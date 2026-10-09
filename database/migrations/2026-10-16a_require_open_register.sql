-- ============================================================================
-- Register enforcement — 2026-10-16
--
--   1. stores.require_open_register — when a store turns this on, POS sale
--      creation is refused until a drawer session is open for that store.
--      Default 0 keeps today's behavior (open prompt is a soft suggestion).
--
--   2. print_document_settings accepts a 'register_close' document_type so the
--      Z-report can use the same delivery/template/auto-print pipeline as
--      receipts and invoices instead of a hardcoded inline print.
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- 1. require_open_register flag ----------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'stores'
     AND COLUMN_NAME = 'require_open_register'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `stores` ADD COLUMN `require_open_register` TINYINT(1) NOT NULL DEFAULT 0 AFTER `default_sale_document_type`',
  'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. register_close document type --------------------------------------------
-- document_type is an ENUM('receipt','invoice'); widen it so a store can
-- configure delivery mode + printer + auto-print for the register Z-report.
ALTER TABLE `print_document_settings`
  MODIFY COLUMN `document_type` ENUM('receipt','invoice','register_close') NOT NULL;
