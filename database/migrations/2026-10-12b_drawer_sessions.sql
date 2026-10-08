-- ============================================================================
-- Cash drawer sessions + money transfers — Phase 4 of the ledger rollout
-- 2026-10-12
--
--   cash_drawer_sessions    — one open drawer per store at a time. Tracks the
--                             opening float and, at close, the counted vs
--                             expected cash + variance. expected_cash is
--                             computed at close from the drawer account's
--                             ledger lines for this store during the session
--                             window (entries carry store_id). Variance posts
--                             to the Cash Over/Short account: short = Dr
--                             OVERSHORT / Cr cash; over = Dr cash / Cr
--                             OVERSHORT. The journal stays the source of truth
--                             — the session row is the operating record.
--
--   money_drawer_movements  — paid-in / paid-out activity during a session
--                             (change added from safe, petty payout from the
--                             till, …). Each row links to its journal entry.
--
-- Transfers between money accounts (drawer → safe → bank deposit) need no
-- table of their own: they are journal entries with source_type='transfer'
-- and a generated source_id, listed via GET /finance/ledger.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS.
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cash_drawer_sessions` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `account_id` CHAR(36) NOT NULL COMMENT 'money_accounts row the drawer counts against (usually subtype=cash_drawer or CASH)',
  `opening_float` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `opened_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `opened_by` CHAR(36) NULL,
  `closed_at` TIMESTAMP NULL,
  `closed_by` CHAR(36) NULL,
  `counted_cash` DECIMAL(14,2) NULL,
  `expected_cash` DECIMAL(14,2) NULL,
  `variance` DECIMAL(14,2) NULL COMMENT 'counted − expected; negative = short',
  `status` ENUM('open','closed') NOT NULL DEFAULT 'open',
  `open_marker` TINYINT GENERATED ALWAYS AS (IF(`status` = 'open', 1, NULL)) STORED COMMENT 'Non-null only while open — the unique key below enforces one open session per store; closed rows carry NULL and never collide',
  `notes` VARCHAR(500) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_drawer_open` (`tenant_id`, `store_id`, `open_marker`),
  KEY `idx_drawer_tenant_store` (`tenant_id`, `store_id`, `opened_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `money_drawer_movements` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `direction` ENUM('paid_in','paid_out') NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `reason` VARCHAR(200) NULL,
  `journal_entry_id` CHAR(36) NULL,
  `created_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dm_session` (`session_id`),
  KEY `idx_dm_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
