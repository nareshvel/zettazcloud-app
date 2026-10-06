import React, { createContext, useContext, ReactNode } from 'react';
import { useStore } from './StoreContext';
import { Store } from '@/types';
// Define types internally instead of importing from utils
interface CurrencyFormatOptions {
  style?: 'currency' | 'decimal';
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  useGrouping?: boolean;
}

interface CurrencyDetails {
  code: string;
  symbol: string;
  name: string;
  decimalPlaces: number;
}
import {
  DATE_FORMATS,
  TIME_FORMATS
} from '@/utils/locale/dateUtils';
import { formatInStoreTimezone } from '@/utils/timezone';
import {
  formatNumber,
  formatPercent,
  NumberFormatOptions
} from '@/utils/locale/numberUtils';
import {
  convertWeight,
  convertVolume,
  convertLength,
  formatWeight,
  formatVolume,
  formatLength,
  getDefaultUnit,
  WeightUnit,
  VolumeUnit,
  LengthUnit,
  UnitType
} from '@/utils/locale/measurementUtils';

/**
 * Interface defining the properties and methods available through the LocalizationContext
 */
interface LocalizationContextType {
  // Currency
  currencyCode: string;
  currencySymbol: string;
  currencyDetails: CurrencyDetails;
  currencyDecimalPlaces: number;
  formatCurrency: (amount: number | null | undefined, options?: CurrencyFormatOptions) => string;
  
  // Date/Time
  dateFormat: string;
  timeFormat: string;
  timezone: string;
  formatDate: (date: Date | string | number | null | undefined, customFormat?: string) => string;
  formatTime: (time: Date | string | number | null | undefined, customFormat?: string) => string;
  formatDateTime: (datetime: Date | string | number | null | undefined, customDateFormat?: string, customTimeFormat?: string) => string;
  
  // Numbers
  numberFormat: string;
  decimalPrecision: number;
  formatNumber: (value: number | null | undefined, options?: NumberFormatOptions) => string;
  formatPercent: (value: number | null | undefined, options?: Omit<NumberFormatOptions, 'style' | 'unit'>) => string;
  
  // Measurement
  measurementSystem: 'metric' | 'imperial';
  getDefaultUnit: (type: UnitType) => WeightUnit | VolumeUnit | LengthUnit;
  convertWeight: (value: number, fromUnit: WeightUnit, toUnit: WeightUnit) => number;
  convertVolume: (value: number, fromUnit: VolumeUnit, toUnit: VolumeUnit) => number;
  convertLength: (value: number, fromUnit: LengthUnit, toUnit: LengthUnit) => number;
  formatWeight: (value: number, unit: WeightUnit, options?: { minimumFractionDigits?: number; maximumFractionDigits?: number; useGrouping?: boolean; }) => string;
  formatVolume: (value: number, unit: VolumeUnit, options?: { minimumFractionDigits?: number; maximumFractionDigits?: number; useGrouping?: boolean; }) => string;
  formatLength: (value: number, unit: LengthUnit, options?: { minimumFractionDigits?: number; maximumFractionDigits?: number; useGrouping?: boolean; }) => string;
  
  // Locale
  localeCode: string;
  languageCode: string;
  countryCode: string;
}

/**
 * Create the LocalizationContext with undefined as the default value
 * The actual value will be provided by the LocalizationProvider
 */
const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

/**
 * Props for the LocalizationProvider component
 */
interface LocalizationProviderProps {
  children: ReactNode;
}

/**
 * Provider component that makes localization data and functions available to all components
 * 
 * @param children Child components that will have access to the context
 */
export const LocalizationProvider: React.FC<LocalizationProviderProps> = ({ children }) => {
  // Get store settings from StoreContext
  const { store } = useStore();
  
  // Get store settings or fall back to defaults
  const storeSettings = store || {} as Partial<Store>;
  
  // Currency settings
  const currencyCode = storeSettings.currencyCode || 'USD';
  
  // Get currency details internally without relying on external utility
  const getCurrencyDetails = (code: string): CurrencyDetails => {
    const currencyDetailsMap: Record<string, CurrencyDetails> = {
      USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimalPlaces: 2 },
      EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimalPlaces: 2 },
      GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimalPlaces: 2 },
      INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', decimalPlaces: 2 },
      JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimalPlaces: 0 },
      CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', decimalPlaces: 2 },
      CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', decimalPlaces: 2 },
      AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', decimalPlaces: 2 },
      XCD: { code: 'XCD', symbol: '$', name: 'Eastern Caribbean Dollar', decimalPlaces: 2 },
    };
    
    return currencyDetailsMap[code] || { code, symbol: code, name: code, decimalPlaces: 2 };
  };
  
  // Get currency symbol using native Intl API
  const getCurrencySymbol = (code: string, locale: string): string => {
    try {
      // Extract just the symbol from formatted "0"
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: code,
        currencyDisplay: 'symbol'
      })
        .formatToParts(0)
        .find(part => part.type === 'currency')?.value || code;
    } catch (e) {
      return code;
    }
  };
  
  const currencyDetails = getCurrencyDetails(currencyCode);
  const currencySymbol = getCurrencySymbol(currencyCode, storeSettings.localeCode || 'en-US');
  const currencyDecimalPlaces = storeSettings.currencyDecimalPlaces || currencyDetails.decimalPlaces || 2;
  
  // Date/Time settings
  const dateFormat = storeSettings.dateFormat || 'MM/DD/YYYY';
  const timeFormat = storeSettings.timeFormat || 'hh:mm A';
  // Use cached timezone from localStorage to prevent flash, or wait for store settings
  const cachedTimezone = typeof window !== 'undefined' ? localStorage.getItem('store_timezone') : null;
  const timezone = storeSettings.timezone || cachedTimezone || 'UTC';
  
  // Cache timezone when loaded from store
  if (storeSettings.timezone && typeof window !== 'undefined') {
    localStorage.setItem('store_timezone', storeSettings.timezone);
  }
  
  // Number settings
  const numberFormat = storeSettings.numberFormat || 'point_comma';
  const decimalPrecision = storeSettings.decimalPrecision || 2;
  
  // Locale settings
  const localeCode = storeSettings.localeCode || 'en-US';
  // Extract language and country codes from the locale
  const [languageCode, countryCode] = (localeCode || 'en-US').split('-');
  
  // Measurement settings
  const measurementSystem = storeSettings.measurementSystem || 'metric';
  
  // Create the context value with all localization functions
  const value: LocalizationContextType = {
    // Currency
    currencyCode,
    currencySymbol,
    currencyDetails,
    currencyDecimalPlaces,
    formatCurrency: (amount, options) => {
      if (amount === null || amount === undefined) return '';
      
      try {
        return new Intl.NumberFormat(localeCode, {
          style: options?.style || 'currency',
          currency: currencyCode,
          minimumFractionDigits: options?.minimumFractionDigits ?? currencyDecimalPlaces,
          maximumFractionDigits: options?.maximumFractionDigits ?? currencyDecimalPlaces,
          useGrouping: options?.useGrouping ?? true
        }).format(amount);
      } catch (e) {
        console.error('Error formatting currency:', e);
        // Fallback format
        return currencySymbol + amount.toFixed(currencyDecimalPlaces);
      }
    },
    
    // Date/Time - Using timezone-aware formatting
    dateFormat,
    timeFormat,
    timezone,
    formatDate: (date, customFormat) => {
      if (!date) return '';
      const fmt = customFormat || (dateFormat && DATE_FORMATS[dateFormat]) || dateFormat || 'MM/dd/yyyy';
      // Use timezone-aware formatting from timezone.ts
      // Convert number to Date if needed
      const dateObj = typeof date === 'number' ? new Date(date) : date;
      return formatInStoreTimezone(dateObj, fmt, timezone);
    },
    formatTime: (time, customFormat) => {
      if (!time) return '';
      const fmt = customFormat || (timeFormat && TIME_FORMATS[timeFormat]) || timeFormat || 'hh:mm a';
      // Use timezone-aware formatting from timezone.ts
      // Convert number to Date if needed
      const timeObj = typeof time === 'number' ? new Date(time) : time;
      return formatInStoreTimezone(timeObj, fmt, timezone);
    },
    formatDateTime: (datetime, customDateFormat, customTimeFormat) => {
      if (!datetime) return '';
      const dateFmt = customDateFormat || (dateFormat && DATE_FORMATS[dateFormat]) || dateFormat || 'MM/dd/yyyy';
      const timeFmt = customTimeFormat || (timeFormat && TIME_FORMATS[timeFormat]) || timeFormat || 'hh:mm a';
      // Use timezone-aware formatting from timezone.ts
      // Convert number to Date if needed
      const datetimeObj = typeof datetime === 'number' ? new Date(datetime) : datetime;
      return formatInStoreTimezone(datetimeObj, `${dateFmt} ${timeFmt}`, timezone);
    },
    
    // Numbers
    numberFormat,
    decimalPrecision,
    formatNumber: (value, options) => formatNumber(
      value, 
      { 
        minimumFractionDigits: options?.minimumFractionDigits ?? decimalPrecision,
        maximumFractionDigits: options?.maximumFractionDigits ?? decimalPrecision,
        ...options 
      },
      localeCode
    ),
    formatPercent: (value, options) => formatPercent(
      value, 
      { 
        minimumFractionDigits: options?.minimumFractionDigits ?? 1,
        maximumFractionDigits: options?.maximumFractionDigits ?? 1,
        ...options 
      },
      localeCode
    ),
    
    // Measurement
    measurementSystem,
    getDefaultUnit: (type) => getDefaultUnit(type, measurementSystem),
    convertWeight,
    convertVolume,
    convertLength,
    formatWeight: (value, unit, options) => formatWeight(
      value, 
      unit, 
      {
        minimumFractionDigits: options?.minimumFractionDigits ?? decimalPrecision,
        maximumFractionDigits: options?.maximumFractionDigits ?? decimalPrecision,
        ...options
      },
      localeCode
    ),
    formatVolume: (value, unit, options) => formatVolume(
      value, 
      unit, 
      {
        minimumFractionDigits: options?.minimumFractionDigits ?? decimalPrecision,
        maximumFractionDigits: options?.maximumFractionDigits ?? decimalPrecision,
        ...options
      },
      localeCode
    ),
    formatLength: (value, unit, options) => formatLength(
      value, 
      unit, 
      {
        minimumFractionDigits: options?.minimumFractionDigits ?? decimalPrecision,
        maximumFractionDigits: options?.maximumFractionDigits ?? decimalPrecision,
        ...options
      },
      localeCode
    ),
    
    // Locale
    localeCode,
    languageCode,
    countryCode,
  };
  
  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};

/**
 * Hook to use the localization context
 * 
 * @returns The localization context with all localization functions
 * @throws Error if used outside of a LocalizationProvider
 */
export const useLocalization = (): LocalizationContextType => {
  const context = useContext(LocalizationContext);
  if (context === undefined) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
};

/**
 * Hook to use only currency-related functions from the localization context
 * 
 * @returns Currency-related functions and properties
 */
export const useCurrency = () => {
  const { 
    currencyCode, 
    currencySymbol, 
    currencyDetails, 
    formatCurrency 
  } = useLocalization();
  
  return { 
    currencyCode, 
    currencySymbol, 
    currencyDetails, 
    formatCurrency 
  };
};

/**
 * Hook to use only date-related functions from the localization context
 * 
 * @returns Date-related functions and properties
 */
export const useDateFormatting = () => {
  const { 
    dateFormat, 
    timeFormat, 
    timezone, 
    formatDate, 
    formatTime, 
    formatDateTime 
  } = useLocalization();
  
  return { 
    dateFormat, 
    timeFormat, 
    timezone, 
    formatDate, 
    formatTime, 
    formatDateTime 
  };
};

/**
 * Hook to use only number-related functions from the localization context
 * 
 * @returns Number-related functions and properties
 */
export const useNumberFormatting = () => {
  const { 
    numberFormat, 
    decimalPrecision, 
    formatNumber, 
    formatPercent 
  } = useLocalization();
  
  return { 
    numberFormat, 
    decimalPrecision, 
    formatNumber, 
    formatPercent 
  };
};

/**
 * Hook to use only measurement-related functions from the localization context
 * 
 * @returns Measurement-related functions and properties
 */
export const useMeasurement = () => {
  const { 
    measurementSystem, 
    getDefaultUnit, 
    convertWeight, 
    convertVolume, 
    convertLength, 
    formatWeight, 
    formatVolume, 
    formatLength 
  } = useLocalization();
  
  return { 
    measurementSystem, 
    getDefaultUnit, 
    convertWeight, 
    convertVolume, 
    convertLength, 
    formatWeight, 
    formatVolume, 
    formatLength 
  };
};
