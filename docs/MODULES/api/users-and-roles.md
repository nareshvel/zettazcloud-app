# Users and Roles API

This document details the endpoints for managing users, roles, and permissions in the Zettaz Cloud Enterprise API.

## Overview

The Users and Roles API provides endpoints for creating and managing users, assigning roles, and configuring role-based access control (RBAC) within the multi-tenant environment.

## Endpoints

### List Users

```
GET /api/v1/users
```

Retrieves a paginated list of users within the current tenant.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| page | number | Page number (default: 1) |
| limit | number | Items per page (default: 20, max: 100) |
| sort | string | Field to sort by (default: 'created_at') |
| order | string | Sort order ('asc' or 'desc', default: 'desc') |
| search | string | Search term for name or email |
| role_id | string | Filter by role ID |
| status | string | Filter by status ('ACTIVE', 'INACTIVE', 'LOCKED') |

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "user_123",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john.doe@example.com",
      "username": "john.doe",
      "status": "ACTIVE",
      "role_id": "role_456",
      "role_name": "Store Manager",
      "last_login": "2023-05-30T15:30:00.000Z",
      "tenant_id": "tenant_123",
      "created_at": "2023-01-15T10:00:00.000Z",
      "updated_at": "2023-05-30T15:30:00.000Z"
    },
    {
      "id": "user_124",
      "first_name": "Jane",
      "last_name": "Smith",
      "email": "jane.smith@example.com",
      "username": "jane.smith",
      "status": "ACTIVE",
      "role_id": "role_789",
      "role_name": "Sales Associate",
      "last_login": "2023-06-01T09:15:00.000Z",
      "tenant_id": "tenant_123",
      "created_at": "2023-02-20T11:30:00.000Z",
      "updated_at": "2023-06-01T09:15:00.000Z"
    }
    // Additional users...
  ],
  "pagination": {
    "totalItems": 35,
    "totalPages": 2,
    "currentPage": 1,
    "pageSize": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

#### Notes
- Results are automatically filtered by the tenant_id of the authenticated user
- Password data is never included in responses
- Only users with appropriate permissions can view the user list

### Get User Details

```
GET /api/v1/users/:id
```

Retrieves detailed information for a specific user.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "user_123",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "username": "john.doe",
    "phone": "+1234567890",
    "status": "ACTIVE",
    "role_id": "role_456",
    "role_name": "Store Manager",
    "permissions": [
      "users.view",
      "users.create",
      "users.edit",
      "sales.view",
      "sales.create",
      "sales.edit",
      "inventory.view",
      "inventory.edit",
      "reports.view"
    ],
    "last_login": "2023-05-30T15:30:00.000Z",
    "last_password_change": "2023-04-15T11:20:00.000Z",
    "login_attempts": 0,
    "preferences": {
      "theme": "light",
      "language": "en-US",
      "timezone": "America/New_York",
      "notifications": {
        "email": true,
        "in_app": true
      }
    },
    "tenant_id": "tenant_123",
    "created_at": "2023-01-15T10:00:00.000Z",
    "updated_at": "2023-05-30T15:30:00.000Z",
    "created_by": "user_admin",
    "created_by_name": "Admin User"
  }
}
```

### Create User

```
POST /api/v1/users
```

Creates a new user within the current tenant.

#### Request Body

```json
{
  "first_name": "Michael",
  "last_name": "Johnson",
  "email": "michael.johnson@example.com",
  "username": "michael.johnson",
  "phone": "+1987654321",
  "password": "StrongP@ssw0rd123",
  "role_id": "role_789",
  "status": "ACTIVE",
  "preferences": {
    "theme": "dark",
    "language": "en-US",
    "timezone": "America/Chicago"
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "user_125",
    "first_name": "Michael",
    "last_name": "Johnson",
    "email": "michael.johnson@example.com",
    "username": "michael.johnson",
    "phone": "+1987654321",
    "status": "ACTIVE",
    "role_id": "role_789",
    "role_name": "Sales Associate",
    "tenant_id": "tenant_123",
    "created_at": "2023-06-02T10:30:00.000Z",
    "updated_at": "2023-06-02T10:30:00.000Z",
    "created_by": "user_123",
    "created_by_name": "John Doe"
  }
}
```

#### Notes
- Passwords must meet security requirements (min 8 chars, including uppercase, lowercase, numbers, and special characters)
- Email addresses must be unique within the tenant
- A welcome email with activation instructions is automatically sent to the new user
- The user is created within the tenant of the authenticated user

### Update User

```
PUT /api/v1/users/:id
```

Updates an existing user.

#### Request Body

```json
{
  "first_name": "Michael",
  "last_name": "Johnson-Smith",
  "phone": "+1987654322",
  "role_id": "role_456",
  "status": "ACTIVE",
  "preferences": {
    "theme": "light",
    "language": "en-US",
    "timezone": "America/Chicago",
    "notifications": {
      "email": true,
      "in_app": true
    }
  }
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "user_125",
    "first_name": "Michael",
    "last_name": "Johnson-Smith",
    "email": "michael.johnson@example.com",
    "username": "michael.johnson",
    "phone": "+1987654322",
    "status": "ACTIVE",
    "role_id": "role_456",
    "role_name": "Store Manager",
    "updated_at": "2023-06-02T11:45:00.000Z"
  }
}
```

#### Notes
- Email and username changes require additional verification
- Status changes (especially to LOCKED) are logged for audit purposes
- Role changes update the user's permissions immediately

### Change Password

```
PUT /api/v1/users/:id/password
```

Changes a user's password.

#### Request Body

```json
{
  "current_password": "StrongP@ssw0rd123",
  "new_password": "EvenStronger!P@ss456",
  "confirm_password": "EvenStronger!P@ss456"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Password updated successfully",
    "last_password_change": "2023-06-02T14:00:00.000Z"
  }
}
```

#### Notes
- Current password is required for security verification
- Passwords are securely hashed using bcrypt with appropriate salt rounds
- Password history is maintained to prevent reuse of recent passwords
- Password changes reset the login_attempts counter

### Delete User

```
DELETE /api/v1/users/:id
```

Deletes a user or marks them as inactive.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "User deactivated successfully"
  }
}
```

#### Notes
- In most cases, users are not physically deleted but marked as INACTIVE
- User deletion is only allowed if there are no dependencies (e.g., created records)
- Admin users cannot be deleted
- All user deletion actions are logged for audit purposes

### List Roles

```
GET /api/v1/roles
```

Retrieves a list of roles within the current tenant.

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "role_123",
      "name": "Administrator",
      "description": "Full system access",
      "is_system_role": true,
      "user_count": 2,
      "created_at": "2023-01-01T00:00:00.000Z",
      "updated_at": "2023-01-01T00:00:00.000Z"
    },
    {
      "id": "role_456",
      "name": "Store Manager",
      "description": "Manages store operations and staff",
      "is_system_role": false,
      "user_count": 5,
      "created_at": "2023-01-15T10:30:00.000Z",
      "updated_at": "2023-04-10T14:15:00.000Z"
    },
    {
      "id": "role_789",
      "name": "Sales Associate",
      "description": "Handles sales and basic inventory",
      "is_system_role": false,
      "user_count": 12,
      "created_at": "2023-01-20T11:45:00.000Z",
      "updated_at": "2023-03-05T09:30:00.000Z"
    }
    // Additional roles...
  ]
}
```

### Get Role Details

```
GET /api/v1/roles/:id
```

Retrieves detailed information for a specific role.

#### Response

```json
{
  "success": true,
  "data": {
    "id": "role_456",
    "name": "Store Manager",
    "description": "Manages store operations and staff",
    "is_system_role": false,
    "permissions": [
      {
        "id": "perm_users_view",
        "name": "users.view",
        "description": "View users",
        "category": "User Management"
      },
      {
        "id": "perm_users_edit",
        "name": "users.edit",
        "description": "Edit users",
        "category": "User Management"
      },
      {
        "id": "perm_sales_all",
        "name": "sales.*",
        "description": "All sales operations",
        "category": "Sales"
      },
      {
        "id": "perm_inventory_view",
        "name": "inventory.view",
        "description": "View inventory",
        "category": "Inventory"
      },
      {
        "id": "perm_inventory_edit",
        "name": "inventory.edit",
        "description": "Edit inventory",
        "category": "Inventory"
      },
      {
        "id": "perm_reports_view",
        "name": "reports.view",
        "description": "View reports",
        "category": "Reports"
      }
      // Additional permissions...
    ],
    "users": [
      {
        "id": "user_123",
        "name": "John Doe",
        "email": "john.doe@example.com"
      },
      {
        "id": "user_126",
        "name": "Emily Chen",
        "email": "emily.chen@example.com"
      }
      // Additional users...
    ],
    "created_by": "user_admin",
    "created_by_name": "Admin User",
    "created_at": "2023-01-15T10:30:00.000Z",
    "updated_at": "2023-04-10T14:15:00.000Z"
  }
}
```

### Create Role

```
POST /api/v1/roles
```

Creates a new role within the current tenant.

#### Request Body

```json
{
  "name": "Inventory Manager",
  "description": "Manages inventory, purchases, and stock levels",
  "permissions": [
    "inventory.*",
    "purchases.view",
    "purchases.create",
    "purchases.edit",
    "products.view",
    "products.edit",
    "reports.view"
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "role_789",
    "name": "Inventory Manager",
    "description": "Manages inventory, purchases, and stock levels",
    "is_system_role": false,
    "permissions": [
      "inventory.view",
      "inventory.create",
      "inventory.edit",
      "inventory.delete",
      "purchases.view",
      "purchases.create",
      "purchases.edit",
      "products.view",
      "products.edit",
      "reports.view"
    ],
    "created_by": "user_123",
    "created_by_name": "John Doe",
    "created_at": "2023-06-02T15:30:00.000Z",
    "updated_at": "2023-06-02T15:30:00.000Z"
  }
}
```

#### Notes
- Wildcard permissions (e.g., inventory.*) are expanded to individual permissions
- System roles cannot be created by users
- Role names must be unique within a tenant

### Update Role

```
PUT /api/v1/roles/:id
```

Updates an existing role.

#### Request Body

```json
{
  "name": "Inventory Manager",
  "description": "Manages all aspects of inventory and supplier relations",
  "permissions": [
    "inventory.*",
    "purchases.*",
    "products.*",
    "suppliers.*",
    "reports.view"
  ]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "role_789",
    "name": "Inventory Manager",
    "description": "Manages all aspects of inventory and supplier relations",
    "is_system_role": false,
    "permissions": [
      "inventory.view",
      "inventory.create",
      "inventory.edit",
      "inventory.delete",
      "purchases.view",
      "purchases.create",
      "purchases.edit",
      "purchases.delete",
      "products.view",
      "products.create",
      "products.edit",
      "products.delete",
      "suppliers.view",
      "suppliers.create",
      "suppliers.edit",
      "suppliers.delete",
      "reports.view"
    ],
    "updated_at": "2023-06-02T16:45:00.000Z"
  }
}
```

#### Notes
- System roles cannot be modified
- Changes to roles immediately affect all users with that role
- A complete list of permissions must be provided (not just additions/removals)

### Delete Role

```
DELETE /api/v1/roles/:id
```

Deletes a role.

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Role deleted successfully"
  }
}
```

#### Notes
- Roles can only be deleted if they have no assigned users
- System roles cannot be deleted
- All role deletion actions are logged for audit purposes

### List Permissions

```
GET /api/v1/permissions
```

Retrieves a list of all available permissions.

#### Response

```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "name": "User Management",
        "permissions": [
          {
            "id": "perm_users_view",
            "name": "users.view",
            "description": "View users"
          },
          {
            "id": "perm_users_create",
            "name": "users.create",
            "description": "Create users"
          },
          {
            "id": "perm_users_edit",
            "name": "users.edit",
            "description": "Edit users"
          },
          {
            "id": "perm_users_delete",
            "name": "users.delete",
            "description": "Delete users"
          },
          {
            "id": "perm_roles_view",
            "name": "roles.view",
            "description": "View roles"
          },
          {
            "id": "perm_roles_create",
            "name": "roles.create",
            "description": "Create roles"
          },
          {
            "id": "perm_roles_edit",
            "name": "roles.edit",
            "description": "Edit roles"
          },
          {
            "id": "perm_roles_delete",
            "name": "roles.delete",
            "description": "Delete roles"
          }
        ]
      },
      {
        "name": "Sales",
        "permissions": [
          {
            "id": "perm_sales_view",
            "name": "sales.view",
            "description": "View sales"
          },
          {
            "id": "perm_sales_create",
            "name": "sales.create",
            "description": "Create sales"
          },
          {
            "id": "perm_sales_edit",
            "name": "sales.edit",
            "description": "Edit sales"
          },
          {
            "id": "perm_sales_delete",
            "name": "sales.delete",
            "description": "Delete sales"
          },
          {
            "id": "perm_invoices_view",
            "name": "invoices.view",
            "description": "View invoices"
          },
          {
            "id": "perm_invoices_create",
            "name": "invoices.create",
            "description": "Create invoices"
          },
          {
            "id": "perm_payments_view",
            "name": "payments.view",
            "description": "View payments"
          },
          {
            "id": "perm_payments_create",
            "name": "payments.create",
            "description": "Create payments"
          }
        ]
      }
      // Additional categories and permissions...
    ]
  }
}
```

## Error Responses

### Not Found

```json
{
  "success": false,
  "error": {
    "message": "User not found",
    "code": "NOT_FOUND"
  }
}
```

### Authentication Error

```json
{
  "success": false,
  "error": {
    "message": "Current password is incorrect",
    "code": "AUTHENTICATION_ERROR"
  }
}
```

### Validation Error

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": {
      "email": "Email already exists",
      "password": "Password must contain at least 8 characters including uppercase, lowercase, numbers and special characters"
    }
  }
}
```

### Permission Error

```json
{
  "success": false,
  "error": {
    "message": "Insufficient permissions to perform this action",
    "code": "PERMISSION_DENIED"
  }
}
```

## Implementation Notes

### Multi-tenancy Considerations

All user and role operations enforce tenant isolation:

```javascript
// Direct user query
const [users] = await connection.query(
  'SELECT * FROM users WHERE tenant_id = ?',
  [tenant_id]
);

// Joined queries for roles and permissions
const [roleUsers] = await connection.query(`
  SELECT u.id, u.first_name, u.last_name, u.email 
  FROM users u
  JOIN roles r ON u.role_id = r.id
  WHERE r.id = ? AND u.tenant_id = ?
`, [roleId, tenant_id]);
```

### Password Security

Passwords are securely handled throughout the system:

1. All passwords are hashed using bcrypt with appropriate salt rounds
2. Password complexity requirements are enforced
3. Password history is maintained to prevent reuse
4. Failed login attempts are tracked and can trigger account lockouts
5. Passwords are never stored or transmitted in plaintext

### Permission Hierarchy

The permission system supports several patterns:

1. Wildcard permissions (e.g., `inventory.*`)
2. Granular permissions (e.g., `inventory.view`, `inventory.edit`)
3. Resource-specific permissions (e.g., `reports.sales.view`)

### Audit Trail

User and role changes are tracked for compliance and security:

1. All user creation, modification, and status changes are logged
2. All role changes are logged, including permission changes
3. Login attempts (successful and failed) are recorded
4. Password changes and resets are tracked

### System Roles

Some roles are system-defined and have special protections:

1. Administrator: Full system access, cannot be deleted
2. Tenant Owner: Special role for the tenant creator
3. Read Only: View-only access for auditing purposes

### Security Best Practices

The API follows security best practices:

1. JWT tokens are used for authentication with appropriate expiration
2. Role-based access control (RBAC) is enforced for all operations
3. Input validation is performed for all user inputs
4. Rate limiting is applied to sensitive endpoints
5. Security headers are set on all responses
