const express = require("express");
const router = express.Router();
const Exam = require("../models/Exam");
const ExamSession = require("../models/ExamSession");
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

function normalizeQuestionPayload({ text, options, correctAnswer }) {
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
  };
}

async function submitSession(exam, session, answers, reason = "manual_submit") {
  if (session.submitted) return session;

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

// get all exams
router.get("/", auth, async (req, res) => {
  try {
    const exams = await Exam.find().sort({ createdAt: -1 });
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
      .populate("exam", "title duration startTime")
      .sort({ updatedAt: -1 });

    const now = Date.now();
    const data = sessions.map((session) => ({
      sessionId: session._id,
      user: session.user,
      exam: session.exam,
      warningsCount: session.warnings.length,
      submitted: session.submitted,
      timeLeftMs: Math.max(0, new Date(session.endTime).getTime() - now),
      lastSeenAt: session.lastSeenAt,
    }));

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ msg: "Failed to load live monitor", error: err.message });
  }
});

// get one exam
router.get("/:id", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });
    res.json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// create exam (admin)
router.post("/", auth, requireRole("admin"), async (req, res) => {
  const { title, duration, startTime } = req.body;
  try {
    const exam = new Exam({
      title,
      duration,
      startTime,
      createdBy: req.user.id,
    });
    await exam.save();
    res.status(201).json(exam);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// add question to exam (admin)
router.post("/:id/questions", auth, requireRole("admin"), async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    const payload = normalizeQuestionPayload(req.body);
    if (!payload.text || payload.options.length < 2 || !payload.correctAnswer) {
      return res.status(400).json({ msg: "Invalid question payload" });
    }

    exam.questions.push(payload);
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

    const ownerId = req.body.clientId || req.header("x-client-id") || req.user.id;
    const { session, timeLeftMs, resumeAnswers, multipleLogin } = await startOrResumeSession({
      exam,
      userId: req.user.id,
      ownerId,
    });

    if (timeLeftMs <= 0 && !session.submitted) {
      await submitSession(exam, session, null, "time_over");
    }

    const fresh = await ExamSession.findById(session._id);

    return res.json({
      sessionId: fresh._id,
      examId: exam._id,
      submitted: fresh.submitted,
      timeLeftMs: getTimeLeftMs(fresh),
      endTime: fresh.endTime,
      warnings: fresh.warnings,
      resumeAnswers,
      multipleLogin,
    });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to start exam", error: err.message });
  }
});

// fetch active session for resume
router.get("/:id/session", auth, async (req, res) => {
  try {
    const session = await ExamSession.findOne({ exam: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ msg: "No session found" });

    return res.json({
      sessionId: session._id,
      examId: session.exam,
      submitted: session.submitted,
      timeLeftMs: getTimeLeftMs(session),
      endTime: session.endTime,
      warnings: session.warnings,
      answers: answersArrayToMap(session.answers),
      resumePoint: session.resumePoint,
    });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to fetch session", error: err.message });
  }
});

// anti-cheat warning endpoint
router.post("/:id/warnings", auth, async (req, res) => {
  try {
    const { type, message } = req.body;
    const session = await ExamSession.findOne({ exam: req.params.id, user: req.user.id });
    if (!session) return res.status(404).json({ msg: "No session found" });

    await appendWarning(
      session,
      type || "warning",
      message || "Suspicious activity detected during exam",
    );

    return res.json({ msg: "Warning stored", warnings: session.warnings });
  } catch (err) {
    return res.status(500).json({ msg: "Failed to store warning", error: err.message });
  }
});

// submit exam answers
router.post("/:id/submit", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    let session = await ExamSession.findOne({ exam: req.params.id, user: req.user.id });
    if (!session) {
      return res.status(404).json({ msg: "No session found. Start exam first." });
    }

    session = await submitSession(exam, session, req.body.answers, "manual_submit");

    return res.json({
      msg: "submitted",
      sessionId: session._id,
      submittedAt: session.submittedAt,
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
      submitted: session.submitted,
      submittedAt: session.submittedAt,
      warnings: session.warnings,
      warningsCount: session.warnings.length,
      timeLeftMs: Math.max(0, new Date(session.endTime).getTime() - now),
      startTime: session.startTime,
      lastSeenAt: session.lastSeenAt,
    }));

    res.json(monitoring);
  } catch (err) {
    res.status(500).json({ msg: "Failed to load monitor", error: err.message });
  }
});

module.exports = router;
