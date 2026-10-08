/**
 * RBAC Permission Middleware
 * 
 * This middleware provides permission-based access control using the RBAC system.
 * It replaces the legacy permissionMiddleware that relied on the role column.
 */

const jwt = require('jsonwebtoken');
const db = require('../config/db');
const rbacService = require('../services/rbacService');
const PermissionSeedingService = require('../services/permissionSeedingService');
const { JWT_SECRET } = require('../config/constants'); // Import centralized JWT secret

// Set to true to enable RBAC debug logs
const DEBUG_RBAC = process.env.DEBUG_RBAC === 'true' || false;

// Conditional debug logging helper
const debugLog = (...args) => {
  if (DEBUG_RBAC) {
    console.log(...args);
  }
};

// JWT_SECRET is now imported from config/constants.js

/**
 * Helper function to check if the user has the required permission
 * from their JWT token or from a fresh database lookup
 * 
 * @param {string} userId - User ID
 * @param {string} requiredPermission - Permission to check
 * @param {string} tenantId - Tenant context
 * @param {string} storeId - Store context (optional)
 * @param {object} token - JWT token data (optional, for optimization)
 * @returns {Promise<boolean>} True if user has permission
 */
/**
 * True when the permission name is platform/system-scoped. Platform
 * permissions may only come from NULL-tenant roles (system roles) — a
 * tenant-level grant or tenant-admin bypass must never satisfy them.
 */
// The canonical scope rule lives in permissionSeedingService so catalog
// filtering, grant validation, seeding, and this runtime check never drift.
const isSystemPermissionName = (name) => PermissionSeedingService.isPlatformScopedName(name);

/**
 * Check whether a user holds a platform/system permission through a real
 * system role: either the live path (user_roles → roles.tenant_id IS NULL →
 * role_permissions → permissions) or the legacy path (user_system_roles →
 * system_role_permissions → system_permissions). No tenant-admin bypass —
 * tenant admin rights are deliberately scoped to their own tenant.
 */
const checkSystemPermission = async (userId, requiredPermission) => {
  try {
    // db.query() returns the rows array directly (config/db.js unwraps
    // mysql2's [rows, fields] tuple).
    const rows = await db.query(
      `SELECT 1 FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id AND r.tenant_id IS NULL
         JOIN role_permissions rp ON rp.role_id = r.id
         JOIN permissions p ON p.id = rp.permission_id
        WHERE ur.user_id = ? AND p.name = ?
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
        LIMIT 1`,
      [userId, requiredPermission]
    );
    if (rows.length) return true;

    const legacy = await db.query(
      `SELECT 1 FROM user_system_roles usr
         JOIN system_role_permissions srp ON srp.role_id = usr.role_id
         JOIN system_permissions sp ON sp.id = srp.permission_id
        WHERE usr.user_id = ? AND sp.name = ?
        LIMIT 1`,
      [userId, requiredPermission]
    );
    return legacy.length > 0;
  } catch (error) {
    console.error('Error checking system permission:', error.message);
    return false;
  }
};

const checkUserPermission = async (userId, requiredPermission, tenantId, storeId = null, token = null) => {
  try {
    // Platform/system permissions have no tenant-admin bypass — those rights
    // stop at the tenant boundary by design.
    if (isSystemPermissionName(requiredPermission)) {
      debugLog(`  System permission check: ${requiredPermission}`);
      return await checkSystemPermission(userId, requiredPermission);
    }

    // Check if user is a tenant admin (tenant admins bypass permission checks)
    if (tenantId && await rbacService.isTenantAdmin(userId, tenantId)) {
      debugLog(`User ${userId} is tenant admin, bypassing permission check`);
      debugLog(`  Tenant ID: ${tenantId}`);
      debugLog(`  Required permission: ${requiredPermission}`);
      return true;
    }

    // Get user's permissions
    const rbacData = await rbacService.getUserRolesAndPermissions(userId, tenantId, storeId);
    debugLog(`  User's permissions: ${rbacData.permissions.join(', ')}`);
    debugLog(`  Required permission: ${requiredPermission}`);
    return rbacData.permissions.includes(requiredPermission);
  } catch (error) {
    console.error('Error checking permission:', error.message);
    return false;
  }
};

// Note: isTenantAdmin function has been moved to rbacService.js for centralized management

/**
 * Create permission middleware
 * 
 * @param {string} requiredPermission - Permission required to access route
 * @param {object} options - Options for permission check
 * @returns {Function} Express middleware function
 */
const requirePermission = (requiredPermission, options = {}) => {
  return async (req, res, next) => {
    try {
      // Check for development mode with permission checks skipped
      const skipPermissionChecks = process.env.NODE_ENV === 'development' && process.env.SKIP_PERMISSION_CHECKS === 'true';
      
      // In development mode with permission skipping, we still need to extract real user from JWT
      if (skipPermissionChecks) {
        debugLog(`RBAC MIDDLEWARE: Skipping permission check for "${requiredPermission}" in development mode`);
        
        // Extract user from JWT token even in development mode to get real user ID
        const token = req.headers.authorization?.split(' ')[1];
        
        if (token) {
          try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = {
              id: decoded.id,
              email: decoded.email,
              name: decoded.name,
              tenant_id: decoded.tenant_id || decoded.tenantId,
              tenantId: decoded.tenant_id || decoded.tenantId,
              store_id: decoded.store_id || decoded.storeId,
              storeId: decoded.store_id || decoded.storeId,
              roles: decoded.systemRoles || ['admin'],
              permissions: ['*'], // Wildcard permission for development
              isDevelopmentUser: false
            };
            debugLog('Extracted real user from JWT in development mode:', req.user.id);
          } catch (err) {
            console.error('JWT verification failed in development mode:', err.message);
            return res.status(401).json({ message: 'Invalid or expired token' });
          }
        } else {
          return res.status(401).json({ message: 'Authentication token required' });
        }
        
        return next();
      }
      
      // Normal permission check flow for production
      // Extract user from token
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      let decoded;
      try {
        decoded = jwt.verify(token, JWT_SECRET);
      } catch (err) {
        console.error('Token verification error:', err.message);
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
      
      const userId = decoded.id;
      if (!userId) {
        return res.status(401).json({ message: 'Invalid token - missing user ID' });
      }
      
      // Extract tenant and store context
      let tenantId = req.params?.tenantId || 
                   req.query?.tenantId || 
                   req.body?.tenantId ||
                   decoded.tenant_id || 
                   decoded.tenantId;
      
      // For system-level permissions, we don't need a specific tenant
      const isSystemPermission = isSystemPermissionName(requiredPermission);
      
      // For tenant-level permissions, tenant ID is required
      if (!isSystemPermission && !tenantId) {
        return res.status(400).json({ message: 'Tenant ID is required for this operation' });
      }
      
      // Extract store context if available
      // Store context is critical for store-scoped permissions
      const storeId = req.params?.storeId || 
                    req.query?.storeId || 
                    req.body?.storeId || 
                    req.headers['x-store-id'] || 
                    req.headers['store-id'] || 
                    decoded.store_id || 
                    decoded.storeId;
                    
      // Log store context extraction for debugging
      if (process.env.NODE_ENV === 'development') {
        debugLog(`RBAC MIDDLEWARE: Store context extraction for "${requiredPermission}"`);
        debugLog(`  Headers store-id: ${req.headers['store-id'] || 'not set'}`);
        debugLog(`  Query storeId: ${req.query?.storeId || 'not set'}`);
        debugLog(`  Body storeId: ${req.body?.storeId || 'not set'}`);
        debugLog(`  Token store_id: ${decoded.store_id || 'not set'}`);
        debugLog(`  Resolved storeId: ${storeId || 'not set'}`);
      }
      
      // First check if user is tenant admin (admins bypass permission checks)
      if (!isSystemPermission && !options.skipAdminBypass && tenantId) {
        const isAdmin = await rbacService.isTenantAdmin(userId, tenantId);
        if (isAdmin) {
          // Tenant admins bypass permission checks
          req.user = {
            id: userId,
            tenant_id: tenantId,
            tenantId,
            store_id: storeId,
            storeId,
            isAdmin: true
          };
          return next();
        }
      }
      
      // Check permission
      const hasPermission = await checkUserPermission(
        userId, 
        requiredPermission, 
        tenantId, 
        storeId, 
        decoded // Pass decoded token for optimization
      );
      
      if (!hasPermission) {
        return res.status(403).json({ 
          message: `Access denied. Required permission: ${requiredPermission}` 
        });
      }
      
      // Permission granted
      // Set user context for downstream middleware/routes
      // Include store information and context for consistent access
      req.user = {
        id: userId,
        tenant_id: tenantId,
        tenantId,
        store_id: storeId,
        storeId,
        // RBAC data - from token
        roles: decoded.roles || [],
        permissions: decoded.permissions || [],
        // Add contextual metadata for route handlers
        context: {
          // Store the permission that was checked to reach this route
          checkedPermission: requiredPermission,
          // Whether the permission is specific to a store
          hasStoreContext: !!storeId,
          // Permission check timestamp
          permissionCheckedAt: new Date().toISOString()
        }
      };
      
      // Log successful permission check with context
      if (process.env.NODE_ENV === 'development') {
        debugLog(`RBAC MIDDLEWARE: Permission "${requiredPermission}" granted for user ${userId}`);
        if (storeId) {
          debugLog(`  With store context: ${storeId}`);
        }
      }
      
      return next();
    } catch (error) {
      console.error('RBAC permission middleware error:', error.message);
      res.status(500).json({ message: 'Internal server error during permission check' });
    }
  };
};

/**
 * Create permission-bypass middleware for development purposes only
 * 
 * @returns {Function} Express middleware function
 */
const bypassPermissions = () => {
  return (req, res, next) => {
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({ message: 'Not allowed in production' });
    }
    
    debugLog('⚠️ WARNING: Bypassing all permissions checks - FOR DEVELOPMENT ONLY ⚠️');
    
    // Set a default user with admin permissions
    req.user = {
      id: 'dev-user',
      name: 'Development User',
      email: 'dev@example.com',
      tenant_id: req.query.tenantId || req.params.tenantId || 'dev-tenant',
      tenantId: req.query.tenantId || req.params.tenantId || 'dev-tenant',
      store_id: req.query.storeId || req.params.storeId || null,
      storeId: req.query.storeId || req.params.storeId || null,
      isAdmin: true,
      roles: ['tenant_admin'],
      permissions: ['*'] // Wildcard permission
    };
    
    next();
  };
};

// Export middleware functions
module.exports = {
  requirePermission,
  bypassPermissions,
  checkUserPermission,
  checkSystemPermission,
  isSystemPermissionName
  // isTenantAdmin function moved to rbacService.js
};
