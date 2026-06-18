// routes/servicePlanRoutes.js

import express from "express";
import {
    getServicePlans,
    getServicePlanByServiceId,
    getFormattedServicePlans,
    createServicePlan,
    updateServicePlan,
    deleteServicePlan,
    addPlanToService,
    removePlanFromService,
    updateSinglePlan,
    reorderPlans,
    bulkServicePlans,
} from "../controllers/servicePlan.controller.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ==========================================================
// PUBLIC ROUTES (No authentication required)
// ==========================================================

// Get all service plans
router.get("/", getServicePlans);

// Get service plan by service ID
router.get("/:serviceId", getServicePlanByServiceId);

// Get formatted plans for frontend
router.get("/:serviceId/formatted", getFormattedServicePlans);

// ==========================================================
// ADMIN ROUTES (Authentication + Admin required)
// ==========================================================
router.use(protect);
router.use(authorize("admin"));

// Create service plan
router.post("/", createServicePlan);

// Bulk create/update service plans
router.post("/bulk", bulkServicePlans);

// Update entire service plan
router.put("/:serviceId", updateServicePlan);

// Delete service plan
router.delete("/:serviceId", deleteServicePlan);

// Add single plan
router.post("/:serviceId/plans", addPlanToService);

// Update single plan
router.put("/:serviceId/plans/:planKey", updateSinglePlan);

// Remove single plan
router.delete("/:serviceId/plans/:planKey", removePlanFromService);

// Reorder plans
router.put("/:serviceId/reorder", reorderPlans);

export default router;