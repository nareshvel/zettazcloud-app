/**
 * Measurement utilities for handling unit conversions and formatting
 * 
 * This module provides functions for converting between different measurement units
 * and formatting measurements according to locale preferences
 */
import { formatNumber } from './numberUtils';

// Conversion factors
const WEIGHT_CONVERSIONS = {
  g_to_kg: 0.001,
  g_to_oz: 0.035274,
  g_to_lb: 0.00220462,
  
  kg_to_g: 1000,
  kg_to_oz: 35.274,
  kg_to_lb: 2.20462,
  
  oz_to_g: 28.3495,
  oz_to_kg: 0.0283495,
  oz_to_lb: 0.0625,
  
  lb_to_g: 453.592,
  lb_to_kg: 0.453592,
  lb_to_oz: 16,
};

const VOLUME_CONVERSIONS = {
  ml_to_l: 0.001,
  ml_to_floz: 0.033814,
  ml_to_cup: 0.00422675,
  ml_to_pt: 0.00211338,
  ml_to_qt: 0.00105669,
  ml_to_gal: 0.000264172,
  
  l_to_ml: 1000,
  l_to_floz: 33.814,
  l_to_cup: 4.22675,
  l_to_pt: 2.11338,
  l_to_qt: 1.05669,
  l_to_gal: 0.264172,
  
  floz_to_ml: 29.5735,
  floz_to_l: 0.0295735,
  floz_to_cup: 0.125,
  floz_to_pt: 0.0625,
  floz_to_qt: 0.03125,
  floz_to_gal: 0.0078125,
};

const LENGTH_CONVERSIONS = {
  mm_to_cm: 0.1,
  mm_to_m: 0.001,
  mm_to_in: 0.0393701,
  mm_to_ft: 0.00328084,
  
  cm_to_mm: 10,
  cm_to_m: 0.01,
  cm_to_in: 0.393701,
  cm_to_ft: 0.0328084,
  
  m_to_mm: 1000,
  m_to_cm: 100,
  m_to_in: 39.3701,
  m_to_ft: 3.28084,
  
  in_to_mm: 25.4,
  in_to_cm: 2.54,
  in_to_m: 0.0254,
  in_to_ft: 0.0833333,
  
  ft_to_mm: 304.8,
  ft_to_cm: 30.48,
  ft_to_m: 0.3048,
  ft_to_in: 12,
};

// Weight units
export type WeightUnit = 'g' | 'kg' | 'oz' | 'lb';

// Volume units
export type VolumeUnit = 'ml' | 'l' | 'floz' | 'cup' | 'pt' | 'qt' | 'gal';

// Length units
export type LengthUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft';

// All unit types
export type UnitType = 'weight' | 'volume' | 'length';

/**
 * Convert a weight value from one unit to another
 * 
 * @param value Value to convert
 * @param fromUnit Source unit
 * @param toUnit Target unit
 * @returns Converted value
 */
export function convertWeight(
  value: number,
  fromUnit: WeightUnit,
  toUnit: WeightUnit
): number {
  if (fromUnit === toUnit) return value;
  
  // Get the conversion key
  const conversionKey = `${fromUnit}_to_${toUnit}` as keyof typeof WEIGHT_CONVERSIONS;
  const conversionFactor = WEIGHT_CONVERSIONS[conversionKey];
  
  if (!conversionFactor) {
    console.warn(`Conversion from ${fromUnit} to ${toUnit} not supported`);
    return value;
  }
  
  return value * conversionFactor;
}

/**
 * Convert a volume value from one unit to another
 * 
 * @param value Value to convert
 * @param fromUnit Source unit
 * @param toUnit Target unit
 * @returns Converted value
 */
export function convertVolume(
  value: number,
  fromUnit: VolumeUnit,
  toUnit: VolumeUnit
): number {
  if (fromUnit === toUnit) return value;
  
  // Get the conversion key
  const conversionKey = `${fromUnit}_to_${toUnit}` as keyof typeof VOLUME_CONVERSIONS;
  const conversionFactor = VOLUME_CONVERSIONS[conversionKey];
  
  if (!conversionFactor) {
    console.warn(`Conversion from ${fromUnit} to ${toUnit} not supported`);
    return value;
  }
  
  return value * conversionFactor;
}

/**
 * Convert a length value from one unit to another
 * 
 * @param value Value to convert
 * @param fromUnit Source unit
 * @param toUnit Target unit
 * @returns Converted value
 */
export function convertLength(
  value: number,
  fromUnit: LengthUnit,
  toUnit: LengthUnit
): number {
  if (fromUnit === toUnit) return value;
  
  // Get the conversion key
  const conversionKey = `${fromUnit}_to_${toUnit}` as keyof typeof LENGTH_CONVERSIONS;
  const conversionFactor = LENGTH_CONVERSIONS[conversionKey];
  
  if (!conversionFactor) {
    console.warn(`Conversion from ${fromUnit} to ${toUnit} not supported`);
    return value;
  }
  
  return value * conversionFactor;
}

/**
 * Format a weight value with the appropriate unit
 * 
 * @param value Weight value
 * @param unit Weight unit
 * @param options Formatting options
 * @param localeCode BCP 47 language tag
 * @returns Formatted weight string
 */
export function formatWeight(
  value: number,
  unit: WeightUnit,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  },
  localeCode: string = 'en-US'
): string {
  if (value === null || value === undefined) return '';
  
  const formattedValue = formatNumber(value, options, localeCode);
  return `${formattedValue} ${unit}`;
}

/**
 * Format a volume value with the appropriate unit
 * 
 * @param value Volume value
 * @param unit Volume unit
 * @param options Formatting options
 * @param localeCode BCP 47 language tag
 * @returns Formatted volume string
 */
export function formatVolume(
  value: number,
  unit: VolumeUnit,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  },
  localeCode: string = 'en-US'
): string {
  if (value === null || value === undefined) return '';
  
  const formattedValue = formatNumber(value, options, localeCode);
  return `${formattedValue} ${unit}`;
}

/**
 * Format a length value with the appropriate unit
 * 
 * @param value Length value
 * @param unit Length unit
 * @param options Formatting options
 * @param localeCode BCP 47 language tag
 * @returns Formatted length string
 */
export function formatLength(
  value: number,
  unit: LengthUnit,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  },
  localeCode: string = 'en-US'
): string {
  if (value === null || value === undefined) return '';
  
  const formattedValue = formatNumber(value, options, localeCode);
  return `${formattedValue} ${unit}`;
}

/**
 * Get the default unit for a given measurement type based on measurement system
 * 
 * @param type Measurement type
 * @param system Measurement system
 * @returns Default unit for the given type and system
 */
export function getDefaultUnit(
  type: UnitType,
  system: 'metric' | 'imperial' = 'metric'
): WeightUnit | VolumeUnit | LengthUnit {
  if (type === 'weight') {
    return system === 'metric' ? 'kg' : 'lb';
  } else if (type === 'volume') {
    return system === 'metric' ? 'l' : 'gal';
  } else if (type === 'length') {
    return system === 'metric' ? 'm' : 'ft';
  }
  
  // Default fallback
  return system === 'metric' ? 'kg' : 'lb';
}
