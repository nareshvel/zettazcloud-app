-- Migration: Human-friendly customer code
-- Date: 2026-08-10  (rev 2 — MySQL 8 safe)
-- The UUID `customers.id` stays the internal key (never shown in the UI).
-- `customer_code` is a short, per-tenant sequential identifier staff can read out,
-- e.g. CU-000123.
--
-- rev 2 fixes two issues found on the first production run:
--   a) `INSERT ... SELECT ... ON DUPLICATE KEY UPDATE ... VALUES()` is not valid
--      in MySQL 8 — replaced with INSERT IGNORE + UPDATE ... JOIN.
--   b) The backfill used session variables (@rownum), whose evaluation order is
--      undefined in MySQL 8 and can produce duplicate codes — replaced with the
--      ROW_NUMBER() window function, and a de-duplication step added to repair
--      any bad codes written by rev 1.
--
-- Idempotent: safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) Column
-- ---------------------------------------------------------------------------
SET @col := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
             WHERE table_schema=DATABASE() AND table_name='customers' AND column_name='customer_code');
SET @sql := IF(@col=0,
  'ALTER TABLE `customers` ADD COLUMN `customer_code` varchar(40) DEFAULT NULL COMMENT ''Human-friendly sequential code, unique per tenant'' AFTER `tenant_id`',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ---------------------------------------------------------------------------
-- 2) Per-tenant sequence table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `customer_code_sequences` (
  `tenant_id`  char(36) NOT NULL,
  `last_value` int      NOT NULL DEFAULT 0,
  PRIMARY KEY (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- 3) Repair: clear any DUPLICATE codes within a tenant (keeps the earliest row).
--    Protects against bad data from rev 1 and lets the unique index be added.
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_dupe_customer_codes;
CREATE TEMPORARY TABLE tmp_dupe_customer_codes AS
SELECT id FROM (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id, customer_code ORDER BY created_at, id) AS rn
    FROM `customers`
   WHERE customer_code IS NOT NULL
) d
WHERE d.rn > 1;

UPDATE `customers` c
  JOIN tmp_dupe_customer_codes t ON t.id = c.id
   SET c.customer_code = NULL;

DROP TEMPORARY TABLE IF EXISTS tmp_dupe_customer_codes;

-- ---------------------------------------------------------------------------
-- 4) Backfill customers without a code, numbered per tenant, continuing from the
--    highest code that tenant already has. ROW_NUMBER() is deterministic.
--    A temporary table is used so we never read and write `customers` in one go.
-- ---------------------------------------------------------------------------
DROP TEMPORARY TABLE IF EXISTS tmp_new_customer_codes;
CREATE TEMPORARY TABLE tmp_new_customer_codes AS
SELECT x.id,
       CONCAT('CU-', LPAD(
         base.max_seq + ROW_NUMBER() OVER (PARTITION BY x.tenant_id ORDER BY x.created_at, x.id),
         6, '0')) AS new_code
  FROM `customers` x
  JOIN (
    SELECT t.tenant_id,
           COALESCE(MAX(CAST(SUBSTRING(c2.customer_code, 4) AS UNSIGNED)), 0) AS max_seq
      FROM (SELECT DISTINCT tenant_id FROM `customers`) t
      LEFT JOIN `customers` c2
             ON c2.tenant_id = t.tenant_id
            AND c2.customer_code REGEXP '^CU-[0-9]+$'
     GROUP BY t.tenant_id
  ) base ON base.tenant_id = x.tenant_id
 WHERE x.customer_code IS NULL;

UPDATE `customers` c
  JOIN tmp_new_customer_codes n ON n.id = c.id
   SET c.customer_code = n.new_code;

DROP TEMPORARY TABLE IF EXISTS tmp_new_customer_codes;

-- ---------------------------------------------------------------------------
-- 5) Seed the sequence table from the highest code per tenant.
--    Two plain statements — avoids INSERT...SELECT...ON DUPLICATE KEY UPDATE.
-- ---------------------------------------------------------------------------
-- NOTE: `last_value` is a RESERVED WORD in MySQL 8 (the LAST_VALUE() window
-- function), so it must be backtick-quoted everywhere it is used as a column.
INSERT IGNORE INTO `customer_code_sequences` (`tenant_id`, `last_value`)
SELECT DISTINCT `tenant_id`, 0 FROM `customers`;

UPDATE `customer_code_sequences` s
  JOIN (
    SELECT tenant_id,
           COALESCE(MAX(CAST(SUBSTRING(customer_code, 4) AS UNSIGNED)), 0) AS max_seq
      FROM `customers`
     WHERE customer_code REGEXP '^CU-[0-9]+$'
     GROUP BY tenant_id
  ) m ON m.tenant_id = s.`tenant_id`
   SET s.`last_value` = GREATEST(s.`last_value`, m.max_seq);

-- ---------------------------------------------------------------------------
-- 6) Unique per tenant (added last, after backfill + de-duplication)
-- ---------------------------------------------------------------------------
SET @idx := (SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
             WHERE table_schema=DATABASE() AND table_name='customers' AND index_name='uniq_tenant_customer_code');
SET @sql := IF(@idx=0,
  'ALTER TABLE `customers` ADD UNIQUE KEY `uniq_tenant_customer_code` (`tenant_id`,`customer_code`)',
  'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- Verify after running:
--   SELECT tenant_id, customer_code, first_name, created_at
--     FROM customers ORDER BY tenant_id, customer_code LIMIT 20;
--   SELECT * FROM customer_code_sequences;
--   -- must return 0 rows:
--   SELECT tenant_id, customer_code, COUNT(*) FROM customers
--    WHERE customer_code IS NOT NULL
--    GROUP BY tenant_id, customer_code HAVING COUNT(*) > 1;
