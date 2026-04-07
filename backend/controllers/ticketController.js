const mongoose = require("mongoose");
const Ticket = require("../models/Ticket");
const User = require("../models/User");
const Order = require("../models/Order");
const sendEmail = require("../lib/email");
const {
  DEPARTMENTS,
  PRIORITY,
  RESOLUTION_STATUSES,
  SLA_HOURS,
  STATUS,
  STATUS_TRANSITIONS,
  SUBCATEGORIES,
  derivePriority,
  toLegacyCategory,
} = require("../lib/ticketConfig");

const unresolvedStatuses = STATUS.filter((item) => !RESOLUTION_STATUSES.has(item));

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

const ticketPopulate = [
  { path: "user", select: "name email role department" },
  { path: "assignedTo", select: "name email role department" },
];

const messagePopulate = {
  path: "messages.sender",
  select: "name email role department",
};

const ensureEscalations = async (baseQuery = {}) => {
  const now = new Date();

  await Ticket.updateMany(
    {
      ...baseQuery,
      escalationStatus: false,
      status: { $nin: ["Resolved", "Closed", "Escalated"] },
      slaDeadline: { $lt: now },
    },
    {
      $set: {
        escalationStatus: true,
        status: "Escalated",
      },
    }
  );
};

const isAdminUser = (req) => req.user.role === "admin";

const canAccessTicket = (req, ticket) => {
  if (req.user.role === "user") {
    return String(ticket.user) === req.user.id;
  }

  if (isAdminUser(req)) {
    return true;
  }

  if (req.user.role === "support" && req.legacySupportScope) {
    return String(ticket.assignedTo || "") === req.user.id;
  }

  if (req.user.role === "admin" || req.user.role === "support") {
    return ticket.department === req.departmentScope;
  }

  return false;
};

const canReplyToTicket = (req, ticket) => {
  if (req.user.role === "customer") {
    req.user.role = "user";
  }

  if (req.user.role === "user") {
    return String(ticket.user) === req.user.id;
  }

  if (!["support", "admin"].includes(req.user.role)) {
    return false;
  }

  return String(ticket.assignedTo || "") === req.user.id;
};

const sortMessages = (messages = []) =>
  [...messages].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

const getAdminScopedTicketQuery = (req) => {
  if (isAdminUser(req)) {
    return {};
  }

  return { department: req.departmentScope };
};

const getMyTickets = async (req, res) => {
  try {
    const query = req.user.role === "user"
      ? { user: req.user.id }
      : isAdminUser(req)
        ? {}
      : req.user.role === "support" && req.legacySupportScope
        ? { assignedTo: req.user.id }
        : { department: req.departmentScope };

    await ensureEscalations(query);

    const tickets = await Ticket.find(query)
      .populate("user", "name email role department")
      .populate("assignedTo", "name email role department")
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getAllTickets = async (req, res) => {
  try {
    const query = {};

    if (req.user.role === "user") {
      query.user = req.user.id;
    } else if (isAdminUser(req)) {
      // Admins can view globally unless a filter is explicitly applied below.
    } else if (req.user.role === "support" && req.legacySupportScope) {
      query.assignedTo = req.user.id;
    } else {
      query.department = req.departmentScope;
    }

    if (req.query.status && STATUS.includes(req.query.status)) {
      query.status = req.query.status;
    }

    if (req.query.priority && PRIORITY.includes(req.query.priority)) {
      query.priority = req.query.priority;
    }

    if (req.query.department && DEPARTMENTS.includes(req.query.department)) {
      if (req.user.role === "user" || isAdminUser(req)) {
        query.department = req.query.department;
      }
    }

    await ensureEscalations(query);

    const tickets = await Ticket.find(query)
      .populate("user", "name email role department")
      .populate("assignedTo", "name email role department")
      .sort({ createdAt: -1 });

    res.json(tickets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getTicketStats = async (req, res) => {
  try {
    const match = req.user.role === "user"
      ? { user: toObjectId(req.user.id) }
      : isAdminUser(req)
        ? {}
      : req.user.role === "support" && req.legacySupportScope
        ? { assignedTo: toObjectId(req.user.id) }
        : { department: req.departmentScope };

    await ensureEscalations(
      req.user.role === "user"
        ? { user: req.user.id }
        : isAdminUser(req)
          ? {}
        : req.user.role === "support" && req.legacySupportScope
          ? { assignedTo: req.user.id }
          : { department: req.departmentScope }
    );

    const grouped = await Ticket.aggregate([
      { $match: match },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const stats = {
      total: 0,
      Open: 0,
      Assigned: 0,
      "Under Review": 0,
      "Waiting for Customer": 0,
      Reopened: 0,
      Resolved: 0,
      Closed: 0,
      Escalated: 0,
      slaBreaches: 0,
      avgResolutionTimeHours: 0,
      ticketsPerDepartment: [],
    };

    grouped.forEach((item) => {
      if (stats[item._id] !== undefined) stats[item._id] = item.count;
      stats.total += item.count;
    });

    stats.slaBreaches = await Ticket.countDocuments({
      ...(req.user.role === "user"
        ? { user: req.user.id }
        : isAdminUser(req)
          ? {}
        : req.user.role === "support" && req.legacySupportScope
          ? { assignedTo: req.user.id }
          : { department: req.departmentScope }),
      escalationStatus: true,
    });

    const resolutionAgg = await Ticket.aggregate([
      {
        $match: {
          ...match,
          resolvedAt: { $exists: true, $ne: null },
        },
      },
      {
        $project: {
          resolutionHours: {
            $divide: [{ $subtract: ["$resolvedAt", "$createdAt"] }, 1000 * 60 * 60],
          },
        },
      },
      { $group: { _id: null, avg: { $avg: "$resolutionHours" } } },
    ]);
    stats.avgResolutionTimeHours = Number((resolutionAgg[0]?.avg || 0).toFixed(2));

    const ticketsPerDepartment = await Ticket.aggregate([
      { $match: match },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    stats.ticketsPerDepartment = ticketsPerDepartment.map((item) => ({
      department: item._id,
      count: item.count,
    }));

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const createTicket = async (req, res) => {
  const { title, description, department, subcategory, orderMongoId } = req.body;

  try {
    if (req.user.role === "customer") {
      req.user.role = "user";
    }

    if (req.user.role !== "user") {
      return res.status(403).json({ message: "Only customers can create tickets" });
    }

    if (!title?.trim() || !description?.trim() || !subcategory?.trim()) {
      return res.status(400).json({ message: "title, description, and subcategory are required" });
    }

    if (!DEPARTMENTS.includes(department)) {
      return res.status(400).json({ message: "Invalid department" });
    }

    const allowedSubcategories = SUBCATEGORIES[department] || [];
    if (!allowedSubcategories.includes(subcategory)) {
      return res.status(400).json({ message: "Invalid subcategory for department" });
    }

    let order = null;

    if (orderMongoId) {
      if (!mongoose.Types.ObjectId.isValid(orderMongoId)) {
        return res.status(400).json({ message: "Invalid orderMongoId" });
      }
      order = await Order.findOne({ _id: orderMongoId, userId: req.user.id });
      if (!order) {
        return res.status(404).json({ message: "Order not found for this user" });
      }
    }

    const now = new Date();
    const slaDeadline = new Date(now.getTime() + SLA_HOURS * 60 * 60 * 1000);

    const ticket = await Ticket.create({
      title: title.trim(),
      description: description.trim(),
      department,
      subcategory: subcategory.trim(),
      user: req.user.id,
      order: order?._id,
      orderId: order?.orderNumber || "",
      orderAmount: order?.totalAmount || 0,
      paymentMethod: order?.paymentMethod || "",
      deliveryDate: order?.deliveryDate,
      priority: derivePriority(department, subcategory),
      category: toLegacyCategory(department),
      status: "Open",
      slaDeadline,
      escalationStatus: false,
    });

    const populated = await ticket.populate(ticketPopulate);

    res.status(201).json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const updateTicket = async (req, res) => {
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

    const isLegacySupportClaimingUnassigned =
      req.user.role === "support" &&
      req.legacySupportScope &&
      !ticket.assignedTo &&
      assignedTo !== undefined &&
      (assignedTo === "self" || String(assignedTo) === req.user.id);

    if (!canAccessTicket(req, ticket) && !isLegacySupportClaimingUnassigned) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.user.role === "customer") {
      req.user.role = "user";
    }

    if (req.user.role === "user") {
      return res.status(403).json({ message: "Customers cannot update ticket workflow fields" });
    }

    let notifyUser = false;

    if (assignedTo !== undefined) {
      if (!assignedTo) {
        ticket.assignedTo = null;
        if (ticket.status === "Assigned") {
          ticket.status = "Open";
        }
      } else {
        const assigneeId = assignedTo === "self" ? req.user.id : assignedTo;
        if (!mongoose.Types.ObjectId.isValid(assigneeId)) {
          return res.status(400).json({ message: "Invalid assignee id" });
        }

        const assignee = await User.findById(assigneeId).select("role department");
        if (!assignee || !["support", "admin"].includes(assignee.role)) {
          return res.status(400).json({ message: "Assignee must be an admin/support user" });
        }

        if (assignee.role === "admin" && assignee.department && assignee.department !== ticket.department) {
          return res.status(400).json({ message: "Assignee must belong to the ticket department" });
        }
        if (assignee.role === "support" && assignee.department && assignee.department !== ticket.department) {
          return res.status(400).json({ message: "Assignee must belong to the ticket department" });
        }

        ticket.assignedTo = assignee._id;
        if (!ticket.firstResponseTime) {
          ticket.firstResponseTime = new Date();
        }
        if (ticket.status === "Open") {
          ticket.status = "Assigned";
        }
      }
      notifyUser = true;
    }

    if (priority !== undefined) {
      if (!PRIORITY.includes(priority)) {
        return res.status(400).json({ message: "Invalid priority" });
      }
      ticket.priority = priority;
      notifyUser = true;
    }

    if (resolutionNote !== undefined) {
      ticket.resolutionNote = String(resolutionNote).trim();
      if (!ticket.firstResponseTime) {
        ticket.firstResponseTime = new Date();
      }
      notifyUser = true;
    }

    if (status !== undefined) {
      if (!STATUS.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const allowedNext = STATUS_TRANSITIONS[ticket.status] || [];
      if (!allowedNext.includes(status) && ticket.status !== status) {
        return res.status(400).json({
          message: `Invalid status transition from "${ticket.status}" to "${status}"`,
        });
      }

      ticket.status = status;
      if (status === "Open") {
        ticket.assignedTo = null;
      }
      if (!ticket.firstResponseTime) {
        ticket.firstResponseTime = new Date();
      }
      if (status === "Resolved") {
        ticket.resolvedAt = new Date();
      }
      if (status === "Closed") {
        ticket.closedAt = new Date();
      }
      if (!["Resolved", "Closed"].includes(status)) {
        ticket.closedAt = undefined;
      }
      if (status !== "Resolved") {
        ticket.resolvedAt = undefined;
      }
      if (status === "Escalated") {
        ticket.escalationStatus = true;
      }
      notifyUser = true;
    }

    const now = new Date();
    if (!ticket.escalationStatus && !RESOLUTION_STATUSES.has(ticket.status) && ticket.slaDeadline < now) {
      ticket.escalationStatus = true;
      ticket.status = "Escalated";
    }

    const updated = await ticket.save();

    if (notifyUser) {
      const owner = await User.findById(updated.user).select("name email");
      if (owner?.email) {
        try {
          await sendEmail({
            to: owner.email,
            subject: `Ticket Update: ${updated.title}`,
            text: `Hello ${owner.name || "Customer"},\n\nYour ticket has been updated.\nDepartment: ${updated.department}\nStatus: ${updated.status}\nPriority: ${updated.priority}\nResolution Note: ${updated.resolutionNote || "N/A"}\n\n- Customer Operations Team`,
          });
        } catch (emailErr) {
          console.error("Email sending failed:", emailErr.message);
        }
      }
    }

    const populated = await updated.populate(ticketPopulate);
    res.json(populated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getDepartmentStats = async (req, res) => {
  try {
    const query = getAdminScopedTicketQuery(req);

    await ensureEscalations(query);

    const grouped = await Ticket.aggregate([
      { $match: query },
      {
        $group: {
          _id: { department: "$department", status: "$status" },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.department": 1,
        },
      },
    ]);

    const visibleDepartments =
      isAdminUser(req)
        ? DEPARTMENTS
        : [req.departmentScope].filter(Boolean);

    // Seed every visible department with the full status list so the chart
    // payload remains stable even when a status currently has zero tickets.
    const stats = visibleDepartments.reduce((acc, department) => {
      acc[department] = STATUS.reduce((statusAcc, status) => {
        statusAcc[status] = 0;
        return statusAcc;
      }, {});
      return acc;
    }, {});

    grouped.forEach((item) => {
      const department = item._id?.department;
      const status = item._id?.status;

      if (!department || !status) {
        return;
      }

      if (!stats[department]) {
        stats[department] = STATUS.reduce((statusAcc, statusItem) => {
          statusAcc[statusItem] = 0;
          return statusAcc;
        }, {});
      }

      if (stats[department][status] !== undefined) {
        stats[department][status] = item.count;
      }
    });

    res.json(stats);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getTicketMessages = async (req, res) => {
  try {
    if (req.user.role === "customer") {
      req.user.role = "user";
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    const ticket = await Ticket.findById(req.params.id).populate(messagePopulate);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (!canAccessTicket(req, ticket)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(sortMessages(ticket.messages));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const replyToTicket = async (req, res) => {
  const content = String(req.body?.message || "").trim();

  try {
    if (req.user.role === "customer") {
      req.user.role = "user";
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    if (!content) {
      return res.status(400).json({ message: "Message is required" });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (!canReplyToTicket(req, ticket)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    ticket.messages.push({
      sender: req.user.id,
      senderRole: req.user.role,
      message: content,
    });

    // Support/admin replies count as a response if the ticket was still awaiting first handling.
    if (!ticket.firstResponseTime && ["support", "admin"].includes(req.user.role)) {
      ticket.firstResponseTime = new Date();
    }

    // Customer replies on resolved work reopen the ticket without changing other workflow APIs.
    if (req.user.role === "user" && ["Closed", "Resolved"].includes(ticket.status)) {
      ticket.status = "Reopened";
      ticket.resolvedAt = undefined;
      ticket.closedAt = undefined;
    }

    await ticket.save();

    const populated = await Ticket.findById(ticket._id)
      .populate(ticketPopulate)
      .populate(messagePopulate);

    res.json({
      ticket: populated,
      messages: sortMessages(populated?.messages),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const submitFeedback = async (req, res) => {
  const { rating, comment } = req.body;

  try {
    if (req.user.role === "customer") {
      req.user.role = "user";
    }

    if (req.user.role !== "user") {
      return res.status(403).json({ message: "Only customers can submit feedback" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (String(ticket.user) !== req.user.id) {
      return res.status(403).json({ message: "You can only submit feedback for your own ticket" });
    }

    if (!["Resolved", "Closed"].includes(ticket.status)) {
      return res.status(400).json({ message: "Feedback is only allowed after ticket is resolved" });
    }

    const parsedRating = Number(rating);
    if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ message: "rating must be an integer between 1 and 5" });
    }

    ticket.feedback = {
      rating: parsedRating,
      comment: String(comment || "").trim(),
      submittedAt: new Date(),
    };

    await ticket.save();
    res.json({ message: "Feedback submitted", feedback: ticket.feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const deleteTicket = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ticket id" });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    if (req.user.role === "customer") {
      req.user.role = "user";
    }

    if (req.user.role === "user") {
      if (String(ticket.user) !== req.user.id) {
        return res.status(403).json({ message: "You can only delete your own tickets" });
      }
      if (ticket.status !== "Open") {
        return res.status(403).json({ message: "Only Open tickets can be deleted by users" });
      }
    } else {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Only admin can delete tickets" });
      }
    }

    await ticket.deleteOne();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getTicketMeta = async (_req, res) => {
  res.json({
    departments: DEPARTMENTS,
    subcategories: SUBCATEGORIES,
    statuses: STATUS,
    priorities: PRIORITY,
    slaHours: SLA_HOURS,
    unresolvedStatuses,
  });
};

module.exports = {
  createTicket,
  deleteTicket,
  getAllTickets,
  getDepartmentStats,
  getTicketMessages,
  getMyTickets,
  getTicketMeta,
  getTicketStats,
  replyToTicket,
  submitFeedback,
  updateTicket,
};
