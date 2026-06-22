// controllers/admin.controller.js

import User from "../models/user.model.js";
import Service from "../models/service.model.js";
import Order from "../models/order.model.js";
import Payment from "../models/payment.model.js";
import {
  successResponse,
  errorResponse,
  logger,
} from "../utils/index.js";

// ==========================================================
// GET DASHBOARD STATS - FULLY FIXED
// ==========================================================

export const getDashboardStats = async (req, res) => {
  try {
    // ==========================================================
    // USERS
    // ==========================================================
    const totalUsers = await User.countDocuments({ isDeleted: false });
    const activeUsers = await User.countDocuments({ isActive: true, isDeleted: false });
    const inactiveUsers = await User.countDocuments({ isActive: false, isDeleted: false });

    const recentUsers = await User.find({ isDeleted: false })
      .select("fullName email role avatar isVerified createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // ==========================================================
    // SERVICES
    // ==========================================================
    const totalServices = await Service.countDocuments();
    const activeServices = await Service.countDocuments({ "flags.isActive": true });
    const inactiveServices = await Service.countDocuments({ "flags.isActive": false });

    const recentServices = await Service.find()
      .select("name category shortDescription flags createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // ==========================================================
    // ORDERS - FIXED WITH REAL DATA
    // ==========================================================
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ orderStatus: "pending" });
    const processingOrders = await Order.countDocuments({ orderStatus: "processing" });
    const completedOrders = await Order.countDocuments({ orderStatus: "completed" });
    const cancelledOrders = await Order.countDocuments({ orderStatus: "cancelled" });

    // Get revenue from completed orders
    const revenueResult = await Order.aggregate([
      { $match: { orderStatus: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    // Get today's orders count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: today }
    });

    // Get recent orders for activity
    const recentOrders = await Order.find()
      .populate("user", "fullName email")
      .populate("service", "name slug")
      .select("user service amount plan orderStatus createdAt invoiceNumber")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // ==========================================================
    // PAYMENTS - FIXED WITH REAL DATA
    // ==========================================================
    const totalPayments = await Payment.countDocuments();
    const completedPayments = await Payment.countDocuments({ paymentStatus: "completed" });
    const pendingPayments = await Payment.countDocuments({ paymentStatus: "pending" });
    const failedPayments = await Payment.countDocuments({ paymentStatus: "failed" });
    const refundedPayments = await Payment.countDocuments({ 
      paymentStatus: { $in: ["refunded", "partially_refunded"] } 
    });

    // Get total payment amount from completed payments
    const paymentAmountResult = await Payment.aggregate([
      { $match: { paymentStatus: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalPaymentAmount = paymentAmountResult.length > 0 ? paymentAmountResult[0].total : 0;

    // ==========================================================
    // CONTENT
    // ==========================================================
    const totalSectionsResult = await Service.aggregate([
      { $unwind: { path: "$sections", preserveNullAndEmptyArrays: true } },
      { $count: "total" }
    ]);
    
    const totalSidebarCardsResult = await Service.aggregate([
      { $unwind: { path: "$sidebarCards", preserveNullAndEmptyArrays: true } },
      { $count: "total" }
    ]);

    // ==========================================================
    // RESPONSE
    // ==========================================================
    return successResponse(res, {
      message: "Dashboard stats fetched successfully",
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: inactiveUsers,
          recent: recentUsers
        },
        services: {
          total: totalServices,
          active: activeServices,
          inactive: inactiveServices,
          recent: recentServices
        },
        orders: {
          total: totalOrders,
          pending: pendingOrders,
          processing: processingOrders,
          completed: completedOrders,
          cancelled: cancelledOrders,
          revenue: totalRevenue,
          today: todayOrders,
          recent: recentOrders
        },
        payments: {
          total: totalPayments,
          completed: completedPayments,
          pending: pendingPayments,
          failed: failedPayments,
          refunded: refundedPayments,
          amount: totalPaymentAmount
        },
        content: {
          totalSections: totalSectionsResult.length > 0 ? totalSectionsResult[0].total : 0,
          totalSidebarCards: totalSidebarCardsResult.length > 0 ? totalSidebarCardsResult[0].total : 0
        }
      }
    });

  } catch (error) {
    logger.error("Get dashboard stats error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch dashboard stats"
    });
  }
};

// ==========================================================
// GET SYSTEM OVERVIEW
// ==========================================================

export const getSystemOverview = async (req, res) => {
  try {
    // User overview
    const totalUsers = await User.countDocuments({ isDeleted: false });
    const verifiedUsers = await User.countDocuments({ isVerified: true, isDeleted: false });
    const unverifiedUsers = totalUsers - verifiedUsers;

    // Service overview
    const totalServices = await Service.countDocuments();
    const popularServices = await Service.countDocuments({ "flags.isPopular": true });
    const featuredServices = await Service.countDocuments({ "flags.isFeatured": true });

    return successResponse(res, {
      message: "System overview fetched successfully",
      data: {
        users: {
          total: totalUsers,
          verified: verifiedUsers,
          unverified: unverifiedUsers
        },
        services: {
          total: totalServices,
          popular: popularServices,
          featured: featuredServices
        }
      }
    });

  } catch (error) {
    logger.error("Get system overview error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch system overview"
    });
  }
};

// ==========================================================
// GET RECENT ACTIVITY
// ==========================================================

export const getRecentActivity = async (req, res) => {
  try {
    const activities = [];

    // Get recent user registrations
    const recentUsers = await User.find({ isDeleted: false })
      .select("fullName email createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentUsers.forEach(user => {
      activities.push({
        type: "user",
        action: "registered",
        user: user.fullName,
        email: user.email,
        timestamp: user.createdAt,
        details: `New user registered: ${user.fullName}`
      });
    });

    // Get recent service creations
    const recentServices = await Service.find()
      .select("name category createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentServices.forEach(service => {
      activities.push({
        type: "service",
        action: "created",
        name: service.name,
        category: service.category,
        timestamp: service.createdAt,
        details: `New service created: ${service.name}`
      });
    });

    // Get recent orders
    const recentOrders = await Order.find()
      .populate("user", "fullName")
      .populate("service", "name")
      .select("user service amount orderStatus createdAt invoiceNumber")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentOrders.forEach(order => {
      const userName = order.user?.fullName || "Unknown User";
      const serviceName = order.service?.name || "Unknown Service";
      activities.push({
        type: "order",
        action: order.orderStatus || "created",
        user: userName,
        service: serviceName,
        amount: order.amount,
        invoice: order.invoiceNumber,
        timestamp: order.createdAt,
        details: `Order ${order.orderStatus || 'created'}: ${serviceName} by ${userName} (${order.invoiceNumber || 'N/A'})`
      });
    });

    // Get recent payments
    const recentPayments = await Payment.find()
      .populate("user", "fullName")
      .populate("service", "name")
      .select("user service amount paymentStatus createdAt")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    recentPayments.forEach(payment => {
      const userName = payment.user?.fullName || "Unknown User";
      const serviceName = payment.service?.name || "Unknown Service";
      activities.push({
        type: "payment",
        action: payment.paymentStatus || "completed",
        user: userName,
        service: serviceName,
        amount: payment.amount,
        timestamp: payment.createdAt,
        details: `Payment ${payment.paymentStatus || 'completed'}: ₹${payment.amount} by ${userName}`
      });
    });

    // Sort all activities by timestamp (newest first)
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Return only latest 20
    return successResponse(res, {
      message: "Recent activity fetched successfully",
      data: activities.slice(0, 20)
    });

  } catch (error) {
    logger.error("Get recent activity error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch recent activity"
    });
  }
};