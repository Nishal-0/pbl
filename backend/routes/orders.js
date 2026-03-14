const express = require("express");
const protect = require("../middleware/authMiddleware");
const authorizeRoles = require("../middleware/roleMiddleware");
const {
  createOrder,
  getMyOrders,
  getOrderById,
  seedDefaultOrders,
} = require("../controllers/orderController");

const router = express.Router();

router.get("/my", protect, getMyOrders);
router.post("/seed-defaults", protect, authorizeRoles("user", "customer"), seedDefaultOrders);
router.get("/:id", protect, getOrderById);
router.post("/", protect, authorizeRoles("user", "customer", "admin"), createOrder);

module.exports = router;
