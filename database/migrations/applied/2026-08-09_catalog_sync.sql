-- Migration: Catalog sync / e-commerce integration foundation (P3)
-- Date: 2026-08-09
-- Deliberately PLATFORM-AGNOSTIC. We store a channel config + per-product sync
-- state + an outbox of pending changes. A platform adapter (Shopify, WooCommerce,
-- custom storefront) reads the outbox and pushes; adding a platform later needs no
-- schema change.
-- Idempotent.

CREATE TABLE IF NOT EXISTS `sales_channels` (
  `id`            char(36)     NOT NULL,
  `tenant_id`     char(36)     NOT NULL,
  `name`          varchar(120) NOT NULL,
  `platform`      varchar(40)  NOT NULL DEFAULT 'custom' COMMENT 'shopify | woocommerce | custom | feed',
  `status`        enum('disconnected','connected','error','paused') NOT NULL DEFAULT 'disconnected',
  `config`        json         DEFAULT NULL COMMENT 'Endpoint/store domain and non-secret options',
  `credentials_ref` varchar(160) DEFAULT NULL COMMENT 'Reference to a secret store key — never store raw tokens here',
  `auto_sync`     tinyint(1)   NOT NULL DEFAULT 0,
  `last_sync_at`  datetime     DEFAULT NULL,
  `last_error`    varchar(500) DEFAULT NULL,
  `created_at`    timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    timestamp    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Per-product publish state per channel.
CREATE TABLE IF NOT EXISTS `channel_product_links` (
  `id`               char(36)     NOT NULL,
  `tenant_id`        char(36)     NOT NULL,
  `channel_id`       char(36)     NOT NULL,
  `product_id`       char(36)     NOT NULL,
  `external_id`      varchar(160) DEFAULT NULL COMMENT 'ID of the product on the remote platform',
  `is_published`     tinyint(1)   NOT NULL DEFAULT 0,
  `sync_status`      enum('pending','synced','error','excluded') NOT NULL DEFAULT 'pending',
  `last_synced_at`   datetime     DEFAULT NULL,
  `last_error`       varchar(500) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_channel_product` (`channel_id`,`product_id`),
  KEY `idx_status` (`tenant_id`,`sync_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Outbox of changes awaiting push (product upsert, price/stock change, delete).
CREATE TABLE IF NOT EXISTS `channel_sync_queue` (
  `id`          char(36)     NOT NULL,
  `tenant_id`   char(36)     NOT NULL,
  `channel_id`  char(36)     DEFAULT NULL COMMENT 'NULL = all channels',
  `entity_type` varchar(40)  NOT NULL DEFAULT 'product',
  `entity_id`   char(36)     NOT NULL,
  `action`      enum('upsert','delete','stock','price') NOT NULL DEFAULT 'upsert',
  `status`      enum('queued','processing','done','failed') NOT NULL DEFAULT 'queued',
  `attempts`    int          NOT NULL DEFAULT 0,
  `last_error`  varchar(500) DEFAULT NULL,
  `created_at`  timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  `processed_at` datetime    DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pending` (`tenant_id`,`status`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Done.
