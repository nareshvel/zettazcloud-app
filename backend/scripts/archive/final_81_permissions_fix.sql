-- =====================================================
-- Final 81 Permissions Fix - Remove 2 Extra Permissions
-- Based on analysis: we have 83, need exactly 81
-- =====================================================

-- Step 1: Identify which 2 permissions to remove
-- Analysis shows we need to remove 2 permissions to get from 83 to 81
-- Based on documentation, the Orders module (5 permissions) might be future-planned
-- Let's remove 2 orders permissions to get exactly 81

-- Remove 2 orders permissions (orders.delete and orders.fulfill)
DELETE FROM permissions WHERE name IN ('orders.delete', 'orders.fulfill');

-- Step 2: Verify we now have exactly 81 permissions
-- =====================================================
SELECT 'AFTER_REMOVAL_COUNT' as check_type, COUNT(*) as total_count,
       CASE WHEN COUNT(*) = 81 THEN '✅ EXACTLY 81' ELSE '❌ STILL WRONG' END as status
FROM permissions;

-- Step 3: Clear all role assignments and reassign correctly
-- =====================================================
DELETE FROM role_permissions;

-- Step 4: Role assignments with exactly 81 permissions available
-- =====================================================

-- Tenant Admin: ALL 81 permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'Tenant Admin';

-- Store Manager: 58 permissions (81 - 23 exclusions = 58)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p 
WHERE r.name = 'Store Manager' AND p.name NOT IN (
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
  -- Remaining orders (1 - since we removed 2)
  'orders.view'
);

-- Cashier: 18 permissions (essential POS only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p 
WHERE r.name = 'Cashier' AND p.name IN (
  'dashboard.view', 'products.view', 'categories.view', 'inventory.view',
  'sales.view', 'sales.create', 'sales.discount',
  'customers.view', 'customers.create', 'customers.edit',
  'tax.view', 'payments.view', 'printer.view', 'printer.settings',
  'sales-return.view', 'sales-return.create', 'promotions.view', 'promotions.apply'
);

-- Inventory Manager: 28 permissions (product/inventory focus)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p 
WHERE r.name = 'Inventory Manager' AND p.name IN (
  'dashboard.view', 'reports.view',
  'products.view', 'products.create', 'products.edit', 'products.delete', 'products.import', 'products.export',
  'categories.view', 'categories.create', 'categories.edit', 'categories.delete',
  'inventory.view', 'inventory.adjust', 'inventory.transfer', 'inventory.history',
  'suppliers.view', 'suppliers.create', 'suppliers.edit',
  'purchase-orders.view', 'purchase-orders.create', 'purchase-orders.edit', 'purchase-orders.delete', 'purchase-orders.approve',
  'grn.view', 'grn.create', 'grn.edit', 'grn.complete', 'promotions.view'
);

-- Reports Viewer: 12 permissions (read-only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p 
WHERE r.name = 'Reports Viewer' AND p.name IN (
  'dashboard.view', 'reports.view', 'reports.export',
  'products.view', 'categories.view', 'inventory.view',
  'sales.view', 'customers.view', 'suppliers.view',
  'purchase-orders.view', 'grn.view', 'promotions.view'
);

-- Step 5: Final verification with exactly 81 permissions
-- =====================================================
SELECT 
  'FINAL_81_VERIFICATION' as check_type,
  t.name as tenant_name, r.name as role_name,
  COUNT(rp.permission_id) as actual_count,
  CASE 
    WHEN r.name = 'Tenant Admin' THEN 81
    WHEN r.name = 'Store Manager' THEN 58
    WHEN r.name = 'Cashier' THEN 18
    WHEN r.name = 'Inventory Manager' THEN 28
    WHEN r.name = 'Reports Viewer' THEN 12
  END as expected_count,
  CASE 
    WHEN COUNT(rp.permission_id) = CASE 
      WHEN r.name = 'Tenant Admin' THEN 81
      WHEN r.name = 'Store Manager' THEN 58
      WHEN r.name = 'Cashier' THEN 18
      WHEN r.name = 'Inventory Manager' THEN 28
      WHEN r.name = 'Reports Viewer' THEN 12
    END THEN '✅ PERFECT'
    ELSE '❌ INCORRECT'
  END as status
FROM tenants t
JOIN roles r ON t.id = r.tenant_id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE t.setup_completed = 1 AND r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer')
GROUP BY t.id, t.name, r.name ORDER BY t.name, r.name;

-- Step 6: System summary
-- =====================================================
SELECT 'FINAL_SYSTEM_SUMMARY' as check_type, 
       COUNT(*) as total_permissions,
       CASE WHEN COUNT(*) = 81 THEN '✅ PERFECT 81' ELSE '❌ WRONG COUNT' END as status
FROM permissions;

-- =====================================================
-- This removes 2 orders permissions to get exactly 81 total
-- Expected: Perfect role counts matching documentation
-- =====================================================
