-- Migration: Repair / custom-order management (jewelry P1)
-- Date: 2026-08-08
-- Intake-to-pickup workflow with status history (chain of custody).
-- Idempotent.

CREATE TABLE IF NOT EXISTS `repair_orders` (
  `id`                  char(36)     NOT NULL,
  `tenant_id`           char(36)     NOT NULL,
  `store_id`            char(36)     DEFAULT NULL,
  `ticket_no`           varchar(40)  NOT NULL,
  `customer_id`         char(36)     DEFAULT NULL,
  `employee_id`         char(36)     DEFAULT NULL COMMENT 'Staff who took in / handles the repair',
  `item_description`    varchar(255) NOT NULL,
  `metal`               varchar(60)  DEFAULT NULL,
  `weight`              decimal(10,3) DEFAULT NULL,
  `problem_description` text         DEFAULT NULL,
  `work_required`       text         DEFAULT NULL,
  `estimated_cost`      decimal(12,2) DEFAULT NULL,
  `final_cost`          decimal(12,2) DEFAULT NULL,
  `advance_paid`        decimal(12,2) NOT NULL DEFAULT 0.00,
  `status`              enum('received','in_progress','ready','delivered','cancelled') NOT NULL DEFAULT 'received',
  `received_date`       date         DEFAULT NULL,
  `promised_date`       date         DEFAULT NULL,
  `delivered_date`      date         DEFAULT NULL,
  `photos`              json         DEFAULT NULL COMMENT 'Array of image URLs',
  `notes`               text         DEFAULT NULL,
  `created_by_user_id`  char(36)     DEFAULT NULL,
  `created_at`          timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          timestamp    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tenant_ticket` (`tenant_id`,`ticket_no`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_customer` (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Status history / chain of custody
CREATE TABLE IF NOT EXISTS `repair_order_updates` (
  `id`               char(36)    NOT NULL,
  `tenant_id`        char(36)    NOT NULL,
  `repair_order_id`  char(36)    NOT NULL,
  `status`           varchar(40) NOT NULL,
  `note`             varchar(500) DEFAULT NULL,
  `updated_by_user_id` char(36)  DEFAULT NULL,
  `created_at`       timestamp   NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_order` (`repair_order_id`,`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Per-tenant ticket number sequence (mirrors return_number_sequences pattern)
CREATE TABLE IF NOT EXISTS `repair_ticket_sequences` (
  `tenant_id`  char(36) NOT NULL,
  `last_value` int      NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Done.
