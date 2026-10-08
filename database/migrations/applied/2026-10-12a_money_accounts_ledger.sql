-- ============================================================================
-- Money accounts + double-entry ledger — the "where does money sit" foundation
-- 2026-10-12
--
-- Before this migration every money event was recorded in its own table
-- (sales.payment_method, outgoing_payments, layaway_payments, …) with no
-- notion of WHICH account held the money and no unified movement history.
-- This adds:
--
--   money_accounts          — chart of accounts, seeded per tenant with a
--                             small system set (Cash in Hand, Bank, Card
--                             Clearing, A/R, A/P, Tax Payable, Sales,
--                             deferred-revenue liability accounts, Purchases,
--                             Operating Expenses, Cash Over/Short, Equity).
--                             account_type drives the normal-balance side:
--                             asset/expense are debit-normal, the rest are
--                             credit-normal. Tenants can add custom accounts;
--                             is_system rows are posting targets and must not
--                             be deleted (deactivate instead).
--
--   money_journal_entries   — one balanced entry per money event. status
--                             'posted' entries are immutable; a void is a
--                             separate reversal entry linked via
--                             reversal_of_id (the original flips to 'voided'
--                             but stays for audit). UNIQUE(tenant_id,
--                             source_type, source_id) makes posting
--                             idempotent — a sale/payment can't post twice.
--
--   money_journal_lines     — the debit/credit legs. Exactly one of
--                             debit/credit is > 0 per line (CHECK). Customer/
--                             supplier refs give subledger tracing without
--                             FK coupling to modules that may not exist.
--
--   finance_account_mappings— posting map: which account a business event
--                             hits. mapping_key examples: 'tender:cash',
--                             'tender:card', 'tender:on_account',
--                             'event:revenue', 'event:tax', 'event:expense',
--                             'event:over_short'. Tenant-editable so custom
--                             accounts can be wired in without code changes.
--
-- No runtime code writes these tables yet except the posting service; each
-- business module hooks in separately (sales, payments, drawer sessions).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + INSERT IGNORE / NOT EXISTS.
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 1. money_accounts — chart of accounts (money buckets)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `money_accounts` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NULL COMMENT 'NULL = tenant-level account; set for per-store cash drawers/safes',
  `code` VARCHAR(40) NOT NULL COMMENT 'Tenant-unique ledger code, e.g. CASH, BANK, CARDCLR',
  `name` VARCHAR(120) NOT NULL,
  `account_type` ENUM('asset','liability','equity','revenue','expense') NOT NULL,
  `subtype` VARCHAR(40) NULL COMMENT 'cash_drawer|bank|petty_cash|safe|card_clearing|receivable|payable|tax_payable|sales|sales_returns|deferred_revenue|purchases|operating|cash_over_short|opening_balance',
  `opening_balance` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Seeded posting target — may be renamed but not deleted',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_acct_tenant_code` (`tenant_id`, `code`),
  KEY `idx_acct_tenant_store` (`tenant_id`, `store_id`),
  KEY `idx_acct_tenant_type` (`tenant_id`, `account_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 2. money_journal_entries — posted movement headers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `money_journal_entries` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NULL,
  `entry_number` VARCHAR(40) NULL COMMENT 'Human ref, e.g. JE-2026-000123',
  `entry_date` DATE NOT NULL,
  `source_type` VARCHAR(40) NULL COMMENT 'sale|sale_return|outgoing_payment|expense|layaway_payment|savings_payment|refund|transfer|drawer_session|manual|opening_balance',
  `source_id` CHAR(36) NULL COMMENT 'Originating record id (sale id, payment id, …)',
  `memo` VARCHAR(255) NULL,
  `status` ENUM('posted','voided') NOT NULL DEFAULT 'posted',
  `reversal_of_id` CHAR(36) NULL COMMENT 'Set on the reversal entry; points back at the entry it voids',
  `created_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_entry_source` (`tenant_id`, `source_type`, `source_id`),
  KEY `idx_entry_tenant_date` (`tenant_id`, `entry_date`),
  KEY `idx_entry_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 3. money_journal_lines — debit/credit legs (exactly one side > 0)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `money_journal_lines` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `entry_id` CHAR(36) NOT NULL,
  `line_no` SMALLINT NOT NULL DEFAULT 1,
  `account_id` CHAR(36) NOT NULL,
  `debit` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `credit` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `memo` VARCHAR(255) NULL,
  `customer_id` CHAR(36) NULL COMMENT 'Optional subledger trace — no FK, modules own their rows',
  `supplier_id` CHAR(36) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_line_one_side` CHECK ((`debit` > 0) <> (`credit` > 0)),
  CONSTRAINT `chk_line_nonneg` CHECK (`debit` >= 0 AND `credit` >= 0),
  KEY `idx_line_entry` (`entry_id`),
  KEY `idx_line_tenant_account` (`tenant_id`, `account_id`),
  KEY `idx_line_customer` (`customer_id`),
  KEY `idx_line_supplier` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 4. finance_account_mappings — posting map (which account each event hits)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `finance_account_mappings` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `mapping_key` VARCHAR(60) NOT NULL COMMENT 'tender:<method-code> or event:<name>',
  `account_id` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_map_tenant_key` (`tenant_id`, `mapping_key`),
  KEY `idx_map_account` (`account_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 5. Seed the system chart of accounts for every existing tenant.
--    New tenants get the same set via moneyPostingService.ensureDefaults()
--    (the constants there are the source of truth — keep in sync).
--    INSERT IGNORE + uq_acct_tenant_code makes this re-runnable.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `money_accounts`
  (`id`, `tenant_id`, `store_id`, `code`, `name`, `account_type`, `subtype`, `opening_balance`, `is_system`, `is_active`)
SELECT UUID(), t.id, NULL, v.code, v.name, v.account_type, v.subtype, 0.00, 1, 1
FROM `tenants` t
JOIN (
  SELECT 'CASH'      AS code, 'Cash in Hand'               AS name, 'asset'     AS account_type, 'cash'              AS subtype
  UNION ALL SELECT 'BANK',      'Bank — Main',                        'asset',     'bank'
  UNION ALL SELECT 'SAFE',      'Store Safe',                         'asset',     'safe'
  UNION ALL SELECT 'CARDCLR',   'Card Clearing',                      'asset',     'card_clearing'
  UNION ALL SELECT 'AR',        'Accounts Receivable',                'asset',     'receivable'
  UNION ALL SELECT 'AP',        'Accounts Payable',                   'liability', 'payable'
  UNION ALL SELECT 'TAXPAY',    'Tax Payable',                        'liability', 'tax_payable'
  UNION ALL SELECT 'LAYDEF',    'Deferred Revenue — Layaways',        'liability', 'deferred_revenue'
  UNION ALL SELECT 'SAVDEF',    'Deferred Revenue — Savings Schemes', 'liability', 'deferred_revenue'
  UNION ALL SELECT 'SALES',     'Sales Revenue',                      'revenue',   'sales'
  UNION ALL SELECT 'SALESRET',  'Sales Returns & Refunds',            'revenue',   'sales_returns'
  UNION ALL SELECT 'PURCH',     'Purchases',                          'expense',   'purchases'
  UNION ALL SELECT 'OPEXP',     'Operating Expenses',                 'expense',   'operating'
  UNION ALL SELECT 'OVERSHORT', 'Cash Over/Short',                    'expense',   'cash_over_short'
  UNION ALL SELECT 'EQUITY',    "Owner's Equity",                     'equity',    'opening_balance'
) v;

-- ---------------------------------------------------------------------------
-- 6. Seed default posting mappings for every existing tenant.
--    tender:* keys resolve a payment method to the money account it lands in;
--    event:* keys resolve the balancing leg of a business event.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `finance_account_mappings` (`id`, `tenant_id`, `mapping_key`, `account_id`)
SELECT UUID(), a.tenant_id, m.mapping_key, a.id
FROM `money_accounts` a
JOIN (
  SELECT 'CASH'      AS code, 'tender:cash'           AS mapping_key
  UNION ALL SELECT 'CARDCLR',   'tender:card'
  UNION ALL SELECT 'CARDCLR',   'tender:phone'
  UNION ALL SELECT 'CARDCLR',   'tender:stripe'
  UNION ALL SELECT 'CARDCLR',   'tender:paypal'
  UNION ALL SELECT 'BANK',      'tender:bank_transfer'
  UNION ALL SELECT 'AR',        'tender:on_account'
  UNION ALL SELECT 'SALES',     'event:revenue'
  UNION ALL SELECT 'SALESRET',  'event:returns'
  UNION ALL SELECT 'TAXPAY',    'event:tax'
  UNION ALL SELECT 'AP',        'event:payable'
  UNION ALL SELECT 'AR',        'event:receivable'
  UNION ALL SELECT 'PURCH',     'event:purchases'
  UNION ALL SELECT 'OPEXP',     'event:expense'
  UNION ALL SELECT 'LAYDEF',    'event:layaway_liability'
  UNION ALL SELECT 'SAVDEF',    'event:savings_liability'
  UNION ALL SELECT 'OVERSHORT', 'event:over_short'
  UNION ALL SELECT 'EQUITY',    'event:equity'
  UNION ALL SELECT 'BANK',      'event:default_out'   -- fallback sink for money-out with no method
  UNION ALL SELECT 'CASH',      'event:default_in'    -- fallback source for money-in with no method
) m ON m.code = a.code;
