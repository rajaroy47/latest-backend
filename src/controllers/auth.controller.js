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

        if (user.isDeleted) {
            return forbiddenResponse(res, { message: "Your account has been deleted" });
        }

        if (user.isBlocked) {
            return forbiddenResponse(res, { message: "Your account has been blocked" });
        }

        if (user.isLocked) {
            const waitTime = Math.ceil((user.lockedUntil - new Date()) / 60000);
            return forbiddenResponse(res, {
                message: `Account locked. Try again in ${waitTime} minutes.`,
            });
        }

        const isPasswordCorrect = await user.matchPassword(password);
        if (!isPasswordCorrect) {
            await user.incrementFailedLogin();
            return unauthorizedResponse(res, { message: "Invalid email or password" });
        }

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

        if (user.refreshToken !== incomingRefreshToken) {
            return unauthorizedResponse(res, { message: "Invalid refresh token" });
        }

        if (!user.isActive || user.isDeleted) {
            return forbiddenResponse(res, { message: "Your account is not active" });
        }

        const accessToken = generateAccessToken(user);

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

export const logoutUser = async (req, res) => {
    try {
        if (req.user?._id) {
            await User.findByIdAndUpdate(req.user._id, {
                $unset: { refreshToken: 1 },
            });
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
// EMAIL VERIFICATION (AUTH)
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

        user.isVerified = true;
        user.verificationToken = undefined;
        user.verificationTokenExpiry = undefined;
        await user.save();

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

export const resendVerificationEmail = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (!user) {
            return notFoundResponse(res, { message: "User not found" });
        }

        if (user.isVerified) {
            return badRequestResponse(res, { message: "Email is already verified" });
        }

        const verificationToken = user.createVerificationToken();
        await user.save({ validateBeforeSave: false });

        const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;

        try {
            await sendVerificationEmail(user.email, user.fullName, verifyUrl);
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
// PASSWORD RESET (AUTH)
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

        if (!user) {
            return successResponse(res, {
                message: "If your email is registered, you will receive a password reset link",
            });
        }

        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;

        try {
            await sendPasswordResetEmail(user.email, user.fullName, resetUrl);
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
            message: "Password reset link sent to your email",
        });

    } catch (error) {
        logger.error("❌ Forgot password error:", error);
        return errorResponse(res, {
            message: error.message || "Failed to process password reset request",
        });
    }
};

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

        user.password = password;
        user.passwordChangedAt = new Date();
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiry = undefined;
        user.failedLoginAttempts = 0;
        user.lockedUntil = null;
        await user.save();

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
// GET CURRENT USER (AUTH)
// ==========================================================

export const getCurrentUser = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select("-password -refreshToken -verificationToken -resetPasswordToken -__v");

        if (!user) {
            return notFoundResponse(res, { message: "User not found" });
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
    getCurrentUser,
};