// utils/fileUtils.js

import fs from 'fs/promises';
import path from 'path';
import mime from 'mime-types';
import logger from './logger.js';

// ==========================================================
// FILE OPERATIONS
// ==========================================================

/**
 * Check if file exists
 * @param {string} filePath - File path
 * @returns {Promise<boolean>} True if exists
 */
export const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Get file info
 * @param {string} filePath - File path
 * @returns {Promise<Object>} File info
 */
export const getFileInfo = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      path: filePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
    };
  } catch (error) {
    logger.error(`❌ File info error: ${filePath}`, error);
    throw error;
  }
};

/**
 * Delete file
 * @param {string} filePath - File path
 * @returns {Promise<boolean>} True if deleted
 */
export const deleteFile = async (filePath) => {
  try {
    if (await fileExists(filePath)) {
      await fs.unlink(filePath);
      logger.info(`✅ File deleted: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    logger.error(`❌ File delete error: ${filePath}`, error);
    throw error;
  }
};

/**
 * Get file extension
 * @param {string} filename - File name
 * @returns {string} File extension
 */
export const getFileExtension = (filename) => {
  return path.extname(filename).toLowerCase();
};

/**
 * Get file name without extension
 * @param {string} filename - File name
 * @returns {string} File name without extension
 */
export const getFileNameWithoutExtension = (filename) => {
  return path.basename(filename, path.extname(filename));
};

/**
 * Get mime type from file
 * @param {string} filename - File name
 * @returns {string} Mime type
 */
export const getMimeType = (filename) => {
  return mime.lookup(filename) || 'application/octet-stream';
};

/**
 * Check if file is an image
 * @param {string} filename - File name
 * @returns {boolean} True if image
 */
export const isImage = (filename) => {
  const extension = getFileExtension(filename);
  return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(extension);
};

/**
 * Check if file is a PDF
 * @param {string} filename - File name
 * @returns {boolean} True if PDF
 */
export const isPDF = (filename) => {
  const extension = getFileExtension(filename);
  return extension === '.pdf';
};

/**
 * Check if file size is within limit
 * @param {number} size - File size in bytes
 * @param {number} limit - Size limit in bytes (default: 5MB)
 * @returns {boolean} True if within limit
 */
export const isWithinSizeLimit = (size, limit = 5 * 1024 * 1024) => {
  return size <= limit;
};

/**
 * Format file size
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};