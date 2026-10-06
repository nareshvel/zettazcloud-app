-- Migration: Update Payment System Schema
-- Created: 2024-05-20
-- Description: Updates existing payment tables and adds new features

-- Enable strict mode
SET SQL_MODE = 'STRICT_TRANS_TABLES,NO_ENGINE_SUBSTITUTION';

-- Disable foreign key checks temporarily
SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;

START TRANSACTION;

-- Change delimiter to handle stored procedure
DELIMITER //

-- Create a procedure to modify the payment_methods table
CREATE PROCEDURE update_payment_methods_table()
BEGIN
    DECLARE dbname VARCHAR(64);
    DECLARE tablename VARCHAR(64);
    DECLARE table_exists INT;
    DECLARE sql_text TEXT;
    DECLARE index_exists INT;
    
    SET dbname = DATABASE();
    SET tablename = 'payment_methods';
    
    -- Check if the table exists
    SELECT COUNT(*) INTO table_exists
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE table_schema = dbname AND table_name = tablename;
    
    -- If table exists, check and add columns
    IF table_exists > 0 THEN
        -- Add code column if it doesn't exist
        SET @col_exists = 0;
        SELECT COUNT(*) INTO @col_exists
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_schema = dbname 
        AND table_name = tablename 
        AND column_name = 'code';
        
        IF @col_exists = 0 THEN
            SET @sql = CONCAT('ALTER TABLE ', tablename, ' ADD COLUMN code VARCHAR(20) AFTER name');
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
        
        -- Add is_active column if it doesn't exist
        SET @col_exists = 0;
        SELECT COUNT(*) INTO @col_exists
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_schema = dbname 
        AND table_name = tablename 
        AND column_name = 'is_active';
        
        IF @col_exists = 0 THEN
            SET @sql = CONCAT('ALTER TABLE ', tablename, ' ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER code');
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
        
        -- Add requires_terminal column if it doesn't exist
        SET @col_exists = 0;
        SELECT COUNT(*) INTO @col_exists
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_schema = dbname 
        AND table_name = tablename 
        AND column_name = 'requires_terminal';
        
        IF @col_exists = 0 THEN
            SET @sql = CONCAT('ALTER TABLE ', tablename, ' ADD COLUMN requires_terminal TINYINT(1) DEFAULT 0 AFTER is_active');
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
        
        -- Add icon column if it doesn't exist
        SET @col_exists = 0;
        SELECT COUNT(*) INTO @col_exists
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_schema = dbname 
        AND table_name = tablename 
        AND column_name = 'icon';
        
        IF @col_exists = 0 THEN
            SET @sql = CONCAT('ALTER TABLE ', tablename, ' ADD COLUMN icon VARCHAR(50) AFTER requires_terminal');
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
        
        -- Add sort_order column if it doesn't exist
        SET @col_exists = 0;
        SELECT COUNT(*) INTO @col_exists
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_schema = dbname 
        AND table_name = tablename 
        AND column_name = 'sort_order';
        
        IF @col_exists = 0 THEN
            SET @sql = CONCAT('ALTER TABLE ', tablename, ' ADD COLUMN sort_order INT DEFAULT 0 AFTER icon');
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
        
        -- Add created_at column if it doesn't exist
        SET @col_exists = 0;
        SELECT COUNT(*) INTO @col_exists
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_schema = dbname 
        AND table_name = tablename 
        AND column_name = 'created_at';
        
        IF @col_exists = 0 THEN
            SET @sql = CONCAT('ALTER TABLE ', tablename, ' ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER sort_order');
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
        
        -- Add updated_at column if it doesn't exist
        SET @col_exists = 0;
        SELECT COUNT(*) INTO @col_exists
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE table_schema = dbname 
        AND table_name = tablename 
        AND column_name = 'updated_at';
        
        IF @col_exists = 0 THEN
            SET @sql = CONCAT('ALTER TABLE ', tablename, ' ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at');
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
        
        -- Add unique index if it doesn't exist
        SET @index_exists = 0;
        SELECT COUNT(*) INTO @index_exists
        FROM information_schema.statistics 
        WHERE table_schema = dbname 
        AND table_name = tablename 
        AND index_name = 'unique_tenant_payment_code';
        
        IF @index_exists = 0 THEN
            -- First, make sure the code column has values
            SET @sql = CONCAT('UPDATE ', tablename, ' SET code = UPPER(REPLACE(name, '' '', ''_'')) WHERE code IS NULL');
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
            
            -- Then add the unique index
            SET @sql = CONCAT('ALTER TABLE ', tablename, ' ADD UNIQUE INDEX unique_tenant_payment_code (tenant_id, code)');
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
    END IF;
END //

-- Reset delimiter
DELIMITER ;

-- Execute the procedure
CALL update_payment_methods_table();

-- Drop the procedure
DROP PROCEDURE IF EXISTS update_payment_methods_table;

-- Update payment_methods with default values if needed
UPDATE payment_methods SET 
    code = UPPER(REPLACE(name, ' ', '_')),
    is_active = IF(is_active IS NULL, 1, is_active),
    requires_terminal = IF(requires_terminal IS NULL, 0, requires_terminal)
WHERE code IS NULL;

-- Ensure we have default payment methods for each tenant
INSERT IGNORE INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order)
SELECT 
    UUID(), 
    t.id, 
    'Cash', 
    'CASH', 
    1, 
    0, 
    'cash', 
    1
FROM tenants t
LEFT JOIN payment_methods pm ON pm.tenant_id = t.id AND pm.code = 'CASH'
WHERE pm.id IS NULL;

INSERT IGNORE INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order)
SELECT 
    UUID(), 
    t.id, 
    'Credit/Debit Card', 
    'CARD', 
    1, 
    1, 
    'credit-card', 
    2
FROM tenants t
LEFT JOIN payment_methods pm ON pm.tenant_id = t.id AND pm.code = 'CARD'
WHERE pm.id IS NULL;

-- Check if payment_terminals table exists
SET @tablename = 'payment_terminals';
SET @table_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                   WHERE table_schema = @dbname AND table_name = @tablename);

-- If table exists, add columns that don't exist
SET @sql = NULL;
SELECT 
  GROUP_CONCAT(
    DISTINCT
    CONCAT(
      'ALTER TABLE ', @tablename, ' ADD COLUMN ', 
      column_name, ' ', 
      column_type, 
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
      IF(extra != '', CONCAT(' ', extra), ''),
      ' AFTER ', 
      CASE 
        WHEN column_name = 'type' THEN 'name'
        WHEN column_name = 'is_active' THEN 'api_secret'
        WHEN column_name = 'settings' THEN 'is_active'
        WHEN column_name = 'created_at' THEN 'settings'
        WHEN column_name = 'updated_at' THEN 'created_at'
        ELSE 'id'
      END,
      ';'
    ) SEPARATOR '\n'
  ) INTO @sql
FROM (
  SELECT 
    'type' as column_name, 'ENUM(\'INGENICO\',\'VERIFONE\',\'PAYTM\',\'PHONEPE\',\'CUSTOM\')' as column_type, 'NO' as is_nullable, 'CUSTOM' as column_default, '' as extra
  UNION SELECT 'is_active', 'TINYINT(1)', 'NO', '1', ''
  UNION SELECT 'settings', 'JSON', 'YES', NULL, ''
  UNION SELECT 'created_at', 'TIMESTAMP', 'NO', 'CURRENT_TIMESTAMP', 'DEFAULT_GENERATED'
  UNION SELECT 'updated_at', 'TIMESTAMP', 'NO', 'CURRENT_TIMESTAMP', 'on update CURRENT_TIMESTAMP'
) as cols
WHERE @table_exists > 0
AND NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE table_schema = @dbname 
  AND table_name = @tablename 
  AND column_name = cols.column_name
);

-- Execute the ALTER TABLE statements if there are any
IF @sql IS NOT NULL AND @sql != '' THEN
  SET @sql = CONCAT('ALTER TABLE ', @tablename, ' ', @sql);
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
END IF;

-- Check if payment_transactions table exists
SET @tablename = 'payment_transactions';
SET @table_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                   WHERE table_schema = @dbname AND table_name = @tablename);

-- If table exists, add columns that don't exist
SET @sql = NULL;
SELECT 
  GROUP_CONCAT(
    DISTINCT
    CONCAT(
      'ALTER TABLE ', @tablename, ' ADD COLUMN ', 
      column_name, ' ', 
      column_type, 
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
      IF(extra != '', CONCAT(' ', extra), ''),
      ' AFTER ', 
      CASE 
        WHEN column_name = 'exchange_rate' THEN 'currency'
        WHEN column_name = 'transaction_id' THEN 'status'
        WHEN column_name = 'reference_id' THEN 'transaction_id'
        WHEN column_name = 'card_last4' THEN 'wallet_name'
        WHEN column_name = 'card_type' THEN 'card_last4'
        WHEN column_name = 'metadata' THEN 'notes'
        WHEN column_name = 'created_at' THEN 'metadata'
        WHEN column_name = 'updated_at' THEN 'created_at'
        ELSE 'id'
      END,
      ';'
    ) SEPARATOR '\n'
  ) INTO @sql
FROM (
  SELECT 
    'exchange_rate' as column_name, 'DECIMAL(10,6)' as column_type, 'NO' as is_nullable, '1.0' as column_default, '' as extra
  UNION SELECT 'transaction_id', 'VARCHAR(100)', 'YES', NULL, ''
  UNION SELECT 'reference_id', 'VARCHAR(100)', 'YES', NULL, ''
  UNION SELECT 'card_last4', 'VARCHAR(4)', 'YES', NULL, ''
  UNION SELECT 'card_type', 'VARCHAR(20)', 'YES', NULL, ''
  UNION SELECT 'metadata', 'JSON', 'YES', NULL, ''
  UNION SELECT 'created_at', 'TIMESTAMP', 'NO', 'CURRENT_TIMESTAMP', 'DEFAULT_GENERATED'
  UNION SELECT 'updated_at', 'TIMESTAMP', 'NO', 'CURRENT_TIMESTAMP', 'on update CURRENT_TIMESTAMP'
) as cols
WHERE @table_exists > 0
AND NOT EXISTS (
  SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE table_schema = @dbname 
  AND table_name = @tablename 
  AND column_name = cols.column_name
);

-- Execute the ALTER TABLE statements if there are any
IF @sql IS NOT NULL AND @sql != '' THEN
  SET @sql = CONCAT('ALTER TABLE ', @tablename, ' ', @sql);
  PREPARE stmt FROM @sql;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
  
  -- Add indexes that don't exist
  SET @indexes = 'idx_sale,idx_payment_method,idx_terminal,idx_tenant,idx_transaction,idx_reference,idx_created';
  
  -- Check and add each index
  SET @index_list = CONCAT(
    'SELECT GROUP_CONCAT(index_name) INTO @existing_indexes ',
    'FROM information_schema.statistics ',
    'WHERE table_schema = \'', @dbname, '\' ',
    'AND table_name = \'', @tablename, '\' ',
    'AND index_name IN (\'', REPLACE(@indexes, ',', '\',\''), '\')'
  );
  
  PREPARE stmt FROM @index_list;
  EXECUTE stmt;
  DEALLOCATE PREPARE stmt;
  
  -- Add missing indexes
  SET @indexes_to_add = CONCAT(
    'ALTER TABLE ', @tablename, ' ',
    IF(@existing_indexes IS NULL, 
       CONCAT('ADD INDEX idx_sale (sale_id), ',
              'ADD INDEX idx_payment_method (payment_method_id), ',
              'ADD INDEX idx_terminal (terminal_id), ',
              'ADD INDEX idx_tenant (tenant_id), ',
              'ADD INDEX idx_transaction (transaction_id), ',
              'ADD INDEX idx_reference (reference_id), ',
              'ADD INDEX idx_created (created_at)'),
       CONCAT_WS(', ',
         IF(@existing_indexes NOT LIKE '%idx_sale%', 'ADD INDEX idx_sale (sale_id)', NULL),
         IF(@existing_indexes NOT LIKE '%idx_payment_method%', 'ADD INDEX idx_payment_method (payment_method_id)', NULL),
         IF(@existing_indexes NOT LIKE '%idx_terminal%', 'ADD INDEX idx_terminal (terminal_id)', NULL),
         IF(@existing_indexes NOT LIKE '%idx_tenant%', 'ADD INDEX idx_tenant (tenant_id)', NULL),
         IF(@existing_indexes NOT LIKE '%idx_transaction%', 'ADD INDEX idx_transaction (transaction_id)', NULL),
         IF(@existing_indexes NOT LIKE '%idx_reference%', 'ADD INDEX idx_reference (reference_id)', NULL),
         IF(@existing_indexes NOT LIKE '%idx_created%', 'ADD INDEX idx_created (created_at)', NULL)
       )
    )
  );
  
  IF @indexes_to_add != CONCAT('ALTER TABLE ', @tablename, ' ') THEN
    PREPARE stmt FROM @indexes_to_add;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END IF;

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

-- Initialize tenant payment settings for existing tenants
INSERT IGNORE INTO `tenant_payment_settings` (`tenant_id`, `default_currency`, `allow_partial_payments`)
SELECT 
    t.id, 
    'INR', 
    1
FROM `tenants` t
LEFT JOIN `tenant_payment_settings` tps ON tps.tenant_id = t.id
WHERE tps.tenant_id IS NULL;

-- Check if sales table exists and needs updates
SET @tablename = 'sales';
SET @table_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES 
                   WHERE table_schema = @dbname AND table_name = @tablename);

-- If table exists, add/modify columns
IF @table_exists > 0 THEN
    -- Check if payment_status column exists
    SET @column_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                         WHERE table_schema = @dbname 
                         AND table_name = @tablename 
                         AND column_name = 'payment_status');
    
    -- Add payment_status column if it doesn't exist
    IF @column_exists = 0 THEN
        SET @sql = 'ALTER TABLE sales ADD COLUMN payment_status ENUM(''PENDING'', ''PARTIALLY_PAID'', ''PAID'', ''REFUNDED'', ''CANCELLED'') DEFAULT ''PENDING'' AFTER status';
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        
        -- Add index on payment_status
        SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
                           WHERE table_schema = @dbname 
                           AND table_name = @tablename 
                           AND index_name = 'idx_sales_payment_status');
                           
        IF @index_exists = 0 THEN
            SET @sql = 'ALTER TABLE sales ADD INDEX idx_sales_payment_status (payment_status)';
            PREPARE stmt FROM @sql;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
        END IF;
    END IF;
    
    -- Check if payment_reference column exists
    SET @column_exists = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                         WHERE table_schema = @dbname 
                         AND table_name = @tablename 
                         AND column_name = 'payment_reference');
    
    -- Add payment_reference column if it doesn't exist
    IF @column_exists = 0 THEN
        SET @sql = 'ALTER TABLE sales ADD COLUMN payment_reference VARCHAR(100) NULL AFTER payment_method';
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
    
    -- Modify payment_method column if needed
    SET @column_type = (SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS 
                       WHERE table_schema = @dbname 
                       AND table_name = @tablename 
                       AND column_name = 'payment_method');
    
    IF @column_type IS NOT NULL AND @column_type NOT LIKE "%'online'%" THEN
        SET @sql = 'ALTER TABLE sales MODIFY COLUMN payment_method ENUM(''cash'',''card'',''upi'',''wallet'',''online'') NULL';
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
    
    -- Add index on payment_method if it doesn't exist
    SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
                       WHERE table_schema = @dbname 
                       AND table_name = @tablename 
                       AND index_name = 'idx_sales_payment_method');
                       
    IF @index_exists = 0 THEN
        SET @sql = 'ALTER TABLE sales ADD INDEX idx_sales_payment_method (payment_method)';
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END IF;

-- Re-enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

COMMIT;

-- Add a comment to the migration
-- This migration updates the existing payment system schema to support the enhanced payment features
-- while maintaining compatibility with existing data.
