/**
 * RBAC Permission Utilities
 * 
 * This file contains helper functions for checking user permissions
 * in the frontend using the RBAC system.
 */
import { User } from '@/types';

/**
 * Check if a user has a specific permission
 * 
 * @param user - User object with permissions
 * @param permission - Permission string to check
 * @param options - Optional configuration
 * @returns boolean - Whether the user has the permission
 */
export const hasPermission = (
  user: User | null | undefined, 
  permission: string,
  options: { 
    allowWildcard?: boolean,  // Whether to consider wildcard permissions
    checkAdmin?: boolean      // Whether to grant access to tenant admins
  } = { allowWildcard: true, checkAdmin: true }
): boolean => {
  // No user, no permission
  if (!user) return false;
  
  // System admin or tenant admin bypass (if checkAdmin option is enabled)
  if (options.checkAdmin) {
    // Normalize potential role locations
    const sysRoles = (user.systemRoles || []).map(r => String(r).toLowerCase().trim());
    const roles = (user.roles || []).map(r => String(r).toLowerCase().trim());
    const singleRole = (user as any).role ? String((user as any).role).toLowerCase().trim() : '';
    const allRoles = new Set<string>([...sysRoles, ...roles, singleRole].filter(Boolean));
    const adminAliases = new Set(['tenant_admin', 'tenant admin', 'admin']);
    for (const r of allRoles) {
      if (adminAliases.has(r)) {
        return true;
      }
    }
  }
  
  // Direct permission check
  if (user.permissions?.includes(permission)) {
    return true;
  }
  
  // Check for wildcard permissions if option is enabled
  if (options.allowWildcard && user.permissions) {
    // Check for exact wildcards like '*'
    if (user.permissions.includes('*')) {
      return true;
    }
    
    // Check for category wildcards like 'products.*'
    const permissionParts = permission.split('.');
    if (permissionParts.length > 1) {
      const categoryWildcard = `${permissionParts[0]}.*`;
      if (user.permissions.includes(categoryWildcard)) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Check if user has any of the specified permissions
 * 
 * @param user - User object with permissions
 * @param permissions - Array of permission strings to check
 * @param options - Optional configuration
 * @returns boolean - Whether the user has any of the permissions
 */
export const hasAnyPermission = (
  user: User | null | undefined, 
  permissions: string[],
  options = { allowWildcard: true, checkAdmin: true }
): boolean => {
  if (!user || !permissions.length) return false;
  return permissions.some(permission => hasPermission(user, permission, options));
};

/**
 * Check if user has all of the specified permissions
 * 
 * @param user - User object with permissions
 * @param permissions - Array of permission strings to check
 * @param options - Optional configuration
 * @returns boolean - Whether the user has all the permissions
 */
export const hasAllPermissions = (
  user: User | null | undefined, 
  permissions: string[],
  options = { allowWildcard: true, checkAdmin: true }
): boolean => {
  if (!user || !permissions.length) return false;
  return permissions.every(permission => hasPermission(user, permission, options));
};

/**
 * Is this user an admin/office user, as opposed to a sales-floor user?
 *
 * Mirrors Login.tsx's `getRedirectPath` `isAdminUser` check EXACTLY — that
 * function is what decides whether a user lands on the admin dashboard or
 * on Sales Hub/POS at login, so it's the codebase's real, load-bearing
 * definition of "admin" for this purpose.
 *
 * IMPORTANT: this is NOT the same question as "does this user hold the
 * `dashboard.view` permission." Both the baseline RBAC seed and the demo
 * tenant seeds deliberately grant `dashboard.view` to the Cashier role
 * (database/seeds/applied/2025-06-18_rbac_seed_data.sql and
 * 2026-08-15_diamond_republic_antigua_seed.sql) — presumably for some
 * narrower read-only widget, not as permission to navigate to the full
 * admin dashboard route. A cashier legitimately holding `dashboard.view`
 * means gating a "back to Dashboard" shortcut on that permission does
 * nothing: every cashier has it by design. Any UI element offering
 * navigation OUT of a sales-floor screen (Sales Hub, POS) and INTO the
 * admin dashboard must use `isAdminUser`, not `hasPermission(user,
 * 'dashboard.view')`.
 */
export const isAdminUser = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return (
    (user as any).role === 'tenant_admin' ||
    user.systemRoles?.includes('admin') ||
    user.permissions?.some((p) => p.startsWith('system.')) ||
    user.permissions?.some((p) => p.startsWith('tenant.')) ||
    Boolean(user.systemRoles?.includes('Tenant Admin'))
  );
};

/**
 * Legacy compatibility helper to map roles to permissions
 * This helps during the transition from role-based to permission-based access
 * 
 * @param role - Legacy role string
 * @returns string[] - Array of equivalent permissions
 */
export const mapRoleToPermissions = (role: string | undefined): string[] => {
  if (!role) return [];
  
  const lowerRole = role.toLowerCase();
  
  switch (lowerRole) {
    case 'tenant_admin':
      return ['*']; // Admin has all permissions
    case 'manager':
      return [
        'products.*',
        'inventory.*', 
        'sales.view', 
        'sales.create',
        'customers.*',
        'reports.view'
      ];
    case 'cashier':
      return [
        'products.view',
        'sales.view', 
        'sales.create'
      ];
    default:
      return [];
  }
};
