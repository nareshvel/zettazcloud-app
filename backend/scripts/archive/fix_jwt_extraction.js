/**
 * JWT Extraction Fix
 * 
 * This script modifies the authentication middleware to properly extract
 * JWT tokens in development mode when permission checks are skipped.
 * 
 * The issue was that while we had code to extract the token, the req.user
 * object was not actually being populated correctly.
 */

const fs = require('fs');
const path = require('path');

// Path to middleware
const authMiddlewarePath = path.join(__dirname, '../middleware/unifiedAuthMiddleware.js');

// Read current middleware code
let authMiddlewareContent = fs.readFileSync(authMiddlewarePath, 'utf8');

console.log('Creating direct JWT middleware fix...');

// Replace the entire authenticate middleware with a corrected version
// This ensures proper JWT extraction regardless of permission checks
const newAuthMiddleware = `/**
 * Authentication middleware that verifies the JWT token
 * When SKIP_PERMISSION_CHECKS is true in development, it will still extract
 * user data from JWT but won't block the request
 */
exports.authenticate = async (req, res, next) => {
  try {
    // Always try to extract and verify JWT regardless of permission checks
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const jwt = require('jsonwebtoken');
        
        // Use centralized JWT_SECRET from constants file
        const { JWT_SECRET } = require('../config/constants');
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Always attach user data when JWT is valid
        req.user = decoded;
        
        // Debug log in development mode
        if (process.env.NODE_ENV === 'development') {
          console.log('[JWT Debug] Valid token detected, user data attached');
        }
        
        // Also set headers for components that might use them directly
        if (decoded.tenant_id) req.headers['x-tenant-id'] = decoded.tenant_id;
        if (decoded.store_id) req.headers['x-store-id'] = decoded.store_id;
        if (decoded.id) req.headers['x-user-id'] = decoded.id;
        
        // In development + skip permission mode, allow the request through
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_PERMISSION_CHECKS === 'true') {
          console.log('RBAC MIDDLEWARE: Token verified but skipping permission checks in development mode');
          return next();
        }
        
        // In production, continue normal flow with authenticated user
        return next();
      } catch (err) {
        // JWT verification failed
        console.error('JWT verification failed:', err.message);
        
        // In development + skip permission mode, allow request even with bad JWT
        if (process.env.NODE_ENV === 'development' && process.env.SKIP_PERMISSION_CHECKS === 'true') {
          console.log('RBAC MIDDLEWARE: JWT verification failed, but proceeding in dev mode');
          // Still try to extract tenant/store from query params
          if (req.query.tenant_id) req.headers['x-tenant-id'] = req.query.tenant_id;
          if (req.query.store_id) req.headers['x-store-id'] = req.query.store_id;
          return next();
        }
        
        // In production, block unauthorized requests
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
    } else {
      // No JWT found
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_PERMISSION_CHECKS === 'true') {
        console.log('RBAC MIDDLEWARE: No token found, but proceeding in dev mode');
        // Try to extract tenant/store from query params
        if (req.query.tenant_id) req.headers['x-tenant-id'] = req.query.tenant_id;
        if (req.query.store_id) req.headers['x-store-id'] = req.query.store_id;
        return next();
      }
      
      // In production, block requests without JWT
      return res.status(401).json({ message: 'Authorization token is required' });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    
    if (process.env.NODE_ENV === 'development' && process.env.SKIP_PERMISSION_CHECKS === 'true') {
      return next(); // Still proceed in dev mode
    }
    
    return res.status(500).json({ message: 'Internal server error during authentication' });
  }
};`;

// Find the authenticate middleware and replace it
const authRegex = /exports\.authenticate = async \(req, res, next\) => \{[\s\S]*?(?=exports\.|$)/;
if (authRegex.test(authMiddlewareContent)) {
  authMiddlewareContent = authMiddlewareContent.replace(authRegex, newAuthMiddleware);
  fs.writeFileSync(authMiddlewarePath, authMiddlewareContent, 'utf8');
  console.log('Successfully updated authentication middleware with proper JWT handling');
} else {
  console.log('Could not find authenticate middleware pattern - manual update needed');
}

// Now add a direct tenant_id and store_id extraction middleware that runs before all routes
// This will extract tenant_id and store_id from JWT, query params, or headers and ensure it's available
const extractorMiddlewarePath = path.join(__dirname, '../middleware/idExtractorMiddleware.js');
const extractorMiddlewareContent = `/**
 * ID Extractor Middleware
 * Ensures tenant_id and store_id are always available from:
 * 1. req.user (from JWT)
 * 2. Request headers
 * 3. Query parameters
 */
module.exports = (req, res, next) => {
  // Extract tenant_id
  if (!req.headers['x-tenant-id']) {
    // Try to get from req.user first
    if (req.user?.tenant_id) {
      req.headers['x-tenant-id'] = req.user.tenant_id;
    } 
    // Then try query params
    else if (req.query?.tenant_id) {
      req.headers['x-tenant-id'] = req.query.tenant_id;
    }
  }
  
  // Extract store_id
  if (!req.headers['x-store-id']) {
    // Try to get from req.user first
    if (req.user?.store_id) {
      req.headers['x-store-id'] = req.user.store_id;
    } 
    // Then try query params
    else if (req.query?.store_id) {
      req.headers['x-store-id'] = req.query.store_id;
    }
  }
  
  next();
};`;

fs.writeFileSync(extractorMiddlewarePath, extractorMiddlewareContent, 'utf8');
console.log('Created new ID extractor middleware');

// Now update the server.js to use this middleware globally
const serverPath = path.join(__dirname, '../server.js');
const serverContent = fs.readFileSync(serverPath, 'utf8');

// Add the import for the new middleware and apply it before routes
if (!serverContent.includes('idExtractorMiddleware')) {
  // Find the express setup section with other app.use calls
  const appUsePatternRegex = /(app\.use\(express\.json\(\)\);.*?)(\n\s*\/\/ API Routes)/s;
  
  if (appUsePatternRegex.test(serverContent)) {
    const newServerContent = serverContent.replace(
      appUsePatternRegex,
      '$1\n\n// Extract tenant_id and store_id from various sources\nconst idExtractorMiddleware = require(\'./middleware/idExtractorMiddleware\');\napp.use(idExtractorMiddleware);\n$2'
    );
    
    fs.writeFileSync(serverPath, newServerContent, 'utf8');
    console.log('Successfully added ID extractor middleware to server.js');
  } else {
    console.log('Could not find app.use pattern in server.js - manual update needed');
  }
}

// Finally, let's update controllers that have tenant_id and store_id checks to use our new headers
// Create a separate fix script for key controllers

const salesControllerPath = path.join(__dirname, '../controllers/salesController.js');
if (fs.existsSync(salesControllerPath)) {
  let salesContent = fs.readFileSync(salesControllerPath, 'utf8');
  
  // Fix the summary endpoint to check headers first
  const summaryRegex = /const tenant_id = req\.user\?\.tenant_id \|\| req\.query\?\.tenant_id \|\| req\.headers\["x-tenant-id"\] \|\| null;[\s\S]*?const store_id = req\.user\?\.store_id \|\| req\.query\?\.store_id \|\| req\.headers\["x-store-id"\] \|\| null;/g;
  
  if (summaryRegex.test(salesContent)) {
    salesContent = salesContent.replace(summaryRegex, 
      `const tenant_id = req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null;
        const store_id = req.headers["x-store-id"] || req.user?.store_id || req.query?.store_id || null;
        
        console.log('[DEBUG] /api/sales/summary - Headers:', req.headers);
        console.log('[DEBUG] /api/sales/summary - User:', req.user);
        console.log('[DEBUG] /api/sales/summary - Using tenant_id:', tenant_id, 'store_id:', store_id);`
    );
    
    fs.writeFileSync(salesControllerPath, salesContent, 'utf8');
    console.log('Fixed tenant/store ID handling in salesController.js');
  }
}

// Fix the reports controller
const reportsControllerPath = path.join(__dirname, '../controllers/reportsController.js');
if (fs.existsSync(reportsControllerPath)) {
  let reportsContent = fs.readFileSync(reportsControllerPath, 'utf8');
  
  // Update all tenant_id extractions to check headers first
  const tenantRegex = /const tenant_id = req\.user\?\.tenant_id \|\| req\.query\?\.tenant_id \|\| req\.headers\["x-tenant-id"\];/g;
  
  if (tenantRegex.test(reportsContent)) {
    reportsContent = reportsContent.replace(tenantRegex,
      `const tenant_id = req.headers["x-tenant-id"] || req.user?.tenant_id || req.query?.tenant_id || null;
      // Debug log the tenant_id extraction
      console.log('[DEBUG] reports endpoint - Headers:', req.headers);
      console.log('[DEBUG] reports endpoint - Using tenant_id:', tenant_id);`
    );
    
    fs.writeFileSync(reportsControllerPath, reportsContent, 'utf8');
    console.log('Fixed tenant_id handling in reportsController.js');
  }
}

console.log('JWT extraction fix completed successfully!');
console.log('Restart the server to apply changes.');
