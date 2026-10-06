const axios = require('axios');
const db = require('../db');

// Test configuration
const API_URL = 'http://localhost:3001';
const TEST_USER = {
  email: 'admin@deshvidesh.com',
  password: 'Password!1234' // Correct password provided by the user
};

async function testLoginAndRBAC() {
  try {
    console.log('=== RBAC LOGIN TEST ===');
    
    // Step 1: Verify user in database and their roles
    console.log('\n--- STEP 1: Checking user and roles in database ---');
    
    const users = await db.query('SELECT id, email, tenant_id FROM users WHERE email = ?', [TEST_USER.email]);
    
    if (!users || users.length === 0) {
      console.error('User not found in database');
      return;
    }
    
    const user = users[0];
    console.log('User in database:', JSON.stringify(user, null, 2));
    
    // Check user roles in database
    const userRoles = await db.query(`
      SELECT ur.*, r.name as role_name, r.tenant_id as role_tenant_id
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `, [user.id]);
    
    console.log(`Found ${userRoles.length} roles in database for user:`, 
      userRoles.map(r => `${r.role_name} (tenant: ${r.role_tenant_id || 'system'})`));
      
    if (userRoles.length === 0) {
      console.warn('⚠️ WARNING: User has no roles in database!');
    } else {
      console.log('User has roles with tenant_id:', userRoles[0].role_tenant_id);
      console.log('User\'s own tenant_id:', user.tenant_id);
      
      if (userRoles[0].role_tenant_id !== user.tenant_id) {
        console.warn('⚠️ WARNING: Tenant ID mismatch between user and roles!');
      }
    }

    // Step 2: Test login API
    console.log('\n--- STEP 2: Testing login API ---');
    
    try {
      const loginResponse = await axios.post(`${API_URL}/api/auth/login`, {
        email: TEST_USER.email,
        password: TEST_USER.password
      });
      
      console.log('Login successful:', loginResponse.status === 200);
      
      if (loginResponse.data && loginResponse.data.token) {
        console.log('JWT token received');
        
        // Analyze token payload
        const tokenPayload = parseJwt(loginResponse.data.token);
        console.log('Token payload:', JSON.stringify(tokenPayload, null, 2));
        
        // Check RBAC data in token
        console.log('\nRBAC Data in token:');
        console.log(`- Roles: ${tokenPayload.roles ? tokenPayload.roles.length : 0} (${tokenPayload.roles?.join(', ') || 'none'})`);
        console.log(`- System Roles: ${tokenPayload.systemRoles ? tokenPayload.systemRoles.length : 0} (${tokenPayload.systemRoles?.join(', ') || 'none'})`);
        console.log(`- Permissions: ${tokenPayload.permissions ? tokenPayload.permissions.length : 0}`);
        
        if ((!tokenPayload.roles || tokenPayload.roles.length === 0) && 
            (!tokenPayload.systemRoles || tokenPayload.systemRoles.length === 0)) {
          console.error('❌ ERROR: No roles found in JWT token!');
        } else {
          console.log('✅ SUCCESS: Roles found in JWT token');
        }
        
        if (!tokenPayload.permissions || tokenPayload.permissions.length === 0) {
          console.error('❌ ERROR: No permissions found in JWT token!');
        } else {
          console.log('✅ SUCCESS: Permissions found in JWT token');
        }
        
        // Step 3: Test API with token to check RBAC
        console.log('\n--- STEP 3: Testing authenticated API with token ---');
        
        try {
          const meResponse = await axios.get(`${API_URL}/api/users/me`, {
            headers: {
              'Authorization': `Bearer ${loginResponse.data.token}`
            }
          });
          
          console.log('Auth check successful:', meResponse.status === 200);
          console.log('User data received:', JSON.stringify(meResponse.data, null, 2));
          
          // Check if user data includes RBAC info
          if (meResponse.data && meResponse.data.user) {
            const userData = meResponse.data.user;
            console.log('\nRBAC Data in user profile:');
            console.log(`- Roles: ${userData.roles ? userData.roles.length : 0}`);
            console.log(`- System Roles: ${userData.systemRoles ? userData.systemRoles.length : 0}`);
            console.log(`- Permissions: ${userData.permissions ? userData.permissions.length : 0}`);
          }
          
        } catch (authError) {
          console.error('❌ ERROR: Auth check failed:', authError.response?.data || authError.message);
        }
      } else {
        console.error('❌ ERROR: No token in login response');
      }
      
    } catch (loginError) {
      console.error('❌ ERROR: Login failed:', loginError.response?.data || loginError.message);
    }
    
  } catch (error) {
    console.error('Error in test:', error);
  } finally {
    process.exit();
  }
}

// Helper function to parse JWT token
function parseJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(Buffer.from(base64, 'base64').toString().split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  
  return JSON.parse(jsonPayload);
}

testLoginAndRBAC();
