/**
 * Script to assign default permissions to system roles
 * 
 * This script will find permissions by name and assign them to the
 * appropriate system roles (Cashier, Store Manager, Tenant Admin).
 */
const { pool } = require('../config/db');

// Helper to get system role by name
const getSystemRoleByName = async (roleName) => {
  try {
    const [roles] = await pool.query(
      'SELECT * FROM system_roles WHERE name = ?',
      [roleName]
    );
    return roles.length > 0 ? roles[0] : null;
  } catch (error) {
    console.error(`Error getting role by name "${roleName}":`, error);
    return null;
  }
};

// Helper to get permissions by pattern
const getPermissionsByPattern = async (patterns, isSystem = true) => {
  try {
    const permissionsTable = isSystem ? 'system_permissions' : 'permissions';
    let permissionsList = [];
    
    // For each pattern, find matching permissions
    for (const pattern of patterns) {
      const [permissions] = await pool.query(
        `SELECT * FROM ${permissionsTable} WHERE name LIKE ?`,
        [pattern]
      );
      permissionsList = permissionsList.concat(permissions);
    }
    
    return permissionsList;
  } catch (error) {
    console.error('Error getting permissions by pattern:', error);
    return [];
  }
};

// Helper to assign permissions to a system role
const assignPermissionsToSystemRole = async (roleId, permissionIds) => {
  if (!roleId || !permissionIds || permissionIds.length === 0) {
    console.log('No role ID or permissions to assign');
    return;
  }

  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // Delete existing role permissions
    await connection.query(
      'DELETE FROM system_role_permissions WHERE role_id = ?',
      [roleId]
    );
    
    // Insert new role permissions
    for (const permissionId of permissionIds) {
      await connection.query(
        'INSERT INTO system_role_permissions (role_id, permission_id) VALUES (?, ?)',
        [roleId, permissionId]
      );
    }
    
    await connection.commit();
    console.log(`Assigned ${permissionIds.length} permissions to role ID ${roleId}`);
  } catch (error) {
    await connection.rollback();
    console.error('Error assigning permissions to role:', error);
  } finally {
    connection.release();
  }
};

// Main function to assign permissions
const assignDefaultPermissions = async () => {
  try {
    // Get roles
    const cashierRole = await getSystemRoleByName('Cashier');
    const storeManagerRole = await getSystemRoleByName('Store Manager');
    const tenantAdminRole = await getSystemRoleByName('Tenant Admin');
    
    if (!cashierRole) {
      console.log('Cashier role not found');
    } else {
      console.log(`Found Cashier role: ${cashierRole.id}`);
      
      // Get permissions for Cashier
      const cashierPermissions = await getPermissionsByPattern([
        'sales.%',
        'dashboard.view',
        'products.view',
        'customers.view',
        'inventory.view',
        'categories.view'
      ]);
      
      console.log(`Found ${cashierPermissions.length} permissions for Cashier`);
      
      // Assign permissions to Cashier
      await assignPermissionsToSystemRole(
        cashierRole.id,
        cashierPermissions.map(p => p.id)
      );
    }
    
    if (!storeManagerRole) {
      console.log('Store Manager role not found');
    } else {
      console.log(`Found Store Manager role: ${storeManagerRole.id}`);
      
      // Get permissions for Store Manager
      const storeManagerPermissions = await getPermissionsByPattern([
        'sales.%',
        'dashboard.%',
        'products.%',
        'customers.%',
        'inventory.%',
        'categories.%',
        'reports.%',
        'users.%',
        'settings.view'
      ]);
      
      console.log(`Found ${storeManagerPermissions.length} permissions for Store Manager`);
      
      // Assign permissions to Store Manager
      await assignPermissionsToSystemRole(
        storeManagerRole.id,
        storeManagerPermissions.map(p => p.id)
      );
    }
    
    if (!tenantAdminRole) {
      console.log('Tenant Admin role not found');
    } else {
      console.log(`Found Tenant Admin role: ${tenantAdminRole.id}`);
      
      // Get all non-system, non-platform permissions for Tenant Admin
      const [allPermissions] = await pool.query(
        'SELECT * FROM system_permissions WHERE name NOT LIKE "system.%" AND name NOT LIKE "platform.%"'
      );
      
      console.log(`Found ${allPermissions.length} permissions for Tenant Admin`);
      
      // Assign permissions to Tenant Admin
      await assignPermissionsToSystemRole(
        tenantAdminRole.id,
        allPermissions.map(p => p.id)
      );
    }
    
    console.log('Default permissions assignment complete');
  } catch (error) {
    console.error('Error assigning default permissions:', error);
  } finally {
    // Close pool when done
    pool.end();
  }
};

// Execute the function
assignDefaultPermissions()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
