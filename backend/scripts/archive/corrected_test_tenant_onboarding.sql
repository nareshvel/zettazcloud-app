-- =====================================================
-- Corrected Test Tenant Onboarding - Using Actual Schema
-- =====================================================

-- Step 1: Create a test tenant with correct schema (no email column)
INSERT INTO tenants (id, name, created_at, updated_at, setup_completed, onboarding_step)
VALUES ('test-tenant-001', 'Test Business Ltd', NOW(), NOW(), 0, 'pending');

-- Step 2: Create a test user with correct schema (name instead of first_name/last_name)
INSERT INTO users (id, tenant_id, name, email, password_hash, created_at, updated_at)
VALUES ('test-user-001', 'test-tenant-001', 'Test Admin', 'admin@testbusiness.com', '$2b$10$dummy.hash.for.testing', NOW(), NOW());

-- Step 3: Create default store for the tenant with correct schema
INSERT INTO stores (id, tenant_id, name, is_active, created_at, updated_at)
VALUES ('test-store-001', 'test-tenant-001', 'Test Store', 1, NOW(), NOW());

-- Step 4: Verify test tenant was created successfully
SELECT 'TEST_TENANT_CREATED' as check_type, id, name, setup_completed, onboarding_step
FROM tenants WHERE id = 'test-tenant-001';

-- Step 5: Verify test user was created successfully
SELECT 'TEST_USER_CREATED' as check_type, id, name, email, tenant_id
FROM users WHERE id = 'test-user-001';

-- Step 6: Verify test store was created successfully
SELECT 'TEST_STORE_CREATED' as check_type, id, name, tenant_id, is_active
FROM stores WHERE id = 'test-store-001';

-- Step 7: Now test the permission seeding service by calling it
-- This would normally be done via Node.js service, but we can check if roles exist
SELECT 'ROLES_BEFORE_SEEDING' as check_type, COUNT(*) as role_count
FROM roles WHERE tenant_id = 'test-tenant-001';

-- Step 8: Check current system permissions (should be 81)
SELECT 'SYSTEM_PERMISSIONS_COUNT' as check_type, COUNT(*) as total_permissions
FROM permissions;

-- =====================================================
-- Next: Call PermissionSeedingService.createDefaultRolesWithPermissions()
-- Expected: Creates 5 roles with exact permission counts
-- =====================================================
