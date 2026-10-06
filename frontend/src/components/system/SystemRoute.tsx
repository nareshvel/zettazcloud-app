/**
 * SystemRoute — route-level guard for the /system/* console.
 *
 * Backend still enforces every permission; this guard just keeps tenant
 * users from ever rendering console chrome. A platform user is someone whose
 * JWT carries any platform.* permission or a system role (NULL-tenant role
 * resolved into `systemRoles`).
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';

export const isPlatformUser = (user: { permissions?: string[]; systemRoles?: string[] } | null | undefined): boolean => {
  if (!user) return false;
  if ((user.systemRoles || []).some((r) => /^system|super[ _-]?admin/i.test(String(r)))) return true;
  return (user.permissions || []).some((p) =>
    p.startsWith('platform.') || p.startsWith('tenants.') || p.startsWith('system.'));
};

const SystemRoute: React.FC<{ children: React.ReactNode; perm?: string }> = ({ children, perm }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (!isPlatformUser(user)) return <Navigate to="/dashboard" replace />;
  if (perm && !hasPermission(user, perm, { allowWildcard: false, checkAdmin: false })) {
    return <Navigate to="/system" replace />;
  }
  return <>{children}</>;
};

export default SystemRoute;
