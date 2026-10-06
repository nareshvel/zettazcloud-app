-- ============================================================================
-- Platform admin foundation (2026-10-08)
--
-- Adds everything the system-admin console needs:
--   1. tenants lifecycle columns (status, suspended_reason/at, deletion_due_at,
--      created_by) — suspend/resume/scheduled-deletion semantics
--   2. tenant_features — per-tenant feature-flag overrides (tri-state)
--   3. announcements — platform → tenant broadcast messages
--   4. support_tickets + support_ticket_messages — tenant helpdesk
--   5. job_runs — scheduled-job self-reporting for the Health page
--   6. platform permissions seeded into `permissions` (live resolution path:
--      roles/user_roles/role_permissions) AND `system_permissions` (legacy
--      display path via user_system_roles)
--   7. platform roles as `roles` rows with tenant_id NULL (the live "system
--      role" convention — see rbacService.getUserRolesAndPermissions) +
--      matching `system_roles` rows for the legacy table
--   8. The platform tenant row that staff users hang off (users.tenant_id is
--      NOT NULL, so staff need a tenant FK target)
--
-- All statements are idempotent (INFORMATION_SCHEMA checks / INSERT IGNORE /
-- INSERT ... WHERE NOT EXISTS).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. tenants lifecycle columns
-- ---------------------------------------------------------------------------
SET @ddl := IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'status'),
  'SELECT 1 -- tenants.status exists',
  'ALTER TABLE `tenants` ADD COLUMN `status` enum(''active'',''suspended'',''pending_deletion'') NOT NULL DEFAULT ''active'' AFTER `industry_code`'
);
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @ddl := IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenants' AND COLUMN_NAME = 'suspended_reason'),
  'SELECT 1 -- tenants.suspended_reason exists',
  'ALTER TABLE `tenants` ADD COLUMN `suspended_reason` VARCHAR(500) NULL AFTER `status`,
                          ADD COLUMN `suspended_at` DATETIME NULL AFTER `suspended_reason`,
                          ADD COLUMN `deletion_due_at` DATETIME NULL AFTER `suspended_at`,
                          ADD COLUMN `created_by` CHAR(36) NULL AFTER `deletion_due_at`'
);
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- 2. tenant_features — tri-state per-tenant feature overrides
--    state: 'default' (fall back to plan features), 'on', 'off'
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tenant_features` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `tenant_id` CHAR(36) NOT NULL,
  `feature_key` VARCHAR(80) NOT NULL,
  `state` ENUM('default','on','off') NOT NULL DEFAULT 'default',
  `updated_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tenant_feature` (`tenant_id`, `feature_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 3. announcements — platform → tenant broadcasts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `announcements` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `title` VARCHAR(255) NOT NULL,
  `body` TEXT,
  `severity` ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
  `audience` ENUM('all','trial','active','past_due') NOT NULL DEFAULT 'all',
  `starts_at` DATETIME NULL,
  `ends_at` DATETIME NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 4. support_tickets + messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `tenant_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NULL,
  `subject` VARCHAR(255) NOT NULL,
  `status` ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  `priority` ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_tickets_tenant` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `support_ticket_messages` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `ticket_id` CHAR(36) NOT NULL,
  `author_user_id` CHAR(36) NULL,
  `body` TEXT NOT NULL,
  `is_platform_reply` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ix_ticket_msgs` (`ticket_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 5. job_runs — scheduled-job self-reporting
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `job_runs` (
  `id` CHAR(36) NOT NULL DEFAULT (UUID()),
  `job_name` VARCHAR(80) NOT NULL,
  `started_at` DATETIME NOT NULL,
  `finished_at` DATETIME NULL,
  `status` ENUM('running','success','failure') NOT NULL DEFAULT 'running',
  `message` VARCHAR(1000) NULL,
  PRIMARY KEY (`id`),
  KEY `ix_job_runs_name` (`job_name`, `started_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 6. Platform permission names — seeded into BOTH tables.
--    `permissions` feeds the live path (roles→role_permissions→permissions,
--    resolved by rbacService.getUserRolesAndPermissions into JWT permissions).
--    `system_permissions` feeds the legacy display path
--    (permissionService.getUserPermissions via user_system_roles).
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `permissions` (`id`, `name`, `description`, `module`)
SELECT UUID(), s.name, s.description, s.module FROM (
  SELECT 'platform.view'              AS name, 'View platform dashboard and statistics' AS description, 'platform' AS module UNION ALL
  SELECT 'platform.manage',           'Manage platform settings and configuration',      'platform' UNION ALL
  SELECT 'platform.impersonate',      'Impersonate a tenant (open workspace)',           'platform' UNION ALL
  SELECT 'platform.features.manage',  'Manage per-tenant feature flags',                 'platform' UNION ALL
  SELECT 'platform.announcements.manage', 'Manage platform announcements',               'platform' UNION ALL
  SELECT 'platform.audit.view',       'View platform audit log',                         'platform' UNION ALL
  SELECT 'platform.health.view',      'View platform health/jobs',                       'platform' UNION ALL
  SELECT 'tenants.view',              'View all tenants on the platform',                'tenants' UNION ALL
  SELECT 'tenants.create',            'Create new tenants',                              'tenants' UNION ALL
  SELECT 'tenants.delete',            'Delete tenants',                                  'tenants' UNION ALL
  SELECT 'subscriptions.view',        'View all subscriptions',                          'subscriptions' UNION ALL
  SELECT 'subscriptions.create',      'Create subscriptions',                            'subscriptions' UNION ALL
  SELECT 'subscriptions.edit',        'Edit subscriptions',                              'subscriptions' UNION ALL
  SELECT 'subscriptions.delete',      'Cancel/delete subscriptions',                     'subscriptions' UNION ALL
  SELECT 'plans.view',                'View subscription plans',                         'plans' UNION ALL
  SELECT 'plans.create',              'Create subscription plans',                       'plans' UNION ALL
  SELECT 'plans.edit',                'Edit subscription plans',                         'plans' UNION ALL
  SELECT 'plans.delete',              'Delete subscription plans',                       'plans' UNION ALL
  SELECT 'support.view',              'View support tickets',                            'support' UNION ALL
  SELECT 'support.respond',           'Respond to support tickets',                      'support' UNION ALL
  SELECT 'support.escalate',          'Escalate support tickets',                        'support' UNION ALL
  SELECT 'support.close',             'Close support tickets',                           'support' UNION ALL
  SELECT 'system.logs.view',          'View system logs',                                'system' UNION ALL
  SELECT 'system.settings.view',      'View system settings',                            'system' UNION ALL
  SELECT 'system.settings.edit',      'Edit system settings',                            'system'
) s
WHERE NOT EXISTS (SELECT 1 FROM `permissions` p WHERE p.name = s.name);

INSERT IGNORE INTO `system_permissions` (`id`, `name`, `description`, `module`)
SELECT UUID(), s.name, s.description, s.module FROM (
  SELECT 'platform.impersonate' AS name, 'Impersonate a tenant (open workspace)' AS description, 'platform' AS module UNION ALL
  SELECT 'platform.features.manage',       'Manage per-tenant feature flags',                'platform' UNION ALL
  SELECT 'platform.announcements.manage',  'Manage platform announcements',                  'platform' UNION ALL
  SELECT 'platform.audit.view',            'View platform audit log',                        'platform' UNION ALL
  SELECT 'platform.health.view',           'View platform health/jobs',                      'platform'
) s
WHERE NOT EXISTS (SELECT 1 FROM `system_permissions` p WHERE p.name = s.name);

-- ---------------------------------------------------------------------------
-- 7. Platform roles.
--
--    LIVE path (authoritative for requirePermission + JWT permissions):
--      `roles` rows with tenant_id = NULL, is_system_role = 1, granted via
--      `user_roles` + `role_permissions` → `permissions`.
--      (rbacService.getUserRolesAndPermissions already accepts
--      `r.tenant_id IS NULL` rows as "system rows" — but the column itself is
--      NOT NULL in the baseline schema, so make it nullable first.)
--
--    LEGACY path (effective-permissions display):
--      `system_roles` + `system_role_permissions` → `system_permissions`.
-- ---------------------------------------------------------------------------

-- 7a. Platform tenant — staff users need a tenants row (users.tenant_id NOT
--     NULL). Fixed well-known ID so scripts and code can reference it.
INSERT INTO `tenants` (`id`, `name`, `settings`, `created_at`, `updated_at`,
                       `setup_completed`, `onboarding_step`, `status`)
SELECT '00000000-0000-0000-0000-000000000001', 'Zettaz Platform',
       JSON_OBJECT('isPlatform', 1), NOW(), NOW(), 1, 'completed', 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM `tenants` WHERE id = '00000000-0000-0000-0000-000000000001'
);

-- 7b. Bootstrap platform system user — exists so roles.created_by (FK to
--     users.id, NOT NULL) has a valid target, and as the audit actor for
--     automated platform actions. Password '!' is not a valid bcrypt hash so
--     the account can never log in — real staff are created via the console.
INSERT INTO `users` (`id`, `tenant_id`, `name`, `email`, `password_hash`,
                     `is_active`, `email_verified`, `signup_completed`,
                     `created_at`, `updated_at`)
SELECT '00000000-0000-0000-0000-000000000002',
       '00000000-0000-0000-0000-000000000001',
       'Platform System', 'system@zettaz.internal', '!',
       1, 1, 1, NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM `users` WHERE id = '00000000-0000-0000-0000-000000000002'
);

-- 7c. roles.tenant_id must allow NULL for platform/system roles
SET @ddl := IF(
  (SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'roles' AND COLUMN_NAME = 'tenant_id') = 'YES',
  'SELECT 1 -- roles.tenant_id already nullable',
  'ALTER TABLE `roles` MODIFY COLUMN `tenant_id` CHAR(36) NULL'
);
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- 7d. `roles` rows (tenant_id NULL = platform/system role)
INSERT INTO `roles` (`id`, `name`, `description`, `tenant_id`, `is_system_role`, `created_by`, `created_at`, `updated_at`)
SELECT UUID(), s.name, s.description, NULL, 1,
       '00000000-0000-0000-0000-000000000002', NOW(), NOW() FROM (
  SELECT 'System Admin'    AS name, 'Full platform administration'          AS description UNION ALL
  SELECT 'System Manager', 'Platform operations without destructive rights'               UNION ALL
  SELECT 'System Support', 'Support desk — read tenants, work tickets'
) s
WHERE NOT EXISTS (
  SELECT 1 FROM `roles` r WHERE r.name = s.name AND r.tenant_id IS NULL
);

-- 7e. role_permissions for the platform roles (live path)
--     System Admin gets every platform/system-scoped permission.
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON (
  p.name LIKE 'platform.%' OR p.name LIKE 'tenants.%' OR p.name LIKE 'subscriptions.%'
  OR p.name LIKE 'plans.%' OR p.name LIKE 'support.%' OR p.name LIKE 'system.%'
)
WHERE r.tenant_id IS NULL AND r.name = 'System Admin';

--     System Manager: views + tenant/subscription edits + support + announcements.
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.name IN (
  'platform.view','platform.audit.view','platform.health.view',
  'platform.announcements.manage','platform.features.manage',
  'tenants.view','tenants.create','tenants.edit',
  'subscriptions.view','subscriptions.edit','plans.view','plans.edit',
  'support.view','support.respond','support.escalate','support.close',
  'system.logs.view','system.settings.view'
)
WHERE r.tenant_id IS NULL AND r.name = 'System Manager';

--     System Support: read-only + tickets.
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `roles` r
JOIN `permissions` p ON p.name IN (
  'platform.view','platform.audit.view','platform.health.view',
  'tenants.view','subscriptions.view','plans.view',
  'support.view','support.respond','support.close','system.logs.view'
)
WHERE r.tenant_id IS NULL AND r.name = 'System Support';

-- 7f. `system_roles` rows (legacy display path) — reuse existing seeded names,
--     add System Admin/Manager/Support aliases only if that table lacks them.
INSERT INTO `system_roles` (`id`, `name`, `description`, `created_at`, `updated_at`)
SELECT UUID(), s.name, s.description, NOW(), NOW() FROM (
  SELECT 'System Admin'    AS name, 'Full platform administration'          AS description UNION ALL
  SELECT 'System Manager', 'Platform operations without destructive rights'               UNION ALL
  SELECT 'System Support', 'Support desk — read tenants, work tickets'
) s
WHERE NOT EXISTS (SELECT 1 FROM `system_roles` r WHERE r.name = s.name);

-- Map the new system_roles to system_permissions (same scopes as 7b).
INSERT IGNORE INTO `system_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `system_roles` r JOIN `system_permissions` p
WHERE r.name = 'System Admin';

INSERT IGNORE INTO `system_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `system_roles` r JOIN `system_permissions` p
  ON p.name IN (
    'platform.view','platform.manage','tenants.view','tenants.create','tenants.edit',
    'subscriptions.view','subscriptions.edit','plans.view','plans.edit',
    'support.view','support.respond','support.escalate','support.close',
    'system.logs.view','system.settings.view'
  )
WHERE r.name = 'System Manager';

INSERT IGNORE INTO `system_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id FROM `system_roles` r JOIN `system_permissions` p
  ON p.name IN ('platform.view','tenants.view','subscriptions.view','plans.view',
                'support.view','support.respond','support.close','system.logs.view')
WHERE r.name = 'System Support';
