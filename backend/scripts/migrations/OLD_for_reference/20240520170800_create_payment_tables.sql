-- Migration: Create Payment System Tables
-- Created: 2024-05-20
-- Description: Initial setup for payment system tables

-- Enable strict mode
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

START TRANSACTION;

-- Create payment_methods table
CREATE TABLE IF NOT EXISTS `payment_methods` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(50) NOT NULL COMMENT 'Display name (e.g., Cash, Credit Card, UPI)',
    `code` VARCHAR(20) NOT NULL COMMENT 'Unique code (e.g., CASH, CARD, UPI)',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `requires_terminal` TINYINT(1) NOT NULL DEFAULT 0,
    `icon` VARCHAR(50) COMMENT 'Icon identifier for UI',
    `sort_order` INT NOT NULL DEFAULT 0,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `unique_tenant_payment_code` (`tenant_id`, `code`),
    KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Available payment methods for each tenant';

-- Create payment_terminals table
CREATE TABLE IF NOT EXISTS `payment_terminals` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL COMMENT 'Display name for the terminal',
    `type` ENUM('INGENICO', 'VERIFONE', 'PAYTM', 'PHONEPE', 'CUSTOM') NOT NULL,
    `terminal_id` VARCHAR(100) COMMENT 'Terminal ID from provider',
    `api_key` VARCHAR(255) COMMENT 'API key for terminal authentication',
    `api_secret` TEXT COMMENT 'Encrypted API secret',
    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
    `settings` JSON COMMENT 'Terminal-specific settings',
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_tenant` (`tenant_id`),
    KEY `idx_terminal_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment terminal configurations';

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS `payment_transactions` (
    `id` VARCHAR(36) NOT NULL,
    `tenant_id` VARCHAR(36) NOT NULL,
    `sale_id` VARCHAR(36) NOT NULL,
    `payment_method_id` VARCHAR(36) NOT NULL,
    `terminal_id` VARCHAR(36) DEFAULT NULL,
    
    -- Amount details
    `amount` DECIMAL(10,2) NOT NULL COMMENT 'Amount in the transaction currency',
    `currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `exchange_rate` DECIMAL(10,6) DEFAULT 1.0,
    
    -- Transaction details
    `transaction_id` VARCHAR(100) COMMENT 'Gateway transaction ID',
    `reference_id` VARCHAR(100) COMMENT 'Merchant reference ID',
    `status` ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL DEFAULT 'PENDING',
    
    -- Card/Wallet specific
    `card_last4` VARCHAR(4) COMMENT 'Last 4 digits of card',
    `card_type` VARCHAR(20) COMMENT 'Visa, MasterCard, etc.',
    `wallet_name` VARCHAR(50) COMMENT 'Name of wallet for wallet payments',
    
    -- Metadata
    `metadata` JSON COMMENT 'Additional payment details',
    `notes` TEXT COMMENT 'Additional notes',
    
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (`id`),
    KEY `idx_sale` (`sale_id`),
    KEY `idx_payment_method` (`payment_method_id`),
    KEY `idx_terminal` (`terminal_id`),
    KEY `idx_tenant` (`tenant_id`),
    KEY `idx_transaction` (`transaction_id`),
    KEY `idx_reference` (`reference_id`),
    KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment transactions';

-- Create tenant_payment_settings table
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
    CONSTRAINT `fk_tenant_payment_settings_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tenant-specific payment settings';

-- Add foreign key constraints after all tables are created
ALTER TABLE `payment_methods`
ADD CONSTRAINT `fk_payment_methods_tenant` 
FOREIGN KEY (`tenant_id`) 
REFERENCES `tenants` (`id`) 
ON DELETE CASCADE;

ALTER TABLE `payment_terminals`
ADD CONSTRAINT `fk_payment_terminals_tenant` 
FOREIGN KEY (`tenant_id`) 
REFERENCES `tenants` (`id`) 
ON DELETE CASCADE;

ALTER TABLE `payment_transactions`
ADD CONSTRAINT `fk_payment_transactions_sale` 
FOREIGN KEY (`sale_id`) 
REFERENCES `sales` (`id`) 
ON DELETE CASCADE,
ADD CONSTRAINT `fk_payment_transactions_method` 
FOREIGN KEY (`payment_method_id`) 
REFERENCES `payment_methods` (`id`),
ADD CONSTRAINT `fk_payment_transactions_terminal` 
FOREIGN KEY (`terminal_id`) 
REFERENCES `payment_terminals` (`id`),
ADD CONSTRAINT `fk_payment_transactions_tenant` 
FOREIGN KEY (`tenant_id`) 
REFERENCES `tenants` (`id`) 
ON DELETE CASCADE;

-- Insert default payment methods for existing tenants
INSERT INTO `payment_methods` (`id`, `tenant_id`, `name`, `code`, `is_active`, `requires_terminal`, `icon`, `sort_order`)
SELECT 
    UUID(), 
    t.id, 
    'Cash', 
    'CASH', 
    1, 
    0, 
    'cash', 
    1
FROM `tenants` t
WHERE NOT EXISTS (
    SELECT 1 FROM `payment_methods` pm 
    WHERE pm.tenant_id = t.id AND pm.code = 'CASH'
);

INSERT INTO `payment_methods` (`id`, `tenant_id`, `name`, `code`, `is_active`, `requires_terminal`, `icon`, `sort_order`)
SELECT 
    UUID(), 
    t.id, 
    'Credit/Debit Card', 
    'CARD', 
    1, 
    1, 
    'credit-card', 
    2
FROM `tenants` t
WHERE NOT EXISTS (
    SELECT 1 FROM `payment_methods` pm 
    WHERE pm.tenant_id = t.id AND pm.code = 'CARD'
);

-- Initialize tenant payment settings for existing tenants
INSERT INTO `tenant_payment_settings` (`tenant_id`, `default_currency`, `allow_partial_payments`)
SELECT 
    t.id, 
    'INR', 
    1
FROM `tenants` t
WHERE NOT EXISTS (
    SELECT 1 FROM `tenant_payment_settings` tps 
    WHERE tps.tenant_id = t.id
);

-- Update existing sales table to support new payment system
-- Add payment_status column if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'sales';
SET @columnname = 'payment_status';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE (table_name = @tablename)
        AND (table_schema = @dbname)
        AND (column_name = @columnname)
    ) = 0,
    'ALTER TABLE sales ADD COLUMN payment_status ENUM("PENDING", "PARTIALLY_PAID", "PAID", "REFUNDED", "CANCELLED") DEFAULT "PENDING" AFTER status;',
    'SELECT 1;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add payment_method column if it doesn't exist
SET @columnname = 'payment_method';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE (table_name = @tablename)
        AND (table_schema = @dbname)
        AND (column_name = @columnname)
    ) = 0,
    'ALTER TABLE sales ADD COLUMN payment_method VARCHAR(20) NULL AFTER payment_status;',
    'SELECT 1;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add payment_reference column if it doesn't exist
SET @columnname = 'payment_reference';
SET @preparedStatement = (SELECT IF(
    (
        SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
        WHERE (table_name = @tablename)
        AND (table_schema = @dbname)
        AND (column_name = @columnname)
    ) = 0,
    'ALTER TABLE sales ADD COLUMN payment_reference VARCHAR(100) NULL AFTER payment_method;',
    'SELECT 1;'
));

PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS `idx_sales_payment_status` ON `sales` (`payment_status`);
CREATE INDEX IF NOT EXISTS `idx_sales_payment_method` ON `sales` (`payment_method`);

COMMIT;

-- Add a comment to the migration
-- This migration creates the necessary tables for the enhanced payment system
-- and sets up default payment methods for existing tenants.
