/**
 * Migration: Migrate Legacy Roles to RBAC System
 * 
 * This script migrates users with legacy role values to the new RBAC system by:
 * 1. Finding all users with legacy roles not yet assigned in RBAC
 * 2. Converting each legacy role to equivalent RBAC roles and permissions
 * 3. Assigning appropriate roles to each user based on their legacy role
 * 
 * Run this BEFORE the 20250625_remove_legacy_role_column.js script
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const rbacService = require('../services/rbacService');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Map legacy roles to RBAC roles
const roleMapping = {
  'admin': {
    tenantRoles: ['Tenant Admin'],
    systemRoles: [], 
  },
  'tenant admin': {
    tenantRoles: ['Tenant Admin'],
    systemRoles: [], 
  },
  'manager': {
    tenantRoles: ['Store Manager'],
    systemRoles: [],
  },
  'cashier': {
    tenantRoles: ['Cashier'],
    systemRoles: [],
  },
  'owner': {
    tenantRoles: ['Tenant Admin'],
    systemRoles: ['System Admin'],
  },
  'support': {
    tenantRoles: [],
    systemRoles: ['Support Agent'],
  },
  // Add any other legacy roles your system might have
};

async function getConnection() {
  return await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT || 3306
  });
}

/**
 * Find all users who need migration
 * (those who have a legacy role but no RBAC roles)
 */
async function findUsersNeedingMigration() {
  const connection = await getConnection();
  
  try {
    console.log('Finding users with legacy roles who need migration to RBAC...');
    
    // Get all users with their legacy roles
    const [users] = await connection.query('SELECT id, email, role, tenant_id FROM users WHERE role IS NOT NULL');
    console.log(`Found ${users.length} total users with legacy roles`);
    
    const usersNeedingMigration = [];
    
    // Check which users already have RBAC roles
    for (const user of users) {
      try {
        const rbacData = await rbacService.getUserRolesAndPermissions(user.id);
        
        // If user has no roles in RBAC, they need migration
        if (!rbacData.roleNames || rbacData.roleNames.length === 0) {
          usersNeedingMigration.push(user);
        }
      } catch (error) {
        console.error(`Error checking RBAC roles for user ${user.id} (${user.email}):`, error.message);
        // If we can't check, assume they need migration
        usersNeedingMigration.push(user);
      }
    }
    
    return usersNeedingMigration;
  } finally {
    await connection.end();
  }
}

/**
 * Get role IDs by name (for both system and tenant roles)
 */
async function getRoleIdsByName() {
  const connection = await getConnection();
  
  try {
    // Get tenant role IDs
    const [tenantRoles] = await connection.query('SELECT id, name FROM roles');
    const tenantRoleMap = tenantRoles.reduce((acc, role) => {
      acc[role.name] = role.id;
      return acc;
    }, {});
    
    // Get system role IDs
    const [systemRoles] = await connection.query('SELECT id, name FROM system_roles');
    const systemRoleMap = systemRoles.reduce((acc, role) => {
      acc[role.name] = role.id;
      return acc;
    }, {});
    
    return { tenantRoleMap, systemRoleMap };
  } finally {
    await connection.end();
  }
}

/**
 * Assign RBAC roles to a user
 */
async function assignRolesToUser(user, roleIds) {
  const { tenantRoleIds, systemRoleIds } = roleIds;
  
  try {
    // Assign tenant roles
    for (const roleId of tenantRoleIds) {
      if (!roleId) continue; // Skip if role ID is not found
      
      try {
        await rbacService.assignTenantRole(
          user.id, 
          roleId, 
          user.tenant_id, 
          'tenant', // scope
          null, // storeId
          'system' // assignedBy (system for migration)
        );
        console.log(`✓ Assigned tenant role ${roleId} to user ${user.email}`);
      } catch (error) {
        console.error(`Error assigning tenant role ${roleId} to user ${user.id}:`, error.message);
      }
    }
    
    // Assign system roles
    for (const roleId of systemRoleIds) {
      if (!roleId) continue; // Skip if role ID is not found
      
      try {
        await rbacService.assignSystemRole(
          user.id,
          roleId,
          'system' // assignedBy (system for migration)
        );
        console.log(`✓ Assigned system role ${roleId} to user ${user.email}`);
      } catch (error) {
        console.error(`Error assigning system role ${roleId} to user ${user.id}:`, error.message);
      }
    }
    
    return true;
  } catch (error) {
    console.error(`Failed to assign roles to user ${user.id}:`, error);
    return false;
  }
}

/**
 * Main migration function
 */
async function migrateUsers() {
  try {
    console.log('Starting migration of legacy roles to RBAC system...');
    
    // Get users needing migration
    const usersNeedingMigration = await findUsersNeedingMigration();
    
    if (usersNeedingMigration.length === 0) {
      console.log('✅ No users need migration! All users already have RBAC roles assigned.');
      return { success: true, totalMigrated: 0 };
    }
    
    console.log(`Found ${usersNeedingMigration.length} users needing migration to RBAC`);
    
    // Get role IDs by name
    const { tenantRoleMap, systemRoleMap } = await getRoleIdsByName();
    
    // Log available roles for debugging
    console.log('Available tenant roles:', Object.keys(tenantRoleMap).join(', '));
    console.log('Available system roles:', Object.keys(systemRoleMap).join(', '));
    
    // Process each user
    const results = {
      success: 0,
      failure: 0,
      users: []
    };
    
    for (const user of usersNeedingMigration) {
      console.log(`\nMigrating user: ${user.email} (${user.id}) with legacy role "${user.role}"`);
      
      // Skip users without tenant_id for tenant roles
      if (!user.tenant_id && user.role !== 'support') {
        console.warn(`⚠️ User ${user.email} has no tenant_id, can only assign system roles`);
      }
      
      // Map legacy role to RBAC roles
      const legacyRole = user.role.toLowerCase();
      const mappedRoles = roleMapping[legacyRole] || { tenantRoles: [], systemRoles: [] };
      
      // Get role IDs from names
      const tenantRoleIds = mappedRoles.tenantRoles
        .map(name => tenantRoleMap[name])
        .filter(id => id); // Filter out undefined
        
      const systemRoleIds = mappedRoles.systemRoles
        .map(name => systemRoleMap[name])
        .filter(id => id); // Filter out undefined
      
      // Log roles to be assigned
      console.log(`- Tenant roles to assign: ${mappedRoles.tenantRoles.join(', ') || 'None'}`);
      console.log(`- System roles to assign: ${mappedRoles.systemRoles.join(', ') || 'None'}`);
      
      // Assign roles
      const success = await assignRolesToUser(user, { tenantRoleIds, systemRoleIds });
      
      if (success) {
        results.success++;
        results.users.push({ id: user.id, email: user.email, status: 'migrated' });
      } else {
        results.failure++;
        results.users.push({ id: user.id, email: user.email, status: 'failed' });
      }
    }
    
    return {
      success: true,
      totalUsers: usersNeedingMigration.length,
      successfulMigrations: results.success,
      failedMigrations: results.failure,
      userResults: results.users
    };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Run the migration
 */
/**
 * Check if the role column exists in the users table
 */
async function checkIfRoleColumnExists() {
  const connection = await getConnection();
  
  try {
    console.log('Checking if role column exists in users table...');
    
    // Get table information
    const [columns] = await connection.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS " +
      "WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'",
      [process.env.MYSQL_DATABASE]
    );
    
    return columns.length > 0;
  } finally {
    await connection.end();
  }
}

async function run() {
  try {
    console.log('---------------------------------------------');
    console.log('Migration: Legacy Roles to RBAC');
    console.log('---------------------------------------------');
    console.log('Database:', process.env.MYSQL_DATABASE || 'digitpulse_zcloud');
    console.log('---------------------------------------------\n');
    
    // First check if the role column exists
    const roleColumnExists = await checkIfRoleColumnExists();
    
    if (!roleColumnExists) {
      console.log('✅ The role column does not exist in the users table.');
      console.log('This indicates that either:');
      console.log('1. The migration has already been completed');
      console.log('2. The system was never using legacy roles');
      console.log('\nNo migration is needed!');
      return;
    }
    
    const results = await migrateUsers();
    
    if (results.success) {
      if (results.totalUsers > 0) {
        console.log('\n✅ Migration completed!');
        console.log(`- Total users processed: ${results.totalUsers}`);
        console.log(`- Successfully migrated: ${results.successfulMigrations}`);
        console.log(`- Failed migrations: ${results.failedMigrations}`);
        
        if (results.failedMigrations > 0) {
          console.log('\n⚠️ Some users could not be migrated. Please check the logs above and resolve manually.');
        }
      }
      
      console.log('\n---------------------------------------------');
      console.log('Next steps:');
      console.log('1. Verify users have correct RBAC roles');
      console.log('2. Run 20250625_remove_legacy_role_column.js to complete migration');
      console.log('---------------------------------------------');
    } else {
      console.error('\n❌ Migration failed:');
      console.error(results.error);
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
run();
