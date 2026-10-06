/**
 * Permission Service
 * Manages both system and tenant-level permissions
 */
const { pool } = require('../config/db');

/**
 * Get all system permissions
 * 
 * @param {Object} options - Query options
 * @param {String} options.module - Filter by module
 * @returns {Promise<Array>} System permissions
 */
const getSystemPermissions = async (options = {}) => {
  try {
    let query = 'SELECT * FROM system_permissions';
    const params = [];
    
    if (options.module) {
      query += ' WHERE module = ?';
      params.push(options.module);
    }
    
    query += ' ORDER BY module, name';
    
    const [permissions] = await pool.query(query, params);
    return permissions;
  } catch (error) {
    console.error('Error in getSystemPermissions:', error);
    throw error;
  }
};

/**
 * Get all tenant permissions
 * 
 * @param {Object} options - Query options
 * @param {String} options.module - Filter by module
 * @returns {Promise<Array>} Tenant permissions
 */
const getTenantPermissions = async (options = {}) => {
  try {
    let query = 'SELECT * FROM permissions';
    const params = [];
    
    if (options.module) {
      query += ' WHERE module = ?';
      params.push(options.module);
    }
    
    query += ' ORDER BY module, name';
    
    const [permissions] = await pool.query(query, params);
    return permissions;
  } catch (error) {
    console.error('Error in getTenantPermissions:', error);
    throw error;
  }
};

/**
 * Get permissions by role ID
 * 
 * @param {String} roleId - Role ID
 * @param {Boolean} isSystemRole - Whether this is a system role
 * @returns {Promise<Array>} Permissions associated with the role
 */
const getPermissionsByRoleId = async (roleId, isSystemRole = false) => {
  try {
    let query;
    if (isSystemRole) {
      query = `
        SELECT sp.*
        FROM system_permissions sp
        JOIN system_role_permissions srp ON sp.id = srp.permission_id
        WHERE srp.role_id = ?
        ORDER BY sp.module, sp.name
      `;
    } else {
      query = `
        SELECT p.*
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ?
        ORDER BY p.module, p.name
      `;
    }
    
    const [permissions] = await pool.query(query, [roleId]);
    return permissions;
  } catch (error) {
    console.error('Error in getPermissionsByRoleId:', error);
    throw error;
  }
};

/**
 * Get all permissions for a user (both system and tenant level)
 * 
 * @param {String} userId - User ID
 * @param {String} tenantId - Tenant ID
 * @param {String} storeId - Optional store ID for store-scoped permissions
 * @returns {Promise<Object>} User's permissions object
 */
const getUserPermissions = async (userId, tenantId, storeId = null) => {
  try {
    // Get system permissions for user
    const systemPermissionsQuery = `
      SELECT DISTINCT sp.name
      FROM system_permissions sp
      JOIN system_role_permissions srp ON sp.id = srp.permission_id
      JOIN user_system_roles usr ON srp.role_id = usr.role_id
      WHERE usr.user_id = ?
    `;
    
    // Get tenant-level permissions for user
    // Debug logging removed for cleaner console output
    
    // Modified query to avoid using tenant_id column in user_roles table
    // Instead, use the scope and check that role belongs to the tenant
    const tenantPermissionsQuery = `
      SELECT DISTINCT p.name
      FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      JOIN user_roles ur ON rp.role_id = ur.role_id
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
        AND (
          (ur.scope = 'tenant' AND r.tenant_id = ?)
          OR (ur.scope = 'store' AND ${storeId ? 'ur.store_id = ?' : 'ur.store_id IS NOT NULL'})
        )
    `;
    
    // Debug logging removed for cleaner console output
    
    const params = storeId ? [userId, tenantId, storeId] : [userId, tenantId];
    
    let systemPermissions = [];
    let tenantPermissions = [];
    
    try {
      // Add debugging to see what's happening with the queries
      // Debug logging removed for cleaner console output
      
      const [systemPermissionsResult] = await pool.query(systemPermissionsQuery, [userId]);
      const [tenantPermissionsResult] = await pool.query(tenantPermissionsQuery, params);
      
      // Debug logging removed for cleaner console output
      
      // Safely convert results to simple arrays with null checks
      systemPermissions = Array.isArray(systemPermissionsResult) 
        ? systemPermissionsResult.map(p => p.name) 
        : [];
        
      tenantPermissions = Array.isArray(tenantPermissionsResult) 
        ? tenantPermissionsResult.map(p => p.name) 
        : [];
    } catch (error) {
      console.error('Error in getUserPermissions:', error);
      // Return empty arrays in case of error
      systemPermissions = [];
      tenantPermissions = [];
    }
    
    // Group permissions by module
    const permissionsByModule = {};
    
    try {
      // Get all modules
      const [systemModules] = await pool.query('SELECT DISTINCT module FROM system_permissions');
      const [tenantModules] = await pool.query('SELECT DISTINCT module FROM permissions');
      
      // Initialize modules with null checks
      const allModules = [
        ...(Array.isArray(systemModules) ? systemModules : []), 
        ...(Array.isArray(tenantModules) ? tenantModules : [])
      ];
      
      allModules.forEach(m => {
        if (m && m.module) {
          const module = m.module;
          if (!permissionsByModule[module]) {
            permissionsByModule[module] = [];
          }
        }
      });
    } catch (error) {
      console.error('Error getting permission modules:', error);
      // Continue with empty modules object
    }
    
    // Process permissions by module - doing this directly with the arrays we already have
    // No need to iterate over results again
    
    // Add system permissions to modules
    systemPermissions.forEach(permName => {
      const [module] = permName.split('.');
      if (permissionsByModule[module]) {
        permissionsByModule[module].push(permName);
      }
    });
    
    // Add tenant permissions to modules
    tenantPermissions.forEach(permName => {
      const [module] = permName.split('.');
      if (permissionsByModule[module]) {
        permissionsByModule[module].push(permName);
      }
    });
    
    return {
      all: [...systemPermissions, ...tenantPermissions],
      system: systemPermissions,
      tenant: tenantPermissions,
      byModule: permissionsByModule
    };
  } catch (error) {
    console.error('Error in getUserPermissions:', error);
    throw error;
  }
};

/**
 * Check if a user is a tenant admin
 * 
 * @param {String} userId - User ID 
 * @param {String} tenantId - Tenant ID
 * @param {Object} req - Express request object (optional, for token role check)
 * @returns {Promise<Boolean>} Whether user is a tenant admin
 */
const isTenantAdmin = async (userId, tenantId, req = null) => {
  try {
    if (!userId || !tenantId) {
      return false;
    }
    
    // First check if the JWT token has an admin role - backward compatibility
    if (req?.user?.role === 'admin') {
      return true;
    }
    
    // Check if user has the tenant_admin role in the database
    const query = `
      SELECT 1
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ? 
        AND r.tenant_id = ?
        AND (r.name = 'tenant_admin' OR r.name = 'admin')
        AND ur.scope = 'tenant'
    `;
    
    const [result] = await pool.query(query, [userId, tenantId]);
    const isAdmin = Array.isArray(result) && result.length > 0;
    
    return isAdmin;
  } catch (error) {
    console.error('Error in isTenantAdmin:', error);
    return false; // Fail safe - if we can't verify admin status, don't grant admin privileges
  }
};

/**
 * Check if user has specific permission
 * 
 * @param {String} userId - User ID
 * @param {String} permission - Permission name
 * @param {String} tenantId - Tenant ID
 * @param {String} storeId - Optional store ID for store-scoped permissions
 * @param {Object} req - Express request object (optional)
 * @returns {Promise<Boolean>} Whether user has the permission
 */
const hasPermission = async (userId, permission, tenantId, storeId = null, req = null) => {
  try {
    // First check if user is a tenant admin - tenant admins bypass permission checks at tenant level
    if (tenantId && await isTenantAdmin(userId, tenantId, req)) {
      return true;
    }
    
    // Otherwise, check specific permission
    const userPermissions = await getUserPermissions(userId, tenantId, storeId);
    return userPermissions.all.includes(permission);
  } catch (error) {
    console.error('Error in hasPermission:', error);
    throw error;
  }
};

/**
 * Get user's accessible stores with permissions
 * 
 * @param {String} userId - User ID
 * @param {String} tenantId - Tenant ID
 * @returns {Promise<Array>} Stores with permissions
 */
const getUserAccessibleStores = async (userId, tenantId) => {
  try {
    // Check if user has tenant-wide access
    const tenantAccessQuery = `
      SELECT COUNT(*) as count
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
        AND r.tenant_id = ?
        AND ur.scope = 'tenant'
    `;
    
    const [tenantAccess] = await pool.query(tenantAccessQuery, [userId, tenantId]);
    const hasTenantAccess = tenantAccess[0].count > 0;
    
    // If user has tenant-wide access, return all stores
    if (hasTenantAccess) {
      const storesQuery = 'SELECT * FROM stores WHERE tenant_id = ?';
      const [stores] = await pool.query(storesQuery, [tenantId]);
      
      // Get permissions for each store
      const storesWithPermissions = await Promise.all(
        stores.map(async (store) => {
          const permissions = await getUserPermissions(userId, tenantId, store.id);
          return {
            ...store,
            permissions: permissions.tenant
          };
        })
      );
      
      return storesWithPermissions;
    }
    
    // Otherwise, return only stores with specific access
    const storeAccessQuery = `
      SELECT DISTINCT s.*
      FROM stores s
      JOIN user_roles ur ON s.id = ur.store_id
      WHERE ur.user_id = ?
        AND s.tenant_id = ?
        AND ur.scope = 'store'
    `;
    
    const [stores] = await pool.query(storeAccessQuery, [userId, tenantId]);
    
    // Get permissions for each store
    const storesWithPermissions = await Promise.all(
      stores.map(async (store) => {
        const permissions = await getUserPermissions(userId, tenantId, store.id);
        return {
          ...store,
          permissions: permissions.tenant
        };
      })
    );
    
    return storesWithPermissions;
  } catch (error) {
    console.error('Error in getUserAccessibleStores:', error);
    throw error;
  }
};

/**
 * Update permissions for a role
 * 
 * @param {String} roleId - Role ID
 * @param {Array<String>} permissionIds - Array of permission IDs to assign to the role
 * @param {Boolean} isSystemRole - Whether this is a system role
 * @returns {Promise<Boolean>} Success flag
 */
const updateRolePermissions = async (roleId, permissionIds, isSystemRole = false) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Delete existing permissions for this role
    if (isSystemRole) {
      await connection.query('DELETE FROM system_role_permissions WHERE role_id = ?', [roleId]);
    } else {
      await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    }
    
    // If there are permissions to add, insert them
    if (permissionIds && permissionIds.length > 0) {
      let insertQuery;
      
      if (isSystemRole) {
        insertQuery = 'INSERT INTO system_role_permissions (role_id, permission_id) VALUES ?';
      } else {
        insertQuery = 'INSERT INTO role_permissions (role_id, permission_id) VALUES ?';
      }
      
      // Create array of arrays for bulk insert
      const values = permissionIds.map(permissionId => [roleId, permissionId]);
      
      await connection.query(insertQuery, [values]);
    }
    
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    console.error('Error in updateRolePermissions:', error);
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  getSystemPermissions,
  getTenantPermissions,
  getPermissionsByRoleId,
  getUserPermissions,
  updateRolePermissions,
  hasPermission,
  isTenantAdmin,
  getUserAccessibleStores
};
