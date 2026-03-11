const express = require("express");
const router = express.Router();
const Group = require("../models/Group");
const GroupActivity = require("../models/GroupActivity");
const GroupMember = require("../models/GroupMember");
const Exam = require("../models/Exam");
const Result = require("../models/Result");
const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");
const {
  serializeExamListWithDerivedStatus,
} = require("../services/examAccessService");
const {
  createGroup,
  ensureMembership,
  joinGroupByCode,
  generateInviteLink,
  joinGroupByInviteToken,
  getInviteDetails,
  leaveGroup,
  removeGroupMember,
  regenerateGroupJoinCode,
} = require("../services/groupService");

function mapMembershipGroup(membership) {
  const groupDoc = membership.groupId || {};
  const group =
    typeof groupDoc.toObject === "function" ? groupDoc.toObject() : groupDoc;

  return {
    ...group,
    membershipRole: membership.role,
    joinedAt: membership.joinedAt || membership.createdAt,
  };
}

// POST /api/groups - Create group (admin only)
router.post("/", auth, requireRole("admin"), async (req, res) => {
  try {
    const group = await createGroup({
      name: req.body.name,
      description: req.body.description,
      joinCode: req.body.joinCode,
      maxMembers: req.body.maxMembers,
      createdBy: res.locals.user.id,
    });

    res.status(201).json(group);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error creating group:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/groups/:id/invite - Generate one time invite link (admin only)
router.post("/:id/invite", auth, requireRole("admin"), async (req, res) => {
  try {
    const invite = await generateInviteLink({
      actingUserId: res.locals.user.id,
      groupId: req.params.id,
    });
    res.json({ invite });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error generating invite:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/groups/join - Join group using join code
router.post("/join", auth, async (req, res) => {
  try {
    const { group } = await joinGroupByCode({
      userId: res.locals.user.id,
      joinCode: req.body.joinCode,
    });

    res.json({ message: "Joined group successfully", group });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error joining group:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/invite/:token - Get invite details
router.get("/invite/:token", async (req, res) => {
  try {
    const invite = await getInviteDetails(req.params.token);
    res.json({ invite });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error getting invite:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/groups/invite/:token/use - Use invite link
router.post("/invite/:token/use", auth, async (req, res) => {
  try {
    const { group } = await joinGroupByInviteToken({
      userId: res.locals.user.id,
      token: req.params.token,
    });
    res.json({ message: "Joined group successfully", group });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error using invite:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/my - Get user's groups
router.get("/my", auth, async (req, res) => {
  try {
    const memberships = await GroupMember.find({
      userId: res.locals.user.id,
    })
      .select("groupId role joinedAt createdAt")
      .populate("groupId")
      .lean();
    const groups = memberships.map(mapMembershipGroup);
    res.json(groups);
  } catch (error) {
    console.error("Error fetching user groups:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/joined - Get groups the user joined, excluding ones they created
router.get("/joined", auth, async (req, res) => {
  try {
    const memberships = await GroupMember.find({
      userId: res.locals.user.id,
    })
      .select("groupId role joinedAt createdAt")
      .populate("groupId")
      .lean();

    const groups = memberships
      .filter((membership) => {
        const creatorId = membership.groupId?.createdBy;
        return String(creatorId || "") !== String(res.locals.user.id);
      })
      .map(mapMembershipGroup);

    res.json(groups);
  } catch (error) {
    console.error("Error fetching joined groups:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/created - Get groups created by current admin
router.get("/created", auth, requireRole("admin"), async (req, res) => {
  try {
    const groups = await Group.find({ createdBy: res.locals.user.id }).sort({
      createdAt: -1,
    }).lean();

    const memberships = await GroupMember.find({
      userId: res.locals.user.id,
      groupId: { $in: groups.map((group) => group._id) },
    })
      .select("groupId role joinedAt createdAt")
      .lean();

    const membershipByGroupId = new Map(
      memberships.map((membership) => [
        String(membership.groupId),
        membership,
      ]),
    );

    res.json(
      groups.map((group) => {
        const membership = membershipByGroupId.get(String(group._id));
        return {
          ...group,
          membershipRole: membership?.role || "admin",
          joinedAt: membership?.joinedAt || membership?.createdAt || group.createdAt,
        };
      }),
    );
  } catch (error) {
    console.error("Error fetching created groups:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/groups/:id/leave - Leave group
router.post("/:id/leave", auth, async (req, res) => {
  try {
    await leaveGroup({
      userId: res.locals.user.id,
      groupId: req.params.id,
    });
    res.json({ message: "Left group successfully" });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error leaving group:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/groups/:id/join-code/regenerate - Regenerate join code (admin only)
router.post("/:id/join-code/regenerate", auth, requireRole("admin"), async (req, res) => {
  try {
    const group = await regenerateGroupJoinCode({
      actingUserId: res.locals.user.id,
      groupId: req.params.id,
      joinCode: req.body.joinCode,
    });
    res.json({ message: "Join code updated", group });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error regenerating join code:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/:id - Get group info
router.get("/:id", auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).lean();
    if (!group) return res.status(404).json({ error: "Group not found" });

    const membership = await ensureMembership({
      userId: res.locals.user.id,
      groupId: req.params.id,
    });

    const [memberCount, examCount] = await Promise.all([
      GroupMember.countDocuments({ groupId: req.params.id }),
      Exam.countDocuments({
        groupId: req.params.id,
        ...(membership.role === "admin" ? {} : { published: true }),
      }),
    ]);

    res.json({
      ...group,
      maxMembers: group.maxMembers || 200,
      membershipRole: membership.role,
      joinedAt: membership.joinedAt || membership.createdAt,
      memberCount,
      examCount,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching group:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/:id/members - Get group members
router.get("/:id/members", auth, async (req, res) => {
  try {
    await ensureMembership({
      userId: res.locals.user.id,
      groupId: req.params.id,
    });

    const members = await GroupMember.find({ groupId: req.params.id })
      .select("userId role joinedAt createdAt")
      .populate("userId", "name email role")
      .sort({ role: 1, joinedAt: 1 })
      .lean();
    res.json(members);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching group members:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/:id/exams - Get group exams
router.get("/:id/exams", auth, async (req, res) => {
  try {
    const membership = await ensureMembership({
      userId: res.locals.user.id,
      groupId: req.params.id,
    });
    const joinedScope = req.query.scope === "joined";

    const exams = await Exam.find({
      groupId: req.params.id,
      ...((membership.role === "admin" && !joinedScope) ? {} : { published: true }),
    })
      .populate("createdBy", "name")
      .sort({ startTime: -1 })
      .lean();

    res.json(serializeExamListWithDerivedStatus(exams));
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching group exams:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/:id/results - Group results
router.get("/:id/results", auth, async (req, res) => {
  try {
    const membership = await ensureMembership({
      userId: res.locals.user.id,
      groupId: req.params.id,
    });
    const mineOnly = req.query.scope === "mine";

    const examIds = await Exam.distinct("_id", { groupId: req.params.id });

    if (!examIds.length) {
      return res.json([]);
    }

    const results = await Result.find({
      exam: { $in: examIds },
      ...((membership.role === "admin" && !mineOnly)
        ? {}
        : { user: res.locals.user.id }),
    })
      .select(
        "exam user score total percentage correctAnswers wrongAnswers timeTakenSeconds createdAt",
      )
      .populate("user", "name email")
      .populate("exam", "title resultVisibility resultsPublished startTime duration")
      .sort({ createdAt: -1 })
      .lean();

    const visibleResults =
      membership.role === "admin" && !mineOnly
        ? results
        : results.filter((result) => {
          const exam = result.exam || {};
          const now = Date.now();
          const endMs = new Date(exam.startTime).getTime() + (exam.duration || 0) * 60000;
          return (
            (exam.resultVisibility === "immediate" && now >= endMs) ||
            exam.resultsPublished === true
          );
        });

    res.json(
      visibleResults.map((result) => ({
        _id: result._id,
        examId: result.exam?._id || result.exam,
        examTitle: result.exam?.title || "Exam",
        userId: result.user?._id || result.user,
        studentName:
          result.user?.name || result.user?.email || "Student",
        score: result.score,
        total: result.total,
        percentage: result.percentage,
        correctAnswers: result.correctAnswers,
        wrongAnswers: result.wrongAnswers,
        timeTakenSeconds: result.timeTakenSeconds,
        submittedAt: result.createdAt,
      })),
    );
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching group results:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/:id/activity - Group activity feed
router.get("/:id/activity", auth, async (req, res) => {
  try {
    await ensureMembership({
      userId: res.locals.user.id,
      groupId: req.params.id,
    });

    const activities = await GroupActivity.find({ groupId: req.params.id })
      .select("actorId type message metadata createdAt")
      .populate("actorId", "name email")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json(
      activities.map((activity) => ({
        _id: activity._id,
        type: activity.type,
        message: activity.message,
        actor: activity.actorId
          ? {
            _id: activity.actorId._id,
            name: activity.actorId.name,
            email: activity.actorId.email,
          }
          : null,
        metadata: activity.metadata || {},
        createdAt: activity.createdAt,
      })),
    );
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching group activity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/groups/:id/members/:memberId - Remove member (admin only)
router.delete("/:id/members/:memberId", auth, requireRole("admin"), async (req, res) => {
  try {
    const member = await removeGroupMember({
      actingUserId: res.locals.user.id,
      groupId: req.params.id,
      memberId: req.params.memberId,
    });

    res.json({
      message: "Member removed successfully",
      memberId: member._id,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error removing group member:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
