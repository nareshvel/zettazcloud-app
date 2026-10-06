-- =====================================================
-- Test New Tenant Onboarding - Verify RBAC Creation
-- =====================================================

-- Step 1: Create a test tenant to verify onboarding process
INSERT INTO tenants (id, name, email, created_at, updated_at, setup_completed, onboarding_step)
VALUES ('test-tenant-001', 'Test Business Ltd', 'test@testbusiness.com', NOW(), NOW(), 0, 'pending');

-- Step 2: Create a test user for this tenant
INSERT INTO users (id, email, password_hash, first_name, last_name, tenant_id, created_at, updated_at)
VALUES ('test-user-001', 'admin@testbusiness.com', '$2b$10$dummy.hash.for.testing', 'Test', 'Admin', 'test-tenant-001', NOW(), NOW());

-- Step 3: Create default store for the tenant
INSERT INTO stores (id, name, tenant_id, is_active, created_at, updated_at)
VALUES ('test-store-001', 'Test Store', 'test-tenant-001', 1, NOW(), NOW());

-- Step 4: Verify current system permissions count (should be 81)
SELECT 'CURRENT_SYSTEM_PERMISSIONS' as check_type, COUNT(*) as total_permissions
FROM permissions;

-- Step 5: List all current system permissions
SELECT 'SYSTEM_PERMISSIONS_LIST' as check_type, name, module
FROM permissions 
ORDER BY module, name;

-- Step 6: Check if test tenant was created successfully
SELECT 'TEST_TENANT_CREATED' as check_type, id, name, setup_completed, onboarding_step
FROM tenants WHERE id = 'test-tenant-001';

-- =====================================================
-- Next: Run permission seeding service to see what happens
-- Expected: Should create exactly 81 permissions, not more
-- =====================================================
