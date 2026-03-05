const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: "ExamSession", unique: true, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true, index: true },
    score: { type: Number, required: true, default: 0 },
    correctAnswers: { type: Number, required: true, default: 0 },
    wrongAnswers: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true, default: 0 },
    percentage: { type: Number, required: true, default: 0 },
    timeTakenSeconds: { type: Number, default: 0 },
    warningsCount: { type: Number, default: 0 },
    processedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Result", resultSchema);
