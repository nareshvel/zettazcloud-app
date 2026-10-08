-- ============================================================================
-- Receive-payment-on-account — closes the `customers.outstanding_credit` gap
-- 2026-10-13
--
--   customer_account_payments — a payment collected against a customer's
--   on-account (AR) balance. Each row carries its journal entry
--   (Dr tender / Cr AR, source_type='payment_received') and mirrors the
--   outgoing_payments void pattern: voids reverse the journal entry and add
--   the amount back onto outstanding_credit — rows are never hard-deleted.
--
-- The balance invariant this table enables:
--   customers.outstanding_credit
--     =  Σ on-account sales (bumped inside createSale's transaction)
--      − Σ posted customer_account_payments
--
-- Idempotent: CREATE TABLE IF NOT EXISTS.
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `customer_account_payments` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NULL,
  `customer_id` CHAR(36) NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `payment_method` VARCHAR(60) NOT NULL COMMENT 'resolved tender code — cash, card, bank_transfer, or a tenant custom method',
  `reference` VARCHAR(120) NULL COMMENT 'cheque no, txn ref, etc.',
  `notes` VARCHAR(500) NULL,
  `journal_entry_id` CHAR(36) NULL COMMENT 'money_journal_entries row (Dr tender / Cr AR)',
  `status` ENUM('posted','voided') NOT NULL DEFAULT 'posted',
  `voided_by` CHAR(36) NULL,
  `voided_at` TIMESTAMP NULL,
  `void_reason` VARCHAR(255) NULL,
  `received_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cap_tenant_cust` (`tenant_id`, `customer_id`, `created_at`),
  KEY `idx_cap_tenant_status` (`tenant_id`, `status`),
  CONSTRAINT `chk_cap_amount` CHECK (`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
