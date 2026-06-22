// models/notification.model.js

import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    // User who owns this notification
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
      index: true,
    },

    // Notification Type
    type: {
      type: String,
      enum: [
        // Service related
        "service_active",
        "service_processing",
        "service_completed",
        "service_cancelled",
        "service_paused",
        "service_updated",
        
        // Payment related
        "payment_success",
        "payment_failed",
        "payment_pending",
        "payment_refunded",
        "payment_partial_refund",
        
        // Order related
        "order_confirmed",
        "order_processing",
        "order_completed",
        "order_cancelled",
        "order_delivered",
        
        // System related
        "system_info",
        "system_alert",
        "system_warning",
        "system_update",
        
        // User related
        "user_welcome",
        "user_verified",
        "user_password_changed",
        "user_profile_updated",
        
        // Document related
        "document_uploaded",
        "document_verified",
        "document_rejected",
        "document_pending",
        
        // Reminder related
        "reminder",
        "deadline_approaching",
        "follow_up",
      ],
      required: [true, "Notification type is required"],
      index: true,
    },

    // Title (short, bold)
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },

    // Message (detailed description)
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [500, "Message cannot exceed 500 characters"],
    },

    // Priority level
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
      index: true,
    },

    // Read status
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    // Read timestamp
    readAt: {
      type: Date,
      default: null,
    },

    // Action URL (where user should navigate)
    actionUrl: {
      type: String,
      default: null,
      trim: true,
    },

    // Action label (button text)
    actionLabel: {
      type: String,
      default: null,
      trim: true,
    },

    // Related entities
    metadata: {
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        default: null,
      },
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        default: null,
      },
      paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
        default: null,
      },
      serviceStatusId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ServiceStatus",
        default: null,
      },
      // Additional dynamic data
      serviceName: {
        type: String,
        default: null,
      },
      amount: {
        type: Number,
        default: null,
      },
      status: {
        type: String,
        default: null,
      },
      plan: {
        type: String,
        default: null,
      },
      orderIdDisplay: {
        type: String,
        default: null,
      },
      daysRemaining: {
        type: Number,
        default: null,
      },
      // For custom data
      customData: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
    },

    // Expiry date (auto-delete after)
    expiresAt: {
      type: Date,
      default: null,
    },

    // For email/push notification tracking
    isEmailSent: {
      type: Boolean,
      default: false,
    },
    emailSentAt: {
      type: Date,
      default: null,
    },
    isPushSent: {
      type: Boolean,
      default: false,
    },
    pushSentAt: {
      type: Date,
      default: null,
    },

    // Created by (system or admin)
    createdBy: {
      type: String,
      enum: ["system", "admin", "user", "cron"],
      default: "system",
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

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, isRead: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete

// ==========================================================
// VIRTUALS
// ==========================================================

// Is notification recent (last 7 days)
notificationSchema.virtual("isRecent").get(function() {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return this.createdAt > sevenDaysAgo;
});

// Time ago in human readable format
notificationSchema.virtual("timeAgo").get(function() {
  const diff = Date.now() - this.createdAt.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return this.createdAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
});

// Get icon name for frontend
notificationSchema.virtual("iconName").get(function() {
  const iconMap = {
    'service_active': 'check-circle',
    'service_processing': 'loader',
    'service_completed': 'check-circle',
    'service_cancelled': 'x-circle',
    'service_paused': 'clock',
    'payment_success': 'thumbs-up',
    'payment_failed': 'alert-triangle',
    'payment_pending': 'clock',
    'payment_refunded': 'refresh-cw',
    'order_confirmed': 'shopping-bag',
    'order_cancelled': 'x-circle',
    'system_alert': 'alert-circle',
    'system_info': 'info',
    'reminder': 'clock',
  };
  return iconMap[this.type] || 'bell';
});

// Get color for frontend
notificationSchema.virtual("color").get(function() {
  const colorMap = {
    'service_active': 'emerald',
    'service_processing': 'blue',
    'service_completed': 'emerald',
    'service_cancelled': 'red',
    'service_paused': 'amber',
    'payment_success': 'emerald',
    'payment_failed': 'red',
    'payment_pending': 'amber',
    'payment_refunded': 'purple',
    'order_confirmed': 'blue',
    'order_cancelled': 'red',
    'system_alert': 'red',
    'system_info': 'blue',
    'reminder': 'amber',
  };
  return colorMap[this.type] || 'slate';
});

// ==========================================================
// INSTANCE METHODS
// ==========================================================

/**
 * Mark notification as read
 */
notificationSchema.methods.markAsRead = async function() {
  if (this.isRead) return this;
  
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

/**
 * Mark notification as unread
 */
notificationSchema.methods.markAsUnread = async function() {
  this.isRead = false;
  this.readAt = null;
  return this.save();
};

/**
 * Send notification via email
 */
notificationSchema.methods.sendEmail = async function() {
  // Implement email sending logic
  this.isEmailSent = true;
  this.emailSentAt = new Date();
  return this.save();
};

// ==========================================================
// STATIC METHODS
// ==========================================================

/**
 * Get unread notifications count for a user
 */
notificationSchema.statics.getUnreadCount = async function(userId) {
  return this.countDocuments({
    user: userId,
    isRead: false,
  });
};

/**
 * Get all notifications for a user with pagination
 */
notificationSchema.statics.getUserNotifications = async function(userId, options = {}) {
  const {
    limit = 20,
    page = 1,
    isRead,
    type,
    priority,
    startDate,
    endDate,
  } = options;

  const query = { user: userId };
  
  if (isRead !== undefined) query.isRead = isRead;
  if (type) query.type = type;
  if (priority) query.priority = priority;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    this.countDocuments(query),
  ]);

  return {
    data: notifications,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  };
};

/**
 * Create a notification with proper defaults
 */
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this({
    ...data,
    expiresAt: data.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
  });
  
  return notification.save();
};

/**
 * Bulk create notifications
 */
notificationSchema.statics.bulkCreate = async function(notifications) {
  return this.insertMany(notifications.map(n => ({
    ...n,
    expiresAt: n.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })));
};

/**
 * Mark all notifications as read for a user
 */
notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { user: userId, isRead: false },
    { 
      $set: { 
        isRead: true, 
        readAt: new Date() 
      } 
    }
  );
};

/**
 * Delete old notifications (older than days)
 */
notificationSchema.statics.deleteOldNotifications = async function(days = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isRead: true,
  });
};

/**
 * Get notification statistics for a user
 */
notificationSchema.statics.getStats = async function(userId) {
  const stats = await this.aggregate([
    {
      $match: { user: mongoose.Types.ObjectId(userId) }
    },
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 },
        unread: {
          $sum: { $cond: [{ $eq: ["$isRead", false] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        type: "$_id",
        count: 1,
        unread: 1,
        read: { $subtract: ["$count", "$unread"] },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const unreadCount = await this.getUnreadCount(userId);
  const totalCount = await this.countDocuments({ user: userId });

  return {
    total: totalCount,
    unread: unreadCount,
    read: totalCount - unreadCount,
    byType: stats,
  };
};

// ==========================================================
// PRE-SAVE MIDDLEWARE
// ==========================================================

notificationSchema.pre('save', async function() { 
  // Ensure expiresAt is set if not provided 
  if (!this.expiresAt) { 
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 
  } 
  
  // If marking as read, set readAt 
  if (this.isModified('isRead') && this.isRead && !this.readAt) { 
    this.readAt = new Date(); 
  }
  
  // No next() needed! Mongoose resolves when the async function resolves.
});

// ==========================================================
// POST-SAVE MIDDLEWARE (for real-time notifications)
// ==========================================================

notificationSchema.post('save', function(doc) {
  // This can be used to trigger real-time notifications via Socket.io
  // Example: io.to(doc.user.toString()).emit('new-notification', doc);
});

// ==========================================================
// MODEL EXPORT
// ==========================================================

const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

export default Notification;