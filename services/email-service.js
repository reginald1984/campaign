const nodemailer = require("nodemailer");
const { createPool } = require("generic-pool");
const { EventEmitter } = require("events");
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

const {
  SMTP_FROM_USER,
  SMTP_PASSWORD,
  SMTP_FROM_NAME = "Presidential Campaign",
  SMTP_FROM_EMAIL,
  SMTP_HOST = "smtp.gmail.com",
  SMTP_PORT = 587,
  SMTP_SECURE = false,
  SMTP_BACKUP_HOST,
  SMTP_BACKUP_PORT,
  APP_NAME = "Presidential Campaign Platform",
  NODE_ENV = "development",
  CLIENT_URL = "https://yourcampaign.com",
} = process.env;

class EmailService extends EventEmitter {
  constructor() {
    super();
    this.transporters = [];
    this.currentTransporterIndex = 0;
    this.sendQueue = [];
    this.isProcessingQueue = false;
    this.lastSendTime = 0;
    this.MIN_SEND_INTERVAL = 1000;
    this.MAX_FAILURES = 3;
    this.BASE_DISABLE_TIME = 5 * 60 * 1000;
    
    this.colors = {
      primary: '#1a56db',
      primaryLight: '#3b82f6',
      primaryDark: '#1e3a8a',
      secondary: '#7c3aed',
      secondaryLight: '#8b5cf6',
      secondaryDark: '#5b21b6',
      success: '#10B981',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6',
      white: '#FFFFFF',
      black: '#000000',
      gray50: '#F9FAFB',
      gray100: '#F3F4F6',
      gray200: '#E5E7EB',
      gray300: '#D1D5DB',
      gray400: '#9CA3AF',
      gray500: '#6B7280',
      gray600: '#4B5563',
      gray700: '#374151',
      gray800: '#1F2937',
      gray900: '#111827',
      background: '#FFFFFF',
      surface: '#F9FAFB',
      textPrimary: '#111827',
      textSecondary: '#6B7280',
      textTertiary: '#9CA3AF',
    };
    
    this.initialize();
  }

  getSmtpConfig(host, port, secure) {
    return {
      host,
      port: parseInt(port),
      secure: secure === "true",
      auth: {
        user: SMTP_FROM_USER,
        pass: SMTP_PASSWORD,
      },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 30000,
      debug: NODE_ENV !== "production",
    };
  }

  createSmtpPool(config) {
    return createPool(
      {
        create: async () => {
          const transporter = nodemailer.createTransport(config);
          await transporter.verify();
          return transporter;
        },
        destroy: (transporter) => transporter.close(),
        validate: (transporter) => transporter.verify(),
      },
      {
        min: 1,
        max: 3,
        acquireTimeoutMillis: 30000,
        idleTimeoutMillis: 60000,
      }
    );
  }

  async initialize() {
    const primaryConfig = this.getSmtpConfig(SMTP_HOST, SMTP_PORT, SMTP_SECURE);
    this.transporters.push({
      name: "primary",
      pool: this.createSmtpPool(primaryConfig),
      config: primaryConfig,
      failureCount: 0,
      disabledUntil: 0,
    });

    if (SMTP_BACKUP_HOST) {
      const backupConfig = this.getSmtpConfig(
        SMTP_BACKUP_HOST,
        SMTP_BACKUP_PORT || SMTP_PORT,
        SMTP_SECURE
      );
      this.transporters.push({
        name: "backup",
        pool: this.createSmtpPool(backupConfig),
        config: backupConfig,
        failureCount: 0,
        disabledUntil: 0,
      });
    }
  }

  async getActiveTransporter() {
    for (let i = 0; i < this.transporters.length; i++) {
      const transporter = this.transporters[this.currentTransporterIndex];
      this.currentTransporterIndex = (this.currentTransporterIndex + 1) % this.transporters.length;

      if (transporter.disabledUntil <= Date.now()) {
        try {
          const conn = await transporter.pool.acquire();
          await transporter.pool.release(conn);
          transporter.failureCount = 0;
          return transporter;
        } catch (error) {
          this.handleTransporterFailure(transporter);
        }
      }
    }
    throw new Error("No available SMTP transporters");
  }

  handleTransporterFailure(transporter) {
    transporter.failureCount++;
    if (transporter.failureCount >= this.MAX_FAILURES) {
      transporter.disabledUntil = Date.now() + this.BASE_DISABLE_TIME;
      console.warn(`Disabled ${transporter.name} SMTP for ${this.BASE_DISABLE_TIME / 60000} minutes`);
    }
  }

  async sendEmail(mailOptions, retries = 3) {
    return new Promise((resolve, reject) => {
      this.sendQueue.push({ mailOptions, retries, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.sendQueue.length === 0) return;
    this.isProcessingQueue = true;

    const { mailOptions, retries, resolve, reject } = this.sendQueue.shift();

    try {
      const now = Date.now();
      if (now - this.lastSendTime < this.MIN_SEND_INTERVAL) {
        await new Promise((r) =>
          setTimeout(r, this.MIN_SEND_INTERVAL - (now - this.lastSendTime))
        );
      }

      let lastError;
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const transporter = await this.getActiveTransporter();
          const conn = await transporter.pool.acquire();

          const info = await conn.sendMail({
            ...mailOptions,
            from: mailOptions.from || `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
          });

          await transporter.pool.release(conn);
          this.lastSendTime = Date.now();
          
          this.emit('emailSent', {
            to: mailOptions.to,
            subject: mailOptions.subject,
            timestamp: new Date()
          });
          
          resolve(info);
          return;
        } catch (error) {
          lastError = error;
          this.emit('emailError', {
            to: mailOptions.to,
            subject: mailOptions.subject,
            error: error.message,
            attempt
          });
          
          if (attempt < retries) await new Promise((r) => setTimeout(r, 2000 * attempt));
        }
      }
      reject(lastError || new Error("Email sending failed"));
    } catch (error) {
      reject(error);
    } finally {
      this.isProcessingQueue = false;
      process.nextTick(() => this.processQueue());
    }
  }

  // =============================================
  // CONTACT REPLY TEMPLATE
  // =============================================
  
  async sendContactReply(userEmail, userName, originalMessage, replyMessage) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a56db; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .message-box { background-color: #f3f4f6; padding: 15px; margin: 15px 0; border-left: 4px solid #1a56db; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Response from the Presidential Candidate</h2>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <p>Thank you for reaching out. Here's our response to your message:</p>
            <div class="message-box">
              <strong>Your message:</strong>
              <p>${originalMessage}</p>
            </div>
            <div class="message-box">
              <strong>Our response:</strong>
              <p>${replyMessage}</p>
            </div>
            <p>Best regards,<br>The Campaign Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: userEmail,
      subject: "Response from the Presidential Candidate",
      html
    });
  }

  // =============================================
  // DONATION CONFIRMATION TEMPLATE
  // =============================================

  async sendDonationConfirmation(userEmail, userName, donationAmount, donationId) {
    const html = `
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
            <h2>Thank You for Your Support!</h2>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <p>Thank you for your generous donation to our campaign!</p>
            <div class="donation-details">
              <h3>Donation Details:</h3>
              <p><strong>Amount:</strong> $${donationAmount}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
              <p><strong>Transaction ID:</strong> ${donationId}</p>
            </div>
            <p>Your contribution helps us build a better future for everyone.</p>
            <p>Together, we can make a difference!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: userEmail,
      subject: "Thank you for your donation!",
      html
    });
  }

  // =============================================
  // PASSWORD RESET TEMPLATE
  // =============================================

  async sendPasswordReset(userEmail, resetToken) {
    const resetUrl = `${CLIENT_URL}/reset-password?token=${resetToken}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .button { display: inline-block; padding: 12px 24px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Password Reset Request</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You requested to reset your password for your account associated with ${userEmail}.</p>
            <p>Click the button below to reset your password:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: userEmail,
      subject: "Password Reset Request",
      html
    });
  }

  // =============================================
  // PASSWORD CHANGE CONFIRMATION TEMPLATE
  // =============================================

  async sendPasswordChangeConfirmation(userEmail, userName) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Password Changed Successfully</h2>
          </div>
          <div class="content">
            <p>Dear ${userName},</p>
            <p>Your password has been successfully changed on ${new Date().toLocaleDateString()}.</p>
            <p>If you did not make this change, please contact our support team immediately.</p>
            <p>For security reasons, we recommend that you:</p>
            <ul>
              <li>Use a strong, unique password</li>
              <li>Never share your password with anyone</li>
            </ul>
            <p>Best regards,<br>Security Team</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: userEmail,
      subject: "Password Changed Successfully",
      html
    });
  }

  // =============================================
  // NEWSLETTER TEMPLATE
  // =============================================

  async sendNewsletter(subscribers, postData) {
    const batchSize = 50;
    const results = [];

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      const batchPromises = batch.map(subscriber => {
        const unsubscribeUrl = `${CLIENT_URL}/unsubscribe?email=${encodeURIComponent(subscriber.email)}`;
        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #1a56db; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; }
              .post-content { margin: 20px 0; padding: 15px; background-color: #f3f4f6; }
              .button { display: inline-block; padding: 10px 20px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 5px; }
              .unsubscribe { font-size: 12px; color: #6b7280; text-align: center; margin-top: 30px; }
              .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>${postData.title}</h2>
                <p>Campaign Newsletter</p>
              </div>
              <div class="content">
                <div class="post-content">
                  <p>${postData.excerpt || postData.content.substring(0, 300)}</p>
                </div>
                <div style="text-align: center;">
                  <a href="${CLIENT_URL}/posts/${postData.slug}" class="button">Read Full Post</a>
                </div>
                <div class="unsubscribe">
                  <p>You're receiving this because you subscribed to our newsletter.</p>
                  <p><a href="${unsubscribeUrl}">Click here to unsubscribe</a></p>
                </div>
              </div>
              <div class="footer">
                <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        return this.sendEmail({
          to: subscriber.email,
          subject: `New Post: ${postData.title}`,
          html
        }).catch(error => ({ error, email: subscriber.email }));
      });

      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
      
      if (i + batchSize < subscribers.length) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    return results;
  }

  // =============================================
  // SUBSCRIPTION CONFIRMATION TEMPLATE
  // =============================================

  async sendSubscriptionConfirmation(email, postTitle, isReactivated = false) {
    const unsubscribeUrl = `${CLIENT_URL}/api/subscribe/unsubscribe?email=${encodeURIComponent(email)}`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${isReactivated ? 'Subscription Reactivated' : 'Subscription Confirmed'}!</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>${isReactivated 
              ? `You have successfully reactivated your subscription to our campaign newsletter.` 
              : `Thank you for subscribing to our campaign newsletter!`}</p>
            <p>You will receive email notifications whenever new content is posted.</p>
            <p>To unsubscribe at any time, click <a href="${unsubscribeUrl}">here</a>.</p>
            <p>Thank you for staying informed!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: email,
      subject: isReactivated ? "Subscription Reactivated" : "Subscription Confirmed",
      html
    });
  }

  // =============================================
  // NEW POST NOTIFICATION TEMPLATE
  // =============================================

  async sendNewPostNotification(email, postData, unsubscribeUrl) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #1a56db; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .post-preview { margin: 20px 0; padding: 15px; background-color: #f3f4f6; border-radius: 5px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>New Campaign Update!</h2>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>A new post has been published:</p>
            <div class="post-preview">
              <h3>${postData.title}</h3>
              <p>${postData.excerpt || postData.content.substring(0, 200)}...</p>
              <p><small>Posted on ${new Date(postData.createdAt).toLocaleDateString()}</small></p>
            </div>
            <div style="text-align: center;">
              <a href="${CLIENT_URL}/posts/${postData.slug}" class="button">Read Full Post</a>
            </div>
            <div class="footer">
              <p>You're receiving this because you subscribed to our newsletter.</p>
              <p><a href="${unsubscribeUrl}">Unsubscribe</a> from notifications.</p>
              <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: email,
      subject: `New Campaign Update: ${postData.title}`,
      html
    });
  }

  async shutdown() {
    for (const transporter of this.transporters) {
      await transporter.pool.drain();
      await transporter.pool.clear();
    }
  }
}

// Singleton instance
const emailService = new EmailService();

// Graceful shutdown
process.on("SIGTERM", () => emailService.shutdown());
process.on("SIGINT", () => emailService.shutdown());

// Event listeners for monitoring
emailService.on('emailSent', (data) => {
  console.log(`📧 Email sent to ${data.to}: ${data.subject}`);
});

emailService.on('emailError', (data) => {
  console.error(`❌ Email failed to ${data.to}: ${data.error}`);
});

module.exports = { emailService };