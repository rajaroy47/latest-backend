// // controllers/paymentController.js

// import crypto from "crypto";
// import mongoose from "mongoose";
// import { UAParser } from "ua-parser-js";

// import RazorpayInstance from "../config/razorpay.js";
// import Service from "../models/service.model.js";
// import Order from "../models/order.model.js";
// import Payment from "../models/payment.model.js";
// import ServicePlan from "../models/servicePlan.model.js";
// import ServiceStatus from "../models/serviceStatus.model.js";
// import {
//   successResponse,
//   errorResponse,
//   badRequestResponse,
//   notFoundResponse,
//   forbiddenResponse,
//   logger,
//   getPaginationOptions,
//   getPaginatedResponse,
// } from "../utils/index.js";

// // ==========================================================
// // HELPER: Get request metadata
// // ==========================================================

// const getRequestMetadata = (req) => {
//   const ua = UAParser(req.headers["user-agent"]);

//   const ipAddress =
//     req.headers["x-forwarded-for"]?.split(",")[0] ||
//     req.socket.remoteAddress ||
//     req.ip ||
//     "0.0.0.0";

//   return {
//     ipAddress,
//     browser: ua.browser.name || "Unknown",
//     browserVersion: ua.browser.version || "Unknown",
//     os: ua.os.name || "Unknown",
//     device: ua.device.type || "desktop",
//     userAgent: req.headers["user-agent"] || "",
//   };
// };

// // ==========================================================
// // HELPER: Compute final price
// // ==========================================================

// const computeFinalPrice = (selectedPlan) => {
//   if (selectedPlan.finalPrice !== undefined && selectedPlan.finalPrice !== null) {
//     return Number(selectedPlan.finalPrice);
//   }

//   const basePrice = Number(selectedPlan.price || 0);
//   const discount = Number(selectedPlan.discount || 0);
//   return Math.max(0, basePrice - discount);
// };

// // ==========================================================
// // PROCESS PAYMENT
// // ==========================================================

// export const processPayment = async (req, res) => {
//   try {
//     const { serviceId, plan } = req.body;

//     if (!serviceId || !plan) {
//       return badRequestResponse(res, {
//         message: "Service ID and plan are required",
//       });
//     }

//     if (!mongoose.Types.ObjectId.isValid(serviceId)) {
//       return badRequestResponse(res, { message: "Invalid service ID" });
//     }

//     const service = await Service.findById(serviceId);
//     if (!service) {
//       return notFoundResponse(res, { message: "Service not found" });
//     }

//     const servicePlan = await ServicePlan.findOne({ serviceId });
//     if (!servicePlan) {
//       return notFoundResponse(res, { message: "Service plan not found" });
//     }

//     const selectedPlan = servicePlan?.plans?.get?.(plan) || servicePlan?.plans?.[plan];
//     if (!selectedPlan) {
//       return notFoundResponse(res, { message: `${plan} plan not found` });
//     }

//     const amount = computeFinalPrice(selectedPlan);

//     if (!amount || amount <= 0) {
//       return badRequestResponse(res, { message: "Invalid plan amount" });
//     }

//     // Check for existing pending order
//     const existingPendingOrder = await Order.findOne({
//       user: req.user._id,
//       service: serviceId,
//       plan,
//       orderStatus: "pending",
//     });

//     if (existingPendingOrder) {
//       if (existingPendingOrder.amount === amount) {
//         return successResponse(res, {
//           message: "Pending order already exists",
//           data: {
//             orderId: existingPendingOrder.razorpayOrderId,
//             amount: existingPendingOrder.amount * 100,
//             dbOrderId: existingPendingOrder._id,
//           },
//         });
//       } else {
//         await Order.findByIdAndDelete(existingPendingOrder._id);
//         logger.info(`Stale pending order replaced: ${existingPendingOrder._id}`);
//       }
//     }

//     // Create Razorpay order
//     const razorpayOrder = await RazorpayInstance.orders.create({
//       amount: Math.round(amount * 100),
//       currency: "INR",
//       receipt: `receipt_${Date.now()}`,
//       notes: {
//         userId: req.user._id.toString(),
//         serviceId,
//         plan,
//       },
//     });

//     const order = await Order.create({
//       user: req.user._id,
//       service: serviceId,
//       plan,
//       amount,
//       planFeatures: selectedPlan.features || [],
//       razorpayOrderId: razorpayOrder.id,
//       orderStatus: "pending",
//       customerDetails: {
//         name: req.user.fullName,
//         email: req.user.email,
//         phone: req.user.phone || "",
//       },
//     });

//     return successResponse(res, {
//       message: "Payment order created successfully",
//       data: {
//         orderId: razorpayOrder.id,
//         amount: razorpayOrder.amount,
//         currency: razorpayOrder.currency,
//         dbOrderId: order._id,
//       },
//     });
//   } catch (error) {
//     logger.error("Process payment error:", error);
//     return errorResponse(res, {
//       message: error.message || "Failed to process payment",
//     });
//   }
// };

// // ==========================================================
// // VERIFY PAYMENT
// // ==========================================================

// export const verifyPayment = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

//     if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
//       await session.abortTransaction();
//       session.endSession();
//       return badRequestResponse(res, { message: "All payment fields are required" });
//     }

//     const generatedSignature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     if (generatedSignature !== razorpay_signature) {
//       await session.abortTransaction();
//       session.endSession();
//       return badRequestResponse(res, { message: "Invalid payment signature" });
//     }

//     const razorpayPayment = await RazorpayInstance.payments.fetch(
//       razorpay_payment_id
//     );

//     console.log(razorpayPayment);

//     const order = await Order.findOne({ razorpayOrderId: razorpay_order_id }).session(session);

//     if (!order) {
//       await session.abortTransaction();
//       session.endSession();
//       return notFoundResponse(res, { message: "Order not found" });
//     }

//     const existingPayment = await Payment.findOne({
//       razorpayPaymentId: razorpay_payment_id,
//     }).session(session);

//     if (existingPayment) {
//       await session.commitTransaction();
//       session.endSession();
//       return successResponse(res, {
//         message: "Payment already verified",
//         data: {
//           paymentId: existingPayment._id,
//           orderId: order._id,
//         },
//       });
//     }

//     const clientMetadata = getRequestMetadata(req);

//     const [payment] = await Payment.create(
//       [
//         {
//           user: order.user,
//           service: order.service,
//           order: order._id,
//           plan: order.plan,
//           amount: order.amount,
//           paymentMethod: "razorpay",
//           paymentStatus: "completed",
//           razorpayOrderId: razorpay_order_id,
//           razorpayPaymentId: razorpay_payment_id,
//           razorpaySignature: razorpay_signature,
//           paidAt: new Date(),
//           metadata: clientMetadata,
//         },
//       ],
//       { session }
//     );

//     order.paymentId = payment._id;
//     order.razorpayPaymentId = razorpay_payment_id;
//     order.signature = razorpay_signature;
//     order.orderStatus = "completed";
//     order.completedAt = new Date();
//     await order.save({ session });

//     // Create or update service status
//     const existingServiceStatus = await ServiceStatus.findOne({
//       serviceId: order.service,
//       subscribedBy: order.user,
//     }).session(session);

//     if (!existingServiceStatus) {
//       await ServiceStatus.create(
//         [
//           {
//             serviceId: order.service,
//             subscribedBy: order.user,
//             status: "processing",
//             plan: order.plan,
//             startedAt: new Date(),
//           },
//         ],
//         { session }
//       );
//     }

//     await session.commitTransaction();
//     session.endSession();

//     return successResponse(res, {
//       message: "Payment verified successfully",
//       data: {
//         paymentId: payment._id,
//         orderId: order._id,
//         serviceId: order.service,
//       },
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     logger.error("Verify payment error:", error);
//     return errorResponse(res, {
//       message: error.message || "Payment verification failed",
//     });
//   }
// };

// // ==========================================================
// // GET RAZORPAY KEY
// // ==========================================================

// export const getRazorpayKey = (req, res) => {
//   return successResponse(res, {
//     message: "Razorpay key fetched successfully",
//     data: {
//       key: process.env.RAZORPAY_KEY_ID,
//     },
//   });
// };

// // ==========================================================
// // GET MY PAYMENTS
// // ==========================================================

// export const getMyPaymentDetails = async (req, res) => {
//   try {
//     const payments = await Payment.find({ user: req.user._id })
//       .populate("service", "name slug category serviceImage")
//       .populate("order", "plan orderStatus")
//       .sort({ createdAt: -1 });

//     return successResponse(res, {
//       message: "Payments fetched successfully",
//       data: payments,
//     });
//   } catch (error) {
//     logger.error("Get my payments error:", error);
//     return errorResponse(res, {
//       message: error.message || "Failed to fetch payments",
//     });
//   }
// };

// // ==========================================================
// // GET ALL PAYMENTS (Admin)
// // ==========================================================

// export const getAllPayments = async (req, res) => {
//   try {
//     const { paymentStatus, service, user, startDate, endDate, search } = req.query;

//     const query = {};

//     if (paymentStatus) query.paymentStatus = paymentStatus;
//     if (service) query.service = service;
//     if (user) query.user = user;

//     if (startDate || endDate) {
//       query.createdAt = {};
//       if (startDate) query.createdAt.$gte = new Date(startDate);
//       if (endDate) query.createdAt.$lte = new Date(endDate);
//     }

//     if (search) {
//       query.$or = [
//         { razorpayOrderId: { $regex: search, $options: "i" } },
//         { razorpayPaymentId: { $regex: search, $options: "i" } },
//         { transactionId: { $regex: search, $options: "i" } },
//       ];
//     }

//     const paginationOptions = getPaginationOptions(req.query);
//     const { skip, limit, sort } = paginationOptions;

//     const [payments, total] = await Promise.all([
//       Payment.find(query)
//         .sort(sort)
//         .skip(skip)
//         .limit(limit)
//         .populate("user", "fullName email")
//         .populate("service", "name slug category")
//         .populate("order", "plan orderStatus")
//         .lean(),
//       Payment.countDocuments(query),
//     ]);

//     return getPaginatedResponse(res, payments, total, paginationOptions);
//   } catch (error) {
//     logger.error("Get all payments error:", error);
//     return errorResponse(res, {
//       message: error.message || "Failed to fetch payments",
//     });
//   }
// };

// // ==========================================================
// // GET PAYMENT STATS (Admin)
// // ==========================================================

// export const getPaymentStats = async (req, res) => {
//   try {
//     const stats = await Payment.getPaymentStats();
//     const dailySummary = await Payment.getDailySummary(new Date());

//     return successResponse(res, {
//       message: "Payment statistics fetched successfully",
//       data: {
//         ...stats,
//         today: dailySummary,
//       },
//     });
//   } catch (error) {
//     logger.error("Get payment stats error:", error);
//     return errorResponse(res, {
//       message: error.message || "Failed to fetch payment statistics",
//     });
//   }
// };

// // ==========================================================
// // REFUND PAYMENT (Admin)
// // ==========================================================

// export const refundPayment = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { amount, reason } = req.body;

//     const payment = await Payment.findById(id);

//     if (!payment) {
//       return notFoundResponse(res, { message: "Payment not found" });
//     }

//     if (payment.paymentStatus !== "completed") {
//       return badRequestResponse(res, {
//         message: `Only completed payments can be refunded. Current status: ${payment.paymentStatus}`,
//       });
//     }

//     const refundAmount = amount || payment.amount;

//     if (refundAmount > payment.amount) {
//       return badRequestResponse(res, {
//         message: "Refund amount cannot exceed payment amount",
//       });
//     }

//     await payment.processRefund(refundAmount, reason || "Refund requested");

//     if (refundAmount === payment.amount) {
//       const order = await Order.findById(payment.order);
//       if (order) {
//         order.orderStatus = "cancelled";
//         order.cancelledAt = new Date();
//         order.cancelledReason = "Refunded";
//         await order.save();
//       }
//     }

//     return successResponse(res, {
//       message: "Payment refunded successfully",
//       data: payment,
//     });
//   } catch (error) {
//     logger.error("Refund payment error:", error);
//     return errorResponse(res, {
//       message: error.message || "Failed to process refund",
//     });
//   }
// };

// // ==========================================================
// // GET PAYMENT BY ORDER ID
// // ==========================================================

// export const getPaymentByOrderId = async (req, res) => {
//   try {
//     const { orderId } = req.params;

//     const payment = await Payment.findOne({ order: orderId })
//       .populate("user", "fullName email")
//       .populate("service", "name slug")
//       .populate("order", "plan orderStatus");

//     if (!payment) {
//       return notFoundResponse(res, { message: "Payment not found" });
//     }

//     if (payment.user._id.toString() !== req.user._id.toString() && req.user.role !== "admin") {
//       return forbiddenResponse(res, { message: "You are not authorized to view this payment" });
//     }

//     return successResponse(res, {
//       message: "Payment fetched successfully",
//       data: payment,
//     });
//   } catch (error) {
//     logger.error("Get payment by order ID error:", error);
//     return errorResponse(res, {
//       message: error.message || "Failed to fetch payment",
//     });
//   }
// };

// // ==========================================================
// // WEBHOOK HANDLER
// // ==========================================================

// export const webhookHandler = async (req, res) => {
//   try {
//     const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
//     const signature = req.headers["x-razorpay-signature"];

//     // Verify webhook signature
//     const expectedSignature = crypto
//       .createHmac('sha256', webhookSecret)
//       .update(JSON.stringify(req.body))
//       .digest('hex');

//     if (signature !== expectedSignature) {
//       logger.warn("Invalid webhook signature");
//       return res.status(401).json({ success: false, message: "Invalid signature" });
//     }

//     const { event, payload } = req.body;

//     logger.info(`Webhook received: ${event}`);

//     switch (event) {
//       case "payment.captured": {
//         const paymentId = payload.payment.entity.id;
//         const orderId = payload.payment.entity.order_id;
        
//         await Payment.findOneAndUpdate(
//           { razorpayOrderId: orderId },
//           { 
//             paymentStatus: "completed",
//             razorpayPaymentId: paymentId,
//             paidAt: new Date(),
//             webhookReceived: true,
//             webhookData: payload,
//           }
//         );
//         break;
//       }

//       case "payment.failed": {
//         const failedPaymentId = payload.payment.entity.id;
//         const failedOrderId = payload.payment.entity.order_id;
//         const failureReason = payload.payment.entity.error_description || "Payment failed";
        
//         await Payment.findOneAndUpdate(
//           { razorpayOrderId: failedOrderId },
//           {
//             paymentStatus: "failed",
//             failureReason: failureReason,
//             webhookReceived: true,
//             webhookData: payload,
//           }
//         );
//         break;
//       }

//       case "refund.created": {
//         const refundData = payload.refund.entity;
//         await Payment.findOneAndUpdate(
//           { razorpayPaymentId: refundData.payment_id },
//           {
//             refundAmount: refundData.amount / 100,
//             refundedAt: new Date(),
//             paymentStatus: refundData.amount === refundData.total_amount ? "refunded" : "partially_refunded",
//             webhookReceived: true,
//             webhookData: payload,
//           }
//         );
//         break;
//       }

//       default:
//         logger.info(`Unhandled webhook event: ${event}`);
//     }

//     return res.status(200).json({ success: true, message: "Webhook processed" });
//   } catch (error) {
//     logger.error("Webhook error:", error);
//     return res.status(500).json({ success: false, message: "Webhook processing failed" });
//   }
// };

// // ==========================================================
// // GET SUCCESS MESSAGE
// // ==========================================================

// export const getSuccessMsg = (req, res) => {
//   return successResponse(res, { 
//     message: "Payment successful" 
//   });
// };

// // ==========================================================
// // EXPORT ALL
// // ==========================================================

// export default {
//   processPayment,
//   verifyPayment,
//   getRazorpayKey,
//   getMyPaymentDetails,
//   getAllPayments,
//   getPaymentStats,
//   refundPayment,
//   getPaymentByOrderId,
//   webhookHandler,
//   getSuccessMsg,
// };






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
import Notification from "../models/notification.model.js";
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
// ✅ IMPROVED: Map Razorpay payment method to your enum
// ==========================================================

const mapRazorpayMethodToEnum = (razorpayMethod, razorpayPayment = null) => {
  if (!razorpayMethod) return 'razorpay';
  
  const method = razorpayMethod.toLowerCase();
  
  const methodMap = {
    'card': () => {
      if (razorpayPayment?.card?.type) {
        if (razorpayPayment.card.type === 'credit') return 'credit_card';
        if (razorpayPayment.card.type === 'debit') return 'debit_card';
      }
      return 'debit_card';
    },
    'upi': () => 'upi',
    'netbanking': () => 'net_banking',
    'wallet': () => 'wallet',
    'emi': () => 'emi',
    'paylater': () => 'pay_later',
    'razorpay': () => 'razorpay',
  };
  
  if (methodMap[method]) {
    return methodMap[method]();
  }
  
  return 'razorpay';
};

// ==========================================================
// ✅ IMPROVED: Get card type from Razorpay response
// ==========================================================

const getCardTypeFromRazorpay = (card) => {
  if (!card) return null;
  
  if (card.type === 'credit') return 'credit_card';
  if (card.type === 'debit') return 'debit_card';
  
  const creditNetworks = ['american express', 'amex', 'mastercard', 'visa', 'rupay', 'diner'];
  const debitNetworks = ['maestro', 'visa electron'];
  
  const network = card.network?.toLowerCase() || '';
  if (creditNetworks.some(n => network.includes(n))) return 'credit_card';
  if (debitNetworks.some(n => network.includes(n))) return 'debit_card';
  
  return null;
};

// ==========================================================
// ✅ IMPROVED: Get payment method details from Razorpay
// ==========================================================

const getPaymentMethodDetails = (razorpayPayment) => {
  if (!razorpayPayment) return {};
  
  const details = {
    rawMethod: razorpayPayment.method || null,
    bank: razorpayPayment.bank || null,
    wallet: razorpayPayment.wallet || null,
    vpa: razorpayPayment.vpa || null,
    bankName: razorpayPayment.bank_name || razorpayPayment.bank || null,
  };
  
  if (razorpayPayment.card) {
    details.card = {
      network: razorpayPayment.card.network,
      type: razorpayPayment.card.type,
      last4: razorpayPayment.card.last4,
      issuer: razorpayPayment.card.issuer,
      emi: razorpayPayment.card.emi || false,
    };
  }
  
  if (razorpayPayment.upi) {
    details.upi = {
      vpa: razorpayPayment.upi.vpa,
    };
  }
  
  if (razorpayPayment.wallet) {
    details.walletDetails = {
      name: razorpayPayment.wallet,
    };
  }
  
  return details;
};

// ==========================================================
// ✅ IMPROVED: Get human-readable payment method label
// ==========================================================

const getPaymentMethodLabel = (method) => {
  const methodMap = {
    'razorpay': 'Razorpay',
    'debit_card': 'Debit Card',
    'credit_card': 'Credit Card',
    'net_banking': 'Net Banking',
    'upi': 'UPI',
    'wallet': 'Wallet',
    'emi': 'EMI',
    'pay_later': 'Pay Later',
    'stripe': 'Stripe',
  };
  return methodMap[method] || method || 'Unknown';
};

// ==========================================================
// ✅ HELPER: Create Payment Notifications
// ==========================================================

const createPaymentNotification = async (userId, type, data) => {
  const notificationConfigs = {
    'payment_success': {
      title: '💰 Payment Received',
      message: `Payment of ₹${data.amount?.toLocaleString()} for ${data.serviceName || 'service'} has been received successfully.`,
      priority: 'high',
      icon: 'thumbs-up',
      actionUrl: '/dashboard',
      actionLabel: 'View Payment',
    },
    'payment_failed': {
      title: '❌ Payment Failed',
      message: `Payment of ₹${data.amount?.toLocaleString()} for ${data.serviceName || 'service'} has failed. Please try again.`,
      priority: 'urgent',
      icon: 'alert-triangle',
      actionUrl: '/payment/retry',
      actionLabel: 'Retry Payment',
    },
    'payment_pending': {
      title: '⏳ Payment Pending',
      message: `Payment of ₹${data.amount?.toLocaleString()} for ${data.serviceName || 'service'} is pending. Complete it within 24 hours.`,
      priority: 'high',
      icon: 'clock',
      actionUrl: '/dashboard',
      actionLabel: 'Complete Payment',
    },
    'payment_refunded': {
      title: '🔄 Payment Refunded',
      message: `Refund of ₹${data.amount?.toLocaleString()} for ${data.serviceName || 'service'} has been processed successfully.`,
      priority: 'medium',
      icon: 'refresh-cw',
      actionUrl: '/dashboard',
      actionLabel: 'View Refund',
    },
    'payment_partial_refund': {
      title: '🔄 Partial Refund',
      message: `Partial refund of ₹${data.amount?.toLocaleString()} for ${data.serviceName || 'service'} has been processed.`,
      priority: 'medium',
      icon: 'refresh-cw',
      actionUrl: '/dashboard',
      actionLabel: 'View Refund',
    },
  };

  const config = notificationConfigs[type] || notificationConfigs['payment_success'];

  try {
    const notification = await Notification.create({
      user: userId,
      type: type,
      title: config.title,
      message: config.message,
      priority: config.priority,
      actionUrl: config.actionUrl,
      actionLabel: config.actionLabel,
      metadata: {
        serviceId: data.serviceId || null,
        orderId: data.orderId || null,
        paymentId: data.paymentId || null,
        serviceName: data.serviceName || null,
        amount: data.amount || null,
        plan: data.plan || null,
        paymentMethod: data.paymentMethod || null,
        bankName: data.bankName || null,
        transactionId: data.transactionId || null,
        ...data.metadata,
      },
      createdBy: "system",
    });

    logger.info(`✅ ${type} notification created for user ${userId}`, {
      notificationId: notification._id,
      type: type,
      amount: data.amount,
    });

    return notification;
  } catch (error) {
    logger.error(`Failed to create ${type} notification:`, error);
    return null;
  }
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

    // ✅ Create payment pending notification
    await createPaymentNotification(req.user._id, 'payment_pending', {
      amount: amount,
      serviceName: service.name,
      serviceId: serviceId,
      orderId: order._id,
      plan: plan,
      transactionId: razorpayOrder.id,
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
// ✅ VERIFY PAYMENT - With Professional Notifications
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
    let paymentMethod = 'razorpay';
    let bankName = null;
    let paymentMethodDetails = {};
    let cardType = null;

    try {
      razorpayPayment = await RazorpayInstance.payments.fetch(razorpay_payment_id);
      
      if (razorpayPayment) {
        const rawMethod = razorpayPayment.method || 'razorpay';
        
        switch (rawMethod.toLowerCase()) {
          case 'card':
            cardType = getCardTypeFromRazorpay(razorpayPayment.card);
            paymentMethod = cardType || 'debit_card';
            break;
          case 'upi':
            paymentMethod = 'upi';
            break;
          case 'netbanking':
            paymentMethod = 'net_banking';
            bankName = razorpayPayment.bank || null;
            break;
          case 'wallet':
            paymentMethod = 'wallet';
            break;
          case 'emi':
            paymentMethod = 'emi';
            break;
          case 'paylater':
            paymentMethod = 'pay_later';
            break;
          default:
            paymentMethod = mapRazorpayMethodToEnum(rawMethod, razorpayPayment);
        }
        
        paymentMethodDetails = getPaymentMethodDetails(razorpayPayment);

        logger.info(`✅ Payment method detected: ${paymentMethod}`, {
          paymentId: razorpay_payment_id,
          rawMethod: rawMethod,
          method: paymentMethod,
          bankName: bankName || razorpayPayment.bank,
          cardType: cardType,
        });
      }
    } catch (fetchError) {
      logger.warn(`Failed to fetch payment details from Razorpay: ${fetchError.message}`, {
        paymentId: razorpay_payment_id
      });
    }

    // Find the order
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id }).session(session);

    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return notFoundResponse(res, { message: "Order not found" });
    }

    // Check for existing payment
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

    // Get service details for notification
    const service = await Service.findById(order.service).session(session);

    const clientMetadata = getRequestMetadata(req);

    // ✅ Create payment record
    const [payment] = await Payment.create(
      [
        {
          user: order.user,
          service: order.service,
          order: order._id,
          plan: order.plan,
          amount: order.amount,
          paymentMethod: paymentMethod,
          paymentStatus: "completed",
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          paidAt: new Date(),
          currency: "INR",
          transactionId: razorpay_payment_id,
          bankName: bankName || razorpayPayment?.bank || null,
          metadata: {
            ...clientMetadata,
            razorpayResponse: razorpayPayment ? {
              method: razorpayPayment.method,
              bank: razorpayPayment.bank,
              bankName: razorpayPayment.bank_name,
              wallet: razorpayPayment.wallet,
              vpa: razorpayPayment.vpa,
              card: razorpayPayment.card ? {
                network: razorpayPayment.card.network,
                type: razorpayPayment.card.type,
                last4: razorpayPayment.card.last4,
                issuer: razorpayPayment.card.issuer,
              } : null,
              upi: razorpayPayment.upi ? {
                vpa: razorpayPayment.upi.vpa,
              } : null,
            } : null,
          },
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

    let serviceStatus = null;
    if (!existingServiceStatus) {
      [serviceStatus] = await ServiceStatus.create(
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
    } else {
      serviceStatus = existingServiceStatus;
    }

    // ✅ ==========================================================
    // ✅ CREATE PROFESSIONAL PAYMENT SUCCESS NOTIFICATION
    // ✅ ==========================================================
    
    await createPaymentNotification(order.user, 'payment_success', {
      amount: order.amount,
      serviceName: service?.name || 'service',
      serviceId: order.service,
      orderId: order._id,
      paymentId: payment._id,
      plan: order.plan,
      paymentMethod: paymentMethod,
      bankName: bankName || null,
      transactionId: razorpay_payment_id,
      metadata: {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
      },
    });

    // ✅ ==========================================================
    // ✅ CREATE SERVICE STATUS NOTIFICATION
    // ✅ ==========================================================
    
    await createServiceStatusNotification(order.user, serviceStatus, service);

    await session.commitTransaction();
    session.endSession();

    return successResponse(res, {
      message: "Payment verified successfully",
      data: {
        paymentId: payment._id,
        orderId: order._id,
        serviceId: order.service,
        paymentMethod: paymentMethod,
        paymentMethodLabel: getPaymentMethodLabel(paymentMethod),
        bankName: bankName || razorpayPayment?.bank || null,
        paymentMethodDetails: paymentMethodDetails,
        cardType: cardType,
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
// ✅ HELPER: Create Service Status Notification
// ==========================================================

const createServiceStatusNotification = async (userId, serviceStatus, service) => {
  const statusMap = {
    'pending': {
      type: 'service_pending',
      title: '⏳ Service Pending',
      message: `Your ${service?.name || 'service'} is pending review. We'll notify you once it's processed.`,
      priority: 'medium',
    },
    'processing': {
      type: 'service_processing',
      title: '🔄 Service Processing',
      message: `Your ${service?.name || 'service'} is being processed. Our team is working on it.`,
      priority: 'medium',
    },
    'active': {
      type: 'service_active',
      title: '✅ Service Activated',
      message: `🎉 Your ${service?.name || 'service'} has been activated successfully! You can now access all features.`,
      priority: 'high',
    },
    'completed': {
      type: 'service_completed',
      title: '🎉 Service Completed',
      message: `✅ Your ${service?.name || 'service'} has been completed successfully. Thank you for choosing us!`,
      priority: 'high',
    },
    'cancelled': {
      type: 'service_cancelled',
      title: '❌ Service Cancelled',
      message: `Your ${service?.name || 'service'} has been cancelled. If this was a mistake, please contact support.`,
      priority: 'urgent',
    },
  };

  const config = statusMap[serviceStatus?.status] || statusMap['processing'];

  try {
    const notification = await Notification.create({
      user: userId,
      type: config.type,
      title: config.title,
      message: config.message,
      priority: config.priority,
      actionUrl: '/dashboard',
      actionLabel: 'View Status',
      metadata: {
        serviceId: serviceStatus?.serviceId || null,
        serviceStatusId: serviceStatus?._id || null,
        serviceName: service?.name || null,
        status: serviceStatus?.status || null,
        plan: serviceStatus?.plan || null,
      },
      createdBy: "system",
    });

    logger.info(`✅ Service status notification created for user ${userId}`, {
      notificationId: notification._id,
      status: serviceStatus?.status,
      serviceName: service?.name,
    });

    return notification;
  } catch (error) {
    logger.error('Failed to create service status notification:', error);
    return null;
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

    const paymentsWithLabels = payments.map(payment => ({
      ...payment.toObject(),
      paymentMethodLabel: getPaymentMethodLabel(payment.paymentMethod),
      bankName: payment.bankName || null,
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
        { bankName: { $regex: search, $options: "i" } },
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

    const paymentsWithLabels = payments.map(payment => ({
      ...payment,
      paymentMethodLabel: getPaymentMethodLabel(payment.paymentMethod),
      bankName: payment.bankName || null,
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
// GET PAYMENT STATS
// ==========================================================

export const getPaymentStats = async (req, res) => {
  try {
    const stats = await Payment.getPaymentStats();
    const dailySummary = await Payment.getDailySummary(new Date());

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
                { case: { $eq: ['$_id', 'wallet'] }, then: 'Wallet' },
                { case: { $eq: ['$_id', 'emi'] }, then: 'EMI' },
                { case: { $eq: ['$_id', 'pay_later'] }, then: 'Pay Later' },
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

    const topBanks = await Payment.aggregate([
      {
        $match: { 
          paymentMethod: 'net_banking',
          paymentStatus: 'completed',
          bankName: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: '$bankName',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const methodDistribution = await Payment.aggregate([
      {
        $match: { paymentStatus: 'completed' }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          method: '$_id',
          count: 1,
          label: {
            $switch: {
              branches: [
                { case: { $eq: ['$_id', 'debit_card'] }, then: 'Debit Card' },
                { case: { $eq: ['$_id', 'credit_card'] }, then: 'Credit Card' },
                { case: { $eq: ['$_id', 'upi'] }, then: 'UPI' },
                { case: { $eq: ['$_id', 'net_banking'] }, then: 'Net Banking' },
                { case: { $eq: ['$_id', 'razorpay'] }, then: 'Razorpay' },
                { case: { $eq: ['$_id', 'wallet'] }, then: 'Wallet' },
                { case: { $eq: ['$_id', 'emi'] }, then: 'EMI' },
                { case: { $eq: ['$_id', 'pay_later'] }, then: 'Pay Later' },
              ],
              default: 'Other'
            }
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
        methodDistribution: methodDistribution,
        topBanks: topBanks,
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
// REFUND PAYMENT (With Notification)
// ==========================================================

export const refundPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const payment = await Payment.findById(id)
      .populate("user", "_id fullName email")
      .populate("service", "name");

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

    // Update order if full refund
    let order = null;
    if (refundAmount === payment.amount) {
      order = await Order.findById(payment.order);
      if (order) {
        order.orderStatus = "cancelled";
        order.cancelledAt = new Date();
        order.cancelledReason = "Refunded";
        await order.save();
      }
    }

    // ✅ ==========================================================
    // ✅ CREATE REFUND NOTIFICATION
    // ✅ ==========================================================
    
    const notificationType = refundAmount === payment.amount 
      ? 'payment_refunded' 
      : 'payment_partial_refund';

    await createPaymentNotification(payment.user._id, notificationType, {
      amount: refundAmount,
      serviceName: payment.service?.name || 'service',
      serviceId: payment.service?._id || null,
      orderId: payment.order || null,
      paymentId: payment._id,
      plan: payment.plan,
      paymentMethod: payment.paymentMethod,
      bankName: payment.bankName || null,
      transactionId: payment.transactionId || null,
      metadata: {
        refundReason: reason || 'Refund requested',
        originalAmount: payment.amount,
        isFullRefund: refundAmount === payment.amount,
      },
    });

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
// GET PAYMENT BY ORDER ID
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

    const paymentWithLabel = {
      ...payment.toObject(),
      paymentMethodLabel: getPaymentMethodLabel(payment.paymentMethod),
      bankName: payment.bankName || null,
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
// WEBHOOK HANDLER (With Notification on Failure)
// ==========================================================

export const webhookHandler = async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];

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
        const bankName = payload.payment.entity.bank || null;
        const method = payload.payment.entity.method || 'razorpay';
        
        const mappedMethod = mapRazorpayMethodToEnum(method, payload.payment.entity);
        
        await Payment.findOneAndUpdate(
          { razorpayOrderId: orderId },
          { 
            paymentStatus: "completed",
            razorpayPaymentId: paymentId,
            paidAt: new Date(),
            paymentMethod: mappedMethod,
            bankName: bankName,
            webhookReceived: true,
            webhookData: payload,
          }
        );
        break;
      }

      case "payment.failed": {
        const failedOrderId = payload.payment.entity.order_id;
        const failureReason = payload.payment.entity.error_description || "Payment failed";
        const paymentId = payload.payment.entity.id;
        
        // Update payment status
        await Payment.findOneAndUpdate(
          { razorpayOrderId: failedOrderId },
          {
            paymentStatus: "failed",
            failureReason: failureReason,
            razorpayPaymentId: paymentId,
            webhookReceived: true,
            webhookData: payload,
          }
        );

        // ✅ ==========================================================
        // ✅ CREATE PAYMENT FAILED NOTIFICATION
        // ✅ ==========================================================
        
        // Find the order to get user and service details
        const order = await Order.findOne({ razorpayOrderId: failedOrderId })
          .populate("user", "_id")
          .populate("service", "name");

        if (order) {
          await createPaymentNotification(order.user._id, 'payment_failed', {
            amount: order.amount,
            serviceName: order.service?.name || 'service',
            serviceId: order.service?._id || null,
            orderId: order._id,
            plan: order.plan,
            transactionId: paymentId,
            metadata: {
              failureReason: failureReason,
              razorpayOrderId: failedOrderId,
            },
          });
        }
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