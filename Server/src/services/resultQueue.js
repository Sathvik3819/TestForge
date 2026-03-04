const Bull = require("bull");
const ExamSession = require("../models/ExamSession");
const Exam = require("../models/Exam");
const Result = require("../models/Result");
const { getBullRedisOptions } = require("./redisClient");

let resultQueue = null;
let workerStarted = false;

function getResultQueue() {
  if (!resultQueue) {
    resultQueue = new Bull("result-processing", {
      redis: getBullRedisOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: true,
      },
    });
  }

  return resultQueue;
}

async function calculateResult(sessionId) {
  const session = await ExamSession.findById(sessionId);
  if (!session) throw new Error("Session not found");

  const exam = await Exam.findById(session.exam);
  if (!exam) throw new Error("Exam not found");

  const answerMap = new Map(
    (session.answers || []).map((item) => [item.questionId.toString(), item.answer]),
  );

  const total = exam.questions.length;
  let score = 0;

  exam.questions.forEach((question) => {
    const answer = answerMap.get(question._id.toString());
    if (answer && String(answer).trim() === String(question.correctAnswer).trim()) {
      score += 1;
    }
  });

  const percentage = total ? Number(((score / total) * 100).toFixed(2)) : 0;

  const result = await Result.findOneAndUpdate(
    { session: session._id },
    {
      session: session._id,
      user: session.user,
      exam: session.exam,
      score,
      total,
      percentage,
      warningsCount: session.warnings.length,
      processedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  session.resultProcessed = true;
  await session.save();

  return result;
}

async function enqueueResultProcessing({ sessionId, examId, userId }) {
  const queue = getResultQueue();
  await queue.add("calculate-result", { sessionId, examId, userId });
}

function startResultWorker() {
  if (workerStarted) return;

  const queue = getResultQueue();
  queue.process("calculate-result", 5, async (job) => {
    return calculateResult(job.data.sessionId);
  });

  queue.on("completed", (job) => {
    console.log(`Result job completed: ${job.id}`);
  });

  queue.on("failed", (job, err) => {
    console.error(`Result job failed: ${job?.id}`, err.message);
  });

  workerStarted = true;
}

module.exports = {
  getResultQueue,
  enqueueResultProcessing,
  startResultWorker,
  calculateResult,
};
