const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Sender Information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    trim: true,
    default: '',
    match: [/^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/, 'Please provide a valid phone number']
  },
  
  // Message Content
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    trim: true,
    maxlength: [200, 'Subject cannot exceed 200 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [5000, 'Message cannot exceed 5000 characters']
  },
  
  // Message Category
  category: {
    type: String,
    enum: ['general', 'volunteer', 'media', 'partnership', 'feedback', 'support', 'other'],
    default: 'general'
  },
  
  // Status & Tracking
  status: {
    type: String,
    enum: ['unread', 'read', 'replied', 'archived', 'spam'],
    default: 'unread'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Admin Response
  adminResponse: {
    message: { type: String, default: null },
    respondedAt: { type: Date, default: null },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  
  // Metadata
  ipAddress: {
    type: String,
    select: false,
    default: null
  },
  userAgent: {
    type: String,
    select: false,
    default: null
  },
  referrer: {
    type: String,
    default: null
  },
  
  // Newsletter Subscription
  subscribeToNewsletter: {
    type: Boolean,
    default: false
  },
  
  // Attachments (for future use with Cloudinary)
  attachments: [{
    filename: String,
    url: String,
    publicId: String,
    size: Number,
    mimeType: String
  }],
  
  // Notes (internal use)
  internalNotes: {
    type: String,
    select: false,
    default: ''
  },
  
  // Read receipt
  readAt: {
    type: Date,
    default: null
  },
  
  // Spam detection
  isSpam: {
    type: Boolean,
    default: false
  },
  spamScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, {
  timestamps: true
});

// Create indexes for efficient queries
messageSchema.index({ email: 1 });
messageSchema.index({ status: 1, createdAt: -1 });
messageSchema.index({ category: 1 });
messageSchema.index({ priority: 1 });
messageSchema.index({ createdAt: -1 });
messageSchema.index({ status: 1, priority: 1 });
messageSchema.index({ subject: 'text', message: 'text' });

// Virtual for formatted createdAt
messageSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});

// Method to mark as read
messageSchema.methods.markAsRead = async function() {
  if (this.status === 'unread') {
    this.status = 'read';
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

// Method to mark as replied
messageSchema.methods.markAsReplied = async function(responseMessage, adminId) {
  this.status = 'replied';
  this.adminResponse = {
    message: responseMessage,
    respondedAt: new Date(),
    respondedBy: adminId
  };
  await this.save();
  return this;
};

// Method to change priority
messageSchema.methods.setPriority = async function(priorityLevel) {
  if (['low', 'medium', 'high', 'urgent'].includes(priorityLevel)) {
    this.priority = priorityLevel;
    await this.save();
  }
  return this;
};

// Method to archive
messageSchema.methods.archive = async function() {
  this.status = 'archived';
  await this.save();
  return this;
};

// Static method to get message statistics
messageSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);
  
  const total = await this.countDocuments();
  const unread = await this.countDocuments({ status: 'unread' });
  const urgent = await this.countDocuments({ priority: 'urgent', status: { $ne: 'archived' } });
  
  return {
    total,
    unread,
    urgent,
    byStatus: stats
  };
};

// Static method to get recent messages
messageSchema.statics.getRecent = async function(limit = 10) {
  return await this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('name email subject category status priority createdAt');
};

// Pre-save middleware to check for spam (basic implementation)
messageSchema.pre('save', function(next) {
  // Basic spam keywords check
  const spamKeywords = ['casino', 'viagra', 'lottery', 'winner', 'prize', 'bitcoin', 'crypto'];
  const content = (this.message + ' ' + this.subject).toLowerCase();
  
  let spamScore = 0;
  spamKeywords.forEach(keyword => {
    if (content.includes(keyword)) {
      spamScore += 20;
    }
  });
  
  // Check for excessive links
  const linkCount = (this.message.match(/https?:\/\/[^\s]+/g) || []).length;
  if (linkCount > 3) spamScore += 30;
  
  // Check for all caps
  const upperCaseRatio = (this.message.replace(/[^A-Z]/g, '').length / this.message.length) * 100;
  if (upperCaseRatio > 50) spamScore += 20;
  
  this.spamScore = Math.min(spamScore, 100);
  this.isSpam = this.spamScore > 50;
  
  next();
});

module.exports = mongoose.model('Message', messageSchema);