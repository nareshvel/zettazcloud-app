-- ============================================================================
-- Sale-item unit cost snapshot — 2026-10-14
--
-- COGS posts at sale time from the live valuation source (store listing WAC →
-- product WAC → cost fallbacks). Persisting the per-unit cost on the sale item
-- freezes that basis so sales-return restores and margin reports can reproduce
-- the original COGS even after later GRNs move the weighted average.
--
-- NULL means "no cost basis was known at sale time" (or the row predates this
-- column) — readers must fall back to the live valuation source, never treat
-- NULL as 0 cost for old rows.
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'sale_items'
     AND COLUMN_NAME = 'unit_cost'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `sale_items` ADD COLUMN `unit_cost` DECIMAL(12,2) NULL AFTER `price`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
