const express = require('express');
const router = express.Router();
const userController = require('../controllers/UserController');
const { protect} = require('../middleware/auth');
const {
    uploadProfilePicture, 
  uploadCoverImage, 
  handleUploadError 
} = require('../middleware/upload-file');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

/**
 * @route   POST /api/auth/login
 * @desc    Login admin user
 * @access  Public
 */
router.post('/auth/login', userController.login);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh authentication token
 * @access  Public
 */
router.post('/auth/refresh-token', userController.refreshToken);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/auth/forgot-password', userController.forgotPassword);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.post('/auth/reset-password', userController.resetPassword);

/**
 * @route   GET /api/users/public-profile
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
 * @route   GET /api/auth/verify
 * @desc    Verify authentication status
 * @access  Private
 */
router.get('/auth/verify', userController.verifyAuth);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/auth/logout', userController.logout);

// =============================================
// USER PROFILE ROUTES
// =============================================

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/users/profile', userController.getProfile);

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/users/profile', userController.updateProfile);

/**
 * @route   POST /api/users/change-password
 * @desc    Change password
 * @access  Private
 */
router.post('/users/change-password', userController.changePassword);

// =============================================
// IMAGE UPLOAD ROUTES
// =============================================

/**
 * @route   POST /api/users/profile-picture
 * @desc    Upload profile picture
 * @access  Private
 */
router.post(
  '/users/profile-picture',
  protect,
  uploadProfilePicture.single('image'),
  handleUploadError,
  userController.uploadProfilePictureDirect
);
/**
 * @route   POST /api/users/cover-image
 * @desc    Upload cover image
 * @access  Private
 */
router.post(
  '/users/cover-image',
  protect,
  uploadCoverImage.single('image'),
  handleUploadError,
  userController.uploadCoverImageDirect
);

/**
 * @route   DELETE /api/users/profile-picture
 * @desc    Remove profile picture
 * @access  Private
 */
router.delete('/users/profile-picture', userController.removeProfilePicture);

/**
 * @route   DELETE /api/users/cover-image
 * @desc    Remove cover image
 * @access  Private
 */
router.delete('/users/cover-image', userController.removeCoverImage);

// =============================================
// SOCIAL MEDIA ROUTES
// =============================================

/**
 * @route   PUT /api/users/social-media
 * @desc    Update social media links
 * @access  Private
 */
router.put('/users/social-media', userController.updateSocialMedia);

// =============================================
// EDUCATION ROUTES
// =============================================

/**
 * @route   POST /api/users/education
 * @desc    Add education entry
 * @access  Private
 */
router.post('/users/education', userController.addEducation);

/**
 * @route   DELETE /api/users/education/:educationId
 * @desc    Remove education entry
 * @access  Private
 */
router.delete('/users/education/:educationId', userController.removeEducation);

// =============================================
// EXPERIENCE ROUTES
// =============================================

/**
 * @route   POST /api/users/experience
 * @desc    Add experience entry
 * @access  Private
 */
router.post('/users/experience', userController.addExperience);

/**
 * @route   DELETE /api/users/experience/:experienceId
 * @desc    Remove experience entry
 * @access  Private
 */
router.delete('/users/experience/:experienceId', userController.removeExperience);

// =============================================
// ACHIEVEMENTS ROUTES
// =============================================

/**
 * @route   POST /api/users/achievements
 * @desc    Add achievement entry
 * @access  Private
 */
router.post('/users/achievements', userController.addAchievement);

/**
 * @route   DELETE /api/users/achievements/:achievementId
 * @desc    Remove achievement entry
 * @access  Private
 */
router.delete('/users/achievements/:achievementId', userController.removeAchievement);

// =============================================
// CAMPAIGN INFORMATION ROUTES
// =============================================

/**
 * @route   PUT /api/users/campaign-info
 * @desc    Update campaign information
 * @access  Private
 */
router.put('/users/campaign-info', userController.updateCampaignInfo);

// =============================================
// USER PREFERENCES ROUTES
// =============================================

/**
 * @route   PUT /api/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/users/preferences', userController.updatePreferences);

// =============================================
// STATISTICS ROUTES
// =============================================

/**
 * @route   PUT /api/users/statistics
 * @desc    Update campaign statistics
 * @access  Private
 */
router.put('/users/statistics', userController.updateStatistics);

// =============================================
// ADMIN ONLY ROUTES (if needed for multiple users)
// =============================================

/**
 * @route   GET /api/admin/users
 * @desc    Get all users (if multiple users exist)
 * @access  Private/Admin
 */
// router.get('/admin/users', requireAdmin, userController.getAllUsers);

/**
 * @route   DELETE /api/admin/users/:userId
 * @desc    Delete user (if multiple users exist)
 * @access  Private/Admin
 */
// router.delete('/admin/users/:userId', requireAdmin, userController.deleteUser);

module.exports = router;