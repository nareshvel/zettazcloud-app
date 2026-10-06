-- Migration: Print Device Registry
-- Feature: Print Module Security Hardening
-- Status: applied
-- Notes: Creates printer_devices table to replace arbitrary printer addresses with tenant-scoped device IDs
-- Idempotent: yes

-- Check if printer_devices table exists
SET @table_exists = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
  AND table_name = 'printer_devices'
);

-- Create printer_devices table if it doesn't exist
SET @create_table = IF(@table_exists = 0,
  'CREATE TABLE printer_devices (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36),
    name VARCHAR(255) NOT NULL,
    device_type ENUM("thermal_receipt", "laser", "inkjet", "label_zebra_zpl", "label_tsc_tspl", "label_dymo", "label_brother", "pdf_generator") NOT NULL,
    connection_type ENUM("network", "usb", "bluetooth", "cloud", "browser") NOT NULL DEFAULT "network",
    address VARCHAR(500),
    port INT DEFAULT 9100,
    capabilities JSON,
    is_default TINYINT(1) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by CHAR(36),
    updated_by CHAR(36),
    INDEX idx_tenant_store (tenant_id, store_id),
    INDEX idx_device_type (device_type),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
  'SELECT 1'
);

PREPARE stmt FROM @create_table;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add capabilities column if table exists but column doesn't
SET @column_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = 'printer_devices'
  AND column_name = 'capabilities'
);

SET @add_column = IF(@table_exists = 1 AND @column_exists = 0,
  'ALTER TABLE printer_devices ADD COLUMN capabilities JSON AFTER port',
  'SELECT 1'
);

PREPARE stmt FROM @add_column;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_default column if table exists but column doesn't
SET @is_default_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = 'printer_devices'
  AND column_name = 'is_default'
);

SET @add_is_default = IF(@table_exists = 1 AND @is_default_exists = 0,
  'ALTER TABLE printer_devices ADD COLUMN is_default TINYINT(1) DEFAULT 0 AFTER capabilities',
  'SELECT 1'
);

PREPARE stmt FROM @add_is_default;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add is_active column if table exists but column doesn't
SET @is_active_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = 'printer_devices'
  AND column_name = 'is_active'
);

SET @add_is_active = IF(@table_exists = 1 AND @is_active_exists = 0,
  'ALTER TABLE printer_devices ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER is_default',
  'SELECT 1'
);

PREPARE stmt FROM @add_is_active;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add created_by and updated_by columns if they don't exist
SET @created_by_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = 'printer_devices'
  AND column_name = 'created_by'
);

SET @add_created_by = IF(@table_exists = 1 AND @created_by_exists = 0,
  'ALTER TABLE printer_devices ADD COLUMN created_by CHAR(36) AFTER updated_at',
  'SELECT 1'
);

PREPARE stmt FROM @add_created_by;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @updated_by_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = 'printer_devices'
  AND column_name = 'updated_by'
);

SET @add_updated_by = IF(@table_exists = 1 AND @updated_by_exists = 0,
  'ALTER TABLE printer_devices ADD COLUMN updated_by CHAR(36) AFTER created_by',
  'SELECT 1'
);

PREPARE stmt FROM @add_updated_by;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create print_stations table for grouping printers by location
SET @stations_table_exists = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
  AND table_name = 'print_stations'
);

SET @create_stations_table = IF(@stations_table_exists = 0,
  'CREATE TABLE print_stations (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36),
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    description TEXT,
    is_default TINYINT(1) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by CHAR(36),
    updated_by CHAR(36),
    INDEX idx_tenant_store (tenant_id, store_id),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
  'SELECT 1'
);

PREPARE stmt FROM @create_stations_table;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add station_id column to printer_devices
SET @station_id_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
  AND table_name = 'printer_devices'
  AND column_name = 'station_id'
);

SET @add_station_id = IF(@table_exists = 1 AND @station_id_exists = 0,
  'ALTER TABLE printer_devices ADD COLUMN station_id CHAR(36) AFTER store_id, ADD INDEX idx_station (station_id), ADD FOREIGN KEY (station_id) REFERENCES print_stations(id) ON DELETE SET NULL',
  'SELECT 1'
);

PREPARE stmt FROM @add_station_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create print_jobs table for audit trail and job tracking
SET @jobs_table_exists = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
  AND table_name = 'print_jobs'
);

SET @create_jobs_table = IF(@jobs_table_exists = 0,
  'CREATE TABLE print_jobs (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36),
    station_id CHAR(36),
    printer_device_id CHAR(36),
    job_type ENUM("receipt", "invoice", "label", "document", "test") NOT NULL,
    document_type VARCHAR(50),
    status ENUM("pending", "queued", "processing", "completed", "failed", "cancelled") DEFAULT "pending",
    priority INT DEFAULT 5,
    payload JSON,
    error_message TEXT,
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,
    idempotency_key VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    created_by CHAR(36),
    INDEX idx_tenant_store (tenant_id, store_id),
    INDEX idx_status (status),
    INDEX idx_printer_device (printer_device_id),
    INDEX idx_created_at (created_at),
    INDEX idx_idempotency (idempotency_key),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES print_stations(id) ON DELETE SET NULL,
    FOREIGN KEY (printer_device_id) REFERENCES printer_devices(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
  'SELECT 1'
);

PREPARE stmt FROM @create_jobs_table;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create print_routes table for routing rules
SET @routes_table_exists = (
  SELECT COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
  AND table_name = 'print_routes'
);

SET @create_routes_table = IF(@routes_table_exists = 0,
  'CREATE TABLE print_routes (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    store_id CHAR(36),
    route_name VARCHAR(255) NOT NULL,
    condition_type ENUM("document_type", "payment_method", "customer_type", "custom") NOT NULL,
    condition_value VARCHAR(255),
    printer_device_id CHAR(36) NOT NULL,
    priority INT DEFAULT 10,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by CHAR(36),
    updated_by CHAR(36),
    INDEX idx_tenant_store (tenant_id, store_id),
    INDEX idx_condition (condition_type, condition_value),
    INDEX idx_priority (priority),
    INDEX idx_is_active (is_active),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
    FOREIGN KEY (printer_device_id) REFERENCES printer_devices(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci',
  'SELECT 1'
);

PREPARE stmt FROM @create_routes_table;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
