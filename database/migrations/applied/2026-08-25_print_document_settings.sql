-- =============================================================================
-- 2026-08-25  print_document_settings — store-level printing config per document
--             type (Print Module Phase 1)
-- =============================================================================
-- NOT NAMED print_routes — READ BEFORE TOUCHING
-- ----------------------------------------------
-- A `print_routes` table already exists in this database (empty, unreferenced
-- by any application code), alongside `print_stations`, `printer_devices` and
-- `print_jobs`. Those are an earlier, partial stab at the FULL
-- PRINT_MODULE_FINAL_BLUEPRINT.md data model: a generic condition-engine route
-- (`condition_type`/`condition_value` -> `printer_device_id`), device records
-- with their own connection types, etc. Discovered 2026-08-25 when this
-- migration first ran and collided with it.
--
-- That schema has no `template_id`, `copies`, `auto_print`, or `paper_width`,
-- and `printer_devices.connection_type` has no `local_agent` option the app
-- already relies on — bending Phase 1 to fit it would mean building full
-- station/device modeling now, which was explicitly deferred (see
-- docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md §1). So this migration adds
-- a differently-named, purpose-built table instead of colliding with or
-- half-adopting the dormant one.
--
-- `print_routes`/`print_stations`/`printer_devices`/`print_jobs` are left
-- completely untouched by this migration. Adopting them for real is a later
-- milestone decision, not something to back into via a naming collision.
--
-- Everything else about this table matches the original plan: one row per
-- (tenant, store, document_type), station-level overrides deferred, backfilled
-- from the legacy printer_settings table.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `print_document_settings` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `station_id` CHAR(36) NULL COMMENT 'Reserved for a future per-counter phase. Unused today. NOT the same concept as the dormant print_stations table.',
  `document_type` ENUM('receipt','invoice') NOT NULL,
  `delivery_mode` ENUM('browser','direct','local_agent') NOT NULL DEFAULT 'browser',
  `printer_name` VARCHAR(255) NULL,
  `paper_width` INT NOT NULL DEFAULT 80,
  `template_id` CHAR(36) NULL COMMENT 'FK -> print_templates.id, enforced in application code',
  `copies` INT NOT NULL DEFAULT 1,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `auto_print` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_print_doc_settings_store_type` (`tenant_id`, `store_id`, `document_type`),
  KEY `idx_print_doc_settings_store` (`store_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Backfill: one `receipt` row per existing printer_settings row that doesn't
-- already have one. Re-running is a no-op (NOT EXISTS guard).
INSERT INTO `print_document_settings`
  (`id`, `tenant_id`, `store_id`, `document_type`, `delivery_mode`,
   `printer_name`, `paper_width`, `template_id`, `enabled`, `auto_print`)
SELECT
  UUID(),
  ps.`tenant_id`,
  ps.`store_id`,
  'receipt',
  CASE
    WHEN ps.`print_mode` IN ('browser', 'direct', 'local-agent', 'local_agent', 'server') THEN
      CASE ps.`print_mode`
        WHEN 'local-agent' THEN 'local_agent'
        WHEN 'server' THEN 'browser'      -- server mode was never implemented; safest known-good default
        ELSE ps.`print_mode`
      END
    ELSE 'browser'
  END,
  ps.`printer_name`,
  COALESCE(ps.`paper_width`, 80),
  (
    SELECT pt.`id` FROM `print_templates` pt
    WHERE pt.`id` = ps.`template_id` AND pt.`tenant_id` = ps.`tenant_id`
    LIMIT 1
  ),
  ps.`enabled`,
  ps.`auto_print`
FROM `printer_settings` ps
WHERE NOT EXISTS (
  SELECT 1 FROM `print_document_settings` pds
  WHERE pds.`tenant_id` = ps.`tenant_id`
    AND pds.`store_id` = ps.`store_id`
    AND pds.`document_type` = 'receipt'
);
