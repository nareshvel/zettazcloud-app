/**
 * JWT Secret Synchronization Utilities
 * 
 * This module provides functions to check if frontend and backend
 * are using the same JWT secret to avoid "invalid signature" errors.
 */

import { checkJwtConfigSync } from './jwt';

interface SyncCheckResult {
  isInSync: boolean;
  message: string;
  timestamp: number;
}

// Store the result of the last check to avoid repeated API calls
let lastCheckResult: SyncCheckResult | null = null;
// Cache the result for 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

/**
 * Check if frontend and backend JWT secrets are synchronized
 * @returns Promise resolving to a sync check result
 */
export async function checkJwtSecretSync(): Promise<SyncCheckResult> {
  // Return cached result if available and not expired
  if (lastCheckResult && Date.now() - lastCheckResult.timestamp < CACHE_DURATION) {
    return lastCheckResult;
  }

  try {
    const result = await checkJwtConfigSync();
    
    // Cache the result with timestamp
    lastCheckResult = {
      ...result,
      timestamp: Date.now()
    };
    
    return lastCheckResult;
  } catch (error) {
    console.error('Failed to check JWT secret sync:', error);
    return {
      isInSync: false,
      message: 'Failed to check JWT secret synchronization',
      timestamp: Date.now()
    };
  }
}

/**
 * Diagnose JWT token verification issues and suggest fixes
 * @param error Error object from a failed API call
 * @returns Promise resolving to diagnostic information
 */
export async function diagnoseJwtIssue(error: any): Promise<{
  possibleCause: string;
  suggestion: string;
  isSecretMismatch: boolean;
}> {
  // Check if the error is related to JWT verification
  const errorMessage = error?.message || '';
  const isJwtError = errorMessage.includes('invalid signature') || 
    errorMessage.includes('jwt malformed') ||
    errorMessage.includes('jwt expired') ||
    errorMessage.includes('unauthorized');
    
  if (!isJwtError) {
    return {
      possibleCause: 'The error does not appear to be JWT-related',
      suggestion: 'Check server logs for more details',
      isSecretMismatch: false
    };
  }
    
  // Check if frontend and backend secrets match
  const syncResult = await checkJwtSecretSync();
  
  if (!syncResult.isInSync) {
    return {
      possibleCause: 'JWT secret mismatch between frontend and backend',
      suggestion: 'Update frontend VITE_JWT_SECRET in .env to match the backend JWT_SECRET',
      isSecretMismatch: true
    };
  }
  
  if (errorMessage.includes('jwt expired')) {
    return {
      possibleCause: 'JWT token has expired',
      suggestion: 'Log out and log back in to get a new token',
      isSecretMismatch: false
    };
  }
  
  return {
    possibleCause: 'JWT verification error with matching secrets',
    suggestion: 'Clear browser storage and log in again. If the issue persists, check for middleware issues in the backend',
    isSecretMismatch: false
  };
}
