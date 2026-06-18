// routes/paymentRoutes.js

import express from "express";
import {
  processPayment,
  verifyPayment,
  getRazorpayKey,
  getMyPaymentDetails,
  getAllPayments,
  getPaymentStats,
  refundPayment,
  getPaymentByOrderId,
  webhookHandler,
  getSuccessMsg,
} from "../controllers/payment.controller.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ==========================================================
// PUBLIC ROUTES
// ==========================================================

router.get("/key", getRazorpayKey);
router.post("/webhook", express.raw({ type: "application/json" }), webhookHandler);
router.get("/success", getSuccessMsg);

// ==========================================================
// PROTECTED ROUTES
// ==========================================================
router.use(protect);

router.post("/process", processPayment);
router.post("/verify", verifyPayment);
router.get("/my-payments", getMyPaymentDetails);
router.get("/order/:orderId", getPaymentByOrderId);

// ==========================================================
// ADMIN ROUTES
// ==========================================================
router.use(authorize("admin"));

router.get("/all", getAllPayments);
router.get("/stats", getPaymentStats);
router.post("/:id/refund", refundPayment);

export default router;