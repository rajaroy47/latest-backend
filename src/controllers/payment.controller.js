// controllers/paymentController.js

import crypto from "crypto";
import mongoose from "mongoose";
import { UAParser } from "ua-parser-js";

import RazorpayInstance from "../config/razorpay.js";
import Service from "../models/service.model.js";
import Order from "../models/order.model.js";
import Payment from "../models/payment.model.js";
import ServicePlan from "../models/servicePlan.model.js";
import ServiceStatus from "../models/serviceStatus.model.js";
import {
  successResponse,
  errorResponse,
  badRequestResponse,
  notFoundResponse,
  forbiddenResponse,
  logger,
  getPaginationOptions,
  getPaginatedResponse,
} from "../utils/index.js";

// ==========================================================
// HELPER: Get request metadata
// ==========================================================

const getRequestMetadata = (req) => {
  const ua = UAParser(req.headers["user-agent"]);

  const ipAddress =
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.socket.remoteAddress ||
    req.ip ||
    "0.0.0.0";

  return {
    ipAddress,
    browser: ua.browser.name || "Unknown",
    browserVersion: ua.browser.version || "Unknown",
    os: ua.os.name || "Unknown",
    device: ua.device.type || "desktop",
    userAgent: req.headers["user-agent"] || "",
  };
};

// ==========================================================
// HELPER: Map Razorpay payment method to your enum
// ==========================================================

const mapRazorpayMethodToEnum = (razorpayMethod) => {
  const methodMap = {
    'card': 'debit_card', // or 'credit_card' - you might want to check card type
    'credit_card': 'credit_card',
    'debit_card': 'debit_card',
    'upi': 'upi',
    'netbanking': 'net_banking',
    'wallet': 'razorpay',
    'emi': 'razorpay',
    'paylater': 'razorpay',
  };
  
  return methodMap[razorpayMethod] || 'razorpay';
};

// ==========================================================
// HELPER: Get card type from Razorpay response
// ==========================================================

const getCardType = (card) => {
  if (!card) return null;
  // Razorpay returns card type as 'credit' or 'debit'
  if (card.type === 'credit') return 'credit_card';
  if (card.type === 'debit') return 'debit_card';
  return null;
};

// ==========================================================
// HELPER: Compute final price
// ==========================================================

const computeFinalPrice = (selectedPlan) => {
  if (selectedPlan.finalPrice !== undefined && selectedPlan.finalPrice !== null) {
    return Number(selectedPlan.finalPrice);
  }

  const basePrice = Number(selectedPlan.price || 0);
  const discount = Number(selectedPlan.discount || 0);
  return Math.max(0, basePrice - discount);
};

// ==========================================================
// PROCESS PAYMENT
// ==========================================================

export const processPayment = async (req, res) => {
  try {
    const { serviceId, plan } = req.body;

    if (!serviceId || !plan) {
      return badRequestResponse(res, {
        message: "Service ID and plan are required",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return badRequestResponse(res, { message: "Invalid service ID" });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return notFoundResponse(res, { message: "Service not found" });
    }

    const servicePlan = await ServicePlan.findOne({ serviceId });
    if (!servicePlan) {
      return notFoundResponse(res, { message: "Service plan not found" });
    }

    const selectedPlan = servicePlan?.plans?.get?.(plan) || servicePlan?.plans?.[plan];
    if (!selectedPlan) {
      return notFoundResponse(res, { message: `${plan} plan not found` });
    }

    const amount = computeFinalPrice(selectedPlan);

    if (!amount || amount <= 0) {
      return badRequestResponse(res, { message: "Invalid plan amount" });
    }

    // Check for existing pending order
    const existingPendingOrder = await Order.findOne({
      user: req.user._id,
      service: serviceId,
      plan,
      orderStatus: "pending",
    });

    if (existingPendingOrder) {
      if (existingPendingOrder.amount === amount) {
        return successResponse(res, {
          message: "Pending order already exists",
          data: {
            orderId: existingPendingOrder.razorpayOrderId,
            amount: existingPendingOrder.amount * 100,
            dbOrderId: existingPendingOrder._id,
          },
        });
      } else {
        await Order.findByIdAndDelete(existingPendingOrder._id);
        logger.info(`Stale pending order replaced: ${existingPendingOrder._id}`);
      }
    }

    // Create Razorpay order
    const razorpayOrder = await RazorpayInstance.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: `receipt_${Date.now()}`,
      notes: {
        userId: req.user._id.toString(),
        serviceId,
        plan,
      },
    });

    const order = await Order.create({
      user: req.user._id,
      service: serviceId,
      plan,
      amount,
      planFeatures: selectedPlan.features || [],
      razorpayOrderId: razorpayOrder.id,
      orderStatus: "pending",
      customerDetails: {
        name: req.user.fullName,
        email: req.user.email,
        phone: req.user.phone || "",
      },
    });

    return successResponse(res, {
      message: "Payment order created successfully",
      data: {
        orderId: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        dbOrderId: order._id,
      },
    });
  } catch (error) {
    logger.error("Process payment error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to process payment",
    });
  }
};

// ==========================================================
// VERIFY PAYMENT (FIXED WITH PROPER METHOD MAPPING)
// ==========================================================

export const verifyPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      await session.abortTransaction();
      session.endSession();
      return badRequestResponse(res, { message: "All payment fields are required" });
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      await session.abortTransaction();
      session.endSession();
      return badRequestResponse(res, { message: "Invalid payment signature" });
    }

    // Fetch payment details from Razorpay
    let razorpayPayment = null;
    let paymentMethod = 'razorpay'; // default fallback
    let paymentMethodDetails = {};

    try {
      razorpayPayment = await RazorpayInstance.payments.fetch(razorpay_payment_id);
      
      if (razorpayPayment) {
        // Get the raw method from Razorpay
        const rawMethod = razorpayPayment.method || 'razorpay';
        
        // Handle card payments specially to determine credit/debit
        if (rawMethod === 'card' && razorpayPayment.card) {
          paymentMethod = getCardType(razorpayPayment.card) || 'debit_card';
        } else {
          // Map Razorpay method to your enum
          paymentMethod = mapRazorpayMethodToEnum(rawMethod);
        }
        
        // Store additional payment method details
        paymentMethodDetails = {
          rawMethod: rawMethod,
          bank: razorpayPayment.bank || null,
          wallet: razorpayPayment.wallet || null,
          vpa: razorpayPayment.vpa || null,
          card: razorpayPayment.card ? {
            network: razorpayPayment.card.network,
            type: razorpayPayment.card.type,
            last4: razorpayPayment.card.last4,
            issuer: razorpayPayment.card.issuer,
            emi: razorpayPayment.card.emi || false,
          } : null,
          upi: razorpayPayment.upi ? {
            vpa: razorpayPayment.upi.vpa,
          } : null,
          bankName: razorpayPayment.bank_name || null,
        };

        logger.info(`Payment method detected: ${paymentMethod}`, {
          paymentId: razorpay_payment_id,
          rawMethod: rawMethod,
          details: paymentMethodDetails
        });
      }
    } catch (fetchError) {
      logger.warn(`Failed to fetch payment details from Razorpay: ${fetchError.message}`, {
        paymentId: razorpay_payment_id
      });
      // Continue with default method
    }

    // Find the order
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id }).session(session);

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return notFoundResponse(res, { message: "Order not found" });
    }

    // Check for existing payment to prevent duplicate verification
    const existingPayment = await Payment.findOne({
      razorpayPaymentId: razorpay_payment_id,
    }).session(session);

    if (existingPayment) {
      await session.commitTransaction();
      session.endSession();
      return successResponse(res, {
        message: "Payment already verified",
        data: {
          paymentId: existingPayment._id,
          orderId: order._id,
          paymentMethod: existingPayment.paymentMethod,
        },
      });
    }

    // Get request metadata
    const clientMetadata = getRequestMetadata(req);

    // Create payment record with proper method mapping
    const [payment] = await Payment.create(
      [
        {
          user: order.user,
          service: order.service,
          order: order._id,
          plan: order.plan,
          amount: order.amount,
          paymentMethod: paymentMethod, // Now properly mapped to your enum
          paymentStatus: "completed",
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          paidAt: new Date(),
          currency: "INR",
          transactionId: razorpay_payment_id, // Using payment ID as transaction ID
          metadata: {
            ...clientMetadata,
            // Store raw Razorpay response for reference
            razorpayResponse: razorpayPayment ? {
              method: razorpayPayment.method,
              bank: razorpayPayment.bank,
              wallet: razorpayPayment.wallet,
              vpa: razorpayPayment.vpa,
              card: razorpayPayment.card ? {
                network: razorpayPayment.card.network,
                type: razorpayPayment.card.type,
                last4: razorpayPayment.card.last4,
                issuer: razorpayPayment.card.issuer,
              } : null,
            } : null,
          },
          // Store payment method details in a separate field (you might want to add this to schema)
          // If you want to add this field, uncomment and add to schema
          // paymentMethodDetails: paymentMethodDetails,
        },
      ],
      { session }
    );

    // Update order
    order.paymentId = payment._id;
    order.razorpayPaymentId = razorpay_payment_id;
    order.signature = razorpay_signature;
    order.orderStatus = "completed";
    order.completedAt = new Date();
    await order.save({ session });

    // Create or update service status
    const existingServiceStatus = await ServiceStatus.findOne({
      serviceId: order.service,
      subscribedBy: order.user,
    }).session(session);

    if (!existingServiceStatus) {
      await ServiceStatus.create(
        [
          {
            serviceId: order.service,
            subscribedBy: order.user,
            status: "processing",
            plan: order.plan,
            startedAt: new Date(),
          },
        ],
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    return successResponse(res, {
      message: "Payment verified successfully",
      data: {
        paymentId: payment._id,
        orderId: order._id,
        serviceId: order.service,
        paymentMethod: paymentMethod,
        paymentMethodDetails: paymentMethodDetails,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    logger.error("Verify payment error:", error);
    return errorResponse(res, {
      message: error.message || "Payment verification failed",
    });
  }
};

// ==========================================================
// GET RAZORPAY KEY
// ==========================================================

export const getRazorpayKey = (req, res) => {
  return successResponse(res, {
    message: "Razorpay key fetched successfully",
    data: {
      key: process.env.RAZORPAY_KEY_ID,
    },
  });
};

// ==========================================================
// GET MY PAYMENTS
// ==========================================================

export const getMyPaymentDetails = async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id })
      .populate("service", "name slug category serviceImage")
      .populate("order", "plan orderStatus")
      .sort({ createdAt: -1 });

    // Add human-readable payment method labels
    const paymentsWithLabels = payments.map(payment => ({
      ...payment.toObject(),
      paymentMethodLabel: getPaymentMethodLabel(payment.paymentMethod),
    }));

    return successResponse(res, {
      message: "Payments fetched successfully",
      data: paymentsWithLabels,
    });
  } catch (error) {
    logger.error("Get my payments error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch payments",
    });
  }
};

// ==========================================================
// GET ALL PAYMENTS (Admin)
// ==========================================================

export const getAllPayments = async (req, res) => {
  try {
    const { paymentStatus, service, user, startDate, endDate, search, paymentMethod } = req.query;

    const query = {};

    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (service) query.service = service;
    if (user) query.user = user;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { razorpayOrderId: { $regex: search, $options: "i" } },
        { razorpayPaymentId: { $regex: search, $options: "i" } },
        { transactionId: { $regex: search, $options: "i" } },
      ];
    }

    const paginationOptions = getPaginationOptions(req.query);
    const { skip, limit, sort } = paginationOptions;

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate("user", "fullName email")
        .populate("service", "name slug category")
        .populate("order", "plan orderStatus")
        .lean(),
      Payment.countDocuments(query),
    ]);

    // Add payment method labels
    const paymentsWithLabels = payments.map(payment => ({
      ...payment,
      paymentMethodLabel: getPaymentMethodLabel(payment.paymentMethod),
    }));

    return getPaginatedResponse(res, paymentsWithLabels, total, paginationOptions);
  } catch (error) {
    logger.error("Get all payments error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch payments",
    });
  }
};

// ==========================================================
// GET PAYMENT STATS (Enhanced with method breakdown)
// ==========================================================

export const getPaymentStats = async (req, res) => {
  try {
    const stats = await Payment.getPaymentStats();
    const dailySummary = await Payment.getDailySummary(new Date());

    // Get payment method breakdown
    const methodBreakdown = await Payment.aggregate([
      {
        $match: { paymentStatus: 'completed' }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $project: {
          method: '$_id',
          methodLabel: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 'debit_card'] }, then: 'Debit Card' },
                { case: { $eq: ['$_id', 'credit_card'] }, then: 'Credit Card' },
                { case: { $eq: ['$_id', 'upi'] }, then: 'UPI' },
                { case: { $eq: ['$_id', 'net_banking'] }, then: 'Net Banking' },
                { case: { $eq: ['$_id', 'razorpay'] }, then: 'Razorpay' },
              ],
              default: 'Other'
            }
          },
          count: 1,
          totalAmount: 1,
          percentage: {
            $multiply: [
              { $divide: ['$count', { $sum: '$count' }] },
              100
            ]
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    return successResponse(res, {
      message: "Payment statistics fetched successfully",
      data: {
        ...stats,
        today: dailySummary,
        methodBreakdown: methodBreakdown,
      },
    });
  } catch (error) {
    logger.error("Get payment stats error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch payment statistics",
    });
  }
};

// ==========================================================
// REFUND PAYMENT (Admin)
// ==========================================================

export const refundPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const payment = await Payment.findById(id);

    if (!payment) {
      return notFoundResponse(res, { message: "Payment not found" });
    }

    if (payment.paymentStatus !== "completed") {
      return badRequestResponse(res, {
        message: `Only completed payments can be refunded. Current status: ${payment.paymentStatus}`,
      });
    }

    const refundAmount = amount || payment.amount;

    if (refundAmount > payment.amount) {
      return badRequestResponse(res, {
        message: "Refund amount cannot exceed payment amount",
      });
    }

    await payment.processRefund(refundAmount, reason || "Refund requested");

    if (refundAmount === payment.amount) {
      const order = await Order.findById(payment.order);
      if (order) {
        order.orderStatus = "cancelled";
        order.cancelledAt = new Date();
        order.cancelledReason = "Refunded";
        await order.save();
      }
    }

    return successResponse(res, {
      message: "Payment refunded successfully",
      data: payment,
    });
  } catch (error) {
    logger.error("Refund payment error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to process refund",
    });
  }
};

// ==========================================================
// GET PAYMENT BY ORDER ID (Enhanced)
// ==========================================================

export const getPaymentByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;

    const payment = await Payment.findOne({ order: orderId })
      .populate("user", "fullName email")
      .populate("service", "name slug")
      .populate("order", "plan orderStatus");

    if (!payment) {
      return notFoundResponse(res, { message: "Payment not found" });
    }

    if (payment.user._id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return forbiddenResponse(res, { message: "You are not authorized to view this payment" });
    }

    // Add human-readable label
    const paymentWithLabel = {
      ...payment.toObject(),
      paymentMethodLabel: getPaymentMethodLabel(payment.paymentMethod),
    };

    return successResponse(res, {
      message: "Payment fetched successfully",
      data: paymentWithLabel,
    });
  } catch (error) {
    logger.error("Get payment by order ID error:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch payment",
    });
  }
};

// ==========================================================
// HELPER: Get human-readable payment method label
// ==========================================================

const getPaymentMethodLabel = (method) => {
  const methodMap = {
    'razorpay': 'Razorpay',
    'debit_card': 'Debit Card',
    'credit_card': 'Credit Card',
    'net_banking': 'Net Banking',
    'upi': 'UPI',
    'stripe': 'Stripe',
  };
  return methodMap[method] || method || 'Unknown';
};

// ==========================================================
// WEBHOOK HANDLER
// ==========================================================

export const webhookHandler = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (signature !== expectedSignature) {
      logger.warn("Invalid webhook signature");
      return res.status(401).json({ success: false, message: "Invalid signature" });
    }

    const { event, payload } = req.body;

    logger.info(`Webhook received: ${event}`);

    switch (event) {
      case "payment.captured": {
        const paymentId = payload.payment.entity.id;
        const orderId = payload.payment.entity.order_id;
        
        await Payment.findOneAndUpdate(
          { razorpayOrderId: orderId },
          { 
            paymentStatus: "completed",
            razorpayPaymentId: paymentId,
            paidAt: new Date(),
            webhookReceived: true,
            webhookData: payload,
          }
        );
        break;
      }

      case "payment.failed": {
        const failedPaymentId = payload.payment.entity.id;
        const failedOrderId = payload.payment.entity.order_id;
        const failureReason = payload.payment.entity.error_description || "Payment failed";
        
        await Payment.findOneAndUpdate(
          { razorpayOrderId: failedOrderId },
          {
            paymentStatus: "failed",
            failureReason: failureReason,
            webhookReceived: true,
            webhookData: payload,
          }
        );
        break;
      }

      case "refund.created": {
        const refundData = payload.refund.entity;
        await Payment.findOneAndUpdate(
          { razorpayPaymentId: refundData.payment_id },
          {
            refundAmount: refundData.amount / 100,
            refundedAt: new Date(),
            paymentStatus: refundData.amount === refundData.total_amount ? "refunded" : "partially_refunded",
            webhookReceived: true,
            webhookData: payload,
          }
        );
        break;
      }

      default:
        logger.info(`Unhandled webhook event: ${event}`);
    }

    return res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    logger.error("Webhook error:", error);
    return res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
};

// ==========================================================
// GET SUCCESS MESSAGE
// ==========================================================

export const getSuccessMsg = (req, res) => {
  return successResponse(res, { 
    message: "Payment successful" 
  });
};

// ==========================================================
// EXPORT ALL
// ==========================================================

export default {
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
};