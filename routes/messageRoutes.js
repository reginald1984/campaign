const express = require('express');
const router = express.Router();
const messageController = require('../controllers/MessageController');
const { protect } = require('../middleware/auth');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

/**
 * @route   POST /api/messages
 * @desc    Send a contact message
 * @access  Public
 */
router.post('/messages/new', messageController.sendMessage);

// =============================================
// ADMIN ROUTES (Authentication required)
// =============================================

/**
 * @route   GET /api/admin/messages
 * @desc    Get all messages
 * @access  Private/Admin
 */
router.get('/admin/messages', protect, messageController.getAllMessages);

/**
 * @route   GET /api/admin/messages/stats
 * @desc    Get message statistics
 * @access  Private/Admin
 */
router.get('/admin/messages/stats', protect, messageController.getMessageStats);

/**
 * @route   GET /api/admin/messages/recent
 * @desc    Get recent messages
 * @access  Private/Admin
 */
router.get('/admin/messages/recent', protect, messageController.getRecentMessages);

/**
 * @route   GET /api/admin/messages/export
 * @desc    Export messages to CSV
 * @access  Private/Admin
 */
router.get('/admin/messages/export', protect, messageController.exportMessages);

/**
 * @route   GET /api/admin/messages/:messageId
 * @desc    Get single message by ID
 * @access  Private/Admin
 */
router.get('/admin/messages/:messageId', protect, messageController.getMessageById);

/**
 * @route   POST /api/admin/messages/:messageId/reply
 * @desc    Reply to a message
 * @access  Private/Admin
 */
router.post('/admin/messages/:messageId/reply', protect, messageController.replyToMessage);

/**
 * @route   PUT /api/admin/messages/:messageId/priority
 * @desc    Update message priority
 * @access  Private/Admin
 */
router.put('/admin/messages/:messageId/priority', protect, messageController.updatePriority);

/**
 * @route   POST /api/admin/messages/:messageId/archive
 * @desc    Archive a message
 * @access  Private/Admin
 */
router.post('/admin/messages/:messageId/archive', protect, messageController.archiveMessage);

/**
 * @route   POST /api/admin/messages/:messageId/spam
 * @desc    Mark message as spam
 * @access  Private/Admin
 */
router.post('/admin/messages/:messageId/spam', protect, messageController.markAsSpam);

/**
 * @route   DELETE /api/admin/messages/:messageId
 * @desc    Delete a message permanently
 * @access  Private/Admin
 */
router.delete('/admin/messages/:messageId', protect, messageController.deleteMessage);

/**
 * @route   POST /api/admin/messages/bulk-update
 * @desc    Bulk update message status
 * @access  Private/Admin
 */
router.post('/admin/messages/bulk-update', protect, messageController.bulkUpdateStatus);

module.exports = router;