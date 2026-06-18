// routes/orderRoutes.js

import express from "express";
import {
  getAllOrders,
  getOrderById,
  getMyOrders,
  createOrder,
  updateOrderStatus,
  cancelOrder,
  verifyPayment,
  getOrderStats,
  getOrdersByService,
  getOrdersByUser,
} from "../controllers/order.controller.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

// ==========================================================
// PROTECTED ROUTES
// ==========================================================
router.use(protect);

router.get("/my-orders", getMyOrders);
router.post("/", createOrder);
router.get("/:id", getOrderById);
router.put("/:id/cancel", cancelOrder);
router.post("/:id/verify-payment", verifyPayment);

// ==========================================================
// ADMIN ROUTES
// ==========================================================
router.use(authorize("admin"));

router.get("/", getAllOrders);
router.get("/stats", getOrderStats);
router.get("/service/:serviceId", getOrdersByService);
router.get("/user/:userId", getOrdersByUser);
router.put("/:id/status", updateOrderStatus);

export default router;