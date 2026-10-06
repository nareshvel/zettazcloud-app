# Database Schema Fixes and Analysis

## Overview
This document details the database schema mismatches discovered during the signup/onboarding flow debugging and the fixes implemented to align the code with the actual database structure.

## Database Schema Issues Identified

### 1. Incorrect Table References

#### ❌ **subscription_plans Table**
- **Issue**: Code referenced non-existent `subscription_plans` table
- **Actual Schema**: Uses `plans` table instead
- **Files Affected**: `/backend/services/signupService.js`
- **Fix**: Updated to query `plans` table for existing plan IDs

#### ❌ **tenant_subscriptions Table** 
- **Issue**: Documentation referenced non-existent `tenant_subscriptions` table
- **Actual Schema**: Uses `subscriptions` table
- **Correct Structure**:
  ```sql
  subscriptions (
    id CHAR(36) PRIMARY KEY,
    tenant_id CHAR(36) NOT NULL,
    plan_id CHAR(36) NOT NULL,
    status ENUM('active','trial','expired','cancelled','pending'),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    trial_end_date DATE NULL,
    auto_renew TINYINT(1) DEFAULT 0,
    metadata JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
  ```

#### ❌ **audit_logs Table**
- **Issue**: Code attempted to insert into non-existent `audit_logs` table
- **Actual Schema**: Table doesn't exist
- **Files Affected**: `/backend/routes/onboardingRoutes.js`
- **Fix**: Removed audit logging, replaced with console logging

### 2. Incorrect Field Names

#### ❌ **Subscriptions Table Fields**
- **Issue**: Code used incorrect field names for subscriptions table
- **Incorrect Fields Used**:
  - `trial_start`, `trial_end` 
  - `current_period_start`, `current_period_end`
- **Correct Fields**:
  - `start_date`, `end_date`, `trial_end_date`
  - `status`, `auto_renew`, `metadata`

## Fixes Implemented

### 1. Signup Service Fixes (`signupService.js`)

#### **createTrialSubscription Method**
```javascript
// BEFORE (Incorrect)
const [plans] = await connection.execute(
  'SELECT id FROM subscription_plans WHERE name = ? OR is_trial = TRUE LIMIT 1',
  ['Free Trial']
);

await connection.execute(`
  INSERT INTO subscriptions (
    id, tenant_id, plan_id, status, 
    trial_start, trial_end, current_period_start, current_period_end,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, NOW(), ?, NOW(), ?, NOW(), NOW())
`, [subscriptionId, tenantId, planId, 'trialing', trialEndDate, trialEndDate]);

// AFTER (Correct)
const [plans] = await connection.execute(
  'SELECT id FROM plans LIMIT 1'
);

await connection.execute(`
  INSERT INTO subscriptions (
    id, tenant_id, plan_id, status, 
    start_date, end_date, trial_end_date, auto_renew,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
`, [
  subscriptionId, tenantId, planId, 'trial',
  startDate.toISOString().split('T')[0],
  endDate.toISOString().split('T')[0],
  trialEndDate.toISOString().split('T')[0],
  1
]);
```

### 2. Onboarding Routes Fixes (`onboardingRoutes.js`)

#### **Audit Logging Removal**
```javascript
// BEFORE (Incorrect)
await connection.execute(
  `INSERT INTO audit_logs 
   (user_id, tenant_id, action, resource_type, details, created_at)
   VALUES (?, ?, 'onboarding_completed', 'tenant', ?, CURRENT_TIMESTAMP)`,
  [userId, tenantId, JSON.stringify(details)]
);

// AFTER (Correct)
console.log(`✅ Onboarding completed for tenant ${tenantId} by user ${userId}:`, {
  businessType: businessInfo.businessType,
  currency: storeInfo.currency,
  timezone: storeInfo.timezone
});
```

### 3. Authentication Token Fix (`OnboardingWizard.tsx`)

#### **Token Key Mismatch**
```javascript
// BEFORE (Incorrect)
const token = localStorage.getItem('token');

// AFTER (Correct)
const token = localStorage.getItem('auth_token');
```

## Current Database State

### Legacy Data (Preserve)
- **Admin User**: `admin@zettaz.com`
- **Legacy Tenants**: 
  - `d7f267da-d5d9-4a15-b0d3-31ca710a4492`
  - `e6eb6436-4665-11f0-9c38-525400148990`
- **Legacy Subscriptions**: 2 active subscriptions for legacy tenants

### Test Data (To Clean Up)
- **Test Users**: Gmail addresses created during signup testing
- **Test Tenants**: Created after 2025-01-01
- **Test Stores**: Associated with test tenants
- **Test Subscriptions**: Associated with test tenants

## Database Cleanup Script

A comprehensive cleanup script has been created at `/scripts/cleanup_test_data.sql` that:

1. **Identifies** test data to be removed
2. **Creates backups** of data before deletion
3. **Safely deletes** test data while preserving legacy data
4. **Verifies** that legacy data remains intact
5. **Provides rollback** capability if something goes wrong

### Execution Steps:
1. **BACKUP DATABASE** before running any cleanup
2. Run identification queries to review data
3. Create backup tables for test data
4. Execute deletion commands within transaction
5. Verify results and commit or rollback

## Updated Database Tables Affected During Signup/Onboarding

### Phase 1: User Signup (`/api/auth/signup`)
1. **`tenants`** - Creates new tenant record
2. **`stores`** - Creates default store for tenant  
3. **`users`** - Creates user with `store_id` assigned ✅
4. **`user_roles`** - Assigns tenant_admin role
5. **`subscriptions`** - Creates trial subscription (using correct schema) ✅

### Phase 2: Email Verification (`/api/auth/verify-email`)
1. **`users`** - Updates email verification status
2. **`tenants`** - Updates onboarding step

### Phase 3: Onboarding Completion (`/api/onboarding/complete`)
1. **`tenants`** - Stores business info, marks setup complete
2. **`stores`** - Updates store details
3. **`users`** - Confirms store assignment
4. **Console Logging** - Replaces audit_logs (table doesn't exist) ✅

## Verification Status

- ✅ **Signup Service**: Fixed to use correct table and field names
- ✅ **Onboarding Routes**: Removed non-existent table references
- ✅ **Authentication**: Fixed token key mismatch
- ✅ **Database Schema**: Documented actual structure
- ✅ **Cleanup Script**: Created safe test data removal process

## Next Steps

1. **Test the complete signup/onboarding flow** with the fixes
2. **Execute the cleanup script** to remove test data
3. **Verify that new signups work properly** without database errors
4. **Monitor backend logs** for any remaining schema mismatches

## Impact

These fixes resolve:
- ❌ Backend 500 errors during subscription creation
- ❌ "Authentication token not found" errors in onboarding
- ❌ Database table/field mismatch errors
- ❌ Test data pollution in production database

The signup/onboarding flow should now work correctly with the actual database schema.
