/**
 * ExamValidationHelper.js
 * Centralizes all exam rule validations according to TestForge policies
 */

/**
 * Validate exam creation payload according to Rule 2: Exam Creation Rules
 * @param {object} payload - Exam creation data
 * @returns {array} Array of validation errors
 */
function validateExamCreationRules(payload) {
  const errors = [];

  // Rule 2: Required fields
  if (!payload.title || payload.title.trim() === "") {
    errors.push("Exam title is required");
  }
  if (!payload.description || payload.description.trim() === "") {
    errors.push("Description is required");
  }
  if (!payload.startTime) {
    errors.push("Start time is required");
  }
  if (!payload.duration) {
    errors.push("Duration is required");
  }
  if (!payload.totalMarks) {
    errors.push("Total marks is required");
  }
  if (!payload.numberOfQuestions) {
    errors.push("Number of questions is required");
  }

  // Rule 2: Restrictions
  const startTime = new Date(payload.startTime).getTime();
  if (!Number.isFinite(startTime) || startTime <= Date.now()) {
    errors.push("Exam cannot start in the past");
  }

  const duration = Number(payload.duration);
  // Rule 2: Duration must be between 10 minutes and 180 minutes
  if (!Number.isFinite(duration) || duration < 10 || duration > 180) {
    errors.push("Duration must be between 10 and 180 minutes");
  }

  // Rule 2: At least 1 question required
  const numQuestions = Number(payload.numberOfQuestions);
  if (!Number.isFinite(numQuestions) || numQuestions < 1) {
    errors.push("At least 1 question is required");
  }

  return errors;
}

/**
 * Validate question payload according to Rule 3: Question Rules
 * @param {object} question - Question data
 * @returns {array} Array of validation errors
 */
function validateQuestionRules(question) {
  const errors = [];

  // Rule 3: Question text required
  if (!question.text || question.text.trim() === "") {
    errors.push("Question text is required");
  }

  // Rule 3: Minimum 2 options required
  const options = question.options || [];
  if (!Array.isArray(options) || options.length < 2) {
    errors.push("Minimum 2 options required");
  }

  // Rule 3: Only one correct answer (for MCQ)
  if (!question.correctAnswer || question.correctAnswer.trim() === "") {
    errors.push("Correct answer is required");
  }

  // Rule 3: Correct answer must match one option
  const optionTexts = options.map((opt) => {
    if (typeof opt === "string") return opt.trim();
    return opt?.text?.trim() || "";
  });

  if (!optionTexts.includes(question.correctAnswer?.trim())) {
    errors.push("Correct answer must match one of the options");
  }

  // Rule 3: Marks must be positive
  const marks = Number(question.marks || 0);
  if (marks <= 0) {
    errors.push("Marks must be positive");
  }

  // Rule 3: Negative marks optional but must be non-negative if provided
  const negativeMarks = Number(question.negativeMarks || 0);
  if (negativeMarks < 0) {
    errors.push("Negative marks cannot be negative");
  }

  return errors;
}

/**
 * Validate exam start conditions according to Rule 5: Exam Start Rules
 * @param {object} exam - Exam object
 * @param {string} userId - User ID attempting to start
 * @returns {object} { allowed: boolean, reason: string }
 */
function validateExamStartConditions(
  exam,
  userId,
  submittedAttempts,
  maxAttempts,
  allowRetake,
) {
  // Rule 5: Exam status must be Active
  if (exam.status !== "Active") {
    return { allowed: false, reason: "Exam is not active" };
  }

  // Rule 5: Current time must be within exam window
  const now = Date.now();
  const start = new Date(exam.startTime).getTime();
  const end = start + Number(exam.duration) * 60 * 1000;

  if (now < start || now > end) {
    return {
      allowed: false,
      reason: "Exam can only be started within scheduled window",
    };
  }

  // Rule 15: Exam Attempt Policy - check max attempts
  if (!allowRetake && submittedAttempts >= 1) {
    return { allowed: false, reason: "Student can attempt exam only once" };
  }

  if (submittedAttempts >= maxAttempts) {
    return {
      allowed: false,
      reason: `Maximum attempts (${maxAttempts}) reached`,
    };
  }

  return { allowed: true };
}

/**
 * Validate warning threshold according to Rule 8: Anti-Cheat Policies
 * @param {number} warningsCount - Current warning count
 * @returns {object} { shouldFlag: boolean, warningsCount: number }
 */
function validateWarningThreshold(warningsCount) {
  // Rule 8: If warnings > 3, flag exam attempt
  return {
    shouldFlag: warningsCount > 3,
    warningsCount: warningsCount,
  };
}

/**
 * Calculate result score according to Rule 12: Result Calculation Rules
 * Formula: (correct_answers × marks) - (wrong_answers × negative_marks)
 * @param {array} questions - Exam questions
 * @param {object} answerMap - Map of questionId -> answer
 * @returns {object} { score, correctCount, wrongCount, percentage }
 */
function calculateScoreByRules(questions, answerMap) {
  let totalScore = 0;
  let correctCount = 0;
  let wrongCount = 0;

  questions.forEach((question) => {
    const answer = answerMap.get(question._id?.toString());
    const isCorrect =
      answer && String(answer).trim() === String(question.correctAnswer).trim();

    if (isCorrect) {
      // Rule 12: correct_answers × marks
      totalScore += Number(question.marks || 1);
      correctCount += 1;
    } else if (answer) {
      // Rule 12: wrong_answers × negative_marks (only if answer given)
      totalScore -= Number(question.negativeMarks || 0);
      wrongCount += 1;
    }
    // Unanswered questions don't affect score
  });

  const score = Math.max(0, totalScore); // Never go below 0
  const totalMarks = questions.reduce(
    (sum, q) => sum + Number(q.marks || 1),
    0,
  );
  const percentage =
    totalMarks > 0 ? Number(((score / totalMarks) * 100).toFixed(2)) : 0;

  return {
    score,
    correctCount,
    wrongCount,
    percentage,
    totalMarks,
  };
}

/**
 * Determine if results should be visible according to Rule 13: Result Visibility Policy
 * @param {object} exam - Exam object
 * @returns {boolean} - True if student can view results
 */
function shouldShowResults(exam) {
  // Rule 13: Immediate Result mode = always show
  if (exam.resultVisibility === "immediate") {
    return true;
  }

  // Rule 13: Delayed Result mode = show only if admin published
  if (exam.resultVisibility === "delayed" && exam.resultsPublished) {
    return true;
  }

  return false;
}

/**
 * Validate exam status transitions according to Rule 4: Exam Scheduling Rules
 * @param {string} currentStatus - Current exam status
 * @param {object} exam - Exam object with timestamps
 * @returns {string} - New status after transition
 */
function getExamStatusTransition(currentStatus, exam) {
  // Rule 4: Exam states: Draft, Scheduled, Active, Ended, Completed
  const now = Date.now();
  const start = new Date(exam.startTime).getTime();
  const end = start + Number(exam.duration) * 60 * 1000;

  if (!exam.published) {
    return "Draft";
  }

  if (now < start) {
    return "Scheduled";
  }

  if (now >= start && now <= end) {
    return "Active";
  }

  if (now > end) {
    // Transition to Completed if results are visible
    if (exam.resultVisibility === "immediate" || exam.resultsPublished) {
      return "Completed";
    }
    return "Ended";
  }

  return currentStatus;
}

/**
 * Validate answers against exam questions
 * @param {object} exam - Exam object
 * @param {object} answersInput - Student answers
 * @returns {array} - Valid answers array
 */
function validateAnswersAgainstExam(exam, answersInput) {
  if (!answersInput || !exam?.questions) return [];

  let answers = answersInput;
  if (typeof answersInput === "object" && !Array.isArray(answersInput)) {
    answers = Object.entries(answersInput).map(([questionId, answer]) => ({
      questionId,
      answer,
    }));
  }

  const timeLeftMs = getTimeLeftMs(exam);

  // Rule 11: Exam Ending Rules - answers locked after submission
  if (timeLeftMs <= 0) {
    return [];
  }

  const questionMap = new Map(exam.questions.map((q) => [q._id.toString(), q]));
  const validAnswers = [];

  answers.forEach((item) => {
    const question = questionMap.get(String(item.questionId));
    if (!question) return;

    const optionTexts = question.options.map((opt) => opt.text);
    if (optionTexts.includes(item.answer)) {
      validAnswers.push({ questionId: question._id, answer: item.answer });
    }
  });

  return validAnswers;
}

/**
 * Get time left in milliseconds for exam session
 * @param {object} session - Exam session
 * @returns {number} - Milliseconds remaining
 */
function getTimeLeftMs(session) {
  if (!session?.endTime) return 0;
  return Math.max(0, new Date(session.endTime).getTime() - Date.now());
}

/**
 * Validate session state according to Rule 5 and 6
 * @param {object} session - Exam session
 * @returns {object} - { isValid: boolean, reason: string }
 */
function validateSessionState(session) {
  // Rule 11: Answers locked after submission
  if (session.submitted) {
    return {
      isValid: false,
      reason: "Exam already submitted. Answers cannot be modified.",
    };
  }

  // Rule 9: Session invalidated due to multiple login
  if (session.isInvalidated) {
    return {
      isValid: false,
      reason: "Session invalidated due to multiple login",
    };
  }

  if (session.status === "submitted") {
    return { isValid: false, reason: "Session already submitted" };
  }

  if (session.status !== "active") {
    return {
      isValid: false,
      reason: `Session is not active (status: ${session.status})`,
    };
  }

  return { isValid: true };
}

module.exports = {
  validateExamCreationRules,
  validateQuestionRules,
  validateExamStartConditions,
  validateWarningThreshold,
  calculateScoreByRules,
  shouldShowResults,
  getExamStatusTransition,
  validateAnswersAgainstExam,
  getTimeLeftMs,
  validateSessionState,
};
