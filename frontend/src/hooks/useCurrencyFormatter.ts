import { useCurrency } from '@/contexts/CurrencyContext';

/**
 * Custom hook for currency formatting that automatically uses the store's currency settings
 * 
 * This is a thin wrapper around useCurrency() for backward compatibility
 * 
 * @returns Object containing formatting functions and currency information
 */
export function useCurrencyFormatter() {
  // Use the CurrencyContext
  const { formatCurrency, currencyDetails, currencyCode } = useCurrency();
  
  return {
    format: formatCurrency,
    currencyDetails,
    currencyCode
  };
}
