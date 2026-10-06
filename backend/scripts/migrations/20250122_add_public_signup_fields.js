/**
 * Migration: Add Public Signup Fields
 * Date: 2025-01-22
 * Description: Adds email verification, phone number, and tenant setup tracking fields
 * for public self-service signup functionality
 */

const { pool } = require('../config/db');

/**
 * Run the migration - Add fields for public signup
 */
async function up() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🚀 Starting public signup fields migration...');
    
    // Add email verification fields to users table
    console.log('📧 Adding email verification fields to users table...');
    const userColumns = [
      { name: 'email_verified', sql: 'ADD COLUMN email_verified BOOLEAN DEFAULT FALSE' },
      { name: 'verification_token', sql: 'ADD COLUMN verification_token VARCHAR(255) NULL' },
      { name: 'verification_expires', sql: 'ADD COLUMN verification_expires DATETIME NULL' },
      { name: 'phone_number', sql: 'ADD COLUMN phone_number VARCHAR(20) NULL' },
      { name: 'signup_completed', sql: 'ADD COLUMN signup_completed BOOLEAN DEFAULT FALSE' }
    ];
    
    for (const column of userColumns) {
      try {
        await connection.execute(`ALTER TABLE users ${column.sql}`);
        console.log(`  ✅ Added column: ${column.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ℹ️ Column ${column.name} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }
    
    // Add tenant setup tracking fields
    console.log('🏢 Adding tenant setup tracking fields to tenants table...');
    const tenantColumns = [
      { name: 'setup_completed', sql: 'ADD COLUMN setup_completed BOOLEAN DEFAULT FALSE' },
      { name: 'trial_started_at', sql: 'ADD COLUMN trial_started_at DATETIME NULL' },
      { name: 'onboarding_step', sql: 'ADD COLUMN onboarding_step VARCHAR(50) DEFAULT \'signup\'' }
    ];
    
    for (const column of tenantColumns) {
      try {
        await connection.execute(`ALTER TABLE tenants ${column.sql}`);
        console.log(`  ✅ Added column: ${column.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ℹ️ Column ${column.name} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }
    
    // Create indexes for performance
    console.log('📊 Creating indexes for email verification...');
    const indexes = [
      { name: 'idx_users_verification_token', sql: 'CREATE INDEX idx_users_verification_token ON users(verification_token)' },
      { name: 'idx_users_email_verified', sql: 'CREATE INDEX idx_users_email_verified ON users(email_verified)' },
      { name: 'idx_tenants_setup_completed', sql: 'CREATE INDEX idx_tenants_setup_completed ON tenants(setup_completed)' }
    ];
    
    for (const index of indexes) {
      try {
        await connection.execute(index.sql);
        console.log(`  ✅ Created index: ${index.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`  ℹ️ Index ${index.name} already exists, skipping...`);
        } else {
          throw error;
        }
      }
    }
    
    console.log('✅ Public signup fields migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Rollback the migration - Remove added fields
 */
async function down() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🔄 Rolling back public signup fields migration...');
    
    // Remove indexes first
    console.log('🗑️ Removing indexes...');
    await connection.execute(`DROP INDEX IF EXISTS idx_users_verification_token ON users`);
    await connection.execute(`DROP INDEX IF EXISTS idx_users_email_verified ON users`);
    await connection.execute(`DROP INDEX IF EXISTS idx_tenants_setup_completed ON tenants`);
    
    // Remove fields from users table
    console.log('📧 Removing email verification fields from users table...');
    await connection.execute(`
      ALTER TABLE users 
      DROP COLUMN IF EXISTS email_verified,
      DROP COLUMN IF EXISTS verification_token,
      DROP COLUMN IF EXISTS verification_expires,
      DROP COLUMN IF EXISTS phone_number,
      DROP COLUMN IF EXISTS signup_completed
    `);
    
    // Remove fields from tenants table
    console.log('🏢 Removing tenant setup fields from tenants table...');
    await connection.execute(`
      ALTER TABLE tenants 
      DROP COLUMN IF EXISTS setup_completed,
      DROP COLUMN IF EXISTS trial_started_at,
      DROP COLUMN IF EXISTS onboarding_step
    `);
    
    console.log('✅ Public signup fields rollback completed successfully!');
    
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Check if migration has already been applied
 */
async function checkMigrationStatus() {
  const connection = await pool.getConnection();
  
  try {
    // Check if email_verified column exists in users table
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME = 'email_verified'
    `);
    
    return columns.length > 0;
  } catch (error) {
    console.error('❌ Error checking migration status:', error);
    return false;
  } finally {
    connection.release();
  }
}

// Export functions for use in migration runner
module.exports = {
  up,
  down,
  checkMigrationStatus,
  migrationName: '20250122_add_public_signup_fields',
  description: 'Add email verification, phone number, and tenant setup tracking fields for public signup'
};

// Allow running this migration directly
if (require.main === module) {
  (async () => {
    try {
      const alreadyApplied = await checkMigrationStatus();
      
      if (alreadyApplied) {
        console.log('ℹ️ Migration already applied. Use --force to reapply.');
        process.exit(0);
      }
      
      await up();
      console.log('🎉 Migration completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    }
  })();
}
