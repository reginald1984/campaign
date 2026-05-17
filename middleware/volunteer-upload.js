// backend/middleware/volunteer-upload.js
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

// Configure Cloudinary storage for volunteer ID pictures
const volunteerIdStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'campaign/volunteers/id-pictures',
    transformation: [
      { width: 800, height: 800, crop: 'limit' },
      { quality: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png'],
    format: async (req, file) => 'jpg',
    public_id: (req, file) => {
      const timestamp = Date.now();
      const idNumber = req.body.idNumber || 'unknown';
      return `volunteer_${idNumber}_${timestamp}`;
    }
  }
});

// Create multer instance for volunteer ID upload
const uploadVolunteerId = multer({
  storage: volunteerIdStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Allowed mime types
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, and PNG images are allowed'), false);
    }
  }
});

// Error handling middleware for volunteer uploads
const handleVolunteerUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one ID picture is allowed.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field. Please upload only one ID picture.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    return res.status(400).json({
      success: false,
      message: err.message
    });
  }
  next();
};

// Optional: Multiple file upload for bulk volunteer registration (admin only)
const volunteerBulkStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'campaign/volunteers/bulk-uploads',
    allowed_formats: ['csv', 'xlsx', 'xls'],
    resource_type: 'raw'
  }
});

const uploadBulkVolunteerFile = multer({
  storage: volunteerBulkStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'), false);
    }
  }
});

module.exports = {
  uploadVolunteerId,
  handleVolunteerUploadError,
  uploadBulkVolunteerFile
};