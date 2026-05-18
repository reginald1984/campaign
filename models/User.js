const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true, 
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  
  // Profile Information with Cloudinary
  profilePicture: {
    url: {
      type: String,
      default: null
    },
    publicId: {
      type: String,
      default: null
    },
    alt: {
      type: String,
      default: 'Profile picture'
    },
    cloudinaryUrl: {
      type: String,
      default: null
    }
  },
  coverImage: {
    url: {
      type: String,
      default: null
    },
    publicId: {
      type: String,
      default: null
    },
    cloudinaryUrl: {
      type: String,
      default: null
    }
  },
  
  bio: {
    type: String,
    maxlength: [1000, 'Bio cannot exceed 1000 characters'],
    default: ''
  },
  shortBio: {
    type: String,
    maxlength: [200, 'Short bio cannot exceed 200 characters'],
    default: ''
  },
  
  // Political Information
  politicalParty: {
    type: String,
    trim: true,
    default: ''
  },
  campaignSlogan: {
    type: String,
    maxlength: [150, 'Slogan cannot exceed 150 characters'],
    default: ''
  },
  position: {
    type: String,
    default: 'Presidential Candidate'
  },
  
  // Contact Information
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  website: {
    type: String,
    trim: true,
    default: ''
  },
  socialMedia: {
    twitter: { type: String, default: '' },
    facebook: { type: String, default: '' },
    instagram: { type: String, default: '' },
    youtube: { type: String, default: '' },
    linkedin: { type: String, default: '' },
    tiktok: { type: String, default: '' }
  },
  
  // Professional Background
  education: [{
    degree: String,
    institution: String,
    year: String,
    description: String
  }],
  experience: [{
    title: String,
    organization: String,
    period: String,
    description: String
  }],
  achievements: [{
    title: String,
    description: String,
    year: String
  }],
  
  // Campaign Information
  campaignStartDate: {
    type: Date,
    default: Date.now
  },
  campaignWebsite: {
    type: String,
    default: ''
  },
  campaignManager: {
    name: String,
    email: String,
    phone: String
  },
  campaignOffice: {
    address: String,
    city: String,
    state: String,
    zipCode: String,
    phone: String
  },
  
  // Statistics
  followerCount: {
    type: Number,
    default: 0
  },
  postCount: {
    type: Number,
    default: 0
  },
  totalDonations: {
    type: Number,
    default: 0
  },
  donationCount: {
    type: Number,
    default: 0 
  },
  
  // System Fields
  role: {
    type: String,
    default: 'admin',
    enum: ['admin']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  },
  
  // Preferences
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    commentModeration: { type: Boolean, default: true },
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' }
  }
}, {
  timestamps: true
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = async function() {
  this.loginAttempts += 1;
  if (this.loginAttempts >= 5) {
    this.lockUntil = Date.now() + 30 * 60 * 1000;
  }
  await this.save();
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function() {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  await this.save();
};

module.exports = mongoose.model('User', userSchema);