# RBAC Permissions Documentation
## Comprehensive Guide to Roles, Permissions, and Access Control

**Document Version**: 1.0  
**Last Updated**: August 15, 2025  
**Status**: Current Implementation Analysis  

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Application Modules](#application-modules)
3. [Permission Structure](#permission-structure)
4. [Default Role Definitions](#default-role-definitions)
5. [Current Implementation Status](#current-implementation-status)
6. [Permission Gaps and Issues](#permission-gaps-and-issues)
7. [Recommendations](#recommendations)

---

## System Overview

### RBAC Architecture
- **Dual-tier system**: System-level (platform) + Tenant-level (application) permissions
- **Tenant isolation**: Each tenant has independent role and permission assignments
- **Hierarchical roles**: From Tenant Admin (full access) to Cashier (limited POS access)

### Database Tables
- `permissions` - System-wide permission definitions
- `roles` - Tenant-specific role definitions
- `role_permissions` - Links roles to permissions
- `user_roles` - Assigns roles to users

---

## Application Modules

Based on analysis of frontend pages and backend routes, the application has the following modules:

### 1. **Dashboard & Analytics**
- **Pages**: Dashboard, Various Report Pages
- **Purpose**: Business intelligence, KPIs, analytics
- **Backend Routes**: `/api/reports/*`

### 2. **Product Management**
- **Pages**: ProductsPage, Categories management
- **Purpose**: Product catalog, categorization, pricing
- **Backend Routes**: `/api/products/*`, `/api/categories/*`

### 3. **Inventory Management**
- **Pages**: StockAdjustmentPage, GoodsReceivingPage
- **Purpose**: Stock control, adjustments, receiving
- **Backend Routes**: `/api/inventory/*`, `/api/grn/*`

### 4. **Sales & POS**
- **Pages**: POS Screen, SalesReturnPage
- **Purpose**: Point of sale, transaction processing, returns
- **Backend Routes**: `/api/sales/*`, `/api/sales-return/*`

### 5. **Customer Management**
- **Pages**: CustomersPage, CustomerDetailsPage
- **Purpose**: Customer database, profiles, history
- **Backend Routes**: `/api/customers/*`

### 6. **Supplier Management**
- **Pages**: SuppliersPage
- **Purpose**: Vendor management, purchase orders
- **Backend Routes**: `/api/suppliers/*`

### 7. **Purchase Management**
- **Pages**: PurchaseManagementPage, OrdersPage
- **Purpose**: Purchase orders, procurement
- **Backend Routes**: `/api/purchase-orders/*`

### 8. **User & Role Management**
- **Pages**: UserManagementPage, RolesManagementPage
- **Purpose**: Staff management, access control
- **Backend Routes**: `/api/users/*`, `/api/roles/*`

### 9. **Store Management**
- **Pages**: Settings pages
- **Purpose**: Multi-store operations, store configuration
- **Backend Routes**: `/api/stores/*`

### 10. **Promotional Offers**
- **Pages**: PromotionalOffersPage, ApplyPromotionalOffersPage
- **Purpose**: Discounts, promotions, marketing
- **Backend Routes**: `/api/promotional-offers/*`

### 11. **Tax Management**
- **Pages**: Tax settings in Settings
- **Purpose**: Tax configuration, rates, classes
- **Backend Routes**: `/api/v1/settings/taxes/*`

### 12. **Payment Processing**
- **Pages**: Payment settings, POS payment
- **Purpose**: Payment methods, gateways, terminals
- **Backend Routes**: `/api/payment/*`, `/api/payment-terminals/*`

### 13. **Printer Management**
- **Pages**: PrintAgentPage, PrintReturnPage
- **Purpose**: Receipt printing, label printing
- **Backend Routes**: `/api/printer-settings/*`

### 14. **Reports & Analytics**
- **Pages**: Multiple report pages (Customer Value, Inventory, Payment, etc.)
- **Purpose**: Business reporting, data export
- **Backend Routes**: `/api/reports/*`

---

## Permission Structure

### Current Permissions in Database (50 total)

#### **Dashboard & Reports (3 permissions)**
- `dashboard.view` - View store dashboard
- `reports.view` - View reports
- `reports.export` - Export reports

#### **Products (6 permissions)**
- `products.view` - View products
- `products.create` - Create products
- `products.edit` - Edit products
- `products.delete` - Delete products
- `products.import` - Import products
- `products.export` - Export products

#### **Categories (4 permissions)**
- `categories.view` - View categories
- `categories.create` - Create categories
- `categories.edit` - Edit categories
- `categories.delete` - Delete categories

#### **Inventory (4 permissions)**
- `inventory.view` - View inventory
- `inventory.adjust` - Adjust inventory
- `inventory.transfer` - Transfer inventory between stores
- `inventory.history` - View inventory history

#### **Sales (5 permissions)**
- `sales.view` - View sales
- `sales.create` - Create sales
- `sales.void` - Void sales
- `sales.refund` - Process refunds
- `sales.discount` - Apply discounts

#### **Customers (4 permissions)**
- `customers.view` - View customers
- `customers.create` - Create customers
- `customers.edit` - Edit customers
- `customers.delete` - Delete customers

#### **Stores (4 permissions)**
- `stores.view` - View stores
- `stores.create` - Create stores
- `stores.edit` - Edit stores
- `stores.delete` - Delete stores

#### **Users & Roles (8 permissions)**
- `users.view` - View users
- `users.create` - Create users
- `users.edit` - Edit users
- `users.delete` - Delete users
- `roles.view` - View roles
- `roles.create` - Create roles
- `roles.edit` - Edit roles
- `roles.delete` - Delete roles

#### **Suppliers (4 permissions)**
- `suppliers.view` - View suppliers
- `suppliers.create` - Create suppliers
- `suppliers.edit` - Edit suppliers
- `suppliers.delete` - Delete suppliers

#### **Tax Management (3 permissions)**
- `tax.view` - View tax classes and rates
- `tax.create` - Create tax classes and rates
- `tax.edit` - Edit tax classes and rates

#### **Payment Processing (3 permissions)**
- `payments.view` - View payment methods
- `payments.create` - Create payment methods
- `payments.edit` - Edit payment methods

#### **Printer Management (2 permissions)**
- `printer.view` - View printer settings
- `printer.settings` - Manage printer settings

---

## Default Role Definitions

### **1. Tenant Admin** (50 permissions - Full Access)
**Purpose**: Complete administrative control over tenant resources

**Permissions**: ALL 50 permissions including:
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

### **2. Store Manager** (32 permissions - Operational Management)
**Purpose**: Day-to-day store operations and staff supervision

**Permissions Include**:
- Dashboard and reports (view, export)
- Products (view, create, edit, import, export)
- Categories (view, create, edit)
- Inventory (view, adjust, history)
- Sales (view, create, void, refund, discount)
- Customers (view, create, edit)
- Users (view, create, edit)
- Suppliers (view, create, edit)
- Tax and payment viewing
- Printer management

**Excluded**: Store creation/deletion, user deletion, role management, advanced configurations

**Use Cases**: Store manager, assistant manager, shift supervisor

---

### **3. Cashier** (14 permissions - Essential POS Operations)
**Purpose**: Front-line sales and customer service

**Permissions Include**:
- Dashboard viewing
- Products and categories (view only)
- Inventory (view only)
- Sales (view, create, discount)
- Customers (view, create, edit)
- Tax viewing (for POS calculations)
- Payment viewing (for transaction processing)
- Printer access (for receipts)

**Excluded**: Product management, inventory adjustments, user management, advanced operations

**Use Cases**: Cashier, sales associate, part-time staff

---

### **4. Inventory Manager** (19 permissions - Product & Stock Focus)
**Purpose**: Product catalog and inventory control specialist

**Permissions Include**:
- Dashboard and reports viewing
- Products (full CRUD + import/export)
- Categories (full CRUD)
- Inventory (full access including transfers)
- Suppliers (view, create, edit)

**Excluded**: Sales operations, user management, store configuration

**Use Cases**: Inventory specialist, warehouse manager, purchasing coordinator

---

### **5. Reports Viewer** (12 permissions - Read-Only Analytics)
**Purpose**: Business intelligence and reporting access

**Permissions Include**:
- Dashboard and reports (view, export)
- Products, categories, inventory (view only)
- Sales and customers (view only)

**Excluded**: Any create, edit, delete operations

**Use Cases**: Business analyst, accountant, external auditor

---

## Current Implementation Status

### ✅ **What's Working**
1. **Database Schema**: Complete with all necessary tables
2. **Permission Definitions**: 50 permissions defined and active
3. **Role Creation**: Signup service creates default roles
4. **Permission Assignment**: Backfill script has assigned permissions to existing roles
5. **Middleware**: RBAC permission checking middleware functional

### ✅ **Recent Fixes Applied**
1. **Permission Seeding Service**: Created comprehensive service for role-permission mapping
2. **Signup Service Update**: Now assigns permissions during tenant onboarding
3. **Existing Tenant Backfill**: All existing tenants now have proper role permissions
4. **Remote Database**: Production database updated with correct permissions

### 📊 **Current Tenant Status**

#### **Naresh Velusamy's Business** (Tenant: c6516ca6-4f26-45b7-8d83-3a35f5e4a6bd)
- **Tenant Admin**: 58 permissions ✅
- **Store Manager**: 33 permissions ✅
- **Cashier**: 15 permissions ✅
- **Inventory Manager**: 19 permissions ✅

#### **Zettaz Demo Store** (Tenant: d7f267da-d5d9-4a15-b0d3-31ca710a4492)
- **Tenant Admin**: 46 permissions ✅
- **Store Manager**: 42 permissions ✅
- **Cashier**: 14 permissions ✅
- **Inventory Manager**: 16 permissions ✅
- **Reports Viewer**: 12 permissions ✅

---

## Permission Gaps and Issues

### 🔍 **Identified Discrepancies**

#### **1. Permission Count Variations**
- **Expected vs Actual**: Some roles have more permissions than defined in seeding service
- **Tenant Admin**: Should have 50, but shows 58 and 46 for different tenants
- **Store Manager**: Should have 32, but shows 33 and 42 for different tenants

**Possible Causes**:
- Legacy permissions from previous implementations
- Manual permission assignments
- Database inconsistencies

#### **2. Missing Module Permissions**
Based on application analysis, some modules may lack comprehensive permissions:

**Purchase Management**:
- No specific `purchase-orders.*` permissions defined
- GRN operations may need dedicated permissions
- Procurement workflow permissions missing

**Promotional Offers**:
- No `promotions.*` permissions in current structure
- Marketing campaign permissions absent
- Discount management permissions unclear

**Advanced Inventory**:
- No `inventory.import` or `inventory.export` permissions
- Stock transfer approvals missing
- Inventory audit permissions absent

**System Administration**:
- No `system.backup` or `system.restore` permissions
- Audit log access permissions missing
- System configuration permissions unclear

#### **3. Frontend-Backend Permission Mismatches**
Some frontend pages may not have corresponding backend permission checks:
- Print Agent functionality
- Advanced reporting features
- System diagnostic pages

---

## Recommendations

### **Immediate Actions**

#### **1. Permission Audit and Standardization**
```sql
-- Query to identify permission discrepancies
SELECT r.tenant_id, t.name as tenant_name, r.name as role_name,
       COUNT(rp.permission_id) as actual_permissions
FROM roles r
LEFT JOIN tenants t ON r.tenant_id = t.id
LEFT JOIN role_permissions rp ON r.id = rp.role_id
WHERE r.name IN ('Tenant Admin', 'Store Manager', 'Cashier', 'Inventory Manager', 'Reports Viewer')
GROUP BY r.tenant_id, t.name, r.name
ORDER BY t.name, r.name;
```

#### **2. Add Missing Module Permissions**
```javascript
// Suggested additional permissions
const ADDITIONAL_PERMISSIONS = [
  // Purchase Management
  { name: 'purchase-orders.view', description: 'View purchase orders', module: 'purchase' },
  { name: 'purchase-orders.create', description: 'Create purchase orders', module: 'purchase' },
  { name: 'purchase-orders.edit', description: 'Edit purchase orders', module: 'purchase' },
  { name: 'purchase-orders.delete', description: 'Delete purchase orders', module: 'purchase' },
  
  // GRN Management
  { name: 'grn.view', description: 'View goods receiving notes', module: 'inventory' },
  { name: 'grn.create', description: 'Create goods receiving notes', module: 'inventory' },
  { name: 'grn.edit', description: 'Edit goods receiving notes', module: 'inventory' },
  
  // Promotional Offers
  { name: 'promotions.view', description: 'View promotional offers', module: 'promotions' },
  { name: 'promotions.create', description: 'Create promotional offers', module: 'promotions' },
  { name: 'promotions.edit', description: 'Edit promotional offers', module: 'promotions' },
  { name: 'promotions.delete', description: 'Delete promotional offers', module: 'promotions' },
  
  // System Administration
  { name: 'system.audit', description: 'View audit logs', module: 'system' },
  { name: 'system.backup', description: 'Create system backups', module: 'system' },
  { name: 'system.settings', description: 'Manage system settings', module: 'system' }
];
```

#### **3. Role Permission Standardization**
Update the permission seeding service to ensure consistent permission counts across all tenants.

### **Long-term Improvements**

#### **1. Dynamic Permission Discovery**
Implement automatic permission discovery based on route definitions and middleware usage.

#### **2. Permission Testing Framework**
Create automated tests to verify that all frontend pages have corresponding backend permission checks.

#### **3. Role Hierarchy System**
Implement permission inheritance where higher-level roles automatically include lower-level permissions.

#### **4. Custom Role Creation**
Allow tenants to create custom roles with specific permission combinations.

---

## Discussion Points

### **Questions for Review**

1. **Permission Count Discrepancies**: Should we standardize all tenants to have identical permission counts per role?

2. **Missing Modules**: Which additional modules need dedicated permissions (Purchase Orders, GRN, Promotions)?

3. **Role Granularity**: Are the current 5 default roles sufficient, or do we need additional roles (e.g., "Sales Manager", "Accountant")?

4. **Custom Permissions**: Should tenants be able to create custom permissions for their specific business needs?

5. **Permission Inheritance**: Should we implement role hierarchy where Store Manager inherits all Cashier permissions?

6. **Module Organization**: Should permissions be grouped differently (by functional area vs. CRUD operations)?

### **Next Steps**

1. **Review and Validate**: Confirm the current permission structure meets business requirements
2. **Standardize Permissions**: Ensure all tenants have consistent role-permission mappings
3. **Add Missing Permissions**: Implement permissions for uncovered modules
4. **Update Documentation**: Finalize this document based on decisions made
5. **Implement Changes**: Apply any agreed-upon modifications to the system

---

**Document Status**: Ready for Review and Discussion  
**Next Review Date**: To be scheduled based on feedback
