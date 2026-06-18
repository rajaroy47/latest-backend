// routes/serviceRoutes.js

import express from "express";
import {
  createService,
  getAllServices,
  getService,
  updateService,
  deleteService,
  permanentlyDeleteService,
  restoreService,
  duplicateService,
  bulkUpdateStatus,
  bulkDeleteServices,
  getFeaturedServices,
  getPopularServices,
  getServicesByCategory,
  getCategoriesWithCounts,
  addServiceSection,
  updateServiceSection,
  deleteServiceSection,
  reorderSections,
  addSidebarCard,
  updateSidebarCard,
  deleteSidebarCard,
  uploadServiceImage,
  deleteServiceImage,
  upload
} from "../controllers/service.controller.js";
import { protect, authorize, optionalAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ==========================================================
// PUBLIC ROUTES (No authentication required)
// ==========================================================

// Get all services with pagination and filters
router.get("/", getAllServices);

// Get featured services
router.get("/featured", getFeaturedServices);

// Get popular services
router.get("/popular", getPopularServices);

// Get all categories with counts
router.get("/categories", getCategoriesWithCounts);

// Get services by category
router.get("/category/:category", getServicesByCategory);

// Get single service by slug or ID (with optional auth for personalized data)
router.get("/:identifier", optionalAuth, getService);

// ==========================================================
// ADMIN ROUTES (Authentication + Admin required)
// ==========================================================
router.use(protect);
router.use(authorize("admin"));

// ==========================================================
// CORE CRUD OPERATIONS
// ==========================================================

// Create service (with image uploads)
router.post(
  "/create",
  upload.fields([
    { name: "thumbnailImage", maxCount: 1 },
    { name: "serviceImage", maxCount: 1 },
    { name: "sideImage", maxCount: 1 },
    { name: "hero.backgroundImage", maxCount: 1 },
    { name: "seo.ogImage", maxCount: 1 },
  ]),
  createService
);

// Update service (with image uploads)
router.put(
  "/:id",
  upload.fields([
    { name: "thumbnailImage", maxCount: 1 },
    { name: "serviceImage", maxCount: 1 },
    { name: "sideImage", maxCount: 1 },
    { name: "hero.backgroundImage", maxCount: 1 },
    { name: "seo.ogImage", maxCount: 1 },
  ]),
  updateService
);

// Soft delete service
router.delete("/:id", deleteService);

// Permanently delete service (hard delete with image cleanup)
router.delete("/:id/permanent", permanentlyDeleteService);

// Restore soft deleted service
router.post("/:id/restore", restoreService);

// Duplicate service
router.post("/:id/duplicate", duplicateService);

// ==========================================================
// BULK OPERATIONS
// ==========================================================

// Bulk update service status
router.patch("/bulk/status", bulkUpdateStatus);

// Bulk delete services (soft delete)
router.delete("/bulk", bulkDeleteServices);

// ==========================================================
// SECTION MANAGEMENT
// ==========================================================

// Add section to service
router.post("/:id/sections", addServiceSection);

// Update section in service
router.put("/:id/sections/:sectionId", updateServiceSection);

// Delete section from service
router.delete("/:id/sections/:sectionId", deleteServiceSection);

// Reorder sections
router.put("/:id/sections/reorder", reorderSections);

// ==========================================================
// SIDEBAR MANAGEMENT
// ==========================================================

// Add sidebar card
router.post("/:id/sidebar", addSidebarCard);

// Update sidebar card
router.put("/:id/sidebar/:cardId", updateSidebarCard);

// Delete sidebar card
router.delete("/:id/sidebar/:cardId", deleteSidebarCard);

// ==========================================================
// IMAGE MANAGEMENT
// ==========================================================

// Upload single image for service
router.post("/:id/upload-image", upload.single("image"), uploadServiceImage);

// Delete image from service
router.delete("/:id/image", deleteServiceImage);

export default router;