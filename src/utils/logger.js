// utils/logger.js

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================================
// LOGGER CONFIGURATION
// ==========================================================

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level.toUpperCase()}]: ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta) : ''
    }`;
  })
);

// Vercel (and most serverless platforms) ship a read-only filesystem —
// only /tmp is writable, and it doesn't persist between invocations anyway.
// Writing to ./logs there throws synchronously at import time and crashes
// the whole function. Detect that environment and skip file transports.
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }),
];

if (!isServerless) {
  transports.push(
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
});

// ==========================================================
// CUSTOM LOGGERS
// ==========================================================

/**
 * Log API request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {number} duration - Request duration in ms
 */
export const logApiRequest = (req, res, duration) => {
  const { method, originalUrl, ip } = req;
  const { statusCode } = res;
  const user = req.user?.email || 'anonymous';

  logger.info(`📡 ${method} ${originalUrl} - ${statusCode} - ${duration}ms - ${user} - ${ip}`);
};

/**
 * Log database operation
 * @param {string} operation - Operation name
 * @param {string} collection - Collection name
 * @param {Object} details - Additional details
 */
export const logDbOperation = (operation, collection, details = {}) => {
  logger.info(`🗄️ ${operation} - ${collection}`, details);
};

/**
 * Log authentication event
 * @param {string} event - Event type (login, logout, register)
 * @param {string} email - User email
 * @param {Object} details - Additional details
 */
export const logAuth = (event, email, details = {}) => {
  logger.info(`🔐 ${event} - ${email}`, details);
};

export default logger;