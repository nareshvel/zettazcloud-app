-- Migration to update tax tables for store-specific and default functionality
-- Timestamp: 20250611003800

-- Step 1: Add store_id to tax_classes to allow for store-specific tax classes.
-- A NULL store_id means the tax class is available to all stores in the tenant.
ALTER TABLE `tax_classes`
ADD COLUMN `store_id` CHAR(36) NULL DEFAULT NULL AFTER `tenant_id`,
ADD INDEX `idx_store_id` (`store_id`),
ADD CONSTRAINT `fk_tax_classes_store_id` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 2: Remove the is_default column from tax_classes.
-- The concept of a "default" tax class is now managed at the store level.
ALTER TABLE `tax_classes`
DROP COLUMN `is_default`;

-- Step 3: Add default_tax_class_id to the stores table.
-- This allows each store to have its own default tax class.
ALTER TABLE `stores`
ADD COLUMN `default_tax_class_id` CHAR(36) NULL DEFAULT NULL AFTER `name`,
ADD CONSTRAINT `fk_stores_default_tax_class` FOREIGN KEY (`default_tax_class_id`) REFERENCES `tax_classes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Note: You will need to run this migration against your database.
-- Example command might be: mysql -u your_user -p your_database < 20250611003800_update_tax_tables_for_stores.sql
