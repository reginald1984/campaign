const SubscribeService = require('../services/subscribe-service');
const HttpError = require('../middleware/HttpError');
const asyncHandler = require('express-async-handler');

class SubscribeController {
  /**
   * @desc    Subscribe to newsletter
   * @route   POST /api/subscribe
   * @access  Public
   */
  subscribe = asyncHandler(async (req, res, next) => {
    const { email } = req.body;
    const source = req.body.source || 'website';
    const ipAddress = req.ip || req.connection.remoteAddress;
    
    const result = await SubscribeService.subscribe(email, source, ipAddress);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data,
      alreadySubscribed: result.alreadySubscribed || false,
      reactivated: result.reactivated || false
    });
  });

  /**
   * @desc    Unsubscribe from newsletter
   * @route   GET /api/subscribe/unsubscribe
   * @access  Public
   */
  unsubscribe = asyncHandler(async (req, res, next) => {
    const { email } = req.query;
    
    if (!email) {
      return next(new HttpError('Email is required', 400));
    }
    
    const result = await SubscribeService.unsubscribe(email);
    
    // For web view, return HTML confirmation
    if (req.accepts('html')) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unsubscribed - Campaign Newsletter</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .container { max-width: 500px; margin: 0 auto; }
            .success { color: #10b981; }
            .button { display: inline-block; padding: 10px 20px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">✓ Successfully Unsubscribed</h1>
            <p>You have been removed from our campaign newsletter.</p>
            <p>We're sorry to see you go. If you change your mind, you can always <a href="${process.env.CLIENT_URL}">subscribe again</a>.</p>
            <a href="${process.env.CLIENT_URL}" class="button">Return to Homepage</a>
          </div>
        </body>
        </html>
      `);
    } else {
      res.status(200).json({
        success: true,
        message: result.message
      });
    }
  });

  /**
   * @desc    Check if email is subscribed
   * @route   GET /api/subscribe/check
   * @access  Public
   */
  checkSubscription = asyncHandler(async (req, res, next) => {
    const { email } = req.query;
    
    if (!email) {
      return next(new HttpError('Email is required', 400));
    }
    
    const result = await SubscribeService.isSubscribed(email);
    
    res.status(200).json({
      success: true,
      isSubscribed: result.isSubscribed
    });
  });

  /**
   * @desc    Get all subscribers (admin only)
   * @route   GET /api/admin/subscribers
   * @access  Private/Admin
   */
  getAllSubscribers = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';
    
    const result = await SubscribeService.getAllSubscribers(page, limit, search);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    Get subscriber statistics (admin only)
   * @route   GET /api/admin/subscribers/stats
   * @access  Private/Admin
   */
  getSubscriberStats = asyncHandler(async (req, res, next) => {
    const result = await SubscribeService.getSubscriberStats();
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Delete subscriber (admin only)
   * @route   DELETE /api/admin/subscribers/:email
   * @access  Private/Admin
   */
  deleteSubscriber = asyncHandler(async (req, res, next) => {
    const { email } = req.params;
    
    const result = await SubscribeService.deleteSubscriber(email);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Export subscribers to CSV (admin only)
   * @route   GET /api/admin/subscribers/export
   * @access  Private/Admin
   */
  exportSubscribers = asyncHandler(async (req, res, next) => {
    const result = await SubscribeService.exportSubscribers();
    
    // Convert to CSV
    const csvData = result.data.map(sub => ({
      Email: sub.email,
      'Subscribed At': sub.subscribedAt,
      Source: sub.source,
      'Notification Count': sub.notificationCount,
      'Last Notified': sub.lastNotifiedAt || ''
    }));
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=subscribers-${Date.now()}.csv`);
    
    // Create CSV
    const headers = Object.keys(csvData[0] || {});
    const csv = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => JSON.stringify(row[h] || '')).join(','))
    ].join('\n');
    
    res.status(200).send(csv);
  });

  /**
   * @desc    Send test newsletter (admin only)
   * @route   POST /api/admin/subscribers/test-newsletter
   * @access  Private/Admin
   */
  sendTestNewsletter = asyncHandler(async (req, res, next) => {
    const { email } = req.body;
    
    if (!email) {
      return next(new HttpError('Email is required', 400));
    }
    
    const testPost = {
      title: 'Test Newsletter - Campaign Update',
      slug: 'test-newsletter',
      excerpt: 'This is a test email to preview how newsletters will look to your subscribers.',
      content: 'This is test content to demonstrate the newsletter format.',
      featuredImage: null
    };
    
    await SubscribeService.sendNewsletterToAllSubscribers(testPost);
    
    res.status(200).json({
      success: true,
      message: `Test newsletter sent to ${email}`
    });
  });
}

module.exports = new SubscribeController();