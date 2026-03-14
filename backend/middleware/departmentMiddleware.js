const User = require("../models/User");

const withDepartmentScope = async (req, res, next) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Not authorized" });
    }

    if (!req.user.departmentLoaded) {
      const dbUser = await User.findById(req.user.id).select("role department");
      if (!dbUser) {
        return res.status(401).json({ message: "User not found" });
      }
      req.user.role = dbUser.role;
      req.user.department = dbUser.department;
      req.user.departmentLoaded = true;
    }

    if (req.user.role === "customer") {
      req.user.role = "user";
    }

    if (req.user.role === "admin") {
      if (!req.user.department) {
        // Legacy admin compatibility: allow global visibility when no department is set.
        req.departmentScope = null;
        req.legacyAdminScope = true;
      } else {
        req.departmentScope = req.user.department;
        req.legacyAdminScope = false;
      }
    } else if (req.user.role === "support") {
      req.departmentScope = req.user.department || null;
      req.legacySupportScope = !req.user.department;
    } else {
      req.departmentScope = null;
    }

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { withDepartmentScope };
