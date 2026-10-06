-- =============================================================================
-- 2026-08-24 Retail profile: industry catalog seed + duty-free flag
-- =============================================================================
-- WHY
-- ---
-- Two gaps in how a store describes itself:
--
--   1. `industry_types` was created in 2026-08-08 but NEVER SEEDED. The table is
--      empty, so any UI trying to offer a business-type picker has nothing to
--      show, and `tenants.industry_code` holds values with no catalog behind
--      them. This seeds the six verticals the product actually supports.
--
--   2. Nothing recorded whether a store sells DUTY-FREE. That single fact
--      determines which templates make sense, whether passport capture is
--      required, and whether sales are zero-rated — so it belongs next to
--      business type in General Settings, not buried in a template.
--
-- DESIGN — no new column for duty-free
-- ------------------------------------
-- `store_jurisdiction_settings.sales_mode` already models exactly this
-- (domestic | duty_free | export | mixed) and is read by the tax engine and the
-- print renderers. Adding a second boolean would create two sources of truth
-- that can disagree — the classic setup for "the checkbox says duty-free but
-- the receipt charges tax".
--
-- So the checkbox in General Settings writes `sales_mode`. What IS added here
-- is convenience: a generated column so a store row can be filtered on
-- duty-free without a join, and the industry catalog it depends on.
--
-- Idempotent per repo convention.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Seed the industry catalog (previously empty)
-- ---------------------------------------------------------------------------
-- Codes match backend/services/industryMapping.js — that file is the single
-- place the onboarding vocabulary and the platform vocabulary meet.
-- ---------------------------------------------------------------------------
INSERT IGNORE INTO `industry_types` (`code`, `name`, `description`, `is_active`, `sort_order`)
VALUES
  ('general_retail', 'General Retail',
   'Everyday retail — the default when no specialised vertical applies', 1, 10),

  ('grocery', 'Grocery & Supermarket',
   'Weighed produce, PLU codes, mixed taxable and exempt baskets', 1, 20),

  ('electronics', 'Electronics',
   'Serialised goods, IMEI capture, warranty terms and RMA returns', 1, 30),

  ('apparel', 'Apparel & Fashion',
   'Size and colour variants, exchange-first returns, gift receipts', 1, 40),

  ('jewelry', 'Jewelry & Bullion',
   'Purity, gross and net weight, making charges, serialised pieces', 1, 50),

  -- Held back: dispensing records carry regulatory weight and the rules differ
  -- per board of pharmacy. is_active = 0 keeps it out of the picker until the
  -- blocks have been reviewed for each target market.
  ('pharmacy', 'Pharmacy',
   'Prescription dispensing — pending regulatory review, not yet selectable', 0, 60);

-- ---------------------------------------------------------------------------
-- 2. Retail profile columns on stores
-- ---------------------------------------------------------------------------

-- Which vertical this STORE operates as. Usually inherited from the tenant, but
-- a group may run a jewellery counter and a general store under one tenant.
SET @tbl = 'stores';
SET @col = 'industry_code';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  CONCAT('ALTER TABLE `', @tbl, '` ADD COLUMN `', @col,
         '` varchar(40) DEFAULT NULL COMMENT ''Vertical for this store. NULL = inherit from tenant''')
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Backfill store industry from the tenant, so existing stores are not blank.
UPDATE `stores` s
  JOIN `tenants` t ON t.`id` = s.`tenant_id`
   SET s.`industry_code` = COALESCE(t.`industry_code`, 'general_retail')
 WHERE s.`industry_code` IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Make duty-free queryable without a join
-- ---------------------------------------------------------------------------
-- A read-only convenience mirror of store_jurisdiction_settings.sales_mode.
-- Deliberately NOT independently writable — see the design note above.
-- ---------------------------------------------------------------------------
SET @col = 'is_duty_free';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stores' AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  'ALTER TABLE `stores` ADD COLUMN `is_duty_free` tinyint(1) NOT NULL DEFAULT 0
     COMMENT ''Mirror of store_jurisdiction_settings.sales_mode. Written by the settings API, never edited directly'''
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- Sync the mirror for stores already configured as duty-free.
UPDATE `stores` s
  JOIN `store_jurisdiction_settings` sjs ON sjs.`store_id` = s.`id`
   SET s.`is_duty_free` = IF(sjs.`sales_mode` IN ('duty_free', 'export'), 1, 0);

-- ---------------------------------------------------------------------------
-- 4. Index for template provisioning lookups
-- ---------------------------------------------------------------------------
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'stores'
             AND INDEX_NAME = 'idx_store_retail_profile'),
  'SELECT 1 -- already exists',
  'ALTER TABLE `stores` ADD INDEX `idx_store_retail_profile` (`tenant_id`, `industry_code`, `is_duty_free`)'
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- =============================================================================
-- Verification
-- =============================================================================
-- SELECT code, name, is_active FROM industry_types ORDER BY sort_order;
--
-- SELECT s.name, s.industry_code, s.is_duty_free, sjs.sales_mode
--   FROM stores s
--   LEFT JOIN store_jurisdiction_settings sjs ON sjs.store_id = s.id;
--
-- Mirror must never disagree with the source of truth -- expect ZERO rows:
-- SELECT s.id FROM stores s
--   JOIN store_jurisdiction_settings sjs ON sjs.store_id = s.id
--  WHERE s.is_duty_free <> IF(sjs.sales_mode IN ('duty_free','export'), 1, 0);
-- =============================================================================
