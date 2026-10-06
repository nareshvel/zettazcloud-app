-- Add new fields to customers table
-- Using a safer approach with individual ALTER statements and error handling

-- Add company_name column if it doesn't exist
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'company_name') = 0,
  'ALTER TABLE `customers` ADD COLUMN `company_name` varchar(255) DEFAULT NULL',
  'SELECT 1'
));
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add currency_code column if it doesn't exist
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'currency_code') = 0,
  'ALTER TABLE `customers` ADD COLUMN `currency_code` varchar(3) DEFAULT NULL',
  'SELECT 1'
));
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add portal_status column if it doesn't exist
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'portal_status') = 0,
  'ALTER TABLE `customers` ADD COLUMN `portal_status` enum(\'enabled\',\'disabled\') DEFAULT \'disabled\'',
  'SELECT 1'
));
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add portal_language column if it doesn't exist
SET @stmt = (SELECT IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'portal_language') = 0,
  'ALTER TABLE `customers` ADD COLUMN `portal_language` varchar(10) DEFAULT \'en\'',
  'SELECT 1'
));
PREPARE stmt FROM @stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create table for customer contacts
CREATE TABLE IF NOT EXISTS `customer_contacts` (
  `id` varchar(36) NOT NULL,
  `customer_id` varchar(36) NOT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT 0,
  `position` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_contacts_customer_id` (`customer_id`),
  CONSTRAINT `fk_customer_contacts_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create table for customer activity log
CREATE TABLE IF NOT EXISTS `customer_activity_log` (
  `id` varchar(36) NOT NULL,
  `customer_id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `activity_type` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_activity_customer_id` (`customer_id`),
  CONSTRAINT `fk_customer_activity_customer_id` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
