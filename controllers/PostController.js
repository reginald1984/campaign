const PostService = require('../services/post-service');
const HttpError = require('../middleware/HttpError');
const asyncHandler = require('express-async-handler');
const Post = require('../models/Post');
const { cloudinary } = require('../config/cloudinary');
const fs = require('fs');

class PostController {
  /**
   * @desc    Create a new post
   * @route   POST /api/posts
   * @access  Private/Admin
   */
  createPost = asyncHandler(async (req, res, next) => {
    const postData = req.body;
    const authorId = req.user._id;
    
    const result = await PostService.createPost(postData, authorId);
    
    res.status(201).json({
      success: true,
      message: result.message, 
      data: result.data
    });
  });

  /**
   * @desc    Update a post
   * @route   PUT /api/posts/:postId
   * @access  Private/Admin
   */
  updatePost = asyncHandler(async (req, res, next) => {
    const { postId } = req.params;
    const updateData = req.body;
    const authorId = req.user._id;
    
    const result = await PostService.updatePost(postId, updateData, authorId);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Get published post by slug (public)
   * @route   GET /api/posts/slug/:slug
   * @access  Public
   */
  getPostBySlug = asyncHandler(async (req, res, next) => {
    const { slug } = req.params;
    
    const result = await PostService.getPostBySlug(slug);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Get post by ID (admin)
   * @route   GET /api/posts/:postId
   * @access  Private/Admin
   */
  getPostById = asyncHandler(async (req, res, next) => {
    const { postId } = req.params;
    
    const result = await PostService.getPostById(postId);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Get all published posts
   * @route   GET /api/posts
   * @access  Public
   */
  getPublishedPosts = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category;
    const tag = req.query.tag;
    
    const result = await PostService.getPublishedPosts(page, limit, category, tag);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    Get all posts for admin
   * @route   GET /api/admin/posts
   * @access  Private/Admin
   */
  getAllPostsForAdmin = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    
    const result = await PostService.getAllPostsForAdmin(page, limit, status);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    Get featured posts
   * @route   GET /api/posts/featured
   * @access  Public
   */
  getFeaturedPosts = asyncHandler(async (req, res, next) => {
    const limit = parseInt(req.query.limit) || 5;
    
    const result = await PostService.getFeaturedPosts(limit);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Search posts
   * @route   GET /api/posts/search
   * @access  Public
   */
  searchPosts = asyncHandler(async (req, res, next) => {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    if (!q) {
      return next(new HttpError('Search query is required', 400));
    }
    
    const result = await PostService.searchPosts(q, page, limit);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      query: result.query
    });
  });

  /**
   * @desc    Get posts by category
   * @route   GET /api/posts/category/:category
   * @access  Public
   */
  getPostsByCategory = asyncHandler(async (req, res, next) => {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await PostService.getPostsByCategory(category, page, limit);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    Get posts by tag
   * @route   GET /api/posts/tag/:tag
   * @access  Public
   */
  getPostsByTag = asyncHandler(async (req, res, next) => {
    const { tag } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await PostService.getPostsByTag(tag, page, limit);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    Delete a post
   * @route   DELETE /api/posts/:postId
   * @access  Private/Admin
   */
  deletePost = asyncHandler(async (req, res, next) => {
    const { postId } = req.params;
    
    const result = await PostService.deletePost(postId);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Like or Unlike a post
   * @route   POST /api/posts/:postId/like
   * @access  Public (with optional auth)
   */
  likePost = asyncHandler(async (req, res, next) => {
    const { postId } = req.params;
    const userId = req.user ? req.user._id : null;
    
    const result = await PostService.likePost(postId, userId);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Get like status for a post
   * @route   GET /api/posts/:postId/like-status
   * @access  Public (with optional auth)
   */
  getLikeStatus = asyncHandler(async (req, res, next) => {
    const { postId } = req.params;
    const userId = req.user ? req.user._id : null;
    
    const result = await PostService.getLikeStatus(postId, userId);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Get users who liked a post
   * @route   GET /api/posts/:postId/likes
   * @access  Public
   */
  getPostLikes = asyncHandler(async (req, res, next) => {
    const { postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const result = await PostService.getPostLikes(postId, page, limit);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Upload featured image
   * @route   POST /api/posts/:postId/featured-image
   * @access  Private/Admin
   */
  uploadFeaturedImage = asyncHandler(async (req, res, next) => {
    console.log('=== Controller: uploadFeaturedImage ===');
    console.log('Request params:', req.params);
    console.log('Request file:', req.file);
    
    if (!req.file) {
      console.error('No file in request');
      return next(new HttpError('Please upload an image', 400));
    }
    
    const { postId } = req.params;
    const { alt, caption } = req.body;
    
    // When using multer-storage-cloudinary, the file is already uploaded 
    // The file object contains the Cloudinary URL and public_id
    if (req.file.secure_url || req.file.url || req.file.path) {
      // File is already on Cloudinary - just update the post with the Cloudinary info
      console.log('File already uploaded to Cloudinary, just updating post record');
      
      const imageUrl = req.file.secure_url || req.file.url || req.file.path;
      const publicId = req.file.public_id || req.file.filename;
      
      console.log('Cloudinary URL:', imageUrl);
      console.log('Public ID:', publicId);
      
      // Find the post
      const post = await Post.findById(postId);
      if (!post) {
        return next(new HttpError('Post not found', 404));
      }
      
      // Delete old featured image from Cloudinary if exists
      if (post.featuredImage && post.featuredImage.publicId) {
        console.log('Deleting old featured image:', post.featuredImage.publicId);
        try {
          await cloudinary.uploader.destroy(post.featuredImage.publicId);
          console.log('Old featured image deleted successfully');
        } catch (deleteError) {
          console.warn('Failed to delete old featured image:', deleteError.message);
        }
      }
      
      // Update post with new featured image info
      post.featuredImage = {
        url: imageUrl,
        publicId: publicId,
        alt: alt || post.title,
        caption: caption || post.excerpt || '',
        cloudinaryUrl: imageUrl,
        width: req.file.width || 1200,
        height: req.file.height || 630,
        format: req.file.format || 'jpg'
      };
      
      await post.save();
      console.log('Post updated successfully with Cloudinary image');
      
      return res.status(200).json({
        success: true,
        message: 'Featured image uploaded successfully',
        data: post.featuredImage
      });
    }
    
    // Fallback for local file uploads (if not using cloudinary storage)
    if (req.file.path && fs.existsSync(req.file.path)) {
      const result = await PostService.uploadFeaturedImage(postId, req.file.path, alt, caption);
      return res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    }
    
    return next(new HttpError('Invalid file data', 400));
  });

  /**
   * @desc    Upload gallery images
   * @route   POST /api/posts/:postId/gallery
   * @access  Private/Admin
   */
  uploadGalleryImages = asyncHandler(async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
      return next(new HttpError('Please upload at least one image', 400));
    }
    
    const { postId } = req.params;
    
    const result = await PostService.uploadGalleryImages(postId, req.files);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Remove gallery image
   * @route   DELETE /api/posts/:postId/gallery/:publicId
   * @access  Private/Admin
   */
  removeGalleryImage = asyncHandler(async (req, res, next) => {
    const { postId, publicId } = req.params;
    
    const result = await PostService.removeGalleryImage(postId, publicId);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Get post statistics
   * @route   GET /api/admin/posts/stats
   * @access  Private/Admin
   */
  getPostStats = asyncHandler(async (req, res, next) => {
    const result = await PostService.getPostStats();
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Get related posts
   * @route   GET /api/posts/:postId/related
   * @access  Public
   */
  getRelatedPosts = asyncHandler(async (req, res, next) => {
    const { postId } = req.params;
    const limit = parseInt(req.query.limit) || 3;
    
    const result = await PostService.getRelatedPosts(postId, limit);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });
}

module.exports = new PostController();