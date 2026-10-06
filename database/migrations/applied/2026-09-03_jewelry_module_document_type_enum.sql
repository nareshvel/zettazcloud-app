-- =============================================================================
-- 2026-09-03  Add jewelry-module document types to the print template type enum
-- =============================================================================
-- WHY
-- ---
-- Repairs, Old Gold, Memo, Layaway and Savings Schemes have always printed
-- through hand-rolled HTML generators (repairPrintService.ts,
-- oldGoldPrintService.ts, memoPrintService.ts, layawayPrintService.ts, and
-- SavingsSchemesPage.tsx's inline printPassbook()) that never touched
-- print_templates or the Print Template Designer — a store owner could
-- customize a receipt or invoice's branding/layout, but not a repair ticket's.
-- Special Order had no print implementation at all.
--
-- Bringing these onto the Designer needs `print_templates.template_type` to
-- accept the new type names. Same ENUM-widening approach as
-- 2026-08-31_return_template_type.sql, extended in one pass with every type
-- name the whole project plans to add — repair_ticket, old_gold_voucher,
-- memo_slip, layaway_agreement, layaway_receipt, savings_enrollment,
-- order_acknowledgement — rather than one migration per phase. `validTypes`
-- in printTemplateService.js (validTemplateTypes(), reading DEFAULT_BLOCKS'
-- own keys) is the actual gate on what can be created; a type present in this
-- ENUM but not yet in DEFAULT_BLOCKS simply can't be provisioned yet, so
-- widening ahead of the DEFAULT_BLOCKS entries landing is harmless.
--
-- SAFETY
-- ------
-- Adding members to an ENUM is non-destructive: existing rows keep their
-- values and the column stays NOT NULL. Idempotent — re-running finds the
-- members already present and does nothing.
-- =============================================================================

SET @has_repair_ticket := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'print_templates'
    AND COLUMN_NAME = 'template_type'
    AND COLUMN_TYPE LIKE '%''repair_ticket''%'
);

SET @sql := IF(@has_repair_ticket = 0,
  'ALTER TABLE `print_templates`
     MODIFY COLUMN `template_type`
       ENUM(''receipt'', ''invoice'', ''label'', ''document'',
            ''jewelry_invoice'', ''jewelry_certificate'', ''return'',
            ''repair_ticket'', ''old_gold_voucher'', ''memo_slip'',
            ''layaway_agreement'', ''layaway_receipt'', ''savings_enrollment'',
            ''order_acknowledgement'')
       NOT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- The version history table mirrors the same shape where it carries the type.
SET @needs_version_update := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'print_template_versions'
    AND COLUMN_NAME = 'template_type'
    AND COLUMN_TYPE NOT LIKE '%''repair_ticket''%'
);

SET @sql := IF(@needs_version_update > 0,
  'ALTER TABLE `print_template_versions`
     MODIFY COLUMN `template_type`
       ENUM(''receipt'', ''invoice'', ''label'', ''document'',
            ''jewelry_invoice'', ''jewelry_certificate'', ''return'',
            ''repair_ticket'', ''old_gold_voucher'', ''memo_slip'',
            ''layaway_agreement'', ''layaway_receipt'', ''savings_enrollment'',
            ''order_acknowledgement'')
       NOT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
