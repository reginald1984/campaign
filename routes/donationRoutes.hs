const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donationController');
const { protect } = require('../middleware/auth');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

/**
 * @route   POST /api/donations/create
 * @desc    Create a new donation
 * @access  Public
 */
router.post('/donations/create', donationController.createDonation);

/**
 * @route   POST /api/donations/:donationId/process
 * @desc    Process donation payment
 * @access  Public
 */
router.post('/donations/:donationId/process', donationController.processPayment);

/**
 * @route   GET /api/donations/success
 * @desc    Payment success callback
 * @access  Public
 */
router.get('/donations/success', donationController.paymentSuccess);

/**
 * @route   GET /api/donations/cancel
 * @desc    Payment cancel callback
 * @access  Public
 */
router.get('/donations/cancel', donationController.paymentCancel);

/**
 * @route   GET /api/donations/donor-wall
 * @desc    Get donor wall (public)
 * @access  Public
 */
router.get('/donations/donor-wall', donationController.getDonorWall);

// =============================================
// ADMIN ROUTES (Authentication required)
// =============================================

/**
 * @route   GET /api/admin/donations
 * @desc    Get all donations
 * @access  Private/Admin
 */
router.get('/admin/donations', protect, donationController.getAllDonations);

/**
 * @route   GET /api/admin/donations/stats
 * @desc    Get donation statistics
 * @access  Private/Admin
 */
router.get('/admin/donations/stats', protect, donationController.getDonationStats);

/**
 * @route   GET /api/admin/donations/export
 * @desc    Export donations to CSV
 * @access  Private/Admin
 */
router.get('/admin/donations/export', protect, donationController.exportDonations);

/**
 * @route   GET /api/admin/donations/:donationId
 * @desc    Get donation by ID
 * @access  Private/Admin
 */
router.get('/admin/donations/:donationId', protect, donationController.getDonationById);

/**
 * @route   POST /api/admin/donations/:donationId/refund
 * @desc    Refund donation
 * @access  Private/Admin
 */
router.post('/admin/donations/:donationId/refund', protect, donationController.refundDonation);

module.exports = router;