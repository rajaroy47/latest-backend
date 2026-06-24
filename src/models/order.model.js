// // models/order.model.js

// import mongoose from "mongoose";

// const orderSchema = new mongoose.Schema(
//   {
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: [true, "User is required"],
//       index: true,
//     },
//     service: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Service",
//       required: [true, "Service is required"],
//       index: true,
//     },
//     plan: {
//       type: String,
//       enum: ["basic", "standard", "premium"],
//       required: [true, "Plan is required"],
//     },
//     amount: {
//       type: Number,
//       required: [true, "Amount is required"],
//       min: [1, "Amount must be greater than 0"],
//     },
//     planFeatures: {
//       type: [String],
//       required: true,
//       default: [],
//     },
//     orderStatus: {
//       type: String,
//       enum: ["pending", "processing", "completed", "cancelled", "failed"],
//       default: "pending",
//       index: true,
//     },
//     paymentId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Payment",
//       sparse: true,
//       // default: null,
//     },
//     razorpayOrderId: {
//       type: String,
//       required: [true, "Razorpay order ID is required"],
//       unique: true,
//       trim: true,
//       index: true,
//     },
//     razorpayPaymentId: {
//       type: String,
//       default: null,
//       trim: true,
//       index: true,
//     },
//     signature: {
//       type: String,
//       default: null,
//       trim: true,
//     },
//     customerDetails: {
//       name: { type: String, trim: true, default: "" },
//       email: { type: String, trim: true, lowercase: true, default: "" },
//       phone: { type: String, trim: true, default: "" },
//     },
//     paymentMethod: {
//       type: String,
//       enum: ["razorpay", "stripe", "cash", "bank_transfer"],
//       default: "razorpay",
//     },
//     invoiceNumber: {
//       type: String,
//       trim: true,
//       unique: true,
//       sparse: true,
//     },
//     notes: {
//       type: String,
//       trim: true,
//       default: "",
//     },
//     refundStatus: {
//       type: String,
//       enum: ["none", "requested", "approved", "rejected", "completed"],
//       default: "none",
//     },
//     refundAmount: {
//       type: Number,
//       default: 0,
//       min: 0,
//     },
//     completedAt: {
//       type: Date,
//       default: null,
//     },
//     cancelledAt: {
//       type: Date,
//       default: null,
//     },
//     cancelledReason: {
//       type: String,
//       trim: true,
//       default: "",
//     },
//   },
//   {
//     timestamps: true,
//     toJSON: { virtuals: true },
//     toObject: { virtuals: true },
//   }
// );

// // ==========================================================
// // INDEXES
// // ==========================================================

// orderSchema.index({ user: 1, createdAt: -1 });
// orderSchema.index({ service: 1, createdAt: -1 });
// orderSchema.index({ orderStatus: 1, createdAt: -1 });

// // ==========================================================
// // VIRTUALS
// // ==========================================================

// orderSchema.virtual("formattedAmount").get(function() {
//   return this.amount ? `₹${this.amount.toLocaleString('en-IN')}` : '₹0';
// });


// orderSchema.virtual("isPaid").get(function() {
//   return this.orderStatus === "completed" && this.razorpayPaymentId;
// });

// orderSchema.virtual("canBeCancelled").get(function() {
//   return ["pending", "processing"].includes(this.orderStatus);
// });

// // ==========================================================
// // PRE-SAVE MIDDLEWARE (FIXED - NO next)
// // ==========================================================

// orderSchema.pre("save", async function() {
//   try {
//     if (!this.invoiceNumber && this.isNew) {
//       const date = new Date();
//       const year = date.getFullYear();
//       const month = String(date.getMonth() + 1).padStart(2, '0');
//       const day = String(date.getDate()).padStart(2, '0');
      
//       const Order = mongoose.model("Order");
//       const count = await Order.countDocuments({
//         createdAt: {
//           $gte: new Date(date.setHours(0, 0, 0, 0)),
//           $lt: new Date(date.setHours(23, 59, 59, 999)),
//         },
//       });
      
//       this.invoiceNumber = `INV-${year}${month}${day}-${String(count + 1).padStart(4, '0')}`;
//     }
//   } catch (error) {
//     throw error;
//   }
// });

// // ==========================================================
// // INSTANCE METHODS
// // ==========================================================

// orderSchema.methods.markAsCompleted = async function() {
//   this.orderStatus = "completed";
//   this.completedAt = new Date();
//   return this.save();
// };

// orderSchema.methods.markAsCancelled = async function(reason = "") {
//   if (!this.canBeCancelled) {
//     throw new Error("Order cannot be cancelled");
//   }
//   this.orderStatus = "cancelled";
//   this.cancelledAt = new Date();
//   this.cancelledReason = reason;
//   return this.save();
// };

// orderSchema.methods.processRefund = async function(amount, reason = "") {
//   if (this.orderStatus !== "completed") {
//     throw new Error("Only completed orders can be refunded");
//   }
//   this.refundStatus = "requested";
//   this.refundAmount = amount || this.amount;
//   this.notes = reason;
//   return this.save();
// };

// orderSchema.methods.updatePayment = async function(paymentId, razorpayPaymentId, signature) {
//   this.paymentId = paymentId;
//   this.razorpayPaymentId = razorpayPaymentId;
//   this.signature = signature;
//   return this.save();
// };

// // ==========================================================
// // STATIC METHODS
// // ==========================================================

// orderSchema.statics.getOrdersByUser = function(userId) {
//   return this.find({ user: userId })
//     .populate("service", "name slug category serviceImage")
//     .sort({ createdAt: -1 });
// };

// orderSchema.statics.getOrdersByService = function(serviceId) {
//   return this.find({ service: serviceId })
//     .populate("user", "fullName email")
//     .sort({ createdAt: -1 });
// };

// orderSchema.statics.getByRazorpayOrderId = function(razorpayOrderId) {
//   return this.findOne({ razorpayOrderId })
//     .populate("user", "fullName email")
//     .populate("service", "name slug");
// };

// orderSchema.statics.getOrderStats = async function() {
//   const stats = await this.aggregate([
//     {
//       $group: {
//         _id: "$orderStatus",
//         count: { $sum: 1 },
//         totalAmount: { $sum: "$amount" },
//       },
//     },
//   ]);

//   const result = {
//     pending: 0,
//     processing: 0,
//     completed: 0,
//     cancelled: 0,
//     failed: 0,
//     total: 0,
//     totalRevenue: 0,
//   };

//   stats.forEach((stat) => {
//     result[stat._id] = stat.count;
//     result.total += stat.count;
//     if (stat._id === "completed") {
//       result.totalRevenue = stat.totalAmount;
//     }
//   });

//   return result;
// };

// orderSchema.statics.getMonthlyRevenue = async function(year, month) {
//   const startDate = new Date(year, month - 1, 1);
//   const endDate = new Date(year, month, 0, 23, 59, 59);

//   return this.aggregate([
//     {
//       $match: {
//         orderStatus: "completed",
//         createdAt: { $gte: startDate, $lte: endDate },
//       },
//     },
//     {
//       $group: {
//         _id: { $dayOfMonth: "$createdAt" },
//         total: { $sum: "$amount" },
//         count: { $sum: 1 },
//       },
//     },
//     { $sort: { _id: 1 } },
//   ]);
// };

// // ==========================================================
// // MODEL EXPORT
// // ==========================================================

// const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

// export default Order;












// models/order.model.js

import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // ==========================================================
    // USER & SERVICE
    // ==========================================================
    
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

    // ==========================================================
    // PLAN & AMOUNT
    // ==========================================================
    
    plan: {
      type: String,
      enum: ["basic", "standard", "premium", "enterprise"],
      required: [true, "Plan is required"],
    },

    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [1, "Amount must be greater than 0"],
    },

    // ✅ NEW: Discount and final amount
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    couponCode: {
      type: String,
      trim: true,
      default: null,
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    finalAmount: {
      type: Number,
      default: null,
      min: 0,
    },

    planFeatures: {
      type: [String],
      required: true,
      default: [],
    },

    // ==========================================================
    // ORDER STATUS
    // ==========================================================
    
    orderStatus: {
      type: String,
      enum: ["pending", "processing", "completed", "cancelled", "failed", "refunded"],
      default: "pending",
      index: true,
    },

    // ==========================================================
    // PAYMENT REFERENCES
    // ==========================================================
    
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      sparse: true,
    },

    // ✅ NEW: Invoice reference
    invoiceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      sparse: true,
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

    // ==========================================================
    // PAYMENT METHOD
    // ==========================================================
    
    paymentMethod: {
      type: String,
      enum: ["razorpay", "stripe", "cash", "bank_transfer", "net_banking", "upi", "debit_card", "credit_card", "wallet"],
      default: "razorpay",
    },

    // ✅ NEW: Bank name for net banking payments
    bankName: {
      type: String,
      default: null,
      trim: true,
    },

    // ==========================================================
    // CUSTOMER DETAILS
    // ==========================================================
    
    customerDetails: {
      name: { 
        type: String, 
        trim: true, 
        default: "" 
      },
      email: { 
        type: String, 
        trim: true, 
        lowercase: true, 
        default: "" 
      },
      phone: { 
        type: String, 
        trim: true, 
        default: "" 
      },
      // ✅ NEW: Billing address
      billingAddress: {
        street: { type: String, default: "" },
        city: { type: String, default: "" },
        state: { type: String, default: "" },
        pincode: { type: String, default: "" },
        country: { type: String, default: "India" },
      },
      // ✅ NEW: GSTIN for GST invoices
      gstin: {
        type: String,
        default: "",
        trim: true,
        uppercase: true,
      },
      pan: {
        type: String,
        default: "",
        trim: true,
        uppercase: true,
      },
    },

    // ==========================================================
    // INVOICE
    // ==========================================================
    
    invoiceNumber: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },

    // ✅ NEW: Invoice generated flag
    invoiceGenerated: {
      type: Boolean,
      default: false,
    },

    invoiceGeneratedAt: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // ORDER METADATA
    // ==========================================================
    
    notes: {
      type: String,
      trim: true,
      default: "",
    },

    // ✅ NEW: Order type
    orderType: {
      type: String,
      enum: ["new", "renewal", "upgrade", "downgrade"],
      default: "new",
    },

    // ✅ NEW: Previous order ID for renewal/upgrade
    previousOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      sparse: true,
    },

    // ==========================================================
    // REFUND
    // ==========================================================
    
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

    refundReason: {
      type: String,
      default: "",
      trim: true,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // TIMESTAMPS
    // ==========================================================
    
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

    // ✅ NEW: Expiry date for subscriptions
    expiresAt: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // METADATA
    // ==========================================================
    
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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
// orderSchema.index({ invoiceNumber: 1 });
orderSchema.index({ invoiceGenerated: 1 });
orderSchema.index({ orderType: 1 });
orderSchema.index({ expiresAt: 1 });

// ==========================================================
// VIRTUALS
// ==========================================================

orderSchema.virtual("formattedAmount").get(function() {
  return this.amount ? `₹${this.amount.toLocaleString('en-IN')}` : '₹0';
});

orderSchema.virtual("formattedFinalAmount").get(function() {
  const amount = this.finalAmount || this.amount;
  return amount ? `₹${amount.toLocaleString('en-IN')}` : '₹0';
});

orderSchema.virtual("isPaid").get(function() {
  return this.orderStatus === "completed" && this.razorpayPaymentId;
});

orderSchema.virtual("canBeCancelled").get(function() {
  return ["pending", "processing"].includes(this.orderStatus);
});

orderSchema.virtual("canBeRefunded").get(function() {
  return this.orderStatus === "completed" && this.refundStatus === "none";
});

orderSchema.virtual("isInvoiceGenerated").get(function() {
  return this.invoiceGenerated && this.invoiceNumber;
});

// ✅ NEW: Check if order is expired
orderSchema.virtual("isExpired").get(function() {
  if (!this.expiresAt) return false;
  return new Date() > new Date(this.expiresAt);
});

// ✅ NEW: Days until expiry
orderSchema.virtual("daysUntilExpiry").get(function() {
  if (!this.expiresAt) return null;
  const diff = new Date(this.expiresAt) - new Date();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
});

// ==========================================================
// PRE-SAVE MIDDLEWARE
// ==========================================================

orderSchema.pre("save", async function () {
  // ✅ Generate invoice number only if not exists and not already generated
  if (!this.invoiceNumber && this.isNew) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    const Order = mongoose.model("Order");

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const count = await Order.countDocuments({
      createdAt: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
    });

    this.invoiceNumber = `INV-${year}${month}${day}-${String(
      count + 1
    ).padStart(4, "0")}`;
  }

  // ✅ Calculate final amount if not set
  if (this.finalAmount === null || this.finalAmount === undefined) {
    this.finalAmount =
      this.amount - (this.discount || 0) + (this.taxAmount || 0);
  }

  // ✅ Set default order type
  if (!this.orderType) {
    this.orderType = "new";
  }
});

// ==========================================================
// INSTANCE METHODS
// ==========================================================

/**
 * Mark order as completed
 */
orderSchema.methods.markAsCompleted = async function() {
  this.orderStatus = "completed";
  this.completedAt = new Date();
  return this.save();
};

/**
 * Mark order as cancelled
 */
orderSchema.methods.markAsCancelled = async function(reason = "") {
  if (!this.canBeCancelled) {
    throw new Error("Order cannot be cancelled");
  }
  this.orderStatus = "cancelled";
  this.cancelledAt = new Date();
  this.cancelledReason = reason;
  return this.save();
};

/**
 * Process refund
 */
orderSchema.methods.processRefund = async function(amount, reason = "") {
  if (this.orderStatus !== "completed") {
    throw new Error("Only completed orders can be refunded");
  }
  this.refundStatus = "requested";
  this.refundAmount = amount || this.amount;
  this.refundReason = reason;
  return this.save();
};

/**
 * Update payment details
 */
orderSchema.methods.updatePayment = async function(paymentId, razorpayPaymentId, signature) {
  this.paymentId = paymentId;
  this.razorpayPaymentId = razorpayPaymentId;
  this.signature = signature;
  return this.save();
};

/**
 * ✅ Mark invoice as generated
 */
orderSchema.methods.markInvoiceGenerated = async function(invoiceId, invoiceNumber) {
  this.invoiceId = invoiceId;
  this.invoiceNumber = invoiceNumber || this.invoiceNumber;
  this.invoiceGenerated = true;
  this.invoiceGeneratedAt = new Date();
  return this.save();
};

/**
 * ✅ Set expiry date (for subscriptions)
 */
orderSchema.methods.setExpiry = async function(days, unit = 'days') {
  const now = new Date();
  switch (unit) {
    case 'days':
      this.expiresAt = new Date(now.setDate(now.getDate() + days));
      break;
    case 'months':
      this.expiresAt = new Date(now.setMonth(now.getMonth() + days));
      break;
    case 'years':
      this.expiresAt = new Date(now.setFullYear(now.getFullYear() + days));
      break;
    default:
      this.expiresAt = new Date(now.setDate(now.getDate() + days));
  }
  return this.save();
};

// ==========================================================
// STATIC METHODS
// ==========================================================

/**
 * Get orders by user with pagination
 */
orderSchema.statics.getOrdersByUser = function(userId, options = {}) {
  const { limit = 20, page = 1, orderStatus } = options;
  const query = { user: userId };
  if (orderStatus) query.orderStatus = orderStatus;
  
  const skip = (page - 1) * limit;
  
  return this.find(query)
    .populate("service", "name slug category serviceImage")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

/**
 * Get orders by service
 */
orderSchema.statics.getOrdersByService = function(serviceId) {
  return this.find({ service: serviceId })
    .populate("user", "fullName email")
    .sort({ createdAt: -1 });
};

/**
 * Get order by Razorpay order ID
 */
orderSchema.statics.getByRazorpayOrderId = function(razorpayOrderId) {
  return this.findOne({ razorpayOrderId })
    .populate("user", "fullName email")
    .populate("service", "name slug");
};

/**
 * Get order by invoice number
 */
orderSchema.statics.getByInvoiceNumber = function(invoiceNumber) {
  return this.findOne({ invoiceNumber })
    .populate("user", "fullName email")
    .populate("service", "name slug");
};

/**
 * Get orders with invoice not generated
 */
orderSchema.statics.getOrdersWithoutInvoice = async function() {
  return this.find({
    orderStatus: "completed",
    invoiceGenerated: false,
    invoiceNumber: { $exists: true, $ne: null },
  })
    .populate("user", "fullName email")
    .populate("service", "name slug")
    .sort({ createdAt: 1 });
};

/**
 * Get order statistics
 */
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
    refunded: 0,
    total: 0,
    totalRevenue: 0,
  };

  stats.forEach((stat) => {
    if (stat._id) {
      result[stat._id] = stat.count;
      result.total += stat.count;
      if (stat._id === "completed") {
        result.totalRevenue = stat.totalAmount;
      }
    }
  });

  return result;
};

/**
 * Get monthly revenue
 */
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

/**
 * Get orders expiring soon
 */
orderSchema.statics.getOrdersExpiringSoon = async function(days = 7) {
  const now = new Date();
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + days);

  return this.find({
    expiresAt: { $gte: now, $lte: expiryDate },
    orderStatus: "completed",
  })
    .populate("user", "fullName email")
    .populate("service", "name slug");
};

/**
 * Get orders by payment method
 */
orderSchema.statics.getByPaymentMethod = function(paymentMethod) {
  return this.find({ paymentMethod })
    .populate("user", "fullName email")
    .populate("service", "name slug")
    .sort({ createdAt: -1 });
};

// ==========================================================
// MODEL EXPORT
// ==========================================================

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;