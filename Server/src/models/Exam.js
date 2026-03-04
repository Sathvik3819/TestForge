const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  options: [{ text: { type: String, required: true, trim: true } }],
  correctAnswer: { type: String, required: true, trim: true },
});

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    duration: { type: Number, required: true }, // in minutes
    startTime: { type: Date, required: true },
    questions: [questionSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Exam", examSchema);
