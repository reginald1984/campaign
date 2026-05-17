const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const { protect } = require('../middleware/auth');
const {
  uploadProfilePicture,
  uploadCoverImage,
  handleUploadError
} = require('../middleware/upload-file');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login admin user
 * @access  Public
 */
router.post('/auth/login', userController.login);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh authentication token
 * @access  Public
 */
router.post('/auth/refresh-token', userController.refreshToken);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/auth/forgot-password', userController.forgotPassword);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/auth/reset-password', userController.resetPassword);

/**
 * @route   GET /api/v1/users/public-profile
 * @desc    Get public profile (for website visitors)
 * @access  Public
 */
router.get('/users/public-profile', userController.getPublicProfile);

// =============================================
// PROTECTED ROUTES (Authentication required)
// =============================================

// Apply authentication middleware to all routes below
router.use(protect);

/**
 * @route   GET /api/v1/auth/verify
 * @desc    Verify authentication status
 * @access  Private
 */
router.get('/auth/verify', userController.verifyAuth);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/auth/logout', userController.logout);

// =============================================
// USER PROFILE ROUTES
// =============================================

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/users/profile', userController.getProfile);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/users/profile', userController.updateProfile);

/**
 * @route   POST /api/v1/users/change-password
 * @desc    Change password
 * @access  Private
 */
router.post('/users/change-password', userController.changePassword);

// =============================================
// IMAGE UPLOAD ROUTES
// =============================================

/**
 * @route   POST /api/v1/users/profile-picture
 * @desc    Upload profile picture
 * @access  Private
 */
router.post(
  '/users/profile-picture',
  uploadProfilePicture.single('image'),
  handleUploadError,
  userController.uploadProfilePictureDirect
);

/**
 * @route   POST /api/v1/users/cover-image
 * @desc    Upload cover image
 * @access  Private
 */
router.post(
  '/users/cover-image',
  uploadCoverImage.single('image'),
  handleUploadError,
  userController.uploadCoverImageDirect
);

/**
 * @route   DELETE /api/v1/users/profile-picture
 * @desc    Remove profile picture
 * @access  Private
 */
router.delete('/users/profile-picture', userController.removeProfilePicture);

/**
 * @route   DELETE /api/v1/users/cover-image
 * @desc    Remove cover image
 * @access  Private
 */
router.delete('/users/cover-image', userController.removeCoverImage);

// =============================================
// SOCIAL MEDIA ROUTES
// =============================================

/**
 * @route   PUT /api/v1/users/social-media
 * @desc    Update social media links
 * @access  Private
 */
router.put('/users/social-media', userController.updateSocialMedia);

// =============================================
// EDUCATION ROUTES
// =============================================

/**
 * @route   POST /api/v1/users/education
 * @desc    Add education entry
 * @access  Private
 */
router.post('/users/education', userController.addEducation);

/**
 * @route   DELETE /api/v1/users/education/:educationId
 * @desc    Remove education entry
 * @access  Private
 */
router.delete('/users/education/:educationId', userController.removeEducation);

// =============================================
// EXPERIENCE ROUTES
// =============================================

/**
 * @route   POST /api/v1/users/experience
 * @desc    Add experience entry
 * @access  Private
 */
router.post('/users/experience', userController.addExperience);

/**
 * @route   DELETE /api/v1/users/experience/:experienceId
 * @desc    Remove experience entry
 * @access  Private
 */
router.delete('/users/experience/:experienceId', userController.removeExperience);

// =============================================
// ACHIEVEMENTS ROUTES
// =============================================

/**
 * @route   POST /api/v1/users/achievements
 * @desc    Add achievement entry
 * @access  Private
 */
router.post('/users/achievements', userController.addAchievement);

/**
 * @route   DELETE /api/v1/users/achievements/:achievementId
 * @desc    Remove achievement entry
 * @access  Private
 */
router.delete('/users/achievements/:achievementId', userController.removeAchievement);

// =============================================
// CAMPAIGN INFORMATION ROUTES
// =============================================

/**
 * @route   PUT /api/v1/users/campaign-info
 * @desc    Update campaign information
 * @access  Private
 */
router.put('/users/campaign-info', userController.updateCampaignInfo);

// =============================================
// USER PREFERENCES ROUTES
// =============================================

/**
 * @route   PUT /api/v1/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/users/preferences', userController.updatePreferences);

// =============================================
// STATISTICS ROUTES
// =============================================

/**
 * @route   PUT /api/v1/users/statistics
 * @desc    Update campaign statistics
 * @access  Private
 */
router.put('/users/statistics', userController.updateStatistics);

module.exports = router;