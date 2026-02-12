require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const ticketRoutes = require("./routes/tickets");
const { notFound, errorHandler } = require("./middleware/errorMiddleware");

const app = express();

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
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/tickets", ticketRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

