/**
 * ID Extractor Middleware
 * Ensures tenant_id and store_id are always available from:
 * 1. req.user (from JWT)
 * 2. Request headers
 * 3. Query parameters
 * 
 * This middleware MUST run after the JWT middleware to ensure req.user is available.
 */
module.exports = (req, res, next) => {
  const isDevelopmentMode = process.env.NODE_ENV === 'development';
  const skipPermissionChecks = process.env.SKIP_PERMISSION_CHECKS === 'true';
  
  // Only log in development mode with debugging enabled
  const shouldLog = isDevelopmentMode && (process.env.DEBUG === 'auth' || process.env.DEBUG === 'true');
  
  // Extract tenant_id
  let tenantIdSource = null;
  
  // Use the best source for tenant_id in this priority:
  // 1. Existing x-tenant-id header
  // 2. req.user.tenant_id (from JWT)
  // 3. req.query.tenant_id
  
  if (req.headers['x-tenant-id']) {
    // Already set from a previous middleware, keep it
    tenantIdSource = 'header';
  } else if (req.user?.tenant_id) {
    req.headers['x-tenant-id'] = req.user.tenant_id;
    tenantIdSource = 'jwt';
  } else if (req.query?.tenant_id) {
    req.headers['x-tenant-id'] = req.query.tenant_id;
    tenantIdSource = 'query';
  }
  
  // Extract store_id with similar logic
  let storeIdSource = null;
  
  if (req.headers['x-store-id']) {
    storeIdSource = 'header';
  } else if (req.user?.store_id) {
    req.headers['x-store-id'] = req.user.store_id;
    storeIdSource = 'jwt';
  } else if (req.query?.store_id) {
    req.headers['x-store-id'] = req.query.store_id;
    storeIdSource = 'query';
  }
  
  if (shouldLog) {
    console.log(`[ID EXTRACTOR] ${req.method} ${req.path}:`);
    console.log(`  - tenant_id: ${req.headers['x-tenant-id']} (source: ${tenantIdSource || 'MISSING'})`);
    console.log(`  - store_id: ${req.headers['x-store-id']} (source: ${storeIdSource || 'MISSING'})`);
    
    if (req.user) {
      console.log(`  - User context available from JWT: ${req.user.email}`);
    } else {
      console.log('  - No user context available');
    }
  }
  
  // In development mode with skipped permissions, continue even without tenant_id/store_id
  if (isDevelopmentMode && skipPermissionChecks) {
    return next();
  }
  
  // In production, require tenant_id for most endpoints (except authentication endpoints)
  const isAuthEndpoint = req.path.startsWith('/api/auth') || 
                         req.path === '/api/users/me' ||
                         req.path === '/api/health';
  
  if (!isAuthEndpoint && !req.headers['x-tenant-id']) {
    if (shouldLog) {
      console.log('[ID EXTRACTOR] Tenant ID missing and required');
    }
    return res.status(403).json({
      status: 'error',
      message: 'Tenant ID is missing.'
    });
  }
  
  next();
};