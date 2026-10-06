-- =====================================================
-- Debug Fresh Permissions - Find the 2 extra permissions
-- =====================================================

-- Step 1: List all current permissions to identify the extras
-- =====================================================
SELECT 'CURRENT_PERMISSIONS_AFTER_FRESH_INSERT' as check_type, name, module
FROM permissions 
ORDER BY module, name;

-- Step 2: Count permissions by module to find discrepancies
-- =====================================================
SELECT 'PERMISSIONS_BY_MODULE_FRESH' as check_type, 
       COALESCE(module, 'NULL_MODULE') as module,
       COUNT(*) as permission_count
FROM permissions
GROUP BY module
ORDER BY module;

-- Step 3: Expected counts by module (should total 81)
-- =====================================================
SELECT 'EXPECTED_MODULE_COUNTS' as check_type, 'dashboard' as module, 1 as expected_count
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'reports', 2
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'products', 6
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'categories', 4
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'inventory', 4
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'sales', 5
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'customers', 4
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'stores', 4
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'users', 4
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'roles', 4
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'suppliers', 4
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'tax', 3
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'payments', 3
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'printer', 2
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'sales-return', 4
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'purchase-orders', 5
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'grn', 4
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'promotions', 5
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'settings', 6
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'system', 4
UNION ALL SELECT 'EXPECTED_MODULE_COUNTS', 'orders', 5
ORDER BY module;

-- Step 4: Find duplicate permission names
-- =====================================================
SELECT 'DUPLICATE_PERMISSION_NAMES_CHECK' as check_type, name, COUNT(*) as duplicate_count
FROM permissions
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY name;

-- Step 5: Manual count verification of INSERT statement
-- The INSERT should have exactly these 81 permissions:
-- Dashboard (1): dashboard.view
-- Reports (2): reports.view, reports.export  
-- Products (6): products.view, products.create, products.edit, products.delete, products.import, products.export
-- Categories (4): categories.view, categories.create, categories.edit, categories.delete
-- Inventory (4): inventory.view, inventory.adjust, inventory.transfer, inventory.history
-- Sales (5): sales.view, sales.create, sales.void, sales.refund, sales.discount
-- Customers (4): customers.view, customers.create, customers.edit, customers.delete
-- Stores (4): stores.view, stores.create, stores.edit, stores.delete
-- Users (4): users.view, users.create, users.edit, users.delete
-- Roles (4): roles.view, roles.create, roles.edit, roles.delete
-- Suppliers (4): suppliers.view, suppliers.create, suppliers.edit, suppliers.delete
-- Tax (3): tax.view, tax.create, tax.edit
-- Payments (3): payments.view, payments.create, payments.edit
-- Printer (2): printer.view, printer.settings
-- Sales-return (4): sales-return.view, sales-return.create, sales-return.process, sales-return.approve
-- Purchase-orders (5): purchase-orders.view, purchase-orders.create, purchase-orders.edit, purchase-orders.delete, purchase-orders.approve
-- GRN (4): grn.view, grn.create, grn.edit, grn.complete
-- Promotions (5): promotions.view, promotions.create, promotions.edit, promotions.delete, promotions.apply
-- Settings (6): settings.view, settings.edit, settings.tax, settings.payment, settings.printer, settings.store
-- System (4): system.audit, system.backup, system.settings, system.maintenance
-- Orders (5): orders.view, orders.create, orders.edit, orders.delete, orders.fulfill
-- TOTAL: 81 permissions

-- =====================================================
-- This will help identify which 2 permissions are extra
-- =====================================================
