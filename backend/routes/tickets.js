const express = require("express");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const { withDepartmentScope } = require("../middleware/departmentMiddleware");
const {
  createTicket,
  deleteTicket,
  getAllTickets,
  getMyTickets,
  getTicketMeta,
  getTicketStats,
  submitFeedback,
  updateTicket,
} = require("../controllers/ticketController");

const router = express.Router();

router.get("/meta", protect, getTicketMeta);
router.get("/", protect, withDepartmentScope, getMyTickets);
router.get("/stats", protect, withDepartmentScope, getTicketStats);
router.get("/all", protect, authorizeRoles("admin", "support"), withDepartmentScope, getAllTickets);
router.post("/", protect, createTicket);
router.post("/:id/feedback", protect, submitFeedback);
router.patch("/:id", protect, withDepartmentScope, updateTicket);
router.delete("/:id", protect, withDepartmentScope, deleteTicket);

module.exports = router;
