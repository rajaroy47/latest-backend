// utils/jwtToken.js

import jwt from "jsonwebtoken";
import logger from "./logger.js";

// ==========================================================
// TOKEN GENERATION
// ==========================================================

/**
 * Generate Access Token
 * @param {Object} user - User object
 * @returns {string} JWT access token
 */
export const generateAccessToken = (user) => {
  try {
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
        fullName: user.fullName,
      },
      process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRE || "7d",
      }
    );
    logger.info(`✅ Access token generated for user: ${user.email}`);
    return token;
  } catch (error) {
    logger.error("❌ Access token generation error:", error);
    throw error;
  }
};

/**
 * Generate Refresh Token
 * @param {Object} user - User object
 * @returns {string} JWT refresh token
 */
export const generateRefreshToken = (user) => {
  try {
    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
      {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRE || "30d",
      }
    );
    logger.info(`✅ Refresh token generated for user: ${user.email}`);
    return token;
  } catch (error) {
    logger.error("❌ Refresh token generation error:", error);
    throw error;
  }
};

/**
 * Generate both access and refresh tokens
 * @param {Object} user - User object
 * @returns {Object} { accessToken, refreshToken }
 */
export const generateTokens = (user) => {
  return {
    accessToken: generateAccessToken(user),
    refreshToken: generateRefreshToken(user),
  };
};

// ==========================================================
// TOKEN VERIFICATION
// ==========================================================

/**
 * Verify Access Token
 * @param {string} token - JWT access token
 * @returns {Object} Decoded token payload
 */
export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET
    );
    return decoded;
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      logger.error("❌ Invalid access token");
    }
    if (error.name === "TokenExpiredError") {
      logger.error("❌ Access token expired");
    }
    throw error;
  }
};

/**
 * Verify Refresh Token
 * @param {string} token - JWT refresh token
 * @returns {Object} Decoded token payload
 */
export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET
    );
    return decoded;
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      logger.error("❌ Invalid refresh token");
    }
    if (error.name === "TokenExpiredError") {
      logger.error("❌ Refresh token expired");
    }
    throw error;
  }
};

/**
 * Decode token without verification (use with caution)
 * @param {string} token - JWT token
 * @returns {Object|null} Decoded token payload or null
 */
export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    logger.error("❌ Token decode error:", error);
    return null;
  }
};