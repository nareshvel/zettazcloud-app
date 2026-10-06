/**
 * Permission Requirement Middleware
 * Checks if the current user has the required permission.
 * 
 * This middleware should run AFTER the JWT middleware and ID extractor middleware.
 */

// Determine if we're in development mode and should skip permission checks
const isDevelopmentMode = process.env.NODE_ENV === 'development';
const skipPermissionChecks = process.env.SKIP_PERMISSION_CHECKS === 'true';

/**
 * Middleware to require specific permission
 * @param {String} permission - Permission to check
 * @returns {Function} Express middleware
 */
function requirePermission(permission) {
  return (req, res, next) => {
    // Skip permission checks in development mode if configured
    if (isDevelopmentMode && skipPermissionChecks) {
      console.log(`RBAC MIDDLEWARE: Skipping permission checks in development mode`);
      return next();
    }

    // Ensure user exists
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Ensure tenant_id exists
    const tenantId = req.headers['x-tenant-id'];
    if (!tenantId) {
      return res.status(403).json({
        status: 'error',
        message: 'Tenant information is missing or user is not authorized.'
      });
    }

    // Check if user has the required permission
    const userPermissions = req.user.permissions || [];
    
    // Check for admin/wildcard permissions or specific permission
    if (
      userPermissions.includes('*') || 
      userPermissions.includes(permission) ||
      // Check for wildcard permissions in the same resource area
      // e.g. "products.*" matches "products.view", "products.create", etc.
      userPermissions.some(p => {
        // If permission is "resource.action", check for "resource.*"
        if (permission.includes('.')) {
          const resource = permission.split('.')[0];
          return p === `${resource}.*`;
        }
        return false;
      })
    ) {
      return next();
    }

    // Permission denied
    return res.status(403).json({
      status: 'error',
      message: 'You do not have permission to perform this action.'
    });
  };
}

module.exports = requirePermission;
