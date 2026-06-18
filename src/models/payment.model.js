// models/payment.model.js

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
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

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
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

    paymentMethod: {
      type: String,
      enum: ["razorpay", "debit_card", "credit_card", "net_banking", "upi", "stripe"],
      default: "razorpay",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "partially_refunded"],
      default: "pending",
      index: true,
    },

    razorpayOrderId: {
      type: String,
      required: [true, "Razorpay order ID is required"],
      trim: true,
      index: true,
    },

    razorpayPaymentId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    razorpaySignature: {
      type: String,
      default: null,
      trim: true,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    metadata: {
      ipAddress: {
        type: String,
        default: "",
      },
      browser: {
        type: String,
        default: "",
      },
      browserVersion: {
        type: String,
        default: "",
      },
      os: {
        type: String,
        default: "",
      },
      device: {
        type: String,
        default: "desktop",
      },
      userAgent: {
        type: String,
        default: "",
      },
    },

    failureReason: {
      type: String,
      default: null,
      trim: true,
    },

    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    refundReason: {
      type: String,
      default: "",
      trim: true,
    },

    invoiceUrl: {
      type: String,
      default: "",
      trim: true,
    },

    // Additional fields
    transactionId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    // Webhook related
    webhookReceived: {
      type: Boolean,
      default: false,
    },

    webhookData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
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

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ service: 1, createdAt: -1 });
paymentSchema.index({ paymentStatus: 1, createdAt: -1 });

// ==========================================================
// VIRTUALS
// ==========================================================

// Formatted amount
paymentSchema.virtual("formattedAmount").get(function() {
  return `₹${this.amount.toLocaleString('en-IN')}`;
});

// Check if payment is successful
paymentSchema.virtual("isSuccessful").get(function() {
  return this.paymentStatus === "completed";
});

// Check if payment is refunded
paymentSchema.virtual("isRefunded").get(function() {
  return ["refunded", "partially_refunded"].includes(this.paymentStatus);
});

// ==========================================================
// INSTANCE METHODS
// ==========================================================

/**
 * Mark payment as completed
 */
paymentSchema.methods.markAsCompleted = async function(razorpayPaymentId, razorpaySignature) {
  this.paymentStatus = "completed";
  this.razorpayPaymentId = razorpayPaymentId || this.razorpayPaymentId;
  this.razorpaySignature = razorpaySignature || this.razorpaySignature;
  this.paidAt = new Date();
  return this.save();
};

/**
 * Mark payment as failed
 */
paymentSchema.methods.markAsFailed = async function(reason) {
  this.paymentStatus = "failed";
  this.failureReason = reason || "Payment failed";
  return this.save();
};

/**
 * Process refund
 */
paymentSchema.methods.processRefund = async function(amount, reason = "") {
  if (this.paymentStatus !== "completed") {
    throw new Error("Only completed payments can be refunded");
  }

  const refundAmount = amount || this.amount;
  
  if (refundAmount > this.amount) {
    throw new Error("Refund amount cannot exceed payment amount");
  }

  this.refundAmount = refundAmount;
  this.refundReason = reason;
  
  if (refundAmount === this.amount) {
    this.paymentStatus = "refunded";
  } else {
    this.paymentStatus = "partially_refunded";
  }
  
  this.refundedAt = new Date();
  return this.save();
};

// ==========================================================
// STATIC METHODS
// ==========================================================

/**
 * Get payments by user
 */
paymentSchema.statics.getPaymentsByUser = function(userId) {
  return this.find({ user: userId })
    .populate("service", "name slug category serviceImage")
    .populate("order", "plan orderStatus")
    .sort({ createdAt: -1 });
};

/**
 * Get payments by service
 */
paymentSchema.statics.getPaymentsByService = function(serviceId) {
  return this.find({ service: serviceId })
    .populate("user", "fullName email")
    .populate("order", "plan orderStatus")
    .sort({ createdAt: -1 });
};

/**
 * Get payment statistics
 */
paymentSchema.statics.getPaymentStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$paymentStatus",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  const result = {
    pending: 0,
    completed: 0,
    failed: 0,
    refunded: 0,
    partially_refunded: 0,
    total: 0,
    totalRevenue: 0,
    totalRefunded: 0,
  };

  stats.forEach((stat) => {
    result[stat._id] = stat.count;
    result.total += stat.count;
    if (stat._id === "completed") {
      result.totalRevenue = stat.totalAmount;
    }
    if (["refunded", "partially_refunded"].includes(stat._id)) {
      result.totalRefunded += stat.totalAmount;
    }
  });

  return result;
};

/**
 * Get monthly revenue
 */
paymentSchema.statics.getMonthlyRevenue = async function(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const result = await this.aggregate([
    {
      $match: {
        paymentStatus: "completed",
        paidAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $dayOfMonth: "$paidAt" },
        total: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return result;
};

/**
 * Get daily payment summary
 */
paymentSchema.statics.getDailySummary = async function(date) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const result = await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalPayments: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
        successful: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "completed"] }, 1, 0] },
        },
        failed: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "failed"] }, 1, 0] },
        },
        refunded: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "refunded"] }, 1, 0] },
        },
      },
    },
  ]);

  return result[0] || {
    totalPayments: 0,
    totalAmount: 0,
    successful: 0,
    failed: 0,
    refunded: 0,
  };
};

// ==========================================================
// MODEL EXPORT
// ==========================================================

const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

export default Payment;