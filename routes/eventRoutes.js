const express = require('express');
const router = express.Router();
const eventController = require('../controllers/EventController'); // Fixed: contrrollers -> controllers
const { protect} = require('../middleware/auth');
const {
  uploadEventFeaturedImage,
  uploadEventGalleryImages,
  handleEventUploadError,
} = require('../middleware/event-upload');

// ==================== PUBLIC ROUTES ====================

// Get upcoming events (with pagination and category filter)
router.get('/events', eventController.getUpcomingEvents);

// Get featured events
router.get('/featured', eventController.getFeaturedEvents);

// Search events
router.get('/search', eventController.searchEvents);

// Get event by slug (public)
router.get('/events/slug/:slug', eventController.getEventBySlug);

// Get events by category
router.get('/category/:category', eventController.getEventsByCategory);

// RSVP to an event (public)
router.post('/:eventId/rsvp', eventController.rsvpToEvent);

// Cancel RSVP (public)
router.delete('/:eventId/rsvp', eventController.cancelRSVP);

// ==================== ADMIN ROUTES ====================

// Get all events for admin (with pagination and status filter)
router.get('/admin/events', protect,  eventController.getAllEventsForAdmin);

// Get event statistics
router.get('/admin/events/stats', protect,  eventController.getEventStats);

// Get event RSVPs
router.get('/admin/events/:eventId/rsvps', protect,  eventController.getEventRSVPs);

// Create new event
router.post('/admin/new-events', protect,  eventController.createEvent);
// Get event by ID (admin)
router.get('/admin/events/:eventId', protect,  eventController.getEventById);

// Update event
router.put('/admin/update-events/:eventId', protect,  eventController.updateEvent);

// Delete event
router.delete('/admin/events/:eventId', protect,  eventController.deleteEvent);

// Upload featured image for event
router.post(
  '/admin/events/:eventId/featured-image',
  protect,
  uploadEventFeaturedImage.single('image'),
  handleEventUploadError,
  eventController.uploadFeaturedImage
);

// Upload gallery images for event
router.post(
  '/admin/events/:eventId/gallery',
  protect,
  uploadEventGalleryImages.array('images', 10),
  handleEventUploadError,
  eventController.uploadGalleryImages
);

// Remove gallery image
router.delete(
  '/admin/events/:eventId/gallery/:publicId',
  protect,
  eventController.removeGalleryImage
);

module.exports = router;