// backend/middleware/post-upload.js

const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../config/cloudinary');

// Configure Cloudinary storage for featured images
const featuredImageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'campaign/posts/featured',
    transformation: [
      { width: 1200, height: 630, crop: 'fill' },
      { quality: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp']
  }
});

// Configure Cloudinary storage for gallery images
const galleryStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'campaign/posts/gallery',
    transformation: [
      { width: 800, height: 600, crop: 'limit' },
      { quality: 'auto' }
    ],
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp']
  }
});

// Create multer instances
const uploadFeaturedImage = multer({
  storage: featuredImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    console.log('Featured image filter:', file.originalname, file.mimetype);
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

const uploadGalleryImages = multer({
  storage: galleryStorage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10 // Max 10 files
  },
  fileFilter: (req, file, cb) => {
    console.log('Gallery image filter:', file.originalname, file.mimetype);
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Error handling middleware for post uploads
const handlePostUploadError = (err, req, res, next) => {
  console.error('Upload error:', err);
  
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
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Unexpected field. Please upload images with field name "image" for featured and "images" for gallery.'
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

// Export all middleware
module.exports = {
  uploadFeaturedImage,
  uploadGalleryImages,  // Make sure this is exported
  handlePostUploadError
};