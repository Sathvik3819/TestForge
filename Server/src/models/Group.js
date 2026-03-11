const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    joinCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      minlength: 6,
      maxlength: 12,
      match: [/^[A-Z0-9]{6,12}$/, "Join code must be 6-12 uppercase letters or numbers"],
    },
    maxMembers: {
      type: Number,
      default: 200,
      min: 1,
      max: 5000,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

groupSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model("Group", groupSchema);
