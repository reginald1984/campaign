const mongoose = require('mongoose');

const subscribeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  subscribedAt: {
    type: Date,
    default: Date.now
  },
  unsubscribedAt: {
    type: Date
  },
  lastNotifiedAt: {
    type: Date
  },
  notificationCount: {
    type: Number,
    default: 0
  },
  
  // Source tracking
  source: {
    type: String,
    enum: ['website', 'contact_form', 'donation', 'volunteer', 'manual'],
    default: 'website'
  },
  
  // IP Address for tracking
  ipAddress: {
    type: String,
    select: false
  }
}, {
  timestamps: true
});

// Indexes
subscribeSchema.index({ email: 1 });
subscribeSchema.index({ isActive: 1 });
subscribeSchema.index({ createdAt: -1 });

// Method to unsubscribe
subscribeSchema.methods.unsubscribe = async function() {
  this.isActive = false;
  this.unsubscribedAt = Date.now();
  await this.save();
  return this;
};

// Method to reactivate
subscribeSchema.methods.reactivate = async function() {
  this.isActive = true;
  this.unsubscribedAt = null;
  await this.save();
  return this;
};

// Static method to get all active subscribers
subscribeSchema.statics.getActiveSubscribers = async function() {
  return await this.find({ isActive: true }).select('email -_id');
};

// Static method to get subscriber count
subscribeSchema.statics.getSubscriberCount = async function() {
  return await this.countDocuments({ isActive: true });
};

// Static method to update last notified
subscribeSchema.statics.updateLastNotified = async function(emails) {
  return await this.updateMany(
    { email: { $in: emails }, isActive: true },
    { 
      lastNotifiedAt: new Date(),
      $inc: { notificationCount: 1 }
    }
  );
};

module.exports = mongoose.model('Subscribe', subscribeSchema);