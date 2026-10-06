/**
 * Number formatting utilities
 * 
 * This module provides functions for formatting numbers according to locale preferences
 */

export interface NumberFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
  style?: 'decimal' | 'percent' | 'unit';
  unit?: string;
}

/**
 * Format a number according to the specified options and locale
 * 
 * @param value Number to format
 * @param options Formatting options
 * @param localeCode BCP 47 language tag
 * @returns Formatted number string
 */
export function formatNumber(
  value: number | null | undefined,
  options?: NumberFormatOptions,
  localeCode: string = 'en-US',
): string {
  if (value === null || value === undefined) return '';
  
  try {
    const formatter = new Intl.NumberFormat(localeCode, {
      minimumFractionDigits: options?.minimumFractionDigits,
      maximumFractionDigits: options?.maximumFractionDigits,
      useGrouping: options?.useGrouping ?? true,
      style: options?.style || 'decimal',
      unit: options?.unit,
    } as Intl.NumberFormatOptions);
    
    return formatter.format(value);
  } catch (error) {
    console.warn(`Error formatting number: ${error}`);
    return String(value);
  }
}

/**
 * Format a number as a percentage
 * 
 * @param value Number to format (0.1 = 10%)
 * @param options Formatting options
 * @param localeCode BCP 47 language tag
 * @returns Formatted percentage string
 */
export function formatPercent(
  value: number | null | undefined,
  options?: Omit<NumberFormatOptions, 'style' | 'unit'>,
  localeCode: string = 'en-US',
): string {
  if (value === null || value === undefined) return '';
  
  return formatNumber(value, {
    ...options,
    style: 'percent',
  }, localeCode);
}

/**
 * Parse a formatted number string back to a number
 * 
 * @param numberString Number string to parse
 * @returns Parsed number or null if invalid
 */
export function parseNumberString(numberString: string): number | null {
  if (!numberString) return null;
  
  try {
    // Remove group separators and other non-numeric characters except decimal point
    const cleanedString = numberString
      .replace(/[^\d.-]/g, '')  // Remove non-numeric characters except period and minus
      .trim();
    
    return parseFloat(cleanedString);
  } catch (error) {
    console.warn(`Error parsing number string: ${error}`);
    return null;
  }
}
