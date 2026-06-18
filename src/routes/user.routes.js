// routes/userRoutes.js

import express from "express";
import {
  getUserProfile,
  getUserById,
  updateUserProfile,
  deleteUserAvatar,
  updatePassword,
  getAllUsers,
  updateUserByAdmin,
  deleteUserByAdmin,
  restoreUserByAdmin,
  bulkUpdateUserStatus,
  bulkDeleteUsers,
  getUserStats,
} from "../controllers/user.controller.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import { upload } from "../utils/index.js";

const router = express.Router();

// ==========================================================
// PROTECTED ROUTES (Authentication required)
// ==========================================================
router.use(protect);

// ==========================================================
// USER PROFILE ROUTES
// ==========================================================

// Get current user profile
router.get("/profile", getUserProfile);

// Update user profile (with avatar upload)
router.put("/profile", upload.single("avatar"), updateUserProfile);

// Delete user avatar
router.delete("/avatar", deleteUserAvatar);

// Update password
router.put("/password", updatePassword);

// ==========================================================
// ADMIN ROUTES (Admin only)
// ==========================================================
router.use(authorize("admin"));

// Get all users with pagination and filters
router.get("/all", getAllUsers);

// Get user statistics
router.get("/stats", getUserStats);

// Get user by ID
router.get("/:id", getUserById);

// Update user by ID
router.put("/:id", updateUserByAdmin);

// Soft delete user by ID
router.delete("/:id", deleteUserByAdmin);

// Restore deleted user
router.post("/:id/restore", restoreUserByAdmin);

// Bulk update user status
router.patch("/bulk/status", bulkUpdateUserStatus);

// Bulk delete users
router.delete("/bulk", bulkDeleteUsers);

export default router;