// models/servicePlan.model.js

import mongoose from "mongoose";

// Individual plan schema (reusable)
const planItemSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    discount: {
        type: Number,
        default: 0,
        min: 0,
    },
    finalPrice: {
        type: Number,
        default: 0,
    },
    features: {
        type: [String],
        default: [],
    },
    isRecommended: {
        type: Boolean,
        default: false,
    },
    isPopular: {
        type: Boolean,
        default: false,
    },
    isAllIncluded: {
        type: Boolean,
        default: false,
    },
    validTill: {
        type: Date,
        default: null,
    },
    description: {
        type: String,
        trim: true,
        default: "",
    },
    badge: {
        type: String,
        trim: true,
        default: "",
    },
    order: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, { _id: false, timestamps: false });

// Main Service Plan Schema
const ServicePlanSchema = new mongoose.Schema({
    serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
        required: true,
        unique: true,
        index: true,
    },
    // Dynamic plans object - any plan name can be added
    plans: {
        type: Map,
        of: planItemSchema,
        default: {},
    },
    // Plan order for display
    planOrder: {
        type: [String],
        default: ['basic', 'standard', 'premium', 'enterprise', 'special'],
    },
    // Metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

// ==========================================================
// INDEXES
// ==========================================================

ServicePlanSchema.index({ "plans.isActive": 1 });

// ==========================================================
// PRE-SAVE MIDDLEWARE - Calculate finalPrice for all plans (FIXED - NO next)
// ==========================================================

ServicePlanSchema.pre('save', function () {
    try {
        // Get all plan keys
        const planKeys = Array.from(this.plans.keys());

        planKeys.forEach((key) => {
            const plan = this.plans.get(key);
            if (plan) {
                const price = Number(plan.price) || 0;
                const discount = Number(plan.discount) || 0;
                plan.finalPrice = Math.max(0, price - discount);
            }
        });
    } catch (error) {
        // Throw error to be caught by save()
        throw error;
    }
});

// ==========================================================
// INSTANCE METHODS
// ==========================================================

/**
 * Get all plans as array with tier names
 * @returns {Array} Array of plan objects with tier key
 */
ServicePlanSchema.methods.getPlansArray = function () {
    const result = [];
    const planKeys = this.planOrder || Array.from(this.plans.keys());

    for (const key of planKeys) {
        const plan = this.plans.get(key);
        if (plan && plan.isActive !== false) {
            result.push({
                tier: key,
                ...plan.toObject(),
            });
        }
    }

    return result;
};

/**
 * Get active plans (valid till check)
 * @returns {Array} Array of active plans
 */
ServicePlanSchema.methods.getActivePlans = function () {
    const now = new Date();
    const result = [];
    const planKeys = this.planOrder || Array.from(this.plans.keys());

    for (const key of planKeys) {
        const plan = this.plans.get(key);
        if (plan && plan.isActive !== false) {
            // Check if valid till is null or future date
            if (!plan.validTill || new Date(plan.validTill) > now) {
                result.push({
                    tier: key,
                    ...plan.toObject(),
                });
            }
        }
    }

    return result;
};

/**
 * Add a new plan
 * @param {string} key - Plan key (e.g., 'basic', 'premium', 'enterprise')
 * @param {Object} planData - Plan data
 * @returns {Object} Updated plan
 */
ServicePlanSchema.methods.addPlan = function (key, planData) {
    if (this.plans.has(key)) {
        throw new Error(`Plan with key "${key}" already exists`);
    }

    // Remove finalPrice if provided (will be calculated)
    delete planData.finalPrice;

    this.plans.set(key, planData);

    // Add to order if not already there
    if (!this.planOrder.includes(key)) {
        this.planOrder.push(key);
    }

    return this.plans.get(key);
};

/**
 * Remove a plan
 * @param {string} key - Plan key to remove
 * @returns {boolean} True if removed
 */
ServicePlanSchema.methods.removePlan = function (key) {
    if (!this.plans.has(key)) {
        return false;
    }

    this.plans.delete(key);
    this.planOrder = this.planOrder.filter(k => k !== key);

    return true;
};

/**
 * Update a plan
 * @param {string} key - Plan key
 * @param {Object} planData - Updated plan data
 * @returns {Object} Updated plan
 */
ServicePlanSchema.methods.updatePlan = function (key, planData) {
    if (!this.plans.has(key)) {
        throw new Error(`Plan with key "${key}" not found`);
    }

    const existingPlan = this.plans.get(key);
    delete planData.finalPrice;

    this.plans.set(key, {
        ...existingPlan.toObject(),
        ...planData,
    });

    return this.plans.get(key);
};

/**
 * Reorder plans
 * @param {Array} order - Array of plan keys in desired order
 */
ServicePlanSchema.methods.reorderPlans = function (order) {
    const validKeys = order.filter(key => this.plans.has(key));
    this.planOrder = validKeys;
};

// ==========================================================
// STATIC METHODS
// ==========================================================

/**
 * Get plan by service ID with populated service
 * @param {string} serviceId - Service ID
 * @returns {Promise<Object>} Service plan document
 */
ServicePlanSchema.statics.getByServiceId = function (serviceId) {
    return this.findOne({ serviceId })
        .populate('serviceId', 'name slug category shortDescription serviceImage');
};

/**
 * Get all plans with populated services
 * @returns {Promise<Array>} Array of service plans
 */
ServicePlanSchema.statics.getAllWithServices = function () {
    return this.find({ isActive: true })
        .populate('serviceId', 'name slug category shortDescription serviceImage')
        .sort({ createdAt: -1 });
};

/**
 * Get plans by multiple service IDs
 * @param {Array} serviceIds - Array of service IDs
 * @returns {Promise<Array>} Array of service plans
 */
ServicePlanSchema.statics.getByServiceIds = function (serviceIds) {
    return this.find({ 
        serviceId: { $in: serviceIds },
        isActive: true,
    }).populate('serviceId', 'name slug category');
};

// ==========================================================
// MODEL EXPORT
// ==========================================================

const ServicePlan = mongoose.models.ServicePlan || mongoose.model("ServicePlan", ServicePlanSchema);

export default ServicePlan;