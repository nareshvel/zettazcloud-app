-- =============================================================================
-- 0000_baseline_schema.sql
-- =============================================================================
-- BASELINE SCHEMA - structure only, no data.
--
-- WHY THIS EXISTS
-- ---------------
-- Before this file, `database/migrations/` contained only incremental changes
-- dating from 2025-08-16 onward. The core tables (users, tenants, stores,
-- products, sales, customers, tax_classes, tax_class_rates, ...) existed ONLY
-- inside backup dumps in `database/backup/`. Consequences:
--   * a fresh database could not be built from migrations
--   * onboarding a developer required restoring a production backup
--   * CI could not spin up a clean test database, which is why test coverage
--     for anything touching the DB was effectively blocked
--
-- Generated from Sep_03_2025_digitpulse_zcloud.sql with:
--   * all INSERT/data statements removed
--   * CREATE TABLE -> CREATE TABLE IF NOT EXISTS (idempotent, per convention)
--   * AUTO_INCREMENT seed values stripped (environment specific)
--   * backup/legacy tables excluded (legacy_users_backup, migration_backup_categories, migration_backup_products, users_backup_20250626051814474)
--   * VIEWS emitted as real CREATE OR REPLACE VIEW, not the mysqldump
--     placeholder CREATE TABLE stubs (those stubs would otherwise create
--     bogus tables that shadow the real views)
--   * DEFINER clauses removed and SQL SECURITY INVOKER used, so the schema
--     does not depend on a specific database user existing
--
-- ORDERING: the `0000_` prefix sorts before every dated migration, so a clean
-- database builds this first, then applies incremental changes in date order.
--
-- EXISTING ENVIRONMENTS: every statement is IF NOT EXISTS / OR REPLACE, so
-- applying this to a populated database is a no-op. Safe to run anywhere.
--
-- COLLATION: this file faithfully reproduces production, which includes eight
-- tables still on utf8mb4_unicode_ci. They are converged onto the mandated
-- utf8mb4_0900_ai_ci by 2026-08-23_normalize_collation.sql, which runs after
-- this file. Do not "fix" the collation here - that would make fresh databases
-- diverge from restored ones.
--
-- FOREIGN KEYS: checks are disabled for the duration of this file because the
-- dump is emitted alphabetically, not in dependency order.
-- =============================================================================

SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- TABLES (51)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `user_id` char(36) DEFAULT NULL,
  `tenant_id` char(36) DEFAULT NULL,
  `store_id` char(36) DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `resource_type` varchar(50) NOT NULL,
  `resource_id` char(36) DEFAULT NULL,
  `event_category` enum('authentication','authorization','transaction','inventory','configuration','user_management','system','data_export','onboarding','subscription') NOT NULL,
  `severity` enum('low','medium','high','critical') DEFAULT 'medium',
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `session_id` varchar(255) DEFAULT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `details` json DEFAULT NULL,
  `status` enum('success','failure','warning') DEFAULT 'success',
  `error_message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `categories` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `image_url` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by_user_id` char(36) DEFAULT NULL,
  `updated_by_user_id` char(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- countries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `countries` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(2) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ISO 3166-1 alpha-2 code',
  `code3` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'ISO 3166-1 alpha-3 code',
  `phone_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Country calling code',
  `currency_code` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'ISO 4217 currency code',
  `flag_emoji` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Flag emoji unicode',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- customer_activity_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_activity_log` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `activity_type` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- customer_contacts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_contacts` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `phone` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_primary` tinyint(1) DEFAULT '0',
  `position` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- customers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customers` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `store_id` varchar(36) DEFAULT NULL,
  `first_name` varchar(100) NOT NULL,
  `last_name` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone_number` varchar(30) DEFAULT NULL,
  `address_line1` varchar(255) DEFAULT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state_province` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `country_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Reference to countries table',
  `customer_type` varchar(50) DEFAULT 'INDIVIDUAL',
  `loyalty_id` varchar(50) DEFAULT NULL,
  `tax_id_number` varchar(50) DEFAULT NULL,
  `notes` text,
  `credit_limit` decimal(12,2) NOT NULL DEFAULT '0.00',
  `outstanding_credit` decimal(12,2) NOT NULL DEFAULT '0.00',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by_user_id` varchar(36) DEFAULT NULL,
  `updated_by_user_id` varchar(36) DEFAULT NULL,
  `default_discount_type` enum('percentage','fixed') DEFAULT NULL,
  `default_discount_value` decimal(10,2) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `preferred_communication` varchar(50) DEFAULT NULL,
  `preferred_payment_method` varchar(255) DEFAULT NULL,
  `referral_source` varchar(255) DEFAULT NULL,
  `company_name` varchar(255) DEFAULT NULL,
  `currency_code` varchar(3) DEFAULT NULL,
  `portal_status` enum('enabled','disabled') DEFAULT 'disabled',
  `portal_language` varchar(10) DEFAULT 'en',
  `payment_terms_days` int DEFAULT '30' COMMENT 'Number of days allowed for payment before considered overdue',
  `is_tax_exempt` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Whether this customer is exempt from taxes (1=exempt, 0=not exempt)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- goods_received_notes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `goods_received_notes` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `store_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT 'FK to stores.id',
  `grn_number` varchar(50) NOT NULL,
  `supplier_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `purchase_order_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `received_date` date NOT NULL,
  `notes` text,
  `supplier_invoice_number` varchar(100) DEFAULT NULL,
  `supplier_invoice_date` date DEFAULT NULL,
  `received_by_user_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `user_id` varchar(36) DEFAULT NULL COMMENT 'FK to users.id, creator of the GRN',
  `status` enum('DRAFT','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `total_received_value` decimal(15,2) NOT NULL DEFAULT '0.00',
  `total_tax_paid` decimal(15,2) NOT NULL DEFAULT '0.00',
  `shipping_handling_paid` decimal(15,2) NOT NULL DEFAULT '0.00',
  `other_charges_paid` decimal(15,2) NOT NULL DEFAULT '0.00',
  `grand_total` decimal(15,2) GENERATED ALWAYS AS ((((coalesce(`total_received_value`,0) + coalesce(`total_tax_paid`,0)) + coalesce(`shipping_handling_paid`,0)) + coalesce(`other_charges_paid`,0))) STORED COMMENT 'Total value including taxes and charges',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- grn_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `grn_items` (
  `id` varchar(36) NOT NULL,
  `grn_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `product_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `purchase_order_id` varchar(36) DEFAULT NULL,
  `purchase_order_item_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `quantity_received` decimal(10,2) NOT NULL,
  `unit_cost_price` decimal(15,2) NOT NULL,
  `line_total` decimal(15,2) GENERATED ALWAYS AS ((`quantity_received` * `unit_cost_price`)) STORED,
  `tax_rate` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT 'Tax rate percentage, e.g., 10.00 for 10%',
  `tax_amount` decimal(15,2) GENERATED ALWAYS AS ((((`quantity_received` * `unit_cost_price`) * `tax_rate`) / 100.00)) STORED COMMENT 'Calculated tax amount for the line',
  `line_total_with_tax` decimal(15,2) GENERATED ALWAYS AS (((`quantity_received` * `unit_cost_price`) + (((`quantity_received` * `unit_cost_price`) * `tax_rate`) / 100.00))) STORED COMMENT 'Line total including tax',
  `batch_number` varchar(50) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `remarks` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- held_orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `held_orders` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `cashier_id` char(36) NOT NULL,
  `items` json NOT NULL,
  `note` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- inventory_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `inventory_logs` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `product_id` char(36) NOT NULL,
  `store_id` varchar(36) DEFAULT NULL COMMENT 'FK to stores.id, if inventory is store-specific',
  `quantity_change` decimal(10,2) NOT NULL COMMENT 'Change in quantity, positive for increase, negative for decrease',
  `reference_type` varchar(50) DEFAULT NULL COMMENT 'e.g., GRN_ITEM, SALE_ITEM, ADJUSTMENT',
  `reference_id` varchar(36) DEFAULT NULL COMMENT 'ID of the source document/item (e.g., grn_items.id)',
  `reason` text,
  `current_stock_before_change` decimal(10,2) DEFAULT NULL COMMENT 'Stock level of the product before this change',
  `current_stock_after_change` decimal(10,2) DEFAULT NULL COMMENT 'Stock level of the product after this change',
  `created_by` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- offer_price_tiers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `offer_price_tiers` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `store_id` varchar(36) NOT NULL,
  `offer_id` varchar(36) NOT NULL,
  `quantity` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- offer_rules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `offer_rules` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `offer_id` char(36) NOT NULL,
  `rule_type` enum('product','category','all_products') NOT NULL,
  `entity_id` char(36) DEFAULT NULL,
  `quantity` int DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- offer_usage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `offer_usage` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `offer_id` char(36) NOT NULL,
  `customer_id` char(36) NOT NULL,
  `order_id` char(36) NOT NULL,
  `used_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- payment_gateway_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payment_gateway_transactions` (
  `id` varchar(36) NOT NULL,
  `sale_id` varchar(36) NOT NULL,
  `gateway_id` varchar(36) NOT NULL,
  `gateway_transaction_id` varchar(100) DEFAULT NULL,
  `payment_intent_id` varchar(100) DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `currency` varchar(3) DEFAULT 'USD',
  `status` enum('pending','processing','completed','failed','cancelled','refunded','partially_refunded') DEFAULT 'pending',
  `gateway_response` json DEFAULT NULL,
  `webhook_data` json DEFAULT NULL,
  `refund_amount` decimal(10,2) DEFAULT '0.00',
  `fees_amount` decimal(10,2) DEFAULT '0.00',
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- payment_gateways
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payment_gateways` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `gateway_type` enum('stripe','paypal','razorpay','square','authorize_net') NOT NULL,
  `is_active` tinyint(1) DEFAULT '0',
  `is_live_mode` tinyint(1) DEFAULT '0',
  `config_data` json NOT NULL,
  `webhook_secret` varchar(255) DEFAULT NULL,
  `webhook_endpoint` varchar(255) DEFAULT NULL,
  `supported_currencies` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- payment_methods
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payment_methods` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Display name (e.g., Cash, Credit Card, Phone)',
  `code` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Unique code (e.g., cash, card, phone, on_account)',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `requires_terminal` tinyint(1) NOT NULL DEFAULT '0',
  `icon` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Icon identifier for UI',
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Available payment methods for each tenant';

-- ---------------------------------------------------------------------------
-- payment_terminals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payment_terminals` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Display name for the terminal',
  `type` enum('INGENICO','VERIFONE','PAYTM','PHONEPE','CUSTOM') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `terminal_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Terminal ID from provider',
  `api_key` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'API key for terminal authentication',
  `api_secret` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Encrypted API secret',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `settings` json DEFAULT NULL COMMENT 'Terminal-specific settings',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment terminal configurations';

-- ---------------------------------------------------------------------------
-- payment_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `payment_transactions` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `tenant_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `sale_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `payment_method_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `terminal_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL COMMENT 'Amount in the transaction currency',
  `currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `exchange_rate` decimal(10,6) DEFAULT '1.000000',
  `transaction_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Gateway transaction ID',
  `reference_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Merchant reference ID',
  `status` enum('PENDING','COMPLETED','FAILED','REFUNDED','PARTIALLY_REFUNDED') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDING',
  `card_last4` varchar(4) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Last 4 digits of card',
  `card_type` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Visa, MasterCard, etc.',
  `wallet_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Name of wallet for wallet payments',
  `metadata` json DEFAULT NULL COMMENT 'Additional payment details',
  `notes` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Additional notes',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Payment transactions';

-- ---------------------------------------------------------------------------
-- permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `permissions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `description` text,
  `module` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `plans` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `description` text,
  `price_monthly` decimal(10,2) NOT NULL,
  `price_yearly` decimal(10,2) DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'USD',
  `features` json DEFAULT NULL,
  `limits` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- printer_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `printer_settings` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `store_id` varchar(36) NOT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `auto_print` tinyint(1) DEFAULT '0',
  `print_mode` varchar(32) NOT NULL DEFAULT 'browser',
  `printer_name` varchar(255) DEFAULT NULL,
  `paper_width` int DEFAULT '58',
  `template_id` varchar(36) DEFAULT NULL,
  `header` text,
  `footer` text,
  `logo_url` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `products` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) DEFAULT NULL COMMENT 'FK to stores.id, if product is store-specific',
  `name` varchar(255) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL,
  `cost_price` decimal(10,2) DEFAULT NULL COMMENT 'Cost price of the product',
  `total_quantity_received` decimal(15,2) NOT NULL DEFAULT '0.00' COMMENT 'Cumulative quantity of this product ever received',
  `last_received_cost_price` decimal(15,2) DEFAULT NULL,
  `weighted_average_cost` decimal(15,5) DEFAULT NULL COMMENT 'Weighted average cost price, updated upon receiving goods',
  `last_received_date` date DEFAULT NULL COMMENT 'Date when the product was last received via GRN',
  `barcode` varchar(255) DEFAULT NULL,
  `sku` varchar(255) DEFAULT NULL,
  `category_id` char(36) DEFAULT NULL,
  `stock_quantity` int DEFAULT '0',
  `low_stock_threshold` int DEFAULT NULL COMMENT 'Threshold for low stock warning',
  `image_url` text,
  `tax_class_id` char(36) DEFAULT NULL COMMENT 'FK to tax_classes.id. Determines the tax rules for this product. NULL means use store default tax class.',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by_user_id` char(36) DEFAULT NULL COMMENT 'FK to users.id, user who created the product',
  `updated_by_user_id` char(36) DEFAULT NULL COMMENT 'FK to users.id, user who last updated the product',
  `specific_discount_type` enum('percentage','fixed') DEFAULT NULL COMMENT 'Type of product-specific discount.',
  `specific_discount_value` decimal(10,2) DEFAULT NULL COMMENT 'Value for product-specific discount (amount for fixed, percentage for percentage).',
  `promotional_offer_id` char(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- promotional_offers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `promotional_offers` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `offer_type` enum('buy_x_get_y','percentage_discount','fixed_discount','bundle_price','tiered_pricing') NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `start_date` datetime NOT NULL,
  `end_date` datetime DEFAULT NULL,
  `priority` int DEFAULT '0',
  `max_uses_per_customer` int DEFAULT NULL,
  `max_total_uses` int DEFAULT NULL,
  `current_total_uses` int DEFAULT '0',
  `minimum_quantity` int DEFAULT '1',
  `minimum_purchase_amount` decimal(10,2) DEFAULT NULL,
  `discount_value` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by_user_id` char(36) DEFAULT NULL,
  `updated_by_user_id` char(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- purchase_order_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_order_items` (
  `id` char(36) NOT NULL,
  `purchase_order_id` char(36) NOT NULL COMMENT 'FK to purchase_orders.id',
  `product_id` char(36) NOT NULL COMMENT 'FK to products.id',
  `quantity_ordered` decimal(10,2) NOT NULL,
  `cost_price` decimal(10,2) NOT NULL COMMENT 'Cost per unit at the time of this purchase',
  `quantity_received` decimal(10,2) DEFAULT '0.00' COMMENT 'How many have been received so far',
  `remaining_quantity` decimal(10,2) GENERATED ALWAYS AS ((`quantity_ordered` - `quantity_received`)) STORED COMMENT 'Calculated remaining quantity to be received',
  `status` varchar(50) DEFAULT NULL,
  `line_total` decimal(12,2) GENERATED ALWAYS AS ((`quantity_ordered` * `cost_price`)) STORED COMMENT 'Automatically calculated',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- purchase_orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `purchase_orders` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) DEFAULT NULL COMMENT 'FK to stores.id, if purchases are store-specific',
  `supplier_id` char(36) NOT NULL COMMENT 'FK to suppliers.id - Who the purchase is from',
  `purchase_order_number` varchar(50) DEFAULT NULL COMMENT 'Optional user-friendly PO number',
  `order_date` date NOT NULL COMMENT 'Date the order was placed',
  `expected_delivery_date` date DEFAULT NULL COMMENT 'When the items are expected',
  `status` varchar(50) NOT NULL DEFAULT 'DRAFT',
  `total_amount` decimal(12,2) DEFAULT '0.00' COMMENT 'Calculated total of all items, can be updated',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by_user_id` char(36) DEFAULT NULL COMMENT 'FK to users.id',
  `updated_by_user_id` char(36) DEFAULT NULL COMMENT 'FK to users.id',
  `last_grn_date` datetime DEFAULT NULL COMMENT 'Date when last GRN was processed for this PO'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- receipt_templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `receipt_templates` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text,
  `html_template` text NOT NULL,
  `css_template` text,
  `is_default` tinyint(1) DEFAULT '0',
  `is_system` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` varchar(36) DEFAULT NULL,
  `updated_by` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- return_number_sequences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `return_number_sequences` (
  `tenant_id` varchar(36) NOT NULL,
  `current_number` int NOT NULL DEFAULT '1',
  `prefix` varchar(10) NOT NULL DEFAULT 'RET',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- role_permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` char(36) NOT NULL,
  `permission_id` char(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `roles` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `tenant_id` char(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text,
  `is_system_role` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- sale_applied_offers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sale_applied_offers` (
  `id` char(36) NOT NULL,
  `sale_id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `offer_id` char(36) DEFAULT NULL,
  `offer_name` varchar(255) NOT NULL,
  `offer_type` varchar(64) NOT NULL,
  `discount_value` decimal(12,4) DEFAULT NULL,
  `priority` int DEFAULT NULL,
  `rules_json` json DEFAULT NULL,
  `price_tiers_json` json DEFAULT NULL,
  `total_discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- sale_item_discounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sale_item_discounts` (
  `id` char(36) NOT NULL,
  `sale_id` char(36) NOT NULL,
  `sale_item_id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `product_id` char(36) NOT NULL,
  `offer_id` char(36) DEFAULT NULL,
  `offer_name` varchar(255) NOT NULL,
  `offer_type` varchar(64) NOT NULL,
  `rule_type` varchar(64) DEFAULT NULL,
  `rule_entity_id` char(36) DEFAULT NULL,
  `quantity_applied` int DEFAULT NULL,
  `discount_per_unit` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `total_discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `metadata_json` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- sale_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sale_items` (
  `id` char(36) NOT NULL,
  `sale_id` char(36) NOT NULL,
  `product_id` char(36) NOT NULL,
  `quantity` int NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `base_unit_price` decimal(12,2) DEFAULT NULL,
  `manual_discount_per_unit` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `promo_discount_per_unit` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `tax_per_unit` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `final_unit_price` decimal(12,4) NOT NULL DEFAULT '0.0000',
  `applied_discounts_json` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- sales
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `cashier_id` char(36) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `tax` decimal(10,2) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `payment_method` varchar(36) DEFAULT NULL,
  `payment_reference` varchar(100) DEFAULT NULL,
  `status` enum('completed','refunded','voided') DEFAULT 'completed',
  `payment_status` enum('PENDING','PARTIALLY_PAID','PAID','REFUNDED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `discount_type` varchar(20) DEFAULT NULL COMMENT 'Type of discount (e.g., percentage, fixed)',
  `discount_value` decimal(10,2) DEFAULT NULL COMMENT 'The value of the discount (e.g., 10 for 10%, or 5.00 for a fixed amount)',
  `discount_amount` decimal(10,2) DEFAULT NULL COMMENT 'The actual calculated amount of the discount applied to the sale',
  `promotions_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `manual_discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `applied_offers_json` json DEFAULT NULL,
  `customer_id` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- sales_return_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_return_items` (
  `id` varchar(36) NOT NULL,
  `sales_return_id` varchar(36) NOT NULL,
  `original_sale_item_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `base_unit_price` decimal(10,2) DEFAULT NULL,
  `discount_per_unit` decimal(10,2) DEFAULT NULL,
  `tax_per_unit` decimal(10,2) DEFAULT NULL,
  `final_unit_price` decimal(10,2) DEFAULT NULL,
  `line_subtotal` decimal(10,2) DEFAULT NULL,
  `line_discount` decimal(10,2) DEFAULT NULL,
  `line_tax` decimal(10,2) DEFAULT NULL,
  `quantity_returned` int NOT NULL,
  `unit_price` decimal(10,2) NOT NULL,
  `total_amount` decimal(10,2) NOT NULL,
  `return_condition` enum('new','used','damaged','defective') NOT NULL DEFAULT 'new',
  `restockable` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- sales_returns
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sales_returns` (
  `id` varchar(36) NOT NULL,
  `return_number` varchar(50) NOT NULL,
  `original_sale_id` varchar(36) NOT NULL,
  `customer_id` varchar(36) DEFAULT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `store_id` varchar(36) NOT NULL,
  `return_date` datetime NOT NULL,
  `return_reason` enum('defective','wrong_item','customer_change_mind','damaged','other') NOT NULL,
  `return_reason_notes` text,
  `subtotal_amount` decimal(10,2) DEFAULT NULL,
  `discount_amount` decimal(10,2) DEFAULT NULL,
  `tax_amount` decimal(10,2) DEFAULT NULL,
  `total_return_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `refund_method` enum('cash','card','store_credit','exchange') NOT NULL,
  `status` enum('pending','completed','cancelled') NOT NULL DEFAULT 'pending',
  `processed_by_user_id` varchar(36) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- stock_adjustments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_adjustments` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `store_id` varchar(36) NOT NULL,
  `product_id` varchar(36) NOT NULL,
  `variant_id` varchar(36) DEFAULT NULL COMMENT 'For future product variant support',
  `user_id` varchar(36) NOT NULL COMMENT 'User performing the adjustment',
  `adjustment_type` enum('INCREMENT','DECREMENT') NOT NULL,
  `reason_code` varchar(50) NOT NULL COMMENT 'e.g., DAMAGED, CORRECTION, INITIAL_STOCK, RECEIVED_STOCK, PROMOTION_ADJ, THEFT, SPOILAGE, RETURN_TO_VENDOR, OTHER',
  `quantity_adjusted` int UNSIGNED NOT NULL COMMENT 'Absolute value of quantity changed',
  `stock_before_adjustment` int NOT NULL,
  `stock_after_adjustment` int NOT NULL,
  `notes` text,
  `adjustment_date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- stores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stores` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `default_tax_class_id` char(36) DEFAULT NULL,
  `address` text,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `tax_rate` decimal(5,2) DEFAULT '10.00',
  `currency_code` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT 'USD' COMMENT 'Standard ISO 4217 currency code, e.g., USD, EUR, INR',
  `language_code` varchar(5) DEFAULT NULL,
  `country_code` varchar(2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `tax_config` json DEFAULT (json_object(_utf8mb4'default_rate',0.00,_utf8mb4'rules',json_array())),
  `allow_negative_stock` tinyint(1) DEFAULT '1',
  `discount_application_rule` varchar(20) DEFAULT 'BEFORE_TAX' COMMENT 'Can be BEFORE_TAX or AFTER_TAX',
  `date_format` varchar(20) DEFAULT 'MM/DD/YYYY',
  `time_format` varchar(20) DEFAULT 'hh:mm A',
  `timezone` varchar(50) DEFAULT 'UTC',
  `number_format` varchar(20) DEFAULT '1,234.56' COMMENT 'Number format pattern, e.g., 1,234.56 or 1.234,56',
  `decimal_precision` int DEFAULT '2' COMMENT 'Default decimal precision for currency values',
  `locale_code` varchar(10) DEFAULT 'en-US' COMMENT 'BCP 47 language tag, e.g., en-US, fr-CA',
  `measurement_system` enum('metric','imperial') DEFAULT 'metric' COMMENT 'Default measurement system',
  `allow_over_receiving` tinyint(1) DEFAULT '0',
  `default_tax_basis` enum('INCLUSIVE','EXCLUSIVE') NOT NULL DEFAULT 'EXCLUSIVE' COMMENT 'Determines if product prices in this store are treated as tax-inclusive or tax-exclusive by default.',
  `is_active` tinyint(1) DEFAULT '1',
  `quickstart_progress` json DEFAULT NULL COMMENT 'Tracks QuickStart onboarding step completion for each store'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- subscription_plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subscription_plans` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `display_name` varchar(100) NOT NULL,
  `description` text,
  `price` decimal(10,2) NOT NULL DEFAULT '0.00',
  `billing_cycle` enum('monthly','yearly') NOT NULL DEFAULT 'monthly',
  `trial_days` int DEFAULT '14',
  `features` json DEFAULT NULL,
  `limits_json` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `tenant_id` char(36) NOT NULL,
  `plan_id` char(36) NOT NULL,
  `status` enum('active','trial','expired','cancelled','pending') NOT NULL DEFAULT 'pending',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `trial_end_date` date DEFAULT NULL,
  `auto_renew` tinyint(1) NOT NULL DEFAULT '0',
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `suppliers` (
  `id` varchar(36) NOT NULL,
  `tenant_id` varchar(36) NOT NULL,
  `supplier_name` varchar(255) NOT NULL COMMENT 'Name of the supplier company or individual',
  `contact_person` varchar(255) DEFAULT NULL COMMENT 'Primary contact person at the supplier',
  `email` varchar(255) DEFAULT NULL COMMENT 'Email address of the supplier',
  `phone` varchar(50) DEFAULT NULL COMMENT 'Phone number of the supplier',
  `address_line1` varchar(255) DEFAULT NULL,
  `address_line2` varchar(255) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state_province` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL COMMENT 'Supplier website URL',
  `tax_id` varchar(50) DEFAULT NULL COMMENT 'Tax identification number (e.g., VAT ID, EIN)',
  `default_payment_terms` varchar(100) DEFAULT NULL COMMENT 'e.g., Net 30, Due on Receipt',
  `notes` text COMMENT 'Internal notes about the supplier',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether the supplier is currently active',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by_user_id` varchar(36) DEFAULT NULL,
  `updated_by_user_id` varchar(36) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- system_permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_permissions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `description` text,
  `module` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- system_role_permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_role_permissions` (
  `role_id` char(36) NOT NULL,
  `permission_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- system_roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_roles` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(50) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- tax_class_rates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tax_class_rates` (
  `id` char(36) NOT NULL,
  `tax_class_id` char(36) NOT NULL,
  `tax_rate_name` varchar(100) NOT NULL COMMENT 'e.g., GST, PST, State Sales Tax, City Tax',
  `rate` decimal(7,5) NOT NULL COMMENT 'Tax rate, e.g., 0.05000 for 5%. Allows for rates like 12.345%',
  `priority` int NOT NULL DEFAULT '0' COMMENT 'Calculation order for taxes within the same class. Lower numbers first.',
  `is_compound` tinyint(1) NOT NULL DEFAULT '0' COMMENT '0 = Applied on base price. 1 = Applied on (base price + sum of prior-priority taxes for this item).',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT '0 = Inactive, 1 = Active. Allows disabling a rate without deleting.',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `store_id` char(36) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Defines individual tax rate components for a tax class.';

-- ---------------------------------------------------------------------------
-- tax_classes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tax_classes` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL COMMENT 'e.g., Standard Sales Tax, Food Items (Reduced Rate), Services (GST + QST), Tax Exempt',
  `description` text COMMENT 'Optional detailed description of the tax class.',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Defines categories of tax rules (e.g., standard, reduced, exempt).';

-- ---------------------------------------------------------------------------
-- tenant_payment_settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tenant_payment_settings` (
  `tenant_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `default_currency` varchar(3) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'INR',
  `allow_partial_payments` tinyint(1) NOT NULL DEFAULT '1',
  `allow_tips` tinyint(1) NOT NULL DEFAULT '0',
  `default_tip_percentage` decimal(5,2) DEFAULT '10.00',
  `receipt_settings` json DEFAULT NULL COMMENT 'Receipt template and settings',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Tenant-specific payment settings';

-- ---------------------------------------------------------------------------
-- tenants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tenants` (
  `id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `domain` varchar(255) DEFAULT NULL,
  `settings` json DEFAULT (_utf8mb4'{}'),
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `setup_completed` tinyint(1) DEFAULT '0',
  `trial_started_at` datetime DEFAULT NULL,
  `onboarding_step` varchar(50) DEFAULT 'signup'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- user_activity_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_activity_logs` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `username` varchar(255) DEFAULT NULL,
  `action_type` varchar(100) NOT NULL,
  `description` text,
  `details` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_roles` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `user_id` char(36) NOT NULL,
  `role_id` char(36) NOT NULL,
  `store_id` char(36) DEFAULT NULL,
  `scope` enum('tenant','store') NOT NULL DEFAULT 'tenant',
  `assigned_by` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- user_system_roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `user_system_roles` (
  `user_id` char(36) NOT NULL,
  `role_id` char(36) NOT NULL,
  `assigned_by` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone_number` varchar(30) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `password_hash` varchar(255) NOT NULL,
  `profile_picture_url` varchar(255) DEFAULT NULL,
  `store_id` char(36) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `email_verified` tinyint(1) DEFAULT '0',
  `verification_token` varchar(255) DEFAULT NULL,
  `verification_expires` datetime DEFAULT NULL,
  `signup_completed` tinyint(1) DEFAULT '0'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- =============================================================================
-- VIEWS (3) - created last, they depend on the tables above
-- =============================================================================

-- ---------------------------------------------------------------------------
-- recent_critical_events
-- ---------------------------------------------------------------------------
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `recent_critical_events` AS SELECT `al`.`id` AS `id`, `al`.`created_at` AS `created_at`, `u`.`name` AS `user_name`, `u`.`email` AS `user_email`, `t`.`name` AS `tenant_name`, `s`.`name` AS `store_name`, `al`.`action` AS `action`, `al`.`resource_type` AS `resource_type`, `al`.`event_category` AS `event_category`, `al`.`severity` AS `severity`, `al`.`details` AS `details`, `al`.`status` AS `status` FROM (((`audit_logs` `al` left join `users` `u` on((`al`.`user_id` = `u`.`id`))) left join `tenants` `t` on((`al`.`tenant_id` = `t`.`id`))) left join `stores` `s` on((`al`.`store_id` = `s`.`id`))) WHERE ((`al`.`severity` in ('high','critical')) AND (`al`.`created_at` >= (now() - interval 24 hour))) ORDER BY `al`.`created_at` DESC;

-- ---------------------------------------------------------------------------
-- user_activity_summary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `user_activity_summary` AS SELECT `u`.`id` AS `user_id`, `u`.`name` AS `user_name`, `u`.`email` AS `user_email`, `t`.`name` AS `tenant_name`, count(0) AS `total_actions`, count((case when (`al`.`status` = 'failure') then 1 end)) AS `failed_actions`, max(`al`.`created_at`) AS `last_activity`, group_concat(distinct `al`.`event_category` separator ',') AS `activity_categories` FROM ((`audit_logs` `al` join `users` `u` on((`al`.`user_id` = `u`.`id`))) left join `tenants` `t` on((`al`.`tenant_id` = `t`.`id`))) WHERE (`al`.`created_at` >= (now() - interval 7 day)) GROUP BY `u`.`id`, `u`.`name`, `u`.`email`, `t`.`name` ORDER BY `total_actions` DESC;

-- ---------------------------------------------------------------------------
-- v_sales_discounts_summary
-- ---------------------------------------------------------------------------
CREATE OR REPLACE SQL SECURITY INVOKER VIEW `v_sales_discounts_summary` AS SELECT `s`.`id` AS `sale_id`, `s`.`subtotal` AS `subtotal`, `s`.`tax` AS `tax`, `s`.`discount_amount` AS `manual_discount_amount`, `s`.`promotions_amount` AS `promotions_amount`, `s`.`total` AS `total` FROM `sales` AS `s`;

-- ---------------------------------------------------------------------------
-- KEYS AND CONSTRAINTS (restored 2026-10-08)
--
-- The baseline originally shipped columns-only: the dump's ALTER TABLE
-- key/constraint blocks were dropped during generation, so clean builds had
-- no PRIMARY KEYs, indexes, or FKs and later migrations adding FKs failed
-- with "Missing index for constraint". This section restores them from
-- database/backup/Sep_03_2025_digitpulse_zcloud.sql.
--
-- Every statement is guarded by an INFORMATION_SCHEMA existence check so
-- the file stays idempotent (the migration runner re-executes files on
-- replay). Secondary indexes that 2025-08-16_performance_indexes.sql
-- re-creates with unguarded CREATE INDEX are omitted — adding them here
-- would collide on replay.
-- ---------------------------------------------------------------------------

SET @k0 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND INDEX_NAME='PRIMARY');
SET @s0 := IF(@k0=0, 'ALTER TABLE `audit_logs` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st0 FROM @s0; EXECUTE st0; DEALLOCATE PREPARE st0;

SET @k1 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_user_id');
SET @s1 := IF(@k1=0, 'ALTER TABLE `audit_logs` ADD KEY `idx_user_id` (`user_id`)', 'SELECT 1');
PREPARE st1 FROM @s1; EXECUTE st1; DEALLOCATE PREPARE st1;

SET @k2 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_tenant_id');
SET @s2 := IF(@k2=0, 'ALTER TABLE `audit_logs` ADD KEY `idx_tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st2 FROM @s2; EXECUTE st2; DEALLOCATE PREPARE st2;

SET @k3 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_store_id');
SET @s3 := IF(@k3=0, 'ALTER TABLE `audit_logs` ADD KEY `idx_store_id` (`store_id`)', 'SELECT 1');
PREPARE st3 FROM @s3; EXECUTE st3; DEALLOCATE PREPARE st3;

SET @k4 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_action');
SET @s4 := IF(@k4=0, 'ALTER TABLE `audit_logs` ADD KEY `idx_action` (`action`)', 'SELECT 1');
PREPARE st4 FROM @s4; EXECUTE st4; DEALLOCATE PREPARE st4;

SET @k5 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_resource_type');
SET @s5 := IF(@k5=0, 'ALTER TABLE `audit_logs` ADD KEY `idx_resource_type` (`resource_type`)', 'SELECT 1');
PREPARE st5 FROM @s5; EXECUTE st5; DEALLOCATE PREPARE st5;

SET @k6 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_event_category');
SET @s6 := IF(@k6=0, 'ALTER TABLE `audit_logs` ADD KEY `idx_event_category` (`event_category`)', 'SELECT 1');
PREPARE st6 FROM @s6; EXECUTE st6; DEALLOCATE PREPARE st6;

SET @k7 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_severity');
SET @s7 := IF(@k7=0, 'ALTER TABLE `audit_logs` ADD KEY `idx_severity` (`severity`)', 'SELECT 1');
PREPARE st7 FROM @s7; EXECUTE st7; DEALLOCATE PREPARE st7;

SET @k8 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_created_at');
SET @s8 := IF(@k8=0, 'ALTER TABLE `audit_logs` ADD KEY `idx_created_at` (`created_at`)', 'SELECT 1');
PREPARE st8 FROM @s8; EXECUTE st8; DEALLOCATE PREPARE st8;

SET @k9 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_tenant_created');
SET @s9 := IF(@k9=0, 'ALTER TABLE `audit_logs` ADD KEY `idx_tenant_created` (`tenant_id`,`created_at`)', 'SELECT 1');
PREPARE st9 FROM @s9; EXECUTE st9; DEALLOCATE PREPARE st9;

SET @k10 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND INDEX_NAME='idx_user_created');
SET @s10 := IF(@k10=0, 'ALTER TABLE `audit_logs` ADD KEY `idx_user_created` (`user_id`,`created_at`)', 'SELECT 1');
PREPARE st10 FROM @s10; EXECUTE st10; DEALLOCATE PREPARE st10;

SET @k11 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND INDEX_NAME='PRIMARY');
SET @s11 := IF(@k11=0, 'ALTER TABLE `categories` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st11 FROM @s11; EXECUTE st11; DEALLOCATE PREPARE st11;

SET @k12 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND INDEX_NAME='unique_category_name_per_tenant');
SET @s12 := IF(@k12=0, 'ALTER TABLE `categories` ADD UNIQUE KEY `unique_category_name_per_tenant` (`tenant_id`,`name`)', 'SELECT 1');
PREPARE st12 FROM @s12; EXECUTE st12; DEALLOCATE PREPARE st12;

SET @k13 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND INDEX_NAME='fk_categories_created_by');
SET @s13 := IF(@k13=0, 'ALTER TABLE `categories` ADD KEY `fk_categories_created_by` (`created_by_user_id`)', 'SELECT 1');
PREPARE st13 FROM @s13; EXECUTE st13; DEALLOCATE PREPARE st13;

SET @k14 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND INDEX_NAME='fk_categories_updated_by');
SET @s14 := IF(@k14=0, 'ALTER TABLE `categories` ADD KEY `fk_categories_updated_by` (`updated_by_user_id`)', 'SELECT 1');
PREPARE st14 FROM @s14; EXECUTE st14; DEALLOCATE PREPARE st14;

SET @k15 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='countries' AND INDEX_NAME='PRIMARY');
SET @s15 := IF(@k15=0, 'ALTER TABLE `countries` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st15 FROM @s15; EXECUTE st15; DEALLOCATE PREPARE st15;

SET @k16 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='countries' AND INDEX_NAME='idx_countries_code');
SET @s16 := IF(@k16=0, 'ALTER TABLE `countries` ADD UNIQUE KEY `idx_countries_code` (`code`)', 'SELECT 1');
PREPARE st16 FROM @s16; EXECUTE st16; DEALLOCATE PREPARE st16;

SET @k17 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='countries' AND INDEX_NAME='idx_countries_name');
SET @s17 := IF(@k17=0, 'ALTER TABLE `countries` ADD KEY `idx_countries_name` (`name`)', 'SELECT 1');
PREPARE st17 FROM @s17; EXECUTE st17; DEALLOCATE PREPARE st17;

SET @k18 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='countries' AND INDEX_NAME='idx_countries_code3');
SET @s18 := IF(@k18=0, 'ALTER TABLE `countries` ADD KEY `idx_countries_code3` (`code3`)', 'SELECT 1');
PREPARE st18 FROM @s18; EXECUTE st18; DEALLOCATE PREPARE st18;

SET @k19 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='countries' AND INDEX_NAME='idx_countries_is_active');
SET @s19 := IF(@k19=0, 'ALTER TABLE `countries` ADD KEY `idx_countries_is_active` (`is_active`)', 'SELECT 1');
PREPARE st19 FROM @s19; EXECUTE st19; DEALLOCATE PREPARE st19;

SET @k20 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='countries' AND INDEX_NAME='idx_countries_sort_order');
SET @s20 := IF(@k20=0, 'ALTER TABLE `countries` ADD KEY `idx_countries_sort_order` (`sort_order`)', 'SELECT 1');
PREPARE st20 FROM @s20; EXECUTE st20; DEALLOCATE PREPARE st20;

SET @k21 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='PRIMARY');
SET @s21 := IF(@k21=0, 'ALTER TABLE `customers` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st21 FROM @s21; EXECUTE st21; DEALLOCATE PREPARE st21;

SET @k22 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='fk_customers_store');
SET @s22 := IF(@k22=0, 'ALTER TABLE `customers` ADD KEY `fk_customers_store` (`store_id`)', 'SELECT 1');
PREPARE st22 FROM @s22; EXECUTE st22; DEALLOCATE PREPARE st22;

SET @k23 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='fk_customers_created_by');
SET @s23 := IF(@k23=0, 'ALTER TABLE `customers` ADD KEY `fk_customers_created_by` (`created_by_user_id`)', 'SELECT 1');
PREPARE st23 FROM @s23; EXECUTE st23; DEALLOCATE PREPARE st23;

SET @k24 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='fk_customers_updated_by');
SET @s24 := IF(@k24=0, 'ALTER TABLE `customers` ADD KEY `fk_customers_updated_by` (`updated_by_user_id`)', 'SELECT 1');
PREPARE st24 FROM @s24; EXECUTE st24; DEALLOCATE PREPARE st24;

SET @k25 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='idx_customers_tenant_id');
SET @s25 := IF(@k25=0, 'ALTER TABLE `customers` ADD KEY `idx_customers_tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st25 FROM @s25; EXECUTE st25; DEALLOCATE PREPARE st25;

SET @k26 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='idx_customers_phone_number');
SET @s26 := IF(@k26=0, 'ALTER TABLE `customers` ADD KEY `idx_customers_phone_number` (`tenant_id`,`phone_number`)', 'SELECT 1');
PREPARE st26 FROM @s26; EXECUTE st26; DEALLOCATE PREPARE st26;

SET @k27 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='idx_customers_loyalty_id');
SET @s27 := IF(@k27=0, 'ALTER TABLE `customers` ADD KEY `idx_customers_loyalty_id` (`tenant_id`,`loyalty_id`)', 'SELECT 1');
PREPARE st27 FROM @s27; EXECUTE st27; DEALLOCATE PREPARE st27;

SET @k28 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='idx_customers_is_active');
SET @s28 := IF(@k28=0, 'ALTER TABLE `customers` ADD KEY `idx_customers_is_active` (`is_active`)', 'SELECT 1');
PREPARE st28 FROM @s28; EXECUTE st28; DEALLOCATE PREPARE st28;

SET @k29 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND INDEX_NAME='idx_customers_country_id');
SET @s29 := IF(@k29=0, 'ALTER TABLE `customers` ADD KEY `idx_customers_country_id` (`country_id`)', 'SELECT 1');
PREPARE st29 FROM @s29; EXECUTE st29; DEALLOCATE PREPARE st29;

SET @k30 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_activity_log' AND INDEX_NAME='PRIMARY');
SET @s30 := IF(@k30=0, 'ALTER TABLE `customer_activity_log` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st30 FROM @s30; EXECUTE st30; DEALLOCATE PREPARE st30;

SET @k31 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_activity_log' AND INDEX_NAME='idx_customer_activity_customer_id');
SET @s31 := IF(@k31=0, 'ALTER TABLE `customer_activity_log` ADD KEY `idx_customer_activity_customer_id` (`customer_id`)', 'SELECT 1');
PREPARE st31 FROM @s31; EXECUTE st31; DEALLOCATE PREPARE st31;

SET @k32 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_contacts' AND INDEX_NAME='PRIMARY');
SET @s32 := IF(@k32=0, 'ALTER TABLE `customer_contacts` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st32 FROM @s32; EXECUTE st32; DEALLOCATE PREPARE st32;

SET @k33 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_contacts' AND INDEX_NAME='idx_customer_contacts_customer_id');
SET @s33 := IF(@k33=0, 'ALTER TABLE `customer_contacts` ADD KEY `idx_customer_contacts_customer_id` (`customer_id`)', 'SELECT 1');
PREPARE st33 FROM @s33; EXECUTE st33; DEALLOCATE PREPARE st33;

SET @k34 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND INDEX_NAME='PRIMARY');
SET @s34 := IF(@k34=0, 'ALTER TABLE `goods_received_notes` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st34 FROM @s34; EXECUTE st34; DEALLOCATE PREPARE st34;

SET @k35 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND INDEX_NAME='grn_number');
SET @s35 := IF(@k35=0, 'ALTER TABLE `goods_received_notes` ADD UNIQUE KEY `grn_number` (`grn_number`)', 'SELECT 1');
PREPARE st35 FROM @s35; EXECUTE st35; DEALLOCATE PREPARE st35;

SET @k36 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND INDEX_NAME='idx_grn_supplier_id');
SET @s36 := IF(@k36=0, 'ALTER TABLE `goods_received_notes` ADD KEY `idx_grn_supplier_id` (`supplier_id`)', 'SELECT 1');
PREPARE st36 FROM @s36; EXECUTE st36; DEALLOCATE PREPARE st36;

SET @k37 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND INDEX_NAME='idx_grn_purchase_order_id');
SET @s37 := IF(@k37=0, 'ALTER TABLE `goods_received_notes` ADD KEY `idx_grn_purchase_order_id` (`purchase_order_id`)', 'SELECT 1');
PREPARE st37 FROM @s37; EXECUTE st37; DEALLOCATE PREPARE st37;

SET @k38 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND INDEX_NAME='idx_grn_received_by_user_id');
SET @s38 := IF(@k38=0, 'ALTER TABLE `goods_received_notes` ADD KEY `idx_grn_received_by_user_id` (`received_by_user_id`)', 'SELECT 1');
PREPARE st38 FROM @s38; EXECUTE st38; DEALLOCATE PREPARE st38;

SET @k39 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND INDEX_NAME='idx_grn_status');
SET @s39 := IF(@k39=0, 'ALTER TABLE `goods_received_notes` ADD KEY `idx_grn_status` (`status`)', 'SELECT 1');
PREPARE st39 FROM @s39; EXECUTE st39; DEALLOCATE PREPARE st39;

SET @k40 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND INDEX_NAME='idx_grn_status_tenant');
SET @s40 := IF(@k40=0, 'ALTER TABLE `goods_received_notes` ADD KEY `idx_grn_status_tenant` (`status`,`tenant_id`)', 'SELECT 1');
PREPARE st40 FROM @s40; EXECUTE st40; DEALLOCATE PREPARE st40;

SET @k41 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND INDEX_NAME='idx_grn_received_date');
SET @s41 := IF(@k41=0, 'ALTER TABLE `goods_received_notes` ADD KEY `idx_grn_received_date` (`received_date`)', 'SELECT 1');
PREPARE st41 FROM @s41; EXECUTE st41; DEALLOCATE PREPARE st41;

SET @k42 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='grn_items' AND INDEX_NAME='PRIMARY');
SET @s42 := IF(@k42=0, 'ALTER TABLE `grn_items` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st42 FROM @s42; EXECUTE st42; DEALLOCATE PREPARE st42;

SET @k43 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='grn_items' AND INDEX_NAME='idx_grn_item_grn_id');
SET @s43 := IF(@k43=0, 'ALTER TABLE `grn_items` ADD KEY `idx_grn_item_grn_id` (`grn_id`)', 'SELECT 1');
PREPARE st43 FROM @s43; EXECUTE st43; DEALLOCATE PREPARE st43;

SET @k44 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='grn_items' AND INDEX_NAME='idx_grn_item_product_id');
SET @s44 := IF(@k44=0, 'ALTER TABLE `grn_items` ADD KEY `idx_grn_item_product_id` (`product_id`)', 'SELECT 1');
PREPARE st44 FROM @s44; EXECUTE st44; DEALLOCATE PREPARE st44;

SET @k45 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='grn_items' AND INDEX_NAME='idx_grn_item_po_item_id');
SET @s45 := IF(@k45=0, 'ALTER TABLE `grn_items` ADD KEY `idx_grn_item_po_item_id` (`purchase_order_item_id`)', 'SELECT 1');
PREPARE st45 FROM @s45; EXECUTE st45; DEALLOCATE PREPARE st45;

SET @k46 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='grn_items' AND INDEX_NAME='idx_grn_items_po_item_id');
SET @s46 := IF(@k46=0, 'ALTER TABLE `grn_items` ADD KEY `idx_grn_items_po_item_id` (`purchase_order_item_id`)', 'SELECT 1');
PREPARE st46 FROM @s46; EXECUTE st46; DEALLOCATE PREPARE st46;

SET @k47 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='grn_items' AND INDEX_NAME='idx_grn_items_purchase_order_id');
SET @s47 := IF(@k47=0, 'ALTER TABLE `grn_items` ADD KEY `idx_grn_items_purchase_order_id` (`purchase_order_id`)', 'SELECT 1');
PREPARE st47 FROM @s47; EXECUTE st47; DEALLOCATE PREPARE st47;

SET @k48 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='held_orders' AND INDEX_NAME='PRIMARY');
SET @s48 := IF(@k48=0, 'ALTER TABLE `held_orders` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st48 FROM @s48; EXECUTE st48; DEALLOCATE PREPARE st48;

SET @k49 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='held_orders' AND INDEX_NAME='tenant_id');
SET @s49 := IF(@k49=0, 'ALTER TABLE `held_orders` ADD KEY `tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st49 FROM @s49; EXECUTE st49; DEALLOCATE PREPARE st49;

SET @k50 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='held_orders' AND INDEX_NAME='store_id');
SET @s50 := IF(@k50=0, 'ALTER TABLE `held_orders` ADD KEY `store_id` (`store_id`)', 'SELECT 1');
PREPARE st50 FROM @s50; EXECUTE st50; DEALLOCATE PREPARE st50;

SET @k51 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='held_orders' AND INDEX_NAME='cashier_id');
SET @s51 := IF(@k51=0, 'ALTER TABLE `held_orders` ADD KEY `cashier_id` (`cashier_id`)', 'SELECT 1');
PREPARE st51 FROM @s51; EXECUTE st51; DEALLOCATE PREPARE st51;

SET @k52 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventory_logs' AND INDEX_NAME='PRIMARY');
SET @s52 := IF(@k52=0, 'ALTER TABLE `inventory_logs` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st52 FROM @s52; EXECUTE st52; DEALLOCATE PREPARE st52;

SET @k53 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventory_logs' AND INDEX_NAME='tenant_id');
SET @s53 := IF(@k53=0, 'ALTER TABLE `inventory_logs` ADD KEY `tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st53 FROM @s53; EXECUTE st53; DEALLOCATE PREPARE st53;

SET @k54 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventory_logs' AND INDEX_NAME='product_id');
SET @s54 := IF(@k54=0, 'ALTER TABLE `inventory_logs` ADD KEY `product_id` (`product_id`)', 'SELECT 1');
PREPARE st54 FROM @s54; EXECUTE st54; DEALLOCATE PREPARE st54;

SET @k55 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='inventory_logs' AND INDEX_NAME='created_by');
SET @s55 := IF(@k55=0, 'ALTER TABLE `inventory_logs` ADD KEY `created_by` (`created_by`)', 'SELECT 1');
PREPARE st55 FROM @s55; EXECUTE st55; DEALLOCATE PREPARE st55;

SET @k56 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offer_price_tiers' AND INDEX_NAME='PRIMARY');
SET @s56 := IF(@k56=0, 'ALTER TABLE `offer_price_tiers` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st56 FROM @s56; EXECUTE st56; DEALLOCATE PREPARE st56;

SET @k57 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offer_price_tiers' AND INDEX_NAME='idx_offer_price_tiers_tenant_store');
SET @s57 := IF(@k57=0, 'ALTER TABLE `offer_price_tiers` ADD KEY `idx_offer_price_tiers_tenant_store` (`tenant_id`,`store_id`)', 'SELECT 1');
PREPARE st57 FROM @s57; EXECUTE st57; DEALLOCATE PREPARE st57;

SET @k58 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offer_price_tiers' AND INDEX_NAME='idx_offer_price_tiers_offer');
SET @s58 := IF(@k58=0, 'ALTER TABLE `offer_price_tiers` ADD KEY `idx_offer_price_tiers_offer` (`offer_id`)', 'SELECT 1');
PREPARE st58 FROM @s58; EXECUTE st58; DEALLOCATE PREPARE st58;

SET @k59 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offer_rules' AND INDEX_NAME='PRIMARY');
SET @s59 := IF(@k59=0, 'ALTER TABLE `offer_rules` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st59 FROM @s59; EXECUTE st59; DEALLOCATE PREPARE st59;

SET @k60 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offer_rules' AND INDEX_NAME='tenant_id');
SET @s60 := IF(@k60=0, 'ALTER TABLE `offer_rules` ADD KEY `tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st60 FROM @s60; EXECUTE st60; DEALLOCATE PREPARE st60;

SET @k61 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offer_rules' AND INDEX_NAME='idx_offer_rule');
SET @s61 := IF(@k61=0, 'ALTER TABLE `offer_rules` ADD KEY `idx_offer_rule` (`offer_id`,`rule_type`)', 'SELECT 1');
PREPARE st61 FROM @s61; EXECUTE st61; DEALLOCATE PREPARE st61;

SET @k62 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offer_rules' AND INDEX_NAME='idx_offer_rule_store');
SET @s62 := IF(@k62=0, 'ALTER TABLE `offer_rules` ADD KEY `idx_offer_rule_store` (`store_id`)', 'SELECT 1');
PREPARE st62 FROM @s62; EXECUTE st62; DEALLOCATE PREPARE st62;

SET @k63 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offer_usage' AND INDEX_NAME='PRIMARY');
SET @s63 := IF(@k63=0, 'ALTER TABLE `offer_usage` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st63 FROM @s63; EXECUTE st63; DEALLOCATE PREPARE st63;

SET @k64 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offer_usage' AND INDEX_NAME='customer_id');
SET @s64 := IF(@k64=0, 'ALTER TABLE `offer_usage` ADD KEY `customer_id` (`customer_id`)', 'SELECT 1');
PREPARE st64 FROM @s64; EXECUTE st64; DEALLOCATE PREPARE st64;

SET @k65 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offer_usage' AND INDEX_NAME='tenant_id');
SET @s65 := IF(@k65=0, 'ALTER TABLE `offer_usage` ADD KEY `tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st65 FROM @s65; EXECUTE st65; DEALLOCATE PREPARE st65;

SET @k66 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offer_usage' AND INDEX_NAME='idx_offer_customer');
SET @s66 := IF(@k66=0, 'ALTER TABLE `offer_usage` ADD KEY `idx_offer_customer` (`offer_id`,`customer_id`)', 'SELECT 1');
PREPARE st66 FROM @s66; EXECUTE st66; DEALLOCATE PREPARE st66;

SET @k67 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='offer_usage' AND INDEX_NAME='idx_offer_usage_store');
SET @s67 := IF(@k67=0, 'ALTER TABLE `offer_usage` ADD KEY `idx_offer_usage_store` (`store_id`)', 'SELECT 1');
PREPARE st67 FROM @s67; EXECUTE st67; DEALLOCATE PREPARE st67;

SET @k68 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_gateways' AND INDEX_NAME='PRIMARY');
SET @s68 := IF(@k68=0, 'ALTER TABLE `payment_gateways` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st68 FROM @s68; EXECUTE st68; DEALLOCATE PREPARE st68;

SET @k69 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_gateways' AND INDEX_NAME='unique_tenant_gateway');
SET @s69 := IF(@k69=0, 'ALTER TABLE `payment_gateways` ADD UNIQUE KEY `unique_tenant_gateway` (`tenant_id`,`gateway_type`)', 'SELECT 1');
PREPARE st69 FROM @s69; EXECUTE st69; DEALLOCATE PREPARE st69;

SET @k70 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_gateways' AND INDEX_NAME='idx_tenant_gateways');
SET @s70 := IF(@k70=0, 'ALTER TABLE `payment_gateways` ADD KEY `idx_tenant_gateways` (`tenant_id`,`is_active`)', 'SELECT 1');
PREPARE st70 FROM @s70; EXECUTE st70; DEALLOCATE PREPARE st70;

SET @k71 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_gateway_transactions' AND INDEX_NAME='PRIMARY');
SET @s71 := IF(@k71=0, 'ALTER TABLE `payment_gateway_transactions` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st71 FROM @s71; EXECUTE st71; DEALLOCATE PREPARE st71;

SET @k72 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_gateway_transactions' AND INDEX_NAME='idx_sale_gateway');
SET @s72 := IF(@k72=0, 'ALTER TABLE `payment_gateway_transactions` ADD KEY `idx_sale_gateway` (`sale_id`)', 'SELECT 1');
PREPARE st72 FROM @s72; EXECUTE st72; DEALLOCATE PREPARE st72;

SET @k73 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_gateway_transactions' AND INDEX_NAME='idx_gateway_status');
SET @s73 := IF(@k73=0, 'ALTER TABLE `payment_gateway_transactions` ADD KEY `idx_gateway_status` (`gateway_id`,`status`)', 'SELECT 1');
PREPARE st73 FROM @s73; EXECUTE st73; DEALLOCATE PREPARE st73;

SET @k74 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_gateway_transactions' AND INDEX_NAME='idx_gateway_transaction');
SET @s74 := IF(@k74=0, 'ALTER TABLE `payment_gateway_transactions` ADD KEY `idx_gateway_transaction` (`gateway_transaction_id`)', 'SELECT 1');
PREPARE st74 FROM @s74; EXECUTE st74; DEALLOCATE PREPARE st74;

SET @k75 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_gateway_transactions' AND INDEX_NAME='idx_payment_intent');
SET @s75 := IF(@k75=0, 'ALTER TABLE `payment_gateway_transactions` ADD KEY `idx_payment_intent` (`payment_intent_id`)', 'SELECT 1');
PREPARE st75 FROM @s75; EXECUTE st75; DEALLOCATE PREPARE st75;

SET @k76 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_methods' AND INDEX_NAME='PRIMARY');
SET @s76 := IF(@k76=0, 'ALTER TABLE `payment_methods` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st76 FROM @s76; EXECUTE st76; DEALLOCATE PREPARE st76;

SET @k77 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_methods' AND INDEX_NAME='unique_tenant_payment_code');
SET @s77 := IF(@k77=0, 'ALTER TABLE `payment_methods` ADD UNIQUE KEY `unique_tenant_payment_code` (`tenant_id`,`code`)', 'SELECT 1');
PREPARE st77 FROM @s77; EXECUTE st77; DEALLOCATE PREPARE st77;

SET @k78 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_methods' AND INDEX_NAME='idx_tenant');
SET @s78 := IF(@k78=0, 'ALTER TABLE `payment_methods` ADD KEY `idx_tenant` (`tenant_id`)', 'SELECT 1');
PREPARE st78 FROM @s78; EXECUTE st78; DEALLOCATE PREPARE st78;

SET @k79 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_terminals' AND INDEX_NAME='PRIMARY');
SET @s79 := IF(@k79=0, 'ALTER TABLE `payment_terminals` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st79 FROM @s79; EXECUTE st79; DEALLOCATE PREPARE st79;

SET @k80 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_terminals' AND INDEX_NAME='idx_tenant');
SET @s80 := IF(@k80=0, 'ALTER TABLE `payment_terminals` ADD KEY `idx_tenant` (`tenant_id`)', 'SELECT 1');
PREPARE st80 FROM @s80; EXECUTE st80; DEALLOCATE PREPARE st80;

SET @k81 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_terminals' AND INDEX_NAME='idx_terminal_type');
SET @s81 := IF(@k81=0, 'ALTER TABLE `payment_terminals` ADD KEY `idx_terminal_type` (`type`)', 'SELECT 1');
PREPARE st81 FROM @s81; EXECUTE st81; DEALLOCATE PREPARE st81;

SET @k82 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions' AND INDEX_NAME='PRIMARY');
SET @s82 := IF(@k82=0, 'ALTER TABLE `payment_transactions` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st82 FROM @s82; EXECUTE st82; DEALLOCATE PREPARE st82;

SET @k83 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions' AND INDEX_NAME='idx_sale');
SET @s83 := IF(@k83=0, 'ALTER TABLE `payment_transactions` ADD KEY `idx_sale` (`sale_id`)', 'SELECT 1');
PREPARE st83 FROM @s83; EXECUTE st83; DEALLOCATE PREPARE st83;

SET @k84 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions' AND INDEX_NAME='idx_payment_method');
SET @s84 := IF(@k84=0, 'ALTER TABLE `payment_transactions` ADD KEY `idx_payment_method` (`payment_method_id`)', 'SELECT 1');
PREPARE st84 FROM @s84; EXECUTE st84; DEALLOCATE PREPARE st84;

SET @k85 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions' AND INDEX_NAME='idx_terminal');
SET @s85 := IF(@k85=0, 'ALTER TABLE `payment_transactions` ADD KEY `idx_terminal` (`terminal_id`)', 'SELECT 1');
PREPARE st85 FROM @s85; EXECUTE st85; DEALLOCATE PREPARE st85;

SET @k86 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions' AND INDEX_NAME='idx_tenant');
SET @s86 := IF(@k86=0, 'ALTER TABLE `payment_transactions` ADD KEY `idx_tenant` (`tenant_id`)', 'SELECT 1');
PREPARE st86 FROM @s86; EXECUTE st86; DEALLOCATE PREPARE st86;

SET @k87 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions' AND INDEX_NAME='idx_transaction');
SET @s87 := IF(@k87=0, 'ALTER TABLE `payment_transactions` ADD KEY `idx_transaction` (`transaction_id`)', 'SELECT 1');
PREPARE st87 FROM @s87; EXECUTE st87; DEALLOCATE PREPARE st87;

SET @k88 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions' AND INDEX_NAME='idx_reference');
SET @s88 := IF(@k88=0, 'ALTER TABLE `payment_transactions` ADD KEY `idx_reference` (`reference_id`)', 'SELECT 1');
PREPARE st88 FROM @s88; EXECUTE st88; DEALLOCATE PREPARE st88;

SET @k89 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_transactions' AND INDEX_NAME='idx_created');
SET @s89 := IF(@k89=0, 'ALTER TABLE `payment_transactions` ADD KEY `idx_created` (`created_at`)', 'SELECT 1');
PREPARE st89 FROM @s89; EXECUTE st89; DEALLOCATE PREPARE st89;

SET @k90 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='permissions' AND INDEX_NAME='PRIMARY');
SET @s90 := IF(@k90=0, 'ALTER TABLE `permissions` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st90 FROM @s90; EXECUTE st90; DEALLOCATE PREPARE st90;

SET @k91 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='permissions' AND INDEX_NAME='uk_permissions_name');
SET @s91 := IF(@k91=0, 'ALTER TABLE `permissions` ADD UNIQUE KEY `uk_permissions_name` (`name`)', 'SELECT 1');
PREPARE st91 FROM @s91; EXECUTE st91; DEALLOCATE PREPARE st91;

SET @k92 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='plans' AND INDEX_NAME='PRIMARY');
SET @s92 := IF(@k92=0, 'ALTER TABLE `plans` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st92 FROM @s92; EXECUTE st92; DEALLOCATE PREPARE st92;

SET @k93 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='printer_settings' AND INDEX_NAME='PRIMARY');
SET @s93 := IF(@k93=0, 'ALTER TABLE `printer_settings` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st93 FROM @s93; EXECUTE st93; DEALLOCATE PREPARE st93;

SET @k94 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='printer_settings' AND INDEX_NAME='tenant_id');
SET @s94 := IF(@k94=0, 'ALTER TABLE `printer_settings` ADD KEY `tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st94 FROM @s94; EXECUTE st94; DEALLOCATE PREPARE st94;

SET @k95 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='printer_settings' AND INDEX_NAME='store_id');
SET @s95 := IF(@k95=0, 'ALTER TABLE `printer_settings` ADD KEY `store_id` (`store_id`)', 'SELECT 1');
PREPARE st95 FROM @s95; EXECUTE st95; DEALLOCATE PREPARE st95;

SET @k96 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='printer_settings' AND INDEX_NAME='template_id');
SET @s96 := IF(@k96=0, 'ALTER TABLE `printer_settings` ADD KEY `template_id` (`template_id`)', 'SELECT 1');
PREPARE st96 FROM @s96; EXECUTE st96; DEALLOCATE PREPARE st96;

SET @k97 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='PRIMARY');
SET @s97 := IF(@k97=0, 'ALTER TABLE `products` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st97 FROM @s97; EXECUTE st97; DEALLOCATE PREPARE st97;

SET @k98 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='unique_sku_per_tenant');
SET @s98 := IF(@k98=0, 'ALTER TABLE `products` ADD UNIQUE KEY `unique_sku_per_tenant` (`tenant_id`,`sku`)', 'SELECT 1');
PREPARE st98 FROM @s98; EXECUTE st98; DEALLOCATE PREPARE st98;

SET @k99 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='unique_barcode_per_tenant');
SET @s99 := IF(@k99=0, 'ALTER TABLE `products` ADD UNIQUE KEY `unique_barcode_per_tenant` (`tenant_id`,`barcode`)', 'SELECT 1');
PREPARE st99 FROM @s99; EXECUTE st99; DEALLOCATE PREPARE st99;

SET @k100 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='idx_products_tenant');
SET @s100 := IF(@k100=0, 'ALTER TABLE `products` ADD KEY `idx_products_tenant` (`tenant_id`)', 'SELECT 1');
PREPARE st100 FROM @s100; EXECUTE st100; DEALLOCATE PREPARE st100;

SET @k101 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='fk_products_tax_class');
SET @s101 := IF(@k101=0, 'ALTER TABLE `products` ADD KEY `fk_products_tax_class` (`tax_class_id`)', 'SELECT 1');
PREPARE st101 FROM @s101; EXECUTE st101; DEALLOCATE PREPARE st101;

SET @k102 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='idx_products_store');
SET @s102 := IF(@k102=0, 'ALTER TABLE `products` ADD KEY `idx_products_store` (`store_id`)', 'SELECT 1');
PREPARE st102 FROM @s102; EXECUTE st102; DEALLOCATE PREPARE st102;

SET @k103 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='products' AND INDEX_NAME='idx_products_promotional_offer_id');
SET @s103 := IF(@k103=0, 'ALTER TABLE `products` ADD KEY `idx_products_promotional_offer_id` (`promotional_offer_id`)', 'SELECT 1');
PREPARE st103 FROM @s103; EXECUTE st103; DEALLOCATE PREPARE st103;

SET @k104 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='promotional_offers' AND INDEX_NAME='PRIMARY');
SET @s104 := IF(@k104=0, 'ALTER TABLE `promotional_offers` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st104 FROM @s104; EXECUTE st104; DEALLOCATE PREPARE st104;

SET @k105 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='promotional_offers' AND INDEX_NAME='store_id');
SET @s105 := IF(@k105=0, 'ALTER TABLE `promotional_offers` ADD KEY `store_id` (`store_id`)', 'SELECT 1');
PREPARE st105 FROM @s105; EXECUTE st105; DEALLOCATE PREPARE st105;

SET @k106 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='promotional_offers' AND INDEX_NAME='idx_tenant_store_active');
SET @s106 := IF(@k106=0, 'ALTER TABLE `promotional_offers` ADD KEY `idx_tenant_store_active` (`tenant_id`,`store_id`,`is_active`)', 'SELECT 1');
PREPARE st106 FROM @s106; EXECUTE st106; DEALLOCATE PREPARE st106;

SET @k107 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='promotional_offers' AND INDEX_NAME='idx_dates');
SET @s107 := IF(@k107=0, 'ALTER TABLE `promotional_offers` ADD KEY `idx_dates` (`start_date`,`end_date`)', 'SELECT 1');
PREPARE st107 FROM @s107; EXECUTE st107; DEALLOCATE PREPARE st107;

SET @k108 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND INDEX_NAME='PRIMARY');
SET @s108 := IF(@k108=0, 'ALTER TABLE `purchase_orders` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st108 FROM @s108; EXECUTE st108; DEALLOCATE PREPARE st108;

SET @k109 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND INDEX_NAME='idx_po_tenant_id');
SET @s109 := IF(@k109=0, 'ALTER TABLE `purchase_orders` ADD KEY `idx_po_tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st109 FROM @s109; EXECUTE st109; DEALLOCATE PREPARE st109;

SET @k110 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND INDEX_NAME='idx_po_supplier_id');
SET @s110 := IF(@k110=0, 'ALTER TABLE `purchase_orders` ADD KEY `idx_po_supplier_id` (`supplier_id`)', 'SELECT 1');
PREPARE st110 FROM @s110; EXECUTE st110; DEALLOCATE PREPARE st110;

SET @k111 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND INDEX_NAME='idx_po_store_id');
SET @s111 := IF(@k111=0, 'ALTER TABLE `purchase_orders` ADD KEY `idx_po_store_id` (`store_id`)', 'SELECT 1');
PREPARE st111 FROM @s111; EXECUTE st111; DEALLOCATE PREPARE st111;

SET @k112 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND INDEX_NAME='fk_po_created_by');
SET @s112 := IF(@k112=0, 'ALTER TABLE `purchase_orders` ADD KEY `fk_po_created_by` (`created_by_user_id`)', 'SELECT 1');
PREPARE st112 FROM @s112; EXECUTE st112; DEALLOCATE PREPARE st112;

SET @k113 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND INDEX_NAME='fk_po_updated_by');
SET @s113 := IF(@k113=0, 'ALTER TABLE `purchase_orders` ADD KEY `fk_po_updated_by` (`updated_by_user_id`)', 'SELECT 1');
PREPARE st113 FROM @s113; EXECUTE st113; DEALLOCATE PREPARE st113;

SET @k114 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND INDEX_NAME='idx_po_status');
SET @s114 := IF(@k114=0, 'ALTER TABLE `purchase_orders` ADD KEY `idx_po_status` (`status`)', 'SELECT 1');
PREPARE st114 FROM @s114; EXECUTE st114; DEALLOCATE PREPARE st114;

SET @k115 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_order_items' AND INDEX_NAME='PRIMARY');
SET @s115 := IF(@k115=0, 'ALTER TABLE `purchase_order_items` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st115 FROM @s115; EXECUTE st115; DEALLOCATE PREPARE st115;

SET @k116 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_order_items' AND INDEX_NAME='idx_poi_purchase_order_id');
SET @s116 := IF(@k116=0, 'ALTER TABLE `purchase_order_items` ADD KEY `idx_poi_purchase_order_id` (`purchase_order_id`)', 'SELECT 1');
PREPARE st116 FROM @s116; EXECUTE st116; DEALLOCATE PREPARE st116;

SET @k117 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_order_items' AND INDEX_NAME='idx_poi_product_id');
SET @s117 := IF(@k117=0, 'ALTER TABLE `purchase_order_items` ADD KEY `idx_poi_product_id` (`product_id`)', 'SELECT 1');
PREPARE st117 FROM @s117; EXECUTE st117; DEALLOCATE PREPARE st117;

SET @k118 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='purchase_order_items' AND INDEX_NAME='idx_poi_status');
SET @s118 := IF(@k118=0, 'ALTER TABLE `purchase_order_items` ADD KEY `idx_poi_status` (`status`)', 'SELECT 1');
PREPARE st118 FROM @s118; EXECUTE st118; DEALLOCATE PREPARE st118;

SET @k119 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='receipt_templates' AND INDEX_NAME='PRIMARY');
SET @s119 := IF(@k119=0, 'ALTER TABLE `receipt_templates` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st119 FROM @s119; EXECUTE st119; DEALLOCATE PREPARE st119;

SET @k120 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='receipt_templates' AND INDEX_NAME='tenant_id');
SET @s120 := IF(@k120=0, 'ALTER TABLE `receipt_templates` ADD KEY `tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st120 FROM @s120; EXECUTE st120; DEALLOCATE PREPARE st120;

SET @k121 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='return_number_sequences' AND INDEX_NAME='PRIMARY');
SET @s121 := IF(@k121=0, 'ALTER TABLE `return_number_sequences` ADD PRIMARY KEY (`tenant_id`)', 'SELECT 1');
PREPARE st121 FROM @s121; EXECUTE st121; DEALLOCATE PREPARE st121;

SET @k122 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='roles' AND INDEX_NAME='PRIMARY');
SET @s122 := IF(@k122=0, 'ALTER TABLE `roles` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st122 FROM @s122; EXECUTE st122; DEALLOCATE PREPARE st122;

SET @k123 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='roles' AND INDEX_NAME='fk_roles_created_by');
SET @s123 := IF(@k123=0, 'ALTER TABLE `roles` ADD KEY `fk_roles_created_by` (`created_by`)', 'SELECT 1');
PREPARE st123 FROM @s123; EXECUTE st123; DEALLOCATE PREPARE st123;

SET @k124 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='role_permissions' AND INDEX_NAME='PRIMARY');
SET @s124 := IF(@k124=0, 'ALTER TABLE `role_permissions` ADD PRIMARY KEY (`role_id`,`permission_id`)', 'SELECT 1');
PREPARE st124 FROM @s124; EXECUTE st124; DEALLOCATE PREPARE st124;

SET @k125 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='role_permissions' AND INDEX_NAME='idx_rp_permission');
SET @s125 := IF(@k125=0, 'ALTER TABLE `role_permissions` ADD KEY `idx_rp_permission` (`permission_id`)', 'SELECT 1');
PREPARE st125 FROM @s125; EXECUTE st125; DEALLOCATE PREPARE st125;

SET @k126 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND INDEX_NAME='PRIMARY');
SET @s126 := IF(@k126=0, 'ALTER TABLE `sales` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st126 FROM @s126; EXECUTE st126; DEALLOCATE PREPARE st126;

SET @k127 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND INDEX_NAME='idx_sales_tenant');
SET @s127 := IF(@k127=0, 'ALTER TABLE `sales` ADD KEY `idx_sales_tenant` (`tenant_id`)', 'SELECT 1');
PREPARE st127 FROM @s127; EXECUTE st127; DEALLOCATE PREPARE st127;

SET @k128 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND INDEX_NAME='idx_sales_store');
SET @s128 := IF(@k128=0, 'ALTER TABLE `sales` ADD KEY `idx_sales_store` (`store_id`)', 'SELECT 1');
PREPARE st128 FROM @s128; EXECUTE st128; DEALLOCATE PREPARE st128;

SET @k129 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND INDEX_NAME='idx_sales_payment_status');
SET @s129 := IF(@k129=0, 'ALTER TABLE `sales` ADD KEY `idx_sales_payment_status` (`payment_status`)', 'SELECT 1');
PREPARE st129 FROM @s129; EXECUTE st129; DEALLOCATE PREPARE st129;

SET @k130 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND INDEX_NAME='PRIMARY');
SET @s130 := IF(@k130=0, 'ALTER TABLE `sales_returns` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st130 FROM @s130; EXECUTE st130; DEALLOCATE PREPARE st130;

SET @k131 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND INDEX_NAME='uniq_tenant_return');
SET @s131 := IF(@k131=0, 'ALTER TABLE `sales_returns` ADD UNIQUE KEY `uniq_tenant_return` (`tenant_id`,`return_number`)', 'SELECT 1');
PREPARE st131 FROM @s131; EXECUTE st131; DEALLOCATE PREPARE st131;

SET @k132 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND INDEX_NAME='customer_id');
SET @s132 := IF(@k132=0, 'ALTER TABLE `sales_returns` ADD KEY `customer_id` (`customer_id`)', 'SELECT 1');
PREPARE st132 FROM @s132; EXECUTE st132; DEALLOCATE PREPARE st132;

SET @k133 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND INDEX_NAME='store_id');
SET @s133 := IF(@k133=0, 'ALTER TABLE `sales_returns` ADD KEY `store_id` (`store_id`)', 'SELECT 1');
PREPARE st133 FROM @s133; EXECUTE st133; DEALLOCATE PREPARE st133;

SET @k134 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND INDEX_NAME='processed_by_user_id');
SET @s134 := IF(@k134=0, 'ALTER TABLE `sales_returns` ADD KEY `processed_by_user_id` (`processed_by_user_id`)', 'SELECT 1');
PREPARE st134 FROM @s134; EXECUTE st134; DEALLOCATE PREPARE st134;

SET @k135 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND INDEX_NAME='idx_return_number');
SET @s135 := IF(@k135=0, 'ALTER TABLE `sales_returns` ADD KEY `idx_return_number` (`return_number`)', 'SELECT 1');
PREPARE st135 FROM @s135; EXECUTE st135; DEALLOCATE PREPARE st135;

SET @k136 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND INDEX_NAME='idx_original_sale');
SET @s136 := IF(@k136=0, 'ALTER TABLE `sales_returns` ADD KEY `idx_original_sale` (`original_sale_id`)', 'SELECT 1');
PREPARE st136 FROM @s136; EXECUTE st136; DEALLOCATE PREPARE st136;

SET @k137 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND INDEX_NAME='idx_tenant_store');
SET @s137 := IF(@k137=0, 'ALTER TABLE `sales_returns` ADD KEY `idx_tenant_store` (`tenant_id`,`store_id`)', 'SELECT 1');
PREPARE st137 FROM @s137; EXECUTE st137; DEALLOCATE PREPARE st137;

SET @k138 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND INDEX_NAME='idx_return_date');
SET @s138 := IF(@k138=0, 'ALTER TABLE `sales_returns` ADD KEY `idx_return_date` (`return_date`)', 'SELECT 1');
PREPARE st138 FROM @s138; EXECUTE st138; DEALLOCATE PREPARE st138;

SET @k139 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_return_items' AND INDEX_NAME='PRIMARY');
SET @s139 := IF(@k139=0, 'ALTER TABLE `sales_return_items` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st139 FROM @s139; EXECUTE st139; DEALLOCATE PREPARE st139;

SET @k140 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_return_items' AND INDEX_NAME='original_sale_item_id');
SET @s140 := IF(@k140=0, 'ALTER TABLE `sales_return_items` ADD KEY `original_sale_item_id` (`original_sale_item_id`)', 'SELECT 1');
PREPARE st140 FROM @s140; EXECUTE st140; DEALLOCATE PREPARE st140;

SET @k141 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_return_items' AND INDEX_NAME='idx_return_id');
SET @s141 := IF(@k141=0, 'ALTER TABLE `sales_return_items` ADD KEY `idx_return_id` (`sales_return_id`)', 'SELECT 1');
PREPARE st141 FROM @s141; EXECUTE st141; DEALLOCATE PREPARE st141;

SET @k142 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sales_return_items' AND INDEX_NAME='idx_product');
SET @s142 := IF(@k142=0, 'ALTER TABLE `sales_return_items` ADD KEY `idx_product` (`product_id`)', 'SELECT 1');
PREPARE st142 FROM @s142; EXECUTE st142; DEALLOCATE PREPARE st142;

SET @k143 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_applied_offers' AND INDEX_NAME='PRIMARY');
SET @s143 := IF(@k143=0, 'ALTER TABLE `sale_applied_offers` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st143 FROM @s143; EXECUTE st143; DEALLOCATE PREPARE st143;

SET @k144 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_applied_offers' AND INDEX_NAME='idx_sale_applied_offers_sale');
SET @s144 := IF(@k144=0, 'ALTER TABLE `sale_applied_offers` ADD KEY `idx_sale_applied_offers_sale` (`sale_id`)', 'SELECT 1');
PREPARE st144 FROM @s144; EXECUTE st144; DEALLOCATE PREPARE st144;

SET @k145 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_applied_offers' AND INDEX_NAME='idx_sale_applied_offers_tenant_store');
SET @s145 := IF(@k145=0, 'ALTER TABLE `sale_applied_offers` ADD KEY `idx_sale_applied_offers_tenant_store` (`tenant_id`,`store_id`)', 'SELECT 1');
PREPARE st145 FROM @s145; EXECUTE st145; DEALLOCATE PREPARE st145;

SET @k146 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_items' AND INDEX_NAME='PRIMARY');
SET @s146 := IF(@k146=0, 'ALTER TABLE `sale_items` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st146 FROM @s146; EXECUTE st146; DEALLOCATE PREPARE st146;

SET @k147 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_items' AND INDEX_NAME='idx_sale_items_sale');
SET @s147 := IF(@k147=0, 'ALTER TABLE `sale_items` ADD KEY `idx_sale_items_sale` (`sale_id`)', 'SELECT 1');
PREPARE st147 FROM @s147; EXECUTE st147; DEALLOCATE PREPARE st147;

SET @k148 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_items' AND INDEX_NAME='idx_sale_items_product');
SET @s148 := IF(@k148=0, 'ALTER TABLE `sale_items` ADD KEY `idx_sale_items_product` (`product_id`)', 'SELECT 1');
PREPARE st148 FROM @s148; EXECUTE st148; DEALLOCATE PREPARE st148;

SET @k149 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_item_discounts' AND INDEX_NAME='PRIMARY');
SET @s149 := IF(@k149=0, 'ALTER TABLE `sale_item_discounts` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st149 FROM @s149; EXECUTE st149; DEALLOCATE PREPARE st149;

SET @k150 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_item_discounts' AND INDEX_NAME='idx_sale_item_discounts_sale_item');
SET @s150 := IF(@k150=0, 'ALTER TABLE `sale_item_discounts` ADD KEY `idx_sale_item_discounts_sale_item` (`sale_item_id`)', 'SELECT 1');
PREPARE st150 FROM @s150; EXECUTE st150; DEALLOCATE PREPARE st150;

SET @k151 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_item_discounts' AND INDEX_NAME='idx_sale_item_discounts_sale');
SET @s151 := IF(@k151=0, 'ALTER TABLE `sale_item_discounts` ADD KEY `idx_sale_item_discounts_sale` (`sale_id`)', 'SELECT 1');
PREPARE st151 FROM @s151; EXECUTE st151; DEALLOCATE PREPARE st151;

SET @k152 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sale_item_discounts' AND INDEX_NAME='idx_sale_item_discounts_tenant_store');
SET @s152 := IF(@k152=0, 'ALTER TABLE `sale_item_discounts` ADD KEY `idx_sale_item_discounts_tenant_store` (`tenant_id`,`store_id`)', 'SELECT 1');
PREPARE st152 FROM @s152; EXECUTE st152; DEALLOCATE PREPARE st152;

SET @k153 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stock_adjustments' AND INDEX_NAME='PRIMARY');
SET @s153 := IF(@k153=0, 'ALTER TABLE `stock_adjustments` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st153 FROM @s153; EXECUTE st153; DEALLOCATE PREPARE st153;

SET @k154 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stock_adjustments' AND INDEX_NAME='idx_sa_product_id');
SET @s154 := IF(@k154=0, 'ALTER TABLE `stock_adjustments` ADD KEY `idx_sa_product_id` (`product_id`)', 'SELECT 1');
PREPARE st154 FROM @s154; EXECUTE st154; DEALLOCATE PREPARE st154;

SET @k155 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stock_adjustments' AND INDEX_NAME='idx_sa_variant_id');
SET @s155 := IF(@k155=0, 'ALTER TABLE `stock_adjustments` ADD KEY `idx_sa_variant_id` (`variant_id`)', 'SELECT 1');
PREPARE st155 FROM @s155; EXECUTE st155; DEALLOCATE PREPARE st155;

SET @k156 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stock_adjustments' AND INDEX_NAME='idx_sa_user_id');
SET @s156 := IF(@k156=0, 'ALTER TABLE `stock_adjustments` ADD KEY `idx_sa_user_id` (`user_id`)', 'SELECT 1');
PREPARE st156 FROM @s156; EXECUTE st156; DEALLOCATE PREPARE st156;

SET @k157 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stock_adjustments' AND INDEX_NAME='idx_sa_reason_code');
SET @s157 := IF(@k157=0, 'ALTER TABLE `stock_adjustments` ADD KEY `idx_sa_reason_code` (`reason_code`)', 'SELECT 1');
PREPARE st157 FROM @s157; EXECUTE st157; DEALLOCATE PREPARE st157;

SET @k158 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stock_adjustments' AND INDEX_NAME='idx_sa_adjustment_date');
SET @s158 := IF(@k158=0, 'ALTER TABLE `stock_adjustments` ADD KEY `idx_sa_adjustment_date` (`adjustment_date`)', 'SELECT 1');
PREPARE st158 FROM @s158; EXECUTE st158; DEALLOCATE PREPARE st158;

SET @k159 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stores' AND INDEX_NAME='PRIMARY');
SET @s159 := IF(@k159=0, 'ALTER TABLE `stores` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st159 FROM @s159; EXECUTE st159; DEALLOCATE PREPARE st159;

SET @k160 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stores' AND INDEX_NAME='tenant_id');
SET @s160 := IF(@k160=0, 'ALTER TABLE `stores` ADD KEY `tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st160 FROM @s160; EXECUTE st160; DEALLOCATE PREPARE st160;

SET @k161 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stores' AND INDEX_NAME='fk_stores_default_tax_class');
SET @s161 := IF(@k161=0, 'ALTER TABLE `stores` ADD KEY `fk_stores_default_tax_class` (`default_tax_class_id`)', 'SELECT 1');
PREPARE st161 FROM @s161; EXECUTE st161; DEALLOCATE PREPARE st161;

SET @k162 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stores' AND INDEX_NAME='idx_stores_is_active');
SET @s162 := IF(@k162=0, 'ALTER TABLE `stores` ADD KEY `idx_stores_is_active` (`is_active`)', 'SELECT 1');
PREPARE st162 FROM @s162; EXECUTE st162; DEALLOCATE PREPARE st162;

SET @k163 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='subscriptions' AND INDEX_NAME='PRIMARY');
SET @s163 := IF(@k163=0, 'ALTER TABLE `subscriptions` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st163 FROM @s163; EXECUTE st163; DEALLOCATE PREPARE st163;

SET @k164 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='subscriptions' AND INDEX_NAME='idx_sub_tenant');
SET @s164 := IF(@k164=0, 'ALTER TABLE `subscriptions` ADD KEY `idx_sub_tenant` (`tenant_id`)', 'SELECT 1');
PREPARE st164 FROM @s164; EXECUTE st164; DEALLOCATE PREPARE st164;

SET @k165 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='subscriptions' AND INDEX_NAME='idx_sub_plan');
SET @s165 := IF(@k165=0, 'ALTER TABLE `subscriptions` ADD KEY `idx_sub_plan` (`plan_id`)', 'SELECT 1');
PREPARE st165 FROM @s165; EXECUTE st165; DEALLOCATE PREPARE st165;

SET @k166 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='subscriptions' AND INDEX_NAME='idx_sub_status');
SET @s166 := IF(@k166=0, 'ALTER TABLE `subscriptions` ADD KEY `idx_sub_status` (`status`)', 'SELECT 1');
PREPARE st166 FROM @s166; EXECUTE st166; DEALLOCATE PREPARE st166;

SET @k167 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='subscription_plans' AND INDEX_NAME='PRIMARY');
SET @s167 := IF(@k167=0, 'ALTER TABLE `subscription_plans` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st167 FROM @s167; EXECUTE st167; DEALLOCATE PREPARE st167;

SET @k168 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='suppliers' AND INDEX_NAME='PRIMARY');
SET @s168 := IF(@k168=0, 'ALTER TABLE `suppliers` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st168 FROM @s168; EXECUTE st168; DEALLOCATE PREPARE st168;

SET @k169 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='suppliers' AND INDEX_NAME='fk_suppliers_created_by');
SET @s169 := IF(@k169=0, 'ALTER TABLE `suppliers` ADD KEY `fk_suppliers_created_by` (`created_by_user_id`)', 'SELECT 1');
PREPARE st169 FROM @s169; EXECUTE st169; DEALLOCATE PREPARE st169;

SET @k170 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='suppliers' AND INDEX_NAME='fk_suppliers_updated_by');
SET @s170 := IF(@k170=0, 'ALTER TABLE `suppliers` ADD KEY `fk_suppliers_updated_by` (`updated_by_user_id`)', 'SELECT 1');
PREPARE st170 FROM @s170; EXECUTE st170; DEALLOCATE PREPARE st170;

SET @k171 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='suppliers' AND INDEX_NAME='idx_suppliers_tenant_id');
SET @s171 := IF(@k171=0, 'ALTER TABLE `suppliers` ADD KEY `idx_suppliers_tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st171 FROM @s171; EXECUTE st171; DEALLOCATE PREPARE st171;

SET @k172 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='suppliers' AND INDEX_NAME='idx_suppliers_tenant_id_supplier_name');
SET @s172 := IF(@k172=0, 'ALTER TABLE `suppliers` ADD KEY `idx_suppliers_tenant_id_supplier_name` (`tenant_id`,`supplier_name`)', 'SELECT 1');
PREPARE st172 FROM @s172; EXECUTE st172; DEALLOCATE PREPARE st172;

SET @k173 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='suppliers' AND INDEX_NAME='idx_suppliers_tenant_id_email');
SET @s173 := IF(@k173=0, 'ALTER TABLE `suppliers` ADD KEY `idx_suppliers_tenant_id_email` (`tenant_id`,`email`)', 'SELECT 1');
PREPARE st173 FROM @s173; EXECUTE st173; DEALLOCATE PREPARE st173;

SET @k174 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='suppliers' AND INDEX_NAME='idx_suppliers_tenant_id_phone');
SET @s174 := IF(@k174=0, 'ALTER TABLE `suppliers` ADD KEY `idx_suppliers_tenant_id_phone` (`tenant_id`,`phone`)', 'SELECT 1');
PREPARE st174 FROM @s174; EXECUTE st174; DEALLOCATE PREPARE st174;

SET @k175 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='suppliers' AND INDEX_NAME='idx_suppliers_is_active');
SET @s175 := IF(@k175=0, 'ALTER TABLE `suppliers` ADD KEY `idx_suppliers_is_active` (`is_active`)', 'SELECT 1');
PREPARE st175 FROM @s175; EXECUTE st175; DEALLOCATE PREPARE st175;

SET @k176 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='system_permissions' AND INDEX_NAME='PRIMARY');
SET @s176 := IF(@k176=0, 'ALTER TABLE `system_permissions` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st176 FROM @s176; EXECUTE st176; DEALLOCATE PREPARE st176;

SET @k177 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='system_permissions' AND INDEX_NAME='uk_system_permissions_name');
SET @s177 := IF(@k177=0, 'ALTER TABLE `system_permissions` ADD UNIQUE KEY `uk_system_permissions_name` (`name`)', 'SELECT 1');
PREPARE st177 FROM @s177; EXECUTE st177; DEALLOCATE PREPARE st177;

SET @k178 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='system_roles' AND INDEX_NAME='PRIMARY');
SET @s178 := IF(@k178=0, 'ALTER TABLE `system_roles` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st178 FROM @s178; EXECUTE st178; DEALLOCATE PREPARE st178;

SET @k179 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='system_role_permissions' AND INDEX_NAME='PRIMARY');
SET @s179 := IF(@k179=0, 'ALTER TABLE `system_role_permissions` ADD PRIMARY KEY (`role_id`,`permission_id`)', 'SELECT 1');
PREPARE st179 FROM @s179; EXECUTE st179; DEALLOCATE PREPARE st179;

SET @k180 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='system_role_permissions' AND INDEX_NAME='idx_srp_permission');
SET @s180 := IF(@k180=0, 'ALTER TABLE `system_role_permissions` ADD KEY `idx_srp_permission` (`permission_id`)', 'SELECT 1');
PREPARE st180 FROM @s180; EXECUTE st180; DEALLOCATE PREPARE st180;

SET @k181 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tax_classes' AND INDEX_NAME='PRIMARY');
SET @s181 := IF(@k181=0, 'ALTER TABLE `tax_classes` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st181 FROM @s181; EXECUTE st181; DEALLOCATE PREPARE st181;

SET @k182 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tax_classes' AND INDEX_NAME='idx_tax_classes_tenant');
SET @s182 := IF(@k182=0, 'ALTER TABLE `tax_classes` ADD KEY `idx_tax_classes_tenant` (`tenant_id`)', 'SELECT 1');
PREPARE st182 FROM @s182; EXECUTE st182; DEALLOCATE PREPARE st182;

SET @k183 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tax_classes' AND INDEX_NAME='idx_store_id');
SET @s183 := IF(@k183=0, 'ALTER TABLE `tax_classes` ADD KEY `idx_store_id` (`store_id`)', 'SELECT 1');
PREPARE st183 FROM @s183; EXECUTE st183; DEALLOCATE PREPARE st183;

SET @k184 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tax_classes' AND INDEX_NAME='idx_tax_classes_store');
SET @s184 := IF(@k184=0, 'ALTER TABLE `tax_classes` ADD KEY `idx_tax_classes_store` (`store_id`)', 'SELECT 1');
PREPARE st184 FROM @s184; EXECUTE st184; DEALLOCATE PREPARE st184;

SET @k185 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tax_class_rates' AND INDEX_NAME='PRIMARY');
SET @s185 := IF(@k185=0, 'ALTER TABLE `tax_class_rates` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st185 FROM @s185; EXECUTE st185; DEALLOCATE PREPARE st185;

SET @k186 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tax_class_rates' AND INDEX_NAME='idx_tax_class_rates_class');
SET @s186 := IF(@k186=0, 'ALTER TABLE `tax_class_rates` ADD KEY `idx_tax_class_rates_class` (`tax_class_id`)', 'SELECT 1');
PREPARE st186 FROM @s186; EXECUTE st186; DEALLOCATE PREPARE st186;

SET @k187 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tax_class_rates' AND INDEX_NAME='idx_tax_rates_store');
SET @s187 := IF(@k187=0, 'ALTER TABLE `tax_class_rates` ADD KEY `idx_tax_rates_store` (`store_id`)', 'SELECT 1');
PREPARE st187 FROM @s187; EXECUTE st187; DEALLOCATE PREPARE st187;

SET @k188 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tenants' AND INDEX_NAME='PRIMARY');
SET @s188 := IF(@k188=0, 'ALTER TABLE `tenants` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st188 FROM @s188; EXECUTE st188; DEALLOCATE PREPARE st188;

SET @k189 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tenants' AND INDEX_NAME='domain');
SET @s189 := IF(@k189=0, 'ALTER TABLE `tenants` ADD UNIQUE KEY `domain` (`domain`)', 'SELECT 1');
PREPARE st189 FROM @s189; EXECUTE st189; DEALLOCATE PREPARE st189;

SET @k190 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='tenant_payment_settings' AND INDEX_NAME='PRIMARY');
SET @s190 := IF(@k190=0, 'ALTER TABLE `tenant_payment_settings` ADD PRIMARY KEY (`tenant_id`)', 'SELECT 1');
PREPARE st190 FROM @s190; EXECUTE st190; DEALLOCATE PREPARE st190;

SET @k191 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='PRIMARY');
SET @s191 := IF(@k191=0, 'ALTER TABLE `users` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st191 FROM @s191; EXECUTE st191; DEALLOCATE PREPARE st191;

SET @k192 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='email');
SET @s192 := IF(@k192=0, 'ALTER TABLE `users` ADD UNIQUE KEY `email` (`email`)', 'SELECT 1');
PREPARE st192 FROM @s192; EXECUTE st192; DEALLOCATE PREPARE st192;

SET @k193 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='tenant_id');
SET @s193 := IF(@k193=0, 'ALTER TABLE `users` ADD KEY `tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st193 FROM @s193; EXECUTE st193; DEALLOCATE PREPARE st193;

SET @k194 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND INDEX_NAME='store_id');
SET @s194 := IF(@k194=0, 'ALTER TABLE `users` ADD KEY `store_id` (`store_id`)', 'SELECT 1');
PREPARE st194 FROM @s194; EXECUTE st194; DEALLOCATE PREPARE st194;

SET @k195 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_activity_logs' AND INDEX_NAME='PRIMARY');
SET @s195 := IF(@k195=0, 'ALTER TABLE `user_activity_logs` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st195 FROM @s195; EXECUTE st195; DEALLOCATE PREPARE st195;

SET @k196 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_activity_logs' AND INDEX_NAME='idx_user_activity_tenant_id');
SET @s196 := IF(@k196=0, 'ALTER TABLE `user_activity_logs` ADD KEY `idx_user_activity_tenant_id` (`tenant_id`)', 'SELECT 1');
PREPARE st196 FROM @s196; EXECUTE st196; DEALLOCATE PREPARE st196;

SET @k197 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_activity_logs' AND INDEX_NAME='idx_user_activity_user_id');
SET @s197 := IF(@k197=0, 'ALTER TABLE `user_activity_logs` ADD KEY `idx_user_activity_user_id` (`user_id`)', 'SELECT 1');
PREPARE st197 FROM @s197; EXECUTE st197; DEALLOCATE PREPARE st197;

SET @k198 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_activity_logs' AND INDEX_NAME='idx_user_activity_action_type');
SET @s198 := IF(@k198=0, 'ALTER TABLE `user_activity_logs` ADD KEY `idx_user_activity_action_type` (`action_type`)', 'SELECT 1');
PREPARE st198 FROM @s198; EXECUTE st198; DEALLOCATE PREPARE st198;

SET @k199 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_activity_logs' AND INDEX_NAME='idx_user_activity_timestamp');
SET @s199 := IF(@k199=0, 'ALTER TABLE `user_activity_logs` ADD KEY `idx_user_activity_timestamp` (`timestamp`)', 'SELECT 1');
PREPARE st199 FROM @s199; EXECUTE st199; DEALLOCATE PREPARE st199;

SET @k200 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_roles' AND INDEX_NAME='PRIMARY');
SET @s200 := IF(@k200=0, 'ALTER TABLE `user_roles` ADD PRIMARY KEY (`id`)', 'SELECT 1');
PREPARE st200 FROM @s200; EXECUTE st200; DEALLOCATE PREPARE st200;

SET @k201 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_roles' AND INDEX_NAME='uq_user_role_scope');
SET @s201 := IF(@k201=0, 'ALTER TABLE `user_roles` ADD UNIQUE KEY `uq_user_role_scope` (`user_id`,`role_id`,`scope`,`store_id`)', 'SELECT 1');
PREPARE st201 FROM @s201; EXECUTE st201; DEALLOCATE PREPARE st201;

SET @k202 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_roles' AND INDEX_NAME='idx_ur_role');
SET @s202 := IF(@k202=0, 'ALTER TABLE `user_roles` ADD KEY `idx_ur_role` (`role_id`)', 'SELECT 1');
PREPARE st202 FROM @s202; EXECUTE st202; DEALLOCATE PREPARE st202;

SET @k203 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_roles' AND INDEX_NAME='idx_ur_scope');
SET @s203 := IF(@k203=0, 'ALTER TABLE `user_roles` ADD KEY `idx_ur_scope` (`scope`,`store_id`)', 'SELECT 1');
PREPARE st203 FROM @s203; EXECUTE st203; DEALLOCATE PREPARE st203;

SET @k204 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_roles' AND INDEX_NAME='fk_ur_store');
SET @s204 := IF(@k204=0, 'ALTER TABLE `user_roles` ADD KEY `fk_ur_store` (`store_id`)', 'SELECT 1');
PREPARE st204 FROM @s204; EXECUTE st204; DEALLOCATE PREPARE st204;

SET @k205 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_system_roles' AND INDEX_NAME='PRIMARY');
SET @s205 := IF(@k205=0, 'ALTER TABLE `user_system_roles` ADD PRIMARY KEY (`user_id`,`role_id`)', 'SELECT 1');
PREPARE st205 FROM @s205; EXECUTE st205; DEALLOCATE PREPARE st205;

SET @k206 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='user_system_roles' AND INDEX_NAME='idx_usr_role');
SET @s206 := IF(@k206=0, 'ALTER TABLE `user_system_roles` ADD KEY `idx_usr_role` (`role_id`)', 'SELECT 1');
PREPARE st206 FROM @s206; EXECUTE st206; DEALLOCATE PREPARE st206;

SET @f0 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND CONSTRAINT_NAME='audit_logs_ibfk_1');
SET @fs0 := IF(@f0=0, 'ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs0 FROM @fs0; EXECUTE fs0; DEALLOCATE PREPARE fs0;

SET @f1 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND CONSTRAINT_NAME='audit_logs_ibfk_2');
SET @fs1 := IF(@f1=0, 'ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_ibfk_2` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs1 FROM @fs1; EXECUTE fs1; DEALLOCATE PREPARE fs1;

SET @f2 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='audit_logs' AND CONSTRAINT_NAME='audit_logs_ibfk_3');
SET @fs2 := IF(@f2=0, 'ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_ibfk_3` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs2 FROM @fs2; EXECUTE fs2; DEALLOCATE PREPARE fs2;

SET @f3 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND CONSTRAINT_NAME='categories_ibfk_1');
SET @fs3 := IF(@f3=0, 'ALTER TABLE `categories` ADD CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs3 FROM @fs3; EXECUTE fs3; DEALLOCATE PREPARE fs3;

SET @f4 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND CONSTRAINT_NAME='fk_categories_created_by');
SET @fs4 := IF(@f4=0, 'ALTER TABLE `categories` ADD CONSTRAINT `fk_categories_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE fs4 FROM @fs4; EXECUTE fs4; DEALLOCATE PREPARE fs4;

SET @f5 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='categories' AND CONSTRAINT_NAME='fk_categories_updated_by');
SET @fs5 := IF(@f5=0, 'ALTER TABLE `categories` ADD CONSTRAINT `fk_categories_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE fs5 FROM @fs5; EXECUTE fs5; DEALLOCATE PREPARE fs5;

SET @f6 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND CONSTRAINT_NAME='fk_customers_created_by');
SET @fs6 := IF(@f6=0, 'ALTER TABLE `customers` ADD CONSTRAINT `fk_customers_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs6 FROM @fs6; EXECUTE fs6; DEALLOCATE PREPARE fs6;

SET @f7 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND CONSTRAINT_NAME='fk_customers_store');
SET @fs7 := IF(@f7=0, 'ALTER TABLE `customers` ADD CONSTRAINT `fk_customers_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs7 FROM @fs7; EXECUTE fs7; DEALLOCATE PREPARE fs7;

SET @f8 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND CONSTRAINT_NAME='fk_customers_tenant');
SET @fs8 := IF(@f8=0, 'ALTER TABLE `customers` ADD CONSTRAINT `fk_customers_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs8 FROM @fs8; EXECUTE fs8; DEALLOCATE PREPARE fs8;

SET @f9 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='customers' AND CONSTRAINT_NAME='fk_customers_updated_by');
SET @fs9 := IF(@f9=0, 'ALTER TABLE `customers` ADD CONSTRAINT `fk_customers_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs9 FROM @fs9; EXECUTE fs9; DEALLOCATE PREPARE fs9;

SET @f10 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND CONSTRAINT_NAME='fk_grn_purchase_order');
SET @fs10 := IF(@f10=0, 'ALTER TABLE `goods_received_notes` ADD CONSTRAINT `fk_grn_purchase_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE fs10 FROM @fs10; EXECUTE fs10; DEALLOCATE PREPARE fs10;

SET @f11 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND CONSTRAINT_NAME='fk_grn_supplier');
SET @fs11 := IF(@f11=0, 'ALTER TABLE `goods_received_notes` ADD CONSTRAINT `fk_grn_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE fs11 FROM @fs11; EXECUTE fs11; DEALLOCATE PREPARE fs11;

SET @f12 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='goods_received_notes' AND CONSTRAINT_NAME='fk_grn_user');
SET @fs12 := IF(@f12=0, 'ALTER TABLE `goods_received_notes` ADD CONSTRAINT `fk_grn_user` FOREIGN KEY (`received_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE fs12 FROM @fs12; EXECUTE fs12; DEALLOCATE PREPARE fs12;

SET @f13 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='grn_items' AND CONSTRAINT_NAME='fk_grn_item_grn');
SET @fs13 := IF(@f13=0, 'ALTER TABLE `grn_items` ADD CONSTRAINT `fk_grn_item_grn` FOREIGN KEY (`grn_id`) REFERENCES `goods_received_notes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE', 'SELECT 1');
PREPARE fs13 FROM @fs13; EXECUTE fs13; DEALLOCATE PREPARE fs13;

SET @f14 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='grn_items' AND CONSTRAINT_NAME='fk_grn_item_po_item');
SET @fs14 := IF(@f14=0, 'ALTER TABLE `grn_items` ADD CONSTRAINT `fk_grn_item_po_item` FOREIGN KEY (`purchase_order_item_id`) REFERENCES `purchase_order_items` (`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE fs14 FROM @fs14; EXECUTE fs14; DEALLOCATE PREPARE fs14;

SET @f15 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='grn_items' AND CONSTRAINT_NAME='fk_grn_item_product');
SET @fs15 := IF(@f15=0, 'ALTER TABLE `grn_items` ADD CONSTRAINT `fk_grn_item_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE', 'SELECT 1');
PREPARE fs15 FROM @fs15; EXECUTE fs15; DEALLOCATE PREPARE fs15;

SET @f16 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='grn_items' AND CONSTRAINT_NAME='fk_grn_items_purchase_order_id');
SET @fs16 := IF(@f16=0, 'ALTER TABLE `grn_items` ADD CONSTRAINT `fk_grn_items_purchase_order_id` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE fs16 FROM @fs16; EXECUTE fs16; DEALLOCATE PREPARE fs16;

SET @f17 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='held_orders' AND CONSTRAINT_NAME='held_orders_ibfk_1');
SET @fs17 := IF(@f17=0, 'ALTER TABLE `held_orders` ADD CONSTRAINT `held_orders_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs17 FROM @fs17; EXECUTE fs17; DEALLOCATE PREPARE fs17;

SET @f18 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='held_orders' AND CONSTRAINT_NAME='held_orders_ibfk_2');
SET @fs18 := IF(@f18=0, 'ALTER TABLE `held_orders` ADD CONSTRAINT `held_orders_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs18 FROM @fs18; EXECUTE fs18; DEALLOCATE PREPARE fs18;

SET @f19 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='held_orders' AND CONSTRAINT_NAME='held_orders_ibfk_3');
SET @fs19 := IF(@f19=0, 'ALTER TABLE `held_orders` ADD CONSTRAINT `held_orders_ibfk_3` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`)', 'SELECT 1');
PREPARE fs19 FROM @fs19; EXECUTE fs19; DEALLOCATE PREPARE fs19;

SET @f20 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='inventory_logs' AND CONSTRAINT_NAME='inventory_logs_ibfk_1');
SET @fs20 := IF(@f20=0, 'ALTER TABLE `inventory_logs` ADD CONSTRAINT `inventory_logs_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs20 FROM @fs20; EXECUTE fs20; DEALLOCATE PREPARE fs20;

SET @f21 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='inventory_logs' AND CONSTRAINT_NAME='inventory_logs_ibfk_2');
SET @fs21 := IF(@f21=0, 'ALTER TABLE `inventory_logs` ADD CONSTRAINT `inventory_logs_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs21 FROM @fs21; EXECUTE fs21; DEALLOCATE PREPARE fs21;

SET @f22 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='inventory_logs' AND CONSTRAINT_NAME='inventory_logs_ibfk_3');
SET @fs22 := IF(@f22=0, 'ALTER TABLE `inventory_logs` ADD CONSTRAINT `inventory_logs_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)', 'SELECT 1');
PREPARE fs22 FROM @fs22; EXECUTE fs22; DEALLOCATE PREPARE fs22;

SET @f23 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='offer_price_tiers' AND CONSTRAINT_NAME='offer_price_tiers_ibfk_1');
SET @fs23 := IF(@f23=0, 'ALTER TABLE `offer_price_tiers` ADD CONSTRAINT `offer_price_tiers_ibfk_1` FOREIGN KEY (`offer_id`) REFERENCES `promotional_offers` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs23 FROM @fs23; EXECUTE fs23; DEALLOCATE PREPARE fs23;

SET @f24 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='offer_rules' AND CONSTRAINT_NAME='offer_rules_ibfk_1');
SET @fs24 := IF(@f24=0, 'ALTER TABLE `offer_rules` ADD CONSTRAINT `offer_rules_ibfk_1` FOREIGN KEY (`offer_id`) REFERENCES `promotional_offers` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs24 FROM @fs24; EXECUTE fs24; DEALLOCATE PREPARE fs24;

SET @f25 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='offer_rules' AND CONSTRAINT_NAME='offer_rules_ibfk_2');
SET @fs25 := IF(@f25=0, 'ALTER TABLE `offer_rules` ADD CONSTRAINT `offer_rules_ibfk_2` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)', 'SELECT 1');
PREPARE fs25 FROM @fs25; EXECUTE fs25; DEALLOCATE PREPARE fs25;

SET @f26 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='offer_rules' AND CONSTRAINT_NAME='offer_rules_ibfk_3');
SET @fs26 := IF(@f26=0, 'ALTER TABLE `offer_rules` ADD CONSTRAINT `offer_rules_ibfk_3` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`)', 'SELECT 1');
PREPARE fs26 FROM @fs26; EXECUTE fs26; DEALLOCATE PREPARE fs26;

SET @f27 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='offer_usage' AND CONSTRAINT_NAME='offer_usage_ibfk_1');
SET @fs27 := IF(@f27=0, 'ALTER TABLE `offer_usage` ADD CONSTRAINT `offer_usage_ibfk_1` FOREIGN KEY (`offer_id`) REFERENCES `promotional_offers` (`id`)', 'SELECT 1');
PREPARE fs27 FROM @fs27; EXECUTE fs27; DEALLOCATE PREPARE fs27;

SET @f28 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='offer_usage' AND CONSTRAINT_NAME='offer_usage_ibfk_2');
SET @fs28 := IF(@f28=0, 'ALTER TABLE `offer_usage` ADD CONSTRAINT `offer_usage_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)', 'SELECT 1');
PREPARE fs28 FROM @fs28; EXECUTE fs28; DEALLOCATE PREPARE fs28;

SET @f29 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='offer_usage' AND CONSTRAINT_NAME='offer_usage_ibfk_3');
SET @fs29 := IF(@f29=0, 'ALTER TABLE `offer_usage` ADD CONSTRAINT `offer_usage_ibfk_3` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)', 'SELECT 1');
PREPARE fs29 FROM @fs29; EXECUTE fs29; DEALLOCATE PREPARE fs29;

SET @f30 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='offer_usage' AND CONSTRAINT_NAME='offer_usage_ibfk_4');
SET @fs30 := IF(@f30=0, 'ALTER TABLE `offer_usage` ADD CONSTRAINT `offer_usage_ibfk_4` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`)', 'SELECT 1');
PREPARE fs30 FROM @fs30; EXECUTE fs30; DEALLOCATE PREPARE fs30;

SET @f31 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='payment_gateways' AND CONSTRAINT_NAME='payment_gateways_ibfk_1');
SET @fs31 := IF(@f31=0, 'ALTER TABLE `payment_gateways` ADD CONSTRAINT `payment_gateways_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs31 FROM @fs31; EXECUTE fs31; DEALLOCATE PREPARE fs31;

SET @f32 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='payment_gateway_transactions' AND CONSTRAINT_NAME='payment_gateway_transactions_ibfk_1');
SET @fs32 := IF(@f32=0, 'ALTER TABLE `payment_gateway_transactions` ADD CONSTRAINT `payment_gateway_transactions_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs32 FROM @fs32; EXECUTE fs32; DEALLOCATE PREPARE fs32;

SET @f33 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='payment_gateway_transactions' AND CONSTRAINT_NAME='payment_gateway_transactions_ibfk_2');
SET @fs33 := IF(@f33=0, 'ALTER TABLE `payment_gateway_transactions` ADD CONSTRAINT `payment_gateway_transactions_ibfk_2` FOREIGN KEY (`gateway_id`) REFERENCES `payment_gateways` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs33 FROM @fs33; EXECUTE fs33; DEALLOCATE PREPARE fs33;

SET @f34 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='printer_settings' AND CONSTRAINT_NAME='printer_settings_ibfk_1');
SET @fs34 := IF(@f34=0, 'ALTER TABLE `printer_settings` ADD CONSTRAINT `printer_settings_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs34 FROM @fs34; EXECUTE fs34; DEALLOCATE PREPARE fs34;

SET @f35 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='printer_settings' AND CONSTRAINT_NAME='printer_settings_ibfk_2');
SET @fs35 := IF(@f35=0, 'ALTER TABLE `printer_settings` ADD CONSTRAINT `printer_settings_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs35 FROM @fs35; EXECUTE fs35; DEALLOCATE PREPARE fs35;

SET @f36 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='printer_settings' AND CONSTRAINT_NAME='printer_settings_ibfk_3');
SET @fs36 := IF(@f36=0, 'ALTER TABLE `printer_settings` ADD CONSTRAINT `printer_settings_ibfk_3` FOREIGN KEY (`template_id`) REFERENCES `receipt_templates` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs36 FROM @fs36; EXECUTE fs36; DEALLOCATE PREPARE fs36;

SET @f37 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='products' AND CONSTRAINT_NAME='fk_product_tax_class');
SET @fs37 := IF(@f37=0, 'ALTER TABLE `products` ADD CONSTRAINT `fk_product_tax_class` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs37 FROM @fs37; EXECUTE fs37; DEALLOCATE PREPARE fs37;

SET @f38 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='products' AND CONSTRAINT_NAME='fk_products_promotional_offers');
SET @fs38 := IF(@f38=0, 'ALTER TABLE `products` ADD CONSTRAINT `fk_products_promotional_offers` FOREIGN KEY (`promotional_offer_id`) REFERENCES `promotional_offers` (`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE fs38 FROM @fs38; EXECUTE fs38; DEALLOCATE PREPARE fs38;

SET @f39 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='products' AND CONSTRAINT_NAME='fk_products_store');
SET @fs39 := IF(@f39=0, 'ALTER TABLE `products` ADD CONSTRAINT `fk_products_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs39 FROM @fs39; EXECUTE fs39; DEALLOCATE PREPARE fs39;

SET @f40 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='products' AND CONSTRAINT_NAME='fk_products_tax_class');
SET @fs40 := IF(@f40=0, 'ALTER TABLE `products` ADD CONSTRAINT `fk_products_tax_class` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs40 FROM @fs40; EXECUTE fs40; DEALLOCATE PREPARE fs40;

SET @f41 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='products' AND CONSTRAINT_NAME='products_ibfk_1');
SET @fs41 := IF(@f41=0, 'ALTER TABLE `products` ADD CONSTRAINT `products_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs41 FROM @fs41; EXECUTE fs41; DEALLOCATE PREPARE fs41;

SET @f42 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='products' AND CONSTRAINT_NAME='products_ibfk_2');
SET @fs42 := IF(@f42=0, 'ALTER TABLE `products` ADD CONSTRAINT `products_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs42 FROM @fs42; EXECUTE fs42; DEALLOCATE PREPARE fs42;

SET @f43 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='promotional_offers' AND CONSTRAINT_NAME='promotional_offers_ibfk_1');
SET @fs43 := IF(@f43=0, 'ALTER TABLE `promotional_offers` ADD CONSTRAINT `promotional_offers_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)', 'SELECT 1');
PREPARE fs43 FROM @fs43; EXECUTE fs43; DEALLOCATE PREPARE fs43;

SET @f44 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='promotional_offers' AND CONSTRAINT_NAME='promotional_offers_ibfk_2');
SET @fs44 := IF(@f44=0, 'ALTER TABLE `promotional_offers` ADD CONSTRAINT `promotional_offers_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`)', 'SELECT 1');
PREPARE fs44 FROM @fs44; EXECUTE fs44; DEALLOCATE PREPARE fs44;

SET @f45 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND CONSTRAINT_NAME='fk_po_created_by');
SET @fs45 := IF(@f45=0, 'ALTER TABLE `purchase_orders` ADD CONSTRAINT `fk_po_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`)', 'SELECT 1');
PREPARE fs45 FROM @fs45; EXECUTE fs45; DEALLOCATE PREPARE fs45;

SET @f46 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND CONSTRAINT_NAME='fk_po_supplier');
SET @fs46 := IF(@f46=0, 'ALTER TABLE `purchase_orders` ADD CONSTRAINT `fk_po_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`)', 'SELECT 1');
PREPARE fs46 FROM @fs46; EXECUTE fs46; DEALLOCATE PREPARE fs46;

SET @f47 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND CONSTRAINT_NAME='fk_po_tenant');
SET @fs47 := IF(@f47=0, 'ALTER TABLE `purchase_orders` ADD CONSTRAINT `fk_po_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)', 'SELECT 1');
PREPARE fs47 FROM @fs47; EXECUTE fs47; DEALLOCATE PREPARE fs47;

SET @f48 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='purchase_orders' AND CONSTRAINT_NAME='fk_po_updated_by');
SET @fs48 := IF(@f48=0, 'ALTER TABLE `purchase_orders` ADD CONSTRAINT `fk_po_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`)', 'SELECT 1');
PREPARE fs48 FROM @fs48; EXECUTE fs48; DEALLOCATE PREPARE fs48;

SET @f49 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='purchase_order_items' AND CONSTRAINT_NAME='fk_poi_product');
SET @fs49 := IF(@f49=0, 'ALTER TABLE `purchase_order_items` ADD CONSTRAINT `fk_poi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)', 'SELECT 1');
PREPARE fs49 FROM @fs49; EXECUTE fs49; DEALLOCATE PREPARE fs49;

SET @f50 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='purchase_order_items' AND CONSTRAINT_NAME='fk_poi_purchase_order');
SET @fs50 := IF(@f50=0, 'ALTER TABLE `purchase_order_items` ADD CONSTRAINT `fk_poi_purchase_order` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs50 FROM @fs50; EXECUTE fs50; DEALLOCATE PREPARE fs50;

SET @f51 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='receipt_templates' AND CONSTRAINT_NAME='receipt_templates_ibfk_1');
SET @fs51 := IF(@f51=0, 'ALTER TABLE `receipt_templates` ADD CONSTRAINT `receipt_templates_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs51 FROM @fs51; EXECUTE fs51; DEALLOCATE PREPARE fs51;

SET @f52 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='return_number_sequences' AND CONSTRAINT_NAME='return_number_sequences_ibfk_1');
SET @fs52 := IF(@f52=0, 'ALTER TABLE `return_number_sequences` ADD CONSTRAINT `return_number_sequences_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)', 'SELECT 1');
PREPARE fs52 FROM @fs52; EXECUTE fs52; DEALLOCATE PREPARE fs52;

SET @f53 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='roles' AND CONSTRAINT_NAME='fk_roles_created_by');
SET @fs53 := IF(@f53=0, 'ALTER TABLE `roles` ADD CONSTRAINT `fk_roles_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)', 'SELECT 1');
PREPARE fs53 FROM @fs53; EXECUTE fs53; DEALLOCATE PREPARE fs53;

SET @f54 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='roles' AND CONSTRAINT_NAME='fk_roles_tenant');
SET @fs54 := IF(@f54=0, 'ALTER TABLE `roles` ADD CONSTRAINT `fk_roles_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs54 FROM @fs54; EXECUTE fs54; DEALLOCATE PREPARE fs54;

SET @f55 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='role_permissions' AND CONSTRAINT_NAME='fk_rp_permission');
SET @fs55 := IF(@f55=0, 'ALTER TABLE `role_permissions` ADD CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs55 FROM @fs55; EXECUTE fs55; DEALLOCATE PREPARE fs55;

SET @f56 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='role_permissions' AND CONSTRAINT_NAME='fk_rp_role');
SET @fs56 := IF(@f56=0, 'ALTER TABLE `role_permissions` ADD CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs56 FROM @fs56; EXECUTE fs56; DEALLOCATE PREPARE fs56;

SET @f57 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND CONSTRAINT_NAME='sales_ibfk_1');
SET @fs57 := IF(@f57=0, 'ALTER TABLE `sales` ADD CONSTRAINT `sales_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs57 FROM @fs57; EXECUTE fs57; DEALLOCATE PREPARE fs57;

SET @f58 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND CONSTRAINT_NAME='sales_ibfk_2');
SET @fs58 := IF(@f58=0, 'ALTER TABLE `sales` ADD CONSTRAINT `sales_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs58 FROM @fs58; EXECUTE fs58; DEALLOCATE PREPARE fs58;

SET @f59 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sales' AND CONSTRAINT_NAME='sales_ibfk_3');
SET @fs59 := IF(@f59=0, 'ALTER TABLE `sales` ADD CONSTRAINT `sales_ibfk_3` FOREIGN KEY (`cashier_id`) REFERENCES `users` (`id`)', 'SELECT 1');
PREPARE fs59 FROM @fs59; EXECUTE fs59; DEALLOCATE PREPARE fs59;

SET @f60 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND CONSTRAINT_NAME='sales_returns_ibfk_1');
SET @fs60 := IF(@f60=0, 'ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_ibfk_1` FOREIGN KEY (`original_sale_id`) REFERENCES `sales` (`id`)', 'SELECT 1');
PREPARE fs60 FROM @fs60; EXECUTE fs60; DEALLOCATE PREPARE fs60;

SET @f61 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND CONSTRAINT_NAME='sales_returns_ibfk_2');
SET @fs61 := IF(@f61=0, 'ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_ibfk_2` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`)', 'SELECT 1');
PREPARE fs61 FROM @fs61; EXECUTE fs61; DEALLOCATE PREPARE fs61;

SET @f62 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND CONSTRAINT_NAME='sales_returns_ibfk_3');
SET @fs62 := IF(@f62=0, 'ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_ibfk_3` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`)', 'SELECT 1');
PREPARE fs62 FROM @fs62; EXECUTE fs62; DEALLOCATE PREPARE fs62;

SET @f63 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND CONSTRAINT_NAME='sales_returns_ibfk_4');
SET @fs63 := IF(@f63=0, 'ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_ibfk_4` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`)', 'SELECT 1');
PREPARE fs63 FROM @fs63; EXECUTE fs63; DEALLOCATE PREPARE fs63;

SET @f64 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sales_returns' AND CONSTRAINT_NAME='sales_returns_ibfk_5');
SET @fs64 := IF(@f64=0, 'ALTER TABLE `sales_returns` ADD CONSTRAINT `sales_returns_ibfk_5` FOREIGN KEY (`processed_by_user_id`) REFERENCES `users` (`id`)', 'SELECT 1');
PREPARE fs64 FROM @fs64; EXECUTE fs64; DEALLOCATE PREPARE fs64;

SET @f65 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sales_return_items' AND CONSTRAINT_NAME='sales_return_items_ibfk_1');
SET @fs65 := IF(@f65=0, 'ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_ibfk_1` FOREIGN KEY (`sales_return_id`) REFERENCES `sales_returns` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs65 FROM @fs65; EXECUTE fs65; DEALLOCATE PREPARE fs65;

SET @f66 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sales_return_items' AND CONSTRAINT_NAME='sales_return_items_ibfk_2');
SET @fs66 := IF(@f66=0, 'ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_ibfk_2` FOREIGN KEY (`original_sale_item_id`) REFERENCES `sale_items` (`id`)', 'SELECT 1');
PREPARE fs66 FROM @fs66; EXECUTE fs66; DEALLOCATE PREPARE fs66;

SET @f67 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sales_return_items' AND CONSTRAINT_NAME='sales_return_items_ibfk_3');
SET @fs67 := IF(@f67=0, 'ALTER TABLE `sales_return_items` ADD CONSTRAINT `sales_return_items_ibfk_3` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)', 'SELECT 1');
PREPARE fs67 FROM @fs67; EXECUTE fs67; DEALLOCATE PREPARE fs67;

SET @f68 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sale_applied_offers' AND CONSTRAINT_NAME='fk_sale_applied_offers_sale');
SET @fs68 := IF(@f68=0, 'ALTER TABLE `sale_applied_offers` ADD CONSTRAINT `fk_sale_applied_offers_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs68 FROM @fs68; EXECUTE fs68; DEALLOCATE PREPARE fs68;

SET @f69 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sale_items' AND CONSTRAINT_NAME='sale_items_ibfk_1');
SET @fs69 := IF(@f69=0, 'ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_ibfk_1` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs69 FROM @fs69; EXECUTE fs69; DEALLOCATE PREPARE fs69;

SET @f70 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sale_items' AND CONSTRAINT_NAME='sale_items_ibfk_2');
SET @fs70 := IF(@f70=0, 'ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs70 FROM @fs70; EXECUTE fs70; DEALLOCATE PREPARE fs70;

SET @f71 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sale_item_discounts' AND CONSTRAINT_NAME='fk_sale_item_discounts_item');
SET @fs71 := IF(@f71=0, 'ALTER TABLE `sale_item_discounts` ADD CONSTRAINT `fk_sale_item_discounts_item` FOREIGN KEY (`sale_item_id`) REFERENCES `sale_items` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs71 FROM @fs71; EXECUTE fs71; DEALLOCATE PREPARE fs71;

SET @f72 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sale_item_discounts' AND CONSTRAINT_NAME='fk_sale_item_discounts_sale');
SET @fs72 := IF(@f72=0, 'ALTER TABLE `sale_item_discounts` ADD CONSTRAINT `fk_sale_item_discounts_sale` FOREIGN KEY (`sale_id`) REFERENCES `sales` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs72 FROM @fs72; EXECUTE fs72; DEALLOCATE PREPARE fs72;

SET @f73 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='stock_adjustments' AND CONSTRAINT_NAME='stock_adjustments_ibfk_1');
SET @fs73 := IF(@f73=0, 'ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs73 FROM @fs73; EXECUTE fs73; DEALLOCATE PREPARE fs73;

SET @f74 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='stock_adjustments' AND CONSTRAINT_NAME='stock_adjustments_ibfk_2');
SET @fs74 := IF(@f74=0, 'ALTER TABLE `stock_adjustments` ADD CONSTRAINT `stock_adjustments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT', 'SELECT 1');
PREPARE fs74 FROM @fs74; EXECUTE fs74; DEALLOCATE PREPARE fs74;

SET @f75 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='stores' AND CONSTRAINT_NAME='fk_stores_default_tax_class');
SET @fs75 := IF(@f75=0, 'ALTER TABLE `stores` ADD CONSTRAINT `fk_stores_default_tax_class` FOREIGN KEY (`default_tax_class_id`) REFERENCES `tax_classes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE', 'SELECT 1');
PREPARE fs75 FROM @fs75; EXECUTE fs75; DEALLOCATE PREPARE fs75;

SET @f76 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='stores' AND CONSTRAINT_NAME='stores_ibfk_1');
SET @fs76 := IF(@f76=0, 'ALTER TABLE `stores` ADD CONSTRAINT `stores_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs76 FROM @fs76; EXECUTE fs76; DEALLOCATE PREPARE fs76;

SET @f77 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='subscriptions' AND CONSTRAINT_NAME='fk_sub_plan');
SET @fs77 := IF(@f77=0, 'ALTER TABLE `subscriptions` ADD CONSTRAINT `fk_sub_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`)', 'SELECT 1');
PREPARE fs77 FROM @fs77; EXECUTE fs77; DEALLOCATE PREPARE fs77;

SET @f78 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='subscriptions' AND CONSTRAINT_NAME='fk_sub_tenant');
SET @fs78 := IF(@f78=0, 'ALTER TABLE `subscriptions` ADD CONSTRAINT `fk_sub_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs78 FROM @fs78; EXECUTE fs78; DEALLOCATE PREPARE fs78;

SET @f79 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='suppliers' AND CONSTRAINT_NAME='fk_suppliers_created_by');
SET @fs79 := IF(@f79=0, 'ALTER TABLE `suppliers` ADD CONSTRAINT `fk_suppliers_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs79 FROM @fs79; EXECUTE fs79; DEALLOCATE PREPARE fs79;

SET @f80 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='suppliers' AND CONSTRAINT_NAME='fk_suppliers_tenant');
SET @fs80 := IF(@f80=0, 'ALTER TABLE `suppliers` ADD CONSTRAINT `fk_suppliers_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs80 FROM @fs80; EXECUTE fs80; DEALLOCATE PREPARE fs80;

SET @f81 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='suppliers' AND CONSTRAINT_NAME='fk_suppliers_updated_by');
SET @fs81 := IF(@f81=0, 'ALTER TABLE `suppliers` ADD CONSTRAINT `fk_suppliers_updated_by` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs81 FROM @fs81; EXECUTE fs81; DEALLOCATE PREPARE fs81;

SET @f82 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='system_role_permissions' AND CONSTRAINT_NAME='fk_srp_permission');
SET @fs82 := IF(@f82=0, 'ALTER TABLE `system_role_permissions` ADD CONSTRAINT `fk_srp_permission` FOREIGN KEY (`permission_id`) REFERENCES `system_permissions` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs82 FROM @fs82; EXECUTE fs82; DEALLOCATE PREPARE fs82;

SET @f83 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='system_role_permissions' AND CONSTRAINT_NAME='fk_srp_role');
SET @fs83 := IF(@f83=0, 'ALTER TABLE `system_role_permissions` ADD CONSTRAINT `fk_srp_role` FOREIGN KEY (`role_id`) REFERENCES `system_roles` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs83 FROM @fs83; EXECUTE fs83; DEALLOCATE PREPARE fs83;

SET @f84 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='tax_classes' AND CONSTRAINT_NAME='fk_tax_classes_store_id');
SET @fs84 := IF(@f84=0, 'ALTER TABLE `tax_classes` ADD CONSTRAINT `fk_tax_classes_store_id` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`)', 'SELECT 1');
PREPARE fs84 FROM @fs84; EXECUTE fs84; DEALLOCATE PREPARE fs84;

SET @f85 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='tax_classes' AND CONSTRAINT_NAME='fk_tax_classes_tenant');
SET @fs85 := IF(@f85=0, 'ALTER TABLE `tax_classes` ADD CONSTRAINT `fk_tax_classes_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs85 FROM @fs85; EXECUTE fs85; DEALLOCATE PREPARE fs85;

SET @f86 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='tax_class_rates' AND CONSTRAINT_NAME='fk_tax_class_rates_class');
SET @fs86 := IF(@f86=0, 'ALTER TABLE `tax_class_rates` ADD CONSTRAINT `fk_tax_class_rates_class` FOREIGN KEY (`tax_class_id`) REFERENCES `tax_classes` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs86 FROM @fs86; EXECUTE fs86; DEALLOCATE PREPARE fs86;

SET @f87 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='tax_class_rates' AND CONSTRAINT_NAME='fk_tax_class_rates_store_id');
SET @fs87 := IF(@f87=0, 'ALTER TABLE `tax_class_rates` ADD CONSTRAINT `fk_tax_class_rates_store_id` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`)', 'SELECT 1');
PREPARE fs87 FROM @fs87; EXECUTE fs87; DEALLOCATE PREPARE fs87;

SET @f88 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='users' AND CONSTRAINT_NAME='users_ibfk_1');
SET @fs88 := IF(@f88=0, 'ALTER TABLE `users` ADD CONSTRAINT `users_ibfk_1` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs88 FROM @fs88; EXECUTE fs88; DEALLOCATE PREPARE fs88;

SET @f89 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='users' AND CONSTRAINT_NAME='users_ibfk_2');
SET @fs89 := IF(@f89=0, 'ALTER TABLE `users` ADD CONSTRAINT `users_ibfk_2` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE SET NULL', 'SELECT 1');
PREPARE fs89 FROM @fs89; EXECUTE fs89; DEALLOCATE PREPARE fs89;

SET @f90 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='user_roles' AND CONSTRAINT_NAME='fk_ur_role');
SET @fs90 := IF(@f90=0, 'ALTER TABLE `user_roles` ADD CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs90 FROM @fs90; EXECUTE fs90; DEALLOCATE PREPARE fs90;

SET @f91 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='user_roles' AND CONSTRAINT_NAME='fk_ur_store');
SET @fs91 := IF(@f91=0, 'ALTER TABLE `user_roles` ADD CONSTRAINT `fk_ur_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs91 FROM @fs91; EXECUTE fs91; DEALLOCATE PREPARE fs91;

SET @f92 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='user_roles' AND CONSTRAINT_NAME='fk_ur_user');
SET @fs92 := IF(@f92=0, 'ALTER TABLE `user_roles` ADD CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs92 FROM @fs92; EXECUTE fs92; DEALLOCATE PREPARE fs92;

SET @f93 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='user_system_roles' AND CONSTRAINT_NAME='fk_usr_role');
SET @fs93 := IF(@f93=0, 'ALTER TABLE `user_system_roles` ADD CONSTRAINT `fk_usr_role` FOREIGN KEY (`role_id`) REFERENCES `system_roles` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs93 FROM @fs93; EXECUTE fs93; DEALLOCATE PREPARE fs93;

SET @f94 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='user_system_roles' AND CONSTRAINT_NAME='fk_usr_user');
SET @fs94 := IF(@f94=0, 'ALTER TABLE `user_system_roles` ADD CONSTRAINT `fk_usr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE', 'SELECT 1');
PREPARE fs94 FROM @fs94; EXECUTE fs94; DEALLOCATE PREPARE fs94;


SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

-- =============================================================================
-- Verification
-- =============================================================================
-- SELECT TABLE_TYPE, COUNT(*) FROM INFORMATION_SCHEMA.TABLES
--  WHERE TABLE_SCHEMA = DATABASE() GROUP BY TABLE_TYPE;
-- Expect >= 51 BASE TABLE and 3 VIEW.
-- =============================================================================
