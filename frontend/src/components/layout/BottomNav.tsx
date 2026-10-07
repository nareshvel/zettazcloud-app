import { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutDashboard, ClipboardList, Tag, Menu as MenuIcon,
  Plus, UserPlus, Package, PlusCircle, Archive, X, LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/hooks/useI18n';
import { useKeyboard } from '@/hooks/useKeyboard';
import { hasAnyPermission } from '@/utils/permissionUtils';

type Tab = { to: string; labelKey: string; fallback: string; icon: LucideIcon; alsoActiveOn?: string[] };
type Quick = { to: string; labelKey: string; fallback: string; icon: LucideIcon; tone: string };

/**
 * Phone-only bottom tab bar (below md, matching the sidebar's mobile
 * drawer breakpoint): Dashboard / Stock Count / "+" / Promotions / More.
 * Tabs are permission-filtered; "More" opens the full sidebar drawer and
 * always renders so the full menu is never unreachable. The raised centre
 * "+" opens a quick-actions sheet (new customer/product/PO/GRN).
 * Rendered in-flow below <main> — no fixed positioning — and hidden while
 * the on-screen keyboard is open.
 *
 * Not rendered on /pos, /sales-hub, or HubFlowShell pages: those routes
 * live outside AppLayout, so nothing special is needed to exclude them.
 */
const BottomNav = ({ onMore }: { onMore: () => void }) => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [quickOpen, setQuickOpen] = useState(false);
  const kbOpen = useKeyboard();

  // Same fallback-user trick as Sidebar: keep the bar stable while the
  // auth context briefly holds a null user during re-validation.
  const effectiveUser = useMemo(() => {
    if (user) return user;
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [user]);

  const can = (...permissions: string[]) => hasAnyPermission(effectiveUser, permissions);

  const tabs: Tab[] = [
    can('dashboard.view') && { to: '/admin', labelKey: 'nav.dashboard', fallback: 'Dashboard', icon: LayoutDashboard, alsoActiveOn: ['/', '/dashboard'] },
    can('inventory.adjust') && { to: '/stock-count', labelKey: 'nav.stock_count', fallback: 'Stock Count', icon: ClipboardList },
    can('sales.view') && { to: '/promotions', labelKey: 'nav.promotions', fallback: 'Promotions', icon: Tag },
  ].filter((tab): tab is Tab => !!tab);

  const quick: Quick[] = [
    can('customers.create') && { to: '/customers', labelKey: 'quick.new_customer', fallback: 'New Customer', icon: UserPlus, tone: 'bg-emerald-50 text-emerald-700' },
    can('products.create') && { to: '/products', labelKey: 'quick.new_product', fallback: 'New Product', icon: Package, tone: 'bg-sky-50 text-sky-700' },
    can('inventory.view') && { to: '/purchase-orders', labelKey: 'quick.new_po', fallback: 'New Purchase Order', icon: PlusCircle, tone: 'bg-amber-50 text-amber-700' },
    can('inventory.view') && { to: '/goods-receiving', labelKey: 'quick.new_grn', fallback: 'New GRN', icon: Archive, tone: 'bg-violet-50 text-violet-700' },
  ].filter((q): q is Quick => !!q);

  useEffect(() => { setQuickOpen(false); }, [location.pathname]);

  const label = (key: string, fallback: string) => t(key, { defaultValue: fallback });

  const tabEl = (tab: Tab) => {
    const extraActive = !!tab.alsoActiveOn?.includes(location.pathname);
    return (
      <NavLink
        key={tab.to}
        to={tab.to}
        className={({ isActive }) => clsx(
          'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10.5px] font-medium leading-tight',
          isActive || extraActive ? 'text-blue-700' : 'text-gray-500',
        )}
      >
        {({ isActive }) => {
          const active = isActive || extraActive;
          return (
            <>
              <span className={clsx('flex h-7 w-12 items-center justify-center rounded-full transition', active && 'bg-blue-50')}>
                <tab.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.2 : 1.8} />
              </span>
              <span className="w-full truncate px-0.5 text-center">{label(tab.labelKey, tab.fallback)}</span>
            </>
          );
        }}
      </NavLink>
    );
  };

  // "More" always renders — it is the only guaranteed path to the full menu.
  const mid = quick.length > 0 ? Math.ceil(tabs.length / 2) : tabs.length;

  return (
    <>
      <nav
        aria-label="Main"
        className={clsx(
          'shrink-0 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden',
          kbOpen && !quickOpen && 'hidden',
        )}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex h-16 max-w-md items-stretch px-1">
          {tabs.slice(0, mid).map(tabEl)}
          {quick.length > 0 && (
            <div className="flex w-16 shrink-0 items-start justify-center">
              <button
                type="button"
                onClick={() => setQuickOpen(true)}
                aria-label={label('quick.title', 'Quick actions')}
                className="-mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-lg shadow-blue-900/30 ring-4 ring-white active:scale-95"
              >
                <Plus className="h-7 w-7" />
              </button>
            </div>
          )}
          {tabs.slice(mid).map(tabEl)}
          <button
            type="button"
            onClick={onMore}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10.5px] font-medium leading-tight text-gray-500"
          >
            <span className="flex h-7 w-12 items-center justify-center rounded-full">
              <MenuIcon className="h-[22px] w-[22px]" strokeWidth={1.8} />
            </span>
            <span className="w-full truncate px-0.5 text-center">{label('nav.more', 'More')}</span>
          </button>
        </div>
      </nav>

      {/* Quick actions bottom sheet */}
      {quickOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={label('common.close', 'Close')}
            className="absolute inset-0 bg-black/40"
            onClick={() => setQuickOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white px-4 pt-2 shadow-2xl"
            style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">{label('quick.title', 'Quick actions')}</h2>
              <button type="button" onClick={() => setQuickOpen(false)} className="rounded-full p-1.5 text-gray-400" aria-label={label('common.close', 'Close')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {quick.map((q) => (
                <button
                  key={q.labelKey}
                  type="button"
                  onClick={() => { setQuickOpen(false); navigate(q.to); }}
                  className="flex flex-col items-center gap-2 rounded-xl p-2 active:bg-gray-50"
                >
                  <span className={clsx('flex h-12 w-12 items-center justify-center rounded-2xl', q.tone)}>
                    <q.icon className="h-6 w-6" />
                  </span>
                  <span className="text-center text-[11px] font-medium leading-tight text-gray-700">{label(q.labelKey, q.fallback)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BottomNav;
