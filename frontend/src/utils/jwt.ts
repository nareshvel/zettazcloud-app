/**
 * JWT Utilities for Zettaz Cloud POS
 * 
 * This file provides utilities for JWT token handling in the frontend,
 * ensuring that the same JWT_SECRET is used as in the backend.
 */

// Import standard JWT library
import { jwtDecode } from 'jwt-decode';

// Environment configuration
const JWT_SECRET = import.meta.env.VITE_JWT_SECRET;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5172';

/**
 * Type definitions for JWT token payloads
 */
interface JwtPayload {
  id: string;
  email: string;
  tenant_id?: string;
  store_id?: string;
  systemRoles?: string[];
  roles?: string[];
  permissions?: string[];
  iat?: number;
  exp?: number;
}

/**
 * Decode and return the payload of a JWT token without verification
 * @param token The JWT token to decode
 * @returns The decoded payload or null if invalid
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwtDecode<JwtPayload>(token);
  } catch (error) {
    console.error('Failed to decode JWT token:', error);
    return null;
  }
}

/**
 * Check if a token is expired
 * @param token The JWT token to check
 * @returns True if expired, false otherwise
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;
  
  // Convert expiration time to milliseconds and compare with current time
  const expirationTime = payload.exp * 1000;
  return Date.now() >= expirationTime;
}

/**
 * Verify that frontend and backend JWT configurations are in sync
 * This helps diagnose JWT verification errors
 */
export async function checkJwtConfigSync(): Promise<{
  isInSync: boolean;
  message: string;
}> {
  try {
    // Skip this check if no JWT_SECRET is configured in frontend
    if (!JWT_SECRET) {
      console.warn('Frontend JWT_SECRET is not configured');
      return {
        isInSync: false,
        message: 'Frontend JWT_SECRET is not configured'
      };
    }
    
    // Get hash of our JWT secret to securely compare with backend
    const secretHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(JWT_SECRET)
    ).then(hash => Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .substring(0, 8)
    );
    
    // Only available in development mode
    if (process.env.NODE_ENV === 'development') {
      // Call our debug endpoint to check if secrets match
      const response = await fetch(`${API_URL}/api/debug/sync-check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ secretHash })
      });
      
      if (!response.ok) {
        return {
          isInSync: false,
          message: 'Failed to check JWT configuration sync'
        };
      }
      
      const data = await response.json();
      return {
        isInSync: data.isInSync,
        message: data.message
      };
    }
    
    // In production, we can't make this check, so just assume it's in sync
    return {
      isInSync: true,
      message: 'JWT configuration sync check skipped in production'
    };
  } catch (error) {
    console.error('Failed to check JWT configuration sync:', error);
    return {
      isInSync: false,
      message: 'Failed to check JWT configuration sync'
    };
  }
}
