const mongoose = require("mongoose");

const DEPARTMENTS = [
  "Order Management",
  "Delivery & Logistics",
  "Returns & Refunds",
  "Payments & Billing",
  "Technical Support",
  "Account Support",
];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    googleId: { type: String }, // Google login
    role: { type: String, default: "user", enum: ["user", "customer", "support", "admin"] },
    department: {
      type: String,
      enum: DEPARTMENTS,
      default: undefined,
    },
  },
  { timestamps: true }
);

userSchema.pre("validate", function enforceDepartmentByRole() {
  if (this.role === "customer") {
    this.role = "user";
  }

  const isAdmin = this.role === "admin";
  if (isAdmin && !this.department) {
    this.invalidate("department", "Department is required for admin users");
  }
  if (!isAdmin && this.role !== "support") {
    this.department = undefined;
  }
});

module.exports = mongoose.model("User", userSchema);
