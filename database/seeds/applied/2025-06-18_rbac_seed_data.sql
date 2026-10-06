-- ========================================================
-- Zettaz Cloud RBAC & Subscription Seed Data
-- ========================================================

-- Start transaction for atomicity
START TRANSACTION;

-- ========================================================
-- 1. SYSTEM PERMISSIONS (Platform Level)
-- ========================================================

INSERT INTO `system_permissions` (`id`, `name`, `description`, `module`) VALUES
-- Platform Management
(uuid(), 'platform.view', 'View platform dashboard and statistics', 'platform'),
(uuid(), 'platform.manage', 'Manage platform settings and configurations', 'platform'),

-- Tenant Management
(uuid(), 'tenants.view', 'View all tenants on the platform', 'tenants'),
(uuid(), 'tenants.create', 'Create new tenants', 'tenants'),
(uuid(), 'tenants.edit', 'Edit tenant information', 'tenants'),
(uuid(), 'tenants.delete', 'Delete tenants', 'tenants'),

-- Subscription Management
(uuid(), 'subscriptions.view', 'View all subscriptions', 'subscriptions'),
(uuid(), 'subscriptions.create', 'Create new subscriptions', 'subscriptions'),
(uuid(), 'subscriptions.edit', 'Edit existing subscriptions', 'subscriptions'),
(uuid(), 'subscriptions.delete', 'Cancel/Delete subscriptions', 'subscriptions'),

-- Plan Management
(uuid(), 'plans.view', 'View subscription plans', 'plans'),
(uuid(), 'plans.create', 'Create new subscription plans', 'plans'),
(uuid(), 'plans.edit', 'Edit subscription plans', 'plans'),
(uuid(), 'plans.delete', 'Delete subscription plans', 'plans'),

-- Support & Customer Management
(uuid(), 'support.view', 'View support tickets', 'support'),
(uuid(), 'support.respond', 'Respond to support tickets', 'support'),
(uuid(), 'support.escalate', 'Escalate support tickets', 'support'),
(uuid(), 'support.close', 'Close support tickets', 'support'),

-- System Administration
(uuid(), 'system.logs.view', 'View system logs', 'system'),
(uuid(), 'system.settings.view', 'View system settings', 'system'),
(uuid(), 'system.settings.edit', 'Edit system settings', 'system'),
(uuid(), 'system.maintenance', 'Perform system maintenance', 'system'),
(uuid(), 'system.roles.manage', 'Manage system roles', 'system');

-- ========================================================
-- 2. SYSTEM ROLES (Platform Level)
-- ========================================================

INSERT INTO `system_roles` (`id`, `name`, `description`) VALUES
(uuid(), 'Super Admin', 'Complete access to all platform features and settings'),
(uuid(), 'Platform Admin', 'Administrative access to platform management features'),
(uuid(), 'Support Admin', 'Access to customer support and help desk features'),
(uuid(), 'Billing Admin', 'Access to subscription and billing management'),
(uuid(), 'Read Only Admin', 'View-only access to platform data and analytics');

-- ========================================================
-- 3. SYSTEM ROLE PERMISSIONS (Mapping)
-- ========================================================

-- Get role IDs for mapping
SET @super_admin_role_id = (SELECT id FROM system_roles WHERE name = 'Super Admin' LIMIT 1);
SET @platform_admin_role_id = (SELECT id FROM system_roles WHERE name = 'Platform Admin' LIMIT 1);
SET @support_admin_role_id = (SELECT id FROM system_roles WHERE name = 'Support Admin' LIMIT 1);
SET @billing_admin_role_id = (SELECT id FROM system_roles WHERE name = 'Billing Admin' LIMIT 1);
SET @readonly_admin_role_id = (SELECT id FROM system_roles WHERE name = 'Read Only Admin' LIMIT 1);

-- Super Admin: All permissions
INSERT INTO system_role_permissions (role_id, permission_id)
SELECT @super_admin_role_id, id FROM system_permissions;

-- Platform Admin: Platform, tenant, and system management
INSERT INTO system_role_permissions (role_id, permission_id)
SELECT @platform_admin_role_id, id FROM system_permissions 
WHERE name LIKE 'platform.%' OR name LIKE 'tenants.%' OR name LIKE 'system.%';

-- Support Admin: Support-related permissions
INSERT INTO system_role_permissions (role_id, permission_id)
SELECT @support_admin_role_id, id FROM system_permissions 
WHERE name LIKE 'support.%' OR name LIKE 'tenants.view' OR name = 'system.logs.view';

-- Billing Admin: Subscription and plan management
INSERT INTO system_role_permissions (role_id, permission_id)
SELECT @billing_admin_role_id, id FROM system_permissions 
WHERE name LIKE 'subscriptions.%' OR name LIKE 'plans.%' OR name LIKE 'tenants.view';

-- Read Only Admin: View-only permissions
INSERT INTO system_role_permissions (role_id, permission_id)
SELECT @readonly_admin_role_id, id FROM system_permissions 
WHERE name LIKE '%.view';

-- ========================================================
-- 4. TENANT PERMISSIONS (Tenant Level)
-- ========================================================

INSERT INTO `permissions` (`id`, `name`, `description`, `module`) VALUES
-- Dashboard & Reports
(uuid(), 'dashboard.view', 'View store dashboard', 'dashboard'),
(uuid(), 'reports.view', 'View reports', 'reports'),
(uuid(), 'reports.export', 'Export reports', 'reports'),

-- Products
(uuid(), 'products.view', 'View products', 'products'),
(uuid(), 'products.create', 'Create products', 'products'),
(uuid(), 'products.edit', 'Edit products', 'products'),
(uuid(), 'products.delete', 'Delete products', 'products'),
(uuid(), 'products.import', 'Import products', 'products'),
(uuid(), 'products.export', 'Export products', 'products'),

-- Categories
(uuid(), 'categories.view', 'View categories', 'categories'),
(uuid(), 'categories.create', 'Create categories', 'categories'),
(uuid(), 'categories.edit', 'Edit categories', 'categories'),
(uuid(), 'categories.delete', 'Delete categories', 'categories'),

-- Inventory
(uuid(), 'inventory.view', 'View inventory', 'inventory'),
(uuid(), 'inventory.adjust', 'Adjust inventory', 'inventory'),
(uuid(), 'inventory.transfer', 'Transfer inventory between stores', 'inventory'),
(uuid(), 'inventory.history', 'View inventory history', 'inventory'),

-- Sales & Orders
(uuid(), 'sales.view', 'View sales', 'sales'),
(uuid(), 'sales.create', 'Create sales', 'sales'),
(uuid(), 'sales.void', 'Void sales', 'sales'),
(uuid(), 'sales.refund', 'Process refunds', 'sales'),
(uuid(), 'sales.discount', 'Apply discounts', 'sales'),

-- Customers
(uuid(), 'customers.view', 'View customers', 'customers'),
(uuid(), 'customers.create', 'Create customers', 'customers'),
(uuid(), 'customers.edit', 'Edit customers', 'customers'),
(uuid(), 'customers.delete', 'Delete customers', 'customers'),

-- Store Management
(uuid(), 'stores.view', 'View stores', 'stores'),
(uuid(), 'stores.create', 'Create stores', 'stores'),
(uuid(), 'stores.edit', 'Edit stores', 'stores'),
(uuid(), 'stores.delete', 'Delete stores', 'stores'),

-- User Management
(uuid(), 'users.view', 'View users', 'users'),
(uuid(), 'users.create', 'Create users', 'users'),
(uuid(), 'users.edit', 'Edit users', 'users'),
(uuid(), 'users.delete', 'Delete users', 'users'),

-- Role Management
(uuid(), 'roles.view', 'View roles', 'roles'),
(uuid(), 'roles.create', 'Create roles', 'roles'),
(uuid(), 'roles.edit', 'Edit roles', 'roles'),
(uuid(), 'roles.delete', 'Delete roles', 'roles'),

-- Settings
(uuid(), 'settings.view', 'View tenant settings', 'settings'),
(uuid(), 'settings.edit', 'Edit tenant settings', 'settings'),

-- Subscription Management (Tenant Admin only)
(uuid(), 'tenant.subscription.view', 'View subscription details', 'subscription'),
(uuid(), 'tenant.subscription.upgrade', 'Upgrade subscription', 'subscription');

-- ========================================================
-- 5. DEFAULT TENANT ROLES
-- ========================================================

-- Prepare to retrieve the ID of the first tenant
SET @first_tenant_id = (SELECT id FROM tenants ORDER BY id LIMIT 1);

-- Create default roles for the first tenant
INSERT INTO `roles` (`id`, `tenant_id`, `name`, `description`, `is_system_role`, `created_by`) VALUES
-- Set @first_user_id to the ID of the first user to use as created_by
(uuid(), @first_tenant_id, 'Tenant Admin', 'Full tenant administrative access', 1, (SELECT id FROM users ORDER BY id LIMIT 1)),
(uuid(), @first_tenant_id, 'Store Manager', 'Full management of assigned stores', 1, (SELECT id FROM users ORDER BY id LIMIT 1)),
(uuid(), @first_tenant_id, 'Cashier', 'Basic sales and customer management', 1, (SELECT id FROM users ORDER BY id LIMIT 1)),
(uuid(), @first_tenant_id, 'Inventory Manager', 'Product and inventory management', 0, (SELECT id FROM users ORDER BY id LIMIT 1)),
(uuid(), @first_tenant_id, 'Reports Viewer', 'View-only access to reports and analytics', 0, (SELECT id FROM users ORDER BY id LIMIT 1));

-- ========================================================
-- 6. ROLE PERMISSIONS (Mapping for Default Roles)
-- ========================================================

-- Get role IDs for mapping
SET @tenant_admin_role_id = (SELECT id FROM roles WHERE name = 'Tenant Admin' AND tenant_id = @first_tenant_id LIMIT 1);
SET @store_manager_role_id = (SELECT id FROM roles WHERE name = 'Store Manager' AND tenant_id = @first_tenant_id LIMIT 1);
SET @cashier_role_id = (SELECT id FROM roles WHERE name = 'Cashier' AND tenant_id = @first_tenant_id LIMIT 1);
SET @inventory_manager_role_id = (SELECT id FROM roles WHERE name = 'Inventory Manager' AND tenant_id = @first_tenant_id LIMIT 1);
SET @reports_viewer_role_id = (SELECT id FROM roles WHERE name = 'Reports Viewer' AND tenant_id = @first_tenant_id LIMIT 1);

-- Tenant Admin: All tenant-level permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT @tenant_admin_role_id, id FROM permissions;

-- Store Manager: All except tenant administration
INSERT INTO role_permissions (role_id, permission_id)
SELECT @store_manager_role_id, id FROM permissions 
WHERE name NOT LIKE 'tenant.%' AND name NOT LIKE 'stores.create' AND name NOT LIKE 'stores.delete';

-- Cashier: Basic operations
-- NOTE: 'dashboard.view' intentionally omitted — it was removed from
-- Cashier/Sales Associate roles by migration
-- 2026-09-03_remove_dashboard_view_from_cashier_roles.sql so that the
-- permission meaningfully gates dashboard navigation.
INSERT INTO role_permissions (role_id, permission_id)
SELECT @cashier_role_id, id FROM permissions 
WHERE name IN (
  'products.view', 
  'categories.view',
  'inventory.view',
  'sales.view', 'sales.create',
  'customers.view', 'customers.create', 'customers.edit'
);

-- Inventory Manager: Product and inventory related
INSERT INTO role_permissions (role_id, permission_id)
SELECT @inventory_manager_role_id, id FROM permissions 
WHERE name LIKE 'products.%' OR name LIKE 'categories.%' OR name LIKE 'inventory.%';

-- Reports Viewer: Read-only access to reporting features
INSERT INTO role_permissions (role_id, permission_id)
SELECT @reports_viewer_role_id, id FROM permissions 
WHERE name LIKE '%.view';

-- ========================================================
-- 7. USER ROLE MIGRATION (Move existing users to new system)
-- ========================================================

-- Map existing users based on their current role column to new roles
-- Admin -> Tenant Admin
INSERT INTO user_roles (id, user_id, role_id, scope, assigned_by)
SELECT 
  uuid(),
  u.id, 
  @tenant_admin_role_id, 
  'tenant',
  (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
FROM 
  users u
WHERE 
  u.role = 'admin';

-- Manager -> Store Manager
INSERT INTO user_roles (id, user_id, role_id, store_id, scope, assigned_by)
SELECT 
  uuid(),
  u.id, 
  @store_manager_role_id, 
  u.store_id,
  'store',
  (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
FROM 
  users u
WHERE 
  u.role = 'manager' AND u.store_id IS NOT NULL;

-- Cashier -> Cashier
INSERT INTO user_roles (id, user_id, role_id, store_id, scope, assigned_by)
SELECT 
  uuid(),
  u.id, 
  @cashier_role_id, 
  u.store_id,
  'store',
  (SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1)
FROM 
  users u
WHERE 
  u.role = 'cashier' AND u.store_id IS NOT NULL;

-- ========================================================
-- 8. SUBSCRIPTION PLANS
-- ========================================================

INSERT INTO `plans` (`id`, `name`, `description`, `price_monthly`, `price_yearly`, `currency`, `features`, `limits`, `is_active`) VALUES
-- Growth Plan (renamed from "Basic" 2026-09-04 — see database/migrations/2026-09-04_rename_growth_plan.sql)
(uuid(), 'Growth', 'Essential features for small businesses', 29.99, 299.90, 'USD',
JSON_OBJECT(
  'pointOfSale', true,
  'inventory', true,
  'basicReports', true,
  'customerManagement', true,
  'multiUser', true,
  'support', 'email'
), 
JSON_OBJECT(
  'stores', 1,
  'products', 500,
  'users', 3,
  'storage', '1GB'
),
1),

-- Standard Plan
(uuid(), 'Professional', 'Advanced features for growing businesses', 59.99, 599.90, 'USD', 
JSON_OBJECT(
  'pointOfSale', true,
  'inventory', true,
  'advancedReports', true,
  'customerManagement', true,
  'loyaltyProgram', true,
  'multiUser', true,
  'multiStore', true,
  'support', '24/7'
), 
JSON_OBJECT(
  'stores', 3,
  'products', 2000,
  'users', 10,
  'storage', '5GB'
),
1),

-- Premium Plan
(uuid(), 'Enterprise', 'Full-featured solution for larger businesses', 99.99, 999.90, 'USD', 
JSON_OBJECT(
  'pointOfSale', true,
  'inventory', true,
  'advancedReports', true,
  'customerManagement', true,
  'loyaltyProgram', true,
  'multiUser', true,
  'multiStore', true,
  'apiAccess', true,
  'customBranding', true,
  'support', 'premium'
), 
JSON_OBJECT(
  'stores', 10,
  'products', 10000,
  'users', 30,
  'storage', '20GB'
),
1);

-- ========================================================
-- 9. ASSIGN FIRST TENANT A SUBSCRIPTION
-- ========================================================

-- Get first plan ID
SET @growth_plan_id = (SELECT id FROM plans WHERE name = 'Growth' LIMIT 1);

-- Create subscription for first tenant
INSERT INTO `subscriptions` (
  `id`, `tenant_id`, `plan_id`, `status`,
  `start_date`, `end_date`, `trial_end_date`, `auto_renew`
) VALUES (
  uuid(),
  @first_tenant_id,
  @growth_plan_id,
  'active',
  CURDATE(),
  DATE_ADD(CURDATE(), INTERVAL 1 YEAR),
  DATE_ADD(CURDATE(), INTERVAL -1 DAY),
  1
);

-- ========================================================
-- FINALIZE TRANSACTION
-- ========================================================

COMMIT;

-- ========================================================
-- VERIFICATION QUERIES (Uncomment to check data)
-- ========================================================

-- SELECT * FROM system_permissions;
-- SELECT * FROM system_roles;
-- SELECT * FROM system_role_permissions;
-- SELECT * FROM permissions;
-- SELECT * FROM roles;
-- SELECT * FROM role_permissions;
-- SELECT * FROM user_roles;
-- SELECT * FROM plans;
-- SELECT * FROM subscriptions;
