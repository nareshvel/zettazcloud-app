-- =============================================================================
-- 2026-09-03  Add products.is_serialized (never actually applied to the live DB)
-- =============================================================================
-- WHY
-- ---
-- database/migrations/applied/2026-08-08_serialized_inventory.sql already
-- contains this exact ADD COLUMN, and its filename is in the applied/
-- directory — but `npm run migrate:status` shows it is NOT among the 60
-- migrations actually recorded as run against the live database. What
-- actually ran was a differently-named, later file,
-- 2026-08-15_serialized_inventory.sql, which only creates the
-- product_pieces / product_piece_sequences tables and never touches
-- `products` at all. The 2026-08-08 file was superseded by the 2026-08-15
-- one for the table-creation part, but its own products.is_serialized
-- column addition was never carried over or re-run — the same "migration
-- file exists in applied/ but was never actually applied" class of gap
-- CLAUDE.md's Print Module Phase 1 incident (Iteration 17.2) already warns
-- about. `syncAvailableCount()` in productPieces.routes.js has been writing
-- `is_serialized = 1` on every piece creation since that route shipped —
-- on a database missing this column that update itself would error, so any
-- tenant that has ever successfully created a serialized piece already has
-- an equivalent column from some other path; this migration is the
-- guarded, idempotent way to guarantee it exists everywhere before any code
-- (including the new bulk Stock Count tool) filters on it directly in a
-- WHERE clause, where a missing column is a hard error rather than a
-- silently-wrong write.
--
-- SAFETY
-- ------
-- Idempotent — INFORMATION_SCHEMA guard, skips if the column already exists
-- (e.g. on a database where it really was added some other way already).
-- Non-destructive: DEFAULT 0 for every existing row, matching the meaning
-- "not serialized" for every product created before this flag existed.
-- =============================================================================

SET @col := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND COLUMN_NAME = 'is_serialized'
);
SET @sql := IF(@col = 0,
  'ALTER TABLE `products` ADD COLUMN `is_serialized` tinyint(1) NOT NULL DEFAULT 0 COMMENT ''1 = tracked per physical piece (product_pieces)''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
