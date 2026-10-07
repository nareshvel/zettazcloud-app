-- ============================================================================
-- Stock count sessions — named, resumable physical counts with approval gates
-- 2026-10-09
--
-- Turns the ad-hoc Stock Count sheet into real sessions: a named count is
-- created with an optional category scope (its items are seeded at create
-- time), counts are saved per-item as they happen (so a session survives
-- device switches, dead batteries and shift handoffs), and submission either
-- posts immediately or waits for an approver — controlled by
-- requires_approval + the new inventory.count_approve permission.
--
-- Items snapshot product name/sku/barcode/expected_qty so session history
-- stays meaningful after products are renamed, repriced or deleted. The
-- delta that actually posts is still recomputed against LIVE stock at post
-- time (same semantics as POST /api/stock-counts/reconcile) — expected_qty
-- is the display baseline, not the post-time truth.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + INSERT IGNORE throughout.
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 1. Sessions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_count_sessions` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `scope_category_id` CHAR(36) NULL,
  `scope_category_name` VARCHAR(120) NULL,
  `blind` TINYINT(1) NOT NULL DEFAULT 0,
  `requires_approval` TINYINT(1) NOT NULL DEFAULT 0,
  `status` ENUM('in_progress','submitted','posted','cancelled') NOT NULL DEFAULT 'in_progress',
  `created_by` CHAR(36) NULL,
  `submitted_by` CHAR(36) NULL,
  `submitted_at` DATETIME NULL,
  `approved_by` CHAR(36) NULL,
  `approved_at` DATETIME NULL,
  `posted_at` DATETIME NULL,
  `applied_count` INT NOT NULL DEFAULT 0,
  `skipped_count` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_scs_tenant_store_status` (`tenant_id`, `store_id`, `status`),
  KEY `ix_scs_created` (`tenant_id`, `store_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 2. Session items — one row per product in the count
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `stock_count_session_items` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `session_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `product_name` VARCHAR(255) NOT NULL,
  `sku` VARCHAR(100) NULL,
  `barcode` VARCHAR(100) NULL,
  `category_name` VARCHAR(120) NULL,
  `expected_qty` DECIMAL(12,2) NOT NULL DEFAULT 0,
  `counted_qty` DECIMAL(12,2) NULL,
  `variance` DECIMAL(12,2) NULL,
  `reason_code` VARCHAR(40) NULL,
  `notes` VARCHAR(500) NULL,
  `added_during_count` TINYINT(1) NOT NULL DEFAULT 0,
  `counted_by` CHAR(36) NULL,
  `counted_at` DATETIME NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_scsi_session_product` (`session_id`, `product_id`),
  KEY `ix_scsi_tenant_session` (`tenant_id`, `session_id`),
  KEY `ix_scsi_session_barcode` (`session_id`, `barcode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 3. Permission — approver gate for submitted counts.
--    Counters use the existing inventory.adjust; this separate permission is
--    what makes "someone else approves the variance" meaningful. Granted to
--    admin/manager-flavoured default roles in permissionSeedingService.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `permissions` (`name`, `description`, `module`, `created_at`, `updated_at`)
VALUES ('inventory.count_approve', 'Review and approve submitted stock counts', 'inventory', NOW(), NOW());
