import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchApi } from '@/services/api';
import { useRefresh } from './RefreshContext';
import { useAuth } from './AuthContext';

interface TaxConfig {
  default_tax_class_id?: string;
  pricesIncludeTax?: boolean;
  [key: string]: any;
}

interface TaxConfigContextType {
  taxConfig: TaxConfig | null;
  refreshTaxConfig: () => Promise<void>;
  updateTaxConfig: (newConfig: TaxConfig) => Promise<void>;
  isLoading: boolean;
  pricesIncludeTax: boolean;
}

const TaxConfigContext = createContext<TaxConfigContextType | undefined>(undefined);

export const useTaxConfig = () => {
  const context = useContext(TaxConfigContext);
  if (context === undefined) {
    throw new Error('useTaxConfig must be used within a TaxConfigProvider');
  }
  return context;
};

interface TaxConfigProviderProps {
  children: ReactNode;
}

export const TaxConfigProvider: React.FC<TaxConfigProviderProps> = ({ children }) => {
  const [taxConfig, setTaxConfig] = useState<TaxConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { refreshKey } = useRefresh();
  const { user, isAuthenticated } = useAuth();
  
  // Get token from localStorage directly when needed (fetchApi also handles auth)
  const getToken = () => localStorage.getItem('auth_token');
  
  const fetchTaxConfig = async () => {
    const token = getToken();
    if (!token) {
      setTaxConfig(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await fetchApi<any>('/api/stores/settings');
      // Support both shapes:
      // 1) Wrapped: { status: 'success', data: { ...store } }
      // 2) Direct store object: { id, tenantId, defaultTaxBasis, ... }
      const storeData = (data && data.status === 'success' && data.data)
        ? data.data
        : data;

      if (storeData) {
        // Handle both snake_case and camelCase field names
        const taxConfigData: any = storeData.tax_config || storeData.taxConfig || {};
        // Derive pricesIncludeTax from either snake_case or camelCase field
        const defaultBasis = storeData.default_tax_basis || storeData.defaultTaxBasis;
        const isTaxInclusive = String(defaultBasis || 'EXCLUSIVE').toUpperCase() === 'INCLUSIVE';
        taxConfigData.pricesIncludeTax = isTaxInclusive;
        // Normalize default tax class id to camelCase for downstream consumers
        taxConfigData.defaultTaxClassId = taxConfigData.defaultTaxClassId || taxConfigData.default_tax_class_id || storeData.default_tax_class_id;
        

        
        setTaxConfig(taxConfigData);
      } else {
        setTaxConfig({});
      }
    } catch (error) {
      console.error('Error fetching tax configuration:', error);
      setTaxConfig({});
    } finally {
      setIsLoading(false);
    }
  };

  const refreshTaxConfig = async () => {
    await fetchTaxConfig();
    // We don't need to trigger a refresh here as it would cause a loop
    // The components that need to know about tax config changes should
    // already be subscribed to the taxConfig state
  };

  const updateTaxConfig = async (newConfig: TaxConfig) => {
    const token = getToken();
    if (!token || !user) return;

    try {
      // First get the current store
      console.log('[DEBUG] Fetching current store settings');
      await fetchApi<any>('/api/stores/settings');
      console.log('[DEBUG] Received store settings');

      // Update the store with the new tax_config
      console.log('[DEBUG] Updating store tax config via /api/stores/settings');
      console.log('[DEBUG] Update payload:', JSON.stringify({ tax_config: newConfig }, null, 2));
      
      await fetchApi<void>('/api/stores/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tax_config: newConfig }),
      });

      // Update local state
      setTaxConfig(newConfig);
    } catch (error) {
      console.error('Error updating tax configuration:', error);
      throw error;
    }
  };

  // Fetch when component mounts, authentication status changes, or refreshKey changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchTaxConfig();
    } else {
      setTaxConfig(null);
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, refreshKey]);

  return (
    <TaxConfigContext.Provider value={{
      taxConfig,
      refreshTaxConfig,
      updateTaxConfig,
      isLoading,
      // Provide a convenience accessor for tax-inclusive pricing
      pricesIncludeTax: taxConfig?.pricesIncludeTax || false
    }}>
      {children}
    </TaxConfigContext.Provider>
  );
};
