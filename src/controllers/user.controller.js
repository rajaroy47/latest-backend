// controllers/userController.js

import User from "../models/user.model.js";
import crypto from "crypto";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  successResponse,
  errorResponse,
  notFoundResponse,
  badRequestResponse,
  unauthorizedResponse,
  forbiddenResponse,
  validationErrorResponse,
  logger,
  getPaginationOptions,
  getPaginatedResponse,
  isValidEmail,
  isValidPhone,
  isValidPAN,
  isValidAadhaar,
  isValidGST,
  isValidPincode,
  validatePassword,
} from "../utils/index.js";

// ==========================================================
// PROFILE MANAGEMENT
// ==========================================================

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select("-password -refreshToken -verificationToken -resetPasswordToken -__v");

    if (!user) {
      return notFoundResponse(res, { message: "User not found" });
    }

    return successResponse(res, {
      message: "Profile fetched successfully",
      data: user,
    });
  } catch (error) {
    logger.error("Get profile error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch profile",
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id)
      .select("-password -refreshToken -verificationToken -resetPasswordToken -__v");

    if (!user) {
      return notFoundResponse(res, { message: "User not found" });
    }

    return successResponse(res, {
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    logger.error("Get user by ID error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch user",
    });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return notFoundResponse(res, { message: "User not found" });
    }

    const { fullName, phone, bio, address, identity, company, social, preferences } = req.body;

    if (fullName && fullName.trim()) {
      user.fullName = fullName.trim();
    }

    if (phone) {
      if (!isValidPhone(phone)) {
        return badRequestResponse(res, { message: "Invalid phone number format" });
      }
      user.phone = phone.trim();
    }

    if (bio !== undefined) {
      user.bio = bio.trim();
    }

    // Address, Identity, Company, Social, Preferences updates
    // ... (keep all your existing update logic)

    // Process Avatar Upload
    if (req.file) {
      if (user.avatar) {
        const publicId = extractPublicIdFromUrl(user.avatar);
        if (publicId) {
          try {
            await deleteFromCloudinary(publicId);
          } catch (error) {
            logger.error("Failed to delete old avatar:", error);
          }
        }
      }

      const uploadedAvatar = await uploadToCloudinary(req.file, {
        folder: "avatars",
        transformation: [
          { width: 400, height: 400, crop: "limit" },
          { quality: "auto" },
        ],
      });
      user.avatar = uploadedAvatar.secure_url;
    }

    user.markModified("userDetails");
    user.updatedBy = user._id;
    await user.save();

    const updatedUser = await User.findById(user._id)
      .select("-password -refreshToken -verificationToken -resetPasswordToken -__v");

    return successResponse(res, {
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    logger.error("Update profile error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to update profile",
    });
  }
};

export const deleteUserAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return notFoundResponse(res, { message: "User not found" });
    }

    if (!user.avatar) {
      return badRequestResponse(res, { message: "No avatar to delete" });
    }

    const publicId = extractPublicIdFromUrl(user.avatar);
    if (publicId) {
      await deleteFromCloudinary(publicId);
    }

    user.avatar = "";
    await user.save();

    return successResponse(res, {
      message: "Avatar deleted successfully",
    });
  } catch (error) {
    logger.error("Delete avatar error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to delete avatar",
    });
  }
};

// ==========================================================
// PASSWORD MANAGEMENT (User Profile)
// ==========================================================

export const updatePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return notFoundResponse(res, { message: "User not found" });
    }

    const { oldPassword, newPassword, confirmPassword } = req.body;

    const isPasswordCorrect = await user.matchPassword(oldPassword);
    if (!isPasswordCorrect) {
      return unauthorizedResponse(res, { message: "Current password is incorrect" });
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return validationErrorResponse(res, {
        message: "Password validation failed",
        errors: passwordValidation.errors,
      });
    }

    if (newPassword !== confirmPassword) {
      return badRequestResponse(res, { message: "Passwords do not match" });
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.updatedBy = user._id;
    await user.save();

    return successResponse(res, {
      message: "Password updated successfully",
    });
  } catch (error) {
    logger.error("Update password error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to update password",
    });
  }
};

// ==========================================================
// ADMIN - USER MANAGEMENT
// ==========================================================

export const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      isActive,
      isVerified,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
      includeDeleted = "false",
    } = req.query;

    const query = {};
    if (includeDeleted !== "true") {
      query.isDeleted = false;
    }
    if (role) query.role = role;
    if (isActive !== undefined) query.isActive = isActive === "true";
    if (isVerified !== undefined) query.isVerified = isVerified === "true";

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const paginationOptions = getPaginationOptions(req.query);
    const { skip, limit: pageLimit, sort } = paginationOptions;

    const [users, total] = await Promise.all([
      User.find(query)
        .sort(sort)
        .skip(skip)
        .limit(pageLimit)
        .select("-password -refreshToken -verificationToken -resetPasswordToken -__v"),
      User.countDocuments(query),
    ]);

    return getPaginatedResponse(res, users, total, paginationOptions);
  } catch (error) {
    logger.error("Get all users error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch users",
    });
  }
};

export const updateUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, phone, isActive, isVerified, userDetails } = req.body;

    const user = await User.findById(id);

    if (!user) {
      return notFoundResponse(res, { message: "User not found" });
    }

    if (fullName) user.fullName = fullName.trim();
    if (email) {
      if (!isValidEmail(email)) {
        return badRequestResponse(res, { message: "Invalid email address" });
      }
      user.email = email.toLowerCase().trim();
    }
    if (role) user.role = role;
    if (phone) {
      if (!isValidPhone(phone)) {
        return badRequestResponse(res, { message: "Invalid phone number" });
      }
      user.phone = phone.trim();
    }
    if (isActive !== undefined) user.isActive = isActive;
    if (isVerified !== undefined) user.isVerified = isVerified;

    if (userDetails) {
      let parsedDetails = userDetails;
      if (typeof userDetails === "string") {
        try {
          parsedDetails = JSON.parse(userDetails);
        } catch (e) {
          return badRequestResponse(res, { message: "Invalid userDetails format" });
        }
      }
      user.userDetails = {
        ...(user.userDetails || {}),
        ...parsedDetails,
      };
      user.markModified("userDetails");
    }

    user.updatedBy = req.user._id;
    await user.save();

    const updatedUser = await User.findById(id)
      .select("-password -refreshToken -verificationToken -resetPasswordToken -__v");

    return successResponse(res, {
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    logger.error("Admin update user error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to update user",
    });
  }
};

export const deleteUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);

    if (!user) {
      return notFoundResponse(res, { message: "User not found" });
    }

    if (user.role === "admin") {
      return forbiddenResponse(res, { message: "Cannot delete admin user" });
    }

    await user.softDelete();

    return successResponse(res, {
      message: "User deleted successfully",
      data: { id: user._id, deletedAt: user.deletedAt },
    });
  } catch (error) {
    logger.error("Admin delete user error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to delete user",
    });
  }
};

export const restoreUserByAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findOne({ _id: id, isDeleted: true });

    if (!user) {
      return notFoundResponse(res, { message: "Deleted user not found" });
    }

    await user.restore();

    return successResponse(res, {
      message: "User restored successfully",
      data: user,
    });
  } catch (error) {
    logger.error("Admin restore user error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to restore user",
    });
  }
};

export const bulkUpdateUserStatus = async (req, res) => {
  try {
    const { userIds, status } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return badRequestResponse(res, { message: "Please provide user IDs" });
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      {
        $set: {
          isActive: status,
          updatedBy: req.user._id,
        },
      }
    );

    return successResponse(res, {
      message: `Updated ${result.modifiedCount} users`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    logger.error("Bulk update status error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to update users",
    });
  }
};

export const bulkDeleteUsers = async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return badRequestResponse(res, { message: "Please provide user IDs" });
    }

    const result = await User.updateMany(
      { _id: { $in: userIds } },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          isActive: false,
          updatedBy: req.user._id,
        },
      }
    );

    return successResponse(res, {
      message: `Deleted ${result.modifiedCount} users`,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    logger.error("Bulk delete users error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to delete users",
    });
  }
};

// ==========================================================
// STATS & DASHBOARD
// ==========================================================

export const getUserStats = async (req, res) => {
  try {
    const [totalUsers, activeUsers, verifiedUsers, adminUsers, deletedUsers, recentUsers] =
      await Promise.all([
        User.countDocuments({ isDeleted: false }),
        User.countDocuments({ isActive: true, isDeleted: false }),
        User.countDocuments({ isVerified: true, isDeleted: false }),
        User.countDocuments({ role: "admin", isDeleted: false }),
        User.countDocuments({ isDeleted: true }),
        User.find({ isDeleted: false })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("fullName email createdAt isVerified avatar"),
      ]);

    return successResponse(res, {
      message: "User statistics fetched successfully",
      data: {
        totalUsers,
        activeUsers,
        verifiedUsers,
        adminUsers,
        deletedUsers,
        recentUsers,
        stats: {
          verificationRate: totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(1) : 0,
          activeRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(1) : 0,
        },
      },
    });
  } catch (error) {
    logger.error("Get user stats error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch user statistics",
    });
  }
};

// ==========================================================
// EXPORT ALL
// ==========================================================

export default {
  // Profile
  getUserProfile,
  getUserById,
  updateUserProfile,
  deleteUserAvatar,

  // Password
  updatePassword,

  // Admin
  getAllUsers,
  updateUserByAdmin,
  deleteUserByAdmin,
  restoreUserByAdmin,
  bulkUpdateUserStatus,
  bulkDeleteUsers,

  // Stats
  getUserStats,
};