import WebsiteSetting from "../models/websiteSetting.model.js";

/**
 * Get the global website settings
 * GET /api/v1/settings
 */
export const getWebsiteSettings = async (req, res) => {
  try {
    // Fetch the single settings document (or return defaults if empty)
    let settings = await WebsiteSetting.findOne();

    if (!settings) {
      // If no settings document exists yet, return an empty object or handle gracefully
      return res.status(200).json({
        success: true,
        message: "No settings configured yet. Returning system defaults.",
        settings: {}
      });
    }

    return res.status(200).json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Error fetching website settings:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error while fetching settings.",
    });
  }
};

/**
 * Update or Create (Upsert) global website settings
 * POST /api/v1/settings
 */
export const updateWebsiteSettings = async (req, res) => {
  try {
    const {
      siteTitle,
      siteDescription,
      siteKeywords,
      siteLogo,
      contactEmail,
      contactPhone,
      contactAddress,
      socialMedia,
      razorpay,
      smtp,
      cloudinary,
    } = req.body;

    // Build the update payload dynamically based on what was provided
    const updateData = {
      siteTitle,
      siteDescription,
      siteKeywords,
      siteLogo,
      contactEmail,
      contactPhone,
      contactAddress,
      socialMedia,
      razorpay,
      smtp,
      cloudinary,
    };

    // 🌟 PROFESSIONAL UPSERT LOGIC
    // Since we only want ONE configuration block globally, we pass an empty filter {}
    // 'upsert: true' creates it if missing; 'new: true' returns the modified document.
    // 'runValidators: true' forces Mongoose to check your Regex matches for email/phone.
    const updatedSettings = await WebsiteSetting.findOneAndUpdate(
      {},
      { $set: updateData },
      { returnDocument: "after", upsert: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: "Website settings updated successfully",
      settings: updatedSettings,
    });
  } catch (error) {
    console.error("Error updating website settings:", error);

    // Capture Mongoose validation failures cleanly (like bad phone pattern or missing fields)
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((val) => val.message);
      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors: messages,
      });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error while saving configurations.",
    });
  }
};