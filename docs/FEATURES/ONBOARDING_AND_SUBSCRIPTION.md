# Admin-Controlled Onboarding and Subscription Management

## Overview
This document outlines the **admin-controlled onboarding process** for the Zettaz Cloud POS application. Unlike typical SaaS applications, Zettaz Cloud does not offer public self-service registration. All user creation, tenant provisioning, and subscription management is handled by platform administrators through private API endpoints.

## Table of Contents
1. [Admin-Only Registration](#admin-only-registration)
2. [Tenant Provisioning](#tenant-provisioning)
3. [Subscription Management](#subscription-management)
4. [User Creation and Role Assignment](#user-creation-and-role-assignment)
5. [Store Setup](#store-setup)
6. [First Login Experience](#first-login-experience)
7. [Administrative Workflows](#administrative-workflows)
8. [API Endpoints Reference](#api-endpoints-reference)
9. [Troubleshooting](#troubleshooting)

## Admin-Only Registration

### 1. No Public Signup
- **There is no public registration page or self-service signup**
- All user accounts must be created by platform administrators
- Registration endpoint: `POST /api/auth/register`
- **Required permissions**: `system.platform.manage`
- **Authentication**: Must be authenticated as platform admin

### 2. Admin User Creation Process
- Platform admin logs into the system
- Navigates to User Management section
- Creates new user accounts with:
  - Full name
  - Business email
  - Initial password (user changes on first login)
  - Assigned tenant ID
  - Initial role assignment

## Tenant Provisioning

### 1. Admin-Controlled Tenant Creation
- Tenants are created by platform administrators
- No automatic tenant creation from user registration
- Each tenant represents a business/organization
- Tenant configuration includes:
  - Unique tenant ID (UUID)
  - Company/business name
  - Default settings and configurations
  - Initial subscription assignment

### 2. Initial Tenant Setup
- Admin assigns first tenant admin user
- Initial permissions for tenant admin:
  - `tenant.admin` (full tenant management)
  - `users.manage` (create/manage tenant users)
  - `stores.manage` (create/manage stores)
  - `subscription.view` (view subscription details)

## Subscription Management

### 1. Admin-Only Subscription Control
- **No self-service subscription selection**
- All subscription management handled by platform administrators
- Subscription endpoint: `POST /api/subscriptions/tenant`
- **Required permissions**: `system.subscriptions.create`
- **Authentication**: Must be authenticated as platform admin

### 2. Available Plans
1. **Starter**
   - Up to 3 users
   - 1 store location
   - Basic inventory management
   - Email support

2. **Professional**
   - Up to 10 users
   - 3 store locations
   - Advanced reporting
   - Priority support

3. **Enterprise**
   - Unlimited users
   - Unlimited locations
   - Custom integrations
   - 24/7 dedicated support

### Plan Selection Flow
1. User selects preferred plan
2. System validates plan constraints
3. User enters billing information
4. System calculates prorated amount (if applicable)
5. User confirms subscription

### 3. Subscription Assignment Process
- Admin selects appropriate plan for tenant
- Configures subscription parameters:
  - Plan ID and billing cycle
  - Start and end dates
  - Trial period (if applicable)
  - Payment method (admin-managed)
  - Auto-renewal settings

### 4. Billing Management
- All billing handled at platform level
- Tenants cannot self-manage subscriptions
- Payment processing managed by platform admins
- Subscription changes require admin approval

## User Creation and Role Assignment

### 1. Tenant User Creation
- Tenant admins can create users within their tenant
- User creation endpoint: `POST /api/users`
- **Required permissions**: `users.create` or `tenant.admin`
- Available roles for assignment:
  - `tenant_admin` (full tenant management)
  - `manager` (store management)
  - `cashier` (POS operations)
  - `employee` (limited access)

### 2. Role-Based Access Control (RBAC)
- Granular permission system
- Role inheritance and permission stacking
- Store-specific role assignments
- Dynamic permission checking

### 3. Permission Categories
- **Tenant Level**: `tenant.admin`, `tenant.view`
- **User Management**: `users.create`, `users.edit`, `users.delete`
- **Store Management**: `stores.create`, `stores.edit`, `stores.delete`
- **Inventory**: `inventory.view`, `inventory.edit`, `inventory.adjust`
- **Sales**: `sales.create`, `sales.view`, `sales.refund`
- **Reports**: `reports.view`, `reports.export`
- **System**: `system.platform.manage`, `system.subscriptions.create`

## Store Setup

### 1. Admin Store Creation
- Platform admins create initial stores for tenants
- Tenant admins can create additional stores (if permitted by subscription)
- Store configuration includes:
  - Store name and address
  - Business hours and contact info
  - Tax settings and receipt customization
  - POS terminal configuration

### 2. User-Store Assignment
- Users can be assigned to specific stores
- Store-level role assignments override tenant-level roles
- Multi-store users have access across assigned stores

## First Login Experience

### 1. Initial Password Setup
- Users receive login credentials from admin
- Must change password on first login
- Password complexity requirements enforced

### 2. Role-Based Dashboard
- Dashboard content varies by user role:
  - **Tenant Admin**: Full system overview, user management, subscription status
  - **Manager**: Store performance, inventory, staff management
  - **Cashier**: POS interface, daily sales, customer management
  - **Employee**: Limited access based on assigned permissions

### 3. Initial Configuration
- Store-specific settings (for store users)
- POS terminal configuration
- Receipt and printing setup
- Tax configuration review

## Administrative Workflows

### 1. New Tenant Onboarding (Platform Admin)
1. **Create Tenant**
   - Generate unique tenant ID
   - Set up tenant configuration
   - Assign initial subscription plan

2. **Create Tenant Admin User**
   - Use `POST /api/auth/register` with platform admin credentials
   - Assign `tenant.admin` role
   - Provide login credentials to client

3. **Configure Initial Store**
   - Create first store for tenant
   - Set up basic POS configuration
   - Configure tax settings and receipt templates

### 2. Tenant User Management (Tenant Admin)
1. **Create Additional Users**
   - Use User Management interface
   - Assign appropriate roles (manager, cashier, employee)
   - Set store assignments

2. **Role and Permission Management**
   - Modify user roles as needed
   - Assign store-specific permissions
   - Review and audit user access

### 3. Subscription Management (Platform Admin Only)
1. **Plan Assignment**
   - Review tenant requirements
   - Assign appropriate subscription plan
   - Configure billing parameters

2. **Plan Changes**
   - Handle upgrade/downgrade requests
   - Adjust feature limits
   - Update billing cycles

## API Endpoints Reference

### Authentication & User Management
```
POST /api/auth/register
- Description: Create new user (admin only)
- Required Permission: system.platform.manage
- Authentication: Required

POST /api/users
- Description: Create tenant user
- Required Permission: users.create or tenant.admin
- Authentication: Required

PUT /api/users/:userId/roles
- Description: Assign roles to user
- Required Permission: users.edit or tenant.admin
- Authentication: Required
```

### Subscription Management
```
GET /api/subscriptions/plans
- Description: Get available subscription plans
- Required Permission: Authenticated user
- Authentication: Required

POST /api/subscriptions/tenant
- Description: Create/update tenant subscription
- Required Permission: system.subscriptions.create
- Authentication: Required

GET /api/subscriptions/tenant/:tenantId
- Description: Get tenant subscription details
- Required Permission: tenant.admin or system.subscriptions.view
- Authentication: Required
```

### Store Management
```
POST /api/stores
- Description: Create new store
- Required Permission: stores.create or tenant.admin
- Authentication: Required

GET /api/stores/tenant/:tenantId
- Description: Get tenant stores
- Required Permission: stores.view or tenant.admin
- Authentication: Required
```

## Troubleshooting

### Common Issues
1. **User Cannot Login**
   - Verify user account exists
   - Check if account is active
   - Confirm role assignments
   - Reset password if needed

2. **Permission Denied Errors**
   - Review user role assignments
   - Check store-specific permissions
   - Verify tenant association
   - Contact admin for role updates

3. **Subscription Limitations**
   - Contact platform admin for plan upgrades
   - Review current subscription limits
   - Check feature availability for current plan
   - Verify subscription is active and not expired

4. **Store Access Issues**
   - Verify user is assigned to correct store
   - Check store-specific role assignments
   - Confirm store is active and properly configured
   - Review multi-store access permissions

## Summary

### Key Differences from Standard SaaS Onboarding

1. **No Public Registration**: Unlike typical SaaS applications, Zettaz Cloud requires admin-controlled user creation
2. **Admin-Managed Subscriptions**: All subscription management is handled by platform administrators
3. **Hierarchical User Management**: Platform admins create tenant admins, who then manage their tenant users
4. **Enterprise-Focused**: Designed for B2B deployment with controlled access and centralized management

### Benefits of Admin-Controlled Onboarding

- **Enhanced Security**: No risk of unauthorized account creation
- **Quality Control**: Ensures proper tenant setup and configuration
- **Compliance**: Meets enterprise requirements for controlled access
- **Support**: Direct admin involvement ensures proper onboarding
- **Customization**: Each tenant can be configured according to specific needs

### Important Notes for Implementation

- All user creation requires appropriate admin permissions
- Subscription changes must go through platform administrators
- Role assignments follow strict RBAC principles
- Multi-tenant architecture ensures data isolation
- API endpoints are secured with permission-based access control

---

*This documentation reflects the actual implementation as of the current system architecture. For any discrepancies between this documentation and system behavior, the actual API implementation takes precedence.*

### Support Channels
- In-app chat support
- Email: support@zettaz.com
- Phone: (555) 123-4567
- Help Center: https://help.zettaz.com

## Next Steps
- [ ] Set up additional store locations
- [ ] Configure tax rates and payment methods
- [ ] Import product catalog
- [ ] Train team members on system usage
