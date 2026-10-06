import React, { useState, useEffect, useRef } from 'react';
import { UserCircle, ChevronRight, LogOut, User as UserIconLucide, CreditCard, Globe, Settings as SettingsIcon, Sun, Moon, Store as StoreIcon, Plus, Check, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../hooks/useI18n';
import HelpButton from '../help/HelpButton';
import NotificationBell from './NotificationBell';
import { useTheme } from '../../contexts/ThemeContext';
import Breadcrumbs, { useCurrentPageLabel } from '../common/Breadcrumbs';
import { useOptionalStore } from '../../contexts/StoreContext';
import { switchStore } from '../../services/storeService';
import CreateStoreModal from '../stores/CreateStoreModal';

const TopBar: React.FC = () => {
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isStoreSwitchOpen, setIsStoreSwitchOpen] = useState(false);
  const [switchingStoreId, setSwitchingStoreId] = useState<string | null>(null);
  const [isCreateStoreOpen, setIsCreateStoreOpen] = useState(false);
  const { user, logout } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const langDropdownRef = useRef<HTMLDivElement>(null);
  const storeSwitchRef = useRef<HTMLDivElement>(null);
  const { t, currentLanguage, changeLanguage } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const currentPageLabel = useCurrentPageLabel();
  const storeCtx = useOptionalStore();

  const effectiveUser: any = user;
  const isTenantAdmin = !!effectiveUser?.systemRoles?.includes('Tenant Admin');
  // Same field precedence UserProfilePage.tsx uses for the same data.
  const companyName: string = effectiveUser?.tenantName || effectiveUser?.tenant?.name || '';
  const accessibleStores = storeCtx?.accessibleStores || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
      if (langDropdownRef.current && !langDropdownRef.current.contains(event.target as Node)) {
        setIsLangDropdownOpen(false);
      }
      if (storeSwitchRef.current && !storeSwitchRef.current.contains(event.target as Node)) {
        setIsStoreSwitchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setIsUserDropdownOpen(false);
  };

  const handleSwitchStore = async (storeId: string | undefined | null) => {
    if (!storeId) {
      console.error('[TopBar] handleSwitchStore called without a storeId — refusing to call the API.', new Error().stack);
      toast.error('Could not determine which store to switch to.');
      return;
    }
    if (switchingStoreId) return;
    setSwitchingStoreId(storeId);
    try {
      await switchStore(storeId);
      // switchStore() reloads the page on success — nothing further to do here.
    } catch (error: any) {
      toast.error(error?.message || 'Failed to switch store.');
      setSwitchingStoreId(null);
    }
  };

  return (
    <header className="bg-background-card shadow-topbar h-16 flex items-center justify-between sticky top-0 z-30">
      {/* Left Section: page identity. Mobile (below `md:`) shows just the current page's
          own name — one line, truncated, no "Dashboard >" prefix — in the space between
          the fixed hamburger toggle (Sidebar.tsx, `left-4`, ~34px) and the icon cluster
          on the right; `md:` and up shows the full breadcrumb trail instead, where there's
          room for it. Two earlier attempts (2026-08-31) both regressed this: showing the
          full trail here at `pl-6` wrapped to two lines next to the hamburger on phones,
          and hiding it here entirely while duplicating it under each page's own title
          just left this row blank and repeated the title a second time for no reason. */}
      <div className="flex md:hidden items-center text-sm pl-14 pr-2 min-w-0 flex-1">
        <span className="truncate font-medium text-text-primary">{currentPageLabel}</span>
      </div>
      <div className="hidden md:flex items-center text-sm pl-6">
        <Breadcrumbs />
      </div>

      {/* Right Section: Search and Actions */}
      <div className="flex items-center space-x-3 md:space-x-4">
        {/* Action Icons */}
        <NotificationBell />
        
        <HelpButton />

        {/* Theme Toggle */}
        <button
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          className="p-2 rounded-full hover:bg-primary-light text-text-secondary hover:text-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light transition-colors duration-150 ease-in-out"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <Link to="/settings"
          title="Settings" 
          className="p-2 rounded-full hover:bg-primary-light text-text-secondary hover:text-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light transition-colors duration-150 ease-in-out"
        >
          <SettingsIcon size={20} />
        </Link>

        {/* User Profile Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button 
            title="User Profile"
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            className="p-1.5 rounded-full hover:bg-primary-light text-text-secondary hover:text-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light transition-colors duration-150 ease-in-out"
          >
            <UserCircle size={24} /> 
          </button>

          {isUserDropdownOpen && (
            <div ref={dropdownRef} className="absolute right-0 mt-2 w-64 bg-card rounded-lg shadow-xl py-1 z-40 border border-border">
              {user && (
                <div className="px-4 py-3 border-b border-border">
                  <div className="flex items-center">
                    <img 
                      // Use the default SVG avatar as fallback
                      src={'/images/default-avatar.svg'} 
                      alt="User Avatar"
                      className="h-10 w-10 rounded-full mr-3"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null; // Prevent infinite loop
                        target.src = '/images/default-avatar.svg';
                      }}
                    />
                    <div>
                      <p className="text-sm font-semibold text-text-primary flex items-center">
                        {user.first_name} {user.last_name}
                        <span className="ml-1.5 px-1.5 py-0.5 text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/30 rounded-full">Pro</span> 
                      </p>
                      <p className="text-xs text-text-secondary truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="py-1">
                <Link 
                  to="/profile" 
                  className="flex items-center px-4 py-2.5 text-sm text-text-primary hover:bg-background-hover w-full text-left"
                  onClick={() => setIsUserDropdownOpen(false)} 
                >
                  <UserIconLucide size={18} className="mr-2.5 text-text-secondary" />
                  My Profile
                </Link>
                <Link 
                  to="/profile?tab=subscription"
                  className="flex items-center justify-between px-4 py-2.5 text-sm text-text-primary hover:bg-background-hover w-full text-left"
                  onClick={() => setIsUserDropdownOpen(false)} 
                >
                  <span className="flex items-center">
                    <CreditCard size={18} className="mr-2.5 text-text-secondary" />
                    My Subscription
                  </span>
                  <ChevronRight size={16} className="text-text-placeholder" />
                </Link>

                {storeCtx?.store && (
                  <>
                    <div className="border-t border-border my-1"></div>
                    <div className="px-4 py-2 text-xs font-medium text-text-secondary flex items-center">
                      <StoreIcon size={14} className="mr-2" />
                      Current Store: <span className="ml-1 text-text-primary font-semibold truncate">{storeCtx.store.name}</span>
                    </div>
                    {/* Parent company name — mostly invisible for a single-store
                        tenant, but matters once a company runs multiple,
                        differently-named/-typed stores (e.g. "Global Jewelry
                        ANU" and "Global Gifts MIA" under "Global Retail Inc") —
                        without this, the switcher below reads as an unrelated
                        flat list. */}
                    {companyName && companyName !== storeCtx.store.name && (
                      <div className="px-4 pb-1 -mt-1 text-[11px] text-text-placeholder truncate">
                        {companyName}
                      </div>
                    )}

                    {accessibleStores.length > 1 && (
                      <div className="px-4 py-2.5 text-sm text-text-primary">
                        <div className="relative" ref={storeSwitchRef}>
                          <button
                            onClick={() => setIsStoreSwitchOpen(!isStoreSwitchOpen)}
                            className="w-full flex items-center justify-between hover:bg-muted rounded-md px-2 py-1.5"
                          >
                            <span className="flex items-center">
                              <StoreIcon size={18} className="mr-2.5 text-text-secondary" />
                              Switch Store
                            </span>
                            <ChevronRight size={16} className={`transition-transform duration-200 ${isStoreSwitchOpen ? 'rotate-90' : ''}`} />
                          </button>

                          {isStoreSwitchOpen && (
                            <div className="absolute right-0 mt-1 w-full bg-card rounded-md shadow-lg py-1 z-50 border border-border text-left max-h-64 overflow-y-auto">
                              {accessibleStores.map((s) => (
                                <button
                                  key={s.id}
                                  onClick={() => handleSwitchStore(s.id)}
                                  disabled={s.isCurrent || switchingStoreId === s.id}
                                  className={`w-full flex items-center justify-between px-3 py-2 hover:bg-muted disabled:cursor-default ${s.isCurrent ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                                >
                                  <span className="truncate">{s.name}</span>
                                  {switchingStoreId === s.id ? (
                                    <Loader2 size={14} className="animate-spin shrink-0" />
                                  ) : s.isCurrent ? (
                                    <Check size={14} className="shrink-0" />
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {isTenantAdmin && (
                      <button
                        onClick={() => {
                          setIsCreateStoreOpen(true);
                          setIsUserDropdownOpen(false);
                        }}
                        className="flex items-center px-4 py-2.5 text-sm text-text-primary hover:bg-background-hover w-full text-left"
                      >
                        <Plus size={18} className="mr-2.5 text-text-secondary" />
                        Create Store
                      </button>
                    )}
                  </>
                )}

                <div className="border-t border-border my-1"></div>
                <div className="px-4 py-2.5 text-sm text-text-primary">
                  <div className="relative" ref={langDropdownRef}>
                    <button 
                      onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                      className="w-full flex items-center justify-between hover:bg-muted rounded-md px-2 py-1.5"
                    >
                      <span className="flex items-center">
                        <Globe size={18} className="mr-2.5 text-text-secondary" />
                        {t('language')}
                      </span>
                      <span className="flex items-center text-text-secondary">
                        {currentLanguage === 'en' && 'English'}
                        {currentLanguage === 'es' && 'Español'}
                        {currentLanguage === 'fr' && 'Français'}
                        {currentLanguage === 'ta' && 'தமிழ்'}
                        {currentLanguage === 'hi' && 'हिन्दी'}
                        {currentLanguage === 'te' && 'తెలుగు'}
                        <img 
                          src={`/images/flags/${currentLanguage === 'en' ? 'us' : 
                                       currentLanguage === 'ta' || currentLanguage === 'hi' ? 'in' : 
                                       currentLanguage}.svg`} 
                          alt="Selected language flag" 
                          className="h-4 w-auto ml-1.5 rounded-sm" 
                        />
                        <ChevronRight size={16} className={`ml-1 transition-transform duration-200 ${isLangDropdownOpen ? 'rotate-90' : ''}`} />
                      </span>
                    </button>
                    
                    {isLangDropdownOpen && (
                      <div className="absolute right-0 mt-1 w-full bg-card rounded-md shadow-lg py-1 z-50 border border-border text-left">
                        <button 
                          onClick={() => {
                            changeLanguage('en');
                            setIsLangDropdownOpen(false);
                          }} 
                          className={`w-full flex items-center justify-between px-3 py-2 hover:bg-muted ${currentLanguage === 'en' ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                        >
                          <span>English</span>
                          <img src="/images/flags/us.svg" alt="US Flag" className="h-4 w-auto rounded-sm" />
                        </button>
                        <button 
                          onClick={() => {
                            changeLanguage('es');
                            setIsLangDropdownOpen(false);
                          }} 
                          className={`w-full flex items-center justify-between px-3 py-2 hover:bg-muted ${currentLanguage === 'es' ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                        >
                          <span>Español</span>
                          <img src="/images/flags/es.svg" alt="Spain Flag" className="h-4 w-auto rounded-sm" />
                        </button>
                        <button 
                          onClick={() => {
                            changeLanguage('fr');
                            setIsLangDropdownOpen(false);
                          }} 
                          className={`w-full flex items-center justify-between px-3 py-2 hover:bg-muted ${currentLanguage === 'fr' ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                        >
                          <span>Français</span>
                          <img src="/images/flags/fr.svg" alt="France Flag" className="h-4 w-auto rounded-sm" />
                        </button>
                        <button 
                          onClick={() => {
                            changeLanguage('ta');
                            setIsLangDropdownOpen(false);
                          }} 
                          className={`w-full flex items-center justify-between px-3 py-2 hover:bg-muted ${currentLanguage === 'ta' ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                        >
                          <span>தமிழ்</span>
                          <img src="/images/flags/in.svg" alt="India Flag" className="h-4 w-auto rounded-sm" />
                        </button>
                        <button 
                          onClick={() => {
                            changeLanguage('hi');
                            setIsLangDropdownOpen(false);
                          }} 
                          className={`w-full flex items-center justify-between px-3 py-2 hover:bg-muted ${currentLanguage === 'hi' ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                        >
                          <span>हिन्दी</span>
                          <img src="/images/flags/in.svg" alt="India Flag" className="h-4 w-auto rounded-sm" />
                        </button>
                        <button 
                          onClick={() => {
                            changeLanguage('te');
                            setIsLangDropdownOpen(false);
                          }} 
                          className={`w-full flex items-center justify-between px-3 py-2 hover:bg-muted ${currentLanguage === 'te' ? 'bg-primary/10 text-primary' : 'text-foreground'}`}
                        >
                          <span>తెలుగు</span>
                          <img src="/images/flags/in.svg" alt="India Flag" className="h-4 w-auto rounded-sm" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="border-t border-border my-1"></div> 
                <button 
                  onClick={handleLogout} 
                  className="flex items-center px-4 py-2.5 text-sm text-text-primary hover:bg-background-hover w-full text-left"
                >
                  <LogOut size={18} className="mr-2.5 text-text-secondary" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {isCreateStoreOpen && (
        <CreateStoreModal
          onClose={() => setIsCreateStoreOpen(false)}
          onCreated={(newStoreId) => {
            setIsCreateStoreOpen(false);
            handleSwitchStore(newStoreId);
          }}
        />
      )}
    </header>
  );
};

export default TopBar;
