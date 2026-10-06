-- Migration: Metal rates + weight-based pricing (jewelry P3, OFF by default)
-- Date: 2026-08-09
-- Diamond Republic prices by markup (purchase -> cost -> selling) and does NOT use
-- this. Other jewelry tenants price by live metal rate; enable per tenant.
-- Idempotent.

CREATE TABLE IF NOT EXISTS `metal_rates` (
  `id`            char(36)      NOT NULL,
  `tenant_id`     char(36)      NOT NULL,
  `store_id`      char(36)      DEFAULT NULL COMMENT 'NULL = applies to all stores',
  `metal`         varchar(60)   NOT NULL COMMENT 'Gold, Silver, Platinum…',
  `purity_label`  varchar(40)   NOT NULL COMMENT '24K, 22K, 18K, 925…',
  `purity_pct`    decimal(6,3)  DEFAULT NULL,
  `rate_per_gram` decimal(12,2) NOT NULL COMMENT 'Selling rate per gram',
  `buy_rate_per_gram` decimal(12,2) DEFAULT NULL COMMENT 'Rate used for old-gold buy-back',
  `effective_from` datetime     NOT NULL,
  `effective_to`   datetime     DEFAULT NULL COMMENT 'NULL = currently active',
  `created_by_user_id` char(36) DEFAULT NULL,
  `created_at`    timestamp     NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lookup` (`tenant_id`,`metal`,`purity_label`,`effective_from`),
  KEY `idx_active` (`tenant_id`,`effective_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Per-tenant switch + defaults for weight-based pricing.
CREATE TABLE IF NOT EXISTS `tenant_pricing_settings` (
  `tenant_id`             char(36)     NOT NULL,
  `weight_pricing_enabled` tinyint(1)  NOT NULL DEFAULT 0,
  `default_making_charge_type` enum('per_gram','percentage','flat') NOT NULL DEFAULT 'per_gram',
  `default_making_charge_value` decimal(12,2) NOT NULL DEFAULT 0.00,
  `default_wastage_pct`   decimal(6,3) NOT NULL DEFAULT 0.000,
  `updated_at`            timestamp    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Snapshot the rate used on a sale line so historical invoices stay reproducible.
SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sale_items' AND column_name='pricing_snapshot');
SET @sql := IF(@col=0,
  'ALTER TABLE `sale_items` ADD COLUMN `pricing_snapshot` json DEFAULT NULL COMMENT ''Metal rate/weight/making breakdown at time of sale''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Done.
