-- =============================================================================
-- 2026-08-25  stores.default_sale_document_type — receipt vs. invoice per store
-- =============================================================================
-- WHY THIS LIVES ON `stores`
-- --------------------------
-- Print Module Phase 1 lets a tenant decide whether a completed POS sale
-- prints as a thermal receipt or an A4/Letter invoice, based on their business
-- (docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md §3.3). That decision is a
-- retail-profile fact about the store — same category as industry_code and
-- is_duty_free, both already on `stores` — not a printer/delivery detail, so
-- it does not belong on `print_document_settings` (which configures HOW a
-- document type is delivered, not WHICH type a sale becomes).
--
-- Idempotent per repo convention.
-- =============================================================================

SET @tbl = 'stores';
SET @col = 'default_sale_document_type';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` ENUM(''receipt'',''invoice'') NOT NULL DEFAULT ''receipt''',
         ' COMMENT ''Which document type a completed POS sale prints as. Store-level only in this phase.''')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;
