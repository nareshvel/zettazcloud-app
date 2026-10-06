/**
 * Unified RBAC Service
 * 
 * This service consolidates functionality from userRoleService.js and userRbacService.js
 * to provide a complete Role-Based Access Control (RBAC) system.
 * 
 * Features:
 * - Role assignment & removal for both system and tenant levels
 * - Permission-based access control
 * - Role and permission retrieval optimized for authentication
 * - Support for tenant and store-specific permissions
 */
const { pool } = require('../config/db');
const logger = require('../logger');
const cacheService = require('./cacheService');
const { v4: uuidv4 } = require('uuid');

// Cache TTL constants
const RBAC_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Import other services if needed
const roleService = require('./roleService');

/*************************************
 * CACHE INVALIDATION
 * getUserRolesAndPermissions results are cached under keys shaped
 * `rbac:${userId}:${tenantId}:${storeId}`. Every write to user_roles or
 * role_permissions must flush the affected users' keys or revocations and
 * grants take up to 5 minutes to take effect.
 *************************************/
const invalidateUserCache = (userId) => {
  if (!userId) return;
  try {
    cacheService.deleteByPrefix(`rbac:${userId}:`);
  } catch (e) {
    console.error('Error invalidating RBAC cache for user:', e.message);
  }
};

/**
 * Flush the cached permission sets of every user assigned a given role.
 * Called after role_permissions changes for that role.
 * @param {string} roleId
 */
const invalidateRoleUsersCache = async (roleId) => {
  if (!roleId) return;
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT user_id FROM user_roles WHERE role_id = ?',
      [roleId]
    );
    for (const row of rows) invalidateUserCache(row.user_id);
  } catch (e) {
    console.error('Error invalidating RBAC cache for role users:', e.message);
  }
};

/*************************************
 * ROLE ASSIGNMENT FUNCTIONS
 *************************************/

/**
 * Assign system role to user
 * 
 * @param {string} userId - User ID
 * @param {string} roleId - Role ID
 * @param {string} assignedBy - User ID who assigned the role
 * @returns {Promise<Object>} Assignment result
 */
const assignSystemRole = async (userId, roleId, assignedBy) => {
  if (!userId || !roleId) {
    throw new Error('User ID and Role ID are required');
  }

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check if role exists
    const [roleExists] = await connection.query(
      'SELECT id FROM system_roles WHERE id = ?', 
      [roleId]
    );
    
    if (!roleExists || roleExists.length === 0) {
      throw new Error(`System role with ID ${roleId} does not exist`);
    }
    
    // Check if assignment already exists
    const [existingAssignment] = await connection.query(
      'SELECT id FROM user_system_roles WHERE user_id = ? AND role_id = ?',
      [userId, roleId]
    );
    
    if (existingAssignment && existingAssignment.length > 0) {
      await connection.commit();
      return { id: existingAssignment[0].id, alreadyExists: true };
    }
    
    // Create new assignment
    const assignmentId = uuidv4();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    await connection.query(
      `INSERT INTO user_system_roles 
       (id, user_id, role_id, assigned_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [assignmentId, userId, roleId, assignedBy, now, now]
    );
    
    await connection.commit();
    invalidateUserCache(userId);
    return { id: assignmentId, success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Remove system role from user
 * 
 * @param {string} userId - User ID
 * @param {string} roleId - Role ID
 * @returns {Promise<boolean>} Success status
 */
const removeSystemRole = async (userId, roleId) => {
  if (!userId || !roleId) {
    throw new Error('User ID and Role ID are required');
  }
  
  try {
    const [result] = await pool.query(
      'DELETE FROM user_system_roles WHERE user_id = ? AND role_id = ?',
      [userId, roleId]
    );
    
    if (result.affectedRows > 0) invalidateUserCache(userId);
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error removing system role:', error);
    throw error;
  }
};

/**
 * Assign tenant role to user with scope
 * 
 * @param {string} userId - User ID
 * @param {string} roleId - Role ID
 * @param {string} tenantId - Tenant ID
 * @param {string} scope - Role scope ('tenant' or 'store')
 * @param {string} storeId - Store ID (required if scope is 'store')
 * @param {string} assignedBy - User ID who assigned the role
 * @returns {Promise<Object>} Assignment result
 */
const assignTenantRole = async (userId, roleId, tenantId, scope = 'tenant', storeId = null, assignedBy, expiresAt = null) => {
  // Early validation to prevent errors
  if (!userId || !roleId || !tenantId) {
    throw new Error('User ID, Role ID, and Tenant ID are required');
  }
  
  if (scope === 'store' && !storeId) {
    throw new Error('Store ID is required for store-scoped role assignments');
  }

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check if role exists and belongs to tenant
    const [roleExists] = await connection.query(
      'SELECT id FROM roles WHERE id = ? AND tenant_id = ?', 
      [roleId, tenantId]
    );
    
    if (!roleExists || roleExists.length === 0) {
      throw new Error(`Role with ID ${roleId} does not exist in tenant ${tenantId}`);
    }
    
    // Check if assignment already exists
    let existingQuery = 'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ? AND scope = ?';
    let existingParams = [userId, roleId, scope];
    
    // Add store ID check for store-scoped roles
    if (scope === 'store') {
      existingQuery += ' AND store_id = ?';
      existingParams.push(storeId);
    } else {
      existingQuery += ' AND store_id IS NULL';
    }
    
    const [existingAssignment] = await connection.query(existingQuery, existingParams);
    
    if (existingAssignment && existingAssignment.length > 0) {
      await connection.commit();
      return { id: existingAssignment[0].id, alreadyExists: true };
    }
    
    // Create new assignment
    const assignmentId = uuidv4();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    await connection.query(
      `INSERT INTO user_roles
       (id, user_id, role_id, scope, expires_at, store_id, assigned_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [assignmentId, userId, roleId, scope, expiresAt, scope === 'store' ? storeId : null, assignedBy, now, now]
    );
    
    await connection.commit();
    invalidateUserCache(userId);
    return { id: assignmentId, success: true };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Remove tenant role from user
 * 
 * @param {string} assignmentId - User role assignment ID
 * @param {string} userId - User ID (for verification)
 * @param {string} tenantId - Tenant ID (for verification)
 * @returns {Promise<boolean>} Success status
 */
const removeTenantRole = async (assignmentId, userId, tenantId) => {
  if (!assignmentId || !userId || !tenantId) {
    throw new Error('Assignment ID, User ID, and Tenant ID are required');
  }
  
  try {
    // Verify the assignment belongs to the specified user and tenant
    const [result] = await pool.query(
      `DELETE ur FROM user_roles ur
       JOIN roles r ON ur.role_id = r.id
       WHERE ur.id = ? AND ur.user_id = ? AND r.tenant_id = ?`,
      [assignmentId, userId, tenantId]
    );
    
    if (result.affectedRows > 0) invalidateUserCache(userId);
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Error removing tenant role:', error);
    throw error;
  }
};

/*************************************
 * ROLE RETRIEVAL FUNCTIONS
 *************************************/

/**
 * Get system roles for a user
 * 
 * @param {string} userId - User ID
 * @returns {Promise<Array>} User's system roles
 */
const getUserSystemRoles = async (userId) => {
  try {
    const query = `
      SELECT sr.*
      FROM system_roles sr
      JOIN user_system_roles usr ON sr.id = usr.role_id
      WHERE usr.user_id = ?
    `;
    
    const [roles] = await pool.query(query, [userId]);
    return roles;
  } catch (error) {
    console.error('Error getting user system roles:', error);
    throw error;
  }
};

/**
 * Get tenant roles for a user with scope information
 * 
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @param {Object} options - Query options
 * @param {string} options.storeId - Filter by store ID for store-scoped roles
 * @param {string} options.scope - Filter by scope ('tenant' or 'store')
 * @returns {Promise<Array>} User's tenant roles
 */
const getUserTenantRoles = async (userId, tenantId, options = {}) => {
  try {
    let query = `
      SELECT 
        r.*,
        ur.id as assignment_id,
        ur.scope,
        ur.store_id,
        ur.expires_at,
        ur.created_at as assigned_at,
        ur.assigned_by,
        s.name as store_name
      FROM roles r
      JOIN user_roles ur ON r.id = ur.role_id
      LEFT JOIN stores s ON ur.store_id = s.id
      WHERE ur.user_id = ? AND r.tenant_id = ?
    `;
    
    const params = [userId, tenantId];
    
    // Add filters
    if (options.storeId) {
      query += ' AND (ur.store_id = ? OR ur.scope = "tenant")';
      params.push(options.storeId);
    }
    
    if (options.scope) {
      query += ' AND ur.scope = ?';
      params.push(options.scope);
    }
    
    // Order by scope (tenant roles first) and then by role name
    query += ' ORDER BY FIELD(ur.scope, "tenant", "store"), r.name';
    
    const [roles] = await pool.query(query, params);
    return roles;
  } catch (error) {
    console.error('Error getting user tenant roles:', error);
    throw error;
  }
};

/*************************************
 * PERMISSION FUNCTIONS
 *************************************/

/**
 * Get all roles and permissions for a user
 * @param {string} userId - User ID
 * @param {string} tenantId - Optional tenant ID to filter roles
 * @param {string} storeId - Optional store ID to filter roles
 * @returns {Promise<Object>} Roles and permissions
 */
const getUserRolesAndPermissions = async (userId, tenantId = null, storeId = null) => {
  if (!userId) {
    logger.error('RBAC Error: User ID is required');
    throw new Error('User ID is required');
  }
  
  // Generate cache key based on inputs
  const cacheKey = `rbac:${userId}:${tenantId || 'null'}:${storeId || 'null'}`;

  const cachedData = cacheService.get(cacheKey);
  if (cachedData) {
    logger.debug(`[RBAC] Cache hit for user ${userId}`);
    return cachedData;
  }

  try {
    // Default return object in case of errors or empty results
    const emptyResult = {
      roles: [],
      roleNames: [],
      systemRoles: [],
      permissions: []
    };

    // Build query constraints based on tenant and store context
    let constraints = [];
    let params = [userId];

    // Tenant containment: only roles owned by the request tenant (or the user's
    // own tenant — some early-seeded data mismatched user.tenant_id vs
    // role.tenant_id) may grant permissions. Without this, a caller could pass
    // another tenant's ID in ?tenantId and have their home-tenant roles
    // evaluated against it — a cross-tenant privilege leak. Rows with
    // r.tenant_id IS NULL are pre-normalization system rows.
    constraints.push(`(r.tenant_id IS NULL
      OR r.tenant_id = ?
      OR r.tenant_id = (SELECT u.tenant_id FROM users u WHERE u.id = ?))`);
    params.push(tenantId, userId);

    // Add store filter - prioritize store-specific roles
    // When storeId is provided, we get both:
    // 1. Store-specific roles for this specific store
    // 2. Tenant-level roles (where store_id is NULL)
    // When NO storeId is provided, only tenant-scoped roles apply — otherwise
    // a store-scoped role would leak into requests outside that store.
    if (storeId) {
      constraints.push('(ur.store_id = ? OR ur.scope = "tenant")');
      params.push(storeId);
    } else {
      constraints.push('ur.scope = "tenant"');
    }

    // Build the constraint part of the SQL query
    const constraintSQL = constraints.length > 0 
      ? `AND ${constraints.join(' AND ')}` 
      : '';

    // Get user's roles - using a safer query format
    try {
      const userRolesQuery = `
        SELECT 
          r.id as role_id, 
          r.name as role_name, 
          r.description as role_description,
          r.tenant_id,
          ur.scope,
          ur.store_id
        FROM 
          user_roles ur
        JOIN 
          roles r ON ur.role_id = r.id
        WHERE
          ur.user_id = ?
          AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
          ${constraintSQL}
      `;
      
      logger.debug(`[RBAC] Role query for user ${userId}: ${userRolesQuery}`, params);
      const [userRoles] = await pool.query(userRolesQuery, params);

      if (!userRoles || !Array.isArray(userRoles)) {
        logger.error(`[RBAC] Invalid response from roles query for user ${userId}`);
        return emptyResult;
      }
      
      // If no roles found, return empty result
      if (userRoles.length === 0) {
        logger.warn(`[RBAC] No roles found for user ${userId}`);
        return emptyResult;
      }

      // Process roles into a cleaner format and extract role IDs
      const roles = [];
      const roleIds = new Set();
      const roleMap = {};

      // Process user roles with store context prioritization
      userRoles.forEach(role => {
        if (!role || !role.role_id || !role.role_name) {
          logger.warn(`[RBAC] Invalid role data in results: ${JSON.stringify(role)}`);
          return; // Skip this invalid role
        }

        const roleData = {
          id: role.role_id,
          name: role.role_name,
          description: role.role_description,
          scope: role.scope || 'tenant', // Default to tenant scope if not specified
          storeId: role.store_id,
          tenant_id: role.tenant_id // Keep track of tenant_id for system role detection
        };

        // Every assigned role contributes its permissions — grants are additive.
        // The name-based dedup below only affects the display list (roles/roleNames);
        // it must NOT drop roleIds or a same-named role's permissions vanish silently.
        roleIds.add(role.role_id);

        // Store-scoped roles take precedence over tenant-scoped roles with the same name
        // If a role with this name exists but the new one is store-scoped and we have the right store context, replace it
        const existingRole = roleMap[role.role_name];
        const isStoreSpecificRole = role.scope === 'store' && role.store_id === storeId;

        // Either add the role if it doesn't exist or replace tenant-scoped with store-scoped
        if (!existingRole || (isStoreSpecificRole && existingRole.scope === 'tenant')) {
          // If replacing, remove the old role from the roles array
          if (existingRole) {
            const index = roles.findIndex(r => r.id === existingRole.id);
            if (index !== -1) {
              roles.splice(index, 1);
            }
          }

          roles.push(roleData);

          // Map role name to role data for easier access
          roleMap[role.role_name] = roleData;
        }
      });

      // Get permissions for these roles - only if we have roles
      const permissions = [];
      const permissionSet = new Set(); // For deduplication

      if (roleIds.size > 0) {
        try {
          const roleIdList = [...roleIds];
          const placeholders = roleIdList.map(() => '?').join(',');

          const permissionsQuery = `
            SELECT 
              p.name as permission_name,
              p.description as permission_description
            FROM 
              role_permissions rp
            JOIN 
              permissions p ON rp.permission_id = p.id
            WHERE 
              rp.role_id IN (${placeholders})
          `;

          logger.debug(`[RBAC] Permission query for roleIds ${roleIdList.join(',')}: ${permissionsQuery}`);
          const [rolePermissions] = await pool.query(permissionsQuery, roleIdList);

          if (!rolePermissions || !Array.isArray(rolePermissions)) {
            logger.error(`[RBAC] Invalid response from permissions query for user ${userId}`);
          } else {
            // Process permissions
            rolePermissions.forEach(perm => {
              if (!perm || !perm.permission_name) {
                logger.warn(`[RBAC] Invalid permission data: ${JSON.stringify(perm)}`);
                return; // Skip this invalid permission
              }
              
              // Deduplicate permissions
              if (!permissionSet.has(perm.permission_name)) {
                permissionSet.add(perm.permission_name);
                permissions.push({
                  name: perm.permission_name,
                  description: perm.permission_description || ''
                });
              }
            });
          }
        } catch (permError) {
          logger.error(`[RBAC] Error fetching permissions: ${permError.message}`);
          // Continue with the roles we have but without permissions
        }
      } else {
        logger.warn(`[RBAC] No role IDs available to fetch permissions`);
      }

      // Extract system roles vs tenant roles
      const systemRoles = roles
        .filter(role => !role.tenant_id)
        .map(role => role.name);

      // Per-user grant/deny overrides (Phase 2c). Tenant-wide rows
      // (store_id IS NULL) apply everywhere; store-scoped rows apply only in
      // that store context and win over a tenant-wide row for the same
      // permission. deny beats grant at the same scope. Expired rows are
      // ignored at read time.
      const overrides = [];
      try {
        const [overrideRows] = await pool.query(
          `SELECT p.name AS permission_name, upo.effect, upo.store_id
           FROM user_permission_overrides upo
           JOIN permissions p ON p.id = upo.permission_id
           WHERE upo.user_id = ?
             AND upo.tenant_id = ?
             AND (upo.store_id IS NULL OR upo.store_id = ?)
             AND (upo.expires_at IS NULL OR upo.expires_at > NOW())`,
          [userId, tenantId, storeId || '']
        );
        overrides.push(...(overrideRows || []));
      } catch (ovErr) {
        // Table may not exist pre-migration — fail open to role-only grants
        if (ovErr.code !== 'ER_NO_SUCH_TABLE') {
          logger.error(`[RBAC] Error fetching permission overrides: ${ovErr.message}`);
        }
      }

      // Apply least-specific first, then store-scoped; deny wins ties
      overrides.sort((a, b) => (a.store_id ? 1 : 0) - (b.store_id ? 1 : 0));
      const overrideMap = {};
      overrides.forEach(o => {
        const prev = overrideMap[o.permission_name];
        // deny sticks; a store-scoped row overrides a tenant-wide decision
        if (!prev || (prev.scope !== o.store_id) || (prev.effect === 'grant' && o.effect === 'deny')) {
          overrideMap[o.permission_name] = { effect: o.effect, scope: o.store_id };
        }
      });
      Object.entries(overrideMap).forEach(([perm, o]) => {
        if (o.effect === 'deny') {
          permissionSet.delete(perm);
        } else {
          permissionSet.add(perm);
        }
      });

      // Extract just the permission names for easier consumption
      const permissionNames = [...permissionSet];

      // Create the final result object
      const result = {
        roles,                      // Full role objects with metadata
        roleNames: Object.keys(roleMap),  // Just the role names
        systemRoles,               // System role names (global roles)
        permissions: permissionNames // Just permission names
      };
      
      // Cache the result — RBAC_CACHE_TTL (the previous `5 * 60` passed 300ms,
      // not 5 minutes). Invalidation on role/permission writes makes a real
      // TTL safe now.
      cacheService.set(cacheKey, result, RBAC_CACHE_TTL);
      
      return result;
    } catch (queryError) {
      logger.error(`[RBAC] Error in user roles query: ${queryError.message}`);
      logger.error(queryError.stack);
      return emptyResult;
    }
  } catch (error) {
    logger.error(`[RBAC] Unexpected error in getUserRolesAndPermissions: ${error.message}`);
    logger.error(error.stack);
    // Return empty result set instead of throwing error
    return {
      roles: [],
      roleNames: [],
      systemRoles: [],
      permissions: []
    };
  }
};

/**
 * Check if user has a specific permission
 * 
 * @param {string} userId - User ID
 * @param {string} permission - Permission to check
 * @param {string} tenantId - Tenant ID
 * @param {string} storeId - Store ID (optional)
 * @returns {Promise<boolean>} True if user has permission
 */
const hasPermission = async (userId, permission, tenantId, storeId = null) => {
  try {
    // First check if user is a tenant admin - tenant admins bypass permission checks at tenant level
    if (tenantId && await isTenantAdmin(userId, tenantId)) {
      return true;
    }
    
    // Otherwise, check for specific permission
    const rbacData = await getUserRolesAndPermissions(userId, tenantId, storeId);
    const hasAccess = rbacData.permissions.includes(permission);
    
    // Log permission checks with store context for debugging
    if (storeId) {
      // Debug logging removed for cleaner console output
      // Debug logging removed for cleaner console output
      // Debug logging removed for cleaner console output
      // Debug logging removed for cleaner console output
      // Debug logging removed for cleaner console output
      // Debug logging removed for cleaner console output
      // Debug logging removed for cleaner console output
    }
    
    return hasAccess;
  } catch (error) {
    console.error('Error checking permission:', error);
    throw error;
  }
};

/**
 * Check if user is a tenant admin
 * Tenant admins have full access to tenant resources
 * 
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<boolean>} True if user is tenant admin
 */
const isTenantAdmin = async (userId, tenantId) => {
  try {
    // `is_system_role = 1` is load-bearing: without it, any user with role-create
    // rights could make a role literally named "Tenant Admin", self-assign it,
    // and bypass every permission check. Only the seeded system role counts.
    const query = `
      SELECT COUNT(*) as count
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
        AND r.tenant_id = ?
        AND LOWER(REPLACE(r.name, ' ', '_')) = 'tenant_admin'
        AND r.is_system_role = 1
    `;
    
    const [result] = await pool.query(query, [userId, tenantId]);
    return result[0].count > 0;
  } catch (error) {
    console.error('Error checking tenant admin status:', error);
    return false;
  }
};

/**
 * Get all permissions a user has in a tenant
 * 
 * @param {string} userId - User ID
 * @param {string} tenantId - Tenant ID
 * @param {string} storeId - Store ID (optional)
 * @returns {Promise<Array<string>>} List of permission names
 */
const getUserPermissions = async (userId, tenantId, storeId = null) => {
  try {
    const rbacData = await getUserRolesAndPermissions(userId, tenantId, storeId);
    return rbacData.permissions;
  } catch (error) {
    console.error('Error getting user permissions:', error);
    throw error;
  }
};

/*************************************
 * PER-USER PERMISSION OVERRIDES (Phase 2c)
 *************************************/

// Permissions that must never be grantable via tenant-level overrides —
// same boundary the role-permission write path enforces.
const TENANT_BLOCKED_PREFIX = /^(platform|system|tenants|subscriptions|plans|support)\./;

/**
 * List a user's permission overrides for a tenant.
 */
const getUserPermissionOverrides = async (userId, tenantId) => {
  const [rows] = await pool.query(
    `SELECT upo.id, upo.user_id, upo.tenant_id, upo.store_id, upo.effect,
            upo.expires_at, upo.reason, upo.created_by, upo.created_at, upo.updated_at,
            p.name AS permission_name, p.id AS permission_id,
            s.name AS store_name
     FROM user_permission_overrides upo
     JOIN permissions p ON p.id = upo.permission_id
     LEFT JOIN stores s ON s.id = upo.store_id
     WHERE upo.user_id = ? AND upo.tenant_id = ?
     ORDER BY upo.store_id IS NULL DESC, p.name`,
    [userId, tenantId]
  );
  return rows;
};

/**
 * Upsert a grant/deny override. (user_id, permission_id, store_id) is unique;
 * NULL store_id needs an application-level dedup since MySQL unique keys
 * ignore NULLs.
 * @returns the override row id
 */
const setUserPermissionOverride = async ({ userId, tenantId, storeId = null, permissionId, effect, expiresAt = null, reason = null, createdBy = null }) => {
  if (!userId || !tenantId || !permissionId) throw new Error('userId, tenantId and permissionId are required');
  if (!['grant', 'deny'].includes(effect)) throw new Error('effect must be grant or deny');

  // Resolve the permission — must exist and (for grants) be tenant-scoped
  const [permRows] = await pool.query('SELECT id, name FROM permissions WHERE id = ?', [permissionId]);
  if (!permRows.length) throw new Error('Permission not found');
  if (effect === 'grant' && TENANT_BLOCKED_PREFIX.test(permRows[0].name)) {
    throw new Error(`System permissions cannot be granted via user overrides: ${permRows[0].name}`);
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM user_permission_overrides
       WHERE user_id = ? AND permission_id = ? AND tenant_id = ?
         AND (store_id = ? OR (store_id IS NULL AND ? IS NULL))`,
      [userId, permissionId, tenantId, storeId, storeId]
    );
    const id = uuidv4();
    await connection.query(
      `INSERT INTO user_permission_overrides
         (id, user_id, tenant_id, store_id, permission_id, effect, expires_at, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, tenantId, storeId, permissionId, effect, expiresAt, reason, createdBy]
    );
    await connection.commit();
    invalidateUserCache(userId);
    return id;
  } catch (e) {
    await connection.rollback().catch(() => {});
    throw e;
  } finally {
    connection.release();
  }
};

const removeUserPermissionOverride = async (overrideId, tenantId) => {
  const [rows] = await pool.query(
    'SELECT user_id FROM user_permission_overrides WHERE id = ? AND tenant_id = ?',
    [overrideId, tenantId]
  );
  if (!rows.length) return false;
  await pool.query('DELETE FROM user_permission_overrides WHERE id = ?', [overrideId]);
  invalidateUserCache(rows[0].user_id);
  return true;
};

module.exports = {
  // Role assignment functions
  assignSystemRole,
  removeSystemRole,
  assignTenantRole,
  removeTenantRole,
  
  // Role retrieval functions
  getUserSystemRoles,
  getUserTenantRoles,
  
  // Permission functions
  getUserRolesAndPermissions,
  getUserPermissions,
  hasPermission,
  isTenantAdmin,

  // Per-user permission overrides
  getUserPermissionOverrides,
  setUserPermissionOverride,
  removeUserPermissionOverride,

  // Cache invalidation (call after any user_roles / role_permissions write)
  invalidateUserCache,
  invalidateRoleUsersCache
};
