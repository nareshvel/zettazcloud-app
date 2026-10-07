-- ============================================================================
-- Expense workflows: partial payments, due dates, tax-inclusive pricing,
-- recurring expenses, approval threshold, finance.approve permission,
-- tenant_finance_settings
-- 2026-10-10 (follow-up to 2026-10-10b_expense_items_totals.sql)
--
--   status enum       — gains 'partial' (some money paid, balance open) and
--                       'pending_approval' (above tenant threshold, awaiting
--                       a finance.approve holder).
--   due_date          — unpaid/partial + past due = overdue.
--   tax_inclusive     — when 1, line-item amounts already contain the tax;
--                       tax_amount is informational and NOT added to the
--                       payable (payable = subtotal + shipping - discount).
--   is_recurring /
--   recurrence_interval /
--   next_occurrence   — a recurring expense is its own template: each
--                       occurrence materializes a new expense (child links
--                       back via recurrence_parent_id) and advances
--                       next_occurrence. platformJobs materializes daily.
--   approved_by /
--   approved_at       — audit for the approval gate.
--   tenant_finance_settings — per-tenant finance knobs; currently just
--                       expense_approval_threshold (NULL = approval off).
--
-- Idempotent: INFORMATION_SCHEMA-guarded ALTERs, INSERT IGNORE seeds.
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 1. expenses.status enum — add 'partial' and 'pending_approval'
-- ---------------------------------------------------------------------------
SET @st := (
  SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'status'
);
SET @stmt := IF(@st LIKE '%''partial''%',
  'SELECT 1',
  'ALTER TABLE `expenses` MODIFY COLUMN `status`
     ENUM(''unpaid'',''partial'',''paid'',''pending_approval'',''cancelled'')
     NOT NULL DEFAULT ''unpaid''');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- 2. New expense columns
-- ---------------------------------------------------------------------------
SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'due_date');
SET @stmt := IF(@c = 0,
  'ALTER TABLE `expenses` ADD COLUMN `due_date` DATE NULL AFTER `expense_date`',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'tax_inclusive');
SET @stmt := IF(@c = 0,
  'ALTER TABLE `expenses` ADD COLUMN `tax_inclusive` TINYINT(1) NOT NULL DEFAULT 0 AFTER `discount_amount`',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'is_recurring');
SET @stmt := IF(@c = 0,
  'ALTER TABLE `expenses` ADD COLUMN `is_recurring` TINYINT(1) NOT NULL DEFAULT 0 AFTER `notes`',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'recurrence_interval');
SET @stmt := IF(@c = 0,
  'ALTER TABLE `expenses` ADD COLUMN `recurrence_interval`
     ENUM(''weekly'',''monthly'',''quarterly'',''yearly'') NULL AFTER `is_recurring`',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'next_occurrence');
SET @stmt := IF(@c = 0,
  'ALTER TABLE `expenses` ADD COLUMN `next_occurrence` DATE NULL AFTER `recurrence_interval`',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'recurrence_parent_id');
SET @stmt := IF(@c = 0,
  'ALTER TABLE `expenses` ADD COLUMN `recurrence_parent_id` CHAR(36) NULL AFTER `next_occurrence`',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND COLUMN_NAME = 'approved_by');
SET @stmt := IF(@c = 0,
  'ALTER TABLE `expenses` ADD COLUMN `approved_by` CHAR(36) NULL AFTER `supplier_id`,
                             ADD COLUMN `approved_at` TIMESTAMP NULL DEFAULT NULL AFTER `approved_by`',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

SET @stmt := IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expenses' AND INDEX_NAME = 'idx_exp_next_occ') = 0,
  'ALTER TABLE `expenses` ADD INDEX `idx_exp_next_occ` (`next_occurrence`)',
  'SELECT 1');
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- 3. tenant_finance_settings — per-tenant finance knobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tenant_finance_settings` (
  `tenant_id` CHAR(36) NOT NULL,
  `expense_approval_threshold` DECIMAL(12,2) NULL COMMENT 'Amounts above this need finance.approve; NULL = approval off',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 4. finance.approve permission + default-role grants
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO permissions (id, name, description, created_at)
SELECT UUID(), 'finance.approve',
       'Approve expenses above the tenant approval threshold', NOW()
 WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'finance.approve');

INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
  FROM `roles` r
  JOIN `permissions` p ON p.name = 'finance.approve'
 WHERE r.name IN ('Tenant Admin', 'Store Manager')
   AND NOT EXISTS (
     SELECT 1 FROM `role_permissions` rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
   );
