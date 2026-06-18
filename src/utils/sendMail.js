// utils/sendMail.js

import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();
import logger from "./logger.js";


// ==========================================================
// EMAIL TEMPLATES
// ==========================================================

const templates = {
  welcome: (data) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; padding: 20px; margin: 0; }
        .container { max-width: 600px; margin: auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 28px; font-weight: bold; color: #2563eb; }
        .button { display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">CFI</div>
        </div>
        <h2>Welcome ${data.name}! 👋</h2>
        <p>Thank you for registering with CFI. We're excited to have you on board!</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${data.verifyUrl || '#'}" class="button">Verify Email</a>
        </p>
        <p>If you have any questions, feel free to reply to this email.</p>
        <div class="footer">
          <p>© ${new Date().getFullYear()} CFI. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  passwordReset: (data) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; padding: 20px; margin: 0; }
        .container { max-width: 600px; margin: auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .button { display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
        .warning { color: #dc2626; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Password Reset Request 🔐</h2>
        <p>Hello ${data.name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${data.resetUrl}" class="button">Reset Password</a>
        </p>
        <p class="warning">⏰ This link will expire in ${data.expiryTime || '10 minutes'}.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <div class="footer">
          <p>© ${new Date().getFullYear()} CFI. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,

  verification: (data) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; padding: 20px; margin: 0; }
        .container { max-width: 600px; margin: auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .button { display: inline-block; padding: 12px 30px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
        .footer { margin-top: 30px; text-align: center; color: #94a3b8; font-size: 14px; border-top: 1px solid #e2e8f0; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Verify Your Email 📧</h2>
        <p>Hello ${data.name},</p>
        <p>Please verify your email address to complete your registration:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${data.verifyUrl}" class="button">Verify Email</a>
        </p>
        <p>⏰ This link will expire in ${data.expiryTime || '24 hours'}.</p>
        <div class="footer">
          <p>© ${new Date().getFullYear()} CFI. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,
};

// ==========================================================
// TRANSPORTER SETUP - WITH BETTER ERROR HANDLING
// ==========================================================

// Get SMTP configuration with fallbacks
const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === "true";
  const user = process.env.SMTP_EMAIL;
  const pass = process.env.SMTP_PASSWORD;

  // Validate required config
  if (!user || !pass) {
    logger.warn("⚠️ SMTP credentials not configured. Email sending will be disabled.");
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === "production",
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  };
};

// Create transporter
let transporter = null;
let isSmtpReady = false;

const createTransporter = () => {
  const config = getSmtpConfig();
  if (!config) return null;

  try {
    return nodemailer.createTransport(config);
  } catch (error) {
    logger.error("❌ Failed to create SMTP transporter:", error.message);
    return null;
  }
};

// Initialize transporter
transporter = createTransporter();

// Verify SMTP connection (with retry)
const verifySmtpConnection = async (retries = 3, delay = 2000) => {
  if (!transporter) {
    logger.warn("⚠️ SMTP transporter not available. Skipping verification.");
    return false;
  }

  for (let i = 0; i < retries; i++) {
    try {
      await transporter.verify();
      isSmtpReady = true;
      logger.info("✅ SMTP Server Ready");
      return true;
    } catch (error) {
      logger.warn(`⚠️ SMTP verification attempt ${i + 1}/${retries} failed:`, error.message);
      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  logger.error("❌ SMTP verification failed after all retries. Email sending may not work.");
  isSmtpReady = false;
  return false;
};

// Run verification (don't block server startup)
setTimeout(() => {
  verifySmtpConnection();
}, 1000);

// ==========================================================
// SEND EMAIL FUNCTION
// ==========================================================

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.template - Template name (welcome, passwordReset, verification)
 * @param {Object} options.data - Template data
 * @param {string} options.text - Plain text content (fallback)
 * @returns {Promise<Object>} Nodemailer info
 */
export const sendMail = async ({ to, subject, html, template, data, text }) => {
  try {
    // Check if SMTP is configured
    if (!transporter) {
      logger.error("❌ SMTP transporter not configured. Email not sent.");
      throw new Error("SMTP not configured. Please check your environment variables.");
    }

    // Check if SMTP is ready
    if (!isSmtpReady) {
      logger.warn("⚠️ SMTP not verified. Attempting to send anyway...");
      // Try to verify again
      await verifySmtpConnection(1, 1000);
    }

    let emailHtml = html;

    // If template is provided, use it
    if (template && templates[template]) {
      emailHtml = templates[template](data || {});
    }

    // If no HTML provided but text is, use text
    if (!emailHtml && text) {
      emailHtml = text;
    }

    // If still no content, throw error
    if (!emailHtml) {
      throw new Error("No email content provided. Please provide html, text, or template.");
    }

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'CFI'}" <${process.env.SMTP_EMAIL}>`,
      to,
      subject,
      html: emailHtml,
      text: text || undefined,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info(`✅ Email sent to ${to}: ${info.messageId}`);
    return info;
  } catch (error) {
    logger.error("❌ Email sending failed:", error.message);
    throw error;
  }
};

/**
 * Send welcome email to new user
 * @param {string} to - Recipient email
 * @param {string} name - User name
 * @param {string} verifyUrl - Verification URL
 * @returns {Promise<Object>} Nodemailer info
 */
export const sendWelcomeEmail = async (to, name, verifyUrl) => {
  return sendMail({
    to,
    subject: "Welcome to CFI! 🎉",
    template: "welcome",
    data: { name, verifyUrl },
  });
};

/**
 * Send password reset email
 * @param {string} to - Recipient email
 * @param {string} name - User name
 * @param {string} resetUrl - Reset URL
 * @param {string} expiryTime - Expiry time
 * @returns {Promise<Object>} Nodemailer info
 */
export const sendPasswordResetEmail = async (to, name, resetUrl, expiryTime = "10 minutes") => {
  return sendMail({
    to,
    subject: "Password Reset Request 🔐",
    template: "passwordReset",
    data: { name, resetUrl, expiryTime },
  });
};

/**
 * Send verification email
 * @param {string} to - Recipient email
 * @param {string} name - User name
 * @param {string} verifyUrl - Verification URL
 * @param {string} expiryTime - Expiry time
 * @returns {Promise<Object>} Nodemailer info
 */
export const sendVerificationEmail = async (to, name, verifyUrl, expiryTime = "24 hours") => {
  return sendMail({
    to,
    subject: "Verify Your Email 📧",
    template: "verification",
    data: { name, verifyUrl, expiryTime },
  });
};

/**
 * Check if SMTP is configured and ready
 * @returns {boolean} True if SMTP is ready
 */
export const isSmtpConfigured = () => {
  return !!transporter && isSmtpReady;
};

/**
 * Get SMTP status
 * @returns {Object} SMTP status
 */
export const getSmtpStatus = () => {
  return {
    configured: !!transporter,
    ready: isSmtpReady,
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_EMAIL ? "configured" : "missing",
    fromName: process.env.SMTP_FROM_NAME || "CFI",
  };
};

export default {
  sendMail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVerificationEmail,
  isSmtpConfigured,
  getSmtpStatus,
};