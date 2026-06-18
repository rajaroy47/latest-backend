// utils/passwordUtils.js

import bcrypt from "bcrypt";
import crypto from "crypto";
import logger from "./logger.js";

// ==========================================================
// PASSWORD HASHING
// ==========================================================

/**
 * Hash password
 * @param {string} password - Plain text password
 * @param {number} saltRounds - Salt rounds (default: 10)
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password, saltRounds = 10) => {
  try {
    const salt = await bcrypt.genSalt(saltRounds);
    const hashed = await bcrypt.hash(password, salt);
    logger.info("✅ Password hashed successfully");
    return hashed;
  } catch (error) {
    logger.error("❌ Password hashing error:", error);
    throw error;
  }
};

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hashedPassword - Hashed password
 * @returns {Promise<boolean>} True if matches
 */
export const comparePassword = async (password, hashedPassword) => {
  try {
    const isMatch = await bcrypt.compare(password, hashedPassword);
    logger.info(`✅ Password comparison: ${isMatch ? 'Match' : 'No match'}`);
    return isMatch;
  } catch (error) {
    logger.error("❌ Password comparison error:", error);
    throw error;
  }
};

// ==========================================================
// TOKEN GENERATION
// ==========================================================

/**
 * Generate random token
 * @param {number} length - Token length (default: 32)
 * @returns {string} Random token
 */
export const generateRandomToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate hashed token
 * @param {string} token - Token to hash
 * @returns {string} Hashed token
 */
export const hashToken = (token) => {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
};

/**
 * Generate OTP
 * @param {number} length - OTP length (default: 6)
 * @returns {string} OTP code
 */
export const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};

/**
 * Check password strength
 * @param {string} password - Password to check
 * @returns {Object} { score, feedback }
 */
export const checkPasswordStrength = (password) => {
  let score = 0;
  const feedback = [];

  if (password.length >= 8) {
    score++;
  } else {
    feedback.push('Password should be at least 8 characters long');
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score++;
  } else {
    feedback.push('Password should contain both uppercase and lowercase letters');
  }

  if (/[0-9]/.test(password)) {
    score++;
  } else {
    feedback.push('Password should contain at least one number');
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score++;
  } else {
    feedback.push('Password should contain at least one special character');
  }

  return {
    score,
    strength: score >= 4 ? 'Strong' : score >= 3 ? 'Good' : score >= 2 ? 'Fair' : 'Weak',
    feedback,
  };
};