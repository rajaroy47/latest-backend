// controllers/adminController.js

import User from "../models/user.model.js";
import Service from "../models/service.model.js";
import { logger, successResponse, errorResponse } from "../utils/index.js";

// ==========================================================
// ADMIN DASHBOARD
// ==========================================================

/**
 * @desc    Get admin dashboard statistics
 * @route   GET /api/admin/dashboard/stats
 * @access  Private/Admin
 */
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalServices,
      activeServices,
      totalSectionsResult,
      totalSidebarCardsResult,
      recentUsers,
      recentServices,
    ] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      User.countDocuments({ isActive: true, isDeleted: false }),
      Service.countDocuments({ isDeleted: false }),
      Service.countDocuments({ "flags.isActive": true, isDeleted: false }),
      // Get total sections with safe aggregation
      Service.aggregate([
        { $match: { isDeleted: false } },
        { $project: { sectionsCount: { $cond: { if: { $isArray: "$sections" }, then: { $size: "$sections" }, else: 0 } } } },
        { $group: { _id: null, total: { $sum: "$sectionsCount" } } },
      ]),
      // Get total sidebar cards with safe aggregation
      Service.aggregate([
        { $match: { isDeleted: false } },
        { $project: { sidebarCount: { $cond: { if: { $isArray: "$sidebarCards" }, then: { $size: "$sidebarCards" }, else: 0 } } } },
        { $group: { _id: null, total: { $sum: "$sidebarCount" } } },
      ]),
      // Get recent users
      User.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("fullName email createdAt role isVerified avatar")
        .lean(),
      // Get recent services
      Service.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name category shortDescription flags createdAt")
        .lean(),
    ]);

    // Safely extract totals
    const totalSections = totalSectionsResult[0]?.total || 0;
    const totalSidebarCards = totalSidebarCardsResult[0]?.total || 0;

    const stats = {
      users: {
        total: totalUsers || 0,
        active: activeUsers || 0,
        inactive: (totalUsers || 0) - (activeUsers || 0),
        recent: recentUsers || [],
      },
      services: {
        total: totalServices || 0,
        active: activeServices || 0,
        inactive: (totalServices || 0) - (activeServices || 0),
        recent: recentServices || [],
      },
      content: {
        totalSections: totalSections,
        totalSidebarCards: totalSidebarCards,
      },
    };

    return successResponse(res, {
      message: "Dashboard stats fetched successfully",
      data: stats,
    });
  } catch (error) {
    logger.error("Dashboard stats error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch dashboard stats",
    });
  }
};

// ==========================================================
// ADDITIONAL ADMIN FUNCTIONS (Optional)
// ==========================================================

/**
 * @desc    Get system overview
 * @route   GET /api/admin/dashboard/overview
 * @access  Private/Admin
 */
export const getSystemOverview = async (req, res) => {
  try {
    const [
      totalUsers,
      verifiedUsers,
      totalServices,
      popularServices,
      featuredServices,
    ] = await Promise.all([
      User.countDocuments({ isDeleted: false }),
      User.countDocuments({ isVerified: true, isDeleted: false }),
      Service.countDocuments({ isDeleted: false }),
      Service.countDocuments({ "flags.isPopular": true, isDeleted: false }),
      Service.countDocuments({ "flags.isFeatured": true, isDeleted: false }),
    ]);

    return successResponse(res, {
      message: "System overview fetched successfully",
      data: {
        users: {
          total: totalUsers || 0,
          verified: verifiedUsers || 0,
          unverified: (totalUsers || 0) - (verifiedUsers || 0),
        },
        services: {
          total: totalServices || 0,
          popular: popularServices || 0,
          featured: featuredServices || 0,
        },
      },
    });
  } catch (error) {
    logger.error("System overview error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch system overview",
    });
  }
};

/**
 * @desc    Get recent activity
 * @route   GET /api/admin/dashboard/activity
 * @access  Private/Admin
 */
export const getRecentActivity = async (req, res) => {
  try {
    const [recentUsers, recentServices] = await Promise.all([
      User.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("fullName email createdAt role")
        .lean(),
      Service.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("name category createdAt")
        .lean(),
    ]);

    // Combine and sort activities
    const activities = [
      ...recentUsers.map(user => ({
        type: 'user',
        action: 'registered',
        user: user.fullName,
        email: user.email,
        timestamp: user.createdAt,
        details: `New user registered: ${user.fullName}`,
      })),
      ...recentServices.map(service => ({
        type: 'service',
        action: 'created',
        name: service.name,
        category: service.category,
        timestamp: service.createdAt,
        details: `New service created: ${service.name}`,
      })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
     .slice(0, 10);

    return successResponse(res, {
      message: "Recent activity fetched successfully",
      data: activities,
    });
  } catch (error) {
    logger.error("Recent activity error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch recent activity",
    });
  }
};

// ==========================================================
// EXPORT ALL
// ==========================================================

export default {
  getDashboardStats,
  getSystemOverview,
  getRecentActivity,
};