// models/Service.js

import mongoose from "mongoose";
import slugify from "slugify";

const { Schema } = mongoose;

/* ==========================================================
1. ATOMIC / REUSABLE SCHEMAS
========================================================== */

// Key-Value Facts
const keyValuePairSchema = new Schema(
  {
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    variant: {
      type: String,
      enum: ["default", "primary", "success", "warning", "danger", "info"],
      default: "default",
    },
    icon: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

// CTA Link
const linkSchema = new Schema(
  {
    label: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    url: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { _id: false }
);

// Generic Block Item
const blockItemSchema = new Schema(
  {
    title: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    subtitle: {
      type: String,
      trim: true,
      maxlength: 250,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    icon: {
      type: String,
      trim: true,
      default: "",
    },
    badge: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    image: {
      type: String,
      trim: true,
      default: "",
    },
    link: {
      type: linkSchema,
      default: () => ({}),
    },
  },
  { _id: false }
);

// Accordion Item
const accordionItemSchema = new Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    answer: {
      type: String,
      required: true,
      trim: true,
    },
    badge: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

// Checklist Item
const checklistItemSchema = new Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },
    checked: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

/* ==========================================================
2. UNIVERSAL TABLE ENGINE
========================================================== */

const tableRowSchema = new Schema(
  {
    cells: {
      type: [String],
      validate: {
        validator: function(arr) {
          return arr.length > 0;
        },
        message: "Each table row must contain at least one cell.",
      },
      default: [],
    },
  },
  { _id: false }
);

const universalTableSchema = new Schema(
  {
    headers: {
      type: [String],
      validate: {
        validator: function(arr) {
          return arr.length > 0;
        },
        message: "Table must have at least one header.",
      },
      default: [],
    },
    rows: {
      type: [tableRowSchema],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 200;
        },
        message: "Maximum 200 table rows allowed.",
      },
    },
    caption: {
      type: String,
      trim: true,
      default: "",
    },
    searchable: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

/* ==========================================================
3. SECTION STYLE ENGINE
========================================================== */

const sectionStyleSchema = new Schema(
  {
    backgroundColor: {
      type: String,
      default: "inherit",
    },
    layoutWidth: {
      type: String,
      enum: ["normal", "wide", "narrow", "full"],
      default: "normal",
    },
    className: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

/* ==========================================================
4. UNIVERSAL SECTION SCHEMA
========================================================== */

const serviceSectionSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    subtitle: {
      type: String,
      trim: true,
      default: "",
    },
    type: {
      type: String,
      required: true,
      enum: [
        "richtext",
        "accordion",
        "timeline",
        "grid",
        "list",
        "table",
        "callout",
        "cta-block",
        "comparison",
        "statistics",
        "testimonial",
        "checklist",
        "faq",
        "video",
      ],
      default: "richtext",
    },
    richTextContent: {
      type: String,
      default: "",
    },
    items: {
      type: [blockItemSchema],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 100;
        },
        message: "Maximum 100 items allowed per section.",
      },
    },
    accordionItems: {
      type: [accordionItemSchema],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 100;
        },
        message: "Maximum 100 accordion items allowed.",
      },
    },
    checklistItems: {
      type: [checklistItemSchema],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 100;
        },
        message: "Maximum 100 checklist items allowed.",
      },
    },
    tableData: {
      type: universalTableSchema,
      default: null,
    },
    videoUrl: {
      type: String,
      trim: true,
      default: "",
    },
    button: {
      type: linkSchema,
      default: () => ({}),
    },
    order: {
      type: Number,
      default: 0,
    },
    visible: {
      type: Boolean,
      default: true,
    },
    styles: {
      type: sectionStyleSchema,
      default: () => ({}),
    },
  },
  { _id: false }
);

/* ==========================================================
5. SIDEBAR CARD SCHEMA
========================================================== */

const sidebarCardSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: [
        "cta-form",
        "contact-expert",
        "document-checklist",
        "html-custom",
        "callout",
        "links",
      ],
      default: "cta-form",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    buttonText: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "Apply Now",
    },
    buttonLink: {
      type: String,
      trim: true,
      default: "",
    },
    items: {
      type: [String],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 20;
        },
        message: "Maximum 20 sidebar items allowed.",
      },
    },
    icon: {
      type: String,
      trim: true,
      default: "",
    },
    image: {
      type: String,
      trim: true,
      default: "",
    },
    order: {
      type: Number,
      default: 0,
    },
    visible: {
      type: Boolean,
      default: true,
    },
  },
  { _id: false }
);

/* ==========================================================
6. HERO SCHEMA
========================================================== */

const heroSchema = new Schema(
  {
    title: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    backgroundImage: {
      type: String,
      trim: true,
      default: "",
    },
    primaryCTA: {
      type: linkSchema,
      default: () => ({
        label: "Get Started",
        url: "",
      }),
    },
    secondaryCTA: {
      type: linkSchema,
      default: () => ({
        label: "",
        url: "",
      }),
    },
    quickFacts: {
      type: [keyValuePairSchema],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 10;
        },
        message: "Maximum 10 quick facts allowed.",
      },
    },
  },
  { _id: false }
);

/* ==========================================================
7. SEO SCHEMA
========================================================== */

const seoSchema = new Schema(
  {
    metaTitle: {
      type: String,
      trim: true,
      maxlength: 70,
      default: "",
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    metaKeywords: {
      type: [String],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 30;
        },
        message: "Maximum 30 SEO keywords allowed.",
      },
    },
    canonicalUrl: {
      type: String,
      trim: true,
      default: "",
    },
    ogImage: {
      type: String,
      trim: true,
      default: "",
    },
    schemaMarkup: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

/* ==========================================================
8. METRICS SCHEMA
========================================================== */

const metricsSchema = new Schema(
  {
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 5,
    },
    reviewsCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalUsersServed: {
      type: String,
      trim: true,
      default: "1000+",
    },
  },
  { _id: false }
);

/* ==========================================================
9. FLAGS SCHEMA
========================================================== */

const flagsSchema = new Schema(
  {
    isPopular: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    isNew: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

/* ==========================================================
10. MAIN SERVICE SCHEMA
========================================================== */

const serviceSchema = new Schema(
  {
    /* =====================
BASIC INFORMATION
===================== */
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 200,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },

    /* =====================
   IMAGES
===================== */
    thumbnailImage: {
      type: String,
      trim: true,
      default: "",
    },
    serviceImage: {
      type: String,
      trim: true,
      default: "",
    },
    sideImage: {
      type: String,
      trim: true,
      default: "",
    },

    /* =====================
   HERO
===================== */
    hero: {
      type: heroSchema,
      default: () => ({}),
    },

    /* =====================
   SIDEBAR
===================== */
    sidebarCards: {
      type: [sidebarCardSchema],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 10;
        },
        message: "Maximum 10 sidebar cards allowed.",
      },
    },

    /* =====================
   PAGE BUILDER
===================== */
    sections: {
      type: [serviceSectionSchema],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 50;
        },
        message: "Maximum 50 sections allowed.",
      },
    },

    /* =====================
   SEO
===================== */
    seo: {
      type: seoSchema,
      default: () => ({}),
    },

    /* =====================
   FLAGS
===================== */
    flags: {
      type: flagsSchema,
      default: () => ({}),
    },

    /* =====================
   METRICS
===================== */
    metrics: {
      type: metricsSchema,
      default: () => ({}),
    },

    /* =====================
   SOFT DELETE
===================== */
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },

    /* =====================
   AUDIT
===================== */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ==========================================================
11. INDEXES
========================================================== */

// Category listing
serviceSchema.index({
  category: 1,
  "flags.isActive": 1,
  isDeleted: 1,
});

// Featured services
serviceSchema.index({
  "flags.isFeatured": 1,
  "flags.isActive": 1,
  isDeleted: 1,
});

// Popular services
serviceSchema.index({
  "flags.isPopular": 1,
  "flags.isActive": 1,
  isDeleted: 1,
});

// Homepage queries
serviceSchema.index({
  "flags.isActive": 1,
  isDeleted: 1,
  createdAt: -1,
});

// Search
serviceSchema.index({
  name: "text",
  shortDescription: "text",
  category: "text",
});

/* ==========================================================
12. VIRTUALS - FIXED with safe checks
========================================================== */

// Frontend URL
serviceSchema.virtual("url").get(function() {
  return `/services/${this.slug}`;
});

// Total visible sections - FIXED: Added safe check
serviceSchema.virtual("visibleSectionsCount").get(function() {
  // Safely check if sections exists and is an array
  if (!this.sections || !Array.isArray(this.sections)) {
    return 0;
  }
  return this.sections.filter((section) => section.visible).length;
});

/* ==========================================================
13. SLUG GENERATION - FIXED (NO next parameter)
========================================================== */

serviceSchema.pre("save", async function() {
  try {
    if ((!this.slug || this.slug === "") && this.name) {
      let baseSlug = slugify(this.name, {
        lower: true,
        strict: true,
        trim: true,
      });
      
      baseSlug = baseSlug.replace(/[^\w\-]+/g, '');
      
      // Check for duplicate slug
      let slug = baseSlug;
      let counter = 1;
      const Model = mongoose.model("Service");
      
      while (await Model.findOne({ slug, _id: { $ne: this._id } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      
      this.slug = slug;
    }
  } catch (error) {
    // Log error but don't block save
    console.error("Slug generation error:", error);
  }
});

/* ==========================================================
14. QUERY MIDDLEWARE - FIXED (NO next parameter)
========================================================== */

// IMPORTANT: Do NOT use arrow functions! Use regular function() {}
// Automatically exclude soft deleted services from all find queries

serviceSchema.pre("find", function() {
  this.where({ isDeleted: false });
});

serviceSchema.pre("findOne", function() {
  this.where({ isDeleted: false });
});

serviceSchema.pre("findById", function() {
  this.where({ isDeleted: false });
});

serviceSchema.pre("countDocuments", function() {
  this.where({ isDeleted: false });
});

serviceSchema.pre("count", function() {
  this.where({ isDeleted: false });
});

serviceSchema.pre("aggregate", function() {
  // Add match stage to filter out deleted documents
  this.pipeline().unshift({ $match: { isDeleted: false } });
});

/* ==========================================================
15. INSTANCE METHODS - FIXED with safe checks
========================================================== */

// Get rendered sections in correct order - FIXED
serviceSchema.methods.getRenderedLayout = function() {
  if (!this.sections || !Array.isArray(this.sections)) {
    return [];
  }
  return this.sections
    .filter((section) => section.visible)
    .sort((a, b) => a.order - b.order);
};

// Get sidebar cards - FIXED
serviceSchema.methods.getSidebarCards = function() {
  if (!this.sidebarCards || !Array.isArray(this.sidebarCards)) {
    return [];
  }
  return this.sidebarCards
    .filter((card) => card.visible)
    .sort((a, b) => a.order - b.order);
};

// Soft delete
serviceSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Restore deleted service
serviceSchema.methods.restore = async function() {
  this.isDeleted = false;
  this.deletedAt = null;
  return this.save();
};

/* ==========================================================
16. STATIC METHODS - FIXED with explicit isDeleted filter
========================================================== */

// Featured services
serviceSchema.statics.getFeaturedServices = function(limit = 6) {
  return this.find({
    "flags.isFeatured": true,
    "flags.isActive": true,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Popular services
serviceSchema.statics.getPopularServices = function(limit = 6) {
  return this.find({
    "flags.isPopular": true,
    "flags.isActive": true,
    isDeleted: false,
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Services by category
serviceSchema.statics.getByCategory = function(category, limit = 50) {
  return this.find({
    category,
    "flags.isActive": true,
    isDeleted: false,
  })
    .sort({
      "flags.isFeatured": -1,
      createdAt: -1,
    })
    .limit(limit)
    .lean();
};

// Active services
serviceSchema.statics.getActiveServices = function() {
  return this.find({
    "flags.isActive": true,
    isDeleted: false,
  })
    .sort({
      createdAt: -1,
    })
    .lean();
};

/* ==========================================================
17. ALLOW INCLUDE DELETED (Override filter when needed)
========================================================== */

// Method to include deleted documents in queries
serviceSchema.statics.includeDeleted = function() {
  return this.find().setOptions({ includeDeleted: true });
};

/* ==========================================================
18. MODEL EXPORT
========================================================== */

const Service = mongoose.models.Service || mongoose.model("Service", serviceSchema);

export default Service;