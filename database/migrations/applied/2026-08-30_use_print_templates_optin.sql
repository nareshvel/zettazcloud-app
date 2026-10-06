-- =============================================================================
-- 2026-08-30  Per-store opt-in to template-driven printing
-- =============================================================================
-- WHY AN OPT-IN AND NOT A SWITCHOVER
-- ----------------------------------
-- Until now every sale printed through the hard-coded receipt in
-- receiptService.ts. The print template module could design documents but
-- nothing printed one — `buildPrintableHtml` was only ever called by the
-- designer's preview.
--
-- Turning the mapper on for everyone at once would silently change what every
-- existing customer's receipt looks like, on the next deploy, with no warning.
-- Receipts are the most customer-visible artefact the product produces and some
-- shops have grown attached to theirs. So this is opt-in per store, and the
-- legacy receipt remains the default.
--
-- IT IS ALSO A KILL SWITCH
-- ------------------------
-- If template printing misbehaves on real hardware — and thermal printers are
-- where rendering assumptions go to die — a shop can be put back on the known-
-- good path by clearing one flag, without a deploy.
--
-- Note that the code additionally falls back to the legacy receipt at runtime
-- whenever template rendering throws or no published template exists. A cashier
-- must always be able to print; a broken template must never stop a sale being
-- handed to a customer.
--
-- WHY printer_settings
-- --------------------
-- This is a choice about the print pipeline, not about jurisdiction or
-- document content, and printer_settings already carries `template_id`,
-- `paper_width` and `print_mode`. Numbering and duty-free live in
-- store_jurisdiction_settings; keeping the two concerns apart is deliberate.
-- =============================================================================

SET @col := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'printer_settings'
                AND COLUMN_NAME = 'use_print_templates');
SET @sql := IF(@col = 0,
  'ALTER TABLE `printer_settings`
     ADD COLUMN `use_print_templates` tinyint(1) NOT NULL DEFAULT 0
       COMMENT ''Print sales through the print-template engine instead of the built-in receipt. Off by default; falls back automatically if rendering fails''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
