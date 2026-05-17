const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: [true, 'Comment must belong to a post'],
    index: true
  },
  
  // Parent comment for nested/replies
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  
  // Commenter Information (No login required)
  commenterName: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  commenterEmail: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  commenterWebsite: {
    type: String,
    trim: true,
    default: ''
  },
  commenterAvatar: {
    type: String, // Gravatar URL
    default: null
  },
  
  // Comment Content
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    maxlength: [5000, 'Comment cannot exceed 5000 characters'],
    trim: true
  },
  
  // Moderation
  isApproved: {
    type: Boolean,
    default: false,
    index: true
  },
  isSpam: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  moderationReason: {
    type: String,
    default: null
  },
  
  // Statistics
  likeCount: {
    type: Number,
    default: 0
  },
  replyCount: {
    type: Number,
    default: 0
  },
  
  // IP Tracking for spam prevention
  ipAddress: {
    type: String,
    select: false
  },
  userAgent: {
    type: String,
    select: false
  },
  
  // Admin response
  adminResponse: {
    content: { type: String, default: null },
    respondedAt: { type: Date, default: null },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
commentSchema.index({ post: 1, createdAt: -1 });
commentSchema.index({ post: 1, isApproved: 1, createdAt: -1 });
commentSchema.index({ commenterEmail: 1 });
commentSchema.index({ parentComment: 1 });

// Virtual for replies
commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment',
  justOne: false
});

// Method to approve comment
commentSchema.methods.approve = async function() {
  this.isApproved = true;
  await this.save();
  
  // Increment comment count on post
  await mongoose.model('Post').findByIdAndUpdate(
    this.post,
    { $inc: { commentCount: 1 } }
  );
};

// Method to delete comment
commentSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  await this.save();
  
  // Decrement comment count on post if it was approved
  if (this.isApproved) {
    await mongoose.model('Post').findByIdAndUpdate(
      this.post,
      { $inc: { commentCount: -1 } }
    );
  }
};

module.exports = mongoose.model('Comment', commentSchema);