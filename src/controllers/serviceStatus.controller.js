// controllers/serviceStatusController.js

import ServiceStatus from "../models/serviceStatus.model.js";
import Service from "../models/service.model.js";
import Order from "../models/order.model.js";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  badRequestResponse,
  forbiddenResponse,
  logger,
  getPaginationOptions,
  getPaginatedResponse,
} from "../utils/index.js";

// ==========================================================
// GET ALL SERVICE STATUSES (Admin Only)
// ==========================================================

/**
 * @desc    Get all service statuses with pagination and filters
 * @route   GET /api/service-status
 * @access  Private/Admin
 */
export const getAllServiceStatuses = async (req, res) => {
  try {
    const {
      status,
      serviceId,
      subscribedBy,
      isActive,
      startDate,
      endDate,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (serviceId) query.serviceId = serviceId;
    if (subscribedBy) query.subscribedBy = subscribedBy;
    if (isActive !== undefined) query.isActive = isActive === "true";

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const paginationOptions = getPaginationOptions(req.query);
    const { skip, limit, sort } = paginationOptions;

    const [statuses, total] = await Promise.all([
      ServiceStatus.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("serviceId", "name slug category serviceImage")
        .populate("subscribedBy", "fullName email")
        .lean(),
      ServiceStatus.countDocuments(query),
    ]);

    return getPaginatedResponse(res, statuses, total, paginationOptions);
  } catch (error) {
    logger.error("Get all service statuses error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch service statuses",
    });
  }
};

// ==========================================================
// GET SERVICE STATUS BY ID
// ==========================================================

/**
 * @desc    Get service status by ID
 * @route   GET /api/service-status/:id
 * @access  Private/Admin
 */
export const getServiceStatusById = async (req, res) => {
  try {
    const { id } = req.params;

    const status = await ServiceStatus.findById(id)
      .populate("serviceId", "name slug category serviceImage")
      .populate("subscribedBy", "fullName email");

    if (!status) {
      return notFoundResponse(res, { message: "Service status not found" });
    }

    return successResponse(res, {
      message: "Service status fetched successfully",
      data: status,
    });
  } catch (error) {
    logger.error("Get service status by ID error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch service status",
    });
  }
};

// ==========================================================
// GET MY SERVICE STATUSES (Current User)
// ==========================================================

/**
 * @desc    Get current user's service statuses
 * @route   GET /api/service-status/my-statuses
 * @access  Private
 */
export const getMyServiceStatuses = async (req, res) => {
  try {
    const { status, isActive, limit = 20 } = req.query;

    const query = { subscribedBy: req.user._id };
    if (status) query.status = status;
    if (isActive !== undefined) query.isActive = isActive === "true";

    const statuses = await ServiceStatus.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("serviceId", "name slug category serviceImage");

    return successResponse(res, {
      message: "My service statuses fetched successfully",
      data: statuses,
    });
  } catch (error) {
    logger.error("Get my service statuses error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch service statuses",
    });
  }
};

// ==========================================================
// GET SERVICE STATUS BY SERVICE AND USER
// ==========================================================

/**
 * @desc    Get service status by service ID and user ID
 * @route   GET /api/service-status/service/:serviceId/user/:userId
 * @access  Private
 */
export const getServiceStatusByServiceAndUser = async (req, res) => {
  try {
    const { serviceId, userId } = req.params;

    // Check authorization
    if (userId !== req.user._id.toString() && req.user.role !== "admin") {
      return forbiddenResponse(res, {
        message: "You are not authorized to view this status",
      });
    }

    const status = await ServiceStatus.findOne({
      serviceId,
      subscribedBy: userId,
    })
      .populate("serviceId", "name slug category serviceImage")
      .populate("subscribedBy", "fullName email");

    if (!status) {
      return notFoundResponse(res, {
        message: "Service status not found for this user and service",
      });
    }

    return successResponse(res, {
      message: "Service status fetched successfully",
      data: status,
    });
  } catch (error) {
    logger.error("Get service status by service and user error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch service status",
    });
  }
};

// ==========================================================
// CREATE SERVICE STATUS
// ==========================================================

/**
 * @desc    Create a new service status (usually after payment)
 * @route   POST /api/service-status
 * @access  Private/Admin
 */
export const createServiceStatus = async (req, res) => {
  try {
    const { serviceId, subscribedBy, status, plan, expiresAt, notes } = req.body;

    if (!serviceId || !subscribedBy) {
      return badRequestResponse(res, {
        message: "Service ID and Subscribed By are required",
      });
    }

    // Check if service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    // Check if user exists
    const User = mongoose.model("User");
    const user = await User.findById(subscribedBy);
    if (!user) {
      return notFoundResponse(res, { message: "User not found" });
    }

    // Check if status already exists
    const existingStatus = await ServiceStatus.findOne({
      serviceId,
      subscribedBy,
    });

    if (existingStatus) {
      return badRequestResponse(res, {
        message: "Service status already exists for this user and service",
      });
    }

    const serviceStatus = await ServiceStatus.create({
      serviceId,
      subscribedBy,
      status: status || "pending",
      plan: plan || "basic",
      expiresAt: expiresAt || null,
      notes: notes || "",
    });

    await serviceStatus.populate("serviceId", "name slug");
    await serviceStatus.populate("subscribedBy", "fullName email");

    return successResponse(res, {
      message: "Service status created successfully",
      data: serviceStatus,
    });
  } catch (error) {
    logger.error("Create service status error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to create service status",
    });
  }
};

// ==========================================================
// UPDATE SERVICE STATUS
// ==========================================================

/**
 * @desc    Update service status
 * @route   PUT /api/service-status/:id
 * @access  Private/Admin
 */
export const updateServiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, plan, expiresAt, isActive, notes } = req.body;

    const serviceStatus = await ServiceStatus.findById(id);

    if (!serviceStatus) {
      return notFoundResponse(res, { message: "Service status not found" });
    }

    // Update fields
    if (status) serviceStatus.status = status;
    if (plan) serviceStatus.plan = plan;
    if (expiresAt !== undefined) serviceStatus.expiresAt = expiresAt;
    if (isActive !== undefined) serviceStatus.isActive = isActive;
    if (notes !== undefined) serviceStatus.notes = notes;

    await serviceStatus.save();

    await serviceStatus.populate("serviceId", "name slug category");
    await serviceStatus.populate("subscribedBy", "fullName email");

    return successResponse(res, {
      message: "Service status updated successfully",
      data: serviceStatus,
    });
  } catch (error) {
    logger.error("Update service status error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to update service status",
    });
  }
};

// ==========================================================
// DELETE SERVICE STATUS
// ==========================================================

/**
 * @desc    Delete service status
 * @route   DELETE /api/service-status/:id
 * @access  Private/Admin
 */
export const deleteServiceStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const serviceStatus = await ServiceStatus.findById(id);

    if (!serviceStatus) {
      return notFoundResponse(res, { message: "Service status not found" });
    }

    await serviceStatus.deleteOne();

    return successResponse(res, {
      message: "Service status deleted successfully",
    });
  } catch (error) {
    logger.error("Delete service status error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to delete service status",
    });
  }
};

// ==========================================================
// ACTIVATE SERVICE (Admin)
// ==========================================================

/**
 * @desc    Activate a service for a user
 * @route   POST /api/service-status/:id/activate
 * @access  Private/Admin
 */
export const activateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { duration, durationUnit } = req.body;

    const serviceStatus = await ServiceStatus.findById(id);

    if (!serviceStatus) {
      return notFoundResponse(res, { message: "Service status not found" });
    }

    // Update status
    serviceStatus.status = "active";
    serviceStatus.isActive = true;

    // Set expiry if duration provided
    if (duration && durationUnit) {
      const now = new Date();
      switch (durationUnit) {
        case "days":
          serviceStatus.expiresAt = new Date(now.setDate(now.getDate() + duration));
          break;
        case "months":
          serviceStatus.expiresAt = new Date(now.setMonth(now.getMonth() + duration));
          break;
        case "years":
          serviceStatus.expiresAt = new Date(now.setFullYear(now.getFullYear() + duration));
          break;
        default:
          serviceStatus.expiresAt = null;
      }
    }

    await serviceStatus.save();

    return successResponse(res, {
      message: "Service activated successfully",
      data: serviceStatus,
    });
  } catch (error) {
    logger.error("Activate service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to activate service",
    });
  }
};

// ==========================================================
// DEACTIVATE SERVICE (Admin)
// ==========================================================

/**
 * @desc    Deactivate a service for a user
 * @route   POST /api/service-status/:id/deactivate
 * @access  Private/Admin
 */
export const deactivateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const serviceStatus = await ServiceStatus.findById(id);

    if (!serviceStatus) {
      return notFoundResponse(res, { message: "Service status not found" });
    }

    serviceStatus.status = "cancelled";
    serviceStatus.isActive = false;
    serviceStatus.notes = reason || "Service deactivated by admin";

    await serviceStatus.save();

    return successResponse(res, {
      message: "Service deactivated successfully",
      data: serviceStatus,
    });
  } catch (error) {
    logger.error("Deactivate service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to deactivate service",
    });
  }
};

// ==========================================================
// GET SERVICE STATUS STATISTICS (Admin)
// ==========================================================

/**
 * @desc    Get service status statistics
 * @route   GET /api/service-status/stats
 * @access  Private/Admin
 */
export const getServiceStatusStats = async (req, res) => {
  try {
    const [
      totalActive,
      totalPending,
      totalProcessing,
      totalCompleted,
      totalCancelled,
      totalExpired,
      recentActivations,
    ] = await Promise.all([
      ServiceStatus.countDocuments({ status: "active", isActive: true }),
      ServiceStatus.countDocuments({ status: "pending" }),
      ServiceStatus.countDocuments({ status: "processing" }),
      ServiceStatus.countDocuments({ status: "completed" }),
      ServiceStatus.countDocuments({ status: "cancelled" }),
      ServiceStatus.countDocuments({ status: "expired" }),
      ServiceStatus.find({ status: "active", isActive: true })
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate("serviceId", "name slug")
        .populate("subscribedBy", "fullName email")
        .lean(),
    ]);

    const total = totalActive + totalPending + totalProcessing + totalCompleted + totalCancelled + totalExpired;

    return successResponse(res, {
      message: "Service status statistics fetched successfully",
      data: {
        total,
        active: totalActive,
        pending: totalPending,
        processing: totalProcessing,
        completed: totalCompleted,
        cancelled: totalCancelled,
        expired: totalExpired,
        recentActivations,
        activationRate: total > 0 ? ((totalActive / total) * 100).toFixed(1) : 0,
      },
    });
  } catch (error) {
    logger.error("Get service status stats error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch service status statistics",
    });
  }
};

// ==========================================================
// CHECK USER HAS ACTIVE SERVICE
// ==========================================================

/**
 * @desc    Check if a user has an active service
 * @route   GET /api/service-status/check/:serviceId
 * @access  Private
 */
export const checkUserHasActiveService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const serviceStatus = await ServiceStatus.findOne({
      serviceId,
      subscribedBy: req.user._id,
      status: "active",
      isActive: true,
    });

    // Check if expired
    let isExpired = false;
    if (serviceStatus && serviceStatus.expiresAt) {
      isExpired = new Date() > new Date(serviceStatus.expiresAt);
      if (isExpired) {
        serviceStatus.status = "expired";
        serviceStatus.isActive = false;
        await serviceStatus.save();
      }
    }

    const hasActive = serviceStatus && !isExpired;

    return successResponse(res, {
      message: "Service status checked successfully",
      data: {
        hasActive,
        status: serviceStatus ? serviceStatus.status : null,
        expiresAt: serviceStatus ? serviceStatus.expiresAt : null,
        isExpired,
        serviceStatus: serviceStatus || null,
      },
    });
  } catch (error) {
    logger.error("Check user has active service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to check service status",
    });
  }
};

// ==========================================================
// EXPORT ALL
// ==========================================================

export default {
  getAllServiceStatuses,
  getServiceStatusById,
  getMyServiceStatuses,
  getServiceStatusByServiceAndUser,
  createServiceStatus,
  updateServiceStatus,
  deleteServiceStatus,
  activateService,
  deactivateService,
  getServiceStatusStats,
  checkUserHasActiveService,
};