const express = require('express');
const router = express.Router();
const eventController = require('../controllers/EventController');
const { protect } = require('../middleware/auth');
const {
  uploadEventFeaturedImage,
  uploadEventGalleryImages,
  handleEventUploadError,
} = require('../middleware/event-upload');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

/**
 * @route   GET /api/v1/events
 * @desc    Get upcoming events (with pagination and category filter)
 * @access  Public
 */
router.get('/events', eventController.getUpcomingEvents);

/**
 * @route   GET /api/v1/events/featured
 * @desc    Get featured events
 * @access  Public
 */
router.get('/events/featured', eventController.getFeaturedEvents);

/**
 * @route   GET /api/v1/events/search
 * @desc    Search events
 * @access  Public
 */
router.get('/events/search', eventController.searchEvents);

/**
 * @route   GET /api/v1/events/slug/:slug
 * @desc    Get event by slug
 * @access  Public
 */
router.get('/events/slug/:slug', eventController.getEventBySlug);

/**
 * @route   GET /api/v1/events/category/:category
 * @desc    Get events by category
 * @access  Public
 */
router.get('/events/category/:category', eventController.getEventsByCategory);

/**
 * @route   GET /api/v1/events/:eventId
 * @desc    Get event by ID
 * @access  Public
 */
router.get('/events/:eventId', eventController.getEventById);

/**
 * @route   POST /api/v1/events/:eventId/rsvp
 * @desc    RSVP to an event
 * @access  Public
 */
router.post('/events/:eventId/rsvp', eventController.rsvpToEvent);

/**
 * @route   DELETE /api/v1/events/:eventId/rsvp
 * @desc    Cancel RSVP
 * @access  Public
 */
router.delete('/events/:eventId/rsvp', eventController.cancelRSVP);

// =============================================
// PROTECTED ROUTES (Authentication required)
// =============================================

// Apply authentication middleware to all routes below
router.use(protect);

/**
 * @route   GET /api/v1/admin/events
 * @desc    Get all events for admin (with pagination and status filter)
 * @access  Private/Admin
 */
router.get('/admin/events', eventController.getAllEventsForAdmin);

/**
 * @route   GET /api/v1/admin/events/stats
 * @desc    Get event statistics
 * @access  Private/Admin
 */
router.get('/admin/events/stats', eventController.getEventStats);

/**
 * @route   GET /api/v1/admin/events/:eventId/rsvps
 * @desc    Get event RSVPs
 * @access  Private/Admin
 */
router.get('/admin/events/:eventId/rsvps', eventController.getEventRSVPs);

/**
 * @route   POST /api/v1/admin/events/new
 * @desc    Create new event
 * @access  Private/Admin
 */
router.post('/admin/events/new', eventController.createEvent);

/**
 * @route   GET /api/v1/admin/events/:eventId
 * @desc    Get event by ID (admin)
 * @access  Private/Admin
 */
router.get('/admin/events/:eventId', eventController.getEventById);

/**
 * @route   PUT /api/v1/admin/events/update/:eventId
 * @desc    Update event
 * @access  Private/Admin
 */
router.put('/admin/events/update/:eventId', eventController.updateEvent);

/**
 * @route   DELETE /api/v1/admin/events/delete/:eventId
 * @desc    Delete event
 * @access  Private/Admin
 */
router.delete('/admin/events/delete/:eventId', eventController.deleteEvent);

/**
 * @route   POST /api/v1/admin/events/:eventId/featured-image
 * @desc    Upload featured image for event
 * @access  Private/Admin
 */
router.post(
  '/admin/events/:eventId/featured-image',
  uploadEventFeaturedImage.single('image'),
  handleEventUploadError,
  eventController.uploadFeaturedImage
);

/**
 * @route   POST /api/v1/admin/events/:eventId/gallery
 * @desc    Upload gallery images for event
 * @access  Private/Admin
 */
router.post(
  '/admin/events/:eventId/gallery',
  uploadEventGalleryImages.array('images', 10),
  handleEventUploadError,
  eventController.uploadGalleryImages
);

/**
 * @route   DELETE /api/v1/admin/events/:eventId/gallery/:publicId
 * @desc    Remove gallery image
 * @access  Private/Admin
 */
router.delete(
  '/admin/events/:eventId/gallery/:publicId',
  eventController.removeGalleryImage
);

module.exports = router;