// controllers/invoice.controller.js

import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import htmlPdf from 'html-pdf';
import Invoice from "../models/invoice.model.js";
import Order from "../models/order.model.js";
import Payment from "../models/payment.model.js";
import Service from "../models/service.model.js";
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  badRequestResponse,
  forbiddenResponse,
  logger,
  getPaginationOptions,
  getPaginatedResponse,
} from "../utils/index.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==========================================================
// ✅ HELPER: Get User ID from Token
// ==========================================================

const getUserIdFromToken = async (token) => {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET);
    return decoded.id || decoded.userId;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
};

// ==========================================================
// ✅ HELPER: Generate Invoice HTML
// ==========================================================

// controllers/invoice.controller.js - Updated generateInvoiceHTML function


// controllers/invoice.controller.js - Updated generateInvoiceHTML function

const generateInvoiceHTML = (invoice) => {
  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoiceNumber}</title>
  <style>
    /* ==========================================================
       PAGE SETUP - true A4, no overflow / no dead space
    ========================================================== */
    @page {
      size: A4;
      margin: 0;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      background: #eef1f6;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1e293b;
      font-size: 11.5px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    /* A4 = 210mm x 297mm. Container is fixed to that size,
       content is sized/spaced to comfortably fill it without
       leaving a big dead zone or overflowing to a 2nd page. */
    .page-wrap {
      width: 210mm;
      margin: 0 auto;
      padding: 24px 0;
    }

    .invoice-container {
      width: 210mm;
      min-height: 297mm;
      background: #ffffff;
      padding: 16mm 16mm 14mm;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06), 0 12px 32px rgba(15, 23, 42, 0.08);
      position: relative;
      overflow: hidden;
    }

    .accent-bar {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 6px;
      background: linear-gradient(90deg, #3b82f6, #6366f1);
    }

    .text-right { text-align: right; }

    /* ==========================================================
       HEADER
    ========================================================== */
    .invoice-header {
      display: flex;
      flex-wrap: nowrap;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 32px;
    }

    .logo-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .logo-text h1 {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
      color: #0f172a;
    }

    .logo-text h1 span {
      color: #3b82f6;
      font-weight: 500;
    }

    .logo-text .tagline {
      font-size: 9px;
      color: #64748b;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      font-weight: 600;
    }

    .invoice-meta {
      text-align: right;
      flex-shrink: 0;
    }

    .invoice-meta .meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      font-weight: 600;
    }

    .invoice-meta .number {
      font-size: 19px;
      font-weight: 700;
      color: #0f172a;
      margin: 3px 0 8px;
      white-space: nowrap;
    }

    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
    }

    .status-badge.unpaid {
      background: #fef2f2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }

    .status-badge.pending {
      background: #fffbeb;
      color: #92400e;
      border: 1px solid #fde68a;
    }

    /* ==========================================================
       ADDRESS / DETAILS GRID
    ========================================================== */
    .address-grid {
      display: grid;
      grid-template-columns: 0.85fr 1.15fr 1.15fr;
      gap: 24px;
      margin-bottom: 32px;
      padding-bottom: 22px;
      border-bottom: 1px solid #e2e8f0;
    }

    .address-block h4 {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .address-block p {
      color: #475569;
      line-height: 1.55;
      word-break: break-word;
    }

    .address-block .name {
      font-weight: 600;
      font-size: 12.5px;
      color: #0f172a;
      margin-bottom: 2px;
    }

    .address-block .detail {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 4px;
    }

    /* ==========================================================
       TABLE
    ========================================================== */
    .section-title {
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      font-weight: 700;
      margin-bottom: 10px;
    }

    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 28px;
    }

    .invoice-table thead th {
      padding: 9px 10px;
      text-align: left;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      font-weight: 700;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
    }

    .invoice-table thead th:first-child { border-radius: 6px 0 0 6px; padding-left: 14px; }
    .invoice-table thead th:last-child { border-radius: 0 6px 6px 0; padding-right: 14px; }

    .invoice-table tbody td {
      padding: 16px 10px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
      vertical-align: top;
    }

    .invoice-table tbody td:first-child { padding-left: 14px; }
    .invoice-table tbody td:last-child { padding-right: 14px; }

    .invoice-table .service-name {
      font-weight: 600;
      font-size: 12.5px;
      color: #0f172a;
    }

    .invoice-table .service-desc {
      font-size: 10.5px;
      color: #64748b;
      margin-top: 4px;
      max-width: 340px;
      line-height: 1.5;
    }

    .plan-badge {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 600;
      text-transform: capitalize;
      background: #eff6ff;
      color: #2563eb;
    }

    /* ==========================================================
       TOTALS & PAYMENT INFO
    ========================================================== */
    .summary-wrapper {
      display: flex;
      flex-wrap: nowrap;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      margin-bottom: 32px;
      page-break-inside: avoid;
    }

    .payment-info {
      display: flex;
      flex-direction: column;
      gap: 10px;
      width: 48%;
      flex-shrink: 0;
    }

    .info-card {
      background: #f8fafc;
      border-radius: 8px;
      padding: 14px 16px;
      border: 1px solid #eef2f7;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .info-item .label {
      font-size: 8.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #94a3b8;
      font-weight: 700;
      margin-bottom: 3px;
    }

    .info-item .value {
      font-weight: 600;
      color: #334155;
      font-size: 10.5px;
      word-break: break-word;
    }

    .total-box {
      width: 260px;
      flex-shrink: 0;
      margin-left: auto;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 11.5px;
      color: #475569;
    }

    .total-row .label { color: #64748b; }
    .total-row .amount { font-weight: 500; color: #0f172a; }

    .total-row.subtotal {
      border-bottom: 1px dashed #e2e8f0;
      padding-bottom: 9px;
      margin-bottom: 3px;
    }

    .total-row.discount .amount { color: #ef4444; }

    .total-row.grand-total {
      font-size: 13px;
      padding-top: 12px;
      margin-top: 6px;
      border-top: 1.5px solid #0f172a;
    }

    .total-row.grand-total .label {
      font-weight: 700;
      color: #0f172a;
    }

    .total-row.grand-total .amount {
      font-weight: 700;
      color: #166534;
      font-size: 16px;
    }

    /* ==========================================================
       NOTES
    ========================================================== */
    .notes-section {
      background: #f8fafc;
      border-radius: 6px;
      padding: 12px 16px;
      border-left: 3px solid #3b82f6;
    }

    .notes-section .notes-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      font-weight: 700;
      margin-bottom: 4px;
    }

    .notes-section p {
      color: #475569;
      font-size: 10.5px;
      line-height: 1.55;
    }

    /* spacer pushes footer to the bottom of the page without
       leaving a huge visible gap when content is short */
    .flex-spacer { flex: 1 1 auto; min-height: 16px; }

    /* ==========================================================
       FOOTER
    ========================================================== */
    .invoice-footer {
      margin-top: 8px;
      padding-top: 18px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
    }

    .invoice-footer .footer-brand {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }

    .invoice-footer .footer-brand span { color: #3b82f6; }

    .invoice-footer .footer-terms {
      margin-top: 4px;
      font-size: 9.5px;
      color: #94a3b8;
    }

    .invoice-footer .footer-contact {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 18px;
      margin-top: 10px;
      font-size: 10.5px;
      color: #64748b;
    }

    .invoice-footer .footer-contact span {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }

    /* ==========================================================
       PRINT OVERRIDES
    ========================================================== */
    @media print {
      html, body { background: #ffffff; }

      .page-wrap { width: auto; padding: 0; margin: 0; }

      .invoice-container {
        box-shadow: none;
        width: 100%;
        min-height: 100vh;
      }

      .invoice-table thead th {
        background: #f8fafc !important;
      }

      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
  </style>
</head>
<body>
  <div class="page-wrap">
    <div class="invoice-container">
      <div class="accent-bar"></div>

      <header class="invoice-header">
        <div class="logo-section">
          <div class="logo-text">
            <h1>CFI <span>V2.0</span></h1>
            <div class="tagline">Corporate Financial Solutions</div>
          </div>
        </div>
        <div class="invoice-meta">
          <div class="meta-label">Invoice</div>
          <div class="number">${invoice.invoiceNumber}</div>
          <div class="status-badge ${invoice.paymentStatus}">${invoice.paymentStatus}</div>
        </div>
      </header>

      <div class="address-grid">
        <div class="address-block">
          <h4>Invoice Details</h4>
          <p><strong>Date:</strong> ${formatDate(invoice.invoiceDate)}</p>
          <p><strong>Due:</strong> ${invoice.dueDate ? formatDate(invoice.dueDate) : 'N/A'}</p>
        </div>
        <div class="address-block">
          <h4>Billed To</h4>
          <p class="name">${invoice.customerDetails.name}</p>
          <p>${invoice.customerDetails.email}</p>
          ${invoice.customerDetails.phone ? `<p>${invoice.customerDetails.phone}</p>` : ''}
          ${invoice.customerDetails.gstin ? `<p class="detail">GSTIN: ${invoice.customerDetails.gstin}</p>` : ''}
        </div>
        <div class="address-block">
          <h4>From</h4>
          <p class="name">${invoice.companyDetails.name}</p>
          <p>${invoice.companyDetails.address}</p>
          <p>${invoice.companyDetails.email}</p>
          ${invoice.companyDetails.gstin ? `<p class="detail">GSTIN: ${invoice.companyDetails.gstin}</p>` : ''}
        </div>
      </div>

      <div class="section-title">Service Details</div>
      <table class="invoice-table">
        <thead>
          <tr>
            <th style="width: 55%;">Description</th>
            <th style="width: 15%;">Plan</th>
            <th style="width: 15%;" class="text-right">Amount</th>
            <th style="width: 15%;" class="text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="service-name">${invoice.serviceDetails.name}</div>
              ${invoice.serviceDetails.description ? `<div class="service-desc">${invoice.serviceDetails.description}</div>` : ''}
            </td>
            <td>
              <span class="plan-badge">${invoice.serviceDetails.plan}</span>
            </td>
            <td class="text-right">${formatCurrency(invoice.subtotal)}</td>
            <td class="text-right">${formatCurrency(invoice.subtotal)}</td>
          </tr>
        </tbody>
      </table>

      <div class="summary-wrapper">
        <div class="payment-info">
          <div class="section-title">Payment Info</div>
          <div class="info-card">
            <div class="info-item">
              <div class="label">Method</div>
              <div class="value">${invoice.paymentMethod.replace('_', ' ').toUpperCase()}</div>
            </div>
            <div class="info-item">
              <div class="label">Transaction</div>
              <div class="value">${invoice.transactionId || 'N/A'}</div>
            </div>
            <div class="info-item">
              <div class="label">Status</div>
              <div class="value" style="color:#166534;">${invoice.paymentStatus.toUpperCase()}</div>
            </div>
          </div>
        </div>

        <div class="total-box">
          <div class="total-row subtotal">
            <span class="label">Subtotal</span>
            <span class="amount">${formatCurrency(invoice.subtotal)}</span>
          </div>
          <div class="total-row">
            <span class="label">GST (${invoice.taxRate}%)</span>
            <span class="amount">${formatCurrency(invoice.taxAmount)}</span>
          </div>
          ${invoice.discount > 0 ? `
          <div class="total-row discount">
            <span class="label">Discount</span>
            <span class="amount">-${formatCurrency(invoice.discount)}</span>
          </div>
          ` : ''}
          <div class="total-row grand-total">
            <span class="label">Total Amount</span>
            <span class="amount">${formatCurrency(invoice.totalAmount)}</span>
          </div>
        </div>
      </div>

      ${invoice.notes ? `
      <div class="notes-section">
        <div class="notes-label">Notes</div>
        <p>${invoice.notes}</p>
      </div>
      ` : ''}

      <div class="flex-spacer"></div>

      <footer class="invoice-footer">
        <div class="footer-brand">CFI <span>V2.0</span></div>
        <div class="footer-terms">${invoice.termsAndConditions}</div>
        <div class="footer-contact">
          <span>📧 ${invoice.companyDetails.email}</span>
          ${invoice.companyDetails.phone ? `<span>📞 ${invoice.companyDetails.phone}</span>` : ''}
          ${invoice.companyDetails.website ? `<span>🌐 ${invoice.companyDetails.website.replace('https://', '').replace('http://', '')}</span>` : ''}
        </div>
      </footer>
    </div>
  </div>
</body>
</html>
  `;
};


// ==========================================================
// ✅ HELPER: Generate PDF from HTML
// ==========================================================

const generatePDF = (html) => {
  return new Promise((resolve, reject) => {
    const options = {
      format: 'A4',
      orientation: 'portrait',
      border: {
        top: '20px',
        bottom: '20px',
        left: '20px',
        right: '20px'
      },
      type: 'pdf',
      timeout: 30000,
      quality: '100',
      zoomFactor: 1,
    };

    htmlPdf.create(html, options).toBuffer((err, buffer) => {
      if (err) {
        console.error('PDF Generation Error:', err);
        reject(err);
      } else {
        resolve(buffer);
      }
    });
  });
};

// ==========================================================
// ✅ GENERATE INVOICE FROM PAYMENT
// ==========================================================

export const generateInvoiceFromPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      return badRequestResponse(res, { message: "Invalid payment ID" });
    }

    const payment = await Payment.findById(paymentId)
      .populate("user", "fullName email phone userDetails")
      .populate("service", "name slug category")
      .populate("order", "plan amount orderStatus invoiceNumber");

    if (!payment) {
      return notFoundResponse(res, { message: "Payment not found" });
    }

    const existingInvoice = await Invoice.findOne({ payment: payment._id });
    if (existingInvoice) {
      return successResponse(res, {
        message: "Invoice already exists for this payment",
        data: existingInvoice,
      });
    }

    const order = await Order.findById(payment.order);
    if (!order) {
      return notFoundResponse(res, { message: "Order not found" });
    }

    const service = await Service.findById(payment.service);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    const user = await User.findById(payment.user);
    if (!user) {
      return notFoundResponse(res, { message: "User not found" });
    }

    const subtotal = payment.amount || 0;
    const taxRate = 0;
    const taxAmount = (subtotal * taxRate) / 100;
    const discount = payment.discount || 0;
    const totalAmount = subtotal + taxAmount - discount;

    const invoiceNumber = await Invoice.generateInvoiceNumber();

    const invoice = new Invoice({
      invoiceNumber,
      user: payment.user._id,
      order: payment.order._id,
      payment: payment._id,
      service: payment.service,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      subtotal,
      taxRate,
      taxAmount,
      discount,
      totalAmount,
      paymentMethod: payment.paymentMethod,
      paymentStatus: "paid",
      paymentDate: payment.paidAt || new Date(),
      transactionId: payment.transactionId || payment.razorpayPaymentId,
      
      customerDetails: {
        name: user.fullName || "User",
        email: user.email || "",
        phone: user.phone || "",
        address: user.userDetails?.address || {},
        gstin: user.userDetails?.gstin || "",
        pan: user.userDetails?.pan || "",
      },
      
      serviceDetails: {
        name: service.name || "Service",
        plan: payment.plan || order.plan || "standard",
        description: service.shortDescription || service.description || "",
        features: order.planFeatures || [],
      },
      
      companyDetails: {
        name: process.env.COMPANY_NAME || "CFI V2.0",
        address: process.env.COMPANY_ADDRESS || "123, Business Park, Mumbai, India",
        email: process.env.COMPANY_EMAIL || "support@cfiv2.com",
        phone: process.env.COMPANY_PHONE || "+91 1234567890",
        gstin: process.env.COMPANY_GSTIN || "22AAAAA0000A1Z5",
        pan: process.env.COMPANY_PAN || "AAAAA0000A",
        cin: process.env.COMPANY_CIN || "U12345MH2026PTC000001",
        website: process.env.COMPANY_WEBSITE || "https://cfiv2.com",
      },
      
      status: "generated",
      notes: order.notes || "",
    });

    await invoice.save();

    payment.invoice = invoice._id;
    payment.invoiceUrl = `/api/invoices/${invoice._id}/download`;
    payment.invoiceGenerated = true;
    payment.invoiceGeneratedAt = new Date();
    await payment.save();

    order.invoiceNumber = invoiceNumber;
    order.invoiceId = invoice._id;
    order.invoiceGenerated = true;
    order.invoiceGeneratedAt = new Date();
    await order.save();

    await Notification.create({
      user: payment.user._id,
      type: 'system_info',
      title: '📄 Invoice Generated',
      message: `Your invoice ${invoice.invoiceNumber} has been generated.`,
      priority: 'medium',
      actionUrl: `/invoices/${invoice._id}`,
      actionLabel: 'View Invoice',
      metadata: {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount,
      },
      createdBy: "system",
    });

    logger.info(`✅ Invoice generated: ${invoice.invoiceNumber}`, {
      invoiceId: invoice._id,
      paymentId: payment._id,
      userId: payment.user._id,
    });

    return successResponse(res, {
      message: "Invoice generated successfully",
      data: invoice,
    });

  } catch (error) {
    logger.error("Generate invoice error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to generate invoice",
    });
  }
};

// ==========================================================
// ✅ GET INVOICE BY ID
// ==========================================================

export const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequestResponse(res, { message: "Invalid invoice ID" });
    }

    const invoice = await Invoice.findById(id)
      .populate("user", "fullName email phone")
      .populate("service", "name slug category")
      .populate("order", "plan orderStatus")
      .populate("payment", "paymentMethod paymentStatus amount");

    if (!invoice) {
      return notFoundResponse(res, { message: "Invoice not found" });
    }

    if (invoice.user._id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return forbiddenResponse(res, { message: "You are not authorized to view this invoice" });
    }

    if (req.user.role !== "admin") {
      await invoice.markAsViewed();
    }

    return successResponse(res, {
      message: "Invoice fetched successfully",
      data: invoice,
    });

  } catch (error) {
    logger.error("Get invoice by ID error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch invoice",
    });
  }
};

// ==========================================================
// ✅ GET MY INVOICES
// ==========================================================

export const getMyInvoices = async (req, res) => {
  try {
    const { status, limit = 20, page = 1, startDate, endDate } = req.query;

    const result = await Invoice.getInvoicesByUser(req.user._id, {
      status,
      limit: parseInt(limit),
      page: parseInt(page),
      startDate,
      endDate,
    });

    return successResponse(res, {
      message: "Invoices fetched successfully",
      data: result.data,
      pagination: result.pagination,
    });

  } catch (error) {
    logger.error("Get my invoices error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch invoices",
    });
  }
};

// ==========================================================
// ✅ GET ALL INVOICES (Admin)
// ==========================================================

export const getAllInvoices = async (req, res) => {
  try {
    const {
      status,
      paymentStatus,
      user,
      service,
      startDate,
      endDate,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (user) query.user = user;
    if (service) query.service = service;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { "customerDetails.name": { $regex: search, $options: "i" } },
        { "customerDetails.email": { $regex: search, $options: "i" } },
      ];
    }

    const paginationOptions = getPaginationOptions(req.query);
    const { skip, limit, sort } = paginationOptions;

    const [invoices, total] = await Promise.all([
      Invoice.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("user", "fullName email")
        .populate("service", "name slug")
        .populate("order", "plan orderStatus")
        .populate("payment", "paymentMethod paymentStatus")
        .lean(),
      Invoice.countDocuments(query),
    ]);

    return getPaginatedResponse(res, invoices, total, paginationOptions);

  } catch (error) {
    logger.error("Get all invoices error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch invoices",
    });
  }
};

// ==========================================================
// ✅ DOWNLOAD INVOICE AS PDF
// ==========================================================

export const downloadInvoicePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequestResponse(res, { message: "Invalid invoice ID" });
    }

    const invoice = await Invoice.findById(id)
      .populate("user", "fullName email")
      .populate("service", "name");

    if (!invoice) {
      return notFoundResponse(res, { message: "Invoice not found" });
    }

    // ✅ Check authorization - Support both header token and query token
    let userId = req.user?._id;
    
    if (!userId && token) {
      userId = await getUserIdFromToken(token);
    }

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Not authorized, no token provided" 
      });
    }

    if (invoice.user._id.toString() !== userId.toString() && req.user?.role !== "admin") {
      return forbiddenResponse(res, { message: "You are not authorized to download this invoice" });
    }

    // Generate HTML
    const html = generateInvoiceHTML(invoice);

    // ✅ Generate PDF
    console.log('📄 Generating PDF for invoice:', invoice.invoiceNumber);
    const pdfBuffer = await generatePDF(html);
    console.log('✅ PDF generated successfully, size:', pdfBuffer.length);

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');

    return res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Download invoice PDF error:', error);
    logger.error("Download invoice PDF error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to download invoice PDF",
    });
  }
};

// ==========================================================
// ✅ PREVIEW INVOICE (HTML View in Browser)
// ==========================================================

export const previewInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { token } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequestResponse(res, { message: "Invalid invoice ID" });
    }

    const invoice = await Invoice.findById(id)
      .populate("user", "fullName email")
      .populate("service", "name");

    if (!invoice) {
      return notFoundResponse(res, { message: "Invoice not found" });
    }

    let userId = req.user?._id;
    
    if (!userId && token) {
      userId = await getUserIdFromToken(token);
    }

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: "Not authorized, no token provided" 
      });
    }

    if (invoice.user._id.toString() !== userId.toString() && req.user?.role !== "admin") {
      return forbiddenResponse(res, { message: "You are not authorized to view this invoice" });
    }

    const html = generateInvoiceHTML(invoice);
    return res.send(html);

  } catch (error) {
    logger.error("Preview invoice error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to preview invoice",
    });
  }
};

// ==========================================================
// ✅ SEND INVOICE BY EMAIL
// ==========================================================

export const sendInvoiceEmail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequestResponse(res, { message: "Invalid invoice ID" });
    }

    const invoice = await Invoice.findById(id)
      .populate("user", "fullName email");

    if (!invoice) {
      return notFoundResponse(res, { message: "Invoice not found" });
    }

    if (invoice.user._id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return forbiddenResponse(res, { message: "You are not authorized to send this invoice" });
    }

    const html = generateInvoiceHTML(invoice);

    // Generate PDF for attachment
    const pdfBuffer = await generatePDF(html);

    // Get user
    const user = await User.findById(invoice.user);
    if (!user) {
      return notFoundResponse(res, { message: "User not found" });
    }

    // TODO: Send email with PDF attachment
    // await sendEmail({
    //   to: user.email,
    //   subject: `Invoice ${invoice.invoiceNumber} from CFI V2.0`,
    //   html: `
    //     <p>Dear ${user.fullName},</p>
    //     <p>Please find attached your invoice ${invoice.invoiceNumber}.</p>
    //     <p>Total Amount: ₹${invoice.totalAmount.toLocaleString()}</p>
    //     <p>Thank you for your business!</p>
    //   `,
    //   attachments: [{
    //     filename: `invoice-${invoice.invoiceNumber}.pdf`,
    //     content: pdfBuffer,
    //     contentType: 'application/pdf',
    //   }],
    // });

    await invoice.markAsSent();

    await Notification.create({
      user: invoice.user,
      type: 'system_info',
      title: '📧 Invoice Sent',
      message: `Your invoice ${invoice.invoiceNumber} has been sent to your email.`,
      priority: 'medium',
      actionUrl: `/invoices/${invoice._id}`,
      actionLabel: 'View Invoice',
      metadata: {
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        amount: invoice.totalAmount,
      },
      createdBy: "system",
    });

    logger.info(`✅ Invoice email sent: ${invoice.invoiceNumber}`, {
      invoiceId: invoice._id,
      userId: invoice.user._id,
    });

    return successResponse(res, {
      message: `Invoice ${invoice.invoiceNumber} sent to email successfully`,
      data: invoice,
    });

  } catch (error) {
    logger.error("Send invoice email error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to send invoice email",
    });
  }
};

// ==========================================================
// ✅ UPDATE INVOICE STATUS
// ==========================================================

export const updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequestResponse(res, { message: "Invalid invoice ID" });
    }

    const validStatuses = ["draft", "generated", "sent", "viewed", "paid", "overdue", "cancelled"];
    if (status && !validStatuses.includes(status)) {
      return badRequestResponse(res, {
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return notFoundResponse(res, { message: "Invoice not found" });
    }

    if (req.user.role !== "admin") {
      return forbiddenResponse(res, { message: "Only admin can update invoice status" });
    }

    if (status) invoice.status = status;
    if (notes) invoice.notes = notes;

    await invoice.save();

    logger.info(`✅ Invoice status updated: ${invoice.invoiceNumber}`, {
      invoiceId: invoice._id,
      status: invoice.status,
      updatedBy: req.user._id,
    });

    return successResponse(res, {
      message: "Invoice status updated successfully",
      data: invoice,
    });

  } catch (error) {
    logger.error("Update invoice status error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to update invoice status",
    });
  }
};

// ==========================================================
// ✅ MARK INVOICE AS PAID
// ==========================================================

export const markInvoiceAsPaid = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequestResponse(res, { message: "Invalid invoice ID" });
    }

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return notFoundResponse(res, { message: "Invoice not found" });
    }

    if (req.user.role !== "admin") {
      return forbiddenResponse(res, { message: "Only admin can mark invoice as paid" });
    }

    await invoice.markAsPaid();

    const payment = await Payment.findById(invoice.payment);
    if (payment) {
      payment.paymentStatus = "completed";
      payment.paidAt = new Date();
      await payment.save();
    }

    const order = await Order.findById(invoice.order);
    if (order) {
      order.orderStatus = "completed";
      order.completedAt = new Date();
      await order.save();
    }

    logger.info(`✅ Invoice marked as paid: ${invoice.invoiceNumber}`, {
      invoiceId: invoice._id,
      updatedBy: req.user._id,
    });

    return successResponse(res, {
      message: "Invoice marked as paid successfully",
      data: invoice,
    });

  } catch (error) {
    logger.error("Mark invoice as paid error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to mark invoice as paid",
    });
  }
};

// ==========================================================
// ✅ GET INVOICE STATISTICS (Admin)
// ==========================================================

export const getInvoiceStats = async (req, res) => {
  try {
    const stats = await Invoice.getInvoiceStats();

    const now = new Date();
    const monthlyRevenue = await Invoice.getMonthlyRevenue(now.getFullYear(), now.getMonth() + 1);

    const overdueInvoices = await Invoice.countDocuments({
      status: "overdue",
    });

    const recentInvoices = await Invoice.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("user", "fullName email")
      .populate("service", "name");

    return successResponse(res, {
      message: "Invoice statistics fetched successfully",
      data: {
        ...stats,
        overdue: overdueInvoices,
        monthlyRevenue: monthlyRevenue,
        recentInvoices: recentInvoices,
      },
    });

  } catch (error) {
    logger.error("Get invoice stats error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch invoice statistics",
    });
  }
};

// ==========================================================
// ✅ DELETE INVOICE (Admin)
// ==========================================================

export const deleteInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequestResponse(res, { message: "Invalid invoice ID" });
    }

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return notFoundResponse(res, { message: "Invoice not found" });
    }

    if (req.user.role !== "admin") {
      return forbiddenResponse(res, { message: "Only admin can delete invoices" });
    }

    await Payment.updateMany(
      { invoice: invoice._id },
      { $unset: { invoice: 1, invoiceGenerated: 1, invoiceGeneratedAt: 1 } }
    );

    await Order.updateMany(
      { invoiceId: invoice._id },
      { $unset: { invoiceId: 1, invoiceGenerated: 1, invoiceGeneratedAt: 1 } }
    );

    await invoice.deleteOne();

    logger.info(`✅ Invoice deleted: ${invoice.invoiceNumber}`, {
      invoiceId: invoice._id,
      deletedBy: req.user._id,
    });

    return successResponse(res, {
      message: "Invoice deleted successfully",
    });

  } catch (error) {
    logger.error("Delete invoice error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to delete invoice",
    });
  }
};

// ==========================================================
// ✅ BULK GENERATE INVOICES (Admin)
// ==========================================================

export const bulkGenerateInvoices = async (req, res) => {
  try {
    const { paymentIds } = req.body;

    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return badRequestResponse(res, { message: "Payment IDs array is required" });
    }

    const results = {
      success: [],
      failed: [],
    };

    for (const paymentId of paymentIds) {
      try {
        const mockReq = { params: { paymentId }, user: req.user };
        const mockRes = {
          status: () => ({ json: () => {} }),
        };

        const invoice = await generateInvoiceFromPayment(mockReq, mockRes);
        results.success.push(paymentId);
      } catch (error) {
        results.failed.push({
          paymentId,
          error: error.message,
        });
      }
    }

    return successResponse(res, {
      message: `Bulk invoice generation completed: ${results.success.length} success, ${results.failed.length} failed`,
      data: results,
    });

  } catch (error) {
    logger.error("Bulk generate invoices error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to bulk generate invoices",
    });
  }
};

// ==========================================================
// EXPORT ALL
// ==========================================================

export default {
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
};