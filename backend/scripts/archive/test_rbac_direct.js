const db = require('../db');
const rbacService = require('../services/rbacService');

async function testRbacService() {
  try {
    console.log('=== RBAC SERVICE DIRECT TEST ===');
    
    // Step 1: Find the user
    console.log('\n--- Step 1: Finding user in database ---');
    const users = await db.query('SELECT id, email, tenant_id FROM users WHERE email = ?', ['admin@deshvidesh.com']);
    
    if (!users || users.length === 0) {
      console.error('User not found in database');
      return;
    }
    
    const user = users[0];
    console.log('User found:', JSON.stringify(user, null, 2));
    
    // Step 2: Find user roles in database
    console.log('\n--- Step 2: Finding user roles in database ---');
    const userRoles = await db.query(`
      SELECT ur.*, r.name as role_name, r.tenant_id as role_tenant_id
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `, [user.id]);
    
    console.log(`Found ${userRoles.length} roles for user:`, 
      userRoles.map(r => `${r.role_name} (tenant: ${r.role_tenant_id || 'system'})`))
    
    if (userRoles.length === 0) {
      console.warn('⚠️ WARNING: No roles found for user');
    } else {
      console.log('User has roles with tenant_id:', userRoles[0].role_tenant_id);
      console.log('User\'s own tenant_id:', user.tenant_id);
      
      if (userRoles[0].role_tenant_id !== user.tenant_id) {
        console.warn('⚠️ EXPECTED: Tenant ID mismatch between user and roles');
      }
    }
    
    // Step 3: Test rbacService directly with USER'S TENANT ID (this should have been failing before the fix)
    console.log('\n--- Step 3: Testing rbacService with USER\'S tenant ID ---');
    const rbacWithUserTenant = await rbacService.getUserRolesAndPermissions(
      user.id,
      user.tenant_id,
      null
    );
    
    console.log('RBAC data with user\'s tenant ID:');
    console.log('- Roles:', rbacWithUserTenant.roleNames);
    console.log('- System Roles:', rbacWithUserTenant.systemRoles);
    console.log('- Permissions:', rbacWithUserTenant.permissions.length);
    
    // Step 4: Test rbacService directly with ROLE'S TENANT ID
    if (userRoles.length > 0) {
      console.log('\n--- Step 4: Testing rbacService with ROLE\'S tenant ID ---');
      const rbacWithRoleTenant = await rbacService.getUserRolesAndPermissions(
        user.id,
        userRoles[0].role_tenant_id,
        null
      );
      
      console.log('RBAC data with role\'s tenant ID:');
      console.log('- Roles:', rbacWithRoleTenant.roleNames);
      console.log('- System Roles:', rbacWithRoleTenant.systemRoles);
      console.log('- Permissions:', rbacWithRoleTenant.permissions.length);
    }
    
    // Step 5: Test rbacService directly with NO tenant ID filtering (our fix)
    console.log('\n--- Step 5: Testing rbacService with NO tenant ID filtering ---');
    const rbacWithNoTenant = await rbacService.getUserRolesAndPermissions(
      user.id,
      null,
      null
    );
    
    console.log('RBAC data with no tenant ID filtering:');
    console.log('- Roles:', rbacWithNoTenant.roleNames);
    console.log('- System Roles:', rbacWithNoTenant.systemRoles);
    console.log('- Permissions:', rbacWithNoTenant.permissions.length);
    
    // Conclusion
    console.log('\n=== TEST RESULTS ===');
    if (rbacWithNoTenant.roleNames.length > 0) {
      console.log('✅ SUCCESS: RBAC service now returns roles regardless of tenant ID mismatch');
    } else {
      console.error('❌ ERROR: RBAC service still not returning roles');
    }
    
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    process.exit();
  }
}

testRbacService();
