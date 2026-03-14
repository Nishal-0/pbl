const mongoose = require("mongoose");
const Order = require("../models/Order");

const generateOrderNumber = (suffix = "") => {
  const random = Math.floor(Math.random() * 9000) + 1000;
  return `ORD-${Date.now()}-${random}${suffix}`;
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id }).sort({ orderDate: -1 });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const createOrder = async (req, res) => {
  try {
    const { products, totalAmount, paymentMethod, paymentStatus, deliveryStatus, deliveryDate } =
      req.body;

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ message: "products must contain at least one product" });
    }

    if (typeof totalAmount !== "number" || totalAmount < 0) {
      return res.status(400).json({ message: "totalAmount must be a valid number" });
    }

    const order = await Order.create({
      userId: req.user.id,
      products,
      totalAmount,
      paymentMethod: paymentMethod || "Card",
      paymentStatus: paymentStatus || "Pending",
      deliveryStatus: deliveryStatus || "Processing",
      deliveryDate: deliveryDate || undefined,
    });

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const getOrderById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (req.user.role === "user" && String(order.userId) !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

const seedDefaultOrders = async (req, res) => {
  try {
    const existing = await Order.find({ userId: req.user.id }).select("_id").limit(1);
    if (existing.length > 0) {
      const orders = await Order.find({ userId: req.user.id }).sort({ orderDate: -1 });
      return res.json({ message: "Orders already exist", orders });
    }

    const now = Date.now();
    const defaults = [
      {
        userId: req.user.id,
        orderNumber: generateOrderNumber("-A"),
        products: [
          { name: "Wireless Mouse", quantity: 1, price: 25.99 },
          { name: "USB-C Hub", quantity: 1, price: 39.5 },
        ],
        totalAmount: 65.49,
        paymentMethod: "Card",
        paymentStatus: "Paid",
        deliveryStatus: "Delivered",
        deliveryDate: new Date(now - 2 * 24 * 60 * 60 * 1000),
        orderDate: new Date(now - 5 * 24 * 60 * 60 * 1000),
      },
      {
        userId: req.user.id,
        orderNumber: generateOrderNumber("-B"),
        products: [{ name: "Bluetooth Headset", quantity: 1, price: 79.99 }],
        totalAmount: 79.99,
        paymentMethod: "UPI",
        paymentStatus: "Paid",
        deliveryStatus: "Shipped",
        deliveryDate: new Date(now + 2 * 24 * 60 * 60 * 1000),
        orderDate: new Date(now - 1 * 24 * 60 * 60 * 1000),
      },
      {
        userId: req.user.id,
        orderNumber: generateOrderNumber("-C"),
        products: [{ name: "Laptop Sleeve", quantity: 2, price: 19.99 }],
        totalAmount: 39.98,
        paymentMethod: "Card",
        paymentStatus: "Pending",
        deliveryStatus: "Processing",
        orderDate: new Date(now),
      },
    ];

    await Order.insertMany(defaults);
    const orders = await Order.find({ userId: req.user.id }).sort({ orderDate: -1 });
    res.status(201).json({ message: "Default orders created", orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  createOrder,
  getMyOrders,
  getOrderById,
  seedDefaultOrders,
};
