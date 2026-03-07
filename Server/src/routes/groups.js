const express = require("express");
const router = express.Router();
const Group = require("../models/Group");
const GroupMember = require("../models/GroupMember");
const Exam = require("../models/Exam");
const auth = require("../middleware/auth");
const { requireRole } = require("../middleware/roles");
const {
  createGroup,
  ensureMembership,
  joinGroupByCode,
} = require("../services/groupService");

// POST /api/groups - Create group (admin only)
router.post("/", auth, requireRole("admin"), async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Group name is required" });

    const group = await createGroup({
      name,
      description,
      createdBy: res.locals.user.id,
    });

    res.status(201).json(group);
  } catch (error) {
    console.error("Error creating group:", error);
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

// GET /api/groups/my - Get user's groups
router.get("/my", auth, async (req, res) => {
  try {
    const memberships = await GroupMember.find({
      userId: res.locals.user.id,
    }).populate("groupId");
    const groups = memberships.map((m) => ({
      ...m.groupId.toObject(),
      membershipRole: m.role,
      joinedAt: m.joinedAt || m.createdAt,
    }));
    res.json(groups);
  } catch (error) {
    console.error("Error fetching user groups:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/groups/:id - Get group info
router.get("/:id", auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ error: "Group not found" });

    const membership = await ensureMembership({
      userId: res.locals.user.id,
      groupId: req.params.id,
    });

    res.json({
      ...group.toObject(),
      membershipRole: membership.role,
      joinedAt: membership.joinedAt || membership.createdAt,
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

    const members = await GroupMember.find({ groupId: req.params.id }).populate(
      "userId",
      "name email",
    );
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
    await ensureMembership({
      userId: res.locals.user.id,
      groupId: req.params.id,
    });

    const exams = await Exam.find({ groupId: req.params.id }).populate(
      "createdBy",
      "name",
    );
    res.json(exams);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error("Error fetching group exams:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
