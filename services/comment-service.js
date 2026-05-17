const Comment = require('../models/Comment');
const Post = require('../models/Post');
const HttpError = require('../middleware/HttpError');
const { emailService } = require('./email-service');
const crypto = require('crypto');

class CommentService {
  constructor() {
    // Professional spam detection for political campaign
    this.spamPatterns = [
      // Offensive/hate speech patterns
      /\b(hate|racist|terrorist|violent|kill|murder|threat)\b/i,
      // Excessive links (potential spam)
      /(https?:\/\/[^\s]+){3,}/,
      // All caps excessive (SHOUTING)
      /[A-Z]{20,}/,
      // Repeated characters
      /(.)\1{10,}/,
      // Common spam phrases
      /\b(buy now|click here|free money|earn money|crypto|bitcoin investment)\b/i
    ];
    
    this.allowedDomains = [
      'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
      'protonmail.com', 'icloud.com', 'mail.com'
    ];
  }

  /**
   * Generate Gravatar URL from email
   */
  generateGravatar(email, size = 80) {
    const trimmedEmail = email.trim().toLowerCase();
    const hash = crypto.createHash('md5').update(trimmedEmail).digest('hex');
    return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=mp`;
  }

  /**
   * Check if comment content contains spam or inappropriate content
   */
  isSpamOrInappropriate(content) {
    // Check against spam patterns
    for (const pattern of this.spamPatterns) {
      if (pattern.test(content)) {
        return { isSpam: true, reason: 'Content triggered spam filter' };
      }
    }
    
    // Check for excessive links (more than 3)
    const urlCount = (content.match(/https?:\/\/[^\s]+/g) || []).length;
    if (urlCount > 3) {
      return { isSpam: true, reason: 'Excessive external links' };
    }
    
    return { isSpam: false, reason: null };
  }

  /**
   * Validate email domain (block disposable/temporary emails)
   */
  isDisposableEmail(email) {
    const disposableDomains = [
      'tempmail.com', 'throwaway.com', '10minutemail.com',
      'guerrillamail.com', 'mailinator.com', 'yopmail.com'
    ];
    const domain = email.split('@')[1];
    return disposableDomains.includes(domain);
  }

  /**
   * Send email notifications asynchronously
   */
  async sendEmailNotifications(comment, postExists, isSpam) {
    // Send admin notification
    const emailSubject = isSpam 
      ? '⚠️ Comment Requires Moderation'
      : '💬 New Comment on Your Campaign Post';

    await emailService.sendEmail({
      to: process.env.SMTP_FROM_EMAIL,
      subject: emailSubject,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #1a56db; color: white; padding: 20px; text-align: center; }
            .comment-box { background-color: #f3f4f6; padding: 15px; margin: 20px 0; border-left: 4px solid #1a56db; }
            ${isSpam ? '.warning { background-color: #fef3c7; padding: 10px; border-left: 4px solid #f59e0b; }' : ''}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Campaign Comment</h2>
            </div>
            ${isSpam ? '<div class="warning"><strong>⚠️ Spam Detection:</strong> This comment requires review before publishing.</div>' : ''}
            <div class="comment-box">
              <p><strong>From:</strong> ${comment.commenterName}</p>
              <p><strong>Email:</strong> ${comment.commenterEmail}</p>
              <p><strong>Post:</strong> ${postExists.title}</p>
              <p><strong>Comment:</strong></p>
              <p>${comment.content.replace(/\n/g, '<br>')}</p>
              ${comment.commenterWebsite ? `<p><strong>Website:</strong> ${comment.commenterWebsite}</p>` : ''}
              ${comment.ipAddress ? `<p><strong>IP Address:</strong> ${comment.ipAddress}</p>` : ''}
            </div>
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/comments/${comment._id}" 
                 style="display: inline-block; padding: 10px 20px; background-color: #1a56db; color: white; text-decoration: none; border-radius: 5px;">
                Moderate Comment
              </a>
            </div>
          </div>
        </body>
        </html>
      `
    });

    // Send auto-response to commenter (only if not spam)
    if (!isSpam) {
      await emailService.sendEmail({
        to: comment.commenterEmail,
        subject: 'Thank you for your comment! 🇺🇸',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background-color: #1a56db; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Thank You for Engaging!</h2>
              </div>
              <div class="content">
                <p>Dear ${comment.commenterName},</p>
                <p>Thank you for sharing your thoughts on our campaign platform. Your voice matters, and we appreciate you being part of this important conversation.</p>
                <p>Our team reviews all comments to ensure a respectful and constructive dialogue. Your comment will be visible shortly.</p>
                <p>Together, we can build a better future for everyone.</p>
                <p>Best regards,<br>The Campaign Team</p>
              </div>
            </div>
          </body>
          </html>
        `
      });
    }
  }

  /**
   * Create a new comment
   */
  async createComment(commentData, ipAddress = null, userAgent = null) {
    try {
      const { post, parentComment, commenterName, commenterEmail, commenterWebsite, content } = commentData;

      // Validate input
      if (!post || !commenterName || !commenterEmail || !content) {
        throw new HttpError('Please provide your name, email, and comment', 400);
      }

      // Validate name length and characters
      if (commenterName.length < 2 || commenterName.length > 100) {
        throw new HttpError('Name must be between 2 and 100 characters', 400);
      }

      // Validate email format
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(commenterEmail)) {
        throw new HttpError('Please provide a valid email address', 400);
      }

      // Check for disposable email
      if (this.isDisposableEmail(commenterEmail)) {
        throw new HttpError('Please use a valid email address (temporary emails are not allowed)', 400);
      }

      // Validate comment content
      if (content.length < 5) {
        throw new HttpError('Comment must be at least 5 characters', 400);
      }

      if (content.length > 5000) {
        throw new HttpError('Comment cannot exceed 5000 characters', 400);
      }

      // Check if post exists
      const postExists = await Post.findById(post);
      if (!postExists) {
        throw new HttpError('Post not found', 404);
      }

      // Generate avatar from Gravatar
      const avatar = this.generateGravatar(commenterEmail);

      // Check for spam/inappropriate content
      const { isSpam, reason } = this.isSpamOrInappropriate(content);

      // Create comment
      const comment = new Comment({
        post,
        parentComment: parentComment || null,
        commenterName: commenterName.trim(),
        commenterEmail: commenterEmail.trim().toLowerCase(),
        commenterWebsite: commenterWebsite || '',
        commenterAvatar: avatar,
        content: content.trim(),
        isApproved: !isSpam, // Auto-approve if not spam
        isSpam: isSpam,
        moderationReason: reason,
        ipAddress,
        userAgent
      });

      await comment.save();

      // If this is a reply, increment reply count on parent comment
      if (parentComment) {
        const parent = await Comment.findById(parentComment);
        if (parent) {
          parent.replyCount += 1;
          await parent.save();
        }
      }

      // Send email notifications asynchronously using setImmediate
      setImmediate(async () => {
        try {
          await this.sendEmailNotifications(comment, postExists, isSpam);
          console.log(`Email notifications sent for comment ${comment._id}`);
        } catch (emailError) {
          console.error(`Failed to send email notifications for comment ${comment._id}:`, emailError);
        }
      });

      // Return comment without sensitive info
      const commentResponse = comment.toObject();
      delete commentResponse.ipAddress;
      delete commentResponse.userAgent;

      return {
        success: true,
        message: isSpam ? 'Your comment has been submitted and will be reviewed by our team.' : 'Comment posted successfully!',
        data: commentResponse,
        requiresModeration: isSpam
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to create comment', 500);
    }
  }

  /**
   * Get approved comments for a post
   */
  async getPostComments(postId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;

      const comments = await Comment.find({
        post: postId,
        isApproved: true,
        isDeleted: false,
        parentComment: null // Top-level comments only
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

      // Get reply counts for each comment
      const commentsWithReplies = await Promise.all(
        comments.map(async (comment) => {
          const replies = await Comment.find({
            parentComment: comment._id,
            isApproved: true,
            isDeleted: false
          })
          .sort({ createdAt: 1 })
          .limit(5)
          .lean();

          const totalReplies = await Comment.countDocuments({
            parentComment: comment._id,
            isApproved: true,
            isDeleted: false
          });

          return {
            ...comment,
            replies,
            totalReplies,
            hasMoreReplies: totalReplies > replies.length
          };
        })
      );

      const totalComments = await Comment.countDocuments({
        post: postId,
        isApproved: true,
        isDeleted: false,
        parentComment: null
      });

      return {
        success: true,
        data: commentsWithReplies,
        pagination: {
          page,
          limit,
          total: totalComments,
          pages: Math.ceil(totalComments / limit)
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch comments', 500);
    }
  }

  /**
   * Get replies for a specific comment
   */
  async getCommentReplies(commentId, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const replies = await Comment.find({
        parentComment: commentId,
        isApproved: true,
        isDeleted: false
      })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

      const totalReplies = await Comment.countDocuments({
        parentComment: commentId,
        isApproved: true,
        isDeleted: false
      });

      return {
        success: true,
        data: replies,
        pagination: {
          page,
          limit,
          total: totalReplies,
          pages: Math.ceil(totalReplies / limit)
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch replies', 500);
    }
  }

  /**
   * Admin: Get all comments (for moderation)
   */
  async getAllCommentsForModeration(status = 'pending', page = 1, limit = 50) {
    try {
      const skip = (page - 1) * limit;
      let filter = { isDeleted: false };

      switch (status) {
        case 'pending':
          filter.isApproved = false;
          filter.isSpam = false;
          break;
        case 'approved':
          filter.isApproved = true;
          break;
        case 'spam':
          filter.isSpam = true;
          break;
        default:
          break;
      }

      const comments = await Comment.find(filter)
        .populate('post', 'title slug')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Comment.countDocuments(filter);

      return {
        success: true,
        data: comments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch comments for moderation', 500);
    }
  }

  /**
   * Admin: Approve a comment
   */
  async approveComment(commentId, adminId) {
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new HttpError('Comment not found', 404);
      }

      if (comment.isApproved) {
        throw new HttpError('Comment is already approved', 400);
      }

      await comment.approve();

      // Send notification to commenter asynchronously
      setImmediate(async () => {
        try {
          await emailService.sendEmail({
            to: comment.commenterEmail,
            subject: 'Your comment has been approved!',
            html: `
              <h3>Your comment has been approved</h3>
              <p>Dear ${comment.commenterName},</p>
              <p>Your comment has been approved and is now visible on our campaign website.</p>
              <p>Thank you for being part of the conversation!</p>
            `
          });
        } catch (emailError) {
          console.error('Failed to send approval email:', emailError);
        }
      });

      return {
        success: true,
        message: 'Comment approved successfully',
        data: comment
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to approve comment', 500);
    }
  }

  /**
   * Admin: Reject/Delete a comment
   */
  async rejectComment(commentId, reason = null) {
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new HttpError('Comment not found', 404);
      }

      await comment.softDelete();
      
      if (reason) {
        comment.moderationReason = reason;
        await comment.save();
      }

      // Send notification to commenter asynchronously
      setImmediate(async () => {
        try {
          await emailService.sendEmail({
            to: comment.commenterEmail,
            subject: 'Regarding your comment on our campaign',
            html: `
              <h3>Comment Moderation Notice</h3>
              <p>Dear ${comment.commenterName},</p>
              <p>Your comment has been reviewed and was not approved for publication.</p>
              ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
              <p>We encourage respectful and constructive dialogue on our platform.</p>
              <p>Thank you for your understanding.</p>
            `
          });
        } catch (emailError) {
          console.error('Failed to send rejection email:', emailError);
        }
      });

      return {
        success: true,
        message: 'Comment rejected and removed'
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError('Failed to reject comment', 500);
    }
  }

  /**
   * Admin: Mark as spam
   */
  async markAsSpam(commentId) {
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new HttpError('Comment not found', 404);
      }

      comment.isSpam = true;
      comment.isApproved = false;
      comment.moderationReason = 'Marked as spam';
      await comment.save();

      return {
        success: true,
        message: 'Comment marked as spam'
      };
    } catch (error) {
      throw new HttpError('Failed to mark comment as spam', 500);
    }
  }

  /**
   * Admin: Add admin response to comment
   */
  async addAdminResponse(commentId, responseContent, adminId, adminName) {
    try {
      const comment = await Comment.findById(commentId);
      if (!comment) {
        throw new HttpError('Comment not found', 404);
      }

      comment.adminResponse = {
        content: responseContent,
        respondedAt: new Date(),
        respondedBy: adminId
      };
      await comment.save();

      // Send email notification asynchronously
      setImmediate(async () => {
        try {
          await emailService.sendEmail({
            to: comment.commenterEmail,
            subject: 'Response from the Presidential Candidate',
            html: `
              <h3>Response to Your Comment</h3>
              <p>Dear ${comment.commenterName},</p>
              <p><strong>Your comment:</strong></p>
              <p>${comment.content}</p>
              <p><strong>Response from ${adminName}:</strong></p>
              <p>${responseContent}</p>
              <p>Thank you for your engagement in this important conversation!</p>
            `
          });
        } catch (emailError) {
          console.error('Failed to send admin response email:', emailError);
        }
      });

      return {
        success: true,
        message: 'Response added successfully',
        data: comment.adminResponse
      };
    } catch (error) {
      throw new HttpError('Failed to add admin response', 500);
    }
  }

  /**
   * Get comment statistics for admin dashboard
   */
  async getCommentStats() {
    try {
      const total = await Comment.countDocuments({ isDeleted: false });
      const pending = await Comment.countDocuments({ 
        isApproved: false, 
        isSpam: false,
        isDeleted: false 
      });
      const approved = await Comment.countDocuments({ 
        isApproved: true, 
        isDeleted: false 
      });
      const spam = await Comment.countDocuments({ 
        isSpam: true, 
        isDeleted: false 
      });

      return {
        success: true,
        data: {
          total,
          pending,
          approved,
          spam
        }
      };
    } catch (error) {
      throw new HttpError('Failed to fetch comment statistics', 500);
    }
  }
}

module.exports = new CommentService();