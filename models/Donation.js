const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  // Donor Information
  donorName: {
    type: String,
    required: [true, 'Donor name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  donorEmail: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  donorPhone: {
    type: String,
    trim: true,
    default: ''
  },
  
  // Donation Details
  amount: {
    type: Number,
    required: [true, 'Donation amount is required'],
    min: [1, 'Minimum donation is $1'],
    max: [100000, 'Maximum donation is $100,000']
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  donationType: {
    type: String,
    enum: ['one_time', 'monthly', 'yearly'],
    default: 'one_time'
  },
  
  // Optional donor details
  donorAddress: {
    street: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    zipCode: { type: String, default: '' },
    country: { type: String, default: 'US' }
  },
  
  // Occupation information (for compliance)
  occupation: {
    type: String,
    default: ''
  },
  employer: {
    type: String,
    default: ''
  },
  
  // Anonymity preference
  isAnonymous: {
    type: Boolean,
    default: false
  },
  showOnDonorWall: {
    type: Boolean,
    default: true
  },
  
  // Dedication
  dedication: {
    inHonorOf: { type: String, default: '' },
    message: { type: String, default: '' },
    notifyRecipient: { type: Boolean, default: false },
    recipientEmail: { type: String, default: '' }
  },
  
  // Payment Information
  paymentMethod: {
    type: String,
    default:'paypal',
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'disputed'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    unique: true,
    sparse: true
  },

  
  // Receipt
  receiptSent: {
    type: Boolean,
    default: false
  },
  receiptSentAt: {
    type: Date,
    default: null
  },
  receiptUrl: {
    type: String,
    default: null
  },
  
  // Tax information
  taxDeductible: {
    type: Boolean,
    default: true
  },
  taxId: {
    type: String,
    default: null
  },
  
  // Notes
  notes: {
    type: String,
    default: ''
  },
  internalNotes: {
    type: String,
    select: false,
    default: ''
  },
  
  // Campaign attribution
  campaign: {
    type: String,
    default: 'general'
  },
  source: {
    type: String,
    enum: ['website', 'social_media', 'email', 'event', 'direct', 'other'],
    default: 'website'
  },
  utmSource: { type: String, default: '' },
  utmMedium: { type: String, default: '' },
  utmCampaign: { type: String, default: '' },
  
  // Recurring donation fields
  recurringId: {
    type: String,
    default: null
  },
  nextBillingDate: {
    type: Date,
    default: null
  },
  billingCycleEnd: {
    type: Date,
    default: null
  },
  
  // Thank you
  thankYouSent: {
    type: Boolean,
    default: false
  },
  thankYouSentAt: {
    type: Date,
    default: null
  },
  
  // Admin who processed (if manual)
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Create indexes for efficient queries
donationSchema.index({ donorEmail: 1 });
donationSchema.index({ paymentStatus: 1 });
donationSchema.index({ createdAt: -1 });
donationSchema.index({ amount: 1 });
donationSchema.index({ donationType: 1 });
donationSchema.index({ transactionId: 1 });
donationSchema.index({ campaign: 1 });
donationSchema.index({ isAnonymous: 1, showOnDonorWall: 1 });

// Static method to get donation statistics
donationSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $match: { paymentStatus: 'completed' }
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalDonations: { $sum: 1 },
        averageAmount: { $avg: '$amount' },
        maxAmount: { $max: '$amount' },
        minAmount: { $min: '$amount' }
      }
    }
  ]);
  
  return stats[0] || {
    totalAmount: 0,
    totalDonations: 0,
    averageAmount: 0,
    maxAmount: 0,
    minAmount: 0
  };
};

// Method to mark donation as completed
donationSchema.methods.markCompleted = async function(transactionData) {
  this.paymentStatus = 'completed';
  this.transactionId = transactionData.transactionId;
  this.processorData = transactionData;
  await this.save();
  
  // Update user statistics
  const User = mongoose.model('User');
  const user = await User.findOne();
  if (user) {
    user.totalDonations += this.amount;
    user.donationCount += 1;
    await user.save();
  }
};

// Method to send receipt
donationSchema.methods.sendReceipt = async function() {
  this.receiptSent = true;
  this.receiptSentAt = new Date();
  await this.save();
};

module.exports = mongoose.model('Donation', donationSchema);