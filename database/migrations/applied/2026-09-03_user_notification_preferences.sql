-- =============================================================================
-- 2026-09-03  User notification preferences
-- =============================================================================
-- New table `user_notification_preferences` — one row per user, backend-enforced
-- toggles gating whether emailService.js actually sends a given email class.
-- Idempotent per repo convention: CREATE TABLE IF NOT EXISTS guard.
-- `email_low_stock` / `email_new_sale_summary` have columns ready but no
-- caller wired up yet (no such email exists in emailService.js today) — see
-- backend/routes/notificationPreferences.routes.js and
-- backend/services/subscriptionService.js for the ones that ARE enforced.
-- =============================================================================

SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_notification_preferences'),
  'SELECT 1 -- already exists',
  'CREATE TABLE `user_notification_preferences` (
     `id` CHAR(36) NOT NULL,
     `user_id` CHAR(36) NOT NULL,
     `tenant_id` CHAR(36) NOT NULL,
     `email_payment_failed` TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''Dunning email on a failed Stripe invoice payment attempt.'',
     `email_trial_ending` TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''Reserved: no sender wired up yet (no trial-ending email exists in emailService.js as of 2026-09-03).'',
     `email_subscription_renewed` TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''Reserved: no sender wired up yet (no renewal email exists in emailService.js as of 2026-09-03).'',
     `email_low_stock` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''Reserved: no sender wired up yet.'',
     `email_new_sale_summary` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''Reserved: no sender wired up yet.'',
     `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     PRIMARY KEY (`id`),
     UNIQUE KEY `uq_user_notification_preferences_user_id` (`user_id`),
     KEY `idx_user_notification_preferences_tenant_id` (`tenant_id`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci'
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;
