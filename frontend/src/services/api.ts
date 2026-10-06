// API service to communicate with the backend server
/**
 * API Service
 * 
 * IMPORTANT: This service automatically handles case conversion between frontend and backend:
 * - Requests: All JSON request bodies are converted from camelCase to snake_case
 * - Responses: All JSON responses are converted from snake_case to camelCase
 * 
 * This means:
 * 1. Always use camelCase in your frontend code
 * 2. The backend can continue using snake_case
 * 3. No manual conversion is needed anywhere else in the application
 */

import { 
  TaxClass, 
  TaxClassRate, 
  Customer, 
  NewCustomerData, 
  StoreDetails, 
  Category, 
  TaxClassesResponsePayload,
  UserMeResponseData,
  Store,
  Sale, // Added Sale type for getSale response
  DateSalesData,
  CategorySalesSummaryItem
} from '@/types/index';

// Import our JWT utility
import { decodeToken } from '@/utils/jwt';
import { checkJwtSecretSync } from '@/utils/jwtSync';
import { transformApiImageUrls } from '@/utils/imageUtils';

// Base URL from environment variables with fallback
// VITE_API_BASE_URL should be the server root WITHOUT a trailing /api (e.g. https://api.zettaz.com)
// The buildApiUrl function adds /api automatically.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5172')
  .replace(/\/api\/?$/, ''); // strip trailing /api if someone included it

// Build full API URL safely, ensuring the '/api' prefix exists when needed
const buildApiUrl = (endpoint: string): string => {
  // Absolute endpoints pass through
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;

  const base = API_BASE_URL || '';
  const baseEndsWithApi = /\/api\/?$/.test(base);
  const endpointStartsWithApi = endpoint.startsWith('/api');

  // Ensure exactly one slash between parts
  if (baseEndsWithApi) {
    return `${base}${endpoint}`;
  }
  // If base lacks '/api', add it unless endpoint already has it
  const apiPrefix = endpointStartsWithApi ? '' : '/api';
  return `${base}${apiPrefix}${endpoint}`;
};

// Check JWT configuration synchronization on startup, but only in dev mode
if (process.env.NODE_ENV === 'development') {
  checkJwtSecretSync().then(result => {
    if (!result.isInSync) {
      console.warn('⚠️ JWT Secret Mismatch:', result.message);
      console.warn('This may cause authentication errors. Ensure frontend VITE_JWT_SECRET matches backend JWT_SECRET.');
    } else {
      try {
        if (localStorage.getItem('debug-api') === 'true') {
          // Debug logging removed for cleaner console output
        }
      } catch (e) {
        // Ignore localStorage errors in strict browsers like Chromium
      }
    }
  }).catch(error => {
    console.error('Failed to check JWT secret sync:', error);
  });
}

// Helper interfaces for type casting unknown data
interface ErrorPayload {
  message?: string;
  error?: string;
  errorDetail?: string;
}

interface BackendResponseWrapper<DataType> {
  status?: 'success' | 'error';
  data?: DataType;
  message?: string;
  error?: string;
  token?: string;
}

// Utility function to convert camelCase keys to snake_case
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toSnakeCase = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return Object.keys(obj).reduce((acc: any, key) => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    acc[snakeKey] = toSnakeCase(obj[key]);
    return acc;
  }, {});
};

// Utility to convert object keys from snake_case to camelCase
const toCamelCase = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
    acc[camelKey] = toCamelCase(obj[key]);
    return acc;
  }, {} as any);
};

// Simple perf toggle helpers (set localStorage['debug-perf'] or ['measure-login-perf'] to 'true' to enable)
const isPerfEnabled = (): boolean => {
  try {
    return localStorage.getItem('debug-perf') === 'true' || localStorage.getItem('measure-login-perf') === 'true';
  } catch {
    return false;
  }
};
const shouldHighlightEndpoint = (url: string): boolean => {
  return /\/auth\/login|\/dashboard|\/users\/me/.test(url);
};

/**
 * Core API fetching function that handles authentication and error handling.
 * It now also intelligently unwraps responses from backend that use a { status: 'success', data: ... } structure.
 */
export const fetchApi = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> => {
  // Build URL with safe '/api' handling
  const apiUrl = buildApiUrl(endpoint);

  // Perf: mark start
  const perfOn = isPerfEnabled();
  const perfStart = perfOn ? performance.now() : 0;
  const perfLabel = perfOn ? `${(options.method || 'GET').toString()} ${apiUrl}` : '';

  const token = localStorage.getItem('auth_token');
  
  // Check if token exists and is not expired
  if (token) {
    try {
      const decoded = decodeToken(token);
      if (decoded && decoded.exp && decoded.exp < Date.now() / 1000) {
        console.warn('Auth token has expired, redirecting to login');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('user');
        
        if (typeof window !== 'undefined' && !window.location.pathname.includes('login')) {
          window.location.href = '/login';
        }
        
        return Promise.reject(new Error('Auth token has expired'));
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      // Don't fail the request if token decoding fails, let the server handle it
    }
  }

  const finalHeaders = new Headers(); // Start with empty headers

  let explicitContentType: string | null = null;

  // First, copy all headers from options.headers, extracting explicit Content-Type if present
  if (options.headers) {
    // Normalize options.headers to a Headers object to easily check/get values
    const providedHeaders = new Headers(options.headers);
    providedHeaders.forEach((value, key) => {
      if (key.toLowerCase() === 'content-type') {
        explicitContentType = value;
      } else {
        finalHeaders.append(key, value);
      }
    });

    // Mirror tenant/store headers for backend compatibility if only one variant provided
    const hasTenantId = finalHeaders.has('tenant-id');
    const hasXTenantId = finalHeaders.has('x-tenant-id');
    if (hasTenantId && !hasXTenantId) {
      finalHeaders.set('x-tenant-id', finalHeaders.get('tenant-id') || '');
    } else if (hasXTenantId && !hasTenantId) {
      finalHeaders.set('tenant-id', finalHeaders.get('x-tenant-id') || '');
    }

    const hasStoreId = finalHeaders.has('store-id');
    const hasXStoreId = finalHeaders.has('x-store-id');
    if (hasStoreId && !hasXStoreId) {
      finalHeaders.set('x-store-id', finalHeaders.get('store-id') || '');
    } else if (hasXStoreId && !hasStoreId) {
      finalHeaders.set('store-id', finalHeaders.get('x-store-id') || '');
    }
  }

  // Now, set the Content-Type based on what was found or defaults
  if (options.body instanceof FormData) {
    // For FormData, let the browser set the Content-Type (including boundary)
    // If an explicit Content-Type was provided for FormData (unusual), it would have been captured
    // but typically we don't set it here, browser does it best.
    // If explicitContentType was set for FormData, we might need to decide if we honor it or clear it.
    // For now, if it's FormData, we assume browser handles it, so we don't explicitly set finalHeaders.set('Content-Type', ...)
    // unless explicitContentType was specifically for FormData.
    if (explicitContentType) {
        finalHeaders.set('Content-Type', explicitContentType);
    }
  } else {
    // For non-FormData requests
    if (explicitContentType) {
      finalHeaders.set('Content-Type', explicitContentType); // Use Content-Type from options.headers
    } else {
      finalHeaders.set('Content-Type', 'application/json'); // Default to application/json
    }
  }

  // Add authentication token if available. The CURRENT TOKEN is the source of
  // truth for tenant/store scope — it's decoded and applied to headers FIRST,
  // before localStorage's cached 'tenant_id'/'store_id' keys are consulted as
  // a fallback only for whatever the token didn't have. This ordering used to
  // be reversed (localStorage first, token as fallback), which meant that any
  // code path that minted a fresh token without ALSO updating localStorage's
  // 'tenant_id'/'store_id' (switchStore() was one such path — now fixed, but
  // any future one would reproduce this) left every subsequent request
  // sending a stale store-id header that no longer matched the new token's
  // store_id, tripping routes like GET /api/jurisdiction/current's
  // "Requested store is outside your access scope" check. Deriving from the
  // token first makes that whole class of drift impossible, regardless of
  // whether some other code path forgets the localStorage write.
  if (token) {
    finalHeaders.set('Authorization', `Bearer ${token}`);

    try {
      const payload = decodeToken(token);

      if (payload) {
        if (payload.tenant_id && !finalHeaders.has('x-tenant-id')) {
          finalHeaders.set('x-tenant-id', payload.tenant_id);
          if (!finalHeaders.has('tenant-id')) finalHeaders.set('tenant-id', payload.tenant_id);
        }

        if (payload.store_id && !finalHeaders.has('store-id')) {
          finalHeaders.set('store-id', payload.store_id);
          if (!finalHeaders.has('x-store-id')) finalHeaders.set('x-store-id', payload.store_id);
        }

        // Note: Do NOT inject a synthetic default store ID. If no valid store is available,
        // allow the backend to respond with a 400, which is safer than inserting invalid IDs.
      }
    } catch (e) {
      console.warn('Failed to parse token for tenant/store ID:', e);
    }
  }

  // Fall back to localStorage's cached tenant/store IDs only for whatever the
  // token above didn't already supply (e.g. no token present at all).
  const storedTenantId = localStorage.getItem('tenant_id');
  const storedStoreId = localStorage.getItem('store_id');

  if (storedTenantId && !finalHeaders.has('x-tenant-id')) {
    finalHeaders.set('x-tenant-id', storedTenantId);
    if (!finalHeaders.has('tenant-id')) finalHeaders.set('tenant-id', storedTenantId);
  }

  if (storedStoreId && !finalHeaders.has('store-id')) {
    finalHeaders.set('store-id', storedStoreId);
    if (!finalHeaders.has('x-store-id')) finalHeaders.set('x-store-id', storedStoreId);
  }

  if (!token) {
    console.warn('No authentication token available for API request');
    // Do not fabricate a store-id here either; backend should enforce presence/validity.
  }
  
  // Log final headers for debugging
  if (process.env.NODE_ENV === 'development' && localStorage.getItem('debug-api') === 'true') {
    // Debug logging removed for cleaner console output
  }

  // Process the request body - convert from camelCase to snake_case when sending JSON
  let finalBody = options.body;
  if (finalBody && typeof finalBody === 'string' && (!explicitContentType || explicitContentType === 'application/json')) {
    try {
      // Try to parse the body as JSON
      const parsedBody = JSON.parse(finalBody);
      // Convert to snake_case
      const snakeCaseBody = toSnakeCase(parsedBody);
      // Stringify back to JSON
      finalBody = JSON.stringify(snakeCaseBody);
    } catch (e) {
      // If parsing fails, leave the body as is
      console.warn('Failed to parse request body as JSON for snake_case conversion', e);
    }
  }

  const finalOptions: RequestInit = {
    ...options,
    body: finalBody,
    headers: finalHeaders,
    credentials: 'include',
  };

  try {
    let response;
    try {
      // Log the request details for debugging
      if (process.env.NODE_ENV === 'development' || localStorage.getItem('debug-api') === 'true') {
        // Debug logging removed for cleaner console output
        // Debug logging removed for cleaner console output
        // Debug logging removed for cleaner console output
        // Debug logging removed for cleaner console output
        if (finalBody) {
          // Debug logging removed for cleaner console output
        }
        // Debug logging removed for cleaner console output
      }
      
      response = await fetch(apiUrl, finalOptions);
    } catch (fetchError) {
      console.error('[fetchApi] NATIVE FETCH ERROR:', fetchError);
      // Potentially re-throw or handle as a specific type of error to be caught by the outer block
      throw fetchError; // Re-throw to be caught by the outer catch
    }

    // Perf: record duration for successful fetch (before parsing)
    if (perfOn) {
      const dur = performance.now() - perfStart;
      const highlight = shouldHighlightEndpoint(apiUrl);
      // Log concise perf line; highlight key endpoints
      if (highlight) {
        console.info(`[PERF] ${perfLabel} -> ${dur.toFixed(0)}ms`);
      } else if (localStorage.getItem('debug-perf') === 'true') {
        console.debug(`[perf] ${perfLabel} -> ${dur.toFixed(0)}ms`);
      }
      // Create a PerformanceEntry for tooling
      try {
        performance.measure(perfLabel, { start: perfStart, end: performance.now() });
      } catch { /* ignore */ }
    }
    
    let responseBody: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseBody = await response.json().catch(() => {
        console.error('Failed to parse JSON response:');
        throw new Error(`Failed to parse response from ${apiUrl}. Status: ${response.status}`);
      });
    } else {
      responseBody = await response.text();
    }
    
    if (!response.ok) {
      let errorData: unknown;
      if (typeof responseBody === 'object' && responseBody !== null) {
        errorData = responseBody;
      } else if (typeof responseBody === 'string') {
        try {
          errorData = JSON.parse(responseBody);
        } catch {
          errorData = { message: `Request failed with status ${response.status}. Not a JSON response.`, errorDetail: responseBody } as ErrorPayload;
        }
      } else {
        errorData = { message: `Request failed with status ${response.status}. Unexpected error response type.`, errorDetail: String(responseBody) } as ErrorPayload;
      }
      
      // Special handling for 401 Unauthorized
      // A 401 from the auth endpoints themselves (login, 2FA verify, etc.) is
      // an expected "invalid credentials" response, not an expired-session
      // signal — force-redirecting here wiped the page (and the console/
      // network state) before Login.tsx's own catch block could ever render
      // the "Invalid credentials" message, making a bad password look like a
      // silent, unexplained refresh. Only treat 401s from OTHER endpoints as
      // a signal that the current session/token is no longer valid.
      const isAuthEndpoint = /\/api\/auth\/(login|register|2fa)/i.test(apiUrl);
      if (response.status === 401 && !isAuthEndpoint) {
        console.error('[fetchApi] 401 Unauthorized - Possible issues:', {
          hasToken: !!token,
          tokenLength: token?.length,
          tokenPrefix: token?.substring(0, 10) + '...',
          url: apiUrl,
          method: finalOptions.method || 'GET',
          headers: Object.fromEntries(finalHeaders.entries()),
          response: errorData
        });

        // Clear invalid token and reload the page to trigger re-authentication
        localStorage.removeItem('auth_token');
        localStorage.removeItem('currentUser');
        window.location.href = '/login';
      }

      const typedErrorData = errorData as ErrorPayload & { errors?: Record<string, string> };
      // Prefer the backend's explicit message/error field so the user sees a
      // meaningful message (e.g. "Invalid credentials.") rather than a generic
      // "Request failed with status 401." — the latter also contained "401",
      // which used to trigger the outer catch block's logout-redirect logic.
      const apiError = new Error(typedErrorData.message || typedErrorData.error || `Request failed with status ${response.status}.`) as Error & {
        status?: number;
        errors?: Record<string, string>;
        response?: unknown;
      };
      apiError.status = response.status;
      apiError.errors = typedErrorData.errors;
      apiError.response = errorData;
      throw apiError;
    }

    // Handle cases where response.ok is true but responseBody is empty (e.g., 204 No Content)
    if (response.status === 204 || responseBody === '' || responseBody === null || responseBody === undefined) {
      return undefined as T; // Return undefined for void or optional types
    }
    
    // If responseBody is already an object (from response.json())
    if (typeof responseBody === 'object' && responseBody !== null) {
      // Convert snake_case keys to camelCase for the entire response
      const camelCaseResponse = toCamelCase(responseBody);
      
      // Now check if it's a wrapped response with status/data structure
      const wrappedResponse = camelCaseResponse as BackendResponseWrapper<T>;
      if (wrappedResponse.status === 'error') {
        throw new Error(wrappedResponse.message || `API error: ${wrappedResponse.error || 'Unknown error'}`);
      }
      
      // If the response explicitly has a "status: 'success'" and a "data" field,
      // then we assume it's the wrapped structure and return the "data" field.
      // Otherwise, we assume the entire camelCaseResponse is the actual data (T).
      if (wrappedResponse.status === 'success' && typeof wrappedResponse.data !== 'undefined') {
        // This assumes that if status === 'success', then wrappedResponse.data is indeed of type T.
        // This is the convention for BackendResponseWrapper<T> where T is the type of the 'data' field.
        return wrappedResponse.data as T; 
      } else {
        // If no 'status: "success"' or if 'data' is undefined even with 'status: "success"' (which would be odd),
        // or if 'status' is not present at all (like our paginated responses),
        // then the entire camelCaseResponse is considered to be of type T.
        return camelCaseResponse as T;
      }
    } 
    // If responseBody is a string (e.g. content-type was not application/json)
    else if (typeof responseBody === 'string') {
      try {
        // Parse string to JSON and convert snake_case to camelCase
        const parsedData = toCamelCase(JSON.parse(responseBody)) as BackendResponseWrapper<T>;
        if (parsedData.status === 'error') {
          throw new Error(parsedData.message || `API error: ${parsedData.error || 'Unknown error'}`);
        }
        if (parsedData.data !== undefined || parsedData.status === 'success') {
          return parsedData.data as T; 
        } else {
          return parsedData as unknown as T; // If parsedData itself is T
        }
      } catch (error) {
        // If parsing failed, but T is string, return the raw string. Otherwise, it's an issue.
        if (typeof '' === typeof ({} as T)) { // Heuristic: if T could be string
           return responseBody as T;
        }
        console.error(`API Error: Successfully fetched but failed to parse/interpret string responseBody from ${apiUrl}`, error, 'Response Body:', responseBody);
        throw new Error('Failed to parse or interpret string response from server.');
      }
    } 
    // Fallback for any other unexpected type for responseBody
    else {
      console.error(`API Error: Unexpected type for responseBody from ${apiUrl}`, typeof responseBody, 'Response Body:', responseBody);
      throw new Error('Received unexpected response type from server.');
    }
  } catch (error: unknown) { // Catch errors from fetch itself or errors thrown above
    console.error(`Error in fetchApi for ${apiUrl}:`, error);
    
    // More detailed error handling
    let errorMessage = 'An API error occurred.';
    let shouldLogout = false;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Handle network errors
      if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      }
      
      // Handle token expiration/invalidation
      // IMPORTANT: must exclude auth endpoints (login, register, 2FA) — a 401
      // from those is an expected "invalid credentials" response, not an
      // expired session. Without this guard, the fallback error message
      // ("Request failed with status 401...") contains "401", which triggers
      // shouldLogout → window.location.href = '/login', causing a full page
      // redirect that wipes Login.tsx's error message before the user can
      // read it — making a wrong password look like a silent refresh.
      const isAuthEndpoint = /\/api\/auth\/(login|register|2fa)/i.test(apiUrl);
      if (!isAuthEndpoint && (error.message.includes('401') || error.message.includes('Unauthorized'))) {
        errorMessage = 'Your session has expired. Please log in again.';
        shouldLogout = true;
      }
    }
    
    // Log the full error in development
    if (process.env.NODE_ENV === 'development' || localStorage.getItem('debug-api') === 'true') {
      console.group('API Error Details');
      console.error('Error:', error);
      console.error('URL:', apiUrl);
      console.error('Method:', options.method || 'GET');
      console.error('Headers:', Object.fromEntries(finalHeaders.entries()));
      console.groupEnd();
    }
    
    // Force logout if token is invalid
    if (shouldLogout) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('currentUser');
      window.location.href = '/login';
    }
    
    // Re-throw the error with the appropriate message
    if (error instanceof Error) {
      error.message = errorMessage;
      throw error;
    }
    throw new Error(errorMessage);
  }
}; 

// Auth API
export const login = async (email: string, password: string): Promise<UserMeResponseData> => {
  try {
    const response = await fetchApi<UserMeResponseData>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    // Simplified token handling: fetchApi returns UserMeResponseData directly.
    if (response && response.token) {
      localStorage.setItem('auth_token', response.token);
      // Persist tenant and store IDs for header injection in subsequent requests
      try {
        const user = (response as any).user || {};
        const tenantId = user.tenantId || user.tenant_id;
        const storeId = user.storeId || user.store_id;
        if (tenantId) {
          localStorage.setItem('tenant_id', tenantId);
        }
        if (storeId) {
          localStorage.setItem('store_id', storeId);
        }
        // Optionally persist user for app-wide access
        localStorage.setItem('currentUser', JSON.stringify(user));
      } catch {
        // Swallow storage errors silently
      }
    } else {
      // This case might indicate an issue if a token is always expected upon successful login.
      // However, UserMeResponseData shows token is optional.
      console.warn('Login response did not contain a token or response was null/undefined.');
      // Depending on requirements, you might throw an error here if a token is mandatory for a successful login flow.
      // For now, we proceed, allowing for scenarios where login might not immediately yield a token.
    }
    
    return response; // Return the full UserMeResponseData object
  } catch (error) {
    console.error('Login API error:', error);
    throw error;
  }
};
export const logout = () => {
  localStorage.removeItem('auth_token');
  return Promise.resolve({ status: 'success' } as const);
};

// Store/Tenant API
export const getStoreDetails = async (storeId: string): Promise<StoreDetails> => {
  const storeDataFromApi = await fetchApi<any>(`/stores/${storeId}`); // Fetch as any first
  return toCamelCase(storeDataFromApi) as StoreDetails; // Then transform and cast
};

export const getStoreData = async (tenantId: string): Promise<Store> => {
  return fetchApi<Store>(`/stores/settings?tenant_id=${tenantId}`);
}

export const updateStoreData = async (storeData: Partial<Store> & { id: string }): Promise<Store> => {
  // Add debug logging to see the conversion
  const snakeCaseData = toSnakeCase(storeData);
  // console.log('Original store data (camelCase):', storeData);
  // console.log('Converted to snake_case:', snakeCaseData);
  
  return fetchApi<Store>(`/stores/${storeData.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snakeCaseData)
  });
};

// Categories API
// Removed local Category type definition, will use Category from '@/types'
export const getCategories = async (status?: 'active' | 'inactive' | 'all'): Promise<Category[]> => {
  const queryParam = status ? `?status=${status}` : '';
  const categories = await fetchApi<Category[]>(`/categories${queryParam}`);
  return transformApiImageUrls(categories) as Category[];
};

// Sales API

/**
 * Fetches a single sale by its ID.
 * @param saleId The ID of the sale to fetch.
 * @returns A Promise resolving to the Sale object.
 */
export const getSale = async (saleId: string): Promise<Sale> => {
  return fetchApi<Sale>(`/sales/${saleId}`);
};

export type SaleItem = { productId: string; quantity: number; price: number; discount?: number; };
export type CreateSaleData = { 
  items: SaleItem[]; 
  tenantId?: string; 
  store_id?: string;         
  cashier_id?: string;       
  subtotal?: number;
  tax?: number;
  totalAmount?: number;      
  customerId?: string;
  customer_id?: string; // Added snake_case alternative for backend compatibility
  employeeId?: string;
  employee_id?: string; // Sales employee credited for commission/targets
  paymentMethodId: string;
  payment_method_id?: string; // Snake case version for backend compatibility  
  // Discount fields - both camelCase and snake_case versions
  discount?: number;         // Calculated discount amount
  discountAmount?: number;   // Alias for discount
  discount_amount?: number;  // Snake case version
  discountType?: 'percentage' | 'fixed';
  discountValue?: number; // The rate (e.g., 10 for 10%) or fixed amount
  taxRate?: number;
  notes?: string; 
  // Promotions payloads computed on the client; backend normalization accepts any of these
  promoResult?: any;
  promotions?: any;
  cartPromotions?: any;
  // Duty-free traveller capture (Sales Hub) — absent on an ordinary sale.
  // See createSaleController.js and docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md.
  travellerIdType?: 'passport' | 'national_id' | 'seaman_book' | 'other';
  travellerIdNumber?: string;
  travellerIdCountry?: string;
  travelMethodType?: 'flight' | 'vessel' | 'other';
  travelMethodRef?: string;
  travelMethodDetail?: string;
  destination?: string;
  departureDate?: string;
};

export const createSale = async (saleData: CreateSaleData) => fetchApi<{ saleId: string }>('/sales', { method: 'POST', body: JSON.stringify(saleData) });

export const getSalesSummary = async (): Promise<{
  totalSales: number;
  totalItems: number;
  totalRevenue: number;
  averageOrderValue: number;
  totalRevenueThisMonth: number;
}> => {
  // Get store ID and tenant ID from localStorage
  const storeId = localStorage.getItem('store_id');
  const tenantId = localStorage.getItem('tenant_id');
  
  // Build headers with required IDs
  const headers: Record<string, string> = {};
  if (tenantId) headers['tenant-id'] = tenantId;
  if (storeId) headers['store-id'] = storeId;
  
  return fetchApi('/sales/summary', { headers });
};

// Fetch sales data for charts
export const getSalesChartData = async (filters: { startDate: string, endDate: string }): Promise<DateSalesData[]> => {
  const queryParams = new URLSearchParams({
    startDate: filters.startDate,
    endDate: filters.endDate
  });
  
  return fetchApi<DateSalesData[]>(`/reports/sales/chart?${queryParams.toString()}`);
};

export const getCategorySalesSummary = async (): Promise<CategorySalesSummaryItem[]> => {
  // TODO: Backend endpoint /reports/sales/categories doesn't exist yet
  // Available endpoints are /reports/sales/transactions and /reports/sales/chart (both require date params)
  // Providing fallback empty data for now to prevent dashboard 404 errors
  try {
    // Attempt to call the endpoint in case it gets implemented
    return await fetchApi<CategorySalesSummaryItem[]>(`/reports/sales/categories`);
  } catch (error) {
    // Fallback to empty data if endpoint doesn't exist (404 error)
    console.warn('[getCategorySalesSummary] Backend endpoint not available, using fallback empty data');
    return [];
  }
};  

// Payment API
export interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  requires_terminal?: boolean;
  sort_order: number;
};
export const getPaymentMethods = async (): Promise<PaymentMethod[]> => fetchApi<PaymentMethod[]>(`/payment/methods`);
type ProcessPaymentData = { saleId: string; paymentMethodId: string; amount: number; tenderAmount: number; metadata?: Record<string, unknown>; };
type ProcessPaymentResponse = { status: 'success' | 'failed' | 'pending'; transactionId: string; message?: string; };
export const processPayment = async (paymentData: ProcessPaymentData) => fetchApi<ProcessPaymentResponse>('/payment/process', { method: 'POST', body: JSON.stringify(paymentData) });

// Tax Classes API
export const getTaxClasses = async (): Promise<TaxClassesResponsePayload> => fetchApi<TaxClassesResponsePayload>('/v1/settings/taxes/classes');
export const createTaxClass = async (data: Pick<TaxClass, 'name' | 'isActive'>): Promise<TaxClass> => 
  fetchApi<TaxClass>('/v1/settings/taxes/classes', { method: 'POST', body: JSON.stringify(data) });
export const updateTaxClass = async (id: string, data: Partial<Pick<TaxClass, 'name' | 'isActive'>>): Promise<TaxClass> => 
  fetchApi<TaxClass>(`/v1/settings/taxes/classes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTaxClass = async (id: string): Promise<{message?: string}> => 
  fetchApi<{message?: string}>(`/v1/settings/taxes/classes/${id}`, { method: 'DELETE' });

// Store Tax Configuration API
export const getStoreTaxConfig = async (): Promise<{
  storeId: string;
  defaultTaxClassId: string | null;
  pricesIncludeTax: boolean;
  defaultTaxBasis: 'INCLUSIVE' | 'EXCLUSIVE';
  taxClasses: TaxClass[];
  defaultTaxRates: TaxClassRate[];
}> => fetchApi<any>('/v1/settings/taxes/store-config');

// Product Tax Class API
export const getProductTaxClass = async (productId: string): Promise<{
  productId: string;
  productName: string;
  taxClassId: string | null;
  taxClassName: string | null;
  isTenantWide: boolean;
  availableTaxClasses: TaxClass[];
  currentTaxRates: TaxClassRate[];
}> => fetchApi<any>(`/v1/settings/taxes/product/${productId}`);

export const updateProductTaxClass = async (productId: string, taxClassId: string | null): Promise<{
  productId: string;
  productName: string;
  taxClassId: string | null;
  taxClassName: string | null;
}> => {
  const requestBody = { product_id: productId, tax_class_id: taxClassId };
  return fetchApi<any>('/v1/settings/taxes/product-tax-class', {
  method: 'PUT',
  body: JSON.stringify(requestBody)
  });
};

// Customers API
interface CustomersResponse { customers: Customer[] }

/** Map snake_case DB row → camelCase Customer type */
const mapCustomer = (r: any): Customer => ({
  ...r,
  customerCode:       r.customerCode       ?? r.customer_code       ?? null,
  firstName:          r.firstName          ?? r.first_name          ?? '',
  lastName:           r.lastName           ?? r.last_name           ?? null,
  phoneNumber:        r.phoneNumber        ?? r.phone_number        ?? null,
  customerType:       r.customerType       ?? r.customer_type       ?? 'INDIVIDUAL',
  isActive:           r.isActive           ?? r.is_active           ?? true,
  companyName:        r.companyName        ?? r.company_name        ?? null,
  creditLimit:        r.creditLimit        ?? r.credit_limit        ?? null,
  outstandingCredit:  r.outstandingCredit  ?? r.outstanding_credit  ?? null,
  isTaxExempt:        r.isTaxExempt        ?? r.is_tax_exempt       ?? false,
  defaultDiscountType:  r.defaultDiscountType  ?? r.default_discount_type  ?? null,
  defaultDiscountValue: r.defaultDiscountValue ?? r.default_discount_value ?? null,
  dateOfBirth:        r.dateOfBirth        ?? r.dob                 ?? r.birthDate ?? null,
  createdAt:          r.createdAt          ?? r.created_at          ?? '',
  updatedAt:          r.updatedAt          ?? r.updated_at          ?? '',
});

export const getCustomers = async (): Promise<CustomersResponse> => {
  const res = await fetchApi<any>('/customers');
  const raw = res?.customers ?? res ?? [];
  return { customers: Array.isArray(raw) ? raw.map(mapCustomer) : [] };
};

export const getCustomer = async (id: string): Promise<Customer> => {
  const res = await fetchApi<any>(`/customers/${id}`);
  const raw = res?.customer ?? res;
  return mapCustomer(raw);
};
export const createCustomer = async (customerData: NewCustomerData): Promise<Customer> => 
  fetchApi<Customer>('/customers', { method: 'POST', body: JSON.stringify(customerData) });
export const updateCustomer = async (id: string, customerData: Partial<NewCustomerData>): Promise<Customer> => 
  fetchApi<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(customerData) });
export const deleteCustomer = async (id: string): Promise<{message?: string}> => 
  fetchApi<{message?: string}>(`/customers/${id}`, { method: 'DELETE' });

// Tax Class Rates API
export const getTaxClassRates = async (taxClassId: string): Promise<TaxClassRate[]> => 
  fetchApi<TaxClassRate[]>(`/v1/settings/taxes/classes/${taxClassId}/rates`);

export const createTaxClassRate = async (taxClassId: string, data: Pick<TaxClassRate, 'taxRateName' | 'rate' | 'priority' | 'isCompound'>): Promise<TaxClassRate> => 
  fetchApi<TaxClassRate>(`/v1/settings/taxes/classes/${taxClassId}/rates`, { method: 'POST', body: JSON.stringify(data) });
export const updateTaxClassRate = async (rateId: string, data: Partial<Pick<TaxClassRate, 'taxRateName' | 'rate' | 'priority' | 'isCompound'>>): Promise<TaxClassRate> => 
  fetchApi<TaxClassRate>(`/v1/settings/taxes/rates/${rateId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTaxClassRate = async (rateId: string): Promise<{message?: string}> => 
  fetchApi<{message?: string}>(`/v1/settings/taxes/rates/${rateId}`, { method: 'DELETE' });

// Customer API
export const addCustomer = async (customerData: Partial<Customer>): Promise<Customer> => {
  // Ensure essential fields are at least null if not provided, to match backend expectations if any
  const payload: Partial<Customer> = {
    firstName: '', // Default to empty string if not provided
    lastName: '',  // Default to empty string if not provided
    email: null,
    phoneNumber: null,
    customerType: 'INDIVIDUAL', // Default type
    creditLimit: 0,
    isTaxExempt: false, // Default to not tax exempt
    // ... include other fields that have defaults or should be explicitly null
    ...customerData,
  };

  const snakeCasePayload = toSnakeCase(payload);

  try {
    const newCustomerFromApi = await fetchApi<any>('/customers', {
      method: 'POST',
      body: JSON.stringify(snakeCasePayload),
    });

    if (newCustomerFromApi && newCustomerFromApi.customer) {
      const camelCaseCustomerData = toCamelCase(newCustomerFromApi.customer);
      return camelCaseCustomerData as Customer;
    } else if (newCustomerFromApi && !newCustomerFromApi.customer) {
      // If the response is an object but doesn't have the 'customer' key as expected,
      // it might be that the backend is returning the customer object directly.
      // This was the case before a previous refactor, so let's handle it gracefully.
      const camelCaseCustomerData = toCamelCase(newCustomerFromApi);
      return camelCaseCustomerData as Customer;
    }

    throw new Error('Failed to add customer or unexpected response structure.');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to add customer: ${error.message}`);
    }
    throw new Error('An unknown error occurred while adding the customer.');
  }
};

// Function to search for customers
export const searchCustomers = async (term: string): Promise<Customer[]> => {
  try {
    // Ensure the term is URL encoded to handle special characters
    const encodedTerm = encodeURIComponent(term);
    // Use the imported Customer type here
    const response = await fetchApi<Customer[] | { customers: Customer[] }>(`/customers/search?term=${encodedTerm}`);

    if (response) {
      
      // Check if the data is an object with a 'customers' array property
      if (typeof response === 'object' && response !== null && Array.isArray((response as { customers: Customer[] }).customers)) {
        const customersArray = (response as { customers: Customer[] }).customers;
        // Optional: Log if discount fields are missing (should now be present if backend sends them)
        if (customersArray.length > 0) {
          const firstCustomer = customersArray[0];
          if (firstCustomer.defaultDiscountType === undefined || firstCustomer.defaultDiscountValue === undefined) { 
            console.warn('Search result: Customer item might still be missing defaultDiscountType or defaultDiscountValue:', firstCustomer);
          }
        }
        return customersArray;
      } else if (Array.isArray(response)) {
        // Fallback if response is directly the array
        const customersArray = response as Customer[];
        if (customersArray.length > 0) {
          const firstCustomer = customersArray[0];
          if (firstCustomer.defaultDiscountType === undefined || firstCustomer.defaultDiscountValue === undefined) { 
            console.warn('Search result (direct array): Customer item might still be missing defaultDiscountType or defaultDiscountValue:', firstCustomer);
          }
        }
        return customersArray;
      }
      
      console.warn('Customer search response is not in expected format (array or {customers: array}):', response);
      return []; // Return empty if data is not in an expected format
    } else {
      console.error('Failed to search customers or no data returned:', 'No data');
      return []; // Return an empty array on failure or if no data
    }
  } catch (error) {
    console.error('Error in searchCustomers API call:', error);
    throw error;
  }
};

// Misc
export const testDatabaseConnection = async () => fetchApi<{ ok: boolean; message?: string }>('/test-connection');
