// routes/notificationRoutes.js

import express from "express";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import {
  getMyNotifications,
  getNotificationStats,
  getUnreadCount,
  getNotificationById,
  markNotificationAsRead,
  markAllAsRead,
  deleteNotification,
  getAllNotifications,
  createNotification,
  bulkDeleteNotifications,
} from "../controllers/notification.controller.js";

const router = express.Router();

// ==========================================================
// ALL NOTIFICATION ROUTES (Authentication Required)
// ==========================================================
router.use(protect);

// ==========================================================
// USER NOTIFICATION ROUTES
// ==========================================================

// Get all notifications
router.get("/", getMyNotifications);

// Get notification statistics
router.get("/stats", getNotificationStats);

// Get unread notification count
router.get("/unread/count", getUnreadCount);

// Get single notification
router.get("/:id", getNotificationById);

// Mark notification as read
router.put("/:id/read", markNotificationAsRead);

// Mark all notifications as read
router.put("/read/all", markAllAsRead);

// Delete notification
router.delete("/:id", deleteNotification);

// ==========================================================
// ADMIN NOTIFICATION ROUTES
// ==========================================================

// Get all notifications (Admin)
router.get(
  "/admin/all",
  authorize("admin"),
  getAllNotifications
);

// Create notification (Admin)
router.post(
  "/admin/create",
  authorize("admin"),
  createNotification
);

// Bulk delete notifications (Admin)
router.delete(
  "/admin/bulk",
  authorize("admin"),
  bulkDeleteNotifications
);

export default router;