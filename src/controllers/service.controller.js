// controllers/serviceController.js

import Service from "../models/service.model.js"; // ✅ FIXED: Correct import path
import mongoose from "mongoose";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  upload,
  successResponse,
  errorResponse,
  createdResponse,
  notFoundResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  conflictResponse,
  logger,
  getPaginationOptions,
  getPaginatedResponse,
} from "../utils/index.js";

/* ==========================================================
   IMAGE UTILITIES
========================================================== */

// Extract all image URLs from service object
const extractImageUrls = (serviceData) => {
  const imageUrls = [];

  if (!serviceData) return imageUrls;

  // Main images
  if (serviceData.thumbnailImage) imageUrls.push(serviceData.thumbnailImage);
  if (serviceData.serviceImage) imageUrls.push(serviceData.serviceImage);
  if (serviceData.sideImage) imageUrls.push(serviceData.sideImage);

  // Hero background image
  if (serviceData.hero?.backgroundImage) imageUrls.push(serviceData.hero.backgroundImage);

  // SEO OG image
  if (serviceData.seo?.ogImage) imageUrls.push(serviceData.seo.ogImage);

  // Sidebar card images
  if (serviceData.sidebarCards && Array.isArray(serviceData.sidebarCards)) {
    serviceData.sidebarCards.forEach((card) => {
      if (card.image) imageUrls.push(card.image);
    });
  }

  // Section items images
  if (serviceData.sections && Array.isArray(serviceData.sections)) {
    serviceData.sections.forEach((section) => {
      if (section.items && Array.isArray(section.items)) {
        section.items.forEach((item) => {
          if (item.image) imageUrls.push(item.image);
        });
      }
    });
  }

  return imageUrls;
};

// Extract all public IDs from Cloudinary URLs
const extractPublicIds = (imageUrls) => {
  const publicIds = [];

  imageUrls.forEach((url) => {
    if (!url) return;
    const publicId = extractPublicIdFromUrl(url);
    if (publicId) {
      publicIds.push(publicId);
    }
  });

  return publicIds;
};

// Delete old images when updating
const deleteOldImages = async (oldService, newServiceData) => {
  const oldImageUrls = extractImageUrls(oldService);
  const newImageUrls = extractImageUrls(newServiceData);

  const imagesToDelete = oldImageUrls.filter((oldUrl) => !newImageUrls.includes(oldUrl));

  const deletionResults = [];
  for (const imageUrl of imagesToDelete) {
    const publicId = extractPublicIdFromUrl(imageUrl);
    if (publicId) {
      try {
        const result = await deleteFromCloudinary(publicId);
        deletionResults.push({ publicId, success: true, result });
      } catch (error) {
        logger.error(`Failed to delete image ${publicId}:`, error);
        deletionResults.push({ publicId, success: false, error: error.message });
      }
    }
  }

  return deletionResults;
};

// Process uploaded files and upload to Cloudinary
const processUploadedFiles = async (files, updateData) => {
  const processedData = { ...updateData };

  // Define file fields and their destinations
  const fileFields = [
    { fieldName: "thumbnailImage", targetPath: "thumbnailImage" },
    { fieldName: "serviceImage", targetPath: "serviceImage" },
    { fieldName: "sideImage", targetPath: "sideImage" },
    { fieldName: "hero.backgroundImage", targetPath: "hero.backgroundImage" },
    { fieldName: "seo.ogImage", targetPath: "seo.ogImage" },
  ];

  // Process each file field
  for (const { fieldName, targetPath } of fileFields) {
    const file = files?.[fieldName]?.[0];

    if (file) {
      try {
        const uploadResult = await uploadToCloudinary(file, {
          folder: "services",
          transformation: [{ width: 1200, height: 800, crop: "limit" }],
        });

        if (targetPath.includes(".")) {
          const [parent, child] = targetPath.split(".");
          if (!processedData[parent]) processedData[parent] = {};
          processedData[parent][child] = uploadResult.secure_url;
        } else {
          processedData[targetPath] = uploadResult.secure_url;
        }
      } catch (error) {
        logger.error(`Error uploading ${fieldName}:`, error);
      }
    }
  }

  return processedData;
};

// Parse JSON strings in update data
const parseJSONFields = (updateData) => {
  const parsedData = { ...updateData };

  const jsonFields = ["hero", "seo", "flags", "metrics", "sidebarCards", "sections"];

  jsonFields.forEach((field) => {
    if (parsedData[field] && typeof parsedData[field] === "string") {
      try {
        parsedData[field] = JSON.parse(parsedData[field]);
      } catch (error) {
        logger.error(`Failed to parse ${field}:`, error);
      }
    }
  });

  return parsedData;
};

/* ==========================================================
   CORE CRUD OPERATIONS
========================================================== */

// @desc    Create a new service
// @route   POST /api/services
// @access  Private (Admin)
export const createService = async (req, res) => {
  try {
    const files = req.files || {};

    // Parse JSON fields
    let serviceData = parseJSONFields(req.body);

    // Process uploaded files
    serviceData = await processUploadedFiles(files, serviceData);

    // Add audit information
    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    serviceData.createdBy = req.user._id;

    // Generate slug if not provided
    if (!serviceData.slug && serviceData.name) {
      serviceData.slug = serviceData.name
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "-")
        .replace(/-+/g, "-");
    }

    // Check if service with same slug exists
    const existingService = await Service.findOne({ slug: serviceData.slug });
    if (existingService) {
      return conflictResponse(res, { message: "Service with this slug already exists" });
    }

    // Create service
    const service = await Service.create(serviceData);

    return createdResponse(res, {
      message: "Service created successfully",
      data: service,
    });
  } catch (error) {
    logger.error("Create service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to create service",
    });
  }
};

// @desc    Get all services with pagination and filtering
// @route   GET /api/services
// @access  Public
export const getAllServices = async (req, res) => {
  try {
    const {
      category,
      isActive,
      isFeatured,
      isPopular,
      search,
      includeDeleted = "false",
    } = req.query;

    // Build query
    const query = includeDeleted !== "true" ? { isDeleted: false } : {};

    if (category) query.category = category;
    if (isActive !== undefined) query["flags.isActive"] = isActive === "true";
    if (isFeatured !== undefined) query["flags.isFeatured"] = isFeatured === "true";
    if (isPopular !== undefined) query["flags.isPopular"] = isPopular === "true";

    // Search
    if (search) {
      query.$text = { $search: search };
    }

    // Pagination
    const paginationOptions = getPaginationOptions(req.query);
    const { skip, limit, sort } = paginationOptions;

    // Execute query
    const [services, total] = await Promise.all([
      Service.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("createdBy", "name email")
        .populate("updatedBy", "name email")
        .lean(),
      Service.countDocuments(query),
    ]);

    return getPaginatedResponse(res, services, total, paginationOptions);
  } catch (error) {
    logger.error("Get all services error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch services",
    });
  }
};

// @desc    Get single service by slug or ID
// @route   GET /api/services/:identifier
// @access  Public
export const getService = async (req, res) => {
  try {
    const { identifier } = req.params;

    // Check if identifier is ObjectId or slug
    const query = mongoose.Types.ObjectId.isValid(identifier)
      ? { _id: identifier, isDeleted: false }
      : { slug: identifier, isDeleted: false };

    const service = await Service.findOne(query)
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email")
      .lean();

    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    return successResponse(res, {
      message: "Service fetched successfully",
      data: service,
    });
  } catch (error) {
    logger.error("Get service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch service",
    });
  }
};

// @desc    Update service
// @route   PUT /api/services/:id
// @access  Private (Admin)
export const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const files = req.files || {};

    // Find existing service
    const existingService = await Service.findById(id);
    if (!existingService) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    // Parse JSON fields
    let updateData = parseJSONFields(req.body);

    // Process uploaded files
    updateData = await processUploadedFiles(files, updateData);

    // Add audit information
    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    updateData.updatedBy = req.user._id;

    // Check slug uniqueness if being updated
    if (updateData.slug && updateData.slug !== existingService.slug) {
      const slugExists = await Service.findOne({
        slug: updateData.slug,
        _id: { $ne: id },
        isDeleted: false,
      });
      if (slugExists) {
        return conflictResponse(res, { message: "Service with this slug already exists" });
      }
    }

    // Delete old images that are being replaced
    const hasNewImages = Object.keys(files).length > 0;
    if (hasNewImages) {
      await deleteOldImages(existingService, updateData);
    }

    // Update service
    const updatedService = await Service.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("createdBy", "name email")
      .populate("updatedBy", "name email");

    return successResponse(res, {
      message: "Service updated successfully",
      data: updatedService,
    });
  } catch (error) {
    logger.error("Update service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to update service",
    });
  }
};

// @desc    Soft delete service
// @route   DELETE /api/services/:id
// @access  Private (Admin)
export const deleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    // Soft delete
    await service.softDelete();

    return successResponse(res, {
      message: "Service soft deleted successfully",
      data: {
        id: service._id,
        deletedAt: service.deletedAt,
      },
    });
  } catch (error) {
    logger.error("Delete service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to delete service",
    });
  }
};

// @desc    Permanently delete service (hard delete with image cleanup)
// @route   DELETE /api/services/:id/permanent
// @access  Private (Admin)
export const permanentlyDeleteService = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    // Extract and delete all associated images from Cloudinary
    const imageUrls = extractImageUrls(service);
    const publicIds = extractPublicIds(imageUrls);

    const deletionResults = [];
    for (const publicId of publicIds) {
      try {
        const result = await deleteFromCloudinary(publicId);
        deletionResults.push({ publicId, success: true, result });
      } catch (error) {
        logger.error(`Failed to delete image ${publicId}:`, error);
        deletionResults.push({ publicId, success: false, error: error.message });
      }
    }

    // Hard delete from database
    await Service.findByIdAndDelete(id);

    return successResponse(res, {
      message: "Service permanently deleted",
      data: {
        imagesDeleted: deletionResults,
      },
    });
  } catch (error) {
    logger.error("Permanent delete service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to permanently delete service",
    });
  }
};

// @desc    Restore soft deleted service
// @route   POST /api/services/:id/restore
// @access  Private (Admin)
export const restoreService = async (req, res) => {
  try {
    const { id } = req.params;

    // Need to bypass the default find query that excludes deleted documents
    const service = await Service.findOne({
      _id: id,
      isDeleted: true,
    });

    if (!service) {
      return notFoundResponse(res, { message: "Deleted service not found" });
    }

    await service.restore();

    return successResponse(res, {
      message: "Service restored successfully",
      data: service,
    });
  } catch (error) {
    logger.error("Restore service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to restore service",
    });
  }
};

// @desc    Duplicate service
// @route   POST /api/services/:id/duplicate
// @access  Private (Admin)
export const duplicateService = async (req, res) => {
  try {
    const { id } = req.params;

    const originalService = await Service.findById(id);
    if (!originalService) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    // Create duplicate data
    const serviceData = originalService.toObject();
    delete serviceData._id;
    delete serviceData.createdAt;
    delete serviceData.updatedAt;
    delete serviceData.__v;

    serviceData.name = `${serviceData.name} (Copy)`;
    serviceData.slug = `${serviceData.slug}-copy-${Date.now()}`;
    serviceData.flags = {
      ...serviceData.flags,
      isActive: false,
      isFeatured: false,
      isPopular: false,
      isNew: true,
    };
    serviceData.createdBy = req.user._id;
    serviceData.updatedBy = req.user._id;
    serviceData.isDeleted = false;
    serviceData.deletedAt = null;

    const newService = await Service.create(serviceData);

    return createdResponse(res, {
      message: "Service duplicated successfully",
      data: newService,
    });
  } catch (error) {
    logger.error("Duplicate service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to duplicate service",
    });
  }
};

/* ==========================================================
   BULK OPERATIONS
========================================================== */

// @desc    Bulk update service status
// @route   PATCH /api/services/bulk/status
// @access  Private (Admin)
export const bulkUpdateStatus = async (req, res) => {
  try {
    const { serviceIds, status } = req.body;

    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return badRequestResponse(res, { message: "Please provide service IDs" });
    }

    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    const result = await Service.updateMany(
      { _id: { $in: serviceIds }, isDeleted: false },
      {
        $set: {
          "flags.isActive": status,
          updatedBy: req.user._id,
        },
      }
    );

    return successResponse(res, {
      message: `Updated ${result.modifiedCount} services`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    logger.error("Bulk update status error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to update services",
    });
  }
};

// @desc    Bulk delete services (soft delete)
// @route   DELETE /api/services/bulk
// @access  Private (Admin)
export const bulkDeleteServices = async (req, res) => {
  try {
    const { serviceIds } = req.body;

    if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length === 0) {
      return badRequestResponse(res, { message: "Please provide service IDs" });
    }

    const services = await Service.find({ _id: { $in: serviceIds }, isDeleted: false });

    const deletedCount = await Promise.all(services.map((service) => service.softDelete()));

    return successResponse(res, {
      message: `Deleted ${deletedCount.length} services`,
      data: {
        deletedCount: deletedCount.length,
      },
    });
  } catch (error) {
    logger.error("Bulk delete services error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to delete services",
    });
  }
};

/* ==========================================================
   SPECIALIZED QUERIES
========================================================== */

// @desc    Get featured services
// @route   GET /api/services/featured
// @access  Public
export const getFeaturedServices = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const services = await Service.getFeaturedServices(parseInt(limit));

    return successResponse(res, {
      message: "Featured services fetched successfully",
      data: services,
    });
  } catch (error) {
    logger.error("Get featured services error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch featured services",
    });
  }
};

// @desc    Get popular services
// @route   GET /api/services/popular
// @access  Public
export const getPopularServices = async (req, res) => {
  try {
    const { limit = 6 } = req.query;

    const services = await Service.getPopularServices(parseInt(limit));

    return successResponse(res, {
      message: "Popular services fetched successfully",
      data: services,
    });
  } catch (error) {
    logger.error("Get popular services error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch popular services",
    });
  }
};

// @desc    Get services by category
// @route   GET /api/services/category/:category
// @access  Public
export const getServicesByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { limit = 50 } = req.query;

    const services = await Service.getByCategory(category, parseInt(limit));

    return successResponse(res, {
      message: `Services in category '${category}' fetched successfully`,
      data: services,
    });
  } catch (error) {
    logger.error("Get services by category error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch services by category",
    });
  }
};

// @desc    Get all categories with service counts
// @route   GET /api/services/categories/list
// @access  Public
export const getCategoriesWithCounts = async (req, res) => {
  try {
    const categories = await Service.aggregate([
      {
        $match: {
          "flags.isActive": true,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          name: "$_id",
          count: 1,
          _id: 0,
        },
      },
      { $sort: { name: 1 } },
    ]);

    return successResponse(res, {
      message: "Categories fetched successfully",
      data: categories,
    });
  } catch (error) {
    logger.error("Get categories error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch categories",
    });
  }
};

/* ==========================================================
   SECTION MANAGEMENT
========================================================== */

// @desc    Add section to service
// @route   POST /api/services/:id/sections
// @access  Private (Admin)
export const addServiceSection = async (req, res) => {
  try {
    const { id } = req.params;
    const sectionData = req.body;

    const service = await Service.findById(id);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    // Auto-generate order
    sectionData.order = service.sections.length;

    service.sections.push(sectionData);
    service.updatedBy = req.user._id;

    await service.save();

    return createdResponse(res, {
      message: "Section added successfully",
      data: service.sections[service.sections.length - 1],
    });
  } catch (error) {
    logger.error("Add section error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to add section",
    });
  }
};

// @desc    Update section in service
// @route   PUT /api/services/:id/sections/:sectionId
// @access  Private (Admin)
export const updateServiceSection = async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const updateData = req.body;

    const service = await Service.findById(id);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    const sectionIndex = service.sections.findIndex((section) => section.id === sectionId);

    if (sectionIndex === -1) {
      return notFoundResponse(res, { message: "Section not found" });
    }

    // Update section
    service.sections[sectionIndex] = {
      ...service.sections[sectionIndex].toObject(),
      ...updateData,
    };
    service.updatedBy = req.user._id;

    await service.save();

    return successResponse(res, {
      message: "Section updated successfully",
      data: service.sections[sectionIndex],
    });
  } catch (error) {
    logger.error("Update section error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to update section",
    });
  }
};

// @desc    Delete section from service
// @route   DELETE /api/services/:id/sections/:sectionId
// @access  Private (Admin)
export const deleteServiceSection = async (req, res) => {
  try {
    const { id, sectionId } = req.params;

    const service = await Service.findById(id);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    const sectionIndex = service.sections.findIndex((section) => section.id === sectionId);

    if (sectionIndex === -1) {
      return notFoundResponse(res, { message: "Section not found" });
    }

    service.sections.splice(sectionIndex, 1);
    service.updatedBy = req.user._id;

    await service.save();

    return successResponse(res, {
      message: "Section deleted successfully",
    });
  } catch (error) {
    logger.error("Delete section error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to delete section",
    });
  }
};

// @desc    Reorder sections
// @route   PUT /api/services/:id/sections/reorder
// @access  Private (Admin)
export const reorderSections = async (req, res) => {
  try {
    const { id } = req.params;
    const { sectionOrders } = req.body;

    if (!sectionOrders || !Array.isArray(sectionOrders)) {
      return badRequestResponse(res, { message: "Please provide section orders" });
    }

    const service = await Service.findById(id);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    // Update orders
    sectionOrders.forEach(({ id: sectionId, order }) => {
      const section = service.sections.find((s) => s.id === sectionId);
      if (section) {
        section.order = order;
      }
    });

    // Sort sections by order
    service.sections.sort((a, b) => a.order - b.order);
    service.updatedBy = req.user._id;

    await service.save();

    return successResponse(res, {
      message: "Sections reordered successfully",
      data: service.sections,
    });
  } catch (error) {
    logger.error("Reorder sections error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to reorder sections",
    });
  }
};

/* ==========================================================
   SIDEBAR MANAGEMENT
========================================================== */

// @desc    Add sidebar card
// @route   POST /api/services/:id/sidebar
// @access  Private (Admin)
export const addSidebarCard = async (req, res) => {
  try {
    const { id } = req.params;
    const cardData = req.body;

    const service = await Service.findById(id);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    // Auto-generate order
    cardData.order = service.sidebarCards.length;

    service.sidebarCards.push(cardData);
    service.updatedBy = req.user._id;

    await service.save();

    return createdResponse(res, {
      message: "Sidebar card added successfully",
      data: service.sidebarCards[service.sidebarCards.length - 1],
    });
  } catch (error) {
    logger.error("Add sidebar card error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to add sidebar card",
    });
  }
};

// @desc    Update sidebar card
// @route   PUT /api/services/:id/sidebar/:cardId
// @access  Private (Admin)
export const updateSidebarCard = async (req, res) => {
  try {
    const { id, cardId } = req.params;
    const updateData = req.body;

    const service = await Service.findById(id);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    const cardIndex = service.sidebarCards.findIndex((card) => card._id.toString() === cardId);

    if (cardIndex === -1) {
      return notFoundResponse(res, { message: "Sidebar card not found" });
    }

    service.sidebarCards[cardIndex] = {
      ...service.sidebarCards[cardIndex].toObject(),
      ...updateData,
    };
    service.updatedBy = req.user._id;

    await service.save();

    return successResponse(res, {
      message: "Sidebar card updated successfully",
      data: service.sidebarCards[cardIndex],
    });
  } catch (error) {
    logger.error("Update sidebar card error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to update sidebar card",
    });
  }
};

// @desc    Delete sidebar card
// @route   DELETE /api/services/:id/sidebar/:cardId
// @access  Private (Admin)
export const deleteSidebarCard = async (req, res) => {
  try {
    const { id, cardId } = req.params;

    const service = await Service.findById(id);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    service.sidebarCards = service.sidebarCards.filter((card) => card._id.toString() !== cardId);
    service.updatedBy = req.user._id;

    await service.save();

    return successResponse(res, {
      message: "Sidebar card deleted successfully",
    });
  } catch (error) {
    logger.error("Delete sidebar card error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to delete sidebar card",
    });
  }
};

/* ==========================================================
   IMAGE MANAGEMENT
========================================================== */

// @desc    Upload single image for service
// @route   POST /api/services/:id/upload-image
// @access  Private (Admin)
export const uploadServiceImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { fieldName } = req.body;

    if (!req.file) {
      return badRequestResponse(res, { message: "Please upload an image" });
    }

    if (!fieldName) {
      return badRequestResponse(res, {
        message: "Please provide fieldName (thumbnailImage, serviceImage, sideImage, hero.backgroundImage, seo.ogImage)",
      });
    }

    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    const service = await Service.findById(id);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    // Upload new image to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file, {
      folder: "services",
      transformation: [{ width: 1200, height: 800, crop: "limit" }],
    });

    // Delete old image if exists
    let oldImageUrl;
    if (fieldName.includes(".")) {
      const [parent, child] = fieldName.split(".");
      oldImageUrl = service[parent]?.[child];
      if (!service[parent]) service[parent] = {};
      service[parent][child] = uploadResult.secure_url;
    } else {
      oldImageUrl = service[fieldName];
      service[fieldName] = uploadResult.secure_url;
    }

    if (oldImageUrl) {
      const publicId = extractPublicIdFromUrl(oldImageUrl);
      if (publicId) {
        await deleteFromCloudinary(publicId);
      }
    }

    service.updatedBy = req.user._id;
    await service.save();

    return successResponse(res, {
      message: "Image uploaded successfully",
      data: {
        fieldName,
        url: uploadResult.secure_url,
      },
    });
  } catch (error) {
    logger.error("Upload image error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to upload image",
    });
  }
};

// @desc    Delete image from service
// @route   DELETE /api/services/:id/image
// @access  Private (Admin)
export const deleteServiceImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { fieldName } = req.body;

    if (!fieldName) {
      return badRequestResponse(res, { message: "Please provide fieldName" });
    }

    if (!req.user || !req.user._id) {
      return unauthorizedResponse(res, { message: "Authentication required" });
    }

    const service = await Service.findById(id);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    // Get image URL
    let imageUrl;
    if (fieldName.includes(".")) {
      const [parent, child] = fieldName.split(".");
      imageUrl = service[parent]?.[child];
    } else {
      imageUrl = service[fieldName];
    }

    if (!imageUrl) {
      return notFoundResponse(res, { message: "Image not found" });
    }

    // Delete from Cloudinary
    const publicId = extractPublicIdFromUrl(imageUrl);
    if (publicId) {
      await deleteFromCloudinary(publicId);
    }

    // Remove from service
    if (fieldName.includes(".")) {
      const [parent, child] = fieldName.split(".");
      if (service[parent]) {
        service[parent][child] = "";
      }
    } else {
      service[fieldName] = "";
    }

    service.updatedBy = req.user._id;
    await service.save();

    return successResponse(res, {
      message: "Image deleted successfully",
    });
  } catch (error) {
    logger.error("Delete image error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to delete image",
    });
  }
};

/* ==========================================================
   EXPORT ALL
========================================================== */

export { upload };

export default {
  // Core CRUD
  createService,
  getAllServices,
  getService,
  updateService,
  deleteService,
  permanentlyDeleteService,
  restoreService,
  duplicateService,

  // Bulk Operations
  bulkUpdateStatus,
  bulkDeleteServices,

  // Specialized Queries
  getFeaturedServices,
  getPopularServices,
  getServicesByCategory,
  getCategoriesWithCounts,

  // Section Management
  addServiceSection,
  updateServiceSection,
  deleteServiceSection,
  reorderSections,

  // Sidebar Management
  addSidebarCard,
  updateSidebarCard,
  deleteSidebarCard,

  // Image Management
  uploadServiceImage,
  deleteServiceImage,
  upload
};