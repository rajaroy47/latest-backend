// app.js

import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

// Import Routes
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import servicePlanRoutes from "./routes/servicePlan.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import serviceStatusRoutes from "./routes/serviceStatus.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";

// Import Utils
import { logger } from "./utils/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// ==========================================================
// CORS CONFIGURATION
// ==========================================================

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
    "http://localhost:3001",
    process.env.FRONTEND_URL,
    "https://lavender-lark-113297.hostingersite.com",
].filter(Boolean);

app.use(
    cors({
        origin: function (origin, callback) {
            // ✅ Fix: Allow server-to-server or platform internal pings cleanly
            if (!origin) return callback(null, true);
            
            if (allowedOrigins.indexOf(origin) !== -1) {
                callback(null, true);
            } else {
                logger.warn(`❌ CORS blocked: ${origin}`);
                // In development, allow all origins seamlessly
                if (process.env.NODE_ENV === "development") {
                    callback(null, true);
                } else {
                    // Safe production fallback text
                    callback(new Error('Not allowed by CORS Architecture'));
                }
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Cookie",
            "X-Requested-With",
            "Accept",
            "Origin",
        ],
        exposedHeaders: ["Set-Cookie"],
        maxAge: 86400, // 24 hours
    })
);

// ==========================================================
// MIDDLEWARE
// ==========================================================

// Body parsers
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Cookie parser
app.use(cookieParser());

// ✅ Vercel-Safe Static Files Fallback
// Serverless functions cannot persistently hold files locally. 
// This remains active for your local development structure seamlessly.
if (process.env.NODE_ENV !== "production") {
    app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
}

// ==========================================================
// LOGGING MIDDLEWARE (Development only)
// ==========================================================

if (process.env.NODE_ENV === "development") {
    app.use((req, res, next) => {
        logger.info(`📡 ${req.method} ${req.originalUrl}`);
        next();
    });
}

// ==========================================================
// HEALTH CHECK ENDPOINTS
// ==========================================================

app.get("/health", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "Server is healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        uptime: process.uptime(),
    });
});

app.get("/api/health", (req, res) => {
    return res.status(200).json({
        success: true,
        message: "API is healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        version: "1.0.0",
    });
});

// ==========================================================
// API ROUTES
// ==========================================================

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/public/services", serviceRoutes);
app.use("/api/services", serviceRoutes); 
app.use("/api/service-plans", servicePlanRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/service-status", serviceStatusRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/invoices", invoiceRoutes);

// ==========================================================
// 404 HANDLER
// ==========================================================

app.use((req, res) => {
    logger.warn(`❌ 404 Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        success: false,
        message: "Route not found",
        path: req.originalUrl,
        method: req.method,
    });
});

// ==========================================================
// GLOBAL ERROR HANDLER
// ==========================================================

app.use((err, req, res, next) => {
    logger.error(`❌ Error Details: ${err.message}`);
    if (process.env.NODE_ENV === "development" && err.stack) {
        logger.error(err.stack);
    }

    const statusCode = err.status || 500;
    const message = err.message || "Internal Server Error";

    res.status(statusCode).json({
        success: false,
        message: message,
        ...(process.env.NODE_ENV === "development" && {
            stack: err.stack,
            details: err,
        }),
    });
});

// ==========================================================
// EXPORT APP
// ==========================================================

export default app;