const express = require('express');
const router = express.Router();
const postController = require('../controllers/PostController');
const { protect } = require('../middleware/auth');
const {
  uploadFeaturedImage,
  uploadGalleryImages,
  handlePostUploadError,
} = require('../middleware/post-upload');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

/**
 * @route   GET /api/v1/posts
 * @desc    Get all published posts
 * @access  Public
 */
router.get('/posts', postController.getPublishedPosts);

/**
 * @route   GET /api/v1/posts/featured
 * @desc    Get featured posts
 * @access  Public
 */
router.get('/posts/featured', postController.getFeaturedPosts);

/**
 * @route   GET /api/v1/posts/search
 * @desc    Search posts
 * @access  Public
 */
router.get('/posts/search', postController.searchPosts);


/**
 * @route   GET /api/v1/posts/slug/:slug
 * @desc    Get post by slug
 * @access  Public
 */
router.get('/posts/slug/:slug', postController.getPostBySlug);

/**
 * @route   GET /api/v1/posts/category/:category
 * @desc    Get posts by category
 * @access  Public
 */
router.get('/posts/category/:category', postController.getPostsByCategory);

/**
 * @route   GET /api/v1/posts/tag/:tag
 * @desc    Get posts by tag
 * @access  Public
 */
router.get('/posts/tag/:tag', postController.getPostsByTag);

/**
 * @route   GET /api/v1/posts/:postId/related
 * @desc    Get related posts
 * @access  Public
 */
router.get('/posts/:postId/related', postController.getRelatedPosts);

/**
 * @route   POST /api/v1/posts/:postId/like
 * @desc    Like or unlike a post
 * @access  Public (with optional auth)
 */
router.post('/posts/:postId/like', postController.likePost);

/**
 * @route   GET /api/v1/posts/:postId/like-status
 * @desc    Get like status for a post
 * @access  Public (with optional auth)
 */
router.get('/posts/:postId/like-status', postController.getLikeStatus);

/**
 * @route   GET /api/v1/posts/:postId/likes
 * @desc    Get users who liked a post
 * @access  Public
 */
router.get('/posts/:postId/likes', postController.getPostLikes);

/**
 * @route   GET /api/v1/posts/:postId
 * @desc    Get post by ID
 * @access  Public
 */
router.get('/posts/:postId', postController.getPostById);

// =============================================
// PROTECTED ROUTES (Authentication required)
// =============================================

// Apply authentication middleware to all routes below
router.use(protect);

/**
 * @route   POST /api/v1/posts/new
 * @desc    Create a new post
 * @access  Private/Admin
 */
router.post('/posts/new', uploadFeaturedImage.single('image'), handlePostUploadError, postController.createPost);

/**
 * @route   PUT /api/v1/posts/update/:postId
 * @desc    Update a post
 * @access  Private/Admin
 */
router.put('/posts/update/:postId', postController.updatePost);

/**
 * @route   DELETE /api/v1/posts/delete/:postId
 * @desc    Delete a post
 * @access  Private/Admin
 */
router.delete('/posts/delete/:postId', postController.deletePost);

/**
 * @route   POST /api/v1/posts/:postId/featured-image
 * @desc    Upload featured image
 * @access  Private/Admin
 */
router.post(
  '/posts/:postId/featured-image',
  uploadFeaturedImage.single('image'),
  handlePostUploadError,
  postController.uploadFeaturedImage
);

/**
 * @route   POST /api/v1/posts/:postId/gallery
 * @desc    Upload gallery images
 * @access  Private/Admin
 */
router.post(
  '/posts/:postId/gallery',
  uploadGalleryImages.array('images', 10),
  handlePostUploadError,
  postController.uploadGalleryImages
);

/**
 * @route   DELETE /api/v1/posts/:postId/gallery/:publicId
 * @desc    Remove gallery image
 * @access  Private/Admin
 */
router.delete('/posts/:postId/gallery/:publicId', postController.removeGalleryImage);

/**
 * @route   GET /api/v1/admin/posts
 * @desc    Get all posts for admin
 * @access  Private/Admin
 */
router.get('/admin/posts', postController.getAllPostsForAdmin);

/**
 * @route   GET /api/v1/admin/posts/stats
 * @desc    Get post statistics
 * @access  Private/Admin
 */
router.get('/admin/posts/stats', postController.getPostStats);

module.exports = router;