-- Migration: Make sales_returns.return_number unique per tenant
-- Safe to run multiple times: checks existing indexes before altering

-- 1) Drop global unique index on return_number if it exists
SET @idx_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'sales_returns'
    AND index_name = 'return_number'
);

SET @sql := IF(@idx_exists > 0,
  'ALTER TABLE `sales_returns` DROP INDEX `return_number`',
  'SELECT 1');

PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Create composite unique index (tenant_id, return_number) if missing
SET @idx2_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE table_schema = DATABASE()
    AND table_name = 'sales_returns'
    AND index_name = 'uniq_tenant_return'
);

SET @sql2 := IF(@idx2_exists = 0,
  'ALTER TABLE `sales_returns` ADD UNIQUE KEY `uniq_tenant_return` (`tenant_id`, `return_number`)',
  'SELECT 1');

PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- Done
