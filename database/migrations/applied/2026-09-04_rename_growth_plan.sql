-- =============================================================================
-- 2026-09-04  plans — rename "Basic" to "Growth"
-- =============================================================================
-- The plan row id `6baf0d04-4c50-11f0-8dfa-525400d69130` was originally seeded
-- as "Basic" in database/seeds/applied/2025-06-18_rbac_seed_data.sql. The
-- 2026-08-31 Stripe price-id migration already referred to this same plan as
-- "Growth" in its comments, but no migration ever actually updated the
-- `plans.name` column — every environment that ran the original seed still has
-- a plan literally named "Basic" in the database. We no longer use the name
-- "Basic" anywhere (UI, docs, seed source) — this migration is the one place
-- that performs the real, idempotent rename against a live database.
--
-- Idempotent: re-running is a no-op once the name is already "Growth".
-- =============================================================================

UPDATE `plans`
SET `name` = 'Growth'
WHERE `id` = '6baf0d04-4c50-11f0-8dfa-525400d69130'
  AND `name` = 'Basic';
