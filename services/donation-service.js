const Donation = require('../models/Donation');
const Subscribe = require('../models/Subscribe');
const User = require('../models/User');
const HttpError = require('../middleware/HttpError');
const { emailService } = require('./email-service');
const axios = require('axios');

class DonationService {
  constructor() {
    this.paypalApiUrl = process.env.PAYPAL_MODE === 'live' 
      ? 'https://api.paypal.com' 
      : 'https://api.sandbox.paypal.com';
    this.paypalClientId = process.env.PAYPAL_CLIENT_ID;
    this.paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get PayPal access token
   */
  async getPayPalAccessToken() {
    try {
      // Check if token is still valid
      if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
        return this.accessToken;
      }

      const auth = Buffer.from(`${this.paypalClientId}:${this.paypalClientSecret}`).toString('base64');
      
      const response = await axios({
        url: `${this.paypalApiUrl}/v1/oauth2/token`,
        method: 'post',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: 'grant_type=client_credentials'
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Expire 1 minute early
      
      return this.accessToken;
    } catch (error) {
      console.error('Failed to get PayPal token:', error.response?.data || error.message);
      throw new HttpError('Payment service unavailable', 503);
    }
  }

  /**
   * Create PayPal order
   */
  async createPayPalOrder(donationId, amount, currency = 'USD', returnUrl, cancelUrl) {
    try {
      const accessToken = await this.getPayPalAccessToken();
      
      const response = await axios({
        url: `${this.paypalApiUrl}/v2/checkout/orders`,
        method: 'post',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          intent: 'CAPTURE',
          purchase_units: [{
            reference_id: donationId,
            amount: {
              currency_code: currency,
              value: amount.toString(),
              breakdown: {
                item_total: {
                  currency_code: currency,
                  value: amount.toString()
                }
              }
            },
            description: `Campaign Donation - ${donationId}`
          }],
          application_context: {
            return_url: returnUrl,
            cancel_url: cancelUrl,
            brand_name: 'Presidential Campaign',
            landing_page: 'BILLING',
            user_action: 'PAY_NOW'
          }
        }
      });

      return {
        success: true,
        orderId: response.data.id,
        approvalUrl: response.data.links.find(link => link.rel === 'approve').href
      };
    } catch (error) {
      console.error('Failed to create PayPal order:', error.response?.data || error.message);
      throw new HttpError('Failed to create payment order', 500);
    }
  }

  /**
   * Capture PayPal payment
   */
  async capturePayPalOrder(orderId) {
    try {
      const accessToken = await this.getPayPalAccessToken();
      
      const response = await axios({
        url: `${this.paypalApiUrl}/v2/checkout/orders/${orderId}/capture`,
        method: 'post',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        success: true,
        captureId: response.data.purchase_units[0].payments.captures[0].id,
        status: response.data.status,
        amount: response.data.purchase_units[0].payments.captures[0].amount.value,
        currency: response.data.purchase_units[0].payments.captures[0].amount.currency_code,
        payerEmail: response.data.payer.email_address,
        payerName: `${response.data.payer.name.given_name} ${response.data.payer.name.surname}`,
        transactionDetails: response.data
      };
    } catch (error) {
      console.error('Failed to capture PayPal order:', error.response?.data || error.message);
      throw new HttpError('Failed to capture payment', 500);
    }
  }

  /**
   * Create a new donation
   */
  async createDonation(donationData, ipAddress = null) {
    try {
      const {
        donorName,
        donorEmail,
        donorPhone,
        amount,
        currency = 'USD',
        donationType = 'one_time',
        donorAddress,
        occupation,
        employer,
        isAnonymous = false,
        showOnDonorWall = true,
        dedication,
        campaign = 'general',
        source = 'website',
        utmSource,
        utmMedium,
        utmCampaign,
        subscribeToNewsletter = false
      } = donationData;

      // Validate required fields
      if (!donorName || !donorEmail || !amount) {
        throw new HttpError('Donor name, email, and amount are required', 400);
      }

      // Validate amount
      if (amount < 1 || amount > 100000) {
        throw new HttpError('Donation amount must be between $1 and $100,000', 400);
      }

      // Validate email
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(donorEmail)) {
        throw new HttpError('Please provide a valid email address', 400);
      }

      // Create donation record
      const donation = new Donation({
        donorName: donorName.trim(),
        donorEmail: donorEmail.trim().toLowerCase(),
        donorPhone: donorPhone || '',
        amount,
        currency,
        donationType,
        donorAddress: donorAddress || {},
        occupation: occupation || '',
        employer: employer || '',
        isAnonymous,
        showOnDonorWall,
        dedication: dedication || {},
        campaign,
        source,
        utmSource: utmSource || '',
        utmMedium: utmMedium || '',
        utmCampaign: utmCampaign || '',
        paymentMethod: 'paypal',
        paymentStatus: 'pending',
        ipAddress
      });

      await donation.save();

      // Handle newsletter subscription
      if (subscribeToNewsletter) {
        try {
          const SubscribeService = require('./subscribe-service');
          await SubscribeService.subscribe(donorEmail, 'donation', ipAddress);
        } catch (error) {
          console.error('Failed to subscribe donor to newsletter:', error);
        }
      }

      return {
        success: true,
        message: 'Donation initiated successfully',
        data: {
          donationId: donation._id,
          donation
        }
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to create donation: ' + error.message, 500);
    }
  }

  /**
   * Process donation payment
   */
  async processPayment(donationId, returnUrl, cancelUrl) {
    try {
      const donation = await Donation.findById(donationId);
      
      if (!donation) {
        throw new HttpError('Donation not found', 404);
      }

      if (donation.paymentStatus !== 'pending') {
        throw new HttpError('Donation already processed', 400);
      }

      // Create PayPal order
      const paypalOrder = await this.createPayPalOrder(
        donationId,
        donation.amount,
        donation.currency,
        returnUrl,
        cancelUrl
      );

      // Update donation with PayPal order ID
      donation.transactionId = paypalOrder.orderId;
      await donation.save();

      return {
        success: true,
        approvalUrl: paypalOrder.approvalUrl,
        orderId: paypalOrder.orderId
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to process payment: ' + error.message, 500);
    }
  }

  /**
   * Complete donation after PayPal capture
   */
  async completeDonation(orderId, payerId) {
    try {
      // Find donation by transactionId (orderId)
      const donation = await Donation.findOne({ transactionId: orderId });
      
      if (!donation) {
        throw new HttpError('Donation not found', 404);
      }

      if (donation.paymentStatus !== 'pending') {
        throw new HttpError('Donation already completed', 400);
      }

      // Capture PayPal payment
      const captureResult = await this.capturePayPalOrder(orderId);

      if (captureResult.status === 'COMPLETED') {
        // Mark donation as completed
        await donation.markCompleted({
          transactionId: captureResult.captureId,
          payerId: payerId,
          captureDetails: captureResult
        });

        // Update donor name from PayPal if not provided
        if (captureResult.payerName && (!donation.donorName || donation.donorName === 'Anonymous')) {
          donation.donorName = captureResult.payerName;
          await donation.save();
        }

        // Send thank you email
        await this.sendThankYouEmail(donation);

        // Send receipt
        await this.sendReceipt(donation);

        return {
          success: true,
          message: 'Donation completed successfully! Thank you for your support!',
          data: {
            donationId: donation._id,
            amount: donation.amount,
            donorName: donation.isAnonymous ? 'Anonymous' : donation.donorName,
            transactionId: donation.transactionId
          }
        };
      } else {
        donation.paymentStatus = 'failed';
        await donation.save();
        
        throw new HttpError('Payment capture failed', 400);
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to complete donation: ' + error.message, 500);
    }
  }

  /**
   * Send thank you email to donor
   */
  async sendThankYouEmail(donation) {
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
            .donation-details { background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
            .button { display: inline-block; padding: 12px 24px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Thank You for Your Support! 🇺🇸</h2>
            </div>
            <div class="content">
              <p>Dear ${donation.isAnonymous ? 'Supporter' : donation.donorName},</p>
              <p>Thank you for your generous donation to our campaign! Your support helps us build a better future for all Americans.</p>
              <div class="donation-details">
                <h3>Donation Details:</h3>
                <p><strong>Amount:</strong> ${donation.currency} ${donation.amount.toLocaleString()}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Transaction ID:</strong> ${donation.transactionId}</p>
                <p><strong>Type:</strong> ${donation.donationType.replace('_', ' ').toUpperCase()}</p>
              </div>
              <p>Your contribution will be used to:</p>
              <ul>
                <li>Spread our message of hope and unity</li>
                <li>Organize community events and rallies</li>
                <li>Support grassroots organizing efforts</li>
                <li>Ensure every voice is heard</li>
              </ul>
              <div style="text-align: center;">
                <a href="${process.env.CLIENT_URL}" class="button">Join Our Movement</a>
              </div>
              <p>Together, we can make a difference!</p>
              <p>With gratitude,<br>The Campaign Team</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Presidential Campaign. All rights reserved.</p>
              <p>This donation is tax-deductible as allowed by law.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: donation.donorEmail,
        subject: `Thank You for Your ${donation.currency} ${donation.amount} Donation!`,
        html: emailHtml
      });

      donation.thankYouSent = true;
      donation.thankYouSentAt = new Date();
      await donation.save();
    } catch (error) {
      console.error('Failed to send thank you email:', error);
    }
  }

  /**
   * Send receipt to donor
   */
  async sendReceipt(donation) {
    try {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; }
            .donation-details { background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>Official Donation Receipt</h2>
            </div>
            <div class="content">
              <p>Dear ${donation.isAnonymous ? 'Supporter' : donation.donorName},</p>
              <p>This is your official receipt for your contribution to our campaign.</p>
              <div class="donation-details">
                <h3>Receipt Details:</h3>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Amount:</strong> ${donation.currency} ${donation.amount.toLocaleString()}</p>
                <p><strong>Transaction ID:</strong> ${donation.transactionId}</p>
                <p><strong>Payment Method:</strong> PayPal</p>
                <p><strong>Donation Type:</strong> ${donation.donationType.replace('_', ' ').toUpperCase()}</p>
                ${donation.taxDeductible ? '<p><strong>Tax-Deductible:</strong> Yes</p>' : ''}
              </div>
              <p>Please save this receipt for your records. If you have any questions, please contact our support team.</p>
              <p>Thank you again for your support!</p>
            </div>
            <div class="footer">
              <p>Campaign Headquarters</p>
              <p>${new Date().getFullYear()} Presidential Campaign</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: donation.donorEmail,
        subject: `Your Official Donation Receipt - ${donation.transactionId}`,
        html: emailHtml
      });

      donation.receiptSent = true;
      donation.receiptSentAt = new Date();
      await donation.save();
    } catch (error) {
      console.error('Failed to send receipt:', error);
    }
  }

  /**
   * Get all donations (admin only)
   */
  async getAllDonations(filters = {}, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      let query = {};

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query.paymentStatus = filters.status;
      }
      if (filters.donationType && filters.donationType !== 'all') {
        query.donationType = filters.donationType;
      }
      if (filters.campaign && filters.campaign !== 'all') {
        query.campaign = filters.campaign;
      }
      if (filters.startDate) {
        query.createdAt = { ...query.createdAt, $gte: new Date(filters.startDate) };
      }
      if (filters.endDate) {
        query.createdAt = { ...query.createdAt, $lte: new Date(filters.endDate) };
      }
      if (filters.search) {
        query.$or = [
          { donorName: { $regex: filters.search, $options: 'i' } },
          { donorEmail: { $regex: filters.search, $options: 'i' } },
          { transactionId: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const donations = await Donation.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Donation.countDocuments(query);

      return {
        success: true,
        data: donations,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch donations', 500);
    }
  }

  /**
   * Get donation by ID (admin only)
   */
  async getDonationById(donationId) {
    try {
      const donation = await Donation.findById(donationId).lean();
      
      if (!donation) {
        throw new HttpError('Donation not found', 404);
      }

      return {
        success: true,
        data: donation
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to fetch donation', 500);
    }
  }

  /**
   * Get donation statistics
   */
  async getDonationStats() {
    try {
      const stats = await Donation.getStats();
      
      // Get recent donations (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentDonations = await Donation.aggregate([
        {
          $match: {
            paymentStatus: 'completed',
            createdAt: { $gte: sevenDaysAgo }
          }
        },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      // Get monthly breakdown for current year
      const currentYear = new Date().getFullYear();
      const monthlyBreakdown = await Donation.aggregate([
        {
          $match: {
            paymentStatus: 'completed',
            createdAt: {
              $gte: new Date(`${currentYear}-01-01`),
              $lte: new Date(`${currentYear}-12-31`)
            }
          }
        },
        {
          $group: {
            _id: { $month: '$createdAt' },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': 1 } }
      ]);

      // Get donation type breakdown
      const typeBreakdown = await Donation.aggregate([
        { $match: { paymentStatus: 'completed' } },
        {
          $group: {
            _id: '$donationType',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]);

      // Get top donors
      const topDonors = await Donation.aggregate([
        { $match: { paymentStatus: 'completed', isAnonymous: false } },
        {
          $group: {
            _id: '$donorEmail',
            donorName: { $first: '$donorName' },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
            lastDonation: { $max: '$createdAt' }
          }
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 10 }
      ]);

      return {
        success: true,
        data: {
          overview: stats,
          recent7Days: recentDonations[0] || { totalAmount: 0, count: 0 },
          monthlyBreakdown,
          typeBreakdown,
          topDonors
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch donation statistics', 500);
    }
  }

  /**
   * Get donor wall (public, shows non-anonymous donors)
   */
  async getDonorWall(limit = 50) {
    try {
      const donors = await Donation.aggregate([
        {
          $match: {
            paymentStatus: 'completed',
            isAnonymous: false,
            showOnDonorWall: true
          }
        },
        {
          $group: {
            _id: '$donorEmail',
            donorName: { $first: '$donorName' },
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
            lastDonation: { $max: '$createdAt' }
          }
        },
        { $sort: { totalAmount: -1 } },
        { $limit: limit }
      ]);

      return {
        success: true,
        data: donors
      };
    } catch (error) {
      throw new HttpError('Failed to fetch donor wall', 500);
    }
  }

  /**
   * Refund donation (admin only)
   */
  async refundDonation(donationId, reason = '') {
    try {
      const donation = await Donation.findById(donationId);
      
      if (!donation) {
        throw new HttpError('Donation not found', 404);
      }

      if (donation.paymentStatus !== 'completed') {
        throw new HttpError('Only completed donations can be refunded', 400);
      }

      // In a real implementation, you would call PayPal refund API here
      // For now, we'll just update the status
      donation.paymentStatus = 'refunded';
      donation.notes = `Refunded: ${reason}`;
      await donation.save();

      // Update user statistics
      const user = await User.findOne();
      if (user) {
        user.totalDonations -= donation.amount;
        user.donationCount -= 1;
        await user.save();
      }

      // Send refund notification email
      await this.sendRefundNotification(donation, reason);

      return {
        success: true,
        message: 'Donation refunded successfully'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to refund donation', 500);
    }
  }

  /**
   * Send refund notification
   */
  async sendRefundNotification(donation, reason) {
    try {
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
              <h2>Donation Refund Confirmation</h2>
            </div>
            <div class="content">
              <p>Dear ${donation.isAnonymous ? 'Supporter' : donation.donorName},</p>
              <p>Your donation of ${donation.currency} ${donation.amount.toLocaleString()} has been refunded.</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              <p>The refund has been processed back to your original payment method. Please allow 3-5 business days for the refund to appear in your account.</p>
              <p>If you have any questions, please contact our support team.</p>
              <p>Thank you for your understanding.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Presidential Campaign</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail({
        to: donation.donorEmail,
        subject: `Donation Refund Confirmation - ${donation.transactionId}`,
        html: emailHtml
      });
    } catch (error) {
      console.error('Failed to send refund notification:', error);
    }
  }

  /**
   * Export donations to CSV
   */
  async exportDonations(filters = {}) {
    try {
      let query = { paymentStatus: 'completed' };

      if (filters.startDate) {
        query.createdAt = { ...query.createdAt, $gte: new Date(filters.startDate) };
      }
      if (filters.endDate) {
        query.createdAt = { ...query.createdAt, $lte: new Date(filters.endDate) };
      }
      if (filters.campaign && filters.campaign !== 'all') {
        query.campaign = filters.campaign;
      }

      const donations = await Donation.find(query)
        .sort({ createdAt: -1 })
        .select('donorName donorEmail amount currency donationType paymentStatus transactionId createdAt campaign source')
        .lean();

      return {
        success: true,
        data: donations
      };
    } catch (error) {
      throw new HttpError('Failed to export donations', 500);
    }
  }
}

module.exports = new DonationService();