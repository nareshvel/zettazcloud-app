-- Migration: Memo / consignment ledgers (jewelry P2)
-- Date: 2026-08-09
-- Goods held on memo are NOT owned stock. Kept in a separate ledger so they never
-- pollute inventory valuation.
--   direction = 'in'  : received from a vendor on memo (we hold, not yet bought)
--   direction = 'out' : loaned to a customer on approval (we own, temporarily out)
-- Idempotent.

CREATE TABLE IF NOT EXISTS `memo_transactions` (
  `id`              char(36)     NOT NULL,
  `tenant_id`       char(36)     NOT NULL,
  `store_id`        char(36)     DEFAULT NULL,
  `memo_no`         varchar(40)  NOT NULL,
  `direction`       enum('in','out') NOT NULL,
  `party_type`      enum('supplier','customer') NOT NULL,
  `supplier_id`     char(36)     DEFAULT NULL,
  `customer_id`     char(36)     DEFAULT NULL,
  `employee_id`     char(36)     DEFAULT NULL,
  `issue_date`      date         NOT NULL,
  `due_date`        date         DEFAULT NULL,
  `status`          enum('open','partially_returned','returned','purchased','sold','cancelled')
                    NOT NULL DEFAULT 'open',
  `total_value`     decimal(15,2) NOT NULL DEFAULT 0.00,
  `notes`           varchar(500) DEFAULT NULL,
  `created_by_user_id` char(36)  DEFAULT NULL,
  `created_at`      timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      timestamp    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_tenant_memo` (`tenant_id`,`memo_no`),
  KEY `idx_tenant_status` (`tenant_id`,`status`),
  KEY `idx_due` (`tenant_id`,`due_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `memo_items` (
  `id`               char(36)      NOT NULL,
  `tenant_id`        char(36)      NOT NULL,
  `memo_id`          char(36)      NOT NULL,
  `product_id`       char(36)      DEFAULT NULL,
  `piece_id`         char(36)      DEFAULT NULL COMMENT 'FK to product_pieces.id when serialized',
  `description`      varchar(255)  NOT NULL,
  `quantity`         decimal(12,3) NOT NULL DEFAULT 1.000,
  `returned_quantity` decimal(12,3) NOT NULL DEFAULT 0.000,
  `unit_value`       decimal(15,2) DEFAULT NULL,
  `line_value`       decimal(15,2) DEFAULT NULL,
  `status`           enum('held','returned','purchased','sold') NOT NULL DEFAULT 'held',
  PRIMARY KEY (`id`),
  KEY `idx_memo` (`memo_id`),
  KEY `idx_piece` (`piece_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `memo_sequences` (
  `tenant_id`  char(36) NOT NULL,
  `last_value` int      NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Done.
