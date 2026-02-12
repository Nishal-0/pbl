const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: {
      type: String,
      default: "general",
      enum: ["general", "billing", "technical", "account", "other"],
    },
    priority: {
      type: String,
      default: "medium",
      enum: ["low", "medium", "high"],
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, default: "open", enum: ["open", "in_progress", "closed"] },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // for support agent
    resolutionNote: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);
