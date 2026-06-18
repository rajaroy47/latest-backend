// utils/dateUtils.js

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(timezone);

// ==========================================================
// DATE FORMATTING
// ==========================================================

/**
 * Format date
 * @param {Date|string} date - Date to format
 * @param {string} format - Format string (default: 'YYYY-MM-DD HH:mm:ss')
 * @param {string} timezone - Timezone (default: 'Asia/Kolkata')
 * @returns {string} Formatted date
 */
export const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss', timezone = 'Asia/Kolkata') => {
  if (!date) return null;
  return dayjs(date).tz(timezone).format(format);
};

/**
 * Format date to ISO string
 * @param {Date|string} date - Date to format
 * @returns {string} ISO date string
 */
export const toISOString = (date) => {
  if (!date) return null;
  return dayjs(date).toISOString();
};

/**
 * Format date as relative time (e.g., "2 days ago")
 * @param {Date|string} date - Date to format
 * @returns {string} Relative time string
 */
export const getRelativeTime = (date) => {
  if (!date) return null;
  return dayjs(date).fromNow();
};

/**
 * Get date difference
 * @param {Date|string} date1 - First date
 * @param {Date|string} date2 - Second date (default: now)
 * @param {string} unit - Unit of time (default: 'day')
 * @returns {number} Difference
 */
export const getDateDiff = (date1, date2 = new Date(), unit = 'day') => {
  if (!date1) return null;
  return dayjs(date2).diff(dayjs(date1), unit);
};

/**
 * Check if date is in the past
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if in the past
 */
export const isPastDate = (date) => {
  if (!date) return false;
  return dayjs(date).isBefore(dayjs());
};

/**
 * Check if date is in the future
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if in the future
 */
export const isFutureDate = (date) => {
  if (!date) return false;
  return dayjs(date).isAfter(dayjs());
};

/**
 * Check if date is today
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if today
 */
export const isToday = (date) => {
  if (!date) return false;
  return dayjs(date).isSame(dayjs(), 'day');
};

/**
 * Add time to date
 * @param {Date|string} date - Base date
 * @param {number} amount - Amount to add
 * @param {string} unit - Unit of time (default: 'day')
 * @returns {string} New date
 */
export const addTime = (date, amount, unit = 'day') => {
  if (!date) return null;
  return dayjs(date).add(amount, unit).toISOString();
};

/**
 * Subtract time from date
 * @param {Date|string} date - Base date
 * @param {number} amount - Amount to subtract
 * @param {string} unit - Unit of time (default: 'day')
 * @returns {string} New date
 */
export const subtractTime = (date, amount, unit = 'day') => {
  if (!date) return null;
  return dayjs(date).subtract(amount, unit).toISOString();
};

/**
 * Get start of day
 * @param {Date|string} date - Date
 * @param {string} timezone - Timezone
 * @returns {string} Start of day
 */
export const getStartOfDay = (date, timezone = 'Asia/Kolkata') => {
  if (!date) return null;
  return dayjs(date).tz(timezone).startOf('day').toISOString();
};

/**
 * Get end of day
 * @param {Date|string} date - Date
 * @param {string} timezone - Timezone
 * @returns {string} End of day
 */
export const getEndOfDay = (date, timezone = 'Asia/Kolkata') => {
  if (!date) return null;
  return dayjs(date).tz(timezone).endOf('day').toISOString();
};