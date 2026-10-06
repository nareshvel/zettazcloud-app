-- =============================================================================
-- 2026-09-07  store_product_listings
-- =============================================================================
-- Part of the multi-store data-sharing model:
-- docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3, §9
-- Phase 2 foundation.
--
-- A tenant-shared `products` row (store_id IS NULL) can now be sold from
-- multiple stores with a different price and independent stock per store.
-- This table is the per-store override: one row per (store_id, product_id)
-- carrying that store's price/stock/active-flag for a shared product.
--
-- This table does NOT apply to store-owned products (`products.store_id`
-- NOT NULL) — those keep reading/writing `products.price` /
-- `products.stock_quantity` directly, exactly as today. Mutual exclusivity
-- between the two models is enforced at the application layer (see plan doc
-- §6 Q2) since MySQL cannot CHECK against another table.
--
-- `price` is nullable: NULL means "use the shared product's own `price`" for
-- that store (a store can override just stock without overriding price).
-- `stock_quantity` is NOT NULL DEFAULT 0 — stock is never shared or defaulted
-- from the product row; every store starts at zero and is stocked via its
-- own GRN / stock-adjustment flow, same as store-owned products today.
--
-- Idempotent per database/README.md's convention.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `store_product_listings` (
  `id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) NOT NULL,
  `product_id` char(36) NOT NULL,
  `price` decimal(10,2) DEFAULT NULL COMMENT 'Per-store price override; NULL = use products.price',
  `cost_price_override` decimal(10,2) DEFAULT NULL COMMENT 'Per-store cost price override; NULL = use products.cost_price',
  `stock_quantity` int NOT NULL DEFAULT '0' COMMENT 'Store-specific stock; never shared or copied from products.stock_quantity',
  `is_active` tinyint(1) NOT NULL DEFAULT '1' COMMENT 'Whether this shared product is sellable at this store',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_store_product` (`store_id`,`product_id`),
  KEY `idx_tenant` (`tenant_id`),
  KEY `idx_product` (`product_id`),
  CONSTRAINT `fk_spl_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_spl_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
