const mongoose = require("mongoose");

const groupInviteSchema = new mongoose.Schema(
    {
        groupId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true,
        },
        token: { type: String, required: true, unique: true },
        used: { type: Boolean, default: false },
        usedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        },
    },
    { timestamps: true }
);

groupInviteSchema.index({ groupId: 1, used: 1, expiresAt: 1 });
groupInviteSchema.index({ expiresAt: 1 });

module.exports = mongoose.model("GroupInvite", groupInviteSchema);
