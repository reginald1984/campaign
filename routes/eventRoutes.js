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

router.get('/events', eventController.getUpcomingEvents);
router.get('/events/featured', eventController.getFeaturedEvents);
router.get('/events/search', eventController.searchEvents);
router.get('/events/slug/:slug', eventController.getEventBySlug);
router.get('/events/category/:category', eventController.getEventsByCategory);
router.get('/events/:eventId', eventController.getEventById);
router.post('/events/:eventId/rsvp', eventController.rsvpToEvent);
router.delete('/events/:eventId/rsvp', eventController.cancelRSVP);

// =============================================
// PROTECTED ROUTES (Authentication required)
// =============================================

router.use(protect); // <-- KEY LINE

router.get('/admin/events', eventController.getAllEventsForAdmin);
router.get('/admin/events/stats', eventController.getEventStats);
router.get('/admin/events/:eventId/rsvps', eventController.getEventRSVPs);
router.post('/admin/events/new', eventController.createEvent);
router.get('/admin/events/:eventId', eventController.getEventById);
router.put('/admin/events/update/:eventId', eventController.updateEvent);
router.delete('/admin/events/delete/:eventId', eventController.deleteEvent);
router.post('/admin/events/:eventId/featured-image', uploadEventFeaturedImage.single('image'), handleEventUploadError, eventController.uploadFeaturedImage);
router.post('/admin/events/:eventId/gallery', uploadEventGalleryImages.array('images', 10), handleEventUploadError, eventController.uploadGalleryImages);
router.delete('/admin/events/:eventId/gallery/:publicId', eventController.removeGalleryImage);

module.exports = router;