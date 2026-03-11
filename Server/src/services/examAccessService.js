const ExamSession = require("../models/ExamSession");
const GroupMember = require("../models/GroupMember");

function getExamWindow(exam) {
  const start = new Date(exam.startTime).getTime();
  const end = start + Number(exam.duration) * 60 * 1000;
  return { start, end };
}

function deriveExamStatus(exam, now = Date.now()) {
  const { start, end } = getExamWindow(exam);

  if (!exam.published) {
    return "Draft";
  }

  if (now < start) {
    return "Scheduled";
  }

  if (now >= start && now <= end) {
    return "Active";
  }

  return exam.resultsPublished || exam.resultVisibility === "immediate"
    ? "Completed"
    : "Ended";
}

function serializeExamWithDerivedStatus(exam, now = Date.now()) {
  const payload =
    exam && typeof exam.toObject === "function" ? exam.toObject() : { ...exam };

  return {
    ...payload,
    status: deriveExamStatus(exam, now),
  };
}

function serializeExamListWithDerivedStatus(exams = [], now = Date.now()) {
  return exams.map((exam) => serializeExamWithDerivedStatus(exam, now));
}

async function syncExamStatus(exam) {
  const nextStatus = deriveExamStatus(exam);

  if (nextStatus !== exam.status) {
    exam.status = nextStatus;
    await exam.save();
  }

  return exam;
}

async function ensureExamMembership({ userId, groupId }) {
  const membership = await GroupMember.findOne({ userId, groupId });
  if (membership) return membership;

  // If not a member, check if user is the admin/creator of the group
  const Group = require("../models/Group");
  const group = await Group.findById(groupId);
  if (group && group.createdBy.toString() === userId.toString()) {
    return { role: 'admin', userId, groupId }; // Dummy membership object for admins
  }

  const err = new Error("You are not a member of this exam's group");
  err.statusCode = 403;
  throw err;
}

async function validateExamAccessForStart({ exam, userId }) {
  await ensureExamMembership({ userId, groupId: exam.groupId });

  const now = Date.now();
  const { start, end } = getExamWindow(exam);
  const examStatus = deriveExamStatus(exam, now);

  if (examStatus !== "Active") {
    const err = new Error("Exam is not active");
    err.statusCode = 403;
    throw err;
  }

  if (now < start || now > end) {
    const err = new Error("Exam can only be started within scheduled window");
    err.statusCode = 403;
    throw err;
  }

  const submittedAttempts = await ExamSession.countDocuments({
    exam: exam._id,
    user: userId,
    submitted: true,
  });

  if (!exam.allowRetake && submittedAttempts >= 1) {
    const err = new Error("Student can attempt exam only once");
    err.statusCode = 409;
    throw err;
  }

  if (submittedAttempts >= exam.maxAttempts) {
    const err = new Error(`Maximum attempts (${exam.maxAttempts}) reached`);
    err.statusCode = 409;
    throw err;
  }

  const activeSession = await ExamSession.findOne({
    exam: exam._id,
    user: userId,
    submitted: false,
    status: "active",
  });

  return {
    submittedAttempts,
    activeSession,
    canStart: !activeSession,
    now,
    examStatus,
    examWindow: { start, end },
  };
}

async function getExamLobbyState({ exam, userId }) {
  let membership = null;
  try {
    membership = await ensureExamMembership({ userId, groupId: exam.groupId });
  } catch (err) {
    if (err.statusCode !== 403) throw err;
  }

  const now = Date.now();
  const { start, end } = getExamWindow(exam);
  const examStatus = deriveExamStatus(exam, now);
  const activeSession = membership
    ? await ExamSession.findOne({
      exam: exam._id,
      user: userId,
      submitted: false,
      status: "active",
    })
    : null;
  const submittedAttempts = membership
    ? await ExamSession.countDocuments({
      exam: exam._id,
      user: userId,
      submitted: true,
    })
    : 0;

  const rules = [
    "Join only if you belong to the exam group.",
    "You can start only within the active exam window.",
    "Warnings and disconnects are tracked in real time.",
    "Answers are auto-saved during the exam.",
  ];

  return {
    examId: exam._id,
    title: exam.title,
    description: exam.description,
    duration: exam.duration,
    totalMarks: exam.totalMarks,
    startTime: exam.startTime,
    endTime: new Date(end),
    status: examStatus,
    rules,
    canStart:
      Boolean(membership) &&
      examStatus === "Active" &&
      now >= start &&
      now <= end &&
      submittedAttempts < exam.maxAttempts &&
      !activeSession,
    membership: Boolean(membership),
    attemptsUsed: submittedAttempts,
    maxAttempts: exam.maxAttempts,
    hasActiveSession: Boolean(activeSession),
    activeSessionId: activeSession?._id || null,
    timeWindowOpen: now >= start && now <= end,
  };
}

module.exports = {
  getExamWindow,
  deriveExamStatus,
  serializeExamWithDerivedStatus,
  serializeExamListWithDerivedStatus,
  syncExamStatus,
  ensureExamMembership,
  validateExamAccessForStart,
  getExamLobbyState,
};
