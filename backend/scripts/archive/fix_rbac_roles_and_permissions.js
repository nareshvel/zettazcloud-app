/**
 * Script to check and fix RBAC roles and permissions
 * 
 * This script:
 * 1. Identifies users without proper RBAC roles and permissions
 * 2. Fixes users by assigning appropriate roles based on tenant and store context
 * 3. Provides a summary of the changes made
 * 
 * Run with: node scripts/fix_rbac_roles_and_permissions.js
 */

require('dotenv').config();
const { v4: uuid } = require('uuid');
const { pool } = require('../config/db');
const rbacService = require('../services/rbacService');

// Display script info
console.log('---------------------------------------------');
console.log('RBAC Diagnostic and Fix Tool');
console.log('---------------------------------------------');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Database:', process.env.MYSQL_DATABASE || 'digitpulse_zcloud');
console.log('---------------------------------------------\n');

// Default roles to assign based on context
const DEFAULT_ROLES = {
  SYSTEM_ADMIN: 'System Admin',
  TENANT_ADMIN: 'Tenant Admin',
  STORE_MANAGER: 'Store Manager',
  CASHIER: 'Cashier'
};

/**
 * Get a database connection from the pool
 */
async function getConnection() {
  return await pool.getConnection();
}

/**
 * Get all tenants in the system
 */
async function getAllTenants() {
  const connection = await getConnection();
  try {
    const [tenants] = await connection.query('SELECT id, name FROM tenants');
    console.log(`Found ${tenants.length} tenants in the system`);
    return tenants;
  } finally {
    connection.release();
  }
}

/**
 * Get all roles in the system
 */
async function getAllRoles() {
  const connection = await getConnection();
  try {
    // Get tenant roles
    const [tenantRoles] = await connection.query('SELECT id, name, tenant_id FROM roles');
    console.log(`Found ${tenantRoles.length} tenant roles`);
    
    // Get system roles
    const [systemRoles] = await connection.query('SELECT id, name FROM system_roles');
    console.log(`Found ${systemRoles.length} system roles`);
    
    return { tenantRoles, systemRoles };
  } finally {
    connection.release();
  }
}

/**
 * Get all users for a specific tenant
 */
async function getUsersForTenant(tenantId) {
  const connection = await getConnection();
  try {
    const [users] = await connection.query(
      'SELECT id, email, name, tenant_id, store_id FROM users WHERE tenant_id = ?',
      [tenantId]
    );
    return users;
  } finally {
    connection.release();
  }
}

/**
 * Check if user has any RBAC roles
 */
async function getUserRolesAndPermissions(userId) {
  try {
    return await rbacService.getUserRolesAndPermissions(userId);
  } catch (error) {
    console.error(`Error checking roles for user ${userId}:`, error.message);
    return { roles: [], permissions: [] };
  }
}

/**
 * Find appropriate role IDs for a user based on context
 */
async function findAppropriateRoleIds(user, tenantRoles, systemRoles) {
  const result = {
    tenantRoleIds: [],
    systemRoleIds: []
  };
  
  // For the tenant's first user or users with ID pattern indicating they're admins
  const isTenantAdmin = user.id.includes('admin') || user.email.includes('admin');
  
  if (isTenantAdmin) {
    // Find Tenant Admin role
    const tenantAdminRole = tenantRoles.find(
      role => role.name === DEFAULT_ROLES.TENANT_ADMIN && role.tenant_id === user.tenant_id
    );
    
    if (tenantAdminRole) {
      result.tenantRoleIds.push(tenantAdminRole.id);
    }
  } else if (user.store_id) {
    // Find Store Manager or Cashier role based on context
    // Simple heuristic: if email contains 'manager', assign Store Manager role, otherwise Cashier
    const roleName = user.email.includes('manager') ? 
      DEFAULT_ROLES.STORE_MANAGER : DEFAULT_ROLES.CASHIER;
    
    const appropriateRole = tenantRoles.find(
      role => role.name === roleName && role.tenant_id === user.tenant_id
    );
    
    if (appropriateRole) {
      result.tenantRoleIds.push(appropriateRole.id);
    }
  }
  
  // Check if the user should be a system admin
  if (user.email.includes('superadmin') || user.email.includes('system')) {
    const systemAdminRole = systemRoles.find(role => role.name === DEFAULT_ROLES.SYSTEM_ADMIN);
    if (systemAdminRole) {
      result.systemRoleIds.push(systemAdminRole.id);
    }
  }
  
  return result;
}

/**
 * Assign tenant role to a user
 */
async function assignTenantRole(userId, roleId, tenantId, scope = 'tenant', storeId = null) {
  const connection = await getConnection();
  try {
    const userRoleId = uuid();
    
    // First, check the column names in the table
    const [columns] = await connection.query('SHOW COLUMNS FROM user_roles');
    const columnNames = columns.map(col => col.Field);
    
    // Log column names for debugging
    console.log('Available columns in user_roles table:', columnNames.join(', '));
    
    // Determine if we have scope_type or just scope
    const hasScopeType = columnNames.includes('scope_type');
    const hasScopeColumn = columnNames.includes('scope');
    const hasScopeId = columnNames.includes('scope_id');
    
    // Build the query dynamically based on available columns
    let query = 'INSERT INTO user_roles (id, user_id, role_id';
    const params = [userRoleId, userId, roleId];
    
    if (hasScopeType) {
      query += ', scope_type';
      params.push(scope);
    } else if (hasScopeColumn) {
      query += ', scope';
      params.push(scope);
    }
    
    if (hasScopeId) {
      query += ', scope_id';
      params.push(scope === 'tenant' ? tenantId : storeId);
    }
    
    if (columnNames.includes('store_id')) {
      query += ', store_id';
      params.push(storeId);
    }
    
    query += ', created_at, updated_at) VALUES (' + params.map(() => '?').join(', ') + ', NOW(), NOW())';
    
    console.log('Executing query:', query);
    await connection.query(query, params);
    
    return true;
  } catch (error) {
    console.error(`Error assigning tenant role ${roleId} to user ${userId}:`, error.message);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * Assign system role to a user
 */
async function assignSystemRole(userId, roleId) {
  const connection = await getConnection();
  try {
    const userSystemRoleId = uuid();
    
    await connection.query(
      `INSERT INTO user_system_roles (id, user_id, system_role_id, created_at, updated_at)
       VALUES (?, ?, ?, NOW(), NOW())`,
      [userSystemRoleId, userId, roleId]
    );
    
    return true;
  } catch (error) {
    console.error(`Error assigning system role ${roleId} to user ${userId}:`, error.message);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * Assign appropriate roles to a specific user by email
 */
async function fixSpecificUser(email) {
  console.log(`\nFixing specific user: ${email}`);
  
  // Find the user by email
  const connection = await getConnection();
  try {
    const [users] = await connection.query(
      'SELECT id, name, email, tenant_id, store_id FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      console.error(`❌ User not found with email: ${email}`);
      return false;
    }
    
    const user = users[0];
    console.log(`Fixing roles for user: ${user.email} (${user.id})`);
    
    // Get tenant and store information
    const tenantId = user.tenant_id;
    const storeId = user.store_id;
    
    // Check if user already has roles assigned
    const [existingRoles] = await connection.query(
      `SELECT 
        r.id as role_id, 
        r.name as role_name
      FROM 
        user_roles ur
      JOIN 
        roles r ON ur.role_id = r.id
      WHERE 
        ur.user_id = ?`,
      [user.id]
    );
    
    if (existingRoles.length > 0) {
      console.log(`\nUser already has the following roles:`);
      existingRoles.forEach(role => {
        console.log(` - ${role.role_name} (${role.role_id})`);
      });
      
      // Check if we need to delete existing roles before assigning new ones
      const deleteExisting = false; // Set to true if you want to remove existing roles first
      
      if (deleteExisting) {
        console.log(`Removing existing roles...`);
        await connection.query('DELETE FROM user_roles WHERE user_id = ?', [user.id]);
      } else {
        console.log(`Keeping existing roles and adding new ones if needed.`);
      }
    } else {
      console.log(`User has no roles assigned.`);
    }
    
    // Get available tenant roles
    const [tenantRoles] = await connection.query(
      'SELECT id, name, description FROM roles WHERE tenant_id = ?',
      [tenantId]
    );
    
    console.log(`\nFound ${tenantRoles.length} tenant roles:`);
    tenantRoles.forEach((role, index) => {
      console.log(` ${index + 1}. ${role.name} (${role.id}) - ${role.description || 'No description'}`);
    });
    
    // Get available system roles
    const [systemRoles] = await connection.query(
      'SELECT id, name, description FROM system_roles'
    );
    
    console.log(`\nFound ${systemRoles.length} system roles:`);
    systemRoles.forEach((role, index) => {
      console.log(` ${index + 1}. ${role.name} (${role.id}) - ${role.description || 'No description'}`);
    });
    
    // Try to find an appropriate role - prioritize Admin roles for this email pattern
    let roleToAssign = null;
    
    if (email.toLowerCase().includes('admin')) {
      // For admin users, find admin role
      roleToAssign = tenantRoles.find(role => 
        role.name.toLowerCase().includes('admin') || 
        (role.description && role.description.toLowerCase().includes('admin'))
      );
      
      if (roleToAssign) {
        console.log(`\nSelected admin role for admin user: ${roleToAssign.name}`);
      }
    } else if (email.toLowerCase().includes('manager')) {
      // For manager users, find manager role
      roleToAssign = tenantRoles.find(role => 
        role.name.toLowerCase().includes('manager') || 
        (role.description && role.description.toLowerCase().includes('manager'))
      );
      
      if (roleToAssign) {
        console.log(`\nSelected manager role for manager user: ${roleToAssign.name}`);
      }
    }
    
    // If no matching role found, use the first role with highest privileges
    if (!roleToAssign && tenantRoles.length > 0) {
      roleToAssign = tenantRoles[0]; // Typically the first role has the highest privileges
      console.log(`\nNo specific role match found, selecting first available role: ${roleToAssign.name}`);
    }
    
    // If we have a role to assign, assign it
    if (roleToAssign) {
      const roleAssigned = await assignTenantRole(user.id, roleToAssign.id, tenantId, 'tenant', storeId);
      
      if (roleAssigned) {
        console.log(`✅ Assigned ${roleToAssign.name} role to user ${user.email}`);
        
        // Now check if the role has permissions
        const [rolePermissions] = await connection.query(
          `SELECT COUNT(*) as permission_count
           FROM role_permissions
           WHERE role_id = ?`,
          [roleToAssign.id]
        );
        
        if (rolePermissions[0].permission_count === 0) {
          console.warn(`⚠️ Warning: The assigned role has no permissions. User may not have access to features.`);
        } else {
          console.log(`Role has ${rolePermissions[0].permission_count} permissions.`);
        }
        
        return true;
      } else {
        console.error(`❌ Failed to assign ${roleToAssign.name} role to user ${user.email}`);
      }
    } else {
      console.error(`❌ No suitable roles found for tenant ${tenantId}`);
    }
    
    return false;
  } catch (error) {
    console.error(`Error fixing roles for user ${email}:`, error);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * Check and add required permissions for a role if missing
 */
async function fixRolePermissions(roleId) {
  const connection = await getConnection();
  try {
    console.log(`\nChecking permissions for role: ${roleId}`);
    
    // Check current permissions for the role
    const [existingPermissions] = await connection.query(
      `SELECT 
        p.id as permission_id,
        p.name as permission_name,
        p.description as permission_description
      FROM 
        role_permissions rp
      JOIN 
        permissions p ON rp.permission_id = p.id
      WHERE 
        rp.role_id = ?`,
      [roleId]
    );
    
    console.log(`Role has ${existingPermissions.length} permissions assigned.`);
    
    if (existingPermissions.length === 0) {
      // Get all available permissions
      const [allPermissions] = await connection.query(
        `SELECT id, name, description FROM permissions`
      );
      
      console.log(`Found ${allPermissions.length} available permissions.`);
      
      // For admin users, assign all permissions
      if (allPermissions.length > 0) {
        console.log(`Adding permissions to role ${roleId}...`);
        
        // Add batch permissions (use transaction for efficiency)
        await connection.beginTransaction();
        
        try {
          for (const permission of allPermissions) {
            await connection.query(
              'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
              [roleId, permission.id]
            );
          }
          
          await connection.commit();
          console.log(`✅ Added ${allPermissions.length} permissions to role ${roleId}.`);
          return true;
        } catch (error) {
          await connection.rollback();
          console.error(`Failed to add permissions to role:`, error);
          return false;
        }
      }
    } else {
      console.log(`Role already has permissions. No action needed.`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error checking role permissions:`, error);
    return false;
  } finally {
    connection.release();
  }
}

/**
 * Main function to check and fix RBAC for all users
 */
async function checkAndFixRbac() {
  try {
    // Get all tenants
    const tenants = await getAllTenants();
    
    // Get all roles
    const { tenantRoles, systemRoles } = await getAllRoles();
    
    // Summary stats
    const summary = {
      totalUsers: 0,
      usersWithoutRoles: 0,
      rolesAssigned: 0,
      usersFailed: 0
    };
    
    // Process each tenant
    for (const tenant of tenants) {
      console.log(`\nProcessing tenant: ${tenant.name} (${tenant.id})`);
      
      // Get users for this tenant
      const users = await getUsersForTenant(tenant.id);
      summary.totalUsers += users.length;
      
      console.log(`Found ${users.length} users for tenant ${tenant.name}`);
      
      // Check each user
      for (const user of users) {
        const rbacData = await getUserRolesAndPermissions(user.id);
        
        // If user has no roles, assign appropriate ones
        if (!rbacData.roles || rbacData.roles.length === 0) {
          console.log(`User ${user.email} has no roles. Assigning appropriate roles...`);
          summary.usersWithoutRoles++;
          
          // Find appropriate roles
          const { tenantRoleIds, systemRoleIds } = await findAppropriateRoleIds(
            user, tenantRoles, systemRoles
          );
          
          // Assign tenant roles
          let success = false;
          for (const roleId of tenantRoleIds) {
            const roleSuccess = await assignTenantRole(
              user.id, 
              roleId, 
              user.tenant_id, 
              user.store_id ? 'store' : 'tenant',
              user.store_id
            );
            
            if (roleSuccess) {
              const roleName = tenantRoles.find(role => role.id === roleId).name;
              console.log(`✅ Assigned tenant role '${roleName}' to user ${user.email}`);
              summary.rolesAssigned++;
              success = true;
            }
          }
          
          // Assign system roles
          for (const roleId of systemRoleIds) {
            const roleSuccess = await assignSystemRole(user.id, roleId);
            
            if (roleSuccess) {
              const roleName = systemRoles.find(role => role.id === roleId).name;
              console.log(`✅ Assigned system role '${roleName}' to user ${user.email}`);
              summary.rolesAssigned++;
              success = true;
            }
          }
          
          // If no roles could be assigned
          if (!success && tenantRoleIds.length === 0 && systemRoleIds.length === 0) {
            console.warn(`⚠️ Could not determine appropriate roles for user ${user.email}`);
            summary.usersFailed++;
          } else if (!success) {
            console.error(`❌ Failed to assign roles to user ${user.email}`);
            summary.usersFailed++;
          }
        } else {
          console.log(`✓ User ${user.email} already has ${rbacData.roles.length} roles`);
        }
      }
    }
    
    // Print summary
    console.log('\n---------------------------------------------');
    console.log('RBAC Check and Fix Summary');
    console.log('---------------------------------------------');
    console.log(`Total users checked: ${summary.totalUsers}`);
    console.log(`Users without roles: ${summary.usersWithoutRoles}`);
    console.log(`Roles assigned: ${summary.rolesAssigned}`);
    console.log(`Users failed: ${summary.usersFailed}`);
    console.log('---------------------------------------------');
    
    if (summary.usersFailed > 0) {
      console.warn('\n⚠️ Some users could not be assigned roles. Please check the logs.');
    } else if (summary.usersWithoutRoles === 0) {
      console.log('\n✅ All users have proper RBAC roles assigned!');
    } else {
      console.log('\n✅ Role assignment completed for all users!');
    }
    
  } catch (error) {
    console.error('Error in RBAC check and fix:', error);
  }
}

/**
 * Check if permissions are properly linked to roles
 */
async function checkRolePermissions() {
  const connection = await getConnection();
  try {
    console.log('\nChecking role permissions...');
    
    // Count roles without any permissions
    const [rolesWithoutPermissions] = await connection.query(`
      SELECT r.id, r.name, r.tenant_id
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id, r.name, r.tenant_id
      HAVING COUNT(rp.role_id) = 0
    `);
    
    if (rolesWithoutPermissions.length > 0) {
      console.warn(`⚠️ Found ${rolesWithoutPermissions.length} roles without any permissions:`);
      rolesWithoutPermissions.forEach(role => {
        console.warn(`- Role "${role.name}" (${role.id}) for tenant ${role.tenant_id || 'N/A'}`);
      });
    } else {
      console.log('✅ All roles have permissions assigned');
    }
    
    // Check if system_role_permissions table exists
    const [tables] = await connection.query(`
      SHOW TABLES LIKE 'system_role_permissions'
    `);
    
    if (tables.length === 0) {
      console.log('⚠️ system_role_permissions table not found - skipping system role permission check');
      return;
    }
    
    // Get the column name for system role id
    const [columns] = await connection.query(`
      SHOW COLUMNS FROM system_role_permissions
    `);
    
    // Find the column that likely contains the system role id
    let systemRoleIdColumn = 'system_role_id';
    for (const column of columns) {
      if (column.Field.includes('role') && column.Field.includes('id')) {
        systemRoleIdColumn = column.Field;
        break;
      }
    }
    
    console.log(`Using ${systemRoleIdColumn} as system role ID column`);
    
    // Check system roles
    const [systemRolesWithoutPermissions] = await connection.query(`
      SELECT sr.id, sr.name
      FROM system_roles sr
      LEFT JOIN system_role_permissions srp ON sr.id = srp.${systemRoleIdColumn}
      GROUP BY sr.id, sr.name
      HAVING COUNT(srp.${systemRoleIdColumn}) = 0
    `);
    
    if (systemRolesWithoutPermissions.length > 0) {
      console.warn(`⚠️ Found ${systemRolesWithoutPermissions.length} system roles without permissions:`);
      systemRolesWithoutPermissions.forEach(role => {
        console.warn(`- System Role "${role.name}" (${role.id})`);
      });
    } else {
      console.log('✅ All system roles have permissions assigned');
    }
  } finally {
    connection.release();
  }
}

/**
 * Main execution function
 */
async function run() {
  try {
    // Check if specific user was provided
    const userArg = process.argv[2];
    if (userArg && userArg.includes('@')) {
      console.log(`Fixing specific user: ${userArg}`);
      await fixSpecificUser(userArg);
    } else if (userArg === "fix-permissions") {
      // Special command to fix permissions for admin@deshvidesh.com's role
      const roleId = "6b9f79c6-4c50-11f0-8dfa-525400d69130"; // Tenant Admin role ID
      await fixRolePermissions(roleId);
    } else {
      // Check and fix all user RBAC roles
      await checkAndFixRbac();
      
      // Check role permissions
      await checkRolePermissions();
    }
    
    console.log('\nRBAC diagnostic and fix process completed.');
  } catch (error) {
    console.error('Script failed:', error);
  } finally {
    // Ensure the script terminates
    process.exit(0);
  }
}

// Run the script
run();
