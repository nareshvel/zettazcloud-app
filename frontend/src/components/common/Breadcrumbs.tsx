import React, { useSyncExternalStore } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission } from '@/utils/permissionUtils';
import {
  getBreadcrumbLabel,
  getBreadcrumbLabelsVersion,
  subscribeBreadcrumbLabels,
} from '@/utils/breadcrumbLabels';

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
  // Detail pages (e.g. /customers/:id) register a friendly label for their
  // pathname via setBreadcrumbLabel so the last crumb reads "Angela Clarke"
  // rather than a UUID. Re-render when the registry changes.
  useSyncExternalStore(subscribeBreadcrumbLabels, getBreadcrumbLabelsVersion);
  const pathnames = location.pathname.split('/').filter((x) => x);

  // This breadcrumb link pointed straight at /admin for every logged-in
  // user regardless of role. Gated on dashboard.view — meaningful since
  // migration 2026-09-03 stripped it from Cashier/Sales Associate roles,
  // and the same gate the Sidebar's Dashboard nav item already uses.
  const { user } = useAuth();
  const canViewDashboard = hasPermission(user, 'dashboard.view');

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
    const displayName =
      getBreadcrumbLabel(currentPath) ||
      NAME_MAPPING[name.toLowerCase()] ||
      name.charAt(0).toUpperCase() + name.slice(1);

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
  useSyncExternalStore(subscribeBreadcrumbLabels, getBreadcrumbLabelsVersion);
  const pathnames = location.pathname.split('/').filter((x) => x);

  if (pathnames.length === 0) return 'Dashboard';
  const override = getBreadcrumbLabel(location.pathname);
  if (override) return override;
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
