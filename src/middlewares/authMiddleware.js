// middleware/authMiddleware.js

import jwt from "jsonwebtoken";
import User from "../models/user.model.js"; // Fixed: Changed from user.model.js to User.js (consistent with Service model import pattern)

/* ==========================================================
   PROTECT MIDDLEWARE - Authentication
========================================================== */

export const protect = async (req, res, next) => {
  try {
    let token;
    
    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    
    // Check for token in cookies (optional - for additional security)
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }
    
    // Check if token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, no token provided",
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET);
    
    // Find user by id and exclude password
    const user = await User.findById(decoded.id || decoded.userId).select("-password");
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found or token invalid",
      });
    }
    
    // Check if user is active
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }
    
    // Check if user is deleted
    if (user.isDeleted === true) {
      return res.status(401).json({
        success: false,
        message: "Your account has been deleted.",
      });
    }
    
    // Attach user to request object
    req.user = user;
    req.userId = user._id;
    req.userRole = user.role;
    
    next();
  } catch (error) {
    // Handle specific JWT errors
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
      });
    }
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }
    
    // Generic error
    console.error("Auth middleware error:", error);
    return res.status(401).json({
      success: false,
      message: "Not authorized. Please login.",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/* ==========================================================
   ADMIN MIDDLEWARE - Role-based access
========================================================== */

export const admin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }
  
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required. You do not have permission to access this resource.",
    });
  }
  
  next();
};

/* ==========================================================
   AUTHORIZE MIDDLEWARE - Multiple roles support
========================================================== */

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role (${req.user.role}) is not authorized to access this resource. Required roles: ${roles.join(", ")}`,
      });
    }
    
    next();
  };
};

/* ==========================================================
   OPTIONAL AUTH MIDDLEWARE - Auth if token provided, but not required
========================================================== */

export const optionalAuth = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    
    if (token) {
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET);
      const user = await User.findById(decoded.id || decoded.userId).select("-password");
      
      if (user && user.isActive !== false && user.isDeleted !== true) {
        req.user = user;
        req.userId = user._id;
      }
    }
    
    next();
  } catch (error) {
    // Just continue without user if token is invalid
    next();
  }
};

/* ==========================================================
   OWNER OR ADMIN MIDDLEWARE - Check if user owns the resource or is admin
========================================================== */

export const ownerOrAdmin = (getResourceUserId) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }
      
      // Admin has full access
      if (req.user.role === "admin") {
        return next();
      }
      
      // Get the resource owner ID from the request
      let resourceOwnerId;
      
      if (typeof getResourceUserId === "function") {
        resourceOwnerId = await getResourceUserId(req);
      } else if (typeof getResourceUserId === "string") {
        resourceOwnerId = req.params[getResourceUserId] || req.body[getResourceUserId];
      } else {
        resourceOwnerId = getResourceUserId;
      }
      
      // Check if current user is the owner
      if (resourceOwnerId && resourceOwnerId.toString() === req.user._id.toString()) {
        return next();
      }
      
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action",
      });
    } catch (error) {
      console.error("Owner or admin middleware error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error while checking permissions",
      });
    }
  };
};

/* ==========================================================
   PERMISSION MIDDLEWARE - Check specific permissions
========================================================== */

export const hasPermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }
      
      // Admin has all permissions
      if (req.user.role === "admin") {
        return next();
      }
      
      // Check if user has specific permission
      if (req.user.permissions && req.user.permissions.includes(permission)) {
        return next();
      }
      
      return res.status(403).json({
        success: false,
        message: `You don't have permission to ${permission}`,
      });
    } catch (error) {
      console.error("Permission middleware error:", error);
      return res.status(500).json({
        success: false,
        message: "Server error while checking permissions",
      });
    }
  };
};

/* ==========================================================
   RATE LIMIT BY ROLE - Different rate limits for different roles
========================================================== */

export const rateLimitByRole = (limits) => {
  // limits = { admin: 1000, user: 100, guest: 20 }
  return async (req, res, next) => {
    try {
      let role = "guest";
      
      if (req.user) {
        role = req.user.role === "admin" ? "admin" : "user";
      }
      
      const limit = limits[role] || limits.default || 50;
      
      // You can implement actual rate limiting here using Redis or memory store
      // This is a placeholder for rate limiting logic
      
      req.rateLimit = {
        limit,
        remaining: limit,
        resetTime: new Date(Date.now() + 60 * 1000),
      };
      
      next();
    } catch (error) {
      next();
    }
  };
};

/* ==========================================================
   VERIFY REFRESH TOKEN MIDDLEWARE
========================================================== */

export const verifyRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
      });
    }
    
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    
    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }
    
    req.user = user;
    req.refreshToken = refreshToken;
    
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Refresh token expired. Please login again.",
      });
    }
    
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};

/* ==========================================================
   LOGIN LIMITER MIDDLEWARE - Prevent brute force attacks
========================================================== */

// Store failed attempts (in production, use Redis)
const failedAttempts = new Map();

export const loginLimiter = async (req, res, next) => {
  const email = req.body.email;
  const ip = req.ip || req.connection.remoteAddress;
  const key = `${email}-${ip}`;
  
  const attempts = failedAttempts.get(key) || { count: 0, lastAttempt: Date.now() };
  
  // Reset attempts after 15 minutes
  if (Date.now() - attempts.lastAttempt > 15 * 60 * 1000) {
    attempts.count = 0;
  }
  
  if (attempts.count >= 5) {
    const waitTime = 15 * 60 * 1000 - (Date.now() - attempts.lastAttempt);
    const minutes = Math.ceil(waitTime / 60000);
    
    return res.status(429).json({
      success: false,
      message: `Too many failed attempts. Please try again in ${minutes} minutes.`,
    });
  }
  
  req.loginAttempts = attempts;
  next();
};

// Function to record failed login (use after failed login)
export const recordFailedLogin = (email, ip) => {
  const key = `${email}-${ip}`;
  const attempts = failedAttempts.get(key) || { count: 0, lastAttempt: Date.now() };
  
  attempts.count += 1;
  attempts.lastAttempt = Date.now();
  
  failedAttempts.set(key, attempts);
  
  // Clean up after 15 minutes
  setTimeout(() => {
    if (failedAttempts.get(key) === attempts) {
      failedAttempts.delete(key);
    }
  }, 15 * 60 * 1000);
};

// Function to reset failed attempts (use after successful login)
export const resetFailedAttempts = (email, ip) => {
  const key = `${email}-${ip}`;
  failedAttempts.delete(key);
};

/* ==========================================================
   API KEY AUTHENTICATION (for external services)
========================================================== */

export const apiKeyAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "API key required",
      });
    }
    
    // Validate API key (implement your API key model)
    // const apiKeyDoc = await ApiKey.findOne({ key: apiKey, isActive: true });
    
    // if (!apiKeyDoc) {
    //   return res.status(401).json({
    //     success: false,
    //     message: "Invalid API key",
    //   });
    // }
    
    // req.apiKey = apiKeyDoc;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid API key",
    });
  }
};

/* ==========================================================
   EXPORT ALL MIDDLEWARES
========================================================== */

export default {
  protect,
  admin,
  authorize,
  optionalAuth,
  ownerOrAdmin,
  hasPermission,
  rateLimitByRole,
  verifyRefreshToken,
  loginLimiter,
  recordFailedLogin,
  resetFailedAttempts,
  apiKeyAuth,
};