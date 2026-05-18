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

router.post('/auth/login', userController.login);
router.post('/auth/refresh-token', userController.refreshToken);
router.post('/auth/forgot-password', userController.forgotPassword);
router.post('/auth/reset-password', userController.resetPassword);
router.get('/users/public-profile', userController.getPublicProfile); // <-- THIS IS PUBLIC

// =============================================
// PROTECTED ROUTES (Authentication required)
// =============================================

router.use(protect); // <-- KEY LINE

router.get('/auth/verify', userController.verifyAuth);
router.post('/auth/logout', userController.logout);
router.get('/users/profile', userController.getProfile);
router.put('/users/profile', userController.updateProfile);
router.post('/users/change-password', userController.changePassword);
router.post('/users/profile-picture', uploadProfilePicture.single('image'), handleUploadError, userController.uploadProfilePictureDirect);
router.post('/users/cover-image', uploadCoverImage.single('image'), handleUploadError, userController.uploadCoverImageDirect);
router.delete('/users/profile-picture', userController.removeProfilePicture);
router.delete('/users/cover-image', userController.removeCoverImage);
router.put('/users/social-media', userController.updateSocialMedia);
router.post('/users/education', userController.addEducation);
router.delete('/users/education/:educationId', userController.removeEducation);
router.post('/users/experience', userController.addExperience);
router.delete('/users/experience/:experienceId', userController.removeExperience);
router.post('/users/achievements', userController.addAchievement);
router.delete('/users/achievements/:achievementId', userController.removeAchievement);
router.put('/users/campaign-info', userController.updateCampaignInfo);
router.put('/users/preferences', userController.updatePreferences);
router.put('/users/statistics', userController.updateStatistics);

module.exports = router;