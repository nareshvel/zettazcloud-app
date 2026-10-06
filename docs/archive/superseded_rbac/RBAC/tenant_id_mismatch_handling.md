# RBAC Tenant ID Mismatch Handling

## Overview

This document explains how the system handles tenant ID mismatches between user records and role assignments in the RBAC system.

## Problem Description

In multi-tenant environments, we've identified a scenario where a user may have:
- A primary `tenant_id` in their user record (e.g., `e6eb6436-4665-11f0-9c38-525400148990`)
- Role assignments with a different `tenant_id` (e.g., `d7f267da-d5d9-4a15-b0d3-31ca710a4492`)

Before the fix, this mismatch caused:
1. Empty RBAC roles in the JWT token
2. Missing permissions in frontend authorization checks
3. Users unable to access resources despite having appropriate role assignments

## Solution Implementation

As of July 2025, we modified the RBAC service to handle tenant ID mismatches by:

1. Removing tenant-based filtering in `getUserRolesAndPermissions`
   - Previously, roles were filtered to match the user's tenant ID
   - Now, all roles assigned to a user are included regardless of tenant ID

2. Maintaining distinct handling of system roles (where `tenant_id IS NULL`)

3. Adding comprehensive logging for easier debugging

4. Ensuring consistent data structure for RBAC properties in JWT tokens

## Design Rationale

This approach prioritizes user experience and role-based functionality over strict tenant separation because:

1. If a role is explicitly assigned to a user, the intention is for that user to have those permissions
2. Cross-tenant role assignments are legitimate use cases in some scenarios
3. Security is still maintained through explicit role assignments

## Best Practices for Role Assignment

When assigning roles to users:
- Prefer assigning roles matching the user's tenant ID when possible
- Use cross-tenant role assignments only when specifically needed
- Use system roles (tenant_id IS NULL) for global administrators

## Future Considerations

Future improvements could include:
- Adding explicit UI indicators when a user has cross-tenant role assignments
- Implementing tenant-switching functionality for users with multiple tenant roles
- More granular logging of cross-tenant permission usage

## Related Code

The implementation spans several files:
- `backend/services/rbacService.js`: Core implementation of role retrieval
- `backend/middleware/unifiedAuthMiddleware.js`: JWT token generation
- `backend/middleware/jwtMiddleware.js`: JWT token consumption
