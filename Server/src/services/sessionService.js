const ExamSession = require("../models/ExamSession");
const { ensureRedisConnection } = require("./redisClient");

const TIMER_KEY_PREFIX = "exam:timer:";
const LOCK_KEY_PREFIX = "exam:lock:";
const USER_STATE_PREFIX = "exam:userstate:";

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
  return `${LOCK_KEY_PREFIX}${examId}:${userId}`;
}

function getUserStateKey(examId, userId) {
  return `${USER_STATE_PREFIX}${examId}:${userId}`;
}

function getTimerKey(examId) {
  return `${TIMER_KEY_PREFIX}${examId}`;
}

async function getOrCreateExamEndTimeMs(exam) {
  const baseStart = exam.startTime ? new Date(exam.startTime).getTime() : Date.now();
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
  await redis.set(getUserStateKey(examId, userId), JSON.stringify(payload), { EX: 24 * 60 * 60 });
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
  await session.save();
}

async function saveAnswers(session, answersInput) {
  const normalized = normalizeAnswers(answersInput);
  if (!normalized.length) return session;

  const current = new Map(
    (session.answers || []).map((item) => [item.questionId.toString(), item.answer]),
  );

  normalized.forEach((item) => {
    current.set(item.questionId.toString(), item.answer);
  });

  session.answers = Array.from(current.entries()).map(([questionId, answer]) => ({
    questionId,
    answer,
  }));

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

async function startOrResumeSession({ exam, userId, ownerId, socketId = null }) {
  const endTimeMs = await getOrCreateExamEndTimeMs(exam);
  const { multipleLogin } = await applySessionLock(exam._id.toString(), userId.toString(), ownerId);

  let session = await ExamSession.findOne({ exam: exam._id, user: userId });
  if (!session) {
    session = await ExamSession.create({
      user: userId,
      exam: exam._id,
      startTime: new Date(),
      endTime: new Date(endTimeMs),
      warnings: [],
      submitted: false,
      answers: [],
    });
  } else {
    session.endTime = new Date(endTimeMs);
    session.lastSeenAt = new Date();
    session.disconnectedAt = null;
  }

  if (socketId) {
    session.activeSocketId = socketId;
  }

  await session.save();
  await markUserState(exam._id.toString(), userId.toString(), {
    online: true,
    ownerId,
    socketId,
    updatedAt: new Date().toISOString(),
  });

  if (multipleLogin) {
    await appendWarning(session, "multiple_login", "Multiple active login detected");
  }

  return {
    session,
    timeLeftMs: getTimeLeftMs(session),
    multipleLogin,
    resumeAnswers: answersArrayToMap(session.answers),
  };
}

async function markDisconnected(session) {
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
};
