-- =============================================================================
-- 2026-09-04  print_agent_fleet — tenant-scoped Print Agent fleet backend
-- =============================================================================
-- Adds three tables:
--   print_agents                 - enrolled workstation agents
--   print_agent_enrollment_codes - one-time plaintext codes (only SHA-256 stored)
--   print_agent_printer_mappings - logical document route -> local printer
-- Idempotent: CREATE TABLE IF NOT EXISTS, guarded column/index additions.
-- Collation: utf8mb4_0900_ai_ci on every table.
-- =============================================================================

CREATE TABLE IF NOT EXISTS `print_agents` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `agent_id` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(255) NULL,
  `status` ENUM('pending','online','offline','error','revoked') NOT NULL DEFAULT 'pending',
  `update_channel` ENUM('stable','pilot','beta') NOT NULL DEFAULT 'stable',
  `heartbeat_interval` INT NOT NULL DEFAULT 300,
  `notification_policy` ENUM('all','errors','none') NOT NULL DEFAULT 'errors',
  `config_policy` ENUM('cloud','workstation','hybrid') NOT NULL DEFAULT 'cloud',
  `workstation_overrides` JSON NULL,
  `version` VARCHAR(50) NULL,
  `platform` VARCHAR(50) NULL,
  `os_version` VARCHAR(100) NULL,
  `architecture` VARCHAR(50) NULL,
  `capabilities` JSON NULL,
  `queue_counts` JSON NULL,
  `last_error` TEXT NULL,
  `last_seen` TIMESTAMP NULL DEFAULT NULL,
  `token_hash` CHAR(64) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_by` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_print_agent_agent_id` (`tenant_id`, `agent_id`),
  KEY `idx_print_agents_tenant_store` (`tenant_id`, `store_id`),
  KEY `idx_print_agents_status` (`status`),
  KEY `idx_print_agents_token_hash` (`token_hash`),
  KEY `idx_print_agents_last_seen` (`last_seen`),
  CONSTRAINT `fk_print_agents_tenant_id` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_print_agents_store_id` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `print_agent_enrollment_codes` (
  `id` CHAR(36) NOT NULL,
  `tenant_id` CHAR(36) NOT NULL,
  `store_id` CHAR(36) NOT NULL,
  `code_hash` CHAR(64) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `consumed_by` CHAR(36) NULL DEFAULT NULL,
  `consumed_at` TIMESTAMP NULL DEFAULT NULL,
  `created_by` CHAR(36) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_print_agent_enrollment_codes_tenant_store` (`tenant_id`, `store_id`),
  KEY `idx_print_agent_enrollment_codes_hash` (`code_hash`),
  KEY `idx_print_agent_enrollment_codes_expires` (`expires_at`),
  KEY `idx_print_agent_enrollment_codes_consumed_by` (`consumed_by`),
  CONSTRAINT `fk_print_agent_enrollment_codes_tenant_id` FOREIGN KEY (`tenant_id`) REFERENCES `tenants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_print_agent_enrollment_codes_store_id` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_print_agent_enrollment_codes_consumed_by` FOREIGN KEY (`consumed_by`) REFERENCES `print_agents` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `print_agent_printer_mappings` (
  `id` CHAR(36) NOT NULL,
  `print_agent_id` CHAR(36) NOT NULL,
  `document_route` VARCHAR(50) NOT NULL,
  `local_printer_id` VARCHAR(255) NOT NULL,
  `printer_name` VARCHAR(255) NULL,
  `priority` INT NOT NULL DEFAULT 1,
  `is_fallback` TINYINT(1) NOT NULL DEFAULT 0,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `capabilities` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_print_agent_mapping_route_printer` (`print_agent_id`, `document_route`, `local_printer_id`),
  KEY `idx_print_agent_printer_mappings_agent` (`print_agent_id`),
  KEY `idx_print_agent_printer_mappings_route` (`print_agent_id`, `document_route`, `priority`),
  CONSTRAINT `fk_print_agent_printer_mappings_agent_id` FOREIGN KEY (`print_agent_id`) REFERENCES `print_agents` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
