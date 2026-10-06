import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isAdminUser } from '@/utils/permissionUtils';

/**
 * Shared breadcrumb logic, extracted from TopBar.tsx (2026-08-31). TopBar renders the
 * full multi-segment trail from `md:` up, where there's room for it next to the sticky
 * row's icon cluster. Below `md:`, showing the full trail (or duplicating it a second
 * time under the page's own title, which was tried and reverted the same day — see
 * PageHeader.tsx's comment) either wraps to two lines next to the hamburger button or
 * repeats text the page's own `<h1>` already shows. `useCurrentPageLabel()` below is the
 * mobile answer instead: just the current page's own name, one line, truncated, no
 * "Dashboard >" prefix — since the hamburger menu is the actual way back to Dashboard on
 * mobile, the prefix wasn't adding navigational value there anyway.
 */
const NAME_MAPPING: Record<string, string> = {
  pos: 'POS Screen',
  products: 'Products',
  customers: 'Customers',
  reports: 'Reports',
  settings: 'Settings',
  team: 'Team',
  roles: 'Roles',
  profile: 'My Profile',
};

export function useBreadcrumbs(): React.ReactNode[] {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  // This breadcrumb link pointed straight at /admin for every logged-in
  // user regardless of role, so a sales-floor cashier landing on
  // /sales-hub (per Login.tsx's getRedirectPath) still had a live way back
  // into the admin dashboard the rest of the app deliberately keeps them
  // out of. Gated on isAdminUser — NOT dashboard.view, which both the
  // baseline and demo RBAC seeds deliberately grant to Cashier by design
  // (see isAdminUser's doc comment in permissionUtils.ts); a permission
  // check would have gated nothing here.
  const { user } = useAuth();
  const canViewDashboard = isAdminUser(user);

  if (
    pathnames.length === 0 ||
    (pathnames.length === 1 && (pathnames[0].toLowerCase() === 'admin' || pathnames[0].toLowerCase() === 'dashboard'))
  ) {
    return [
      <span key="dashboard-only" className="text-text-primary font-medium">
        Dashboard
      </span>,
    ];
  }

  const breadcrumbs: React.ReactNode[] = [
    canViewDashboard ? (
      <Link key="home" to="/admin" className="text-text-secondary hover:text-primary">
        Dashboard
      </Link>
    ) : (
      <span key="home" className="text-text-secondary">
        Dashboard
      </span>
    ),
  ];

  let currentPath = '';
  pathnames.forEach((name, index) => {
    currentPath += `/${name}`;
    const displayName = NAME_MAPPING[name.toLowerCase()] || name.charAt(0).toUpperCase() + name.slice(1);

    if ((name.toLowerCase() === 'admin' || name.toLowerCase() === 'dashboard') && index === 0) return;

    if (index < pathnames.length - 1) {
      breadcrumbs.push(<ChevronRight key={`sep-${index}`} size={18} className="mx-1 text-text-placeholder" />);
      breadcrumbs.push(
        <Link key={currentPath} to={currentPath} className="text-text-secondary hover:text-primary">
          {displayName}
        </Link>,
      );
    } else {
      breadcrumbs.push(<ChevronRight key={`sep-${index}`} size={18} className="mx-1 text-text-placeholder" />);
      breadcrumbs.push(
        <span key={currentPath} className="text-text-primary font-medium">
          {displayName}
        </span>,
      );
    }
  });

  return breadcrumbs;
}

/** Just the current page's display name — see the module comment above for why. */
export function useCurrentPageLabel(): string {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (pathnames.length === 0) return 'Dashboard';
  const last = pathnames[pathnames.length - 1].toLowerCase();
  if (last === 'admin' || last === 'dashboard') return 'Dashboard';
  return NAME_MAPPING[last] || last.charAt(0).toUpperCase() + last.slice(1);
}

interface BreadcrumbsProps {
  className?: string;
}

/**
 * Renders the trail from `useBreadcrumbs()`. Callers control visibility per breakpoint
 * via `className` (e.g. pass `sm:hidden` to show this only on mobile, where TopBar's own
 * copy is hidden).
 */
const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ className = '' }) => {
  const crumbs = useBreadcrumbs();
  return <div className={`flex items-center text-sm ${className}`}>{crumbs}</div>;
};

export default Breadcrumbs;
