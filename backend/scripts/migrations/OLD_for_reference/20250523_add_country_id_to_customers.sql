-- Add country_id column to customers table
ALTER TABLE `customers` 
ADD COLUMN `country_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL DEFAULT NULL COMMENT 'Reference to countries table' AFTER `country`,
ADD INDEX `idx_customers_country_id` (`country_id`);

-- Optionally, you can add a foreign key constraint later when ready
-- Commented out for now to avoid potential issues
-- ALTER TABLE `customers` 
-- ADD CONSTRAINT `fk_customers_country_id` FOREIGN KEY (`country_id`) REFERENCES `countries` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
