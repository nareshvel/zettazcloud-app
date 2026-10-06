-- =====================================================
-- Check Database Table Structure for Test Tenant Creation
-- =====================================================

-- Step 1: Check tenants table structure
SELECT 'TENANTS_TABLE_STRUCTURE' as check_type, 
       COLUMN_NAME, 
       DATA_TYPE, 
       IS_NULLABLE, 
       COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'tenants'
ORDER BY ORDINAL_POSITION;

-- Step 2: Check users table structure
SELECT 'USERS_TABLE_STRUCTURE' as check_type, 
       COLUMN_NAME, 
       DATA_TYPE, 
       IS_NULLABLE, 
       COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'users'
ORDER BY ORDINAL_POSITION;

-- Step 3: Check stores table structure
SELECT 'STORES_TABLE_STRUCTURE' as check_type, 
       COLUMN_NAME, 
       DATA_TYPE, 
       IS_NULLABLE, 
       COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = DATABASE() 
AND TABLE_NAME = 'stores'
ORDER BY ORDINAL_POSITION;

-- Step 4: Check existing tenant data to understand ID format
SELECT 'EXISTING_TENANTS' as check_type, 
       id, 
       name, 
       setup_completed, 
       onboarding_step
FROM tenants 
LIMIT 5;

-- Step 5: Check existing user data to understand structure
SELECT 'EXISTING_USERS' as check_type, 
       id, 
       email, 
       tenant_id,
       created_at
FROM users 
LIMIT 5;

-- =====================================================
-- This will show us the correct column names and structure
-- =====================================================
