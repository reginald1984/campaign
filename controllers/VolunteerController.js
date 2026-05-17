const VolunteerService = require('../services/volunteer-service');
const HttpError = require('../middleware/HttpError');
const asyncHandler = require('express-async-handler');

class VolunteerController {
  /**
   * @desc    Register a new volunteer
   * @route   POST /api/v1/volunteers/register
   * @access  Public
   */
 registerVolunteer = asyncHandler(async (req, res, next) => {
    // With Cloudinary storage, the file is already uploaded
    // The file object contains the Cloudinary URL and public_id
    let volunteerData = req.body;
    const idPictureFile = req.file;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const referrer = req.headers['referer'] || null;

    // Process interests and skills if they come as strings
    if (volunteerData.interests && typeof volunteerData.interests === 'string') {
      volunteerData.interests = volunteerData.interests.split(',');
    }
    if (volunteerData.skills && typeof volunteerData.skills === 'string') {
      volunteerData.skills = volunteerData.skills.split(',');
    }

    // Process emergency contact if it comes as separate fields
    if (req.body['emergencyContact[name]']) {
      volunteerData.emergencyContact = {
        name: req.body['emergencyContact[name]'],
        relationship: req.body['emergencyContact[relationship]'],
        phone: req.body['emergencyContact[phone]']
      };
    }

    // If file is already on Cloudinary, create idPicture object
    if (idPictureFile && (idPictureFile.secure_url || idPictureFile.url || idPictureFile.path)) {
      const imageUrl = idPictureFile.secure_url || idPictureFile.url || idPictureFile.path;
      const publicId = idPictureFile.public_id || idPictureFile.filename;
      
      volunteerData.idPicture = {
        url: imageUrl,
        publicId: publicId,
        filename: idPictureFile.originalname || 'id_picture',
        size: idPictureFile.size || 0,
        mimeType: idPictureFile.mimetype || 'image/jpeg',
        uploadedAt: new Date()
      };
      
      // Remove the file object from request body
      delete req.file;
    }

    const result = await VolunteerService.registerVolunteer(
      volunteerData,
      idPictureFile,
      ipAddress,
      userAgent,
      referrer
    );

    res.status(201).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Get all volunteers (admin only)
   * @route   GET /api/v1/volunteers
   * @access  Private/Admin
   */
  getAllVolunteers = asyncHandler(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filters = {
      status: req.query.status,
      availability: req.query.availability,
      city: req.query.city,
      state: req.query.state,
      search: req.query.search,
      interest: req.query.interest,
      skill: req.query.skill
    };

    const result = await VolunteerService.getAllVolunteers(filters, page, limit);

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination
    });
  });

  /**
   * @desc    Get volunteer by ID (admin only)
   * @route   GET /api/v1/volunteers/:volunteerId
   * @access  Private/Admin
   */
  getVolunteerById = asyncHandler(async (req, res, next) => {
    const { volunteerId } = req.params;

    const result = await VolunteerService.getVolunteerById(volunteerId);

    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Get volunteer by ID number
   * @route   GET /api/v1/volunteers/id-number/:idNumber
   * @access  Public
   */
  getVolunteerByIdNumber = asyncHandler(async (req, res, next) => {
    const { idNumber } = req.params;

    const result = await VolunteerService.getVolunteerByIdNumber(idNumber);

    res.status(200).json({
      success: true,
      data: result.data
    });
  });

  /**
   * @desc    Update volunteer information (admin only)
   * @route   PUT /api/v1/volunteers/:volunteerId
   * @access  Private/Admin
   */
  updateVolunteer = asyncHandler(async (req, res, next) => {
    const { volunteerId } = req.params;
    const updateData = req.body;

    const result = await VolunteerService.updateVolunteer(volunteerId, updateData);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Approve volunteer application (admin only)
   * @route   PUT /api/v1/volunteers/:volunteerId/approve
   * @access  Private/Admin
   */
  approveVolunteer = asyncHandler(async (req, res, next) => {
    const { volunteerId } = req.params;
    const adminId = req.user._id;

    const result = await VolunteerService.approveVolunteer(volunteerId, adminId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Reject volunteer application (admin only)
   * @route   PUT /api/v1/volunteers/:volunteerId/reject
   * @access  Private/Admin
   */
  rejectVolunteer = asyncHandler(async (req, res, next) => {
    const { volunteerId } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    if (!reason) {
      return next(new HttpError('Please provide a reason for rejection', 400));
    }

    const result = await VolunteerService.rejectVolunteer(volunteerId, reason, adminId);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Delete volunteer (admin only)
   * @route   DELETE /api/v1/volunteers/:volunteerId
   * @access  Private/Admin
   */
  deleteVolunteer = asyncHandler(async (req, res, next) => {
    const { volunteerId } = req.params;

    const result = await VolunteerService.deleteVolunteer(volunteerId);

    res.status(200).json({
      success: true,
      message: result.message
    });
  });

  /**
   * @desc    Get volunteer statistics (admin only)
   * @route   GET /api/v1/volunteers/stats
   * @access  Private/Admin
   */
  getVolunteerStats = asyncHandler(async (req, res, next) => {
    const result = await VolunteerService.getVolunteerStats();

    res.status(200).json({
      success: true,
      data: result.data 
    });
  });

  /**
   * @desc    Add volunteer hours (admin only)
   * @route   POST /api/v1/volunteers/:volunteerId/hours
   * @access  Private/Admin
   */
  addVolunteerHours = asyncHandler(async (req, res, next) => {
    const { volunteerId } = req.params;
    const { hours, eventId, eventName } = req.body;

    if (!hours || hours <= 0) {
      return next(new HttpError('Please provide valid hours', 400));
    }

    const result = await VolunteerService.addVolunteerHours(volunteerId, hours, eventId, eventName);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Add achievement to volunteer (admin only)
   * @route   POST /api/v1/volunteers/:volunteerId/achievements
   * @access  Private/Admin
   */
  addAchievement = asyncHandler(async (req, res, next) => {
    const { volunteerId } = req.params;
    const { title, description } = req.body;

    if (!title || !description) {
      return next(new HttpError('Please provide title and description', 400));
    }

    const result = await VolunteerService.addAchievement(volunteerId, title, description);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result.data
    });
  });

  /**
   * @desc    Export volunteers to CSV (admin only)
   * @route   GET /api/v1/volunteers/export
   * @access  Private/Admin
   */
  exportVolunteers = asyncHandler(async (req, res, next) => {
    const filters = {
      status: req.query.status,
      city: req.query.city,
      state: req.query.state
    };

    const result = await VolunteerService.exportVolunteers(filters);

    // Create CSV
    const csvHeaders = ['ID Number', 'Name', 'Email', 'Phone', 'City', 'State', 'Status', 'Availability', 'Interests', 'Skills', 'Hours', 'Registered Date'];
    const csvRows = result.data.map(volunteer => [
      volunteer.idNumber,
      volunteer.name,
      volunteer.email,
      volunteer.phone,
      volunteer.city || '',
      volunteer.state || '',
      volunteer.status,
      volunteer.availability,
      volunteer.interests?.join('; ') || '',
      volunteer.skills?.join('; ') || '',
      volunteer.hoursVolunteered || 0,
      new Date(volunteer.createdAt).toLocaleDateString()
    ]);

    const csvContent = [csvHeaders, ...csvRows].map(row => row.join(',')).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=volunteers.csv');
    res.send(csvContent);
  });

  /**
   * @desc    Get volunteer dashboard data (volunteer only)
   * @route   GET /api/v1/volunteers/dashboard/:volunteerId
   * @access  Private
   */
  getVolunteerDashboard = asyncHandler(async (req, res, next) => {
    const { volunteerId } = req.params;

    const result = await VolunteerService.getVolunteerById(volunteerId);

    // Get additional dashboard data
    const dashboardData = {
      profile: result.data,
      totalHours: result.data.hoursVolunteered || 0,
      eventsAttended: result.data.eventsAttended?.length || 0,
      achievements: result.data.achievements || [],
      recentActivities: [
        ...(result.data.eventsAttended || []).slice(-5),
        ...(result.data.achievements || []).slice(-3)
      ].sort((a, b) => new Date(b.date) - new Date(a.date))
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  });

  /**
   * @desc    Update volunteer status (admin only)
   * @route   PUT /api/v1/volunteers/:volunteerId/status
   * @access  Private/Admin
   */
  updateVolunteerStatus = asyncHandler(async (req, res, next) => {
    const { volunteerId } = req.params;
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      return next(new HttpError('Please provide valid status (active/inactive)', 400));
    }

    const volunteer = await VolunteerService.getVolunteerById(volunteerId);
    
    if (status === 'active') {
      await VolunteerService.activateVolunteer(volunteerId);
    } else {
      await VolunteerService.deactivateVolunteer(volunteerId);
    }

    res.status(200).json({
      success: true,
      message: `Volunteer status updated to ${status}`
    });
  });
}

module.exports = new VolunteerController();