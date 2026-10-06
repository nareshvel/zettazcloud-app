#!/usr/bin/env node

/**
 * Direct RBAC Service Test
 * This script directly tests the RBAC service to debug the role assignment issue
 */

const rbacService = require('./services/rbacService');

async function testRbacService() {
  console.log('🧪 Testing RBAC Service Directly...');
  
  const userId = '8f13e2ff-d318-4808-954b-1eaad85ca529';
  const tenantId = 'c6516ca6-4f26-45b7-8d83-3a35f5e4a6bd';
  const storeId = '1a736472-4141-45db-81f3-d8a282abe2ea';
  
  console.log('📋 Test Parameters:');
  console.log(`  User ID: ${userId}`);
  console.log(`  Tenant ID: ${tenantId}`);
  console.log(`  Store ID: ${storeId}`);
  console.log('');
  
  try {
    console.log('🔍 Calling rbacService.getUserRolesAndPermissions...');
    const result = await rbacService.getUserRolesAndPermissions(userId, tenantId, storeId);
    
    console.log('✅ RBAC Service Result:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('📊 Summary:');
    console.log(`  Roles: ${result.roles ? result.roles.length : 0}`);
    console.log(`  Role Names: ${result.roleNames ? result.roleNames.length : 0}`);
    console.log(`  Permissions: ${result.permissions ? result.permissions.length : 0}`);
    console.log(`  System Roles: ${result.systemRoles ? result.systemRoles.length : 0}`);
    
    if (result.roleNames && result.roleNames.length > 0) {
      console.log(`  Role Names: ${result.roleNames.join(', ')}`);
    }
    
    if (result.permissions && result.permissions.length > 0) {
      console.log(`  Sample Permissions: ${result.permissions.slice(0, 5).join(', ')}`);
    }
    
  } catch (error) {
    console.error('❌ RBAC Service Error:');
    console.error(`  Message: ${error.message}`);
    console.error(`  Stack: ${error.stack}`);
  }
}

// Run the test
testRbacService()
  .then(() => {
    console.log('🏁 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
