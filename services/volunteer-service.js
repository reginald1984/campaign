// backend/services/volunteer-service.js
const Volunteer = require('../models/Volunteer');
const HttpError = require('../middleware/HttpError');
const { cloudinary } = require('../config/cloudinary');
const { emailService } = require('./email-service');
const fs = require('fs');

class VolunteerService {
  constructor() {
    this.allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    this.maxImageSize = 5 * 1024 * 1024; // 5MB
  }

  /**
   * Upload ID picture to Cloudinary
   */
  async uploadIdPicture(filePath, idNumber) {
    try {
      // Check if file exists
      if (!filePath || !fs.existsSync(filePath)) {
        throw new Error('File not found');
      }

      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'volunteers/id-pictures',
        public_id: `volunteer_${idNumber}_${Date.now()}`,
        transformation: [
          { width: 800, height: 800, crop: 'limit', quality: 'auto' }
        ]
      });

      // Remove temporary file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return {
        url: result.secure_url,
        publicId: result.public_id,
        filename: result.original_filename,
        size: result.bytes,
        mimeType: result.format,
        uploadedAt: new Date()
      };
    } catch (error) {
      console.error('Failed to upload ID picture:', error);
      throw new HttpError('Failed to upload ID picture: ' + error.message, 500);
    }
  }

  /**
   * Send welcome email to volunteer
   */
  async sendWelcomeEmail(volunteer) {
    try {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #81022c, #330011); color: white; padding: 30px; text-align: center; }
            .content { padding: 30px; background: #f9fafb; }
            .button { display: inline-block; padding: 12px 24px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Welcome to the Team, ${volunteer.name}! 🎉</h2>
            </div>
            <div class="content">
              <p>Dear ${volunteer.name},</p>
              <p>Thank you for volunteering with our campaign! Your application has been received and is currently under review.</p>
              <p><strong>Application Reference ID:</strong> ${volunteer._id}</p>
              <p><strong>ID Number:</strong> ${volunteer.idNumber}</p>
              <p>Our volunteer coordinator will review your application and contact you within 48 hours with next steps.</p>
              <div style="background-color: #e0e7ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h4 style="margin-top: 0;">What's next?</h4>
                <ul>
                  <li>Application review (24-48 hours)</li>
                  <li>Virtual orientation session invitation</li>
                  <li>Training materials and resources</li>
                  <li>Assignment to a team based on your interests</li>
                </ul>
              </div>
              <a href="${process.env.CLIENT_URL}/volunteer/status/${volunteer._id}" class="button">Check Application Status</a>
              <p style="margin-top: 20px;">We're excited to have you on board! Together, we can make a difference.</p>
              <p>Best regards,<br>The Campaign Volunteer Team</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Presidential Campaign. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: volunteer.email,
        subject: 'Welcome to Our Volunteer Team! 🇺🇸',
        html: emailHtml
      });
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }
  }

  /**
   * Send admin notification for new volunteer
   */
  async sendAdminNotification(volunteer) {
    try {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #81022c, #330011); color: white; padding: 20px; text-align: center; }
            .info-box { background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-left: 4px solid #1a56db; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Volunteer Application</h2>
            </div>
            <div class="info-box">
              <p><strong>Name:</strong> ${volunteer.name}</p>
              <p><strong>ID Number:</strong> ${volunteer.idNumber}</p>
              <p><strong>Email:</strong> ${volunteer.email}</p>
              <p><strong>Phone:</strong> ${volunteer.phone}</p>
              <p><strong>City:</strong> ${volunteer.city || 'Not provided'}</p>
              <p><strong>Availability:</strong> ${volunteer.availability}</p>
              <p><strong>Interests:</strong> ${volunteer.interests.join(', ')}</p>
              <p><strong>Skills:</strong> ${volunteer.skills.join(', ')}</p>
            </div>
            <div style="text-align: center;">
              <a href="${process.env.CLIENT_URL}/admin/volunteers/${volunteer._id}" 
                 style="display: inline-block; padding: 10px 20px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 5px;">
                Review Application
              </a>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: process.env.SMTP_FROM_EMAIL,
        subject: `New Volunteer Application: ${volunteer.name}`,
        html: emailHtml
      });
    } catch (error) {
      console.error('Failed to send admin notification:', error);
    }
  }

  /**
   * Register a new volunteer
   */

async registerVolunteer(volunteerData, idPictureFile, ipAddress = null, userAgent = null, referrer = null) {
  try {
    const {
      idNumber, name, email, address, city, state, country, phone,
      availability, interests, skills, experience, whyJoin,
      emergencyContact, backgroundCheckConsent, termsAccepted,
      subscribeToNewsletter, idPicture: cloudinaryIdPicture
    } = volunteerData;

    // Validate required fields
    if (!idNumber || !name || !email || !phone) {
      throw new HttpError('ID number, name, email, and phone are required', 400);
    }

    if (!termsAccepted) {
      throw new HttpError('You must accept the terms and conditions', 400);
    }

    // Check if volunteer already exists
    const existingVolunteer = await Volunteer.findOne({
      $or: [
        { email: email.toLowerCase() },
        { idNumber: idNumber.toUpperCase() }
      ]
    });

    if (existingVolunteer) {
      throw new HttpError('A volunteer with this email or ID number already exists', 400);
    }

    // Use Cloudinary uploaded picture or upload new one
    let idPicture = cloudinaryIdPicture;
    
    if (!idPicture && idPictureFile && idPictureFile.path) {
      // Fallback for local file upload (if not using Cloudinary storage)
      idPicture = await this.uploadIdPicture(idPictureFile.path, idNumber);
    } else if (!idPicture) {
      throw new HttpError('ID picture is required', 400);
    }

    // Create volunteer
    const volunteer = new Volunteer({
      idNumber: idNumber.trim().toUpperCase(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      address: address || '',
      city: city || '',
      state: state || '',
      country: country || 'United States',
      phone: phone.trim(),
      availability: availability || 'flexible',
      interests: interests || [],
      skills: skills || [],
      experience: experience || '',
      whyJoin: whyJoin || '',
      emergencyContact: {
        name: emergencyContact?.name || '',
        relationship: emergencyContact?.relationship || '',
        phone: emergencyContact?.phone || ''
      },
      backgroundCheckConsent: backgroundCheckConsent || false,
      termsAccepted: termsAccepted,
      subscribeToNewsletter: subscribeToNewsletter || false,
      idPicture: idPicture,
      ipAddress: ipAddress,
      userAgent: userAgent,
      referrer: referrer,
      status: 'pending'
    });

    await volunteer.save();

    // Send emails asynchronously
    setImmediate(async () => {
      try {
        await this.sendWelcomeEmail(volunteer);
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError);
      }
    });

    setImmediate(async () => {
      try {
        await this.sendAdminNotification(volunteer);
      } catch (emailError) {
        console.error('Failed to send admin notification:', emailError);
      }
    });

    // Return volunteer without sensitive info
    const volunteerResponse = volunteer.toObject();
    delete volunteerResponse.ipAddress;
    delete volunteerResponse.userAgent;
    delete volunteerResponse.referrer;

    return {
      success: true,
      message: 'Volunteer application submitted successfully!',
      data: volunteerResponse
    };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError('Failed to register volunteer: ' + error.message, 500);
  }
}


  /**
   * Get all volunteers with filters (admin only)
   */
  async getAllVolunteers(filters = {}, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      let query = {};

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query.status = filters.status;
      }
      if (filters.availability && filters.availability !== 'all') {
        query.availability = filters.availability;
      }
      if (filters.city) {
        query.city = { $regex: filters.city, $options: 'i' };
      }
      if (filters.state) {
        query.state = { $regex: filters.state, $options: 'i' };
      }
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { email: { $regex: filters.search, $options: 'i' } },
          { idNumber: { $regex: filters.search, $options: 'i' } }
        ];
      }
      if (filters.interest) {
        query.interests = filters.interest;
      }
      if (filters.skill) {
        query.skills = filters.skill;
      }

      const volunteers = await Volunteer.find(query)
        .populate('approvedBy', 'name email')
        .populate('assignedTo', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Volunteer.countDocuments(query);

      return {
        success: true,
        data: volunteers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch volunteers', 500);
    }
  }

  /**
   * Get volunteer by ID (admin only)
   */
  async getVolunteerById(volunteerId) {
    try {
      const volunteer = await Volunteer.findById(volunteerId)
        .populate('approvedBy', 'name email')
        .populate('assignedTo', 'name email')
        .lean();

      if (!volunteer) {
        throw new HttpError('Volunteer not found', 404);
      }

      return {
        success: true,
        data: volunteer
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to fetch volunteer', 500);
    }
  }

  /**
   * Get volunteer by ID number
   */
  async getVolunteerByIdNumber(idNumber) {
    try {
      const volunteer = await Volunteer.findOne({ 
        idNumber: idNumber.toUpperCase() 
      }).lean();

      if (!volunteer) {
        throw new HttpError('Volunteer not found', 404);
      }

      return {
        success: true,
        data: volunteer
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to fetch volunteer', 500);
    }
  }

  /**
   * Update volunteer information (admin only)
   */
  async updateVolunteer(volunteerId, updateData) {
    try {
      const volunteer = await Volunteer.findById(volunteerId);
      
      if (!volunteer) {
        throw new HttpError('Volunteer not found', 404);
      }

      // Fields that can be updated
      const allowedUpdates = [
        'address', 'city', 'state', 'country', 'phone',
        'availability', 'interests', 'skills', 'experience',
        'emergencyContact', 'notes', 'assignedTo'
      ];

      allowedUpdates.forEach(field => {
        if (updateData[field] !== undefined) {
          volunteer[field] = updateData[field];
        }
      });

      await volunteer.save();

      return {
        success: true,
        message: 'Volunteer information updated successfully',
        data: volunteer
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to update volunteer', 500);
    }
  }

  /**
   * Approve volunteer application
   */
  async approveVolunteer(volunteerId, adminId) {
    try {
      const volunteer = await Volunteer.findById(volunteerId);
      
      if (!volunteer) {
        throw new HttpError('Volunteer not found', 404);
      }

      if (volunteer.status !== 'pending') {
        throw new HttpError('Application has already been processed', 400);
      }

      await volunteer.approve(adminId);

      // Send approval email
      setImmediate(async () => {
        try {
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #81022c, #330011); color: white; padding: 30px; text-align: center; }
                .content { padding: 30px; background: #f9fafb; }
                .button { display: inline-block; padding: 12px 24px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2>Congratulations, ${volunteer.name}! 🎉</h2>
                </div>
                <div class="content">
                  <p>Dear ${volunteer.name},</p>
                  <p>We are pleased to inform you that your volunteer application has been <strong>APPROVED</strong>!</p>
                  <p>You are now officially part of our campaign volunteer team.</p>
                  <div style="background-color: #e0e7ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h4 style="margin-top: 0;">Next Steps:</h4>
                    <ol>
                      <li>Attend virtual orientation (invitation coming soon)</li>
                      <li>Complete online training modules</li>
                      <li>Join your assigned team's communication channel</li>
                      <li>Schedule your first volunteer shift</li>
                    </ol>
                  </div>
                  <a href="${process.env.CLIENT_URL}/volunteer/dashboard" class="button">Go to Dashboard</a>
                  <p style="margin-top: 20px;">Welcome to the team! Together, we will make history.</p>
                  <p>Best regards,<br>The Campaign Volunteer Coordinator</p>
                </div>
              </div>
            </body>
            </html>
          `;

          await emailService.sendEmail({
            to: volunteer.email,
            subject: 'Volunteer Application Approved! 🎉',
            html: emailHtml
          });
        } catch (emailError) {
          console.error('Failed to send approval email:', emailError);
        }
      });

      return {
        success: true,
        message: 'Volunteer application approved successfully',
        data: volunteer
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to approve volunteer', 500);
    }
  }

  /**
   * Reject volunteer application
   */
  async rejectVolunteer(volunteerId, reason, adminId) {
    try {
      const volunteer = await Volunteer.findById(volunteerId);
      
      if (!volunteer) {
        throw new HttpError('Volunteer not found', 404);
      }

      if (volunteer.status !== 'pending') {
        throw new HttpError('Application has already been processed', 400);
      }

      await volunteer.reject(reason, adminId);

      // Send rejection email
      setImmediate(async () => {
        try {
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #dc2626; color: white; padding: 30px; text-align: center; }
                .content { padding: 30px; background: #f9fafb; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2>Application Update</h2>
                </div>
                <div class="content">
                  <p>Dear ${volunteer.name},</p>
                  <p>Thank you for your interest in volunteering with our campaign.</p>
                  <p>After careful review of your application, we regret to inform you that we are unable to approve your application at this time.</p>
                  ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                  <p>We encourage you to reapply in the future or consider other ways to support our campaign.</p>
                  <p>Thank you for your interest in making a difference.</p>
                  <p>Best regards,<br>The Campaign Volunteer Team</p>
                </div>
              </div>
            </body>
            </html>
          `;

          await emailService.sendEmail({
            to: volunteer.email,
            subject: 'Update on Your Volunteer Application',
            html: emailHtml
          });
        } catch (emailError) {
          console.error('Failed to send rejection email:', emailError);
        }
      });

      return {
        success: true,
        message: 'Volunteer application rejected',
        data: volunteer
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to reject volunteer', 500);
    }
  }

  /**
   * Delete volunteer (soft delete)
   */
  async deleteVolunteer(volunteerId) {
    try {
      const volunteer = await Volunteer.findByIdAndDelete(volunteerId);
      
      if (!volunteer) {
        throw new HttpError('Volunteer not found', 404);
      }

      // Delete ID picture from Cloudinary
      if (volunteer.idPicture && volunteer.idPicture.publicId) {
        await cloudinary.uploader.destroy(volunteer.idPicture.publicId);
      }

      return {
        success: true,
        message: 'Volunteer deleted successfully'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to delete volunteer', 500);
    }
  }

  /**
   * Get volunteer statistics
   */
  async getVolunteerStats() {
    try {
      const stats = await Volunteer.getStats();
      
      // Get recent activity
      const recentApplications = await Volunteer.getRecentApplications(10);

      return {
        success: true,
        data: {
          ...stats,
          recentApplications
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch volunteer statistics', 500);
    }
  }

  /**
   * Add volunteer hours
   */
  async addVolunteerHours(volunteerId, hours, eventId = null, eventName = null) {
    try {
      const volunteer = await Volunteer.findById(volunteerId);
      
      if (!volunteer) {
        throw new HttpError('Volunteer not found', 404);
      }

      if (eventId && eventName) {
        await volunteer.addEventAttendance(eventId, eventName, hours);
      } else {
        await volunteer.addVolunteerHours(hours);
      }

      return {
        success: true,
        message: `Added ${hours} hours to volunteer`,
        data: {
          totalHours: volunteer.hoursVolunteered
        }
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to add volunteer hours', 500);
    }
  }

  /**
   * Add achievement to volunteer
   */
  async addAchievement(volunteerId, title, description) {
    try {
      const volunteer = await Volunteer.findById(volunteerId);
      
      if (!volunteer) {
        throw new HttpError('Volunteer not found', 404);
      }

      await volunteer.addAchievement(title, description);

      return {
        success: true,
        message: 'Achievement added successfully',
        data: volunteer.achievements
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to add achievement', 500);
    }
  }

  /**
   * Export volunteers to CSV
   */
  async exportVolunteers(filters = {}) {
    try {
      let query = {};

      if (filters.status && filters.status !== 'all') {
        query.status = filters.status;
      }
      if (filters.city) {
        query.city = filters.city;
      }
      if (filters.state) {
        query.state = filters.state;
      }

      const volunteers = await Volunteer.find(query)
        .select('idNumber name email phone city state status availability interests skills hoursVolunteered createdAt')
        .sort({ createdAt: -1 })
        .lean();

      return {
        success: true,
        data: volunteers
      };
    } catch (error) {
      throw new HttpError('Failed to export volunteers', 500);
    }
  }
}

module.exports = new VolunteerService();