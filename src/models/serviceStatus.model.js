// models/serviceStatus.model.js

import mongoose from "mongoose";

const serviceStatusSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },
    subscribedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "active", "completed", "cancelled", "expired"],
      default: "pending",
    },
    plan: {
      type: String,
      enum: ["basic", "standard", "premium"],
      default: "basic",
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
serviceStatusSchema.index({ serviceId: 1, subscribedBy: 1 }, { unique: true });
serviceStatusSchema.index({ status: 1 });
serviceStatusSchema.index({ expiresAt: 1 });

const ServiceStatus = mongoose.models.ServiceStatus || mongoose.model("ServiceStatus", serviceStatusSchema);

export default ServiceStatus;