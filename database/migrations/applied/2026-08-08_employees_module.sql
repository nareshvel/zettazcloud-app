-- Migration: Minimal employee module for sales performance, targets & incentives
-- Date: 2026-08-08
-- Scope: intentionally lean. Full payroll (salary, tax, attendance) is delegated
--        to the Paytime application via paytime_employee_id. This module only
--        holds what the POS needs for performance audit, targets and commissions.
-- Idempotent.

CREATE TABLE IF NOT EXISTS `employees` (
  `id`                 char(36)     NOT NULL,
  `tenant_id`          char(36)     NOT NULL,
  `store_id`           char(36)     DEFAULT NULL,
  `user_id`            char(36)     DEFAULT NULL COMMENT 'FK to users.id if the employee logs into POS',
  `employee_code`      varchar(40)  DEFAULT NULL,
  `first_name`         varchar(120) NOT NULL,
  `last_name`          varchar(120) DEFAULT NULL,
  `email`              varchar(190) DEFAULT NULL,
  `phone`              varchar(40)  DEFAULT NULL,
  `job_title`          varchar(120) DEFAULT NULL,
  `commission_pct`     decimal(6,2) DEFAULT NULL COMMENT 'Default commission % on their sales',
  `is_sales_staff`     tinyint(1)   NOT NULL DEFAULT 1,
  `paytime_employee_id` varchar(80) DEFAULT NULL COMMENT 'Link to Paytime payroll record',
  `is_active`          tinyint(1)   NOT NULL DEFAULT 1,
  `created_at`         timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         timestamp    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tenant_code` (`tenant_id`,`employee_code`),
  KEY `idx_tenant_store` (`tenant_id`,`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Sales targets per employee per period (monthly/quarterly), with incentive rules.
CREATE TABLE IF NOT EXISTS `employee_sales_targets` (
  `id`             char(36)    NOT NULL,
  `tenant_id`      char(36)    NOT NULL,
  `employee_id`    char(36)    NOT NULL,
  `period_type`    enum('monthly','quarterly','yearly','custom') NOT NULL DEFAULT 'monthly',
  `period_start`   date        NOT NULL,
  `period_end`     date        NOT NULL,
  `target_amount`  decimal(15,2) NOT NULL DEFAULT 0.00,
  `incentive_pct`  decimal(6,2) DEFAULT NULL COMMENT 'Bonus % paid on sales above target',
  `bonus_flat`     decimal(15,2) DEFAULT NULL COMMENT 'Flat bonus on hitting target',
  `notes`          varchar(255) DEFAULT NULL,
  `created_at`     timestamp   NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_emp_period` (`employee_id`,`period_start`,`period_end`),
  KEY `idx_tenant` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Link a sale to the crediting employee (additive; sales.cashier_id stays as-is).
SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='sales' AND column_name='employee_id');
SET @sql := IF(@col=0,
  'ALTER TABLE `sales` ADD COLUMN `employee_id` char(36) DEFAULT NULL COMMENT ''Sales employee credited for commission/targets''',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Index for performance reporting by employee.
SET @idx := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE table_schema=DATABASE() AND table_name='sales' AND index_name='idx_sales_employee');
SET @sql := IF(@idx=0,
  'ALTER TABLE `sales` ADD INDEX `idx_sales_employee` (`tenant_id`,`employee_id`,`created_at`)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Done.
