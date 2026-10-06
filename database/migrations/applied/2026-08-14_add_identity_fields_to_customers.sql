-- Add nationality / ID fields to customers table
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND COLUMN_NAME='nationality');
SET @sql := IF(@col=0,
  'ALTER TABLE customers ADD COLUMN nationality VARCHAR(100) DEFAULT NULL AFTER gender, ADD COLUMN id_type ENUM(''passport'',''national_id'',''drivers_license'',''residence_permit'',''other'') DEFAULT NULL AFTER nationality, ADD COLUMN id_number VARCHAR(100) DEFAULT NULL AFTER id_type',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
