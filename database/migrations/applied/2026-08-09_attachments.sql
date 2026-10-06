-- Migration: Generic attachments (certificates, photos, documents) — P2
-- Date: 2026-08-09
-- One polymorphic table serves products, product_pieces, repair_orders, customers,
-- memos and layaways, so we never add a bespoke photo table per module.
-- Idempotent.

CREATE TABLE IF NOT EXISTS `attachments` (
  `id`             char(36)     NOT NULL,
  `tenant_id`      char(36)     NOT NULL,
  `entity_type`    varchar(40)  NOT NULL COMMENT 'product | product_piece | repair_order | customer | memo | layaway',
  `entity_id`      char(36)     NOT NULL,
  `kind`           enum('photo','certificate','appraisal','document','other') NOT NULL DEFAULT 'document',
  `label`          varchar(160) DEFAULT NULL COMMENT 'e.g. GIA report, before-repair photo',
  `reference_no`   varchar(120) DEFAULT NULL COMMENT 'Certificate/report number if applicable',
  `issuer`         varchar(120) DEFAULT NULL COMMENT 'e.g. GIA, IGI, AGS, BIS',
  `file_name`      varchar(255) NOT NULL,
  `file_path`      varchar(500) NOT NULL COMMENT 'Storage key/path (driver-relative)',
  `mime_type`      varchar(120) DEFAULT NULL,
  `size_bytes`     bigint       DEFAULT NULL,
  `storage_driver` varchar(20)  NOT NULL DEFAULT 'local' COMMENT 'local | s3 — allows migrating later',
  `uploaded_by_user_id` char(36) DEFAULT NULL,
  `created_at`     timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_entity` (`tenant_id`,`entity_type`,`entity_id`),
  KEY `idx_kind` (`tenant_id`,`kind`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Done.
