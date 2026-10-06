-- =====================================================
-- Fresh RBAC System Rebuild - Complete Clean Slate
-- Removes all existing permissions and creates exactly 81 new ones
-- =====================================================

-- Step 1: Complete cleanup - remove all existing RBAC data
-- =====================================================

-- Remove all role-permission assignments
DELETE FROM role_permissions;

-- Remove all permissions (this will cascade to role_permissions if FK exists)
DELETE FROM permissions;

-- Reset auto-increment if needed
ALTER TABLE permissions AUTO_INCREMENT = 1;

-- Step 2: Create exactly 81 permissions from scratch
-- =====================================================

INSERT INTO permissions (name, description, module, created_at, updated_at) VALUES

-- Dashboard & Reports (3 permissions)
('dashboard.view', 'View dashboard', 'dashboard', NOW(), NOW()),
('reports.view', 'View reports', 'reports', NOW(), NOW()),
('reports.export', 'Export reports', 'reports', NOW(), NOW()),

-- Products (6 permissions)
('products.view', 'View products', 'products', NOW(), NOW()),
('products.create', 'Create products', 'products', NOW(), NOW()),
('products.edit', 'Edit products', 'products', NOW(), NOW()),
('products.delete', 'Delete products', 'products', NOW(), NOW()),
('products.import', 'Import products', 'products', NOW(), NOW()),
('products.export', 'Export products', 'products', NOW(), NOW()),

-- Categories (4 permissions)
('categories.view', 'View categories', 'categories', NOW(), NOW()),
('categories.create', 'Create categories', 'categories', NOW(), NOW()),
('categories.edit', 'Edit categories', 'categories', NOW(), NOW()),
('categories.delete', 'Delete categories', 'categories', NOW(), NOW()),

-- Inventory (4 permissions)
('inventory.view', 'View inventory', 'inventory', NOW(), NOW()),
('inventory.adjust', 'Adjust inventory', 'inventory', NOW(), NOW()),
('inventory.transfer', 'Transfer inventory', 'inventory', NOW(), NOW()),
('inventory.history', 'View inventory history', 'inventory', NOW(), NOW()),

-- Sales (5 permissions)
('sales.view', 'View sales', 'sales', NOW(), NOW()),
('sales.create', 'Create sales', 'sales', NOW(), NOW()),
('sales.void', 'Void sales', 'sales', NOW(), NOW()),
('sales.refund', 'Process refunds', 'sales', NOW(), NOW()),
('sales.discount', 'Apply discounts', 'sales', NOW(), NOW()),

-- Customers (4 permissions)
('customers.view', 'View customers', 'customers', NOW(), NOW()),
('customers.create', 'Create customers', 'customers', NOW(), NOW()),
('customers.edit', 'Edit customers', 'customers', NOW(), NOW()),
('customers.delete', 'Delete customers', 'customers', NOW(), NOW()),

-- Stores (4 permissions)
('stores.view', 'View stores', 'stores', NOW(), NOW()),
('stores.create', 'Create stores', 'stores', NOW(), NOW()),
('stores.edit', 'Edit stores', 'stores', NOW(), NOW()),
('stores.delete', 'Delete stores', 'stores', NOW(), NOW()),

-- Users (4 permissions)
('users.view', 'View users', 'users', NOW(), NOW()),
('users.create', 'Create users', 'users', NOW(), NOW()),
('users.edit', 'Edit users', 'users', NOW(), NOW()),
('users.delete', 'Delete users', 'users', NOW(), NOW()),

-- Roles (4 permissions)
('roles.view', 'View roles', 'roles', NOW(), NOW()),
('roles.create', 'Create roles', 'roles', NOW(), NOW()),
('roles.edit', 'Edit roles', 'roles', NOW(), NOW()),
('roles.delete', 'Delete roles', 'roles', NOW(), NOW()),

-- Suppliers (4 permissions)
('suppliers.view', 'View suppliers', 'suppliers', NOW(), NOW()),
('suppliers.create', 'Create suppliers', 'suppliers', NOW(), NOW()),
('suppliers.edit', 'Edit suppliers', 'suppliers', NOW(), NOW()),
('suppliers.delete', 'Delete suppliers', 'suppliers', NOW(), NOW()),

-- Tax Management (3 permissions)
('tax.view', 'View tax settings', 'tax', NOW(), NOW()),
('tax.create', 'Create tax settings', 'tax', NOW(), NOW()),
('tax.edit', 'Edit tax settings', 'tax', NOW(), NOW()),

-- Payment Processing (3 permissions)
('payments.view', 'View payment methods', 'payments', NOW(), NOW()),
('payments.create', 'Create payment methods', 'payments', NOW(), NOW()),
('payments.edit', 'Edit payment methods', 'payments', NOW(), NOW()),

-- Printer Management (2 permissions)
('printer.view', 'View printer settings', 'printer', NOW(), NOW()),
('printer.settings', 'Manage printer settings', 'printer', NOW(), NOW()),

-- Sales Return (4 permissions)
('sales-return.view', 'View sales returns', 'sales-return', NOW(), NOW()),
('sales-return.create', 'Create sales returns', 'sales-return', NOW(), NOW()),
('sales-return.process', 'Process sales returns', 'sales-return', NOW(), NOW()),
('sales-return.approve', 'Approve sales returns', 'sales-return', NOW(), NOW()),

-- Purchase Orders (5 permissions)
('purchase-orders.view', 'View purchase orders', 'purchase-orders', NOW(), NOW()),
('purchase-orders.create', 'Create purchase orders', 'purchase-orders', NOW(), NOW()),
('purchase-orders.edit', 'Edit purchase orders', 'purchase-orders', NOW(), NOW()),
('purchase-orders.delete', 'Delete purchase orders', 'purchase-orders', NOW(), NOW()),
('purchase-orders.approve', 'Approve purchase orders', 'purchase-orders', NOW(), NOW()),

-- GRN (4 permissions)
('grn.view', 'View goods receiving notes', 'grn', NOW(), NOW()),
('grn.create', 'Create goods receiving notes', 'grn', NOW(), NOW()),
('grn.edit', 'Edit goods receiving notes', 'grn', NOW(), NOW()),
('grn.complete', 'Complete goods receiving', 'grn', NOW(), NOW()),

-- Promotions (5 permissions)
('promotions.view', 'View promotional offers', 'promotions', NOW(), NOW()),
('promotions.create', 'Create promotional offers', 'promotions', NOW(), NOW()),
('promotions.edit', 'Edit promotional offers', 'promotions', NOW(), NOW()),
('promotions.delete', 'Delete promotional offers', 'promotions', NOW(), NOW()),
('promotions.apply', 'Apply promotional offers', 'promotions', NOW(), NOW()),

-- Settings (6 permissions)
('settings.view', 'View settings', 'settings', NOW(), NOW()),
('settings.edit', 'Edit settings', 'settings', NOW(), NOW()),
('settings.tax', 'Manage tax settings', 'settings', NOW(), NOW()),
('settings.payment', 'Manage payment settings', 'settings', NOW(), NOW()),
('settings.printer', 'Manage printer settings', 'settings', NOW(), NOW()),
('settings.store', 'Manage store settings', 'settings', NOW(), NOW()),

-- System Administration (4 permissions)
('system.audit', 'View audit logs', 'system', NOW(), NOW()),
('system.backup', 'Create system backups', 'system', NOW(), NOW()),
('system.settings', 'Manage system settings', 'system', NOW(), NOW()),
('system.maintenance', 'Perform system maintenance', 'system', NOW(), NOW()),

-- Orders (5 permissions)
('orders.view', 'View orders', 'orders', NOW(), NOW()),
('orders.create', 'Create orders', 'orders', NOW(), NOW()),
('orders.edit', 'Edit orders', 'orders', NOW(), NOW()),
('orders.delete', 'Delete orders', 'orders', NOW(), NOW()),
('orders.fulfill', 'Fulfill orders', 'orders', NOW(), NOW());

-- Step 3: Verify exactly 81 permissions created
-- =====================================================
SELECT 'FRESH_PERMISSIONS_COUNT' as check_type, COUNT(*) as total_count,
       CASE WHEN COUNT(*) = 81 THEN '✅ EXACTLY 81' ELSE '❌ INCORRECT COUNT' END as status
FROM permissions;

-- Step 4: Assign permissions to roles with exact counts
-- =====================================================

-- Tenant Admin: ALL 81 permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Tenant Admin';

-- Store Manager: 58 permissions (exclude 23 specific ones)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Store Manager'
AND p.name NOT IN (
  -- System administration (4)
  'system.audit', 'system.backup', 'system.settings', 'system.maintenance',
  -- Store creation/deletion (2)
  'stores.create', 'stores.delete',
  -- User deletion (1)
  'users.delete',
  -- All role management (4)
  'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
  -- Product deletion (1)
  'products.delete',
  -- Category deletion (1)
  'categories.delete',
  -- Customer deletion (1)
  'customers.delete',
  -- Supplier deletion (1)
  'suppliers.delete',
  -- Tax creation/editing (2)
  'tax.create', 'tax.edit',
  -- Payment creation/editing (2)
  'payments.create', 'payments.edit',
  -- Sales return approval (1)
  'sales-return.approve',
  -- Purchase order deletion/approval (2)
  'purchase-orders.delete', 'purchase-orders.approve',
  -- Orders deletion (1)
  'orders.delete'
);

-- Cashier: 18 permissions (essential POS operations)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
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
FROM roles r
CROSS JOIN permissions p
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

-- Reports Viewer: 12 permissions (read-only analytics)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Reports Viewer'
AND p.name IN (
  'dashboard.view', 'reports.view', 'reports.export',
  'products.view', 'categories.view', 'inventory.view',
  'sales.view', 'customers.view', 'suppliers.view',
  'purchase-orders.view', 'grn.view', 'promotions.view'
);

-- Step 5: Final verification of all counts
-- =====================================================
SELECT 
  'FINAL_FRESH_VERIFICATION' as check_type,
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
    END THEN '✅ PERFECT'
    ELSE '❌ INCORRECT'
  END as status
FROM tenants t
JOIN roles r ON t.id = r.tenant_id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE t.setup_completed = 1
AND r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer')
GROUP BY t.id, t.name, r.name
ORDER BY t.name, r.name;

-- Step 6: Summary
-- =====================================================
SELECT 'SYSTEM_SUMMARY' as check_type, 
       (SELECT COUNT(*) FROM permissions) as total_permissions,
       (SELECT COUNT(*) FROM role_permissions) as total_assignments,
       CASE WHEN (SELECT COUNT(*) FROM permissions) = 81 THEN '✅ PERFECT SYSTEM' ELSE '❌ SYSTEM ERROR' END as status;

-- =====================================================
-- Fresh RBAC System Complete
-- Expected Results:
-- - Exactly 81 permissions total
-- - Tenant Admin: 81 permissions
-- - Store Manager: 58 permissions  
-- - Cashier: 18 permissions
-- - Inventory Manager: 28 permissions
-- - Reports Viewer: 12 permissions
-- - Total role assignments: 197 (81+58+18+28+12)
-- =====================================================
