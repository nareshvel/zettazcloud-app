/**
 * Role Service
 * Manages both system and tenant-level roles
 */
// Fixed: Use the consistent database pool connection pattern
const { pool } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const permissionService = require('./permissionService');

// rbacService is lazily required inside functions — it already requires this
// module at its top level, so a top-level require here would create a cycle.
const rbacService = () => require('./rbacService');

// Reserved role names that a tenant must never (re)create or rename to —
// 'Tenant Admin' is hard-wired to the permission bypass in
// rbacService.isTenantAdmin, so a user-created role with that name would be an
// escalation path (isTenantAdmin also requires is_system_role=1 as a second gate).
const normalizeRoleName = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, '_');
const isReservedRoleName = (name) => normalizeRoleName(name) === 'tenant_admin';

// Prefixes that resolve through user_system_roles / platform scope, never
// role_permissions. Granting them to a tenant role is a dead grant at best
// and an escalation surface if semantics ever change — reject at write time.
const SYSTEM_PERMISSION_PREFIX = /^(platform|system|tenants|subscriptions|plans|support)\./;
const assertTenantAssignablePermissions = async (permissionIds, conn) => {
  if (!permissionIds || !permissionIds.length) return;
  const placeholders = permissionIds.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT name FROM permissions WHERE id IN (${placeholders})`,
    permissionIds
  );
  const blocked = (rows || []).map(r => r.name).filter(n => SYSTEM_PERMISSION_PREFIX.test(n));
  if (blocked.length) {
    throw new Error(`System permissions cannot be granted to tenant roles: ${blocked.join(', ')}`);
  }
};

/**
 * Get all system roles with optional permissions
 * 
 * @param {Object} options - Query options
 * @param {Boolean} options.includePermissions - Whether to include permissions
 * @returns {Promise<Array>} System roles
 */
const getSystemRoles = async (options = {}) => {
  try {
    const query = 'SELECT * FROM system_roles ORDER BY name';
    const [roles] = await pool.query(query);
    
    if (options.includePermissions) {
      // Get permissions for each role
      for (const role of roles) {
        role.permissions = await permissionService.getPermissionsByRoleId(role.id, true);
      }
    }
    
    return roles;
  } catch (error) {
    console.error('Error in getSystemRoles:', error);
    throw error;
  }
};

/**
 * Get system role by ID
 * 
 * @param {String} roleId - Role ID
 * @param {Object} options - Query options
 * @param {Boolean} options.includePermissions - Whether to include permissions
 * @returns {Promise<Object>} Role object
 */
const getSystemRoleById = async (roleId, options = {}) => {
  try {
    const query = 'SELECT * FROM system_roles WHERE id = ?';
    const [roles] = await pool.query(query, [roleId]);
    
    if (!roles.length) {
      return null;
    }
    
    const role = roles[0];
    
    if (options.includePermissions) {
      role.permissions = await permissionService.getPermissionsByRoleId(roleId, true);
    }
    
    return role;
  } catch (error) {
    console.error('Error in getSystemRoleById:', error);
    throw error;
  }
};

/**
 * Create system role
 * 
 * @param {Object} roleData - Role data
 * @param {String} roleData.name - Role name
 * @param {String} roleData.description - Role description
 * @param {Array} roleData.permissions - Permission IDs
 * @returns {Promise<Object>} Created role
 */
const createSystemRole = async (roleData) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const roleId = uuidv4();
    const role = {
      id: roleId,
      name: roleData.name,
      description: roleData.description
    };
    
    // Insert role
    await connection.query(
      'INSERT INTO system_roles (id, name, description) VALUES (?, ?, ?)',
      [roleId, role.name, role.description]
    );
    
    // Insert permissions
    if (roleData.permissions && roleData.permissions.length) {
      const permissionValues = roleData.permissions.map(permissionId => [roleId, permissionId]);
      await connection.query(
        'INSERT INTO system_role_permissions (role_id, permission_id) VALUES ?',
        [permissionValues]
      );
    }
    
    await connection.commit();
    
    // Get created role with permissions
    const createdRole = await getSystemRoleById(roleId, { includePermissions: true });
    return createdRole;
  } catch (error) {
    await connection.rollback();
    console.error('Error in createSystemRole:', error);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Update system role
 * 
 * @param {String} roleId - Role ID
 * @param {Object} roleData - Role data
 * @param {String} roleData.name - Role name
 * @param {String} roleData.description - Role description
 * @param {Array} roleData.permissions - Permission IDs
 * @returns {Promise<Object>} Updated role
 */
const updateSystemRole = async (roleId, roleData) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check if role exists
    const [existingRoles] = await connection.query(
      'SELECT * FROM system_roles WHERE id = ?',
      [roleId]
    );
    
    if (!existingRoles.length) {
      throw new Error(`System role with ID ${roleId} not found`);
    }
    
    // Update role
    await connection.query(
      'UPDATE system_roles SET name = ?, description = ? WHERE id = ?',
      [roleData.name, roleData.description, roleId]
    );
    
    // Update permissions if provided
    if (roleData.permissions) {
      // Delete existing permissions
      await connection.query(
        'DELETE FROM system_role_permissions WHERE role_id = ?',
        [roleId]
      );
      
      // Insert new permissions
      if (roleData.permissions.length) {
        const permissionValues = roleData.permissions.map(permissionId => [roleId, permissionId]);
        await connection.query(
          'INSERT INTO system_role_permissions (role_id, permission_id) VALUES ?',
          [permissionValues]
        );
      }
    }
    
    await connection.commit();
    
    // Get updated role with permissions
    const updatedRole = await getSystemRoleById(roleId, { includePermissions: true });
    return updatedRole;
  } catch (error) {
    await connection.rollback();
    console.error('Error in updateSystemRole:', error);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Delete system role
 * 
 * @param {String} roleId - Role ID
 * @returns {Promise<Boolean>} Success status
 */
const deleteSystemRole = async (roleId) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check if role is assigned to users
    const [assignments] = await connection.query(
      'SELECT COUNT(*) as count FROM user_system_roles WHERE role_id = ?',
      [roleId]
    );
    
    if (assignments[0].count > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }
    
    // Delete permissions
    await connection.query(
      'DELETE FROM system_role_permissions WHERE role_id = ?',
      [roleId]
    );
    
    // Delete role
    await connection.query(
      'DELETE FROM system_roles WHERE id = ?',
      [roleId]
    );
    
    await connection.commit();
    
    return true;
  } catch (error) {
    await connection.rollback();
    console.error('Error in deleteSystemRole:', error);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Get all tenant roles
 * 
 * @param {String} tenantId - Tenant ID
 * @param {Object} options - Query options
 * @param {Boolean} options.includePermissions - Whether to include permissions
 * @returns {Promise<Array>} Tenant roles
 */
const getTenantRoles = async (tenantId, options = {}) => {
  try {
    const query = 'SELECT * FROM roles WHERE tenant_id = ? ORDER BY name';
    const [roles] = await pool.query(query, [tenantId]);
    
    // Ensure roles is always an array
    const rolesArray = Array.isArray(roles) ? roles : [roles].filter(Boolean);
    // Debug logging removed for cleaner console output
    
    if (options.includePermissions) {
      // Get permissions for each role
      for (const role of rolesArray) {
        role.permissions = await permissionService.getPermissionsByRoleId(role.id, false);
      }
    }
    
    return rolesArray;
  } catch (error) {
    console.error('Error in getTenantRoles:', error);
    throw error;
  }
};

/**
 * Get tenant role by ID
 * 
 * @param {String} roleId - Role ID
 * @param {String} tenantId - Tenant ID
 * @param {Object} options - Query options
 * @param {Boolean} options.includePermissions - Whether to include permissions
 * @returns {Promise<Object>} Role object
 */
const getTenantRoleById = async (roleId, tenantId, options = {}) => {
  // Validate required parameters
  if (!roleId || !tenantId) {
    console.warn(`getTenantRoleById called with invalid parameters: roleId=${roleId}, tenantId=${tenantId}`);
    return null;
  }
  
  try {
    const query = 'SELECT * FROM roles WHERE id = ? AND tenant_id = ?';
    const [roles] = await pool.query(query, [roleId, tenantId]);
    
    // Check if roles exists and has length property
    if (!roles || !roles.length) {
      return null;
    }
    
    const role = roles[0];
    
    if (options.includePermissions) {
      role.permissions = await permissionService.getPermissionsByRoleId(roleId, false);
    }
    
    return role;
  } catch (error) {
    console.error('Error in getTenantRoleById:', error);
    throw error;
  }
};

/**
 * Create tenant role
 * 
 * @param {String} tenantId - Tenant ID
 * @param {Object} roleData - Role data
 * @param {String} roleData.name - Role name
 * @param {String} roleData.description - Role description
 * @param {Boolean} roleData.is_system_role - Whether this is a system-defined role
 * @param {Array} roleData.permissions - Permission IDs
 * @param {String} createdBy - User ID who created the role
 * @returns {Promise<Object>} Created role
 */
const createTenantRole = async (tenantId, roleData, createdBy) => {
  if (isReservedRoleName(roleData.name)) {
    throw new Error(`The role name "${roleData.name}" is reserved and cannot be used`);
  }

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    const roleId = uuidv4();
    const role = {
      id: roleId,
      tenant_id: tenantId,
      name: roleData.name,
      description: roleData.description,
      // Never trust the client: only seeding/provisioning may create system roles.
      is_system_role: false,
      created_by: createdBy
    };
    
    // Insert role
    await connection.query(
      'INSERT INTO roles (id, tenant_id, name, description, is_system_role, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [roleId, role.tenant_id, role.name, role.description, role.is_system_role, role.created_by]
    );

    // Insert permissions
    if (roleData.permissions && roleData.permissions.length) {
      await assertTenantAssignablePermissions(roleData.permissions, connection);
      const permissionValues = roleData.permissions.map(permissionId => [roleId, permissionId]);
      await connection.query(
        'INSERT INTO role_permissions (role_id, permission_id) VALUES ?',
        [permissionValues]
      );
    }
    
    await connection.commit();
    
    // Get created role with permissions
    const createdRole = await getTenantRoleById(roleId, tenantId, { includePermissions: true });
    return createdRole;
  } catch (error) {
    await connection.rollback();
    console.error('Error in createTenantRole:', error);
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Update tenant role
 * 
 * @param {String} roleId - Role ID
 * @param {String} tenantId - Tenant ID
 * @param {Object} roleData - Role data
 * @param {String} roleData.name - Role name
 * @param {String} roleData.description - Role description
 * @param {Array} roleData.permissions - Permission IDs
 * @returns {Promise<Object>} Updated role
 */
const updateTenantRole = async (roleId, tenantId, roleData) => {
  let connection;
  let retries = 5; // Increased from 3 to 5 retries
  let delay = 500; // Start with a shorter delay
  let lastError = null;
  
  // Define a helper function for executing queries with timeout
  const executeQueryWithTimeout = async (queryFn, timeoutMs = 10000) => {
    return Promise.race([
      queryFn(),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query execution timed out')), timeoutMs);
      })
    ]);
  };
  
  // Define a helper function for transaction operations
  const executeTransaction = async (conn, operations) => {
    await conn.beginTransaction();
    try {
      const results = await operations(conn);
      await conn.commit();
      return results;
    } catch (err) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.error('Error during transaction rollback:', rollbackErr);
      }
      throw err;
    }
  };
  
  while (retries > 0) {
    try {
      // Get a connection from the pool with a timeout
      connection = await Promise.race([
        pool.getConnection(),
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Connection acquisition timed out')), 5000);
        })
      ]);
      
      // Ping the database to ensure the connection is valid
      await executeQueryWithTimeout(() => connection.ping());
      
      // Debug logging removed for cleaner console output
      
      // Execute all database operations in a transaction
      const result = await executeTransaction(connection, async (conn) => {
        // Check if role exists
        const [existingRoles] = await executeQueryWithTimeout(() => 
          conn.query(
            'SELECT * FROM roles WHERE id = ? AND tenant_id = ?',
            [roleId, tenantId]
          )
        );
        
        if (!existingRoles.length) {
          throw new Error(`Role with ID ${roleId} not found for tenant ${tenantId}`);
        }
        
        const existingRole = existingRoles[0];
        
        // Prevent modification of system roles
        if (existingRole.is_system_role && (roleData.name !== existingRole.name)) {
          throw new Error('Cannot modify the name of a system role');
        }

        // A non-system role must never be renamed to the reserved admin name
        // ('Tenant Admin' maps to the permission bypass in rbacService.isTenantAdmin).
        if (!existingRole.is_system_role && isReservedRoleName(roleData.name)) {
          throw new Error(`The role name "${roleData.name}" is reserved and cannot be used`);
        }
        
        // Update role with timeout
        await executeQueryWithTimeout(() => 
          conn.query(
            'UPDATE roles SET name = ?, description = ? WHERE id = ? AND tenant_id = ?',
            [roleData.name, roleData.description, roleId, tenantId]
          )
        );
        
        // Debug logging removed for cleaner console output
        
        // Update permissions if provided
        if (roleData.permissions) {
          await assertTenantAssignablePermissions(roleData.permissions, conn);
          // Delete existing permissions with timeout
          await executeQueryWithTimeout(() => 
            conn.query(
              'DELETE FROM role_permissions WHERE role_id = ?',
              [roleId]
            )
          );
          
          // Debug logging removed for cleaner console output
          
          // Insert new permissions
          if (roleData.permissions.length) {
            const permissionValues = roleData.permissions.map(permissionId => [roleId, permissionId]);
            
            // Split large permission arrays into smaller batches to avoid packet size limits
            const BATCH_SIZE = 100;
            for (let i = 0; i < permissionValues.length; i += BATCH_SIZE) {
              const batch = permissionValues.slice(i, i + BATCH_SIZE);
              // Debug logging removed for cleaner console output
              
              await executeQueryWithTimeout(() => 
                conn.query(
                  'INSERT INTO role_permissions (role_id, permission_id) VALUES ?',
                  [batch]
                )
              );
            }
            
            // Debug logging removed for cleaner console output
          }
        }

        // Get updated role with permissions using a separate connection to avoid transaction conflicts
        return await getTenantRoleById(roleId, tenantId, { includePermissions: true });
      });

      // Role grants changed and committed — flush cached permission sets of
      // every assigned user so the change takes effect immediately.
      await rbacService().invalidateRoleUsersCache(roleId);
      return result;
    } catch (error) {
      lastError = error;
      retries--;
      
      // Enhanced error logging with more details
      console.error(`Error in updateTenantRole (${retries} retries left):`, {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage,
        stack: error.stack?.split('\n').slice(0, 3).join('\n') // Truncate stack trace for readability
      });
      
      // Release connection if it exists
      if (connection) {
        try {
          connection.release();
          connection = null;
        } catch (releaseError) {
          console.error('Error releasing connection:', releaseError);
        }
      }
      
      // Handle specific database errors with appropriate retry logic
      const retryableErrors = ['ETIMEDOUT', 'ECONNREFUSED', 'PROTOCOL_CONNECTION_LOST', 'ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'];
      
      if (retryableErrors.includes(error.code) || error.message.includes('timed out')) {
        if (retries > 0) {
          console.log(`Database connection/transaction issue detected. Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * 1.5, 10000); // Exponential backoff with a maximum delay
          continue;
        }
      }
      
      // For non-retryable errors or if we're out of retries
      throw new Error(`Failed to update tenant role after multiple attempts: ${lastError.message}`);
    }
  }
  
  // This should never be reached due to the throw in the catch block above
  throw new Error(`Failed to update tenant role after ${5 - retries} attempts`);
};

/**
 * Delete tenant role
 * 
 * @param {String} roleId - Role ID
 * @param {String} tenantId - Tenant ID
 * @returns {Promise<Boolean>} Success status
 */
const deleteTenantRole = async (roleId, tenantId) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Check if role exists and is not a system role
    const [existingRoles] = await connection.query(
      'SELECT * FROM roles WHERE id = ? AND tenant_id = ?',
      [roleId, tenantId]
    );
    
    if (!existingRoles.length) {
      throw new Error(`Role with ID ${roleId} not found for tenant ${tenantId}`);
    }
    
    if (existingRoles[0].is_system_role) {
      throw new Error('Cannot delete a system role');
    }
    
    // Check if role is assigned to users
    const [assignments] = await connection.query(
      'SELECT COUNT(*) as count FROM user_roles WHERE role_id = ?',
      [roleId]
    );
    
    if (assignments[0].count > 0) {
      throw new Error('Cannot delete role that is assigned to users');
    }
    
    // Delete permissions
    await connection.query(
      'DELETE FROM role_permissions WHERE role_id = ?',
      [roleId]
    );
    
    // Delete role
    await connection.query(
      'DELETE FROM roles WHERE id = ? AND tenant_id = ?',
      [roleId, tenantId]
    );

    await connection.commit();

    // Flush cached permission sets — the role is guaranteed unassigned here
    // (checked above), but invalidate defensively in case of stale assignments.
    // Must run AFTER commit so repopulation cannot read pre-commit state.
    await rbacService().invalidateRoleUsersCache(roleId);

    return true;
  } catch (error) {
    await connection.rollback();
    console.error('Error in deleteTenantRole:', error);
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
  // System roles
  getSystemRoles,
  getSystemRoleById,
  createSystemRole,
  updateSystemRole,
  deleteSystemRole,
  
  // Tenant roles
  getTenantRoles,
  getTenantRoleById,
  createTenantRole,
  updateTenantRole,
  deleteTenantRole
};
