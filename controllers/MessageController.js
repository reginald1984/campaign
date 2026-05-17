const MessageService = require('../services/message-service');
const HttpError = require('../middleware/HttpError');
const asyncHandler = require('express-async-handler');

class MessageController {
  /**
   * @desc    Send a contact message (public)
   * @route   POST /api/messages
   * @access  Public
   */
  sendMessage = asyncHandler(async (req, res, next) => {
    const messageData = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const referrer = req.headers['referer'] || null;
    
    const result = await MessageService.createMessage(
      messageData, 
      ipAddress, 
      userAgent, 
      referrer
    );
    
    res.status(201).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Get all messages (admin only)
   * @route   GET /api/admin/messages
   * @access  Private/Admin
   */
  getAllMessages = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      status: req.query.status,
      category: req.query.category,
      priority: req.query.priority,
      isSpam: req.query.isSpam,
      search: req.query.search
    };
    
    const result = await MessageService.getAllMessages(filters, page, limit);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    Get single message by ID (admin only)
   * @route   GET /api/admin/messages/:messageId
   * @access  Private/Admin
   */
  getMessageById = asyncHandler(async (req, res, next) => {
    const { messageId } = req.params;
    
    const result = await MessageService.getMessageById(messageId);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Reply to a message (admin only)
   * @route   POST /api/admin/messages/:messageId/reply
   * @access  Private/Admin
   */
  replyToMessage = asyncHandler(async (req, res, next) => {
    const { messageId } = req.params;
    const { response } = req.body;
    const adminId = req.user._id;
    const adminName = req.user.name;
    
    if (!response) {
      return next(new HttpError('Response message is required', 400));
    }
    
    const result = await MessageService.replyToMessage(
      messageId, 
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
   * @desc    Update message priority (admin only)
   * @route   PUT /api/admin/messages/:messageId/priority
   * @access  Private/Admin
   */
  updatePriority = asyncHandler(async (req, res, next) => {
    const { messageId } = req.params;
    const { priority } = req.body;
    
    if (!priority) {
      return next(new HttpError('Priority level is required', 400));
    }
    
    const result = await MessageService.updatePriority(messageId, priority);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Archive a message (admin only)
   * @route   POST /api/admin/messages/:messageId/archive
   * @access  Private/Admin
   */
  archiveMessage = asyncHandler(async (req, res, next) => {
    const { messageId } = req.params;
    
    const result = await MessageService.archiveMessage(messageId);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Mark message as spam (admin only)
   * @route   POST /api/admin/messages/:messageId/spam
   * @access  Private/Admin
   */
  markAsSpam = asyncHandler(async (req, res, next) => {
    const { messageId } = req.params;
    
    const result = await MessageService.markAsSpam(messageId);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Delete a message permanently (admin only)
   * @route   DELETE /api/admin/messages/:messageId
   * @access  Private/Admin
   */
  deleteMessage = asyncHandler(async (req, res, next) => {
    const { messageId } = req.params;
    
    const result = await MessageService.deleteMessage(messageId);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Get message statistics (admin only)
   * @route   GET /api/admin/messages/stats
   * @access  Private/Admin
   */
  getMessageStats = asyncHandler(async (req, res, next) => {
    const result = await MessageService.getMessageStats();
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Get recent messages preview (admin only)
   * @route   GET /api/admin/messages/recent
   * @access  Private/Admin
   */
  getRecentMessages = asyncHandler(async (req, res, next) => {
    const limit = parseInt(req.query.limit) || 5;
    
    const result = await MessageService.getRecentMessages(limit);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Bulk update message status (admin only)
   * @route   POST /api/admin/messages/bulk-update
   * @access  Private/Admin
   */
  bulkUpdateStatus = asyncHandler(async (req, res, next) => {
    const { messageIds, status } = req.body;
    
    if (!messageIds || !messageIds.length) {
      return next(new HttpError('Message IDs are required', 400));
    }
    
    if (!status) {
      return next(new HttpError('Status is required', 400));
    }
    
    const result = await MessageService.bulkUpdateStatus(messageIds, status);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Export messages to CSV (admin only)
   * @route   GET /api/admin/messages/export
   * @access  Private/Admin
   */
  exportMessages = asyncHandler(async (req, res, next) => {
    const filters = {
      status: req.query.status,
      category: req.query.category,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    const result = await MessageService.exportMessages(filters);
    
    // Convert to CSV
    const csvData = result.data.map(msg => ({
      Name: msg.name,
      Email: msg.email,
      Phone: msg.phone || '',
      Subject: msg.subject,
      Message: msg.message,
      Category: msg.category,
      Status: msg.status,
      Priority: msg.priority,
      'Created At': msg.createdAt,
      'Responded At': msg.adminResponse?.respondedAt || ''
    }));
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=messages-${Date.now()}.csv`);
    
    // Simple CSV conversion
    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
    ].join('\n');
    
    res.status(200).send(csv);
  });
}

module.exports = new MessageController();