# Audit Logging Integration Examples

## Overview
This document provides examples of how to integrate the audit logging service into various parts of the POS system.

## Basic Usage

```javascript
const AuditService = require('../services/auditService');

// Basic audit log
await AuditService.log({
  userId: 'user-123',
  tenantId: 'tenant-456',
  action: 'user_created',
  resourceType: 'user',
  eventCategory: 'user_management',
  severity: 'medium',
  details: { email: 'new@example.com' }
});
```

## Authentication Events

### Login Success
```javascript
// In login route
await AuditService.logAuth({
  userId: user.id,
  tenantId: user.tenant_id,
  action: 'login_success',
  ...AuditService.extractRequestContext(req),
  details: { loginMethod: 'email_password' }
});
```

### Login Failure
```javascript
// In login route (failed attempt)
await AuditService.logAuth({
  userId: null,
  tenantId: null,
  action: 'login_failed',
  ...AuditService.extractRequestContext(req),
  status: 'failure',
  errorMessage: 'Invalid credentials',
  details: { attemptedEmail: email }
});
```

### Logout
```javascript
// In logout route
await AuditService.logAuth({
  userId: req.user.id,
  tenantId: req.user.tenant_id,
  action: 'logout',
  ...AuditService.extractRequestContext(req)
});
```

## User Management Events

### User Creation
```javascript
// In user creation route
await AuditService.logUserManagement({
  userId: req.user.id, // Admin creating the user
  tenantId: req.user.tenant_id,
  storeId: req.user.store_id,
  action: 'user_created',
  targetUserId: newUser.id,
  newValues: {
    name: newUser.name,
    email: newUser.email,
    role: newUser.role
  },
  ...AuditService.extractRequestContext(req)
});
```

### User Role Change
```javascript
// In role update route
await AuditService.logUserManagement({
  userId: req.user.id,
  tenantId: req.user.tenant_id,
  action: 'role_updated',
  targetUserId: targetUser.id,
  oldValues: { role: oldRole },
  newValues: { role: newRole },
  ...AuditService.extractRequestContext(req),
  details: { reason: 'Promotion to manager' }
});
```

## Transaction Events

### Sale Transaction
```javascript
// In POS sale route
await AuditService.logTransaction({
  userId: req.user.id,
  tenantId: req.user.tenant_id,
  storeId: req.user.store_id,
  action: 'sale_completed',
  transactionId: transaction.id,
  amount: transaction.total,
  ...AuditService.extractRequestContext(req),
  details: {
    items: transaction.items.length,
    paymentMethod: transaction.payment_method,
    customer: transaction.customer_id
  }
});
```

### Refund Transaction
```javascript
// In refund route
await AuditService.logTransaction({
  userId: req.user.id,
  tenantId: req.user.tenant_id,
  storeId: req.user.store_id,
  action: 'refund_processed',
  transactionId: refund.original_transaction_id,
  amount: refund.amount,
  ...AuditService.extractRequestContext(req),
  details: {
    refundId: refund.id,
    reason: refund.reason,
    originalAmount: originalTransaction.total
  }
});
```

## Configuration Changes

### Store Settings Update
```javascript
// In store settings route
await AuditService.logConfiguration({
  userId: req.user.id,
  tenantId: req.user.tenant_id,
  storeId: req.user.store_id,
  action: 'store_settings_updated',
  resourceType: 'store',
  resourceId: store.id,
  oldValues: { 
    name: oldStore.name,
    address: oldStore.address 
  },
  newValues: { 
    name: updatedStore.name,
    address: updatedStore.address 
  },
  ...AuditService.extractRequestContext(req)
});
```

### Tax Configuration
```javascript
// In tax settings route
await AuditService.logConfiguration({
  userId: req.user.id,
  tenantId: req.user.tenant_id,
  storeId: req.user.store_id,
  action: 'tax_rate_updated',
  resourceType: 'tax_configuration',
  oldValues: { rate: oldTaxRate },
  newValues: { rate: newTaxRate },
  ...AuditService.extractRequestContext(req),
  details: { effectiveDate: new Date() }
});
```

## System Events

### Database Migration
```javascript
// In migration script
await AuditService.logSystem({
  action: 'database_migration',
  resourceType: 'database',
  details: {
    migrationName: 'add_audit_logs_table',
    version: '1.2.0'
  },
  severity: 'medium'
});
```

### Backup Creation
```javascript
// In backup script
await AuditService.logSystem({
  action: 'backup_created',
  resourceType: 'database',
  details: {
    backupFile: 'backup_20250123.sql',
    size: '2.5MB'
  },
  severity: 'low'
});
```

## Onboarding Events (Already Implemented)

```javascript
// In onboarding completion route
await AuditService.logOnboarding({
  userId: req.user.id,
  tenantId: req.user.tenant_id,
  action: 'onboarding_completed',
  details: {
    businessType: businessInfo.businessType,
    currency: storeInfo.currency,
    timezone: storeInfo.timezone,
    completedSections: ['business_info', 'store_info', 'payment_settings']
  },
  ...AuditService.extractRequestContext(req)
});
```

## Middleware Integration

### Audit Middleware
```javascript
// Create audit middleware for automatic logging
const auditMiddleware = (action, resourceType, eventCategory) => {
  return async (req, res, next) => {
    // Store original res.json
    const originalJson = res.json;
    
    // Override res.json to capture response
    res.json = function(data) {
      // Log the audit event
      AuditService.log({
        userId: req.user?.id,
        tenantId: req.user?.tenant_id,
        storeId: req.user?.store_id,
        action,
        resourceType,
        eventCategory,
        ...AuditService.extractRequestContext(req),
        status: res.statusCode >= 400 ? 'failure' : 'success',
        details: { 
          endpoint: req.path,
          method: req.method,
          statusCode: res.statusCode
        }
      }).catch(err => console.error('Audit logging failed:', err));
      
      // Call original json method
      return originalJson.call(this, data);
    };
    
    next();
  };
};

// Usage in routes
router.post('/users', 
  authMiddleware,
  auditMiddleware('user_created', 'user', 'user_management'),
  createUserHandler
);
```

## Query Examples

### Get User Activity
```javascript
// Get recent activity for a user
const userActivity = await AuditService.getUserAuditLogs('user-123', 50, 0);

// Get critical events in last 24 hours
const criticalEvents = await AuditService.getCriticalEvents(24, 100);

// Get tenant activity
const tenantActivity = await AuditService.getTenantAuditLogs('tenant-456', 100, 0);
```

## Best Practices

1. **Always log authentication events** - Critical for security
2. **Log financial transactions** - Required for compliance
3. **Include context** - IP address, user agent, session ID
4. **Use appropriate severity levels** - Critical for financial, high for security
5. **Don't log sensitive data** - Passwords, credit card numbers, etc.
6. **Handle audit failures gracefully** - Don't break main functionality
7. **Use structured details** - JSON objects for searchability
8. **Consider performance** - Audit logging shouldn't slow down operations

## Implementation Priority

1. **High Priority** (Implement first):
   - Authentication events (login/logout)
   - User management (creation, role changes)
   - Transaction events (sales, refunds)
   - Onboarding completion ✅ (Already implemented)

2. **Medium Priority**:
   - Configuration changes
   - System events
   - Data exports

3. **Low Priority**:
   - General user actions
   - Report generation
   - Routine maintenance events
