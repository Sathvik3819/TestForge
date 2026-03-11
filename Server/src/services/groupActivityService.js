const GroupActivity = require("../models/GroupActivity");
const { LOG_LEVELS, auditLog } = require("./auditLog");

async function recordGroupActivity({
  groupId,
  actorId = null,
  type,
  message,
  metadata = {},
}) {
  const activity = await GroupActivity.create({
    groupId,
    actorId,
    type,
    message,
    metadata,
  });

  auditLog(LOG_LEVELS.AUDIT, type, {
    groupId: String(groupId),
    actorId: actorId ? String(actorId) : null,
    message,
    ...metadata,
  });

  return activity;
}

async function logGroupCreated({ groupId, actorId, groupName, joinCode }) {
  return recordGroupActivity({
    groupId,
    actorId,
    type: "GROUP_CREATED",
    message: `Group "${groupName}" created`,
    metadata: { groupName, joinCode },
  });
}

async function logGroupJoined({ groupId, actorId, groupName }) {
  return recordGroupActivity({
    groupId,
    actorId,
    type: "GROUP_JOINED",
    message: `Joined group "${groupName}"`,
    metadata: { groupName },
  });
}

async function logGroupLeft({ groupId, actorId }) {
  return recordGroupActivity({
    groupId,
    actorId,
    type: "GROUP_LEFT",
    message: "Left the group",
  });
}

async function logGroupMemberRemoved({
  groupId,
  actorId,
  removedUserId,
  removedUserLabel,
}) {
  return recordGroupActivity({
    groupId,
    actorId,
    type: "GROUP_MEMBER_REMOVED",
    message: `Removed ${removedUserLabel} from the group`,
    metadata: {
      removedUserId: removedUserId ? String(removedUserId) : null,
      removedUserLabel,
    },
  });
}

async function logGroupJoinCodeRegenerated({
  groupId,
  actorId,
  joinCode,
}) {
  return recordGroupActivity({
    groupId,
    actorId,
    type: "GROUP_JOIN_CODE_REGENERATED",
    message: "Join code regenerated",
    metadata: { joinCode },
  });
}

async function logGroupExamCreated({ groupId, actorId, examId, examTitle }) {
  return recordGroupActivity({
    groupId,
    actorId,
    type: "GROUP_EXAM_CREATED",
    message: `Exam "${examTitle}" created`,
    metadata: { examId: String(examId), examTitle },
  });
}

async function logGroupExamStarted({ groupId, actorId, examId, examTitle }) {
  return recordGroupActivity({
    groupId,
    actorId,
    type: "GROUP_EXAM_STARTED",
    message: `Exam "${examTitle}" started`,
    metadata: { examId: String(examId), examTitle },
  });
}

async function logGroupResultsPublished({
  groupId,
  actorId,
  examId,
  examTitle,
}) {
  return recordGroupActivity({
    groupId,
    actorId,
    type: "GROUP_RESULTS_PUBLISHED",
    message: `Results published for "${examTitle}"`,
    metadata: { examId: String(examId), examTitle },
  });
}

module.exports = {
  recordGroupActivity,
  logGroupCreated,
  logGroupJoined,
  logGroupLeft,
  logGroupMemberRemoved,
  logGroupJoinCodeRegenerated,
  logGroupExamCreated,
  logGroupExamStarted,
  logGroupResultsPublished,
};
