const express = require('express');
const router = express.Router();
const subscribeController = require('../controllers/SubscribeController');
const { protect } = require('../middleware/auth');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

/**
 * @route   POST /api/subscribe
 * @desc    Subscribe to newsletter
 * @access  Public
 */
router.post('/subscribe', subscribeController.subscribe);

/**
 * @route   GET /api/subscribe/unsubscribe
 * @desc    Unsubscribe from newsletter
 * @access  Public
 */
router.get('/subscribe/unsubscribe', subscribeController.unsubscribe);

/**
 * @route   GET /api/subscribe/check
 * @desc    Check if email is subscribed
 * @access  Public
 */
router.get('/subscribe/check', subscribeController.checkSubscription);

// =============================================
// ADMIN ROUTES (Authentication required)
// =============================================

/**
 * @route   GET /api/admin/subscribers
 * @desc    Get all subscribers
 * @access  Private/Admin
 */
router.get('/admin/subscribers', protect, subscribeController.getAllSubscribers);

/**
 * @route   GET /api/admin/subscribers/stats
 * @desc    Get subscriber statistics
 * @access  Private/Admin
 */
router.get('/admin/subscribers/stats', protect, subscribeController.getSubscriberStats);

/**
 * @route   GET /api/admin/subscribers/export
 * @desc    Export subscribers to CSV
 * @access  Private/Admin
 */
router.get('/admin/subscribers/export', protect, subscribeController.exportSubscribers);

/**
 * @route   DELETE /api/admin/subscribers/:email
 * @desc    Delete subscriber
 * @access  Private/Admin
 */
router.delete('/admin/subscribers/:email', protect, subscribeController.deleteSubscriber);

/**
 * @route   POST /api/admin/subscribers/test-newsletter
 * @desc    Send test newsletter
 * @access  Private/Admin
 */
router.post('/admin/subscribers/test-newsletter', protect, subscribeController.sendTestNewsletter);

module.exports = router;