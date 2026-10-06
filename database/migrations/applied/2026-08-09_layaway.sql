-- Migration: Layaway / installment plans (P2)
-- Date: 2026-08-09
-- Customer reserves goods and pays over time; goods release on completion.
-- Idempotent.

CREATE TABLE IF NOT EXISTS `layaway_plans` (
  `id`              char(36)      NOT NULL,
  `tenant_id`       char(36)      NOT NULL,
  `store_id`        char(36)      DEFAULT NULL,
  `plan_no`         varchar(40)   NOT NULL,
  `customer_id`     char(36)      DEFAULT NULL,
  `employee_id`     char(36)      DEFAULT NULL,
  `total_amount`    decimal(15,2) NOT NULL DEFAULT 0.00,
  `down_payment`    decimal(15,2) NOT NULL DEFAULT 0.00,
  `paid_amount`     decimal(15,2) NOT NULL DEFAULT 0.00,
  `installment_amount` decimal(15,2) DEFAULT NULL,
  `installment_count`  int          DEFAULT NULL,
  `frequency`       enum('weekly','biweekly','monthly') NOT NULL DEFAULT 'monthly',
  `start_date`      date          NOT NULL,
  `due_date`        date          DEFAULT NULL,
  `status`          enum('active','completed','cancelled','defaulted') NOT NULL DEFAULT 'active',
  `sale_id`         char(36)      DEFAULT NULL COMMENT 'Set when converted to a completed sale',
  `notes`           varchar(500)  DEFAULT NULL,
  `created_by_user_id` char(36)   DEFAULT NULL,
  `created_at`      timestamp     NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      timestamp     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tenant_plan` (`tenant_id`,`plan_no`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `layaway_items` (
  `id`          char(36)      NOT NULL,
  `tenant_id`   char(36)      NOT NULL,
  `layaway_id`  char(36)      NOT NULL,
  `product_id`  char(36)      DEFAULT NULL,
  `piece_id`    char(36)      DEFAULT NULL,
  `description` varchar(255)  NOT NULL,
  `quantity`    decimal(12,3) NOT NULL DEFAULT 1.000,
  `unit_price`  decimal(15,2) NOT NULL DEFAULT 0.00,
  `line_total`  decimal(15,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_layaway` (`layaway_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `layaway_payments` (
  `id`             char(36)      NOT NULL,
  `tenant_id`      char(36)      NOT NULL,
  `layaway_id`     char(36)      NOT NULL,
  `amount`         decimal(15,2) NOT NULL,
  `payment_method` varchar(50)   DEFAULT NULL,
  `reference`      varchar(100)  DEFAULT NULL,
  `paid_at`        timestamp     NULL DEFAULT CURRENT_TIMESTAMP,
  `received_by_user_id` char(36) DEFAULT NULL,
  `notes`          varchar(255)  DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_layaway` (`layaway_id`,`paid_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `layaway_sequences` (
  `tenant_id`  char(36) NOT NULL,
  `last_value` int      NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Done.
