-- =============================================================================
-- 2026-08-31  plans — add the missing "Starter" tier
-- =============================================================================
-- WHY THIS EXISTS
-- ----------------
-- The public pricing page (frontend/src/pages/LandingPage.tsx) advertises three
-- tiers: Starter, Professional, Enterprise. The `plans` table seeded in
-- 2025-06-18_rbac_seed_data.sql only ever had Basic/Professional/Enterprise —
-- there is no "Starter" row. Signup's plan-name mapping
-- (backend/services/signupService.js, createTrialSubscription) maps a
-- 'starter' selection to the DB plan name 'Starter', looks it up with
-- `SELECT id FROM plans WHERE name = ? AND is_active = 1`, finds nothing, and
-- silently skips creating a trial subscription (by design — a lookup miss
-- must never fail signup) — so a tenant who picked Starter previously ended
-- up with no subscription row at all rather than a Starter one.
--
-- This seed adds that row using the same feature/limit shape as the existing
-- Basic/Professional/Enterprise rows, matching the pricing page's Starter
-- copy (1,000 transactions/month, basic reporting, email support).
--
-- Idempotent per repo convention (INSERT ... SELECT ... WHERE NOT EXISTS —
-- `plans.name` has no unique key, so INSERT IGNORE/ON DUPLICATE KEY UPDATE
-- can't be used here).
-- =============================================================================

INSERT INTO `plans` (`id`, `name`, `description`, `price_monthly`, `price_yearly`, `currency`, `features`, `limits`, `is_active`)
SELECT
  uuid(), 'Starter', 'Entry-level plan for small businesses trying out Zettaz Cloud POS', 0.00, 0.00, 'USD',
  JSON_OBJECT(
    'pointOfSale', true,
    'inventory', true,
    'basicReports', true,
    'customerManagement', true,
    'multiUser', false,
    'support', 'email'
  ),
  JSON_OBJECT(
    'stores', 1,
    'products', 200,
    'users', 1,
    'storage', '500MB'
  ),
  1
WHERE NOT EXISTS (SELECT 1 FROM `plans` WHERE `name` = 'Starter');
