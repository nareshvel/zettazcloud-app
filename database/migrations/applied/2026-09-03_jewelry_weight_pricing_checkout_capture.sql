-- =============================================================================
-- 2026-09-03  Jewelry weight-pricing: capture purity/weight/making/wastage on
--             the actual sale, not just a detached calculator
-- =============================================================================
-- WHY
-- ---
-- A printed jewelry invoice showed every line's Purity/Gross Wt/Net Wt/Making
-- column as "—" — traced to the root: metalPricingService.js's
-- calculateLinePrice()/buildSnapshot() already compute this breakdown, and
-- its own doc comment says buildSnapshot() is "persisted on
-- sale_items.pricing_snapshot", but that column never existed and nothing
-- outside metalPricingService.test.js ever called buildSnapshot(). The only
-- caller was POST /api/metal-rates/calculate — a standalone rate calculator,
-- never wired into checkout. So this data was never captured on a real sale
-- for ANY jewelry product, serialized or not.
--
-- This migration adds:
--  1. `products` — optional per-product jewelry defaults (purity, HSN code,
--     nominal gross/net weight, making-charge type/value, wastage %) used to
--     prefill the cart's weight-pricing step. All nullable; meaningless for
--     non-jewelry products and simply unused.
--  2. `sale_items` — the captured-at-sale-time values (which may differ
--     slightly from the product defaults — the cashier can adjust for the
--     actual weighed piece) plus `pricing_snapshot` JSON, matching the shape
--     metalPricingService.buildSnapshot() already returns, for a full
--     reproducible audit trail even after metal rates change.
--
-- SAFETY
-- ------
-- Idempotent (INFORMATION_SCHEMA guards). All new columns are nullable with
-- no default requirement — every existing sale_items/products row is
-- untouched and continues to mean exactly what it always meant.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- products: per-product jewelry pricing defaults
-- ---------------------------------------------------------------------------
SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='purity');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `purity` varchar(40) DEFAULT NULL COMMENT ''e.g. 22K, 916, 18K — jewelry only''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='hsn_code');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `hsn_code` varchar(20) DEFAULT NULL COMMENT ''Tax classification code (e.g. 7113 for jewelry in India), printed on GST invoices''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='default_gross_weight');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `default_gross_weight` decimal(10,3) DEFAULT NULL COMMENT ''Nominal gross weight in grams — prefills the cart weight-pricing step, cashier may adjust per actual piece''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='default_net_weight');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `default_net_weight` decimal(10,3) DEFAULT NULL COMMENT ''Nominal net (metal-only) weight in grams''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='default_making_charge_type');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `default_making_charge_type` enum(''per_gram'',''percentage'',''flat'') DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='default_making_charge_value');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `default_making_charge_value` decimal(14,2) DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='products' AND column_name='default_wastage_pct');
SET @sql := IF(@col=0,
  'ALTER TABLE `products` ADD COLUMN `default_wastage_pct` decimal(6,2) DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- sale_items: values actually captured at the time of THIS sale
-- ---------------------------------------------------------------------------
SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sale_items' AND column_name='purity');
SET @sql := IF(@col=0,
  'ALTER TABLE `sale_items` ADD COLUMN `purity` varchar(40) DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sale_items' AND column_name='gross_weight');
SET @sql := IF(@col=0,
  'ALTER TABLE `sale_items` ADD COLUMN `gross_weight` decimal(10,3) DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sale_items' AND column_name='net_weight');
SET @sql := IF(@col=0,
  'ALTER TABLE `sale_items` ADD COLUMN `net_weight` decimal(10,3) DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sale_items' AND column_name='making_charge');
SET @sql := IF(@col=0,
  'ALTER TABLE `sale_items` ADD COLUMN `making_charge` decimal(14,2) DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sale_items' AND column_name='wastage_value');
SET @sql := IF(@col=0,
  'ALTER TABLE `sale_items` ADD COLUMN `wastage_value` decimal(14,2) DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sale_items' AND column_name='metal_value');
SET @sql := IF(@col=0,
  'ALTER TABLE `sale_items` ADD COLUMN `metal_value` decimal(14,2) DEFAULT NULL COMMENT ''net_weight * rate_per_gram at time of sale''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sale_items' AND column_name='hsn_code');
SET @sql := IF(@col=0,
  'ALTER TABLE `sale_items` ADD COLUMN `hsn_code` varchar(20) DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sale_items' AND column_name='pricing_snapshot');
SET @sql := IF(@col=0,
  'ALTER TABLE `sale_items` ADD COLUMN `pricing_snapshot` json DEFAULT NULL COMMENT ''Full metalPricingService.buildSnapshot() output — reproduces this line even after rates change''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
