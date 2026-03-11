const crypto = require("crypto");
const Group = require("../models/Group");
const GroupMember = require("../models/GroupMember");
const GroupInvite = require("../models/GroupInvite");
const {
  logGroupCreated,
  logGroupJoined,
  logGroupLeft,
  logGroupMemberRemoved,
  logGroupJoinCodeRegenerated,
} = require("./groupActivityService");

const JOIN_CODE_PATTERN = /^[A-Z0-9]{6,12}$/;

function normalizeJoinCode(joinCode) {
  return String(joinCode || "")
    .trim()
    .toUpperCase();
}

function normalizeGroupName(name) {
  return String(name || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeGroupNameKey(name) {
  return normalizeGroupName(name).toLowerCase();
}

function buildError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function validateJoinCodeOrThrow(joinCode) {
  if (!joinCode) {
    throw buildError("Join code is required", 400);
  }

  if (!JOIN_CODE_PATTERN.test(joinCode)) {
    throw buildError(
      "Join code must be 6-12 uppercase letters or numbers",
      400,
    );
  }
}

function parseMaxMembers(maxMembers) {
  if (maxMembers === "" || maxMembers === null || maxMembers === undefined) {
    return 200;
  }

  const parsed = Number(maxMembers);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5000) {
    throw buildError("Max members must be an integer between 1 and 5000", 400);
  }

  return parsed;
}

async function generateUniqueJoinCode(length = 6) {
  const finalLength = Math.max(6, Math.min(12, Number(length) || 6));

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const joinCode = crypto.randomBytes(8)
      .toString("hex")
      .slice(0, finalLength)
      .toUpperCase();
    const existing = await Group.findOne({ joinCode });
    if (!existing) {
      return joinCode;
    }
  }

  throw buildError("Failed to generate unique join code", 500);
}

async function createGroup({ name, description, joinCode, createdBy, maxMembers }) {
  const normalizedName = normalizeGroupName(name);
  if (!normalizedName) {
    throw buildError("Group name is required", 400);
  }

  const normalizedJoinCode = normalizeJoinCode(joinCode);
  validateJoinCodeOrThrow(normalizedJoinCode);

  const existingGroups = await Group.find({ createdBy }).select("name");
  const nameKey = normalizeGroupNameKey(normalizedName);
  if (
    existingGroups.some(
      (group) => normalizeGroupNameKey(group.name) === nameKey,
    )
  ) {
    throw buildError("You already created a group with this name", 409);
  }

  const existingCode = await Group.findOne({ joinCode: normalizedJoinCode });
  if (existingCode) {
    throw buildError("Join code already exists", 409);
  }

  const group = await Group.create({
    name: normalizedName,
    description: String(description || "").trim(),
    joinCode: normalizedJoinCode,
    maxMembers: parseMaxMembers(maxMembers),
    createdBy,
  });

  await GroupMember.create({
    userId: createdBy,
    groupId: group._id,
    role: "admin",
    joinedAt: new Date(),
  });

  await logGroupCreated({
    groupId: group._id,
    actorId: createdBy,
    groupName: group.name,
    joinCode: group.joinCode,
  });

  return group;
}

async function ensureMembership({ userId, groupId }) {
  const membership = await GroupMember.findOne({ userId, groupId });
  if (!membership) {
    throw buildError("Access denied", 403);
  }

  return membership;
}

async function ensureGroupAdmin({ userId, groupId }) {
  const membership = await GroupMember.findOne({ userId, groupId, role: "admin" });
  if (!membership) {
    throw buildError("Only group admins can perform this action", 403);
  }

  return membership;
}

async function joinGroupByCode({ userId, joinCode }) {
  const normalizedCode = normalizeJoinCode(joinCode);
  validateJoinCodeOrThrow(normalizedCode);

  const group = await Group.findOne({ joinCode: normalizedCode });
  if (!group) {
    throw buildError("Invalid join code", 404);
  }

  const existingMember = await GroupMember.findOne({
    userId,
    groupId: group._id,
  });
  if (existingMember) {
    throw buildError("Already a member of this group", 409);
  }

  const memberCount = await GroupMember.countDocuments({ groupId: group._id });
  const memberLimit = Number(group.maxMembers || 200);
  if (memberCount >= memberLimit) {
    throw buildError("This group has reached its member limit", 409);
  }

  const member = await GroupMember.create({
    userId,
    groupId: group._id,
    role: "student",
    joinedAt: new Date(),
  });

  await logGroupJoined({
    groupId: group._id,
    actorId: userId,
    groupName: group.name,
  });

  return { group, member };
}

async function leaveGroup({ userId, groupId }) {
  const membership = await ensureMembership({ userId, groupId });

  if (membership.role === "admin") {
    const adminCount = await GroupMember.countDocuments({
      groupId,
      role: "admin",
    });
    if (adminCount <= 1) {
      throw buildError(
        "You are the last admin of this group and cannot leave it",
        409,
      );
    }
  }

  await membership.deleteOne();
  await logGroupLeft({ groupId, actorId: userId });

  return membership;
}

async function removeGroupMember({ actingUserId, groupId, memberId }) {
  await ensureGroupAdmin({ userId: actingUserId, groupId });

  const membership = await GroupMember.findOne({
    _id: memberId,
    groupId,
  }).populate("userId", "name email");

  if (!membership) {
    throw buildError("Group member not found", 404);
  }

  const targetUserId = membership.userId?._id || membership.userId;
  if (String(targetUserId) === String(actingUserId)) {
    throw buildError("Use the leave group action to remove yourself", 400);
  }

  if (membership.role === "admin") {
    const adminCount = await GroupMember.countDocuments({
      groupId,
      role: "admin",
    });
    if (adminCount <= 1) {
      throw buildError("Cannot remove the last admin from this group", 409);
    }
  }

  await membership.deleteOne();
  await logGroupMemberRemoved({
    groupId,
    actorId: actingUserId,
    removedUserId: targetUserId,
    removedUserLabel:
      membership.userId?.name || membership.userId?.email || "member",
  });

  return membership;
}

async function regenerateGroupJoinCode({ actingUserId, groupId, joinCode }) {
  await ensureGroupAdmin({ userId: actingUserId, groupId });

  const group = await Group.findById(groupId);
  if (!group) {
    throw buildError("Group not found", 404);
  }

  let nextJoinCode = normalizeJoinCode(joinCode);
  if (nextJoinCode) {
    validateJoinCodeOrThrow(nextJoinCode);
  } else {
    nextJoinCode = await generateUniqueJoinCode();
  }

  const existing = await Group.findOne({
    joinCode: nextJoinCode,
    _id: { $ne: groupId },
  });
  if (existing) {
    throw buildError("Join code already exists", 409);
  }

  group.joinCode = nextJoinCode;
  await group.save();

  await logGroupJoinCodeRegenerated({
    groupId,
    actorId: actingUserId,
    joinCode: nextJoinCode,
  });

  return group;
}

async function generateInviteLink({ actingUserId, groupId }) {
  await ensureGroupAdmin({ userId: actingUserId, groupId });
  const token = crypto.randomBytes(16).toString("hex");
  const invite = await GroupInvite.create({
    groupId,
    token,
  });
  return invite;
}

async function joinGroupByInviteToken({ userId, token }) {
  const invite = await GroupInvite.findOne({ token, used: false });
  if (!invite) throw buildError("Invalid or already used invite link", 404);
  if (invite.expiresAt < new Date()) throw buildError("Invite link has expired", 400);

  const group = await Group.findById(invite.groupId);
  if (!group) throw buildError("Group not found", 404);

  const existingMember = await GroupMember.findOne({
    userId,
    groupId: group._id,
  });
  if (existingMember) throw buildError("Already a member of this group", 409);

  const memberCount = await GroupMember.countDocuments({ groupId: group._id });
  const memberLimit = Number(group.maxMembers || 200);
  if (memberCount >= memberLimit) throw buildError("This group has reached its member limit", 409);

  const member = await GroupMember.create({
    userId,
    groupId: group._id,
    role: "student",
    joinedAt: new Date(),
  });

  invite.used = true;
  invite.usedBy = userId;
  await invite.save();

  await logGroupJoined({
    groupId: group._id,
    actorId: userId,
    groupName: group.name,
  });

  return { group, member };
}

async function getInviteDetails(token) {
  const invite = await GroupInvite.findOne({ token, used: false }).populate("groupId", "name description joinCode");
  if (!invite) throw buildError("Invalid or already used invite link", 404);
  if (invite.expiresAt < new Date()) throw buildError("Invite link has expired", 400);

  return invite;
}

module.exports = {
  createGroup,
  ensureMembership,
  ensureGroupAdmin,
  joinGroupByCode,
  generateInviteLink,
  joinGroupByInviteToken,
  getInviteDetails,
  leaveGroup,
  removeGroupMember,
  regenerateGroupJoinCode,
  normalizeJoinCode,
  validateJoinCodeOrThrow,
  parseMaxMembers,
};
