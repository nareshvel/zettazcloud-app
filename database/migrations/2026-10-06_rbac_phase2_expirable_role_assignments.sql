-- RBAC Phase 2e: time-bound role assignments
--
-- Adds expires_at to user_roles so temporary elevation (e.g. a weekend
-- manager) can be expressed as data instead of remembered as a manual
-- revocation. NULL = never expires (existing rows). Expired assignments are
-- filtered at read time in rbacService.getUserRolesAndPermissions — no
-- sweeper job required, and the row remains for audit.
--
-- Idempotent per repo convention: INFORMATION_SCHEMA check + PREPARE.
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'user_roles'
    AND COLUMN_NAME = 'expires_at'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `user_roles` ADD COLUMN `expires_at` timestamp NULL DEFAULT NULL AFTER `scope`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
