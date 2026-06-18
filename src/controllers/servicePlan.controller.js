// controllers/servicePlanController.js

import mongoose from "mongoose";
import ServicePlan from "../models/servicePlan.model.js";
import Service from "../models/service.model.js";
import {
    successResponse,
    errorResponse,
    createdResponse,
    notFoundResponse,
    badRequestResponse,
    conflictResponse,
    logger,
} from "../utils/index.js";

// ==========================================================
// GET ALL SERVICE PLANS
// ==========================================================

/**
 * @desc    Get all service plans
 * @route   GET /api/service-plans
 * @access  Public
 */
export const getServicePlans = async (req, res) => {
    try {
        const servicePlans = await ServicePlan.getAllWithServices();

        return successResponse(res, {
            message: "Service plans fetched successfully",
            data: servicePlans || [],
        });
    } catch (error) {
        logger.error("Error fetching service plans:", error);
        return errorResponse(res, {
            message: error.message || "Failed to fetch service plans",
        });
    }
};

// ==========================================================
// GET SERVICE PLAN BY SERVICE ID
// ==========================================================

/**
 * @desc    Get service plan by service ID
 * @route   GET /api/service-plans/:serviceId
 * @access  Public
 */
export const getServicePlanByServiceId = async (req, res) => {
    try {
        const { serviceId } = req.params;

        if (!serviceId) {
            return badRequestResponse(res, {
                message: "Service ID is required",
            });
        }

        const service = await Service.findById(serviceId);
        if (!service) {
            return notFoundResponse(res, {
                message: "Service not found",
            });
        }

        const servicePlan = await ServicePlan.getByServiceId(serviceId);

        if (!servicePlan) {
            return notFoundResponse(res, {
                message: "Service plan not found for this service",
            });
        }

        return successResponse(res, {
            message: "Service plan fetched successfully",
            data: servicePlan,
        });
    } catch (error) {
        logger.error("Error fetching service plan by service ID:", error);
        return errorResponse(res, {
            message: error.message || "Failed to fetch service plan",
        });
    }
};

// ==========================================================
// GET FORMATTED PLANS (Frontend Ready)
// ==========================================================

/**
 * @desc    Get formatted plans for frontend
 * @route   GET /api/service-plans/:serviceId/formatted
 * @access  Public
 */
// controllers/servicePlanController.js

// Update the getFormattedServicePlans function
export const getFormattedServicePlans = async (req, res) => {
  try {
    const { serviceId } = req.params;

    // Validate serviceId
    if (!serviceId || serviceId === 'undefined' || serviceId === 'null') {
      return res.status(400).json({
        success: false,
        message: "Valid Service ID is required",
      });
    }

    // Check if serviceId is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Service ID format",
      });
    }

    const servicePlan = await ServicePlan.getByServiceId(serviceId);

    if (!servicePlan) {
      return res.status(404).json({
        success: false,
        message: "Service plan not found for this service",
      });
    }

    // Format plans for frontend
    const formattedPlans = {};
    const planKeys = servicePlan.planOrder || Array.from(servicePlan.plans.keys());

    for (const key of planKeys) {
      const plan = servicePlan.plans.get(key);
      if (plan && plan.isActive !== false) {
        formattedPlans[key] = {
          tier: key,
          name: plan.name || key.charAt(0).toUpperCase() + key.slice(1),
          price: plan.price,
          discount: plan.discount || 0,
          finalPrice: plan.finalPrice,
          features: plan.features || [],
          isRecommended: plan.isRecommended || false,
          isPopular: plan.isPopular || false,
          isAllIncluded: plan.isAllIncluded || false,
          validTill: plan.validTill,
          description: plan.description || "",
          badge: plan.badge || "",
          order: plan.order || 0,
        };
      }
    }

    return successResponse(res, {
      message: "Service plans fetched successfully",
      data: {
        serviceId: servicePlan.serviceId,
        plans: formattedPlans,
        planOrder: servicePlan.planOrder,
      },
    });
  } catch (error) {
    logger.error("Error fetching formatted service plans:", error);
    return errorResponse(res, {
      message: error.message || "Failed to fetch service plans",
    });
  }
};

// ==========================================================
// CREATE SERVICE PLAN
// ==========================================================

/**
 * @desc    Create a new service plan with dynamic plans
 * @route   POST /api/service-plans
 * @access  Private/Admin
 */
export const createServicePlan = async (req, res) => {
    try {
        const { serviceId, plans, planOrder } = req.body;

        if (!serviceId) {
            return badRequestResponse(res, {
                message: "Service ID is required",
            });
        }

        if (!plans || typeof plans !== 'object' || Object.keys(plans).length === 0) {
            return badRequestResponse(res, {
                message: "At least one plan is required",
            });
        }

        // Check if service exists
        const service = await Service.findById(serviceId);
        if (!service) {
            return notFoundResponse(res, {
                message: "Service not found",
            });
        }

        // Check if plan already exists
        const existingPlan = await ServicePlan.findOne({ serviceId });
        if (existingPlan) {
            return conflictResponse(res, {
                message: "Service plan already exists. Use update instead.",
            });
        }

        // Validate and clean plan data
        const cleanedPlans = {};
        const planKeys = Object.keys(plans);

        for (const key of planKeys) {
            const plan = plans[key];
            
            // Remove finalPrice (will be calculated)
            delete plan.finalPrice;

            // Validate price
            if (plan.price === undefined || plan.price < 0) {
                return badRequestResponse(res, {
                    message: `Price for "${key}" plan is required and must be greater than or equal to 0`,
                });
            }

            // Set default values
            plan.name = plan.name || key.charAt(0).toUpperCase() + key.slice(1);
            plan.features = plan.features || [];
            plan.discount = plan.discount || 0;
            plan.isActive = plan.isActive !== false;

            cleanedPlans[key] = plan;
        }

        // Create service plan
        const servicePlan = await ServicePlan.create({
            serviceId,
            plans: cleanedPlans,
            planOrder: planOrder || Object.keys(cleanedPlans),
            createdBy: req.user._id,
            updatedBy: req.user._id,
        });

        await servicePlan.populate('serviceId', 'name slug category');

        return createdResponse(res, {
            message: "Service plan created successfully",
            data: servicePlan,
        });
    } catch (error) {
        logger.error("Error creating service plan:", error);
        return errorResponse(res, {
            message: error.message || "Failed to create service plan",
        });
    }
};

// ==========================================================
// UPDATE SERVICE PLAN (Dynamic)
// ==========================================================

/**
 * @desc    Update service plan - supports adding/removing/updating any plan
 * @route   PUT /api/service-plans/:serviceId
 * @access  Private/Admin
 */
export const updateServicePlan = async (req, res) => {
    try {
        const { serviceId } = req.params;

        if (!serviceId) {
            return badRequestResponse(res, {
                message: "Service ID is required",
            });
        }

        const servicePlan = await ServicePlan.findOne({ serviceId });

        if (!servicePlan) {
            return notFoundResponse(res, {
                message: "Service plan not found for this service",
            });
        }

        const { 
            plans,        // Object of plan updates { basic: {...}, premium: {...}, newPlan: {...} }
            planOrder,    // Array of plan keys in display order
            action,       // 'add', 'remove', 'update', 'reorder'
            planKey,      // For add/remove operations
            planData,     // For add/update operations
        } = req.body;

        // Handle different actions
        switch (action) {
            case 'add':
                // Add a new plan
                if (!planKey || !planData) {
                    return badRequestResponse(res, {
                        message: "planKey and planData are required for add action",
                    });
                }
                if (servicePlan.plans.has(planKey)) {
                    return conflictResponse(res, {
                        message: `Plan "${planKey}" already exists`,
                    });
                }
                delete planData.finalPrice;
                servicePlan.addPlan(planKey, planData);
                break;

            case 'remove':
                // Remove a plan
                if (!planKey) {
                    return badRequestResponse(res, {
                        message: "planKey is required for remove action",
                    });
                }
                if (!servicePlan.plans.has(planKey)) {
                    return notFoundResponse(res, {
                        message: `Plan "${planKey}" not found`,
                    });
                }
                servicePlan.removePlan(planKey);
                break;

            case 'reorder':
                // Reorder plans
                if (!planOrder || !Array.isArray(planOrder)) {
                    return badRequestResponse(res, {
                        message: "planOrder array is required for reorder action",
                    });
                }
                servicePlan.reorderPlans(planOrder);
                break;

            case 'update':
                // Update existing plan(s)
                if (!plans) {
                    return badRequestResponse(res, {
                        message: "plans object is required for update action",
                    });
                }
                for (const key of Object.keys(plans)) {
                    if (!servicePlan.plans.has(key)) {
                        return notFoundResponse(res, {
                            message: `Plan "${key}" not found`,
                        });
                    }
                    const updateData = plans[key];
                    delete updateData.finalPrice;
                    servicePlan.updatePlan(key, updateData);
                }
                break;

            default:
                // Default: update all plans from the plans object
                if (plans) {
                    for (const key of Object.keys(plans)) {
                        if (servicePlan.plans.has(key)) {
                            const updateData = plans[key];
                            delete updateData.finalPrice;
                            servicePlan.updatePlan(key, updateData);
                        } else {
                            // If plan doesn't exist, add it
                            const newPlan = plans[key];
                            delete newPlan.finalPrice;
                            servicePlan.addPlan(key, newPlan);
                        }
                    }
                }

                if (planOrder && Array.isArray(planOrder)) {
                    servicePlan.reorderPlans(planOrder);
                }
                break;
        }

        // Update audit
        servicePlan.updatedBy = req.user._id;
        servicePlan.markModified('plans');

        await servicePlan.save();

        await servicePlan.populate('serviceId', 'name slug category');

        return successResponse(res, {
            message: "Service plan updated successfully",
            data: servicePlan,
        });
    } catch (error) {
        logger.error("Error updating service plan:", error);
        return errorResponse(res, {
            message: error.message || "Failed to update service plan",
        });
    }
};

// ==========================================================
// DELETE SERVICE PLAN
// ==========================================================

/**
 * @desc    Delete service plan
 * @route   DELETE /api/service-plans/:serviceId
 * @access  Private/Admin
 */
export const deleteServicePlan = async (req, res) => {
    try {
        const { serviceId } = req.params;

        if (!serviceId) {
            return badRequestResponse(res, {
                message: "Service ID is required",
            });
        }

        const deletedPlan = await ServicePlan.findOneAndDelete({ serviceId });

        if (!deletedPlan) {
            return notFoundResponse(res, {
                message: "Service plan not found for this service",
            });
        }

        return successResponse(res, {
            message: "Service plan deleted successfully",
            data: {
                serviceId: deletedPlan.serviceId,
                deletedAt: new Date().toISOString(),
            },
        });
    } catch (error) {
        logger.error("Error deleting service plan:", error);
        return errorResponse(res, {
            message: error.message || "Failed to delete service plan",
        });
    }
};

// ==========================================================
// ADD SINGLE PLAN TO EXISTING SERVICE PLAN
// ==========================================================

/**
 * @desc    Add a new plan to existing service plan
 * @route   POST /api/service-plans/:serviceId/plans
 * @access  Private/Admin
 */
export const addPlanToService = async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { planKey, planData } = req.body;

        if (!serviceId || !planKey || !planData) {
            return badRequestResponse(res, {
                message: "serviceId, planKey, and planData are required",
            });
        }

        const servicePlan = await ServicePlan.findOne({ serviceId });

        if (!servicePlan) {
            return notFoundResponse(res, {
                message: "Service plan not found for this service",
            });
        }

        if (servicePlan.plans.has(planKey)) {
            return conflictResponse(res, {
                message: `Plan "${planKey}" already exists`,
            });
        }

        delete planData.finalPrice;
        servicePlan.addPlan(planKey, planData);
        servicePlan.updatedBy = req.user._id;
        servicePlan.markModified('plans');

        await servicePlan.save();
        await servicePlan.populate('serviceId', 'name slug category');

        return createdResponse(res, {
            message: `Plan "${planKey}" added successfully`,
            data: servicePlan,
        });
    } catch (error) {
        logger.error("Error adding plan:", error);
        return errorResponse(res, {
            message: error.message || "Failed to add plan",
        });
    }
};

// ==========================================================
// REMOVE SINGLE PLAN FROM SERVICE PLAN
// ==========================================================

/**
 * @desc    Remove a plan from service plan
 * @route   DELETE /api/service-plans/:serviceId/plans/:planKey
 * @access  Private/Admin
 */
export const removePlanFromService = async (req, res) => {
    try {
        const { serviceId, planKey } = req.params;

        if (!serviceId || !planKey) {
            return badRequestResponse(res, {
                message: "serviceId and planKey are required",
            });
        }

        const servicePlan = await ServicePlan.findOne({ serviceId });

        if (!servicePlan) {
            return notFoundResponse(res, {
                message: "Service plan not found for this service",
            });
        }

        if (!servicePlan.plans.has(planKey)) {
            return notFoundResponse(res, {
                message: `Plan "${planKey}" not found`,
            });
        }

        servicePlan.removePlan(planKey);
        servicePlan.updatedBy = req.user._id;
        servicePlan.markModified('plans');

        await servicePlan.save();
        await servicePlan.populate('serviceId', 'name slug category');

        return successResponse(res, {
            message: `Plan "${planKey}" removed successfully`,
            data: servicePlan,
        });
    } catch (error) {
        logger.error("Error removing plan:", error);
        return errorResponse(res, {
            message: error.message || "Failed to remove plan",
        });
    }
};

// ==========================================================
// UPDATE SINGLE PLAN
// ==========================================================

/**
 * @desc    Update a specific plan
 * @route   PUT /api/service-plans/:serviceId/plans/:planKey
 * @access  Private/Admin
 */
export const updateSinglePlan = async (req, res) => {
    try {
        const { serviceId, planKey } = req.params;
        const planData = req.body;

        if (!serviceId || !planKey || !planData) {
            return badRequestResponse(res, {
                message: "serviceId, planKey, and planData are required",
            });
        }

        const servicePlan = await ServicePlan.findOne({ serviceId });

        if (!servicePlan) {
            return notFoundResponse(res, {
                message: "Service plan not found for this service",
            });
        }

        if (!servicePlan.plans.has(planKey)) {
            return notFoundResponse(res, {
                message: `Plan "${planKey}" not found`,
            });
        }

        delete planData.finalPrice;
        servicePlan.updatePlan(planKey, planData);
        servicePlan.updatedBy = req.user._id;
        servicePlan.markModified('plans');

        await servicePlan.save();
        await servicePlan.populate('serviceId', 'name slug category');

        return successResponse(res, {
            message: `Plan "${planKey}" updated successfully`,
            data: servicePlan,
        });
    } catch (error) {
        logger.error("Error updating plan:", error);
        return errorResponse(res, {
            message: error.message || "Failed to update plan",
        });
    }
};

// ==========================================================
// REORDER PLANS
// ==========================================================

/**
 * @desc    Reorder plans
 * @route   PUT /api/service-plans/:serviceId/reorder
 * @access  Private/Admin
 */
export const reorderPlans = async (req, res) => {
    try {
        const { serviceId } = req.params;
        const { planOrder } = req.body;

        if (!serviceId || !planOrder || !Array.isArray(planOrder)) {
            return badRequestResponse(res, {
                message: "serviceId and planOrder array are required",
            });
        }

        const servicePlan = await ServicePlan.findOne({ serviceId });

        if (!servicePlan) {
            return notFoundResponse(res, {
                message: "Service plan not found for this service",
            });
        }

        servicePlan.reorderPlans(planOrder);
        servicePlan.updatedBy = req.user._id;
        servicePlan.markModified('plans');

        await servicePlan.save();

        return successResponse(res, {
            message: "Plans reordered successfully",
            data: {
                planOrder: servicePlan.planOrder,
            },
        });
    } catch (error) {
        logger.error("Error reordering plans:", error);
        return errorResponse(res, {
            message: error.message || "Failed to reorder plans",
        });
    }
};

// ==========================================================
// BULK CREATE/UPDATE PLANS
// ==========================================================

/**
 * @desc    Bulk create or update service plans
 * @route   POST /api/service-plans/bulk
 * @access  Private/Admin
 */
export const bulkServicePlans = async (req, res) => {
    try {
        const { plans } = req.body;

        if (!plans || !Array.isArray(plans) || plans.length === 0) {
            return badRequestResponse(res, {
                message: "Please provide an array of service plans",
            });
        }

        const results = {
            created: [],
            updated: [],
            failed: [],
        };

        for (const planData of plans) {
            try {
                const { serviceId, plans: planTiers, planOrder } = planData;

                if (!serviceId) {
                    results.failed.push({ data: planData, error: "Service ID is required" });
                    continue;
                }

                const service = await Service.findById(serviceId);
                if (!service) {
                    results.failed.push({ data: planData, error: "Service not found" });
                    continue;
                }

                const existingPlan = await ServicePlan.findOne({ serviceId });

                // Clean plan data
                const cleanedPlans = {};
                for (const key of Object.keys(planTiers || {})) {
                    const plan = planTiers[key];
                    delete plan.finalPrice;
                    plan.name = plan.name || key.charAt(0).toUpperCase() + key.slice(1);
                    plan.features = plan.features || [];
                    plan.discount = plan.discount || 0;
                    plan.isActive = plan.isActive !== false;
                    cleanedPlans[key] = plan;
                }

                if (existingPlan) {
                    // Update existing
                    for (const key of Object.keys(cleanedPlans)) {
                        if (existingPlan.plans.has(key)) {
                            existingPlan.updatePlan(key, cleanedPlans[key]);
                        } else {
                            existingPlan.addPlan(key, cleanedPlans[key]);
                        }
                    }
                    if (planOrder) {
                        existingPlan.reorderPlans(planOrder);
                    }
                    existingPlan.updatedBy = req.user._id;
                    existingPlan.markModified('plans');
                    await existingPlan.save();
                    results.updated.push(existingPlan);
                } else {
                    // Create new
                    const newPlan = await ServicePlan.create({
                        serviceId,
                        plans: cleanedPlans,
                        planOrder: planOrder || Object.keys(cleanedPlans),
                        createdBy: req.user._id,
                        updatedBy: req.user._id,
                    });
                    results.created.push(newPlan);
                }
            } catch (error) {
                results.failed.push({ data: planData, error: error.message });
            }
        }

        return successResponse(res, {
            message: "Bulk operation completed",
            data: results,
        });
    } catch (error) {
        logger.error("Error in bulk service plans:", error);
        return errorResponse(res, {
            message: error.message || "Failed to process bulk operation",
        });
    }
};

// ==========================================================
// EXPORT ALL
// ==========================================================

export default {
    getServicePlans,
    getServicePlanByServiceId,
    getFormattedServicePlans,
    createServicePlan,
    updateServicePlan,
    deleteServicePlan,
    addPlanToService,
    removePlanFromService,
    updateSinglePlan,
    reorderPlans,
    bulkServicePlans,
};