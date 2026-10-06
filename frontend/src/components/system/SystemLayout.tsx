/**
 * SystemLayout — sidebar shell for the /system/* console.
 *
 * Deliberately separate from AppLayout: platform staff have no tenant
 * workspace, so the tenant sidebar (products, sales, settings…) would be
 * noise. Each nav item is hidden unless the user holds its permission —
 * backend routes enforce the same perms, this is just UX.
 */
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity, Building2, CreditCard, FileText, LifeBuoy, LogOut,
  Megaphone, Shield, ShieldCheck, Users, Wallet, LayoutDashboard,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import { cn } from '@/lib/utils';
import ImpersonationBanner from '@/components/system/ImpersonationBanner';

const NAV: Array<{ to: string; label: string; icon: typeof LayoutDashboard; perm: string }> = [
  { to: '/system',            label: 'Dashboard',     icon: LayoutDashboard, perm: 'platform.view' },
  { to: '/system/tenants',    label: 'Tenants',       icon: Building2,       perm: 'tenants.view' },
  { to: '/system/billing',    label: 'Subscriptions', icon: Wallet,          perm: 'subscriptions.view' },
  { to: '/system/plans',      label: 'Plans',         icon: CreditCard,      perm: 'plans.view' },
  { to: '/system/users',      label: 'System users',  icon: Users,           perm: 'platform.manage' },
  { to: '/system/roles',      label: 'Roles & RBAC',  icon: ShieldCheck,     perm: 'platform.manage' },
  { to: '/system/support',    label: 'Support',       icon: LifeBuoy,        perm: 'support.view' },
  { to: '/system/announcements', label: 'Announcements', icon: Megaphone,    perm: 'platform.announcements.manage' },
  { to: '/system/audit',      label: 'Audit log',     icon: FileText,        perm: 'platform.audit.view' },
  { to: '/system/health',     label: 'Health',        icon: Activity,        perm: 'platform.health.view' },
];

const SystemLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = NAV.filter((n) => hasPermission(user, n.perm, { allowWildcard: false, checkAdmin: false }));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-slate-800 bg-slate-900">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600">
            <Shield className="h-5 w-5 text-white" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Zettaz Cloud</p>
            <p className="text-[11px] text-slate-400">System console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
          {items.map(({ to, label, icon: Icon, perm }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/system'}
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
                isActive ? 'bg-primary-600 font-medium text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />{label}
            </NavLink>
          ))}
          {items.length === 0 && (
            <p className="px-3 py-4 text-xs text-slate-500">No console sections available for your role.</p>
          )}
        </nav>

        <div className="border-t border-slate-800 p-3">
          <p className="truncate px-2 pb-2 text-xs text-slate-400">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <LogOut className="h-4 w-4" />Sign out
          </button>
        </div>
      </aside>

      <div className="ml-60 flex min-h-screen flex-1 flex-col">
        <ImpersonationBanner />
        <main className="flex-1 px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SystemLayout;
