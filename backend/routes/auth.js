const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { DEPARTMENTS } = require("../lib/ticketConfig");

const router = express.Router();
const TOKEN_COOKIE_NAME = "token";
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const isProduction = process.env.NODE_ENV === "production";
const cookieOptions = {
  httpOnly: true,
  sameSite: isProduction ? "none" : "lax",
  secure: isProduction,
  maxAge: TOKEN_MAX_AGE_MS,
};
const SELF_SERVICE_ROLES = new Set(["user", "support", "admin"]);
const DEFAULT_ADMIN_DEPARTMENT = DEPARTMENTS.includes(process.env.ADMIN_DEFAULT_DEPARTMENT)
  ? process.env.ADMIN_DEFAULT_DEPARTMENT
  : "Technical Support";

const normalizeSelectedRole = (value) => {
  if (typeof value !== "string") return "user";

  const normalized = value.trim().toLowerCase();
  return SELF_SERVICE_ROLES.has(normalized) ? normalized : "user";
};

const getEmailDomain = (email) => {
  if (typeof email !== "string") return "";
  return email.split("@")[1]?.trim().toLowerCase() || "";
};

const getAllowedSupportDomains = () =>
  (process.env.SUPPORT_ALLOWED_EMAIL_DOMAINS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const getAdminEmails = () =>
  (process.env.ADMIN_EMAILS || "thillainishal29@gmail.com")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

const isConfiguredAdminEmail = (email) =>
  typeof email === "string" && getAdminEmails().includes(email.trim().toLowerCase());

const resolveRoleAndDepartment = (selectedRole, email, currentDepartment) => {
  if (isConfiguredAdminEmail(email)) {
    return {
      role: "admin",
      department:
        typeof currentDepartment === "string" && DEPARTMENTS.includes(currentDepartment)
          ? currentDepartment
          : DEFAULT_ADMIN_DEPARTMENT,
    };
  }

  const resolvedRole = resolveSelfServiceRole(selectedRole, email);
  return {
    role: resolvedRole,
    department: resolvedRole === "support" ? currentDepartment : undefined,
  };
};

const resolveSelfServiceRole = (selectedRole, email) => {
  if (selectedRole === "admin") {
    return "user";
  }

  if (selectedRole === "support") {
    const allowedDomains = getAllowedSupportDomains();
    if (allowedDomains.length === 0) {
      return "support";
    }

    return allowedDomains.includes(getEmailDomain(email)) ? "support" : "user";
  }

  return "user";
};

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
  const { credential, selectedRole } = req.body;

  try {
    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    const payload = await verifyGoogleCredential(credential);
    if (!payload) {
      return res.status(401).json({ message: "Invalid Google token" });
    }

    const requestedRole = normalizeSelectedRole(selectedRole);

    let user = await User.findOne({
      $or: [{ googleId: payload.sub }, { email: payload.email }],
    });

    if (!user) {
      const resolvedAccess = resolveRoleAndDepartment(requestedRole, payload.email);
      user = await User.create({
        name: payload.name,
        email: payload.email,
        googleId: payload.sub,
        role: resolvedAccess.role,
        department: resolvedAccess.department,
      });
    } else {
      const resolvedAccess = resolveRoleAndDepartment(
        requestedRole,
        payload.email,
        user.department
      );
      // Avoid blocking login on legacy profile validation rules.
      await User.updateOne(
        { _id: user._id },
        {
          $set: {
            name: payload.name,
            email: payload.email,
            googleId: payload.sub,
            role: resolvedAccess.role,
            department: resolvedAccess.department,
          },
        }
      );
      user = await User.findById(user._id);
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, department: user.department },
      process.env.JWT_SECRET,
      {
      expiresIn: "7d",
      }
    );

    res.cookie(TOKEN_COOKIE_NAME, token, cookieOptions);

    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie(TOKEN_COOKIE_NAME, {
    httpOnly: true,
    sameSite: cookieOptions.sameSite,
    secure: cookieOptions.secure,
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
    const users = await User.find({}).select("name email role department");
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/users/:id/role", protect, authorizeRoles("admin"), async (req, res) => {
  try {
    const payload = req.body && typeof req.body === "object" ? req.body : {};
    const role = typeof payload.role === "string" ? payload.role.trim().toLowerCase() : "";

    if (!["user", "customer", "support", "admin"].includes(role)) {
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

    const normalizedRole = role === "customer" ? "user" : role;
    const departmentValue = payload.department;
    const normalizedDepartment =
      typeof departmentValue === "string"
        ? departmentValue.trim()
        : departmentValue == null
          ? undefined
          : "";

    if (departmentValue != null && typeof departmentValue !== "string") {
      return res.status(400).json({ message: "Invalid department" });
    }

    if (
      normalizedDepartment &&
      !DEPARTMENTS.includes(normalizedDepartment)
    ) {
      return res.status(400).json({ message: "Invalid department" });
    }

    target.role = normalizedRole;

    if (normalizedRole === "admin" && !normalizedDepartment) {
      return res.status(400).json({ message: "Valid department is required for admin" });
    }

    target.department =
      normalizedRole === "admin" || normalizedRole === "support"
        ? normalizedDepartment || undefined
        : undefined;
    await target.save();

    res.json({
      _id: target._id,
      name: target.name,
      email: target.email,
      role: target.role,
      department: target.department,
    });
  } catch (err) {
    console.error("[PATCH /api/auth/users/:id/role] failed", {
      userId: req.params?.id,
      actorId: req.user?.id,
      payload: req.body,
      name: err?.name,
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
    });

    if (err.name === "ValidationError") {
      const message = Object.values(err.errors)[0]?.message || "Validation error";
      return res.status(400).json({ message });
    }

    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV !== "production" ? err?.message : undefined,
    });
  }
});

module.exports = router;
