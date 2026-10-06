/**
 * JWT Authentication Middleware
 * Handles JWT token extraction and verification.
 * 
 * This middleware is ONLY responsible for:
 * 1. Extracting the JWT token from the request
 * 2. Verifying the token signature
 * 3. Attaching the decoded user data to req.user
 * 
 * It does NOT handle permissions or authorization checks.
 */
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { JWT_SECRET } = require('../config/constants'); // Import centralized JWT secret

// Set to true to enable JWT debug logs - DISABLED BY DEFAULT
// This was previously causing excessive console output with hundreds of identical messages
const DEBUG_JWT = process.env.DEBUG_JWT === 'true';

// Conditional debug logging helper
const debugLog = (...args) => {
  if (DEBUG_JWT) {
    console.log('[JWT]', ...args);
  }
  // No-op by default - only logs when explicitly enabled
};

// JWT_SECRET is now imported from config/constants.js

// Determine if we're in development mode
const isDevelopmentMode = process.env.NODE_ENV === 'development';
const skipPermissionChecks = process.env.SKIP_PERMISSION_CHECKS === 'true';

/**
 * JWT Authentication Middleware
 * Always extracts and verifies JWT tokens if present
 */
module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      if (!JWT_SECRET) {
        console.error('JWT_SECRET is not defined in environment variables');
        if (isDevelopmentMode && skipPermissionChecks) {
          // In development with skipped permissions, continue without auth
          return next();
        }
        return res.status(500).json({ status: 'error', message: 'Server configuration error' });
      }
      
      try {
        // Verify token and handle errors
        let decoded;
        let verified = false;
        
        // First try with our centralized JWT_SECRET
        try {
          decoded = jwt.verify(token, JWT_SECRET);
          verified = true;
        } catch (verifyErr) {
          // In development mode, try with common fallback secrets if the main one fails
          if (process.env.NODE_ENV === 'development') {
            const possibleSecrets = [
              'your-secret-key',
              'your-secret-key-for-development-only',
              'your_jwt_secret'
            ];
            
            // Try each possible secret
            for (const secret of possibleSecrets) {
              try {
                decoded = jwt.verify(token, secret);
                verified = true;
                console.log(`JWT verified with fallback secret: '${secret}'. Update frontend to use the same JWT_SECRET.`);
                break;
              } catch (fallbackErr) {
                // Continue to next secret
              }
            }
          }
          
          // If we still couldn't verify, throw the original error
          if (!verified) {
            throw verifyErr;
          }
        }
        
        // Ensure decoded token includes all required RBAC properties
        req.user = {
          ...decoded,
          permissions: decoded.permissions || [],
          roles: decoded.roles || [],
          systemRoles: decoded.systemRoles || []
        };
        
        // Set standard headers for downstream middleware and controllers
        if (req.user.tenant_id) {
          req.headers['x-tenant-id'] = req.user.tenant_id;
        }
        
        if (req.user.store_id) {
          req.headers['x-store-id'] = req.user.store_id;
        }
        
        if (req.user.id) {
          req.headers['x-user-id'] = req.user.id;
        }
        
        // DISABLED: This log was creating excessive console output
        // Only enable with DEBUG_JWT=true when specifically debugging JWT issues
        // debugLog(`Token decoded successfully for user: ${req.user.email}`);
        
        return next();
      } catch (jwtError) {
        console.error(`JWT verification error: ${jwtError.message}`);
        
        // In development with skipped permissions, continue without valid auth
        if (isDevelopmentMode && skipPermissionChecks) {
          debugLog('Development mode with skipped permissions - continuing without valid token');
          return next();
        }
        
        // In production, enforce valid tokens
        return res.status(401).json({ 
          status: 'error', 
          message: jwtError.name === 'TokenExpiredError' 
            ? 'Token expired' 
            : 'Invalid token'
        });
      }
    } else {
      // No token provided
      if (isDevelopmentMode && skipPermissionChecks) {
        debugLog('No token provided, but continuing in development mode with skipped permissions');
        return next();
      }
      
      return res.status(401).json({ 
        status: 'error', 
        message: 'No authentication token provided'
      });
    }
  } catch (error) {
    console.error('Error in JWT middleware:', error);
    return res.status(500).json({ status: 'error', message: 'Server error processing authentication' });
  }
};
