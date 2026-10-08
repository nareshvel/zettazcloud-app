-- ============================================================================
-- Platform-scoped system.* permissions — dead tenant grant cleanup — 2026-10-15
--
-- Six catalog permissions gate platform-console routes but were seeded with
-- tenant-scoped `system.*` names:
--   system.roles.manage      → /api/roles/system* CRUD, GET /permissions/system
--   system.plans.manage      → legacy guard on subscription plan writes
--   system.platform.manage   → legacy guard on POST /auth/register
--   system.logs.view         → platform log viewer
--   system.settings.view     → platform settings read
--   system.settings.edit     → platform settings write
--
-- They are now classified platform-scoped by the canonical rule
-- (PermissionSeedingService.isPlatformScopedName) and resolve only through
-- NULL-tenant system roles. Grants held by tenant roles are therefore dead —
-- kept, they would also be a misleading UI record and a future escalation
-- surface if semantics ever drifted back. Remove them from tenant roles only;
-- NULL-tenant system roles legitimately hold the same names via
-- role_permissions on the live checkSystemPermission path and are preserved.
--
-- The catalog rows themselves stay in `permissions` — that table is the
-- live-path grant catalog for NULL-tenant system roles.
--
-- Idempotent: DELETE is a no-op when nothing matches.
-- ============================================================================

DELETE rp FROM role_permissions rp
JOIN roles r ON r.id = rp.role_id AND r.tenant_id IS NOT NULL
JOIN permissions p ON p.id = rp.permission_id
WHERE p.name IN (
  'system.roles.manage',
  'system.plans.manage',
  'system.platform.manage',
  'system.logs.view',
  'system.settings.view',
  'system.settings.edit'
);
