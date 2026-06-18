// routes/authRoutes.js

import express from "express";
import {
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
} from "../controllers/auth.controller.js";
import { protect, optionalAuth } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ==========================================================
// PUBLIC ROUTES (No authentication required)
// ==========================================================

// Register user
router.post("/register", registerUser);

// Login user
router.post("/login", loginUser);

// Refresh access token
router.post("/refresh-token", refreshAccessToken);

// Forgot password - send reset link
router.post("/forgot-password", forgotPassword);

// Reset password with token
router.post("/reset-password/:token", resetPassword);

router.get("/check-reset-token/:token", checkResetToken);

// Verify email with token
router.get("/verify-email/:token", verifyEmail);

// ==========================================================
// PROTECTED ROUTES (Authentication required)
// ==========================================================

// Logout user
router.post("/logout", protect, logoutUser);

// Get current user
router.get("/me", protect, getCurrentUser);

// Resend verification email
router.post("/resend-verification", protect, resendVerificationEmail);

export default router;