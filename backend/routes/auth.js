const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();
const TOKEN_COOKIE_NAME = "token";
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const verifyGoogleCredential = async (credential) => {
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
  const response = await fetch(url);

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const audience = process.env.GOOGLE_CLIENT_ID;
  const emailVerified = payload.email_verified === "true";

  if (!payload.email || !payload.name || !payload.sub || !emailVerified) {
    return null;
  }

  if (payload.aud !== audience) {
    return null;
  }

  return payload;
};

router.post("/google-login", async (req, res) => {
  const { credential } = req.body;

  try {
    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    const payload = await verifyGoogleCredential(credential);
    if (!payload) {
      return res.status(401).json({ message: "Invalid Google token" });
    }

    let user = await User.findOne({
      $or: [{ googleId: payload.sub }, { email: payload.email }],
    });

    if (!user) {
      user = await User.create({
        name: payload.name,
        email: payload.email,
        googleId: payload.sub,
        role: "user",
      });
    } else {
      user.name = payload.name;
      user.email = payload.email;
      user.googleId = payload.sub;
      await user.save();
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.cookie(TOKEN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: TOKEN_MAX_AGE_MS,
    });

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie(TOKEN_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  res.status(204).send();
});

router.get("/me", protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-__v");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/users", protect, authorizeRoles("admin"), async (_req, res) => {
  try {
    const users = await User.find({}).select("name email role");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/users/:id/role", protect, authorizeRoles("admin"), async (req, res) => {
  const { role } = req.body;

  try {
    if (!["user", "support", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    if (req.user.id === req.params.id && role !== "admin") {
      return res.status(400).json({ message: "You cannot remove your own admin role" });
    }

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ message: "User not found" });
    }

    target.role = role;
    await target.save();

    res.json({ _id: target._id, name: target.name, email: target.email, role: target.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
