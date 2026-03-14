const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    products: [
      {
        name: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true, min: 0 },
      },
    ],
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, default: "Card" },
    paymentStatus: {
      type: String,
      default: "Pending",
      enum: ["Pending", "Paid", "Failed", "Refunded"],
    },
    deliveryStatus: {
      type: String,
      default: "Processing",
      enum: ["Processing", "Shipped", "Delivered", "Cancelled", "Returned"],
    },
    deliveryDate: { type: Date },
    orderDate: { type: Date, default: Date.now },
    orderNumber: { type: String, unique: true, required: true },
  },
  { timestamps: true }
);

orderSchema.pre("validate", function ensureOrderNumber() {
  if (!this.orderNumber) {
    const random = Math.floor(Math.random() * 9000) + 1000;
    this.orderNumber = `ORD-${Date.now()}-${random}`;
  }
});

module.exports = mongoose.model("Order", orderSchema);
