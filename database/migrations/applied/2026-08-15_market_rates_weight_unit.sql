-- =============================================================================
-- 2026-08-15  Market rate fetch config + weight unit localisation
-- =============================================================================
-- Adds to tenant_pricing_settings:
--   market_rate_api_key          goldapi.io API key (stored as plain text; encrypt at app layer if needed)
--   market_rate_local_premium_pct  local duty/premium % applied over international spot (e.g. 15 for India)
--   market_rate_auto_publish     0 = preview only, 1 = auto-publish fetched rates daily
--   market_rate_fetch_time       HH:MM (24h) local time to run the daily fetch, e.g. '10:00'
--   weight_unit                  'g' | 'oz' | 'tola' | 'baht' | 'kg' — org-wide weight display unit
-- All idempotent.
-- =============================================================================

SET @tbl = 'tenant_pricing_settings';

-- market_rate_api_key
SET @col = 'market_rate_api_key';
SET @q = IF(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),
  'SELECT 1',
  CONCAT('ALTER TABLE `',@tbl,'` ADD COLUMN `',@col,'` varchar(120) DEFAULT NULL COMMENT ''goldapi.io API key'''));
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- market_rate_local_premium_pct
SET @col = 'market_rate_local_premium_pct';
SET @q = IF(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),
  'SELECT 1',
  CONCAT('ALTER TABLE `',@tbl,'` ADD COLUMN `',@col,'` decimal(6,3) NOT NULL DEFAULT 0.000 COMMENT ''% markup over international spot for local duties/taxes'''));
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- market_rate_auto_publish
SET @col = 'market_rate_auto_publish';
SET @q = IF(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),
  'SELECT 1',
  CONCAT('ALTER TABLE `',@tbl,'` ADD COLUMN `',@col,'` tinyint(1) NOT NULL DEFAULT 0 COMMENT ''1=auto-publish daily, 0=preview only'''));
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- market_rate_fetch_time
SET @col = 'market_rate_fetch_time';
SET @q = IF(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),
  'SELECT 1',
  CONCAT('ALTER TABLE `',@tbl,'` ADD COLUMN `',@col,'` varchar(5) NOT NULL DEFAULT ''10:00'' COMMENT ''HH:MM 24h local time for daily auto-fetch'''));
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;

-- weight_unit
SET @col = 'weight_unit';
SET @q = IF(EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME=@col),
  'SELECT 1',
  CONCAT('ALTER TABLE `',@tbl,'` ADD COLUMN `',@col,'` enum(''g'',''oz'',''tola'',''baht'',''kg'') NOT NULL DEFAULT ''g'' COMMENT ''org-wide weight display unit'''));
PREPARE s FROM @q; EXECUTE s; DEALLOCATE PREPARE s;
