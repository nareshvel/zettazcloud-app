/**
 * Application configuration settings
 */

// API configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5172/api';

// Receipt printing configuration
export const RECEIPT_DEFAULT_WIDTH = 80; // mm
export const RECEIPT_DEFAULT_FONT = 'Courier, monospace';

// Default service timeouts
export const DEFAULT_TIMEOUT = 30000; // 30 seconds

// Feature flags
export const FEATURES = {
  RECEIPT_PRINTING: true,
  DIRECT_THERMAL_PRINTING: false, // Future feature
  PRINT_SERVER: false // Future feature
};

export default {
  API_BASE_URL,
  RECEIPT_DEFAULT_WIDTH,
  RECEIPT_DEFAULT_FONT,
  DEFAULT_TIMEOUT,
  FEATURES
};
