// controllers/notificationController.js

import mongoose from "mongoose";
import Notification from "../models/notification.model.js";
import {
  successResponse,
  errorResponse,
  badRequestResponse,
  notFoundResponse,
  logger,
} from "../utils/index.js";

// ==========================================================
// GET MY NOTIFICATIONS
// ==========================================================

export const getMyNotifications = async (req, res) => {
  try {
    const { limit = 20, page = 1, isRead, type, priority } = req.query;

    const result = await Notification.getUserNotifications(req.user._id, {
      limit: parseInt(limit),
      page: parseInt(page),
      isRead,
      type,
      priority,
    });

    return successResponse(res, {
      message: "Notifications fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    logger.error("Get my notifications error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch notifications",
    });
  }
};

// ==========================================================
// GET NOTIFICATION BY ID
// ==========================================================

export const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequestResponse(res, { message: "Invalid notification ID" });
    }

    const notification = await Notification.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!notification) {
      return notFoundResponse(res, { message: "Notification not found" });
    }

    return successResponse(res, {
      message: "Notification fetched successfully",
      data: notification,
    });
  } catch (error) {
    logger.error("Get notification by ID error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch notification",
    });
  }
};

// ==========================================================
// MARK NOTIFICATION AS READ
// ==========================================================

export const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequestResponse(res, { message: "Invalid notification ID" });
    }

    const notification = await Notification.findOne({
      _id: id,
      user: req.user._id,
    });

    if (!notification) {
      return notFoundResponse(res, { message: "Notification not found" });
    }

    await notification.markAsRead();

    return successResponse(res, {
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    logger.error("Mark notification as read error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to mark notification as read",
    });
  }
};

// ==========================================================
// MARK ALL NOTIFICATIONS AS READ
// ==========================================================

export const markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.markAllAsRead(req.user._id);

    return successResponse(res, {
      message: "All notifications marked as read",
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    logger.error("Mark all as read error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to mark all notifications as read",
    });
  }
};

// ==========================================================
// GET UNREAD COUNT
// ==========================================================

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.user._id);

    return successResponse(res, {
      message: "Unread count fetched successfully",
      data: { unreadCount: count },
    });
  } catch (error) {
    logger.error("Get unread count error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to get unread count",
    });
  }
};

// ==========================================================
// GET NOTIFICATION STATS
// ==========================================================

export const getNotificationStats = async (req, res) => {
  try {
    const stats = await Notification.getStats(req.user._id);

    return successResponse(res, {
      message: "Notification stats fetched successfully",
      data: stats,
    });
  } catch (error) {
    logger.error("Get notification stats error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to get notification stats",
    });
  }
};

// ==========================================================
// DELETE NOTIFICATION
// ==========================================================

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequestResponse(res, { message: "Invalid notification ID" });
    }

    const notification = await Notification.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });

    if (!notification) {
      return notFoundResponse(res, { message: "Notification not found" });
    }

    return successResponse(res, {
      message: "Notification deleted successfully",
    });
  } catch (error) {
    logger.error("Delete notification error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to delete notification",
    });
  }
};

// ==========================================================
// ADMIN: GET ALL NOTIFICATIONS
// ==========================================================

export const getAllNotifications = async (req, res) => {
  try {
    const { 
      limit = 50, 
      page = 1, 
      user,
      type,
      isRead,
      priority,
      startDate,
      endDate,
    } = req.query;

    const query = {};
    if (user) query.user = user;
    if (type) query.type = type;
    if (isRead !== undefined) query.isRead = isRead === 'true';
    if (priority) query.priority = priority;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .populate("user", "fullName email")
        .populate("metadata.serviceId", "name slug")
        .populate("metadata.orderId", "orderStatus amount")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments(query),
    ]);

    return successResponse(res, {
      message: "All notifications fetched successfully",
      data: notifications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error("Get all notifications error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch notifications",
    });
  }
};

// ==========================================================
// ADMIN: CREATE NOTIFICATION (Manual)
// ==========================================================

export const createNotification = async (req, res) => {
  try {
    const { 
      user, 
      type, 
      title, 
      message, 
      priority, 
      actionUrl, 
      actionLabel,
      metadata,
    } = req.body;

    if (!user || !type || !title || !message) {
      return badRequestResponse(res, {
        message: "User, type, title, and message are required",
      });
    }

    const notification = await Notification.createNotification({
      user,
      type,
      title,
      message,
      priority: priority || "medium",
      actionUrl: actionUrl || null,
      actionLabel: actionLabel || null,
      metadata: metadata || {},
      createdBy: "admin",
    });

    return successResponse(res, {
      message: "Notification created successfully",
      data: notification,
    });
  } catch (error) {
    logger.error("Create notification error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to create notification",
    });
  }
};

// ==========================================================
// ADMIN: BULK DELETE NOTIFICATIONS
// ==========================================================

export const bulkDeleteNotifications = async (req, res) => {
  try {
    const { userId, olderThan } = req.body;

    const query = {};
    if (userId) query.user = userId;
    if (olderThan) {
      const date = new Date();
      date.setDate(date.getDate() - parseInt(olderThan));
      query.createdAt = { $lt: date };
    }

    const result = await Notification.deleteMany(query);

    return successResponse(res, {
      message: "Notifications deleted successfully",
      data: {
        deletedCount: result.deletedCount,
      },
    });
  } catch (error) {
    logger.error("Bulk delete notifications error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to delete notifications",
    });
  }
};

// ==========================================================
// HELPER: Create notification for service status changes
// ==========================================================

export const createServiceStatusNotification = async (userId, serviceStatus) => {
  const statusMap = {
    'pending': {
      type: 'service_pending',
      title: '⏳ Service Pending',
      message: `Your ${serviceStatus.serviceId?.name || 'service'} is pending review.`,
    },
    'processing': {
      type: 'service_processing',
      title: '🔄 Service Processing',
      message: `Your ${serviceStatus.serviceId?.name || 'service'} is being processed.`,
    },
    'active': {
      type: 'service_active',
      title: '✅ Service Activated',
      message: `Your ${serviceStatus.serviceId?.name || 'service'} has been activated successfully.`,
    },
    'completed': {
      type: 'service_completed',
      title: '🎉 Service Completed',
      message: `Your ${serviceStatus.serviceId?.name || 'service'} has been completed.`,
    },
    'cancelled': {
      type: 'service_cancelled',
      title: '❌ Service Cancelled',
      message: `Your ${serviceStatus.serviceId?.name || 'service'} has been cancelled.`,
    },
  };

  const config = statusMap[serviceStatus.status] || statusMap['processing'];

  return Notification.createNotification({
    user: userId,
    type: config.type,
    title: config.title,
    message: config.message,
    priority: serviceStatus.status === 'active' ? 'high' : 'medium',
    actionUrl: '/dashboard',
    actionLabel: 'View Status',
    metadata: {
      serviceId: serviceStatus.serviceId,
      serviceStatusId: serviceStatus._id,
      serviceName: serviceStatus.serviceId?.name,
      status: serviceStatus.status,
      plan: serviceStatus.plan,
    },
  });
};

// ==========================================================
// EXPORT ALL
// ==========================================================

export default {
  getMyNotifications,
  getNotificationById,
  markNotificationAsRead,
  markAllAsRead,
  getUnreadCount,
  getNotificationStats,
  deleteNotification,
  getAllNotifications,
  createNotification,
  bulkDeleteNotifications,
  createServiceStatusNotification,
};