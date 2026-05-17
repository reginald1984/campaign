// backend/models/Volunteer.js
const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
  // Personal Information
  idNumber: {
    type: String,
    required: [true, 'ID/Dermatolog number is required'],
    unique: true,
    trim: true,
    maxlength: [13, 'ID number cannot exceed 13 characters'],
    validate: {
      validator: function(v) {
        return /^[A-Za-z0-9\-]+$/.test(v);
      },
      message: 'ID number can only contain letters, numbers, and hyphens'
    }
  },
  
  name: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  
  email: {
    type: String,
    required: [true, 'Email address is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  
  address: {
    type: String,
    trim: true,
    default: ''
  },
  
  city: {
    type: String,
    trim: true,
    default: ''
  },
  
  state: {
    type: String,
    trim: true,
    default: ''
  },
  
  country: {
    type: String,
    trim: true,
    default: 'United States'
  },
  
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        return /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/.test(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  
  // ID Picture Information (Cloudinary)
  idPicture: {
    url: {
      type: String,
      required: true
    },
    publicId: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      default: ''
    },
    size: {
      type: Number,
      default: 0
    },
    mimeType: {
      type: String,
      default: ''
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  },
  
  // Volunteer Status & Preferences
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'active', 'inactive'],
    default: 'pending'
  },
  
  availability: {
    type: String,
    enum: ['full_time', 'part_time', 'weekends', 'evenings', 'flexible'],
    default: 'flexible'
  },
  
  interests: [{
    type: String,
    enum: ['canvassing', 'phone_banking', 'event_planning', 'social_media', 'data_entry', 'fundraising', 'transportation', 'translation', 'other']
  }],
  
  skills: [{
    type: String,
    trim: true
  }],
  
  experience: {
    type: String,
    maxlength: [1000, 'Experience description cannot exceed 1000 characters']
  },
  
  whyJoin: {
    type: String,
    maxlength: [1000, 'Response cannot exceed 1000 characters']
  },
  
  emergencyContact: {
    name: {
      type: String,
      trim: true
    },
    relationship: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    }
  },
  
  // Background Check
  backgroundCheckConsent: {
    type: Boolean,
    default: false
  },
  
  termsAccepted: {
    type: Boolean,
    required: [true, 'You must accept the terms and conditions'],
    default: false
  },
  
  // Administrative Fields
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  
  approvedAt: {
    type: Date,
    default: null
  },
  
  rejectionReason: {
    type: String,
    default: null
  },
  
  notes: {
    type: String,
    maxlength: [2000, 'Notes cannot exceed 2000 characters']
  },
  
  // Tracking
  ipAddress: {
    type: String,
    default: null
  },
  
  userAgent: {
    type: String,
    default: null
  },
  
  referrer: {
    type: String,
    default: null
  },
  
  // Statistics
  hoursVolunteered: {
    type: Number,
    default: 0
  },
  
  eventsAttended: [{
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event'
    },
    eventName: String,
    date: Date,
    hours: Number
  }],
  
  achievements: [{
    title: String,
    description: String,
    date: Date
  }],
  
  // Newsletter Subscription
  subscribeToNewsletter: {
    type: Boolean,
    default: false
  },
  
  // Timestamps
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create indexes for better query performance
volunteerSchema.index({ idNumber: 1 });
volunteerSchema.index({ email: 1 });
volunteerSchema.index({ status: 1 });
volunteerSchema.index({ createdAt: -1 });
volunteerSchema.index({ name: 'text', email: 'text' }); // For search functionality

// Virtual field for full address
volunteerSchema.virtual('fullAddress').get(function() {
  const parts = [this.address, this.city, this.state, this.country].filter(part => part);
  return parts.join(', ');
});

// Virtual field for age (if date of birth is added in the future)
volunteerSchema.virtual('applicationStatus').get(function() {
  const statusMap = {
    pending: 'Under Review',
    approved: 'Approved - Awaiting Training',
    rejected: 'Not Selected',
    active: 'Active Volunteer',
    inactive: 'Inactive'
  };
  return statusMap[this.status] || this.status;
});

// Method to approve volunteer application
volunteerSchema.methods.approve = async function(adminId) {
  this.status = 'approved';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  await this.save();
  return this;
};

// Method to reject volunteer application
volunteerSchema.methods.reject = async function(reason, adminId) {
  this.status = 'rejected';
  this.rejectionReason = reason;
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  await this.save();
  return this;
};

// Method to activate volunteer
volunteerSchema.methods.activate = async function() {
  this.status = 'active';
  this.lastActiveAt = new Date();
  await this.save();
  return this;
};

// Method to deactivate volunteer
volunteerSchema.methods.deactivate = async function() {
  this.status = 'inactive';
  await this.save();
  return this;
};

// Method to add hours volunteered
volunteerSchema.methods.addVolunteerHours = async function(hours) {
  this.hoursVolunteered += hours;
  await this.save();
  return this;
};

// Method to add event attendance
volunteerSchema.methods.addEventAttendance = async function(eventId, eventName, hours = 0) {
  this.eventsAttended.push({
    eventId,
    eventName,
    date: new Date(),
    hours
  });
  this.hoursVolunteered += hours;
  this.lastActiveAt = new Date();
  await this.save();
  return this;
};

// Method to add achievement
volunteerSchema.methods.addAchievement = async function(title, description) {
  this.achievements.push({
    title,
    description,
    date: new Date()
  });
  await this.save();
  return this;
};

// Static method to get statistics
volunteerSchema.statics.getStats = async function() {
  const total = await this.countDocuments();
  const pending = await this.countDocuments({ status: 'pending' });
  const approved = await this.countDocuments({ status: 'approved' });
  const active = await this.countDocuments({ status: 'active' });
  const rejected = await this.countDocuments({ status: 'rejected' });
  const inactive = await this.countDocuments({ status: 'inactive' });
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayApplications = await this.countDocuments({
    createdAt: { $gte: today }
  });
  
  const thisWeek = new Date();
  thisWeek.setDate(thisWeek.getDate() - 7);
  const weeklyApplications = await this.countDocuments({
    createdAt: { $gte: thisWeek }
  });
  
  const totalHours = await this.aggregate([
    { $group: { _id: null, total: { $sum: '$hoursVolunteered' } } }
  ]);
  
  return {
    total,
    pending,
    approved,
    active,
    rejected,
    inactive,
    todayApplications,
    weeklyApplications,
    totalHours: totalHours[0]?.total || 0
  };
};

// Static method to get recent applications
volunteerSchema.statics.getRecentApplications = async function(limit = 10) {
  return this.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('name email status createdAt idNumber')
    .lean();
};

// Middleware to hash sensitive data before saving (if needed)
volunteerSchema.pre('save', function(next) {
  // Trim all string fields
  if (this.name) this.name = this.name.trim();
  if (this.email) this.email = this.email.toLowerCase().trim();
  if (this.idNumber) this.idNumber = this.idNumber.trim().toUpperCase();
  if (this.phone) this.phone = this.phone.trim();
  
  next();
});

// Method to get public profile (hide sensitive info)
volunteerSchema.methods.getPublicProfile = function() {
  const publicData = this.toObject();
  delete publicData.ipAddress;
  delete publicData.userAgent;
  delete publicData.referrer;
  delete publicData.notes;
  return publicData;
};

// Method to check if volunteer is active
volunteerSchema.methods.isActive = function() {
  return this.status === 'active';
};

// Method to update last active timestamp
volunteerSchema.methods.updateLastActive = async function() {
  this.lastActiveAt = new Date();
  await this.save();
  return this;
};

// Export the model
module.exports = mongoose.model('Volunteer', volunteerSchema);