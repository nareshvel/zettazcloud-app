-- Migration: Backfill tenants.industry_code for existing stores
-- Date: 2026-08-09
-- Existing tenants onboarded before industry capture have industry_code = NULL.
-- Derive it from the onboarding businessType stored in tenants.settings JSON,
-- defaulting to 'general_retail'. Mirrors backend/services/industryMapping.js.
-- Idempotent: only fills rows where industry_code IS NULL.

UPDATE `tenants`
SET `industry_code` = CASE LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(`settings`, '$.businessType')), ''))
  WHEN 'jewelry'     THEN 'jewelry'
  WHEN 'jewellery'   THEN 'jewelry'
  WHEN 'clothing'    THEN 'apparel'
  WHEN 'apparel'     THEN 'apparel'
  WHEN 'electronics' THEN 'electronics'
  WHEN 'grocery'     THEN 'grocery'
  WHEN 'supermarket' THEN 'grocery'
  WHEN 'pharmacy'    THEN 'pharmacy'
  ELSE 'general_retail'
END
WHERE `industry_code` IS NULL;

-- Verify:
--   SELECT name, industry_code,
--          JSON_UNQUOTE(JSON_EXTRACT(settings,'$.businessType')) AS business_type
--   FROM tenants;
