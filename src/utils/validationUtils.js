// utils/validationUtils.js

import validator from 'validator';

// ==========================================================
// COMMON VALIDATORS
// ==========================================================

/**
 * Validate email
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
export const isValidEmail = (email) => {
  return validator.isEmail(email);
};

/**
 * Validate phone number
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid
 */
export const isValidPhone = (phone) => {
  return validator.isMobilePhone(phone);
};

/**
 * Validate PAN card
 * @param {string} pan - PAN card number
 * @returns {boolean} True if valid
 */
export const isValidPAN = (pan) => {
  return /[A-Z]{5}[0-9]{4}[A-Z]{1}/.test(pan);
};

/**
 * Validate Aadhaar
 * @param {string} aadhaar - Aadhaar number
 * @returns {boolean} True if valid
 */
export const isValidAadhaar = (aadhaar) => {
  return /^\d{12}$/.test(aadhaar);
};

/**
 * Validate GST number
 * @param {string} gst - GST number
 * @returns {boolean} True if valid
 */
export const isValidGST = (gst) => {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gst);
};

/**
 * Validate PIN code
 * @param {string} pincode - PIN code
 * @returns {boolean} True if valid
 */
export const isValidPincode = (pincode) => {
  return /^\d{6}$/.test(pincode);
};

/**
 * Validate URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid
 */
export const isValidUrl = (url) => {
  return validator.isURL(url);
};

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {Object} { valid, errors }
 */
export const validatePassword = (password) => {
  const errors = [];

  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  if (password && password.length > 100) {
    errors.push('Password must be less than 100 characters');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate required fields
 * @param {Object} data - Data object
 * @param {string[]} fields - Required field names
 * @returns {Object} { valid, missing }
 */
export const validateRequired = (data, fields) => {
  const missing = [];
  for (const field of fields) {
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      missing.push(field);
    }
  }
  return {
    valid: missing.length === 0,
    missing,
  };
};

/**
 * Sanitize string
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeString = (str) => {
  return validator.escape(str.trim());
};

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @returns {Object} Sanitized object
 */
export const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};