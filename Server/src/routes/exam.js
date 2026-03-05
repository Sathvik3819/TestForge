const express = require("express");
const router = express.Router();
const Exam = require("../models/Exam");
const ExamSession = require("../models/ExamSession");
const Result = require("../models/Result");
const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");
const {
  startOrResumeSession,
  saveAnswers,
  appendWarning,
  getTimeLeftMs,
  answersArrayToMap,
} = require("../services/sessionService");
const { enqueueResultProcessing } = require("../services/resultQueue");
const {
  logExamCreated,
  logExamPublished,
  logQuestionAdded,
  logExamStarted,
  logStudentWarning,
  logExamSubmitted,
  logMultipleLogin,
  logFlaggedAttempt,
} = require("../services/auditLog");

function normalizeQuestionPayload({
  text,
  options,
  correctAnswer,
  marks,
  negativeMarks,
}) {
  const optionTexts = (options || [])
    .map((option) => {
      if (typeof option === "string") return option.trim();
      if (option && typeof option.text === "string") return option.text.trim();
      return "";
    })
    .filter(Boolean);

  return {
    text: String(text || "").trim(),
    options: optionTexts.map((value) => ({ text: value })),
    correctAnswer: String(correctAnswer || "").trim(),
    marks: Number(marks || 1),
    negativeMarks: Number(negativeMarks || 0),
  };
}

function normalizeAnswersInput(answers) {
  if (!answers) return [];

  if (Array.isArray(answers)) {
    return answers.filter((item) => item && item.questionId);
  }

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

function getExamWindow(exam) {
  const start = new Date(exam.startTime).getTime();
  const end = start + Number(exam.duration) * 60 * 1000;
  return { start, end };
}

async function syncExamStatus(exam) {
  const now = Date.now();
  const { start, end } = getExamWindow(exam);

  let nextStatus = exam.status;
  if (!exam.published) {
    nextStatus = "Draft";
  } else if (now < start) {
    nextStatus = "Scheduled";
  } else if (now >= start && now <= end) {
    nextStatus = "Active";
  } else if (now > end) {
    nextStatus =
      exam.resultsPublished || exam.resultVisibility === "immediate"
        ? "Completed"
        : "Ended";
  }

  if (nextStatus !== exam.status) {
    exam.status = nextStatus;
    await exam.save();
  }

  return exam;
}

function validateExamCreatePayload(payload) {
  const errors = [];

  if (!payload.title) errors.push("Exam title is required");
  if (!payload.description) errors.push("Description is required");
  if (!payload.startTime) errors.push("Start time is required");
  if (!payload.duration) errors.push("Duration is required");
  if (!payload.totalMarks) errors.push("Total marks is required");
  if (!payload.numberOfQuestions)
    errors.push("Number of questions is required");

  const start = new Date(payload.startTime).getTime();
  if (!Number.isFinite(start) || start <= Date.now()) {
    errors.push("Exam cannot start in the past");
  }

  const duration = Number(payload.duration);
  if (!Number.isFinite(duration) || duration < 10 || duration > 180) {
    errors.push("Duration must be between 10 and 180 minutes");
  }

  const numQuestions = Number(payload.numberOfQuestions);
  if (!Number.isFinite(numQuestions) || numQuestions < 1) {
    errors.push("At least 1 question is required");
  }

  return errors;
}

async function invalidateOtherActiveSessions({
  examId,
  userId,
  keepSessionId,
}) {
  await ExamSession.updateMany(
    {
      exam: examId,
      user: userId,
      submitted: false,
      _id: { $ne: keepSessionId },
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
}

async function submitSession(exam, session, answers, reason = "manual_submit") {
  if (session.submitted) return session;

  // if submitting due to excessive warnings ensure no answers retained
  if (reason === "warnings_exceeded") {
    session.answers = [];
    answers = [];
  }

  if (answers) {
    const validAnswers = validateAnswersAgainstExam(exam, answers);
    await saveAnswers(session, validAnswers);
  }

  session.submitted = true;
  session.submittedAt = new Date();
  session.lastSeenAt = new Date();
  session.status = "submitted";
  session.endedReason = reason;

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
  console.log("exam submission", {
    examId: exam._id.toString(),
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

// get all exams
router.get("/", auth, async (req, res) => {
  try {
    const query = req.user.role === "admin" ? {} : { published: true };
    const exams = await Exam.find(query).sort({ createdAt: -1 });

    for (const exam of exams) {
      await syncExamStatus(exam);
    }

    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// live monitoring dashboard across exams (admin)
router.get("/monitor/live", auth, requireRole("admin"), async (req, res) => {
  try {
    const sessions = await ExamSession.find({ submitted: false })
      .populate("user", "name email role")
      .populate("exam", "title duration startTime status")
      .sort({ updatedAt: -1 });

    const now = Date.now();
    const data = sessions.map((session) => ({
      sessionId: session._id,
      user: session.user,
      exam: session.exam,
      status: session.status,
      warningsCount: session.warningsCount || session.warnings.length,
      flagged: session.flagged,
      submitted: session.submitted,
      timeLeftMs: Math.max(0, new Date(session.endTime).getTime() - now),
      lastSeenAt: session.lastSeenAt,
    }));

    return res.json(data);
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to load live monitor", error: err.message });
  }
});

// student result dashboard
router.get("/results/me", auth, async (req, res) => {
  try {
    const results = await Result.find({ user: req.user.id })
      .populate(
        "exam",
        "title duration startTime resultVisibility resultsPublished",
      )
      .populate("session", "endedReason")
      .sort({ createdAt: -1 });

    const visibleResults = results.filter((result) => {
      if (!result.exam) return false;
      return (
        result.exam.resultVisibility === "immediate" ||
        result.exam.resultsPublished
      );
    });

    return res.json(visibleResults);
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to load results", error: err.message });
  }
});

// admin result dashboard summary
router.get(
  "/results/admin/summary",
  auth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const [topPerformers, avgRows, examStats] = await Promise.all([
        Result.find()
          .populate("user", "name email")
          .populate("exam", "title")
          .sort({ percentage: -1, timeTakenSeconds: 1, submittedAt: 1 })
          .limit(10),
        Result.aggregate([
          {
            $group: {
              _id: null,
              averageScore: { $avg: "$percentage" },
              attempts: { $sum: 1 },
            },
          },
        ]),
        Result.aggregate([
          {
            $group: {
              _id: "$exam",
              averageScore: { $avg: "$percentage" },
              attempts: { $sum: 1 },
              avgTimeTaken: { $avg: "$timeTakenSeconds" },
            },
          },
        ]),
      ]);

      return res.json({
        averageScore: avgRows[0]?.averageScore || 0,
        attempts: avgRows[0]?.attempts || 0,
        topPerformers,
        examStats,
      });
    } catch (err) {
      return res.status(500).json({
        msg: "Failed to load admin result summary",
        error: err.message,
      });
    }
  },
);

// get one exam
router.get("/:id", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });
    await syncExamStatus(exam);

    if (!exam.published && req.user.role !== "admin") {
      return res.status(403).json({ msg: "Exam is not published yet" });
    }

    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// create exam (admin)
router.post("/", auth, requireRole("admin"), async (req, res) => {
  const {
    title,
    description,
    duration,
    startTime,
    totalMarks,
    numberOfQuestions,
    marksPerQuestion,
    negativeMarking,
    price,
    resultVisibility,
    maxAttempts,
    allowRetake,
  } = req.body;

  try {
    const validationErrors = validateExamCreatePayload({
      title,
      description,
      duration,
      startTime,
      totalMarks,
      numberOfQuestions,
    });
    if (validationErrors.length) {
      return res
        .status(400)
        .json({ msg: validationErrors[0], errors: validationErrors });
    }

    const exam = new Exam({
      title,
      description,
      duration: Number(duration),
      startTime,
      totalMarks: Number(totalMarks),
      numberOfQuestions: Number(numberOfQuestions),
      marksPerQuestion: Number(marksPerQuestion || 1),
      negativeMarking: Number(negativeMarking || 0),
      price: Number(price || 0),
      resultVisibility:
        resultVisibility === "delayed" ? "delayed" : "immediate",
      maxAttempts: Number(maxAttempts || 1),
      allowRetake: Boolean(allowRetake),
      createdBy: req.user.id,
      published: false,
      status: "Draft",
    });
    await exam.save();

    // Log exam creation
    logExamCreated(exam._id.toString(), req.user.id, {
      title,
      duration,
      totalMarks,
      numberOfQuestions,
    });

    res.status(201).json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// publish exam (admin)
router.patch("/:id/publish", auth, requireRole("admin"), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    if ((exam.questions || []).length < 1) {
      return res
        .status(400)
        .json({ msg: "At least 1 question required before publish" });
    }

    exam.numberOfQuestions = exam.questions.length;
    exam.published = true;
    exam.publishedAt = new Date();
    await syncExamStatus(exam);

    // Log exam published
    logExamPublished(exam._id.toString(), req.user.id, exam.questions.length);

    return res.json({ msg: "Exam published", exam });
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to publish exam", error: err.message });
  }
});

// update exam (admin)
router.patch("/:id", auth, requireRole("admin"), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    const updates = {};
    const allowedFields = [
      "title",
      "description",
      "duration",
      "startTime",
      "totalMarks",
      "marksPerQuestion",
      "negativeMarking",
      "price",
      "resultVisibility",
      "maxAttempts",
      "allowRetake",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ msg: "No valid fields to update" });
    }

    const updatedExam = await Exam.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });

    logExamCreated(
      updatedExam._id.toString(),
      req.user.id,
      updatedExam.title,
      "updated",
    );

    return res.json(updatedExam);
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to update exam", error: err.message });
  }
});

// publish delayed results (admin)
router.patch(
  "/:id/results/publish",
  auth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const exam = await Exam.findById(req.params.id);
      if (!exam) return res.status(404).json({ msg: "Exam not found" });

      exam.resultsPublished = true;
      await syncExamStatus(exam);

      return res.json({ msg: "Results published", examId: exam._id });
    } catch (err) {
      return res
        .status(500)
        .json({ msg: "Failed to publish results", error: err.message });
    }
  },
);

// add question to exam (admin)
router.post("/:id/questions", auth, requireRole("admin"), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });
    await syncExamStatus(exam);

    if (["Active", "Ended", "Completed"].includes(exam.status)) {
      return res
        .status(400)
        .json({ msg: "Questions cannot be edited after exam starts" });
    }

    const payload = normalizeQuestionPayload(req.body);
    if (!payload.text || payload.options.length < 2 || !payload.correctAnswer) {
      return res.status(400).json({ msg: "Invalid question payload" });
    }

    if (payload.marks <= 0) {
      return res.status(400).json({ msg: "Marks must be positive" });
    }

    if (
      !payload.options.some((option) => option.text === payload.correctAnswer)
    ) {
      return res
        .status(400)
        .json({ msg: "Correct answer must match one option" });
    }

    exam.questions.push(payload);
    exam.numberOfQuestions = exam.questions.length;
    await exam.save();
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// start or resume exam session
router.post("/:id/start", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });
    await syncExamStatus(exam);

    const now = Date.now();
    const { start, end } = getExamWindow(exam);

    if (exam.status !== "Active") {
      return res.status(403).json({ msg: "Exam is not active" });
    }

    if (now < start || now > end) {
      return res
        .status(403)
        .json({ msg: "Exam can only be started within scheduled window" });
    }

    const submittedAttempts = await ExamSession.countDocuments({
      exam: exam._id,
      user: req.user.id,
      submitted: true,
    });

    if (!exam.allowRetake && submittedAttempts >= 1) {
      return res
        .status(409)
        .json({ msg: "Student can attempt exam only once" });
    }

    if (submittedAttempts >= exam.maxAttempts) {
      return res
        .status(409)
        .json({ msg: `Maximum attempts (${exam.maxAttempts}) reached` });
    }

    const ownerId =
      req.body.clientId || req.header("x-client-id") || req.user.id;
    const { session, timeLeftMs, resumeAnswers, multipleLogin } =
      await startOrResumeSession({
        exam,
        userId: req.user.id,
        ownerId,
      });

    if (multipleLogin) {
      await invalidateOtherActiveSessions({
        examId: exam._id,
        userId: req.user.id,
        keepSessionId: session._id,
      });
      await appendWarning(
        session,
        "multiple_login",
        "Previous session invalidated due to new login",
      );

      // Log multiple login
      logMultipleLogin(
        exam._id.toString(),
        req.user.id,
        undefined,
        session._id.toString(),
      );
    }

    if (timeLeftMs <= 0 && !session.submitted) {
      await submitSession(exam, session, null, "time_over");
    }

    const fresh = await ExamSession.findById(session._id);

    // Log exam started
    logExamStarted(fresh._id.toString(), exam._id.toString(), req.user.id);

    return res.json({
      sessionId: fresh._id,
      examId: exam._id,
      submitted: fresh.submitted,
      timeLeftMs: getTimeLeftMs(fresh),
      endTime: fresh.endTime,
      warnings: fresh.warnings,
      resumeAnswers,
      multipleLogin,
      status: fresh.status,
      flagged: fresh.flagged,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to start exam", error: err.message });
  }
});

// fetch active session for resume
router.get("/:id/session", auth, async (req, res) => {
  try {
    const session = await ExamSession.findOne({
      exam: req.params.id,
      user: req.user.id,
    }).sort({ createdAt: -1 });
    if (!session) return res.status(404).json({ msg: "No session found" });

    return res.json({
      sessionId: session._id,
      examId: session.exam,
      submitted: session.submitted,
      status: session.status,
      flagged: session.flagged,
      attemptNo: session.attemptNo,
      timeLeftMs: getTimeLeftMs(session),
      endTime: session.endTime,
      warnings: session.warnings,
      answers: answersArrayToMap(session.answers),
      resumePoint: session.resumePoint,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to fetch session", error: err.message });
  }
});

// auto-save answers
router.post("/:id/answers", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    const session = await ExamSession.findOne({
      exam: req.params.id,
      user: req.user.id,
      submitted: false,
    });
    if (!session)
      return res.status(404).json({ msg: "No active session found" });

    const validAnswers = validateAnswersAgainstExam(exam, req.body.answers);
    await saveAnswers(session, validAnswers);

    return res.json({ msg: "answers saved", count: validAnswers.length });
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to autosave answers", error: err.message });
  }
});

// anti-cheat warning endpoint
router.post("/:id/warnings", auth, async (req, res) => {
  try {
    const { type, message } = req.body;
    const session = await ExamSession.findOne({
      exam: req.params.id,
      user: req.user.id,
      submitted: false,
    });
    if (!session)
      return res.status(404).json({ msg: "No active session found" });

    await appendWarning(
      session,
      type || "warning",
      message || "Suspicious activity detected during exam",
    );

    // Log student warning
    logStudentWarning(
      session._id.toString(),
      req.params.id,
      req.user.id,
      type || "warning",
    );

    if (session.warningsCount > 3) {
      session.flagged = true;
      await session.save();

      // Log flagged attempt
      logFlaggedAttempt(
        session._id.toString(),
        req.params.id,
        req.user.id,
        session.warningsCount,
      );

      // fetch exam and auto-submit zero-score result
      try {
        const exam = await Exam.findById(req.params.id);
        if (exam) {
          // clear any answers and submit immediately
          session.answers = [];
          await submitSession(exam, session, [], "warnings_exceeded");
        }
      } catch (e) {
        console.error("auto-submit failed for session", session._id, e.message);
      }
    }

    return res.json({
      msg: "Warning stored",
      warnings: session.warnings,
      flagged: session.flagged,
      submitted: session.submitted,
      endedReason: session.endedReason,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to store warning", error: err.message });
  }
});

// submit exam answers
router.post("/:id/submit", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    let session = await ExamSession.findOne({
      exam: req.params.id,
      user: req.user.id,
      submitted: false,
    });
    if (!session) {
      return res
        .status(404)
        .json({ msg: "No active session found. Start exam first." });
    }

    const reason = req.body.reason || "manual_submit";
    const validAnswers = validateAnswersAgainstExam(exam, req.body.answers);
    session = await submitSession(exam, session, validAnswers, reason);

    // Log exam submitted
    logExamSubmitted(
      session._id.toString(),
      exam._id.toString(),
      req.user.id,
      reason,
      session.warningsCount,
    );

    return res.json({
      msg: "submitted",
      sessionId: session._id,
      submittedAt: session.submittedAt,
      flagged: session.flagged,
      warningsCount: session.warningsCount,
    });
  } catch (err) {
    return res.status(500).json({ msg: "Submit failed", error: err.message });
  }
});

// live monitoring dashboard (admin)
router.get("/:id/monitor", auth, requireRole("admin"), async (req, res) => {
  try {
    const sessions = await ExamSession.find({ exam: req.params.id })
      .populate("user", "name email role")
      .sort({ createdAt: -1 });

    const now = Date.now();
    const monitoring = sessions.map((session) => ({
      sessionId: session._id,
      user: session.user,
      status: session.status,
      submitted: session.submitted,
      submittedAt: session.submittedAt,
      warnings: session.warnings,
      warningsCount: session.warningsCount || session.warnings.length,
      flagged: session.flagged,
      timeLeftMs: Math.max(0, new Date(session.endTime).getTime() - now),
      startTime: session.startTime,
      lastSeenAt: session.lastSeenAt,
    }));

    res.json(monitoring);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load monitor", error: err.message });
  }
});

// leaderboard/ranking
router.get("/:id/leaderboard", auth, requireRole("admin"), async (req, res) => {
  try {
    const results = await Result.find({ exam: req.params.id })
      .populate("user", "name email")
      .sort({ score: -1, timeTakenSeconds: 1, processedAt: 1 });

    const leaderboard = results.map((result, idx) => ({
      rank: idx + 1,
      name: result.user?.name || result.user?.email || "Student",
      score: result.score,
      percentage: result.percentage,
      timeTakenSeconds: result.timeTakenSeconds,
    }));

    return res.json(leaderboard);
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to load leaderboard", error: err.message });
  }
});

// get detailed results for a specific exam (for current user or admin)
router.get("/:id/results", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    // Check visibility for non-admin users
    if (req.user.role !== "admin") {
      if (!exam.published) {
        return res.status(403).json({ msg: "Exam not available" });
      }
    }

    // Get result for current user
    const result = await Result.findOne({
      exam: req.params.id,
      user: req.user.id,
    }).populate("session");

    if (!result) {
      return res.status(404).json({ msg: "Result not found for this user" });
    }

    // Check if results are visible
    if (req.user.role !== "admin") {
      if (
        result.exam.resultVisibility === "delayed" &&
        !result.exam.resultsPublished
      ) {
        return res.status(403).json({ msg: "Results are not yet published" });
      }
    }

    // Get the exam session with answers
    const session = result.session;

    // Build response sheet with each question and answer details
    const responseSheet = exam.questions.map((question) => {
      const sessionAnswer = session.answers?.find(
        (a) => a.questionId?.toString() === question._id?.toString(),
      );
      const userAnswer = sessionAnswer?.answer || null;
      const isCorrect = userAnswer === question.correctAnswer;

      return {
        questionId: question._id,
        question: question.text,
        options: question.options.map((opt) => opt.text),
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        marks: question.marks,
        negativeMarks: question.negativeMarks,
        marksObtained: isCorrect
          ? question.marks
          : userAnswer === null
            ? 0
            : -question.negativeMarks,
      };
    });

    const timeTakenMinutes = Math.floor(result.timeTakenSeconds / 60);
    const accuracy = ((result.correctAnswers / result.total) * 100).toFixed(2);

    return res.json({
      examTitle: exam.title,
      score: result.score,
      totalMarks: result.total,
      correctAnswers: result.correctAnswers,
      wrongAnswers: result.wrongAnswers,
      unattempted: result.total - result.correctAnswers - result.wrongAnswers,
      percentage: result.percentage,
      accuracy,
      timeTakenSeconds: result.timeTakenSeconds,
      timeTakenMinutes,
      warningsCount: result.warningsCount,
      responseSheet,
    });
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to load results", error: err.message });
  }
});

module.exports = router;
