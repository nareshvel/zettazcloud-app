import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { fetchApi } from '../services/api';
import { getAccessibleStores, AccessibleStore } from '../services/storeService';

// Import the shared Store interface from types
import { Store as StoreInterface } from '../types';

// Use the shared Store interface to ensure consistency
type Store = StoreInterface;

const getDefaultStore = (tenantId: string): Store => ({
  id: 'mock-store-id',
  tenantId,
  name: 'Mock Store',
  email: 'mock@zettaz.com',
  phone: '(555) MOCK-DATA',
  address: '123 Mock St',
  logoUrl: null,
  currencyCode: 'USD',
  currencyDecimalPlaces: 2,
  dateFormat: 'MM/DD/YYYY',
  timeFormat: 'hh:mm A',
  numberFormat: 'point_comma',
  decimalPrecision: 2,
  localeCode: 'en-US',
  languageCode: 'en',
  countryCode: 'US',
  timezone: 'UTC',
  measurementSystem: 'metric',
  allowNegativeStock: true
});

interface StoreContextProps {
  store: Store | null;
  isLoading: boolean;
  error: string | null;
  updateStore: (updatedStore: Partial<Store>) => Promise<Store>;
  refreshStore: () => Promise<void>;
  /** Stores the current user can switch into (see docs/17-migration-and-roadmap/
   * 19_Store_Creation_And_Switching.md) — Tenant Admin sees every store in the
   * tenant, everyone else only stores they hold a store-scoped role in.
   * Empty/single-entry for tenants that don't use multi-store; the "Switch
   * Store" menu in TopBar.tsx hides itself in that case. */
  accessibleStores: AccessibleStore[];
  refreshAccessibleStores: () => Promise<void>;
}

const StoreContext = createContext<StoreContextProps | undefined>(undefined);

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

/**
 * Non-throwing variant of useStore(), for components that can legitimately
 * render outside a StoreProvider — e.g. PrintAgentFleetSection, which
 * appears on the public, unauthenticated /print-agent route (App.tsx
 * registers it outside <AppProviders>/<StoreProvider> on purpose, so a
 * browser can pair the Print Agent without logging in first). Returns
 * `undefined` instead of throwing when no provider is present; callers
 * already treat `store` as possibly-null everywhere they use it.
 */
export const useOptionalStore = (): StoreContextProps | undefined => {
  return useContext(StoreContext);
};

interface StoreProviderProps {
  children: React.ReactNode;
}

export const StoreProvider: React.FC<StoreProviderProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessibleStores, setAccessibleStores] = useState<AccessibleStore[]>([]);

  const fetchAccessibleStores = async () => {
    if (!isAuthenticated || !user) {
      setAccessibleStores([]);
      return;
    }
    try {
      const stores = await getAccessibleStores();
      setAccessibleStores(Array.isArray(stores) ? stores : []);
    } catch (err) {
      // Non-fatal — the "Switch Store" / "Create Store" menu items just won't
      // render if this fails; the rest of the app is unaffected.
      console.error('[StoreContext] fetchAccessibleStores: Error fetching accessible stores:', err);
      setAccessibleStores([]);
    }
  };

  const fetchStore = async () => {
    if (!isAuthenticated || !user) {
      // logger.debug('[StoreContext] fetchStore: User not authenticated or user object not available. Aborting fetch.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    try {
      // Try to get tenantId from user object first, then fall back to localStorage
      let tenantId = user?.tenantId || '';
      
      // If tenantId is empty, try to get it from localStorage as a fallback
      if (!tenantId) {
        tenantId = localStorage.getItem('tenant_id') || '';
        if (process.env.NODE_ENV === 'development' && localStorage.getItem('debug-api') === 'true') {
          console.log('[StoreContext] fetchStore: Using tenantId from localStorage:', tenantId);
        }
      }
      
      if (!tenantId) {
        throw new Error('No tenant ID available. Cannot fetch store data.');
      }
      
      // Pass store_id too — /stores/settings has no auth middleware of its
      // own, so it can't read the active store off req.user; without this
      // it silently fell back to "first store for this tenant" (usually the
      // oldest one), so a multi-store tenant's TopBar showed the wrong
      // "Current Store" even though the Switch Store dropdown (a different,
      // properly store-scoped endpoint) had the right one checked.
      const activeStoreId = user?.storeId || localStorage.getItem('store_id') || '';
      const storeQuery = activeStoreId
        ? `/stores/settings?tenant_id=${tenantId}&store_id=${activeStoreId}`
        : `/stores/settings?tenant_id=${tenantId}`;
      const storeData = await fetchApi<Store>(storeQuery);
      
      if (storeData) {
        // logger.debug('[StoreContext] fetchStore: Store data received from API:', storeData);
        setStore(storeData);
        // Apply stored theme preference from DB (only if the user hasn't overridden it this session)
        if (storeData.theme && ['light', 'dark'].includes(storeData.theme)) {
          const sessionOverride = localStorage.getItem('zettaz-theme-override');
          if (!sessionOverride) {
            localStorage.setItem('zettaz-theme', storeData.theme);
            document.documentElement.classList.toggle('dark', storeData.theme === 'dark');
          }
        }
      } else {
        console.warn('[StoreContext] fetchStore: No store data received from API. Tenant ID might be invalid or store not set up.');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch store data';
      setError(errorMessage);
      console.error('[StoreContext] fetchStore: Error fetching store data:', errorMessage);
      const defaultStore = getDefaultStore(user.tenantId || 'default');
      // logger.debug('[StoreContext] fetchStore: Setting default store due to error:', defaultStore);
      setStore(defaultStore);
    } finally {
      // logger.debug('[StoreContext] fetchStore: Reached finally block. Setting isLoading to false.');
      setIsLoading(false);
    }
  };

  const updateStore = async (updatedStore: Partial<Store>): Promise<Store> => {
    if (!store) {
      throw new Error('No store data loaded');
    }

    try {
      // Ensure we include the store ID and tenant ID in the update
      const storeUpdate = { 
        id: store.id, 
        tenantId: store.tenantId,
        ...updatedStore 
      };
      
      try {
        // Get tenantId from store, or fall back to localStorage
        let tenantId = store.tenantId || localStorage.getItem('tenant_id') || '';
        
        if (!tenantId) {
          throw new Error('No tenant ID available. Cannot update store data.');
        }
        
        // Attempt the database update with tenant_id as query parameter
        const updated = await fetchApi<Store>(`/stores/settings?tenant_id=${tenantId}`, {
          method: 'PATCH',
          body: JSON.stringify(storeUpdate),
          headers: { 'Content-Type': 'application/json' }
        });
        setStore(updated);
        return updated;
      } catch (updateError) {
        /*
         * RETHROW. This used to swallow the error, write the new values into
         * local state and return them as if the save had succeeded.
         *
         * The screen then showed exactly what the user typed — store name,
         * address, tax number — while the database still held the old values.
         * Nothing looked wrong until the next reload, by which point the change
         * had been "saved" minutes or days earlier and the user had no reason
         * to doubt it.
         *
         * Optimistic local state is a reasonable pattern when the caller is
         * told the write failed and can retry or roll back. Doing it silently
         * is not: it converts a visible failure into a wrong record.
         */
        const message = updateError instanceof Error
          ? updateError.message
          : 'Failed to save store settings';
        setError(message);
        throw updateError;
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update store settings';
      setError(errorMessage);
      throw err;
    }
  };

  const refreshStore = async () => {
    await fetchStore();
  };

  useEffect(() => {
    // logger.debug(`[StoreContext] useEffect for fetchStore: isAuthenticated: ${isAuthenticated}, user exists: ${!!user}`);
    if (isAuthenticated && user) {
      fetchStore();
      fetchAccessibleStores();
    } else {
      // If not authenticated or no user, ensure loading is false and store is null
      // This handles cases where auth state changes to unauthenticated
      // logger.debug('[StoreContext] useEffect for fetchStore: Conditions not met (not authenticated or no user). Ensuring store is null and not loading.');
      setStore(null);
      setIsLoading(false);
      setAccessibleStores([]);
    }
  }, [isAuthenticated, user]);

  const value = useMemo(() => ({
    store,
    isLoading,
    error,
    updateStore,
    refreshStore,
    accessibleStores,
    refreshAccessibleStores: fetchAccessibleStores,
  }), [store, isLoading, error, accessibleStores]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};
