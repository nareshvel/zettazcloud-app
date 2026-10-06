-- Fix GRN Status Default Value
-- Issue: Database defaults GRN status to 'COMPLETED' instead of 'DRAFT'
-- Impact: Breaks entire workflow - new GRNs bypass draft stage

-- Check current default
SELECT COLUMN_DEFAULT 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'goods_received_notes' 
  AND COLUMN_NAME = 'status';

-- Fix the default value to DRAFT
ALTER TABLE goods_received_notes 
MODIFY COLUMN status ENUM('DRAFT', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT';

-- Verify the fix
SELECT COLUMN_DEFAULT 
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
  AND TABLE_NAME = 'goods_received_notes' 
  AND COLUMN_NAME = 'status';
