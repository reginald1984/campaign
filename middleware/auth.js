// backend/middleware/auth.js
const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const HttpError = require('./HttpError');
const { verifyToken } = require('../utils/tokenUtils');

const protect = asyncHandler(async (req, res, next) => {
  let token;
  
  // Check for token in Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // Check for token in cookies
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  if (!token) {
    return next(new HttpError('Not authorized to access this route', 401));
  }
  
  try {
    // Verify token
    const decoded = verifyToken(token);
    
    // Get user from database (excluding password)
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return next(new HttpError('User not found', 401));
    }
    
    // Check if user is active
    if (!user.isActive) {
      return next(new HttpError('Your account has been deactivated', 401));
    }
    
    // Check if account is locked
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return next(new HttpError(`Account locked. Try again after ${new Date(user.lockUntil).toLocaleTimeString()}`, 401));
    }
    
    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new HttpError('Invalid token', 401));
    } else if (error.name === 'TokenExpiredError') {
      return next(new HttpError('Token expired', 401));
    }
    return next(new HttpError('Not authorized', 401));
  }
});

module.exports = { protect };