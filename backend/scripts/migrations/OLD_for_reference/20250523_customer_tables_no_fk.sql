-- Create table for customer contacts without foreign key constraints
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
  KEY `idx_customer_contacts_customer_id` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create table for customer activity log without foreign key constraints
CREATE TABLE IF NOT EXISTS `customer_activity_log` (
  `id` varchar(36) NOT NULL,
  `customer_id` varchar(36) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `activity_type` varchar(50) NOT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_activity_customer_id` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
