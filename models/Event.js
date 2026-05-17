const mongoose = require('mongoose');

// RSVP Sub-schema
const rsvpSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email address']
  },
  phone: {
    type: String,
    trim: true,
    default: ''
  },
  guests: {
    type: Number,
    required: true,
    default: 1,
    min: [1, 'Minimum guests is 1'],
    max: [10, 'Maximum guests is 10']
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled', 'pending'],
    default: 'confirmed'
  },
  attended: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Main Event Schema
const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
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
  description: {
    type: String,
    required: [true, 'Event description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  location: {
    type: String,
    required: [true, 'Event location is required'],
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'USA'
    },
    coordinates: {
      lat: Number,
      lng: Number
    }
  },
  date: {
    type: Date,
    required: [true, 'Event date is required']
  },
  startTime: {
    type: String,
    required: [true, 'Start time is required'],
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide a valid time format (HH:MM)']
  },
  endTime: {
    type: String,
    match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please provide a valid time format (HH:MM)']
  },
  category: {
    type: String,
    enum: ['rally', 'fundraiser', 'meetup', 'conference', 'workshop', 'other'],
    default: 'other'
  },
  status: {
    type: String,
    enum: ['upcoming', 'ongoing', 'completed', 'cancelled', 'postponed'],
    default: 'upcoming'
  },
  featuredImage: {
    url: {
      type: String,
      default: ''
    },
    publicId: {
      type: String,
      default: ''
    },
    caption: String,
    alt: String
  },
  gallery: [{
    url: String,
    publicId: String,
    caption: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  capacity: {
    type: Number,
    required: true,
    min: [1, 'Capacity must be at least 1'],
    default: 100
  },
  currentAttendees: {
    type: Number,
    default: 0
  },
  rsvps: [rsvpSchema],
  organizer: {
    name: {
      type: String,
      required: true
    },
    email: String,
    phone: String,
    website: String
  },
  speakers: [{
    name: {
      type: String,
      required: true
    },
    title: String,
    bio: String,
    photo: String,
    order: Number
  }],
  agenda: [{
    time: String,
    title: {
      type: String,
      required: true
    },
    description: String,
    speaker: String,
    order: Number
  }],
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
  isFree: {
    type: Boolean,
    default: true
  },
  ticketPrice: {
    type: Number,
    min: 0,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  seoTitle: {
    type: String,
    maxlength: [70, 'SEO title cannot exceed 70 characters']
  },
  seoDescription: {
    type: String,
    maxlength: [160, 'SEO description cannot exceed 160 characters']
  }
}, {
  timestamps: true
});

// Indexes for better query performance
eventSchema.index({ title: 'text', description: 'text', tags: 'text' });
eventSchema.index({ date: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ category: 1 });
eventSchema.index({ isFeatured: 1 });
eventSchema.index({ slug: 1 }, { unique: true });

// Pre-save middleware to generate slug from title
eventSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }
  next();
});

// Method to check if event is upcoming
eventSchema.methods.isUpcoming = function() {
  return this.date > new Date() && this.status === 'upcoming';
};

// Method to check if event is ongoing
eventSchema.methods.isOngoing = function() {
  const now = new Date();
  return this.date <= now && !this.isCompleted();
};

// Method to check if event is completed
eventSchema.methods.isCompleted = function() {
  return this.date < new Date() && this.status !== 'cancelled';
};

// Method to check if event has available spots
eventSchema.methods.hasAvailableSpots = function() {
  return this.currentAttendees < this.capacity;
};

// Method to get remaining spots
eventSchema.methods.getRemainingSpots = function() {
  return Math.max(0, this.capacity - this.currentAttendees);
};

// Method to add RSVP
eventSchema.methods.addRSVP = async function(rsvpData) {
  // Check if email already RSVP'd
  const existingRSVP = this.rsvps.find(r => r.email === rsvpData.email);
  if (existingRSVP) {
    throw new Error('This email has already RSVP\'d for this event');
  }
  
  // Check capacity
  if (this.currentAttendees + parseInt(rsvpData.guests) > this.capacity) {
    throw new Error('Event capacity has been reached');
  }
  
  this.rsvps.push(rsvpData);
  this.currentAttendees += parseInt(rsvpData.guests);
  return this.save();
};

// Method to cancel RSVP
eventSchema.methods.cancelRSVP = async function(email) {
  const rsvp = this.rsvps.find(r => r.email === email);
  if (!rsvp) {
    throw new Error('RSVP not found');
  }
  
  rsvp.status = 'cancelled';
  this.currentAttendees -= rsvp.guests;
  return this.save();
};

// Method to increment view count
eventSchema.methods.incrementViews = async function() {
  this.viewCount += 1;
  return this.save();
};

// Static method to get upcoming events
eventSchema.statics.getUpcomingEvents = function(limit = 10) {
  return this.find({
    date: { $gte: new Date() },
    status: 'upcoming'
  })
  .sort({ date: 1, priority: -1 })
  .limit(limit);
};

// Static method to get featured events
eventSchema.statics.getFeaturedEvents = function(limit = 5) {
  return this.find({
    isFeatured: true,
    date: { $gte: new Date() },
    status: 'upcoming'
  })
  .sort({ priority: -1, date: 1 })
  .limit(limit);
};

// Virtual for formatted date
eventSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
});

// Virtual for formatted time
eventSchema.virtual('formattedTime').get(function() {
  return this.startTime;
});

// Virtual for RSVP count
eventSchema.virtual('rsvpCount').get(function() {
  return this.rsvps.filter(r => r.status === 'confirmed').length;
});

// Virtual for event status text
eventSchema.virtual('statusText').get(function() {
  const statusMap = {
    upcoming: 'Upcoming',
    ongoing: 'Ongoing',
    completed: 'Completed',
    cancelled: 'Cancelled',
    postponed: 'Postponed'
  };
  return statusMap[this.status] || this.status;
});

// Ensure virtuals are included in JSON output
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

// Create the model
const Event = mongoose.model('Event', eventSchema);

module.exports = Event;