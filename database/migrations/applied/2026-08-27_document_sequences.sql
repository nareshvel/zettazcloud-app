-- =============================================================================
-- 2026-08-27  Sequential document numbering
-- =============================================================================
-- THE PROBLEM
-- -----------
-- Sales have no document number. `sales.id` is a UUID, and reports alias it as
-- `sale_number` — so the "invoice number" a customer sees is
-- `9f2c1a84-3b7e-4d10-...`. That is unusable on paper and unacceptable in the
-- ~165 VAT/GST jurisdictions that require invoices to carry a sequential,
-- gapless number.
--
-- WHY NOT AUTO_INCREMENT
-- ----------------------
-- The number must restart per (tenant, store, document type, period) and carry
-- a configurable prefix and width. A single AUTO_INCREMENT gives one global
-- run, leaks tenant volume to anyone who can see two of their own invoices, and
-- cannot restart annually.
--
-- WHY NOT duty_free_invoice_sequences (removed 2026-08-25)
-- -------------------------------------------------------
-- It allocated OUTSIDE the sale transaction, so a rolled-back sale still burned
-- a number and left a gap — precisely what the authorities mandating sequential
-- numbering prohibit. It was also keyed on a duty-free profile, so it could not
-- number an ordinary sale, and its UPDATE ... RETURNING is not valid MySQL.
--
-- HOW THIS ONE IS GAPLESS
-- -----------------------
-- The counter row is locked with SELECT ... FOR UPDATE **on the same connection
-- and inside the same transaction as the sale insert**. The number and the sale
-- therefore commit together or roll back together. Concurrent tills serialise
-- on the row lock for the microseconds it takes to increment.
--
-- The cost is real and worth stating: two tills selling at the same instant in
-- the same store briefly queue on this row. That is the price of gaplessness,
-- and it is why numbering is only switched on where it is needed rather than
-- being universal.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The counters
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `document_sequences` (
  `id`            char(36)     NOT NULL,
  `tenant_id`     char(36)     NOT NULL,
  `store_id`      char(36)     NOT NULL,

  -- 'sale', 'invoice', 'credit_note', 'duty_free_invoice', ...
  `doc_type`      varchar(40)  NOT NULL,

  -- The reset window. '2026' for annual, '2026-08' for monthly, 'ALL' for a
  -- run that never restarts. Storing the resolved period as a string keeps one
  -- row per active window and makes "which numbers did we issue in 2026?" a
  -- single indexed lookup.
  `period`        varchar(16)  NOT NULL DEFAULT 'ALL',

  `current_value` bigint       NOT NULL DEFAULT 0,
  `prefix`        varchar(20)           DEFAULT NULL,
  `padding`       int          NOT NULL DEFAULT 6,

  `created_at`    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- One counter per scope. This is the constraint that makes the whole thing
  -- work: without it a race could create two rows for the same scope and issue
  -- the same number twice.
  UNIQUE KEY `uk_sequence_scope` (`tenant_id`, `store_id`, `doc_type`, `period`),

  CONSTRAINT `fk_docseq_tenant` FOREIGN KEY (`tenant_id`)
    REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_docseq_store` FOREIGN KEY (`store_id`)
    REFERENCES `stores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- -----------------------------------------------------------------------------
-- 2. The issued number, on the sale
-- -----------------------------------------------------------------------------
-- Nullable: sales made before this migration have no number, and stores that do
-- not need sequential numbering never get one. NULL means "not numbered",
-- which is different from "numbered 0".
-- -----------------------------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'document_number');
SET @sql := IF(@col = 0,
  'ALTER TABLE `sales`
     ADD COLUMN `document_number` varchar(60)
       CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL
       COMMENT ''Issued sequential document number, NULL when not numbered''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- A number must be unique within a tenant. Enforced in the database rather than
-- trusted from the service, because a duplicate invoice number is the failure
-- this whole feature exists to prevent.
--
-- MySQL treats NULLs as distinct in a UNIQUE index, so unnumbered sales do not
-- collide with each other.
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'sales' AND INDEX_NAME = 'uk_sales_document_number');
SET @sql := IF(@idx = 0,
  'ALTER TABLE `sales`
     ADD UNIQUE KEY `uk_sales_document_number` (`tenant_id`, `document_number`)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- 3. Per-store opt-in
-- -----------------------------------------------------------------------------
-- Semantics, deliberately asymmetric:
--
--   jurisdiction requires it  -> ON, and the store CANNOT turn it off
--   jurisdiction does not     -> the store may opt in
--
-- A tenant must not be able to switch off something their tax authority
-- mandates, so this column can only ever ENABLE. Resolution lives in
-- documentSequenceService.isEnabledFor().
--
--   NULL / 0 -> follow the jurisdiction
--   1        -> on regardless
-- -----------------------------------------------------------------------------
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'store_jurisdiction_settings'
                AND COLUMN_NAME = 'sequential_numbering_optin');
SET @sql := IF(@col = 0,
  'ALTER TABLE `store_jurisdiction_settings`
     ADD COLUMN `sequential_numbering_optin` tinyint(1) NOT NULL DEFAULT 0
       COMMENT ''Store opts in to sequential numbering; cannot opt OUT where the jurisdiction requires it''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Reset cadence. Most EU regimes restart annually; some allow a continuous run.
SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'store_jurisdiction_settings'
                AND COLUMN_NAME = 'sequence_reset');
SET @sql := IF(@col = 0,
  'ALTER TABLE `store_jurisdiction_settings`
     ADD COLUMN `sequence_reset` enum(''never'',''yearly'',''monthly'')
       NOT NULL DEFAULT ''yearly''
       COMMENT ''When the sequential number restarts at 1''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
