-- Migration: Customer savings / instalment schemes (jewelry P3)
-- Date: 2026-08-09
-- Customer pays a fixed amount monthly; on maturity the accumulated value (plus any
-- bonus instalment) is redeemable against a purchase. Amount-based and weight-based
-- (grams accrued at each month's rate) variants are both supported.
-- Idempotent.

CREATE TABLE IF NOT EXISTS `savings_scheme_plans` (
  `id`                char(36)      NOT NULL,
  `tenant_id`         char(36)      NOT NULL,
  `name`              varchar(160)  NOT NULL,
  `accrual_type`      enum('amount','weight') NOT NULL DEFAULT 'amount',
  `installment_amount` decimal(15,2) DEFAULT NULL,
  `duration_months`   int           NOT NULL DEFAULT 11,
  `bonus_type`        enum('none','extra_installment','percentage') NOT NULL DEFAULT 'none',
  `bonus_value`       decimal(12,2) NOT NULL DEFAULT 0.00,
  `terms`             varchar(1000) DEFAULT NULL,
  `is_active`         tinyint(1)    NOT NULL DEFAULT 1,
  `created_at`        timestamp     NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant` (`tenant_id`,`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `savings_scheme_enrollments` (
  `id`              char(36)      NOT NULL,
  `tenant_id`       char(36)      NOT NULL,
  `store_id`        char(36)      DEFAULT NULL,
  `plan_id`         char(36)      NOT NULL,
  `enrollment_no`   varchar(40)   NOT NULL,
  `customer_id`     char(36)      NOT NULL,
  `start_date`      date          NOT NULL,
  `maturity_date`   date          DEFAULT NULL,
  `paid_installments` int         NOT NULL DEFAULT 0,
  `total_paid`      decimal(15,2) NOT NULL DEFAULT 0.00,
  `total_weight`    decimal(12,3) NOT NULL DEFAULT 0.000 COMMENT 'Grams accrued for weight-based schemes',
  `bonus_amount`    decimal(15,2) NOT NULL DEFAULT 0.00,
  `status`          enum('active','matured','redeemed','cancelled') NOT NULL DEFAULT 'active',
  `redeemed_sale_id` char(36)     DEFAULT NULL,
  `created_at`      timestamp     NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      timestamp     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tenant_enrollment` (`tenant_id`,`enrollment_no`),
  KEY `idx_customer` (`tenant_id`,`customer_id`),
  KEY `idx_status` (`tenant_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `savings_scheme_payments` (
  `id`             char(36)      NOT NULL,
  `tenant_id`      char(36)      NOT NULL,
  `enrollment_id`  char(36)      NOT NULL,
  `installment_no` int           NOT NULL,
  `amount`         decimal(15,2) NOT NULL,
  `metal_rate`     decimal(12,2) DEFAULT NULL COMMENT 'Rate used for weight-based accrual',
  `weight_credited` decimal(12,3) DEFAULT NULL,
  `payment_method` varchar(50)   DEFAULT NULL,
  `reference`      varchar(100)  DEFAULT NULL,
  `paid_at`        timestamp     NULL DEFAULT CURRENT_TIMESTAMP,
  `received_by_user_id` char(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_enrollment` (`enrollment_id`,`paid_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `savings_scheme_sequences` (
  `tenant_id`  char(36) NOT NULL,
  `last_value` int      NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Done.
