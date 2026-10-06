-- =====================================================
-- Fix Duplicate Role Permissions - Remove duplicates for all roles
-- =====================================================

-- Step 1: Remove duplicate role permissions for ALL roles
-- Keep only one instance of each role-permission combination
DELETE rp1 FROM role_permissions rp1
INNER JOIN role_permissions rp2 
WHERE rp1.id > rp2.id 
AND rp1.role_id = rp2.role_id 
AND rp1.permission_id = rp2.permission_id;

-- Step 2: Verify all role counts after removing duplicates
-- =====================================================
SELECT 
  'AFTER_DUPLICATE_REMOVAL' as check_type,
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

-- Step 3: Final system summary
-- =====================================================
SELECT 'FINAL_SYSTEM_STATUS' as check_type, 
       COUNT(*) as total_permissions,
       CASE WHEN COUNT(*) = 81 THEN '✅ PERFECT 81' ELSE '❌ WRONG COUNT' END as status
FROM permissions;

-- =====================================================
-- Expected Result: All roles with perfect counts, no duplicates
-- =====================================================
