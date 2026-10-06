-- RBAC Phase 2c: per-user permission overrides (grant/deny)
--
-- Lets a tenant adjust ONE user's effective permissions without cloning a
-- role for a single person (e.g. give one cashier products.edit, or deny
-- sales.delete for one store manager). store_id NULL = tenant-wide override;
-- a store-scoped row wins over a tenant-wide row for the same permission,
-- and deny wins over grant at the same scope.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS + INSERT IGNORE.
CREATE TABLE IF NOT EXISTS `user_permission_overrides` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `user_id` char(36) NOT NULL,
  `tenant_id` char(36) NOT NULL,
  `store_id` char(36) DEFAULT NULL,
  `permission_id` char(36) NOT NULL,
  `effect` enum('grant','deny') NOT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `created_by` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_upo_user_perm_scope` (`user_id`,`permission_id`,`store_id`),
  KEY `idx_upo_tenant` (`tenant_id`),
  CONSTRAINT `fk_upo_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_upo_perm` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
