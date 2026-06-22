// models/order.model.js

import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: [true, "Service is required"],
      index: true,
    },
    plan: {
      type: String,
      enum: ["basic", "standard", "premium"],
      required: [true, "Plan is required"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [1, "Amount must be greater than 0"],
    },
    planFeatures: {
      type: [String],
      required: true,
      default: [],
    },
    orderStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "cancelled", "failed"],
      default: "pending",
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      sparse: true,
      // default: null,
    },
    razorpayOrderId: {
      type: String,
      required: [true, "Razorpay order ID is required"],
      unique: true,
      trim: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    signature: {
      type: String,
      default: null,
      trim: true,
    },
    customerDetails: {
      name: { type: String, trim: true, default: "" },
      email: { type: String, trim: true, lowercase: true, default: "" },
      phone: { type: String, trim: true, default: "" },
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "stripe", "cash", "bank_transfer"],
      default: "razorpay",
    },
    invoiceNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    refundStatus: {
      type: String,
      enum: ["none", "requested", "approved", "rejected", "completed"],
      default: "none",
    },
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancelledReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ==========================================================
// INDEXES
// ==========================================================

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ service: 1, createdAt: -1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });

// ==========================================================
// VIRTUALS
// ==========================================================

orderSchema.virtual("formattedAmount").get(function() {
  return this.amount ? `₹${this.amount.toLocaleString('en-IN')}` : '₹0';
});


orderSchema.virtual("isPaid").get(function() {
  return this.orderStatus === "completed" && this.razorpayPaymentId;
});

orderSchema.virtual("canBeCancelled").get(function() {
  return ["pending", "processing"].includes(this.orderStatus);
});

// ==========================================================
// PRE-SAVE MIDDLEWARE (FIXED - NO next)
// ==========================================================

orderSchema.pre("save", async function() {
  try {
    if (!this.invoiceNumber && this.isNew) {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      const Order = mongoose.model("Order");
      const count = await Order.countDocuments({
        createdAt: {
          $gte: new Date(date.setHours(0, 0, 0, 0)),
          $lt: new Date(date.setHours(23, 59, 59, 999)),
        },
      });
      
      this.invoiceNumber = `INV-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
    }
  } catch (error) {
    throw error;
  }
});

// ==========================================================
// INSTANCE METHODS
// ==========================================================

orderSchema.methods.markAsCompleted = async function() {
  this.orderStatus = "completed";
  this.completedAt = new Date();
  return this.save();
};

orderSchema.methods.markAsCancelled = async function(reason = "") {
  if (!this.canBeCancelled) {
    throw new Error("Order cannot be cancelled");
  }
  this.orderStatus = "cancelled";
  this.cancelledAt = new Date();
  this.cancelledReason = reason;
  return this.save();
};

orderSchema.methods.processRefund = async function(amount, reason = "") {
  if (this.orderStatus !== "completed") {
    throw new Error("Only completed orders can be refunded");
  }
  this.refundStatus = "requested";
  this.refundAmount = amount || this.amount;
  this.notes = reason;
  return this.save();
};

orderSchema.methods.updatePayment = async function(paymentId, razorpayPaymentId, signature) {
  this.paymentId = paymentId;
  this.razorpayPaymentId = razorpayPaymentId;
  this.signature = signature;
  return this.save();
};

// ==========================================================
// STATIC METHODS
// ==========================================================

orderSchema.statics.getOrdersByUser = function(userId) {
  return this.find({ user: userId })
    .populate("service", "name slug category serviceImage")
    .sort({ createdAt: -1 });
};

orderSchema.statics.getOrdersByService = function(serviceId) {
  return this.find({ service: serviceId })
    .populate("user", "fullName email")
    .sort({ createdAt: -1 });
};

orderSchema.statics.getByRazorpayOrderId = function(razorpayOrderId) {
  return this.findOne({ razorpayOrderId })
    .populate("user", "fullName email")
    .populate("service", "name slug");
};

orderSchema.statics.getOrderStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$orderStatus",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  const result = {
    pending: 0,
    processing: 0,
    completed: 0,
    cancelled: 0,
    failed: 0,
    total: 0,
    totalRevenue: 0,
  };

  stats.forEach((stat) => {
    result[stat._id] = stat.count;
    result.total += stat.count;
    if (stat._id === "completed") {
      result.totalRevenue = stat.totalAmount;
    }
  });

  return result;
};

orderSchema.statics.getMonthlyRevenue = async function(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  return this.aggregate([
    {
      $match: {
        orderStatus: "completed",
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $dayOfMonth: "$createdAt" },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

// ==========================================================
// MODEL EXPORT
// ==========================================================

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;