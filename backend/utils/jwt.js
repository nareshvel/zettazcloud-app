const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN, JWT_REFRESH_EXPIRES_IN } = require('../config/constants');

// Use consistent JWT configuration from central constants file

/**
 * Generate a JWT token for authentication
 * @param {Object} payload - Data to be encoded in the token
 * @returns {string} JWT token
 */
const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
};

/**
 * Generate a refresh token
 * @param {Object} payload - Data to be encoded in the token
 * @returns {string} Refresh token
 */
const generateRefreshToken = (payload) => {
  // We typically include less data in refresh tokens
  const refreshPayload = {
    userId: payload.userId,
    tenant_id: payload.tenant_id,
    type: 'refresh'
  };
  
  return jwt.sign(refreshPayload, JWT_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRES_IN
  });
};

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('JWT verification error:', error.message);
    return null;
  }
};

/**
 * Refresh an access token using a refresh token
 * @param {string} refreshToken - The refresh token
 * @returns {Object|null} New tokens or null if refresh token is invalid
 */
const refreshAccessToken = (refreshToken) => {
  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
    
    // Check if it's a refresh token
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    
    // Create a new payload for the access token
    const payload = {
      userId: decoded.userId,
      tenant_id: decoded.tenant_id
    };
    
    // Generate new tokens
    return {
      accessToken: generateToken(payload),
      refreshToken: generateRefreshToken(payload)
    };
  } catch (error) {
    console.error('Token refresh error:', error.message);
    return null;
  }
};

module.exports = {
  generateToken,
  generateRefreshToken,
  verifyToken,
  refreshAccessToken
};
