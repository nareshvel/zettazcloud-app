-- =====================================================
-- Remove One Permission from Inventory Manager - MySQL Compatible
-- =====================================================

-- Step 1: Remove one specific permission from Inventory Manager
DELETE rp FROM role_permissions rp
JOIN roles r ON rp.role_id = r.id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'Inventory Manager' 
AND p.name = 'suppliers.edit';

-- Step 2: Verify Inventory Manager now has exactly 28 permissions
-- =====================================================
SELECT 
  'FINAL_INVENTORY_COUNT' as check_type,
  t.name as tenant_name,
  r.name as role_name,
  COUNT(rp.permission_id) as actual_count,
  28 as expected_count,
  CASE WHEN COUNT(rp.permission_id) = 28 THEN '✅ PERFECT' ELSE '❌ INCORRECT' END as status
FROM tenants t
JOIN roles r ON t.id = r.tenant_id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE t.setup_completed = 1 AND r.name = 'Inventory Manager'
GROUP BY t.id, t.name, r.name;

-- Step 3: Complete RBAC system verification
-- =====================================================
SELECT 
  'COMPLETE_RBAC_VERIFICATION' as check_type,
  t.name as tenant_name,
  r.name as role_name,
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

-- =====================================================
-- Expected: Perfect RBAC system with all exact counts
-- =====================================================
