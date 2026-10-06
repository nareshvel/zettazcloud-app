/**
 * This file serves as a bridge between the old formatting utilities and the new localization system.
 * It maintains the same API as the old utils/format.ts, but internally uses the new localization utilities.
 * This allows for a gradual migration to the new system without breaking existing components.
 */

import { useCurrency, useDateFormatting } from '@/contexts/LocalizationContext';

// Create a formatCurrency function that can be called without React hooks
// This is used as a fallback in non-React contexts or when hooks aren't available
export const formatCurrency = (value: number, currencyCode: string = 'USD'): string => {
  // Ensure currencyCode is a valid string, fallback to USD if it's empty or invalid
  const effectiveCurrencyCode = currencyCode && currencyCode.trim() !== "" ? currencyCode : 'USD';

  try {
    return new Intl.NumberFormat('en-US', { // Using 'en-US' for number formatting, currency symbol will vary
      style: 'currency',
      currency: effectiveCurrencyCode,
      minimumFractionDigits: 2
    }).format(value);
  } catch (error) {
    console.error(`Error formatting currency with code ${effectiveCurrencyCode}:`, error);
    // Fallback to USD if the provided currencyCode causes an error
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  }
};

// Format a date string to a readable format
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// Shorten a string if it's longer than maxLength
export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
};

// Hook version that uses the new localization system
export const useFormattingBridge = () => {
  const { formatCurrency: newFormatCurrency } = useCurrency();
  const { formatDate: newFormatDate } = useDateFormatting();
  
  // These functions have the same signatures as the old ones but use the new system
  const bridgeFormatCurrency = (value: number, _currencyCode?: string) => {
    return newFormatCurrency(value);
  };
  
  const bridgeFormatDate = (dateString: string) => {
    return newFormatDate(new Date(dateString), 'MMM d, yyyy h:mm a');
  };
  
  return {
    formatCurrency: bridgeFormatCurrency,
    formatDate: bridgeFormatDate,
    truncateString
  };
};
