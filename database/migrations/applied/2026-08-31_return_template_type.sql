-- =============================================================================
-- 2026-08-31  Add 'return' to the print template type enum
-- =============================================================================
-- WHY
-- ---
-- Refunds now have a purpose-built template rather than borrowing the receipt
-- shape. `print_templates.template_type` is an ENUM, so provisioning one would
-- otherwise fail at insert with:
--
--     Data truncated for column 'template_type' at row 1
--
-- — a message that gives no hint the cause is a missing enum member.
--
-- WHY AN ENUM IS A LIABILITY HERE
-- -------------------------------
-- Every new document type needs a schema migration before the application can
-- create one, and the failure surfaces as data truncation rather than anything
-- readable. A VARCHAR with validation in the service would be easier to evolve.
--
-- Not changed today, deliberately: the enum is doing real work — it stops a
-- typo'd type reaching the table, and `retailProfile.test.js` already asserts
-- every planned templateType maps to a real DEFAULT_BLOCKS entry. Widening it
-- to VARCHAR is a separate decision from shipping refund documents, and mixing
-- the two would make this migration harder to reason about.
--
-- SAFETY
-- ------
-- Adding a member to an ENUM is non-destructive: existing rows keep their
-- values and the column stays NOT NULL. Idempotent — re-running finds the
-- member already present and does nothing.
-- =============================================================================

SET @has_return := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'print_templates'
    AND COLUMN_NAME = 'template_type'
    AND COLUMN_TYPE LIKE '%''return''%'
);

SET @sql := IF(@has_return = 0,
  'ALTER TABLE `print_templates`
     MODIFY COLUMN `template_type`
       ENUM(''receipt'', ''invoice'', ''label'', ''document'',
            ''jewelry_invoice'', ''jewelry_certificate'', ''return'')
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
    AND COLUMN_TYPE NOT LIKE '%''return''%'
);

SET @sql := IF(@needs_version_update > 0,
  'ALTER TABLE `print_template_versions`
     MODIFY COLUMN `template_type`
       ENUM(''receipt'', ''invoice'', ''label'', ''document'',
            ''jewelry_invoice'', ''jewelry_certificate'', ''return'')
       NOT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
