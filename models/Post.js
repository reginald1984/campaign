const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Post title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Post content is required']
  },
  excerpt: {
    type: String,
    maxlength: [300, 'Excerpt cannot exceed 300 characters']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Media with Cloudinary
  featuredImage: {
    url: { type: String, default: null },
    publicId: { type: String, default: null },
    caption: { type: String, default: '' },
    alt: { type: String, default: '' },
    cloudinaryUrl: { type: String, default: null },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    format: { type: String, default: null }
  },
  gallery: [{
    url: String,
    publicId: String,
    caption: String,
    cloudinaryUrl: String,
    width: Number,
    height: Number,
    format: String
  }],
  attachments: [{
    name: String,
    url: String,
    type: String,
    size: Number
  }],
  
  // Categories & Tags
  category: {
    type: String,
    enum: ['campaign_update', 'policy_proposal', 'speech', 'event', 'press_release', 'interview', 'endorsement', 'other'],
    default: 'campaign_update'
  },
  tags: [{
    type: String,
    trim: true
  }],
  
  // Status & Scheduling
  status: {
    type: String,
    enum: ['draft', 'pending_review', 'published', 'scheduled', 'archived'],
    default: 'draft'
  },
  scheduledFor: {
    type: Date,
    default: null
  },
  publishedAt: {
    type: Date,
    default: null
  },
  
  // Statistics
  viewCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
  },
  shareCount: {
    type: Number,
    default: 0
  },
  
  // Featured & Priority
  isFeatured: {
    type: Boolean,
    default: false
  },
  priority: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  
  // SEO
  seoTitle: {
    type: String,
    maxlength: [70, 'SEO title should be under 70 characters']
  },
  seoDescription: {
    type: String,
    maxlength: [160, 'SEO description should be under 160 characters']
  },
  
  // Call to Action
  callToAction: {
    text: { type: String, default: '' },
    url: { type: String, default: '' },
    type: { type: String, enum: ['donate', 'volunteer', 'learn_more', 'share'], default: 'learn_more' }
  }
}, {
  timestamps: true
});

// Create indexes for search
postSchema.index({ title: 'text', content: 'text', tags: 'text' });
postSchema.index({ slug: 1 });
postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ category: 1 });
postSchema.index({ tags: 1 });

// Generate slug before saving
postSchema.pre('save', function(next) {
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }
  next();
});

// Virtual for comments
postSchema.virtual('comments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'post',
  justOne: false
});

// Methods
postSchema.methods.incrementViews = async function() {
  this.viewCount += 1;
  await this.save();
};

postSchema.methods.incrementLikes = async function() {
  this.likeCount += 1;
  await this.save();
};

postSchema.methods.incrementShares = async function() {
  this.shareCount += 1;
  await this.save();
};

module.exports = mongoose.model('Post', postSchema);