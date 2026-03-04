const jwt = require("jsonwebtoken");
const Exam = require("../models/Exam");
const ExamSession = require("../models/ExamSession");
const {
  startOrResumeSession,
  saveAnswers,
  appendWarning,
  getTimeLeftMs,
  markDisconnected,
} = require("./sessionService");
const { enqueueResultProcessing } = require("./resultQueue");

function getTokenFromSocket(socket) {
  return (
    socket.handshake?.auth?.token ||
    socket.handshake?.headers?.["x-auth-token"] ||
    socket.handshake?.headers?.authorization?.replace("Bearer ", "")
  );
}

async function getMonitorSnapshot(examId) {
  const sessions = await ExamSession.find({ exam: examId }).populate("user", "name email role");
  const now = Date.now();
  return sessions.map((session) => ({
    sessionId: session._id,
    user: session.user,
    submitted: session.submitted,
    warnings: session.warnings,
    warningsCount: session.warnings.length,
    timeLeftMs: Math.max(0, new Date(session.endTime).getTime() - now),
    lastSeenAt: session.lastSeenAt,
    disconnectedAt: session.disconnectedAt,
  }));
}

async function emitMonitorUpdate(io, examId) {
  const snapshot = await getMonitorSnapshot(examId);
  io.to(`monitor:${examId}`).emit("admin:monitor:update", { examId, sessions: snapshot });
}

async function submitSession(exam, session, answers, reason) {
  if (session.submitted) {
    return session;
  }

  if (answers) {
    await saveAnswers(session, answers);
  }

  session.submitted = true;
  session.submittedAt = new Date();
  session.lastSeenAt = new Date();

  if (reason === "time_over") {
    session.warnings.push({
      type: "time_over",
      message: "Exam auto-submitted because time is over",
      at: new Date(),
    });
  }

  await session.save();
  await enqueueResultProcessing({
    sessionId: session._id.toString(),
    examId: exam._id.toString(),
    userId: session.user.toString(),
  });

  return session;
}

function registerSocketHandlers(io) {
  io.use((socket, next) => {
    try {
      const token = getTokenFromSocket(socket);
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
      socket.user = decoded;
      return next();
    } catch (err) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.data.timerInterval = null;

    socket.on("exam:join", async ({ examId, clientId }) => {
      try {
        const exam = await Exam.findById(examId);
        if (!exam) {
          socket.emit("exam:error", { msg: "Exam not found" });
          return;
        }

        const ownerId = clientId || socket.id;
        const { session, timeLeftMs, resumeAnswers } = await startOrResumeSession({
          exam,
          userId: socket.user.id,
          ownerId,
          socketId: socket.id,
        });

        socket.data.examId = examId;
        socket.data.sessionId = session._id.toString();
        socket.join(`exam:${examId}`);

        if (timeLeftMs <= 0 && !session.submitted) {
          await submitSession(exam, session, null, "time_over");
        }

        const freshSession = await ExamSession.findById(session._id);
        socket.emit("exam:state", {
          sessionId: freshSession._id,
          examId,
          timeLeftMs: getTimeLeftMs(freshSession),
          endTime: freshSession.endTime,
          submitted: freshSession.submitted,
          warnings: freshSession.warnings,
          resumeAnswers,
        });

        if (socket.data.timerInterval) {
          clearInterval(socket.data.timerInterval);
        }

        socket.data.timerInterval = setInterval(async () => {
          try {
            const liveSession = await ExamSession.findById(freshSession._id);
            if (!liveSession) return;

            const timeLeftMsNow = getTimeLeftMs(liveSession);
            socket.emit("exam:timer", {
              examId,
              sessionId: liveSession._id,
              timeLeftMs: timeLeftMsNow,
              endTime: liveSession.endTime,
              serverTime: new Date().toISOString(),
            });

            if (liveSession.submitted) {
              clearInterval(socket.data.timerInterval);
              socket.data.timerInterval = null;
              return;
            }

            if (timeLeftMsNow <= 0 && !liveSession.submitted) {
              await submitSession(exam, liveSession, null, "time_over");
              socket.emit("exam:submitted", {
                sessionId: liveSession._id,
                reason: "time_over",
                submittedAt: new Date().toISOString(),
              });
              clearInterval(socket.data.timerInterval);
              socket.data.timerInterval = null;
              await emitMonitorUpdate(io, examId);
            }
          } catch (timerErr) {
            console.error("Timer sync failed:", timerErr.message);
          }
        }, 1000);

        await emitMonitorUpdate(io, examId);
      } catch (err) {
        socket.emit("exam:error", { msg: "Failed to join exam", error: err.message });
      }
    });

    socket.on("exam:answer", async ({ examId, answers }) => {
      try {
        const session = await ExamSession.findOne({ exam: examId, user: socket.user.id });
        if (!session || session.submitted) return;

        await saveAnswers(session, answers);
        socket.emit("exam:ack", { ok: true, updatedAt: new Date().toISOString() });
      } catch (err) {
        socket.emit("exam:error", { msg: "Failed to save answer", error: err.message });
      }
    });

    socket.on("exam:warning", async ({ examId, type, message }) => {
      try {
        const session = await ExamSession.findOne({ exam: examId, user: socket.user.id });
        if (!session) return;

        await appendWarning(session, type || "warning", message || "Suspicious activity detected");
        socket.emit("exam:warning:ack", { ok: true });
        await emitMonitorUpdate(io, examId);
      } catch (err) {
        socket.emit("exam:error", { msg: "Failed to add warning", error: err.message });
      }
    });

    socket.on("exam:submit", async ({ examId, answers }) => {
      try {
        const exam = await Exam.findById(examId);
        const session = await ExamSession.findOne({ exam: examId, user: socket.user.id });
        if (!exam || !session) {
          socket.emit("exam:error", { msg: "Session not found" });
          return;
        }

        const submitted = await submitSession(exam, session, answers, "manual_submit");
        socket.emit("exam:submitted", { sessionId: submitted._id, submittedAt: submitted.submittedAt });
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

        socket.join(`monitor:${examId}`);
        const snapshot = await getMonitorSnapshot(examId);
        socket.emit("admin:monitor:update", { examId, sessions: snapshot });
      } catch (err) {
        socket.emit("exam:error", { msg: "Failed to join monitor", error: err.message });
      }
    });

    socket.on("disconnect", async () => {
      try {
        if (socket.data.timerInterval) {
          clearInterval(socket.data.timerInterval);
          socket.data.timerInterval = null;
        }

        if (!socket.data.examId || !socket.user?.id) return;

        const session = await ExamSession.findOne({
          exam: socket.data.examId,
          user: socket.user.id,
        });
        if (!session || session.submitted) return;

        await appendWarning(session, "disconnect", "User disconnected during exam");
        await markDisconnected(session);
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
