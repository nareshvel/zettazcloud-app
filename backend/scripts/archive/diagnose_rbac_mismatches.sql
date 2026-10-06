-- =====================================================
-- RBAC Permission Count Mismatch Diagnostic Script
-- Identifies the 10 extra permissions causing count issues
-- =====================================================

-- Step 1: Check total permissions in system
-- =====================================================
SELECT 'TOTAL PERMISSIONS IN SYSTEM' as check_type, COUNT(*) as actual_count, 81 as expected_count, 
       (COUNT(*) - 81) as difference
FROM permissions;

-- Step 2: List ALL permissions in system (to identify extras)
-- =====================================================
SELECT 'ALL_PERMISSIONS_LIST' as check_type, name, module, created_at
FROM permissions 
ORDER BY module, name;

-- Step 3: Expected 81 permissions from documentation
-- =====================================================
CREATE TEMPORARY TABLE expected_permissions (name VARCHAR(255));

INSERT INTO expected_permissions (name) VALUES
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

-- Step 4: Find EXTRA permissions (in DB but not in expected list)
-- =====================================================
SELECT 'EXTRA_PERMISSIONS' as check_type, p.name, p.module, p.created_at
FROM permissions p
LEFT JOIN expected_permissions ep ON p.name = ep.name
WHERE ep.name IS NULL
ORDER BY p.module, p.name;

-- Step 5: Find MISSING permissions (in expected list but not in DB)
-- =====================================================
SELECT 'MISSING_PERMISSIONS' as check_type, ep.name
FROM expected_permissions ep
LEFT JOIN permissions p ON ep.name = p.name
WHERE p.name IS NULL
ORDER BY ep.name;

-- Step 6: Current role permission counts
-- =====================================================
SELECT 
  'CURRENT_ROLE_COUNTS' as check_type,
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
  (COUNT(rp.permission_id) - CASE 
    WHEN r.name = 'Tenant Admin' THEN 81
    WHEN r.name = 'Store Manager' THEN 58
    WHEN r.name = 'Cashier' THEN 18
    WHEN r.name = 'Inventory Manager' THEN 28
    WHEN r.name = 'Reports Viewer' THEN 12
    ELSE 0
  END) as difference
FROM tenants t
JOIN roles r ON t.id = r.tenant_id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE t.setup_completed = 1
AND r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer')
GROUP BY t.id, t.name, r.name
ORDER BY t.name, r.name;

-- Step 7: Identify which extra permissions are assigned to roles
-- =====================================================
SELECT 
  'EXTRA_PERMISSIONS_IN_ROLES' as check_type,
  t.name as tenant_name,
  r.name as role_name,
  p.name as permission_name,
  p.module
FROM tenants t
JOIN roles r ON t.id = r.tenant_id
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
LEFT JOIN expected_permissions ep ON p.name = ep.name
WHERE t.setup_completed = 1
AND r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer')
AND ep.name IS NULL
ORDER BY t.name, r.name, p.name;

-- Step 8: Permission count by module
-- =====================================================
SELECT 
  'PERMISSIONS_BY_MODULE' as check_type,
  COALESCE(module, 'NULL_MODULE') as module,
  COUNT(*) as permission_count
FROM permissions
GROUP BY module
ORDER BY module;

-- Step 9: Duplicate permission names check
-- =====================================================
SELECT 
  'DUPLICATE_PERMISSION_NAMES' as check_type,
  name,
  COUNT(*) as duplicate_count
FROM permissions
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY name;

-- Cleanup temporary table
DROP TEMPORARY TABLE expected_permissions;

-- =====================================================
-- Summary of Analysis
-- =====================================================
-- This script will identify:
-- 1. Total permission count vs expected (81)
-- 2. List of all permissions in system
-- 3. Extra permissions not in expected list
-- 4. Missing permissions from expected list
-- 5. Current role assignment counts
-- 6. Which extra permissions are assigned to roles
-- 7. Permission distribution by module
-- 8. Any duplicate permission names
-- =====================================================
