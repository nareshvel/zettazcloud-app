import { useCachedDataFetcher } from './useCachedDataFetcher';
import { getTaxClasses, getStoreTaxConfig } from '../services/api';
import type { TaxClass } from '../types';


/**
 * Interface for tax rates data
 */
type TaxRateItem = {
  id: string;
  taxClassId: string;
  taxRateName: string;
  rate: number;
  priority: number;
  isCompound: boolean;
};

interface TaxRatesData {
  taxClasses: TaxClass[];
  taxRates: TaxRateItem[];
}

/**
 * Hook for fetching and caching tax class data
 * 
 * @returns Object containing tax class data, loading state, error state, and refresh function
 */
export function useTaxClassesData() {
  const fetchTaxClassData = async (): Promise<TaxRatesData> => {
    try {
      // Fetch tax classes
      const taxClassesResponse = await getTaxClasses();
      
      // Fetch tax configuration to get rates
      const taxConfig = await getStoreTaxConfig();
      
      // Extract tax rates from config and transform them to TaxRateItem[]
      const taxRates: TaxRateItem[] = [];
      
      // Process tax rates from the tax config
      if (taxConfig && taxConfig.defaultTaxRates) {
        // Process default tax rates if available
        if (Array.isArray(taxConfig.defaultTaxRates)) {
          taxConfig.defaultTaxRates.forEach((rate) => {
            if (rate.id && typeof rate.rate === 'number') {
              taxRates.push({
                id: rate.id,
                taxClassId: rate.taxClassId || '',
                taxRateName: rate.taxRateName || 'Default',
                rate: Number(rate.rate),
                priority: rate.priority || 0,
                isCompound: Boolean(rate.isCompound)
              });
            }
          });
        }
      }
      
      return {
        taxClasses: Array.isArray(taxClassesResponse) ? taxClassesResponse : (taxClassesResponse && taxClassesResponse.data) || [],
        taxRates: taxRates
      };
    } catch (error) {
      console.error('Error fetching tax class data:', error);
      throw error;
    }
  };
  
  return useCachedDataFetcher<TaxRatesData>(
    fetchTaxClassData,
    'tax_classes',
    15 * 60 * 1000,  // 15 minutes TTL
    { taxClasses: [], taxRates: [] }
  );
}
