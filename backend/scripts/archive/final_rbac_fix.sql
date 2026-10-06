-- =====================================================
-- Final RBAC Fix - Get to exactly 81 permissions and correct role counts
-- =====================================================

-- Step 1: Identify the remaining 2 extra permissions
-- =====================================================
CREATE TEMPORARY TABLE final_expected_permissions (name VARCHAR(255));

INSERT INTO final_expected_permissions (name) VALUES
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

-- Find the remaining 2 extra permissions
SELECT 'REMAINING_EXTRA_PERMISSIONS' as check_type, p.name, p.module
FROM permissions p
LEFT JOIN final_expected_permissions ep ON p.name = ep.name
WHERE ep.name IS NULL
ORDER BY p.name;

-- Step 2: Remove the remaining extra permissions
-- =====================================================
DELETE p FROM permissions p
LEFT JOIN final_expected_permissions ep ON p.name = ep.name
WHERE ep.name IS NULL;

-- Step 3: Verify we now have exactly 81 permissions
-- =====================================================
SELECT 'PERMISSIONS_AFTER_FINAL_CLEANUP' as check_type, COUNT(*) as total_count,
       CASE WHEN COUNT(*) = 81 THEN '✅ CORRECT' ELSE '❌ INCORRECT' END as status
FROM permissions;

-- Step 4: Clear all role permissions and reassign with precise counts
-- =====================================================
DELETE rp FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
WHERE r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer');

-- Step 5: Assign permissions with exact counts
-- =====================================================

-- Tenant Admin: ALL 81 permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Tenant Admin';

-- Store Manager: 58 permissions (exclude 23 specific permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Store Manager'
AND p.name NOT IN (
  -- Exclude system administration (4)
  'system.audit', 'system.backup', 'system.settings', 'system.maintenance',
  -- Exclude store creation/deletion (2)
  'stores.create', 'stores.delete',
  -- Exclude user deletion (1)
  'users.delete',
  -- Exclude all role management (4)
  'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
  -- Exclude product deletion (1)
  'products.delete',
  -- Exclude category deletion (1)
  'categories.delete',
  -- Exclude inventory transfer (1)
  'inventory.transfer',
  -- Exclude sales void/refund (2)
  'sales.void', 'sales.refund',
  -- Exclude customer deletion (1)
  'customers.delete',
  -- Exclude supplier deletion (1)
  'suppliers.delete',
  -- Exclude tax/payment creation/editing (4)
  'tax.create', 'tax.edit', 'payments.create', 'payments.edit',
  -- Exclude sales return approval (1)
  'sales-return.approve'
);

-- Cashier: 18 permissions (essential POS only)
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

-- Inventory Manager: 28 permissions (product/inventory focus)
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

-- Reports Viewer: 12 permissions (read-only)
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

-- Step 6: Final verification
-- =====================================================
SELECT 
  'FINAL_VERIFICATION' as check_type,
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

-- Step 7: Show total permissions in system
-- =====================================================
SELECT 'TOTAL_PERMISSIONS_FINAL' as check_type, COUNT(*) as total_count,
       CASE WHEN COUNT(*) = 81 THEN '✅ CORRECT' ELSE '❌ INCORRECT' END as status
FROM permissions;

-- Cleanup
DROP TEMPORARY TABLE final_expected_permissions;

-- =====================================================
-- This script should result in:
-- - Exactly 81 permissions total
-- - Tenant Admin: 81 permissions
-- - Store Manager: 58 permissions
-- - Cashier: 18 permissions  
-- - Inventory Manager: 28 permissions
-- - Reports Viewer: 12 permissions
-- =====================================================
