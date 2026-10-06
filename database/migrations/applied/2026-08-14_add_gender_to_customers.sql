-- Add gender column to customers table
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND COLUMN_NAME='gender');
SET @sql := IF(@col=0,
  'ALTER TABLE customers ADD COLUMN `gender` ENUM(''male'', ''female'', ''other'') DEFAULT NULL AFTER birth_date',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
