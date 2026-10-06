import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ShoppingCart,
  Search as SearchIconLucide,
  RefreshCw,
  Clock,
  X as XIcon,
  Plus,
  Gem,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useInventory } from '../contexts/InventoryContext';
import { useCart as useCartContext } from '../contexts/CartContext';
import { useTaxConfig } from '../contexts/TaxConfigContext';
import { useIndustry } from '@/hooks/useIndustry';
import ProductGrid from '../components/pos/ProductGrid';
import Cart from '../components/pos/Cart';
import CustomerSearchSelect, { CustomerHit, mapToCustomerHit, mapCustomerHitToCustomer } from '@/components/customers/CustomerSearchSelect';
import QuickAddCustomerModal from '@/components/customers/QuickAddCustomerModal';
import HeldOrdersModal from '../components/pos/HeldOrdersModal';
import POSQuickAddModal from '../components/pos/POSQuickAddModal';
import NotificationsBell from '@/components/common/NotificationsBell';
import { Product } from '@/types';



const POSScreen = () => {
  const { user, logout } = useAuth();
  const {
    isLoading: inventoryLoading,
    error: inventoryError,
    fetchInventoryData,
    isInventoryLoaded,
  } = useInventory();
  const cartContext = useCartContext();
  const { refreshTaxConfig } = useTaxConfig();
  const { industry } = useIndustry();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCustomerSearchOpen, setIsCustomerSearchOpen] = useState(false);
  const [isQuickAddCustomerOpen, setIsQuickAddCustomerOpen] = useState(false);
  const [quickAddPrefill, setQuickAddPrefill] = useState('');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [isHeldOrdersModalOpen, setIsHeldOrdersModalOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  // Dark mode disabled (force light)

  const navigate = useNavigate();
  const location = useLocation();
  // Sales Hub tiles (New Sale / Duty-Free Sale) navigate here with this flag
  // set — the jewelry Hub is the ONLY entry point into /pos for those
  // tenants, so a completed sale should drop the cashier back on it rather
  // than leaving them stranded on a bare POS screen. Ordinary (non-Hub)
  // POS tenants never set this, so their checkout flow is unaffected.
  const fromSalesHub = Boolean((location.state as { fromSalesHub?: boolean } | null)?.fromSalesHub);

  // Refresh tax configuration when component mounts
  useEffect(() => {
    // Refresh tax config to ensure we have the latest tax basis setting
    refreshTaxConfig().then(() => {
      // Tax config has been refreshed
    }).catch(error => {
      console.error('POS: Failed to refresh tax config:', error);
    });
  }, []);


  // ADDED: Determine effective currency code
  const storeCurrency = user?.store?.currencyCode;
  const userCurrency = user?.currencyCode;
  const effectiveCurrencyCode = storeCurrency || userCurrency || 'USD';

  useEffect(() => {
    const timerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timerId);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (user && !isInventoryLoaded && !inventoryLoading) {
      fetchInventoryData();
    }
  }, [user, isInventoryLoaded, inventoryLoading, fetchInventoryData]);

  useEffect(() => {
    const noModalsOpen =
      !isCustomerSearchOpen &&
      !isQuickAddCustomerOpen &&
      !isHeldOrdersModalOpen;

    if (!inventoryLoading && !inventoryError && noModalsOpen && searchInputRef.current) {
      setTimeout(() => {
        const inputElement = searchInputRef.current;
        if (inputElement) { 
            requestAnimationFrame(() => {
              inputElement.focus({ preventScroll: false });
            });
        }
      }, 200); 
    }
  }, [inventoryLoading, inventoryError, isCustomerSearchOpen, isQuickAddCustomerOpen, isHeldOrdersModalOpen]);

  const openCustomerActionModal = useCallback(() => {
    setIsCustomerSearchOpen(true);
  }, []);

  const handleCustomerHitSelected = useCallback((hit: CustomerHit | null) => {
    if (!hit) return;
    cartContext.setSelectedCustomer(mapCustomerHitToCustomer(hit));
    setIsCustomerSearchOpen(false);
  }, [cartContext]);

  const handleQuickAddCreated = useCallback((hit: CustomerHit) => {
    handleCustomerHitSelected(hit);
    setIsQuickAddCustomerOpen(false);
  }, [handleCustomerHitSelected]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const handleOpenHeldOrdersModal = useCallback(() => {
    setIsHeldOrdersModalOpen(true);
  }, [setIsHeldOrdersModalOpen]);

  const resetSelectedCustomerAfterSale = useCallback(() => {
    cartContext.setSelectedCustomer(null);
    if (fromSalesHub) {
      navigate('/sales-hub');
    }
  }, [cartContext, fromSalesHub, navigate]);

  // Memoized handlers for Mobile Cart
  const handleMobileSelectCustomerClick = useCallback(() => {
    setIsCustomerSearchOpen(true);
    setIsMobileCartOpen(false);
  }, []);

  const handleMobileViewHeldOrders = useCallback(() => {
    handleOpenHeldOrdersModal();
    setIsMobileCartOpen(false);
  }, [handleOpenHeldOrdersModal, setIsMobileCartOpen]);

  const handleMobileCheckoutSuccess = useCallback(() => {
    resetSelectedCustomerAfterSale();
    setIsMobileCartOpen(false);
  }, [resetSelectedCustomerAfterSale, setIsMobileCartOpen]);

  return (
    // `h-dvh` (dynamic viewport height, Tailwind 3.4+) alongside the `h-screen` (100vh)
    // fallback: iOS Safari and iOS Chrome resolve `100vh` differently when their address
    // bar is showing — Safari sizes it to the visible viewport, Chrome sizes it to the
    // viewport with the address bar collapsed, which is taller than what's actually on
    // screen. With a plain `h-screen`, that mismatch pushes this column's last two flex
    // children (the mobile search/cart bar and the footer line) below the visible area
    // in Chrome, while Safari renders fine — exactly the bug reported (search box + cart
    // missing on Chrome iOS, present on Safari iOS). `h-dvh` tracks the actual visible
    // viewport in browsers that support it (all current iOS/Android browsers) and is
    // simply ignored by anything that doesn't, in which case `h-screen` (defined earlier
    // in Tailwind's generated stylesheet, so `h-dvh` wins when both apply) still applies.
    <div className="flex flex-col h-screen h-dvh bg-background text-foreground">
      {/* Header Bar */}
      <header className="bg-card/75 backdrop-blur-sm shadow-sm p-4 flex items-center justify-between sticky top-0 z-20 border-b border-border">
        {/* Left side: Logo and Screen Title */}
        <div className="flex items-center space-x-4">
          <img
            src="/images/zettaz-cloud-logo-dark.png"
            alt="Zettaz Cloud POS"
            className="h-8 block dark:hidden"
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder-logo.png'; }}
          />
          <img
            src="/images/zettaz-cloud-logo-light.png"
            alt="Zettaz Cloud POS"
            className="h-8 hidden dark:block"
            onError={(e) => { (e.target as HTMLImageElement).src = '/images/placeholder-logo.png'; }}
          />
          <div className="hidden md:flex items-center space-x-2 text-xs text-gray-600 dark:text-muted-foreground">
            <div>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div>{currentTime.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}</div>
          </div>
        </div>

        {/* Right side: Icons and User Menu */}
        <div className="flex items-center space-x-2 md:space-x-3">
          {/* Online Status & Sync Icons - Hidden on mobile */}
          <div className="hidden md:flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
            </span>
            <button
              onClick={() => { /* Logic for sync */ }}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:bg-muted focus:outline-none focus:bg-gray-100 dark:bg-muted transition-colors"
              aria-label="Sync Status"
            >
              <RefreshCw size={18} className="text-gray-600 dark:text-muted-foreground" />
            </button>
          </div>

          {/* Sales Hub - jewelry tenants only, quick way back to the Hub
              without going through Sign out. Same Gem icon as the sidebar
              entry (Sidebar.tsx) so the two stay visually paired. */}
          {industry === 'jewelry' && (
            <Link
              to="/sales-hub"
              className="hidden md:flex p-1.5 rounded-full hover:bg-gray-100 dark:bg-muted focus:outline-none focus:bg-gray-100 dark:bg-muted transition-colors"
              aria-label="Sales Hub"
              title="Back to Sales Hub"
            >
              <Gem size={20} className="text-gray-600 dark:text-muted-foreground" />
            </Link>
          )}

          {/* Notifications — real list (Print Agent pairing today, more
              sources later), not a dead placeholder button. */}
          <NotificationsBell
            className="hidden md:block"
            buttonClassName="p-1.5 hover:bg-gray-100 dark:bg-muted focus:outline-none focus:bg-gray-100 dark:bg-muted"
            iconClassName="text-gray-600 dark:text-muted-foreground"
          />

          {/* User Menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center focus:outline-none"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors">
                <span className="text-sm font-medium text-primary">
                  {user?.first_name ? user.first_name.charAt(0).toUpperCase() : (user?.username ? user.username.charAt(0).toUpperCase() : '?')}
                </span>
              </div>
            </button>
            {isUserMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-card rounded-md shadow-lg py-1 z-50 border border-border">
                <div className="px-4 py-2 text-sm text-foreground/80 border-b border-border">
                  <p className="font-medium">
                    {user?.first_name && user?.last_name 
                      ? `${user.first_name} ${user.last_name}` 
                      : user?.first_name || user?.username || 'User'}
                  </p>
                  <p className="text-xs">{user?.email || 'user@example.com'}</p>
                </div>
                
                {/* Show Dashboard link for all except cashiers */}
                {user?.role?.toLowerCase() !== 'cashier' && (
                  <Link
                    to="/dashboard"
                    className="block px-4 py-2 text-sm text-foreground hover:bg-accent"
                    onClick={(e) => {
                      e.preventDefault();
                      setIsUserMenuOpen(false);
                      // Navigate to dashboard within the authenticated app
                      navigate('/dashboard');
                    }}
                  >
                    Dashboard
                  </Link>
                )}
                
                <Link
                  to="/settings"
                  className="block px-4 py-2 text-sm text-foreground hover:bg-accent"
                  onClick={() => setIsUserMenuOpen(false)}
                >
                  Settings
                </Link>
                <div className="border-t border-border my-1"></div>
                {/* Dark mode toggle hidden until fully implemented */}
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-500 hover:text-white transition-colors duration-150"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div> {/* Closing tag for 'flex items-center space-x-2 md:space-x-3' */}
      </header> {/* Closing tag for 'header' */}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Product Area (Left/Top on Mobile) */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {inventoryLoading && !isInventoryLoaded ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : inventoryError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="bg-white dark:bg-card p-6 rounded-lg shadow-md">
                <XIcon className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-700 mb-1">Error Loading Products</h3>
                <p className="text-sm text-slate-500 mb-4">Could not load product data. Please check your connection or try refreshing.</p>
                <button 
                  onClick={() => fetchInventoryData()} 
                  className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm font-medium flex items-center mx-auto"
                >
                  <RefreshCw size={16} className="mr-2" /> Try Again
                </button>
              </div>
            </div>
          ) : isInventoryLoaded ? (
            <ProductGrid
              ref={searchInputRef}
              currencyCode={effectiveCurrencyCode}
              searchTerm={searchTerm}
              onSearchTermChange={setSearchTerm}
              onQuickAdd={() => setIsQuickAddOpen(true)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p>No products to display. Inventory might be empty or not loaded.</p>
            </div>
          )}
        </div>

        {/* Desktop Cart - always visible */}
        <div className="hidden md:block md:w-2/5 lg:w-1/3 xl:w-1/4 border-l border-gray-200 dark:border-border bg-white dark:bg-card">
          <Cart 
            selectedCustomer={cartContext.selectedCustomer} 
            onSelectCustomerClick={openCustomerActionModal} 
            onViewHeldOrders={handleOpenHeldOrdersModal} 
            onCheckoutSuccess={resetSelectedCustomerAfterSale}
          />
        </div>
      </main>

      {/* Mobile Cart - Full Screen Modal */}
      <div className="md:hidden">
        {isMobileCartOpen && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-30"
              onClick={() => setIsMobileCartOpen(false)}
            ></div>
            {/* Cart Content */}
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-card shadow-xl z-40 transform transition-transform ease-in-out duration-300 translate-x-0">
              <div className="flex flex-col h-full">
                <header className="p-4 bg-gray-100 dark:bg-muted border-b border-gray-200 dark:border-border flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-foreground">Current Order</h2>
                  <button onClick={() => setIsMobileCartOpen(false)} className="text-gray-500 dark:text-muted-foreground hover:text-gray-700 dark:text-foreground">
                    <XIcon size={24} /> {/* Corrected to use XIcon */}
                  </button>
                </header>
                <div className="flex-1 overflow-y-auto">
                  <Cart 
                    selectedCustomer={cartContext.selectedCustomer} 
                    onSelectCustomerClick={handleMobileSelectCustomerClick} 
                    onViewHeldOrders={handleMobileViewHeldOrders} 
                    onCheckoutSuccess={handleMobileCheckoutSuccess}
                  />
                </div>
              </div>
            </div>
          </>
        )} 
      </div>

      {/* Mobile Search & Cart Bar */}
      <div className="p-2 border-t bg-white dark:bg-card md:hidden flex items-center justify-between space-x-2">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIconLucide size={18} className="text-gray-400 dark:text-muted-foreground" />
          </div>
          <input
            type="text"
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-border rounded-lg focus:ring-ring focus:border-blue-500 text-sm"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={() => setIsMobileCartOpen(true)} 
          className="p-2 rounded-md hover:bg-gray-100 dark:bg-muted relative"
          aria-label="View Cart"
        >
          <ShoppingCart className="h-6 w-6 text-gray-700 dark:text-foreground" />
          {cartContext.items.length > 0 && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
              {cartContext.items.length}
            </span>
          )}
        </button>
      </div>

      {/* Mobile-only Final Footer Line */}
      <div className="md:hidden p-2 text-xs text-gray-500 dark:text-muted-foreground flex justify-between items-center border-t bg-gray-100 dark:bg-muted">
        <span>&copy; 2025 Zettaz Cloud</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-primary"></span>
          Terminal #1
        </span>
      </div>

      {/* Desktop Footer - Hidden on mobile */}
      <footer className="hidden md:flex bg-gray-100 dark:bg-muted border-t border-gray-200 dark:border-border px-4 py-2 items-center justify-between text-sm text-gray-500 dark:text-muted-foreground">
        <div className="flex items-center space-x-4">
          <span>&copy; 2025 Zettaz Cloud</span>
          <span className="hidden md:inline">Version 1.0.0</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <span className="w-1.5 h-1.5 mr-1.5 rounded-full bg-primary"></span>
            Terminal #1
          </span>
          <div className="h-4 w-px bg-gray-300 hidden md:block"></div>
          <div className="hidden md:flex items-center space-x-2">
            <Clock className="h-4 w-4" />
            <span>Last sync: {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </footer>

      {/* Customer search modal */}
      {isCustomerSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Select Customer</h3>
              <button onClick={() => setIsCustomerSearchOpen(false)} className="text-muted-foreground hover:text-foreground">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <CustomerSearchSelect
              selected={null}
              onSelect={(hit) => { handleCustomerHitSelected(hit); }}
              allowQuickAdd={true}
              onQuickAddRequested={(prefill) => {
                setQuickAddPrefill(prefill ?? '');
                setIsCustomerSearchOpen(false);
                setIsQuickAddCustomerOpen(true);
              }}
              placeholder="Search by name, phone or customer code…"
            />
          </div>
        </div>
      )}
      <QuickAddCustomerModal
        isOpen={isQuickAddCustomerOpen}
        prefillName={quickAddPrefill}
        onClose={() => setIsQuickAddCustomerOpen(false)}
        onCreated={handleQuickAddCreated}
      />
      {isHeldOrdersModalOpen && (
        <HeldOrdersModal
          isOpen={isHeldOrdersModalOpen}
          onClose={() => setIsHeldOrdersModalOpen(false)}
        />
      )}

      <POSQuickAddModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onAdd={(product: Product) => cartContext.addToCart(product)}
        tenantId={user?.tenantId ?? ''}
        storeId={user?.storeId ?? undefined}
      />
    </div>
  );
};

export default POSScreen;