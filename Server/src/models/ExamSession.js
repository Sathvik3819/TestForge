const mongoose = require("mongoose");

const examSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    warnings: [
      {
        type: { type: String, required: true },
        message: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    submitted: { type: Boolean, default: false },
    submittedAt: { type: Date, default: null },
    disconnectedAt: { type: Date, default: null },
    lastSeenAt: { type: Date, default: Date.now },
    activeSocketId: { type: String, default: null },
    answers: [{ questionId: mongoose.Schema.Types.ObjectId, answer: String }],
    resumePoint: {
      lastQuestionId: { type: mongoose.Schema.Types.ObjectId, default: null },
      lastAnswer: { type: String, default: null },
      updatedAt: { type: Date, default: null },
    },
    resultProcessed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

examSessionSchema.index({ user: 1, exam: 1 }, { unique: true });

module.exports = mongoose.model("ExamSession", examSessionSchema);
