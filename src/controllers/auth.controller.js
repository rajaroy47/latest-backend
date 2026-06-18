// controllers/authController.js

import User from "../models/user.model.js";
import crypto from "crypto";
import {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
} from "../utils/jwtToken.js";
import {
    sendWelcomeEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
} from "../utils/sendMail.js";
import {
    successResponse,
    errorResponse,
    badRequestResponse,
    unauthorizedResponse,
    forbiddenResponse,
    conflictResponse,
    notFoundResponse,
    validationErrorResponse,
    logger,
    isValidEmail,
    validatePassword,
} from "../utils/index.js";

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
};

// ==========================================================
// HELPER: Check account status
// ==========================================================

const checkAccountStatus = (user) => {
    if (user.isDeleted) {
        return {
            isValid: false,
            status: 'deleted',
            message: "Your account has been deleted."
        };
    }

    if (user.isBlocked) {
        return {
            isValid: false,
            status: 'blocked',
            message: "Your account has been blocked. Please contact support."
        };
    }

    if (user.isActive === false) {
        return {
            isValid: false,
            status: 'deactivated',
            message: "Your account has been deactivated. Please contact support."
        };
    }

    return {
        isValid: true,
        status: 'active',
        message: "Account is active"
    };
};

// ==========================================================
// AUTHENTICATION FUNCTIONS
// ==========================================================

export const registerUser = async (req, res) => {
    try {
        const { fullName, email, password } = req.body;

        if (!fullName || !email || !password) {
            return badRequestResponse(res, {
                message: "All fields (fullName, email, password) are required",
            });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
        if (existingUser) {
            return conflictResponse(res, { message: "User already exists with this email" });
        }

        const user = await User.create({
            fullName: fullName.trim(),
            email: email.toLowerCase().trim(),
            password,
        });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken -verificationToken -resetPasswordToken -__v"
        );

        // Send welcome email (non-blocking)
        try {
            const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${user.verificationToken || 'temp'}`;
            await sendWelcomeEmail(createdUser.email, createdUser.fullName, verifyUrl);
        } catch (emailError) {
            logger.warn("⚠️ Welcome email failed:", emailError.message);
        }

        return res
            .status(201)
            .cookie("accessToken", accessToken, {
                ...cookieOptions,
                maxAge: 15 * 60 * 1000,
            })
            .cookie("refreshToken", refreshToken, {
                ...cookieOptions,
                maxAge: 7 * 24 * 60 * 60 * 1000,
            })
            .json({
                success: true,
                message: "User registered successfully",
                data: { user: createdUser, accessToken, refreshToken },
            });

    } catch (error) {
        logger.error("❌ Registration error:", error);
        return errorResponse(res, {
            message: error.message || "Failed to register user",
        });
    }
};

// ==========================================================
// LOGIN USER (FULLY PROTECTED)
// ==========================================================

export const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return badRequestResponse(res, { message: "Email and password are required" });
        }

        const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+password");

        if (!user) {
            return unauthorizedResponse(res, { message: "Invalid email or password" });
        }

        // ==========================================================
        // CHECK ACCOUNT STATUS
        // ==========================================================
        
        const status = checkAccountStatus(user);
        if (!status.isValid) {
            logger.warn(`❌ ${status.status} user attempted login: ${email}`);
            return forbiddenResponse(res, { message: status.message });
        }

        // Check if user is locked
        if (user.isLocked) {
            const waitTime = Math.ceil((user.lockedUntil - new Date()) / 60000);
            return forbiddenResponse(res, {
                message: `Account locked. Try again in ${waitTime} minutes.`,
            });
        }

        // Verify password
        const isPasswordCorrect = await user.matchPassword(password);
        if (!isPasswordCorrect) {
            await user.incrementFailedLogin();
            return unauthorizedResponse(res, { message: "Invalid email or password" });
        }

        // Reset failed login attempts on successful login
        await user.resetFailedLogin();
        user.lastLogin = new Date();
        await user.save({ validateBeforeSave: false });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        const loggedInUser = await User.findById(user._id).select(
            "-password -refreshToken -verificationToken -resetPasswordToken -__v"
        );

        logger.info(`✅ User logged in: ${user.email}`);

        return res
            .status(200)
            .cookie("accessToken", accessToken, {
                ...cookieOptions,
                maxAge: 15 * 60 * 1000,
            })
            .cookie("refreshToken", refreshToken, {
                ...cookieOptions,
                maxAge: 7 * 24 * 60 * 60 * 1000,
            })
            .json({
                success: true,
                message: "Login successful",
                data: { user: loggedInUser, accessToken, refreshToken },
            });

    } catch (error) {
        logger.error("❌ Login error:", error);
        return errorResponse(res, {
            message: error.message || "Failed to login",
        });
    }
};

// ==========================================================
// REFRESH ACCESS TOKEN (FULLY PROTECTED)
// ==========================================================

export const refreshAccessToken = async (req, res) => {
    try {
        const incomingRefreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

        if (!incomingRefreshToken) {
            return unauthorizedResponse(res, { message: "Refresh token missing" });
        }

        const decoded = verifyRefreshToken(incomingRefreshToken);
        if (!decoded) {
            return unauthorizedResponse(res, { message: "Invalid refresh token" });
        }

        const user = await User.findById(decoded.id);
        if (!user) {
            return unauthorizedResponse(res, { message: "User not found" });
        }

        // ==========================================================
        // CHECK ACCOUNT STATUS
        // ==========================================================
        
        const status = checkAccountStatus(user);
        if (!status.isValid) {
            logger.warn(`❌ ${status.status} user attempted token refresh: ${user.email}`);
            return forbiddenResponse(res, { message: status.message });
        }

        if (user.refreshToken !== incomingRefreshToken) {
            return unauthorizedResponse(res, { message: "Invalid refresh token" });
        }

        const accessToken = generateAccessToken(user);

        logger.info(`🔄 Token refreshed for: ${user.email}`);

        return res
            .status(200)
            .cookie("accessToken", accessToken, {
                ...cookieOptions,
                maxAge: 15 * 60 * 1000,
            })
            .json({
                success: true,
                message: "Access token refreshed",
                data: { accessToken },
            });

    } catch (error) {
        logger.error("❌ Refresh token error:", error);
        return unauthorizedResponse(res, {
            message: error.message || "Refresh token expired or invalid",
        });
    }
};

// ==========================================================
// LOGOUT USER
// ==========================================================

export const logoutUser = async (req, res) => {
    try {
        if (req.user?._id) {
            await User.findByIdAndUpdate(req.user._id, {
                $unset: { refreshToken: 1 },
            });
            logger.info(`🚪 User logged out: ${req.user.email}`);
        }

        return res
            .status(200)
            .clearCookie("accessToken", cookieOptions)
            .clearCookie("refreshToken", cookieOptions)
            .clearCookie("token", cookieOptions)
            .json({
                success: true,
                message: "Logout successful",
            });

    } catch (error) {
        logger.error("❌ Logout error:", error);
        return errorResponse(res, {
            message: error.message || "Failed to logout",
        });
    }
};

// ==========================================================
// EMAIL VERIFICATION (FULLY PROTECTED)
// ==========================================================

export const verifyEmail = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return badRequestResponse(res, { message: "Verification token is required" });
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            verificationToken: hashedToken,
            verificationTokenExpiry: { $gt: Date.now() },
        });

        if (!user) {
            return badRequestResponse(res, { message: "Invalid or expired verification token" });
        }

        // ==========================================================
        // CHECK ACCOUNT STATUS
        // ==========================================================
        
        const status = checkAccountStatus(user);
        if (!status.isValid) {
            logger.warn(`❌ ${status.status} user attempted email verification: ${user.email}`);
            return forbiddenResponse(res, { message: status.message });
        }

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiry = undefined;
        await user.save();

        logger.info(`✅ Email verified for: ${user.email}`);

        return successResponse(res, {
            message: "Email verified successfully. You can now login.",
        });

    } catch (error) {
        logger.error("❌ Verify email error:", error);
        return errorResponse(res, {
            message: error.message || "Failed to verify email",
        });
    }
};

// ==========================================================
// RESEND VERIFICATION EMAIL (FULLY PROTECTED)
// ==========================================================

export const resendVerificationEmail = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return notFoundResponse(res, { message: "User not found" });
        }

        // ==========================================================
        // CHECK ACCOUNT STATUS
        // ==========================================================
        
        const status = checkAccountStatus(user);
        if (!status.isValid) {
            logger.warn(`❌ ${status.status} user requested verification email: ${user.email}`);
            return forbiddenResponse(res, { message: status.message });
        }

        if (user.isVerified) {
            return badRequestResponse(res, { message: "Email is already verified" });
        }

        const verificationToken = user.createVerificationToken();
        await user.save({ validateBeforeSave: false });

        const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;

        try {
            await sendVerificationEmail(user.email, user.fullName, verifyUrl);
            logger.info(`📧 Verification email sent to: ${user.email}`);
        } catch (emailError) {
            logger.error("❌ Verification email failed:", emailError.message);
            return errorResponse(res, {
                message: "Failed to send verification email. Please try again later.",
            });
        }

        return successResponse(res, {
            message: "Verification email sent successfully",
        });

    } catch (error) {
        logger.error("❌ Resend verification error:", error);
        return errorResponse(res, {
            message: error.message || "Failed to resend verification email",
        });
    }
};

// ==========================================================
// FORGOT PASSWORD (FULLY PROTECTED)
// ==========================================================

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return badRequestResponse(res, { message: "Email is required" });
        }

        if (!isValidEmail(email)) {
            return badRequestResponse(res, { message: "Invalid email address" });
        }

        const user = await User.findByEmail(email);

        // Don't reveal if user exists or not for security
        if (!user) {
            return successResponse(res, {
                message: "If your email is registered, you will receive a password reset link",
            });
        }

        // ==========================================================
        // CHECK ACCOUNT STATUS - Return generic message for security
        // ==========================================================
        
        const status = checkAccountStatus(user);
        if (!status.isValid) {
            logger.warn(`❌ ${status.status} user attempted password reset: ${email}`);
            return successResponse(res, {
                message: "If your email is registered, you will receive a password reset link",
            });
        }

        // Check if user is verified
        if (!user.isVerified) {
            logger.warn(`⚠️ Unverified user attempted password reset: ${email}`);
            return successResponse(res, {
                message: "If your email is registered, you will receive a password reset link",
            });
        }

        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

        try {
            await sendPasswordResetEmail(user.email, user.fullName, resetUrl);
            logger.info(`📧 Password reset email sent to: ${email}`);
        } catch (emailError) {
            user.resetPasswordToken = undefined;
            user.resetPasswordExpiry = undefined;
            await user.save({ validateBeforeSave: false });
            logger.error("❌ Password reset email failed:", emailError.message);
            return errorResponse(res, {
                message: "Failed to send password reset email. Please try again later.",
            });
        }

        return successResponse(res, {
            message: "If your email is registered, you will receive a password reset link",
        });

    } catch (error) {
        logger.error("❌ Forgot password error:", error);
        return errorResponse(res, {
            message: error.message || "Failed to process password reset request",
        });
    }
};

// ==========================================================
// RESET PASSWORD (FULLY PROTECTED)
// ==========================================================

export const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password, confirmPassword } = req.body;

        if (!token) {
            return badRequestResponse(res, { message: "Reset token is required" });
        }

        if (!password || !confirmPassword) {
            return badRequestResponse(res, { message: "Password and confirm password are required" });
        }

        if (password !== confirmPassword) {
            return badRequestResponse(res, { message: "Passwords do not match" });
        }

        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
            return validationErrorResponse(res, {
                message: "Password validation failed",
                errors: passwordValidation.errors,
            });
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpiry: { $gt: Date.now() },
        });

        if (!user) {
            return badRequestResponse(res, { message: "Invalid or expired reset token" });
        }

        // ==========================================================
        // CHECK ACCOUNT STATUS
        // ==========================================================
        
        const status = checkAccountStatus(user);
        if (!status.isValid) {
            logger.warn(`❌ ${status.status} user attempted password reset via token: ${user.email}`);
            return forbiddenResponse(res, { message: status.message });
        }

        // Update password
        user.password = password;
        user.passwordChangedAt = new Date();
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiry = undefined;
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        await user.save();

        logger.info(`✅ Password reset successful for: ${user.email}`);

        return successResponse(res, {
            message: "Password reset successfully. Please login with your new password.",
        });

    } catch (error) {
        logger.error("❌ Reset password error:", error);
        return errorResponse(res, {
            message: error.message || "Failed to reset password",
        });
    }
};

// ==========================================================
// CHECK RESET TOKEN (NEW - FULLY PROTECTED)
// ==========================================================

export const checkResetToken = async (req, res) => {
    try {
        const { token } = req.params;

        if (!token) {
            return badRequestResponse(res, { message: "Reset token is required" });
        }

        const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpiry: { $gt: Date.now() },
        });

        if (!user) {
            return badRequestResponse(res, { 
                message: "Invalid or expired reset token. Please request a new one." 
            });
        }

        // ==========================================================
        // CHECK ACCOUNT STATUS
        // ==========================================================
        
        const status = checkAccountStatus(user);
        if (!status.isValid) {
            logger.warn(`❌ ${status.status} user attempted to check reset token: ${user.email}`);
            return forbiddenResponse(res, { message: status.message });
        }

        // Mask email for security
        const maskedEmail = maskEmail(user.email);

        return successResponse(res, {
            message: "Valid reset token",
            data: { 
                email: maskedEmail,
                isVerified: user.isVerified
            }
        });

    } catch (error) {
        logger.error("❌ Check reset token error:", error);
        return errorResponse(res, {
            message: error.message || "Failed to validate reset token",
        });
    }
};

// ==========================================================
// GET CURRENT USER (FULLY PROTECTED)
// ==========================================================

export const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select("-password -refreshToken -verificationToken -resetPasswordToken -__v");

        if (!user) {
            return notFoundResponse(res, { message: "User not found" });
        }

        // ==========================================================
        // CHECK ACCOUNT STATUS
        // ==========================================================
        
        const status = checkAccountStatus(user);
        if (!status.isValid) {
            logger.warn(`❌ ${status.status} user attempted to get profile: ${user.email}`);
            return forbiddenResponse(res, { message: status.message });
        }

        return successResponse(res, {
            message: "User fetched successfully",
            data: user,
        });

    } catch (error) {
        logger.error("❌ Get current user error:", error);
        return errorResponse(res, {
            message: error.message || "Failed to fetch user",
        });
    }
};

// ==========================================================
// HELPER: Mask email for security
// ==========================================================

const maskEmail = (email) => {
    const [localPart, domain] = email.split('@');
    if (localPart.length <= 2) {
        return email;
    }
    const visibleChars = 2;
    const maskedLocal = localPart.slice(0, visibleChars) + '*'.repeat(Math.min(localPart.length - visibleChars, 4));
    return `${maskedLocal}@${domain}`;
};

// ==========================================================
// EXPORT ALL
// ==========================================================

export default {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    checkResetToken,
    getCurrentUser,
};