-- =============================================================================
-- 2026-09-08  store_product_listings — per-store cost/receiving tracking
-- =============================================================================
-- Part of the multi-store data-sharing model:
-- docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3, §9
-- Phase 2 follow-up, per explicit product-owner direction (2026-09-08):
--
--   "sharing a product shares details only — not price, either cost or
--   selling — unless a tenant/authorised user chooses to. Weighted average
--   cost and total quantity received must be tracked strictly store by
--   store, not tenant-wide."
--
-- Previously, storeProductListingService.receiveStock/reverseStock kept
-- weighted_average_cost and total_quantity_received on the shared `products`
-- row (tenant-wide aggregates) even for a shared product, using the SUM of
-- every store's listing stock as the "old qty on hand" basis. That was an
-- explicitly-flagged interim decision pending product-owner confirmation —
-- this migration and the service/controller changes that follow it replace
-- it with per-store tracking instead.
--
-- Idempotent per database/README.md's convention.
-- =============================================================================

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='store_product_listings' AND column_name='weighted_average_cost');
SET @sql := IF(@col=0,
  'ALTER TABLE `store_product_listings` ADD COLUMN `weighted_average_cost` decimal(15,5) DEFAULT NULL COMMENT ''Per-store weighted average cost, tracked independently of other stores'' AFTER `cost_price_override`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='store_product_listings' AND column_name='total_quantity_received');
SET @sql := IF(@col=0,
  'ALTER TABLE `store_product_listings` ADD COLUMN `total_quantity_received` decimal(15,2) NOT NULL DEFAULT 0.00 COMMENT ''Per-store cumulative quantity ever received, independent of other stores'' AFTER `weighted_average_cost`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='store_product_listings' AND column_name='last_received_cost_price');
SET @sql := IF(@col=0,
  'ALTER TABLE `store_product_listings` ADD COLUMN `last_received_cost_price` decimal(15,2) DEFAULT NULL AFTER `total_quantity_received`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='store_product_listings' AND column_name='last_received_date');
SET @sql := IF(@col=0,
  'ALTER TABLE `store_product_listings` ADD COLUMN `last_received_date` date DEFAULT NULL AFTER `last_received_cost_price`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
