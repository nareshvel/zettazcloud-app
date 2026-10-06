/**
 * Frontend debug logger utility
 * Controls debug logs based on environment variables in .env file
 * 
 * IMPORTANT: ALL DEBUG LOGS ARE DISABLED BY DEFAULT
 * To enable logs, set the corresponding environment variable:
 * REACT_APP_DEBUG_USERS=true
 * REACT_APP_DEBUG_API=true
 * etc.
 */

// Set this to true to enable debug logs during development
// This should be false in production/by default
const MASTER_DEBUG_ENABLED = false;

// Helper to check if a debug flag is enabled
const isDebugEnabled = (flag: string): boolean => {
  // Master disable switch - if false, all logs are disabled regardless of env vars
  if (!MASTER_DEBUG_ENABLED) return false;
  
  // For frontend, we need to use REACT_APP_ prefix for environment variables
  const envVarName = `REACT_APP_DEBUG_${flag.toUpperCase()}`;
  return process.env[envVarName] === 'true';
};

// Global debug flags - can be expanded as needed
export const DEBUG_FLAGS = {
  USERS: isDebugEnabled('USERS'),
  API: isDebugEnabled('API'),
  AUTH: isDebugEnabled('AUTH'),
  RBAC: isDebugEnabled('RBAC'),
  FORMS: isDebugEnabled('FORMS'),
};

/**
 * Conditional debug logger
 * Only logs when the specific debug flag is enabled
 * 
 * IMPORTANT: ALL LOGS ARE DISABLED BY DEFAULT
 * To enable, set MASTER_DEBUG_ENABLED to true in this file
 * and set the corresponding environment variable
 * 
 * @param flag - The debug category (USERS, API, etc)
 * @param args - Arguments to pass to console.log
 */
export const debugLog = (flag: keyof typeof DEBUG_FLAGS, ...args: any[]): void => {
  // With MASTER_DEBUG_ENABLED=false, this condition will always be false
  // and no logs will be output regardless of environment variables
  if (DEBUG_FLAGS[flag]) {
    console.log(`[DEBUG:${flag}]`, ...args);
  }
};

/**
 * Logs API requests conditionally when API debugging is enabled
 */
export const debugLogAPI = (...args: any[]): void => {
  debugLog('API', ...args);
};

/**
 * Logs user-related operations conditionally when USER debugging is enabled
 */
export const debugLogUsers = (...args: any[]): void => {
  debugLog('USERS', ...args);
};
