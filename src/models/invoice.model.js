// models/invoice.model.js

import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    // ==========================================================
    // INVOICE IDENTIFICATION
    // ==========================================================
    
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // ==========================================================
    // RELATED ENTITIES
    // ==========================================================
    
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
      index: true,
    },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      required: [true, "Payment is required"],
      index: true,
    },

    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: [true, "Service is required"],
      index: true,
    },

    // ==========================================================
    // INVOICE DATES
    // ==========================================================
    
    invoiceDate: {
      type: Date,
      default: Date.now,
    },

    dueDate: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // AMOUNT DETAILS
    // ==========================================================
    
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    taxRate: {
      type: Number,
      default: 0, // 18% GST
      min: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ==========================================================
    // PAYMENT DETAILS
    // ==========================================================
    
    paymentMethod: {
      type: String,
      enum: ["razorpay", "debit_card", "credit_card", "net_banking", "upi", "wallet", "bank_transfer", "cash"],
      required: true,
    },

    paymentStatus: {
      type: String,
      enum: ["paid", "unpaid", "partial", "refunded"],
      default: "paid",
    },

    paymentDate: {
      type: Date,
      default: null,
    },

    transactionId: {
      type: String,
      trim: true,
      default: null,
    },

    // ==========================================================
    // CUSTOMER DETAILS (Snapshot at invoice generation)
    // ==========================================================
    
    customerDetails: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        default: "",
        trim: true,
      },
      address: {
        street: { type: String, default: "" },
        city: { type: String, default: "" },
        state: { type: String, default: "" },
        pincode: { type: String, default: "" },
        country: { type: String, default: "India" },
      },
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
    // SERVICE DETAILS (Snapshot at invoice generation)
    // ==========================================================
    
    serviceDetails: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      plan: {
        type: String,
        required: true,
        trim: true,
      },
      description: {
        type: String,
        default: "",
        trim: true,
      },
      features: {
        type: [String],
        default: [],
      },
    },

    // ==========================================================
    // COMPANY DETAILS
    // ==========================================================
    
    companyDetails: {
      name: {
        type: String,
        default: "CFI V2.0",
        trim: true,
      },
      address: {
        type: String,
        default: "",
        trim: true,
      },
      email: {
        type: String,
        default: "support@cfiv2.com",
        trim: true,
        lowercase: true,
      },
      phone: {
        type: String,
        default: "",
        trim: true,
      },
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
      cin: {
        type: String,
        default: "",
        trim: true,
        uppercase: true,
      },
      website: {
        type: String,
        default: "",
        trim: true,
      },
      logo: {
        type: String,
        default: "",
        trim: true,
      },
    },

    // ==========================================================
    // INVOICE STATUS
    // ==========================================================
    
    status: {
      type: String,
      enum: ["draft", "generated", "sent", "viewed", "paid", "overdue", "cancelled"],
      default: "generated",
    },

    // ==========================================================
    // EMAIL TRACKING
    // ==========================================================
    
    emailSent: {
      type: Boolean,
      default: false,
    },

    emailSentAt: {
      type: Date,
      default: null,
    },

    emailOpened: {
      type: Boolean,
      default: false,
    },

    emailOpenedAt: {
      type: Date,
      default: null,
    },

    // ==========================================================
    // PDF STORAGE
    // ==========================================================
    
    pdfUrl: {
      type: String,
      default: null,
      trim: true,
    },

    pdfPublicId: {
      type: String,
      default: null,
      trim: true,
    },

    // ==========================================================
    // ADDITIONAL FIELDS
    // ==========================================================
    
    notes: {
      type: String,
      default: "",
      trim: true,
    },

    termsAndConditions: {
      type: String,
      default: "Payment is due within 15 days. Late payment may incur additional charges.",
      trim: true,
    },

    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
    },

    // ==========================================================
    // METADATA
    // ==========================================================
    
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ==========================================================
    // CUSTOM FIELDS FOR EXTENSIBILITY
    // ==========================================================
    
    customFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
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

invoiceSchema.index({ user: 1, createdAt: -1 });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ invoiceDate: 1 });
invoiceSchema.index({ dueDate: 1 });
invoiceSchema.index({ paymentStatus: 1 });
invoiceSchema.index({ "customerDetails.email": 1 });

// ==========================================================
// VIRTUALS
// ==========================================================

invoiceSchema.virtual("formattedTotal").get(function() {
  return `₹${this.totalAmount.toLocaleString('en-IN')}`;
});

invoiceSchema.virtual("formattedSubtotal").get(function() {
  return `₹${this.subtotal.toLocaleString('en-IN')}`;
});

invoiceSchema.virtual("formattedTax").get(function() {
  return `₹${this.taxAmount.toLocaleString('en-IN')}`;
});

invoiceSchema.virtual("formattedDiscount").get(function() {
  return `₹${this.discount.toLocaleString('en-IN')}`;
});

invoiceSchema.virtual("isOverdue").get(function() {
  if (!this.dueDate) return false;
  if (this.status === "paid" || this.status === "cancelled") return false;
  return new Date() > new Date(this.dueDate);
});

invoiceSchema.virtual("isPaid").get(function() {
  return this.paymentStatus === "paid" || this.status === "paid";
});

invoiceSchema.virtual("daysUntilDue").get(function() {
  if (!this.dueDate) return null;
  const now = new Date();
  const due = new Date(this.dueDate);
  const diff = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
  return diff;
});

invoiceSchema.virtual("ageInDays").get(function() {
  const diff = Date.now() - new Date(this.createdAt);
  return Math.floor(diff / (1000 * 60 * 60 * 24));
});

// ==========================================================
// PRE-SAVE MIDDLEWARE
// ==========================================================

invoiceSchema.pre("save", function () {
  // Generate invoice number if not provided
  if (!this.invoiceNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const day = String(new Date().getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");

    this.invoiceNumber = `INV-${year}${month}${day}-${random}`;
  }

  // Set invoice date if not set
  if (!this.invoiceDate) {
    this.invoiceDate = new Date();
  }

  // Set due date if not set
  if (!this.dueDate) {
    const dueDate = new Date(this.invoiceDate);
    dueDate.setDate(dueDate.getDate() + 15);
    this.dueDate = dueDate;
  }
});

// ==========================================================
// INSTANCE METHODS
// ==========================================================

/**
 * Mark invoice as sent
 */
invoiceSchema.methods.markAsSent = async function() {
  this.status = "sent";
  this.emailSent = true;
  this.emailSentAt = new Date();
  return this.save();
};

/**
 * Mark invoice as viewed
 */
invoiceSchema.methods.markAsViewed = async function() {
  if (this.status !== "viewed") {
    this.status = "viewed";
    this.emailOpened = true;
    this.emailOpenedAt = new Date();
    await this.save();
  }
  return this;
};

/**
 * Mark invoice as paid
 */
invoiceSchema.methods.markAsPaid = async function() {
  this.status = "paid";
  this.paymentStatus = "paid";
  this.paymentDate = new Date();
  return this.save();
};

/**
 * Mark invoice as overdue
 */
invoiceSchema.methods.markAsOverdue = async function() {
  if (this.status !== "paid" && this.status !== "cancelled") {
    this.status = "overdue";
    await this.save();
  }
  return this;
};

/**
 * Cancel invoice
 */
invoiceSchema.methods.cancel = async function(reason = "") {
  this.status = "cancelled";
  if (reason) {
    this.notes = this.notes ? `${this.notes}\nCancelled: ${reason}` : `Cancelled: ${reason}`;
  }
  return this.save();
};

/**
 * Update PDF URL
 */
invoiceSchema.methods.updatePDF = async function(pdfUrl, publicId) {
  this.pdfUrl = pdfUrl;
  this.pdfPublicId = publicId;
  return this.save();
};

// ==========================================================
// STATIC METHODS
// ==========================================================

/**
 * Generate next invoice number
 */
invoiceSchema.statics.generateInvoiceNumber = async function() {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const day = String(new Date().getDate()).padStart(2, "0");
  const dateStr = `${year}${month}${day}`;
  
  // Get count of invoices today
  const todayCount = await this.countDocuments({
    invoiceNumber: { $regex: `^INV-${dateStr}-` }
  });
  
  // Sequential number (todayCount + 1)
  const seqNum = String(todayCount + 1).padStart(3, "0");
  
  // Random 3 digits
  const randomDigits = String(Math.floor(Math.random() * 900) + 100);
  
  // Format: INV-YYYYMMDD-SEQ-RND
  // Example: INV-20260624-001-847
  const invoiceNumber = `INV-${dateStr}-${seqNum}-${randomDigits}`;
  
  // Double-check uniqueness
  const exists = await this.findOne({ invoiceNumber });
  if (exists) {
    // If collision, try again
    return this.generateInvoiceNumber();
  }
  
  return invoiceNumber;
};


/**
 * Get invoices by user
 */
invoiceSchema.statics.getInvoicesByUser = async function(userId, options = {}) {
  const { status, limit = 20, page = 1, startDate, endDate } = options;
  
  const query = { user: userId };
  if (status) query.status = status;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }
  
  const skip = (page - 1) * limit;
  
  const [invoices, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("service", "name slug")
      .lean(),
    this.countDocuments(query),
  ]);
  
  return {
    data: invoices,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Get invoice statistics
 */
invoiceSchema.statics.getInvoiceStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$totalAmount" },
      },
    },
  ]);

  const result = {
    total: 0,
    totalRevenue: 0,
    generated: 0,
    sent: 0,
    viewed: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
  };

  stats.forEach((stat) => {
    if (stat._id) {
      result[stat._id] = stat.count;
      result.total += stat.count;
      if (stat._id === "paid") {
        result.totalRevenue = stat.totalAmount;
      }
    }
  });

  return result;
};

/**
 * Get monthly invoice revenue
 */
invoiceSchema.statics.getMonthlyRevenue = async function(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  return this.aggregate([
    {
      $match: {
        status: "paid",
        paymentDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: { $dayOfMonth: "$paymentDate" },
        total: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

/**
 * Get overdue invoices
 */
invoiceSchema.statics.getOverdueInvoices = async function() {
  const now = new Date();
  return this.find({
    status: { $nin: ["paid", "cancelled"] },
    dueDate: { $lt: now },
  })
    .populate("user", "fullName email")
    .populate("service", "name")
    .sort({ dueDate: 1 });
};

/**
 * Get invoices by payment method
 */
invoiceSchema.statics.getByPaymentMethod = async function(paymentMethod) {
  return this.find({ paymentMethod })
    .populate("user", "fullName email")
    .populate("service", "name")
    .sort({ createdAt: -1 });
};

// ==========================================================
// MODEL EXPORT
// ==========================================================

const Invoice = mongoose.models.Invoice || mongoose.model("Invoice", invoiceSchema);

export default Invoice;