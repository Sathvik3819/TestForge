const crypto = require("crypto");
const Group = require("../models/Group");
const GroupMember = require("../models/GroupMember");

function normalizeJoinCode(joinCode) {
  return String(joinCode || "")
    .trim()
    .toUpperCase();
}

async function generateUniqueJoinCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const joinCode = crypto.randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    const existing = await Group.findOne({ joinCode });
    if (!existing) {
      return joinCode;
    }
  }

  throw new Error("Failed to generate unique join code");
}

async function createGroup({ name, description, createdBy }) {
  const joinCode = await generateUniqueJoinCode();
  const group = await Group.create({
    name: String(name || "").trim(),
    description: String(description || "").trim(),
    joinCode,
    createdBy,
  });

  await GroupMember.create({
    userId: createdBy,
    groupId: group._id,
    role: "admin",
    joinedAt: new Date(),
  });

  return group;
}

async function ensureMembership({ userId, groupId }) {
  const membership = await GroupMember.findOne({ userId, groupId });
  if (!membership) {
    const err = new Error("Access denied");
    err.statusCode = 403;
    throw err;
  }

  return membership;
}

async function joinGroupByCode({ userId, joinCode }) {
  const normalizedCode = normalizeJoinCode(joinCode);
  if (!normalizedCode) {
    const err = new Error("Join code is required");
    err.statusCode = 400;
    throw err;
  }

  const group = await Group.findOne({ joinCode: normalizedCode });
  if (!group) {
    const err = new Error("Invalid join code");
    err.statusCode = 404;
    throw err;
  }

  const existingMember = await GroupMember.findOne({
    userId,
    groupId: group._id,
  });
  if (existingMember) {
    const err = new Error("Already a member of this group");
    err.statusCode = 409;
    throw err;
  }

  const member = await GroupMember.create({
    userId,
    groupId: group._id,
    role: "student",
    joinedAt: new Date(),
  });

  return { group, member };
}

module.exports = {
  createGroup,
  ensureMembership,
  joinGroupByCode,
  normalizeJoinCode,
};
