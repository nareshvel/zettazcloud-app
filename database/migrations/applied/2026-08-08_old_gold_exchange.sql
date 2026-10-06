-- Migration: Old-gold / metal exchange (jewelry P1)
-- Date: 2026-08-08
-- Buy customer's old metal, value it by purity, issue a redeemable credit voucher,
-- and (optionally) redeem it against a sale. Re-melt stock entry is recorded via status.
-- Idempotent.

CREATE TABLE IF NOT EXISTS `old_gold_purchases` (
  `id`                char(36)      NOT NULL,
  `tenant_id`         char(36)      NOT NULL,
  `store_id`          char(36)      DEFAULT NULL,
  `voucher_no`        varchar(40)   NOT NULL,
  `customer_id`       char(36)      DEFAULT NULL,
  `employee_id`       char(36)      DEFAULT NULL,
  `metal`             varchar(60)   NOT NULL DEFAULT 'Gold',
  `purity_label`      varchar(40)   DEFAULT NULL COMMENT 'e.g. 22K, 916, 750',
  `purity_pct`        decimal(6,3)  DEFAULT NULL COMMENT 'Assayed purity %, e.g. 91.600',
  `gross_weight`      decimal(10,3) NOT NULL,
  `stone_deduction`   decimal(10,3) NOT NULL DEFAULT 0.000 COMMENT 'Weight deducted for stones etc (g)',
  `net_weight`        decimal(10,3) DEFAULT NULL COMMENT 'Pure-metal equivalent weight (g)',
  `rate_per_gram`     decimal(12,2) NOT NULL COMMENT 'Buy rate per gram of pure metal',
  `amount_deduction`  decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Flat handling/refining deduction',
  `valuation_amount`  decimal(12,2) NOT NULL DEFAULT 0.00 COMMENT 'Credit value paid to customer',
  `status`            enum('valued','credited','redeemed','cancelled') NOT NULL DEFAULT 'valued',
  `redeemed_sale_id`  char(36)      DEFAULT NULL,
  `notes`             varchar(500)  DEFAULT NULL,
  `created_by_user_id` char(36)     DEFAULT NULL,
  `created_at`        timestamp     NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        timestamp     NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tenant_voucher` (`tenant_id`,`voucher_no`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Per-tenant voucher sequence
CREATE TABLE IF NOT EXISTS `old_gold_voucher_sequences` (
  `tenant_id`  char(36) NOT NULL,
  `last_value` int      NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Done.
