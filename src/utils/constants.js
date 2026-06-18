// utils/constants.js

// ==========================================================
// APP CONSTANTS
// ==========================================================

export const APP_NAME = process.env.APP_NAME || 'CFI';
export const APP_ENV = process.env.NODE_ENV || 'development';
export const APP_PORT = process.env.PORT || 5000;

// ==========================================================
// USER ROLES
// ==========================================================

export const USER_ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  EDITOR: 'editor',
  VIEWER: 'viewer',
};

// ==========================================================
// SERVICE CONSTANTS
// ==========================================================

export const SERVICE_CATEGORIES = [
  'Statutory Compliance',
  'Intellectual Property',
  'Business Registration',
  'Tax Services',
  'Legal Services',
  'Financial Services',
];

export const SECTION_TYPES = [
  'richtext',
  'accordion',
  'timeline',
  'grid',
  'list',
  'table',
  'callout',
  'cta-block',
  'comparison',
  'statistics',
  'testimonial',
  'checklist',
  'faq',
  'video',
];

// ==========================================================
// HTTP STATUS CODES
// ==========================================================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
};

// ==========================================================
// RESPONSE MESSAGES
// ==========================================================

export const RESPONSE_MESSAGES = {
  // Success
  SUCCESS: 'Success',
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',

  // Auth
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  REGISTER_SUCCESS: 'Registration successful',
  VERIFICATION_SENT: 'Verification email sent',
  PASSWORD_RESET_SENT: 'Password reset email sent',
  PASSWORD_RESET_SUCCESS: 'Password reset successful',

  // Errors
  BAD_REQUEST: 'Bad request',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Resource conflict',
  VALIDATION_ERROR: 'Validation error',
  INTERNAL_ERROR: 'Internal server error',
  TOO_MANY_REQUESTS: 'Too many requests',
};

// ==========================================================
// REGEX PATTERNS
// ==========================================================

export const REGEX_PATTERNS = {
  EMAIL: /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
  PHONE: /^\+?[1-9]\d{1,14}$/,
  PAN: /[A-Z]{5}[0-9]{4}[A-Z]{1}/,
  AADHAAR: /^\d{12}$/,
  GST: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
  PINCODE: /^\d{6}$/,
  URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
};