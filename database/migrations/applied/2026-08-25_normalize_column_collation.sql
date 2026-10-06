-- =============================================================================
-- 2026-08-25  Normalise COLUMN-level collation
-- =============================================================================
-- THE BUG
-- -------
-- 2026-08-23_normalize_collation.sql fixed TABLE collation. It did not fix
-- COLUMN collation, and MySQL tracks the two independently: a column that
-- carries an explicit `COLLATE utf8mb4_unicode_ci` keeps it even after the
-- table default changes.
--
-- 47 columns across 8 tables were left on utf8mb4_unicode_ci. Six of them are
-- foreign keys pointing at utf8mb4_0900_ai_ci parents, so any JOIN across them
-- raises:
--
--     Illegal mix of collations (utf8mb4_unicode_ci,IMPLICIT)
--       and (utf8mb4_0900_ai_ci,IMPLICIT) for operation '='
--
--   payment_transactions.sale_id          -> sales.id
--   payment_transactions.tenant_id        -> tenants.id
--   customer_activity_log.customer_id     -> customers.id
--   customer_contacts.customer_id         -> customers.id
--   payment_methods.tenant_id             -> tenants.id
--   payment_terminals.tenant_id           -> tenants.id
--   tenant_payment_settings.tenant_id     -> tenants.id
--
-- This is LATENT, not currently firing: no query in the codebase joins these
-- tables yet. It fires the first time someone writes the obvious reporting
-- query — "payments by sale" — which is squarely on the roadmap. Fixing it now
-- costs one migration; fixing it later costs a debugging session on a query
-- that looks perfectly correct.
--
-- WHY `CONVERT TO` RATHER THAN PER-COLUMN `MODIFY`
-- ------------------------------------------------
-- CONVERT TO rewrites every character column in the table without restating
-- its definition. Per-column MODIFY requires repeating the full type, NULL-ability,
-- DEFAULT and COMMENT of each of the 47 columns — and any transcription slip
-- silently drops a constraint. CONVERT TO cannot make that class of mistake.
--
-- SAFETY
-- ------
-- * Idempotent: re-running is a no-op, MySQL skips columns already correct.
-- * FOREIGN_KEY_CHECKS is disabled only for the duration of this file. Parent
--   and child are converted together, so no dangling reference can be created.
-- * These are varchar/text/enum columns; CONVERT TO between utf8mb4 collations
--   does not change stored bytes, only comparison rules. No data loss.
-- =============================================================================

SET @fk_checks_was = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE `countries`               CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `customers`               CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `customer_activity_log`   CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `customer_contacts`       CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `payment_methods`         CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `payment_terminals`       CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `payment_transactions`    CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
ALTER TABLE `tenant_payment_settings` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS = @fk_checks_was;

-- -----------------------------------------------------------------------------
-- Assertion: fail loudly if any character column anywhere is still off-standard.
--
-- A migration that silently half-works is worse than one that fails, because
-- the next person inherits a schema that looks fixed. SIGNAL aborts the run.
-- -----------------------------------------------------------------------------
SET @stragglers = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND COLLATION_NAME IS NOT NULL
    AND COLLATION_NAME <> 'utf8mb4_0900_ai_ci'
);

SET @msg = CONCAT('Column collation normalisation incomplete: ', @stragglers,
                  ' column(s) are still not utf8mb4_0900_ai_ci');

-- MySQL has no IF at statement level outside routines, so drive SIGNAL through
-- a prepared statement that is only ever a no-op when the count is zero.
SET @assert = IF(@stragglers = 0,
  'SELECT 1',
  CONCAT('SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ', QUOTE(@msg)));

PREPARE stmt FROM @assert;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
