const express = require('express');
const router = express.Router();
const commentController = require('../controllers/CommentController');
const { protect } = require('../middleware/auth');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

/**
 * @route   POST /api/v1/comments/new
 * @desc    Create a new comment
 * @access  Public
 */
router.post('/comments/new', commentController.createComment);

/**
 * @route   GET /api/v1/comments/post/:postId
 * @desc    Get comments for a specific post
 * @access  Public
 */
router.get('/comments/post/:postId', commentController.getPostComments);

/**
 * @route   GET /api/v1/comments/:commentId/replies
 * @desc    Get replies for a specific comment
 * @access  Public
 */
router.get('/comments/:commentId/replies', commentController.getCommentReplies);

// =============================================
// ADMIN ROUTES (Authentication required)
// =============================================

// Apply authentication middleware to all admin routes below
router.use(protect);

/**
 * @route   GET /api/v1/admin/comments
 * @desc    Get all comments for moderation
 * @access  Private/Admin
 */
router.get('/admin/comments', commentController.getAllCommentsForModeration);

/**
 * @route   GET /api/v1/admin/comments/stats
 * @desc    Get comment statistics
 * @access  Private/Admin
 */
router.get('/admin/comments/stats', commentController.getCommentStats);

/**
 * @route   PUT /api/v1/admin/comments/:commentId/approve
 * @desc    Approve a comment
 * @access  Private/Admin
 */
router.put('/admin/comments/:commentId/approve', commentController.approveComment);

/**
 * @route   DELETE /api/v1/admin/comments/:commentId
 * @desc    Reject/Delete a comment
 * @access  Private/Admin
 */
router.delete('/admin/comments/:commentId', commentController.rejectComment);

/**
 * @route   POST /api/v1/admin/comments/:commentId/spam
 * @desc    Mark comment as spam
 * @access  Private/Admin
 */
router.post('/admin/comments/:commentId/spam', commentController.markAsSpam);

/**
 * @route   POST /api/v1/admin/comments/:commentId/respond
 * @desc    Add admin response to comment
 * @access  Private/Admin
 */
router.post('/admin/comments/:commentId/respond', commentController.addAdminResponse);

module.exports = router;