require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const orderRoutes = require("./routes/orders");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();
app.set("trust proxy", 1);

const parseConfiguredOrigins = () => {
  const configuredOrigins = [
    process.env.CORS_ORIGIN,
    ...(process.env.CORS_ORIGINS || "").split(","),
    process.env.FRONTEND_URL,
  ]
    .filter(Boolean)
    .map((origin) => origin.trim())
    .filter(Boolean);

  return [...new Set(configuredOrigins)];
};

const allowedOrigins = parseConfiguredOrigins();

const isAllowedOrigin = (origin) => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.includes(origin)) {
    return true;
  }

  if (/^http:\/\/localhost:\d+$/i.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/i.test(origin)) {
    return true;
  }

  return false;
};

const requiredEnvVars = ["MONGO_URI", "JWT_SECRET", "GOOGLE_CLIENT_ID"];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

if (
  process.env.JWT_SECRET === "change_this_to_a_long_random_secret" ||
  process.env.JWT_SECRET.length < 32
) {
  console.error("JWT_SECRET must be at least 32 characters and not a placeholder");
  process.exit(1);
}

connectDB();

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/orders", orderRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

