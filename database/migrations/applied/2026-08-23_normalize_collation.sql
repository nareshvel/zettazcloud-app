-- =============================================================================
-- 2026-08-23 Normalize collation across legacy tables
-- =============================================================================
-- CLAUDE.md mandates utf8mb4_0900_ai_ci on every table. Eight tables predating
-- that convention still use utf8mb4_unicode_ci:
--
--   countries, customer_activity_log, customer_contacts, customers,
--   payment_methods, payment_terminals, payment_transactions,
--   tenant_payment_settings
--
-- Two of these are core: `customers` and `payment_transactions`. Any JOIN
-- between them and a correctly-collated table on a text column throws:
--   "Illegal mix of collations (utf8mb4_unicode_ci,IMPLICIT) and
--    (utf8mb4_0900_ai_ci,IMPLICIT) for operation '='"
--
-- This is the same class of bug already fixed for product_pieces in
-- 2026-08-15_fix_piece_collation.sql — this migration finishes the job.
--
-- WHY NOT FIX IT IN THE BASELINE?
-- 0000_baseline_schema.sql is a faithful reproduction of production so that a
-- fresh database matches a restored one. Silently "improving" it would make
-- fresh and existing environments diverge. Instead the baseline reproduces the
-- current state and this migration converges BOTH onto the correct collation.
--
-- SAFETY
--  * CONVERT TO CHARACTER SET re-collates every char/varchar/text column at once.
--  * Idempotent: re-running is a no-op, MySQL simply rewrites to the same collation.
--  * Guarded so it only fires when the table exists AND is not already correct,
--    which keeps it cheap on databases that are already normalized.
--
-- PERFORMANCE
--  * CONVERT TO CHARACTER SET rebuilds the table. On large `payment_transactions`
--    or `customers` this locks writes for the duration — run during a maintenance
--    window on production, or use pt-online-schema-change / gh-ost for zero downtime.
-- =============================================================================

-- Helper: convert `tbl` only if it exists and is not already utf8mb4_0900_ai_ci.
-- Repeated inline because MySQL stored procedures in migrations add more risk
-- than the duplication saves.

-- ---------------------------------------------------------------------------
-- countries
-- ---------------------------------------------------------------------------
SET @tbl = 'countries';
SET @needs = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl
     AND TABLE_COLLATION <> 'utf8mb4_0900_ai_ci'
);
SET @sql = IF(@needs > 0,
  CONCAT('ALTER TABLE `', @tbl, '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'),
  'SELECT 1 -- already normalized or table absent');
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ---------------------------------------------------------------------------
-- customer_activity_log
-- ---------------------------------------------------------------------------
SET @tbl = 'customer_activity_log';
SET @needs = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl
     AND TABLE_COLLATION <> 'utf8mb4_0900_ai_ci'
);
SET @sql = IF(@needs > 0,
  CONCAT('ALTER TABLE `', @tbl, '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'),
  'SELECT 1 -- already normalized or table absent');
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ---------------------------------------------------------------------------
-- customer_contacts
-- ---------------------------------------------------------------------------
SET @tbl = 'customer_contacts';
SET @needs = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl
     AND TABLE_COLLATION <> 'utf8mb4_0900_ai_ci'
);
SET @sql = IF(@needs > 0,
  CONCAT('ALTER TABLE `', @tbl, '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'),
  'SELECT 1 -- already normalized or table absent');
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ---------------------------------------------------------------------------
-- customers  (CORE — joined against product/sales tables constantly)
-- ---------------------------------------------------------------------------
SET @tbl = 'customers';
SET @needs = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl
     AND TABLE_COLLATION <> 'utf8mb4_0900_ai_ci'
);
SET @sql = IF(@needs > 0,
  CONCAT('ALTER TABLE `', @tbl, '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'),
  'SELECT 1 -- already normalized or table absent');
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ---------------------------------------------------------------------------
-- payment_methods
-- ---------------------------------------------------------------------------
SET @tbl = 'payment_methods';
SET @needs = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl
     AND TABLE_COLLATION <> 'utf8mb4_0900_ai_ci'
);
SET @sql = IF(@needs > 0,
  CONCAT('ALTER TABLE `', @tbl, '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'),
  'SELECT 1 -- already normalized or table absent');
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ---------------------------------------------------------------------------
-- payment_terminals
-- ---------------------------------------------------------------------------
SET @tbl = 'payment_terminals';
SET @needs = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl
     AND TABLE_COLLATION <> 'utf8mb4_0900_ai_ci'
);
SET @sql = IF(@needs > 0,
  CONCAT('ALTER TABLE `', @tbl, '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'),
  'SELECT 1 -- already normalized or table absent');
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ---------------------------------------------------------------------------
-- payment_transactions  (CORE — largest of the affected tables)
-- ---------------------------------------------------------------------------
SET @tbl = 'payment_transactions';
SET @needs = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl
     AND TABLE_COLLATION <> 'utf8mb4_0900_ai_ci'
);
SET @sql = IF(@needs > 0,
  CONCAT('ALTER TABLE `', @tbl, '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'),
  'SELECT 1 -- already normalized or table absent');
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ---------------------------------------------------------------------------
-- tenant_payment_settings
-- ---------------------------------------------------------------------------
SET @tbl = 'tenant_payment_settings';
SET @needs = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl
     AND TABLE_COLLATION <> 'utf8mb4_0900_ai_ci'
);
SET @sql = IF(@needs > 0,
  CONCAT('ALTER TABLE `', @tbl, '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci'),
  'SELECT 1 -- already normalized or table absent');
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- =============================================================================
-- Verification — should return ZERO rows after this migration
-- =============================================================================
-- SELECT TABLE_NAME, TABLE_COLLATION
--   FROM INFORMATION_SCHEMA.TABLES
--  WHERE TABLE_SCHEMA = DATABASE()
--    AND TABLE_TYPE = 'BASE TABLE'
--    AND TABLE_COLLATION <> 'utf8mb4_0900_ai_ci';
-- =============================================================================
