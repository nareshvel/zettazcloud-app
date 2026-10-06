import { useCachedDataFetcher } from './useCachedDataFetcher';
import { fetchApi } from '../services/api';
import { Product } from '../types';

/**
 * Hook for fetching and caching product data
 * 
 * @param categoryId Optional category ID to filter products
 * @returns Object containing product data, loading state, error state, and refresh function
 */
export function useProductsData(categoryId?: string) {
  const fetchProducts = async (): Promise<Product[]> => {
    try {
      let url = '/products';
      if (categoryId) {
        url += `?categoryId=${encodeURIComponent(categoryId)}`;
      }
      
      const responseData = await fetchApi<{ products: Product[] }>(url);
      
      if (responseData && responseData.products && Array.isArray(responseData.products)) {
        return responseData.products;
      }
      
      console.warn('API (via fetchApi) returned unexpected product data structure or missing products field', responseData);
      return []; // Or throw an error if products are strictly expected
    } catch (error) {
      console.error('Error fetching products (via fetchApi):', error);
      throw error;
    }
  };
  
  return useCachedDataFetcher(
    fetchProducts,
    `products_${categoryId || 'all'}`,
    2 * 60 * 1000,  // 2 minutes TTL
    []
  );
}
