-- Migration: Update Payment System Schema for MySQL 8.0+
-- Created: 2024-05-20
-- Description: Updates existing payment tables and adds new features

-- Enable strict mode
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

START TRANSACTION;

-- Update payment_methods table
SET @dbname = DATABASE();
SET @tablename = 'payment_methods';
SET @table_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                   WHERE table_schema = @dbname AND table_name = @tablename);

-- Create payment_methods table if it doesn't exist
CREATE TABLE IF NOT EXISTS `payment_methods` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `code` VARCHAR(20) GENERATED ALWAYS AS (UPPER(REPLACE(name, ' ', '_'))) STORED,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `requires_terminal` TINYINT(1) NOT NULL DEFAULT 0,
    `icon` VARCHAR(50) NULL,
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `unique_tenant_payment_code` (`tenant_id`, `code`),
    INDEX `idx_tenant` (`tenant_id`),
    CONSTRAINT `fk_payment_methods_tenant` 
        FOREIGN KEY (`tenant_id`) 
        REFERENCES `tenants` (`id`) 
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Available payment methods for each tenant';

-- Add columns if they don't exist (for existing tables)
SET @alter_sql = NULL;
SELECT 
  GROUP_CONCAT(
    DISTINCT
    CONCAT('ADD COLUMN IF NOT EXISTS ', 
      column_name, ' ', column_definition,
      IF(is_nullable = 'NO', ' NOT NULL', ''),
      IF(column_default IS NOT NULL, 
         CONCAT(' DEFAULT ', 
           IF(column_default = 'CURRENT_TIMESTAMP', 
              'CURRENT_TIMESTAMP', 
              CONCAT('\'', column_default, '\'')
           )
         ), 
         ''
      ),
      IF(extra != '', CONCAT(' ', extra), '')
    ) SEPARATOR ',\n  '
  ) INTO @alter_sql
FROM (
  SELECT 
    'code' as column_name, 'VARCHAR(20)' as column_definition, 'NO' as is_nullable, NULL as column_default, 'GENERATED ALWAYS AS (UPPER(REPLACE(name, '' '', ''_''))) STORED' as extra
  UNION SELECT 'is_active', 'TINYINT(1)', 'NO', '1', ''
  UNION SELECT 'requires_terminal', 'TINYINT(1)', 'NO', '0', ''
  UNION SELECT 'icon', 'VARCHAR(50)', 'YES', NULL, ''
  UNION SELECT 'sort_order', 'INT', 'NO', '0', ''
  UNION SELECT 'created_at', 'TIMESTAMP', 'NO', 'CURRENT_TIMESTAMP', 'DEFAULT_GENERATED'
  UNION SELECT 'updated_at', 'TIMESTAMP', 'NO', 'CURRENT_TIMESTAMP', 'on update CURRENT_TIMESTAMP'
) as cols
WHERE @table_exists > 0;

-- Execute the ALTER TABLE if there are columns to add
IF @alter_sql IS NOT NULL THEN
  SET @sql = CONCAT('ALTER TABLE ', @tablename, ' ', @alter_sql);
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
  
  -- Add indexes if they don't exist
  SET @indexes = 'unique_tenant_payment_code,idx_tenant';
  
  -- Check and add each index
  SET @index_list = CONCAT(
    'SELECT GROUP_CONCAT(DISTINCT index_name) INTO @existing_indexes ',
    'FROM information_schema.statistics ',
    'WHERE table_schema = \'', @dbname, '\' ',
    'AND table_name = \'', @tablename, '\' ',
    'AND index_name IN (\'', REPLACE(@indexes, ',', '\',\''), '\')'
  );
  
  PREPARE stmt FROM @index_list;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
  
  -- Add missing indexes
  SET @missing_indexes = CONCAT_WS(',',
    IF(@existing_indexes NOT LIKE '%unique_tenant_payment_code%', 
       'ADD UNIQUE INDEX unique_tenant_payment_code (tenant_id, code)', NULL),
    IF(@existing_indexes NOT LIKE '%idx_tenant%', 
       'ADD INDEX idx_tenant (tenant_id)', NULL)
  );
  
  IF @missing_indexes != '' THEN
    SET @sql = CONCAT('ALTER TABLE ', @tablename, ' ', @missing_indexes);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END IF;

-- Create payment_terminals table if it doesn't exist
CREATE TABLE IF NOT EXISTS `payment_terminals` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('INGENICO', 'VERIFONE', 'PAYTM', 'PHONEPE', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM',
    `terminal_id` VARCHAR(100) NULL,
    `api_key` VARCHAR(255) NULL,
    `api_secret` VARCHAR(512) NULL,
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `settings` JSON NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_tenant` (`tenant_id`),
    CONSTRAINT `fk_payment_terminals_tenant` 
        FOREIGN KEY (`tenant_id`) 
        REFERENCES `tenants` (`id`) 
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment terminals and their configurations';

-- Create payment_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS `payment_transactions` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `sale_id` VARCHAR(36) NOT NULL,
    `payment_method_id` VARCHAR(36) NOT NULL,
    `terminal_id` VARCHAR(36) NULL,
    `amount` DECIMAL(10,2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `exchange_rate` DECIMAL(10,6) DEFAULT 1.0,
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL DEFAULT 'PENDING',
    `transaction_id` VARCHAR(100) NULL,
    `reference_id` VARCHAR(100) NULL,
    `card_last4` VARCHAR(4) NULL,
    `card_type` VARCHAR(20) NULL,
    `wallet_name` VARCHAR(50) NULL,
    `notes` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    INDEX `idx_sale` (`sale_id`),
    INDEX `idx_payment_method` (`payment_method_id`),
    INDEX `idx_terminal` (`terminal_id`),
    INDEX `idx_tenant` (`tenant_id`),
    INDEX `idx_transaction` (`transaction_id`),
    INDEX `idx_reference` (`reference_id`),
    INDEX `idx_created` (`created_at`),
    CONSTRAINT `fk_payment_transactions_sale` 
        FOREIGN KEY (`sale_id`) 
        REFERENCES `sales` (`id`) 
        ON DELETE CASCADE,
    CONSTRAINT `fk_payment_transactions_method` 
        FOREIGN KEY (`payment_method_id`) 
        REFERENCES `payment_methods` (`id`),
    CONSTRAINT `fk_payment_transactions_terminal` 
        FOREIGN KEY (`terminal_id`) 
        REFERENCES `payment_terminals` (`id`) 
        ON DELETE SET NULL,
    CONSTRAINT `fk_payment_transactions_tenant` 
        FOREIGN KEY (`tenant_id`) 
        REFERENCES `tenants` (`id`) 
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment transactions for sales';

-- Create tenant_payment_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS `tenant_payment_settings` (
    `tenant_id` VARCHAR(36) NOT NULL,
    `default_currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `allow_partial_payments` TINYINT(1) NOT NULL DEFAULT 1,
    `allow_tips` TINYINT(1) NOT NULL DEFAULT 0,
    `default_tip_percentage` DECIMAL(5,2) DEFAULT 10.00,
    `receipt_settings` JSON COMMENT 'Receipt template and settings',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`tenant_id`),
    CONSTRAINT `fk_tenant_payment_settings_tenant` 
        FOREIGN KEY (`tenant_id`) 
        REFERENCES `tenants` (`id`) 
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tenant-specific payment settings';

-- Update sales table to support new payment system
SET @alter_sales = (
  SELECT GROUP_CONCAT(
    CONCAT('MODIFY COLUMN `', column_name, '` ', column_type, 
           IF(is_nullable = 'NO', ' NOT NULL', ''),
           IF(column_default IS NOT NULL, 
              CONCAT(' DEFAULT ', 
                     IF(column_default = 'CURRENT_TIMESTAMP', 
                        'CURRENT_TIMESTAMP', 
                        CONCAT('\'', column_default, '\'')
                     )
              ),
              ''
           ),
           IF(extra != '', CONCAT(' ', extra), '')
    )
  )
  FROM (
    SELECT 'payment_method' as column_name, 'ENUM(\'cash\',\'card\',\'upi\',\'wallet\',\'online\')' as column_type, 'YES' as is_nullable, NULL as column_default, '' as extra
    UNION SELECT 'payment_status', 'ENUM(\'PENDING\', \'PARTIALLY_PAID\', \'PAID\', \'REFUNDED\', \'CANCELLED\')', 'NO', 'PENDING', ''
    UNION SELECT 'payment_reference', 'VARCHAR(100)', 'YES', NULL, ''
  ) as cols
  WHERE EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
    WHERE table_schema = @dbname AND table_name = 'sales'
  )
);

-- Add new columns to sales table if they don't exist
SET @add_to_sales = (
  SELECT GROUP_CONCAT(
    CONCAT('ADD COLUMN IF NOT EXISTS `', column_name, '` ', column_type, 
           IF(is_nullable = 'NO', ' NOT NULL', ''),
           IF(column_default IS NOT NULL, 
              CONCAT(' DEFAULT ', 
                     IF(column_default = 'CURRENT_TIMESTAMP', 
                        'CURRENT_TIMESTAMP', 
                        CONCAT('\'', column_default, '\'')
                     )
              ),
              ''
           ),
           IF(extra != '', CONCAT(' ', extra), '')
    )
  )
  FROM (
    SELECT 'payment_status' as column_name, 'ENUM(\'PENDING\', \'PARTIALLY_PAID\', \'PAID\', \'REFUNDED\', \'CANCELLED\')' as column_type, 'NO' as is_nullable, 'PENDING' as column_default, '' as extra
    UNION SELECT 'payment_reference', 'VARCHAR(100)', 'YES', NULL, ''
  ) as cols
  WHERE NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE table_schema = @dbname 
    AND table_name = 'sales' 
    AND column_name = cols.column_name
  )
  AND EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
    WHERE table_schema = @dbname AND table_name = 'sales'
  )
);

-- Execute sales table modifications if needed
IF @alter_sales IS NOT NULL OR @add_to_sales IS NOT NULL THEN
  SET @sql = CONCAT('ALTER TABLE sales');
  
  IF @alter_sales IS NOT NULL THEN
    SET @sql = CONCAT(@sql, ' ', @alter_sales);
    IF @add_to_sales IS NOT NULL THEN
      SET @sql = CONCAT(@sql, ', ', @add_to_sales);
    END IF;
  ELSE
    SET @sql = CONCAT(@sql, ' ', @add_to_sales);
  END IF;
  
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
  
  -- Add indexes to sales table if they don't exist
  SET @indexes = 'idx_sales_payment_status,idx_sales_payment_method';
  
  -- Check existing indexes
  SET @index_list = CONCAT(
    'SELECT GROUP_CONCAT(DISTINCT index_name) INTO @existing_sales_indexes ',
    'FROM information_schema.statistics ',
    'WHERE table_schema = \'', @dbname, '\' ',
    'AND table_name = \'sales\' ',
    'AND index_name IN (\'', REPLACE(@indexes, ',', '\',\''), '\')'
  );
  
  PREPARE stmt FROM @index_list;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
  
  -- Add missing indexes
  SET @missing_indexes = CONCAT_WS(',',
    IF(@existing_sales_indexes NOT LIKE '%idx_sales_payment_status%', 
       'ADD INDEX idx_sales_payment_status (payment_status)', NULL),
    IF(@existing_sales_indexes NOT LIKE '%idx_sales_payment_method%', 
       'ADD INDEX idx_sales_payment_method (payment_method)', NULL)
  );
  
  IF @missing_indexes != '' THEN
    SET @sql = CONCAT('ALTER TABLE sales ', @missing_indexes);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END IF;

-- Initialize payment methods for existing tenants
INSERT IGNORE INTO `payment_methods` (`id`, `tenant_id`, `name`, `is_active`, `requires_terminal`, `icon`, `sort_order`)
SELECT 
    UUID(), 
    t.id, 
    'Cash', 
    1, 
    0, 
    'cash', 
    1
FROM tenants t
LEFT JOIN `payment_methods` pm ON pm.tenant_id = t.id AND pm.name = 'Cash'
WHERE pm.id IS NULL;

INSERT IGNORE INTO `payment_methods` (`id`, `tenant_id`, `name`, `is_active`, `requires_terminal`, `icon`, `sort_order`)
SELECT 
    UUID(), 
    t.id, 
    'Credit/Debit Card', 
    1, 
    1, 
    'credit-card', 
    2
FROM tenants t
LEFT JOIN `payment_methods` pm ON pm.tenant_id = t.id AND pm.name = 'Credit/Debit Card'
WHERE pm.id IS NULL;

-- Initialize tenant payment settings for existing tenants
INSERT IGNORE INTO `tenant_payment_settings` (`tenant_id`, `default_currency`, `allow_partial_payments`)
SELECT 
    t.id, 
    'INR', 
    1
FROM `tenants` t
LEFT JOIN `tenant_payment_settings` tps ON tps.tenant_id = t.id
WHERE tps.tenant_id IS NULL;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

COMMIT;
