-- =============================================================================
-- 2026-08-28  sales_orders — minimal real backend for the Orders page
-- =============================================================================
-- The Sales Hub's "Sales Orders" tile previously navigated to OrdersPage.tsx,
-- which rendered entirely from client-side mock data (mockOrdersData in the
-- old OrdersPage.tsx) — there was never a real table, controller, or route.
-- This migration adds the minimal-but-real table backing customer sales
-- orders (distinct from `sales` — a completed POS transaction — and from
-- `purchase_orders` — supplier-facing procurement). One row per order, with
-- items snapshotted as JSON on the row rather than a separate items table,
-- since Phase 1 of this feature only needs a lightweight quick-action
-- create + list, matching the scope of the Sales Hub quick-action redesign.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `sales_orders` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NULL,
  `order_number` VARCHAR(40) NOT NULL,
  `status` ENUM('pending','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  `items` JSON NULL COMMENT 'Snapshot array of {productId, productName, quantity, unitPrice, totalPrice}',
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `tax` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT NULL,
  `created_by` CHAR(36) NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_sales_orders_tenant_order_number` (`tenant_id`, `order_number`),
  KEY `idx_sales_orders_tenant_store` (`tenant_id`, `store_id`),
  KEY `idx_sales_orders_customer` (`customer_id`),
  KEY `idx_sales_orders_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
