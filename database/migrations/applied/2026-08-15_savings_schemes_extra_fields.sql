-- Migration: Add notes and employee_id to savings_scheme_enrollments
-- Date: 2026-08-15
-- Idempotent via SELECT/IF NOT EXISTS workaround (compatible with MySQL 5.7+).

SET @db = DATABASE();

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'savings_scheme_enrollments' AND COLUMN_NAME = 'employee_id') = 0,
  'ALTER TABLE savings_scheme_enrollments ADD COLUMN employee_id char(36) DEFAULT NULL AFTER customer_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'savings_scheme_enrollments' AND COLUMN_NAME = 'notes') = 0,
  'ALTER TABLE savings_scheme_enrollments ADD COLUMN notes text DEFAULT NULL AFTER bonus_amount',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
