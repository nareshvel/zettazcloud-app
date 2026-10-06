-- Migration: Add logo_url column to stores table
-- Date: 2026-08-16
-- Idempotent: checks column existence before adding
-- Purpose: Centralize store logo (used across app: receipts, reports, etc.)
--   Previously, logo was only in printer_settings. This moves it to the
--   canonical store record so it can be reused everywhere.

-- Add logo_url column to stores table if it doesn't exist
SET @dbname = DATABASE();
SET @tablename = 'stores';
SET @columnname = 'logo_url';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE
      (table_schema = @dbname)
      AND (table_name = @tablename)
      AND (column_name = @columnname)
  ) > 0,
  'SELECT 1',
  CONCAT('ALTER TABLE ', @tablename, ' ADD COLUMN ', @columnname, ' VARCHAR(500) NULL COMMENT ''Store logo URL (used across app: receipts, reports, etc.)'' AFTER email')
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;
