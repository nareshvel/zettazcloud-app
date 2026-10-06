-- Migration: Print Templates
-- Feature: Template Platform
-- Status: applied
-- Notes: Creates print_templates table for structured template management
-- Idempotent: yes

-- Check if print_templates table exists
SET @table_exists = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
  AND table_name = 'print_templates'
);

-- Create print_templates table if it doesn't exist
SET @create_table = IF(@table_exists = 0,
  'CREATE TABLE print_templates (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36),
    name VARCHAR(255) NOT NULL,
    template_type ENUM("receipt", "invoice", "label", "document", "jewelry_invoice", "jewelry_certificate") NOT NULL,
    document_subtype VARCHAR(50),
    version INT DEFAULT 1,
    is_published TINYINT(1) DEFAULT 0,
    is_default TINYINT(1) DEFAULT 0,
    blocks JSON,
    styles JSON,
    layout_config JSON,
    preview_data JSON,
    thumbnail_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    published_at TIMESTAMP NULL,
    created_by CHAR(36),
    updated_by CHAR(36),
    published_by CHAR(36),
    INDEX idx_tenant_store (tenant_id, store_id),
    INDEX idx_template_type (template_type),
    INDEX idx_is_published (is_published),
    INDEX idx_is_default (is_default),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
  'SELECT 1'
);

PREPARE stmt FROM @create_table;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add columns if table exists but columns don't
SET @version_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = 'print_templates'
  AND column_name = 'version'
);

SET @add_version = IF(@table_exists = 1 AND @version_exists = 0,
  'ALTER TABLE print_templates ADD COLUMN version INT DEFAULT 1 AFTER document_subtype',
  'SELECT 1'
);

PREPARE stmt FROM @add_version;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @is_published_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = 'print_templates'
  AND column_name = 'is_published'
);

SET @add_is_published = IF(@table_exists = 1 AND @is_published_exists = 0,
  'ALTER TABLE print_templates ADD COLUMN is_published TINYINT(1) DEFAULT 0 AFTER version',
  'SELECT 1'
);

PREPARE stmt FROM @add_is_published;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @published_at_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = 'print_templates'
  AND column_name = 'published_at'
);

SET @add_published_at = IF(@table_exists = 1 AND @published_at_exists = 0,
  'ALTER TABLE print_templates ADD COLUMN published_at TIMESTAMP NULL AFTER updated_at',
  'SELECT 1'
);

PREPARE stmt FROM @add_published_at;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @published_by_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = 'print_templates'
  AND column_name = 'published_by'
);

SET @add_published_by = IF(@table_exists = 1 AND @published_by_exists = 0,
  'ALTER TABLE print_templates ADD COLUMN published_by CHAR(36) AFTER published_at',
  'SELECT 1'
);

PREPARE stmt FROM @add_published_by;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create template_versions table for version history
SET @versions_table_exists = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
  AND table_name = 'template_versions'
);

SET @create_versions_table = IF(@versions_table_exists = 0,
  'CREATE TABLE template_versions (
    id CHAR(36) PRIMARY KEY,
    template_id CHAR(36) NOT NULL,
    version INT NOT NULL,
    blocks JSON,
    styles JSON,
    layout_config JSON,
    change_description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by CHAR(36),
    INDEX idx_template_id (template_id),
    INDEX idx_version (version),
    FOREIGN KEY (template_id) REFERENCES print_templates(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
  'SELECT 1'
);

PREPARE stmt FROM @create_versions_table;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create duty_free_profiles table for jurisdiction-specific invoice requirements
SET @duty_free_table_exists = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
  AND table_name = 'duty_free_profiles'
);

SET @create_duty_free_table = IF(@duty_free_table_exists = 0,
  'CREATE TABLE duty_free_profiles (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36),
    profile_name VARCHAR(255) NOT NULL,
    jurisdiction_code VARCHAR(10) NOT NULL,
    jurisdiction_name VARCHAR(255),
    invoice_sequence_prefix VARCHAR(20),
    invoice_number_length INT DEFAULT 8,
    copies_required INT DEFAULT 2,
    customer_copy_label VARCHAR(100),
    store_copy_label VARCHAR(100),
    required_fields JSON,
    legal_text JSON,
    language_code VARCHAR(10) DEFAULT "en",
    is_active TINYINT(1) DEFAULT 1,
    is_default TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by CHAR(36),
    updated_by CHAR(36),
    INDEX idx_tenant_store (tenant_id, store_id),
    INDEX idx_jurisdiction (jurisdiction_code),
    INDEX idx_is_active (is_active),
    INDEX idx_is_default (is_default),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
  'SELECT 1'
);

PREPARE stmt FROM @create_duty_free_table;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create duty_free_invoice_sequences table for invoice numbering
SET @sequences_table_exists = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
  AND table_name = 'duty_free_invoice_sequences'
);

SET @create_sequences_table = IF(@sequences_table_exists = 0,
  'CREATE TABLE duty_free_invoice_sequences (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36),
    profile_id CHAR(36) NOT NULL,
    sequence_name VARCHAR(100) NOT NULL,
    current_value BIGINT DEFAULT 0,
    prefix VARCHAR(20),
    padding INT DEFAULT 8,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tenant_profile_name (tenant_id, profile_id, sequence_name),
    INDEX idx_tenant_store (tenant_id, store_id),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES duty_free_profiles(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
  'SELECT 1'
);

PREPARE stmt FROM @create_sequences_table;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create duty_free_invoice_corrections table for correction/reissue workflow
SET @corrections_table_exists = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
  AND table_name = 'duty_free_invoice_corrections'
);

SET @create_corrections_table = IF(@corrections_table_exists = 0,
  'CREATE TABLE duty_free_invoice_corrections (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36),
    original_invoice_id CHAR(36) NOT NULL,
    original_invoice_number VARCHAR(100) NOT NULL,
    correction_type ENUM("correction", "reissue", "cancellation") NOT NULL,
    reason TEXT,
    corrected_invoice_id CHAR(36),
    corrected_invoice_number VARCHAR(100),
    status ENUM("pending", "approved", "rejected", "completed") DEFAULT "pending",
    approved_by CHAR(36),
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by CHAR(36),
    updated_by CHAR(36),
    INDEX idx_tenant_store (tenant_id, store_id),
    INDEX idx_original_invoice (original_invoice_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
  'SELECT 1'
);

PREPARE stmt FROM @create_corrections_table;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
