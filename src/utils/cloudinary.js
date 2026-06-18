// utils/cloudinary.js

import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { Readable } from "stream";
import logger from "./logger.js";

// ==========================================================
// CLOUDINARY CONFIGURATION
// ==========================================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ==========================================================
// MULTER SETUP
// ==========================================================

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
  const extname = allowedTypes.test(file.mimetype);
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error("Only image files (jpeg, jpg, png, gif, webp, svg) are allowed"), false);
};

export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// ==========================================================
// MULTER CONFIGURATIONS FOR DIFFERENT USE CASES
// ==========================================================

// For single avatar upload
export const uploadAvatar = upload.single("avatar");

// For service images (multiple fields)
export const uploadServiceImages = upload.fields([
  { name: "thumbnailImage", maxCount: 1 },
  { name: "serviceImage", maxCount: 1 },
  { name: "sideImage", maxCount: 1 },
  { name: "hero.backgroundImage", maxCount: 1 },
  { name: "seo.ogImage", maxCount: 1 },
]);

// For single image upload
export const uploadSingleImage = upload.single("image");

// For multiple images
export const uploadMultipleImages = upload.array("images", 10);

// ==========================================================
// CLOUDINARY OPERATIONS
// ==========================================================

/**
 * Upload buffer to Cloudinary
 * @param {Buffer} buffer - File buffer
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
const uploadBufferToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "uploads",
        transformation: options.transformation || [],
        ...options,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );

    const readableStream = new Readable();
    readableStream.push(buffer);
    readableStream.push(null);
    readableStream.pipe(uploadStream);
  });
};

/**
 * Upload file to Cloudinary
 * @param {Object} file - Multer file object
 * @param {Object} options - Upload options
 * @returns {Promise<Object>} Cloudinary upload result
 */
export const uploadToCloudinary = async (file, options = {}) => {
  try {
    if (!file || !file.buffer) {
      throw new Error("No file buffer provided");
    }

    const result = await uploadBufferToCloudinary(file.buffer, {
      folder: options.folder || "uploads",
      transformation: options.transformation || [],
      ...options,
    });

    logger.info(`✅ File uploaded to Cloudinary: ${result.public_id}`);
    return result;
  } catch (error) {
    logger.error("❌ Cloudinary upload error:", error);
    throw error;
  }
};

/**
 * Delete file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Cloudinary delete result
 */
export const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      throw new Error("Public ID is required");
    }

    const result = await cloudinary.uploader.destroy(publicId);
    logger.info(`✅ File deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    logger.error("❌ Cloudinary delete error:", error);
    throw error;
  }
};

/**
 * Delete multiple files from Cloudinary
 * @param {string[]} publicIds - Array of Cloudinary public IDs
 * @returns {Promise<Object[]>} Array of delete results
 */
export const deleteMultipleFromCloudinary = async (publicIds) => {
  try {
    if (!publicIds || publicIds.length === 0) {
      throw new Error("Public IDs are required");
    }

    const results = await Promise.all(
      publicIds.map((publicId) => cloudinary.uploader.destroy(publicId))
    );

    logger.info(`✅ ${results.length} files deleted from Cloudinary`);
    return results;
  } catch (error) {
    logger.error("❌ Cloudinary batch delete error:", error);
    throw error;
  }
};

/**
 * Extract public ID from Cloudinary URL
 * @param {string} url - Cloudinary URL
 * @returns {string|null} Public ID or null
 */
export const extractPublicIdFromUrl = (url) => {
  if (!url) return null;

  const patterns = [
    /\/upload\/v\d+\/(.+)\.(jpg|jpeg|png|gif|webp|svg)/i,
    /\/upload\/(?:v\d+\/)?(.+)\.(jpg|jpeg|png|gif|webp|svg)/i,
    /\/upload\/(?:v\d+\/)?(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
};

/**
 * Extract all public IDs from array of URLs
 * @param {string[]} urls - Array of Cloudinary URLs
 * @returns {string[]} Array of public IDs
 */
export const extractPublicIdsFromUrls = (urls) => {
  if (!urls || !Array.isArray(urls)) return [];
  return urls.map(url => extractPublicIdFromUrl(url)).filter(Boolean);
};

/**
 * Get Cloudinary image URL with transformations
 * @param {string} publicId - Cloudinary public ID
 * @param {Object} options - Transformation options
 * @returns {string} Transformed URL
 */
export const getCloudinaryUrl = (publicId, options = {}) => {
  if (!publicId) return null;

  const { width, height, crop = "limit", quality = "auto", format = "auto" } = options;

  let url = cloudinary.url(publicId, {
    transformation: [
      { width, height, crop },
      { quality, fetch_format: format },
    ],
  });

  return url;
};

export default cloudinary;