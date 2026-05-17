const Message = require('../models/Message');
const Subscribe = require('../models/Subscribe');
const HttpError = require('../middleware/HttpError');
const { emailService } = require('./email-service');

class MessageService {
  /**
   * Send auto-response to user (async)
   */
  async sendAutoResponse(message) {
    try {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1a56db; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .message-box { background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-left: 4px solid #1a56db; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Thank You for Reaching Out!</h2>
            </div>
            <div class="content">
              <p>Dear ${message.name},</p>
              <p>Thank you for contacting the campaign team. We have received your message and will respond as soon as possible.</p>
              <div class="message-box">
                <p><strong>Your Message:</strong></p>
                <p>${message.message.substring(0, 200)}${message.message.length > 200 ? '...' : ''}</p>
                <p><strong>Reference ID:</strong> ${message._id}</p>
              </div>
              <p>Our team typically responds within 24-48 hours.</p>
              <p>In the meantime, you can:</p>
              <ul>
                <li>Follow our campaign on social media for updates</li>
                <li>Volunteer to help make a difference</li>
                <li>Share our vision with friends and family</li>
              </ul>
              <p>Thank you for your support!</p>
              <p>Best regards,<br>The Campaign Team</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Presidential Campaign. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: message.email,
        subject: `Thank you for contacting us - ${message.subject}`,
        html: emailHtml
      });
    } catch (error) {
      console.error('Failed to send auto-response:', error);
    }
  }

  /**
   * Send notification to admin (async)
   */
  async sendAdminNotification(message) {
    try {
      const priorityColors = {
        low: '#6b7280',
        medium: '#3b82f6',
        high: '#f59e0b',
        urgent: '#ef4444'
      };

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1a56db; color: white; padding: 20px; text-align: center; }
            .message-box { background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-left: 4px solid #1a56db; }
            .priority { display: inline-block; padding: 5px 10px; border-radius: 5px; color: white; background-color: ${priorityColors[message.priority]}; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Contact Message</h2>
            </div>
            <div class="message-box">
              <p><strong>From:</strong> ${message.name}</p>
              <p><strong>Email:</strong> ${message.email}</p>
              ${message.phone ? `<p><strong>Phone:</strong> ${message.phone}</p>` : ''}
              <p><strong>Category:</strong> ${message.category}</p>
              <p><strong>Priority:</strong> <span class="priority">${message.priority}</span></p>
              <p><strong>Subject:</strong> ${message.subject}</p>
              <p><strong>Message:</strong></p>
              <p>${message.message}</p>
              <p><strong>Message ID:</strong> ${message._id}</p>
            </div>
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.CLIENT_URL}/admin/messages/${message._id}" 
                 style="display: inline-block; padding: 10px 20px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 5px;">
                View & Respond
              </a>
            </div>
            <div class="footer">
              <p>This is an automated notification from your campaign website.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: process.env.SMTP_FROM_EMAIL,
        subject: `New Contact Message: ${message.subject} (Priority: ${message.priority})`,
        html: emailHtml
      });
    } catch (error) {
      console.error('Failed to send admin notification:', error);
    }
  }

  /**
   * Create a new contact message
   */
  async createMessage(messageData, ipAddress = null, userAgent = null, referrer = null) {
    try {
      const { name, email, phone, subject, message, category, subscribeToNewsletter } = messageData;

      // Validate required fields
      if (!name || !email || !subject || !message) {
        throw new HttpError('Name, email, subject, and message are required', 400);
      }

      // Validate email format
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        throw new HttpError('Please provide a valid email address', 400);
      }

      // Check for duplicate messages (same email and similar content within 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentMessage = await Message.findOne({
        email,
        message: { $regex: message.substring(0, 50), $options: 'i' },
        createdAt: { $gte: fiveMinutesAgo }
      });

      if (recentMessage) {
        throw new HttpError('You have already sent a similar message recently. Please wait a few minutes.', 429);
      }

      // Create message
      const newMessage = new Message({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone || '',
        subject: subject.trim(),
        message: message.trim(),
        category: category || 'general',
        subscribeToNewsletter: subscribeToNewsletter || false,
        ipAddress,
        userAgent,
        referrer
      });

      await newMessage.save();

      // Auto-mark as high priority for urgent categories
      if (category === 'urgent' || subject.toLowerCase().includes('urgent')) {
        await newMessage.setPriority('urgent');
      }

      // Handle newsletter subscription if requested
      if (subscribeToNewsletter) {
        console.log(`Newsletter subscription requested for: ${email}`);
      }

      // Send emails asynchronously using setImmediate
      setImmediate(async () => {
        try {
          await this.sendAutoResponse(newMessage);
          console.log(`Auto-response sent to ${newMessage.email}`);
        } catch (emailError) {
          console.error(`Failed to send auto-response to ${newMessage.email}:`, emailError);
        }
      });

      setImmediate(async () => {
        try {
          await this.sendAdminNotification(newMessage);
          console.log(`Admin notification sent for message ${newMessage._id}`);
        } catch (emailError) {
          console.error(`Failed to send admin notification for message ${newMessage._id}:`, emailError);
        }
      });

      return {
        success: true,
        message: 'Your message has been sent successfully. We will get back to you soon!',
        data: {
          id: newMessage._id,
          status: newMessage.status,
          createdAt: newMessage.createdAt
        }
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to send message: ' + error.message, 500);
    }
  }

  /**
   * Get all messages (admin only)
   */
  async getAllMessages(filters = {}, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      let query = {};

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query.status = filters.status;
      }
      if (filters.category && filters.category !== 'all') {
        query.category = filters.category;
      }
      if (filters.priority && filters.priority !== 'all') {
        query.priority = filters.priority;
      }
      if (filters.isSpam !== undefined && filters.isSpam !== 'all') {
        query.isSpam = filters.isSpam === 'true';
      }
      if (filters.search) {
        query.$or = [
          { name: { $regex: filters.search, $options: 'i' } },
          { email: { $regex: filters.search, $options: 'i' } },
          { subject: { $regex: filters.search, $options: 'i' } },
          { message: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const messages = await Message.find(query)
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Message.countDocuments(query);

      return {
        success: true,
        data: messages,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch messages', 500);
    }
  }

  /**
   * Get single message by ID (admin only)
   */
  async getMessageById(messageId) {
    try {
      const message = await Message.findById(messageId).lean();
      
      if (!message) {
        throw new HttpError('Message not found', 404);
      }

      // Mark as read if not already
      if (message.status === 'unread') {
        const msg = await Message.findById(messageId);
        await msg.markAsRead();
        message.status = 'read';
        message.readAt = new Date();
      }

      return {
        success: true,
        data: message
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to fetch message', 500);
    }
  }

  /**
   * Reply to a message
   */
  async replyToMessage(messageId, responseMessage, adminId, adminName) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new HttpError('Message not found', 404);
      }

      // Mark as replied
      await message.markAsReplied(responseMessage, adminId);

      // Send email response to user asynchronously
      setImmediate(async () => {
        try {
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #1a56db; color: white; padding: 20px; text-align: center; }
                .original-message { background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-left: 4px solid #9ca3af; }
                .response { background-color: #e0e7ff; padding: 15px; margin: 20px 0; border-left: 4px solid #1a56db; }
                .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h2>Response from the Campaign Team</h2>
                </div>
                <div class="content">
                  <p>Dear ${message.name},</p>
                  <p>Thank you for reaching out to us. Here is our response to your inquiry:</p>
                  
                  <div class="response">
                    <p><strong>Response from ${adminName}:</strong></p>
                    <p>${responseMessage}</p>
                  </div>
                  
                  <div class="original-message">
                    <p><strong>Your original message (${message.subject}):</strong></p>
                    <p>${message.message}</p>
                  </div>
                  
                  <p>If you have any further questions, please don't hesitate to contact us again.</p>
                  <p>Thank you for your engagement in this important campaign.</p>
                  <p>Best regards,<br>${adminName}<br>Campaign Team</p>
                </div>
                <div class="footer">
                  <p>&copy; ${new Date().getFullYear()} Presidential Campaign. All rights reserved.</p>
                </div>
              </div>
            </body>
            </html>
          `;

          await emailService.sendEmail({
            to: message.email,
            subject: `Re: ${message.subject}`,
            html: emailHtml
          });
          console.log(`Reply sent to ${message.email}`);
        } catch (emailError) {
          console.error(`Failed to send reply to ${message.email}:`, emailError);
        }
      });

      return {
        success: true,
        message: 'Response sent successfully',
        data: {
          respondedAt: message.adminResponse.respondedAt,
          response: message.adminResponse.message
        }
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to send response', 500);
    }
  }

  /**
   * Update message priority
   */
  async updatePriority(messageId, priority) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new HttpError('Message not found', 404);
      }

      await message.setPriority(priority);

      return {
        success: true,
        message: 'Priority updated successfully',
        data: { priority: message.priority }
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to update priority', 500);
    }
  }

  /**
   * Archive a message
   */
  async archiveMessage(messageId) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new HttpError('Message not found', 404);
      }

      await message.archive();

      return {
        success: true,
        message: 'Message archived successfully'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to archive message', 500);
    }
  }

  /**
   * Mark message as spam
   */
  async markAsSpam(messageId) {
    try {
      const message = await Message.findById(messageId);
      
      if (!message) {
        throw new HttpError('Message not found', 404);
      }

      message.status = 'spam';
      message.isSpam = true;
      await message.save();

      return {
        success: true,
        message: 'Message marked as spam'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to mark message as spam', 500);
    }
  }

  /**
   * Delete a message permanently
   */
  async deleteMessage(messageId) {
    try {
      const message = await Message.findByIdAndDelete(messageId);
      
      if (!message) {
        throw new HttpError('Message not found', 404);
      }

      return {
        success: true,
        message: 'Message deleted successfully'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to delete message', 500);
    }
  }

  /**
   * Get message statistics
   */
  async getMessageStats() {
    try {
      const total = await Message.countDocuments();
      const unread = await Message.countDocuments({ status: 'unread' });
      const read = await Message.countDocuments({ status: 'read' });
      const replied = await Message.countDocuments({ status: 'replied' });
      const archived = await Message.countDocuments({ status: 'archived' });
      const spam = await Message.countDocuments({ status: 'spam' });
      
      const urgent = await Message.countDocuments({ 
        priority: 'urgent', 
        status: { $nin: ['archived', 'spam'] } 
      });
      
      const categoryStats = await Message.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        }
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayMessages = await Message.countDocuments({
        createdAt: { $gte: today }
      });

      const thisWeek = new Date();
      thisWeek.setDate(thisWeek.getDate() - 7);
      const weeklyMessages = await Message.countDocuments({
        createdAt: { $gte: thisWeek }
      });

      return {
        success: true,
        data: {
          total,
          unread,
          read,
          replied,
          archived,
          spam,
          urgent,
          todayMessages,
          weeklyMessages,
          categoryStats
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch message statistics', 500);
    }
  }

  /**
   * Get recent messages preview
   */
  async getRecentMessages(limit = 5) {
    try {
      const messages = await Message.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('name email subject category status priority createdAt');

      return {
        success: true,
        data: messages
      };
    } catch (error) {
      throw new HttpError('Failed to fetch recent messages', 500);
    }
  }

  /**
   * Bulk update message status
   */
  async bulkUpdateStatus(messageIds, status) {
    try {
      await Message.updateMany(
        { _id: { $in: messageIds } },
        { status: status }
      );

      return {
        success: true,
        message: `${messageIds.length} messages updated successfully`
      };
    } catch (error) {
      throw new HttpError('Failed to update messages', 500);
    }
  }

  /**
   * Export messages to CSV
   */
  async exportMessages(filters = {}) {
    try {
      let query = {};

      if (filters.status && filters.status !== 'all') {
        query.status = filters.status;
      }
      if (filters.category && filters.category !== 'all') {
        query.category = filters.category;
      }
      if (filters.startDate) {
        query.createdAt = { $gte: new Date(filters.startDate) };
      }
      if (filters.endDate) {
        query.createdAt = { ...query.createdAt, $lte: new Date(filters.endDate) };
      }

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .select('name email phone subject message category status priority createdAt readAt adminResponse.respondedAt')
        .lean();

      return {
        success: true,
        data: messages
      };
    } catch (error) {
      throw new HttpError('Failed to export messages', 500);
    }
  }
}

module.exports = new MessageService();