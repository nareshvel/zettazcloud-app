# RBAC Current State and Implementation Analysis
## Comprehensive Documentation of Roles, Permissions, and Access Control

**Document Version**: 2.0  
**Last Updated**: August 16, 2025  
**Status**: Current Implementation Analysis and Gap Identification  

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Application Modules Analysis](#application-modules-analysis)
3. [Current Permission Structure](#current-permission-structure)
4. [Default Role Definitions](#default-role-definitions)
5. [New Tenant Onboarding Process](#new-tenant-onboarding-process)
6. [Existing Tenant Current State](#existing-tenant-current-state)
7. [Implementation Gaps and Issues](#implementation-gaps-and-issues)
8. [Recommendations and Next Steps](#recommendations-and-next-steps)

---

## Executive Summary

### ✅ **What's Working**
- **Core RBAC Infrastructure**: Database schema complete with proper relationships
- **Permission System**: 50 permissions defined and active
- **Role Creation**: Automated during tenant signup via `PermissionSeedingService`
- **POS Functionality**: Critical 403 errors resolved - tax, payments, printer access working
- **Existing Tenants**: Backfilled with proper permissions

### ❌ **Critical Issues Identified**
- **Permission Count Inconsistencies**: Same roles have different permission counts across tenants
- **Missing Module Permissions**: Several application modules lack comprehensive permission coverage
- **Frontend-Backend Gaps**: Some pages may lack corresponding permission checks
- **Settings Permission Gaps**: Various settings pages need dedicated permissions

---

## Application Modules Analysis

Based on frontend pages and backend routes analysis, the application consists of **14 core modules**:

### **1. Dashboard & Analytics**
- **Frontend Pages**: Dashboard, Various Report Pages
- **Backend Routes**: `/api/reports/*`, `/api/dashboard/*`
- **Current Permissions**: `dashboard.view`, `reports.view`, `reports.export`
- **Status**: ✅ **Complete**

### **2. Product Management**
- **Frontend Pages**: `ProductsPage.tsx`
- **Backend Routes**: `/api/products/*`
- **Current Permissions**: `products.view`, `products.create`, `products.edit`, `products.delete`, `products.import`, `products.export`
- **Status**: ✅ **Complete**

### **3. Category Management**
- **Frontend Pages**: Category sections in Products
- **Backend Routes**: `/api/categories/*`
- **Current Permissions**: `categories.view`, `categories.create`, `categories.edit`, `categories.delete`
- **Status**: ✅ **Complete**

### **4. Inventory Management**
- **Frontend Pages**: `StockAdjustmentPage.tsx`, `GoodsReceivingPage.tsx`
- **Backend Routes**: `/api/inventory/*`, `/api/grn/*`
- **Current Permissions**: `inventory.view`, `inventory.adjust`, `inventory.transfer`, `inventory.history`
- **Status**: ⚠️ **Partial** - Missing GRN-specific permissions

### **5. Sales & POS**
- **Frontend Pages**: POS Screen, `SalesReturnPage.tsx`
- **Backend Routes**: `/api/sales/*`, `/api/sales-return/*`
- **Current Permissions**: `sales.view`, `sales.create`, `sales.void`, `sales.refund`, `sales.discount`
- **Status**: ✅ **Complete**

### **6. Customer Management**
- **Frontend Pages**: `CustomersPage.tsx`, `CustomerDetailsPage.tsx`, `CustomersListPage.tsx`
- **Backend Routes**: `/api/customers/*`
- **Current Permissions**: `customers.view`, `customers.create`, `customers.edit`, `customers.delete`
- **Status**: ✅ **Complete**

### **7. Supplier Management**
- **Frontend Pages**: `SuppliersPage.tsx`
- **Backend Routes**: `/api/suppliers/*`
- **Current Permissions**: `suppliers.view`, `suppliers.create`, `suppliers.edit`, `suppliers.delete`
- **Status**: ✅ **Complete**

### **8. Purchase Management**
- **Frontend Pages**: `PurchaseManagementPage.tsx`, `OrdersPage.tsx`
- **Backend Routes**: `/api/purchase-orders/*`
- **Current Permissions**: ❌ **NONE** - No dedicated purchase-order permissions
- **Status**: ❌ **Missing**

### **9. User & Role Management**
- **Frontend Pages**: `UserManagementPage.tsx`, `RolesManagementPage.tsx`
- **Backend Routes**: `/api/users/*`, `/api/roles/*`
- **Current Permissions**: `users.view`, `users.create`, `users.edit`, `users.delete`, `roles.view`, `roles.create`, `roles.edit`, `roles.delete`
- **Status**: ✅ **Complete**

### **10. Store Management**
- **Frontend Pages**: Settings pages
- **Backend Routes**: `/api/stores/*`
- **Current Permissions**: `stores.view`, `stores.create`, `stores.edit`, `stores.delete`
- **Status**: ⚠️ **Partial** - Missing settings-specific permissions

### **11. Promotional Offers**
- **Frontend Pages**: `PromotionalOffersPage.tsx`, `ApplyPromotionalOffersPage.tsx`
- **Backend Routes**: `/api/promotional-offers/*`
- **Current Permissions**: ❌ **NONE** - No dedicated promotion permissions
- **Status**: ❌ **Missing**

### **12. Tax Management**
- **Frontend Pages**: Tax settings in Settings
- **Backend Routes**: `/api/tax/*`, `/api/v1/settings/taxes/*`
- **Current Permissions**: `tax.view`, `tax.create`, `tax.edit`
- **Status**: ✅ **Complete**

### **13. Payment Processing**
- **Frontend Pages**: Payment settings, POS payment
- **Backend Routes**: `/api/payment/*`, `/api/payment-terminals/*`
- **Current Permissions**: `payments.view`, `payments.create`, `payments.edit`
- **Status**: ✅ **Complete**

### **14. Printer Management**
- **Frontend Pages**: `PrintAgentPage.tsx`, `PrintReturnPage.tsx`
- **Backend Routes**: `/api/printer-settings/*`
- **Current Permissions**: `printer.view`, `printer.settings`
- **Status**: ✅ **Complete**

---

## Current Permission Structure

### **Complete Permission List (50 Total)**

#### **Dashboard & Reports (3 permissions)**
```
dashboard.view          - View store dashboard
reports.view           - View reports  
reports.export         - Export reports
```

#### **Products (6 permissions)**
```
products.view          - View products
products.create        - Create products
products.edit          - Edit products
products.delete        - Delete products
products.import        - Import products
products.export        - Export products
```

#### **Categories (4 permissions)**
```
categories.view        - View categories
categories.create      - Create categories
categories.edit        - Edit categories
categories.delete      - Delete categories
```

#### **Inventory (4 permissions)**
```
inventory.view         - View inventory
inventory.adjust       - Adjust inventory
inventory.transfer     - Transfer inventory between stores
inventory.history      - View inventory history
```

#### **Sales (5 permissions)**
```
sales.view            - View sales
sales.create          - Create sales
sales.void            - Void sales
sales.refund          - Process refunds
sales.discount        - Apply discounts
```

#### **Customers (4 permissions)**
```
customers.view        - View customers
customers.create      - Create customers
customers.edit        - Edit customers
customers.delete      - Delete customers
```

#### **Stores (4 permissions)**
```
stores.view           - View stores
stores.create         - Create stores
stores.edit           - Edit stores
stores.delete         - Delete stores
```

#### **Users & Roles (8 permissions)**
```
users.view            - View users
users.create          - Create users
users.edit            - Edit users
users.delete          - Delete users
roles.view            - View roles
roles.create          - Create roles
roles.edit            - Edit roles
roles.delete          - Delete roles
```

#### **Suppliers (4 permissions)**
```
suppliers.view        - View suppliers
suppliers.create      - Create suppliers
suppliers.edit        - Edit suppliers
suppliers.delete      - Delete suppliers
```

#### **Tax Management (3 permissions)**
```
tax.view              - View tax classes and rates
tax.create            - Create tax classes and rates
tax.edit              - Edit tax classes and rates
```

#### **Payment Processing (3 permissions)**
```
payments.view         - View payment methods
payments.create       - Create payment methods
payments.edit         - Edit payment methods
```

#### **Printer Management (2 permissions)**
```
printer.view          - View printer settings
printer.settings      - Manage printer settings
```

---

## Default Role Definitions

### **1. Tenant Admin** (Expected: 50 permissions)
**Purpose**: Complete administrative control over tenant resources

**Intended Permissions**: ALL 50 permissions
- Full dashboard and reports access
- Complete product and inventory management
- All sales operations including voids and refunds
- Customer and supplier management
- User and role administration
- Store management and configuration
- Tax and payment method configuration
- Printer settings management

**Use Cases**: Business owner, IT administrator, senior management

---

### **2. Store Manager** (Expected: 32 permissions)
**Purpose**: Day-to-day store operations and staff supervision

**Intended Permissions**:
```
dashboard.view, reports.view, reports.export
products.view, products.create, products.edit, products.import, products.export
categories.view, categories.create, categories.edit
inventory.view, inventory.adjust, inventory.history
sales.view, sales.create, sales.void, sales.refund, sales.discount
customers.view, customers.create, customers.edit
users.view, users.create, users.edit
suppliers.view, suppliers.create, suppliers.edit
tax.view, payments.view, printer.view, printer.settings
```

**Excluded**: Store creation/deletion, user deletion, role management, advanced configurations

**Use Cases**: Store manager, assistant manager, shift supervisor

---

### **3. Cashier** (Expected: 14 permissions)
**Purpose**: Front-line sales and customer service

**Intended Permissions**:
```
dashboard.view
products.view, categories.view, inventory.view
sales.view, sales.create, sales.discount
customers.view, customers.create, customers.edit
tax.view, payments.view, printer.view, printer.settings
```

**Excluded**: Product management, inventory adjustments, user management, advanced operations

**Use Cases**: Cashier, sales associate, part-time staff

---

### **4. Inventory Manager** (Expected: 19 permissions)
**Purpose**: Product catalog and inventory control specialist

**Intended Permissions**:
```
dashboard.view, reports.view
products.view, products.create, products.edit, products.delete, products.import, products.export
categories.view, categories.create, categories.edit, categories.delete
inventory.view, inventory.adjust, inventory.transfer, inventory.history
suppliers.view, suppliers.create, suppliers.edit
```

**Excluded**: Sales operations, user management, store configuration

**Use Cases**: Inventory specialist, warehouse manager, purchasing coordinator

---

### **5. Reports Viewer** (Expected: 12 permissions)
**Purpose**: Business intelligence and reporting access

**Intended Permissions**:
```
dashboard.view, reports.view, reports.export
products.view, categories.view, inventory.view
sales.view, customers.view
```

**Excluded**: Any create, edit, delete operations

**Use Cases**: Business analyst, accountant, external auditor

---

## New Tenant Onboarding Process

### **Current Implementation** ✅
**File**: `/backend/services/signupService.js` (Line ~400)
**Service**: `PermissionSeedingService.createDefaultRolesWithPermissions()`

**Process Flow**:
1. **Tenant Creation**: New tenant record created
2. **Store Creation**: Default store created for tenant
3. **Role Creation**: 5 default roles created with proper permissions
4. **Permission Assignment**: Each role gets appropriate permission set
5. **User Assignment**: Signup user gets Tenant Admin role

**Roles Created for New Tenants**:
- ✅ **Tenant Admin**: 50 permissions
- ✅ **Store Manager**: 32 permissions  
- ✅ **Cashier**: 14 permissions
- ✅ **Inventory Manager**: 19 permissions
- ✅ **Reports Viewer**: 12 permissions

---

## Existing Tenant Current State

### **Naresh Velusamy's Business** (Tenant: `c6516ca6-4f26-45b7-8d83-3a35f5e4a6bd`)
```
Tenant Admin:      58 permissions ⚠️ (Expected: 50)
Store Manager:     33 permissions ⚠️ (Expected: 32)  
Cashier:           15 permissions ⚠️ (Expected: 14)
Inventory Manager: 19 permissions ✅ (Expected: 19)
```

### **Zettaz Demo Store** (Tenant: `d7f267da-d5d9-4a15-b0d3-31ca710a4492`)
```
Tenant Admin:      46 permissions ⚠️ (Expected: 50)
Store Manager:     42 permissions ⚠️ (Expected: 32)
Cashier:           14 permissions ✅ (Expected: 14)
Inventory Manager: 16 permissions ⚠️ (Expected: 19)
Reports Viewer:    12 permissions ✅ (Expected: 12)
```

### **Analysis**
- **Inconsistent Permission Counts**: Same roles have different permissions across tenants
- **Some Roles Over-Permissioned**: May have legacy or manually added permissions
- **Some Roles Under-Permissioned**: Missing expected permissions

---

## Implementation Gaps and Issues

### **1. Missing Module Permissions** ❌

#### **Purchase Management Module**
**Status**: No dedicated permissions exist
**Required Permissions**:
```
purchase-orders.view     - View purchase orders
purchase-orders.create   - Create purchase orders  
purchase-orders.edit     - Edit purchase orders
purchase-orders.delete   - Delete purchase orders
purchase-orders.approve  - Approve purchase orders
```

#### **GRN (Goods Receiving) Module**
**Status**: No dedicated permissions exist
**Required Permissions**:
```
grn.view                - View goods receiving notes
grn.create              - Create goods receiving notes
grn.edit                - Edit goods receiving notes
grn.complete            - Complete goods receiving
```

#### **Promotional Offers Module**
**Status**: No dedicated permissions exist
**Required Permissions**:
```
promotions.view         - View promotional offers
promotions.create       - Create promotional offers
promotions.edit         - Edit promotional offers
promotions.delete       - Delete promotional offers
promotions.apply        - Apply promotional offers
```

#### **System Administration Module**
**Status**: No dedicated permissions exist
**Required Permissions**:
```
system.audit            - View audit logs
system.backup           - Create system backups
system.settings         - Manage system settings
system.maintenance      - Perform system maintenance
```

### **2. Settings Permission Gaps** ⚠️

**Issue**: Various settings pages use `settings.view` permission, but lack granular control

**Required Additional Permissions**:
```
settings.view           - View tenant settings (EXISTS)
settings.edit           - Edit tenant settings (EXISTS)
settings.tax            - Manage tax settings
settings.payment        - Manage payment settings
settings.printer        - Manage printer settings
settings.store          - Manage store settings
```

### **3. Permission Count Discrepancies** ⚠️

**Root Causes**:
- Legacy permissions from previous implementations
- Manual permission assignments during development
- Inconsistent backfill processes
- Different seeding service versions used

### **4. Frontend-Backend Permission Mismatches** ⚠️

**Potential Issues**:
- Some frontend pages may not have corresponding backend permission checks
- Print Agent functionality permissions unclear
- Advanced reporting features may lack proper checks
- System diagnostic pages need verification

---

## Recommendations and Next Steps

### **Immediate Actions (This Week)**

#### **1. Standardize Existing Tenant Permissions** 🔥
**Priority**: Critical
**Action**: Run standardization script to ensure all tenants have identical role-permission mappings
```sql
-- Query to identify discrepancies
SELECT r.tenant_id, t.name as tenant_name, r.name as role_name,
       COUNT(rp.permission_id) as actual_permissions
FROM roles r
LEFT JOIN tenants t ON r.tenant_id = t.id  
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer')
GROUP BY r.tenant_id, t.name, r.name
ORDER BY t.name, r.name;
```

#### **2. Add Missing Module Permissions** 🔥
**Priority**: Critical
**Action**: Extend `PermissionSeedingService` with missing modules
- Add Purchase Orders permissions (5 permissions)
- Add GRN permissions (4 permissions)  
- Add Promotions permissions (5 permissions)
- Add System Administration permissions (4 permissions)

### **Short Term Actions (Next Sprint)**

#### **3. Update Role Permission Mappings**
**Action**: Update default role definitions to include new permissions
- **Tenant Admin**: Add all new permissions (68 total)
- **Store Manager**: Add purchase-orders.*, grn.*, promotions.* (44 total)
- **Inventory Manager**: Add purchase-orders.*, grn.* (27 total)

#### **4. Frontend-Backend Audit**
**Action**: Verify all frontend pages have corresponding permission checks
- Audit all `*Page.tsx` files
- Check backend route protection
- Document any gaps

### **Long Term Improvements**

#### **5. Permission Testing Framework**
**Action**: Create automated tests to verify permission enforcement
- Unit tests for permission middleware
- Integration tests for protected routes
- Frontend permission display tests

#### **6. Role Hierarchy System**
**Action**: Implement permission inheritance
- Higher roles inherit lower role permissions
- Simplify permission management
- Reduce configuration complexity

#### **7. Custom Role Creation**
**Action**: Allow tenants to create custom roles
- UI for custom role creation
- Permission selection interface
- Validation and constraints

---

## Discussion Points

### **Questions for Decision**

1. **Permission Standardization**: Should we standardize all tenants to have identical permission counts per role immediately?

2. **Missing Module Priority**: Which missing modules need immediate attention?
   - Purchase Orders (high business impact)
   - GRN Operations (inventory workflow)
   - Promotional Offers (marketing features)
   - System Administration (operational needs)

3. **Role Granularity**: Are 5 default roles sufficient or do we need additional roles?
   - Sales Manager (between Store Manager and Cashier)
   - Accountant (financial reporting focus)
   - Marketing Manager (promotions and customer analytics)

4. **Permission Inheritance**: Should we implement role hierarchy?
   - Store Manager inherits all Cashier permissions
   - Tenant Admin inherits all other role permissions

5. **Settings Permissions**: Should settings be more granular or keep current approach?

### **Immediate Decision Required**

**Should we proceed with standardizing existing tenant permissions before adding new modules, or handle both simultaneously?**

**Recommendation**: Standardize first (safer), then add new modules to ensure clean baseline.

---

**Document Status**: Ready for Review and Implementation Planning  
**Next Review Date**: To be scheduled based on decisions made  
**Implementation Priority**: High - Core business functionality affected
