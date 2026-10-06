
-- System-level permissions (managed by platform admins)
CREATE TABLE `system_permissions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `description` text,
  `module` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_system_permissions_name` (`name`)
);

-- System-level roles (platform admin, support, etc.)
CREATE TABLE `system_roles` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(50) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- System role permissions mapping
CREATE TABLE `system_role_permissions` (
  `role_id` char(36) NOT NULL,
  `permission_id` char(36) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `idx_srp_permission` (`permission_id`),
  CONSTRAINT `fk_srp_permission` FOREIGN KEY (`permission_id`) REFERENCES `system_permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_srp_role` FOREIGN KEY (`role_id`) REFERENCES `system_roles` (`id`) ON DELETE CASCADE
);

-- User system role assignments
CREATE TABLE `user_system_roles` (
  `user_id` char(36) NOT NULL,
  `role_id` char(36) NOT NULL,
  `assigned_by` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`role_id`),
  KEY `idx_usr_role` (`role_id`),
  CONSTRAINT `fk_usr_role` FOREIGN KEY (`role_id`) REFERENCES `system_roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_usr_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

-- Tenant-specific permissions
CREATE TABLE `permissions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `description` text,
  `module` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_permissions_name` (`name`)
);

-- Tenant-specific roles
CREATE TABLE `roles` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `tenant_id` char(36) NOT NULL,
  `name` varchar(50) NOT NULL,
  `description` text,
  `is_system_role` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` char(36) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_roles_tenant` (`tenant_id`),
  CONSTRAINT `fk_roles_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_roles_created_by` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
);

-- Role permissions mapping
CREATE TABLE `role_permissions` (
  `role_id` char(36) NOT NULL,
  `permission_id` char(36) NOT NULL,
  PRIMARY KEY (`role_id`,`permission_id`),
  KEY `idx_rp_permission` (`permission_id`),
  CONSTRAINT `fk_rp_permission` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rp_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
);

CREATE TABLE `user_roles` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `user_id` char(36) NOT NULL,
  `role_id` char(36) NOT NULL,
  `store_id` char(36) DEFAULT NULL,
  `scope` enum('tenant','store') NOT NULL DEFAULT 'tenant',
  `assigned_by` char(36) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_role_scope` (`user_id`, `role_id`, `scope`, `store_id`),
  KEY `idx_ur_role` (`role_id`),
  KEY `idx_ur_scope` (`scope`,`store_id`),
  CONSTRAINT `fk_ur_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ur_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ur_store` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE
);


-- Subscription plans
CREATE TABLE `plans` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `name` varchar(100) NOT NULL,
  `description` text,
  `price_monthly` decimal(10,2) NOT NULL,
  `price_yearly` decimal(10,2) DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'USD',
  `features` json DEFAULT NULL,
  `limits` json DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);

-- Tenant subscriptions
CREATE TABLE `subscriptions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `tenant_id` char(36) NOT NULL,
  `plan_id` char(36) NOT NULL,
  `status` enum('active','trial','expired','cancelled','pending') NOT NULL DEFAULT 'pending',
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `trial_end_date` date DEFAULT NULL,
  `auto_renew` tinyint(1) NOT NULL DEFAULT '0',
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sub_tenant` (`tenant_id`),
  KEY `idx_sub_plan` (`plan_id`),
  KEY `idx_sub_status` (`status`),
  CONSTRAINT `fk_sub_tenant` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sub_plan` FOREIGN KEY (`plan_id`) REFERENCES `plans` (`id`)
);
