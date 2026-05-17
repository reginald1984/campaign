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
 * @route   GET /api/posts
 * @desc    Get all published posts
 * @access  Public
 */
router.get('/posts', postController.getPublishedPosts);

/**
 * @route   GET /api/posts/featured
 * @desc    Get featured posts
 * @access  Public
 */
router.get('/posts/featured', postController.getFeaturedPosts);

/**
 * @route   GET /api/posts/search
 * @desc    Search posts
 * @access  Public
 */
router.get('/posts/search', postController.searchPosts);

/**
 * @route   GET /api/posts/slug/:slug
 * @desc    Get post by slug
 * @access  Public
 */
router.get('/posts/slug/:slug', postController.getPostBySlug);

/**
 * @route   GET /api/posts/category/:category
 * @desc    Get posts by category
 * @access  Public
 */
router.get('/posts/category/:category', postController.getPostsByCategory);

/**
 * @route   GET /api/posts/tag/:tag
 * @desc    Get posts by tag
 * @access  Public
 */
router.get('/posts/tag/:tag', postController.getPostsByTag);

/**
 * @route   GET /api/posts/:postId/related
 * @desc    Get related posts
 * @access  Public
 */
router.get('/posts/:postId/related', postController.getRelatedPosts);

// =============================================
// LIKE ROUTES (Public with optional auth)
// =============================================

/**
 * @route   POST /api/posts/:postId/like
 * @desc    Like or unlike a post (authenticated users get persistent likes)
 * @access  Public (with optional auth)
 */
router.post('/posts/:postId/like', postController.likePost);

/**
 * @route   GET /api/posts/:postId/like-status
 * @desc    Get like status for a post
 * @access  Public (with optional auth)
 */
router.get('/posts/:postId/like-status', postController.getLikeStatus);

/**
 * @route   GET /api/posts/:postId/likes
 * @desc    Get users who liked a post
 * @access  Public
 */
router.get('/posts/:postId/likes', postController.getPostLikes);

// =============================================
// ADMIN ROUTES (Authentication required)
// =============================================

/**
 * @route   POST /api/posts
 * @desc    Create a new post
 * @access  Private/Admin
 */ 
router.post('/posts/new', protect, uploadFeaturedImage.single('image'),
  handlePostUploadError, postController.createPost);

/**
 * @route   PUT /api/posts/:postId
 * @desc    Update a post
 * @access  Private/Admin
 */
router.put('/posts/update/:postId', protect, postController.updatePost);

/**
 * @route   DELETE /api/posts/:postId
 * @desc    Delete a post
 * @access  Private/Admin
 */
router.delete('/posts/delete/:postId', protect, postController.deletePost);

/**
 * @route   GET /api/posts/:postId
 * @desc    Get post by ID (admin)
 * @access  Private/Admin
 */
router.get('/posts/:postId', protect, postController.getPostById);

/**
 * @route   POST /api/posts/:postId/featured-image
 * @desc    Upload featured image
 * @access  Private/Admin
 */
router.post(
  '/posts/:postId/featured-image',
  protect,
  uploadFeaturedImage.single('image'),
  handlePostUploadError,
  postController.uploadFeaturedImage
);

/**
 * @route   POST /api/posts/:postId/gallery
 * @desc    Upload gallery images
 * @access  Private/Admin
 */
router.post(
  '/posts/:postId/gallery',
  protect,
  uploadGalleryImages.array('images', 10),
  handlePostUploadError,
  postController.uploadGalleryImages
);

/**
 * @route   DELETE /api/posts/:postId/gallery/:publicId
 * @desc    Remove gallery image
 * @access  Private/Admin
 */
router.delete('/posts/:postId/gallery/:publicId', protect, postController.removeGalleryImage);

/**
 * @route   GET /api/admin/posts
 * @desc    Get all posts for admin
 * @access  Private/Admin
 */
router.get('/admin/posts', protect, postController.getAllPostsForAdmin);

/**
 * @route   GET /api/admin/posts/stats
 * @desc    Get post statistics
 * @access  Private/Admin
 */
router.get('/admin/posts/stats', protect, postController.getPostStats);

module.exports = router;