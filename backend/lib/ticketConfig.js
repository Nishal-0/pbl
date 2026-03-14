const DEPARTMENTS = [
  "Order Management",
  "Delivery & Logistics",
  "Returns & Refunds",
  "Payments & Billing",
  "Technical Support",
  "Account Support",
];

const STATUS = [
  "Open",
  "Assigned",
  "Under Review",
  "Waiting for Customer",
  "Resolved",
  "Closed",
  "Escalated",
];

const PRIORITY = ["low", "medium", "high"];

const REQUIRES_ORDER_DEPARTMENTS = [
  "Order Management",
  "Delivery & Logistics",
  "Returns & Refunds",
  "Payments & Billing",
];

const SUBCATEGORIES = {
  "Order Management": ["Change Address", "Cancel Order", "Update Items", "Order Not Found"],
  "Delivery & Logistics": ["Not Delivered", "Late Delivery", "Wrong Address", "Tracking Issue"],
  "Returns & Refunds": ["Return Request", "Refund Delay", "Wrong Item Returned", "Damaged Item"],
  "Payments & Billing": ["Payment Failure", "Double Charged", "Invoice Needed", "Payment Pending"],
  "Technical Support": ["App Error", "Checkout Error", "Login Issue", "Website Performance"],
  "Account Support": ["Password Reset", "Profile Update", "Account Locked", "Email Change"],
};

const PRIORITY_RULES = {
  "payment failure": "high",
  "not delivered": "high",
  "late delivery": "medium",
  "change address": "low",
};

const STATUS_TRANSITIONS = {
  Open: ["Assigned", "Under Review", "Waiting for Customer", "Resolved", "Closed", "Escalated"],
  Assigned: ["Open", "Under Review", "Waiting for Customer", "Resolved", "Closed", "Escalated"],
  "Under Review": ["Assigned","Waiting for Customer", "Resolved", "Escalated","Closed"],
  "Waiting for Customer": ["Under Review", "Resolved", "Escalated", "Closed"],
  Resolved: ["Closed", "Under Review"],
  Closed: ["Open","Waiting for Customer", "Resolved", "Escalated"],
  Escalated: ["Open", "Assigned", "Under Review", "Resolved", "Closed"],
};

const SLA_HOURS = 24;
const RESOLUTION_STATUSES = new Set(["Resolved", "Closed"]);

const normalizeSubcategory = (value = "") => String(value).trim().toLowerCase();

const derivePriority = (department, subcategory) => {
  const normalized = normalizeSubcategory(subcategory);
  if (PRIORITY_RULES[normalized]) {
    return PRIORITY_RULES[normalized];
  }

  if (department === "Payments & Billing") return "high";
  if (department === "Delivery & Logistics") return "medium";
  return "low";
};

const toLegacyCategory = (department) => {
  switch (department) {
    case "Payments & Billing":
      return "billing";
    case "Technical Support":
      return "technical";
    case "Account Support":
      return "account";
    default:
      return "general";
  }
};

module.exports = {
  DEPARTMENTS,
  PRIORITY,
  REQUIRES_ORDER_DEPARTMENTS,
  RESOLUTION_STATUSES,
  SLA_HOURS,
  STATUS,
  STATUS_TRANSITIONS,
  SUBCATEGORIES,
  derivePriority,
  normalizeSubcategory,
  toLegacyCategory,
};
