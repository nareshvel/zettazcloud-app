-- Fix: attachments.kind did not include 'logo', so the store-logo upload in
-- General Settings (kind='logo') failed with "Data truncated for column
-- 'kind'" under STRICT_TRANS_TABLES. Adds 'logo' to the enum.
-- Idempotent: skips the ALTER if 'logo' is already in the column type.
SET @has_logo := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'attachments'
    AND COLUMN_NAME = 'kind'
    AND COLUMN_TYPE LIKE '%''logo''%'
);
SET @ddl := IF(@has_logo = 0,
  'ALTER TABLE `attachments` MODIFY COLUMN `kind` enum(''photo'',''certificate'',''appraisal'',''document'',''other'',''logo'') NOT NULL DEFAULT ''document''',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
