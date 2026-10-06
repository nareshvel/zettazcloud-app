-- =============================================================================
-- 2026-08-15 Serialized Inventory — product_pieces + product_piece_sequences
-- =============================================================================
-- Creates:
--   1. product_pieces          — one row per unique serialized piece (tag/barcode)
--   2. product_piece_sequences — auto-incrementing counter per tenant for PC-XXXXXX codes
-- Both CREATE TABLE statements are guarded with IF NOT EXISTS (idempotent).
-- Collation matches MySQL 8 default (utf8mb4_0900_ai_ci) used by all other tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. product_piece_sequences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_piece_sequences` (
  `tenant_id`  char(36)         NOT NULL,
  `last_value` int unsigned     NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Auto-increment counter for piece codes per tenant';

-- ---------------------------------------------------------------------------
-- 2. product_pieces
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `product_pieces` (
  `id`                 char(36)           NOT NULL,
  `tenant_id`          char(36)           NOT NULL,
  `store_id`           char(36)           DEFAULT NULL,
  `product_id`         char(36)           NOT NULL,

  `piece_code`         varchar(64)        NOT NULL  COMMENT 'Human-readable tag code e.g. PC-000001',
  `barcode`            varchar(128)       DEFAULT NULL,

  `status`             enum('available','hold','sold','returned','melted')
                                          NOT NULL DEFAULT 'available',

  `gross_weight`       decimal(10,3)      DEFAULT NULL,
  `net_weight`         decimal(10,3)      DEFAULT NULL,
  `purity`             varchar(32)        DEFAULT NULL,

  `purchase_price`     decimal(14,2)      DEFAULT NULL,
  `cost_price`         decimal(14,2)      DEFAULT NULL,
  `selling_price`      decimal(14,2)      DEFAULT NULL,
  `cost_code`          varchar(64)        DEFAULT NULL,

  `attributes`         json               DEFAULT NULL,
  `grn_id`             char(36)           DEFAULT NULL,
  `notes`              text               DEFAULT NULL,

  `sale_id`            char(36)           DEFAULT NULL,
  `sale_item_id`       char(36)           DEFAULT NULL,

  `created_by_user_id` char(36)           DEFAULT NULL,
  `created_at`         datetime           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         datetime           NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_piece_code_tenant` (`tenant_id`, `piece_code`),
  KEY `idx_pp_tenant_product` (`tenant_id`, `product_id`),
  KEY `idx_pp_tenant_status`  (`tenant_id`, `status`),
  KEY `idx_pp_barcode`        (`barcode`),
  KEY `idx_pp_sale`           (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Serialized inventory — one row per unique physical piece';
