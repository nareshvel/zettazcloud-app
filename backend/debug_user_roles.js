const { pool } = require('./config/db');

async function checkUserRoles() {
  try {
    console.log('Checking user roles for shyamlaxmi2008@yahoo.com...\n');
    
    // Get user data
    const [users] = await pool.query(
      'SELECT id, email, tenant_id FROM users WHERE email = ?', 
      ['shyamlaxmi2008@yahoo.com']
    );
    
    if (users.length === 0) {
      console.log('❌ User not found');
      return;
    }
    
    const user = users[0];
    console.log('✅ User found:');
    console.log('  ID:', user.id);
    console.log('  Email:', user.email);
    console.log('  Tenant ID:', user.tenant_id);
    console.log('  Legacy Role: N/A (no role column in users table)');
    console.log('');
    
    // Get user roles from RBAC system
    const [userRoles] = await pool.query(`
      SELECT 
        r.name as role_name, 
        r.tenant_id as role_tenant_id, 
        ur.created_at,
        ur.scope,
        ur.store_id
      FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = ?
    `, [user.id]);
    
    console.log('📋 RBAC Roles assigned:');
    if (userRoles.length === 0) {
      console.log('  ❌ No roles found in user_roles table');
    } else {
      userRoles.forEach((role, index) => {
        console.log(`  ${index + 1}. ${role.role_name}`);
        console.log(`     Tenant ID: ${role.role_tenant_id}`);
        console.log(`     Scope: ${role.scope || 'tenant'}`);
        console.log(`     Store ID: ${role.store_id || 'NULL'}`);
        console.log(`     Created: ${role.created_at}`);
        console.log('');
      });
    }
    
    // Test RBAC service
    console.log('🔍 Testing RBAC service...');
    const rbacService = require('./services/rbacService');
    const rbacData = await rbacService.getUserRolesAndPermissions(user.id, user.tenant_id, null);
    
    console.log('RBAC Service Result:');
    console.log('  Roles:', rbacData.roleNames);
    console.log('  Permissions count:', rbacData.permissions.length);
    console.log('  System roles:', rbacData.systemRoles);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkUserRoles();
