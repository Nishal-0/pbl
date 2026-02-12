const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  googleId: { type: String }, // Google login
  role: { type: String, default: "user", enum: ["user", "support", "admin"] },
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
