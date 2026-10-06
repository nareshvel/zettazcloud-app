/**
 * Date and time formatting utilities
 * 
 * This module provides functions for formatting dates and times according to locale preferences
 */
import { format, parseISO, isValid, Locale } from 'date-fns';
import { enUS, fr, de, es, it, ja, zhCN, hi } from 'date-fns/locale';

// Map of language codes to date-fns locales
const LOCALE_MAP: Record<string, Locale> = {
  'en': enUS,
  'en-US': enUS,
  'fr': fr,
  'fr-FR': fr,
  'de': de,
  'de-DE': de,
  'es': es,
  'es-ES': es,
  'it': it,
  'it-IT': it,
  'ja': ja,
  'ja-JP': ja,
  'zh': zhCN,
  'zh-CN': zhCN,
  'hi': hi,
  'hi-IN': hi,
  // Add more locales as needed
};

// Common date format patterns
export const DATE_FORMATS: Record<string, string> = {
  'MM/DD/YYYY': 'MM/dd/yyyy',
  'DD/MM/YYYY': 'dd/MM/yyyy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
  'DD.MM.YYYY': 'dd.MM.yyyy',
  'MMM DD, YYYY': 'MMM dd, yyyy',
  'DD MMM YYYY': 'dd MMM yyyy',
};

// Common time format patterns
export const TIME_FORMATS: Record<string, string> = {
  'hh:mm A': 'hh:mm a', // 12-hour with AM/PM
  'HH:mm': 'HH:mm',     // 24-hour
  'hh:mm:ss A': 'hh:mm:ss a', // 12-hour with seconds
  'HH:mm:ss': 'HH:mm:ss', // 24-hour with seconds
};

/**
 * Format a date according to the specified format string and locale
 * 
 * @param date Date to format
 * @param formatString Format string (e.g., 'MM/dd/yyyy')
 * @param localeCode BCP 47 language tag
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | number | null | undefined,
  formatString: string = 'MM/dd/yyyy',
  localeCode: string = 'en-US'
): string {
  if (!date) return '';
  
  try {
    // Convert from store format string (e.g., 'MM/DD/YYYY') to date-fns format (e.g., 'MM/dd/yyyy')
    const formatPattern = DATE_FORMATS[formatString] || formatString;
    
    // Parse the date if it's a string
    let parsedDate: Date;
    if (typeof date === 'string') {
      parsedDate = parseISO(date);
      if (!isValid(parsedDate)) {
        return date; // Return the original string if it can't be parsed
      }
    } else {
      parsedDate = new Date(date);
    }
    
    // Get the locale object
    const locale = LOCALE_MAP[localeCode] || enUS;
    
    return format(parsedDate, formatPattern, { locale });
  } catch (error) {
    console.warn(`Error formatting date: ${error}`);
    return String(date);
  }
}

/**
 * Format a time according to the specified format string and locale
 * 
 * @param time Time to format
 * @param formatString Format string (e.g., 'hh:mm a')
 * @param localeCode BCP 47 language tag
 * @returns Formatted time string
 */
export function formatTime(
  time: Date | string | number | null | undefined,
  formatString: string = 'hh:mm a',
  localeCode: string = 'en-US'
): string {
  if (!time) return '';
  
  try {
    // Convert from store format string to date-fns format
    const formatPattern = TIME_FORMATS[formatString] || formatString;
    
    // Parse the time if it's a string
    let parsedTime: Date;
    if (typeof time === 'string') {
      // Try to handle time-only strings (without date)
      if (time.indexOf(':') > 0 && time.length <= 12) {
        const today = new Date();
        const [hours, minutes] = time.split(':');
        today.setHours(parseInt(hours, 10));
        today.setMinutes(parseInt(minutes, 10));
        today.setSeconds(0);
        parsedTime = today;
      } else {
        parsedTime = parseISO(time);
      }
      
      if (!isValid(parsedTime)) {
        return time; // Return the original string if it can't be parsed
      }
    } else {
      parsedTime = new Date(time);
    }
    
    // Get the locale object
    const locale = LOCALE_MAP[localeCode] || enUS;
    
    return format(parsedTime, formatPattern, { locale });
  } catch (error) {
    console.warn(`Error formatting time: ${error}`);
    return String(time);
  }
}

/**
 * Format a date and time together
 * 
 * @param datetime Date and time to format
 * @param dateFormatString Date format string
 * @param timeFormatString Time format string
 * @param localeCode BCP 47 language tag
 * @returns Formatted date and time string
 */
export function formatDateTime(
  datetime: Date | string | number | null | undefined,
  dateFormatString: string = 'MM/dd/yyyy',
  timeFormatString: string = 'hh:mm a',
  localeCode: string = 'en-US'
): string {
  if (!datetime) return '';
  
  const dateStr = formatDate(datetime, dateFormatString, localeCode);
  const timeStr = formatTime(datetime, timeFormatString, localeCode);
  
  return `${dateStr} ${timeStr}`;
}
