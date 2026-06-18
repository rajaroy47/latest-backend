// utils/stringUtils.js

import slugify from 'slugify';

// ==========================================================
// STRING MANIPULATION
// ==========================================================

/**
 * Truncate string
 * @param {string} str - String to truncate
 * @param {number} length - Max length (default: 100)
 * @param {string} suffix - Suffix (default: '...')
 * @returns {string} Truncated string
 */
export const truncate = (str, length = 100, suffix = '...') => {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.substring(0, length) + suffix;
};

/**
 * Capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Capitalize each word
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export const capitalizeWords = (str) => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map(word => capitalize(word))
    .join(' ');
};

/**
 * Convert to slug
 * @param {string} str - String to slugify
 * @param {Object} options - Slugify options
 * @returns {string} Slug
 */
export const createSlug = (str, options = {}) => {
  if (!str) return '';
  return slugify(str, {
    lower: true,
    strict: true,
    trim: true,
    ...options,
  });
};

/**
 * Extract initials from name
 * @param {string} name - Full name
 * @param {number} max - Max initials (default: 2)
 * @returns {string} Initials
 */
export const getInitials = (name, max = 2) => {
  if (!name) return '';
  const words = name.trim().split(' ');
  const initials = words
    .slice(0, max)
    .map(word => word.charAt(0).toUpperCase())
    .join('');
  return initials;
};

/**
 * Mask sensitive data
 * @param {string} str - String to mask
 * @param {number} visibleChars - Visible characters at start (default: 4)
 * @param {string} maskChar - Mask character (default: '*')
 * @returns {string} Masked string
 */
export const maskString = (str, visibleChars = 4, maskChar = '*') => {
  if (!str) return '';
  if (str.length <= visibleChars) return str;
  const visible = str.slice(0, visibleChars);
  const masked = maskChar.repeat(str.length - visibleChars);
  return visible + masked;
};

/**
 * Generate random string
 * @param {number} length - String length (default: 8)
 * @param {string} chars - Characters to use (default: alphanumeric)
 * @returns {string} Random string
 */
export const randomString = (length = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') => {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * HTML escape
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export const escapeHtml = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * HTML unescape
 * @param {string} str - String to unescape
 * @returns {string} Unescaped string
 */
export const unescapeHtml = (str) => {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
};

/**
 * Clean string (remove extra spaces, trim)
 * @param {string} str - String to clean
 * @returns {string} Cleaned string
 */
export const cleanString = (str) => {
  if (!str) return '';
  return str.trim().replace(/\s+/g, ' ');
};

/**
 * Extract keywords from text
 * @param {string} text - Text to extract keywords from
 * @param {number} limit - Max keywords (default: 10)
 * @returns {string[]} Array of keywords
 */
export const extractKeywords = (text, limit = 10) => {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/);
  const wordCount = {};
  for (const word of words) {
    if (word.length < 3) continue;
    wordCount[word] = (wordCount[word] || 0) + 1;
  }
  return Object.keys(wordCount)
    .sort((a, b) => wordCount[b] - wordCount[a])
    .slice(0, limit);
};