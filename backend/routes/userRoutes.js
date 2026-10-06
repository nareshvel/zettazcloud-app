const express = require('express');
const router = express.Router();
const db = require('../db'); // Updated db import
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const rbacService = require('../services/rbacService');

// Conditional debug logging for users module
// IMPORTANT: Debug logs are DISABLED by default and only enabled explicitly with DEBUG_USERS=true
const DEBUG_USERS = process.env.DEBUG_USERS === 'true';
const debugLog = (...args) => { if (DEBUG_USERS) console.log(...args); };
// Disable all debug logs by default - uncomment this line to override all debug settings
// const debugLog = () => {}; // This would disable ALL debug logs regardless of environment variables

// Import the consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');

// Import authenticate from unified middleware
const { authenticate } = require('../middleware/unifiedAuthMiddleware');

// Self-service profile editing + avatar upload dependencies
const multer = require('multer');
const signupService = require('../services/signupService'); // reuse validatePhoneNumber, don't reinvent
const storageService = require('../services/storageService'); // same storage driver attachments.routes.js uses
const { logActivity } = require('../services/auditLogService');
const { withinUsageLimits } = require('../middleware/subscriptionMiddleware'); // Plan `limits.users` enforcement
const subscriptionService = require('../services/subscriptionService');
const storageUsageService = require('../services/storageUsageService');
const { parseSizeToBytes, formatBytes } = require('../utils/storageSize');

// Async count function for withinUsageLimits('users', ...) — db.query() here
// (backend/db.js) already resolves to the rows array itself, not a
// [rows, fields] tuple, so no destructuring of the awaited result.
const countTenantUsers = async (tenantId) => {
    const rows = await db.query('SELECT COUNT(*) as count FROM users WHERE tenant_id = ?', [tenantId]);
    return rows?.[0]?.count ?? 0;
};

// changePassword existed in controllers/userController.js but was never
// mounted anywhere in the routes layer, so POST /api/users/change-password
// 404'd unconditionally — pre-existing bug, surfaced when the redesigned
// Change Password card was actually exercised. Wired up here.
const userController = require('../controllers/userController');

// Avatar upload: memoryStorage + image-only filter, matching attachments.routes.js's
// 10MB limit (that route additionally allows PDF, which doesn't apply to an avatar).
const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB, matches attachments.routes.js
  fileFilter: (req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error('Only JPEG/PNG/WebP/GIF images are allowed.'));
    }
    cb(null, true);
  },
});

// Legacy imports (kept for reference during migration)
// const userRoleService = require('../services/userRoleService');
// const userRbacService = require('../services/userRbacService');
// const { PERMISSIONS } = require('../constants');

/**
 * @route   GET /api/users/:userId/roles
 * @desc    Get roles assigned to a specific user
 * @access  Private (requires users.view permission)
 */
router.get('/:userId/roles', authenticate, requirePermission('users.view'), async (req, res) => {
  try {
    const { userId } = req.params;
    const tenant_id = req.user?.tenant_id || req.headers["x-tenant-id"];
    const store_id = req.headers["x-store-id"] || null;
    
    if (!userId || !tenant_id) {
      return res.status(400).json({ message: 'User ID and tenant ID are required' });
    }

    debugLog(`🟡 BACKEND DEBUG - Getting roles for userId: ${userId}, tenant_id: ${tenant_id}, store_id: ${store_id}`);
    
    const roles = await rbacService.getUserTenantRoles(userId, tenant_id, { storeId: store_id });
    
    debugLog(`🟡 BACKEND DEBUG - Raw roles from rbacService:`, roles);
    
    // Format roles to match the expected frontend format
    const formattedRoles = roles.map(role => ({
      id: role.role_id,
      name: role.name,
      description: role.description,
      is_system_role: role.is_system_role === 1,
      scope: role.scope,
      assigned: true
    }));

    debugLog(`🟡 BACKEND DEBUG - Formatted roles:`, formattedRoles);
    
    return res.json({ roles: formattedRoles });
  } catch (error) {
    console.error(`[ERROR] GET /api/users/${req.params.userId}/roles:`, error);
    return res.status(500).json({ message: 'Failed to fetch user roles', error: error.message });
  }
});

/**
 * @route   PUT /api/users/:userId/roles
 * @desc    Assign roles to a user
 * @access  Private (requires users.edit permission)
 */
router.put('/:userId/roles', authenticate, requirePermission('users.edit'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { roleIds, role_ids } = req.body;
    const actualRoleIds = roleIds || role_ids; // Handle both camelCase and snake_case
    const tenant_id = req.user?.tenant_id || req.headers["x-tenant-id"];
    
    // Debug logging to understand validation failure
    debugLog('[DEBUG] Role assignment request:');
    debugLog('- userId from params:', userId);
    debugLog('- Raw req.body:', req.body);
    debugLog('- JSON.stringify(req.body):', JSON.stringify(req.body));
    debugLog('- roleIds from body:', roleIds);
    debugLog('- role_ids from body:', role_ids);
    debugLog('- actualRoleIds:', actualRoleIds);
    debugLog('- typeof actualRoleIds:', typeof actualRoleIds);
    debugLog('- req.user?.tenant_id:', req.user?.tenant_id);
    debugLog('- req.headers["x-tenant-id"]:', req.headers["x-tenant-id"]);
    debugLog('- final tenant_id:', tenant_id);
    debugLog('- Array.isArray(actualRoleIds):', Array.isArray(actualRoleIds));
    debugLog('- Content-Type header:', req.headers['content-type']);
    
    if (!userId || !tenant_id || !Array.isArray(actualRoleIds)) {
      debugLog('[ERROR] Validation failed:');
      debugLog('- userId valid:', !!userId);
      debugLog('- tenant_id valid:', !!tenant_id);
      debugLog('- actualRoleIds is array:', Array.isArray(actualRoleIds));
      return res.status(400).json({ message: 'User ID, tenant ID, and role IDs array are required' });
    }
    
    // Debug logging removed for cleaner console output
    
    // Get existing tenant roles for this user
    const existingRoles = await rbacService.getUserTenantRoles(userId, tenant_id);
    
    // Remove existing tenant role assignments
    for (const existingRole of existingRoles) {
      if (existingRole.assignment_id) {
        await rbacService.removeTenantRole(existingRole.assignment_id, userId, tenant_id);
      }
    }
    
    // Then assign the new roles
    for (const roleId of actualRoleIds) {
      await rbacService.assignTenantRole(userId, roleId, tenant_id, 'tenant', null, req.user.id);
    }
    
    return res.json({ message: 'Roles assigned successfully' });
  } catch (error) {
    console.error(`[ERROR] PUT /api/users/${req.params.userId}/roles:`, error);
    return res.status(500).json({ message: 'Failed to assign roles to user', error: error.message });
  }
});

/**
 * @route   GET /api/users
 * @desc    Get all users for the tenant with pagination, search, and sorting
 * @access  Private (requires users.view permission)
 */
router.get('/', requirePermission('users.view'), async (req, res) => {
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
  try {
    const { page = 1, limit = 10, search = '', sort = 'name', order = 'asc' } = req.query;
    // db.query() (backend/config/db.js) always runs queries through
    // connection.execute() — a real MySQL prepared statement — and this
    // hosted MySQL server rejects LIMIT/OFFSET passed as bound `?`
    // parameters with `ER_WRONG_ARGUMENTS: Incorrect arguments to
    // mysqld_stmt_execute` (a known mysql2/MySQL prepared-statement
    // limitation, not something specific to this endpoint or this tenant —
    // it just hadn't been exercised against this DB host before). Fix:
    // validate to plain integers and inline them into the SQL string
    // instead of binding them, which is safe since they're clamped numbers,
    // never raw user text.
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 500);
    const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
    const offset = (parsedPage - 1) * parsedLimit;

    // `sort` is interpolated directly into ORDER BY below (pre-existing),
    // so constrain it to a known-safe column whitelist rather than trusting
    // the query string outright.
    const SORTABLE_COLUMNS = new Set(['name', 'email', 'created_at', 'updated_at', 'last_login_at', 'is_active']);
    const sortColumn = SORTABLE_COLUMNS.has(sort) ? sort : 'name';

    // Base query for fetching users
    const usersQuery = `
      SELECT
        u.id, u.name, u.email, u.tenant_id, u.store_id, u.created_at, u.updated_at, u.last_login_at as last_login,
        u.is_active, u.phone_number
      FROM users u
      WHERE u.tenant_id = ?
      ${search ? 'AND (u.name LIKE ? OR u.email LIKE ?)' : ''}
      ORDER BY u.${sortColumn} ${order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC'}
      LIMIT ${parsedLimit} OFFSET ${offset}
    `;

    const queryParams = [tenant_id];
    if (search) {
      queryParams.push(`%${search}%`);
      queryParams.push(`%${search}%`);
    }

    // Debug logging removed for cleaner console output
    // Debug logging removed for cleaner console output

    // Debug logging removed for cleaner console output
    // Debug logging removed for cleaner console output
    const users = await db.query(usersQuery, queryParams);
    // Debug logging removed for cleaner console output
    
    // Make sure to handle both array and single object results
    const usersArray = Array.isArray(users) ? users : (users ? [users] : []);
    // Debug logging removed for cleaner console output

    // Get total count for pagination
    let totalQuery = 'SELECT COUNT(*) as count FROM users WHERE tenant_id = ?';
    const totalParams = [tenant_id];
    if (search) {
      totalQuery += ' AND (name LIKE ? OR email LIKE ?)';
      totalParams.push(`%${search}%`, `%${search}%`);
    }

    // Debug logging removed for cleaner console output
    // Debug logging removed for cleaner console output
    const totalResult = await db.query(totalQuery, totalParams);
    // Debug logging removed for cleaner console output
    
    // Get the correct count from the database
    let totalUsers = 0;
    
    // Direct debugging of totalResult
    // Debug logging removed for cleaner console output
    // Debug logging removed for cleaner console output
    
    // Extract count from the format returned by the database
    if (totalResult && Array.isArray(totalResult) && totalResult.length > 0) {
      // Format: [{ count: 4 }]
      totalUsers = parseInt(totalResult[0].count, 10);
      // Debug logging removed for cleaner console output
    } else if (totalResult && typeof totalResult === 'object' && totalResult.count !== undefined) {
      // Direct object: { count: 4 }
      totalUsers = parseInt(totalResult.count, 10);
      // Debug logging removed for cleaner console output
    }
    
    // If we still don't have a count, log the entire result for debugging
    if (totalUsers === 0) {
      // Debug logging removed for cleaner console output
    }
    // Debug logging removed for cleaner console output
    
    // Diagnostic check: If count and returned users don't match, run direct queries
    if (totalUsers > 0 && usersArray.length !== totalUsers) {
      // Debug logging removed for cleaner console output
      
      // Run comprehensive diagnostics to find all issues
      try {
        // Simple query with only tenant_id filter
        const simpleQuery = 'SELECT id, name, email, tenant_id, created_at, updated_at, is_active, phone_number, last_login_at as last_login FROM users WHERE tenant_id = ?';
        const simpleResult = await db.query(simpleQuery, [tenant_id]);
        const simpleUsers = Array.isArray(simpleResult) ? simpleResult : (simpleResult ? [simpleResult] : []);
        
        // Debug logging removed for cleaner console output
        // Debug logging removed for cleaner console output
        
        // Compare with main query
        const mainQueryIds = usersArray.map(u => u.id);
        const simpleQueryIds = simpleUsers.map(u => u.id);
        const missingIds = simpleQueryIds.filter(id => !mainQueryIds.includes(id));
        
        if (missingIds.length > 0) {
          // Debug logging removed for cleaner console output
          // Get details of missing users for debugging
          const missingUsers = simpleUsers.filter(u => missingIds.includes(u.id));
          // Debug logging removed for cleaner console output
          
          // For each missing user, check if there's a specific reason they're filtered out
          for (const user of missingUsers) {
            // Debug logging removed for cleaner console output
            debugLog('  Name:', user.name);
            debugLog('  Email:', user.email);
            debugLog('  Status:', user.status);
            debugLog('  Is Active:', user.is_active);
          }
        }
        
        // Include all found users in the response if we're in dev mode
        if (process.env.NODE_ENV === 'development' && missingIds.length > 0) {
          // Debug logging removed for cleaner console output
          // Replace the users array with all found users
          usersArray.length = 0; // Clear existing array
          simpleUsers.forEach(u => usersArray.push(u)); // Push all users from simple query
          // Debug logging removed for cleaner console output
        }
      } catch (error) {
        console.error('[ERROR] GET /api/users - Error running diagnostic query:', error);
      }
    }

    if (users.length === 0) {
      return res.json({ users: [], totalUsers, totalPages: 0, currentPage: 1 });
    }

    // Efficiently fetch roles for all users on the current page
    // Get the user IDs from the array
    const userIds = usersArray.map(u => u.id);
    // Use the consolidated rbacService instead of the deprecated userRoleService
    // This function needs to get roles for multiple users at once
    // Collect roles for each user individually since consolidated service doesn't have batch function
    const rolesMap = new Map();
    
    // Log user statuses before role processing
    // Debug logging removed for cleaner console output
    usersArray.forEach(user => {
      debugLog(`User ${user.id} (${user.email}): is_active=${user.is_active}, type=${typeof user.is_active}`);
    });
    
    // Process each user sequentially to avoid overwhelming the database
    for (const userId of userIds) {
      try {
        const roles = await rbacService.getUserTenantRoles(userId, tenant_id);
        rolesMap.set(userId, roles);
      } catch (error) {
        console.error(`Error getting roles for user ${userId}:`, error);
        rolesMap.set(userId, []);
      }
    }

    // Combine users with their roles
    const usersWithRoles = usersArray.map(user => {
      const roles = rolesMap.get(user.id) || [];
      // Fallback to legacy role if no new roles are assigned
      if (roles.length === 0 && user.legacy_role) {
        roles.push({ name: user.legacy_role, scope: 'legacy' });
      }
      // Format role names for easy display
      const role_names = roles.map(role => role.name).join(', ');
      
      // Derive status from is_active field
      // Since we don't have a status column in the database, we'll derive it
      // based on is_active (1 = 'active', 0 = 'inactive')
      // Handle different data types consistently - convert to boolean
      let derivedStatus = 'active'; // Default to active if is_active is undefined
      
      // Debug the actual value and type
      // Debug logging removed for cleaner console output
      
      // Handle all possible formats: boolean, number (0/1), string ('0'/'1')
      if (user.is_active === false || user.is_active === 0 || user.is_active === '0' || 
          user.is_active === 'false' || user.is_active === 'FALSE' || user.is_active === '') {
        derivedStatus = 'inactive';
      }

      // Return a clean user object with additional fields for easier UI display
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone_number,
        storeId: user.store_id,
        primaryStoreId: user.store_id,
        status: derivedStatus, // Use the derived status
        isActive: user.is_active, // Camel case for frontend
        roles: roles,
        roleNames: role_names, // Camel case for frontend
        lastLogin: user.last_login ? new Date(user.last_login).toISOString() : null, // Convert to ISO string format and use camelCase
        createdAt: user.created_at, // Camel case for frontend
        updatedAt: user.updated_at, // Camel case for frontend
      };
    });

    // Run diagnostic if there's a discrepancy between total count and returned users
    if (totalUsers !== usersWithRoles.length) {
      debugLog('[WARNING] GET /api/users - Count discrepancy detected. Database reports', totalUsers, 'users but query returned only', usersWithRoles.length);
      
      // Run diagnostic query to find all users for this tenant
      try {
        const allUsers = await db.query('SELECT id, name, email, tenant_id, created_at, updated_at FROM users WHERE tenant_id = ?', [tenant_id]);
        debugLog('[DIAGNOSTIC] All users for tenant:', JSON.stringify(allUsers));
      } catch (diagError) {
        console.error('[DIAGNOSTIC] Error fetching all users:', diagError);
      }
    }
    
    // Calculate proper pagination values
    const totalPages = totalUsers > 0 ? Math.ceil(totalUsers / parsedLimit) : 0;
    const currentPage = parsedPage;
    
    // Debug logging removed for cleaner console output

    // Prepare the response
    const response = {
      users: usersWithRoles,
      totalUsers,
      totalPages,
      currentPage
    };
    
    // In development environment, include diagnostic information
    if (process.env.NODE_ENV === 'development' && totalUsers !== users.length && parsedLimit >= totalUsers) {
      response.debug = {
        message: `WARNING: Count query shows ${totalUsers} users but main query returned ${users.length} users`,
        tenant_id
      };
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching users:', error);
    // Avoid referencing variables that may not be in scope
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * @route   GET /api/users/:userId
 * @desc    Get a single user by ID
 * @access  Private (requires USER_READ permission)
 */
/**
 * @route   GET /api/users/me
 * @desc    Get the currently authenticated user's information
 * @access  Private (requires USER_READ permission)
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id || "system";
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];
    
    // Log the request context for debugging
    debugLog(`GET /api/users/me for userId=${userId}, tenantId=${tenant_id}`);
    debugLog('JWT token user object:', JSON.stringify(req.user, null, 2));
    
    try {
      // Use the authenticated user's ID for lookup without tenant filtering
      // This avoids issues when user's token tenant_id doesn't match database tenant_id
      // Join tenants so the frontend can check onboarding status (setup_completed,
      // onboarding_step) — without this, Login.tsx's redirect to /onboarding
      // never fires because user.tenant is always undefined (audit Gap 3).
      const users = await db.query(`
        SELECT u.id, u.name, u.email, u.tenant_id, u.store_id, u.phone_number, u.profile_picture_url,
               t.name AS tenant_name, t.setup_completed AS tenant_setup_completed,
               t.onboarding_step AS tenant_onboarding_step, t.settings AS tenant_settings,
               t.industry_code AS tenant_industry_code
        FROM users u
        LEFT JOIN tenants t ON u.tenant_id = t.id
        WHERE u.id = ?
      `, [userId]);
      debugLog('User query result:', users ? users.length : 'null');
      
      if (!users || users.length === 0) {
        console.error(`User not found with ID: ${userId}`);
        return res.status(404).json({ msg: 'User not found' });
      }

      const user = users[0];
      debugLog(`User found: ${user.id}, tenant: ${user.tenant_id}`);
      
      // Build a fallback response in case RBAC service fails
      const fallbackResponse = {
        id: user.id,
        name: user.name,
        email: user.email,
        tenant_id: user.tenant_id,
        store_id: user.store_id,
        phone_number: user.phone_number,
        profile_picture_url: user.profile_picture_url,
        permissions: req.user?.permissions || [],
        roles: req.user?.roles || [], // Use roles from JWT token instead of legacy_role
        systemRoles: req.user?.systemRoles || [],
        stores: req.user?.stores || [],
        // Tenant onboarding status (audit Gap 3)
        tenant: user.tenant_id ? {
          id: user.tenant_id,
          name: user.tenant_name,
          setup_completed: Boolean(user.tenant_setup_completed),
          onboarding_step: user.tenant_onboarding_step,
          settings: user.tenant_settings,
          industry_code: user.tenant_industry_code
        } : null
      };
      
      try {
        // Get all roles regardless of tenant (similar to our RBAC service fix)
        debugLog('Calling rbacService.getUserRolesAndPermissions...');
        const rbacData = await rbacService.getUserRolesAndPermissions(user.id, null, null);
        
        // Debug log the RBAC data structure
        debugLog('RBAC data received successfully!');
        debugLog('RBAC data structure:', Object.keys(rbacData || {}));
        
        // Return a clean user object with RBAC data
        const userResponse = {
          id: user.id,
          name: user.name,
          email: user.email,
          tenant_id: user.tenant_id,
          store_id: user.store_id,
          phone_number: user.phone_number,
          profile_picture_url: user.profile_picture_url,
          // Use RBAC data from the service or fallback to JWT token data
          permissions: rbacData?.permissions || req.user?.permissions || [],
          roles: rbacData?.roleNames || [],
          systemRoles: rbacData?.systemRoles || req.user?.systemRoles || [],
          stores: req.user?.stores || [],
          // Tenant onboarding status (audit Gap 3)
          tenant: user.tenant_id ? {
            id: user.tenant_id,
            name: user.tenant_name,
            setup_completed: Boolean(user.tenant_setup_completed),
            onboarding_step: user.tenant_onboarding_step,
            settings: user.tenant_settings,
            industry_code: user.tenant_industry_code
          } : null
        };
        
        // No need for legacy role fallback since we now use JWT token roles

        return res.json(userResponse);
      } catch (rbacError) {
        console.error('Error in rbacService.getUserRolesAndPermissions:', rbacError);
        debugLog('Using fallback response without RBAC data');
        return res.json(fallbackResponse);
      }
    } catch (dbError) {
      console.error('Database error in /api/users/me:', dbError);
      return res.status(500).json({ msg: 'Database error while fetching user data' });
    }
  } catch (error) {
    console.error('Unhandled error in /api/users/me:', error);
    res.status(500).json({ msg: 'Server error while fetching user.' });
  }
});

/**
 * @route   PATCH /api/users/me
 * @desc    Self-service partial update of the caller's own profile (name, phoneNumber).
 *          Email is intentionally NOT editable here — changing it would need a
 *          re-verification flow (see users.email_verified/verification_token),
 *          which is out of scope for this endpoint; a dedicated "change email"
 *          flow should be built separately if needed.
 * @access  Private (own row only — req.user.id, never a body-supplied id)
 */
/**
 * @route   POST /api/users/change-password
 * @desc    Self-service password change (own account only). Body:
 *          { current_password, new_password }. Enforces the same password
 *          strength rule used at signup (signupService.validatePassword).
 * @access  Private
 */
router.post('/change-password', authenticate, userController.changePassword);

router.patch('/me', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Not authenticated' });

    // fetchApi (frontend/src/services/api.ts) converts every outgoing JSON
    // request body from camelCase to snake_case before it hits the wire — so
    // despite the frontend calling this with `{ name, phoneNumber }`, the
    // body actually arriving here has `phone_number`, not `phoneNumber`.
    // Reading the camelCase key here was a real bug: it silently made phone
    // number updates a no-op (falling through to "No updatable fields
    // provided" whenever name was unchanged), while name updates happened to
    // keep working only because "name" has no case difference either way.
    const { name, phone_number: phoneNumber } = req.body || {};
    const updates = [];
    const values = [];

    if (name !== undefined) {
      const trimmed = typeof name === 'string' ? name.trim() : '';
      if (!trimmed || trimmed.length > 255) {
        return res.status(400).json({ status: 'error', message: 'name must be a non-empty string of at most 255 characters' });
      }
      updates.push('name = ?');
      values.push(trimmed);
    }

    if (phoneNumber !== undefined) {
      if (phoneNumber === null || phoneNumber === '') {
        updates.push('phone_number = ?');
        values.push(null);
      } else {
        const validation = signupService.validatePhoneNumber(phoneNumber);
        if (!validation.isValid) {
          return res.status(400).json({ status: 'error', message: validation.message });
        }
        updates.push('phone_number = ?');
        values.push(validation.formatted);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No updatable fields provided (name, phoneNumber)' });
    }

    values.push(userId);
    await db.query(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = ?`, values);

    try {
      await logActivity({
        tenant_id: req.user?.tenant_id,
        user_id: userId,
        action: 'PROFILE_UPDATED',
        entity_type: 'user',
        entity_id: userId,
        details: { fields: Object.keys(req.body || {}) },
      });
    } catch (auditErr) {
      console.error('[users/me PATCH] Audit log failed (non-blocking):', auditErr.message);
    }

    // db.query() (backend/config/db.js) already resolves to the rows array
    // itself, not a mysql2 [rows, fields] tuple — destructuring `[rows]` here
    // grabbed the first ROW OBJECT into `rows`, so `rows[0]` below was always
    // undefined and every successful save silently responded with
    // `data: undefined`, which is why the name/phone fields went blank right
    // after saving instead of showing the new value.
    const rows = await db.query('SELECT id, name, email, phone_number, profile_picture_url FROM users WHERE id = ?', [userId]);
    res.json({ status: 'success', data: rows[0] });
  } catch (error) {
    console.error('Error in PATCH /api/users/me:', error);
    res.status(500).json({ status: 'error', message: 'Server error while updating profile.' });
  }
});

/**
 * @route   POST /api/users/me/avatar
 * @desc    Upload/replace the caller's profile picture. Reuses attachments.routes.js's
 *          storage mechanism (backend/services/storageService.js, local driver by
 *          default) rather than a separate storage path.
 * @access  Private (own row only)
 */
router.post('/me/avatar', authenticate, avatarUpload.single('file'), async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Not authenticated' });
    if (!req.file) return res.status(400).json({ status: 'error', message: 'file is required' });

    const tenantId = req.user?.tenant_id || 'no-tenant';

    // Plan `limits.storage` enforcement — same pre-write pattern as
    // attachments.routes.js (this route also buffers in memory before
    // writing, so the file's own size can be checked before storageService.save).
    const subscription = req.subscription || await subscriptionService.getTenantSubscription(tenantId, { includePlan: true });
    const rawStorageLimit = subscription?.plan?.limits?.storage;
    if (rawStorageLimit !== undefined && rawStorageLimit !== null && rawStorageLimit !== -1) {
      const limitBytes = parseSizeToBytes(rawStorageLimit);
      if (!isNaN(limitBytes) && limitBytes !== -1) {
        const currentBytes = await storageUsageService.getTenantStorageBytes(tenantId);
        if (currentBytes + req.file.size > limitBytes) {
          return res.status(402).json({
            status: 'error',
            message: `You have reached the storage limit (${formatBytes(limitBytes)}) for your subscription plan. Please upgrade your plan or remove some files to free up space.`,
            currentUsage: formatBytes(currentBytes),
            limit: formatBytes(limitBytes),
            resourceType: 'storage',
          });
        }
      }
    }

    const key = storageService.buildKey(tenantId, 'user_avatar', req.file.originalname);
    await storageService.save(key, req.file.buffer);
    const url = storageService.publicUrl(key);

    await db.query('UPDATE users SET profile_picture_url = ?, updated_at = NOW() WHERE id = ?', [url, userId]);

    try {
      await logActivity({
        tenant_id: req.user?.tenant_id,
        user_id: userId,
        action: 'AVATAR_UPLOADED',
        entity_type: 'user',
        entity_id: userId,
      });
    } catch (auditErr) {
      console.error('[users/me/avatar POST] Audit log failed (non-blocking):', auditErr.message);
    }

    res.status(201).json({ status: 'success', data: { profilePictureUrl: url } });
  } catch (error) {
    console.error('Error in POST /api/users/me/avatar:', error);
    res.status(400).json({ status: 'error', message: error.message || 'Server error while uploading avatar.' });
  }
});

/**
 * @route   DELETE /api/users/me/avatar
 * @desc    Clear the caller's profile picture back to null.
 * @access  Private (own row only)
 */
router.delete('/me/avatar', authenticate, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ status: 'error', message: 'Not authenticated' });

    await db.query('UPDATE users SET profile_picture_url = NULL, updated_at = NOW() WHERE id = ?', [userId]);

    try {
      await logActivity({
        tenant_id: req.user?.tenant_id,
        user_id: userId,
        action: 'AVATAR_REMOVED',
        entity_type: 'user',
        entity_id: userId,
      });
    } catch (auditErr) {
      console.error('[users/me/avatar DELETE] Audit log failed (non-blocking):', auditErr.message);
    }

    res.json({ status: 'success' });
  } catch (error) {
    console.error('Error in DELETE /api/users/me/avatar:', error);
    res.status(500).json({ status: 'error', message: 'Server error while removing avatar.' });
  }
});

/**
 * @route   GET /api/users/:userId
 * @desc    Get a single user by ID
 * @access  Private (requires users.view permission)
 */
router.get('/:userId', requirePermission('users.view'), async (req, res) => {
  const { userId } = req.params;
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];

  try {
    // Only select columns that exist in the database
    const users = await db.query('SELECT id, name, email, role as legacy_role FROM users WHERE id = ? AND tenant_id = ?', [userId, tenant_id]);

    if (users.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }

    const user = users[0];
    const roles = await rbacService.getUserTenantRoles(user.id, tenant_id);
    
    // Fallback for legacy roles
    if (roles.length === 0 && user.legacy_role) {
      roles.push({ name: user.legacy_role, scope: 'legacy' });
    }

    // Exclude sensitive fields like password hash
    const { legacy_role, ...userResponse } = user;

    res.json({ ...userResponse, roles });
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error);
    res.status(500).json({ msg: 'Server error while fetching user.' });
  }
});

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Private (requires USER_CREATE permission)
 */
/**
 * @route   POST /api/users
 * @desc    Create a new user with RBAC roles
 * @access  Private (requires users.create permission)
 */
router.post('/', requirePermission('users.create'), withinUsageLimits('users', countTenantUsers), async (req, res) => {
  const { name, email, phone, phone_number, password, roles, primaryStoreId, primary_store_id, store_id, status } = req.body;
  const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];

  if (!name || !email || !password) {
    return res.status(400).json({ status: 'error', message: 'Name, email, and password are required fields.' });
  }

  try {
    const userId = await db.withTransaction(async (trx) => {
      const existingUsers = await trx.query(
        'SELECT id FROM users WHERE email = ? AND tenant_id = ?',
        [email, tenantId]
      );
      if (existingUsers.length) {
        const error = new Error('A user with this email already exists in this tenant.');
        error.status = 409;
        throw error;
      }

      const selectedStoreId = store_id || primary_store_id || primaryStoreId || null;
      if (selectedStoreId) {
        const stores = await trx.query(
          'SELECT id FROM stores WHERE id = ? AND tenant_id = ?',
          [selectedStoreId, tenantId]
        );
        if (!stores.length) {
          const error = new Error('Selected store does not belong to this tenant');
          error.status = 400;
          throw error;
        }
      }

      const id = uuidv4();
      const hashedPassword = await bcrypt.hash(password, 10);
      await trx.query(
        `INSERT INTO users
          (id, tenant_id, name, email, phone_number, password_hash, is_active, email_verified, store_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, tenantId, name, email, phone ?? phone_number ?? null, hashedPassword, status === 'inactive' ? 0 : 1, 1, selectedStoreId]
      );

      if (Array.isArray(roles)) {
        for (const role of roles) {
          const roleId = role.id || null;
          const scope = role.scope === 'store' ? 'store' : 'tenant';
          const roleStoreId = scope === 'store' ? (role.store_id || selectedStoreId) : null;
          const matchingRoles = await trx.query(
            'SELECT id FROM roles WHERE id = ? AND tenant_id = ?',
            [roleId, tenantId]
          );
          if (!matchingRoles.length) {
            const error = new Error('Selected role does not belong to this tenant');
            error.status = 400;
            throw error;
          }
          if (scope === 'store' && !roleStoreId) {
            const error = new Error('A store is required for a store-scoped role');
            error.status = 400;
            throw error;
          }
          await trx.query(
            `INSERT INTO user_roles
              (id, user_id, role_id, scope, store_id, assigned_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [uuidv4(), id, roleId, scope, roleStoreId, req.user?.id || null]
          );
        }
      }

      return id;
    });

    res.status(201).json({ status: 'success', data: { id: userId } });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(error.status || 500).json({
      status: 'error',
      message: error.status ? error.message : 'Server error while creating user.'
    });
  }
});

/**
 * @route   PUT /api/users/:userId
 * @desc    Update a user's details and roles
 * @access  Private (requires users.edit permission)
 */
router.put('/:userId', requirePermission('users.edit'), async (req, res) => {
  const { userId } = req.params;
  const { name, phone, phone_number, store_id, roles, status } = req.body;
  const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];

  try {
    const updatedUser = await db.withTransaction(async (trx) => {
      const users = await trx.query(
        'SELECT id FROM users WHERE id = ? AND tenant_id = ?',
        [userId, tenantId]
      );
      if (!users.length) {
        const error = new Error('User not found');
        error.status = 404;
        throw error;
      }

      const normalizedStoreId = store_id === '' || store_id === undefined ? null : store_id;
      if (normalizedStoreId) {
        const stores = await trx.query(
          'SELECT id FROM stores WHERE id = ? AND tenant_id = ?',
          [normalizedStoreId, tenantId]
        );
        if (!stores.length) {
          const error = new Error('Selected store does not belong to this tenant');
          error.status = 400;
          throw error;
        }
      }

      const clauses = [];
      const values = [];
      if (name !== undefined) {
        clauses.push('name = ?');
        values.push(name);
      }
      if (phone !== undefined || phone_number !== undefined) {
        clauses.push('phone_number = ?');
        values.push(phone ?? phone_number ?? null);
      }
      if (status !== undefined) {
        clauses.push('is_active = ?');
        values.push(status === 'active' ? 1 : 0);
      }
      if (store_id !== undefined) {
        clauses.push('store_id = ?');
        values.push(normalizedStoreId);
      }
      if (clauses.length) {
        clauses.push('updated_at = NOW()');
        await trx.query(
          `UPDATE users SET ${clauses.join(', ')} WHERE id = ? AND tenant_id = ?`,
          [...values, userId, tenantId]
        );
      }

      if (Array.isArray(roles)) {
        const normalizedRoles = Array.from(new Map(roles.map((role) => {
          const roleId = role.id || null;
          const scope = role.scope === 'store' ? 'store' : 'tenant';
          const roleStoreId = scope === 'store' ? (role.store_id || normalizedStoreId) : null;
          return [`${roleId}:${scope}:${roleStoreId || ''}`, { id: roleId, scope, store_id: roleStoreId }];
        })).values());

        for (const role of normalizedRoles) {
          if (!role.id) {
            const error = new Error('A valid role is required');
            error.status = 400;
            throw error;
          }
          const matchingRoles = await trx.query(
            'SELECT id FROM roles WHERE id = ? AND tenant_id = ?',
            [role.id, tenantId]
          );
          if (!matchingRoles.length) {
            const error = new Error('Selected role does not belong to this tenant');
            error.status = 400;
            throw error;
          }
          if (role.scope === 'store' && !role.store_id) {
            const error = new Error('A store is required for a store-scoped role');
            error.status = 400;
            throw error;
          }
          if (role.store_id) {
            const matchingStores = await trx.query(
              'SELECT id FROM stores WHERE id = ? AND tenant_id = ?',
              [role.store_id, tenantId]
            );
            if (!matchingStores.length) {
              const error = new Error('Role store does not belong to this tenant');
              error.status = 400;
              throw error;
            }
          }
        }

        await trx.query('DELETE FROM user_roles WHERE user_id = ?', [userId]);
        for (const role of normalizedRoles) {
          await trx.query(
            `INSERT INTO user_roles
              (id, user_id, role_id, scope, store_id, assigned_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [uuidv4(), userId, role.id, role.scope, role.store_id, req.user?.id || null]
          );
        }
      }

      const rows = await trx.query(
        `SELECT id, name, email, phone_number, store_id, is_active, created_at, updated_at
         FROM users WHERE id = ? AND tenant_id = ?`,
        [userId, tenantId]
      );
      return rows[0];
    });

    res.json({ status: 'success', data: updatedUser });
  } catch (error) {
    console.error(`Error updating user ${userId}:`, error);
    res.status(error.status || 500).json({
      status: 'error',
      message: error.status ? error.message : 'Server error while updating user.'
    });
  }
});


/**
 * @route   DELETE /api/users/:userId
 * @desc    Deletes a user permanently. Use with caution.
 * @access  Private (requires users.delete permission)
 */
router.delete('/:userId', requirePermission('users.delete'), async (req, res) => {
  const { userId } = req.params;
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];

  try {
    // First check if user exists
    const users = await db.query('SELECT * FROM users WHERE id = ? AND tenant_id = ?', [userId, tenant_id]);
    if (!users || users.length === 0) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Delete user roles first (foreign key constraints)
    await db.query('DELETE FROM user_roles WHERE user_id = ?', [userId]);
    
    // Then delete the user
    await db.query('DELETE FROM users WHERE id = ? AND tenant_id = ?', [userId, tenant_id]);

    res.json({ msg: 'User deleted successfully' });

  } catch (error) {
    console.error(`Error deleting user ${userId}:`, error);
    res.status(500).json({ msg: 'Server error while deleting user.' });
  }
});

/**
 * @route   PATCH /api/users/:userId/status
 * @desc    Activate or deactivate a user (soft status change)
 * @access  Private (requires users.edit permission)
 */
router.patch('/:userId/status', requirePermission('users.edit'), async (req, res) => {
  const { userId } = req.params;
  const { is_active } = req.body;
  const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];

  if (typeof is_active !== 'boolean') {
    return res.status(400).json({ msg: 'Invalid value for is_active. Must be true or false.' });
  }

  debugLog(`[USER STATUS] Attempting to update status for user ID: "${userId}" to is_active=${is_active} (${is_active ? 'active' : 'inactive'})`);

  try {
    // Use the db.beginTransaction() method which returns a transaction object
    // This handles getting a connection from the pool internally
    debugLog(`[USER STATUS] Starting transaction for user ${userId} status update`);
    const transaction = await db.beginTransaction();

    try {
      // Execute update within transaction - only update is_active as there is no status column
      // Handle the query result without destructuring to avoid iterable errors
      const result = await transaction.query(
        'UPDATE users SET is_active = ? WHERE id = ? AND tenant_id = ?', 
        [is_active, userId, tenant_id]
      );
      
      // Get the appropriate result object, which could be at index 0 if result is an array
      const updateResult = Array.isArray(result) ? result[0] : result;

      if (updateResult.affectedRows === 0) {
        // No rows affected - rollback and return not found
        await transaction.rollback();
        debugLog(`[USER STATUS] No user found with ID ${userId} for tenant ${tenant_id}. Rolling back.`);
        return res.status(404).json({ msg: 'User not found' });
      }

      // Verify the update by querying the user again
      const verifyResult = await transaction.query(
        'SELECT id, email, is_active FROM users WHERE id = ? AND tenant_id = ?', 
        [userId, tenant_id]
      );
      
      // Enhanced logic to safely extract user data from query results in various formats
      debugLog('[USER STATUS DEBUG] Verification query result structure:', JSON.stringify(verifyResult));
      
      let userData = null;
      
      // Handle different result structures that MySQL might return
      if (Array.isArray(verifyResult)) {
        // Case 0: Simple array of results - most common case
        if (verifyResult.length > 0 && typeof verifyResult[0] === 'object' && verifyResult[0].id) {
          // Direct array of objects [{ id, email, is_active }]
          userData = verifyResult[0];
        }
        // Case 1: Result is an array [resultSet, fields]
        else if (verifyResult[0] && Array.isArray(verifyResult[0])) {
          userData = verifyResult[0][0]; // First row of the result set
        } 
        // Case 2: Result set is at index 0 but not an array (might be an object with rows)
        else if (verifyResult[0] && typeof verifyResult[0] === 'object') {
          if (verifyResult[0].rows && verifyResult[0].rows.length > 0) {
            userData = verifyResult[0].rows[0];
          } else if (Array.isArray(verifyResult[0]) && verifyResult[0].length > 0) {
            userData = verifyResult[0][0];
          }
        }
      } else if (typeof verifyResult === 'object') {
        // Case 3: Result is a direct object
        if (Array.isArray(verifyResult.rows) && verifyResult.rows.length > 0) {
          userData = verifyResult.rows[0];
        } else if (verifyResult.length > 0) {
          userData = verifyResult[0];
        }
      }
      
      // Additional debug info to help troubleshoot
      debugLog('[USER STATUS DEBUG] Extracted user data:', userData);
      
      if (userData) {
        debugLog(`[USER STATUS VERIFY] User ${userId} (${userData.email}) status is now: is_active=${userData.is_active}`);
        // Commit the transaction if verification succeeded
        await transaction.commit();
        debugLog(`[USER STATUS] Transaction committed successfully for user ${userId}`);
        // Create status string for response message only
        const statusText = is_active ? 'activated' : 'deactivated';
        res.json({ 
          msg: `User has been ${statusText}.`, 
          user: {
            id: userData.id,
            email: userData.email,
            is_active: userData.is_active
          }
        });
      } else {
        // This should not happen normally but handle it just in case
        await transaction.rollback();
        console.error(`[USER STATUS ERROR] User ${userId} not found after update. Rolling back.`);
        return res.status(500).json({ msg: 'Failed to verify user status update.' });
      }
    } catch (txnError) {
      // Ensure transaction is rolled back on error
      await transaction.rollback().catch(rollbackErr => {
        console.error('[USER STATUS ERROR] Error during rollback:', rollbackErr);
      });
      console.error(`[USER STATUS ERROR] Transaction error for user ${userId}:`, txnError);
      throw txnError; // Re-throw to be caught by the outer catch
    }
  } catch (error) {
    console.error(`[USER STATUS ERROR] Error updating status for user ${userId}:`, error);
    res.status(500).json({ msg: 'Server error while updating user status.' });
  }
});

/**
 * @route   POST /api/users/:userId/resend-invitation
 * @desc    Resend invitation email to a user
 * @access  Private (requires USER_CREATE permission)
 */
/**
 * @route   POST /api/users/:userId/resend-invitation
 * @desc    Resend invitation email to user
 * @access  Private (requires users.create permission)
 */
router.post('/:userId/resend-invitation', requirePermission('users.create'), async (req, res) => {
    const { userId } = req.params;
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];

    // TODO: Implement actual email sending logic using a mail service.
    // 1. Find user by ID and tenant_id
    // 2. Check if user status is 'invited' or 'inactive'
    // 3. Generate a new invitation token with an expiry
    // 4. Send email with a link containing the token
    debugLog(`Resending invitation for user ${userId} in tenant ${tenant_id}`);

    // Placeholder response until email service is integrated
    res.json({ msg: 'Invitation has been resent successfully.' });
});

/**
 * @route   DELETE /api/users/:userId
 * @desc    Hard delete a user
 * @access  Private (requires users.delete permission)
 */
router.delete('/:userId', requirePermission('users.delete'), async (req, res) => {
    const { userId } = req.params;
    const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];

    debugLog(`[USER DELETE] Attempting to delete user ${userId} from tenant ${tenant_id}`);
    
    try {
        // Start a transaction to ensure all related records are deleted or none
        const transaction = await db.beginTransaction();

        try {
            // First check if user exists and belongs to the tenant
            const [userCheck] = await transaction.query(
                'SELECT id FROM users WHERE id = ? AND tenant_id = ?',
                [userId, tenant_id]
            );

            // Use proper result extraction
            const userExists = Array.isArray(userCheck) ? userCheck.length > 0 : 
                               (userCheck && userCheck.length > 0);

            if (!userExists) {
                await transaction.rollback();
                return res.status(404).json({ msg: 'User not found or doesn\'t belong to this tenant' });
            }

            // Delete associated records in a specific order to maintain referential integrity
            debugLog(`[USER DELETE] Removing role assignments for user ${userId}`);
            
            // 1. Delete tenant role assignments
            await transaction.query(
                'DELETE FROM user_roles WHERE user_id = ?',
                [userId]
            );
            
            // 2. Delete system role assignments
            await transaction.query(
                'DELETE FROM user_system_roles WHERE user_id = ?',
                [userId]
            );
            
            // 3. Finally delete the user
            debugLog(`[USER DELETE] Removing user ${userId} from users table`);
            const [deleteResult] = await transaction.query(
                'DELETE FROM users WHERE id = ? AND tenant_id = ?',
                [userId, tenant_id]
            );

            // Check if any rows were affected
            const rowsAffected = deleteResult.affectedRows || 0;
            
            if (rowsAffected === 0) {
                // This shouldn't happen if we checked existence earlier, but handle it just in case
                await transaction.rollback();
                return res.status(404).json({ msg: 'User not found or couldn\'t be deleted' });
            }

            // Commit the transaction if everything succeeded
            await transaction.commit();
            debugLog(`[USER DELETE] Successfully deleted user ${userId}`);
            
            res.json({
                msg: 'User has been permanently deleted',
                id: userId
            });
        } catch (txnError) {
            // Roll back the transaction if any query fails
            await transaction.rollback().catch(rollbackErr => {
                console.error('[USER DELETE ERROR] Error during rollback:', rollbackErr);
            });
            console.error(`[USER DELETE ERROR] Transaction error for user ${userId}:`, txnError);
            throw txnError; // Re-throw to be caught by the outer catch
        }
    } catch (error) {
        console.error(`[USER DELETE ERROR] Error deleting user ${userId}:`, error);
        res.status(500).json({ msg: 'Server error while deleting user' });
    }
});

module.exports = router;
