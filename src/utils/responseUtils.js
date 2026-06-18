// utils/responseUtils.js

import logger from "./logger.js";

// ==========================================================
// STANDARDIZED RESPONSES
// ==========================================================

/**
 * Success response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {string} message - Success message
 * @param {*} data - Response data
 * @param {Object} meta - Additional metadata
 * @returns {Object} Express response
 */
export const successResponse = (res, { statusCode = 200, message = 'Success', data = null, meta = null }) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) response.data = data;
  if (meta !== null) response.meta = meta;

  logger.info(`✅ ${statusCode} - ${message}`);
  return res.status(statusCode).json(response);
};

/**
 * Created response (201)
 * @param {Object} res - Express response object
 * @param {string} message - Success message
 * @param {*} data - Response data
 * @param {Object} meta - Additional metadata
 * @returns {Object} Express response
 */
export const createdResponse = (res, { message = 'Created successfully', data = null, meta = null }) => {
  return successResponse(res, { statusCode: 201, message, data, meta });
};

/**
 * Error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {string} message - Error message
 * @param {*} errors - Additional error details
 * @param {boolean} showStack - Show stack trace (default: false)
 * @returns {Object} Express response
 */
export const errorResponse = (res, { statusCode = 500, message = 'Internal Server Error', errors = null, showStack = false }) => {
  const response = {
    success: false,
    message,
  };

  if (errors !== null) {
    response.errors = errors;
  }

  if (showStack && process.env.NODE_ENV === 'development') {
    response.stack = new Error().stack;
  }

  logger.error(`❌ ${statusCode} - ${message}`);
  return res.status(statusCode).json(response);
};

/**
 * Bad request response (400)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {*} errors - Additional error details
 * @returns {Object} Express response
 */
export const badRequestResponse = (res, { message = 'Bad Request', errors = null }) => {
  return errorResponse(res, { statusCode: 400, message, errors });
};

/**
 * Unauthorized response (401)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {*} errors - Additional error details
 * @returns {Object} Express response
 */
export const unauthorizedResponse = (res, { message = 'Unauthorized', errors = null }) => {
  return errorResponse(res, { statusCode: 401, message, errors });
};

/**
 * Forbidden response (403)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {*} errors - Additional error details
 * @returns {Object} Express response
 */
export const forbiddenResponse = (res, { message = 'Forbidden', errors = null }) => {
  return errorResponse(res, { statusCode: 403, message, errors });
};

/**
 * Not found response (404)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {*} errors - Additional error details
 * @returns {Object} Express response
 */
export const notFoundResponse = (res, { message = 'Not Found', errors = null }) => {
  return errorResponse(res, { statusCode: 404, message, errors });
};

/**
 * Conflict response (409)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {*} errors - Additional error details
 * @returns {Object} Express response
 */
export const conflictResponse = (res, { message = 'Conflict', errors = null }) => {
  return errorResponse(res, { statusCode: 409, message, errors });
};

/**
 * Validation error response (422)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {*} errors - Validation errors
 * @returns {Object} Express response
 */
export const validationErrorResponse = (res, { message = 'Validation Error', errors = null }) => {
  return errorResponse(res, { statusCode: 422, message, errors });
};

/**
 * Too many requests response (429)
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {*} errors - Additional error details
 * @returns {Object} Express response
 */
export const tooManyRequestsResponse = (res, { message = 'Too Many Requests', errors = null }) => {
  return errorResponse(res, { statusCode: 429, message, errors });
};