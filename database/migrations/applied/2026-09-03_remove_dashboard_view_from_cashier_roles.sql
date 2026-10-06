-- Migration: Remove dashboard.view from Cashier / Sales Associate roles
-- Date: 2026-09-03
--
-- WHY
-- ---
-- dashboard.view was never actually the permission gating navigation to the
-- admin /dashboard route — that's gated by isAdminUser (see
-- frontend/src/utils/permissionUtils.ts), which every Cashier legitimately
-- fails regardless of this grant. Both the original signup seed
-- (database/seeds/applied/2025-06-18_rbac_seed_data.sql) and
-- backend/services/permissionSeedingService.js's ROLE_PERMISSIONS.Cashier
-- template granted it anyway, and the Diamond Republic demo seed
-- (2026-08-15_diamond_republic_antigua_seed.sql) copied the same grant onto
-- both its Cashier role and its Sales Associate role. Every cashier having
-- dashboard.view meant it gated nothing and only obscured what the
-- permission was actually for.
--
-- permissionSeedingService.js's ROLE_PERMISSIONS.Cashier template was fixed
-- in the same session as this migration (dashboard.view removed) — that
-- fixes every FUTURE tenant signup. This migration retroactively fixes
-- every EXISTING tenant (real and demo) whose Cashier/Sales Associate role
-- already has the grant, by role NAME rather than by tenant, since the same
-- over-grant was seeded identically everywhere.
--
-- SAFETY
-- ------
-- Only removes the role_permissions row(s) linking a role literally named
-- 'Cashier' or 'Sales Associate' to the 'dashboard.view' permission. Does
-- not touch any other role or any other permission. A tenant that manually,
-- deliberately re-granted dashboard.view to a custom-configured Cashier
-- role after this migration runs is unaffected going forward — this is a
-- one-time cleanup of the original over-broad seed, not an ongoing
-- constraint.
-- =============================================================================

DELETE rp FROM role_permissions rp
  JOIN roles r ON r.id = rp.role_id
  JOIN permissions p ON p.id = rp.permission_id
WHERE r.name IN ('Cashier', 'Sales Associate')
  AND p.name = 'dashboard.view';
