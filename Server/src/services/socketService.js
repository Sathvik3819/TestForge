const jwt = require("jsonwebtoken");
const Exam = require("../models/Exam");
const ExamSession = require("../models/ExamSession");
const GroupMember = require("../models/GroupMember");
const { getJwtSecret } = require("../config/env");
const {
  startOrResumeSession,
  saveAnswers,
  appendWarning,
  getTimeLeftMs,
  markDisconnected,
} = require("./sessionService");
const { enqueueResultProcessing } = require("./resultQueue");
const {
  ensureExamMembership,
  deriveExamStatus,
  getExamWindow,
} = require("./examAccessService");

const disconnectTimers = new Map();
const MONITOR_REFRESH_INTERVAL_TICKS = 5;

function getTokenFromSocket(socket) {
  return (
    socket.handshake?.auth?.token ||
    socket.handshake?.headers?.["x-auth-token"] ||
    socket.handshake?.headers?.authorization?.replace("Bearer ", "")
  );
}

function normalizeAnswersInput(answers) {
  if (!answers) return [];

  if (Array.isArray(answers))
    return answers.filter((item) => item && item.questionId);
  return Object.entries(answers).map(([questionId, answer]) => ({
    questionId,
    answer,
  }));
}

function validateAnswersAgainstExam(exam, answersInput) {
  const normalized = normalizeAnswersInput(answersInput);
  const questionMap = new Map(exam.questions.map((q) => [q._id.toString(), q]));

  const validAnswers = [];
  for (const ans of normalized) {
    const question = questionMap.get(String(ans.questionId));
    if (!question) continue;

    const optionTexts = question.options.map((opt) => opt.text);
    if (!optionTexts.includes(ans.answer)) continue;

    validAnswers.push({ questionId: question._id, answer: ans.answer });
  }

  return validAnswers;
}

async function getMonitorSnapshot(examId) {
  const sessions = await ExamSession.find({ exam: examId })
    .select(
      "user exam status submitted endedReason warnings warningsCount flagged endTime lastSeenAt disconnectedAt",
    )
    .populate("user", "name email role")
    .populate("exam", "title duration startTime status")
    .lean();
  const now = Date.now();
  return sessions.map((session) => ({
    sessionId: session._id,
    user: session.user,
    exam: session.exam,
    status: session.status,
    submitted: session.submitted,
    endedReason: session.endedReason,
    warnings: session.warnings,
    warningsCount: session.warningsCount || session.warnings.length,
    flagged: session.flagged,
    timeLeftMs: Math.max(0, new Date(session.endTime).getTime() - now),
    lastSeenAt: session.lastSeenAt,
    disconnectedAt: session.disconnectedAt,
  }));
}

function clearSocketTimer(socket) {
  if (socket.data.timerInterval) {
    clearInterval(socket.data.timerInterval);
    socket.data.timerInterval = null;
  }
}

function hasMonitorSubscribers(io, examId) {
  return (io.sockets.adapter.rooms.get(`monitor:${examId}`)?.size || 0) > 0;
}

async function loadSocketExam(examId) {
  return Exam.findById(examId)
    .select(
      "groupId startTime duration status published resultVisibility resultsPublished questions",
    )
    .lean();
}

async function getActiveSessionForSocket(socket, examId) {
  if (socket.data.sessionId && socket.data.examId === examId) {
    return ExamSession.findOne({
      _id: socket.data.sessionId,
      user: socket.user.id,
      exam: examId,
      submitted: false,
    });
  }

  return ExamSession.findOne({
    exam: examId,
    user: socket.user.id,
    submitted: false,
  });
}

async function emitMonitorUpdate(io, examId) {
  if (!hasMonitorSubscribers(io, examId)) {
    return;
  }

  const snapshot = await getMonitorSnapshot(examId);
  io.to(`monitor:${examId}`).emit("admin:monitor:update", {
    examId,
    sessions: snapshot,
  });
}

async function submitSession(exam, session, answers, reason) {
  if (session.submitted) {
    return session;
  }

  if (answers) {
    const validAnswers = validateAnswersAgainstExam(exam, answers);
    await saveAnswers(session, validAnswers);
  }

  session.submitted = true;
  session.submittedAt = new Date();
  session.lastSeenAt = new Date();
  session.status = "submitted";
  session.endedReason = reason || "manual_submit";

  if (reason === "time_over") {
    session.warnings.push({
      type: "time_over",
      message: "Exam auto-submitted because time is over",
      at: new Date(),
    });
  }

  session.warningsCount = session.warnings.length;
  if (session.warningsCount > 3) session.flagged = true;

  await session.save();
  console.log("socket submit", {
    examId: exam._id.toString(),
    userId: session.user.toString(),
    sessionId: session._id.toString(),
    reason,
  });

  await enqueueResultProcessing({
    sessionId: session._id.toString(),
    examId: exam._id.toString(),
    userId: session.user.toString(),
  });

  return session;
}

function scheduleDisconnectAutoSubmit(io, exam, session) {
  const key = `${session.exam.toString()}:${session.user.toString()}`;

  if (disconnectTimers.has(key)) {
    clearTimeout(disconnectTimers.get(key));
  }

  const timeout = setTimeout(async () => {
    try {
      const fresh = await ExamSession.findById(session._id);
      if (!fresh || fresh.submitted) return;

      await appendWarning(
        fresh,
        "disconnect_timeout",
        "Auto submit due to prolonged disconnection",
      );
      await submitSession(exam, fresh, null, "disconnect_timeout");
      await emitMonitorUpdate(io, exam._id.toString());
    } catch (err) {
      console.error("disconnect timeout submit failed:", err.message);
    } finally {
      disconnectTimers.delete(key);
    }
  }, 120000);

  disconnectTimers.set(key, timeout);
}

function clearDisconnectAutoSubmit(examId, userId) {
  const key = `${examId}:${userId}`;
  const timeout = disconnectTimers.get(key);
  if (timeout) {
    clearTimeout(timeout);
    disconnectTimers.delete(key);
  }
}

function registerSocketHandlers(io) {
  io.use((socket, next) => {
    try {
      const token = getTokenFromSocket(socket);
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, getJwtSecret());
      socket.user = decoded;
      return next();
    } catch (err) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.data.timerInterval = null;
    socket.data.timerTicks = 0;
    socket.data.exam = null;
    socket.data.endTimeMs = null;

    socket.on("exam:join", async ({ examId, clientId }) => {
      try {
        const exam = await loadSocketExam(examId);
        if (!exam) {
          socket.emit("exam:error", { msg: "Exam not found" });
          return;
        }

        await ensureExamMembership({
          userId: socket.user.id,
          groupId: exam.groupId,
        });

        const { start, end } = getExamWindow(exam);
        const now = Date.now();
        const examStatus = deriveExamStatus(exam, now);
        if (examStatus !== "Active") {
          socket.emit("exam:error", { msg: "Exam is not active" });
          return;
        }
        if (now < start || now > end) {
          socket.emit("exam:error", {
            msg: "Exam can only be joined within scheduled window",
          });
          return;
        }

        const ownerId = clientId || socket.id;
        const { session, timeLeftMs, resumeAnswers, multipleLogin } =
          await startOrResumeSession({
            exam,
            userId: socket.user.id,
            ownerId,
            socketId: socket.id,
          });

        if (multipleLogin) {
          await ExamSession.updateMany(
            {
              exam: examId,
              user: socket.user.id,
              submitted: false,
              _id: { $ne: session._id },
            },
            {
              $set: {
                submitted: true,
                submittedAt: new Date(),
                status: "invalidated",
                isInvalidated: true,
                endedReason: "multiple_login",
              },
            },
          );

          await appendWarning(
            session,
            "multiple_login",
            "Previous session invalidated due to new login",
          );
        }

        clearDisconnectAutoSubmit(exam._id.toString(), socket.user.id);

        socket.data.examId = examId;
        socket.data.sessionId = session._id.toString();
        socket.data.exam = exam;
        socket.data.endTimeMs = new Date(session.endTime).getTime();
        socket.data.timerTicks = 0;
        socket.join(`exam:${examId}`);

        if (timeLeftMs <= 0 && !session.submitted) {
          await submitSession(exam, session, null, "time_over");
        }

        const freshSession = await ExamSession.findById(session._id).select(
          "_id endTime submitted status warnings warningsCount flagged",
        );
        socket.emit("exam:state", {
          sessionId: freshSession._id,
          examId,
          timeLeftMs: getTimeLeftMs(freshSession),
          endTime: freshSession.endTime,
          submitted: freshSession.submitted,
          status: freshSession.status,
          warnings: freshSession.warnings,
          warningsCount: freshSession.warningsCount,
          flagged: freshSession.flagged,
          resumeAnswers,
        });

        clearSocketTimer(socket);

        socket.data.timerInterval = setInterval(async () => {
          try {
            socket.data.timerTicks += 1;
            const timeLeftMsNow = Math.max(
              0,
              (socket.data.endTimeMs || Date.now()) - Date.now(),
            );
            socket.emit("exam:timer", {
              examId,
              sessionId: freshSession._id,
              timeLeftMs: timeLeftMsNow,
              endTime: new Date(socket.data.endTimeMs).toISOString(),
              serverTime: new Date().toISOString(),
            });

            if (timeLeftMsNow <= 0) {
              const liveSession = await ExamSession.findById(freshSession._id);
              if (!liveSession || liveSession.submitted || liveSession.isInvalidated) {
                clearSocketTimer(socket);
                return;
              }

              await submitSession(exam, liveSession, null, "time_over");
              socket.emit("exam:submitted", {
                sessionId: liveSession._id,
                reason: "time_over",
                submittedAt: new Date().toISOString(),
              });
              clearSocketTimer(socket);
              await emitMonitorUpdate(io, examId);
              return;
            }

            if (socket.data.timerTicks % MONITOR_REFRESH_INTERVAL_TICKS === 0) {
              const liveSession = await ExamSession.findById(freshSession._id)
                .select("submitted isInvalidated endTime");

              if (!liveSession || liveSession.submitted || liveSession.isInvalidated) {
                clearSocketTimer(socket);
                return;
              }

              socket.data.endTimeMs = new Date(liveSession.endTime).getTime();
            }
          } catch (timerErr) {
            console.error("Timer sync failed:", timerErr.message);
          }
        }, 1000);

        await emitMonitorUpdate(io, examId);
      } catch (err) {
        socket.emit("exam:error", {
          msg: "Failed to join exam",
          error: err.message,
        });
      }
    });

    const onAnswerUpdate = async ({ examId, answers }) => {
      try {
        const exam =
          socket.data.examId === examId && socket.data.exam
            ? socket.data.exam
            : await loadSocketExam(examId);
        if (!exam) return;

        const session = await getActiveSessionForSocket(socket, examId);
        if (!session || session.isInvalidated) return;

        const validAnswers = validateAnswersAgainstExam(exam, answers);
        await saveAnswers(session, validAnswers);
        socket.emit("exam:ack", {
          ok: true,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        socket.emit("exam:error", {
          msg: "Failed to save answer",
          error: err.message,
        });
      }
    };

    socket.on("exam:answer", onAnswerUpdate);
    socket.on("answer:update", onAnswerUpdate);

    socket.on("exam:warning", async ({ examId, type, message }) => {
      try {
        const session = await getActiveSessionForSocket(socket, examId);
        if (!session) return;

        await appendWarning(
          session,
          type || "warning",
          message || "Suspicious activity detected",
        );

        // refresh session in case appendWarning auto-submitted
        const updated = await ExamSession.findById(session._id);

        socket.emit("exam:warning:ack", {
          ok: true,
          warningsCount: updated.warningsCount,
          flagged: updated.flagged,
        });

        if (updated.submitted) {
          clearSocketTimer(socket);
          socket.emit("exam:submitted", {
            sessionId: updated._id,
            reason: updated.endedReason || "warnings_exceeded",
            submittedAt: updated.submittedAt,
          });
        }

        await emitMonitorUpdate(io, examId);
      } catch (err) {
        socket.emit("exam:error", {
          msg: "Failed to add warning",
          error: err.message,
        });
      }
    });

    socket.on("exam:submit", async ({ examId, answers }) => {
      try {
        const exam =
          socket.data.examId === examId && socket.data.exam
            ? socket.data.exam
            : await loadSocketExam(examId);
        const session = await getActiveSessionForSocket(socket, examId);
        if (!exam || !session) {
          socket.emit("exam:error", { msg: "Session not found" });
          return;
        }

        const submitted = await submitSession(
          exam,
          session,
          answers,
          "manual_submit",
        );
        clearSocketTimer(socket);
        socket.emit("exam:submitted", {
          sessionId: submitted._id,
          submittedAt: submitted.submittedAt,
        });
        await emitMonitorUpdate(io, examId);
      } catch (err) {
        socket.emit("exam:error", { msg: "Submit failed", error: err.message });
      }
    });

    socket.on("admin:join-monitor", async ({ examId }) => {
      try {
        if (socket.user.role !== "admin") {
          socket.emit("exam:error", { msg: "Forbidden: admin only" });
          return;
        }

        const exam = await Exam.findById(examId).select("groupId").lean();
        if (!exam) {
          socket.emit("exam:error", { msg: "Exam not found" });
          return;
        }

        const membership = await GroupMember.findOne({
          userId: socket.user.id,
          groupId: exam.groupId,
          role: "admin",
        });
        if (!membership) {
          socket.emit("exam:error", {
            msg: "Forbidden: not an admin member of this exam group",
          });
          return;
        }

        socket.join(`monitor:${examId}`);
        const snapshot = await getMonitorSnapshot(examId);
        socket.emit("admin:monitor:update", { examId, sessions: snapshot });
      } catch (err) {
        socket.emit("exam:error", {
          msg: "Failed to join monitor",
          error: err.message,
        });
      }
    });

    socket.on("disconnect", async () => {
      try {
        clearSocketTimer(socket);

        if (!socket.data.examId || !socket.user?.id) return;

        const exam = socket.data.exam || { _id: socket.data.examId };

        const session = await getActiveSessionForSocket(socket, socket.data.examId);
        if (!session) return;

        await appendWarning(
          session,
          "disconnect",
          "User disconnected during exam",
        );
        await markDisconnected(session);
        scheduleDisconnectAutoSubmit(io, exam, session);
        await emitMonitorUpdate(io, socket.data.examId);
      } catch (err) {
        console.error("Socket disconnect handler failed:", err.message);
      }
    });
  });
}

module.exports = {
  registerSocketHandlers,
  getMonitorSnapshot,
  emitMonitorUpdate,
  submitSession,
};
