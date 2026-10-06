import { useState, useEffect, useCallback, useRef } from 'react';

export interface CachedDataState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

/**
 * A generic hook for fetching and caching data with configurable TTL.
 * 
 * @param fetchFn The function that fetches the data
 * @param key A unique key to identify this data in the cache
 * @param ttlMs Time-to-live in milliseconds for cached data
 * @param initialData Optional initial data
 * @returns Object containing data, loading state, error state, and refresh function
 */
export function useCachedDataFetcher<T>(
  fetchFn: () => Promise<T>,
  key: string,
  ttlMs: number = 5 * 60 * 1000, // 5 min cache by default
  initialData: T | null = null
): CachedDataState<T> {
  // Store fetching state
  const [data, setData] = useState<T | null>(initialData);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  
  // Use refs to avoid duplicate requests and prevent recreation of fetchFn from causing infinite loops
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchFnRef = useRef(fetchFn);
  
  // Update the fetchFn ref when it changes, without triggering dependent effects
  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);
  
  // Cache management in localStorage for persistence
  const getCachedData = useCallback(() => {
    try {
      const cachedItem = localStorage.getItem(`cache_${key}`);
      if (cachedItem) {
        const parsedCache = JSON.parse(cachedItem);
        const timestamp = parsedCache.timestamp;
        const isFresh = Date.now() - timestamp < ttlMs;
        
        if (isFresh) {
          return parsedCache.data;
        }
      }
    } catch (e) {
      console.warn(`Error reading cache for ${key}:`, e);
    }
    return null;
  }, [key, ttlMs]);
  
  const setCachedData = useCallback((newData: T) => {
    try {
      localStorage.setItem(`cache_${key}`, JSON.stringify({
        data: newData,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn(`Error caching ${key}:`, e);
    }
  }, [key]);
  
  // Main fetching logic - remove fetchFn from dependencies to break circular dependency
  const fetchData = useCallback(async (forceFresh = false) => {
    // Prevent concurrent fetches
    if (isFetchingRef.current) return;
    
    // Check cache if not forcing refresh
    if (!forceFresh) {
      const cachedData = getCachedData();
      if (cachedData) {
        setData(cachedData);
        setIsLoading(false);
        setError(null);
        setLastUpdated(Date.now());
        return;
      }
    }
    
    // Fetch fresh data
    setIsLoading(true);
    isFetchingRef.current = true;
    
    // Cancel existing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      // Use the ref version of fetchFn to prevent dependency loop
      const result = await fetchFnRef.current();
      setData(result);
      setLastUpdated(Date.now());
      setCachedData(result);
      setError(null);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [getCachedData, setCachedData]); // Removed fetchFn from dependencies
  
  // Initial fetch - only run once on mount
  useEffect(() => {
    // Use a separate function to handle initial fetch
    const initialFetch = async () => {
      const cachedData = getCachedData();
      if (cachedData) {
        setData(cachedData);
        return;
      }
      
      await fetchData();
    };
    
    initialFetch();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only on mount
  
  const refresh = useCallback(() => fetchData(true), [fetchData]);
  
  return { data, isLoading, error, lastUpdated, refresh };
}

// Global cache invalidation utility
export const invalidateCache = (pattern?: RegExp): void => {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('cache_') && (!pattern || pattern.test(key))) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.warn("Error invalidating cache:", e);
  }
};
