/**
 * Migration script to ensure all users with legacy roles have corresponding RBAC role assignments
 * 
 * This script:
 * 1. Finds all users without RBAC role assignments
 * 2. Creates appropriate role assignments based on their legacy role column
 * 3. Reports on the migration status
 * 
 * Run with: node scripts/migrate_legacy_roles.js
 */

require('dotenv').config();
const { v4: uuid } = require('uuid');
const db = require('../config/db');

// Display script info
console.log('---------------------------------------------');
console.log('RBAC Migration: Legacy Role to User Roles Table');
console.log('---------------------------------------------');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('Database:', process.env.MYSQL_DATABASE || 'digitpulse_zcloud');
console.log('---------------------------------------------\n');

/**
 * Map legacy roles to role names in the roles table
 * Note: These should match your actual role names in the roles table
 */
const LEGACY_ROLE_MAP = {
  'admin': 'admin',
  'manager': 'manager',
  'cashier': 'cashier'
};

async function migrateRoles() {
  console.log('Starting legacy role migration...');
  
  try {
    // First, get users without RBAC roles
    const usersWithoutRoles = await db.query(`
      SELECT u.id, u.name, u.email, u.role, u.tenant_id, u.store_id 
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      WHERE ur.id IS NULL
    `);
    
    console.log(`Found ${usersWithoutRoles.length} users without RBAC role assignments.`);
    
    // Process users with transaction support
    await db.executeTransaction(async (connection) => {
      
      // Process each user
      let successCount = 0;
      let failureCount = 0;
      
      for (const user of usersWithoutRoles) {
        try {
          // Find the corresponding role in the roles table
          const legacyRoleName = LEGACY_ROLE_MAP[user.role];
          
          if (!legacyRoleName) {
            console.warn(`Warning: Unknown legacy role '${user.role}' for user ${user.id}`);
            failureCount++;
            continue;
          }
          
          const [roles] = await connection.execute(
            'SELECT id FROM roles WHERE name = ? AND tenant_id = ?',
            [legacyRoleName, user.tenant_id]
          );
          
          if (roles.length === 0) {
            console.warn(`Warning: No matching role found for '${legacyRoleName}' in tenant ${user.tenant_id}`);
            failureCount++;
            continue;
          }
          
          const roleId = roles[0].id;
          
          // Create user_role entry
          const scope = user.store_id ? 'store' : 'tenant';
          const userRoleId = uuid();
          
          await connection.execute(`
            INSERT INTO user_roles (id, user_id, role_id, scope, store_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NOW(), NOW())
          `, [userRoleId, user.id, roleId, scope, user.store_id]);
          
          console.log(`Created role assignment for user ${user.email}: ${legacyRoleName}`);
          successCount++;
          
        } catch (err) {
          console.error(`Error processing user ${user.id}:`, err.message);
          failureCount++;
          // Individual user errors don't fail the entire transaction
        }
      }
      
      // Log summary before committing
      console.log('\nMigration Summary:');
      console.log(`- Total users processed: ${usersWithoutRoles.length}`);
      console.log(`- Successful migrations: ${successCount}`);
      console.log(`- Failed migrations: ${failureCount}`);
      
      // Verify results
      const [remainingUsers] = await connection.execute(`
        SELECT COUNT(*) as count
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        WHERE ur.id IS NULL
      `);
      
      if (remainingUsers[0].count > 0) {
        console.warn(`\nWarning: ${remainingUsers[0].count} users still have no RBAC roles assigned.`);
        console.warn('Review the logs and run the script again if needed.');
      } else {
        console.log('\nSuccess! All users now have RBAC role assignments.');
      }
    });
    
    console.log('Transaction completed successfully.');
    
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

// Run migration and exit when complete
async function run() {
  try {
    await migrateRoles();
    console.log('\nMigration process completed. Please check the logs for any warnings.');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

run();
