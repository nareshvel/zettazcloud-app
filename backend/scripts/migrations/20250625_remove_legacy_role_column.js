/**
 * Migration: Remove Legacy Role Column
 * 
 * This migration removes the legacy 'role' column from the users table
 * after ensuring that all users have been migrated to the RBAC system.
 * 
 * IMPORTANT: Before running this migration, ensure you have:
 * 1. Run the migrate_legacy_roles.js script to ensure all users have RBAC roles
 * 2. Updated the authentication middleware to use RBAC roles and permissions
 * 3. Updated all frontend components to use RBAC permissions instead of the legacy role
 */

const mysql = require('mysql2/promise');
const rbacService = require('../services/rbacService');
require('dotenv').config();

async function validateMigrationReadiness() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT || 3306
  });

  try {
    console.log('Validating that all users have RBAC roles assigned...');
    
    // Get all users
    const [users] = await connection.query('SELECT id, email, role FROM users');
    
    // Check each user for RBAC roles
    const usersWithoutRoles = [];
    
    for (const user of users) {
      try {
        // Use rbacService to get roles for this user
        const rbacData = await rbacService.getUserRolesAndPermissions(user.id);
        
        // If user has no roles, add to list (check roleNames which we know exists in our implementation)
        if (!rbacData.roleNames || rbacData.roleNames.length === 0) {
          usersWithoutRoles.push(user);
        }
      } catch (error) {
        console.error(`Error checking roles for user ${user.id}:`, error);
        usersWithoutRoles.push(user); // Consider this user as needing migration if we can't verify
      }
    }
    
    if (usersWithoutRoles.length > 0) {
      console.error(`⚠️ Migration cannot proceed: ${usersWithoutRoles.length} users don't have RBAC roles:`);
      usersWithoutRoles.forEach(user => {
        console.error(`- User ID: ${user.id}, Email: ${user.email}, Legacy Role: ${user.role}`);
      });
      throw new Error('Some users do not have RBAC roles assigned. Run migration script first.');
    }

    // All checks passed
    return true;
  } finally {
    await connection.end();
  }
}

async function backupUsersTable() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT || 3306
  });

  try {
    // Create a backup of the users table with timestamp
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '');
    const backupTableName = `users_backup_${timestamp}`;
    
    console.log(`Creating backup of users table as ${backupTableName}...`);
    
    // Create backup table
    await connection.execute(`CREATE TABLE ${backupTableName} LIKE users`);
    
    // Copy data
    await connection.execute(`INSERT INTO ${backupTableName} SELECT * FROM users`);
    
    // Verify backup
    const [result] = await connection.execute(`SELECT COUNT(*) as count FROM ${backupTableName}`);
    console.log(`✅ Backup created successfully with ${result[0].count} rows`);
    
    return backupTableName;
  } finally {
    await connection.end();
  }
}

async function executeMigration() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT || 3306
  });

  try {
    console.log('Removing legacy role column from users table...');
    
    // Start transaction
    await connection.beginTransaction();
    
    try {
      // Remove the role column
      await connection.execute('ALTER TABLE users DROP COLUMN role');
      
      // Commit transaction
      await connection.commit();
      console.log('✅ Successfully removed legacy role column from users table');
    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      throw error;
    }
  } finally {
    await connection.end();
  }
}

async function run() {
  try {
    console.log('---------------------------------------------');
    console.log('Migration: Remove Legacy Role Column');
    console.log('---------------------------------------------');
    console.log('Database:', process.env.MYSQL_DATABASE || 'digitpulse_zcloud');
    console.log('---------------------------------------------\n');
    
    // Step 1: Validate that we're ready to migrate
    console.log('Step 1: Validating migration readiness...');
    await validateMigrationReadiness();
    console.log('✅ All users have RBAC roles assigned. Ready to proceed.\n');
    
    // Step 2: Create a backup of the users table
    console.log('Step 2: Creating backup of users table...');
    const backupTable = await backupUsersTable();
    console.log(`✅ Backup created as ${backupTable}\n`);
    
    // Step 3: Execute the migration
    console.log('Step 3: Executing migration to remove role column...');
    await executeMigration();
    
    console.log('\n---------------------------------------------');
    console.log('✅ Migration completed successfully!');
    console.log(`Users table backup: ${backupTable}`);
    console.log('---------------------------------------------');
    
  } catch (error) {
    console.error('\n❌ Migration failed:');
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
run();
