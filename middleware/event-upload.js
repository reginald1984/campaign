const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

// Configure Cloudinary storage for event featured images
const eventFeaturedImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'campaign/events/featured',
    transformation: [
      { width: 1200, height: 630, crop: 'fill' },
      { quality: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});

// Configure Cloudinary storage for event gallery images
const eventGalleryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'campaign/events/gallery',
    transformation: [
      { width: 800, height: 600, crop: 'limit' },
      { quality: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
  }
});

// Create multer instances for event uploads
const uploadEventFeaturedImage = multer({
  storage: eventFeaturedImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const uploadEventGalleryImages = multer({
  storage: eventGalleryStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Error handling middleware for event uploads
const handleEventUploadError = (err, req, res, next) => {
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
        message: 'Too many files. Maximum is 10 images.'
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

module.exports = {
  uploadEventFeaturedImage,
  uploadEventGalleryImages,
  handleEventUploadError
};