// routes/serviceStatusRoutes.js

import express from "express";
import {
  getAllServiceStatuses,
  getServiceStatusById,
  getMyServiceStatuses,
  getServiceStatusByServiceAndUser,
  createServiceStatus,
  updateServiceStatus,
  deleteServiceStatus,
  activateService,
  completeService,      // ✅ NEW
  cancelService,         // ✅ NEW
  deactivateService,
  getServiceStatusStats,
  checkUserHasActiveService,
} from "../controllers/serviceStatus.controller.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ==========================================================
// PROTECTED ROUTES (Authentication required)
// ==========================================================
router.use(protect);

// Get my service statuses
router.get("/my-statuses", getMyServiceStatuses);

// Check if user has active service
router.get("/check/:serviceId", checkUserHasActiveService);

// Get service status by service and user
router.get("/service/:serviceId/user/:userId", getServiceStatusByServiceAndUser);

// ==========================================================
// ADMIN ROUTES (Authentication + Admin required)
// ==========================================================
router.use(authorize("admin"));

// Get all service statuses
router.get("/", getAllServiceStatuses);

// Get service status statistics
router.get("/stats", getServiceStatusStats);

// Get service status by ID
router.get("/:id", getServiceStatusById);

// Create service status
router.post("/", createServiceStatus);

// Update service status
router.put("/:id", updateServiceStatus);

// Delete service status
router.delete("/:id", deleteServiceStatus);

// Activate service (processing → active)
router.post("/:id/activate", activateService);

// ✅ NEW: Complete service (active → completed)
router.post("/:id/complete", completeService);

// ✅ NEW: Cancel service (any status → cancelled)
router.post("/:id/cancel", cancelService);

// Deactivate service (any status → cancelled)
router.post("/:id/deactivate", deactivateService);

export default router;