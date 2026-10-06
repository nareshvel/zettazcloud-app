/**
 * Script to add default permissions for system roles
 * 
 * This script will add appropriate default permissions to system roles
 * based on their intended functions.
 */
const { pool } = require('../config/db');

// Function to get role ID by name
const getRoleIdByName = async (roleName) => {
  try {
    const [roles] = await pool.query(
      'SELECT id FROM system_roles WHERE name = ?',
      [roleName]
    );
    
    if (roles.length === 0) {
      console.log(`Role ${roleName} not found`);
      return null;
    }
    
    return roles[0].id;
  } catch (error) {
    console.error(`Error getting role ID for ${roleName}:`, error);
    throw error;
  }
};

// Function to get permission ID by name
const getPermissionIdByName = async (permissionName) => {
  try {
    const [permissions] = await pool.query(
      'SELECT id FROM system_permissions WHERE name = ?',
      [permissionName]
    );
    
    if (permissions.length === 0) {
      console.log(`Permission ${permissionName} not found`);
      return null;
    }
    
    return permissions[0].id;
  } catch (error) {
    console.error(`Error getting permission ID for ${permissionName}:`, error);
    throw error;
  }
};

// Function to assign permissions to a role
const assignPermissionsToRole = async (roleId, permissionIds) => {
  if (!roleId || !permissionIds || permissionIds.length === 0) {
    console.log('Invalid role ID or permission IDs');
    return;
  }
  
  // Begin transaction
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    
    // Delete existing permissions for this role
    await connection.query(
      'DELETE FROM system_role_permissions WHERE role_id = ?',
      [roleId]
    );
    
    // Insert new permissions
    const values = permissionIds.map(permissionId => [roleId, permissionId]);
    await connection.query(
      'INSERT INTO system_role_permissions (role_id, permission_id) VALUES ?',
      [values]
    );
    
    await connection.commit();
    console.log(`Successfully assigned ${permissionIds.length} permissions to role ${roleId}`);
  } catch (error) {
    await connection.rollback();
    console.error('Error assigning permissions:', error);
    throw error;
  } finally {
    connection.release();
  }
};

// Define default permissions for each system role
const setupDefaultPermissions = async () => {
  try {
    // Get role IDs
    const cashierRoleId = await getRoleIdByName('Cashier');
    const storeManagerRoleId = await getRoleIdByName('Store Manager');
    const tenantAdminRoleId = await getRoleIdByName('Tenant Admin');
    
    if (!cashierRoleId || !storeManagerRoleId || !tenantAdminRoleId) {
      console.error('One or more system roles not found');
      return;
    }
    
    // Define appropriate permissions for each role
    const cashierPermissions = [
      'sales.create', 'sales.view', 'customers.view', 'products.view', 
      'dashboard.view', 'categories.view', 'inventory.view'
    ];
    
    const storeManagerPermissions = [
      'sales.create', 'sales.view', 'sales.refund', 'sales.void', 'sales.discount',
      'customers.view', 'customers.create', 'customers.edit',
      'products.view', 'products.create', 'products.edit',
      'inventory.view', 'inventory.adjust', 'inventory.history',
      'dashboard.view', 'reports.view', 'reports.export',
      'categories.view', 'categories.create', 'categories.edit',
      'users.view', 'settings.view'
    ];
    
    const tenantAdminPermissions = [
      'sales.create', 'sales.view', 'sales.refund', 'sales.void', 'sales.discount',
      'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
      'products.view', 'products.create', 'products.edit', 'products.delete', 'products.import', 'products.export',
      'inventory.view', 'inventory.adjust', 'inventory.history', 'inventory.transfer',
      'dashboard.view', 'reports.view', 'reports.export',
      'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
      'users.view', 'users.create', 'users.edit', 'users.delete',
      'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
      'settings.view', 'settings.edit',
      'stores.view', 'stores.create', 'stores.edit', 'stores.delete',
      'tenant.subscription.view', 'tenant.subscription.upgrade'
    ];
    
    // Get permission IDs for each role
    const cashierPermissionIds = [];
    const storeManagerPermissionIds = [];
    const tenantAdminPermissionIds = [];
    
    // Get all system permissions first
    const [allPermissions] = await pool.query('SELECT id, name FROM system_permissions');
    const permissionMap = {};
    allPermissions.forEach(perm => {
      permissionMap[perm.name] = perm.id;
    });
    
    // Build permission ID arrays
    cashierPermissions.forEach(permName => {
      if (permissionMap[permName]) {
        cashierPermissionIds.push(permissionMap[permName]);
      }
    });
    
    storeManagerPermissions.forEach(permName => {
      if (permissionMap[permName]) {
        storeManagerPermissionIds.push(permissionMap[permName]);
      }
    });
    
    tenantAdminPermissions.forEach(permName => {
      if (permissionMap[permName]) {
        tenantAdminPermissionIds.push(permissionMap[permName]);
      }
    });
    
    // Assign permissions to roles
    await assignPermissionsToRole(cashierRoleId, cashierPermissionIds);
    await assignPermissionsToRole(storeManagerRoleId, storeManagerPermissionIds);
    await assignPermissionsToRole(tenantAdminRoleId, tenantAdminPermissionIds);
    
    console.log('Default permissions setup completed');
  } catch (error) {
    console.error('Error setting up default permissions:', error);
  } finally {
    // Close the pool when done
    pool.end();
  }
};

// Run the setup
setupDefaultPermissions()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });
