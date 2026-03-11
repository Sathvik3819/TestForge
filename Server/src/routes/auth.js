const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");
const { createRateLimiter } = require("../middleware/rateLimit");
const { logAuthAttempt } = require("../services/auditLog");
const { getJwtSecret } = require("../config/env");


const router = express.Router();
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 30,
  keyFn: (req) => `auth:${req.ip}`,
});
function signAuthToken(user) {
  return jwt.sign(
    { id: user._id, email: user.email },
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
    createdAt: user.createdAt,
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post("/signup", authLimiter, async (req, res) => {
  const { name, email, password } = req.body;

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

  try {
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(409).json({ msg: "User already exists" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hash,
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
    const user = await User.findById(res.locals.user?.id).select("-password");
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    return res.json(sanitizeUser(user));
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to fetch user", error: err.message });
  }
});

router.put("/profile", auth, async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;

  // if updating personal info require both name/email
  if ((name || email) && (!name || !email)) {
    return res.status(400).json({ msg: "Name and email are required" });
  }

  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;
  if (normalizedEmail && !isValidEmail(normalizedEmail)) {
    return res.status(400).json({ msg: "Please provide a valid email" });
  }

  try {
    const user = await User.findById(res.locals.user?.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    if (normalizedEmail && normalizedEmail !== user.email) {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(409).json({ msg: "Email already in use" });
      }
      user.email = normalizedEmail;
    }

    if (name) {
      user.name = String(name).trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return res
          .status(400)
          .json({ msg: "Current password is required to make changes" });
      }
      const match = await bcrypt.compare(currentPassword, user.password);
      if (!match) {
        return res.status(401).json({ msg: "Current password incorrect" });
      }
      if (String(newPassword).length < 6) {
        return res
          .status(400)
          .json({ msg: "Password must be at least 6 characters" });
      }
      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    return res.json({
      msg: "Profile updated successfully",
      user: sanitizeUser(user),
    });
  } catch (err) {
    return res
      .status(500)
      .json({ msg: "Failed to update profile", error: err.message });
  }
});

module.exports = router;
