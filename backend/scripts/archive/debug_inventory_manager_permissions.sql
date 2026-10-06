-- =====================================================
-- Debug Inventory Manager - Find the extra permission
-- =====================================================

-- Step 1: List all current permissions for Inventory Manager
SELECT 
  'CURRENT_INVENTORY_PERMISSIONS' as check_type,
  p.name as permission_name,
  p.module
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'Inventory Manager'
ORDER BY p.module, p.name;

-- Step 2: Expected 28 permissions for Inventory Manager
WITH expected_inventory_permissions AS (
  SELECT permission_name FROM (VALUES
    ('dashboard.view'),
    ('reports.view'),
    ('products.view'),
    ('products.create'),
    ('products.edit'),
    ('products.delete'),
    ('products.import'),
    ('products.export'),
    ('categories.view'),
    ('categories.create'),
    ('categories.edit'),
    ('categories.delete'),
    ('inventory.view'),
    ('inventory.adjust'),
    ('inventory.transfer'),
    ('inventory.history'),
    ('suppliers.view'),
    ('suppliers.create'),
    ('suppliers.edit'),
    ('purchase-orders.view'),
    ('purchase-orders.create'),
    ('purchase-orders.edit'),
    ('purchase-orders.delete'),
    ('purchase-orders.approve'),
    ('grn.view'),
    ('grn.create'),
    ('grn.edit'),
    ('grn.complete'),
    ('promotions.view')
  ) AS t(permission_name)
)
SELECT 
  'EXPECTED_INVENTORY_PERMISSIONS' as check_type,
  permission_name
FROM expected_inventory_permissions
ORDER BY permission_name;

-- Step 3: Find EXTRA permissions (current but not expected)
WITH expected_inventory_permissions AS (
  SELECT permission_name FROM (VALUES
    ('dashboard.view'),
    ('reports.view'),
    ('products.view'),
    ('products.create'),
    ('products.edit'),
    ('products.delete'),
    ('products.import'),
    ('products.export'),
    ('categories.view'),
    ('categories.create'),
    ('categories.edit'),
    ('categories.delete'),
    ('inventory.view'),
    ('inventory.adjust'),
    ('inventory.transfer'),
    ('inventory.history'),
    ('suppliers.view'),
    ('suppliers.create'),
    ('suppliers.edit'),
    ('purchase-orders.view'),
    ('purchase-orders.create'),
    ('purchase-orders.edit'),
    ('purchase-orders.delete'),
    ('purchase-orders.approve'),
    ('grn.view'),
    ('grn.create'),
    ('grn.edit'),
    ('grn.complete'),
    ('promotions.view')
  ) AS t(permission_name)
)
SELECT 
  'EXTRA_INVENTORY_PERMISSIONS' as check_type,
  p.name as extra_permission,
  p.module
FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
LEFT JOIN expected_inventory_permissions eip ON p.name = eip.permission_name
WHERE r.name = 'Inventory Manager'
AND eip.permission_name IS NULL
ORDER BY p.module, p.name;

-- =====================================================
-- This will show us exactly which permission is extra
-- =====================================================
