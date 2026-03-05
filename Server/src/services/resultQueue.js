const Bull = require("bull");
const ExamSession = require("../models/ExamSession");
const Exam = require("../models/Exam");
const Result = require("../models/Result");
const { getBullRedisOptions } = require("./redisClient");
const { logResultGenerated } = require("./auditLog");

let resultQueue = null;
let workerStarted = false;

function getResultQueue() {
  if (!resultQueue) {
    resultQueue = new Bull("result_processing_queue", {
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
    (session.answers || []).map((item) => [
      item.questionId.toString(),
      item.answer,
    ]),
  );

  // Calculate score using formula: (correct_answers × marks) - (wrong_answers × negative_marks)
  let totalScore = 0;
  let correctCount = 0;
  let wrongCount = 0;

  exam.questions.forEach((question) => {
    const answer = answerMap.get(question._id.toString());
    const isCorrect =
      answer && String(answer).trim() === String(question.correctAnswer).trim();

    if (isCorrect) {
      totalScore += Number(question.marks || 1);
      correctCount += 1;
    } else {
      // Apply negative marking only if an answer was given
      if (answer) {
        totalScore -= Number(question.negativeMarks || 0);
        wrongCount += 1;
      } else {
        // Unanswered questions don't get negative marks
      }
    }
  });

  // Ensure score doesn't go below 0
  const score = Math.max(0, totalScore);
  const total = exam.questions.length;
  const percentage =
    exam.totalMarks > 0
      ? Number(((score / exam.totalMarks) * 100).toFixed(2))
      : 0;

  const timeTakenSeconds = session.submittedAt
    ? Math.max(
        0,
        Math.round(
          (new Date(session.submittedAt).getTime() -
            new Date(session.startTime).getTime()) /
            1000,
        ),
      )
    : 0;

  const result = await Result.findOneAndUpdate(
    { session: session._id },
    {
      session: session._id,
      user: session.user,
      exam: session.exam,
      score,
      correctAnswers: correctCount,
      wrongAnswers: wrongCount,
      total,
      percentage,
      timeTakenSeconds,
      warningsCount: session.warnings.length,
      processedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  session.resultProcessed = true;
  session.archivedAt = new Date();
  await session.save();

  const shouldComplete =
    exam.resultVisibility === "immediate" ||
    exam.resultsPublished ||
    exam.status === "Ended";
  if (shouldComplete && exam.status !== "Completed") {
    exam.status = "Completed";
    await exam.save();
  }

  // Log result generated
  logResultGenerated(
    session._id.toString(),
    exam._id.toString(),
    session.user.toString(),
    score,
    exam.totalMarks,
    percentage,
  );

  console.log("result generated", {
    sessionId: session._id.toString(),
    examId: exam._id.toString(),
    userId: session.user.toString(),
    score,
    total,
  });

  return result;
}

async function enqueueResultProcessing({ sessionId, examId, userId }) {
  try {
    const queue = getResultQueue();
    await queue.add("calculate-result", { sessionId, examId, userId });
  } catch (err) {
    console.error(
      "Queue unavailable, falling back to inline result calculation:",
      err.message,
    );
    await calculateResult(sessionId);
  }
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
