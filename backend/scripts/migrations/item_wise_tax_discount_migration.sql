-- Migration script for item-wise tax and discount implementation
-- Created: June 12, 2025

-- =============================================
-- PART 1: Item-wise Tax Implementation
-- =============================================

-- 1. Check if tax_class_id column exists in products table
SET @column_exists = 0;
SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'tax_class_id';

-- Add tax_class_id if it doesn't exist
SET @sql = '';

SELECT IF(@column_exists = 0, 
          'ALTER TABLE products ADD COLUMN tax_class_id CHAR(36) NULL', 
          'SELECT "Column tax_class_id already exists"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key if it doesn't exist
SET @fk_exists = 0;
SELECT COUNT(*) INTO @fk_exists FROM information_schema.table_constraints 
WHERE table_schema = DATABASE() AND table_name = 'products' AND constraint_name = 'fk_product_tax_class';

SET @sql = '';

SELECT IF(@fk_exists = 0, 
          'ALTER TABLE products ADD CONSTRAINT fk_product_tax_class FOREIGN KEY (tax_class_id) REFERENCES tax_classes(id) ON DELETE SET NULL', 
          'SELECT "Foreign key fk_product_tax_class already exists"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Check if store_id column exists in tax_classes table
SET @column_exists = 0;
SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = DATABASE() AND table_name = 'tax_classes' AND column_name = 'store_id';

-- Add store_id column if it doesn't exist
SET @sql = '';
SELECT IF(@column_exists = 0, 
          'ALTER TABLE tax_classes ADD COLUMN store_id CHAR(36) NULL', 
          'SELECT "Column store_id already exists in tax_classes"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- If column was just added, populate it with a default store
SET @sql = '';
SELECT IF(@column_exists = 0, 
          'UPDATE tax_classes SET store_id = (SELECT id FROM stores LIMIT 1) WHERE store_id IS NULL', 
          'SELECT "No need to update store_id values"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Now check for any remaining NULL values
SET @null_count = 0;
SELECT COUNT(*) INTO @null_count FROM tax_classes WHERE store_id IS NULL;

-- If there are still NULL values, set them to a default store
SET @sql = '';
SELECT IF(@null_count > 0, 
          'UPDATE tax_classes SET store_id = (SELECT id FROM stores LIMIT 1) WHERE store_id IS NULL', 
          'SELECT "No NULL values in store_id column"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Check for foreign key constraint that might block the modification
SET @fk_exists = 0;
SELECT COUNT(*) INTO @fk_exists FROM information_schema.table_constraints 
WHERE table_schema = DATABASE() AND table_name = 'tax_classes' AND constraint_name = 'fk_tax_classes_store_id';

-- Drop foreign key if it exists
SET @sql = '';
SELECT IF(@fk_exists > 0, 
          'ALTER TABLE tax_classes DROP FOREIGN KEY fk_tax_classes_store_id', 
          'SELECT "No foreign key constraint to drop"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Now we can modify the column
ALTER TABLE tax_classes
MODIFY COLUMN store_id CHAR(36) NOT NULL;

-- Re-add the foreign key if it was dropped
SET @sql = '';
SELECT IF(@fk_exists > 0, 
          'ALTER TABLE tax_classes ADD CONSTRAINT fk_tax_classes_store_id FOREIGN KEY (store_id) REFERENCES stores(id)', 
          'SELECT "No foreign key to re-add"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index if it doesn't exist
SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'tax_classes' AND index_name = 'idx_tax_classes_store';

SET @sql = '';
SELECT IF(@index_exists = 0, 
          'ALTER TABLE tax_classes ADD INDEX idx_tax_classes_store (store_id)', 
          'SELECT "Index idx_tax_classes_store already exists"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Check if store_id column exists in tax_class_rates table
SET @column_exists = 0;
SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = DATABASE() AND table_name = 'tax_class_rates' AND column_name = 'store_id';

-- Add store_id column if it doesn't exist
SET @sql = '';
SELECT IF(@column_exists = 0, 
          'ALTER TABLE tax_class_rates ADD COLUMN store_id CHAR(36) NULL', 
          'SELECT "Column store_id already exists in tax_class_rates"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update store_id with values from tax_classes if it was just added
SET @sql = '';
SELECT IF(@column_exists = 0, 
          'UPDATE tax_class_rates tcr JOIN tax_classes tc ON tcr.tax_class_id = tc.id SET tcr.store_id = tc.store_id WHERE tcr.store_id IS NULL', 
          'SELECT "No need to update store_id values"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Now check for any remaining NULL values
SET @null_count = 0;
SELECT COUNT(*) INTO @null_count FROM tax_class_rates WHERE store_id IS NULL;

-- If there are still NULL values, set them to a default store
SET @sql = '';
SELECT IF(@null_count > 0, 
          'UPDATE tax_class_rates SET store_id = (SELECT id FROM stores LIMIT 1) WHERE store_id IS NULL', 
          'SELECT "No NULL values in store_id column"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Now we can modify the column to be NOT NULL
ALTER TABLE tax_class_rates
MODIFY COLUMN store_id CHAR(36) NOT NULL;

-- Add foreign key if it doesn't exist
SET @fk_exists = 0;
SELECT COUNT(*) INTO @fk_exists FROM information_schema.table_constraints 
WHERE table_schema = DATABASE() AND table_name = 'tax_class_rates' AND constraint_name = 'fk_tax_class_rates_store_id';

SET @sql = '';
SELECT IF(@fk_exists = 0, 
          'ALTER TABLE tax_class_rates ADD CONSTRAINT fk_tax_class_rates_store_id FOREIGN KEY (store_id) REFERENCES stores(id)', 
          'SELECT "Foreign key already exists"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index if it doesn't exist
SET @index_exists = 0;
SELECT COUNT(*) INTO @index_exists FROM information_schema.statistics 
WHERE table_schema = DATABASE() AND table_name = 'tax_class_rates' AND index_name = 'idx_tax_rates_store';

SET @sql = '';
SELECT IF(@index_exists = 0, 
          'ALTER TABLE tax_class_rates ADD INDEX idx_tax_rates_store (store_id)', 
          'SELECT "Index idx_tax_rates_store already exists"') 
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Update existing queries to include store_id filtering
-- Note: This is a reminder for API implementation, not actual SQL

-- =============================================
-- PART 2: Item-wise Discount Implementation
-- =============================================

-- 1. Check if promotional_offers table exists
SET @table_exists = 0;
SELECT COUNT(*) INTO @table_exists FROM information_schema.tables 
WHERE table_schema = DATABASE() AND table_name = 'promotional_offers';

-- Create promotional_offers table if it doesn't exist
SET @sql = '';

SELECT IF(@table_exists = 0, 
'CREATE TABLE promotional_offers (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    offer_type ENUM(\'buy_x_get_y\', \'percentage_discount\', \'fixed_discount\', \'bundle_price\', \'tiered_pricing\') NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    start_date DATETIME NOT NULL,
    end_date DATETIME NULL,
    priority INT DEFAULT 0,
    max_uses_per_customer INT NULL,
    max_total_uses INT NULL,
    current_total_uses INT DEFAULT 0,
    minimum_quantity INT DEFAULT 1,
    minimum_purchase_amount DECIMAL(10,2) NULL,
    discount_value DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by_user_id CHAR(36) NULL,
    updated_by_user_id CHAR(36) NULL,
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    INDEX idx_tenant_store_active (tenant_id, store_id, is_active),
    INDEX idx_dates (start_date, end_date)
)',
'SELECT "Table promotional_offers already exists"')
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Check if offer_rules table exists
SET @table_exists = 0;
SELECT COUNT(*) INTO @table_exists FROM information_schema.tables 
WHERE table_schema = DATABASE() AND table_name = 'offer_rules';

-- Create offer_rules table if it doesn't exist
SET @sql = '';

SELECT IF(@table_exists = 0, 
'CREATE TABLE offer_rules (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36) NOT NULL,
    offer_id CHAR(36) NOT NULL,
    rule_type ENUM(\'product\', \'category\', \'all_products\') NOT NULL,
    entity_id CHAR(36) NULL,
    quantity INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (offer_id) REFERENCES promotional_offers(id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    INDEX idx_offer_rule (offer_id, rule_type),
    INDEX idx_offer_rule_store (store_id)
)',
'SELECT "Table offer_rules already exists"')
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Check if offer_usage table exists
SET @table_exists = 0;
SELECT COUNT(*) INTO @table_exists FROM information_schema.tables 
WHERE table_schema = DATABASE() AND table_name = 'offer_usage';

-- Check if orders table exists
SET @orders_table_exists = 0;
SELECT COUNT(*) INTO @orders_table_exists FROM information_schema.tables 
WHERE table_schema = DATABASE() AND table_name = 'orders';

-- Check if customers table exists
SET @customers_table_exists = 0;
SELECT COUNT(*) INTO @customers_table_exists FROM information_schema.tables 
WHERE table_schema = DATABASE() AND table_name = 'customers';

-- Create offer_usage table if it doesn't exist
SET @sql = '';

-- Build the CREATE TABLE statement based on which tables exist
SET @create_table_start = 'CREATE TABLE offer_usage (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36) NOT NULL,
    offer_id CHAR(36) NOT NULL,
    customer_id CHAR(36) NOT NULL,
    order_id CHAR(36) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (offer_id) REFERENCES promotional_offers(id),
';

SET @customer_fk = IF(@customers_table_exists > 0, '    FOREIGN KEY (customer_id) REFERENCES customers(id),
', '');
SET @order_fk = IF(@orders_table_exists > 0, '    FOREIGN KEY (order_id) REFERENCES orders(id),
', '');

SET @create_table_end = '    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (store_id) REFERENCES stores(id),
    INDEX idx_offer_customer (offer_id, customer_id),
    INDEX idx_offer_usage_store (store_id)
)';

SET @full_create_table = CONCAT(@create_table_start, @customer_fk, @order_fk, @create_table_end);

SELECT IF(@table_exists = 0, @full_create_table, 'SELECT "Table offer_usage already exists"')
INTO @sql;

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- =============================================
-- PART 3: API Implementation Guidelines
-- =============================================

/*
IMPORTANT API IMPLEMENTATION NOTES:

1. All API endpoints must include store_id filtering:
   - For GET requests: Always filter by the current user's store_id
   - For POST/PUT/PATCH: Always include store_id in the payload
   - For DELETE: Verify the resource belongs to the user's store before deletion

2. Example API implementation pattern:

   ```javascript
   // Get all tax classes for current store
   router.get('/api/tax-classes', authenticate, async (req, res) => {
     try {
       const storeId = req.user.store_id; // Get from authenticated user
       
       const taxClasses = await db.query(
         'SELECT * FROM tax_classes WHERE store_id = ?',
         [storeId]
       );
       
       res.json({ status: 'success', data: taxClasses });
     } catch (error) {
       res.status(500).json({ status: 'error', message: error.message });
     }
   });
   ```

3. For multi-store tenants, consider adding role-based access control:
   - Store managers: Can only access their own store's data
   - Tenant admins: Can access all stores' data within their tenant
*/
