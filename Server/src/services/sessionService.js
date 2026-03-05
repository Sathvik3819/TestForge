const ExamSession = require("../models/ExamSession");
const { ensureRedisConnection } = require("./redisClient");

const TIMER_KEY_PREFIX = "exam_timer:";
const LOCK_KEY_PREFIX = "session:";
const USER_STATE_PREFIX = "session:";
const WARNING_KEY_PREFIX = "warnings:";

async function tryGetRedis() {
  try {
    return await ensureRedisConnection();
  } catch (err) {
    return null;
  }
}

function normalizeAnswers(answers) {
  if (!answers) return [];

  if (Array.isArray(answers)) {
    return answers
      .filter((item) => item && item.questionId)
      .map((item) => ({
        questionId: item.questionId,
        answer: item.answer ?? "",
      }));
  }

  return Object.entries(answers).map(([questionId, answer]) => ({
    questionId,
    answer,
  }));
}

function answersArrayToMap(answersArray = []) {
  return answersArray.reduce((acc, item) => {
    acc[item.questionId?.toString()] = item.answer;
    return acc;
  }, {});
}

function getSessionLockKey(examId, userId) {
  return `${LOCK_KEY_PREFIX}${userId}:${examId}`;
}

function getUserStateKey(examId, userId) {
  return `${USER_STATE_PREFIX}${userId}:${examId}:state`;
}

function getTimerKey(examId) {
  return `${TIMER_KEY_PREFIX}${examId}`;
}

function getWarningKey(userId) {
  return `${WARNING_KEY_PREFIX}${userId}`;
}

async function getOrCreateExamEndTimeMs(exam) {
  const baseStart = exam.startTime
    ? new Date(exam.startTime).getTime()
    : Date.now();
  const endTimeMs = baseStart + Number(exam.duration) * 60 * 1000;
  const redis = await tryGetRedis();
  if (!redis) return endTimeMs;

  const key = getTimerKey(exam._id.toString());
  const cached = await redis.get(key);
  if (cached) return Number(cached);

  const ttlSeconds = Math.max(3600, Number(exam.duration) * 60 + 86400);

  await redis.set(key, String(endTimeMs), {
    NX: true,
    EX: ttlSeconds,
  });

  const finalCached = await redis.get(key);
  return Number(finalCached || endTimeMs);
}

async function markUserState(examId, userId, payload) {
  const redis = await tryGetRedis();
  if (!redis) return;
  await redis.set(getUserStateKey(examId, userId), JSON.stringify(payload), {
    EX: 24 * 60 * 60,
  });
}

async function applySessionLock(examId, userId, ownerId) {
  const redis = await tryGetRedis();
  if (!redis) return { multipleLogin: false, existingOwner: null };

  const key = getSessionLockKey(examId, userId);
  const existingOwner = await redis.get(key);
  const multipleLogin = Boolean(existingOwner && existingOwner !== ownerId);

  await redis.set(key, ownerId, { EX: 12 * 60 * 60 });

  return { multipleLogin, existingOwner };
}

async function appendWarning(session, type, message) {
  session.warnings.push({
    type,
    message,
    at: new Date(),
  });
  session.warningsCount = session.warnings.length;
  if (session.warningsCount > 3) {
    session.flagged = true;
  }
  await session.save();

  // if crossing threshold, automatically submit with zero score
  if (session.warningsCount > 3 && !session.submitted) {
    try {
      const Exam = require("../models/Exam");
      const { enqueueResultProcessing } = require("./resultQueue");
      const { logExamSubmitted } = require("./auditLog");

      const exam = await Exam.findById(session.exam);
      if (exam) {
        session.answers = [];
        session.submitted = true;
        session.submittedAt = new Date();
        session.lastSeenAt = new Date();
        session.status = "submitted";
        session.endedReason = "warnings_exceeded";
        await session.save();

        enqueueResultProcessing({
          sessionId: session._id.toString(),
          examId: exam._id.toString(),
          userId: session.user.toString(),
        });
        logExamSubmitted(
          session._id.toString(),
          exam._id.toString(),
          session.user.toString(),
          "warnings_exceeded",
          session.warningsCount,
        );
      }
    } catch (err) {
      console.error("failed auto-submit in appendWarning", err.message);
    }
  }

  const redis = await tryGetRedis();
  if (redis) {
    const key = getWarningKey(session.user.toString());
    const warning = JSON.stringify({
      examId: session.exam.toString(),
      type,
      message,
      at: new Date(),
    });
    await redis.rPush(key, warning);
    await redis.expire(key, 7 * 24 * 60 * 60);
  }
}

async function saveAnswers(session, answersInput) {
  if (
    session.submitted ||
    session.status !== "active" ||
    session.isInvalidated
  ) {
    return session;
  }

  const normalized = normalizeAnswers(answersInput);
  if (!normalized.length) return session;

  const current = new Map(
    (session.answers || []).map((item) => [
      item.questionId.toString(),
      item.answer,
    ]),
  );

  normalized.forEach((item) => {
    current.set(item.questionId.toString(), item.answer);
  });

  session.answers = Array.from(current.entries()).map(
    ([questionId, answer]) => ({
      questionId,
      answer,
    }),
  );

  const last = normalized[normalized.length - 1];
  session.resumePoint = {
    lastQuestionId: last.questionId,
    lastAnswer: last.answer,
    updatedAt: new Date(),
  };
  session.lastSeenAt = new Date();
  await session.save();

  return session;
}

function getTimeLeftMs(session) {
  return Math.max(0, new Date(session.endTime).getTime() - Date.now());
}

async function startOrResumeSession({
  exam,
  userId,
  ownerId,
  socketId = null,
}) {
  const endTimeMs = await getOrCreateExamEndTimeMs(exam);
  const { multipleLogin } = await applySessionLock(
    exam._id.toString(),
    userId.toString(),
    ownerId,
  );

  let session = await ExamSession.findOne({
    exam: exam._id,
    user: userId,
    submitted: false,
  });
  if (!session) {
    const existingCount = await ExamSession.countDocuments({
      exam: exam._id,
      user: userId,
    });
    session = await ExamSession.create({
      user: userId,
      exam: exam._id,
      startTime: new Date(),
      endTime: new Date(endTimeMs),
      warnings: [],
      submitted: false,
      answers: [],
      attemptNo: existingCount + 1,
      status: "active",
      isInvalidated: false,
    });
  } else {
    if (session.isInvalidated) {
      throw new Error("Session invalidated due to multiple login");
    }
    session.endTime = new Date(endTimeMs);
    session.lastSeenAt = new Date();
    session.disconnectedAt = null;
    session.status = "active";
  }

  if (socketId) {
    session.activeSocketId = socketId;
  }

  await session.save();
  await markUserState(exam._id.toString(), userId.toString(), {
    online: true,
    ownerId,
    socketId,
    sessionId: session._id.toString(),
    updatedAt: new Date().toISOString(),
  });

  if (multipleLogin) {
    await appendWarning(
      session,
      "multiple_login",
      "Multiple active login detected",
    );
  }

  return {
    session,
    timeLeftMs: getTimeLeftMs(session),
    multipleLogin,
    resumeAnswers: answersArrayToMap(session.answers),
  };
}

async function markDisconnected(session) {
  if (session.submitted) return;
  session.disconnectedAt = new Date();
  session.lastSeenAt = new Date();
  await session.save();

  await markUserState(session.exam.toString(), session.user.toString(), {
    online: false,
    updatedAt: new Date().toISOString(),
  });
}

module.exports = {
  normalizeAnswers,
  answersArrayToMap,
  getOrCreateExamEndTimeMs,
  startOrResumeSession,
  saveAnswers,
  appendWarning,
  getTimeLeftMs,
  markDisconnected,
  markUserState,
  getSessionLockKey,
};
