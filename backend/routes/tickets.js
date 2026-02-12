const express = require("express");
const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const sendEmail = require("../lib/email");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");

const router = express.Router();
const ALLOWED_STATUS = ["open", "in_progress", "closed"];
const ALLOWED_PRIORITY = ["low", "medium", "high"];
const ALLOWED_CATEGORY = ["general", "billing", "technical", "account", "other"];

router.get("/", protect, async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user.id })
      .populate("assignedTo", "name email role")
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/stats", protect, async (req, res) => {
  try {
    let match = {};

    if (req.user.role === "user") {
      match = { user: new mongoose.Types.ObjectId(req.user.id) };
    } else if (req.user.role === "support") {
      match = { assignedTo: new mongoose.Types.ObjectId(req.user.id) };
    }

    const grouped = await Ticket.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const stats = { total: 0, open: 0, in_progress: 0, closed: 0 };
    for (const item of grouped) {
      if (stats[item._id] !== undefined) {
        stats[item._id] = item.count;
        stats.total += item.count;
      }
    }

    if (req.user.role === "admin") {
      stats.unassigned = await Ticket.countDocuments({
        $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }],
      });
    }

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/all", protect, authorizeRoles("admin", "support"), async (req, res) => {
  try {
    const query = req.user.role === "support" ? { assignedTo: req.user.id } : {};
    if (req.query.status && ALLOWED_STATUS.includes(req.query.status)) {
      query.status = req.query.status;
    }

    const tickets = await Ticket.find(query)
      .populate("user", "name email role")
      .populate("assignedTo", "name email role")
      .sort({ createdAt: -1 });
    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/", protect, async (req, res) => {
  const { title, description, category, priority } = req.body;

  try {
    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ message: "title and description are required" });
    }

    const normalizedCategory = category?.trim() || "general";
    const normalizedPriority = priority?.trim() || "medium";

    if (!ALLOWED_CATEGORY.includes(normalizedCategory)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    if (!ALLOWED_PRIORITY.includes(normalizedPriority)) {
      return res.status(400).json({ message: "Invalid priority" });
    }

    const ticket = await Ticket.create({
      title: title.trim(),
      description: description.trim(),
      category: normalizedCategory,
      priority: normalizedPriority,
      user: req.user.id,
    });
    res.status(201).json(ticket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.patch("/:id", protect, async (req, res) => {
  const { status, assignedTo, priority, resolutionNote } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    if (
      status === undefined &&
      assignedTo === undefined &&
      priority === undefined &&
      resolutionNote === undefined
    ) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (assignedTo !== undefined) {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Only admin can assign tickets" });
      }

      if (!assignedTo) {
        ticket.assignedTo = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
          return res.status(400).json({ message: "Invalid assignee id" });
        }

        const assignee = await User.findById(assignedTo);
        if (!assignee || assignee.role !== "support") {
          return res.status(400).json({ message: "Assignee must be a support user" });
        }

        ticket.assignedTo = assignee._id;
      }
    }

    let notifyUser = false;

    if (status !== undefined) {
      if (!ALLOWED_STATUS.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      if (req.user.role === "support") {
        if (!ticket.assignedTo || String(ticket.assignedTo) !== req.user.id) {
          return res.status(403).json({ message: "You can only update assigned tickets" });
        }
      } else if (req.user.role === "user") {
        return res.status(403).json({ message: "Users cannot update ticket status" });
      }

      ticket.status = status;
      notifyUser = true;
    }

    if (priority !== undefined) {
      if (!ALLOWED_PRIORITY.includes(priority)) {
        return res.status(400).json({ message: "Invalid priority" });
      }
      if (!["admin", "support"].includes(req.user.role)) {
        return res.status(403).json({ message: "You cannot update priority" });
      }
      if (
        req.user.role === "support" &&
        (!ticket.assignedTo || String(ticket.assignedTo) !== req.user.id)
      ) {
        return res.status(403).json({ message: "You can only update assigned tickets" });
      }
      ticket.priority = priority;
      notifyUser = true;
    }

    if (resolutionNote !== undefined) {
      if (!["admin", "support"].includes(req.user.role)) {
        return res.status(403).json({ message: "You cannot add resolution notes" });
      }
      if (
        req.user.role === "support" &&
        (!ticket.assignedTo || String(ticket.assignedTo) !== req.user.id)
      ) {
        return res.status(403).json({ message: "You can only update assigned tickets" });
      }
      ticket.resolutionNote = String(resolutionNote).trim();
      notifyUser = true;
    }

    const updatedTicket = await ticket.save();
    if (notifyUser) {
      const owner = await User.findById(updatedTicket.user).select("name email");
      if (owner?.email) {
        try {
          await sendEmail({
            to: owner.email,
            subject: `Your ticket "${updatedTicket.title}" was updated`,
            text: `Hello ${owner.name || "User"},\n\nYour ticket has been updated.\nStatus: ${updatedTicket.status}\nPriority: ${updatedTicket.priority}\nResolution Note: ${updatedTicket.resolutionNote || "N/A"}\n\n- Support Team`,
          });
        } catch (emailErr) {
          console.error("Email sending failed:", emailErr.message);
        }
      }
    }

    const populated = await updatedTicket.populate([
      { path: "user", select: "name email role" },
      { path: "assignedTo", select: "name email role" },
    ]);
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/:id", protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (req.user.role === "user") {
      if (String(ticket.user) !== req.user.id) {
        return res.status(403).json({ message: "You can only delete your own tickets" });
      }
      if (ticket.status !== "open") {
        return res
          .status(403)
          .json({ message: "Only open tickets can be deleted by users" });
      }
    } else if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admin can delete this ticket" });
    }

    await ticket.deleteOne();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
