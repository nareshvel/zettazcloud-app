# Modules and Permissions Master Table
## Organized by Sidebar Menu Structure

**Document Version**: 1.0  
**Last Updated**: August 16, 2025  
**Status**: Complete Module-Permission Mapping  

---

## Module Organization Logic

**Organization**: Based on sidebar menu structure from `/frontend/src/components/layout/Sidebar.tsx`
**Logic**: Groups modules by functional areas as they appear in the user interface
**Benefits**: 
- Aligns with user mental model
- Matches navigation structure
- Simplifies permission management
- Clear functional boundaries

---

## Complete Module-Permission Table

| **Section** | **Module** | **Status** | **Permissions** | **Count** | **Description** |
|-------------|------------|------------|-----------------|-----------|-----------------|
| **MAIN NAVIGATION** | | | | | |
| | **Dashboard** | ✅ Complete | `dashboard.view` | 1 | Business intelligence and KPIs |
| | **POS** | ✅ Complete | `sales.create`, `sales.view`, `sales.discount`, `tax.view`, `payments.view`, `printer.view`, `printer.settings` | 7 | Point of sale operations |
| **SALES OPERATIONS** | | | | | |
| | **Orders** | 🚧 Planned | `orders.view`, `orders.create`, `orders.edit`, `orders.delete`, `orders.fulfill` | 5 | Order management system |
| | **Promotions** | ❌ Missing | `promotions.view`, `promotions.create`, `promotions.edit`, `promotions.delete`, `promotions.apply` | 5 | Promotional offers and discounts |
| **SALES RETURN** | | | | | |
| | **Sales Return** | ❌ Missing | `sales-return.view`, `sales-return.create`, `sales-return.process`, `sales-return.approve` | 4 | Return and refund processing |
| **INVENTORY** | | | | | |
| | **Products** | ✅ Complete | `products.view`, `products.create`, `products.edit`, `products.delete`, `products.import`, `products.export` | 6 | Product catalog management |
| | **Categories** | ✅ Complete | `categories.view`, `categories.create`, `categories.edit`, `categories.delete` | 4 | Product categorization |
| | **Suppliers** | ✅ Complete | `suppliers.view`, `suppliers.create`, `suppliers.edit`, `suppliers.delete` | 4 | Vendor management |
| | **Purchase Orders** | ❌ Missing | `purchase-orders.view`, `purchase-orders.create`, `purchase-orders.edit`, `purchase-orders.delete`, `purchase-orders.approve` | 5 | Procurement management |
| | **Goods Receiving (GRN)** | ❌ Missing | `grn.view`, `grn.create`, `grn.edit`, `grn.complete` | 4 | Goods receiving notes |
| | **Inventory Management** | ✅ Complete | `inventory.view`, `inventory.adjust`, `inventory.transfer`, `inventory.history` | 4 | Stock control and adjustments |
| **CUSTOMERS** | | | | | |
| | **Customers** | ✅ Complete | `customers.view`, `customers.create`, `customers.edit`, `customers.delete` | 4 | Customer database management |
| **REPORTS** | | | | | |
| | **Reports** | ✅ Complete | `reports.view`, `reports.export` | 2 | Business reporting and analytics |
| **SYSTEM** | | | | | |
| | **Settings** | ⚠️ Partial | `settings.view`, `settings.edit`, `settings.tax`, `settings.payment`, `settings.printer`, `settings.store` | 6 | System configuration |
| | **User Management** | ✅ Complete | `users.view`, `users.create`, `users.edit`, `users.delete` | 4 | Staff management |
| | **Role Management** | ✅ Complete | `roles.view`, `roles.create`, `roles.edit`, `roles.delete` | 4 | Access control management |
| | **Stores** | ✅ Complete | `stores.view`, `stores.create`, `stores.edit`, `stores.delete` | 4 | Multi-store operations |
| **SUPPORTING MODULES** | | | | | |
| | **Tax Management** | ✅ Complete | `tax.view`, `tax.create`, `tax.edit` | 3 | Tax configuration |
| | **Payment Processing** | ✅ Complete | `payments.view`, `payments.create`, `payments.edit` | 3 | Payment method management |
| | **Printer Management** | ✅ Complete | `printer.view`, `printer.settings` | 2 | Receipt and label printing |
| | **System Administration** | ❌ Missing | `system.audit`, `system.backup`, `system.settings`, `system.maintenance` | 4 | System administration |

---

## Permission Status Summary

### ✅ **Complete Modules (12 modules)**
- **Dashboard**: 1 permission
- **Products**: 6 permissions  
- **Categories**: 4 permissions
- **Suppliers**: 4 permissions
- **Inventory Management**: 4 permissions
- **Customers**: 4 permissions
- **Reports**: 2 permissions
- **User Management**: 4 permissions
- **Role Management**: 4 permissions
- **Stores**: 4 permissions
- **Tax Management**: 3 permissions
- **Payment Processing**: 3 permissions
- **Printer Management**: 2 permissions

**Total Complete**: 45 permissions

### ❌ **Missing Modules (5 modules)**
- **Sales Return**: 4 permissions
- **Promotions**: 5 permissions
- **Purchase Orders**: 5 permissions
- **Goods Receiving (GRN)**: 4 permissions
- **System Administration**: 4 permissions

**Total Missing**: 22 permissions

### 🚧 **Planned Modules (1 module)**
- **Orders**: 5 permissions

**Total Planned**: 5 permissions

### ⚠️ **Partial Modules (2 modules)**
- **POS**: Uses multiple module permissions (7 total)
- **Settings**: Needs granular permissions (6 total, 4 missing)

**Total Partial**: 4 additional permissions needed

---

## Detailed Permission Breakdown

### **Current Permissions (50 total)**
```
dashboard.view, reports.view, reports.export,
products.view, products.create, products.edit, products.delete, products.import, products.export,
categories.view, categories.create, categories.edit, categories.delete,
inventory.view, inventory.adjust, inventory.transfer, inventory.history,
sales.view, sales.create, sales.void, sales.refund, sales.discount,
customers.view, customers.create, customers.edit, customers.delete,
stores.view, stores.create, stores.edit, stores.delete,
users.view, users.create, users.edit, users.delete,
roles.view, roles.create, roles.edit, roles.delete,
suppliers.view, suppliers.create, suppliers.edit, suppliers.delete,
tax.view, tax.create, tax.edit,
payments.view, payments.create, payments.edit,
printer.view, printer.settings
```

### **Missing Permissions (26 total)**
```
# Sales Return Module (4)
sales-return.view, sales-return.create, sales-return.process, sales-return.approve,

# Promotions Module (5)
promotions.view, promotions.create, promotions.edit, promotions.delete, promotions.apply,

# Purchase Orders Module (5)
purchase-orders.view, purchase-orders.create, purchase-orders.edit, purchase-orders.delete, purchase-orders.approve,

# GRN Module (4)
grn.view, grn.create, grn.edit, grn.complete,

# System Administration Module (4)
system.audit, system.backup, system.settings, system.maintenance,

# Settings Granular Permissions (4)
settings.tax, settings.payment, settings.printer, settings.store
```

### **Planned Permissions (5 total)**
```
# Orders Module (5)
orders.view, orders.create, orders.edit, orders.delete, orders.fulfill
```

---

## Updated Role Permission Mappings

### **Tenant Admin** (Expected: 81 permissions)
**Current**: 50 permissions  
**Add**: All 26 missing + 5 planned = 81 total

### **Store Manager** (Expected: 58 permissions)  
**Current**: 32 permissions  
**Add**: All except system.* and some advanced permissions = 58 total

### **Cashier** (Expected: 18 permissions)**
**Current**: 14 permissions  
**Add**: `sales-return.view`, `sales-return.create`, `promotions.view`, `promotions.apply` = 18 total

### **Inventory Manager** (Expected: 35 permissions)**
**Current**: 19 permissions  
**Add**: All purchase-orders.*, grn.*, some promotions.* = 35 total

### **Reports Viewer** (Expected: 12 permissions)**
**Current**: 12 permissions  
**No changes needed**

---

## Implementation Priority

### **Phase 1: Critical Missing Modules** (High Priority)
1. **Sales Return** - Core business functionality
2. **Purchase Orders** - Essential for procurement
3. **GRN** - Completes inventory workflow

### **Phase 2: Business Enhancement** (Medium Priority)
4. **Promotions** - Marketing and sales features
5. **Settings Granular** - Better permission control

### **Phase 3: Future Planning** (Low Priority)
6. **Orders Module** - Future e-commerce features
7. **System Administration** - Advanced admin features

---

## Next Steps

### **Immediate Actions**
1. **Add Missing Permissions**: Extend `PermissionSeedingService` with 26 missing permissions
2. **Update Role Mappings**: Assign appropriate permissions to each role
3. **Update Existing Tenants**: Run backfill script for new permissions

### **Implementation Order**
1. Add Sales Return permissions (4)
2. Add Purchase Orders permissions (5)  
3. Add GRN permissions (4)
4. Add Promotions permissions (5)
5. Add Settings granular permissions (4)
6. Add System Administration permissions (4)

### **Validation Steps**
1. Verify all sidebar menu items have corresponding permissions
2. Test permission enforcement on all routes
3. Validate role-based access control
4. Update documentation

---

**Total System Capacity**: 81 permissions across 20 modules  
**Current Implementation**: 50 permissions (62% complete)  
**Missing Implementation**: 31 permissions (38% remaining)  

This table provides a clear roadmap for completing the RBAC permission system aligned with your application's navigation structure.
