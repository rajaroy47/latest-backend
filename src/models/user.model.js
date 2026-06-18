// models/User.js

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const userSchema = new mongoose.Schema({
    // =====================
    // BASIC INFORMATION
    // =====================
    fullName: {
        type: String,
        required: [true, 'Full name is required'],
        trim: true,
        minlength: 2,
        maxlength: 100,
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address'],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: 6,
        select: false, // Don't return password by default
    },

    // =====================
    // ROLE & PERMISSIONS
    // =====================
    role: {
        type: String,
        enum: ['user', 'admin', 'editor', 'viewer'],
        default: 'user',
    },
    permissions: {
        type: [String],
        default: [],
    },

    // =====================
    // PROFILE
    // =====================
    avatar: {
        type: String,
        default: '',
    },
    phone: {
        type: String,
        trim: true,
        match: [/^\+?[1-9]\d{1,14}$/, 'Please fill a valid phone number'],
    },
    bio: {
        type: String,
        trim: true,
        maxlength: 500,
        default: '',
    },

    // =====================
    // USER DETAILS (Nested)
    // =====================
    userDetails: {
        address: {
            streetAddress: { type: String, trim: true, default: '' },
            city: { type: String, trim: true, default: '' },
            state: { type: String, trim: true, default: '' },
            postalCode: {
                type: String,
                trim: true,
                match: [/^\d{6}$/, 'Please fill a valid 6-digit Pincode'],
                default: '',
            },
            country: { type: String, default: 'India', trim: true },
        },
        identity: {
            panCard: {
                type: String,
                uppercase: true,
                trim: true,
                match: [/[A-Z]{5}[0-9]{4}[A-Z]{1}/, 'Please fill a valid PAN card number'],
                default: '',
            },
            aadhaarCard: {
                type: String,
                trim: true,
                match: [/^\d{12}$/, 'Please fill a valid 12-digit Aadhaar number'],
                default: '',
            },
            gstNumber: {
                type: String,
                uppercase: true,
                trim: true,
                match: [/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Please fill a valid GST number'],
                default: '',
            },
        },
        company: {
            name: { type: String, trim: true, default: '' },
            designation: { type: String, trim: true, default: '' },
            industry: { type: String, trim: true, default: '' },
            website: { type: String, trim: true, default: '' },
        },
        social: {
            linkedin: { type: String, trim: true, default: '' },
            twitter: { type: String, trim: true, default: '' },
            facebook: { type: String, trim: true, default: '' },
            instagram: { type: String, trim: true, default: '' },
        },
        preferences: {
            language: { type: String, default: 'en' },
            notifications: { type: Boolean, default: true },
            emailUpdates: { type: Boolean, default: true },
            darkMode: { type: Boolean, default: false },
        }
    },

    // =====================
    // VERIFICATION
    // =====================
    isVerified: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
    verificationToken: {
        type: String,
        select: false,
    },
    verificationTokenExpiry: {
        type: Date,
        select: false,
    },
    resetPasswordToken: {
        type: String,
        select: false,
    },
    resetPasswordExpiry: {
        type: Date,
        select: false,
    },

    // =====================
    // AUTHENTICATION
    // =====================
    refreshToken: {
        type: String,
        select: false,
    },
    lastLogin: {
        type: Date,
        default: null,
    },
    passwordChangedAt: {
        type: Date,
        default: null,
    },
    failedLoginAttempts: {
        type: Number,
        default: 0,
        min: 0,
        max: 10,
    },
    lockedUntil: {
        type: Date,
        default: null,
    },

    // =====================
    // AUDIT
    // =====================
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },

}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            delete ret.password;
            delete ret.refreshToken;
            delete ret.verificationToken;
            delete ret.verificationTokenExpiry;
            delete ret.resetPasswordToken;
            delete ret.resetPasswordExpiry;
            delete ret.__v;
            return ret;
        }
    },
    toObject: {
        transform: function (doc, ret) {
            delete ret.password;
            delete ret.refreshToken;
            delete ret.verificationToken;
            delete ret.verificationTokenExpiry;
            delete ret.resetPasswordToken;
            delete ret.resetPasswordExpiry;
            delete ret.__v;
            return ret;
        }
    }
});

// ==========================================================
// INDEXES
// ==========================================================

userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ isDeleted: 1 });
userSchema.index({ email: 1, isActive: 1, isDeleted: 1 });

// ==========================================================
// MIDDLEWARE - Pre-save
// ==========================================================

// Hash password before saving
userSchema.pre('save', async function () {
    try {
        // Only hash if password is modified
        if (!this.isModified('password')) return;

        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        
        // Set password changed timestamp for existing users
        if (!this.isNew) {
            this.passwordChangedAt = new Date();
        }
    } catch (error) {
        throw error;
    }
});

// Middleware to exclude deleted users from queries
userSchema.pre('find', function () {
    if (!this.getOptions().includeDeleted) {
        this.where({ isDeleted: false });
    }
});

// ==========================================================
// VIRTUALS
// ==========================================================

// Full name virtual
userSchema.virtual('displayName').get(function () {
    return this.fullName || this.email || 'User';
});

// Is locked account
userSchema.virtual('isLocked').get(function () {
    if (!this.lockedUntil) return false;
    return this.lockedUntil > new Date();
});

// ==========================================================
// INSTANCE METHODS
// ==========================================================

// Compare password
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Check if password changed after JWT issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function () {
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    this.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
    
    this.resetPasswordExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    return resetToken;
};

// Create email verification token
userSchema.methods.createVerificationToken = function () {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    this.verificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');
    
    this.verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    return verificationToken;
};

// Increment failed login attempts
userSchema.methods.incrementFailedLogin = async function () {
    this.failedLoginAttempts += 1;
    
    // Lock account after 5 failed attempts
    if (this.failedLoginAttempts >= 5) {
        this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // Lock for 30 minutes
    }
    
    await this.save();
};

// Reset failed login attempts
userSchema.methods.resetFailedLogin = async function () {
    this.failedLoginAttempts = 0;
    this.lockedUntil = null;
    await this.save();
};

// Soft delete
userSchema.methods.softDelete = async function () {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.isActive = false;
    return this.save();
};

// Restore deleted user
userSchema.methods.restore = async function () {
    this.isDeleted = false;
    this.deletedAt = null;
    this.isActive = true;
    return this.save();
};

// ==========================================================
// STATIC METHODS
// ==========================================================

// Find by email (case insensitive)
userSchema.statics.findByEmail = function (email) {
    return this.findOne({ 
        email: { $regex: new RegExp(`^${email}$`, 'i') },
        isDeleted: false 
    });
};

// Get active users
userSchema.statics.getActiveUsers = function () {
    return this.find({ isActive: true, isDeleted: false });
};

// Get admin users
userSchema.statics.getAdmins = function () {
    return this.find({ 
        role: 'admin', 
        isActive: true, 
        isDeleted: false 
    });
};

// Bulk update status
userSchema.statics.bulkUpdateStatus = async function (userIds, status) {
    return this.updateMany(
        { _id: { $in: userIds } },
        { isActive: status }
    );
};

// Bulk delete
userSchema.statics.bulkDelete = async function (userIds) {
    return this.updateMany(
        { _id: { $in: userIds } },
        { 
            isDeleted: true, 
            deletedAt: new Date(),
            isActive: false 
        }
    );
};

// ==========================================================
// MODEL EXPORT
// ==========================================================

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;