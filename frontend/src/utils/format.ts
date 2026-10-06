/**
 * Format a number as currency
 */
export const formatCurrency = (value: number, currencyCode: string = 'USD'): string => {
  // Ensure currencyCode is a valid string, fallback to USD if it's empty or invalid
  // Intl.NumberFormat will throw an error for invalid currency codes.
  // A more robust solution might involve validating the currencyCode against a list of known codes.
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

/**
 * Format a date string to a readable format
 */
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

/**
 * Shorten a string if it's longer than maxLength
 */
export const truncateString = (str: string, maxLength: number): string => {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
};