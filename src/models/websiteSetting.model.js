import mongoose from "mongoose";

const websiteSettingSchema = new mongoose.Schema({
    siteTitle: {
        type: String,
        required: true,
        default: "My Website"
    },
    siteDescription: {
        type: String,
        required: true,
        default: "This is my website description."
    },
    siteKeywords: {
        type: [String],
        required: true,
        default: ["website", "service", "subscription"]
    },
    siteLogo: {
        type: String,
        default: ""
    },

    contactEmail: {
        type: String,
        required: true,
        match: [/\S+@\S+\.\S+/, 'Please use a valid email address.'],
        default: ""
    },
    contactPhone: {
        type: String,
        required: true,
        match: [/^\+?[1-9]\d{1,14}$/, 'Please use a valid phone number.'],
        default: ""
    },
    contactAddress: {
        type: String,
        required: true,
        default: ""
    },
    socialMedia: [
        {
            facebook: {
                type: String,
                default: ""
            },
            twitter: {
                type: String,
                default: ""
            },
            instagram: {
                type: String,
                default: ""
            }
        }
    ],

    razorpay: {
        keyId: {
            type: String,
            required: true
        },
        keySecret: {
            type: String,
            required: true
        },
        webhookSecret: {
            type: String,
            required: true
        }
    },
    smtp: {
        host: {
            type: String,
            required: true
        },
        port: {
            type: Number,
            required: true
        },
        username: {
            type: String,
            required: true
        },
        password: {
            type: String,
            required: true
        }
    },
    cloudinary: {
        cloudName: {
            type: String,
            required: true
        },
        apiKey: {
            type: String,
            required: true
        },
        apiSecret: {
            type: String,
            required: true
        }
    }

}, { timestamps: true });

const WebsiteSetting = mongoose.model("WebsiteSetting", websiteSettingSchema);

export default WebsiteSetting;