const mongoose = require("mongoose");

const DEPARTMENTS = [
  "Order Management",
  "Delivery & Logistics",
  "Returns & Refunds",
  "Payments & Billing",
  "Technical Support",
  "Account Support",
];

const TICKET_STATUS = [
  "Open",
  "Assigned",
  "Under Review",
  "Waiting for Customer",
  "Resolved",
  "Closed",
  "Escalated",
];

const ticketSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    department: {
      type: String,
      enum: DEPARTMENTS,
      required: true,
    },
    subcategory: { type: String, required: true, trim: true },
    orderId: { type: String, default: "", trim: true },
    orderAmount: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "" },
    deliveryDate: { type: Date },
    slaDeadline: { type: Date, required: true },
    firstResponseTime: { type: Date },
    escalationStatus: { type: Boolean, default: false },
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
    status: { type: String, default: "Open", enum: TICKET_STATUS },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // for support agent
    resolutionNote: { type: String, default: "" },
    resolvedAt: { type: Date },
    closedAt: { type: Date },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    feedback: {
      rating: { type: Number, min: 1, max: 5 },
      comment: { type: String, trim: true },
      submittedAt: { type: Date },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema);
