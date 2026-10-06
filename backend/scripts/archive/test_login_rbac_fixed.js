const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Test configuration
const API_URL = 'http://localhost:3001';
const TEST_USER = {
  email: 'admin@deshvidesh.com',
  password: 'Password!1234'
};

// Create a direct database connection with hardcoded values from .env
const dbConfig = {
  host: 'mysql.us.cloudlogin.co',
  user: 'digitpulse_zcloud',
  password: 'MyAntigua!2025',
  database: 'digitpulse_zcloud'
};

async function testLoginAndRBAC() {
  let pool;
  let token;
  
  try {
    console.log('=== RBAC LOGIN TEST ===');
    console.log(`Database config: ${dbConfig.host}, ${dbConfig.user}, ${dbConfig.database}`);
    
    // Create pool for this test
    pool = mysql.createPool(dbConfig);
    
    // Step 1: Verify user in database and their roles
    console.log('\n--- STEP 1: Checking user and roles in database ---');
    
    const [users] = await pool.query('SELECT id, email, tenant_id FROM users WHERE email = ?', [TEST_USER.email]);
    
    if (!users || users.length === 0) {
      console.error('User not found in database');
      return;
    }
    
    const user = users[0];
    console.log('User in database:', JSON.stringify(user, null, 2));
    
    // Check user roles in database
    const [userRoles] = await pool.query(`
      SELECT ur.*, r.name as role_name, r.tenant_id as role_tenant_id
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `, [user.id]);
    
    console.log(`Found ${userRoles.length} roles in database for user:`, 
      userRoles.map(r => `${r.role_name} (tenant: ${r.role_tenant_id || 'system'})`));
    
    // Step 2: Test login API
    console.log('\n--- STEP 2: Testing login API ---');
    
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, TEST_USER);
    
    if (loginResponse.status !== 200) {
      console.error('Login failed:', loginResponse.status, loginResponse.data);
      return;
    }
    
    console.log('Login successful!');
    token = loginResponse.data.token;
    
    // Parse and check token
    const tokenPayload = parseJwt(token);
    console.log('\nJWT Token contains:');
    console.log('- User ID:', tokenPayload.id);
    console.log('- Tenant ID:', tokenPayload.tenant_id);
    console.log('- Roles:', tokenPayload.roles);
    console.log('- System Roles:', tokenPayload.systemRoles);
    console.log('- Permissions:', tokenPayload.permissions);
    
    if (!tokenPayload.roles || tokenPayload.roles.length === 0) {
      console.warn('⚠️ WARNING: No roles found in JWT token!');
    }
    
    if (!tokenPayload.permissions || tokenPayload.permissions.length === 0) {
      console.warn('⚠️ WARNING: No permissions found in JWT token!');
    }
    
    // Step 3: Test authenticated user API
    console.log('\n--- STEP 3: Testing /api/users/me endpoint ---');
    
    const userResponse = await axios.get(`${API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (userResponse.status !== 200) {
      console.error('User API failed:', userResponse.status, userResponse.data);
      return;
    }
    
    console.log('User API response:', JSON.stringify(userResponse.data, null, 2));
    
    // Verify RBAC data in user API response
    console.log('\nVerifying RBAC data in user API response:');
    console.log('- Roles:', userResponse.data.roles);
    console.log('- System Roles:', userResponse.data.systemRoles);
    console.log('- Permissions:', userResponse.data.permissions);
    
    if (!userResponse.data.roles || userResponse.data.roles.length === 0) {
      console.warn('⚠️ WARNING: No roles found in user API response!');
    }
    
    if (!userResponse.data.permissions || userResponse.data.permissions.length === 0) {
      console.warn('⚠️ WARNING: No permissions found in user API response!');
    }
    
    console.log('\n✅ TEST COMPLETE');
    
  } catch (error) {
    console.error('Error in test:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Helper function to parse JWT token
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64').toString().split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Error parsing JWT:', e);
    return {};
  }
}

testLoginAndRBAC();
