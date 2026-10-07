-- ============================================================================
-- Finance module — expenses + outgoing payments
-- 2026-10-10
--
-- Adds the tenant-visible money-out side of the books:
--
--   expenses          — one row per business expense (rent, utilities,
--                       wages, supplier bill, misc). A PAID expense can carry
--                       a linked outgoing_payments row so the Payments page
--                       shows every dollar that left the business, not just
--                       supplier settlements.
--
--   outgoing_payments — one row per payment out. payee_type keeps the three
--                       real cases distinct without forcing a FK:
--                         'supplier' — settlement against a supplier
--                           (optionally a specific purchase_order_id; the PO's
--                           outstanding balance is derived as
--                           total_amount - SUM(payments), never stored)
--                         'expense'  — payment of an expenses row
--                         'other'    — free-form payee name
--
-- Outstanding supplier balances are computed, not stored: a PO is "owed"
-- total_amount minus its non-voided payments. Voided payments (status
-- 'voided') are kept for audit — finance records are never hard-deleted,
-- only voided.
--
-- Also seeds the new permission pair:
--   finance.view    — read expenses/payments
--   finance.manage  — create/edit/void
-- granted to Tenant Admin + Store Manager default roles (never Cashier —
-- money-out is a management function).
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + INSERT IGNORE throughout.
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 1. expenses
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `expenses` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NULL COMMENT 'NULL = tenant-level expense not tied to one store',
  `expense_number` VARCHAR(30) NULL COMMENT 'Human ref, e.g. EXP-2026-000123',
  `category` VARCHAR(100) NOT NULL,
  `payee` VARCHAR(255) NULL COMMENT 'Who was paid / who the bill is from',
  `description` VARCHAR(255) NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `expense_date` DATE NOT NULL,
  `status` ENUM('unpaid','paid','cancelled') NOT NULL DEFAULT 'unpaid',
  `payment_method` VARCHAR(50) NULL COMMENT 'cash|bank_transfer|card|cheque|mobile_money|other',
  `reference` VARCHAR(100) NULL COMMENT 'Invoice no, cheque no, receipt no',
  `supplier_id` CHAR(36) NULL COMMENT 'Optional — when the expense is a supplier bill',
  `notes` TEXT NULL,
  `created_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exp_tenant_date` (`tenant_id`, `expense_date`),
  KEY `idx_exp_tenant_status` (`tenant_id`, `status`),
  KEY `idx_exp_supplier` (`supplier_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 2. outgoing_payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `outgoing_payments` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NULL,
  `payment_number` VARCHAR(30) NULL COMMENT 'Human ref, e.g. PAY-2026-000123',
  `payee_type` ENUM('supplier','expense','other') NOT NULL,
  `payee_name` VARCHAR(255) NULL COMMENT 'Denormalized label (supplier name snapshot or free text)',
  `supplier_id` CHAR(36) NULL,
  `purchase_order_id` CHAR(36) NULL COMMENT 'Optional — applies the payment against one PO',
  `expense_id` CHAR(36) NULL COMMENT 'Set when paying an expenses row',
  `amount` DECIMAL(12,2) NOT NULL,
  `payment_date` DATE NOT NULL,
  `payment_method` VARCHAR(50) NULL,
  `reference` VARCHAR(100) NULL,
  `notes` TEXT NULL,
  `status` ENUM('completed','voided') NOT NULL DEFAULT 'completed',
  `voided_by` CHAR(36) NULL,
  `voided_at` DATETIME NULL,
  `void_reason` VARCHAR(255) NULL,
  `created_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pay_tenant_date` (`tenant_id`, `payment_date`),
  KEY `idx_pay_supplier` (`supplier_id`),
  KEY `idx_pay_po` (`purchase_order_id`),
  KEY `idx_pay_expense` (`expense_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 3. Permissions — seeded for all tenants (INSERT IGNORE keeps it idempotent)
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `permissions` (`name`, `description`, `module`, `created_at`, `updated_at`)
VALUES
  ('finance.view',   'View expenses and outgoing payments', 'finance', NOW(), NOW()),
  ('finance.manage', 'Record, edit and void expenses and outgoing payments', 'finance', NOW(), NOW());

-- Grant to the default admin/manager role rows where they exist.
-- Roles are tenant-scoped; role names match
-- permissionSeedingService.ROLE_PERMISSIONS keys. NOT EXISTS guard keeps
-- this re-runnable regardless of unique-key presence on role_permissions.
INSERT INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.name IN ('finance.view', 'finance.manage')
WHERE r.name IN ('Tenant Admin', 'Store Manager')
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );
