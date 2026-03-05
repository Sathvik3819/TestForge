const fs = require("fs");
const path = require("path");

// Log levels
const LOG_LEVELS = {
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR",
  CRITICAL: "CRITICAL",
  AUDIT: "AUDIT",
};

// Log directory
const logsDir = path.join(__dirname, "../../logs");

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Write audit log entry
 * @param {string} level - Log level (INFO, WARNING, ERROR, CRITICAL, AUDIT)
 * @param {string} action - Action being logged (e.g., "EXAM_CREATED", "STUDENT_WARNED")
 * @param {object} details - Object with relevant details
 */
function auditLog(level, action, details = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    action,
    ...details,
  };

  const logLine = JSON.stringify(logEntry);

  // Determine log file based on level
  const logFile = path.join(
    logsDir,
    `${level.toLowerCase()}-${new Date().toISOString().split("T")[0]}.log`,
  );

  // Write to file (append)
  fs.appendFile(logFile, logLine + "\n", (err) => {
    if (err) console.error("Failed to write audit log:", err.message);
  });

  // Also log to console in development
  if (process.env.NODE_ENV !== "production") {
    console.log(`[${level}] ${action}:`, details);
  }
}

/**
 * Log exam creation
 */
function logExamCreated(examId, adminId, examData) {
  auditLog(LOG_LEVELS.AUDIT, "EXAM_CREATED", {
    examId,
    adminId,
    title: examData.title,
    duration: examData.duration,
    totalMarks: examData.totalMarks,
  });
}

/**
 * Log exam published
 */
function logExamPublished(examId, adminId, questionsCount) {
  auditLog(LOG_LEVELS.AUDIT, "EXAM_PUBLISHED", {
    examId,
    adminId,
    questionsCount,
  });
}

/**
 * Log question added
 */
function logQuestionAdded(examId, questionId, adminId) {
  auditLog(LOG_LEVELS.AUDIT, "QUESTION_ADDED", {
    examId,
    questionId,
    adminId,
  });
}

/**
 * Log exam started by student
 */
function logExamStarted(sessionId, examId, userId) {
  auditLog(LOG_LEVELS.AUDIT, "EXAM_STARTED", {
    sessionId,
    examId,
    userId,
  });
}

/**
 * Log student warning
 */
function logStudentWarning(sessionId, examId, userId, warningType) {
  auditLog(LOG_LEVELS.WARNING, "STUDENT_WARNING", {
    sessionId,
    examId,
    userId,
    warningType,
  });
}

/**
 * Log exam submission
 */
function logExamSubmitted(sessionId, examId, userId, reason, warningsCount) {
  auditLog(LOG_LEVELS.AUDIT, "EXAM_SUBMITTED", {
    sessionId,
    examId,
    userId,
    reason,
    warningsCount,
  });
}

/**
 * Log result generation
 */
function logResultGenerated(
  sessionId,
  examId,
  userId,
  score,
  total,
  percentage,
) {
  auditLog(LOG_LEVELS.AUDIT, "RESULT_GENERATED", {
    sessionId,
    examId,
    userId,
    score,
    total,
    percentage,
  });
}

/**
 * Log suspicious activity / flagged exam attempt
 */
function logFlaggedAttempt(sessionId, examId, userId, warningsCount) {
  auditLog(LOG_LEVELS.CRITICAL, "FLAGGED_EXAM_ATTEMPT", {
    sessionId,
    examId,
    userId,
    warningsCount,
    reason: "Exceeded warning threshold",
  });
}

/**
 * Log multiple login detection
 */
function logMultipleLogin(examId, userId, previousSessionId, newSessionId) {
  auditLog(LOG_LEVELS.WARNING, "MULTIPLE_LOGIN_DETECTED", {
    examId,
    userId,
    previousSessionId,
    newSessionId,
    action: "Previous session invalidated",
  });
}

/**
 * Log disconnection event
 */
function logDisconnection(sessionId, examId, userId) {
  auditLog(LOG_LEVELS.WARNING, "STUDENT_DISCONNECTION", {
    sessionId,
    examId,
    userId,
  });
}

/**
 * Log reconnection event
 */
function logReconnection(sessionId, examId, userId) {
  auditLog(LOG_LEVELS.INFO, "STUDENT_RECONNECTION", {
    sessionId,
    examId,
    userId,
  });
}

/**
 * Log results published by admin
 */
function logResultsPublished(examId, adminId) {
  auditLog(LOG_LEVELS.AUDIT, "RESULTS_PUBLISHED", {
    examId,
    adminId,
  });
}

/**
 * Log authentication attempt
 */
function logAuthAttempt(email, success, reason = null) {
  auditLog(LOG_LEVELS.INFO, success ? "LOGIN_SUCCESS" : "LOGIN_FAILED", {
    email,
    reason: !success ? reason : null,
  });
}

/**
 * Log API access/security event
 */
function logSecurityEvent(eventType, userId, endpoint, details = {}) {
  auditLog(LOG_LEVELS.WARNING, eventType, {
    userId,
    endpoint,
    ...details,
  });
}

module.exports = {
  LOG_LEVELS,
  auditLog,
  logExamCreated,
  logExamPublished,
  logQuestionAdded,
  logExamStarted,
  logStudentWarning,
  logExamSubmitted,
  logResultGenerated,
  logFlaggedAttempt,
  logMultipleLogin,
  logDisconnection,
  logReconnection,
  logResultsPublished,
  logAuthAttempt,
  logSecurityEvent,
};
