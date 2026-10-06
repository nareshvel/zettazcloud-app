#!/usr/bin/env node

/**
 * Migration Script: Fix GRN Status Default Value
 * 
 * Issue: Database defaults GRN status to 'COMPLETED' instead of 'DRAFT'
 * Impact: Breaks entire workflow - new GRNs bypass draft stage
 * Priority: CRITICAL
 * 
 * This script safely updates the goods_received_notes table to use
 * proper ENUM with 'DRAFT' as default value.
 */

const { pool } = require('../config/db');

async function fixGrnStatusDefault() {
    let connection;
    
    try {
        console.log('🔧 Starting GRN Status Default Fix Migration...');
        
        connection = await pool.getConnection();
        
        // Step 1: Check current column definition
        console.log('\n📋 Step 1: Checking current status column definition...');
        const [currentDef] = await connection.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'goods_received_notes' 
              AND COLUMN_NAME = 'status'
        `);
        
        if (currentDef.length === 0) {
            throw new Error('Status column not found in goods_received_notes table');
        }
        
        console.log('Current status column definition:');
        console.log('- Type:', currentDef[0].COLUMN_TYPE);
        console.log('- Default:', currentDef[0].COLUMN_DEFAULT);
        console.log('- Nullable:', currentDef[0].IS_NULLABLE);
        
        // Step 2: Check if fix is needed
        if (currentDef[0].COLUMN_DEFAULT === 'DRAFT') {
            console.log('\n✅ Status column already has correct default value (DRAFT)');
            console.log('No migration needed.');
            return;
        }
        
        // Step 3: Count existing GRNs by status
        console.log('\n📊 Step 2: Analyzing existing GRN data...');
        const [statusCounts] = await connection.query(`
            SELECT status, COUNT(*) as count
            FROM goods_received_notes 
            GROUP BY status
            ORDER BY status
        `);
        
        console.log('Current GRN status distribution:');
        statusCounts.forEach(row => {
            console.log(`- ${row.status}: ${row.count} GRNs`);
        });
        
        // Step 4: Apply the fix
        console.log('\n🔧 Step 3: Applying status column fix...');
        await connection.query(`
            ALTER TABLE goods_received_notes 
            MODIFY COLUMN status ENUM('DRAFT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT'
            COMMENT 'GRN Status: DRAFT (editable), COMPLETED (committed to inventory), CANCELLED (reversed)'
        `);
        
        console.log('✅ Status column updated successfully');
        
        // Step 5: Verify the change
        console.log('\n🔍 Step 4: Verifying the fix...');
        const [newDef] = await connection.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'goods_received_notes' 
              AND COLUMN_NAME = 'status'
        `);
        
        console.log('Updated status column definition:');
        console.log('- Type:', newDef[0].COLUMN_TYPE);
        console.log('- Default:', newDef[0].COLUMN_DEFAULT);
        console.log('- Nullable:', newDef[0].IS_NULLABLE);
        
        if (newDef[0].COLUMN_DEFAULT === 'DRAFT') {
            console.log('\n🎉 SUCCESS: GRN status default value fixed!');
            console.log('New GRNs will now default to DRAFT status as expected.');
        } else {
            throw new Error('Migration failed - default value not updated correctly');
        }
        
    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    } finally {
        if (connection) {
            connection.release();
        }
        await pool.end();
    }
}

// Execute migration
if (require.main === module) {
    fixGrnStatusDefault()
        .then(() => {
            console.log('\n✅ Migration completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { fixGrnStatusDefault };
