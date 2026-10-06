import type { User, LoginCredentials, BackendUserForApi, UserMeResponseData, Store, BackendStoreForApi } from '@/types'; // Changed path to use @ alias; removed TaxConfig
import * as api from './api';

// Base URL for API requests. VITE_API_BASE_URL is documented (see api.ts) as the
// server ROOT without a trailing /api (e.g. http://localhost:5172) — every real
// .env file in this repo (.env.development.local, .env.example) follows that
// convention. This constant used to use the raw env value directly, which meant
// the one call site below (`/users/me`) hit `http://localhost:5172/users/me`
// with no /api segment at all → a 404 on every call. Normalizing here the same
// way api.ts's buildApiUrl does (strip any accidental /api, then always add it
// back) makes this file agree with that convention instead of silently
// depending on VITE_API_BASE_URL happening to already include /api.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5172')
  .replace(/\/api\/?$/, '') + '/api';

/**
 * Browser-compatible storage utility with fallbacks for Chromium localStorage issues
 */
class BrowserStorage {
  private static memoryStorage: Map<string, string> = new Map();
  
  // Browser detection for enhanced debugging
  // private static isChromium(): boolean {
  //   return /Chromium/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
  // }
  
  static setItem(key: string, value: string): void {
    try {
      // Try localStorage first
      localStorage.setItem(key, value);
    } catch (error) {
      // Fallback to memory storage for Chromium compatibility
      this.memoryStorage.set(key, value);
      
      // Also try sessionStorage as secondary fallback
      try {
        sessionStorage.setItem(key, value);
      } catch (sessionError) {
        // Silent fallback - both localStorage and sessionStorage failed
      }
    }
  }
  
  static getItem(key: string): string | null {
    try {
      // Try localStorage first
      const value = localStorage.getItem(key);
      if (value !== null) {
        return value;
      }
    } catch (error) {
      // Silent fallback for localStorage read failure
    }
    
    // Try sessionStorage fallback
    try {
      const sessionValue = sessionStorage.getItem(key);
      if (sessionValue !== null) {
        return sessionValue;
      }
    } catch (error) {}
    
    // Try memory storage fallback
    const memoryValue = this.memoryStorage.get(key);
    if (memoryValue !== undefined) {
      return memoryValue;
    }
    
    return null;
  }
  
  static removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {}
    
    try {
      sessionStorage.removeItem(key);
    } catch (error) {}
    
    this.memoryStorage.delete(key);
  }
  
  static clear(): void {
    try {
      localStorage.clear();
    } catch (error) {}
    
    try {
      sessionStorage.clear();
    } catch (error) {}
    
    this.memoryStorage.clear();
  }
}

/**
 * Helper function to recursively find a token in a nested object structure
 * Enhanced to check more token locations and handle nested objects better
 */
function findTokenInObject(data: unknown): string | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  const obj = data as Record<string, any>;
  
  // Check common token field names in priority order
  const tokenFields = [
    'token', 'access_token', 'accessToken', 'jwt', 'jwtToken', 'authToken',
    'data.token', 'data.access_token', 'user.token', 'auth.token',
    'data.user.token', 'result.token', 'result.access_token'
  ];

  // First check direct fields
  for (const field of tokenFields) {
    // Handle nested paths (e.g., 'data.token')
    const value = field.split('.').reduce((o, k) => o?.[k], obj);
    if (value && typeof value === 'string') {
      // Debug logging removed for cleaner console output
      return value;
    }
  }
  
  // If no token found in common locations, recursively search the object
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== null) {
      // Skip circular references and non-relevant types
      if (key === 'password' || key === 'passwordHash') continue;
      
      if (Array.isArray(obj[key])) {
        // If it's an array, search each item
        for (const item of obj[key]) {
          const result = findTokenInObject(item);
          if (result) return result;
        }
      } else if (typeof obj[key] === 'object') {
        // If it's an object, search recursively but limit depth
        const result = findTokenInObject(obj[key]);
        if (result) return result;
      }
    }
  }
  
  return null;
};

/**
 * Thrown by loginUser() when the backend responds with
 * `{ requiresTwoFactor: true, pendingToken }` instead of the normal
 * `{ user, token }` shape — i.e. the user has TOTP 2FA enabled and must
 * complete the second step via verifyTwoFactorLogin() before a real
 * session token is issued. No auth data is stored in this case; the
 * caller (LoginPage) is expected to catch this specific error type and
 * show a code-entry step rather than treating it as a failed login.
 */
export class TwoFactorRequiredError extends Error {
  pendingToken: string;
  constructor(pendingToken: string) {
    super('Two-factor authentication required');
    this.name = 'TwoFactorRequiredError';
    this.pendingToken = pendingToken;
  }
}

/**
 * Shared success-path handler for both a normal login and a completed
 * 2FA verification — both ultimately receive the same `{ user, token }`
 * (or equivalent nested) shape from the backend and need identical
 * token/user extraction + storage + return-value logic. Extracted out of
 * loginUser() so verifyTwoFactorLogin() doesn't have to duplicate it.
 */
function finalizeAuthResponse(response: any): User {
    // --- BEGIN TOKEN EXTRACTION AND STORAGE ---
    let tokenToStore: string | null = null;
    let responseData = response;

    // If response has a data property, use that as the main response object
    if (response.data && typeof response.data === 'object') {
      responseData = response.data;
      // Debug logging removed for cleaner console output
    }

    // Try to get token from common places in the response
    if ((responseData as any).token) {
      // Token is at the root level
      tokenToStore = (responseData as any).token;
      // Debug logging removed for cleaner console output
    } else if ((responseData as any)?.user?.token) {
      // Token is in response.user.token
      tokenToStore = (responseData as any).user.token;
      // Debug logging removed for cleaner console output
    } else if (typeof responseData === 'object' && responseData !== null) {
      // Fallback to searching within the entire response object
      tokenToStore = findTokenInObject(responseData);
      if (tokenToStore) {
        // Debug logging removed for cleaner console output
      } else {
        // Check for common alternative token field names
        const possibleTokenFields = ['access_token', 'accessToken', 'jwt', 'jwtToken', 'authToken'];
        for (const field of possibleTokenFields) {
          if ((responseData as any)[field]) {
            tokenToStore = (responseData as any)[field];
            // Debug logging removed for cleaner console output
            break;
          }
        }
      }
    }

    if (!tokenToStore) {
      console.error('No authentication token found in login response:', response);
      throw new Error('Authentication token not found in login response.');
    }

    try {
      // Store in browser-compatible storage with fallbacks
      BrowserStorage.setItem('auth_token', tokenToStore);
      sessionStorage.setItem('auth_token', tokenToStore);
      
      // Also store the token in a cookie for compatibility with some auth middleware
      document.cookie = `auth_token=${tokenToStore}; path=/; SameSite=Strict` + 
        (window.location.protocol === 'https:' ? '; Secure' : '');
    } catch (storageError) {
      console.error('Error storing auth token:', storageError);
      // Don't fail the login if storage fails, but log it
    }
    // --- END TOKEN EXTRACTION AND STORAGE ---

    // Debug logging removed for cleaner console output
    const backendUserData = getActualBackendUserData(responseData);
    if (!backendUserData) {
      console.error('Could not extract user data from login response:', response);
      throw new Error('Could not extract user data from login response.');
    }
    // RBAC presence check removed to avoid unused variables and noisy logs

    const user = mapBackendDataToUser(backendUserData);
    // Debug logging removed for cleaner console output

    try {
      // Store user data in browser-compatible storage with fallbacks
      const userData = JSON.stringify(user);
      BrowserStorage.setItem('currentUser', userData);
      sessionStorage.setItem('currentUser', userData);
      
      // Store tenant_id and store_id separately for easy access
      if (user.tenantId) {
        const tenantId = user.tenantId.toString();
        BrowserStorage.setItem('tenant_id', tenantId);
        sessionStorage.setItem('tenant_id', tenantId);
      }
      
      // Store store_id if available, but don't fail if it's null (managers might not have one)
      const storeId = user.storeId?.toString();
      if (storeId) {
        BrowserStorage.setItem('store_id', storeId);
        sessionStorage.setItem('store_id', storeId);
      } else {
        // Debug logging removed for cleaner console output
        const defaultStoreId = `default-${user.tenantId}`;
        localStorage.setItem('store_id', defaultStoreId);
        sessionStorage.setItem('store_id', defaultStoreId);
      }
      
      // Debug logging removed for cleaner console output
    } catch (storageError) {
      console.error('Error storing user data:', storageError);
      // Don't fail the login if storage fails, but log it
    }
    return user;
}

/**
 * Login user with credentials and store auth token.
 *
 * For a user with TOTP 2FA enabled, the backend responds with
 * `{ requiresTwoFactor: true, pendingToken }` instead of the normal
 * `{ user, token }` shape. That case is detected BEFORE the normal token
 * extraction logic runs (which would otherwise fail to find a token and
 * throw a generic "not found" error) and surfaced as a typed
 * TwoFactorRequiredError so the caller (LoginPage) can show a code-entry
 * step. No auth data is stored in that branch. Users without 2FA enabled
 * are completely unaffected — they still get the normal shape and flow.
 */
export const loginUser = async (credentials: LoginCredentials): Promise<User | null> => {
  try {
    // Clear any existing auth data before attempting login
    BrowserStorage.removeItem('auth_token');
    BrowserStorage.removeItem('currentUser');
    BrowserStorage.removeItem('user'); // For backward compatibility

    const response = await api.fetchApi<UserMeResponseData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    // Detect the 2FA-pending branch before attempting normal token
    // extraction. Check both the root response and response.data, since
    // fetchApi may or may not have already unwrapped `{status,data}`.
    const maybeData = (response as any)?.data && typeof (response as any).data === 'object'
      ? (response as any).data
      : response;
    if (maybeData && (maybeData as any).requiresTwoFactor === true) {
      const pendingToken = (maybeData as any).pendingToken;
      if (!pendingToken) {
        throw new Error('Two-factor authentication required but no pending token was returned.');
      }
      throw new TwoFactorRequiredError(pendingToken);
    }

    return finalizeAuthResponse(response);

  } catch (error: any) {
    // A pending-2FA "error" is not a real login failure — don't clear
    // anything (nothing was stored yet) or log it as an error, just let it
    // propagate for LoginPage to handle.
    if (error instanceof TwoFactorRequiredError) {
      throw error;
    }

    // Ensure any partially stored login artifacts are cleared on error
    BrowserStorage.removeItem('auth_token');
    BrowserStorage.removeItem('currentUser');
    BrowserStorage.removeItem('user'); // For backward compatibility

    console.error('Login error in authService:', error);

    throw error; // Re-throw the error so it can be handled by the caller
  }
};

/**
 * Second step of a 2FA-gated login: exchanges the short-lived
 * `pendingToken` (returned by loginUser() via TwoFactorRequiredError) plus
 * the 6-digit authenticator code (or a backup code — the backend accepts
 * either) for a real session. On success, POST /api/auth/2fa/verify
 * returns the same `{ user, token }` shape a normal login does, so this
 * reuses finalizeAuthResponse() rather than duplicating the token/user
 * extraction and storage logic.
 */
export const verifyTwoFactorLogin = async (pendingToken: string, code: string): Promise<User | null> => {
  try {
    const response = await api.fetchApi<UserMeResponseData>('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ pendingToken, code }),
    });
    return finalizeAuthResponse(response);
  } catch (error: any) {
    // Clear anything that might have been partially stored, matching
    // loginUser()'s error-path behavior.
    BrowserStorage.removeItem('auth_token');
    BrowserStorage.removeItem('currentUser');
    BrowserStorage.removeItem('user');
    console.error('2FA verification error in authService:', error);
    throw error;
  }
};

/**
 * Logout user and clear auth data
 */
export const logoutUser = async (): Promise<void> => {
  BrowserStorage.clear();
};

// Helper to extract the actual backend user data from UserMeResponseData
// Helper to map a camelCased store object (from fetchApi) to a snake_case BackendStoreForApi object
function mapCamelStoreToBackendStore(camelStore: any): BackendStoreForApi | null {
  if (!camelStore) return null;
  return {
    id: camelStore.id,
    tenant_id: camelStore.tenantId,
    name: camelStore.name,
    address: camelStore.address,
    phone: camelStore.phone,
    email: camelStore.email,
    currency_code: camelStore.currencyCode,
    currency_decimal_places: camelStore.currencyDecimalPlaces,
    date_format: camelStore.dateFormat,
    time_format: camelStore.timeFormat,
    timezone: camelStore.timezone,
    tax_config: camelStore.taxConfig, // Assuming TaxConfig type is compatible or handled by toCamelCase
    discount_application_preference: camelStore.discountApplicationPreference,
    allow_negative_stock: camelStore.allowNegativeStock,
    number_format: camelStore.numberFormat,
    decimal_precision: camelStore.decimalPrecision,
    locale_code: camelStore.localeCode,
    language_code: camelStore.languageCode,
    country_code: camelStore.countryCode,
    measurement_system: camelStore.measurementSystem,
    // Ensure all fields from BackendStoreForApi are mapped if they exist on camelStore
  };
}

/**
 * Extracts and normalizes user data from various possible response structures.
 * Handles both camelCase and snake_case property names.
 */
function getActualBackendUserData(responseData: unknown): BackendUserForApi | null {
  if (!responseData) {
    console.error('getActualBackendUserData: No response data provided');
    return null;
  }

  // Debug logging removed for cleaner console output
  
  // Type guard to check if an object has a property
  const hasProperty = <T extends object, K extends string>(
    obj: T, 
    prop: K
  ): obj is T & Record<K, unknown> => {
    return prop in obj;
  };

  // Try to find the source object containing user data
  const findSourceObject = (data: unknown): BackendUserForApi | null => {
    if (!data || typeof data !== 'object') {
      return null;
    }

    // Case 1: Check if data is already a BackendUserForApi
    if (hasProperty(data, 'id') && (hasProperty(data, 'email') || hasProperty(data, 'username'))) {
      return data as BackendUserForApi;
    }

    // Case 2: Check common response structures
    if (hasProperty(data, 'user') && data.user && typeof data.user === 'object') {
      const userData = data.user as any;
      
      // Ensure RBAC fields are properly preserved
      const backendUser: BackendUserForApi = {
        ...userData,
        // Explicitly preserve RBAC fields to prevent loss during casting
        roles: userData.roles || [],
        systemRoles: userData.systemRoles || [],
        // Backend sends role names in 'roles' field, map it to 'roleNames'
        roleNames: userData.roleNames || userData.roles || [],
        permissions: userData.permissions || []
      };

      return backendUser;
    }

    if (hasProperty(data, 'data')) {
      const responseData = data.data;
      
      // Case 3: Check response.data.user
      if (responseData && 
          typeof responseData === 'object' && 
          hasProperty(responseData, 'user') && 
          responseData.user && 
          typeof responseData.user === 'object') {
        // Debug logging removed for cleaner console output
        return responseData.user as BackendUserForApi;
      }
      
      // Case 4: Check if response.data is the user object
      if (responseData && 
          typeof responseData === 'object' && 
          (hasProperty(responseData, 'id') || hasProperty(responseData, 'email'))) {
        // Debug logging removed for cleaner console output
        return responseData as BackendUserForApi;
      }
    }

    // Case 5: Recursively search for a user-like object
    // Debug logging removed
    
    const findUserObject = (obj: unknown, depth = 0): BackendUserForApi | null => {
      if (depth > 3) return null; // Prevent infinite recursion
      if (!obj || typeof obj !== 'object') return null;
      
      // Check if this looks like a user object
      if ((hasProperty(obj, 'id') || hasProperty(obj, 'email')) && 
          (hasProperty(obj, 'role') || hasProperty(obj, 'permissions') || hasProperty(obj, 'roles'))) {
        return obj as BackendUserForApi;
      }
      
      // Recursively search in object values
      return Object.values(obj).reduce<BackendUserForApi | null>((found, value) => {
        return found || findUserObject(value, depth + 1);
      }, null);
    };
    
    return findUserObject(data);
  };

  const sourceObject = findSourceObject(responseData);

  if (!sourceObject) {
    console.warn('getActualBackendUserData: Could not find user data in responseData');
    return null;
  }
  
  // Debug logging removed for cleaner console output
  // Debug logging removed for cleaner console output
  // Debug logging removed for cleaner console output

  try {
    // Now, sourceObject contains the user data with camelCase keys.
    // We need to construct a BackendUserForApi object (snake_case keys).
    const backendUser: BackendUserForApi = {
      id: sourceObject.id,
      email: sourceObject.email,
      name: sourceObject.name || (sourceObject as any).fullName || (sourceObject as any).full_name,
      role: sourceObject.role, // role may be undefined with RBAC migration, that's OK
      
      // Handle snake_case vs camelCase for boolean flags
      is_active: sourceObject.is_active !== undefined 
        ? sourceObject.is_active 
        : (sourceObject as any).isActive !== undefined 
          ? (sourceObject as any).isActive 
          : true, // Default to true if undefined
          
      // Handle tenant_id vs tenantId
      tenant_id: sourceObject.tenant_id || (sourceObject as any).tenantId,
      store_id: sourceObject.store_id || (sourceObject as any).storeId,
      
      // Handle nested store object
      store: sourceObject.store ? mapCamelStoreToBackendStore(sourceObject.store) : null,

      // RBAC fields - map from the response. This reconstruction previously
      // dropped `roles`/`roleNames` entirely (they weren't in this object's
      // field list at all) even though the earlier findSourceObject() Case 2
      // branch had carefully preserved them — meaning a correctly-resolved
      // "Tenant Admin" role from the backend silently became `undefined`
      // right here, before mapBackendDataToUser ever saw it. `systemRoles`'s
      // fallback to `sourceObject.roles` was also unreachable in practice:
      // `Array.isArray([])` is true, so an empty (but present) systemRoles
      // array always won over falling back to roles.
      roles: Array.isArray(sourceObject.roles) ? sourceObject.roles : [],
      roleNames: Array.isArray((sourceObject as any).roleNames)
        ? (sourceObject as any).roleNames
        : (Array.isArray(sourceObject.roles) ? sourceObject.roles : []),
      systemRoles: Array.isArray(sourceObject.systemRoles) && sourceObject.systemRoles.length > 0
        ? sourceObject.systemRoles
        : (Array.isArray(sourceObject.roles) ? sourceObject.roles : []),

      permissions: Array.isArray(sourceObject.permissions)
        ? sourceObject.permissions
        : [],

      // Other fields with fallbacks for snake_case and camelCase
      store_currency_code: sourceObject.store_currency_code || (sourceObject as any).storeCurrencyCode,
      tax_config: sourceObject.tax_config || (sourceObject as any).taxConfig, 
      discount_application_rule: sourceObject.discount_application_rule || (sourceObject as any).discountApplicationRule,
      currency_code: sourceObject.currency_code || (sourceObject as any).currencyCode,
      allow_negative_stock: sourceObject.allow_negative_stock !== undefined 
        ? sourceObject.allow_negative_stock 
        : (sourceObject as any).allowNegativeStock,
      default_tax_class_id: sourceObject.default_tax_class_id || (sourceObject as any).defaultTaxClassId,

      // Tenant onboarding status (audit Gap 3) — pass through the nested
      // tenant object from the login / /users/me response so
      // mapBackendDataToUser can populate User.tenant.
      tenant: (sourceObject as any).tenant || null,
    };
    
    // Debug logging removed for cleaner console output
    return backendUser;
  } catch (error) {
    console.error('Error mapping backend user data:', error);
    return null;
  }
}

// Helper function to map backend store data to frontend Store type
function mapBackendStoreToFrontendStore(backendStore: BackendStoreForApi): Store | null {
  if (!backendStore) return null;
  
  // Safely handle the discount application preference
  const discountAppPref = (
    backendStore.discount_application_preference === 'BEFORE_TAX' || 
    backendStore.discount_application_preference === 'AFTER_TAX'
  ) ? backendStore.discount_application_preference : 'BEFORE_TAX';

  // Safely handle the measurement system
  const measurementSystem = (
    backendStore.measurement_system === 'metric' || 
    backendStore.measurement_system === 'imperial'
  ) ? backendStore.measurement_system : 'metric';
  
  return {
    id: backendStore.id || '',
    tenantId: backendStore.tenant_id || '',
    name: backendStore.name || '',
    address: backendStore.address || '',
    phone: backendStore.phone || '',
    email: backendStore.email || '',
    currencyCode: backendStore.currency_code || 'USD',
    currencyDecimalPlaces: backendStore.currency_decimal_places || 2,
    dateFormat: backendStore.date_format || 'YYYY-MM-DD',
    timeFormat: backendStore.time_format || 'HH:mm',
    timezone: backendStore.timezone || 'UTC',
    taxConfig: backendStore.tax_config || null,
    discountApplicationPreference: discountAppPref,
    allowNegativeStock: Boolean(backendStore.allow_negative_stock),
    numberFormat: backendStore.number_format || 'en-US',
    decimalPrecision: backendStore.decimal_precision || 2,
    localeCode: backendStore.locale_code || 'en-US',
    languageCode: backendStore.language_code || 'en',
    countryCode: backendStore.country_code || 'US',
    measurementSystem,
    // Fallback to current date if not provided
    created_at: new Date().toISOString(), // Use current date as fallback for missing backend field
    updated_at: new Date().toISOString(), // Use current date as fallback for missing backend field
  };
}

// Helper function to map backend user data (snake_case) to frontend User type (camelCase)
/**
 * Comprehensive store ID resolution for users without explicit store assignment
 * Handles fallback logic for managers and other multi-store users
 */
function resolveStoreId(backendData: BackendUserForApi, tenantId: string): string | null {
  // Priority 1: Explicit store ID from backend
  if (backendData.store_id) {
    return backendData.store_id;
  }
  
  // Priority 2: Store ID from nested store object
  if (backendData.store?.id) {
    return backendData.store.id;
  }
  
  // Priority 3: Store ID from browser storage (for session persistence)
  const storedStoreId = BrowserStorage.getItem('store_id');
  if (storedStoreId && storedStoreId !== 'null' && !storedStoreId.startsWith('default-')) {
    return storedStoreId;
  }
  
  // Priority 4: For tenant-level users (admins, managers), use tenant's default store
  // This prevents API failures while maintaining proper access control
  if (tenantId) {
    return `default-${tenantId}`;
  }
  
  return null;
}

/**
 * Comprehensive role inference based on permission patterns
 * Analyzes user permissions to determine the most appropriate role
 */
function inferRoleFromPermissions(permissions: string[]): string {
  const permissionSet = new Set(permissions);
  const permissionCount = permissions.length;
  
  // Debug logging removed for cleaner console output
  
  // Admin indicators - comprehensive permissions including tenant-level access
  const adminIndicators = [
    'tenant.subscription.view',
    'tenant.subscription.upgrade',
    'tenant.subscription.manage',
    'stores.create',
    'stores.delete',
    'tenant.manage',
    'tenant.admin',
    'tenant:*'
  ];
  
  // Manager indicators - comprehensive store management but no tenant-level access
  const managerIndicators = [
    'users.create', 'users.edit', 'users.delete',
    'roles.create', 'roles.edit', 'roles.delete',
    'stores.edit', 'inventory.adjust', 'inventory.transfer',
    'dashboard.view', 'reports.view', 'analytics.view',
    'inventory.manage', 'products.manage', 'categories.manage'
  ];
  
  // Cashier indicators - limited POS and basic operations
  const cashierIndicators = [
    'sales.create', 'sales.view', 'sales.refund',
    'customers.create', 'customers.edit', 'customers.view',
    'products.view', 'inventory.view'
  ];
  
  // Count matches for each role type
  const adminMatches = adminIndicators.filter(perm => permissionSet.has(perm)).length;
  const managerMatches = managerIndicators.filter(perm => permissionSet.has(perm)).length;
  const cashierMatches = cashierIndicators.filter(perm => permissionSet.has(perm)).length;
  
  // Enhanced debug logging
  // Debug logging removed for cleaner console output
  
  // Role determination logic based on permission patterns (order matters!)
  // Check for admin first - highest privilege level
  if (adminMatches > 0 || permissionCount >= 40) {
    // Debug logging removed for cleaner console output
    return 'tenant_admin';
  }
  
  // Check for manager - comprehensive store management
  if (managerMatches >= 3 || (permissionCount >= 15 && permissionCount < 40)) {
    // Additional check for manager-specific permissions
    const hasManagerPermissions = (
      permissionSet.has('dashboard.view') && 
      (permissionSet.has('inventory.manage') || permissionSet.has('reports.view'))
    );
    
    if (hasManagerPermissions || managerMatches >= 3) {
      // Debug logging removed for cleaner console output
      return 'manager';
    }
  }
  
  // Check for cashier - limited permissions and low count
  if ((permissionCount <= 20 && cashierMatches >= 2) || 
      (permissionSet.has('sales.create') && permissionSet.has('customers.view'))) {
    // Debug logging removed for cleaner console output
    return 'cashier';
  }
  
  // Fallback for users with dashboard access but unclear role
  if (permissionSet.has('dashboard.view')) {
    // Debug logging removed for cleaner console output
    return 'employee';
  }
  
  // Debug logging removed for cleaner console output
  return 'user';
}

function mapBackendDataToUser(backendData: BackendUserForApi): User {
  // Debug logging removed for cleaner console output

  const frontendStoreObject = backendData.store ? mapBackendStoreToFrontendStore(backendData.store) : null;

  // Get roles from backend data (check all possible role fields)
  let roles: string[] = [];
  
  const rawRoles = [
    ...(Array.isArray(backendData.systemRoles) ? backendData.systemRoles : []),
    ...(Array.isArray(backendData.roles) ? backendData.roles : []),
    ...(Array.isArray(backendData.roleNames) ? backendData.roleNames : [])
  ];

  // Normalize role names (lowercase, trim, etc.)
  roles = [...new Set(rawRoles.map(role => 
    typeof role === 'string' ? role.toLowerCase().trim() : String(role).toLowerCase().trim()
  ))];
  

  
  // Get permissions from backend or fall back to localStorage
  let permissions: string[] = [];
  
  if (Array.isArray(backendData.permissions)) {
    permissions = backendData.permissions;
    // Debug logging removed for cleaner console output
  } else {
    try {
      const storedPerms = BrowserStorage.getItem('user_permissions');
      permissions = storedPerms ? JSON.parse(storedPerms) : [];
      // Debug logging removed for cleaner console output
    } catch (e) {
      console.error('[AUTH ERROR] Failed to parse stored permissions:', e);
      permissions = [];
    }
  }

  // Get tenant ID with fallback logic
  const tenantId = backendData.tenant_id || BrowserStorage.getItem('tenant_id') || '';
  
  // Enhanced store ID resolution with better logging
  const storeId = resolveStoreId(backendData, tenantId);
  // Debug logging removed for cleaner console output

  // Enhanced role determination with priority to permission-based inference
  let userRole = 'user';
  
  // Debug logging removed for cleaner console output
  
  // Check for admin permissions first (highest priority)
  const hasAdminPermissions = permissions.includes('*') || 
    permissions.some(p => p.includes('admin') || p === 'tenant.admin' || p === 'tenant:*');
    
  // Check for manager permissions (second priority)
  const hasManagerPermissions = permissions.some(p => 
    p.includes('manager') || 
    p.includes('store.admin') || 
    p === 'store.manage' ||
    p === 'store:*' ||
    p === 'inventory.manage' ||
    p === 'reports.view' ||
    p === 'dashboard.view' && permissions.length > 5 // If they have dashboard.view plus other permissions
  );
  
  // Check for explicit roles from the backend
  const normalizedRoles = roles.map(r => r.toLowerCase().trim());

  const hasAdminRole = normalizedRoles.some(r => ['admin', 'tenant_admin', 'tenant admin', 'tenantadmin'].includes(r));
  const hasManagerRole = normalizedRoles.some(r => ['manager', 'store_manager', 'store manager', 'store.admin', 'storemanager'].includes(r));
  
  // Role determination logic with priority:
  // 1. Admin permissions or roles
  // 2. Manager permissions or roles
  // 3. Explicit roles from backend
  // 4. Infer from permissions
  if (hasAdminPermissions || hasAdminRole) {
    userRole = 'tenant_admin';  // Fixed: Use tenant_admin instead of admin
  } 
  else if (hasManagerPermissions || hasManagerRole) {
    userRole = 'manager';
  }
  // If we have explicit roles but they didn't match admin/manager, use them
  else if (normalizedRoles.length > 0) {
    if (normalizedRoles.some(r => ['cashier', 'employee', 'staff'].includes(r))) {
      userRole = normalizedRoles.find(r => ['cashier', 'employee', 'staff'].includes(r)) || 'user';
    } else {
      userRole = normalizedRoles[0];
    }
    // Debug logging removed
  }
  // Finally, try to infer role from permissions if we still don't have a match
  else if (permissions.length > 0) {
    userRole = inferRoleFromPermissions(permissions);
    // Debug logging removed
  }
  
  // Final validation of the determined role
  if (!['tenant_admin', 'manager', 'cashier', 'employee', 'user'].includes(userRole)) {
    // Invalid role fallback; avoid noisy warning
    userRole = 'user';
  }

  // Capitalize the first letter of a string
  const titleCase = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '';

  // Derive the full name, using the exact name from the backend if available
  const fullName = backendData.name
    ? backendData.name
    : titleCase(backendData.username || backendData.email?.split('@')[0] || 'User');

  const user: User = {
    id: backendData.id,
    username: backendData.username || backendData.email?.split('@')[0] || 'user',
    email: backendData.email || '',
    name: fullName,
    role: userRole,
    roles: roles,
    isActive: backendData.is_active !== undefined ? backendData.is_active : true,
    tenantId: tenantId || undefined,
    storeId: storeId || undefined,
    store: frontendStoreObject,
    currencyCode: backendData.currency_code || frontendStoreObject?.currencyCode || 'USD',
    taxConfig: backendData.tax_config || null,
    discountApplicationRule: backendData.discount_application_rule || null,
    allowNegativeStock: backendData.allow_negative_stock || false,
    defaultTaxClassId: backendData.default_tax_class_id || null,
    permissions,
    systemRoles: Array.isArray(backendData.systemRoles) ? backendData.systemRoles : [],
    // Tenant onboarding status (audit Gap 3) — used by Login.tsx to
    // redirect to /onboarding when setup is incomplete.
    //
    // fetchApi auto-converts all response keys from snake_case to
    // camelCase, so the backend's `setup_completed` / `onboarding_step`
    // arrive here as `setupCompleted` / `onboardingStep`. But the User
    // type and Login.tsx / ProtectedRoute.tsx check snake_case keys.
    // Normalize both forms here so the checks work regardless of which
    // path the data came through (fetchApi camelCase vs direct assignment).
    tenant: backendData.tenant ? {
      id: backendData.tenant.id,
      name: backendData.tenant.name,
      setup_completed: (backendData.tenant as any).setup_completed
        ?? (backendData.tenant as any).setupCompleted
        ?? false,
      onboarding_step: (backendData.tenant as any).onboarding_step
        ?? (backendData.tenant as any).onboardingStep
        ?? '',
      settings: backendData.tenant.settings,
      industry_code: (backendData.tenant as any).industry_code
        ?? (backendData.tenant as any).industryCode
        ?? null
    } : null
  };

  return user;
}

/**
 * Get the current authenticated user or null if not authenticated
 */
export const getCurrentUser = async (): Promise<User | null> => {
  // Helper function to clear auth data and redirect to login
  const clearAuthAndRedirect = async (reason: string = 'No specific reason provided') => {
    console.log(`[AUTH] Clearing auth data and redirecting to login. Reason: ${reason}`);
    try {
      await logoutUser();
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== '/login') {
        // Use window.location.replace to prevent the current page from being saved in session history
        window.location.replace('/login');
      }
    } catch (error) {
      console.error('[AUTH] Error during logout/redirect:', error);
    }
    return null;
  };

  try {
    // Getting current user
    
    // Check for token first
    const token = BrowserStorage.getItem('auth_token');
    if (!token) {
      // No auth token found
      return await clearAuthAndRedirect('No authentication token found');
    }

    // Validate token format before making API calls
    try {
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        console.error('[AUTH] Invalid token format');
        return await clearAuthAndRedirect('Invalid token format');
      }

      // Check token expiration
      try {
        const payload = JSON.parse(atob(tokenParts[1]));
        const now = Math.floor(Date.now() / 1000);
        
        // Add a 5-minute buffer to prevent race conditions
        if (payload.exp && payload.exp < (now + 300)) {
          // Token near expiry — let server decide
        }
      } catch (e) {
        console.warn('[AUTH] Could not parse token payload, continuing with server validation');
      }
    } catch (e) {
      console.error('[AUTH] Error validating token:', e);
      return await clearAuthAndRedirect('Invalid token format');
    }

    // Check if we have a cached user in browser storage
    const cachedUser = BrowserStorage.getItem('currentUser');
    if (cachedUser) {
      try {
        const parsedUser = JSON.parse(cachedUser);
        const tokenExp = BrowserStorage.getItem('token_exp');
        const now = Math.floor(Date.now() / 1000);

        // If token is expired, force a refresh
        if (tokenExp && parseInt(tokenExp) < now) {
          // expired — fall through to fetch
        } else {
          // Verify the cached user has required fields
          const hasRequiredFields = parsedUser && parsedUser.id && parsedUser.email && parsedUser.role;
          const nameIsGeneric = !parsedUser?.name || parsedUser.name === 'User';
          if (hasRequiredFields && !nameIsGeneric) {
            // Validate that the cached user's tenant_id matches the
            // current JWT's tenant_id. A mismatch means the user signed
            // up / logged in as a different tenant since the cache was
            // written (e.g. deleted and recreated an account with the
            // same email) — returning the stale cached user would send
            // the wrong tenant_id to /stores/settings, which finds no
            // store and falls back to mock data.
            try {
              const tokenParts = token.split('.');
              const payload = JSON.parse(atob(tokenParts[1]));
              const tokenTenantId = payload.tenant_id || payload.tenantId;
              const cachedTenantId = parsedUser.tenantId || parsedUser.tenant_id;
              if (tokenTenantId && cachedTenantId && tokenTenantId !== cachedTenantId) {
                console.warn('[AUTH] Cached user tenant_id does not match token tenant_id — fetching fresh data');
                BrowserStorage.removeItem('currentUser');
                // Fall through to fetch fresh data
              } else {
                // Using cached user data
                return parsedUser;
              }
            } catch {
              // Can't decode token — fall through to fetch fresh data
              BrowserStorage.removeItem('currentUser');
            }
          }
        }
      } catch (e) {
        console.error('[AUTH] Failed to parse cached user data', e);
        // Clear invalid cached data
        BrowserStorage.removeItem('currentUser');
      }
    }

    // Fetch fresh user data from the server with retry logic
    const maxRetries = 3;
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        // Debug logging removed
        
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        
        // Prepare minimal headers to avoid CORS preflight issues
        const headers: HeadersInit = {
          'Authorization': `Bearer ${token}`
        };

        // Move storeId to query param to avoid custom header
        const storeId = BrowserStorage.getItem('store_id');
        const url = new URL(`${API_BASE_URL}/users/me`);
        url.searchParams.set('t', String(timestamp));
        if (storeId) url.searchParams.set('storeId', storeId);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers,
          credentials: 'include'
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[AUTH] Error ${response.status} fetching user data`);
          
          // Handle 401 Unauthorized (token expired or invalid)
          if (response.status === 401) {
            console.warn(`[AUTH] 401 Unauthorized (attempt ${retryCount + 1}/${maxRetries})`);
            // Only clear and redirect if this is the last retry
            if (retryCount >= maxRetries - 1) {
              return await clearAuthAndRedirect('Session expired or invalid');
            }
            // Otherwise, let it retry
            throw new Error('Temporary authentication failure');
          }
          
          // Handle 403 Forbidden (insufficient permissions)
          if (response.status === 403) {
            return await clearAuthAndRedirect('Insufficient permissions');
          }
          
          // Handle 429 Too Many Requests
          if (response.status === 429) {
            console.warn('[AUTH] Rate limited by server, backing off');
            // Don't retry on 429, just clear auth and redirect
            return await clearAuthAndRedirect('Too many requests. Please try again later.');
          }
          
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        // Parse response data
        const responseData = await response.json();
        
        // Extract and normalize the backend user data
        const backendUserData = getActualBackendUserData(responseData);
        if (!backendUserData) {
          throw new Error('Invalid user data received from server');
        }
        
        // Map backend data to frontend user object
        const user = mapBackendDataToUser(backendUserData);
        
        // Cache the user data in localStorage
        try {
          localStorage.setItem('currentUser', JSON.stringify(user));
          // Also store the token expiration if available
          if (responseData.expires_at) {
            localStorage.setItem('token_exp', responseData.expires_at.toString());
          }
        } catch (e) {
          console.warn('[AUTH] Failed to cache user data', e);
        }
        
        // Cache the user data with expiration
        try {
          const now = Math.floor(Date.now() / 1000);
          const expiresIn = 3600; // 1 hour
          
          // Only cache if we have valid user data
          if (user && user.id && user.email) {
            localStorage.setItem('currentUser', JSON.stringify(user));
            localStorage.setItem('user_permissions', JSON.stringify(user.permissions || []));
            localStorage.setItem('token_exp', (now + expiresIn).toString());
            
          } else {
            console.error('[AUTH] Invalid user data, not caching:', user);
            throw new Error('Invalid user data received from server');
          }
        } catch (e) {
          console.error('[AUTH] Failed to cache user data', e);
          // Don't fail the auth flow if caching fails, but log it
        }

        // If we got here, we have a valid user
        return user;
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[AUTH] Error fetching user data (attempt ${retryCount + 1}/${maxRetries}):`, errorMessage);
        
        if (retryCount < maxRetries - 1) {
          // Exponential backoff with jitter: base * 2^retryCount + random(0, 1000)
          const baseDelay = 1000; // 1 second base
          const jitter = Math.floor(Math.random() * 1000); // 0-1s random jitter
          const delay = Math.min(baseDelay * Math.pow(2, retryCount) + jitter, 10000); // Max 10s delay
          
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
        } else {
          // If we've exhausted all retries, check if we have a cached user
          const cachedUser = localStorage.getItem('currentUser');
          if (cachedUser) {
            try {
              const parsedUser = JSON.parse(cachedUser);
              // If cached name is generic, derive a better display name from username/email
              if (!parsedUser.name || parsedUser.name === 'User') {
                const localPart = (parsedUser.username || (parsedUser.email || '').split('@')[0] || '').toString();
                const titleCase = (s: string) => s ? s.replace(/[_\-.]+/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : '';
                const derived = titleCase(localPart) || 'User';
                parsedUser.name = derived;
                try { localStorage.setItem('currentUser', JSON.stringify(parsedUser)); } catch {}
              }
              console.warn('[AUTH] Using cached user data after failed retries');
              return parsedUser;
            } catch (e) {
              console.error('[AUTH] Failed to parse cached user data', e);
            }
          }
          
          // If no valid cached user, clear auth and redirect
          console.error(`[AUTH] Max retries (${maxRetries}) reached, clearing auth data`);
          return await clearAuthAndRedirect('Connection error. Please try again later.');
        }
      }
    }
    
    // If we get here, all retries failed
    console.error('[AUTH] All retry attempts failed:', lastError);
    
    // Don't redirect if we're already on the login page to prevent loops
    if (window.location.pathname === '/login') {
      console.log('[AUTH] Already on login page, not redirecting');
      return null;
    }
    
    return await clearAuthAndRedirect('Failed to authenticate after multiple attempts');
  } catch (error) {
    console.error('[AUTH] Fatal error in getCurrentUser:', error);
    
    // Don't redirect if we're already on the login page to prevent loops
    if (window.location.pathname === '/login') {
      console.log('[AUTH] Already on login page, not redirecting');
      return null;
    }
    
    // If this was a 401, clear the token and redirect to login
    if (error && typeof error === 'object' && 'status' in error) {
      if (error.status === 401) {
        console.error('Response status:', error.status);
        localStorage.removeItem('auth_token');
      } else if (error.status === 429) {
        return await clearAuthAndRedirect('Too many requests. Please wait before trying again.');
      }
    }
    
    // Fallback error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return await clearAuthAndRedirect(`Authentication failed: ${errorMessage}`);
  }
};