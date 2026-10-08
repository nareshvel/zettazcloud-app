-- ============================================================================
-- Finance completeness round 2 — closes the remaining design-level gaps from
-- docs/MODULES/finance/MONEY_ACCOUNTS_AND_LEDGER.md §6
-- 2026-10-14
--
--   1. New seeded accounts: INVENTORY (asset), COGS (expense), FORFINC
--      (revenue — forfeited deposits, so cancel-forfeits stop inflating SALES).
--   2. New seeded mappings: event:inventory, event:cogs,
--      event:forfeited_deposits. (event:payable→AP already exists from 10-12a;
--      supplier payments now debit it for accrual treatment.)
--   3. accounting_period_locks — one row per tenant; postEntry refuses any
--      journal whose entry_date <= locked_through.
--   4. money_reconciliations + money_journal_lines.reconciliation_id —
--      statement reconciliation sessions; lines get marked cleared against a
--      session.
--   5. tax_remissions — audit trail for TAXPAY remittance postings.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS / INSERT IGNORE / INFORMATION_SCHEMA
-- column guard.
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 1. Period locks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `accounting_period_locks` (
  `tenant_id` CHAR(36) NOT NULL,
  `locked_through` DATE NOT NULL COMMENT 'journal entries dated on/before this are rejected',
  `locked_by` CHAR(36) NULL,
  `locked_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `notes` VARCHAR(255) NULL,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 2. Bank/account reconciliation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `money_reconciliations` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `account_id` CHAR(36) NOT NULL,
  `statement_date` DATE NOT NULL,
  `statement_balance` DECIMAL(14,2) NOT NULL,
  `cleared_balance` DECIMAL(14,2) NULL COMMENT 'ledger balance of cleared lines at completion',
  `difference` DECIMAL(14,2) NULL COMMENT 'statement_balance - cleared_balance at completion',
  `adjustment_entry_id` CHAR(36) NULL COMMENT 'journal entry posted to book the residual',
  `status` ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress',
  `created_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `idx_recon_tenant_acct` (`tenant_id`, `account_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'money_journal_lines'
     AND COLUMN_NAME = 'reconciliation_id'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `money_journal_lines`
     ADD COLUMN `reconciliation_id` CHAR(36) NULL AFTER `supplier_id`,
     ADD KEY `idx_line_recon` (`reconciliation_id`)',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 3. Tax remittance audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tax_remissions` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `period_from` DATE NULL,
  `period_to` DATE NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `paid_from_account_id` CHAR(36) NULL COMMENT 'account debited... credited — the tender the remit left through',
  `journal_entry_id` CHAR(36) NULL COMMENT 'Dr TAXPAY / Cr tender entry',
  `reference` VARCHAR(120) NULL,
  `notes` VARCHAR(500) NULL,
  `created_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_taxrem_tenant` (`tenant_id`, `created_at`),
  CONSTRAINT `chk_taxrem_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 4. New seeded accounts (INSERT IGNORE — safe to re-run; new tenants get the
--    same set via moneyPostingService.ensureDefaults — keep in sync).
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `money_accounts`
  (`id`, `tenant_id`, `store_id`, `code`, `name`, `account_type`, `subtype`, `opening_balance`, `is_system`, `is_active`)
SELECT UUID(), t.id, NULL, v.code, v.name, v.account_type, v.subtype, 0.00, 1, 1
FROM `tenants` t
JOIN (
  SELECT 'INVENTORY' AS code, 'Inventory on Hand'           AS name, 'asset'   AS account_type, 'inventory'     AS subtype
  UNION ALL SELECT 'COGS',     'Cost of Goods Sold',                  'expense',  'cogs'
  UNION ALL SELECT 'FORFINC',  'Forfeited Deposit Income',            'revenue',  'forfeited_deposits'
) v;

-- ---------------------------------------------------------------------------
-- 5. New seeded mappings.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `finance_account_mappings` (`id`, `tenant_id`, `mapping_key`, `account_id`)
SELECT UUID(), a.tenant_id, m.mapping_key, a.id
FROM `money_accounts` a
JOIN (
  SELECT 'INVENTORY' AS code, 'event:inventory'           AS mapping_key
  UNION ALL SELECT 'COGS',    'event:cogs'
  UNION ALL SELECT 'FORFINC', 'event:forfeited_deposits'
) m ON m.code = a.code;
