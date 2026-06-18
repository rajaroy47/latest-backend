// controllers/orderController.js

import Order from "../models/order.model.js";
import ServicePlan from "../models/servicePlan.model.js";
import Service from "../models/service.model.js";
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
// GET ALL ORDERS (Admin Only)
// ==========================================================

/**
 * @desc    Get all orders with pagination and filters
 * @route   GET /api/orders
 * @access  Private/Admin
 */
export const getAllOrders = async (req, res) => {
  try {
    const {
      orderStatus,
      service,
      user,
      startDate,
      endDate,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build query
    const query = {};

    if (orderStatus) query.orderStatus = orderStatus;
    if (service) query.service = service;
    if (user) query.user = user;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Search by invoice number or razorpay order ID
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { razorpayOrderId: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const paginationOptions = getPaginationOptions(req.query);
    const { skip, limit, sort } = paginationOptions;

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("user", "fullName email phone")
        .populate("service", "name slug category serviceImage")
        .lean(),
      Order.countDocuments(query),
    ]);

    return getPaginatedResponse(res, orders, total, paginationOptions);
  } catch (error) {
    logger.error("Get all orders error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch orders",
    });
  }
};

// ==========================================================
// GET ORDER BY ID
// ==========================================================

/**
 * @desc    Get order by ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate("user", "fullName email phone")
      .populate("service", "name slug category serviceImage");

    if (!order) {
      return notFoundResponse(res, { message: "Order not found" });
    }

    // Check if user is authorized (owner or admin)
    if (order.user._id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return forbiddenResponse(res, { message: "You are not authorized to view this order" });
    }

    return successResponse(res, {
      message: "Order fetched successfully",
      data: order,
    });
  } catch (error) {
    logger.error("Get order by ID error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch order",
    });
  }
};

// ==========================================================
// GET MY ORDERS (Current User)
// ==========================================================

/**
 * @desc    Get current user's orders
 * @route   GET /api/orders/my-orders
 * @access  Private
 */
export const getMyOrders = async (req, res) => {
  try {
    const { orderStatus, limit = 10 } = req.query;

    const query = { user: req.user._id };
    if (orderStatus) query.orderStatus = orderStatus;

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("service", "name slug category serviceImage");

    return successResponse(res, {
      message: "Orders fetched successfully",
      data: orders,
    });
  } catch (error) {
    logger.error("Get my orders error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch orders",
    });
  }
};

// ==========================================================
// CREATE ORDER
// ==========================================================

/**
 * @desc    Create a new order
 * @route   POST /api/orders
 * @access  Private
 */
export const createOrder = async (req, res) => {
  try {
    const { serviceId, plan, amount, planFeatures, customerDetails } = req.body;

    // Validate required fields
    if (!serviceId || !plan || !amount) {
      return badRequestResponse(res, {
        message: "Service ID, plan, and amount are required",
      });
    }

    // Check if service exists
    const service = await Service.findById(serviceId);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    // Check if service is active
    if (service.flags?.isActive === false) {
      return badRequestResponse(res, { message: "Service is currently inactive" });
    }

    // Generate unique Razorpay order ID (you can integrate actual Razorpay here)
    const razorpayOrderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // Create order
    const order = await Order.create({
      user: req.user._id,
      service: serviceId,
      plan,
      amount,
      planFeatures: planFeatures || [],
      razorpayOrderId,
      customerDetails: customerDetails || {
        name: req.user.fullName,
        email: req.user.email,
        phone: req.user.phone || "",
      },
    });

    await order.populate("service", "name slug category");
    await order.populate("user", "fullName email");

    return successResponse(res, {
      message: "Order created successfully",
      data: {
        order,
        razorpayOrderId: order.razorpayOrderId,
        amount: order.amount,
      },
    });
  } catch (error) {
    logger.error("Create order error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to create order",
    });
  }
};

// ==========================================================
// UPDATE ORDER STATUS (Admin Only)
// ==========================================================

/**
 * @desc    Update order status
 * @route   PUT /api/orders/:id/status
 * @access  Private/Admin
 */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { orderStatus, notes } = req.body;

    if (!orderStatus) {
      return badRequestResponse(res, { message: "Order status is required" });
    }

    const order = await Order.findById(id);

    if (!order) {
      return notFoundResponse(res, { message: "Order not found" });
    }

    // Update status
    order.orderStatus = orderStatus;
    if (notes) order.notes = notes;

    // Update timestamps based on status
    if (orderStatus === "completed") {
      order.completedAt = new Date();
    } else if (orderStatus === "cancelled") {
      order.cancelledAt = new Date();
    }

    await order.save();

    await order.populate("user", "fullName email");
    await order.populate("service", "name slug");

    return successResponse(res, {
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    logger.error("Update order status error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to update order status",
    });
  }
};

// ==========================================================
// CANCEL ORDER
// ==========================================================

/**
 * @desc    Cancel order (User can cancel if pending/processing)
 * @route   PUT /api/orders/:id/cancel
 * @access  Private
 */
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(id);

    if (!order) {
      return notFoundResponse(res, { message: "Order not found" });
    }

    // Check if user owns the order
    if (order.user.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return forbiddenResponse(res, { message: "You are not authorized to cancel this order" });
    }

    // Check if order can be cancelled
    if (!order.canBeCancelled) {
      return badRequestResponse(res, {
        message: `Order cannot be cancelled. Current status: ${order.orderStatus}`,
      });
    }

    await order.markAsCancelled(reason || "Cancelled by user");

    return successResponse(res, {
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    logger.error("Cancel order error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to cancel order",
    });
  }
};

// ==========================================================
// VERIFY PAYMENT
// ==========================================================

/**
 * @desc    Verify payment and complete order
 * @route   POST /api/orders/:id/verify-payment
 * @access  Private
 */
export const verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { razorpayPaymentId, signature, paymentId } = req.body;

    if (!razorpayPaymentId || !signature) {
      return badRequestResponse(res, {
        message: "Razorpay payment ID and signature are required",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return notFoundResponse(res, { message: "Order not found" });
    }

    // Check if order is already completed
    if (order.orderStatus === "completed") {
      return badRequestResponse(res, { message: "Order is already completed" });
    }

    // Update payment details
    order.razorpayPaymentId = razorpayPaymentId;
    order.signature = signature;
    if (paymentId) order.paymentId = paymentId;

    // Mark as completed
    await order.markAsCompleted();

    await order.populate("user", "fullName email");
    await order.populate("service", "name slug");

    return successResponse(res, {
      message: "Payment verified and order completed successfully",
      data: order,
    });
  } catch (error) {
    logger.error("Verify payment error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to verify payment",
    });
  }
};

// ==========================================================
// GET ORDER STATISTICS (Admin Only)
// ==========================================================

/**
 * @desc    Get order statistics
 * @route   GET /api/orders/stats
 * @access  Private/Admin
 */
export const getOrderStats = async (req, res) => {
  try {
    const stats = await Order.getOrderStats();

    return successResponse(res, {
      message: "Order statistics fetched successfully",
      data: stats,
    });
  } catch (error) {
    logger.error("Get order stats error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch order statistics",
    });
  }
};

// ==========================================================
// GET ORDERS BY SERVICE (Admin Only)
// ==========================================================

/**
 * @desc    Get orders by service
 * @route   GET /api/orders/service/:serviceId
 * @access  Private/Admin
 */
export const getOrdersByService = async (req, res) => {
  try {
    const { serviceId } = req.params;

    const orders = await Order.getOrdersByService(serviceId);

    return successResponse(res, {
      message: "Orders fetched successfully",
      data: orders,
    });
  } catch (error) {
    logger.error("Get orders by service error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch orders",
    });
  }
};

// ==========================================================
// GET ORDERS BY USER (Admin Only)
// ==========================================================

/**
 * @desc    Get orders by user
 * @route   GET /api/orders/user/:userId
 * @access  Private/Admin
 */
export const getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const orders = await Order.getOrdersByUser(userId);

    return successResponse(res, {
      message: "Orders fetched successfully",
      data: orders,
    });
  } catch (error) {
    logger.error("Get orders by user error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch orders",
    });
  }
};

// ==========================================================
// EXPORT ALL
// ==========================================================

export default {
  getAllOrders,
  getOrderById,
  getMyOrders,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  verifyPayment,
  getOrderStats,
  getOrdersByService,
  getOrdersByUser,
};