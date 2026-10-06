/**
 * Currency formatting utilities
 * 
 * This module provides functions for formatting currency values according to locale preferences
 * and obtaining currency symbols and details.
 */

export interface CurrencyFormatOptions {
  style?: 'currency' | 'decimal';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
}

export interface CurrencyDetails {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
}

// Common currency details lookup
const CURRENCY_DETAILS: Record<string, CurrencyDetails> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimalPlaces: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimalPlaces: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimalPlaces: 2 },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimalPlaces: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimalPlaces: 0 },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimalPlaces: 2 },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', decimalPlaces: 2 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimalPlaces: 2 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', decimalPlaces: 2 },
  // Add more currencies as needed
};

/**
 * Format a number as currency according to the specified options
 * 
 * @param amount Amount to format
 * @param currencyCode ISO 4217 currency code
 * @param options Formatting options
 * @param localeCode BCP 47 language tag
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: number | null | undefined,
  currencyCode: string = 'USD',
  options?: CurrencyFormatOptions,
  localeCode: string = 'en-US',
): string {
  if (amount === null || amount === undefined) return '';
  
  try {
    const currencyDetails = getCurrencyDetails(currencyCode);
    const formatter = new Intl.NumberFormat(localeCode, {
      style: options?.style || 'currency',
      currency: currencyCode,
      minimumFractionDigits: options?.minimumFractionDigits ?? currencyDetails.decimalPlaces,
      maximumFractionDigits: options?.maximumFractionDigits ?? currencyDetails.decimalPlaces,
      useGrouping: options?.useGrouping ?? true,
    });
    
    return formatter.format(amount);
  } catch (error) {
    console.warn(`Error formatting currency: ${error}`);
    return `${currencyCode} ${amount}`;
  }
}

/**
 * Get currency symbol for a given currency code
 * 
 * @param currencyCode ISO 4217 currency code
 * @param localeCode BCP 47 language tag
 * @returns Currency symbol
 */
export function getCurrencySymbol(currencyCode: string, localeCode: string = 'en-US'): string {
  try {
    // Try to get from our predefined map first for consistency
    if (CURRENCY_DETAILS[currencyCode]) {
      return CURRENCY_DETAILS[currencyCode].symbol;
    }
    
    // Fall back to dynamic generation if not in our map
    return (0).toLocaleString(localeCode, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).replace(/\d/g, '').trim();
  } catch (error) {
    console.warn(`Error getting currency symbol: ${error}`);
    return currencyCode;
  }
}

/**
 * Get details for a currency code
 * 
 * @param currencyCode ISO 4217 currency code
 * @returns Currency details object
 */
export function getCurrencyDetails(currencyCode: string): CurrencyDetails {
  // Normalize the currency code to uppercase
  const normalizedCode = currencyCode.toUpperCase();
  
  // Return the currency details if found, or a default
  return CURRENCY_DETAILS[normalizedCode] || {
    code: normalizedCode,
    symbol: normalizedCode,
    name: `${normalizedCode} Currency`,
    decimalPlaces: 2,
  };
}

/**
 * Parse a currency string back to a number
 * 
 * @param currencyString Currency string to parse
 * @returns Parsed number or null if invalid
 */
export function parseCurrencyToNumber(currencyString: string): number | null {
  if (!currencyString) return null;
  
  try {
    // Remove currency symbols, spaces, and group separators
    const cleanedString = currencyString
      .replace(/[^\d.-]/g, '')  // Remove non-numeric characters except period and minus
      .trim();
    
    return parseFloat(cleanedString);
  } catch (error) {
    console.warn(`Error parsing currency string: ${error}`);
    return null;
  }
}
