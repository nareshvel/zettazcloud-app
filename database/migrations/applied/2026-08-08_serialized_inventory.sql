-- Migration: Serialized (per-piece) inventory (jewelry P1)
-- Date: 2026-08-08
-- Additive: coexists with the existing fungible products.stock_quantity model.
-- A product is either fungible (quantity) or serialized (one row per physical piece).
-- Idempotent.

-- products.is_serialized flag
SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='is_serialized');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `is_serialized` tinyint(1) NOT NULL DEFAULT 0 COMMENT ''1 = tracked per physical piece''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

CREATE TABLE IF NOT EXISTS `product_pieces` (
  `id`               char(36)      NOT NULL,
  `tenant_id`        char(36)      NOT NULL,
  `store_id`         char(36)      DEFAULT NULL,
  `product_id`       char(36)      NOT NULL,
  `piece_code`       varchar(60)   NOT NULL COMMENT 'Tag / piece number, unique per tenant',
  `barcode`          varchar(120)  DEFAULT NULL,
  `status`           enum('available','hold','sold','returned','melted') NOT NULL DEFAULT 'available',
  `gross_weight`     decimal(10,3) DEFAULT NULL,
  `net_weight`       decimal(10,3) DEFAULT NULL,
  `purity`           varchar(40)   DEFAULT NULL,
  `purchase_price`   decimal(15,2) DEFAULT NULL,
  `cost_price`       decimal(15,2) DEFAULT NULL,
  `selling_price`    decimal(15,2) DEFAULT NULL,
  `cost_code`        varchar(40)   DEFAULT NULL,
  `attributes`       json          DEFAULT NULL COMMENT 'Per-piece industry attributes',
  `sale_id`          char(36)      DEFAULT NULL,
  `sale_item_id`     char(36)      DEFAULT NULL,
  `grn_id`           char(36)      DEFAULT NULL COMMENT 'Goods-receipt that brought this piece in',
  `notes`            varchar(500)  DEFAULT NULL,
  `created_by_user_id` char(36)    DEFAULT NULL,
  `created_at`       timestamp     NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       timestamp     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tenant_piece` (`tenant_id`,`piece_code`),
  KEY `idx_product_status` (`product_id`,`status`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_barcode` (`tenant_id`,`barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Per-tenant piece-code sequence (fallback auto numbering)
CREATE TABLE IF NOT EXISTS `product_piece_sequences` (
  `tenant_id`  char(36) NOT NULL,
  `last_value` int      NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Done.
