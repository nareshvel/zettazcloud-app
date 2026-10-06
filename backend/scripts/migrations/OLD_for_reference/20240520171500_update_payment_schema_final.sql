-- Migration: Update Payment System Schema for MySQL 8.0+
-- Created: 2024-05-20
-- Description: Updates existing payment tables and adds new features

-- Enable strict mode
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

-- Get database name
SET @dbname = DATABASE();

-- Check if tables exist
SET @tenants_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                     WHERE table_schema = @dbname AND table_name = 'tenants');
SET @sales_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                   WHERE table_schema = @dbname AND table_name = 'sales');

-- Only proceed if tenants table exists
SET @proceed = IF(@tenants_exists > 0, 1, 0);

-- Start transaction only if we're proceeding
SET @sql = IF(@proceed = 1, 'START TRANSACTION;', 'SELECT ''Skipping migration: tenants table not found'' AS message;');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create payment_methods table if it doesn't exist
SET @table_name = 'payment_methods';
SET @table_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                   WHERE table_schema = @dbname AND table_name = @table_name);

SET @sql = IF(@table_exists = 0, CONCAT(
    'CREATE TABLE `', @table_name, '` (\n',
    '    `id` CHAR(36) NOT NULL,\n',
    '    `tenant_id` CHAR(36) NOT NULL,\n',
    '    `name` VARCHAR(100) NOT NULL,\n',
    '    `code` VARCHAR(20) GENERATED ALWAYS AS (UPPER(REPLACE(name, '' '', ''_''))) STORED,\n',
    '    `is_active` TINYINT(1) NOT NULL DEFAULT 1,\n',
    '    `requires_terminal` TINYINT(1) NOT NULL DEFAULT 0,\n',
    '    `icon` VARCHAR(50) NULL,\n',
    '    `sort_order` INT NOT NULL DEFAULT 0,\n',
    '    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n',
    '    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n',
    '    PRIMARY KEY (`id`),\n',
    '    UNIQUE INDEX `unique_tenant_payment_code` (`tenant_id`, `code`),\n',
    '    INDEX `idx_tenant` (`tenant_id`)\n',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT=''Available payment methods for each tenant'';'
), 'SELECT ''Table already exists'';');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraint after table creation to avoid issues
SET @dbname = DATABASE();
SET @table_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                   WHERE table_schema = @dbname AND table_name = 'payment_methods');
SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
                         WHERE constraint_schema = @dbname 
                         AND table_name = 'payment_methods' 
                         AND constraint_name = 'fk_payment_methods_tenant');

SET @sql = IF(@table_exists > 0 AND @constraint_exists = 0, 
    'ALTER TABLE payment_methods ADD CONSTRAINT fk_payment_methods_tenant 
     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create payment_terminals table if it doesn't exist
SET @table_name = 'payment_terminals';
SET @table_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                   WHERE table_schema = @dbname AND table_name = @table_name);

SET @sql = IF(@table_exists = 0, CONCAT(
    'CREATE TABLE `', @table_name, '` (\n',
    '    `id` CHAR(36) NOT NULL,\n',
    '    `tenant_id` CHAR(36) NOT NULL,\n',
    '    `name` VARCHAR(100) NOT NULL,\n',
    '    `type` ENUM(''INGENICO'', ''VERIFONE'', ''PAYTM'', ''PHONEPE'', ''CUSTOM'') NOT NULL DEFAULT ''CUSTOM'',\n',
    '    `terminal_id` VARCHAR(100) NULL,\n',
    '    `api_key` VARCHAR(255) NULL,\n',
    '    `api_secret` VARCHAR(512) NULL,\n',
    '    `is_active` TINYINT(1) NOT NULL DEFAULT 1,\n',
    '    `settings` JSON NULL,\n',
    '    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n',
    '    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n',
    '    PRIMARY KEY (`id`),\n',
    '    INDEX `idx_tenant` (`tenant_id`)\n',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT=''Payment terminals and their configurations'';'
), 'SELECT ''Table already exists'';');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraint for payment_terminals
SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
                        WHERE constraint_schema = @dbname 
                        AND table_name = 'payment_terminals' 
                        AND constraint_name = 'fk_payment_terminals_tenant');

SET @sql = IF(@table_exists > 0 AND @constraint_exists = 0, 
    'ALTER TABLE payment_terminals ADD CONSTRAINT fk_payment_terminals_tenant 
     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create payment_transactions table if it doesn't exist
SET @table_name = 'payment_transactions';
SET @table_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                   WHERE table_schema = @dbname AND table_name = @table_name);

SET @sql = IF(@table_exists = 0, CONCAT(
    'CREATE TABLE `', @table_name, '` (\n',
    '    `id` CHAR(36) NOT NULL,\n',
    '    `tenant_id` CHAR(36) NOT NULL,\n',
    '    `sale_id` CHAR(36) NOT NULL,\n',
    '    `payment_method_id` CHAR(36) NOT NULL,\n',
    '    `terminal_id` CHAR(36) NULL,\n',
    '    `amount` DECIMAL(10,2) NOT NULL,\n',
    '    `currency` VARCHAR(3) NOT NULL DEFAULT ''INR'',\n',
    '    `exchange_rate` DECIMAL(10,6) DEFAULT 1.0,\n',
    '    `status` ENUM(''PENDING'', ''COMPLETED'', ''FAILED'', ''REFUNDED'', ''PARTIALLY_REFUNDED'') NOT NULL DEFAULT ''PENDING'',\n',
    '    `transaction_id` VARCHAR(100) NULL,\n',
    '    `reference_id` VARCHAR(100) NULL,\n',
    '    `card_last4` VARCHAR(4) NULL,\n',
    '    `card_type` VARCHAR(20) NULL,\n',
    '    `wallet_name` VARCHAR(50) NULL,\n',
    '    `notes` TEXT NULL,\n',
    '    `metadata` JSON NULL,\n',
    '    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n',
    '    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n',
    '    PRIMARY KEY (`id`),\n',
    '    INDEX `idx_sale` (`sale_id`),\n',
    '    INDEX `idx_payment_method` (`payment_method_id`),\n',
    '    INDEX `idx_terminal` (`terminal_id`),\n',
    '    INDEX `idx_tenant` (`tenant_id`),\n',
    '    INDEX `idx_transaction` (`transaction_id`),\n',
    '    INDEX `idx_reference` (`reference_id`),\n',
    '    INDEX `idx_created` (`created_at`)\n',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT=''Payment transactions for sales'';'
), 'SELECT ''Table already exists'';');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraints for payment_transactions
SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
                        WHERE constraint_schema = @dbname 
                        AND table_name = 'payment_transactions' 
                        AND constraint_name = 'fk_payment_transactions_sale');

SET @sql = IF(@table_exists > 0 AND @constraint_exists = 0, 
    'ALTER TABLE payment_transactions ADD CONSTRAINT fk_payment_transactions_sale 
     FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
                        WHERE constraint_schema = @dbname 
                        AND table_name = 'payment_transactions' 
                        AND constraint_name = 'fk_payment_transactions_method');

SET @sql = IF(@table_exists > 0 AND @constraint_exists = 0, 
    'ALTER TABLE payment_transactions ADD CONSTRAINT fk_payment_transactions_method 
     FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id)',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
                        WHERE constraint_schema = @dbname 
                        AND table_name = 'payment_transactions' 
                        AND constraint_name = 'fk_payment_transactions_terminal');

SET @sql = IF(@table_exists > 0 AND @constraint_exists = 0, 
    'ALTER TABLE payment_transactions ADD CONSTRAINT fk_payment_transactions_terminal 
     FOREIGN KEY (terminal_id) REFERENCES payment_terminals(id) ON DELETE SET NULL',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
                        WHERE constraint_schema = @dbname 
                        AND table_name = 'payment_transactions' 
                        AND constraint_name = 'fk_payment_transactions_tenant');

SET @sql = IF(@table_exists > 0 AND @constraint_exists = 0, 
    'ALTER TABLE payment_transactions ADD CONSTRAINT fk_payment_transactions_tenant 
     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create tenant_payment_settings table if it doesn't exist
SET @table_name = 'tenant_payment_settings';
SET @table_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                   WHERE table_schema = @dbname AND table_name = @table_name);

SET @sql = IF(@table_exists = 0, CONCAT(
    'CREATE TABLE `', @table_name, '` (\n',
    '    `tenant_id` CHAR(36) NOT NULL,\n',
    '    `default_currency` VARCHAR(3) NOT NULL DEFAULT ''INR'',\n',
    '    `allow_partial_payments` TINYINT(1) NOT NULL DEFAULT 1,\n',
    '    `allow_tips` TINYINT(1) NOT NULL DEFAULT 0,\n',
    '    `default_tip_percentage` DECIMAL(5,2) DEFAULT 10.00,\n',
    '    `receipt_settings` JSON COMMENT ''Receipt template and settings'',\n',
    '    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,\n',
    '    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n',
    '    PRIMARY KEY (`tenant_id`)\n',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT=''Tenant-specific payment settings'';'
), 'SELECT ''Table already exists'';');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraint for tenant_payment_settings
SET @constraint_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
                        WHERE constraint_schema = @dbname 
                        AND table_name = 'tenant_payment_settings' 
                        AND constraint_name = 'fk_tenant_payment_settings_tenant');

SET @sql = IF(@table_exists > 0 AND @constraint_exists = 0, 
    'ALTER TABLE tenant_payment_settings ADD CONSTRAINT fk_tenant_payment_settings_tenant 
     FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add payment_status and payment_reference to sales table if they don't exist
SET @dbname = DATABASE();
SET @table_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                   WHERE table_schema = @dbname AND table_name = 'sales');

-- Add payment_status column if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE table_schema = @dbname 
                 AND table_name = 'sales' 
                 AND column_name = 'payment_status');

SET @sql = IF(@table_exists > 0 AND @col_exists = 0, 
    "ALTER TABLE sales ADD COLUMN payment_status ENUM('PENDING', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'CANCELLED') NOT NULL DEFAULT 'PENDING' AFTER status",
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add payment_reference column if it doesn't exist
SET @col_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                 WHERE table_schema = @dbname 
                 AND table_name = 'sales' 
                 AND column_name = 'payment_reference');

SET @sql = IF(@table_exists > 0 AND @col_exists = 0, 
    'ALTER TABLE sales ADD COLUMN payment_reference VARCHAR(100) NULL AFTER payment_method',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index on payment_status if it doesn't exist
SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
                   WHERE table_schema = @dbname 
                   AND table_name = 'sales' 
                   AND index_name = 'idx_sales_payment_status');

SET @sql = IF(@table_exists > 0 AND @index_exists = 0, 
    'ALTER TABLE sales ADD INDEX idx_sales_payment_status (payment_status)',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index on payment_method if it doesn't exist
SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
                   WHERE table_schema = @dbname 
                   AND table_name = 'sales' 
                   AND index_name = 'idx_sales_payment_method');

SET @sql = IF(@table_exists > 0 AND @index_exists = 0, 
    'ALTER TABLE sales ADD INDEX idx_sales_payment_method (payment_method)',
    'SELECT 1');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Initialize payment methods for existing tenants
SET @sql = 'INSERT IGNORE INTO `payment_methods` (`id`, `tenant_id`, `name`, `is_active`, `requires_terminal`, `icon`, `sort_order`)
SELECT 
    UUID(), 
    t.id, 
    ''Cash'', 
    1, 
    0, 
    ''cash'', 
    1
FROM tenants t
LEFT JOIN `payment_methods` pm ON pm.tenant_id = t.id AND pm.name = ''Cash''
WHERE pm.id IS NULL;';

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = 'INSERT IGNORE INTO `payment_methods` (`id`, `tenant_id`, `name`, `is_active`, `requires_terminal`, `icon`, `sort_order`)
SELECT 
    UUID(), 
    t.id, 
    ''Credit/Debit Card'', 
    1, 
    1, 
    ''credit-card'', 
    2
FROM tenants t
LEFT JOIN `payment_methods` pm ON pm.tenant_id = t.id AND pm.name = ''Credit/Debit Card''
WHERE pm.id IS NULL;';

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Initialize tenant payment settings for existing tenants
SET @sql = 'INSERT IGNORE INTO `tenant_payment_settings` (`tenant_id`, `default_currency`, `allow_partial_payments`)
SELECT 
    t.id, 
    ''INR'', 
    1
FROM `tenants` t
LEFT JOIN `tenant_payment_settings` tps ON tps.tenant_id = t.id
WHERE tps.tenant_id IS NULL;';

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

COMMIT;
