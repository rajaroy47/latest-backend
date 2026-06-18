// routes/adminRoutes.js

import express from "express";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import { 
  getDashboardStats,
  getSystemOverview,
  getRecentActivity,
} from "../controllers/admin.controller.js";

const router = express.Router();

// ==========================================================
// ALL ADMIN ROUTES (Authentication + Admin required)
// ==========================================================
router.use(protect);
router.use(authorize("admin"));

// ==========================================================
// ADMIN DASHBOARD ROUTES
// ==========================================================

// Get admin dashboard stats
router.get("/dashboard/stats", getDashboardStats);

// Get system overview
router.get("/dashboard/overview", getSystemOverview);

// Get recent activity
router.get("/dashboard/activity", getRecentActivity);

// ==========================================================
// ADMIN USER MANAGEMENT (Delegated to userRoutes)
// ==========================================================
// User management routes are in userRoutes.js

// ==========================================================
// ADMIN SERVICE MANAGEMENT (Delegated to serviceRoutes)
// ==========================================================
// Service management routes are in serviceRoutes.js

export default router;