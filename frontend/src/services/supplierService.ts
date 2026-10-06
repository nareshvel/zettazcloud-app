import { Supplier } from '@/types';
import { fetchApi } from './api'; 

const API_BASE_URL = '/suppliers';

// Interface for the raw supplier data from the API (snake_case keys)
interface SupplierFromApi {
  id: string;
  tenant_id: string;
  supplier_name: string;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state_province?: string | null;
  postal_code?: string | null;
  country?: string | null;
  website?: string | null;
  tax_id?: string | null;
  default_payment_terms?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// Utility function to convert snake_case string to camelCase
const snakeToCamel = (str: string): string =>
  str.replace(/([-_][a-z])/g, (group) =>
    group.toUpperCase().replace('-', '').replace('_', '')
  );

// Utility function to convert camelCase string to snake_case
const camelToSnake = (str: string): string =>
  str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

// Utility function to convert object keys from snake_case to camelCase
const transformKeysToCamelCase = <T extends object>(obj: unknown): T => {
  if (typeof obj !== 'object' || obj === null) return obj as T;
  if (Array.isArray(obj)) {
    return obj.map(item => transformKeysToCamelCase(item)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const key in obj as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = snakeToCamel(key);
      result[camelKey] = transformKeysToCamelCase((obj as Record<string, unknown>)[key]);
    }
  }
  return result as T;
};

// Utility function to convert object keys from camelCase to snake_case
const transformKeysToSnakeCase = <T extends object>(obj: unknown): T => {
  if (typeof obj !== 'object' || obj === null) return obj as T;
  if (Array.isArray(obj)) {
    return obj.map(item => transformKeysToSnakeCase(item)) as unknown as T;
  }
  const result: Record<string, unknown> = {};
  for (const key in obj as Record<string, unknown>) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = camelToSnake(key);
      result[snakeKey] = transformKeysToSnakeCase((obj as Record<string, unknown>)[key]);
    }
  }
  return result as T;
};

// Define data types for creating and updating suppliers
// These types omit tenantId, assuming it's set by the backend based on the authenticated user.
export type CreateSupplierData = Omit<Supplier, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;
export type UpdateSupplierData = Partial<CreateSupplierData>; // Update can be partial of Create data

/**
 * Fetches all suppliers, optionally filtered by tenant_id.
 * @param params Optional parameters, including tenant_id.
 */
export const getSuppliers = async (params?: { tenant_id?: string }): Promise<Supplier[]> => {
  try {
    let url = API_BASE_URL;
    if (params?.tenant_id) {
      url += `?tenant_id=${encodeURIComponent(params.tenant_id)}`;
    }
    // fetchApi returns the data directly or throws an error.
    // The backend is expected to return { suppliers: SupplierFromApi[] } as the direct data payload.
    const response = await fetchApi<{ suppliers: SupplierFromApi[] }>(url);
    
    // Transform snake_case keys from API to camelCase for frontend Supplier type
    return response.suppliers.map(supplier => transformKeysToCamelCase<Supplier>(supplier));
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch suppliers due to an unexpected issue.');
  }
};

/**
 * Fetches a single supplier by its ID.
 * @param supplierId The ID of the supplier to fetch.
 */
export const getSupplierById = async (supplierId: string): Promise<Supplier> => {
  try {
    // API response for a single supplier is { supplier: SupplierFromApi }
    // fetchApi returns the data directly or throws an error.
    const response = await fetchApi<{ supplier: SupplierFromApi }>(`${API_BASE_URL}/${supplierId}`);
    
    // Transform snake_case keys from API to camelCase
    return transformKeysToCamelCase<Supplier>(response.supplier);
  } catch (error) {
    console.error(`Error fetching supplier with ID ${supplierId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch supplier due to an unexpected issue.');
  }
};

/**
 * Creates a new supplier.
 * @param supplierData The data for the new supplier. Should match the backend's expected structure.
 */
export const createSupplier = async (supplierData: CreateSupplierData): Promise<Supplier> => {
  try {
    // Transform camelCase payload to snake_case for the backend
    const snakeCasePayload = transformKeysToSnakeCase<SupplierFromApi>(supplierData as unknown as Record<string, unknown>);

    // fetchApi returns the data directly or throws an error.
    // Backend is expected to return { supplier: SupplierFromApi } as the direct data payload.
    const response = await fetchApi<{ supplier: SupplierFromApi }>(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snakeCasePayload),
    });

    // Transform snake_case response from API to camelCase
    return transformKeysToCamelCase<Supplier>(response.supplier);
  } catch (error) {
    console.error('Error creating supplier:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to create supplier due to an unexpected issue.');
  }
};

/**
 * Updates an existing supplier.
 * @param supplierId The ID of the supplier to update.
 * @param supplierData The data to update the supplier with.
 */
export const updateSupplier = async (supplierId: string, supplierData: UpdateSupplierData): Promise<Supplier> => {
  try {
    // Transform camelCase payload to snake_case for the backend
    const snakeCasePayload = transformKeysToSnakeCase<Partial<SupplierFromApi>>(supplierData as unknown as Record<string, unknown>);

    // fetchApi returns the data directly or throws an error.
    // Backend is expected to return { supplier: SupplierFromApi } as the direct data payload.
    const response = await fetchApi<{ supplier: SupplierFromApi }>(`${API_BASE_URL}/${supplierId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(snakeCasePayload),
    });

    // Transform snake_case response from API to camelCase
    return transformKeysToCamelCase<Supplier>(response.supplier);
  } catch (error) {
    console.error(`Error updating supplier with ID ${supplierId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to update supplier due to an unexpected issue.');
  }
};

/**
 * Deletes a supplier by its ID.
 * @param supplierId The ID of the supplier to delete.
 */
export const deleteSupplier = async (supplierId: string): Promise<void> => {
  try {
    // fetchApi will throw an error if the request fails. 
    // For a DELETE request, if it doesn't throw, it's considered successful.
    // No specific response body is typically processed for a successful DELETE.
    await fetchApi<void>(`${API_BASE_URL}/${supplierId}`, { method: 'DELETE' });
    // If fetchApi completes without throwing, the deletion was successful.
  } catch (error) {
    console.error(`Error deleting supplier with ID ${supplierId}:`, error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to delete supplier due to an unexpected issue.');
  }
};

// Potential future additions:
// - searchSuppliers (if backend supports it)
// - functions to manage supplier contacts or specific supplier-related data
