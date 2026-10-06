-- Migration: Company (tenant-level) contact/communication profile
-- Date: 2026-09-01
-- Idempotent per repo convention (INFORMATION_SCHEMA.COLUMNS guard + PREPARE/EXECUTE).
--
-- WHY
-- ---
-- `stores` has real, typed, always-editable columns for address/phone/email/
-- logo. `tenants` (the company/parent-company level, per
-- docs/17-migration-and-roadmap/22_Tenant_vs_Store_Business_Identity_Audit_And_Plan.md)
-- had NONE of that — company contact info collected once during onboarding
-- (backend/routes/onboardingRoutes.js) was written only into `tenants.settings`
-- (a JSON blob) and was never read back anywhere: `GET /api/tenants/me` only
-- ever selected `id, name, industry_code`. A company's own address/phone/
-- website was therefore captured exactly once, at signup, and permanently
-- invisible and uneditable afterward. This migration gives the company level
-- the same first-class columns the store level already has.
--
-- Columns deliberately mirror a subset of `stores`' naming
-- (address/city/state/postal_code/country_code/phone/email/website/logo_url)
-- so the same form patterns and validation used for store General Settings
-- can be reused for the new Company Profile UI without inventing a second
-- vocabulary.

-- ---------------------------------------------------------------------------
-- 1. Add columns
-- ---------------------------------------------------------------------------
SET @tbl = 'tenants';

SET @col = 'address';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  'ALTER TABLE `tenants` ADD COLUMN `address` varchar(500) DEFAULT NULL COMMENT ''Company street address, distinct from any individual store''''s address.'''
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @col = 'city';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  'ALTER TABLE `tenants` ADD COLUMN `city` varchar(120) DEFAULT NULL'
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @col = 'state';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  'ALTER TABLE `tenants` ADD COLUMN `state` varchar(120) DEFAULT NULL'
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @col = 'postal_code';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  'ALTER TABLE `tenants` ADD COLUMN `postal_code` varchar(20) DEFAULT NULL'
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @col = 'country_code';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  'ALTER TABLE `tenants` ADD COLUMN `country_code` varchar(2) DEFAULT NULL COMMENT ''ISO 3166-1 alpha-2, e.g. US, AG.'''
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @col = 'phone';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  'ALTER TABLE `tenants` ADD COLUMN `phone` varchar(40) DEFAULT NULL COMMENT ''Company-level contact phone, distinct from any store''''s or user''''s phone.'''
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @col = 'email';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  'ALTER TABLE `tenants` ADD COLUMN `email` varchar(255) DEFAULT NULL COMMENT ''Company-level contact email — general/company inbox, not any one user''''s login email.'''
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @col = 'website';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  'ALTER TABLE `tenants` ADD COLUMN `website` varchar(255) DEFAULT NULL'
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

SET @col = 'logo_url';
SET @sql = IF(
  EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @tbl AND COLUMN_NAME = @col),
  'SELECT 1 -- already exists',
  'ALTER TABLE `tenants` ADD COLUMN `logo_url` varchar(500) DEFAULT NULL COMMENT ''Company-wide logo — distinct from a store''''s own logo_url; used where the company itself, rather than a specific store, is represented.'''
);
PREPARE _s FROM @sql; EXECUTE _s; DEALLOCATE PREPARE _s;

-- ---------------------------------------------------------------------------
-- 2. Backfill from `settings` JSON for tenants that completed onboarding
--    before these columns existed (see onboardingRoutes.js's tenantSettings
--    object — address/city/state/zipCode/website were written there).
--    Only fills a column if it is currently NULL, so this is safe to re-run
--    and never clobbers a value already entered through a real form.
-- ---------------------------------------------------------------------------
UPDATE `tenants`
   SET `address`  = COALESCE(`address`,  JSON_UNQUOTE(JSON_EXTRACT(`settings`, '$.address'))),
       `city`     = COALESCE(`city`,     JSON_UNQUOTE(JSON_EXTRACT(`settings`, '$.city'))),
       `state`    = COALESCE(`state`,    JSON_UNQUOTE(JSON_EXTRACT(`settings`, '$.state'))),
       `postal_code` = COALESCE(`postal_code`, JSON_UNQUOTE(JSON_EXTRACT(`settings`, '$.zipCode'))),
       `website`  = COALESCE(`website`,  JSON_UNQUOTE(JSON_EXTRACT(`settings`, '$.website')))
 WHERE `settings` IS NOT NULL
   AND JSON_VALID(`settings`)
   AND (
        JSON_EXTRACT(`settings`, '$.address') IS NOT NULL
     OR JSON_EXTRACT(`settings`, '$.city') IS NOT NULL
     OR JSON_EXTRACT(`settings`, '$.state') IS NOT NULL
     OR JSON_EXTRACT(`settings`, '$.zipCode') IS NOT NULL
     OR JSON_EXTRACT(`settings`, '$.website') IS NOT NULL
   );

-- =============================================================================
-- Verification
-- =============================================================================
-- SELECT id, name, address, city, state, postal_code, country_code, phone,
--        email, website, logo_url
--   FROM tenants
--  LIMIT 20;
