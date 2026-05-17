const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donationController');
const { protect } = require('../middleware/auth');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

/**
 * @route   POST /api/v1/donations/create
 * @desc    Create a new donation
 * @access  Public
 */
router.post('/donations/create', donationController.createDonation);

/**
 * @route   POST /api/v1/donations/:donationId/process
 * @desc    Process donation payment
 * @access  Public
 */
router.post('/donations/:donationId/process', donationController.processPayment);

/**
 * @route   GET /api/v1/donations/success
 * @desc    Payment success callback
 * @access  Public
 */
router.get('/donations/success', donationController.paymentSuccess);

/**
 * @route   GET /api/v1/donations/cancel
 * @desc    Payment cancel callback
 * @access  Public
 */
router.get('/donations/cancel', donationController.paymentCancel);

/**
 * @route   GET /api/v1/donations/donor-wall
 * @desc    Get donor wall (public)
 * @access  Public
 */
router.get('/donations/donor-wall', donationController.getDonorWall);

/**
 * @route   POST /api/v1/donations/webhook
 * @desc    PayPal webhook (no auth required)
 * @access  Public
 */
router.post('/donations/webhook', donationController.handleWebhook);

// =============================================
// ADMIN ROUTES (Authentication required)
// =============================================

// Apply authentication middleware to all admin routes below
router.use(protect);

/**
 * @route   GET /api/v1/admin/donations
 * @desc    Get all donations
 * @access  Private/Admin
 */
router.get('/admin/donations', donationController.getAllDonations);

/**
 * @route   GET /api/v1/admin/donations/stats
 * @desc    Get donation statistics
 * @access  Private/Admin
 */
router.get('/admin/donations/stats', donationController.getDonationStats);

/**
 * @route   GET /api/v1/admin/donations/export
 * @desc    Export donations to CSV
 * @access  Private/Admin
 */
router.get('/admin/donations/export', donationController.exportDonations);

/**
 * @route   GET /api/v1/admin/donations/:donationId
 * @desc    Get donation by ID
 * @access  Private/Admin
 */
router.get('/admin/donations/:donationId', donationController.getDonationById);

/**
 * @route   PUT /api/v1/admin/donations/:donationId/status
 * @desc    Update donation status
 * @access  Private/Admin
 */
router.put('/admin/donations/:donationId/status', donationController.updateDonationStatus);

/**
 * @route   POST /api/v1/admin/donations/:donationId/refund
 * @desc    Refund donation
 * @access  Private/Admin
 */
router.post('/admin/donations/:donationId/refund', donationController.refundDonation);

/**
 * @route   DELETE /api/v1/admin/donations/:donationId
 * @desc    Delete donation record
 * @access  Private/Admin
 */
router.delete('/admin/donations/:donationId', donationController.deleteDonation);

module.exports = router;