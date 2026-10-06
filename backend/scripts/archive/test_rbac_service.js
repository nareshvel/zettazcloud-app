const db = require('../db');
const rbacService = require('../services/rbacService');

async function testUserRolesAndPermissions() {
  try {
    console.log('Testing getUserRolesAndPermissions function...');
    
    // Query the user ID for admin@deshvidesh.com
    const users = await db.query('SELECT id, email, tenant_id FROM users WHERE email = ?', ['admin@deshvidesh.com']);
    
    if (!users || users.length === 0) {
      console.log('User not found!');
      return;
    }
    
    const user = users[0];
    console.log('User in database:', JSON.stringify(user, null, 2));
    
    // Test RBAC service with the user's tenant ID
    console.log('\n--- Testing with user tenant_id ---');
    const userTenantRbacData = await rbacService.getUserRolesAndPermissions(
      user.id,
      user.tenant_id,
      null // No store ID
    );
    
    console.log('Roles found with user tenant_id:', userTenantRbacData.roleNames);
    console.log('System roles:', userTenantRbacData.systemRoles);
    console.log('Permissions:', userTenantRbacData.permissions);
    
    // Get role tenant ID from database directly
    const userRoles = await db.query(`
      SELECT r.id, r.name, r.tenant_id
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `, [user.id]);
    
    if (userRoles && userRoles.length > 0) {
      const roleTenantId = userRoles[0].tenant_id;
      console.log('\n--- Role assigned with tenant_id ---', roleTenantId);
      
      // Test with the role's tenant ID
      console.log('\n--- Testing with role tenant_id ---');
      const roleTenantRbacData = await rbacService.getUserRolesAndPermissions(
        user.id,
        roleTenantId,
        null // No store ID
      );
      
      console.log('Roles found with role tenant_id:', roleTenantRbacData.roleNames);
      console.log('System roles:', roleTenantRbacData.systemRoles);
      console.log('Permissions:', roleTenantRbacData.permissions);
    }
    
    // Test with NO tenant ID (should get all roles)
    console.log('\n--- Testing with NO tenant_id ---');
    const noTenantRbacData = await rbacService.getUserRolesAndPermissions(
      user.id,
      null,
      null
    );
    
    console.log('Roles found with no tenant filtering:', noTenantRbacData.roleNames);
    console.log('System roles:', noTenantRbacData.systemRoles);
    console.log('Permissions:', noTenantRbacData.permissions);

  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    process.exit();
  }
}

testUserRolesAndPermissions();
