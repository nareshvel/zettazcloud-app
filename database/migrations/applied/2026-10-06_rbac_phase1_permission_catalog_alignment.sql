-- RBAC Phase 1: permission catalog alignment
-- Seeds permission rows that routes/controllers reference but the seed catalog
-- (backend/services/permissionSeedingService.js) never defined. Before this
-- migration, grants for these names could only appear via ad-hoc SQL, and
-- several endpoints effectively required Tenant Admin bypass because the
-- permission name did not exist to be granted.
--
-- Idempotent: permissions.name has UNIQUE KEY uk_permissions_name, so
-- INSERT IGNORE no-ops on rows already present (e.g. orders.create and
-- sales.override_tax_mode which exist in production from manual grants).
INSERT IGNORE INTO permissions (name, description, module) VALUES
  ('system.roles.manage',       'Manage platform-level system roles',    'system'),
  ('system.plans.manage',       'Manage subscription plans',             'system'),
  ('system.platform.manage',    'Platform administration',               'system'),
  ('tenants.edit',              'Edit tenant details',                   'tenants'),
  ('tenant.subscription.view',  'View and manage own tenant subscription', 'subscription'),
  ('sales.delete',              'Delete sales',                          'sales'),
  ('sales.override_tax_mode',   'Override store tax mode at checkout',   'sales'),
  ('payments.refund',           'Refund payment transactions',           'payments'),
  ('payments.delete',           'Delete payment methods',                'payments'),
  ('tax.delete',                'Delete tax classes and rates',          'tax'),
  ('grn.delete',                'Delete goods receiving notes',          'grn'),
  ('orders.create',             'Create orders',                         'orders'),
  ('orders.edit',               'Edit orders',                           'orders');
