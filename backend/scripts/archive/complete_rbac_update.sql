-- =====================================================
-- Complete RBAC Permissions Update Script
-- Run this in TablePlus to update existing tenants
-- =====================================================

-- Step 1: Add all missing permissions (31 new permissions)
-- =====================================================

INSERT IGNORE INTO permissions (name, description, module, created_at, updated_at) VALUES
-- Sales Return Module (4 permissions)
('sales-return.view', 'View sales returns', 'sales-return', NOW(), NOW()),
('sales-return.create', 'Create sales returns', 'sales-return', NOW(), NOW()),
('sales-return.process', 'Process sales returns', 'sales-return', NOW(), NOW()),
('sales-return.approve', 'Approve sales returns', 'sales-return', NOW(), NOW()),

-- Purchase Orders Module (5 permissions)
('purchase-orders.view', 'View purchase orders', 'purchase-orders', NOW(), NOW()),
('purchase-orders.create', 'Create purchase orders', 'purchase-orders', NOW(), NOW()),
('purchase-orders.edit', 'Edit purchase orders', 'purchase-orders', NOW(), NOW()),
('purchase-orders.delete', 'Delete purchase orders', 'purchase-orders', NOW(), NOW()),
('purchase-orders.approve', 'Approve purchase orders', 'purchase-orders', NOW(), NOW()),

-- GRN Module (4 permissions)
('grn.view', 'View goods receiving notes', 'grn', NOW(), NOW()),
('grn.create', 'Create goods receiving notes', 'grn', NOW(), NOW()),
('grn.edit', 'Edit goods receiving notes', 'grn', NOW(), NOW()),
('grn.complete', 'Complete goods receiving', 'grn', NOW(), NOW()),

-- Promotions Module (5 permissions)
('promotions.view', 'View promotional offers', 'promotions', NOW(), NOW()),
('promotions.create', 'Create promotional offers', 'promotions', NOW(), NOW()),
('promotions.edit', 'Edit promotional offers', 'promotions', NOW(), NOW()),
('promotions.delete', 'Delete promotional offers', 'promotions', NOW(), NOW()),
('promotions.apply', 'Apply promotional offers', 'promotions', NOW(), NOW()),

-- Settings Granular Module (4 permissions)
('settings.tax', 'Manage tax settings', 'settings', NOW(), NOW()),
('settings.payment', 'Manage payment settings', 'settings', NOW(), NOW()),
('settings.printer', 'Manage printer settings', 'settings', NOW(), NOW()),
('settings.store', 'Manage store settings', 'settings', NOW(), NOW()),

-- System Administration Module (4 permissions)
('system.audit', 'View audit logs', 'system', NOW(), NOW()),
('system.backup', 'Create system backups', 'system', NOW(), NOW()),
('system.settings', 'Manage system settings', 'system', NOW(), NOW()),
('system.maintenance', 'Perform system maintenance', 'system', NOW(), NOW()),

-- Orders Module (Future) (5 permissions)
('orders.view', 'View orders', 'orders', NOW(), NOW()),
('orders.create', 'Create orders', 'orders', NOW(), NOW()),
('orders.edit', 'Edit orders', 'orders', NOW(), NOW()),
('orders.delete', 'Delete orders', 'orders', NOW(), NOW()),
('orders.fulfill', 'Fulfill orders', 'orders', NOW(), NOW());

-- Step 2: Clear existing role permissions for standardization
-- =====================================================

DELETE rp FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
WHERE r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer');

-- Step 3: Assign permissions to Tenant Admin role (81 permissions)
-- =====================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Tenant Admin'
AND p.name IN (
  -- Dashboard & Reports
  'dashboard.view', 'reports.view', 'reports.export',
  -- Products
  'products.view', 'products.create', 'products.edit', 'products.delete', 'products.import', 'products.export',
  -- Categories
  'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
  -- Inventory
  'inventory.view', 'inventory.adjust', 'inventory.transfer', 'inventory.history',
  -- Sales
  'sales.view', 'sales.create', 'sales.void', 'sales.refund', 'sales.discount',
  -- Customers
  'customers.view', 'customers.create', 'customers.edit', 'customers.delete',
  -- Stores
  'stores.view', 'stores.create', 'stores.edit', 'stores.delete',
  -- Users & Roles
  'users.view', 'users.create', 'users.edit', 'users.delete',
  'roles.view', 'roles.create', 'roles.edit', 'roles.delete',
  -- Suppliers
  'suppliers.view', 'suppliers.create', 'suppliers.edit', 'suppliers.delete',
  -- Tax & Payments
  'tax.view', 'tax.create', 'tax.edit',
  'payments.view', 'payments.create', 'payments.edit',
  -- Printer
  'printer.view', 'printer.settings',
  -- Sales Return
  'sales-return.view', 'sales-return.create', 'sales-return.process', 'sales-return.approve',
  -- Purchase Orders
  'purchase-orders.view', 'purchase-orders.create', 'purchase-orders.edit', 'purchase-orders.delete', 'purchase-orders.approve',
  -- GRN
  'grn.view', 'grn.create', 'grn.edit', 'grn.complete',
  -- Promotions
  'promotions.view', 'promotions.create', 'promotions.edit', 'promotions.delete', 'promotions.apply',
  -- Settings Granular
  'settings.view', 'settings.edit', 'settings.tax', 'settings.payment', 'settings.printer', 'settings.store',
  -- System Administration
  'system.audit', 'system.backup', 'system.settings', 'system.maintenance',
  -- Orders (Future)
  'orders.view', 'orders.create', 'orders.edit', 'orders.delete', 'orders.fulfill'
);

-- Step 4: Assign permissions to Store Manager role (58 permissions)
-- =====================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Store Manager'
AND p.name IN (
  -- Dashboard & Reports
  'dashboard.view', 'reports.view', 'reports.export',
  -- Products
  'products.view', 'products.create', 'products.edit', 'products.import', 'products.export',
  -- Categories
  'categories.view', 'categories.create', 'categories.edit',
  -- Inventory
  'inventory.view', 'inventory.adjust', 'inventory.history',
  -- Sales
  'sales.view', 'sales.create', 'sales.void', 'sales.refund', 'sales.discount',
  -- Customers
  'customers.view', 'customers.create', 'customers.edit',
  -- Users
  'users.view', 'users.create', 'users.edit',
  -- Suppliers
  'suppliers.view', 'suppliers.create', 'suppliers.edit',
  -- Tax & Payments
  'tax.view', 'payments.view', 'printer.view', 'printer.settings',
  -- Sales Return
  'sales-return.view', 'sales-return.create', 'sales-return.process', 'sales-return.approve',
  -- Purchase Orders
  'purchase-orders.view', 'purchase-orders.create', 'purchase-orders.edit', 'purchase-orders.delete', 'purchase-orders.approve',
  -- GRN
  'grn.view', 'grn.create', 'grn.edit', 'grn.complete',
  -- Promotions
  'promotions.view', 'promotions.create', 'promotions.edit', 'promotions.delete', 'promotions.apply',
  -- Settings Granular
  'settings.view', 'settings.edit', 'settings.tax', 'settings.payment', 'settings.printer', 'settings.store',
  -- Orders (Future)
  'orders.view', 'orders.create', 'orders.edit', 'orders.delete', 'orders.fulfill'
);

-- Step 5: Assign permissions to Cashier role (18 permissions)
-- =====================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Cashier'
AND p.name IN (
  -- Essential POS operations
  'dashboard.view',
  'products.view', 'categories.view', 'inventory.view',
  'sales.view', 'sales.create', 'sales.discount',
  'customers.view', 'customers.create', 'customers.edit',
  'tax.view', 'payments.view', 'printer.view', 'printer.settings',
  -- Sales Return (limited)
  'sales-return.view', 'sales-return.create',
  -- Promotions (limited)
  'promotions.view', 'promotions.apply'
);

-- Step 6: Assign permissions to Inventory Manager role (28 permissions)
-- =====================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Inventory Manager'
AND p.name IN (
  -- Product and inventory focus
  'dashboard.view', 'reports.view',
  'products.view', 'products.create', 'products.edit', 'products.delete', 'products.import', 'products.export',
  'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
  'inventory.view', 'inventory.adjust', 'inventory.transfer', 'inventory.history',
  'suppliers.view', 'suppliers.create', 'suppliers.edit',
  -- Purchase Orders
  'purchase-orders.view', 'purchase-orders.create', 'purchase-orders.edit', 'purchase-orders.delete', 'purchase-orders.approve',
  -- GRN
  'grn.view', 'grn.create', 'grn.edit', 'grn.complete',
  -- Promotions (view only)
  'promotions.view'
);

-- Step 7: Assign permissions to Reports Viewer role (12 permissions)
-- =====================================================

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Reports Viewer'
AND p.name IN (
  -- Read-only access to reports and analytics
  'dashboard.view', 'reports.view', 'reports.export',
  'products.view', 'categories.view', 'inventory.view',
  'sales.view', 'customers.view'
);

-- Step 8: Verification Query - Check permission counts per role
-- =====================================================

SELECT 
  t.name as tenant_name,
  r.name as role_name,
  COUNT(rp.permission_id) as permission_count,
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
    END THEN '✅ Correct'
    ELSE '❌ Incorrect'
  END as status
FROM tenants t
JOIN roles r ON t.id = r.tenant_id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE t.setup_completed = 1
AND r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer')
GROUP BY t.id, t.name, r.name
ORDER BY t.name, r.name;

-- Step 9: Summary - Total permissions in system
-- =====================================================

SELECT 
  'Total Permissions in System' as description,
  COUNT(*) as count
FROM permissions
UNION ALL
SELECT 
  'Total Role-Permission Assignments' as description,
  COUNT(*) as count
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
WHERE r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer');

-- =====================================================
-- Script Complete
-- Expected Results:
-- - 81 permissions total in system
-- - Tenant Admin: 81 permissions each
-- - Store Manager: 58 permissions each  
-- - Cashier: 18 permissions each
-- - Inventory Manager: 28 permissions each
-- - Reports Viewer: 12 permissions each
-- =====================================================
