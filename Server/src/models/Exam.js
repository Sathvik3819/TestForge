const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true, trim: true },
  options: [{ text: { type: String, required: true, trim: true } }],
  correctAnswer: { type: String, required: true, trim: true },
  marks: { type: Number, required: true, min: 0.01, default: 1 },
  negativeMarks: { type: Number, min: 0, default: 0 },
});

const examSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    duration: { type: Number, required: true }, // in minutes
    startTime: { type: Date, required: true },
    totalMarks: { type: Number, required: true, min: 1 },
    numberOfQuestions: { type: Number, required: true, min: 1 },
    marksPerQuestion: { type: Number, required: true, min: 0.01 },
    negativeMarking: { type: Number, min: 0, default: 0 },
    price: { type: Number, default: 0 },
    questions: [questionSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    published: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["Draft", "Scheduled", "Active", "Ended", "Completed"],
      default: "Draft",
      index: true,
    },
    resultVisibility: {
      type: String,
      enum: ["immediate", "delayed"],
      default: "immediate",
    },
    resultsPublished: { type: Boolean, default: false },
    maxAttempts: { type: Number, default: 1, min: 1 },
    allowRetake: { type: Boolean, default: false },
  },
  { timestamps: true },
);

questionSchema.path("options").validate((options) => options.length >= 2, "Minimum 2 options required");
questionSchema.path("correctAnswer").validate(function validateCorrectAnswer(value) {
  return (this.options || []).some((option) => option.text === value);
}, "Correct answer must match one option");

module.exports = mongoose.model("Exam", examSchema);
