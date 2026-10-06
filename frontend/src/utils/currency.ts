/**
 * Currency formatting utilities
 * This file provides a consistent way to format currency values across the application.
 * It re-exports the formatCurrency function from formatBridge.ts for backward compatibility.
 */

import { formatCurrency as bridgeFormatCurrency } from './formatBridge';

/**
 * Format a number as currency using the store's currency settings
 * 
 * @param value - The numeric value to format
 * @param currencyCode - Optional currency code (defaults to store setting)
 * @returns A formatted currency string
 */
export const formatCurrency = (value: number | null | undefined, currencyCode?: string): string => {
  // Handle null/undefined values
  if (value === null || value === undefined) {
    return bridgeFormatCurrency(0, currencyCode);
  }
  
  return bridgeFormatCurrency(value, currencyCode);
};

/**
 * Parse a currency string or number into a numeric value
 * Handles various formats including those with currency symbols
 * 
 * @param value - The currency string or number to parse
 * @returns A numeric value, or 0 if parsing fails
 */
export const parseCurrency = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  
  // If it's already a number, return it
  if (typeof value === 'number') return value;
  
  // If it's a string, try to parse it
  if (typeof value === 'string') {
    // Remove currency symbols, commas, and other non-numeric characters except decimal point
    const cleanValue = value.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
};
