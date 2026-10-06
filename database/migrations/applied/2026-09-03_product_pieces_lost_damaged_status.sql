-- =============================================================================
-- 2026-09-03  Add 'lost' and 'damaged' to product_pieces.status
-- =============================================================================
-- WHY
-- ---
-- Cycle Count (CycleCountPage.tsx) reconciles scanned serialized pieces
-- against the expected 'available' set and shows a "Missing" list, but had
-- no way to actually act on a missing piece — its own header comment
-- claimed it could "trigger a status adjustment" and it never could. The
-- existing status vocabulary ('available','hold','sold','returned','melted')
-- has no terminal state for "counted as missing/written off" or "found but
-- unsellable" — a discrepancy could only be exported to CSV and manually
-- fixed elsewhere, with no audit trail on the piece itself.
--
-- 'lost'      — piece counted missing during a cycle count and written off.
-- 'damaged'   — piece physically found but not sellable as-is.
-- Both are excluded from syncAvailableCount()'s 'available' tally (same as
-- 'sold'/'returned'/'melted' already are), so marking a piece lost/damaged
-- correctly drops the product's stock_quantity — this is what makes the
-- action a real stock adjustment rather than just a label change.
--
-- SAFETY
-- ------
-- Adding members to an ENUM is non-destructive: existing rows keep their
-- values and the column stays NOT NULL DEFAULT 'available'. Idempotent —
-- re-running finds the members already present and does nothing.
-- =============================================================================

SET @has_lost := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'product_pieces'
    AND COLUMN_NAME = 'status'
    AND COLUMN_TYPE LIKE '%''lost''%'
);

SET @sql := IF(@has_lost = 0,
  'ALTER TABLE `product_pieces`
     MODIFY COLUMN `status`
       ENUM(''available'', ''hold'', ''sold'', ''returned'', ''melted'', ''lost'', ''damaged'')
       NOT NULL DEFAULT ''available''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
