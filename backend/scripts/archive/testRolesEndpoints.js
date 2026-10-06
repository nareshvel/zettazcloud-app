/**
 * Test script for roles endpoints with authentication
 * 
 * This script:
 * 1. Gets a JWT token by logging in
 * 2. Tests the regular /api/roles endpoint 
 * 3. Tests our direct debug endpoint
 * 4. Compares the results to identify any discrepancies
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const API_URL = 'http://localhost:3001';
const TEST_USER = {
  email: 'admin@example.com', // Default admin email
  password: 'admin123'       // Default admin password
};

// Global auth token
let authToken;

/**
 * Login and get authentication token
 */
async function login() {
  try {
    console.log('Logging in to get authentication token...');
    const response = await axios.post(`${API_URL}/api/auth/login`, TEST_USER);
    authToken = response.data.token;
    console.log('Authentication successful, token received.');
    
    // Extract and show important info from JWT token
    const tokenParts = authToken.split('.');
    if (tokenParts.length === 3) {
      try {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
        console.log('\nToken information:');
        console.log('- User ID:', payload.id);
        console.log('- Tenant ID:', payload.tenant_id);
        if (payload.store_id) {
          console.log('- Store ID:', payload.store_id);
        } else {
          console.log('- Store ID: Not provided in token');
        }
      } catch (e) {
        console.error('Error parsing token payload:', e.message);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Test the regular roles API endpoint
 */
async function testRegularRolesEndpoint() {
  try {
    console.log('\n========== TESTING REGULAR ROLES ENDPOINT ==========');
    console.log('GET', `${API_URL}/api/roles`);
    
    const response = await axios.get(`${API_URL}/api/roles`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('Status:', response.status);
    console.log('Response data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Check response format
    if (Array.isArray(response.data)) {
      console.log('\nResponse is an ARRAY containing', response.data.length, 'roles');
    } else if (response.data && typeof response.data === 'object' && 'roles' in response.data) {
      const roles = response.data.roles;
      if (Array.isArray(roles)) {
        console.log('\nResponse has a "roles" property with an ARRAY containing', roles.length, 'roles');
      } else {
        console.log('\nResponse has a "roles" property but it is NOT an array!');
        console.log('Type of roles:', typeof roles);
      }
    } else {
      console.log('\nResponse format is unexpected - neither an array nor an object with a roles array property');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error testing regular roles endpoint:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Test the direct debug roles endpoint
 */
async function testDirectDebugEndpoint() {
  try {
    console.log('\n========== TESTING DIRECT DEBUG ROLES ENDPOINT ==========');
    console.log('GET', `${API_URL}/api/direct-debug/roles`);
    
    const response = await axios.get(`${API_URL}/api/direct-debug/roles`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('Status:', response.status);
    console.log('Response data:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Check response format
    if (Array.isArray(response.data)) {
      console.log('\nResponse is an ARRAY containing', response.data.length, 'roles');
    } else if (response.data && typeof response.data === 'object' && 'roles' in response.data) {
      const roles = response.data.roles;
      if (Array.isArray(roles)) {
        console.log('\nResponse has a "roles" property with an ARRAY containing', roles.length, 'roles');
      } else {
        console.log('\nResponse has a "roles" property but it is NOT an array!');
        console.log('Type of roles:', typeof roles);
      }
    } else {
      console.log('\nResponse format is unexpected - neither an array nor an object with a roles array property');
    }
    
    return response.data;
  } catch (error) {
    console.error('Error testing direct debug endpoint:', error.response?.data || error.message);
    return null;
  }
}

/**
 * Compare the results from both endpoints
 */
function compareResults(regularResults, debugResults) {
  console.log('\n========== COMPARING RESULTS ==========');
  
  // Extract roles arrays for comparison
  const regularRoles = Array.isArray(regularResults) ? regularResults : 
                      (regularResults && regularResults.roles ? regularResults.roles : []);
  
  const debugRoles = Array.isArray(debugResults) ? debugResults : 
                    (debugResults && debugResults.roles ? debugResults.roles : []);
  
  console.log('Regular endpoint returned', regularRoles.length, 'roles');
  console.log('Debug endpoint returned', debugRoles.length, 'roles');
  
  if (regularRoles.length !== debugRoles.length) {
    console.log('\n⚠️ DISCREPANCY: The number of roles differs between endpoints!');
    console.log('This suggests a problem in the backend roleService.js getTenantRoles function.');
  } else {
    console.log('\n✅ Both endpoints return the same number of roles.');
  }
  
  // Compare role IDs to see if they're the same roles
  const regularIds = regularRoles.map(r => r.id).sort();
  const debugIds = debugRoles.map(r => r.id).sort();
  
  const onlyInRegular = regularIds.filter(id => !debugIds.includes(id));
  const onlyInDebug = debugIds.filter(id => !regularIds.includes(id));
  
  if (onlyInRegular.length > 0) {
    console.log('\n⚠️ Roles found in regular API but missing in debug API:', onlyInRegular);
  }
  
  if (onlyInDebug.length > 0) {
    console.log('\n⚠️ Roles found in debug API but missing in regular API:', onlyInDebug);
    console.log('This confirms the backend service layer is not returning all roles.');
  }
  
  if (onlyInRegular.length === 0 && onlyInDebug.length === 0 && regularIds.length > 0) {
    console.log('\n✅ Both endpoints return the exact same role IDs.');
  }
}

/**
 * Main function
 */
async function main() {
  console.log('Starting roles endpoint test...');
  
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('Cannot proceed without authentication. Exiting.');
    return;
  }
  
  const regularResults = await testRegularRolesEndpoint();
  const debugResults = await testDirectDebugEndpoint();
  
  if (regularResults && debugResults) {
    compareResults(regularResults, debugResults);
    
    console.log('\n========== CONCLUSION ==========');
    console.log('If both endpoints return different numbers of roles:');
    console.log('- Issue is likely in the backend roleService.js - it\'s not returning all roles.');
    
    console.log('\nIf both return the same roles but frontend only shows one:');
    console.log('- Issue is likely in frontend parsing or rendering logic.');
    
    console.log('\nCheck getTenantRoles in backend/services/roleService.js');
    console.log('Ensure it properly handles both single and multiple role results.');
  } else {
    console.log('\nCannot compare results because one or both endpoints failed.');
  }
}

// Run the main function
main().catch(console.error);
