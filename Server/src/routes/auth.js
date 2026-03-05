const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { createRateLimiter } = require("../middleware/rateLimit");
const { logAuthAttempt } = require("../services/auditLog");

const router = express.Router();
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  keyFn: (req) => `auth:${req.ip}`,
});

function getJwtSecret() {
  return process.env.JWT_SECRET || "secret";
}

function signAuthToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    getJwtSecret(),
    {
      expiresIn: "1d",
    },
  );
}

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/signup", authLimiter, async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res
      .status(400)
      .json({ msg: "Name, email and password are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ msg: "Please provide a valid email" });
  }

  if (String(password).length < 6) {
    return res
      .status(400)
      .json({ msg: "Password must be at least 6 characters" });
  }

  if (role && !["student", "admin"].includes(role)) {
    return res.status(400).json({ msg: "Role must be student or admin" });
  }

  try {
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ msg: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const finalRole = role === "admin" ? "admin" : "student";
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hash,
      role: finalRole,
    });

    const token = signAuthToken(user);

    return res.status(201).json({
      msg: "Signup successful",
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    return res.status(500).json({ msg: "Signup failed", error: err.message });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ msg: "Email and password are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ msg: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Invalid credentials" });
    }

    const token = signAuthToken(user);

    // Log successful login
    logAuthAttempt(normalizedEmail, true);

    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    // Log failed login
    logAuthAttempt(normalizedEmail, false, err.message);
    return res.status(500).json({ msg: "Login failed", error: err.message });
  }
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.json(user);
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to fetch user", error: err.message });
  }
});

module.exports = router;
