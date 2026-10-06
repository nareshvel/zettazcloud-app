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

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

-- =============================================================================
-- Verification
-- =============================================================================
-- SELECT TABLE_TYPE, COUNT(*) FROM INFORMATION_SCHEMA.TABLES
--  WHERE TABLE_SCHEMA = DATABASE() GROUP BY TABLE_TYPE;
-- Expect >= 51 BASE TABLE and 3 VIEW.
-- =============================================================================
