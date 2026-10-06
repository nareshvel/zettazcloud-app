-- =============================================================================
-- 2026-08-29  Whether the document number is PRINTED, as distinct from issued
-- =============================================================================
-- TWO SEPARATE QUESTIONS
-- ----------------------
--   Is a number issued?   -> sequential_numbering_optin  (2026-08-27)
--   Is it printed as text? -> this migration
--
-- They are not the same decision and conflating them would be wrong in both
-- directions. A shop can want gapless numbering for its own books without
-- cluttering a 58mm slip with it; a wholesaler can need the number on the page
-- whether or not it is machine-issued.
--
-- WHY THE DEFAULTS DIFFER BY DOCUMENT
-- -----------------------------------
-- A thermal receipt is identified by the barcode or QR already printed on it.
-- The cashier scans it for a return or to pull the sale up online; nobody reads
-- the digits aloud. Printing them as well is noise on a narrow slip.
--
-- An A4/Letter invoice is the opposite. Wholesale, trade supply and high-value
-- retail — jewellery especially — settle against an invoice number: it goes on
-- the remittance advice, the purchase order and the customer's ledger. A
-- printed number is the point of the document.
--
-- Hence:
--   show_number_on_receipt  DEFAULT 0   (the barcode does this job)
--   show_number_on_invoice  DEFAULT 1   (the number IS the reference)
--
-- Both are tenant-overridable; the defaults only decide what happens for a
-- shop that never opens the setting.
--
-- WHERE THEY LIVE
-- ---------------
-- store_jurisdiction_settings already holds invoice_number_prefix,
-- sequential_numbering_optin and sequence_reset. Document numbering config
-- belongs in one place — a second home is how a setting ends up disagreeing
-- with itself, which is what the duty_free_profiles removal was about.
-- =============================================================================

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'store_jurisdiction_settings'
                AND COLUMN_NAME = 'show_number_on_receipt');
SET @sql := IF(@col = 0,
  'ALTER TABLE `store_jurisdiction_settings`
     ADD COLUMN `show_number_on_receipt` tinyint(1) NOT NULL DEFAULT 0
       COMMENT ''Print the document number as text on thermal receipts. Off by default — the barcode identifies the sale''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'store_jurisdiction_settings'
                AND COLUMN_NAME = 'show_number_on_invoice');
SET @sql := IF(@col = 0,
  'ALTER TABLE `store_jurisdiction_settings`
     ADD COLUMN `show_number_on_invoice` tinyint(1) NOT NULL DEFAULT 1
       COMMENT ''Print the document number as text on A4/Letter invoices. On by default — wholesale and trade settle against it''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
