// utils/allowedOrigins.js
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8280',
  'http://cheapcallme.com',
    'https://cheapcallme.com',
  'https://campaign-lceh.onrender.com',  // Updated from cvtt to lceh
  'https://campaign-22qf.onrender.com'   // Keep old one for backward compatibility
];

// Export as array (not wrapped in object)
module.exports = ALLOWED_ORIGINS;
