/**
 * Timezone Utilities
 * 
 * Provides timezone-aware date/time operations for the application.
 * All dates should be converted to the store's timezone for display and user input,
 * and converted to UTC for storage and API calls.
 * 
 * TIMEZONE COMPLIANCE GUIDELINES:
 * 1. ALWAYS use these utilities when working with dates
 * 2. NEVER use `new Date()` directly for business logic
 * 3. Store dates in UTC on the backend
 * 4. Convert to store timezone for display
 * 5. Convert user input from store timezone to UTC before sending to API
 */

import { parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime, formatInTimeZone } from 'date-fns-tz';

/**
 * Get the current date/time in the store's timezone
 * 
 * @param timezone Store's timezone (e.g., 'America/New_York', 'UTC')
 * @returns Date object representing current time in store timezone
 */
export function getNowInTimezone(timezone: string = 'UTC'): Date {
  return toZonedTime(new Date(), timezone);
}

/**
 * Convert a UTC date to the store's timezone
 * 
 * @param date UTC date (from API)
 * @param timezone Store's timezone
 * @returns Date object in store timezone
 */
export function utcToTimezone(date: Date | string, timezone: string = 'UTC'): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return toZonedTime(dateObj, timezone);
}

/**
 * Convert a date from store's timezone to UTC (for API calls)
 * 
 * @param date Date in store timezone (from user input)
 * @param timezone Store's timezone
 * @returns Date object in UTC
 */
export function timezoneToUtc(date: Date | string, timezone: string = 'UTC'): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  return fromZonedTime(dateObj, timezone);
}

/**
 * Format a date in the store's timezone
 * 
 * @param date Date to format (can be UTC or any timezone)
 * @param formatString Format pattern (e.g., 'yyyy-MM-dd', 'MMM d, yyyy')
 * @param timezone Store's timezone
 * @returns Formatted date string in store timezone
 */
export function formatInStoreTimezone(
  date: Date | string,
  formatString: string,
  timezone: string = 'UTC'
): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatInTimeZone(dateObj, timezone, formatString);
  } catch (error) {
    console.warn('Error formatting date in timezone:', error);
    return String(date);
  }
}

/**
 * Get start of day in store's timezone (00:00:00)
 * 
 * @param date Date to get start of day for
 * @param timezone Store's timezone
 * @returns Date object representing start of day in store timezone
 */
export function getStartOfDayInTimezone(date: Date | string, timezone: string = 'UTC'): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const zonedDate = toZonedTime(dateObj, timezone);
  zonedDate.setHours(0, 0, 0, 0);
  return fromZonedTime(zonedDate, timezone);
}

/**
 * Get end of day in store's timezone (23:59:59.999)
 * 
 * @param date Date to get end of day for
 * @param timezone Store's timezone
 * @returns Date object representing end of day in store timezone
 */
export function getEndOfDayInTimezone(date: Date | string, timezone: string = 'UTC'): Date {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const zonedDate = toZonedTime(dateObj, timezone);
  zonedDate.setHours(23, 59, 59, 999);
  return fromZonedTime(zonedDate, timezone);
}

/**
 * Convert a date to ISO string for API calls (always in UTC)
 * Handles timezone conversion if the input date is in store timezone
 * 
 * @param date Date in store timezone
 * @param timezone Store's timezone
 * @param includeTime Whether to include time component (default: false, returns YYYY-MM-DD)
 * @returns ISO string in UTC
 */
export function toApiDateString(
  date: Date | string,
  timezone: string = 'UTC',
  includeTime: boolean = false
): string {
  if (!date) return '';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    const utcDate = fromZonedTime(dateObj, timezone);
    
    if (includeTime) {
      return utcDate.toISOString();
    } else {
      // Return just the date part (YYYY-MM-DD)
      return utcDate.toISOString().split('T')[0];
    }
  } catch (error) {
    console.warn('Error converting date to API string:', error);
    return '';
  }
}

/**
 * Parse a date string from user input in store's timezone
 * 
 * @param dateString Date string (e.g., from input[type="date"])
 * @param timezone Store's timezone
 * @returns Date object in store timezone
 */
export function parseDateInTimezone(dateString: string, timezone: string = 'UTC'): Date {
  if (!dateString) return new Date();
  
  try {
    // Input date strings from <input type="date"> are in YYYY-MM-DD format
    // We need to interpret them in the store's timezone, not UTC
    const [year, month, day] = dateString.split('-').map(Number);
    const dateInTimezone = new Date(year, month - 1, day);
    return toZonedTime(dateInTimezone, timezone);
  } catch (error) {
    console.warn('Error parsing date in timezone:', error);
    return new Date();
  }
}

/**
 * Get a date range for "today" in store's timezone
 * 
 * @param timezone Store's timezone
 * @returns Object with start and end dates for today
 */
export function getTodayRange(timezone: string = 'UTC'): { start: Date; end: Date } {
  const now = getNowInTimezone(timezone);
  return {
    start: getStartOfDayInTimezone(now, timezone),
    end: getEndOfDayInTimezone(now, timezone),
  };
}

/**
 * Get a date range for a specific number of days ago in store's timezone
 * 
 * @param days Number of days to go back
 * @param timezone Store's timezone
 * @returns Object with start and end dates
 */
export function getLastNDaysRange(days: number, timezone: string = 'UTC'): { start: Date; end: Date } {
  const now = getNowInTimezone(timezone);
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - days + 1);
  
  return {
    start: getStartOfDayInTimezone(startDate, timezone),
    end: getEndOfDayInTimezone(now, timezone),
  };
}

/**
 * Format a date for display in store's timezone and format
 * 
 * @param date Date to format
 * @param dateFormat Store's date format preference
 * @param timezone Store's timezone
 * @returns Formatted date string
 */
export function formatDateForDisplay(
  date: Date | string | null | undefined,
  dateFormat: string = 'MM/dd/yyyy',
  timezone: string = 'UTC'
): string {
  if (!date) return '';
  return formatInStoreTimezone(date, dateFormat, timezone);
}

/**
 * Format a datetime for display in store's timezone and format
 * 
 * @param date Date to format
 * @param dateFormat Store's date format preference
 * @param timeFormat Store's time format preference
 * @param timezone Store's timezone
 * @returns Formatted datetime string
 */
export function formatDateTimeForDisplay(
  date: Date | string | null | undefined,
  dateFormat: string = 'MM/dd/yyyy',
  timeFormat: string = 'hh:mm a',
  timezone: string = 'UTC'
): string {
  if (!date) return '';
  const combinedFormat = `${dateFormat} ${timeFormat}`;
  return formatInStoreTimezone(date, combinedFormat, timezone);
}
