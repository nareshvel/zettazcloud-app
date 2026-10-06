-- Migration: Fix customer_code_sequences for tenants seeded after the initial backfill
-- Date: 2026-08-14
-- Problem: Tenants added via seed after 2026-08-10_customer_code.sql ran have no row
--          in customer_code_sequences, so the code-allocation INSERT…ON DUPLICATE KEY
--          UPDATE silently fails and all new customers get NULL codes.
-- Fix: Upsert a sequences row for every tenant that has customers, then backfill any
--      customers still missing a code.
-- Idempotent: safe to re-run.

-- 1. Ensure every tenant with customers has a sequences row (seed at 0 if new).
INSERT IGNORE INTO `customer_code_sequences` (`tenant_id`, `last_value`)
SELECT DISTINCT `tenant_id`, 0 FROM `customers`;

-- 2. Bump each tenant's sequence to the highest existing code so the next allocation
--    continues from the right number (covers partial-backfill situations).
UPDATE `customer_code_sequences` s
  JOIN (
    SELECT tenant_id,
           COALESCE(MAX(CAST(SUBSTRING(customer_code, 4) AS UNSIGNED)), 0) AS max_val
      FROM `customers`
     WHERE customer_code REGEXP '^CU-[0-9]+$'
     GROUP BY tenant_id
  ) m ON m.tenant_id = s.tenant_id
   SET s.`last_value` = GREATEST(s.`last_value`, m.max_val);

-- 3. Backfill customers that still have no code.
DROP TEMPORARY TABLE IF EXISTS tmp_fix_codes;
CREATE TEMPORARY TABLE tmp_fix_codes AS
SELECT x.id,
       CONCAT('CU-', LPAD(
         base.max_seq + ROW_NUMBER() OVER (PARTITION BY x.tenant_id ORDER BY x.created_at, x.id),
         6, '0')) AS new_code
  FROM `customers` x
  JOIN (
    SELECT t.tenant_id,
           COALESCE(MAX(CAST(SUBSTRING(c2.customer_code, 4) AS UNSIGNED)), 0) AS max_seq
      FROM (SELECT DISTINCT tenant_id FROM `customers` WHERE customer_code IS NULL) t
      LEFT JOIN `customers` c2
             ON c2.tenant_id = t.tenant_id
            AND c2.customer_code REGEXP '^CU-[0-9]+$'
     GROUP BY t.tenant_id
  ) base ON base.tenant_id = x.tenant_id
 WHERE x.customer_code IS NULL;

UPDATE `customers` c
  JOIN tmp_fix_codes n ON n.id = c.id
   SET c.customer_code = n.new_code;

DROP TEMPORARY TABLE IF EXISTS tmp_fix_codes;

-- 4. Re-sync sequences to the new maximum.
UPDATE `customer_code_sequences` s
  JOIN (
    SELECT tenant_id,
           MAX(CAST(SUBSTRING(customer_code, 4) AS UNSIGNED)) AS max_val
      FROM `customers`
     WHERE customer_code REGEXP '^CU-[0-9]+$'
     GROUP BY tenant_id
  ) m ON m.tenant_id = s.tenant_id
   SET s.`last_value` = m.max_val;

-- Done.
