const CommentService = require('../services/comment-service');
const HttpError = require('../middleware/HttpError');
const asyncHandler = require('express-async-handler');

class CommentController {
  /**
   * @desc    Create a new comment (No login required)
   * @route   POST /api/comments
   * @access  Public
   */
  createComment = asyncHandler(async (req, res, next) => {
    const commentData = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    const result = await CommentService.createComment(commentData, ipAddress, userAgent);
    
    res.status(201).json({
      success: true,
      message: result.message,
      data: result.data,
      requiresModeration: result.requiresModeration
    });
  });

  /**
   * @desc    Get comments for a specific post
   * @route   GET /api/comments/post/:postId
   * @access  Public
   */
  getPostComments = asyncHandler(async (req, res, next) => {
    const { postId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    const result = await CommentService.getPostComments(postId, page, limit);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    Get replies for a specific comment
   * @route   GET /api/comments/:commentId/replies
   * @access  Public
   */
  getCommentReplies = asyncHandler(async (req, res, next) => {
    const { commentId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await CommentService.getCommentReplies(commentId, page, limit);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  // ============= ADMIN ONLY ROUTES =============

  /**
   * @desc    Get all comments for moderation (Admin only)
   * @route   GET /api/admin/comments
   * @access  Private/Admin
   */
  getAllCommentsForModeration = asyncHandler(async (req, res, next) => {
    const { status = 'pending', page = 1, limit = 50 } = req.query;
    
    const result = await CommentService.getAllCommentsForModeration(
      status,
      parseInt(page),
      parseInt(limit)
    );
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    Approve a comment (Admin only)
   * @route   PUT /api/admin/comments/:commentId/approve
   * @access  Private/Admin
   */
  approveComment = asyncHandler(async (req, res, next) => {
    const { commentId } = req.params;
    const adminId = req.user._id;
    
    const result = await CommentService.approveComment(commentId, adminId);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Reject/Delete a comment (Admin only)
   * @route   DELETE /api/admin/comments/:commentId
   * @access  Private/Admin
   */
  rejectComment = asyncHandler(async (req, res, next) => {
    const { commentId } = req.params;
    const { reason } = req.body;
    
    const result = await CommentService.rejectComment(commentId, reason);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Mark comment as spam (Admin only)
   * @route   POST /api/admin/comments/:commentId/spam
   * @access  Private/Admin
   */
  markAsSpam = asyncHandler(async (req, res, next) => {
    const { commentId } = req.params;
    
    const result = await CommentService.markAsSpam(commentId);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Add admin response to comment (Admin only)
   * @route   POST /api/admin/comments/:commentId/respond
   * @access  Private/Admin
   */
  addAdminResponse = asyncHandler(async (req, res, next) => {
    const { commentId } = req.params;
    const { response } = req.body;
    const adminId = req.user._id;
    const adminName = req.user.name;
    
    if (!response) {
      return next(new HttpError('Response content is required', 400));
    }
    
    const result = await CommentService.addAdminResponse(
      commentId,
      response,
      adminId,
      adminName
    );
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Get comment statistics (Admin only)
   * @route   GET /api/admin/comments/stats
   * @access  Private/Admin
   */
  getCommentStats = asyncHandler(async (req, res, next) => {
    const result = await CommentService.getCommentStats();
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });
}

module.exports = new CommentController();