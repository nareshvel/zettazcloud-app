/**
 * Test Permission Seeding Service
 * Tests the corrected permission seeding for new tenant onboarding
 */

const PermissionSeedingService = require('../services/permissionSeedingService');
const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'digitpulse_zcloud',
  port: process.env.MYSQL_PORT || 3306
};

async function testPermissionSeeding() {
  let connection;
  
  try {
    console.log('🧪 Starting Permission Seeding Test...');
    
    // Create database connection
    connection = await mysql.createConnection(dbConfig);
    
    const testTenantId = 'test-tenant-001';
    const testUserId = 'test-user-001';
    
    // Step 1: Verify test tenant exists
    const [tenantCheck] = await connection.execute(
      'SELECT id, name FROM tenants WHERE id = ?',
      [testTenantId]
    );
    
    if (tenantCheck.length === 0) {
      console.log('❌ Test tenant not found. Run corrected_test_tenant_onboarding.sql first.');
      return;
    }
    
    console.log(`✅ Test tenant found: ${tenantCheck[0].name}`);
    
    // Step 2: Check current permissions count
    const [permissionCount] = await connection.execute('SELECT COUNT(*) as count FROM permissions');
    console.log(`📊 Current system permissions: ${permissionCount[0].count}`);
    
    if (permissionCount[0].count !== 81) {
      console.log('⚠️ Warning: Expected 81 permissions, found ' + permissionCount[0].count);
    }
    
    // Step 3: Create default roles with permissions
    console.log('🔧 Creating default roles with permissions...');
    
    const createdRoles = await PermissionSeedingService.createDefaultRolesWithPermissions(
      testTenantId, 
      testUserId, 
      connection
    );
    
    console.log(`✅ Created ${createdRoles.length} roles:`);
    createdRoles.forEach(role => {
      console.log(`   - ${role.name}: ${role.permissionCount} permissions`);
    });
    
    // Step 4: Verify role permission counts
    console.log('🔍 Verifying role permission counts...');
    
    const [rolePermissionCounts] = await connection.execute(`
      SELECT 
        r.name as role_name,
        COUNT(rp.permission_id) as permission_count,
        CASE 
          WHEN r.name = 'Tenant Admin' THEN 81
          WHEN r.name = 'Store Manager' THEN 58
          WHEN r.name = 'Cashier' THEN 18
          WHEN r.name = 'Inventory Manager' THEN 28
          WHEN r.name = 'Reports Viewer' THEN 12
        END as expected_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      WHERE r.tenant_id = ?
      GROUP BY r.id, r.name
      ORDER BY r.name
    `, [testTenantId]);
    
    console.log('\n📋 Role Permission Verification:');
    let allCorrect = true;
    
    rolePermissionCounts.forEach(role => {
      const status = role.permission_count === role.expected_count ? '✅' : '❌';
      console.log(`${status} ${role.role_name}: ${role.permission_count}/${role.expected_count} permissions`);
      
      if (role.permission_count !== role.expected_count) {
        allCorrect = false;
      }
    });
    
    // Step 5: Final summary
    console.log('\n🎯 Test Results Summary:');
    console.log(`- System Permissions: ${permissionCount[0].count}/81 ${permissionCount[0].count === 81 ? '✅' : '❌'}`);
    console.log(`- Roles Created: ${createdRoles.length}/5 ${createdRoles.length === 5 ? '✅' : '❌'}`);
    console.log(`- Permission Counts: ${allCorrect ? '✅ All Correct' : '❌ Some Incorrect'}`);
    
    if (permissionCount[0].count === 81 && createdRoles.length === 5 && allCorrect) {
      console.log('\n🎉 SUCCESS: Tenant onboarding creates perfect RBAC system!');
    } else {
      console.log('\n⚠️ ISSUES: Tenant onboarding needs fixes before production.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run the test
testPermissionSeeding();
