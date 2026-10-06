-- =============================================================================
-- 2026-09-06  tax_classes / promotional_offers — store_id becomes nullable
-- =============================================================================
-- Part of the multi-store data-sharing model:
-- docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §4, §9
-- Phase 1.
--
-- Both tables previously required `store_id NOT NULL`, forcing every store to
-- redefine identical tax classes / promotional offers from scratch even when
-- a tenant's stores share the same rules. Relaxing to NULL lets a row with
-- `store_id IS NULL` act as the tenant-wide default; a store with its own
-- row(s) overrides (replaces, not merges with) the tenant default for that
-- store — see backend/services/taxCalculationService.js's
-- `getTaxClassesWithRates` and backend/services/promotionEngine.js's
-- `computePromotions` for the replace-not-merge application logic.
--
-- Existing rows are untouched — every row currently has a real store_id, so
-- they all continue to behave exactly as store-specific overrides. No row's
-- meaning changes; this migration only relaxes the constraint so that a NEW
-- row can opt into being a tenant-wide default going forward.
--
-- Idempotent per database/README.md's convention.
-- =============================================================================

SET @col_nullable = (
  SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tax_classes' AND COLUMN_NAME = 'store_id'
);
SET @sql = IF(@col_nullable = 'NO',
  'ALTER TABLE `tax_classes` MODIFY COLUMN `store_id` CHAR(36) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_nullable = (
  SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'promotional_offers' AND COLUMN_NAME = 'store_id'
);
SET @sql = IF(@col_nullable = 'NO',
  'ALTER TABLE `promotional_offers` MODIFY COLUMN `store_id` CHAR(36) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
