const express = require('express');
const router = express.Router();
const commentController = require('../controllers/CommentController');
const { protect } = require('../middleware/auth');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

/**
 * @route   POST /api/comments
 * @desc    Create a new comment
 * @access  Public
 */
router.post('/comments/new', commentController.createComment);

/**
 * @route   GET /api/comments/post/:postId
 * @desc    Get comments for a specific post
 * @access  Public
 */
router.get('/comments/post/:postId', commentController.getPostComments);

/**
 * @route   GET /api/comments/:commentId/replies
 * @desc    Get replies for a specific comment
 * @access  Public
 */
router.get('/comments/:commentId/replies', commentController.getCommentReplies);

// =============================================
// ADMIN ROUTES (Authentication required)
// =============================================

/**
 * @route   GET /api/admin/comments
 * @desc    Get all comments for moderation
 * @access  Private/Admin
 */
router.get('/admin/comments', protect, commentController.getAllCommentsForModeration);

/**
 * @route   GET /api/admin/comments/stats
 * @desc    Get comment statistics
 * @access  Private/Admin
 */
router.get('/admin/comments/stats', protect, commentController.getCommentStats);

/**
 * @route   PUT /api/admin/comments/:commentId/approve
 * @desc    Approve a comment
 * @access  Private/Admin
 */
router.put('/admin/comments/:commentId/approve', protect, commentController.approveComment);

/**
 * @route   DELETE /api/admin/comments/:commentId
 * @desc    Reject/Delete a comment
 * @access  Private/Admin
 */
router.delete('/admin/comments/:commentId', protect, commentController.rejectComment);

/**
 * @route   POST /api/admin/comments/:commentId/spam
 * @desc    Mark comment as spam
 * @access  Private/Admin
 */
router.post('/admin/comments/:commentId/spam', protect, commentController.markAsSpam);

/**
 * @route   POST /api/admin/comments/:commentId/respond
 * @desc    Add admin response to comment
 * @access  Private/Admin
 */
router.post('/admin/comments/:commentId/respond', protect, commentController.addAdminResponse);

module.exports = router;