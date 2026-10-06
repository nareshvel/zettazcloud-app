/**
 * Enhanced test script for the /api/users/me endpoint
 */
const axios = require('axios');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Test configuration
const API_URL = 'http://localhost:3001';
const TEST_USER = {
  email: 'admin@deshvidesh.com',
  password: 'Password!1234'
};

// Use credentials from frontend .env
const dbConfig = {
  host: 'mysql.us.cloudlogin.co',
  user: 'digitpulse_zcloud',
  password: 'MyAntigua!2025',
  database: 'digitpulse_zcloud',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Helper function to parse JWT token
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64').toString()
        .split('').map(c => {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error parsing JWT:', error);
    return null;
  }
}

async function testDatabaseConnection() {
  let connection;
  try {
    console.log('Testing database connection...');
    connection = await mysql.createConnection(dbConfig);
    await connection.ping();
    console.log('✅ Database connection successful!');
    
    // Verify if user exists in database
    const [users] = await connection.query(
      'SELECT id, name, email, tenant_id FROM users WHERE email = ?', 
      [TEST_USER.email]
    );
    
    if (users.length > 0) {
      console.log('✅ Test user found in database:', users[0]);
    } else {
      console.log('❌ Test user not found in database!');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error);
    return false;
  } finally {
    if (connection) await connection.end();
  }
}

async function testUsersMe() {
  try {
    console.log('=== Testing /api/users/me Endpoint ===');
    
    // First, test database connection
    await testDatabaseConnection();
    
    // 1. Login to get JWT token
    console.log('\n1. Logging in to get token...');
    const loginResponse = await axios.post(`${API_URL}/api/auth/login`, TEST_USER);
    const token = loginResponse.data.token;
    
    if (!token) {
      throw new Error('No token received from login');
    }
    console.log('✅ Login successful, token received');
    
    // Parse JWT token to see what's inside
    const tokenData = parseJwt(token);
    console.log('\nJWT Token contains:');
    console.log('- User ID:', tokenData.id);
    console.log('- Tenant ID:', tokenData.tenant_id);
    console.log('- Roles:', tokenData.roles);
    console.log('- System Roles:', tokenData.systemRoles);
    if (tokenData.permissions) {
      console.log(`- Permissions: [${tokenData.permissions.length} items]`);
    } else {
      console.log('- Permissions: undefined');
    }
    
    // 2. Call the /api/users/me endpoint with the token
    console.log('\n2. Calling /api/users/me endpoint...');
    try {
      const meResponse = await axios.get(`${API_URL}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Debug': 'true' // Add a debug flag
        }
      });
      
      console.log('✅ /api/users/me endpoint succeeded');
      console.log('Response data:', JSON.stringify(meResponse.data, null, 2));
      
      // 3. Validate the response structure
      console.log('\n3. Validating response structure...');
      const user = meResponse.data;
      
      if (!user.id) console.log('❌ Missing id');
      if (!user.email) console.log('❌ Missing email');
      if (!user.tenant_id) console.log('❌ Missing tenant_id');
      
      if (!user.permissions || !Array.isArray(user.permissions)) {
        console.log('❌ Missing or invalid permissions array');
      } else {
        console.log(`✅ Found ${user.permissions.length} permissions`);
      }
      
      if (!user.roles || !Array.isArray(user.roles)) {
        console.log('❌ Missing or invalid roles array');
      } else {
        console.log(`✅ Found ${user.roles.length} roles: ${user.roles.join(', ')}`);
      }
      
      if (!user.systemRoles || !Array.isArray(user.systemRoles)) {
        console.log('❌ Missing or invalid systemRoles array');
      } else {
        console.log(`✅ Found ${user.systemRoles.length} system roles: ${user.systemRoles.join(', ')}`);
      }
      
    } catch (error) {
      console.log('❌ /api/users/me endpoint failed');
      console.log('Error:', error.message);
      if (error.response) {
        console.log('Response status:', error.response.status);
        console.log('Response data:', error.response.data);
        console.log('Response headers:', error.response.headers);
      }
    }
    
  } catch (error) {
    console.error('Test script error:', error);
  }
}

testUsersMe();
