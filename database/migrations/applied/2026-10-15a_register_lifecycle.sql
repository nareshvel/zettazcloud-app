-- ============================================================================
-- Cash Register lifecycle — 2026-10-15
--
--   1. cash_drawer_sessions.session_no — human-readable session number
--      (REG-0001…) shown on the Z/X report and history, backfilled for
--      existing rows in opened_at order per tenant.
--   2. register.* permission catalog entries — drawer endpoints used to share
--      finance.manage, which Cashier never holds. Dedicated perms let a
--      tenant grant open/close/movement without exposing expenses & journals.
--   3. Grants for the seeded role names (Tenant Admin, Store Manager,
--      Cashier). Custom roles are untouched — grant per tenant as needed.
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- 1a. session_no column ------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'cash_drawer_sessions'
     AND COLUMN_NAME = 'session_no'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `cash_drawer_sessions` ADD COLUMN `session_no` VARCHAR(20) NULL AFTER `id`, ADD INDEX `idx_drawer_session_no` (`session_no`)',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 1b. Backfill per tenant, in open order --------------------------------------
UPDATE `cash_drawer_sessions` s
JOIN (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY opened_at, created_at) AS rn
    FROM `cash_drawer_sessions`
) x ON x.id = s.id
   SET s.session_no = CONCAT('REG-', LPAD(x.rn, 4, '0'))
 WHERE s.session_no IS NULL;

-- 2. Permission catalog entries ----------------------------------------------
INSERT IGNORE INTO `permissions` (`id`, `name`, `description`, `module`, `created_at`, `updated_at`) VALUES
  (UUID(), 'register.view',     'View the cash register, session history and X/Z reports', 'register', NOW(), NOW()),
  (UUID(), 'register.open',     'Open a register session and set the starting float',      'register', NOW(), NOW()),
  (UUID(), 'register.movement', 'Record paid-ins and paid-outs on an open register',       'register', NOW(), NOW()),
  (UUID(), 'register.close',    'Close a register session and post the cash variance',     'register', NOW(), NOW());

-- 3. Grant to seeded role names on every tenant -------------------------------
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
  FROM `roles` r
  JOIN `permissions` p
    ON p.name IN ('register.view', 'register.open', 'register.movement', 'register.close')
 WHERE r.name IN ('Tenant Admin', 'Store Manager', 'Cashier');
