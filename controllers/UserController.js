const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');
const UserService = require('../services/user-service');
const HttpError = require("../middleware/HttpError");
const asyncHandler = require('express-async-handler');

class UserController {
  /**
   * @desc    Login admin user
   * @route   POST /api/auth/login
   * @access  Public
   */
  login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const result = await UserService.authenticateUser(email, password, ipAddress);
    
    // Set cookies
    res.cookie('token', result.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });
    
    res.cookie('refreshToken', result.data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 90 * 24 * 60 * 60 * 1000 // 90 days
    });
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result.data
    });
  });

  /**
   * @desc    Refresh token
   * @route   POST /api/auth/refresh-token
   * @access  Public
   */
  refreshToken = asyncHandler(async (req, res, next) => {
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
    
    const result = await UserService.refreshToken(refreshToken);
    
    // Update cookies
    res.cookie('token', result.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    
    res.cookie('refreshToken', result.data.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 90 * 24 * 60 * 60 * 1000
    });
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Get current user profile
   * @route   GET /api/users/profile
   * @access  Private
   */
  getProfile = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    
    const result = await UserService.getUserProfile(userId);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

/**
 * @desc    Update user profile
 * @route   PUT /api/users/profile
 * @access  Private
 */
updateProfile = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const updateData = req.body;
  
  // Don't remove email - allow email updates
  // Only remove truly sensitive fields
  delete updateData.password;
  delete updateData.role;
  delete updateData.loginAttempts;
  delete updateData.lockUntil;
  
  // IMPORTANT: Keep the email field if it exists
  // Don't delete updateData.email
  
  const result = await UserService.updateUserProfile(userId, updateData);
  
  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: result.data
  });
});
/**
 * @desc    Upload profile picture directly to Cloudinary
 * @route   POST /api/users/profile-picture
 * @access  Private
 */
uploadProfilePictureDirect = asyncHandler(async (req, res, next) => {
  console.log('=== Direct Profile Picture Upload ===');
  
  if (!req.file) {
    return next(new HttpError('Please upload a file', 400));
  }
  
  // req.file already contains Cloudinary URL from multer-storage-cloudinary
  const userId = req.user._id;
  const alt = req.body.alt || 'Profile picture';
  
  // Get Cloudinary info from multer
  const cloudinaryResult = {
    url: req.file.path, // Cloudinary URL
    publicId: req.file.filename, // Cloudinary public ID
    cloudinaryUrl: req.file.path
  };
  
  // Update user in database
  const user = await User.findById(userId);
  if (!user) {
    throw new HttpError('User not found', 404);
  }
  
  // Delete old profile picture if exists
  if (user.profilePicture && user.profilePicture.publicId) {
    try {
      await cloudinary.uploader.destroy(user.profilePicture.publicId);
      console.log('Old profile picture deleted:', user.profilePicture.publicId);
    } catch (deleteError) {
      console.warn('Failed to delete old picture:', deleteError.message);
    }
  }
  
  // Update with new image
  user.profilePicture = {
    url: cloudinaryResult.url,
    publicId: cloudinaryResult.publicId,
    alt: alt,
    cloudinaryUrl: cloudinaryResult.url
  };
  
  await user.save();
  
  console.log('Profile picture updated successfully for user:', userId);
  
  res.status(200).json({
    success: true,
    message: 'Profile picture uploaded successfully',
    data: {
      profilePicture: user.profilePicture
    }
  });
});

/**
 * @desc    Upload cover image directly to Cloudinary
 * @route   POST /api/users/cover-image
 * @access  Private
 */
uploadCoverImageDirect = asyncHandler(async (req, res, next) => {
  console.log('=== Direct Cover Image Upload ===');
  
  if (!req.file) {
    return next(new HttpError('Please upload a file', 400));
  }
  
  const userId = req.user._id;
  const alt = req.body.alt || 'Cover image';
  
  // Update user in database
  const user = await User.findById(userId);
  if (!user) {
    throw new HttpError('User not found', 404);
  }
  
  // Delete old cover image if exists
  if (user.coverImage && user.coverImage.publicId) {
    await cloudinary.uploader.destroy(user.coverImage.publicId);
  }
  
  // Update with new image
  user.coverImage = {
    url: req.file.path,
    publicId: req.file.filename,
    alt: alt,
    cloudinaryUrl: req.file.path
  };
  
  await user.save();
  
  res.status(200).json({
    success: true,
    message: 'Cover image uploaded successfully',
    data: {
      coverImage: user.coverImage
    }
  });
});

  /**
   * @desc    Remove profile picture
   * @route   DELETE /api/users/profile-picture
   * @access  Private
   */
  removeProfilePicture = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    
    const result = await UserService.removeProfilePicture(userId);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Remove cover image
   * @route   DELETE /api/users/cover-image
   * @access  Private
   */
  removeCoverImage = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    
    const result = await UserService.removeCoverImage(userId);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Change password
   * @route   POST /api/users/change-password
   * @access  Private
   */
  changePassword = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { currentPassword, newPassword } = req.body;
    
    const result = await UserService.changePassword(userId, currentPassword, newPassword);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Request password reset
   * @route   POST /api/auth/forgot-password
   * @access  Public
   */
  forgotPassword = asyncHandler(async (req, res, next) => {
    const { email } = req.body;
    
    if (!email) {
      return next(new HttpError('Please provide an email address', 400));
    }
    
    const result = await UserService.requestPasswordReset(email);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Reset password with token
   * @route   POST /api/auth/reset-password
   * @access  Public
   */
  resetPassword = asyncHandler(async (req, res, next) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return next(new HttpError('Token and new password are required', 400));
    }
    
    const result = await UserService.resetPassword(token, newPassword);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Update social media links
   * @route   PUT /api/users/social-media
   * @access  Private
   */
  updateSocialMedia = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const socialMediaData = req.body;
    
    const result = await UserService.updateSocialMedia(userId, socialMediaData);
    
    res.status(200).json({
      success: true,
      message: 'Social media updated successfully',
      data: result.data
    });
  });

  /**
   * @desc    Add education
   * @route   POST /api/users/education
   * @access  Private
   */
  addEducation = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const educationData = req.body;
    
    const result = await UserService.addEducation(userId, educationData);
    
    res.status(201).json({
      success: true,
      message: 'Education added successfully',
      data: result.data
    });
  });

  /**
   * @desc    Remove education
   * @route   DELETE /api/users/education/:educationId
   * @access  Private
   */
  removeEducation = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { educationId } = req.params;
    
    const result = await UserService.removeEducation(userId, educationId);
    
    res.status(200).json({
      success: true,
      message: 'Education removed successfully',
      data: result.data
    });
  });

  /**
   * @desc    Add experience
   * @route   POST /api/users/experience
   * @access  Private
   */
  addExperience = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const experienceData = req.body;
    
    const result = await UserService.addExperience(userId, experienceData);
    
    res.status(201).json({
      success: true,
      message: 'Experience added successfully',
      data: result.data
    });
  });

  /**
   * @desc    Remove experience
   * @route   DELETE /api/users/experience/:experienceId
   * @access  Private
   */
  removeExperience = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { experienceId } = req.params;
    
    const result = await UserService.removeExperience(userId, experienceId);
    
    res.status(200).json({
      success: true,
      message: 'Experience removed successfully',
      data: result.data
    });
  });

  /**
   * @desc    Add achievement
   * @route   POST /api/users/achievements
   * @access  Private
   */
  addAchievement = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const achievementData = req.body;
    
    const result = await UserService.addAchievement(userId, achievementData);
    
    res.status(201).json({
      success: true,
      message: 'Achievement added successfully',
      data: result.data
    });
  });

  /**
   * @desc    Remove achievement
   * @route   DELETE /api/users/achievements/:achievementId
   * @access  Private
   */
  removeAchievement = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const { achievementId } = req.params;
    
    const result = await UserService.removeAchievement(userId, achievementId);
    
    res.status(200).json({
      success: true,
      message: 'Achievement removed successfully',
      data: result.data
    });
  });

  /**
   * @desc    Update campaign information
   * @route   PUT /api/users/campaign-info
   * @access  Private
   */
  updateCampaignInfo = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const campaignData = req.body;
    
    const result = await UserService.updateCampaignInfo(userId, campaignData);
    
    res.status(200).json({
      success: true,
      message: 'Campaign information updated successfully',
      data: result.data
    });
  });

  /**
   * @desc    Update user preferences
   * @route   PUT /api/users/preferences
   * @access  Private
   */
  updatePreferences = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const preferences = req.body;
    
    const result = await UserService.updatePreferences(userId, preferences);
    
    res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
      data: result.data
    });
  });

  /**
   * @desc    Update campaign statistics
   * @route   PUT /api/users/statistics
   * @access  Private
   */
  updateStatistics = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    const stats = req.body;
    
    const result = await UserService.updateStatistics(userId, stats);
    
    res.status(200).json({
      success: true,
      message: 'Statistics updated successfully',
      data: result.data
    });
  });

  /**
   * @desc    Get public profile (for website visitors)
   * @route   GET /api/users/public-profile
   * @access  Public
   */
  getPublicProfile = asyncHandler(async (req, res, next) => {
    const result = await UserService.getPublicProfile();
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Logout user
   * @route   POST /api/auth/logout
   * @access  Private
   */
  logout = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    
    await UserService.logout(userId);
    
    // Clear cookies
    res.clearCookie('token');
    res.clearCookie('refreshToken');
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  });

  /**
   * @desc    Verify authentication status
   * @route   GET /api/auth/verify
   * @access  Private
   */
  verifyAuth = asyncHandler(async (req, res, next) => {
    const userId = req.user._id;
    
    const result = await UserService.verifyAuth(userId);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });
}

module.exports = new UserController();