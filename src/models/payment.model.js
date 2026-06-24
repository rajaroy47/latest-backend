// // models/payment.model.js

// import mongoose from "mongoose";

// const paymentSchema = new mongoose.Schema(
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

//     order: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Order",
//       required: [true, "Order is required"],
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

//     paymentMethod: {
//       type: String,
//       enum: ["razorpay", "debit_card", "credit_card", "net_banking", "upi", "stripe"],
//       default: "razorpay",
//     },

//     paymentStatus: {
//       type: String,
//       enum: ["pending", "completed", "failed", "refunded", "partially_refunded"],
//       default: "pending",
//       index: true,
//     },

//     razorpayOrderId: {
//       type: String,
//       required: [true, "Razorpay order ID is required"],
//       trim: true,
//       index: true,
//     },

//     razorpayPaymentId: {
//       type: String,
//       default: null,
//       trim: true,
//       index: true,
//     },

//     razorpaySignature: {
//       type: String,
//       default: null,
//       trim: true,
//     },

//     paidAt: {
//       type: Date,
//       default: null,
//     },

//     metadata: {
//       ipAddress: {
//         type: String,
//         default: "",
//       },
//       browser: {
//         type: String,
//         default: "",
//       },
//       browserVersion: {
//         type: String,
//         default: "",
//       },
//       os: {
//         type: String,
//         default: "",
//       },
//       device: {
//         type: String,
//         default: "desktop",
//       },
//       userAgent: {
//         type: String,
//         default: "",
//       },
//     },

//     failureReason: {
//       type: String,
//       default: null,
//       trim: true,
//     },

//     refundAmount: {
//       type: Number,
//       default: 0,
//       min: 0,
//     },

//     refundedAt: {
//       type: Date,
//       default: null,
//     },

//     refundReason: {
//       type: String,
//       default: "",
//       trim: true,
//     },

//     invoiceUrl: {
//       type: String,
//       default: "",
//       trim: true,
//     },

//     // Additional fields
//     transactionId: {
//       type: String,
//       trim: true,
//       default: null,
//       index: true,
//     },

//     currency: {
//       type: String,
//       default: "INR",
//       uppercase: true,
//       trim: true,
//     },

//     notes: {
//       type: String,
//       default: "",
//       trim: true,
//     },

//     // Webhook related
//     webhookReceived: {
//       type: Boolean,
//       default: false,
//     },

//     webhookData: {
//       type: mongoose.Schema.Types.Mixed,
//       default: null,
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

// paymentSchema.index({ user: 1, createdAt: -1 });
// paymentSchema.index({ service: 1, createdAt: -1 });
// paymentSchema.index({ paymentStatus: 1, createdAt: -1 });

// // ==========================================================
// // VIRTUALS
// // ==========================================================

// // Formatted amount
// paymentSchema.virtual("formattedAmount").get(function() {
//   return `₹${this.amount.toLocaleString('en-IN')}`;
// });

// // Check if payment is successful
// paymentSchema.virtual("isSuccessful").get(function() {
//   return this.paymentStatus === "completed";
// });

// // Check if payment is refunded
// paymentSchema.virtual("isRefunded").get(function() {
//   return ["refunded", "partially_refunded"].includes(this.paymentStatus);
// });

// // ==========================================================
// // INSTANCE METHODS
// // ==========================================================

// /**
//  * Mark payment as completed
//  */
// paymentSchema.methods.markAsCompleted = async function(razorpayPaymentId, razorpaySignature) {
//   this.paymentStatus = "completed";
//   this.razorpayPaymentId = razorpayPaymentId || this.razorpayPaymentId;
//   this.razorpaySignature = razorpaySignature || this.razorpaySignature;
//   this.paidAt = new Date();
//   return this.save();
// };

// /**
//  * Mark payment as failed
//  */
// paymentSchema.methods.markAsFailed = async function(reason) {
//   this.paymentStatus = "failed";
//   this.failureReason = reason || "Payment failed";
//   return this.save();
// };

// /**
//  * Process refund
//  */
// paymentSchema.methods.processRefund = async function(amount, reason = "") {
//   if (this.paymentStatus !== "completed") {
//     throw new Error("Only completed payments can be refunded");
//   }

//   const refundAmount = amount || this.amount;
  
//   if (refundAmount > this.amount) {
//     throw new Error("Refund amount cannot exceed payment amount");
//   }

//   this.refundAmount = refundAmount;
//   this.refundReason = reason;
  
//   if (refundAmount === this.amount) {
//     this.paymentStatus = "refunded";
//   } else {
//     this.paymentStatus = "partially_refunded";
//   }
  
//   this.refundedAt = new Date();
//   return this.save();
// };

// // ==========================================================
// // STATIC METHODS
// // ==========================================================

// /**
//  * Get payments by user
//  */
// paymentSchema.statics.getPaymentsByUser = function(userId) {
//   return this.find({ user: userId })
//     .populate("service", "name slug category serviceImage")
//     .populate("order", "plan orderStatus")
//     .sort({ createdAt: -1 });
// };

// /**
//  * Get payments by service
//  */
// paymentSchema.statics.getPaymentsByService = function(serviceId) {
//   return this.find({ service: serviceId })
//     .populate("user", "fullName email")
//     .populate("order", "plan orderStatus")
//     .sort({ createdAt: -1 });
// };

// /**
//  * Get payment statistics
//  */
// paymentSchema.statics.getPaymentStats = async function() {
//   const stats = await this.aggregate([
//     {
//       $group: {
//         _id: "$paymentStatus",
//         count: { $sum: 1 },
//         totalAmount: { $sum: "$amount" },
//       },
//     },
//   ]);

//   const result = {
//     pending: 0,
//     completed: 0,
//     failed: 0,
//     refunded: 0,
//     partially_refunded: 0,
//     total: 0,
//     totalRevenue: 0,
//     totalRefunded: 0,
//   };

//   stats.forEach((stat) => {
//     result[stat._id] = stat.count;
//     result.total += stat.count;
//     if (stat._id === "completed") {
//       result.totalRevenue = stat.totalAmount;
//     }
//     if (["refunded", "partially_refunded"].includes(stat._id)) {
//       result.totalRefunded += stat.totalAmount;
//     }
//   });

//   return result;
// };

// /**
//  * Get monthly revenue
//  */
// paymentSchema.statics.getMonthlyRevenue = async function(year, month) {
//   const startDate = new Date(year, month - 1, 1);
//   const endDate = new Date(year, month, 0, 23, 59, 59);

//   const result = await this.aggregate([
//     {
//       $match: {
//         paymentStatus: "completed",
//         paidAt: { $gte: startDate, $lte: endDate },
//       },
//     },
//     {
//       $group: {
//         _id: { $dayOfMonth: "$paidAt" },
//         total: { $sum: "$amount" },
//         count: { $sum: 1 },
//       },
//     },
//     { $sort: { _id: 1 } },
//   ]);

//   return result;
// };

// /**
//  * Get daily payment summary
//  */
// paymentSchema.statics.getDailySummary = async function(date) {
//   const startDate = new Date(date);
//   startDate.setHours(0, 0, 0, 0);
//   const endDate = new Date(date);
//   endDate.setHours(23, 59, 59, 999);

//   const result = await this.aggregate([
//     {
//       $match: {
//         createdAt: { $gte: startDate, $lte: endDate },
//       },
//     },
//     {
//       $group: {
//         _id: null,
//         totalPayments: { $sum: 1 },
//         totalAmount: { $sum: "$amount" },
//         successful: {
//           $sum: { $cond: [{ $eq: ["$paymentStatus", "completed"] }, 1, 0] },
//         },
//         failed: {
//           $sum: { $cond: [{ $eq: ["$paymentStatus", "failed"] }, 1, 0] },
//         },
//         refunded: {
//           $sum: { $cond: [{ $eq: ["$paymentStatus", "refunded"] }, 1, 0] },
//         },
//       },
//     },
//   ]);

//   return result[0] || {
//     totalPayments: 0,
//     totalAmount: 0,
//     successful: 0,
//     failed: 0,
//     refunded: 0,
//   };
// };

// // ==========================================================
// // MODEL EXPORT
// // ==========================================================

// const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

// export default Payment;



// models/payment.model.js

// import mongoose from "mongoose";

// const paymentSchema = new mongoose.Schema(
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

//     order: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Order",
//       required: [true, "Order is required"],
//       index: true,
//     },

//     plan: {
//       type: String,
//       enum: ["basic", "standard", "premium", "enterprise"],
//       required: [true, "Plan is required"],
//     },

//     amount: {
//       type: Number,
//       required: [true, "Amount is required"],
//       min: [1, "Amount must be greater than 0"],
//     },

//     paymentMethod: {
//       type: String,
//       enum: ["razorpay", "debit_card", "credit_card", "net_banking", "upi", "stripe"],
//       default: "razorpay",
//     },

//     paymentStatus: {
//       type: String,
//       enum: ["pending", "completed", "failed", "refunded", "partially_refunded"],
//       default: "pending",
//       index: true,
//     },

//     // ✅ NEW: Bank name for net banking payments
//     bankName: {
//       type: String,
//       default: null,
//       trim: true,
//       index: true,
//     },

//     razorpayOrderId: {
//       type: String,
//       required: [true, "Razorpay order ID is required"],
//       trim: true,
//       index: true,
//     },

//     razorpayPaymentId: {
//       type: String,
//       default: null,
//       trim: true,
//       index: true,
//     },

//     razorpaySignature: {
//       type: String,
//       default: null,
//       trim: true,
//     },

//     paidAt: {
//       type: Date,
//       default: null,
//     },

//     metadata: {
//       ipAddress: {
//         type: String,
//         default: "",
//       },
//       browser: {
//         type: String,
//         default: "",
//       },
//       browserVersion: {
//         type: String,
//         default: "",
//       },
//       os: {
//         type: String,
//         default: "",
//       },
//       device: {
//         type: String,
//         default: "desktop",
//       },
//       userAgent: {
//         type: String,
//         default: "",
//       },
//     },

//     failureReason: {
//       type: String,
//       default: null,
//       trim: true,
//     },

//     refundAmount: {
//       type: Number,
//       default: 0,
//       min: 0,
//     },

//     refundedAt: {
//       type: Date,
//       default: null,
//     },

//     refundReason: {
//       type: String,
//       default: "",
//       trim: true,
//     },

//     invoiceUrl: {
//       type: String,
//       default: "",
//       trim: true,
//     },

//     // Additional fields
//     transactionId: {
//       type: String,
//       trim: true,
//       default: null,
//       index: true,
//     },

//     currency: {
//       type: String,
//       default: "INR",
//       uppercase: true,
//       trim: true,
//     },

//     notes: {
//       type: String,
//       default: "",
//       trim: true,
//     },

//     // Webhook related
//     webhookReceived: {
//       type: Boolean,
//       default: false,
//     },

//     webhookData: {
//       type: mongoose.Schema.Types.Mixed,
//       default: null,
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

// paymentSchema.index({ user: 1, createdAt: -1 });
// paymentSchema.index({ service: 1, createdAt: -1 });
// paymentSchema.index({ paymentStatus: 1, createdAt: -1 });

// // ==========================================================
// // VIRTUALS
// // ==========================================================

// // Formatted amount
// paymentSchema.virtual("formattedAmount").get(function() {
//   return `₹${this.amount.toLocaleString('en-IN')}`;
// });

// // Check if payment is successful
// paymentSchema.virtual("isSuccessful").get(function() {
//   return this.paymentStatus === "completed";
// });

// // Check if payment is refunded
// paymentSchema.virtual("isRefunded").get(function() {
//   return ["refunded", "partially_refunded"].includes(this.paymentStatus);
// });

// // ✅ Virtual to check if payment is net banking
// paymentSchema.virtual("isNetBanking").get(function() {
//   return this.paymentMethod === "net_banking";
// });

// // ✅ Virtual to get payment method label
// paymentSchema.virtual("paymentMethodLabel").get(function() {
//   const methodMap = {
//     'razorpay': 'Razorpay',
//     'debit_card': 'Debit Card',
//     'credit_card': 'Credit Card',
//     'net_banking': 'Net Banking',
//     'upi': 'UPI',
//     'stripe': 'Stripe',
//   };
//   return methodMap[this.paymentMethod] || this.paymentMethod || 'Unknown';
// });

// // ✅ Virtual to get bank display name
// paymentSchema.virtual("bankDisplayName").get(function() {
//   if (this.paymentMethod === "net_banking" && this.bankName) {
//     // Format bank name for display (e.g., "PUNB_R" -> "Punjab National Bank")
//     const bankMap = {
//       'PUNB_R': 'Punjab National Bank',
//       'SBIN': 'State Bank of India',
//       'HDFC': 'HDFC Bank',
//       'ICICI': 'ICICI Bank',
//       'AXIS': 'Axis Bank',
//       'KOTAK': 'Kotak Mahindra Bank',
//       'YESB': 'Yes Bank',
//       'IDBI': 'IDBI Bank',
//       'CANARA': 'Canara Bank',
//       'UNION': 'Union Bank of India',
//       'BOB': 'Bank of Baroda',
//       'PNB': 'Punjab National Bank',
//       'IOB': 'Indian Overseas Bank',
//       'UCO': 'UCO Bank',
//       'BOM': 'Bank of Maharashtra',
//       'CBIN': 'Central Bank of India',
//       'INDUS': 'IndusInd Bank',
//       'FEDERAL': 'Federal Bank',
//       'RBL': 'RBL Bank',
//       'DBS': 'DBS Bank',
//       'CITI': 'Citibank',
//       'HSBC': 'HSBC Bank',
//       'SCB': 'Standard Chartered Bank',
//     };
//     return bankMap[this.bankName] || this.bankName;
//   }
//   return null;
// });

// // ==========================================================
// // INSTANCE METHODS
// // ==========================================================

// /**
//  * Mark payment as completed
//  */
// paymentSchema.methods.markAsCompleted = async function(razorpayPaymentId, razorpaySignature) {
//   this.paymentStatus = "completed";
//   this.razorpayPaymentId = razorpayPaymentId || this.razorpayPaymentId;
//   this.razorpaySignature = razorpaySignature || this.razorpaySignature;
//   this.paidAt = new Date();
//   return this.save();
// };

// /**
//  * Mark payment as failed
//  */
// paymentSchema.methods.markAsFailed = async function(reason) {
//   this.paymentStatus = "failed";
//   this.failureReason = reason || "Payment failed";
//   return this.save();
// };

// /**
//  * Process refund
//  */
// paymentSchema.methods.processRefund = async function(amount, reason = "") {
//   if (this.paymentStatus !== "completed") {
//     throw new Error("Only completed payments can be refunded");
//   }

//   const refundAmount = amount || this.amount;
  
//   if (refundAmount > this.amount) {
//     throw new Error("Refund amount cannot exceed payment amount");
//   }

//   this.refundAmount = refundAmount;
//   this.refundReason = reason;
  
//   if (refundAmount === this.amount) {
//     this.paymentStatus = "refunded";
//   } else {
//     this.paymentStatus = "partially_refunded";
//   }
  
//   this.refundedAt = new Date();
//   return this.save();
// };

// /**
//  * ✅ Set bank name for net banking payments
//  */
// paymentSchema.methods.setBankName = async function(bankName) {
//   this.bankName = bankName;
//   this.paymentMethod = "net_banking";
//   return this.save();
// };

// // ==========================================================
// // STATIC METHODS
// // ==========================================================

// /**
//  * Get payments by user
//  */
// paymentSchema.statics.getPaymentsByUser = function(userId) {
//   return this.find({ user: userId })
//     .populate("service", "name slug category serviceImage")
//     .populate("order", "plan orderStatus")
//     .sort({ createdAt: -1 });
// };

// /**
//  * Get payments by service
//  */
// paymentSchema.statics.getPaymentsByService = function(serviceId) {
//   return this.find({ service: serviceId })
//     .populate("user", "fullName email")
//     .populate("order", "plan orderStatus")
//     .sort({ createdAt: -1 });
// };

// /**
//  * ✅ Get payments by bank name
//  */
// paymentSchema.statics.getPaymentsByBank = function(bankName) {
//   return this.find({ 
//     paymentMethod: "net_banking",
//     bankName: { $regex: bankName, $options: "i" }
//   })
//     .populate("user", "fullName email")
//     .populate("service", "name slug")
//     .sort({ createdAt: -1 });
// };

// /**
//  * ✅ Get bank usage statistics
//  */
// paymentSchema.statics.getBankStats = async function() {
//   return await this.aggregate([
//     {
//       $match: {
//         paymentMethod: "net_banking",
//         paymentStatus: "completed",
//         bankName: { $exists: true, $ne: null }
//       }
//     },
//     {
//       $group: {
//         _id: "$bankName",
//         count: { $sum: 1 },
//         totalAmount: { $sum: "$amount" }
//       }
//     },
//     {
//       $project: {
//         bankName: "$_id",
//         count: 1,
//         totalAmount: 1,
//         averageAmount: { $divide: ["$totalAmount", "$count"] }
//       }
//     },
//     { $sort: { count: -1 } }
//   ]);
// };

// /**
//  * Get payment statistics
//  */
// paymentSchema.statics.getPaymentStats = async function() {
//   const stats = await this.aggregate([
//     {
//       $group: {
//         _id: "$paymentStatus",
//         count: { $sum: 1 },
//         totalAmount: { $sum: "$amount" },
//       },
//     },
//   ]);

//   const result = {
//     pending: 0,
//     completed: 0,
//     failed: 0,
//     refunded: 0,
//     partially_refunded: 0,
//     total: 0,
//     totalRevenue: 0,
//     totalRefunded: 0,
//   };

//   stats.forEach((stat) => {
//     if (stat._id) {
//       result[stat._id] = stat.count;
//       result.total += stat.count;
//       if (stat._id === "completed") {
//         result.totalRevenue = stat.totalAmount;
//       }
//       if (["refunded", "partially_refunded"].includes(stat._id)) {
//         result.totalRefunded += stat.totalAmount;
//       }
//     }
//   });

//   return result;
// };

// /**
//  * Get monthly revenue
//  */
// paymentSchema.statics.getMonthlyRevenue = async function(year, month) {
//   const startDate = new Date(year, month - 1, 1);
//   const endDate = new Date(year, month, 0, 23, 59, 59);

//   const result = await this.aggregate([
//     {
//       $match: {
//         paymentStatus: "completed",
//         paidAt: { $gte: startDate, $lte: endDate },
//       },
//     },
//     {
//       $group: {
//         _id: { $dayOfMonth: "$paidAt" },
//         total: { $sum: "$amount" },
//         count: { $sum: 1 },
//       },
//     },
//     { $sort: { _id: 1 } },
//   ]);

//   return result;
// };

// /**
//  * Get daily payment summary
//  */
// paymentSchema.statics.getDailySummary = async function(date) {
//   const startDate = new Date(date);
//   startDate.setHours(0, 0, 0, 0);
//   const endDate = new Date(date);
//   endDate.setHours(23, 59, 59, 999);

//   const result = await this.aggregate([
//     {
//       $match: {
//         createdAt: { $gte: startDate, $lte: endDate },
//       },
//     },
//     {
//       $group: {
//         _id: null,
//         totalPayments: { $sum: 1 },
//         totalAmount: { $sum: "$amount" },
//         successful: {
//           $sum: { $cond: [{ $eq: ["$paymentStatus", "completed"] }, 1, 0] },
//         },
//         failed: {
//           $sum: { $cond: [{ $eq: ["$paymentStatus", "failed"] }, 1, 0] },
//         },
//         refunded: {
//           $sum: { $cond: [{ $eq: ["$paymentStatus", "refunded"] }, 1, 0] },
//         },
//         netBankingCount: {
//           $sum: { $cond: [{ $eq: ["$paymentMethod", "net_banking"] }, 1, 0] },
//         },
//       },
//     },
//   ]);

//   return result[0] || {
//     totalPayments: 0,
//     totalAmount: 0,
//     successful: 0,
//     failed: 0,
//     refunded: 0,
//     netBankingCount: 0,
//   };
// };

// // ==========================================================
// // MODEL EXPORT
// // ==========================================================

// const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

// export default Payment;







// models/payment.model.js

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema(
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

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
      index: true,
    },

    // ✅ NEW: Invoice reference
    invoice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Invoice",
      sparse: true,
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

    // ✅ NEW: Discount and tax details
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxRate: {
      type: Number,
      default: 18, // 18% GST
      min: 0,
    },

    // ✅ NEW: Final amount after discount and tax
    finalAmount: {
      type: Number,
      default: null,
      min: 0,
    },

    // ==========================================================
    // PAYMENT METHOD
    // ==========================================================
    
    paymentMethod: {
      type: String,
      enum: ["razorpay", "debit_card", "credit_card", "net_banking", "upi", "stripe", "wallet", "bank_transfer"],
      default: "razorpay",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "refunded", "partially_refunded", "processing"],
      default: "pending",
      index: true,
    },

    // ✅ NEW: Bank name for net banking payments
    bankName: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    // ✅ NEW: Payment gateway method (e.g., netbanking, card, upi)
    gatewayMethod: {
      type: String,
      default: null,
      trim: true,
    },

    // ✅ NEW: Card details (for card payments)
    cardDetails: {
      last4: { type: String, default: null, trim: true },
      network: { type: String, default: null, trim: true },
      issuer: { type: String, default: null, trim: true },
      type: { type: String, enum: ["credit", "debit"], default: null },
      emi: { type: Boolean, default: false },
    },

    // ✅ NEW: UPI details
    upiDetails: {
      vpa: { type: String, default: null, trim: true },
      name: { type: String, default: null, trim: true },
    },

    // ✅ NEW: Wallet details
    walletDetails: {
      name: { type: String, default: null, trim: true },
      provider: { type: String, default: null, trim: true },
    },

    // ==========================================================
    // RAZORPAY DETAILS
    // ==========================================================
    
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

    // ✅ NEW: Full Razorpay response
    razorpayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ==========================================================
    // PAYMENT DATES
    // ==========================================================
    
    paidAt: {
      type: Date,
      default: null,
    },

    // ✅ NEW: Payment expiry (for pending payments)
    expiresAt: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // METADATA
    // ==========================================================
    
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
      // ✅ NEW: Additional metadata
      referrer: {
        type: String,
        default: "",
      },
      sessionId: {
        type: String,
        default: "",
      },
    },

    // ==========================================================
    // FAILURE & REFUND
    // ==========================================================
    
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

    // ✅ NEW: Refund transaction ID
    refundTransactionId: {
      type: String,
      default: null,
      trim: true,
    },

    // ==========================================================
    // INVOICE
    // ==========================================================
    
    invoiceUrl: {
      type: String,
      default: "",
      trim: true,
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
    // ADDITIONAL FIELDS
    // ==========================================================
    
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

    // ==========================================================
    // SUBSCRIPTION (for recurring payments)
    // ==========================================================
    
    isRecurring: {
      type: Boolean,
      default: false,
    },

    subscriptionId: {
      type: String,
      default: null,
      trim: true,
    },

    // ==========================================================
    // WEBHOOK
    // ==========================================================
    
    webhookReceived: {
      type: Boolean,
      default: false,
    },

    webhookData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    // ==========================================================
    // TIMESTAMPS (auto-managed by timestamps: true)
    // ==========================================================
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
// paymentSchema.index({ invoice: 1 });
paymentSchema.index({ invoiceGenerated: 1 });
// paymentSchema.index({ bankName: 1 });
// paymentSchema.index({ transactionId: 1 });
// paymentSchema.index({ razorpayOrderId: 1 });
// paymentSchema.index({ razorpayPaymentId: 1 });

// ==========================================================
// VIRTUALS
// ==========================================================

paymentSchema.virtual("formattedAmount").get(function() {
  return `₹${this.amount.toLocaleString('en-IN')}`;
});

paymentSchema.virtual("formattedFinalAmount").get(function() {
  const amount = this.finalAmount || this.amount;
  return `₹${amount.toLocaleString('en-IN')}`;
});

paymentSchema.virtual("isSuccessful").get(function() {
  return this.paymentStatus === "completed";
});

paymentSchema.virtual("isRefunded").get(function() {
  return ["refunded", "partially_refunded"].includes(this.paymentStatus);
});

paymentSchema.virtual("isNetBanking").get(function() {
  return this.paymentMethod === "net_banking";
});

paymentSchema.virtual("isCardPayment").get(function() {
  return ["debit_card", "credit_card"].includes(this.paymentMethod);
});

paymentSchema.virtual("isUpiPayment").get(function() {
  return this.paymentMethod === "upi";
});

paymentSchema.virtual("paymentMethodLabel").get(function() {
  const methodMap = {
    'razorpay': 'Razorpay',
    'debit_card': 'Debit Card',
    'credit_card': 'Credit Card',
    'net_banking': 'Net Banking',
    'upi': 'UPI',
    'stripe': 'Stripe',
    'wallet': 'Wallet',
    'bank_transfer': 'Bank Transfer',
  };
  return methodMap[this.paymentMethod] || this.paymentMethod || 'Unknown';
});

paymentSchema.virtual("bankDisplayName").get(function() {
  if (this.paymentMethod === "net_banking" && this.bankName) {
    const bankMap = {
      'PUNB_R': 'Punjab National Bank',
      'SBIN': 'State Bank of India',
      'HDFC': 'HDFC Bank',
      'ICICI': 'ICICI Bank',
      'AXIS': 'Axis Bank',
      'KOTAK': 'Kotak Mahindra Bank',
      'YESB': 'Yes Bank',
      'IDBI': 'IDBI Bank',
      'CANARA': 'Canara Bank',
      'UNION': 'Union Bank of India',
      'BOB': 'Bank of Baroda',
      'PNB': 'Punjab National Bank',
      'IOB': 'Indian Overseas Bank',
      'UCO': 'UCO Bank',
      'BOM': 'Bank of Maharashtra',
      'CBIN': 'Central Bank of India',
      'INDUS': 'IndusInd Bank',
      'FEDERAL': 'Federal Bank',
      'RBL': 'RBL Bank',
      'DBS': 'DBS Bank',
      'CITI': 'Citibank',
      'HSBC': 'HSBC Bank',
      'SCB': 'Standard Chartered Bank',
    };
    return bankMap[this.bankName] || this.bankName;
  }
  return null;
});

paymentSchema.virtual("hasInvoice").get(function() {
  return this.invoiceGenerated && this.invoice;
});

paymentSchema.virtual("isExpired").get(function() {
  if (!this.expiresAt) return false;
  return new Date() > new Date(this.expiresAt);
});

// ==========================================================
// PRE-SAVE MIDDLEWARE
// ==========================================================

paymentSchema.pre("save", function () {
  // Calculate final amount if not set
  if (this.finalAmount === null || this.finalAmount === undefined) {
    this.finalAmount =
      this.amount - (this.discount || 0) + (this.taxAmount || 0);
  }
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

/**
 * Set bank name for net banking payments
 */
paymentSchema.methods.setBankName = async function(bankName) {
  this.bankName = bankName;
  this.paymentMethod = "net_banking";
  return this.save();
};

/**
 * ✅ Mark invoice as generated
 */
paymentSchema.methods.markInvoiceGenerated = async function(invoiceId, invoiceUrl) {
  this.invoice = invoiceId;
  this.invoiceUrl = invoiceUrl || this.invoiceUrl;
  this.invoiceGenerated = true;
  this.invoiceGeneratedAt = new Date();
  return this.save();
};

/**
 * ✅ Set gateway response
 */
paymentSchema.methods.setGatewayResponse = async function(gatewayMethod, cardDetails, upiDetails, walletDetails) {
  this.gatewayMethod = gatewayMethod || this.gatewayMethod;
  if (cardDetails) this.cardDetails = cardDetails;
  if (upiDetails) this.upiDetails = upiDetails;
  if (walletDetails) this.walletDetails = walletDetails;
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
    .populate("invoice", "invoiceNumber totalAmount")
    .sort({ createdAt: -1 });
};

/**
 * Get payments by service
 */
paymentSchema.statics.getPaymentsByService = function(serviceId) {
  return this.find({ service: serviceId })
    .populate("user", "fullName email")
    .populate("order", "plan orderStatus")
    .populate("invoice", "invoiceNumber totalAmount")
    .sort({ createdAt: -1 });
};

/**
 * Get payments by bank name
 */
paymentSchema.statics.getPaymentsByBank = function(bankName) {
  return this.find({ 
    paymentMethod: "net_banking",
    bankName: { $regex: bankName, $options: "i" }
  })
    .populate("user", "fullName email")
    .populate("service", "name slug")
    .sort({ createdAt: -1 });
};

/**
 * ✅ Get payments without invoice
 */
paymentSchema.statics.getPaymentsWithoutInvoice = async function() {
  return this.find({
    paymentStatus: "completed",
    invoiceGenerated: false,
  })
    .populate("user", "fullName email")
    .populate("service", "name slug")
    .populate("order", "invoiceNumber")
    .sort({ createdAt: 1 });
};

/**
 * Get bank usage statistics
 */
paymentSchema.statics.getBankStats = async function() {
  return await this.aggregate([
    {
      $match: {
        paymentMethod: "net_banking",
        paymentStatus: "completed",
        bankName: { $exists: true, $ne: null }
      }
    },
    {
      $group: {
        _id: "$bankName",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" }
      }
    },
    {
      $project: {
        bankName: "$_id",
        count: 1,
        totalAmount: 1,
        averageAmount: { $divide: ["$totalAmount", "$count"] }
      }
    },
    { $sort: { count: -1 } }
  ]);
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
    processing: 0,
    completed: 0,
    failed: 0,
    refunded: 0,
    partially_refunded: 0,
    total: 0,
    totalRevenue: 0,
    totalRefunded: 0,
  };

  stats.forEach((stat) => {
    if (stat._id) {
      result[stat._id] = stat.count;
      result.total += stat.count;
      if (stat._id === "completed") {
        result.totalRevenue = stat.totalAmount;
      }
      if (["refunded", "partially_refunded"].includes(stat._id)) {
        result.totalRefunded += stat.totalAmount;
      }
    }
  });

  return result;
};

/**
 * Get payment method breakdown
 */
paymentSchema.statics.getMethodBreakdown = async function() {
  return await this.aggregate([
    {
      $match: { paymentStatus: "completed" }
    },
    {
      $group: {
        _id: "$paymentMethod",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" }
      }
    },
    {
      $project: {
        method: "$_id",
        count: 1,
        totalAmount: 1,
        percentage: {
          $multiply: [
            { $divide: ["$count", { $sum: "$count" }] },
            100
          ]
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
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
        netBankingCount: {
          $sum: { $cond: [{ $eq: ["$paymentMethod", "net_banking"] }, 1, 0] },
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
    netBankingCount: 0,
  };
};

// ==========================================================
// MODEL EXPORT
// ==========================================================

const Payment = mongoose.models.Payment || mongoose.model("Payment", paymentSchema);

export default Payment;