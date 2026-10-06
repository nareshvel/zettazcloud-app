const { verifyToken } = require('../utils/jwt');
const db = require('../db');
const permissionService = require('../services/permissionService');
const subscriptionService = require('../services/subscriptionService');
const roleService = require('../services/roleService');

/**
 * Define permissions constants for the application
 * These are used to check if a user has permission to perform an action
 */
const PERMISSIONS = {
  // Legacy permissions for backward compatibility
  GRN: {
    CREATE: 'grn.create',
    READ: 'grn.view', // Updated from grn:read to grn.view for consistency
    UPDATE: 'grn.update',
    DELETE: 'grn.delete',
    UPDATE_STATUS: 'grn.update_status'
  },
  INVENTORY: {
    READ: 'inventory:read',
    UPDATE: 'inventory:update'
  },
  PURCHASE_ORDER: {
    CREATE: 'purchase_order:create',
    READ: 'purchase_order:read',
    UPDATE: 'purchase_order:update',
    DELETE: 'purchase_order:delete'
  },
  
  // System permissions
  SYSTEM: {
    PLATFORM: {
      VIEW: 'platform.view',
      MANAGE: 'platform.manage'
    },
    TENANTS: {
      VIEW: 'tenants.view',
      CREATE: 'tenants.create',
      EDIT: 'tenants.edit',
      DELETE: 'tenants.delete'
    },
    SUBSCRIPTIONS: {
      VIEW: 'subscriptions.view',
      CREATE: 'subscriptions.create',
      EDIT: 'subscriptions.edit',
      DELETE: 'subscriptions.delete'
    },
    PLANS: {
      VIEW: 'plans.view',
      CREATE: 'plans.create',
      EDIT: 'plans.edit',
      DELETE: 'plans.delete'
    },
    SUPPORT: {
      VIEW: 'support.view',
      RESPOND: 'support.respond',
      ESCALATE: 'support.escalate',
      CLOSE: 'support.close'
    },
    SYSTEM: {
      LOGS_VIEW: 'system.logs.view',
      SETTINGS_VIEW: 'system.settings.view',
      SETTINGS_EDIT: 'system.settings.edit',
      MAINTENANCE: 'system.maintenance',
      ROLES_MANAGE: 'system.roles.manage'
    }
  },
  
  // Tenant permissions
  TENANT: {
    USER: {
      CREATE: 'users.create',
      READ: 'users.read',
      UPDATE: 'users.edit',
      DELETE: 'users.delete'
    },
    DASHBOARD: {
      VIEW: 'dashboard.view'
    },
    REPORTS: {
      VIEW: 'reports.view',
      EXPORT: 'reports.export'
    },
    PRODUCTS: {
      VIEW: 'products.view',
      CREATE: 'products.create',
      EDIT: 'products.edit',
      DELETE: 'products.delete',
      IMPORT: 'products.import',
      EXPORT: 'products.export'
    },
    CATEGORIES: {
      VIEW: 'categories.view',
      CREATE: 'categories.create',
      EDIT: 'categories.edit',
      DELETE: 'categories.delete'
    },
    INVENTORY: {
      VIEW: 'inventory.view',
      ADJUST: 'inventory.adjust',
      TRANSFER: 'inventory.transfer',
      HISTORY: 'inventory.history'
    },
    SALES: {
      VIEW: 'sales.view',
      CREATE: 'sales.create',
      VOID: 'sales.void',
      REFUND: 'sales.refund',
      DISCOUNT: 'sales.discount'
    },
    CUSTOMERS: {
      VIEW: 'customers.view',
      CREATE: 'customers.create',
      EDIT: 'customers.edit',
      DELETE: 'customers.delete'
    },
    STORES: {
      VIEW: 'stores.view',
      CREATE: 'stores.create',
      EDIT: 'stores.edit',
      DELETE: 'stores.delete'
    },
    USERS: {
      VIEW: 'users.view',
      CREATE: 'users.create',
      EDIT: 'users.edit',
      DELETE: 'users.delete'
    },
    ROLES: {
      VIEW: 'roles.view',
      CREATE: 'roles.create',
      EDIT: 'roles.edit',
      DELETE: 'roles.delete'
    },
    SETTINGS: {
      VIEW: 'settings.view',
      EDIT: 'settings.edit'
    },
    SUBSCRIPTION: {
      VIEW: 'tenant.subscription.view',
      UPGRADE: 'tenant.subscription.upgrade'
    }
  }
};

/**
 * Middleware to check if the user has the required permission to perform an action
 * @param {string} requiredPermission - The permission required to access the route
 * @returns {function} Middleware function
 */
/**
 * Middleware to check if the user has the required permission to perform an action
 * Supports both system-level and tenant-level permissions
 * @param {string} requiredPermission - The permission required to access the route
 * @param {Object} options - Additional options
 * @param {boolean} options.requireActiveSubscription - Whether to require an active subscription
 * @param {string} options.requiredFeature - Feature that must be available in the subscription
 * @param {boolean} options.skipAdminBypass - If true, even tenant admins need the specific permission
 * @returns {function} Middleware function
 */
const hasPermission = (requiredPermission, options = {}) => {
  return async (req, res, next) => {
    try {
      // CRITICAL FIX: Extract tenant ID from headers if not in req.user
      if (!req.user || (!req.user.tenant_id && !req.user.tenantId)) {
        // Try all possible sources
        let extractedTenantId = null;
        
        // Express recommended way
        if (req.header('tenant-id')) {
          extractedTenantId = req.header('tenant-id');
        }
        // Direct object access
        else if (req.headers['tenant-id']) {
          extractedTenantId = req.headers['tenant-id'];
        }
        // Alternate formats
        else if (req.headers['tenantid']) {
          extractedTenantId = req.headers['tenantid'];
        }
        // Additional formats
        else if (req.headers['x-tenant-id']) {
          extractedTenantId = req.headers['x-tenant-id'];
        }
        else if (req.headers['tenant_id']) {
          extractedTenantId = req.headers['tenant_id'];
        }
        
        // If found in headers, add it to req.user
        if (extractedTenantId) {
          if (!req.user) req.user = {};
          req.user.tenant_id = extractedTenantId;
          req.user.tenantId = extractedTenantId;
        }
      }
      // Only log if no tenant ID found after extraction attempts
      if (!req.user || (!req.user.tenant_id && !req.user.tenantId)) {
        console.warn('PERMISSION MIDDLEWARE: WARNING - No tenant ID found for permission check');
      }
      
      // For development, temporarily skip permission checks
      // TODO: Remove this in production
      if (process.env.NODE_ENV === 'development' && process.env.SKIP_PERMISSION_CHECKS === 'true') {
        console.log('PERMISSION MIDDLEWARE: Skipping permission checks in development mode');
        return next();
      }
      
      // Check for token in Authorization header
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ message: 'Authentication required. No token provided.' });
      }

      // Verify the token
      const decoded = verifyToken(token);
      if (!decoded) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
      }

      // Add user ID to the request object (the JWT token uses 'id' not 'userId')
      req.userId = decoded.id || decoded.userId; // Handle both formats for backward compatibility
      
      // For system-level permissions, we don't need a tenant
      const isSystemPermission = requiredPermission && requiredPermission.startsWith('platform.') || 
                                 requiredPermission.startsWith('tenants.') ||
                                 requiredPermission.startsWith('subscriptions.') ||
                                 requiredPermission.startsWith('plans.') ||
                                 requiredPermission.startsWith('support.') ||
                                 requiredPermission.startsWith('system.');
                                 
      // For tenant-level permissions, get tenant_id from request or token
      let tenantId = null;
      
      if (!isSystemPermission) {
        // Get tenant_id from path params, query params, body, or token
        // CRITICAL FIX: Check both snake_case and camelCase versions from decoded token
        tenantId = req.params?.tenantId || req.query?.tenantId || req.body?.tenantId || 
                 req.user?.tenant_id || req.user?.tenantId || 
                 decoded.tenant_id || decoded.tenantId;
                 
          if (!tenantId) {
          console.warn('PERMISSION MIDDLEWARE: Failed to extract tenant ID from all sources');
          return res.status(400).json({ 
            message: 'Tenant ID is required for tenant-level operations.',
            debug: {
              attempted_sources: ['req.params', 'req.query', 'req.body', 'req.user', 'decoded token'],
              token_keys: Object.keys(decoded),
              has_snake_case: !!decoded.tenant_id,
              has_camel_case: !!decoded.tenantId
            }
          });
        }
        
        // Set tenant_id on the request
        req.tenantId = tenantId;
        
        // For store-specific operations, get store_id
        const storeId = req.params?.storeId || req.query?.storeId || req.body?.storeId || decoded.storeId;
        if (storeId) {
          req.storeId = storeId;
        }
        
        // Check subscription status if required
        if (options.requireActiveSubscription || options.requiredFeature) {
          const subscription = await subscriptionService.getTenantSubscription(tenantId, { includePlan: true });
          
          // Check for active subscription
          if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trial')) {
            return res.status(402).json({ 
              message: 'This action requires an active subscription. Please upgrade your subscription.',
              subscriptionStatus: subscription ? subscription.status : 'none'
            });
          }
          
          // Add subscription to request for later use
          req.subscription = subscription;
          
          // Check for specific feature if required
          if (options.requiredFeature && subscription.plan) {
            const hasFeature = subscription.plan.features && 
                               subscription.plan.features[options.requiredFeature] === true;
                               
            if (!hasFeature) {
              return res.status(402).json({ 
                message: `This action requires the ${options.requiredFeature} feature. Please upgrade your plan.`,
                currentPlan: subscription.plan.name,
                requiredFeature: options.requiredFeature
              });
            }
          }
        }
      }
      
      // Check permission based on system or tenant level
      let hasRequiredPermission = false;
      
      if (requiredPermission) {
        if (isSystemPermission) {
          // Check system-level permission
          // Ensure we have tenant_id for permission check
          const tenantIdForCheck = tenantId || req.user.tenant_id || req.user.tenantId;
          
          if (!tenantIdForCheck) {
            console.log('PERMISSION MIDDLEWARE: Cannot check permissions without tenant ID');
            return res.status(400).json({ 
              error: 'Tenant ID is required for permission checks', 
              message: 'Please ensure your JWT token or headers contain tenant_id',
              debug: {
                user_id: req.user?.id,
                headers_keys: Object.keys(req.headers)
              }
            });
          }
          
          // Make sure we're using the correct user ID from either req.userId or req.user.id
          const userIdForPermissionCheck = req.userId || req.user?.id;
          
          // Check permission for user and tenant
          
          if (!userIdForPermissionCheck) {
            console.error('CRITICAL ERROR: No user ID available for permission check!');
            return res.status(500).json({ error: 'Internal server error - missing user ID for permission check' });
          }
          
          const permissions = await roleService.getUserPermissions(userIdForPermissionCheck, tenantIdForCheck);

          // If permissions are empty or don't include the required permission
          if (!permissions || !permissions.includes(requiredPermission)) {
            const errorMessage = `Access denied. Required permission: ${requiredPermission}`;
            console.log(`PERMISSION ERROR: ${errorMessage}`, { userId: req.user.id, tenantId: tenantIdForCheck, userPermissions: permissions });
            return res.status(403).json({ error: errorMessage });
          }
          
          // At this point, we have confirmed the user has the required permission
        } else {
          // Check tenant-level permission
          
          // OPTIMIZATION: Check if user is a tenant admin first (they bypass regular permission checks)
          // Skip admin bypass if explicitly requested in options
          if (!options.skipAdminBypass) {
            const userIdForCheck = req.userId || req.user?.id;
            const isTenantAdmin = await checkUserIsTenantAdmin(userIdForCheck, tenantId);
            
            if (isTenantAdmin) {
              hasRequiredPermission = true;
              // Skip the regular permission check
              return next();
            }
          }
          
          // Use req.userId which we set from the token's id field
          // Pass the entire req object to allow JWT role check
          hasRequiredPermission = await permissionService.hasPermission(
            req.userId, 
            requiredPermission, 
            tenantId, 
            req.storeId,
            req  // Pass the request object for JWT token role checking
          );
        }
        
        if (!hasRequiredPermission) {
          return res.status(403).json({ 
            message: `Access denied. You don't have the required permission: ${requiredPermission}` 
          });
        }
      }

      // Permission granted, proceed to the next middleware or route handler
      // Important: Ensure tenant_id is still set on req.user before passing to route handler
      const finalTenantId = tenantId || req.user?.tenant_id || req.user?.tenantId;
      if (finalTenantId && req.user) {
        req.user.tenant_id = finalTenantId;
        req.user.tenantId = finalTenantId;
      }
      return next();
    } catch (error) {
      console.error('Permission middleware error:', error.message, error.stack);
      return res.status(500).json({ error: 'Internal server error during permission check' });
    }
  };
};

/**
 * Helper function to get the current user ID from the request
 * Can be used in controllers to get the authenticated user ID
 * @param {Object} req - Express request object
 * @returns {string|null} User ID or null if not authenticated
 */
const getUserId = (req) => {
  // Extract user ID from JWT token payload
  if (req.user && req.user.id) {
    console.log(`[getUserId] Extracted user ID from JWT: ${req.user.id}`);
    return req.user.id;
  }
  
  console.warn('[getUserId] No user ID found in request - user not authenticated');
  return null;
};



/**
 * Check if a user is a tenant admin
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<boolean>} True if user is tenant admin
 */
const checkUserIsTenantAdmin = async (userId, tenantId) => {
  try {
    if (!userId || !tenantId) {
      console.warn('Cannot check tenant admin status without userId and tenantId');
      return false;
    }
    
    // Query to check if user has Tenant Admin role
    const query = `
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
        AND r.tenant_id = ?
        AND r.name = 'Tenant Admin'
        AND ur.scope = 'tenant'
      LIMIT 1
    `;
    
    const [result] = await db.query(query, [userId, tenantId]);
    return Array.isArray(result) && result.length > 0;
  } catch (error) {
    console.error('Error checking if user is tenant admin:', error);
    return false; // Fail safe: if we can't check, assume not admin
  }
};

module.exports = {
  hasPermission,
  getUserId,
  checkUserIsTenantAdmin,
  PERMISSIONS
};
