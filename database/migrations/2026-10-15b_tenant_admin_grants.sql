-- ============================================================================
-- Tenant Admin — full tenant-scoped grant set — 2026-10-15
--
-- The seeded Tenant Admin role's role_permissions rows were captured at
-- provisioning time from a hardcoded list, so permissions added to the
-- catalog later (sales.delete, orders.create/edit, payments.refund,
-- inventory.count_approve, register.*, …) never reached existing tenants.
-- Functionally invisible — Tenant Admin bypasses tenant-scoped checks anyway
-- — but the Roles UI showed "92 of 132" and lied about the role's reach.
--
-- Grants every TENANT-scoped permission to each tenant's SYSTEM Tenant Admin
-- role. Platform-scoped prefixes (platform./tenants./subscriptions./plans./
-- support.) are excluded: isSystemPermissionName() reserves those for
-- NULL-tenant roles, so a tenant grant could never satisfy them. Custom roles
-- named "Tenant Admin" are untouched — they're the tenant's own to configure
-- and don't carry the is_system_role bypass.
-- ============================================================================

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
  FROM `roles` r
  CROSS JOIN `permissions` p
 WHERE r.name = 'Tenant Admin'
   AND r.is_system_role = 1
   AND p.name NOT LIKE 'platform.%'
   AND p.name NOT LIKE 'tenants.%'
   AND p.name NOT LIKE 'subscriptions.%'
   AND p.name NOT LIKE 'plans.%'
   AND p.name NOT LIKE 'support.%';
