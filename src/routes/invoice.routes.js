// routes/invoiceRoutes.js

import express from "express";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import {
  generateInvoiceFromPayment,
  getInvoiceById,
  getMyInvoices,
  getAllInvoices,
  downloadInvoicePDF,
  previewInvoice,
  sendInvoiceEmail,
  updateInvoiceStatus,
  markInvoiceAsPaid,
  getInvoiceStats,
  deleteInvoice,
  bulkGenerateInvoices,
} from "../controllers/invoice.controller.js";

const router = express.Router();

// ==========================================================
// ALL INVOICE ROUTES (Authentication Required)
// ==========================================================
router.use(protect);

// ==========================================================
// USER INVOICE ROUTES
// ==========================================================

// Get my invoices
router.get("/my-invoices", getMyInvoices);

// Get invoice by ID
router.get("/:id", getInvoiceById);

// Download invoice PDF
router.get("/:id/download", downloadInvoicePDF);

// Preview invoice in browser
router.get("/:id/preview", previewInvoice);

// Send invoice email
router.post("/:id/send-email", sendInvoiceEmail);

// ==========================================================
// ADMIN INVOICE ROUTES
// ==========================================================

// Generate invoice from payment
router.post(
  "/generate/:paymentId",
  authorize("admin"),
  generateInvoiceFromPayment
);

// Get all invoices
router.get(
  "/admin/all",
  authorize("admin"),
  getAllInvoices
);

// Update invoice status
router.put(
  "/admin/:id/status",
  authorize("admin"),
  updateInvoiceStatus
);

// Mark invoice as paid
router.put(
  "/admin/:id/mark-paid",
  authorize("admin"),
  markInvoiceAsPaid
);

// Get invoice statistics
router.get(
  "/admin/stats",
  authorize("admin"),
  getInvoiceStats
);

// Bulk generate invoices
router.post(
  "/admin/bulk-generate",
  authorize("admin"),
  bulkGenerateInvoices
);

// Delete invoice
router.delete(
  "/admin/:id",
  authorize("admin"),
  deleteInvoice
);

export default router;