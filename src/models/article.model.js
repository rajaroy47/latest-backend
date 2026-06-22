import mongoose from "mongoose";

const articleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    slug: {
        type: String,
        required: [true, 'Slug is required'],
        unique: true,
        lowercase: true,
        trim: true
    },
    content: {
        type: String,
        required: [true, 'Content is required'],
        minlength: [50, 'Content must be at least 50 characters']
    },
    image: {
        type: String,
        required: [true, 'Image URL is required'],
        validate: {
            validator: (v) => /^(https?:\/\/)/.test(v),
            message: 'Please provide a valid image URL'
        }
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        enum: ['Technology', 'Health', 'Business', 'Education', 'Lifestyle'],
        lowercase: true
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    tags: [String],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
articleSchema.index({ title: "text", content: "text" });
articleSchema.index({ category: 1, createdAt: -1 });
articleSchema.index({ createdAt: -1 });
articleSchema.index({ slug: 1 }, { unique: true });

// Virtual for excerpt
articleSchema.virtual('excerpt').get(function() {
    return this.content.substring(0, 200) + '...';
});

const Article = mongoose.model("Article", articleSchema);
export default Article;