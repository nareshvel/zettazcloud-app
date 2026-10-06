-- Migration: Sales Hub — per-sale duty-free traveller capture + historical sales mode
-- Date: 2026-09-01
-- Scope:
--   1. Records what sales_mode/zero_rate_reason a completed sale actually used.
--      Previously this lived only in store_jurisdiction_settings (a live,
--      mutable setting) with nothing on the sale row itself — so a store that
--      later changes its duty-free configuration would silently rewrite the
--      apparent tax status of every historical sale on reprint. Freezing it on
--      the sale at creation time makes a reprint always match what was
--      actually charged, not what the store happens to be configured as today.
--   2. Adds the generalized traveller-ID / travel-method fields captured by the
--      Sales Hub's Duty-Free Sale intake (POS Hub Proposal, doc 13) — nothing
--      previously captured this at transaction time; it only ever existed on
--      print fixtures. Field names match the print layer's existing model
--      (salesModeRules.ts / printTemplateService.js) so saleToPrintData.ts is a
--      straight passthrough, not a translation.
-- Idempotent.

-- ---- historical sales-mode / zero-rating -----------------------------------

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sales' AND column_name='sales_mode');
SET @sql := IF(@col=0,
  'ALTER TABLE `sales` ADD COLUMN `sales_mode` varchar(20) DEFAULT NULL COMMENT ''Frozen at sale creation from store_jurisdiction_settings.sales_mode; NULL = sale predates this column or jurisdiction lookup was unavailable''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sales' AND column_name='zero_rate_reason');
SET @sql := IF(@col=0,
  'ALTER TABLE `sales` ADD COLUMN `zero_rate_reason` varchar(20) DEFAULT NULL COMMENT ''duty_free | export | NULL. Mirrors taxCalculationService.ZERO_RATE_REASONS''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---- duty-free traveller capture --------------------------------------------

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sales' AND column_name='traveller_id_type');
SET @sql := IF(@col=0,
  'ALTER TABLE `sales` ADD COLUMN `traveller_id_type` varchar(20) DEFAULT NULL COMMENT ''passport | national_id | seaman_book | other''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sales' AND column_name='traveller_id_number');
SET @sql := IF(@col=0,
  'ALTER TABLE `sales` ADD COLUMN `traveller_id_number` varchar(60) DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sales' AND column_name='traveller_id_country');
SET @sql := IF(@col=0,
  'ALTER TABLE `sales` ADD COLUMN `traveller_id_country` varchar(60) DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sales' AND column_name='travel_method_type');
SET @sql := IF(@col=0,
  'ALTER TABLE `sales` ADD COLUMN `travel_method_type` varchar(20) DEFAULT NULL COMMENT ''flight | vessel | other''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sales' AND column_name='travel_method_ref');
SET @sql := IF(@col=0,
  'ALTER TABLE `sales` ADD COLUMN `travel_method_ref` varchar(60) DEFAULT NULL COMMENT ''Flight number, or vessel name''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sales' AND column_name='travel_method_detail');
SET @sql := IF(@col=0,
  'ALTER TABLE `sales` ADD COLUMN `travel_method_detail` varchar(60) DEFAULT NULL COMMENT ''Voyage number, or other travel-method detail''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sales' AND column_name='destination');
SET @sql := IF(@col=0,
  'ALTER TABLE `sales` ADD COLUMN `destination` varchar(120) DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sales' AND column_name='departure_date');
SET @sql := IF(@col=0,
  'ALTER TABLE `sales` ADD COLUMN `departure_date` date DEFAULT NULL',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Index for reporting/filtering duty-free sales by store and date.
SET @idx := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE table_schema=DATABASE() AND table_name='sales' AND index_name='idx_sales_mode');
SET @sql := IF(@idx=0,
  'ALTER TABLE `sales` ADD INDEX `idx_sales_mode` (`tenant_id`,`store_id`,`sales_mode`,`created_at`)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Done.
