const express = require('express');
const router = express.Router();
const postController = require('../controllers/PostController');
const { protect} = require('../middleware/auth');
const {
  uploadFeaturedImage,
  uploadGalleryImages,
  handlePostUploadError,
} = require('../middleware/post-upload');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

router.get('/posts', postController.getPublishedPosts);
router.get('/posts/featured', postController.getFeaturedPosts);
router.get('/posts/search', postController.searchPosts);
router.get('/posts/slug/:slug', postController.getPostBySlug);
router.get('/posts/category/:category', postController.getPostsByCategory);
router.get('/posts/tag/:tag', postController.getPostsByTag);
router.get('/posts/:postId/related', postController.getRelatedPosts);
router.post('/posts/:postId/like', postController.likePost);
router.get('/posts/:postId/like-status', postController.getLikeStatus);
router.get('/posts/:postId/likes', postController.getPostLikes);
router.get('/posts/:postId', postController.getPostById);

// =============================================
// PROTECTED ROUTES (Authentication required)
// =============================================

router.use(protect); // <-- KEY LINE: All routes below require auth

router.post('/posts/new', uploadFeaturedImage.single('image'), handlePostUploadError, postController.createPost);
router.put('/posts/update/:postId', postController.updatePost);
router.delete('/posts/delete/:postId', postController.deletePost);
router.post('/posts/:postId/featured-image', uploadFeaturedImage.single('image'), handlePostUploadError, postController.uploadFeaturedImage);
router.post('/posts/:postId/gallery', uploadGalleryImages.array('images', 10), handlePostUploadError, postController.uploadGalleryImages);
router.delete('/posts/:postId/gallery/:publicId', postController.removeGalleryImage);
router.get('/admin/posts', postController.getAllPostsForAdmin);
router.get('/admin/posts/stats', postController.getPostStats);

module.exports = router;