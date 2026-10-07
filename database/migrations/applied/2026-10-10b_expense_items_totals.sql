-- ============================================================================
-- Expense line items + document-style totals
-- 2026-10-10 (follow-up to 2026-10-10_finance_expenses_payments.sql)
--
-- An expense is a mini purchase document, not a single number:
--
--   expense_items       — one row per line (description / qty / unit cost /
--                         amount). The expense's `subtotal` = SUM(items).
--   expenses columns    — tax_amount, shipping_amount, discount_amount, and
--                         subtotal, all feeding the stored payable:
--                           amount = subtotal + tax + shipping - discount
--
-- `amount` stays the payable total, so payments/outstanding math is untouched.
-- An expense with no item rows treats `amount` as a directly-entered total
-- (backwards compatible with the v1 create flow).
--
-- Idempotent: IF NOT EXISTS + INFORMATION_SCHEMA-guarded ALTERs.
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 1. expense_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `expense_items` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `expense_id` CHAR(36) NOT NULL,
  `description` VARCHAR(255) NOT NULL,
  `quantity` DECIMAL(12,3) NOT NULL DEFAULT 1,
  `unit_cost` DECIMAL(12,2) NULL,
  `amount` DECIMAL(12,2) NOT NULL COMMENT 'Line total (qty x unit_cost, or entered directly)',
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_expitem_expense` (`expense_id`),
  KEY `idx_expitem_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 2. expenses — document total components
-- ---------------------------------------------------------------------------
SET @col_subtotal := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'subtotal'
);
SET @stmt := IF(@col_subtotal = 0,
  'ALTER TABLE `expenses` ADD COLUMN `subtotal` DECIMAL(12,2) NULL AFTER `amount`',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @col_tax := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'tax_amount'
);
SET @stmt := IF(@col_tax = 0,
  'ALTER TABLE `expenses` ADD COLUMN `tax_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `subtotal`',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @col_ship := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'shipping_amount'
);
SET @stmt := IF(@col_ship = 0,
  'ALTER TABLE `expenses` ADD COLUMN `shipping_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `tax_amount`',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @col_disc := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'discount_amount'
);
SET @stmt := IF(@col_disc = 0,
  'ALTER TABLE `expenses` ADD COLUMN `discount_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER `shipping_amount`',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
