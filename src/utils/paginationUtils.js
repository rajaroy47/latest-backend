// utils/paginationUtils.js

import logger from "./logger.js";

// ==========================================================
// PAGINATION HELPERS
// ==========================================================

/**
 * Get pagination options from query
 * @param {Object} query - Express query object
 * @param {number} defaultLimit - Default items per page
 * @param {number} maxLimit - Maximum items per page
 * @returns {Object} { page, limit, skip, sort }
 */
export const getPaginationOptions = (query, defaultLimit = 10, maxLimit = 100) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  let limit = Math.min(parseInt(query.limit) || defaultLimit, maxLimit);
  const skip = (page - 1) * limit;

  const sortField = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;
  const sort = { [sortField]: sortOrder };

  logger.info(`📄 Pagination: page=${page}, limit=${limit}, skip=${skip}, sort=${sortField}:${sortOrder}`);

  return { page, limit, skip, sort };
};

/**
 * Get pagination metadata
 * @param {number} total - Total items count
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
export const getPaginationMeta = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
    nextPage: hasNext ? page + 1 : null,
    prevPage: hasPrev ? page - 1 : null,
  };
};

/**
 * Get paginated response
 * @param {Object} res - Express response object
 * @param {Array} data - Data array
 * @param {number} total - Total items count
 * @param {Object} options - Pagination options
 * @param {Object} extra - Extra data to include
 * @returns {Object} Paginated response
 */
export const getPaginatedResponse = (res, data, total, options, extra = {}) => {
  const { page, limit } = options;
  const meta = getPaginationMeta(total, page, limit);

  const response = {
    success: true,
    data,
    pagination: meta,
    ...extra,
  };

  return res.status(200).json(response);
};