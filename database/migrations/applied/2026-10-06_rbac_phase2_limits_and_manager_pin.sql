-- RBAC Phase 2d: threshold permissions + manager-PIN override
--
-- role_limits caps what a role may do WITHOUT a second person approving:
--   discount_percent  — max sale-level discount as % of subtotal
--   discount_amount   — max sale-level discount in absolute currency
--   refund_amount     — max total return amount a user may create unapproved
--
-- A blocked action can be approved inline by any active user in the tenant
-- whose role carries approvals.manager_override AND who has a pos_pin_hash
-- set — verified via bcrypt against the manager_pin sent with the request.
-- No rows = no caps = behaviour unchanged for existing tenants.
--
-- Idempotent: guarded ALTER + CREATE TABLE IF NOT EXISTS + INSERT IGNORE.

SET @pin_col := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'pos_pin_hash'
);
SET @ddl := IF(@pin_col = 0,
  'ALTER TABLE `users` ADD COLUMN `pos_pin_hash` varchar(255) NULL AFTER `password_hash`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `role_limits` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `tenant_id` char(36) NOT NULL,
  `role_id` char(36) NOT NULL,
  `limit_type` enum('discount_percent','discount_amount','refund_amount') NOT NULL,
  `limit_value` decimal(15,2) NOT NULL,
  `created_by` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_role_limits_role_type` (`role_id`,`limit_type`),
  KEY `idx_role_limits_tenant` (`tenant_id`),
  CONSTRAINT `fk_role_limits_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO permissions (name, description, module) VALUES
  ('approvals.manager_override', 'Approve over-limit refunds and discounts via manager PIN', 'approvals');
