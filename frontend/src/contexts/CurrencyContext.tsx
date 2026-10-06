import React from 'react';

/**
 * @deprecated - Use LocalizationContext and useCurrency() hook instead
 * This file is retained only for backward compatibility
 */

import { useCurrency as useLocalizationCurrency } from './LocalizationContext';

// Create a simplified interface similar to the old one for compatibility
// Export the interface for backward compatibility consumers
export interface CurrencyContextType {
  formatCurrency: (amount: number | undefined | null, options?: any) => string;
  currencyCode: string;
  currencyDetails: any;
  currencySymbol: string;
}

// No need for a context anymore since we're just forwarding to LocalizationContext

/**
 * Custom hook for using currency formatting
 * @deprecated Use useCurrency from LocalizationContext directly
 * @returns Object with formatting functions and currency information
 */
export const useCurrency = () => {
  // Use the new localization system's currency hook directly
  const newCurrency = useLocalizationCurrency();
  
  // Return a compatible interface that mimics the old one
  return {
    formatCurrency: newCurrency.formatCurrency,
    currencyCode: newCurrency.currencyCode,
    currencySymbol: newCurrency.currencySymbol,
    currencyDetails: {
      code: newCurrency.currencyCode,
      symbol: newCurrency.currencySymbol,
      decimalPlaces: 2
    }
  };
};

/**
 * Compatibility provider component that simply passes through
 * @deprecated Use LocalizationProvider instead
 */
export const CurrencyProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  // This provider doesn't actually do anything anymore
  // We just render children directly since the real provider is LocalizationProvider
  return <>{children}</>;
};
