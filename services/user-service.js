// services/user-service.js - MongoDB Version with Cloudinary
const User = require('../models/User');
const HttpError = require('../middleware/HttpError');
const { generateToken, generateRefreshToken, verifyToken } = require('../utils/tokenUtils');
const { emailService } = require('./email-service');
const cloudinary = require('../config/cloudinary');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

class UserService {
  constructor() {
    this.tempPasswordResetTokens = new Map(); // Store reset tokens temporarily (use Redis in production)
  }

  /**
   * Authenticate admin user and generate tokens
   */
  async authenticateUser(email, password, ipAddress = null) {
    try {
      // Validate input
      if (!email || !password) {
        throw new HttpError('Please provide email and password', 400);
      }

      // Find user with password field
      const user = await User.findOne({ email }).select('+password');
      
      if (!user) {
        throw new HttpError('Invalid credentials', 401);
      }

      // Check if user is admin (only admin role allowed)
      if (user.role !== 'admin') {
        throw new HttpError('Unauthorized access', 403);
      }

      // Check if account is locked
      if (user.lockUntil && user.lockUntil > Date.now()) {
        const remainingTime = Math.ceil((user.lockUntil - Date.now()) / 60000);
        throw new HttpError(`Account locked. Try again in ${remainingTime} minutes`, 401);
      }

      // Check password
      const isPasswordMatch = await user.comparePassword(password);
      
      if (!isPasswordMatch) {
        // Increment login attempts
        await user.incrementLoginAttempts();
        throw new HttpError('Invalid credentials', 401);
      }

      // Reset login attempts on successful login
      await user.resetLoginAttempts();

      // Update last login
      user.lastLogin = Date.now();
      await user.save();

      // Generate tokens
      const token = generateToken(user._id);
      const refreshToken = generateRefreshToken(user._id);

      // Remove password from output
      const userData = user.toObject();
      delete userData.password;

      // Log login activity
      if (ipAddress) {
        console.log(`Admin login from IP: ${ipAddress} at ${new Date().toISOString()}`);
      }

      return {
        success: true,
        data: {
          user: userData,
          token,
          refreshToken
        }
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Authentication failed', 500);
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(refreshToken) {
    try {
      if (!refreshToken) {
        throw new HttpError('Refresh token required', 401);
      }

      // Verify refresh token
      const decoded = verifyToken(refreshToken, true);
      
      // Get user
      const user = await User.findById(decoded.id);
      
      if (!user) {
        throw new HttpError('User not found', 401);
      }
      
      if (!user.isActive) {
        throw new HttpError('Account deactivated', 401);
      }

      // Generate new tokens
      const newToken = generateToken(user._id);
      const newRefreshToken = generateRefreshToken(user._id);

      return {
        success: true,
        data: {
          token: newToken,
          refreshToken: newRefreshToken
        }
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Token refresh failed', 500);
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId).select('-password');
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      return {
        success: true,
        data: user
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to fetch user profile', 500);
    }
  }



/**
 * Update user profile
 */
async updateUserProfile(userId, updateData) {
  try {
    // Check if email is being updated
    const newEmail = updateData.email;
    
    // If email is being changed, check if it's already taken by another user
    if (newEmail) {
      const existingUser = await User.findOne({ 
        email: newEmail.toLowerCase().trim(),
        _id: { $ne: userId } // Exclude current user
      });
      
      if (existingUser) {
        throw new HttpError('Email is already taken by another user', 400);
      }
    }
    
    // Remove sensitive fields that shouldn't be updated directly
    delete updateData.password;
    delete updateData.role;
    delete updateData.loginAttempts;
    delete updateData.lockUntil;
    delete updateData.__v;
    delete updateData._id;
    delete updateData.createdAt;
    
    // Don't delete email - we want to allow email updates
    
    // Update the user
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true } // runValidators will enforce email format
    ).select('-password');
    
    if (!user) {
      throw new HttpError('User not found', 404);
    }
    
    console.log('Profile updated successfully for user:', user._id);
    if (newEmail) {
      console.log('Email changed to:', user.email);
    }
    
    return {
      success: true,
      data: user
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    
    // Handle duplicate key error for email
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      throw new HttpError('Email is already taken by another user', 400);
    }
     
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      throw new HttpError(messages.join(', '), 400);
    }
    
    console.error('Update profile error:', error);
    throw new HttpError('Failed to update user profile: ' + error.message, 500);
  }
}

/**
 * Upload profile picture to Cloudinary
 */
async uploadProfilePicture(userId, filePath, alt = 'Profile picture') {
  try {
    console.log('=== Starting profile picture upload ===');
    console.log('User ID:', userId);
    console.log('File path:', filePath);
    console.log('Alt text:', alt);
    
    // Check if file exists
    if (!filePath) {
      console.error('No file path provided');
      throw new HttpError('No file provided', 400);
    }
    
    // Check if file exists on disk
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist at path: ${filePath}`);
      throw new HttpError('File not found on server', 400);
    }
    
    console.log('File exists, size:', fs.statSync(filePath).size, 'bytes');
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      console.error(`User not found: ${userId}`);
      throw new HttpError('User not found', 404);
    }
    
    console.log('User found:', user.email);
    
    // Delete old profile picture from Cloudinary if exists
    if (user.profilePicture && user.profilePicture.publicId) {
      console.log('Deleting old profile picture:', user.profilePicture.publicId);
      try {
        await cloudinary.uploader.destroy(user.profilePicture.publicId);
        console.log('Old profile picture deleted successfully');
      } catch (deleteError) {
        console.warn('Failed to delete old picture:', deleteError.message);
        // Continue with upload even if delete fails
      }
    }
    
    // Upload new image to Cloudinary
    console.log('Uploading to Cloudinary...');
    console.log('Cloudinary config check:', {
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? 'Set' : 'Missing',
      api_key: process.env.CLOUDINARY_API_KEY ? 'Set' : 'Missing',
      api_secret: process.env.CLOUDINARY_API_SECRET ? 'Set' : 'Missing'
    });
    
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'campaign/profiles',
      width: 500,
      height: 500,
      crop: 'fill',
      gravity: 'face',
      quality: 'auto'
    });
    
    console.log('Cloudinary upload successful:', {
      public_id: result.public_id,
      url: result.secure_url,
      size: result.bytes
    });
    
    // Update user with new profile picture
    user.profilePicture = {
      url: result.secure_url,
      publicId: result.public_id,
      alt: alt,
      cloudinaryUrl: result.secure_url
    };
    
    await user.save();
    console.log('User updated successfully');
    
    // Remove temporary file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Temporary file removed:', filePath);
    }
    
    console.log('=== Profile picture upload completed ===');
    
    return {
      success: true,
      data: {
        profilePicture: user.profilePicture
      }
    };
  } catch (error) {
    console.error('=== Profile picture upload failed ===');
    console.error('Error object:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Clean up temp file if it exists
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('Cleaned up temp file:', filePath);
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', cleanupError);
      }
    }
    
    if (error instanceof HttpError) throw error;
    
    // Check for specific Cloudinary errors
    if (error.message && error.message.includes('Cloudinary')) {
      throw new HttpError('Cloudinary upload failed: ' + error.message, 500);
    }
    
    throw new HttpError('Failed to upload profile picture: ' + error.message, 500);
  }
}

/**
 * Upload cover image to Cloudinary - UPDATED with better error handling
 */
async uploadCoverImage(userId, filePath, alt = 'Cover image') {
  try {
    console.log('=== Starting cover image upload ===');
    console.log('User ID:', userId);
    console.log('File path:', filePath);
    
    // Check if file exists
    if (!filePath) {
      console.error('No file path provided');
      throw new HttpError('No file provided', 400);
    }
    
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist at path: ${filePath}`);
      throw new HttpError('File not found on server', 400);
    }
    
    console.log('File exists, size:', fs.statSync(filePath).size, 'bytes');
    
    const user = await User.findById(userId);
    
    if (!user) {
      console.error(`User not found: ${userId}`);
      throw new HttpError('User not found', 404);
    }
    
    // Delete old cover image from Cloudinary if exists
    if (user.coverImage && user.coverImage.publicId) {
      console.log('Deleting old cover image:', user.coverImage.publicId);
      try {
        await cloudinary.uploader.destroy(user.coverImage.publicId);
        console.log('Old cover image deleted successfully');
      } catch (deleteError) {
        console.warn('Failed to delete old cover image:', deleteError.message);
      }
    }
    
    // Upload new image to Cloudinary
    console.log('Uploading to Cloudinary...');
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'campaign/covers',
      width: 1200,
      height: 400,
      crop: 'fill',
      quality: 'auto'
    });
    
    console.log('Cloudinary upload successful:', {
      public_id: result.public_id,
      url: result.secure_url
    });
    
    // Update user with new cover image
    user.coverImage = {
      url: result.secure_url,
      publicId: result.public_id,
      alt: alt,
      cloudinaryUrl: result.secure_url
    };
    
    await user.save();
    console.log('User updated successfully');
    
    // Remove temporary file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log('Temporary file removed:', filePath);
    }
    
    console.log('=== Cover image upload completed ===');
    
    return {
      success: true,
      data: {
        coverImage: user.coverImage
      }
    };
  } catch (error) {
    console.error('=== Cover image upload failed ===');
    console.error('Error:', error);
    
    // Clean up temp file if it exists
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log('Cleaned up temp file:', filePath);
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', cleanupError);
      }
    }
    
    if (error instanceof HttpError) throw error;
    throw new HttpError('Failed to upload cover image: ' + error.message, 500);
  }
}

  /**
   * Remove profile picture
   */
  async removeProfilePicture(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      // Delete from Cloudinary if exists
      if (user.profilePicture && user.profilePicture.publicId) {
        await cloudinary.uploader.destroy(user.profilePicture.publicId);
      }

      // Reset profile picture
      user.profilePicture = {
        url: null,
        publicId: null,
        alt: 'Profile picture',
        cloudinaryUrl: null
      };

      await user.save();

      return {
        success: true,
        message: 'Profile picture removed successfully'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to remove profile picture', 500);
    }
  }

  /**
   * Remove cover image
   */
  async removeCoverImage(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      // Delete from Cloudinary if exists
      if (user.coverImage && user.coverImage.publicId) {
        await cloudinary.uploader.destroy(user.coverImage.publicId);
      }

      // Reset cover image
      user.coverImage = {
        url: null,
        publicId: null,
        alt: 'Cover image',
        cloudinaryUrl: null
      };

      await user.save();

      return {
        success: true,
        message: 'Cover image removed successfully'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to remove cover image', 500);
    }
  }

  /**
   * Change password
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      // Validate input
      if (!currentPassword || !newPassword) {
        throw new HttpError('Current password and new password are required', 400);
      }

      if (newPassword.length < 6) {
        throw new HttpError('New password must be at least 6 characters', 400);
      }

      // Get user with password
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      // Verify current password
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        throw new HttpError('Current password is incorrect', 401);
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Send confirmation email
      await emailService.sendPasswordChangeConfirmation(user.email, user.name);

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to change password', 500);
    }
  }

  /**
   * Request password reset (send reset email)
   */
  async requestPasswordReset(email) {
    try {
      const user = await User.findOne({ email });
      
      if (!user) {
        // Don't reveal that user doesn't exist for security
        return {
          success: true,
          message: 'If an account exists with this email, you will receive a password reset link'
        };
      }

      // Generate reset token (simple random token for demo)
      const resetToken = Math.random().toString(36).substring(2, 15) + 
                        Math.random().toString(36).substring(2, 15);
      
      // Store token with expiration (1 hour)
      this.tempPasswordResetTokens.set(resetToken, {
        userId: user._id,
        expiresAt: Date.now() + 3600000 // 1 hour
      });

      // Send reset email
      await emailService.sendPasswordReset(user.email, resetToken);

      return {
        success: true,
        message: 'Password reset link sent to your email'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to process password reset request', 500);
    }
  }

  /**
   * Reset password using token
   */
  async resetPassword(token, newPassword) {
    try {
      // Validate token
      const resetData = this.tempPasswordResetTokens.get(token);
      
      if (!resetData || resetData.expiresAt < Date.now()) {
        throw new HttpError('Invalid or expired reset token', 400);
      }

      if (!newPassword || newPassword.length < 6) {
        throw new HttpError('Password must be at least 6 characters', 400);
      }

      // Find user
      const user = await User.findById(resetData.userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      // Update password
      user.password = newPassword;
      await user.save();

      // Delete used token
      this.tempPasswordResetTokens.delete(token);

      // Send confirmation email
      await emailService.sendPasswordChangeConfirmation(user.email, user.name);

      return {
        success: true,
        message: 'Password reset successfully'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to reset password', 500);
    }
  }

  /**
   * Update social media links
   */
  async updateSocialMedia(userId, socialMediaData) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      // Update social media fields
      user.socialMedia = {
        ...user.socialMedia,
        ...socialMediaData
      };

      await user.save();

      return {
        success: true,
        data: user.socialMedia
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to update social media', 500);
    }
  }

  /**
   * Add education entry
   */
  async addEducation(userId, educationData) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      user.education.push(educationData);
      await user.save();

      return {
        success: true,
        data: user.education
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to add education', 500);
    }
  }

  /**
   * Remove education entry
   */
  async removeEducation(userId, educationId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      user.education = user.education.filter(edu => edu._id.toString() !== educationId);
      await user.save();

      return {
        success: true,
        data: user.education
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to remove education', 500);
    }
  }

  /**
   * Add experience entry
   */
  async addExperience(userId, experienceData) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      user.experience.push(experienceData);
      await user.save();

      return {
        success: true,
        data: user.experience
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to add experience', 500);
    }
  }

  /**
   * Remove experience entry
   */
  async removeExperience(userId, experienceId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      user.experience = user.experience.filter(exp => exp._id.toString() !== experienceId);
      await user.save();

      return {
        success: true,
        data: user.experience
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to remove experience', 500);
    }
  }

  /**
   * Add achievement entry
   */
  async addAchievement(userId, achievementData) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      user.achievements.push(achievementData);
      await user.save();

      return {
        success: true,
        data: user.achievements
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to add achievement', 500);
    }
  }

  /**
   * Remove achievement entry
   */
  async removeAchievement(userId, achievementId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      user.achievements = user.achievements.filter(ach => ach._id.toString() !== achievementId);
      await user.save();

      return {
        success: true,
        data: user.achievements
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to remove achievement', 500);
    }
  }

  /**
   * Update campaign information
   */
  async updateCampaignInfo(userId, campaignData) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      // Update campaign fields
      if (campaignData.campaignWebsite) user.campaignWebsite = campaignData.campaignWebsite;
      if (campaignData.campaignManager) user.campaignManager = campaignData.campaignManager;
      if (campaignData.campaignOffice) user.campaignOffice = campaignData.campaignOffice;
      if (campaignData.campaignStartDate) user.campaignStartDate = campaignData.campaignStartDate;
      if (campaignData.campaignSlogan) user.campaignSlogan = campaignData.campaignSlogan;
      if (campaignData.politicalParty) user.politicalParty = campaignData.politicalParty;
      if (campaignData.position) user.position = campaignData.position;

      await user.save();

      return {
        success: true,
        data: {
          campaignWebsite: user.campaignWebsite,
          campaignManager: user.campaignManager,
          campaignOffice: user.campaignOffice,
          campaignStartDate: user.campaignStartDate,
          campaignSlogan: user.campaignSlogan,
          politicalParty: user.politicalParty,
          position: user.position
        }
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to update campaign information', 500);
    }
  }

  /**
   * Update user preferences
   */
  async updatePreferences(userId, preferences) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      user.preferences = {
        ...user.preferences,
        ...preferences
      };

      await user.save();

      return {
        success: true,
        data: user.preferences
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to update preferences', 500);
    }
  }

  /**
   * Update campaign statistics
   */
  async updateStatistics(userId, stats) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new HttpError('User not found', 404);
      }

      if (stats.followerCount !== undefined) user.followerCount = stats.followerCount;
      if (stats.postCount !== undefined) user.postCount = stats.postCount;
      if (stats.totalDonations !== undefined) user.totalDonations = stats.totalDonations;
      if (stats.donationCount !== undefined) user.donationCount = stats.donationCount;

      await user.save();

      return {
        success: true,
        data: {
          followerCount: user.followerCount,
          postCount: user.postCount,
          totalDonations: user.totalDonations,
          donationCount: user.donationCount
        }
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to update statistics', 500);
    }
  }

  /**
   * Get public profile (for public viewing)
   */
  async getPublicProfile() {
    try {
      // Get the admin user for public view
      const user = await User.findOne({ role: 'admin' }).select('-password -email -phone -loginAttempts -lockUntil -isVerified');
      
      if (!user) {
        throw new HttpError('Profile not found', 404);
      }

      return {
        success: true,
        data: user
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to fetch public profile', 500);
    }
  }

  /**
   * Check if user is authenticated and valid
   */
  async verifyAuth(userId) {
    try {
      const user = await User.findById(userId).select('-password');
      
      if (!user) {
        throw new HttpError('User not found', 401);
      }
      
      if (!user.isActive) {
        throw new HttpError('Account is deactivated', 401);
      }

      return {
        success: true,
        data: user
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Authentication verification failed', 500);
    } 
  }

  /**
   * Logout user (invalidate tokens - client-side cleanup)
   */
  async logout(userId) {
    try {
      // In a production app, you might want to add the token to a blacklist
      // For now, just return success as client will remove tokens
      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      throw new HttpError('Logout failed', 500);
    }
  }
}

module.exports = new UserService();