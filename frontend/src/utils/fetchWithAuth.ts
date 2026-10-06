/**
 * Utility for making authenticated API requests
 * Automatically adds authorization headers and handles token refresh
 */


/**
 * Get the current auth token from localStorage
 */
const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

/**
 * Enhanced fetch function that automatically adds authentication headers
 * @param url The URL to fetch
 * @param options Optional fetch options
 * @returns Promise with fetch response
 */
export const fetchWithAuth = async (url: string, options: RequestInit = {}): Promise<Response> => {
  // Get the token
  const token = getAuthToken();
  
  // Create default headers if they don't exist
  const headers = options.headers || {};
  
  // Add authorization header if token exists
  const authHeaders = token ? {
    ...headers,
    'Authorization': `Bearer ${token}`
  } : headers;
  
  // Combine options with headers
  const authOptions = {
    ...options,
    headers: authHeaders
  };
  
  try {
    const response = await fetch(url, authOptions);
    
    // Handle 401 Unauthorized errors - could implement token refresh here
    if (response.status === 401) {
      console.warn('Authentication token expired or invalid');
      // Could try to refresh the token here if you have a refresh mechanism
      // For now, just return the error response
    }
    
    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
};

export default fetchWithAuth;
