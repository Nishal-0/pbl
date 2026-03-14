const jwt = require("jsonwebtoken");

const getCookieValue = (cookieHeader, key) => {
  if (!cookieHeader) return null;

  const pairs = cookieHeader.split(";").map((entry) => entry.trim());
  for (const pair of pairs) {
    if (pair.startsWith(`${key}=`)) {
      return decodeURIComponent(pair.slice(key.length + 1));
    }
  }

  return null;
};

const protect = (req, res, next) => {
  const bearerToken = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.split(" ")[1]
    : null;
  const cookieToken = getCookieValue(req.headers.cookie, "token");
  const token = bearerToken || cookieToken;

  if (!token) return res.status(401).json({ message: "Not authorized" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role,
      department: decoded.department,
      departmentLoaded: false,
    };
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = protect;
