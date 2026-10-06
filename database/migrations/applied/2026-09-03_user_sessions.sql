-- =============================================================================
-- 2026-09-03  User sessions / login history + real revocation
-- =============================================================================
-- New table `user_sessions`. Each row's `id` becomes the JWT's `sid` claim at
-- issuance time (see backend/middleware/unifiedAuthMiddleware.js `login`, and
-- the pending-2FA verify flow in backend/routes/twoFactor.routes.js /
-- authRoutes.js). `authenticate` looks this row up on every request when a
-- `sid` claim is present; a MISSING `sid` (tokens issued before this change)
-- MUST fail open — see the comment on that check in unifiedAuthMiddleware.js.
-- Idempotent per repo convention: CREATE TABLE IF NOT EXISTS guard.
-- =============================================================================

SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_sessions'),
  'SELECT 1 -- already exists',
  'CREATE TABLE `user_sessions` (
     `id` CHAR(36) NOT NULL COMMENT ''Also used as the JWT `sid` claim for the token issued at creation of this row.'',
     `user_id` CHAR(36) NOT NULL,
     `tenant_id` CHAR(36) NULL,
     `ip_address` VARCHAR(64) NULL,
     `user_agent` TEXT NULL,
     `device_label` VARCHAR(255) NULL COMMENT ''Best-effort human label derived from the User-Agent header, e.g. "Chrome on macOS".'',
     `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     `last_active_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     `revoked_at` DATETIME NULL,
     PRIMARY KEY (`id`),
     KEY `idx_user_sessions_user_id` (`user_id`),
     KEY `idx_user_sessions_revoked_at` (`revoked_at`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci'
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;
