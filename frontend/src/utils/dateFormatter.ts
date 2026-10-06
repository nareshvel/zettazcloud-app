import { format, parseISO, isValid } from 'date-fns';

export interface DateFormatOptions {
  dateFormat?: string;
  timeFormat?: string;
  timezone?: string;
  includeTime?: boolean;
}

/**
 * Formats a date string according to store settings or provided format
 * @param dateString - The ISO date string to format
 * @param options - Optional formatting options
 * @returns Formatted date string
 */
export const formatDate = (dateString?: string, options?: DateFormatOptions): string => {
  if (!dateString) return 'N/A';
  
  try {
    const date = parseISO(dateString);
    if (!isValid(date)) return 'Invalid Date';
    
    // Default format if none provided
    let formatPattern = 'MMM dd, yyyy';
    
    // Use provided date format if available
    if (options?.dateFormat) {
      // Convert common date formats to date-fns format
      switch(options.dateFormat) {
        case 'DD/MM/YYYY':
          formatPattern = 'dd/MM/yyyy';
          break;
        case 'MM/DD/YYYY':
          formatPattern = 'MM/dd/yyyy';
          break;
        case 'YYYY/MM/DD':
          formatPattern = 'yyyy/MM/dd';
          break;
        case 'DD-MM-YYYY':
          formatPattern = 'dd-MM-yyyy';
          break;
        case 'MM-DD-YYYY':
          formatPattern = 'MM-dd-yyyy';
          break;
        case 'YYYY-MM-DD':
          formatPattern = 'yyyy-MM-dd'; 
          break;
        default:
          // Assume the provided format is already in date-fns format
          formatPattern = options.dateFormat;
      }
      
      // Add time if requested
      if (options.includeTime && options.timeFormat) {
        let timePattern = 'hh:mm a';
        // Convert time formats if needed
        switch(options.timeFormat) {
          case 'HH:mm':
            timePattern = 'HH:mm';
            break;
          case 'hh:mm A':
            timePattern = 'hh:mm a';
            break;
          default:
            timePattern = options.timeFormat;
        }
        formatPattern = `${formatPattern} ${timePattern}`;
      }
    }
    
    // TODO: Handle timezone conversion when needed
    // This would require additional libraries like date-fns-tz
    
    return format(date, formatPattern);
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString; // Return the original string if parsing fails
  }
};
