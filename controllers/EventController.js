const EventService = require('../services/event-service');
const HttpError = require('../middleware/HttpError');
const asyncHandler = require('express-async-handler');
const {cloudinary}=require('../config/cloudinary')
const Event =require('../models/Event')
const fs=require('fs')
class EventController {
  /**
   * @desc    Create a new event
   * @route   POST /api/events/admin/events
   * @access  Private/Admin
   */
  createEvent = asyncHandler(async (req, res, next) => {
    const eventData = req.body;
    const authorId = req.user._id;
    
    // Parse numeric fields
    if (eventData.capacity) eventData.capacity = parseInt(eventData.capacity);
    if (eventData.priority) eventData.priority = parseInt(eventData.priority);
    if (eventData.ticketPrice) eventData.ticketPrice = parseFloat(eventData.ticketPrice);
    
    const result = await EventService.createEvent(eventData, authorId);
    
    res.status(201).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Update an event
   * @route   PUT /api/events/admin/events/:eventId
   * @access  Private/Admin
   */
  updateEvent = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;
    const updateData = req.body;
    const userId = req.user._id;
    
    // Parse numeric fields
    if (updateData.capacity) updateData.capacity = parseInt(updateData.capacity);
    if (updateData.priority) updateData.priority = parseInt(updateData.priority);
    if (updateData.ticketPrice) updateData.ticketPrice = parseFloat(updateData.ticketPrice);
    
    const result = await EventService.updateEvent(eventId, updateData, userId);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Get event by slug (public)
   * @route   GET /api/events/slug/:slug
   * @access  Public
   */
  getEventBySlug = asyncHandler(async (req, res, next) => {
    const { slug } = req.params;
    
    const result = await EventService.getEventBySlug(slug);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Get event by ID (admin)
   * @route   GET /api/events/admin/events/:eventId
   * @access  Private/Admin
   */
  getEventById = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;
    
    const result = await EventService.getEventById(eventId);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Get all upcoming events
   * @route   GET /api/events
   * @access  Public
   */
  getUpcomingEvents = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category;
    
    const result = await EventService.getUpcomingEvents(page, limit, category);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    Get all events for admin
   * @route   GET /api/events/admin/events
   * @access  Private/Admin
   */
  getAllEventsForAdmin = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    
    const result = await EventService.getAllEventsForAdmin(page, limit, status);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    Get featured events
   * @route   GET /api/events/featured
   * @access  Public
   */
  getFeaturedEvents = asyncHandler(async (req, res, next) => {
    const limit = parseInt(req.query.limit) || 5;
    
    const result = await EventService.getFeaturedEvents(limit);
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Search events
   * @route   GET /api/events/search
   * @access  Public
   */
  searchEvents = asyncHandler(async (req, res, next) => {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    if (!q) {
      return next(new HttpError('Search query is required', 400));
    }
    
    const result = await EventService.searchEvents(q, page, limit);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      query: result.query
    });
  });

  /**
   * @desc    Get events by category
   * @route   GET /api/events/category/:category
   * @access  Public
   */
  getEventsByCategory = asyncHandler(async (req, res, next) => {
    const { category } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    
    const result = await EventService.getEventsByCategory(category, page, limit);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    RSVP to an event
   * @route   POST /api/events/:eventId/rsvp
   * @access  Public
   */
  rsvpToEvent = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;
    const rsvpData = {
      fullName: req.body.fullName,
      email: req.body.email,
      phone: req.body.phone,
      guests: parseInt(req.body.guests) || 1
    };
    
    const result = await EventService.rsvpToEvent(eventId, rsvpData);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Cancel RSVP
   * @route   DELETE /api/events/:eventId/rsvp
   * @access  Public
   */
  cancelRSVP = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;
    const { email } = req.body;
    
    if (!email) {
      return next(new HttpError('Email is required', 400));
    }
    
    const result = await EventService.cancelRSVP(eventId, email);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Get event RSVPs (admin)
   * @route   GET /api/events/admin/events/:eventId/rsvps
   * @access  Private/Admin
   */
  getEventRSVPs = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    
    const result = await EventService.getEventRSVPs(eventId, page, limit);
    
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      stats: result.stats
    });
  });

  /**
   * @desc    Delete an event
   * @route   DELETE /api/events/admin/events/:eventId
   * @access  Private/Admin
   */
  deleteEvent = asyncHandler(async (req, res, next) => {
    const { eventId } = req.params;
    
    const result = await EventService.deleteEvent(eventId);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });


uploadFeaturedImage = asyncHandler(async (req, res, next) => {
  console.log('=== Controller: uploadEventFeaturedImage ===');
  console.log('Request params:', req.params);
  console.log('Request file:', req.file);
  
  if (!req.file) {
    console.error('No file in request');
    return next(new HttpError('Please upload an image', 400));
  }
  
  // Check what the parameter name is in your route
  // It could be 'id' or 'eventId'
  const eventId = req.params.eventId || req.params.id;
  console.log('Event ID extracted:', eventId);
  console.log('Event ID type:', typeof eventId);
  
  const { alt, caption } = req.body;
  
  // Make sure eventId is a string
  if (!eventId || typeof eventId !== 'string') {
    console.error('Invalid event ID:', eventId);
    return next(new HttpError('Invalid event ID', 400));
  }
  
  // When using multer-storage-cloudinary, the file is already uploaded 
  if (req.file.secure_url || req.file.url || req.file.path) {
    console.log('File already uploaded to Cloudinary');
    
    const imageUrl = req.file.secure_url || req.file.url || req.file.path;
    const publicId = req.file.public_id || req.file.filename;
    
    console.log('Looking for event with ID:', eventId);
    
    // Find the event
    const event = await Event.findById(eventId);
    if (!event) {
      console.error('Event not found with ID:', eventId);
      return next(new HttpError('Event not found', 404));
    }
    
    // Delete old featured image if exists
    if (event.featuredImage && event.featuredImage.publicId) {
      console.log('Deleting old featured image');
      try {
        await cloudinary.uploader.destroy(event.featuredImage.publicId);
      } catch (deleteError) {
        console.warn('Failed to delete old image:', deleteError.message);
      }
    }
    
    // Update event
    event.featuredImage = {
      url: imageUrl,
      publicId: publicId,
      alt: alt || event.title,
      caption: caption || event.description || '',
      cloudinaryUrl: imageUrl,
      width: req.file.width || 1200,
      height: req.file.height || 630,
      format: req.file.format || 'jpg'
    };
    
    await event.save();
    console.log('Event updated successfully');
    
    return res.status(200).json({
      success: true,
      message: 'Featured image uploaded successfully',
      data: event.featuredImage
    });
  }
  
  return next(new HttpError('Invalid file data', 400));
});


  /**
   * @desc    Upload gallery images
   * @route   POST /api/events/admin/events/:eventId/gallery
   * @access  Private/Admin
   */
  uploadGalleryImages = asyncHandler(async (req, res, next) => {
    if (!req.files || req.files.length === 0) {
      return next(new HttpError('Please upload at least one image', 400));
    }
    
    const { eventId } = req.params;
    
    const result = await EventService.uploadGalleryImages(eventId, req.files);
    
    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Remove gallery image
   * @route   DELETE /api/events/admin/events/:eventId/gallery/:publicId
   * @access  Private/Admin
   */
  removeGalleryImage = asyncHandler(async (req, res, next) => {
    const { eventId, publicId } = req.params;
    
    const result = await EventService.removeGalleryImage(eventId, publicId);
    
    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Get event statistics (admin)
   * @route   GET /api/events/admin/events/stats
   * @access  Private/Admin
   */
  getEventStats = asyncHandler(async (req, res, next) => {
    const result = await EventService.getEventStats();
    
    res.status(200).json({
      success: true,
      data: result.data
    });
  });
}

// Export an instance of the controller
module.exports = new EventController();