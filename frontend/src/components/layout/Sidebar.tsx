import { useState, useMemo, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate, matchPath } from 'react-router-dom';
import { useI18n } from '../../hooks/useI18n';
import packageJson from '../../../package.json';
import { 
  LucideIcon, 
  ShoppingCart, 
  LayoutDashboard, 
  Package, 
  BarChart3, 
  Settings,
  Settings2,
  Store,
  Warehouse,
  X, 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Printer, 
  Archive,
  Users, 
  Building,
  PlusCircle,
  Tag,
  RefreshCcw,
  Wrench,
  Coins,
  Boxes,
  ScanBarcode,
  Contact,
  FileStack,
  CalendarClock,
  PiggyBank,
  Gem,
  Wallet,
  Receipt,
  HandCoins,
  Landmark,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import { useIndustry } from '@/hooks/useIndustry';
import { SALES_HUB_INDUSTRIES } from '@/utils/salesHubIndustries';

interface SidebarProps {
  className?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  /** Controlled mobile drawer state — when provided, overrides internal state. */
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

interface NavigationItemRaw {
  nameKey: string;
  icon: LucideIcon;
  path: string;
  children?: NavigationItemRaw[];
  roles?: string[];
  permissions?: string[];
  industries?: string[];
  excludeIndustries?: string[];
}

interface NavigationSectionRaw {
  titleKey?: string;
  icon?: LucideIcon;
  roles?: string[];
  permissions?: string[];
  items: NavigationItemRaw[];
}

interface NavigationItem {
  name: string;
  icon: LucideIcon;
  path: string;
  children?: NavigationItem[];
  roles?: string[];
  permissions?: string[];
  industries?: string[];
  excludeIndustries?: string[];
}

interface NavigationSection {
  title?: string;
  icon?: LucideIcon;
  roles?: string[];
  permissions?: string[];
  items: NavigationItem[];
}

/**
 * English fallbacks for every nav/section label.
 *
 * The menu used to render nothing until i18n reported `ready`. If the
 * translation bundle was still loading — or momentarily re-resolved after the
 * tab had been idle/backgrounded — the whole sidebar went blank until a manual
 * refresh. Labels now always resolve to readable text, so the menu can never
 * disappear because of i18n state.
 */
const NAV_FALLBACK: Record<string, string> = {
  dashboard: 'Dashboard', pos: 'POS Screen', sales_hub: 'Sales Hub', orders: 'Sales Orders', promotions: 'Promotional Offers',
  sales_return: 'Sales Return', customers: 'Customers', repairs: 'Repairs', old_gold: 'Old Gold',
  layaways: 'Layaway', savings_schemes: 'Savings Schemes', products: 'Products',
  serialized_stock: 'Serialized Stock', cycle_count: 'Cycle Count', stock_count: 'Stock Count', suppliers: 'Suppliers',
  purchase_orders: 'Purchase Orders', goods_receiving: 'Goods Receiving',
  memos: 'Memo & Consignment', metal_rates: 'Metal Rates',
  catalog_channels: 'Sales Channels', reports: 'Reports', settings: 'Settings',
  team: 'Team & Access', print_jobs: 'Print Jobs', print_templates: 'Print Templates',
  sales_management: 'Sales Management', services: 'Services',
  expenses: 'Expenses', payments: 'Payments', accounts: 'Money Accounts', ledger: 'Ledger', procurement: 'Procurement',
};

const SECTION_FALLBACK: Record<string, string> = {
  dashboard: 'Dashboard', sales_operations: 'Sales Operations', inventory: 'Inventory',
  finance: 'Finance', reports: 'Reports', administration: 'Administration',
};

// Static route and gating configuration. Labels are applied at render time so
// translations and the i18n language are the only per-render variables here.
const NAV_TREE: NavigationSectionRaw[] = [
  {
    icon: LayoutDashboard,
    items: [
      { nameKey: 'dashboard', icon: LayoutDashboard, path: '/admin', permissions: ['dashboard.view'] },
    ],
  },
  {
    titleKey: 'sales_operations',
    icon: Store,
    permissions: ['sales.view', 'sales.return', 'customers.view', 'sales.create'],
    items: [
      { nameKey: 'sales_hub', icon: Gem, path: '/sales-hub', permissions: ['sales.create'], industries: [...SALES_HUB_INDUSTRIES] },
      { nameKey: 'pos', icon: ShoppingCart, path: '/pos', permissions: ['sales.create'], excludeIndustries: [...SALES_HUB_INDUSTRIES] },
      {
        nameKey: 'sales_management',
        icon: ClipboardList,
        path: '/sales-operations/sales-management',
        permissions: ['sales.view', 'sales.return', 'customers.view', 'sales.create'],
        children: [
          { nameKey: 'customers', icon: Users, path: '/customers', permissions: ['customers.view'] },
          { nameKey: 'orders', icon: ClipboardList, path: '/orders', permissions: ['sales.view'], excludeIndustries: [...SALES_HUB_INDUSTRIES] },
          { nameKey: 'sales_return', icon: RefreshCcw, path: '/sales-return', permissions: ['sales.return'], excludeIndustries: [...SALES_HUB_INDUSTRIES] },
          { nameKey: 'promotions', icon: Tag, path: '/promotions', permissions: ['sales.view'] },
        ],
      },
      {
        nameKey: 'services',
        icon: Wrench,
        path: '/sales-operations/services',
        permissions: ['sales.view', 'inventory.view'],
        children: [
          { nameKey: 'repairs', icon: Wrench, path: '/repairs', permissions: ['sales.view'], industries: ['jewelry', 'electronics'], excludeIndustries: [...SALES_HUB_INDUSTRIES] },
          { nameKey: 'old_gold', icon: Coins, path: '/old-gold', permissions: ['sales.view'], industries: ['jewelry'], excludeIndustries: ['jewelry'] },
          { nameKey: 'layaways', icon: CalendarClock, path: '/layaways', permissions: ['sales.view'], industries: ['jewelry'], excludeIndustries: ['jewelry'] },
          { nameKey: 'savings_schemes', icon: PiggyBank, path: '/savings-schemes', permissions: ['sales.view'], industries: ['jewelry'], excludeIndustries: ['jewelry'] },
          { nameKey: 'memos', icon: FileStack, path: '/memos', permissions: ['inventory.view'], excludeIndustries: [...SALES_HUB_INDUSTRIES] },
        ],
      },
    ],
  },
  {
    titleKey: 'inventory',
    icon: Warehouse,
    permissions: ['products.view', 'inventory.view'],
    items: [
      // Catalog and Stock Control used to be accordion groups with 1–2
      // children each — flattened to direct items (2026-10-10).
      { nameKey: 'products', icon: Package, path: '/products', permissions: ['products.view'] },
      { nameKey: 'serialized_stock', icon: Boxes, path: '/serialized-inventory', permissions: ['products.view'], industries: ['jewelry', 'electronics'] },
      { nameKey: 'cycle_count', icon: ScanBarcode, path: '/cycle-count', permissions: ['products.view'], industries: ['jewelry', 'electronics'] },
      { nameKey: 'stock_count', icon: ClipboardList, path: '/stock-count', permissions: ['inventory.adjust'] },
      {
        nameKey: 'procurement',
        icon: Building,
        path: '/inventory/procurement',
        permissions: ['inventory.view'],
        children: [
          { nameKey: 'suppliers', icon: Building, path: '/suppliers', permissions: ['inventory.view'] },
          { nameKey: 'purchase_orders', icon: PlusCircle, path: '/purchase-orders', permissions: ['inventory.view'] },
          { nameKey: 'goods_receiving', icon: Archive, path: '/goods-receiving', permissions: ['inventory.view'] },
        ],
      },
    ],
  },
  {
    titleKey: 'finance',
    icon: Wallet,
    permissions: ['finance.view'],
    items: [
      { nameKey: 'expenses', icon: Receipt, path: '/expenses', permissions: ['finance.view'] },
      { nameKey: 'payments', icon: HandCoins, path: '/payments', permissions: ['finance.view'] },
      { nameKey: 'accounts', icon: Landmark, path: '/accounts', permissions: ['finance.view'] },
      { nameKey: 'ledger', icon: BookOpen, path: '/ledger', permissions: ['finance.view'] },
    ],
  },
  {
    titleKey: 'reports',
    icon: BarChart3,
    permissions: ['reports.view'],
    items: [
      { nameKey: 'reports', icon: BarChart3, path: '/reports', permissions: ['reports.view'] },
    ],
  },
  {
    titleKey: 'administration',
    icon: Settings2,
    permissions: ['settings.view', 'users.view', 'employees.view'],
    items: [
      { nameKey: 'team', icon: Contact, path: '/team', permissions: ['employees.view', 'users.view'] },
      { nameKey: 'print_templates', icon: Printer, path: '/print-templates', permissions: ['settings.view'] },
      { nameKey: 'settings', icon: Settings, path: '/settings', permissions: ['settings.view'] },
    ],
  },
];

/**
 * Check whether a given route path is active. `end: false` means parent
 * routes are considered active when a child route is visited (e.g.
 * /sales-operations is active when on /orders).
 */
const isPathActive = (pathname: string, path: string): boolean => {
  return !!matchPath({ path, end: false }, pathname);
};

const Sidebar = ({ className = '', isCollapsed, onToggleCollapse, mobileOpen, onMobileOpenChange }: SidebarProps) => {
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const isMobileOpen = mobileOpen ?? internalMobileOpen;
  const setIsMobileOpen = onMobileOpenChange ?? setInternalMobileOpen;
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [openFlyoutSection, setOpenFlyoutSection] = useState<number | null>(null);
  const sectionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const { user } = useAuth();
  const { t, currentLanguage } = useI18n();
  const { industry } = useIndustry();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  /**
   * The auth context can briefly hold a null user (e.g. a re-validation after the
   * tab had been backgrounded). Permission checks would then fail for every entry
   * and the menu would render empty. Fall back to the cached user from storage so
   * the menu keeps its shape until the real user object returns.
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

  // Compute permission- and industry-filtered navigation tree, translated to
  // the current language. This is stable until user, industry, or language changes.
  const visibleNavigation = useMemo(() => {
    const tNav = (key: string) => t(`nav.${key}`, { defaultValue: NAV_FALLBACK[key] || key });
    const tSection = (key: string) => t(`sections.${key}`, { defaultValue: SECTION_FALLBACK[key] || key });

    const hasAccess = (permissions?: string[], roles?: string[]): boolean => {
      if (effectiveUser?.systemRoles?.includes('Tenant Admin')) return true;
      if (permissions && permissions.length > 0 && hasAnyPermission(effectiveUser, permissions)) return true;
      if (roles && roles.length > 0 && effectiveUser?.role && roles.includes(effectiveUser.role)) return true;
      if ((!permissions || permissions.length === 0) && (!roles || roles.length === 0)) return true;
      return false;
    };

    const isIndustryVisible = (item: NavigationItemRaw): boolean => {
      if (item.industries && (!industry || !item.industries.includes(industry))) return false;
      if (item.excludeIndustries && (!industry || item.excludeIndustries.includes(industry))) return false;
      return true;
    };

    const translateItem = (item: NavigationItemRaw): NavigationItem | null => {
      if (!hasAccess(item.permissions, item.roles)) return null;
      if (!isIndustryVisible(item)) return null;

      if (item.children && item.children.length > 0) {
        const visibleChildren = item.children
          .map(translateItem)
          .filter((child): child is NavigationItem => child !== null);
        if (visibleChildren.length === 0) return null;
        return { ...item, name: tNav(item.nameKey), children: visibleChildren };
      }

      // Leaf: `children` is undefined/empty here, but the spread still types it
      // as NavigationItemRaw[] — clear it so the result satisfies NavigationItem.
      return { ...item, name: tNav(item.nameKey), children: undefined };
    };

    return NAV_TREE.map((section) => {
      if (!hasAccess(section.permissions, section.roles)) return null;
      const items = section.items.map(translateItem).filter((item): item is NavigationItem => item !== null);
      if (items.length === 0) return null;
      return {
        ...section,
        title: section.titleKey ? tSection(section.titleKey) : undefined,
        items,
      } as NavigationSection;
    }).filter((section): section is NavigationSection => section !== null);
    // `t` is a stable function reference; `currentLanguage` is included so the
    // memo recomputes (and translated labels refresh) whenever the language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, currentLanguage, effectiveUser, industry]);

  /**
   * Auto-expand accordion groups that contain the currently active route.
   * This makes it obvious which part of the hierarchy the user is in.
   */
  useEffect(() => {
    const activeKeys: string[] = [];
    const walk = (items: NavigationItem[], prefix: string) => {
      items.forEach((item, index) => {
        const key = `${prefix}-${index}`;
        if (item.children && item.children.length > 0) {
          const childActive = item.children.some((child) => isPathActive(pathname, child.path));
          if (childActive) {
            activeKeys.push(key);
          }
          walk(item.children, key);
        }
      });
    };
    visibleNavigation.forEach((section, sIndex) => {
      walk(section.items, `s${sIndex}`);
    });

    // Keep only the most specific (deepest) active group open so only one
    // accordion is expanded at a time.
    const deepest = activeKeys.length > 0
      ? activeKeys.reduce((a, b) => (a.length >= b.length ? a : b))
      : null;
    setExpandedGroups(deepest ? { [deepest]: true } : {});
  }, [pathname, visibleNavigation]);

  /**
   * Close the collapsed-section flyout when clicking outside of it.
   */
  useEffect(() => {
    if (openFlyoutSection === null) return;
    const handleClickOutside = (event: MouseEvent) => {
      const flyoutEl = document.getElementById('sidebar-collapsed-flyout');
      if (flyoutEl && !flyoutEl.contains(event.target as Node)) {
        const clickedSection = sectionRefs.current[openFlyoutSection];
        if (clickedSection && !clickedSection.contains(event.target as Node)) {
          setOpenFlyoutSection(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFlyoutSection]);

  const toggleMobileSidebar = () => {
    setIsMobileOpen(!isMobileOpen);
  };

  const navLinkClasses = (isActive: boolean) => {
    return `flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 text-sm group ${
      isActive
        ? 'bg-blue-600 text-white font-semibold shadow-sm'
        : 'text-gray-300 hover:bg-white/5 hover:text-white'
    }`;
  };

  const iconClasses = (isActive: boolean) =>
    `transition-colors duration-200 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'}`;

  const groupHeaderIconClasses = (isActive: boolean, isOpen: boolean) =>
    `transition-colors duration-200 ${isActive || isOpen ? 'text-white' : 'text-gray-400 group-hover:text-white'}`;

  const groupHeaderClasses = (isActive: boolean, isOpen: boolean) =>
    `w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl transition-all duration-200 text-sm group ${
      isActive || isOpen
        ? 'bg-white/5 text-white font-semibold'
        : 'text-gray-300 hover:bg-white/5 hover:text-white'
    }`;

  const sectionIconClasses = (isOpen: boolean) =>
    `transition-colors duration-200 ${isOpen ? 'text-white' : 'text-gray-400 group-hover:text-white'}`;

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const isOpen = !!prev[key];
      if (isOpen) {
        return { ...prev, [key]: false };
      }
      // Open the clicked group and collapse all others (single accordion).
      const next: Record<string, boolean> = {};
      Object.keys(prev).forEach((k) => { next[k] = false; });
      next[key] = true;
      return next;
    });
  };

  const handleSectionClick = (section: NavigationSection, sectionIndex: number) => {
    if (!isCollapsed) return;
    // Single-item sections (e.g. Dashboard) navigate directly when collapsed.
    if (section.items.length === 1 && !section.items[0].children) {
      navigate(section.items[0].path);
      setOpenFlyoutSection(null);
      return;
    }
    setOpenFlyoutSection((prev) => (prev === sectionIndex ? null : sectionIndex));
  };

  const isGroupActive = (item: NavigationItem): boolean => {
    if (!item.children) return false;
    return item.children.some((child) => isPathActive(pathname, child.path));
  };

  const renderLeafItem = (item: NavigationItem, depth: number = 0, key: string) => {
    const IconComponent = item.icon;
    const indentClass = depth > 0 ? 'pl-9' : '';
    return (
      <NavLink
        key={key}
        to={item.path}
        className={({ isActive }: { isActive: boolean }) => `${navLinkClasses(isActive)} ${indentClass}`}
        title={item.name}
        onClick={() => {
          setIsMobileOpen(false);
          setOpenFlyoutSection(null);
        }}
      >
        {({ isActive }: { isActive: boolean }) => (
          <>
            <IconComponent size={18} className={iconClasses(isActive)} />
            <span>{item.name}</span>
          </>
        )}
      </NavLink>
    );
  };

  const renderGroup = (item: NavigationItem, key: string, depth: number = 0) => {
    const isExpanded = !!expandedGroups[key];
    const active = isGroupActive(item) || isPathActive(pathname, item.path);
    const IconComponent = item.icon;

    return (
      <div key={key} className="space-y-0.5">
        <button
          type="button"
          onClick={() => toggleGroup(key)}
          className={groupHeaderClasses(active, isExpanded)}
          aria-expanded={isExpanded}
        >
          <span className="flex items-center gap-3">
            <IconComponent size={18} className={groupHeaderIconClasses(active, isExpanded)} />
            <span>{item.name}</span>
          </span>
          <span className="text-gray-500">
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </button>
        {isExpanded && item.children && (
          <div className="space-y-0.5 py-1">
            {item.children.map((child, index) => {
              const childKey = `${key}-${index}`;
              if (child.children && child.children.length > 0) {
                return (
                  <div key={childKey} className="pl-3">
                    {renderGroup(child, childKey, depth + 1)}
                  </div>
                );
              }
              return renderLeafItem(child, depth + 1, childKey);
            })}
          </div>
        )}
      </div>
    );
  };

  const renderSectionContent = (section: NavigationSection, sectionIndex: number) => {
    return (
      <div className="space-y-0.5">
        {section.items.map((item, index) => {
          const key = `s${sectionIndex}-${index}`;
          if (item.children && item.children.length > 0) {
            return renderGroup(item, key);
          }
          return renderLeafItem(item, 0, key);
        })}
      </div>
    );
  };

  const renderFlyoutLeaf = (item: NavigationItem, key: string) => {
    const IconComponent = item.icon;
    return (
      <NavLink
        key={key}
        to={item.path}
        className={({ isActive }: { isActive: boolean }) => navLinkClasses(isActive)}
        onClick={() => {
          setIsMobileOpen(false);
          setOpenFlyoutSection(null);
        }}
      >
        {({ isActive }: { isActive: boolean }) => (
          <>
            <IconComponent size={18} className={iconClasses(isActive)} />
            <span>{item.name}</span>
          </>
        )}
      </NavLink>
    );
  };

  const renderFlyoutContents = (items: NavigationItem[], prefix: string) => {
    return items.map((item, index) => {
      const key = `${prefix}-${index}`;
      if (item.children && item.children.length > 0) {
        return (
          <div key={key} className="space-y-0.5">
            <div className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {item.name}
            </div>
            <div className="pl-2 space-y-0.5">
              {item.children.map((child, childIndex) => {
                const childKey = `${key}-${childIndex}`;
                if (child.children && child.children.length > 0) {
                  return (
                    <div key={childKey}>
                      <div className="px-3 py-1 text-xs font-medium text-gray-400">{child.name}</div>
                      <div className="pl-2 space-y-0.5">
                        {child.children.map((grandChild, gIndex) => renderFlyoutLeaf(grandChild, `${childKey}-${gIndex}`))}
                      </div>
                    </div>
                  );
                }
                return renderFlyoutLeaf(child, childKey);
              })}
            </div>
          </div>
        );
      }
      return renderFlyoutLeaf(item, key);
    });
  };

  const flyoutSection = openFlyoutSection !== null ? visibleNavigation[openFlyoutSection] : null;

  return (
    <>
      {/* Mobile drawer is opened via the bottom-nav "More" tab (BottomNav.tsx).
          The drawer itself still needs a close control while open. */}
      {isMobileOpen && (
        <button
          className="fixed top-4 left-[19rem] z-[60] p-2 rounded-md shadow-md md:hidden focus:outline-none focus:ring-2 focus:ring-slate-400 bg-slate-700/90 text-white hover:bg-slate-600 transition-all duration-300"
          onClick={toggleMobileSidebar}
          title="Close menu"
        >
          <X size={18} />
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-3 left-3 h-[calc(100%-1.5rem)] bg-slate-900 shadow-sidebar z-50 rounded-3xl transition-transform duration-300 ease-in-out md:transition-all
          ${isCollapsed ? 'w-16' : 'w-72'} 
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${className}
        `}
      >
        {/* Sidebar Header & Desktop Toggle */} 
        <div className={`flex items-center h-16 px-5 border-b border-white/5 relative ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
          <div className={`flex items-center ${isCollapsed ? 'w-full justify-center' : ''}`}> 
            <img
              src="/images/zettaz-cloud-logo-light.png"
              alt="Zettaz Cloud Logo"
              className={`h-8 transition-all duration-300 ease-in-out block ${isCollapsed ? 'w-8' : 'w-auto'}`}
            />
          </div>
          {/* Desktop Toggle Button - styled to be on the border */} 
          <button
            onClick={() => {
              onToggleCollapse();
              setOpenFlyoutSection(null);
            }}
            className={`absolute top-1/2 -right-3 transform -translate-y-1/2 
                        w-6 h-6 bg-slate-800 border border-slate-600 rounded-full 
                        flex items-center justify-center text-gray-300 hover:text-white hover:border-slate-400 
                        focus:outline-none focus:ring-1 focus:ring-slate-400 shadow-md 
                        hidden md:flex`}
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Navigation & User/Logout Section Wrapper */} 
        <div className="h-[calc(100%-4rem)] flex flex-col justify-between">
          {/* Navigation */} 
          <nav className="p-2.5 space-y-4 overflow-y-auto flex-grow">
            {visibleNavigation.map((section, sectionIndex) => {
              const SectionIcon = section.icon;
              const isSectionOpen = openFlyoutSection === sectionIndex;
              const sectionActive = section.items.some((item) => {
                if (item.children) return item.children.some((child) => isPathActive(pathname, child.path));
                return isPathActive(pathname, item.path);
              });

              const sectionLabel = section.title || section.items[0]?.name;

              return (
                <div key={section.title || `section-${sectionIndex}`} className="space-y-1">
                  {/* Expanded section header with icon + uppercase label */}
                  {!isCollapsed && section.title && (
                    <div className="flex items-center gap-2 px-3 pt-2 pb-1">
                      {SectionIcon && <SectionIcon size={14} className="text-gray-500" />}
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {section.title}
                      </h3>
                    </div>
                  )}
                  {/* Collapsed section icon button */}
                  {isCollapsed && SectionIcon && (
                    <button
                      type="button"
                      ref={(el) => { sectionRefs.current[sectionIndex] = el; }}
                      onClick={() => handleSectionClick(section, sectionIndex)}
                      className={`w-full flex items-center justify-center p-2 rounded-2xl transition-colors ${
                        isSectionOpen || sectionActive
                          ? 'bg-white/10 text-white'
                          : 'text-gray-400 hover:bg-white/5 hover:text-white'
                      }`}
                      title={sectionLabel}
                      aria-label={sectionLabel}
                      aria-expanded={isSectionOpen}
                    >
                      <SectionIcon size={20} className={sectionIconClasses(isSectionOpen || sectionActive)} />
                    </button>
                  )}
                  {!isCollapsed && renderSectionContent(section, sectionIndex)}
                </div>
              );
            })}
          </nav>

          {/* App version footer */}
          <div className={`p-2.5 border-t border-white/5 ${isCollapsed ? 'text-center' : 'text-left'}`}>
            {!isCollapsed ? (
              <p className="text-[10px] text-gray-500">App Version: <span className="font-medium text-gray-300">{packageJson.version}</span></p>
            ) : (
              <p className="text-[10px] text-gray-500">v{packageJson.version.split('.').slice(0, 2).join('.')}</p>
            )}
          </div>
        </div>
      </aside>

      {/* Collapsed-section flyout panel */}
      {isCollapsed && flyoutSection && (
        <div
          id="sidebar-collapsed-flyout"
          className="fixed top-16 left-16 w-64 h-[calc(100%-4rem)] bg-slate-900 border-l border-white/5 shadow-sidebar z-[60] p-3 overflow-y-auto"
        >
          <div className="flex items-center gap-2 px-3 pt-1 pb-3 border-b border-white/5 mb-3">
            {flyoutSection.icon && <flyoutSection.icon size={16} className="text-gray-500" />}
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {flyoutSection.title}
            </h3>
          </div>
          <div className="space-y-1">
            {renderFlyoutContents(flyoutSection.items, `flyout-${openFlyoutSection}`)}
          </div>
        </div>
      )}

      {/* Overlay for mobile */} 
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-30 z-40 md:hidden" 
          onClick={toggleMobileSidebar}
        ></div>
      )}
    </>
  );
};

export default Sidebar;
