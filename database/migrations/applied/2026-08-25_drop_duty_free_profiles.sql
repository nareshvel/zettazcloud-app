-- =============================================================================
-- 2026-08-25  Remove the abandoned duty_free_profiles subsystem
-- =============================================================================
-- WHAT IS BEING REMOVED
-- ---------------------
--   duty_free_profiles              (per-tenant duty-free document config)
--   duty_free_invoice_sequences     (invoice numbering for the above)
--   duty_free_invoice_corrections   (correction / reissue workflow)
--
-- ...together with backend/services/dutyFreeService.js,
-- backend/routes/dutyFree.routes.js, its mount at /api/duty-free-profiles, and
-- the unused fetchDutyFreeProfiles / DutyFreeProfile in the frontend.
--
-- WHY IT IS SAFE
-- --------------
-- Added 2026-08-16 and never reached working order. The audit found:
--
--   1. NO DATA is expected — but this migration does not take that on trust.
--      It COUNTS the rows first and aborts rather than dropping a table that
--      turns out to hold something. See the guard at the foot of this file.
--
--   2. NO READERS. The service is a closed loop — dutyFree.routes.js is its
--      only caller, and nothing else in the backend requires it. The single
--      frontend touchpoint, fetchDutyFreeProfiles(), has zero call sites.
--
--   3. IT COULD NOT HAVE WORKED. generateInvoiceNumber() was written as
--
--          UPDATE duty_free_invoice_sequences
--             SET current_value = current_value + 1
--           WHERE ... RETURNING current_value, prefix, padding
--
--      UPDATE ... RETURNING is MariaDB and PostgreSQL syntax. MySQL 8 rejects
--      it with a parse error, so this function has never once returned an
--      invoice number. That is the clearest evidence the code path was never
--      exercised.
--
-- WHAT REPLACES IT
-- ----------------
-- The three-axis model that came out of the country-agnostic rework:
--
--   "is this store duty-free?"    -> store_jurisdiction_settings.sales_mode
--   "what does the country need?" -> jurisdiction_profiles
--   "what goes on the document?"  -> print_templates blocks
--   "how many copies?"            -> print_templates blocks
--   "legal / export wording"      -> store_jurisdiction_settings.export_declaration_text
--
-- Every field of duty_free_profiles maps onto one of those. Keeping it would
-- leave two plausible-looking homes for the same setting, which is how a store
-- ends up configured duty-free in one place and taxed in the other.
--
-- INVOICE NUMBERING IS NOT LOST — IT WAS NEVER GAINED
-- ---------------------------------------------------
-- duty_free_invoice_sequences looks like the sequential-numbering feature that
-- is still on the roadmap, so it is worth being explicit: it is not a working
-- implementation to build on. Beyond the invalid SQL above, the design is
-- wrong for the requirement — it is keyed on a duty-free profile rather than on
-- (tenant, store, document type, period), and it increments outside the sale
-- transaction, so a rolled-back sale would still burn a number and leave a gap.
-- Tax authorities that mandate sequential numbering specifically prohibit gaps.
--
-- The replacement is planned as a `document_sequences` table keyed
-- (tenant, store, doc_type, period), allocated with SELECT ... FOR UPDATE
-- inside the sale transaction. Tracked in 09_Retail_Profile_and_Open_Gaps.md.
--
-- REVERSIBILITY
-- -------------
-- The full CREATE TABLE statements remain in
-- database/migrations/applied/2026-08-16_print_templates.sql if the structure
-- is ever wanted again. No data is lost because there is none.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- GUARD: refuse to drop a table that actually holds data.
--
-- The audit says these are empty. This checks rather than believes — if any
-- environment has rows, the migration aborts with a message instead of
-- destroying them, and the situation gets looked at by a human.
--
-- Counting requires the tables to exist, so each count is routed through a
-- prepared statement that yields 0 when the table is already gone (making this
-- migration safe to re-run after a partial application).
-- -----------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS `_df_rowcount`;
CREATE TEMPORARY TABLE `_df_rowcount` (n BIGINT NOT NULL);

SET @t = 'duty_free_profiles';
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t) = 0,
  'INSERT INTO `_df_rowcount` VALUES (0)',
  'INSERT INTO `_df_rowcount` SELECT COUNT(*) FROM `duty_free_profiles`');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @t = 'duty_free_invoice_sequences';
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t) = 0,
  'INSERT INTO `_df_rowcount` VALUES (0)',
  'INSERT INTO `_df_rowcount` SELECT COUNT(*) FROM `duty_free_invoice_sequences`');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @t = 'duty_free_invoice_corrections';
SET @sql = IF(
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @t) = 0,
  'INSERT INTO `_df_rowcount` VALUES (0)',
  'INSERT INTO `_df_rowcount` SELECT COUNT(*) FROM `duty_free_invoice_corrections`');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @df_rows = (SELECT COALESCE(SUM(n), 0) FROM `_df_rowcount`);
DROP TEMPORARY TABLE `_df_rowcount`;

SET @msg = CONCAT(
  'ABORTED: the duty_free_* tables hold ', @df_rows, ' row(s). This migration ',
  'expected them to be empty and will not drop live data. Export the rows, ',
  'decide where they belong under store_jurisdiction_settings / print_templates, ',
  'then re-run.');

SET @guard = IF(@df_rows = 0,
  'SELECT 1',
  CONCAT('SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ', QUOTE(@msg)));
PREPARE stmt FROM @guard; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- -----------------------------------------------------------------------------
-- Child tables first: duty_free_invoice_sequences has a FK to duty_free_profiles.
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `duty_free_invoice_corrections`;
DROP TABLE IF EXISTS `duty_free_invoice_sequences`;
DROP TABLE IF EXISTS `duty_free_profiles`;
