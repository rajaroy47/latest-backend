import Article from "../models/article.model.js";
// import { uploadToCloudinary } from "../utils/cloudinaryUpload.js";

export const createArticle = async (req, res) => {
  try {
    const { title, slug, content, category } = req.body;

    if (!title || !slug || !content || !category) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Article image is required",
      });
    }

    const existingArticle = await Article.findOne({ slug });

    if (existingArticle) {
      return res.status(409).json({
        success: false,
        message: "Article with this slug already exists",
      });
    }

    const uploadedImage = await uploadToCloudinary(
      req.file.buffer,
      "articles"
    );

    const article = await Article.create({
      title,
      slug,
      content,
      category,
      image: uploadedImage.secure_url,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Article created successfully",
      article,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getAllArticles = async (req, res) => {
  try {

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const search = req.query.search || "";
    const category = req.query.category || "";
    const skip = (page - 1) * limit;
    const query = {};

    if (search) {
      query.$or = [
        {
          title: {
            $regex: search,
            $options: "i",
          },
        },
        {
          content: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    if (category) {
      query.category = category;
    }

    const totalArticles = await Article.countDocuments(query);

    const articles = await Article.find(query)
      .populate("createdBy", "fullName email")
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      articles,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalArticles / limit),
        totalArticles,
        limit,
        hasNextPage: page < Math.ceil(totalArticles / limit),
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching articles",
      error: error.message,
    });
  }
};

export const getArticleBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const article = await Article.findOne({
      slug,
    }).populate("createdBy", "fullName email");

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    return res.status(200).json({
      success: true,
      article,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getArticleById = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id).populate(
      "createdBy",
      "fullName email",
    );

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    return res.status(200).json({
      success: true,
      article,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    const { title, slug, content, category } = req.body;

    if (slug && slug !== article.slug) {
      const existing = await Article.findOne({ slug });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "Slug already exists",
        });
      }
    }

    let imageUrl = article.image;

    if (req.file) {
      const uploadedImage = await uploadToCloudinary(
        req.file.buffer,
        "articles"
      );

      imageUrl = uploadedImage.secure_url;
    }

    article.title = title || article.title;
    article.slug = slug || article.slug;
    article.content = content || article.content;
    article.category = category || article.category;
    article.image = imageUrl;

    await article.save();

    return res.status(200).json({
      success: true,
      message: "Article updated successfully",
      article,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deleteArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    await Article.findByIdAndDelete(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Article deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getRelatedArticles = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: "Article not found",
      });
    }

    const related = await Article.find({
      category: article.category,
      _id: {
        $ne: article._id,
      },
    })
      .limit(4)
      .sort({
        createdAt: -1,
      });

    return res.status(200).json({
      success: true,
      related,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};