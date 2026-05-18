const express = require('express');
const router = express.Router();
const volunteerController = require('../controllers/VolunteerController');
const { protect } = require('../middleware/auth');
const { uploadVolunteerId } = require('../middleware/volunteer-upload');

// =============================================
// PUBLIC ROUTES (No authentication required)
// =============================================

router.post('/volunteers/register', uploadVolunteerId.single('idPicture'), volunteerController.registerVolunteer);
router.get('/volunteers/id-number/:idNumber', volunteerController.getVolunteerByIdNumber);
router.get('/volunteers/stats', volunteerController.getVolunteerStats); // <-- THIS IS PUBLIC

// =============================================
// PROTECTED ROUTES (Authentication required)
// =============================================

router.use(protect); // <-- KEY LINE

router.get('/volunteers/dashboard/:volunteerId', volunteerController.getVolunteerDashboard);
router.get('/volunteers', volunteerController.getAllVolunteers);
router.get('/volunteers/export', volunteerController.exportVolunteers);
router.get('/volunteers/:volunteerId', volunteerController.getVolunteerById);
router.put('/volunteers/:volunteerId', volunteerController.updateVolunteer);
router.put('/volunteers/:volunteerId/approve', volunteerController.approveVolunteer);
router.put('/volunteers/:volunteerId/reject', volunteerController.rejectVolunteer);
router.put('/volunteers/:volunteerId/status', volunteerController.updateVolunteerStatus);
router.post('/volunteers/:volunteerId/hours', volunteerController.addVolunteerHours); 
router.post('/volunteers/:volunteerId/achievements', volunteerController.addAchievement);
router.delete('/volunteers/:volunteerId', volunteerController.deleteVolunteer);

module.exports = router;