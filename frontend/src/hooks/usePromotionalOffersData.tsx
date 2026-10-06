import { useCachedDataFetcher } from './useCachedDataFetcher';
import { useEffect } from 'react';
// Dynamic import for discountService
import { useAuth } from '../contexts/AuthContext';
import { PromotionalOffer } from '../types/discount';

/**
 * Hook for fetching and caching promotional offers data
 * 
 * @returns Object containing promotional offers data, loading state, error state, and refresh function
 */
export function usePromotionalOffersData() {
  const { isAuthenticated } = useAuth();
  
  const fetchOffers = async (): Promise<PromotionalOffer[]> => {
    if (!isAuthenticated) {
      // Don't attempt to fetch offers if not authenticated
      console.log('Not fetching promotional offers - user not authenticated');
      return [];
    }
    
    try {
      const { getAllOffers } = await import('../services/discountService');
      return await getAllOffers();
    } catch (error) {
      console.error('Error in usePromotionalOffersData:', error);
      // Return empty array on error rather than propagating
      return [];
    }
  };
  
  const { data, isLoading, error, lastUpdated, refresh } = useCachedDataFetcher(
    fetchOffers,
    'promotional_offers',
    5 * 60 * 1000,  // 5 minutes TTL
    []
  );

  // Listen for global updates to promotional offers to refresh immediately
  useEffect(() => {
    const handler = () => {
      // Force a fresh fetch bypassing cache
      refresh();
    };
    window.addEventListener('promotional_offers_updated', handler as EventListener);
    return () => window.removeEventListener('promotional_offers_updated', handler as EventListener);
  }, [refresh]);

  return { data, isLoading, error, lastUpdated, refresh };
}
