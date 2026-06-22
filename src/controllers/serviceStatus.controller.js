// controllers/serviceStatusController.js

import mongoose from "mongoose";
import ServiceStatus from "../models/serviceStatus.model.js";
import Service from "../models/service.model.js";
import Order from "../models/order.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
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
// ✅ DEBUG HELPER: Enhanced Logging
// ==========================================================

const debugLog = (module, message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`\n🔔 [${timestamp}] [${module}] ${message}`);
  if (Object.keys(data).length > 0) {
    console.log('📦 Data:', JSON.stringify(data, null, 2));
  }
  console.log('─'.repeat(80));
};

// ==========================================================
// ✅ FIXED: Create Service Status Notification with Debug
// ==========================================================

const createServiceStatusNotification = async (userId, serviceStatus, service, action = 'updated') => {
  const MODULE = 'createServiceStatusNotification';
  
  debugLog(MODULE, '🚀 STARTING NOTIFICATION CREATION', {
    userId,
    action,
    status: serviceStatus?.status,
    serviceName: service?.name,
    hasServiceStatus: !!serviceStatus,
    hasService: !!service,
  });

  try {
    // ✅ Validate inputs
    if (!userId) {
      debugLog(MODULE, '❌ ERROR: userId is missing');
      return null;
    }

    if (!serviceStatus) {
      debugLog(MODULE, '❌ ERROR: serviceStatus is missing');
      return null;
    }

    // ✅ Check if Notification model is available
    if (!Notification) {
      debugLog(MODULE, '❌ ERROR: Notification model is not imported');
      return null;
    }

    // ✅ Status mapping
    const statusMap = {
      'pending': {
        type: 'service_pending',
        title: '⏳ Service Pending',
        message: `Your ${service?.name || 'service'} is pending review. We'll notify you once it's processed.`,
        priority: 'medium',
      },
      'processing': {
        type: 'service_processing',
        title: '🔄 Service Processing',
        message: `Your ${service?.name || 'service'} is being processed. Our team is working on it.`,
        priority: 'medium',
      },
      'active': {
        type: 'service_active',
        title: '✅ Service Activated',
        message: `🎉 Your ${service?.name || 'service'} has been activated successfully! You can now access all features.`,
        priority: 'high',
      },
      'completed': {
        type: 'service_completed',
        title: '🎉 Service Completed',
        message: `✅ Your ${service?.name || 'service'} has been completed successfully. Thank you for choosing us!`,
        priority: 'high',
      },
      'cancelled': {
        type: 'service_cancelled',
        title: '❌ Service Cancelled',
        message: `Your ${service?.name || 'service'} has been cancelled. If this was a mistake, please contact support.`,
        priority: 'urgent',
      },
      'expired': {
        type: 'service_expired',
        title: '⏰ Service Expired',
        message: `Your ${service?.name || 'service'} has expired. Please renew to continue using the service.`,
        priority: 'high',
      },
      'paused': {
        type: 'service_paused',
        title: '⏸️ Service Paused',
        message: `Your ${service?.name || 'service'} has been paused. Please contact support for more details.`,
        priority: 'medium',
      },
    };

    const config = statusMap[serviceStatus?.status] || statusMap['processing'];
    debugLog(MODULE, '📝 Status config resolved', { config });

    // ✅ Action labels
    const actionLabels = {
      'pending': 'View Status',
      'processing': 'Track Progress',
      'active': 'Access Service',
      'completed': 'View Details',
      'cancelled': 'Contact Support',
      'expired': 'Renew Now',
      'paused': 'Contact Support',
    };

    // ✅ Prepare notification data
    const notificationData = {
      user: userId,
      type: config.type,
      title: config.title,
      message: config.message,
      priority: config.priority,
      actionUrl: '/dashboard',
      actionLabel: actionLabels[serviceStatus?.status] || 'View Status',
      metadata: {
        serviceId: serviceStatus?.serviceId || null,
        serviceStatusId: serviceStatus?._id || null,
        serviceName: service?.name || null,
        status: serviceStatus?.status || null,
        plan: serviceStatus?.plan || null,
        previousStatus: serviceStatus?.previousStatus || null,
        expiresAt: serviceStatus?.expiresAt || null,
        action: action,
      },
      createdBy: "system",
    };

    debugLog(MODULE, '📝 Notification data prepared', notificationData);

    // ✅ Create notification with try-catch
    try {
      const notification = await Notification.create(notificationData);
      
      debugLog(MODULE, '✅✅✅ NOTIFICATION CREATED SUCCESSFULLY!', {
        notificationId: notification._id,
        userId: notification.user,
        type: notification.type,
        title: notification.title,
        createdAt: notification.createdAt,
      });

      // ✅ Verify the notification exists in DB
      const verifyNotification = await Notification.findById(notification._id);
      debugLog(MODULE, '🔍 Verification: Notification exists in DB', {
        exists: !!verifyNotification,
        id: verifyNotification?._id,
      });

      return notification;

    } catch (dbError) {
      debugLog(MODULE, '❌❌❌ DATABASE ERROR CREATING NOTIFICATION', {
        error: dbError.message,
        stack: dbError.stack,
        code: dbError.code,
        name: dbError.name,
      });
      
      // ✅ Check if it's a validation error
      if (dbError.name === 'ValidationError') {
        const errors = Object.keys(dbError.errors).map(key => ({
          field: key,
          message: dbError.errors[key].message,
        }));
        debugLog(MODULE, '📋 Validation errors', { errors });
      }
      
      return null;
    }

  } catch (error) {
    debugLog(MODULE, '❌❌❌ FATAL ERROR', {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    return null;
  }
};

// ==========================================================
// ✅ FIXED: UPDATE SERVICE STATUS WITH FULL DEBUG
// ==========================================================

export const updateServiceStatus = async (req, res) => {
  const MODULE = 'updateServiceStatus';
  debugLog(MODULE, '🚀 STARTING UPDATE SERVICE STATUS', {
    params: req.params,
    body: req.body,
    user: req.user?._id,
  });

  try {
    const { id } = req.params;
    const { status, plan, expiresAt, isActive, notes } = req.body;

    if (!id) {
      debugLog(MODULE, '❌ ERROR: Missing service status ID');
      return badRequestResponse(res, { message: "Service status ID is required" });
    }

    // ✅ Find service status
    debugLog(MODULE, '🔍 Looking for service status', { id });
    const serviceStatus = await ServiceStatus.findById(id)
      .populate("serviceId", "name slug category")
      .populate("subscribedBy", "fullName email");

    if (!serviceStatus) {
      debugLog(MODULE, '❌ ERROR: Service status not found', { id });
      return notFoundResponse(res, { message: "Service status not found" });
    }

    debugLog(MODULE, '✅ Found service status', {
      id: serviceStatus._id,
      currentStatus: serviceStatus.status,
      userId: serviceStatus.subscribedBy?._id || serviceStatus.subscribedBy,
      serviceName: serviceStatus.serviceId?.name,
      plan: serviceStatus.plan,
    });

    // ✅ Validate status
    const validStatuses = ["pending", "processing", "active", "completed", "cancelled", "expired", "paused"];
    if (status && !validStatuses.includes(status)) {
      debugLog(MODULE, '❌ ERROR: Invalid status', { status, validStatuses });
      return badRequestResponse(res, {
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // ✅ Store previous status
    const previousStatus = serviceStatus.status;
    debugLog(MODULE, '📝 Status change detected', {
      from: previousStatus,
      to: status || 'no change',
      statusChanged: status && status !== previousStatus,
    });

    // ✅ Update fields
    if (status) serviceStatus.status = status;
    if (plan) serviceStatus.plan = plan;
    if (expiresAt !== undefined) serviceStatus.expiresAt = expiresAt;
    if (isActive !== undefined) serviceStatus.isActive = isActive;
    if (notes !== undefined) serviceStatus.notes = notes;

    if (status === "active") {
      serviceStatus.isActive = true;
      debugLog(MODULE, '✅ Status is active, setting isActive = true');
    }

    if (status === "cancelled" || status === "expired") {
      serviceStatus.isActive = false;
      debugLog(MODULE, '✅ Status is cancelled/expired, setting isActive = false');
    }

    // ✅ Save the updated status
    debugLog(MODULE, '💾 Saving service status...');
    await serviceStatus.save();
    debugLog(MODULE, '✅ Service status saved successfully');

    // ✅ ==========================================================
    // ✅ SEND NOTIFICATION IF STATUS CHANGED
    // ✅ ==========================================================
    
    if (status && status !== previousStatus) {
      debugLog(MODULE, '🔔🔔🔔 STATUS CHANGED - CREATING NOTIFICATION', {
        previousStatus,
        newStatus: status,
        userId: serviceStatus.subscribedBy?._id || serviceStatus.subscribedBy,
      });

      // ✅ Get service details
      const service = await Service.findById(serviceStatus.serviceId);
      debugLog(MODULE, '📝 Service details for notification', {
        serviceId: service?._id,
        serviceName: service?.name,
      });

      // ✅ Get user ID
      const userId = serviceStatus.subscribedBy?._id || serviceStatus.subscribedBy;
      debugLog(MODULE, '📝 User ID for notification', { userId });

      if (userId) {
        debugLog(MODULE, '🔔 Calling createServiceStatusNotification...');
        
        // ✅ Create notification
        const notification = await createServiceStatusNotification(
          userId,
          { ...serviceStatus.toObject(), previousStatus },
          service,
          'updated'
        );

        if (notification) {
          debugLog(MODULE, '✅✅✅ NOTIFICATION CREATED SUCCESSFULLY!', {
            notificationId: notification._id,
            userId: notification.user,
            type: notification.type,
          });
        } else {
          debugLog(MODULE, '❌❌❌ NOTIFICATION CREATION FAILED!');
        }

        // ✅ Also send activation notification if status is active
        if (status === 'active') {
          debugLog(MODULE, '🔔🔔🔔 SERVICE ACTIVATED - SENDING EXTRA NOTIFICATION');
          await createServiceStatusNotification(
            userId,
            { ...serviceStatus.toObject(), previousStatus },
            service,
            'activated'
          );
        }
      } else {
        debugLog(MODULE, '❌ ERROR: No user ID found for notification');
      }
    } else {
      debugLog(MODULE, '📝 No status change, skipping notification');
    }

    // ✅ Populate and return
    await serviceStatus.populate("serviceId", "name slug category");
    await serviceStatus.populate("subscribedBy", "fullName email");

    debugLog(MODULE, '✅ UPDATE COMPLETE - SENDING RESPONSE');

    return successResponse(res, {
      message: "Service status updated successfully",
      data: serviceStatus,
    });

  } catch (error) {
    debugLog(MODULE, '❌❌❌ UNHANDLED ERROR', {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    logger.error("Update service status error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to update service status",
    });
  }
};

// ==========================================================
// ✅ FIXED: ACTIVATE SERVICE WITH DEBUG
// ==========================================================

export const activateService = async (req, res) => {
  const MODULE = 'activateService';
  debugLog(MODULE, '🚀 STARTING ACTIVATE SERVICE', {
    params: req.params,
    body: req.body,
  });

  try {
    const { id } = req.params;
    const { duration = 1, durationUnit = "years" } = req.body || {};

    debugLog(MODULE, '📝 Activating service', { id, duration, durationUnit });

    const serviceStatus = await ServiceStatus.findById(id)
      .populate("serviceId", "name slug category")
      .populate("subscribedBy", "fullName email");

    if (!serviceStatus) {
      debugLog(MODULE, '❌ ERROR: Service status not found', { id });
      return notFoundResponse(res, { message: "Service status not found" });
    }

    if (serviceStatus.status === "active") {
      debugLog(MODULE, '⚠️ Service already active', { id });
      return badRequestResponse(res, {
        message: "Service is already active",
      });
    }

    const previousStatus = serviceStatus.status;
    serviceStatus.status = "active";
    serviceStatus.isActive = true;

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
        serviceStatus.expiresAt = new Date(now.setFullYear(now.getFullYear() + 1));
    }

    const activationNote = `Service activated on ${new Date().toLocaleDateString()} (${duration} ${durationUnit})`;
    serviceStatus.notes = serviceStatus.notes 
      ? `${serviceStatus.notes}\n${activationNote}` 
      : activationNote;

    await serviceStatus.save();
    debugLog(MODULE, '✅ Service activated successfully');

    // ✅ Send activation notification
    const service = await Service.findById(serviceStatus.serviceId);
    const userId = serviceStatus.subscribedBy?._id || serviceStatus.subscribedBy;
    
    debugLog(MODULE, '🔔 Sending activation notification', { userId });
    
    if (userId) {
      await createServiceStatusNotification(
        userId,
        { ...serviceStatus.toObject(), previousStatus },
        service,
        'activated'
      );
    }

    await serviceStatus.populate("serviceId", "name slug category");
    await serviceStatus.populate("subscribedBy", "fullName email");

    return successResponse(res, {
      message: "Service activated successfully",
      data: serviceStatus,
    });

  } catch (error) {
    debugLog(MODULE, '❌❌❌ ERROR', {
      error: error.message,
      stack: error.stack,
    });
    logger.error("Activate service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to activate service",
    });
  }
};

// ==========================================================
// ✅ FIXED: COMPLETE SERVICE WITH DEBUG
// ==========================================================

export const completeService = async (req, res) => {
  const MODULE = 'completeService';
  debugLog(MODULE, '🚀 STARTING COMPLETE SERVICE', { params: req.params });

  try {
    const { id } = req.params;
    const { notes } = req.body || {};

    const serviceStatus = await ServiceStatus.findById(id)
      .populate("serviceId", "name slug category")
      .populate("subscribedBy", "fullName email");

    if (!serviceStatus) {
      debugLog(MODULE, '❌ ERROR: Service status not found', { id });
      return notFoundResponse(res, { message: "Service status not found" });
    }

    if (serviceStatus.status === "completed") {
      return badRequestResponse(res, {
        message: "Service is already completed",
      });
    }

    const previousStatus = serviceStatus.status;
    serviceStatus.status = "completed";
    serviceStatus.isActive = false;

    const completionNote = `Service completed on ${new Date().toLocaleDateString()}`;
    serviceStatus.notes = serviceStatus.notes 
      ? `${serviceStatus.notes}\n${completionNote}` 
      : completionNote;

    if (notes) {
      serviceStatus.notes = `${serviceStatus.notes}\n${notes}`;
    }

    await serviceStatus.save();
    debugLog(MODULE, '✅ Service completed successfully');

    // ✅ Send completion notification
    const service = await Service.findById(serviceStatus.serviceId);
    const userId = serviceStatus.subscribedBy?._id || serviceStatus.subscribedBy;
    
    if (userId) {
      await createServiceStatusNotification(
        userId,
        { ...serviceStatus.toObject(), previousStatus },
        service,
        'completed'
      );
    }

    await serviceStatus.populate("serviceId", "name slug category");
    await serviceStatus.populate("subscribedBy", "fullName email");

    return successResponse(res, {
      message: "Service marked as completed successfully",
      data: serviceStatus,
    });

  } catch (error) {
    debugLog(MODULE, '❌❌❌ ERROR', {
      error: error.message,
      stack: error.stack,
    });
    logger.error("Complete service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to mark service as completed",
    });
  }
};

// ==========================================================
// ✅ FIXED: CANCEL SERVICE WITH DEBUG
// ==========================================================

export const cancelService = async (req, res) => {
  const MODULE = 'cancelService';
  debugLog(MODULE, '🚀 STARTING CANCEL SERVICE', { params: req.params });

  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const serviceStatus = await ServiceStatus.findById(id)
      .populate("serviceId", "name slug category")
      .populate("subscribedBy", "fullName email");

    if (!serviceStatus) {
      debugLog(MODULE, '❌ ERROR: Service status not found', { id });
      return notFoundResponse(res, { message: "Service status not found" });
    }

    if (serviceStatus.status === "cancelled") {
      return badRequestResponse(res, {
        message: "Service is already cancelled",
      });
    }

    const previousStatus = serviceStatus.status;
    serviceStatus.status = "cancelled";
    serviceStatus.isActive = false;

    const cancelNote = `Service cancelled on ${new Date().toLocaleDateString()}`;
    serviceStatus.notes = serviceStatus.notes 
      ? `${serviceStatus.notes}\n${cancelNote}` 
      : cancelNote;

    if (reason) {
      serviceStatus.notes = `${serviceStatus.notes}\nReason: ${reason}`;
    }

    await serviceStatus.save();
    debugLog(MODULE, '✅ Service cancelled successfully');

    // ✅ Send cancellation notification
    const service = await Service.findById(serviceStatus.serviceId);
    const userId = serviceStatus.subscribedBy?._id || serviceStatus.subscribedBy;
    
    if (userId) {
      await createServiceStatusNotification(
        userId,
        { ...serviceStatus.toObject(), previousStatus },
        service,
        'cancelled'
      );
    }

    await serviceStatus.populate("serviceId", "name slug category");
    await serviceStatus.populate("subscribedBy", "fullName email");

    return successResponse(res, {
      message: "Service cancelled successfully",
      data: serviceStatus,
    });

  } catch (error) {
    debugLog(MODULE, '❌❌❌ ERROR', {
      error: error.message,
      stack: error.stack,
    });
    logger.error("Cancel service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to cancel service",
    });
  }
};

// ==========================================================
// ✅ FIXED: DEACTIVATE SERVICE WITH DEBUG
// ==========================================================

export const deactivateService = async (req, res) => {
  const MODULE = 'deactivateService';
  debugLog(MODULE, '🚀 STARTING DEACTIVATE SERVICE', { params: req.params });

  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    const serviceStatus = await ServiceStatus.findById(id)
      .populate("serviceId", "name slug category")
      .populate("subscribedBy", "fullName email");

    if (!serviceStatus) {
      debugLog(MODULE, '❌ ERROR: Service status not found', { id });
      return notFoundResponse(res, { message: "Service status not found" });
    }

    const previousStatus = serviceStatus.status;
    serviceStatus.status = "paused";
    serviceStatus.isActive = false;
    serviceStatus.notes = reason || "Service deactivated by admin";

    await serviceStatus.save();
    debugLog(MODULE, '✅ Service deactivated successfully');

    // ✅ Send deactivation notification
    const service = await Service.findById(serviceStatus.serviceId);
    const userId = serviceStatus.subscribedBy?._id || serviceStatus.subscribedBy;
    
    if (userId) {
      await createServiceStatusNotification(
        userId,
        { ...serviceStatus.toObject(), previousStatus },
        service,
        'deactivated'
      );
    }

    await serviceStatus.populate("serviceId", "name slug category");
    await serviceStatus.populate("subscribedBy", "fullName email");

    return successResponse(res, {
      message: "Service deactivated successfully",
      data: serviceStatus,
    });

  } catch (error) {
    debugLog(MODULE, '❌❌❌ ERROR', {
      error: error.message,
      stack: error.stack,
    });
    logger.error("Deactivate service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to deactivate service",
    });
  }
};

// ==========================================================
// ✅ TEST ENDPOINT: Create Test Notification
// ==========================================================

export const testNotification = async (req, res) => {
  const MODULE = 'testNotification';
  debugLog(MODULE, '🚀 TEST NOTIFICATION ENDPOINT HIT');

  try {
    const { userId } = req.params;

    if (!userId) {
      debugLog(MODULE, '❌ ERROR: Missing userId');
      return badRequestResponse(res, { message: "User ID is required" });
    }

    debugLog(MODULE, '📝 Finding user', { userId });

    const user = await User.findById(userId);
    if (!user) {
      debugLog(MODULE, '❌ ERROR: User not found', { userId });
      return notFoundResponse(res, { message: "User not found" });
    }

    debugLog(MODULE, '✅ User found', {
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
    });

    debugLog(MODULE, '🔔 Creating test notification...');

    const testNotification = await Notification.create({
      user: userId,
      type: 'system_info',
      title: '🧪 Test Notification',
      message: 'This is a test notification to verify the notification system is working correctly.',
      priority: 'high',
      actionUrl: '/dashboard',
      actionLabel: 'View Dashboard',
      metadata: {
        test: true,
        timestamp: new Date().toISOString(),
      },
      createdBy: "system",
    });

    debugLog(MODULE, '✅✅✅ TEST NOTIFICATION CREATED!', {
      notificationId: testNotification._id,
      userId: testNotification.user,
      type: testNotification.type,
    });

    return successResponse(res, {
      message: "Test notification created successfully",
      data: testNotification,
    });

  } catch (error) {
    debugLog(MODULE, '❌❌❌ ERROR', {
      error: error.message,
      stack: error.stack,
      name: error.name,
    });
    return errorResponse(res, {
      message: error.message || "Failed to create test notification",
    });
  }
};

// ==========================================================
// ✅ VERIFY NOTIFICATION ENDPOINT
// ==========================================================

export const verifyNotification = async (req, res) => {
  const MODULE = 'verifyNotification';
  debugLog(MODULE, '🔍 VERIFY NOTIFICATION ENDPOINT HIT');

  try {
    const { userId } = req.params;

    if (!userId) {
      return badRequestResponse(res, { message: "User ID is required" });
    }

    debugLog(MODULE, '📝 Finding notifications for user', { userId });

    const notifications = await Notification.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10);

    debugLog(MODULE, '📊 Found notifications', {
      count: notifications.length,
      latest: notifications[0]?.title,
    });

    return successResponse(res, {
      message: `Found ${notifications.length} notifications for user`,
      data: {
        count: notifications.length,
        notifications: notifications,
      },
    });

  } catch (error) {
    debugLog(MODULE, '❌ ERROR', { error: error.message });
    return errorResponse(res, {
      message: error.message || "Failed to verify notifications",
    });
  }
};

// ==========================================================
// GET ALL SERVICE STATUSES (Admin Only)
// ==========================================================

export const getAllServiceStatuses = async (req, res) => {
  try {
    const {
      status,
      serviceId,
      subscribedBy,
      isActive,
      startDate,
      endDate,
      search,
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

    if (search) {
      const users = await User.find({
        $or: [
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      }).select("_id").lean();

      const services = await Service.find({
        name: { $regex: search, $options: "i" }
      }).select("_id").lean();

      const userIds = users.map(u => u._id);
      const serviceIds = services.map(s => s._id);

      query.$or = [];
      if (userIds.length > 0) query.$or.push({ subscribedBy: { $in: userIds } });
      if (serviceIds.length > 0) query.$or.push({ serviceId: { $in: serviceIds } });
      if (query.$or.length === 0) {
        return getPaginatedResponse(res, [], 0, getPaginationOptions(req.query));
      }
    }

    const paginationOptions = getPaginationOptions(req.query);
    const { skip, limit, sort } = paginationOptions;

    const [statuses, total] = await Promise.all([
      ServiceStatus.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("serviceId", "name slug category serviceImage")
        .populate("subscribedBy", "fullName email phone")
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

export const getServiceStatusById = async (req, res) => {
  try {
    const { id } = req.params;

    const status = await ServiceStatus.findById(id)
      .populate("serviceId", "name slug category serviceImage")
      .populate("subscribedBy", "fullName email phone");

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

export const getServiceStatusByServiceAndUser = async (req, res) => {
  try {
    const { serviceId, userId } = req.params;

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
// CREATE SERVICE STATUS (After Payment)
// ==========================================================

export const createServiceStatus = async (req, res) => {
  try {
    const { 
      serviceId, 
      subscribedBy, 
      plan = "basic", 
      expiresAt = null, 
      notes = "",
      metadata = {}
    } = req.body;

    if (!serviceId || !subscribedBy) {
      return badRequestResponse(res, {
        message: "Service ID and Subscribed By are required",
      });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    const user = await User.findById(subscribedBy);
    if (!user) {
      return notFoundResponse(res, { message: "User not found" });
    }

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
      status: "processing",
      plan: plan || "basic",
      startedAt: new Date(),
      expiresAt: expiresAt || null,
      isActive: true,
      notes: notes || "",
      metadata: metadata || {},
    });

    await serviceStatus.populate("serviceId", "name slug category");
    await serviceStatus.populate("subscribedBy", "fullName email");

    // ✅ Create notification for service creation
    await createServiceStatusNotification(
      subscribedBy,
      serviceStatus,
      service,
      'created'
    );

    return successResponse(res, {
      message: "Service status created successfully with processing status",
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
// DELETE SERVICE STATUS
// ==========================================================

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
// GET SERVICE STATUS STATISTICS
// ==========================================================

export const getServiceStatusStats = async (req, res) => {
  try {
    const [
      totalActive,
      totalPending,
      totalProcessing,
      totalCompleted,
      totalCancelled,
      totalExpired,
      totalPaused,
      recentActivations,
    ] = await Promise.all([
      ServiceStatus.countDocuments({ status: "active", isActive: true }),
      ServiceStatus.countDocuments({ status: "pending" }),
      ServiceStatus.countDocuments({ status: "processing" }),
      ServiceStatus.countDocuments({ status: "completed" }),
      ServiceStatus.countDocuments({ status: "cancelled" }),
      ServiceStatus.countDocuments({ status: "expired" }),
      ServiceStatus.countDocuments({ status: "paused" }),
      ServiceStatus.find({ status: "active", isActive: true })
        .sort({ updatedAt: -1 })
        .limit(5)
        .populate("serviceId", "name slug")
        .populate("subscribedBy", "fullName email")
        .lean(),
    ]);

    const total = totalActive + totalPending + totalProcessing + totalCompleted + totalCancelled + totalExpired + totalPaused;

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
        paused: totalPaused,
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

export const checkUserHasActiveService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const serviceStatus = await ServiceStatus.findOne({
      serviceId,
      subscribedBy: req.user._id,
    });

    let isExpired = false;
    if (serviceStatus && serviceStatus.expiresAt) {
      isExpired = new Date() > new Date(serviceStatus.expiresAt);
      if (isExpired && serviceStatus.status !== 'expired') {
        const previousStatus = serviceStatus.status;
        serviceStatus.status = "expired";
        serviceStatus.isActive = false;
        await serviceStatus.save();

        // ✅ Send expiry notification
        const service = await Service.findById(serviceId);
        await createServiceStatusNotification(
          req.user._id,
          { ...serviceStatus.toObject(), previousStatus },
          service,
          'expired'
        );
      }
    }

    const hasActive = serviceStatus && 
      serviceStatus.status === "active" && 
      !isExpired;

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
// BULK STATUS UPDATE WITH NOTIFICATIONS
// ==========================================================

export const bulkUpdateServiceStatus = async (req, res) => {
  try {
    const { serviceId, status, reason } = req.body;

    if (!serviceId || !status) {
      return badRequestResponse(res, {
        message: "Service ID and status are required",
      });
    }

    const validStatuses = ["pending", "processing", "active", "completed", "cancelled", "expired", "paused"];
    if (!validStatuses.includes(status)) {
      return badRequestResponse(res, {
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Update all statuses for this service
    const result = await ServiceStatus.updateMany(
      { serviceId },
      { 
        $set: { 
          status: status,
          isActive: status === 'active',
          updatedAt: new Date(),
          notes: reason ? `Bulk update: ${reason}` : `Bulk update to ${status}`
        }
      }
    );

    // Send notifications to all affected users
    await notifyAllUsersWithService(serviceId, status, 'bulk_updated');

    return successResponse(res, {
      message: `Bulk status update completed for ${result.modifiedCount} records`,
      data: {
        modifiedCount: result.modifiedCount,
        matchedCount: result.matchedCount,
        status: status,
      },
    });
  } catch (error) {
    logger.error("Bulk update service status error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to bulk update service status",
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
  completeService,
  cancelService,
  deactivateService,
  getServiceStatusStats,
  checkUserHasActiveService,
  bulkUpdateServiceStatus,
  testNotification,
  verifyNotification,
};