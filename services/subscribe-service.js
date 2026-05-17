const Subscribe = require('../models/Subscribe');
const HttpError = require('../middleware/HttpError');
const { emailService } = require('./email-service');

class SubscribeService {
  /**
   * Subscribe email to newsletter
   */
  async subscribe(email, source = 'website', ipAddress = null) {
    try {
      // Validate email
      if (!email) {
        throw new HttpError('Email is required', 400);
      }

      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email)) {
        throw new HttpError('Please provide a valid email address', 400);
      }

      // Check if subscription exists
      let subscription = await Subscribe.findOne({ email: email.toLowerCase() });

      if (subscription) {
        if (subscription.isActive) {
          return {
            success: true,
            message: 'You are already subscribed to our newsletter',
            data: subscription,
            alreadySubscribed: true
          };
        } else {
          // Reactivate subscription
          await subscription.reactivate();
          
          if (ipAddress) {
            subscription.ipAddress = ipAddress;
            await subscription.save();
          }

          // Send reactivation confirmation email
          await this.sendSubscriptionConfirmation(email, true);

          return {
            success: true,
            message: 'Subscription reactivated successfully',
            data: subscription,
            reactivated: true
          };
        }
      }

      // Create new subscription
      subscription = new Subscribe({
        email: email.toLowerCase(),
        isActive: true,
        subscribedAt: new Date(),
        source: source,
        ipAddress: ipAddress
      });

      await subscription.save();

      // Send confirmation email
      await this.sendSubscriptionConfirmation(email, false);

      return {
        success: true,
        message: 'Successfully subscribed to our newsletter!',
        data: subscription
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to subscribe: ' + error.message, 500);
    }
  }

  /**
   * Send subscription confirmation email
   */
  async sendSubscriptionConfirmation(email, isReactivated = false) {
    try {
      const unsubscribeUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/api/subscribe/unsubscribe?email=${encodeURIComponent(email)}`;
      
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1a56db; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .button { display: inline-block; padding: 12px 24px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
            .unsubscribe { font-size: 12px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>${isReactivated ? 'Welcome Back!' : 'Welcome to Our Campaign Newsletter!'} 📧</h2>
            </div>
            <div class="content">
              <p>Dear supporter,</p>
              <p>${isReactivated 
                ? `You have successfully reactivated your subscription to our campaign newsletter.` 
                : `Thank you for subscribing to our campaign newsletter!`}</p>
              <p>You will now receive email updates about:</p>
              <ul>
                <li>Campaign announcements and updates</li>
                <li>Policy proposals and positions</li>
                <li>Upcoming events and rallies</li>
                <li>Press releases and media appearances</li>
                <li>Volunteer opportunities</li>
              </ul>
              <div style="text-align: center;">
                <a href="${process.env.CLIENT_URL}" class="button">Visit Our Campaign Website</a>
              </div>
              <p>Stay informed and engaged as we work together to build a better future for all Americans.</p>
              <p>Thank you for your support!</p>
              <p>Best regards,<br>The Campaign Team</p>
              <div class="unsubscribe">
                <p>You can <a href="${unsubscribeUrl}">unsubscribe</a> from these emails at any time.</p>
                <p>&copy; ${new Date().getFullYear()} Presidential Campaign. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: email,
        subject: isReactivated 
          ? 'You\'re Back! Subscription Reactivated' 
          : 'Welcome to Our Campaign Newsletter!',
        html: emailHtml
      });
    } catch (error) {
      console.error('Failed to send subscription confirmation email:', error);
    }
  }

  /**
   * Unsubscribe from newsletter
   */
  async unsubscribe(email) {
    try {
      if (!email) {
        throw new HttpError('Email is required', 400);
      }

      const subscription = await Subscribe.findOne({ email: email.toLowerCase() });

      if (!subscription) {
        throw new HttpError('Email not found in our subscriber list', 404);
      }

      if (!subscription.isActive) {
        return {
          success: true,
          message: 'You are already unsubscribed from our newsletter'
        };
      }

      await subscription.unsubscribe();

      // Send unsubscribe confirmation email
      await this.sendUnsubscribeConfirmation(email);

      return {
        success: true,
        message: 'Successfully unsubscribed from our newsletter'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to unsubscribe: ' + error.message, 500);
    }
  }

  /**
   * Send unsubscribe confirmation email
   */
  async sendUnsubscribeConfirmation(email) {
    try {
      const resubscribeUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/api/subscribe?email=${encodeURIComponent(email)}`;
      
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Sorry to See You Go</h2>
            </div>
            <div class="content">
              <p>Dear supporter,</p>
              <p>You have been successfully unsubscribed from our campaign newsletter.</p>
              <p>You will no longer receive email updates from us.</p>
              <p>If you unsubscribed by mistake or change your mind, you can <a href="${resubscribeUrl}">click here to resubscribe</a>.</p>
              <p>We hope to welcome you back in the future!</p>
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
        to: email,
        subject: 'Unsubscribed from Campaign Newsletter',
        html: emailHtml
      });
    } catch (error) {
      console.error('Failed to send unsubscribe confirmation email:', error);
    }
  }

  /**
   * Send newsletter to all active subscribers when new post is published
   */
  async sendNewsletterToAllSubscribers(postData) {
    try {
      // Get all active subscribers
      const subscribers = await Subscribe.find({ isActive: true }).select('email');
      
      if (subscribers.length === 0) {
        console.log('No active subscribers to notify');
        return {
          success: true,
          message: 'No active subscribers found',
          sentCount: 0
        };
      }

      const subscriberEmails = subscribers.map(s => s.email);
      
      // Prepare email content
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1a56db; color: white; padding: 20px; text-align: center; }
            .featured-image { width: 100%; max-height: 300px; object-fit: cover; margin: 20px 0; }
            .content { padding: 20px; }
            .excerpt { color: #4b5563; margin: 20px 0; line-height: 1.8; }
            .button { display: inline-block; padding: 12px 24px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
            .unsubscribe { font-size: 12px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>📢 New Campaign Update</h2>
              <h3>${postData.title}</h3>
            </div>
            ${postData.featuredImage ? `<img src="${postData.featuredImage}" alt="${postData.title}" class="featured-image">` : ''}
            <div class="content">
              <div class="excerpt">
                ${postData.excerpt || postData.content.substring(0, 300) + '...'}
              </div>
              <div style="text-align: center;">
                <a href="${process.env.CLIENT_URL}/posts/${postData.slug}" class="button">Read Full Update</a>
              </div>
              <p>Stay informed about our campaign progress and vision for America.</p>
              <p>Thank you for your continued support!</p>
              <p>Best regards,<br>The Campaign Team</p>
              <div class="unsubscribe">
                <p>You received this email because you subscribed to our campaign newsletter.</p>
                <p><a href="${process.env.CLIENT_URL}/api/subscribe/unsubscribe?email={{email}}">Click here to unsubscribe</a></p>
                <p>&copy; ${new Date().getFullYear()} Presidential Campaign. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send emails in batches to avoid rate limiting
      const batchSize = 50;
      let sentCount = 0;
      let failedCount = 0;

      for (let i = 0; i < subscriberEmails.length; i += batchSize) {
        const batch = subscriberEmails.slice(i, i + batchSize);
        
        // Send emails in parallel for each batch
        const promises = batch.map(async (email) => {
          try {
            // Replace unsubscribe placeholder with actual email
            const personalizedHtml = emailHtml.replace('{{email}}', encodeURIComponent(email));
            
            await emailService.sendEmail({
              to: email,
              subject: `New Campaign Update: ${postData.title}`,
              html: personalizedHtml
            });
            return { email, success: true };
          } catch (error) {
            console.error(`Failed to send to ${email}:`, error);
            return { email, success: false };
          }
        });

        const results = await Promise.all(promises);
        sentCount += results.filter(r => r.success).length;
        failedCount += results.filter(r => !r.success).length;

        // Wait between batches to avoid rate limiting
        if (i + batchSize < subscriberEmails.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Update last notified timestamp for successful sends
      await Subscribe.updateLastNotified(subscriberEmails);

      return {
        success: true,
        message: `Newsletter sent to ${sentCount} subscribers`,
        sentCount,
        failedCount,
        totalSubscribers: subscriberEmails.length
      };
    } catch (error) {
      console.error('Failed to send newsletter:', error);
      throw new HttpError('Failed to send newsletter: ' + error.message, 500);
    }
  }

  /**
   * Get all active subscribers (admin only)
   */
  async getAllSubscribers(page = 1, limit = 50, search = '') {
    try {
      const skip = (page - 1) * limit;
      let query = { isActive: true };
      
      if (search) {
        query.email = { $regex: search, $options: 'i' };
      }

      const subscribers = await Subscribe.find(query)
        .sort({ subscribedAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await Subscribe.countDocuments(query);

      return {
        success: true,
        data: subscribers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch subscribers', 500);
    }
  }

  /**
   * Get subscriber statistics
   */
  async getSubscriberStats() {
    try {
      const totalActive = await Subscribe.countDocuments({ isActive: true });
      const totalInactive = await Subscribe.countDocuments({ isActive: false });
      const total = totalActive + totalInactive;
      
      // Get recent subscriptions (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const newLast7Days = await Subscribe.countDocuments({
        subscribedAt: { $gte: sevenDaysAgo },
        isActive: true
      });
      
      // Get last 30 days subscriptions
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const newLast30Days = await Subscribe.countDocuments({
        subscribedAt: { $gte: thirtyDaysAgo },
        isActive: true
      });
      
      // Get source breakdown
      const sourceStats = await Subscribe.aggregate([
        { $match: { isActive: true } },
        { $group: {
            _id: '$source',
            count: { $sum: 1 }
          }
        }
      ]);

      return {
        success: true,
        data: {
          total,
          totalActive,
          totalInactive,
          newLast7Days,
          newLast30Days,
          sourceStats
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch subscriber statistics', 500);
    }
  }

  /**
   * Delete subscriber (admin only)
   */
  async deleteSubscriber(email) {
    try {
      const result = await Subscribe.findOneAndDelete({ email: email.toLowerCase() });
      
      if (!result) {
        throw new HttpError('Subscriber not found', 404);
      }

      return {
        success: true,
        message: 'Subscriber deleted successfully'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to delete subscriber', 500);
    }
  }

  /**
   * Export subscribers to CSV
   */
  async exportSubscribers() {
    try {
      const subscribers = await Subscribe.find({ isActive: true })
        .sort({ subscribedAt: -1 })
        .select('email subscribedAt source notificationCount lastNotifiedAt');

      return {
        success: true,
        data: subscribers
      };
    } catch (error) {
      throw new HttpError('Failed to export subscribers', 500);
    }
  }

  /**
   * Check if email is subscribed
   */
  async isSubscribed(email) {
    try {
      const subscription = await Subscribe.findOne({ 
        email: email.toLowerCase(), 
        isActive: true 
      });
      
      return {
        success: true,
        isSubscribed: !!subscription
      };
    } catch (error) {
      throw new HttpError('Failed to check subscription status', 500);
    }
  }
}

module.exports = new SubscribeService();