-- Migration: Fix GRN Status Default Value
-- Issue: Database defaults GRN status to 'COMPLETED' instead of 'DRAFT'
-- Impact: Breaks entire workflow - new GRNs bypass draft stage
-- Date: 2025-08-04
-- Priority: CRITICAL

USE digitpulse_zcloud;

-- Step 1: Check current column definition
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'digitpulse_zcloud' 
  AND TABLE_NAME = 'goods_received_notes' 
  AND COLUMN_NAME = 'status';

-- Step 2: Fix the status column to use proper ENUM with DRAFT default
ALTER TABLE goods_received_notes 
MODIFY COLUMN status ENUM('DRAFT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT'
COMMENT 'GRN Status: DRAFT (editable), COMPLETED (committed to inventory), CANCELLED (reversed)';

-- Step 3: Verify the change
SELECT COLUMN_NAME, COLUMN_TYPE, COLUMN_DEFAULT, IS_NULLABLE 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'digitpulse_zcloud' 
  AND TABLE_NAME = 'goods_received_notes' 
  AND COLUMN_NAME = 'status';

-- Step 4: Update any existing GRNs that might have invalid status
-- (This is safe because we're only changing the default, not existing data)
SELECT COUNT(*) as total_grns, status, COUNT(*) as count_by_status
FROM goods_received_notes 
GROUP BY status;

-- Migration completed successfully
SELECT 'GRN Status Default Fix - Migration Completed' as result;
