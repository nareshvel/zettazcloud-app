const db = require('../db');

async function checkUserTenantId() {
  try {
    console.log('Checking tenant IDs for admin@deshvidesh.com...');
    
    // First, let's check what we get directly from the query
    const result = await db.query('SELECT id, email, tenant_id FROM users WHERE email = ?', ['admin@deshvidesh.com']);
    console.log('Raw query result:', JSON.stringify(result, null, 2));
    
    // Based on the output, it seems the db.query returns the rows directly, not in a nested array
    const user = result[0]; // The first (and only) user in the result
    
    if (!user) {
      console.log('User not found!');
      return;
    }
    
    console.log('User in database:', JSON.stringify(user, null, 2));
    
    if (!user.id) {
      console.log('User data is missing ID');
      return;
    }
    
    // Look at all user_roles
    console.log('\nFetching user roles based on user ID:', user.id);
    const userRolesResult = await db.query(`
      SELECT ur.*, r.name as role_name, r.tenant_id 
      FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = ?
    `, [user.id]);
    
    const userRoles = userRolesResult[0];
    console.log('User roles:', JSON.stringify(userRoles, null, 2));
    
    if (userRoles.length > 0) {
      console.log('\nComparing tenant IDs:');
      console.log('User tenant_id:', user.tenant_id);
      console.log('Role tenant_id:', userRoles[0].tenant_id);
      
      // Also check if there are any system roles (tenant_id IS NULL)
      const systemRolesResult = await db.query(`
        SELECT r.id, r.name, r.tenant_id 
        FROM roles r 
        WHERE r.tenant_id IS NULL
      `);
      
      const systemRoles = systemRolesResult[0];
      console.log('\nAvailable system roles:', JSON.stringify(systemRoles, null, 2));
      
      // Now check the specific admin@deshvidesh.com user data
      console.log('\nChecking specifically for email and tenant ID:');
      const specificUserResult = await db.query(`
        SELECT u.id, u.email, u.tenant_id, r.name as role_name, r.tenant_id as role_tenant_id
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.email = ?
      `, ['admin@deshvidesh.com']);
      
      console.log('User with roles:', JSON.stringify(specificUserResult[0], null, 2));
    } else {
      console.log('No roles found for this user!');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit();
  }
}

checkUserTenantId();
