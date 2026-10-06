import { Product } from '@/types';
import { fetchApi } from './api'; // Import fetchApi directly

/**
 * Fetches all products, optionally filtered by tenant_id and store_id.
 * Handles the ApiResponse structure from the core api service.
 * @param params Optional parameters, including tenant_id and store_id.
 */
export const getProducts = async (params?: { tenant_id?: string, store_id?: string }): Promise<Product[]> => {
  try {
    let endpoint = '/products';
    const queryParams = [];
    
    if (params?.tenant_id) {
      queryParams.push(`tenant_id=${encodeURIComponent(params.tenant_id)}`);
    }
    
    if (params?.store_id) {
      queryParams.push(`store_id=${encodeURIComponent(params.store_id)}`);
    }
    
    if (queryParams.length > 0) {
      endpoint += `?${queryParams.join('&')}`;
    }
    
    // fetchApi returns { products: Product[] } directly or throws an error.
    const response = await fetchApi<{ products: Product[] }>(endpoint); 
    
    // Backend already sends camelCased data matching the Product type.
    return response.products;
  } catch (error) {
    console.error('Error fetching products:', error);
    // Consider how to propagate error or return a default value like an empty array
    // For now, re-throwing or returning empty array based on existing pattern
    if (error instanceof Error) {
        throw error; // rethrow if it's already an error object
    }
    throw new Error('Failed to fetch products due to an unexpected issue.');
  }
};

/**
 * Creates a new product.
 * @param productData - The data for the new product. Must be FormData if an image is included.
 */
export const createProduct = async (productData: FormData): Promise<Product> => {
  // Assuming the backend responds with { product: Product }
  const response = await fetchApi<{ product: Product }>('/products', {
    method: 'POST',
    body: productData,
  });
  // fetchApi throws on error, so if we reach here, the request was successful.
  // The response is { product: Product }
  return response.product;
};

/**
 * Updates an existing product.
 * @param productId - The ID of the product to update.
 * @param productData - The data to update the product with. Must be FormData if an image is included.
 */
export const updateProduct = async (productId: string, productData: FormData): Promise<Product> => {
  // Assuming the backend responds with { product: Product }
  const response = await fetchApi<{ product: Product }>(`/products/${productId}`, {
    method: 'PUT',
    body: productData,
  });
  // fetchApi throws on error.
  // The response is { product: Product }
  return response.product;
};

/**
 * Deletes a product.
 * @param productId - The ID of the product to delete.
 */
export const deleteProduct = async (productId: string): Promise<void> => {
  // fetchApi will throw an error if the request fails.
  // For a DELETE request, if it doesn't throw, it's considered successful.
  await fetchApi<void>(`/products/${productId}`, { method: 'DELETE' });
};

/**
 * Searches for products based on a search term and tenant ID.
 * @param searchTerm - The term to search for.
 * @param tenantId - The ID of the tenant.
 */
export const searchProducts = async (searchTerm: string, tenantId: string): Promise<Product[]> => {
  try {
    // Log detailed info about the request
    // Debug logging removed for cleaner console output
    const endpoint = `/products/search?term=${encodeURIComponent(searchTerm)}&tenantId=${encodeURIComponent(tenantId)}`;
    // Debug logging removed for cleaner console output
    
    // fetchApi returns { products: Product[] } directly or throws an error.
    const response = await fetchApi<{ products: Product[] }>( 
      endpoint
    );
    
    // Log the entire response for debugging
    // Debug logging removed for cleaner console output
        
    return response.products;

  } catch (error) {
    console.error('[searchProducts] Error during product search:', error);
    if (error instanceof Error) {
      throw error; // Rethrow if it's already an error object
    }
    throw new Error('An unexpected error occurred during product search.');
  }
};

/**
 * Updates the stock level of a specific product.
 * @param id - The ID of the product.
 * @param newStockLevel - The new stock quantity.
 */
export const updateProductStockLevel = async (id: string, newStockLevel: number): Promise<Product> => {
  // fetchApi returns Product directly or throws an error.
  const response = await fetchApi<Product>(`/products/${id}/stock`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ new_stock_level: newStockLevel }),
  });
  // The response is Product.
  return response;
};

export interface StoreListing {
  storeId: string;
  storeName: string;
  listingId: string | null;
  price: number | null;
  costPriceOverride: number | null;
  stockQuantity: number;
  isActive: boolean;
}

// Per-store price/stock overrides for a tenant-wide shared product. See
// docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3.
export const getProductStoreListings = async (
  productId: string
): Promise<{ basePrice: number; listings: StoreListing[] }> =>
  fetchApi(`/products/${productId}/store-listings`, { method: 'GET' });

export const updateProductStoreListing = async (
  productId: string,
  storeId: string,
  data: { price?: number | null; costPriceOverride?: number | null; isActive?: boolean }
): Promise<StoreListing> =>
  fetchApi(`/products/${productId}/store-listings/${storeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

// One-off bulk conversion for a tenant that already had products before
// adding a second store: every still-store-owned product becomes
// tenant-wide shared, preserving its current store's stock via a new
// store_product_listings row, so that store is unaffected but every other
// store (including a brand-new one) can now see it. Safe to call more than
// once. See docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md.
export const shareExistingProductsAcrossStores = async (): Promise<{ converted: number; skipped: number }> =>
  fetchApi('/products/share-existing', { method: 'POST' });

// Add other product-related API functions here as needed (e.g., getProductById, getProductMetrics)
