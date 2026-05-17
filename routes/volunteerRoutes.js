// backend/routes/volunteerRoutes.js
const express = require('express');
const router = express.Router();
const volunteerController = require('../controllers/VolunteerController');
const { protect} = require('../middleware/auth');
const { uploadVolunteerId } = require('../middleware/volunteer-upload');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

/**
 * @route   POST /api/v1/volunteers/register
 * @desc    Register a new volunteer
 * @access  Public
 */
router.post(
  '/volunteers/register',
  uploadVolunteerId.single('idPicture'),
  volunteerController.registerVolunteer
);

/**
 * @route   GET /api/v1/volunteers/id-number/:idNumber
 * @desc    Get volunteer by ID number
 * @access  Public
 */
router.get('/volunteers/id-number/:idNumber', volunteerController.getVolunteerByIdNumber);

// =============================================
// PROTECTED ROUTES (Authentication required)
// =============================================

/**
 * @route   GET /api/v1/volunteers/dashboard/:volunteerId
 * @desc    Get volunteer dashboard
 * @access  Private
 */
router.get('/volunteers/dashboard/:volunteerId', protect, volunteerController.getVolunteerDashboard);

// =============================================
// ADMIN ROUTES (Admin only)
// =============================================

/**
 * @route   GET /api/v1/volunteers
 * @desc    Get all volunteers
 * @access  Private/Admin
 */
router.get('/volunteers', protect,  volunteerController.getAllVolunteers);

/**
 * @route   GET /api/v1/volunteers/stats
 * @desc    Get volunteer statistics
 * @access  Private/Admin
 */
router.get('/volunteers/stats', protect, volunteerController.getVolunteerStats);

/**
 * @route   GET /api/v1/volunteers/export
 * @desc    Export volunteers to CSV
 * @access  Private/Admin
 */
router.get('/volunteers/export', protect,  volunteerController.exportVolunteers);

/**
 * @route   GET /api/v1/volunteers/:volunteerId
 * @desc    Get volunteer by ID
 * @access  Private/Admin
 */
router.get('/volunteers/:volunteerId', protect, volunteerController.getVolunteerById);

/**
 * @route   PUT /api/v1/volunteers/:volunteerId
 * @desc    Update volunteer
 * @access  Private/Admin
 */
router.put('/volunteers/:volunteerId', protect, volunteerController.updateVolunteer);

/**
 * @route   PUT /api/v1/volunteers/:volunteerId/approve
 * @desc    Approve volunteer application
 * @access  Private/Admin
 */
router.put('/volunteers/:volunteerId/approve', protect, volunteerController.approveVolunteer);

/**
 * @route   PUT /api/v1/volunteers/:volunteerId/reject
 * @desc    Reject volunteer application
 * @access  Private/Admin
 */
router.put('/volunteers/:volunteerId/reject', protect, volunteerController.rejectVolunteer);

/**
 * @route   PUT /api/v1/volunteers/:volunteerId/status
 * @desc    Update volunteer status
 * @access  Private/Admin
 */
router.put('/volunteers/:volunteerId/status', protect, volunteerController.updateVolunteerStatus);

/**
 * @route   POST /api/v1/volunteers/:volunteerId/hours
 * @desc    Add volunteer hours
 * @access  Private/Admin
 */
router.post('/volunteers/:volunteerId/hours', protect, volunteerController.addVolunteerHours);

/**
 * @route   POST /api/v1/volunteers/:volunteerId/achievements
 * @desc    Add achievement
 * @access  Private/Admin
 */
router.post('/volunteers/:volunteerId/achievements', protect, volunteerController.addAchievement);

/**
 * @route   DELETE /api/v1/volunteers/:volunteerId
 * @desc    Delete volunteer
 * @access  Private/Admin
 */
router.delete('/volunteers/:volunteerId', protect, volunteerController.deleteVolunteer);

module.exports = router;