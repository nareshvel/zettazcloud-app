/**
 * Unified Authentication Middleware
 * Handles user authentication, authorization, and token management
 * 
 * This middleware now uses the RBAC system for role and permission management.
 * The legacy role column is in the process of being deprecated.
 */
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const rbacService = require('../services/rbacService');
const userSessionService = require('../services/userSessionService');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants'); // Import centralized JWT constants

// Throttle window for user_sessions.last_active_at writes (avoid a write on
// every single authenticated request).
const SESSION_ACTIVITY_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes

// JWT_SECRET and JWT_EXPIRES_IN are now imported from config/constants.js

// Determine if we're in development mode
const isDevelopmentMode = process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_HEADER_AUTH === 'true';

// Verbose per-request auth debug logging - opt-in only, disabled by default to avoid log noise
const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true' || process.env.DEBUG === 'true';
const DEBUG_API = process.env.DEBUG_API === 'true' || process.env.DEBUG === 'true';

/**
 * Helper function to create a development user based on headers (for testing)
 */
const tryCreateDevelopmentUser = (req) => {
  // Only in development mode
  if (!isDevelopmentMode) return false;
  
  // Try multiple header formats for tenant ID
  const tenantId = req.headers['tenant-id'] || 
                  req.headers['tenantid'] || 
                  req.headers['x-tenant-id'] || 
                  req.headers['tenant_id'] || 
                  req.query.tenantId || 
                  req.query.tenant_id;
  
  // Try multiple header formats for store ID
  const storeId = req.headers['store-id'] || 
                 req.headers['storeid'] || 
                 req.headers['x-store-id'] || 
                 req.headers['store_id'] || 
                 req.query.storeId || 
                 req.query.store_id;
  
  if (tenantId) {
    if (DEBUG_AUTH) console.log('DEV MODE: Using tenant-id from headers/query:', tenantId);
    
    // Generate a consistent dev user ID based on tenant ID
    const devUserId = `dev-${tenantId.substring(0, 8)}`;
    
    // Set minimal user information for development
    req.user = {
      id: devUserId,
      tenant_id: tenantId,
      tenantId: tenantId,
      store_id: storeId,
      storeId: storeId,
      email: `dev-user@${tenantId.substring(0, 6)}.com`,
      name: 'Development User',
      role: 'admin', // Legacy role field
      systemRoles: ['admin'], // Give admin role for testing
      permissions: ['*'], // All permissions
      isDevelopmentFallback: true, // Mark as development fallback
      devMode: true
    };
    
    if (DEBUG_AUTH) console.log('DEV MODE: Created fallback user context:', req.user);
    return true;
  }
  
  return false;
};

/**
 * Verify JWT token
 * @param {String} token - JWT token
 * @returns {Object|null} Decoded token or null if invalid
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Token verification error:', error.message);
    return null;
  }
};

/**
 * Main authentication middleware
 * Verifies JWT token and adds user info to req.user
 */
const authenticate = async (req, res, next) => {
  try {
    // Check for Authorization header
    const authHeader = req.headers.authorization;
    
    // In development mode, try to create a development user if no auth header
    if (!authHeader && isDevelopmentMode) {
      if (tryCreateDevelopmentUser(req)) {
        return next();
      }
      // If we couldn't create a dev user, continue to regular auth flow
    }

    // Standard token-based authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      if (!JWT_SECRET) {
        if (process.env.NODE_ENV === 'development' && process.env.DEBUG === 'auth') {
          console.log('Auth Middleware: JWT_SECRET is undefined. Cannot verify token.');
        }
        return res.status(500).json({ error: 'Server configuration error: JWT secret not set.' });
      }

      try {
        // Verify the token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Debug log the JWT contents in development
        if (isDevelopmentMode && process.env.DEBUG === 'auth') {
          console.log('JWT TOKEN CONTENTS (VERIFIED):', {
            id: decoded.id || decoded.userId,
            tenant_id: decoded.tenant_id || decoded.tenantId,
            store_id: decoded.store_id || decoded.storeId,
            raw_tenant_id: decoded.tenant_id,
            raw_tenantId: decoded.tenantId, 
            raw_store_id: decoded.store_id,
            raw_storeId: decoded.storeId,
          });
        }
  
        // Extract values with fallbacks
        const tokenTenantId = decoded.tenant_id || decoded.tenantId;
        const tokenStoreId = decoded.store_id || decoded.storeId;
        const userId = decoded.id || decoded.userId;

        // Set user details from token
        req.user = {
          id: userId,
          tenant_id: tokenTenantId, // snake_case style
          tenantId: tokenTenantId,  // camelCase style
          store_id: tokenStoreId,   // snake_case style 
          storeId: tokenStoreId,    // camelCase style
          email: decoded.email,
          name: decoded.name,
          role: decoded.role,       // Legacy role field - will be deprecated
          // RBAC data
          roles: decoded.roles || [],
          permissions: decoded.permissions || []
        };
        
        // For backward compatibility
        req.user.systemRoles = req.user.roles;

        // -------------------------------------------------------------------
        // Session revocation check (sid claim).
        //
        // CRITICAL / fail-open: tokens issued BEFORE this feature shipped have
        // no `sid` claim at all (decoded.sid === undefined). Those must be let
        // through exactly as before — the whole point of `sid` is to allow
        // revoking sessions created going forward, not to invalidate every
        // pre-existing token on deploy. Mirrors the fail-open philosophy
        // already used by requireActiveSubscription() for tenants with zero
        // `subscriptions` rows (see CLAUDE.md). Only a token that HAS a `sid`
        // and whose session is missing/revoked gets rejected.
        // -------------------------------------------------------------------
        const sid = decoded.sid;
        if (sid) {
          try {
            const [sessionRows] = await pool.query(
              'SELECT id, revoked_at, last_active_at FROM user_sessions WHERE id = ?',
              [sid]
            );
            const session = sessionRows && sessionRows[0];

            if (!session || session.revoked_at) {
              return res.status(401).json({ error: 'Session has been revoked. Please log in again.' });
            }

            req.user.sid = sid;

            // Throttled last_active_at update — only write if stale by more
            // than SESSION_ACTIVITY_THROTTLE_MS, to avoid a write on every request.
            const lastActive = session.last_active_at ? new Date(session.last_active_at).getTime() : 0;
            if (Date.now() - lastActive > SESSION_ACTIVITY_THROTTLE_MS) {
              pool.query('UPDATE user_sessions SET last_active_at = NOW() WHERE id = ?', [sid])
                .catch((e) => console.error('[AUTH] Failed to update session last_active_at:', e.message));
            }
          } catch (sessionErr) {
            // A DB error while checking session validity must NOT lock every
            // user out — fail open here too, consistent with the rest of this
            // block. Log loudly so it's visible in ops.
            console.error('[AUTH] Error checking user_sessions row (failing open):', sessionErr.message);
          }
        }

        // If we have a user ID, try to get fresh user data from database
        if (userId) {
          try {
            const sqlQuery = 'SELECT id, name, email, tenant_id, store_id FROM users WHERE id = ?';
            const [dbUser] = await pool.query(sqlQuery, [userId]);

            if (dbUser && dbUser.length > 0) {
              const userRecord = dbUser[0];
              // Update user info with fresh data from database
              req.user.name = userRecord.name;
              req.user.email = userRecord.email;
              
              // Special handling for missing store_id
              if (!req.user.store_id && !req.user.storeId) {
                console.warn(`Warning: User ${userId} in tenant ${req.user.tenant_id} has no store_id after database lookup.`);
                
                // For development, provide a default store ID
                if (process.env.NODE_ENV === 'development') {
                  // Look up the first available store for this tenant
                  try {
                    const [storeResults] = await pool.query('SELECT id FROM stores WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1', [req.user.tenant_id]);
                    
                    if (storeResults && storeResults.length > 0) {
                      const defaultStoreId = storeResults[0].id;
                      console.log(`Development mode: Assigning default store ID ${defaultStoreId} to user ${userId}`);
                      req.user.store_id = defaultStoreId;
                      req.user.storeId = defaultStoreId;
                    } else {
                      // Create a default store for the tenant if none exists
                      if (process.env.DEBUG === 'auth') {
                        console.log(`Development mode: Creating default store for tenant ${req.user.tenant_id}`);
                      }
                      const defaultStoreId = uuidv4(); 
                      await pool.query(
                        'INSERT INTO stores (id, tenant_id, name, location, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
                        [defaultStoreId, req.user.tenant_id, 'Default Store', 'Default Location']
                      );
                      req.user.store_id = defaultStoreId;
                      req.user.storeId = defaultStoreId;
                    }
                  } catch (err) {
                    if (process.env.DEBUG === 'auth') {
                      console.error('Error creating default store:', err);
                    }
                    if (process.env.DEBUG === 'auth') {
                      console.warn('API calls requiring store context will fail without a store ID.');
                    }
                  }
                } else {
                  if (process.env.DEBUG === 'auth') {
                    console.warn('This will cause API calls requiring store context to fail.');
                  }
                }
              }
            }
          } catch (dbError) {
            if (process.env.DEBUG === 'auth') {
              console.error('Error fetching user data from database:', dbError);
            }
            // Continue with token data if DB fetch fails
          }
        }

        next();
      } catch (jwtError) {
        if (process.env.DEBUG === 'auth') {
          console.error(`Token verification failed: ${jwtError.message}`);
        }
        
        // In development mode, fallback to header-based auth for testing
        if (isDevelopmentMode && tryCreateDevelopmentUser(req)) {
          return next();
        }
        
        // Handle specific token errors
        if (jwtError.name === 'TokenExpiredError') {
          return res.status(401).json({ error: 'Session expired. Please log in again.' });
        } else {
          return res.status(401).json({ error: `Invalid token: ${jwtError.message}` });
        }
      }
    } else {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'An error occurred during authentication.' });
  }
};

/**
 * Role-based authorization middleware
 * Checks if user has any of the required roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    
    // Tenant Admin always has access to all features regardless of specific permissions
    const isTenantAdmin = req.user.role === 'Tenant Admin' || 
                         req.user.role === 'tenant_admin' ||
                         (req.user.systemRoles && req.user.systemRoles.includes('Tenant Admin')) ||
                         (req.user.tenantRoles && req.user.tenantRoles.includes('Tenant Admin')) ||
                         (req.user.roles && req.user.roles.includes('Tenant Admin'));
    
    if (isTenantAdmin) {
      return next();
    }
    
    // Check legacy role field first
    if (roles.includes(req.user.role)) {
      return next();
    }
    
    // Check system roles array if available
    if (req.user.systemRoles && req.user.systemRoles.some(role => roles.includes(role))) {
      return next();
    }
    
    // Check tenant roles if in tenant context
    if (req.user.tenantRoles && req.user.tenantRoles.some(role => roles.includes(role))) {
      return next();
    }
    
    return res.status(403).json({ error: 'You do not have permission to perform this action.' });
  };
};

/**
 * Require tenant ID middleware
 * Extracts and validates tenant ID from various sources
 */
const requireTenantId = (req, res, next) => {
  // ---------------------------------------------------------------------------
  // SECURITY: tenant identity is derived from the verified JWT ONLY.
  //
  // This middleware previously fell back to `tenant-id` / `x-tenant-id` headers
  // and `?tenantId=` query params. Any of those are attacker-controlled, so on a
  // route where `authenticate` had not run (or had run permissively) a caller
  // could assume any tenant simply by setting a header. Tenant isolation is the
  // core security boundary of a multi-tenant product, so we fail closed.
  //
  // If a route legitimately needs to operate across tenants (platform admin
  // tooling), it must use an explicit, separately-authorised middleware — not
  // this one.
  // ---------------------------------------------------------------------------
  const tenantId = req.user?.tenant_id || req.user?.tenantId;

  if (!tenantId) {
    // Surface when a client *tried* to supply tenant context out-of-band; that is
    // either a stale caller to migrate, or a probe worth knowing about.
    const attemptedOutOfBand = Boolean(
      req.headers['tenant-id'] || req.headers['tenantid'] || req.headers['x-tenant-id'] ||
      req.query.tenantId || req.query.tenant_id
    );

    console.warn('[AUTH] Missing tenant context on authenticated request:', {
      path: req.path,
      method: req.method,
      hasUser: Boolean(req.user),
      attemptedOutOfBandTenantId: attemptedOutOfBand,
    });

    return res.status(401).json({
      error: 'Authentication required. Tenant context must come from a valid session.',
    });
  }

  // Store in consistent locations for downstream handlers.
  req.tenantId = tenantId;
  req.user.tenant_id = tenantId;
  req.user.tenantId = tenantId;

  if (DEBUG_AUTH) console.log('[AUTH] Tenant context resolved from JWT:', tenantId);

  next();
};

/**
 * Require store ID middleware
 * Extracts and validates store ID from various sources
 */
const requireStoreId = (req, res, next) => {
  // Extract store ID from multiple sources (header, user object, query)
  const storeId = req.user?.store_id || req.user?.storeId || 
                 req.headers['store-id'] || req.headers['storeid'] || req.headers['x-store-id'] ||
                 req.query.storeId || req.query.store_id;
  
  if (!storeId) {
    console.warn('Missing store ID in request:', {
      path: req.path,
      method: req.method,
      headers: { 
        'store-id': req.headers['store-id'],
        'storeid': req.headers['storeid'],
        'x-store-id': req.headers['x-store-id']
      },
      query: {
        storeId: req.query.storeId,
        store_id: req.query.store_id
      },
      user: req.user ? {
        store_id: req.user.store_id,
        storeId: req.user.storeId,
        // Also log the token contents for debugging
        token_tenant_id: req.user.tenant_id,
        token_store_id: req.user.store_id
      } : 'No user'
    });
    return res.status(400).json({
      error: 'Store ID is required.', 
      details: 'No store ID found in token, headers or query parameters. Please ensure a store is selected.'
    });
  }
  
  // Store in consistent locations
  req.storeId = storeId;
  req.user = req.user || {};
  req.user.store_id = storeId;
  req.user.storeId = storeId;
  
  // Debug log
  if (DEBUG_AUTH) console.log('Added store-id header:', storeId);
  
  next();
};

/**
 * Login user and return JWT token
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Please provide email and password.' });
    }
    
    // Find user by email
    // Explicitly query the `users` table to avoid ambiguity with backup tables
    const [users] = await pool.query('SELECT * FROM `users` WHERE email = ?', [email]);
    
    // Check if user exists
    if (!users || users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    
    const user = users[0];
    
    // Check if password matches
    // Handle both password and password_hash fields for backward compatibility
    const passwordField = user.password_hash || user.password;
    const isPasswordValid = await bcrypt.compare(password, passwordField);
    
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    
    // Check if user is active
    if (user.status && user.status !== 'active') {
      return res.status(401).json({ error: 'Your account is not active.' });
    }

    // Check if email has been verified — signup creates the user row with
    // email_verified = FALSE and a verification token; until the user clicks
    // the link, they must not be able to log in. The frontend reads
    // `emailVerified: false` and redirects to /verify-email instead of
    // showing a generic error (see Login.tsx).
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email address before logging in. Check your inbox for the verification link.',
        emailVerified: false,
        email: user.email
      });
    }

    // -------------------------------------------------------------------
    // TOTP two-factor auth gate — if this user has 2FA enabled, do NOT
    // issue a real (full-access) JWT yet. Issue a short-lived "pending 2FA"
    // token instead and require POST /api/auth/2fa/verify with a TOTP or
    // backup code before a real session/JWT is created. Response shape is
    // deliberately distinct from the normal success shape ({ user, token })
    // so the frontend can branch on `requiresTwoFactor` without ambiguity.
    // Users WITHOUT 2fa enabled are completely unaffected by this block.
    // -------------------------------------------------------------------
    if (user.totp_enabled) {
      const pendingToken = jwt.sign(
        { id: user.id, email: user.email, pending2fa: true },
        JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({ requiresTwoFactor: true, pendingToken });
    }

    // Extract tenant ID from request if available
    let tenantId = req.body.tenantId || req.query.tenantId || user.tenant_id;
    
    // Initialize store ID from request or user data
    let storeId = req.body.storeId || req.query.storeId || user.store_id;
    
    // Initialize rbacData with default values to prevent ReferenceError
    let rbacData = { 
      roles: [], 
      roleNames: [], 
      permissions: [],
      systemRoles: []
    };
    
    try {
      // First try to get roles for the specific tenant
      const rbacResult = await rbacService.getUserRolesAndPermissions(
        user.id, 
        tenantId || null, 
        storeId || null
      );
      
      // Safely merge the result with our defaults
      if (rbacResult) {
        rbacData = {
          roles: Array.isArray(rbacResult.roles) ? rbacResult.roles : [],
          roleNames: Array.isArray(rbacResult.roleNames) ? rbacResult.roleNames : [],
          permissions: Array.isArray(rbacResult.permissions) ? rbacResult.permissions : [],
          systemRoles: Array.isArray(rbacResult.systemRoles) ? rbacResult.systemRoles : []
        };
      }
      
      if (DEBUG_API) console.log(`[RBAC] Loaded RBAC data for user ${user.id}:`, {
        roles: rbacData.roles.length,
        roleNames: rbacData.roleNames.length,
        permissions: rbacData.permissions.length,
        systemRoles: rbacData.systemRoles.length
      });
      
      // If store ID is still not set, try to resolve it based on user permissions
      if (!storeId && tenantId) {
        try {
          // Check if user has any store-level permissions
          const hasStoreLevelPermission = rbacData.permissions.some(perm => 
            perm.includes('store.') || perm.includes('sales.') || perm.includes('inventory.')
          );
          
          if (hasStoreLevelPermission) {
            // Try to get default store for the tenant
            // Using only existing columns from stores table
            const [stores] = await pool.query(
              'SELECT id FROM stores WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1',
              [tenantId]
            );
            
            if (stores && stores.length > 0) {
              storeId = stores[0].id;
              console.log(`[LOGIN] Resolved default store ID ${storeId} for user ${user.id} with store-level permissions`);
            } else {
              console.warn(`[LOGIN] No active stores found for tenant ${tenantId}, user ${user.id} may experience limited functionality`);
            }
          }
        } catch (storeError) {
          console.error('[LOGIN] Error resolving store ID:', storeError);
        }
      }
    } catch (rbacError) {
      console.error('[LOGIN] Error getting RBAC data:', rbacError);
      // Continue with empty RBAC data rather than failing the login
    }
    
    if (DEBUG_API) console.log('Debug - Login context:', { 
      userId: user.id, 
      email: user.email,
      tenantId,
      storeId,
      userTenantId: user.tenant_id,
      bodyTenantId: req.body.tenantId,
      queryTenantId: req.query.tenantId
    });
    
    // Ensure we have valid arrays with proper type checking
    const safeRbacData = {
      roles: Array.isArray(rbacData.roles) ? rbacData.roles : [],
      roleNames: Array.isArray(rbacData.roleNames) ? rbacData.roleNames : [],
      permissions: Array.isArray(rbacData.permissions) ? rbacData.permissions : [],
      systemRoles: Array.isArray(rbacData.systemRoles) ? rbacData.systemRoles : []
    };
    
    // Use the validated data
    rbacData = safeRbacData;
    
    if (DEBUG_API) console.log(`[RBAC] Validated RBAC data for user ${user.id}:`, {
      roles: rbacData.roles.length,
      roleNames: rbacData.roleNames.length,
      permissions: rbacData.permissions.length,
      systemRoles: rbacData.systemRoles.length
    });
    
    // If no roles/permissions were found, try to assign default ones based on user type
    if (rbacData.roleNames.length === 0 && rbacData.permissions.length === 0) {
      console.log(`[RBAC] No RBAC data found for user ${user.id}, checking for legacy role or assigning defaults`);
      
      // Assign default roles/permissions based on user's legacy role (if it exists)
      if (user.role) {
        switch(user.role.toLowerCase()) {
          case 'admin':
            rbacData.roleNames = ['admin'];
            rbacData.permissions = ['*'];
            break;
          case 'manager':
            rbacData.roleNames = ['store_manager'];
            rbacData.permissions = [
              'dashboard.view',
              'reports.view',
              'products.view',
              'products.edit',
              'inventory.view',
              'inventory.edit',
              'sales.view',
              'sales.create',
              'customers.view',
              'customers.edit'
            ];
            break;
          case 'cashier':
            rbacData.roleNames = ['cashier'];
            rbacData.permissions = [
              'sales.view',
              'sales.create',
              'customers.view'
            ];
            break;
          default:
            // Basic permissions for all authenticated users
            rbacData.roleNames = ['user'];
            rbacData.permissions = ['dashboard.view'];
        }
        
        console.log(`[RBAC] Assigned default permissions for user ${user.id} with legacy role ${user.role}`);
      } else {
        // No legacy role field - this is likely a new user with only RBAC roles
        // Try to get RBAC data without tenant filtering as a fallback
        console.log(`[RBAC] No legacy role found for user ${user.id}, trying RBAC without tenant filtering`);
        
        try {
          const fallbackRbacResult = await rbacService.getUserRolesAndPermissions(user.id, null, null);
          if (fallbackRbacResult && (fallbackRbacResult.roleNames.length > 0 || fallbackRbacResult.permissions.length > 0)) {
            rbacData = {
              roles: Array.isArray(fallbackRbacResult.roles) ? fallbackRbacResult.roles : [],
              roleNames: Array.isArray(fallbackRbacResult.roleNames) ? fallbackRbacResult.roleNames : [],
              permissions: Array.isArray(fallbackRbacResult.permissions) ? fallbackRbacResult.permissions : [],
              systemRoles: Array.isArray(fallbackRbacResult.systemRoles) ? fallbackRbacResult.systemRoles : []
            };
            console.log(`[RBAC] Fallback RBAC query successful for user ${user.id}:`, {
              roles: rbacData.roleNames,
              permissions: rbacData.permissions.length
            });
          } else {
            // Still no RBAC data, assign basic permissions
            rbacData.roleNames = ['employee'];
            rbacData.permissions = ['dashboard.view', 'sales.view', 'sales.create'];
            console.log(`[RBAC] Assigned default employee permissions for user ${user.id}`);
          }
        } catch (fallbackError) {
          console.error(`[RBAC] Fallback RBAC query failed for user ${user.id}:`, fallbackError);
          // Assign basic permissions as last resort
          rbacData.roleNames = ['employee'];
          rbacData.permissions = ['dashboard.view', 'sales.view', 'sales.create'];
        }
      }
    }
    
    // Final validation of RBAC data
    const finalRbacData = {
      roles: Array.isArray(rbacData.roles) ? rbacData.roles : [],
      roleNames: Array.isArray(rbacData.roleNames) ? rbacData.roleNames : [],
      permissions: Array.isArray(rbacData.permissions) ? rbacData.permissions : [],
      systemRoles: Array.isArray(rbacData.systemRoles) ? rbacData.systemRoles : []
    };
    
    // If we still don't have any roles/permissions, use defaults. This must
    // be && (not ||) — a role that legitimately resolved (e.g. a tenant's
    // "Tenant Admin" role, which intentionally carries zero explicit
    // role_permissions rows because tenant admins bypass permission checks
    // by role name — see rbacPermissionMiddleware.js and the demo tenant
    // seed's own comment on this) must not get clobbered down to a generic
    // 'user'/'dashboard.view' identity just because its permissions array is
    // empty by design. Only fall back when BOTH are empty, matching the
    // identical condition already used above at the first RBAC-data check.
    if (finalRbacData.roleNames.length === 0 && finalRbacData.permissions.length === 0) {
      console.warn('[RBAC] No valid roles or permissions found, using defaults');
      finalRbacData.roleNames = ['user'];
      finalRbacData.permissions = ['dashboard.view'];
    }
    
    // Assign back to rbacData
    rbacData = finalRbacData;

    // Create token payload with both legacy role and RBAC data
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role, // Legacy role field - will be removed in future
      permissions: rbacData.permissions,
      roles: rbacData.roleNames,
      systemRoles: rbacData.systemRoles
    };
    
    // Debug logging for token payload
    if (DEBUG_API) console.log('[RBAC] Token payload RBAC data:', {
      roles: tokenPayload.roles.length,
      permissions: tokenPayload.permissions.length,
      systemRoles: tokenPayload.systemRoles.length,
      roleNames: tokenPayload.roles,
      samplePermissions: tokenPayload.permissions.slice(0, 5)
    });
    
    // Add tenant context if available
    if (tenantId) {
      tokenPayload.tenant_id = tenantId;
      tokenPayload.tenantId = tenantId;
    }
    
    // Add store context if available
    if (storeId) {
      tokenPayload.store_id = storeId;
      tokenPayload.storeId = storeId;
    }
    
    // Update last_login_at timestamp for the user
    try {
      // Double check the user ID format - ensure it's a valid UUID
      const userId = user.id;
      if (!userId || typeof userId !== 'string' || userId.length !== 36) {
        console.error(`[LOGIN ERROR] Invalid user ID format for last_login_at update: "${userId}"`);
      }
      
      if (DEBUG_API) console.log(`[LOGIN] Attempting to update last_login_at for user ID: "${userId}"`);
      
      // Use direct connection for critical update to ensure transaction integrity
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        
        // Execute update with explicit transaction
        const [updateResult] = await connection.query(
          'UPDATE users SET last_login_at = NOW() WHERE id = ?', 
          [userId]
        );
        
        if (updateResult && updateResult.affectedRows > 0) {
          await connection.commit();
          if (DEBUG_API) console.log(`[LOGIN SUCCESS] Updated last_login_at timestamp for user ${userId}. Affected rows: ${updateResult.affectedRows}`);
        } else {
          await connection.rollback();
          console.warn(`[LOGIN WARNING] last_login_at update query completed but no rows were affected for user ${userId}`);

          // Additional diagnostics - check if user exists with this ID.
          // Use the already-held connection instead of pool.query() (which
          // would check out a SECOND connection from the pool while this
          // one is still checked out, wasting a slot).
          const [userCheck] = await connection.query('SELECT id, email FROM users WHERE id = ?', [userId]);
          if (!userCheck || userCheck.length === 0) {
            console.error(`[LOGIN ERROR] User with ID ${userId} not found in database`);
          } else {
            console.log(`[LOGIN DEBUG] User exists in DB: ID=${userCheck[0].id}, Email=${userCheck[0].email}`);
          }
        }

        // Verify the update by querying the user again (same connection).
        const [verifyUser] = await connection.query('SELECT id, email, last_login_at FROM users WHERE id = ?', [userId]);
        if (verifyUser && verifyUser.length > 0) {
          if (DEBUG_API) console.log(`[LOGIN VERIFY] User ${userId} (${verifyUser[0].email}) last_login_at is now: ${verifyUser[0].last_login_at || 'NULL'}`);
        } else {
          console.error(`[LOGIN ERROR] Failed to verify last_login_at update - user ${userId} not found`);
        }
      } catch (transactionError) {
        // Ensure transaction is rolled back on error
        if (connection) await connection.rollback().catch(e => console.error('Rollback error:', e));
        console.error('[LOGIN ERROR] Transaction error updating last_login_at:', transactionError);
      } finally {
        // Always release connection back to pool
        if (connection) connection.release();
      }
    } catch (updateError) {
      console.error('[LOGIN ERROR] Error in last_login_at update process:', updateError);
      // Continue with authentication even if update fails
    }

    // Create a user_sessions row and embed its id as the `sid` claim so this
    // login can later be listed/revoked (see backend/routes/userSessions.routes.js
    // and backend/services/userSessionService.js). Best-effort: createSession()
    // never throws, so a session-tracking failure never blocks login — it just
    // omits `sid`, which `authenticate` below treats as a pre-existing-token
    // shape and fails open.
    const sessionId = await userSessionService.createSession(req, { userId: user.id, tenantId });
    if (sessionId) {
      tokenPayload.sid = sessionId;
    }

    // Generate token
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Fetch tenant onboarding status so the frontend can redirect to
    // /onboarding when setup is incomplete. Without this, Login.tsx's
    // `user.tenant` check is always undefined and every user skips
    // onboarding (see audit Gap 3).
    let tenantInfo = null;
    if (tenantId) {
      try {
        const [tenantRows] = await pool.query(
          'SELECT id, name, setup_completed, onboarding_step, settings, industry_code FROM tenants WHERE id = ?',
          [tenantId]
        );
        if (tenantRows && tenantRows.length > 0) {
          const t = tenantRows[0];
          tenantInfo = {
            id: t.id,
            name: t.name,
            setup_completed: Boolean(t.setup_completed),
            onboarding_step: t.onboarding_step,
            settings: t.settings,
            industry_code: t.industry_code
          };
        }
      } catch (tenantErr) {
        console.error('[LOGIN] Error fetching tenant info:', tenantErr.message);
      }
    }

    // Return user info and token with RBAC data
    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role, // Legacy role field - will be deprecated
        tenant_id: tenantId,
        tenantId: tenantId,
        store_id: storeId,
        storeId: storeId,
        // Include RBAC data
        roles: rbacData.roleNames || [],
        permissions: rbacData.permissions || [],
        systemRoles: rbacData.systemRoles || [], // Add system roles to response
        // Tenant onboarding status — frontend uses this to redirect to
        // /onboarding when setup_completed is false or onboarding_step
        // is not 'completed' (see Login.tsx getRedirectPath).
        tenant: tenantInfo
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

/**
 * Permission-based authorization middleware
 * Checks if user has any of the required permissions
 * @param {Array} requiredPermissions - Array of permission strings required
 */
const hasPermission = (requiredPermissions) => {
  return async (req, res, next) => {
    // If no user is authenticated, deny access
    if (!req.user) {
      return res.status(401).json({ msg: 'Authentication required' });
    }

    // Development mode fallback - grant all permissions
    if (req.user.isDevelopmentFallback || req.user.devMode) {
      return next();
    }

    // Admin users with wildcard permission
    if (req.user.permissions && req.user.permissions.includes('*')) {
      return next();
    }

    /*
     * TENANT ADMINS BYPASS — and this used to be missing here.
     *
     * The codebase has three authorization paths and, until this fix, three
     * different answers to "is this user a tenant admin?":
     *
     *   authorize(...roles)          string-matches 'Tenant Admin' in the JWT
     *   requirePermission(perm)      DB lookup via rbacService.isTenantAdmin
     *   hasPermission([perms])       NOTHING — JWT permission array only
     *
     * So a tenant admin sailed through /api/print-templates (requirePermission)
     * and was refused by /api/v1/settings/taxes (hasPermission), on the same
     * page load. That is what produced the 403s with
     * `user_permissions: ["dashboard.view"]` while the rest of the app worked.
     *
     * Resolved against the DATABASE rather than the token, matching
     * requirePermission. The JWT's permission array is a snapshot taken at
     * login: granting a role mid-session would not take effect until the user
     * signed out and back in, and — worse — REVOKING one would not take effect
     * either. A permission check that cannot be revoked is not a permission
     * check.
     */
    try {
      const tenantId = req.user.tenant_id || req.user.tenantId;
      if (tenantId && await rbacService.isTenantAdmin(req.user.id, tenantId)) {
        return next();
      }
    } catch (error) {
      // Fail CLOSED. If we cannot determine admin status we fall through to the
      // explicit permission check below rather than granting access.
      console.error('[auth] Tenant admin check failed, falling back to explicit permissions:', error.message);
    }

    /*
     * Resolve permissions from the DATABASE, not the JWT snapshot.
     *
     * The JWT `permissions` claim is a snapshot taken at login — a role grant or
     * revocation mid-session never reflects in it until re-login. requirePermission()
     * (rbacPermissionMiddleware) already resolves live via rbacService; doing the
     * same here unifies the two enforcement paths and makes grants/revocations
     * effective immediately (the rbac cache is flushed on every role write).
     */
    try {
      const tenantId = req.params?.tenantId || req.query?.tenantId || req.body?.tenantId ||
        req.user.tenant_id || req.user.tenantId;
      // Same store-context precedence as rbacPermissionMiddleware.requirePermission:
      // request params/query/body → x-store-id header → JWT store claim.
      const storeId = req.params?.storeId || req.query?.storeId || req.body?.storeId ||
        req.headers['x-store-id'] || req.headers['store-id'] ||
        req.user.store_id || req.user.storeId;
      const rbacData = await rbacService.getUserRolesAndPermissions(req.user.id, tenantId, storeId);
      const livePermissions = rbacData.permissions || [];

      const hasRequiredPermission = requiredPermissions.some(permission =>
        livePermissions.includes(permission)
      );

      if (hasRequiredPermission) {
        // Keep req.user.permissions fresh for downstream handlers
        req.user.permissions = livePermissions;
        return next();
      } else {
        return res.status(403).json({
          msg: 'Permission denied',
          required: requiredPermissions,
          user_permissions: livePermissions
        });
      }
    } catch (error) {
      // Fail CLOSED on lookup errors — do not fall back to the stale JWT claim.
      console.error('[auth] Live permission lookup failed:', error.message);
      return res.status(500).json({ msg: 'Permission check failed' });
    }
  };
};

/**
 * Mint a fresh JWT for an already-authenticated user, scoped to a (possibly
 * new) tenant/store context. Mirrors the exact tokenPayload/response shape
 * `login()` above produces (roles/permissions/systemRoles via
 * rbacService.getUserRolesAndPermissions, tenant_id/tenantId + store_id/storeId
 * dual-cased claims), so anything that already knows how to persist a login
 * response (frontend's applySuccessfulLogin) can persist this one identically.
 *
 * `authRoutes.js`'s /switch-tenant and /switch-store routes call
 * `authMiddleware.generateToken(user, tenantId, storeId)` — this export did
 * NOT previously exist on this module (only in an unrelated
 * `middleware/backup/authMiddleware.js backup` file that nothing requires),
 * so both routes threw `TypeError: ... generateToken is not a function` at
 * runtime despite looking fully implemented. This is the real fix, not a
 * rename — the token-issuing logic itself is new here, kept deliberately
 * small (no session-row / last_login_at bookkeeping, unlike login()) since a
 * context switch isn't a new login.
 */
const generateToken = async (user, tenantId = null, storeId = null) => {
  const rbacData = await rbacService.getUserRolesAndPermissions(user.id, tenantId, storeId);

  const tokenPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: rbacData.permissions,
    roles: rbacData.roleNames,
    systemRoles: rbacData.systemRoles,
  };

  if (tenantId) {
    tokenPayload.tenant_id = tenantId;
    tokenPayload.tenantId = tenantId;
  }
  if (storeId) {
    tokenPayload.store_id = storeId;
    tokenPayload.storeId = storeId;
  }

  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_id: tenantId,
      tenantId,
      store_id: storeId,
      storeId,
      roles: rbacData.roleNames || [],
      permissions: rbacData.permissions || [],
      systemRoles: rbacData.systemRoles || [],
    },
  };
};

module.exports = {
  authenticate,
  authorize,
  requireTenantId,
  requireStoreId,
  login,
  verifyToken,
  hasPermission,
  generateToken
};
