-- =============================================================================
-- 2026-08-31  plans — populate live Stripe Price IDs
-- =============================================================================
-- Products/Prices were created directly via the Stripe MCP connector against the
-- live "Zettaz SaaS" Stripe account (acct_1TgFuNDiMTz5HnMK) — see
-- docs/17-migration-and-roadmap/17_Stripe_Billing_Module.md for the architecture
-- these feed into. Requires 2026-08-31_stripe_billing_module.sql (adds
-- stripe_price_id_monthly/stripe_price_id_yearly to `plans`) to already be applied.
--
-- Product IDs (for reference, not stored on `plans`):
--   Starter      -> prod_VAylNk2gLK4S9u
--   Growth       -> prod_VAym3IM9VhoY9U
--   Professional -> prod_VAymukwqj9mEcT
--   Enterprise   -> prod_VAym0GPNQ1KPJ6
--
-- Idempotent: re-running just overwrites with the same values.
-- =============================================================================

UPDATE `plans` SET
  `stripe_price_id_monthly` = 'price_1UAcocDiMTz5HnMK1hRypeIU',
  `stripe_price_id_yearly`  = 'price_1UAcoeDiMTz5HnMK3wDzL3W7'
WHERE `id` = '2487711b-a560-11f1-97e5-525400d69130'; -- Starter

UPDATE `plans` SET
  `stripe_price_id_monthly` = 'price_1UAcogDiMTz5HnMKMFb6GIyD',
  `stripe_price_id_yearly`  = 'price_1UAcohDiMTz5HnMKckJhxx6i'
WHERE `id` = '6baf0d04-4c50-11f0-8dfa-525400d69130'; -- Growth

UPDATE `plans` SET
  `stripe_price_id_monthly` = 'price_1UAcojDiMTz5HnMKY5QYYiBT',
  `stripe_price_id_yearly`  = 'price_1UAcolDiMTz5HnMKOzTB0yZJ'
WHERE `id` = '6baf1082-4c50-11f0-8dfa-525400d69130'; -- Professional

UPDATE `plans` SET
  `stripe_price_id_monthly` = 'price_1UAconDiMTz5HnMKgBFszTay',
  `stripe_price_id_yearly`  = 'price_1UAcooDiMTz5HnMKvosyY5Sr'
WHERE `id` = '6baf11e2-4c50-11f0-8dfa-525400d69130'; -- Enterprise
