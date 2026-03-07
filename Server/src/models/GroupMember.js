const mongoose = require("mongoose");

const groupMemberSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    role: { type: String, enum: ["admin", "student"], default: "student" },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

groupMemberSchema.index({ userId: 1, groupId: 1 }, { unique: true });

module.exports = mongoose.model("GroupMember", groupMemberSchema);
