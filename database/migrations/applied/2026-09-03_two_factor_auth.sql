-- =============================================================================
-- 2026-09-03  TOTP two-factor authentication
-- =============================================================================
-- Adds `users.totp_secret` / `users.totp_enabled`, plus a new
-- `user_backup_codes` table. Idempotent per repo convention:
-- INFORMATION_SCHEMA guard + PREPARE/EXECUTE for the ALTER TABLE, and
-- CREATE TABLE IF NOT EXISTS for the new table.
--
-- KNOWN LIMITATION: `users.totp_secret` is stored as plaintext varchar — there
-- is no app-level encryption-at-rest helper anywhere in this backend today.
-- Anyone with DB read access (or a SQL injection elsewhere) can read a user's
-- TOTP seed. Follow-up: encrypt this column (e.g. via a KMS-backed envelope
-- key) before treating 2FA as a real defense against a DB compromise.
-- =============================================================================

SET @tbl = 'users';
SET @col = 'totp_secret';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` VARCHAR(255) NULL COMMENT ''TOTP seed, base32. PLAINTEXT — no app-level encryption-at-rest exists yet, see migration header.''')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @tbl = 'users';
SET @col = 'totp_enabled';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` TINYINT(1) NOT NULL DEFAULT 0')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- -----------------------------------------------------------------------------
-- New table: user_backup_codes
-- -----------------------------------------------------------------------------
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_backup_codes'),
  'SELECT 1 -- already exists',
  'CREATE TABLE `user_backup_codes` (
     `id` CHAR(36) NOT NULL,
     `user_id` CHAR(36) NOT NULL,
     `code_hash` VARCHAR(255) NOT NULL COMMENT ''bcrypt hash of a single-use backup code.'',
     `used_at` DATETIME NULL,
     `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (`id`),
     KEY `idx_user_backup_codes_user_id` (`user_id`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci'
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;
