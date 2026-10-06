-- Migration: Add sales.override_tax_mode permission
-- Date: 2026-09-03
-- Scope: Per-transaction duty-free/export/domestic override (Option B from
--   docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md §5). Today
--   sales_mode/zero-rating is resolved purely from the STORE's jurisdiction
--   setting (createSaleController.js) — every sale at a duty-free-configured
--   store is zero-rated, with no way to ring an ordinary taxed sale there, and
--   vice versa for a domestic store serving an occasional duty-free traveller.
--
--   This permission gates the new per-sale override so flipping a sale's tax
--   treatment away from the store's default is a deliberate, permissioned
--   action, not something every cashier can do by default. Tenant Admins
--   bypass permission checks by role name (see rbacPermissionMiddleware.js)
--   and get this automatically; every other role needs it granted explicitly
--   via Roles management, same as any other permission added after a role
--   already exists.
--
-- Idempotent: checks for existence before inserting.

INSERT INTO `permissions` (`id`, `name`, `description`, `module`)
SELECT uuid(), 'sales.override_tax_mode', 'Override a sale''s tax/duty-free mode away from the store default', 'sales'
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `permissions` WHERE `name` = 'sales.override_tax_mode');
