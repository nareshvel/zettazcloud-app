import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/contexts/StoreContext';
import { normalizeImageUrl } from '@/utils/imageUtils';
import { hasAnyPermission } from '@/utils/permissionUtils';
import NotificationsBell from '@/components/common/NotificationsBell';
import DutyFreeIntakeModal from './DutyFreeIntakeModal';
import ReceiptModal from '@/components/Receipt/ReceiptModal';
import { useReceipt } from '@/hooks/useReceipt';
import { getRetailProfile } from '@/services/retailProfileService';
import { usePromotionalOffersData } from '@/hooks/usePromotionalOffersData';
import { useCurrency } from '@/contexts/LocalizationContext';
import { format as formatDate } from 'date-fns';
import type { PromotionalOffer } from '@/types/discount';
import {
  searchSalesHub, getSalesHubGlance, SalesHubCustomer, SalesHubRecord, SalesHubAction,
} from '@/services/salesHubService';
import {
  ShoppingCart, PlaneTakeoff, Wrench, Coins, FileStack, CalendarClock,
  PiggyBank, ArrowUpRight, Settings as SettingsIcon, UserCircle,
  LayoutDashboard, LogOut, ClipboardList, Search, Loader2, Receipt,
  RefreshCcw, Eye, Tag, X,
} from 'lucide-react';

/**
 * Sales Hub — landing screen shown before the item grid, for every business
 * type except grocery (see utils/salesHubIndustries.ts, the single source
 * of truth for which industries get this screen at all).
 * See docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md for the original
 * bento-grid design rationale, and the 2026-08-29 session for why this was
 * rebuilt search-first: the old design mirrored the sidebar/database module
 * structure (one tile per table) rather than the actual counter workflow,
 * where almost every interaction is either "new walk-up sale" or "this
 * customer already has something going with us" — a repair, a layaway, a
 * memo, an enrollment, a past sale to return. That second category doesn't
 * need ten separate tiles each reinventing their own "find the record"
 * search; it needs ONE search that surfaces the customer's whole
 * relationship with contextual actions, which is what this screen is now.
 *
 * Layout: two hero actions for pure walk-up transactions (no existing
 * record to find) + one universal search (backend: GET /api/sales-hub/search)
 * + a small "start something new" shortcut row for the no-existing-record
 * case. All three sections are filtered by the logged-in user's actual
 * permissions — the old tile grid had no permission awareness at all.
 *
 * Fullscreen, outside `AppLayout` (same treatment as `/pos` in AppRoutes.tsx).
 *
 * CUSTOMIZING THIS PAGE BY BUSINESS TYPE — three independent knobs:
 * 1. Whether the store even reaches this route at all — controlled by
 *    `SALES_HUB_INDUSTRIES` in utils/salesHubIndustries.ts, enforced by the
 *    `<IndustryRoute>` guard around `/sales-hub` in AppRoutes.tsx.
 * 2. Whether the "Duty-free sale" hero tile shows — controlled by the
 *    store's actual `isDutyFree` flag (retail-profile, per-store), fetched
 *    below via `getRetailProfile()`. Not tied to industry at all — a
 *    jewelry store can be non-duty-free and a souvenir shop can be
 *    duty-free (e.g. airport/cruise-port locations).
 * 3. Which "Start something new" shortcuts show — each `Shortcut` below can
 *    carry an optional `industries` allowlist; shortcuts with no list are
 *    universal (Memo out, Special order, Sales return), shortcuts naming
 *    specific industries (Repair, Old gold buy, Layaway plan, Savings
 *    enrollment) only show for those industries' stores.
 */

interface Shortcut {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
  state: Record<string, unknown>;
  permissions: string[];
  /** Omit for "every Sales-Hub industry" (a universal shortcut). Set to
   * restrict this shortcut to specific industries only (e.g. jewelry-only
   * features like Old gold buy). */
  industries?: string[];
  /** When set, clicking the tile runs this instead of navigating to `path`
   * (e.g. opening an in-page modal rather than leaving the Hub). */
  onClick?: () => void;
  /** Optional count badge (e.g. "2 repairs ready") shown on the tile's icon. */
  badge?: number;
}

const GREETINGS = (hour: number) => {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const meshForHour = (hour: number): string => {
  if (hour < 12) {
    return 'radial-gradient(at 15% 10%, rgba(251,191,110,0.35) 0px, transparent 55%), ' +
      'radial-gradient(at 85% 15%, rgba(125,211,252,0.30) 0px, transparent 55%), ' +
      'radial-gradient(at 50% 100%, rgba(199,210,254,0.30) 0px, transparent 60%)';
  }
  if (hour < 17) {
    return 'radial-gradient(at 10% 15%, rgba(125,211,252,0.32) 0px, transparent 55%), ' +
      'radial-gradient(at 90% 10%, rgba(196,181,253,0.28) 0px, transparent 55%), ' +
      'radial-gradient(at 50% 100%, rgba(253,224,71,0.18) 0px, transparent 60%)';
  }
  return 'radial-gradient(at 15% 10%, rgba(129,140,248,0.32) 0px, transparent 55%), ' +
    'radial-gradient(at 85% 20%, rgba(244,114,182,0.22) 0px, transparent 55%), ' +
    'radial-gradient(at 50% 100%, rgba(56,189,248,0.20) 0px, transparent 60%)';
};

/** Where each search-result action goes, and how to hand off the record so
 * the destination page's existing quick-action search can jump straight to
 * it instead of the cashier re-typing the same query they just used here. */
const ACTION_DESTINATION: Record<SalesHubAction, { path: string; extraState?: Record<string, unknown> }> = {
  'check-in': { path: '/repairs' },
  'collect-payment': { path: '/layaways' }, // overridden per record.type below
  'redeem-credit': { path: '/old-gold' },
  'return-item': { path: '/memos', extraState: { quickActionType: 'in' } },
  'return': { path: '/sales-return' },
};

const RECORD_TYPE_PATH: Record<SalesHubRecord['type'], string> = {
  repair: '/repairs',
  'old-gold': '/old-gold',
  memo: '/memos',
  layaway: '/layaways',
  'savings-enrollment': '/savings-schemes',
  sale: '/sales-return',
};

const formatOfferType = (type: string | undefined): string => {
  if (!type) return 'Offer';
  return type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const SalesHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { store } = useStore();
  const [showDutyFreeIntake, setShowDutyFreeIntake] = useState(false);
  const [showOffers, setShowOffers] = useState(false);
  const [offersFilter, setOffersFilter] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const logoSrc = normalizeImageUrl(store?.logoUrl);

  const { data: offers, isLoading: offersLoading } = usePromotionalOffersData();
  const { formatCurrency } = useCurrency();

  const [isDutyFree, setIsDutyFree] = useState(false);
  const [storeIndustry, setStoreIndustry] = useState<string | null>(null);
  const [glance, setGlance] = useState<{ repairsReady: number; memosOverdue: number } | null>(null);
  useEffect(() => {
    getRetailProfile()
      .then((profile) => {
        setIsDutyFree(Boolean(profile.isDutyFree));
        setStoreIndustry(profile.industryCode || null);
      })
      .catch(() => {
        // Fail closed on the Duty-Free tile / shortcut filtering — better to
        // under-show than to show a tile/shortcut that doesn't apply.
      });
    getSalesHubGlance()
      .then(setGlance)
      .catch(() => {
        // Glance is a nicety — never block the page on it.
      });
  }, []);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [customers, setCustomers] = useState<SalesHubCustomer[]>([]);
  const [standaloneRecords, setStandaloneRecords] = useState<SalesHubRecord[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // View-only receipt preview for a "sale" search result — same
  // print-preview modal POSScreen/Cart use, just opened in 'view' mode so
  // nothing prints and the cashier can confirm this is the right sale
  // before tapping "Return item".
  const {
    isReceiptModalOpen,
    receiptContent,
    showReceiptForSale,
    closeReceiptModal,
    printerSettings,
  } = useReceipt();
  const [isLoadingPreview, setIsLoadingPreview] = useState<string | null>(null);

  const handleViewSale = async (record: SalesHubRecord) => {
    setIsLoadingPreview(record.id);
    try {
      await showReceiptForSale({ id: record.id }, { mode: 'view' });
    } finally {
      setIsLoadingPreview(null);
    }
  };

  useEffect(() => {
    const timerId = setInterval(() => setCurrentTime(new Date()), 1000 * 30);
    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = searchQuery.trim();
    if (q.length < 2) {
      setCustomers([]);
      setStandaloneRecords([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await searchSalesHub(q);
        setCustomers(result.customers);
        setStandaloneRecords(result.standaloneRecords);
        setSearchError(null);
      } catch (e) {
        setSearchError('Search failed. Try again.');
        setCustomers([]);
        setStandaloneRecords([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  const handleLogout = async () => {
    setIsUserMenuOpen(false);
    await logout();
    navigate('/login');
  };

  /**
   * The auth context can briefly hold a null user (e.g. a re-validation
   * after the tab has been backgrounded) — see the identical comment/fix in
   * Sidebar.tsx. Permission checks would then fail for every tile/shortcut
   * and the Hub would render as just the search bar, which is exactly the
   * bug this fixes. Fall back to the cached user from storage so the Hub
   * keeps its shape until the real user object returns.
   */
  const cachedUser = useMemo(() => {
    if (user) return user;
    try {
      const raw = localStorage.getItem('currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [user]);
  const effectiveUser = user || cachedUser;

  const displayName = effectiveUser?.first_name || effectiveUser?.name || effectiveUser?.username || 'there';
  // Gated on dashboard.view — the same gate the Sidebar's Dashboard nav
  // item uses. This permission became meaningful once migration
  // 2026-09-03_remove_dashboard_view_from_cashier_roles.sql stripped it
  // from Cashier/Sales Associate roles; before that, every cashier held
  // it and it could gate nothing (isAdminUser was the workaround). A user
  // granted dashboard.view now sees the icon; the widgets on the page
  // itself still require their own data permissions (reports.view etc.)
  // and degrade gracefully without them — see Dashboard.tsx.
  const canViewDashboard = hasAnyPermission(effectiveUser, ['dashboard.view']);
  const canSell = hasAnyPermission(effectiveUser, ['sales.create']);
  // Settings writes need stores.edit/settings.edit — hide the menu item for
  // view-only users rather than letting them hit 403s on save.
  const canManageSettings = hasAnyPermission(effectiveUser, ['settings.edit', 'stores.edit']);

  const goToRecord = (record: SalesHubRecord, presetQuery: string) => {
    const dest = ACTION_DESTINATION[record.action] || { path: RECORD_TYPE_PATH[record.type] };
    navigate(dest.path, {
      state: {
        quickAction: true,
        fromSalesHub: true,
        presetQuery,
        presetRecordId: record.id,
        ...(dest.extraState || {}),
      },
    });
  };

  const shortcuts: Shortcut[] = useMemo(() => [
    {
      key: 'repair', label: 'Repair', icon: Wrench, path: '/repairs',
      state: { quickAction: true, fromSalesHub: true }, permissions: ['sales.view'],
      industries: ['jewelry', 'electronics'],
      badge: glance?.repairsReady || undefined,
    },
    {
      key: 'old-gold', label: 'Old gold buy', icon: Coins, path: '/old-gold',
      state: { quickAction: true, fromSalesHub: true }, permissions: ['sales.view'],
      industries: ['jewelry'],
    },
    // Universal — every Sales-Hub industry.
    {
      key: 'memo-out', label: 'Memo out', icon: FileStack, path: '/memos',
      state: { quickAction: true, fromSalesHub: true, quickActionType: 'out' }, permissions: ['inventory.view'],
      badge: glance?.memosOverdue || undefined,
    },
    {
      key: 'layaway', label: 'Layaway plan', icon: CalendarClock, path: '/layaways',
      state: { quickAction: true, fromSalesHub: true }, permissions: ['sales.view'],
      industries: ['jewelry'],
    },
    {
      key: 'savings', label: 'Savings enrollment', icon: PiggyBank, path: '/savings-schemes',
      state: { quickAction: true, fromSalesHub: true }, permissions: ['sales.view'],
      industries: ['jewelry'],
    },
    // Universal — every Sales-Hub industry.
    {
      key: 'order', label: 'Special order', icon: ClipboardList, path: '/orders',
      state: { quickAction: true, fromSalesHub: true }, permissions: ['sales.view'],
    },
    // Universal — every Sales-Hub industry.
    {
      key: 'return', label: 'Sales return', icon: RefreshCcw, path: '/sales-return',
      state: { quickAction: true, fromSalesHub: true }, permissions: ['sales.return'],
    },
    // Universal — every Sales-Hub industry. Unlike the others, this doesn't
    // navigate anywhere: it opens a read-only list of current offers right
    // here (see the `onClick` override below and the modal near the bottom
    // of this component), since a cashier just needs to glance at what's
    // running, not the full offer management page (create/edit/delete),
    // which stays behind the sidebar's own Promotions nav item.
    {
      key: 'promotions', label: 'Promotions', icon: Tag, path: '', state: {},
      permissions: ['sales.view'], onClick: () => setShowOffers(true),
    },
  ], [glance]);

  const visibleShortcuts = shortcuts.filter((s) =>
    hasAnyPermission(effectiveUser, s.permissions) &&
    (!s.industries || (storeIndustry ? s.industries.includes(storeIndustry) : false))
  );
  const hasResults = customers.length > 0 || standaloneRecords.length > 0;
  const showResultsPanel = searchQuery.trim().length >= 2;

  const formatOfferDiscount = (offer: PromotionalOffer): string => {
    switch (offer.offerType) {
      case 'percentage_discount':
        return `${offer.discountValue}% off`;
      case 'fixed_discount':
        return `${formatCurrency(Number(offer.discountValue))} off`;
      case 'buy_x_get_y':
        return `Buy ${offer.minimumQuantity}, get ${offer.discountValue} free`;
      case 'bundle_price':
        return `${offer.minimumQuantity} for ${formatCurrency(Number(offer.discountValue))}`;
      case 'tiered_pricing':
        return `${offer.discountValue}% off ${offer.minimumQuantity}+`;
      default:
        return String(offer.discountValue);
    }
  };

  const allOffers = offers || [];
  const offersFilterQuery = offersFilter.trim().toLowerCase();
  const filteredOffers = offersFilterQuery
    ? allOffers.filter((o) => o.name.toLowerCase().includes(offersFilterQuery) || (o.code || '').toLowerCase().includes(offersFilterQuery))
    : allOffers;
  const activeOffers = filteredOffers.filter((o) => o.isActive);
  const inactiveOffers = filteredOffers.filter((o) => !o.isActive);
  // Only show the search box once there's actually enough to search through
  // — for a handful of offers, scrolling the (already height-capped) list
  // is faster than typing a filter.
  const showOffersSearch = allOffers.length > 8;

  return (
    <div
      className="relative flex flex-col h-screen text-foreground overflow-hidden bg-background"
      style={{ backgroundImage: meshForHour(currentTime.getHours()) }}
    >
      <main className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-5 py-6 md:px-8 md:py-8">
          {/* Identity row */}
          <div className="flex items-start justify-between gap-4 mb-8 md:mb-10">
            <div className="flex items-center gap-3 min-w-0">
              {logoSrc && !logoFailed ? (
                <img
                  src={logoSrc}
                  alt={store?.name || 'Store logo'}
                  className="h-9 w-9 rounded-xl object-cover shadow-sm shrink-0"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center shrink-0 shadow-sm">
                  <span className="text-white font-bold text-sm">
                    {(store?.name || 'Z').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground/80 truncate leading-tight">
                  {store?.name || 'Zettaz Cloud'}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' · '}
                  {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {canViewDashboard && (
                <Link
                  to="/dashboard"
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-card/70 backdrop-blur-md border border-white/40 shadow-sm hover:shadow-md transition-shadow"
                  aria-label="Dashboard"
                  title="Dashboard"
                >
                  <LayoutDashboard className="h-4 w-4 text-foreground/80" />
                </Link>
              )}
              <NotificationsBell
                buttonClassName="w-9 h-9 bg-card/70 backdrop-blur-md border border-white/40 shadow-sm hover:shadow-md"
                iconClassName="text-foreground/80"
              />
              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((v) => !v)}
                  className="flex items-center gap-2 focus:outline-none"
                  aria-label="User menu"
                >
                  <div className="w-9 h-9 rounded-full bg-card/70 backdrop-blur-md border border-white/40 shadow-sm flex items-center justify-center hover:shadow-md transition-shadow">
                    <span className="text-sm font-semibold text-primary">
                      {displayName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </button>
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-card/95 backdrop-blur-md rounded-xl shadow-xl py-1.5 z-50 border border-border overflow-hidden">
                    <div className="px-4 py-2.5 text-sm text-foreground/80 border-b border-border bg-muted/30">
                      <p className="font-semibold truncate">
                        {effectiveUser?.first_name && effectiveUser?.last_name ? `${effectiveUser.first_name} ${effectiveUser.last_name}` : displayName}
                      </p>
                      <p className="text-xs truncate text-muted-foreground">{effectiveUser?.email}</p>
                    </div>
                    {canViewDashboard && (
                      <Link
                        to="/dashboard"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <LayoutDashboard className="h-4 w-4" /> Dashboard
                      </Link>
                    )}
                    {/* Self-service — every user may view/edit their own
                        profile, regardless of role permissions */}
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                      onClick={() => setIsUserMenuOpen(false)}
                    >
                      <UserCircle className="h-4 w-4" /> My Profile
                    </Link>
                    {canManageSettings && (
                      <Link
                        to="/settings"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-accent transition-colors"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        <SettingsIcon className="h-4 w-4" /> Settings
                      </Link>
                    )}
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 text-left px-4 py-2.5 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    >
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Greeting */}
          <h1 className="text-lg md:text-xl font-semibold text-foreground tracking-tight leading-[1.1]">
            {GREETINGS(currentTime.getHours())}, {displayName}
          </h1>
          <p className="text-sm text-muted-foreground mt-2 mb-6">
            Start a transaction, or find a customer to continue something already in progress.
          </p>

          {/* Hero actions — pure walk-up transactions, no record to find */}
          {canSell && (
            <div className={`grid gap-3 mb-7 ${isDutyFree ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <button
                onClick={() => navigate('/pos', { state: { fromSalesHub: true } })}
                className="h-24 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-900 text-white flex flex-col items-start justify-between p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <ShoppingCart className="h-5 w-5" />
                <span className="font-semibold text-base">New sale</span>
              </button>
              {isDutyFree && (
                <button
                  onClick={() => setShowDutyFreeIntake(true)}
                  className="h-24 rounded-2xl bg-gradient-to-br from-primary-700 to-primary-950 text-white flex flex-col items-start justify-between p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <PlaneTakeoff className="h-5 w-5" />
                  <span className="font-semibold text-base">Duty-free sale</span>
                </button>
              )}
            </div>
          )}

          {/* Universal search */}
          <p className="text-xs font-medium text-muted-foreground mb-2">Find a customer or record</p>
          <div className="relative mb-3">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, phone, email, receipt, or ticket #…"
              className="w-full pl-11 pr-10 h-11 rounded-full border border-white/40 bg-card/70 backdrop-blur-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            {isSearching && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary/60" />
            )}
          </div>

          {showResultsPanel && (
            <div className="mb-7 space-y-2.5">
              {searchError && (
                <p className="text-sm text-destructive px-1">{searchError}</p>
              )}
              {!isSearching && !searchError && !hasResults && (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center bg-card/40">
                  <p className="text-sm text-muted-foreground">No matches for "{searchQuery}".</p>
                </div>
              )}
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  className="rounded-2xl border border-white/40 bg-card/70 backdrop-blur-md shadow-sm p-4"
                >
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary">
                        {customer.name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{customer.name || 'Walk-in'}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[customer.phone, customer.email].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  {customer.records.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-12">No open items — start a new one below.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {customer.records.map((record) => (
                        <div
                          key={`${record.type}-${record.id}`}
                          className="w-full flex items-center gap-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-colors"
                        >
                          <button
                            onClick={() => goToRecord(record, customer.name)}
                            className="flex-1 min-w-0 flex items-center justify-between gap-3 h-10 px-3 text-left"
                          >
                            <span className="text-sm text-foreground truncate">{record.label}</span>
                            <span className="text-xs font-medium text-primary shrink-0">{record.actionLabel}</span>
                          </button>
                          {record.type === 'sale' && (
                            <button
                              onClick={() => handleViewSale(record)}
                              disabled={isLoadingPreview === record.id}
                              title="View sale details"
                              aria-label="View sale details"
                              className="shrink-0 w-8 h-8 mr-1 rounded-md flex items-center justify-center text-primary hover:bg-primary/15 disabled:opacity-50 transition-colors"
                            >
                              {isLoadingPreview === record.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {standaloneRecords.map((record) => (
                <div
                  key={`standalone-${record.type}-${record.id}`}
                  className="w-full flex items-center gap-1.5 rounded-2xl border border-white/40 bg-card/70 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow"
                >
                  <button
                    onClick={() => goToRecord(record, searchQuery.trim())}
                    className="flex-1 min-w-0 flex items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Receipt className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-sm text-foreground truncate">{record.label}</span>
                    </div>
                    <span className="text-xs font-medium text-primary shrink-0">{record.actionLabel}</span>
                  </button>
                  {record.type === 'sale' && (
                    <button
                      onClick={() => handleViewSale(record)}
                      disabled={isLoadingPreview === record.id}
                      title="View sale details"
                      aria-label="View sale details"
                      className="shrink-0 w-8 h-8 mr-3 rounded-md flex items-center justify-center text-primary hover:bg-primary/10 disabled:opacity-50 transition-colors"
                    >
                      {isLoadingPreview === record.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Start something new */}
          {visibleShortcuts.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground mb-2">Start something new</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {visibleShortcuts.map(({ key, label, icon: Icon, path, state, onClick, badge }) => (
                  <button
                    key={key}
                    onClick={() => (onClick ? onClick() : navigate(path, { state }))}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-white/40 bg-card/60 backdrop-blur-md py-4 px-2 text-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <div className="relative">
                      <Icon className="h-5 w-5 text-primary" />
                      {typeof badge === 'number' && badge > 0 && (
                        <span className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
                          {badge}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-foreground leading-tight">{label}</span>
                    <ArrowUpRight className="h-3 w-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="relative z-10 shrink-0 px-5 py-3 md:px-10 text-right text-xs text-muted-foreground">
        Zettaz Cloud · Version 1.2.0
      </footer>

      {showDutyFreeIntake && (
        <DutyFreeIntakeModal onClose={() => setShowDutyFreeIntake(false)} />
      )}

      {/* Read-only current-offers list — deliberately no create/edit/delete
          actions here (those stay behind the sidebar's Promotions page for
          managers/admins). A cashier just needs a quick glance at what's
          running right now to answer a customer's question at the counter. */}
      {showOffers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg max-h-[80vh] flex flex-col rounded-2xl bg-card shadow-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Current promotions</h2>
              </div>
              <button
                onClick={() => { setShowOffers(false); setOffersFilter(''); }}
                aria-label="Close"
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {showOffersSearch && (
              <div className="px-5 pt-3 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={offersFilter}
                    onChange={(e) => setOffersFilter(e.target.value)}
                    placeholder="Search by name or code…"
                    className="w-full pl-9 pr-3 h-9 rounded-lg border border-border bg-muted/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  />
                </div>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
              {offersLoading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : allOffers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No promotional offers have been set up yet.</p>
              ) : activeOffers.length === 0 && inactiveOffers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">No offers match "{offersFilter}".</p>
              ) : (
                <>
                  {activeOffers.map((offer) => (
                    <div key={offer.id} className="rounded-xl border border-border bg-muted/30 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{offer.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatOfferType(offer.offerType)}{offer.code ? ` · Code: ${offer.code}` : ''}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                          {formatOfferDiscount(offer)}
                        </span>
                      </div>
                      {offer.endDate && (
                        <p className="text-xs text-muted-foreground mt-1.5">Ends {formatDate(new Date(offer.endDate), 'MMM d, yyyy')}</p>
                      )}
                    </div>
                  ))}
                  {inactiveOffers.length > 0 && (
                    <>
                      <p className="text-xs font-medium text-muted-foreground pt-2">Inactive</p>
                      {inactiveOffers.map((offer) => (
                        <div key={offer.id} className="rounded-xl border border-border bg-muted/10 p-3 opacity-60">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">{offer.name}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{formatOfferType(offer.offerType)}</p>
                            </div>
                            <span className="shrink-0 text-xs font-medium text-muted-foreground">{formatOfferDiscount(offer)}</span>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isReceiptModalOpen && receiptContent.html && (
        <ReceiptModal
          isOpen={isReceiptModalOpen}
          onClose={closeReceiptModal}
          receiptContent={receiptContent}
          autoPrint={false}
          printerSettings={printerSettings || undefined}
          title="Sale Details"
        />
      )}
    </div>
  );
};

export default SalesHubPage;
