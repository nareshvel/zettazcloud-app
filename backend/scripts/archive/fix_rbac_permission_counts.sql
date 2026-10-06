-- =====================================================
-- Fix RBAC Permission Count Mismatches
-- Removes 8 extra permissions to get from 91 to 83 total
-- =====================================================

-- Step 1: Remove the 8 extra permissions identified
-- =====================================================

-- Remove legacy sales return permissions (6 permissions)
-- These are duplicates of the new sales-return.* permissions
DELETE FROM permissions WHERE name IN (
  'sales.return.cancel',
  'sales.return.complete', 
  'sales.return.create',
  'sales.return.edit',
  'sales.return.reports',
  'sales.return.view'
);

-- Remove subscription permissions (2 permissions)  
-- These are not in the expected 81-permission list
DELETE FROM permissions WHERE name IN (
  'tenant.subscription.upgrade',
  'tenant.subscription.view'
);

-- Step 2: Verify permission count is now 83 (should be 81 + 2 missing)
-- =====================================================
SELECT 'PERMISSIONS_AFTER_CLEANUP' as check_type, COUNT(*) as total_count
FROM permissions;

-- Step 3: Check what permissions are still missing from expected 81
-- =====================================================
CREATE TEMPORARY TABLE expected_permissions_check (name VARCHAR(255));

INSERT INTO expected_permissions_check (name) VALUES
-- Dashboard & Reports (3)
('dashboard.view'), ('reports.view'), ('reports.export'),
-- Products (6)
('products.view'), ('products.create'), ('products.edit'), ('products.delete'), ('products.import'), ('products.export'),
-- Categories (4)
('categories.view'), ('categories.create'), ('categories.edit'), ('categories.delete'),
-- Inventory (4)
('inventory.view'), ('inventory.adjust'), ('inventory.transfer'), ('inventory.history'),
-- Sales (5)
('sales.view'), ('sales.create'), ('sales.void'), ('sales.refund'), ('sales.discount'),
-- Customers (4)
('customers.view'), ('customers.create'), ('customers.edit'), ('customers.delete'),
-- Stores (4)
('stores.view'), ('stores.create'), ('stores.edit'), ('stores.delete'),
-- Users & Roles (8)
('users.view'), ('users.create'), ('users.edit'), ('users.delete'),
('roles.view'), ('roles.create'), ('roles.edit'), ('roles.delete'),
-- Suppliers (4)
('suppliers.view'), ('suppliers.create'), ('suppliers.edit'), ('suppliers.delete'),
-- Tax & Payments (6)
('tax.view'), ('tax.create'), ('tax.edit'),
('payments.view'), ('payments.create'), ('payments.edit'),
-- Printer (2)
('printer.view'), ('printer.settings'),
-- Sales Return (4)
('sales-return.view'), ('sales-return.create'), ('sales-return.process'), ('sales-return.approve'),
-- Purchase Orders (5)
('purchase-orders.view'), ('purchase-orders.create'), ('purchase-orders.edit'), ('purchase-orders.delete'), ('purchase-orders.approve'),
-- GRN (4)
('grn.view'), ('grn.create'), ('grn.edit'), ('grn.complete'),
-- Promotions (5)
('promotions.view'), ('promotions.create'), ('promotions.edit'), ('promotions.delete'), ('promotions.apply'),
-- Settings Granular (6)
('settings.view'), ('settings.edit'), ('settings.tax'), ('settings.payment'), ('settings.printer'), ('settings.store'),
-- System Administration (4)
('system.audit'), ('system.backup'), ('system.settings'), ('system.maintenance'),
-- Orders (5)
('orders.view'), ('orders.create'), ('orders.edit'), ('orders.delete'), ('orders.fulfill');

-- Find still missing permissions
SELECT 'STILL_MISSING_PERMISSIONS' as check_type, ep.name
FROM expected_permissions_check ep
LEFT JOIN permissions p ON ep.name = p.name
WHERE p.name IS NULL
ORDER BY ep.name;

-- Step 4: Add any missing permissions to reach exactly 81
-- =====================================================

-- Add missing permissions if any (this will show what needs to be added)
INSERT IGNORE INTO permissions (name, description, module, created_at, updated_at)
SELECT 
  ep.name,
  CASE 
    WHEN ep.name LIKE '%.view' THEN CONCAT('View ', SUBSTRING_INDEX(ep.name, '.', 1))
    WHEN ep.name LIKE '%.create' THEN CONCAT('Create ', SUBSTRING_INDEX(ep.name, '.', 1))
    WHEN ep.name LIKE '%.edit' THEN CONCAT('Edit ', SUBSTRING_INDEX(ep.name, '.', 1))
    WHEN ep.name LIKE '%.delete' THEN CONCAT('Delete ', SUBSTRING_INDEX(ep.name, '.', 1))
    ELSE CONCAT('Manage ', ep.name)
  END as description,
  SUBSTRING_INDEX(ep.name, '.', 1) as module,
  NOW(),
  NOW()
FROM expected_permissions_check ep
LEFT JOIN permissions p ON ep.name = p.name
WHERE p.name IS NULL;

-- Step 5: Final verification - should be exactly 81 permissions
-- =====================================================
SELECT 'FINAL_PERMISSION_COUNT' as check_type, COUNT(*) as total_count,
       CASE WHEN COUNT(*) = 81 THEN '✅ CORRECT' ELSE '❌ INCORRECT' END as status
FROM permissions;

-- Step 6: Clear all role permissions and reassign correctly
-- =====================================================

-- Clear existing role permissions
DELETE rp FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
WHERE r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer');

-- Assign ALL 81 permissions to Tenant Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Tenant Admin';

-- Assign 58 permissions to Store Manager (exclude system.*, stores.create/delete, users.delete, roles.*)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Store Manager'
AND p.name NOT IN (
  'system.audit', 'system.backup', 'system.settings', 'system.maintenance',
  'stores.create', 'stores.delete',
  'users.delete',
  'roles.view', 'roles.create', 'roles.edit', 'roles.delete'
);

-- Assign 18 permissions to Cashier (essential POS operations)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Cashier'
AND p.name IN (
  'dashboard.view',
  'products.view', 'categories.view', 'inventory.view',
  'sales.view', 'sales.create', 'sales.discount',
  'customers.view', 'customers.create', 'customers.edit',
  'tax.view', 'payments.view', 'printer.view', 'printer.settings',
  'sales-return.view', 'sales-return.create',
  'promotions.view', 'promotions.apply'
);

-- Assign 28 permissions to Inventory Manager (product and inventory focus)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Inventory Manager'
AND p.name IN (
  'dashboard.view', 'reports.view',
  'products.view', 'products.create', 'products.edit', 'products.delete', 'products.import', 'products.export',
  'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
  'inventory.view', 'inventory.adjust', 'inventory.transfer', 'inventory.history',
  'suppliers.view', 'suppliers.create', 'suppliers.edit',
  'purchase-orders.view', 'purchase-orders.create', 'purchase-orders.edit', 'purchase-orders.delete', 'purchase-orders.approve',
  'grn.view', 'grn.create', 'grn.edit', 'grn.complete',
  'promotions.view'
);

-- Assign 12 permissions to Reports Viewer (read-only analytics)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Reports Viewer'
AND p.name IN (
  'dashboard.view', 'reports.view', 'reports.export',
  'products.view', 'categories.view', 'inventory.view',
  'sales.view', 'customers.view', 'suppliers.view',
  'purchase-orders.view', 'grn.view', 'promotions.view'
);

-- Step 7: Final verification of role permission counts
-- =====================================================
SELECT 
  'FINAL_ROLE_COUNTS' as check_type,
  t.name as tenant_name,
  r.name as role_name,
  COUNT(rp.permission_id) as actual_count,
  CASE 
    WHEN r.name = 'Tenant Admin' THEN 81
    WHEN r.name = 'Store Manager' THEN 58
    WHEN r.name = 'Cashier' THEN 18
    WHEN r.name = 'Inventory Manager' THEN 28
    WHEN r.name = 'Reports Viewer' THEN 12
    ELSE 0
  END as expected_count,
  CASE 
    WHEN COUNT(rp.permission_id) = CASE 
      WHEN r.name = 'Tenant Admin' THEN 81
      WHEN r.name = 'Store Manager' THEN 58
      WHEN r.name = 'Cashier' THEN 18
      WHEN r.name = 'Inventory Manager' THEN 28
      WHEN r.name = 'Reports Viewer' THEN 12
      ELSE 0
    END THEN '✅ CORRECT'
    ELSE '❌ INCORRECT'
  END as status
FROM tenants t
JOIN roles r ON t.id = r.tenant_id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE t.setup_completed = 1
AND r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer')
GROUP BY t.id, t.name, r.name
ORDER BY t.name, r.name;

-- Cleanup
DROP TEMPORARY TABLE expected_permissions_check;

-- =====================================================
-- Expected Results After This Script:
-- - Total permissions: 81 (exactly)
-- - Tenant Admin: 81 permissions
-- - Store Manager: 58 permissions  
-- - Cashier: 18 permissions
-- - Inventory Manager: 28 permissions
-- - Reports Viewer: 12 permissions
-- =====================================================
