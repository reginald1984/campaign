const DonationService = require('../services/donation-service');
const HttpError = require('../middleware/HttpError');
const asyncHandler = require('express-async-handler');

class DonationController {
  /**
   * @desc    Create a new donation
   * @route   POST /api/donations/create
   * @access  Public
   */
  createDonation = asyncHandler(async (req, res, next) => {
    const donationData = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const result = await DonationService.createDonation(donationData, ipAddress);
    
    res.status(201).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Process donation payment
   * @route   POST /api/donations/:donationId/process
   * @access  Public
   */
  processPayment = asyncHandler(async (req, res, next) => {
    const { donationId } = req.params;
    const { returnUrl, cancelUrl } = req.body;
    
    if (!returnUrl || !cancelUrl) {
      return next(new HttpError('Return URL and Cancel URL are required', 400));
    }
    
    const result = await DonationService.processPayment(donationId, returnUrl, cancelUrl);
    
    res.status(200).json({
      success: true,
      data: result
    });
  });

  /**
   * @desc    Complete donation after PayPal callback
   * @route   GET /api/donations/success
   * @access  Public
   */
  paymentSuccess = asyncHandler(async (req, res, next) => {
    const { token, PayerID } = req.query;
    
    if (!token) {
      return next(new HttpError('Payment token is required', 400));
    }
    
    const result = await DonationService.completeDonation(token, PayerID);
    
    // Redirect to success page or return JSON based on request
    if (req.accepts('html')) {
      res.redirect(`${process.env.CLIENT_URL}/donation/success?donationId=${result.data.donationId}`);
    } else {
      res.status(200).json({
        success: true,
        message: result.message,
        data: result.data
      });
    }
  });

  /**
   * @desc    Cancel donation
   * @route   GET /api/donations/cancel
   * @access  Public
   */
  paymentCancel = asyncHandler(async (req, res, next) => {
    const { token } = req.query;
    
    if (req.accepts('html')) {
      res.redirect(`${process.env.CLIENT_URL}/donation/cancel`);
    } else {
      res.status(200).json({
        success: false,
        message: 'Payment was cancelled'
      });
    }
  });

  /**
   * @desc    Get all donations (admin only)
   * @route   GET /api/admin/donations
   * @access  Private/Admin
   */
  getAllDonations = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      status: req.query.status,
      donationType: req.query.donationType,
      campaign: req.query.campaign,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      search: req.query.search
    };
    
    const result = await DonationService.getAllDonations(filters, page, limit);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    Get donation by ID (admin only)
   * @route   GET /api/admin/donations/:donationId
   * @access  Private/Admin
   */
  getDonationById = asyncHandler(async (req, res, next) => {
    const { donationId } = req.params;
    
    const result = await DonationService.getDonationById(donationId);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Get donation statistics (admin only)
   * @route   GET /api/admin/donations/stats
   * @access  Private/Admin
   */
  getDonationStats = asyncHandler(async (req, res, next) => {
    const result = await DonationService.getDonationStats();
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Get donor wall (public)
   * @route   GET /api/donations/donor-wall
   * @access  Public
   */
  getDonorWall = asyncHandler(async (req, res, next) => {
    const limit = parseInt(req.query.limit) || 50;
    
    const result = await DonationService.getDonorWall(limit);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Refund donation (admin only)
   * @route   POST /api/admin/donations/:donationId/refund
   * @access  Private/Admin
   */
  refundDonation = asyncHandler(async (req, res, next) => {
    const { donationId } = req.params;
    const { reason } = req.body;
    
    const result = await DonationService.refundDonation(donationId, reason);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Export donations to CSV (admin only)
   * @route   GET /api/admin/donations/export
   * @access  Private/Admin
   */
  exportDonations = asyncHandler(async (req, res, next) => {
    const filters = {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      campaign: req.query.campaign
    };
    
    const result = await DonationService.exportDonations(filters);
    
    // Convert to CSV
    const csvData = result.data.map(d => ({
      'Donor Name': d.donorName,
      'Donor Email': d.donorEmail,
      'Amount': `${d.currency} ${d.amount}`,
      'Type': d.donationType,
      'Status': d.paymentStatus,
      'Transaction ID': d.transactionId,
      'Date': d.createdAt,
      'Campaign': d.campaign,
      'Source': d.source
    }));
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=donations-${Date.now()}.csv`);
    
    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
    ].join('\n');
    
    res.status(200).send(csv);
  });
}

module.exports = new DonationController();