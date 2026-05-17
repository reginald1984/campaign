const express = require('express');
const router = express.Router();
const subscribeController = require('../controllers/SubscribeController');
const { protect } = require('../middleware/auth');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

/**
 * @route   POST /api/v1/subscribe
 * @desc    Subscribe to newsletter
 * @access  Public
 */
router.post('/subscribe', subscribeController.subscribe);

/**
 * @route   GET /api/v1/subscribe/unsubscribe
 * @desc    Unsubscribe from newsletter
 * @access  Public
 */
router.get('/subscribe/unsubscribe', subscribeController.unsubscribe);

/**
 * @route   GET /api/v1/subscribe/check
 * @desc    Check if email is subscribed
 * @access  Public
 */
router.get('/subscribe/check', subscribeController.checkSubscription);


// =============================================
// ADMIN ROUTES (Authentication required)
// =============================================

// Apply authentication middleware to all admin routes below
router.use(protect);

/**
 * @route   GET /api/v1/admin/subscribers
 * @desc    Get all subscribers
 * @access  Private/Admin
 */
router.get('/admin/subscribers', subscribeController.getAllSubscribers);

/**
 * @route   GET /api/v1/admin/subscribers/stats
 * @desc    Get subscriber statistics
 * @access  Private/Admin
 */
router.get('/admin/subscribers/stats', subscribeController.getSubscriberStats);

/**
 * @route   GET /api/v1/admin/subscribers/export
 * @desc    Export subscribers to CSV
 * @access  Private/Admin
 */
router.get('/admin/subscribers/export', subscribeController.exportSubscribers);


/**
 * @route   DELETE /api/v1/admin/subscribers/:email
 * @desc    Delete subscriber
 * @access  Private/Admin
 */
router.delete('/admin/subscribers/:email', subscribeController.deleteSubscriber);

/**
 * @route   POST /api/v1/admin/subscribers/test-newsletter
 * @desc    Send test newsletter
 * @access  Private/Admin
 */
router.post('/admin/subscribers/test-newsletter', subscribeController.sendTestNewsletter);



module.exports = router;