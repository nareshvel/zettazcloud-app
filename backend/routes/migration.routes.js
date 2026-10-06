const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

/**
 * Migration API Endpoint: Fix GRN Status Default Value
 * 
 * POST /api/migration/fix-grn-status-default
 * 
 * This endpoint fixes the critical issue where GRN status defaults to 'COMPLETED'
 * instead of 'DRAFT', which breaks the entire workflow.
 */
router.post('/fix-grn-status-default', async (req, res) => {
    let connection;
    
    try {
        console.log('🔧 Starting GRN Status Default Fix Migration via API...');
        
        connection = await pool.getConnection();
        
        // Step 1: Check current column definition
        console.log('📋 Step 1: Checking current status column definition...');
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
        
        const currentStatus = {
            type: currentDef[0].COLUMN_TYPE,
            default: currentDef[0].COLUMN_DEFAULT,
            nullable: currentDef[0].IS_NULLABLE
        };
        
        console.log('Current status column definition:', currentStatus);
        
        // Step 2: Check if fix is needed
        if (currentDef[0].COLUMN_DEFAULT === 'DRAFT') {
            const result = {
                success: true,
                message: 'Status column already has correct default value (DRAFT)',
                action: 'No migration needed',
                current: currentStatus
            };
            console.log('✅', result.message);
            return res.json(result);
        }
        
        // Step 3: Count existing GRNs by status
        console.log('📊 Step 2: Analyzing existing GRN data...');
        const [statusCounts] = await connection.query(`
            SELECT status, COUNT(*) as count
            FROM goods_received_notes 
            GROUP BY status
            ORDER BY status
        `);
        
        const statusDistribution = {};
        statusCounts.forEach(row => {
            statusDistribution[row.status] = row.count;
        });
        
        console.log('Current GRN status distribution:', statusDistribution);
        
        // Step 4: Apply the fix
        console.log('🔧 Step 3: Applying status column fix...');
        await connection.query(`
            ALTER TABLE goods_received_notes 
            MODIFY COLUMN status ENUM('DRAFT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT'
            COMMENT 'GRN Status: DRAFT (editable), COMPLETED (committed to inventory), CANCELLED (reversed)'
        `);
        
        console.log('✅ Status column updated successfully');
        
        // Step 5: Verify the change
        console.log('🔍 Step 4: Verifying the fix...');
        const [newDef] = await connection.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'goods_received_notes' 
              AND COLUMN_NAME = 'status'
        `);
        
        const newStatus = {
            type: newDef[0].COLUMN_TYPE,
            default: newDef[0].COLUMN_DEFAULT,
            nullable: newDef[0].IS_NULLABLE
        };
        
        console.log('Updated status column definition:', newStatus);
        
        if (newDef[0].COLUMN_DEFAULT === 'DRAFT') {
            const result = {
                success: true,
                message: 'GRN status default value fixed successfully!',
                action: 'Schema updated',
                before: currentStatus,
                after: newStatus,
                existingData: statusDistribution,
                impact: 'New GRNs will now default to DRAFT status as expected'
            };
            
            console.log('🎉 SUCCESS:', result.message);
            return res.json(result);
        } else {
            throw new Error('Migration failed - default value not updated correctly');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        
        const result = {
            success: false,
            message: 'Migration failed',
            error: error.message,
            action: 'Schema update failed'
        };
        
        return res.status(500).json(result);
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

/**
 * GET /api/migration/check-grn-status
 * 
 * Check current GRN status column configuration
 */
router.get('/check-grn-status', async (req, res) => {
    let connection;
    
    try {
        connection = await pool.getConnection();
        
        // Check column definition
        const [columnDef] = await connection.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'goods_received_notes' 
              AND COLUMN_NAME = 'status'
        `);
        
        // Count GRNs by status
        const [statusCounts] = await connection.query(`
            SELECT status, COUNT(*) as count
            FROM goods_received_notes 
            GROUP BY status
            ORDER BY status
        `);
        
        const statusDistribution = {};
        statusCounts.forEach(row => {
            statusDistribution[row.status] = row.count;
        });
        
        const result = {
            success: true,
            column: columnDef[0] || null,
            statusDistribution,
            needsFix: columnDef[0]?.COLUMN_DEFAULT !== 'DRAFT'
        };
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ Check failed:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to check GRN status configuration',
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;
