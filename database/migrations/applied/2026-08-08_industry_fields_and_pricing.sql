-- Migration: Industry field-config, cost-code pricing, per-tenant customization
-- Date: 2026-08-08
-- Idempotent: guards every ALTER/CREATE so it is safe to re-run.
-- Design goals:
--   * Any tenant can pick an industry_type; the product/POS forms then render
--     the relevant fields for that industry (jewelry, apparel, electronics, ...).
--   * Per-tenant overrides let a specific tenant add/hide/relabel fields without
--     forking the platform.
--   * Non-weight pricing flow: purchase_price -> cost_price -> selling_price.
--   * Configurable alphabetic "cost code" printed on the tag.

-- ---------------------------------------------------------------------------
-- 1) industry_types : the catalogue of supported verticals (global, seeded)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `industry_types` (
  `code`        varchar(40)  NOT NULL,
  `name`        varchar(120) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `is_active`   tinyint(1)   NOT NULL DEFAULT 1,
  `sort_order`  int          NOT NULL DEFAULT 0,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 2) industry_field_definitions : the field schema per industry + entity.
--    applies_to = which form the field renders on (product / pos / customer).
--    These are the platform defaults; tenants may override them (table 3).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `industry_field_definitions` (
  `id`            char(36)     NOT NULL,
  `industry_code` varchar(40)  NOT NULL,
  `applies_to`    enum('product','pos','customer') NOT NULL DEFAULT 'product',
  `field_key`     varchar(60)  NOT NULL,      -- stored inside products.attributes JSON
  `label`         varchar(120) NOT NULL,
  `data_type`     enum('text','number','decimal','date','select','boolean','textarea') NOT NULL DEFAULT 'text',
  `options_json`  json         DEFAULT NULL,  -- for select: ["Gold","Silver",...]
  `unit`          varchar(20)  DEFAULT NULL,  -- e.g. "g", "ct"
  `is_required`   tinyint(1)   NOT NULL DEFAULT 0,
  `is_searchable` tinyint(1)   NOT NULL DEFAULT 0,
  `show_on_receipt` tinyint(1) NOT NULL DEFAULT 0,
  `sort_order`    int          NOT NULL DEFAULT 0,
  `is_active`     tinyint(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_industry_entity_field` (`industry_code`,`applies_to`,`field_key`),
  KEY `idx_industry` (`industry_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 3) tenant_field_overrides : per-tenant add / hide / relabel of fields.
--    field_definition_id NULL + is enabled => a brand-new tenant-only field.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tenant_field_overrides` (
  `id`             char(36)    NOT NULL,
  `tenant_id`      char(36)    NOT NULL,
  `applies_to`     enum('product','pos','customer') NOT NULL DEFAULT 'product',
  `field_key`      varchar(60) NOT NULL,
  `label`          varchar(120) DEFAULT NULL,   -- override label (NULL = inherit)
  `data_type`      enum('text','number','decimal','date','select','boolean','textarea') DEFAULT NULL,
  `options_json`   json        DEFAULT NULL,
  `unit`           varchar(20) DEFAULT NULL,
  `is_required`    tinyint(1)  DEFAULT NULL,
  `is_enabled`     tinyint(1)  NOT NULL DEFAULT 1, -- 0 = hide this field for the tenant
  `is_custom`      tinyint(1)  NOT NULL DEFAULT 0, -- 1 = tenant-defined new field
  `sort_order`     int         DEFAULT NULL,
  `created_at`     timestamp   NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tenant_entity_field` (`tenant_id`,`applies_to`,`field_key`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 4) tenant_cost_code_settings : the tag cost-code cipher configuration.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tenant_cost_code_settings` (
  `tenant_id`    char(36)   NOT NULL,
  `enabled`      tinyint(1) NOT NULL DEFAULT 0,
  `prefix_char`  char(1)    NOT NULL DEFAULT 'X',
  `suffix_char`  char(1)    NOT NULL DEFAULT 'Y',
  `decimal_char` char(1)    NOT NULL DEFAULT '.',
  `repeat_char`  char(1)    DEFAULT NULL,
  `digit_map`    json       NOT NULL,  -- {"1":"A","2":"N",...,"0":"O"}
  `updated_at`   timestamp  NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 5) tenants.industry_code  (nullable; default 'general_retail' at read time)
-- ---------------------------------------------------------------------------
SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='tenants' AND column_name='industry_code');
SET @sql := IF(@col=0,
  'ALTER TABLE `tenants` ADD COLUMN `industry_code` varchar(40) DEFAULT NULL AFTER `domain`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- 6) products : additive columns for the non-weight pricing flow + attributes
-- ---------------------------------------------------------------------------
-- purchase_price
SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='purchase_price');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `purchase_price` decimal(15,2) DEFAULT NULL COMMENT ''Raw supplier purchase price'' AFTER `cost_price`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- handling_cost_pct
SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='handling_cost_pct');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `handling_cost_pct` decimal(6,2) DEFAULT NULL COMMENT ''Handling % added to purchase to get cost price'' AFTER `purchase_price`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- markup_pct
SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='markup_pct');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `markup_pct` decimal(6,2) DEFAULT NULL COMMENT ''Markup % added to cost price to get selling price'' AFTER `handling_cost_pct`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- cost_code (encoded tag string)
SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='cost_code');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `cost_code` varchar(40) DEFAULT NULL COMMENT ''Encoded cost price for the price tag'' AFTER `markup_pct`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- attributes (industry-specific dynamic fields)
SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='attributes');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `attributes` json DEFAULT NULL COMMENT ''Industry-specific dynamic field values''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Done.
