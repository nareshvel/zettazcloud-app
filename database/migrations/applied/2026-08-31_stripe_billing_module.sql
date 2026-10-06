-- =============================================================================
-- 2026-08-31  Stripe Billing Module — plans/subscriptions Stripe columns +
--             stripe_webhook_events + subscription_history
-- =============================================================================
-- Adds the columns/tables needed to drive real Stripe Checkout + Billing
-- Portal subscriptions on top of the existing trial-only `subscriptions` flow
-- (see docs/17-migration-and-roadmap/17_Stripe_Billing_Module.md for the full
-- architecture). Idempotent per repo convention: INFORMATION_SCHEMA guard +
-- PREPARE/EXECUTE for every DDL statement. Collation left to inherit the
-- table default (utf8mb4_0900_ai_ci per CLAUDE.md) — no explicit column
-- collation is set here, so no ALTER ... CONVERT TO is needed later.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- plans.stripe_price_id_monthly / stripe_price_id_yearly
-- -----------------------------------------------------------------------------
SET @tbl = 'plans';
SET @col = 'stripe_price_id_monthly';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` VARCHAR(128) NULL',
         ' COMMENT ''Stripe Price ID for the monthly billing cycle of this plan. Populated manually by the user after creating the Product/Price in the Stripe dashboard.''')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @tbl = 'plans';
SET @col = 'stripe_price_id_yearly';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` VARCHAR(128) NULL',
         ' COMMENT ''Stripe Price ID for the yearly billing cycle of this plan. Populated manually by the user after creating the Product/Price in the Stripe dashboard.''')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- -----------------------------------------------------------------------------
-- subscriptions.stripe_customer_id / stripe_subscription_id (+ indexes)
-- -----------------------------------------------------------------------------
SET @tbl = 'subscriptions';
SET @col = 'stripe_customer_id';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` VARCHAR(255) NULL COMMENT ''Stripe Customer ID for this tenant.''')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @tbl = 'subscriptions';
SET @idx = 'idx_subscriptions_stripe_customer_id';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND INDEX_NAME = @idx),
  'SELECT 1 -- already exists',
  CONCAT('CREATE INDEX `', @idx, '` ON `', @tbl, '` (`stripe_customer_id`)')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @tbl = 'subscriptions';
SET @col = 'stripe_subscription_id';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` VARCHAR(255) NULL COMMENT ''Stripe Subscription ID currently backing this row.''')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @tbl = 'subscriptions';
SET @idx = 'idx_subscriptions_stripe_subscription_id';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND INDEX_NAME = @idx),
  'SELECT 1 -- already exists',
  CONCAT('CREATE INDEX `', @idx, '` ON `', @tbl, '` (`stripe_subscription_id`)')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- -----------------------------------------------------------------------------
-- subscriptions.payment_method — simple label, NOT tied to the in-store
-- payment_methods table (that's a different concept: how a POS sale was
-- paid). Values used by this module: 'stripe' | 'manual'.
-- -----------------------------------------------------------------------------
SET @tbl = 'subscriptions';
SET @col = 'payment_method';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` VARCHAR(32) NULL COMMENT ''Free-form billing-method label, e.g. stripe/manual. Not an FK to payment_methods.''')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- -----------------------------------------------------------------------------
-- subscriptions.billing_cycle
-- -----------------------------------------------------------------------------
SET @tbl = 'subscriptions';
SET @col = 'billing_cycle';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` ENUM(''monthly'',''yearly'') NOT NULL DEFAULT ''monthly''')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- -----------------------------------------------------------------------------
-- subscriptions.cancel_at_period_end
-- -----------------------------------------------------------------------------
SET @tbl = 'subscriptions';
SET @col = 'cancel_at_period_end';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` TINYINT(1) NOT NULL DEFAULT 0 COMMENT ''Set when the tenant cancels but keeps access through the current paid period.''')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- -----------------------------------------------------------------------------
-- subscriptions.grace_period_ends_at
-- -----------------------------------------------------------------------------
SET @tbl = 'subscriptions';
SET @col = 'grace_period_ends_at';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` DATE NULL COMMENT ''Set after the 3rd failed payment attempt (dunning). Read-only/limited access allowed until this date.''')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- -----------------------------------------------------------------------------
-- New table: stripe_webhook_events (idempotent webhook processing)
-- -----------------------------------------------------------------------------
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stripe_webhook_events'),
  'SELECT 1 -- already exists',
  'CREATE TABLE `stripe_webhook_events` (
     `id` CHAR(36) NOT NULL,
     `stripe_event_id` VARCHAR(255) NOT NULL,
     `event_type` VARCHAR(100) NOT NULL,
     `status` ENUM(''processing'',''processed'',''failed'') NOT NULL DEFAULT ''processing'',
     `error_message` TEXT NULL,
     `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     PRIMARY KEY (`id`),
     UNIQUE KEY `uq_stripe_webhook_events_event_id` (`stripe_event_id`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci'
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- -----------------------------------------------------------------------------
-- New table: subscription_history (audit trail)
-- event_type is a free-form varchar (documented set, not an enforced enum):
--   trial_started, checkout_started, subscription_activated, payment_succeeded,
--   payment_failed, grace_period_started, subscription_cancelled,
--   subscription_restored, plan_changed
-- -----------------------------------------------------------------------------
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_history'),
  'SELECT 1 -- already exists',
  'CREATE TABLE `subscription_history` (
     `id` CHAR(36) NOT NULL,
     `tenant_id` CHAR(36) NOT NULL,
     `subscription_id` CHAR(36) NULL,
     `event_type` VARCHAR(64) NOT NULL,
     `metadata` JSON NULL,
     `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
     PRIMARY KEY (`id`),
     KEY `idx_subscription_history_tenant_id` (`tenant_id`),
     KEY `idx_subscription_history_subscription_id` (`subscription_id`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci'
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;
