-- =============================================================================
-- 2026-09-03  offer_rules / offer_price_tiers — store_id becomes nullable
-- =============================================================================
-- WHY
-- ---
-- 2026-09-06_tax_offers_store_id_nullable.sql relaxed `promotional_offers.
-- store_id` to NULL so a tenant-wide offer (appliesToAllStores) could be
-- created — but promotionalOfferController.js's createOffer() also inserts
-- into `offer_rules` (always, for every offer) and `offer_price_tiers` (for
-- tiered_pricing offers), copying the SAME `storeId` (null for a tenant-wide
-- offer) onto those child rows. Both tables were left at `store_id NOT NULL`
-- from the original baseline schema, so creating ANY tenant-wide offer fails
-- with `ER_BAD_NULL_ERROR: Column 'store_id' cannot be null` on the very
-- first `INSERT INTO offer_rules` — confirmed via a live createOffer()
-- request's server-side stack trace, not guessed.
--
-- Relaxing both to match `promotional_offers` closes the gap: a NULL
-- store_id on a rule/tier row means "belongs to a tenant-wide offer",
-- consistent with the parent offer's own store_id being NULL.
--
-- SAFETY
-- ------
-- Idempotent — INFORMATION_SCHEMA guard, skips if already nullable.
-- Non-destructive: every existing row already has a real store_id (no
-- tenant-wide offer has ever successfully been created, precisely because
-- of this bug), so no row's meaning changes.
-- =============================================================================

SET @col_nullable = (
  SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'offer_rules' AND COLUMN_NAME = 'store_id'
);
SET @sql = IF(@col_nullable = 'NO',
  'ALTER TABLE `offer_rules` MODIFY COLUMN `store_id` CHAR(36) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_nullable = (
  SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'offer_price_tiers' AND COLUMN_NAME = 'store_id'
);
SET @sql = IF(@col_nullable = 'NO',
  'ALTER TABLE `offer_price_tiers` MODIFY COLUMN `store_id` VARCHAR(36) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
