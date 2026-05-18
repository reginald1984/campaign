// backend/utils/tokenUtils.js
const jwt = require('jsonwebtoken');

const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET_KEY,
    { expiresIn: process.env.JWT_TOKEN_EXP || '30d' }
  );
};

const generateRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET_KEY,
    { expiresIn: process.env.JWT_REFRESH_EXP || '90d' }
  );
};

const verifyToken = (token, isRefreshToken = false) => {
  const secret = isRefreshToken 
    ? (process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET_KEY)
    : process.env.JWT_SECRET_KEY;
  
  return jwt.verify(token, secret);
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken
};