import { fetchApi } from './api';
import type { CreateGrnData, GrnResponse, PaginatedApiResponse } from '@/types';

// Extend GrnResponse to include items property
interface ExtendedGrnResponse extends GrnResponse {
  totalGrnCost?: number | null;
  items?: Array<{
    productId: string;
    productName?: string;
    productSku?: string;
    quantityReceived: number;
    costPrice: number;
    taxRate: number;
    taxAmount: number;
    purchaseOrderItemId?: string;
    purchaseOrderId?: string;
    poNumber?: string;
    batchNumber?: string;
    expiryDate?: string;
    remarks?: string;
  }>;
}

export const grnService = {
  createGrn: async (grnData: CreateGrnData): Promise<{ message: string; grnId: string; grnNumber: string }> => {
    // fetchApi now directly returns the expected type or throws an error.
    const result = await fetchApi<{ message: string; grnId: string; grnNumber: string }>('/grn', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(grnData),
    });
    
    // Dispatch inventory update event
    window.dispatchEvent(new CustomEvent('inventoryUpdated'));
    
    return result;
  },

  getGrnById: async (grnId: string, tenantId?: string): Promise<ExtendedGrnResponse> => {
    // Explicitly request items and full details
    const queryParams = new URLSearchParams({ include_items: 'true' });
    if (tenantId) {
      queryParams.append('tenant_id', tenantId);
    }
    
    try {
      // Fetch raw response
      const response = await fetchApi<any>(`/grn/${grnId}?${queryParams.toString()}`, { method: 'GET' });
      
      // Transform to ensure items is always an array
      const transformedResponse: ExtendedGrnResponse = {
        ...response,
        // Ensure items is always an array
        items: Array.isArray(response.items) ? response.items : []
      };
      
      return transformedResponse;
    } catch (error) {
      console.error('Error fetching GRN by ID:', error);
      throw error;
    }
  },

  getGrns: async (filters: Record<string, string | number | boolean>): Promise<PaginatedApiResponse<GrnResponse>> => {
    const queryParams = new URLSearchParams(filters as Record<string, string>).toString(); // Cast to Record<string, string> for URLSearchParams
    return fetchApi<PaginatedApiResponse<GrnResponse>>(`/grn?${queryParams}`, { method: 'GET' });
  },

  deleteGrn: async (grnId: string, tenantId: string): Promise<{ message: string }> => {
    const queryParams = new URLSearchParams();
    if (tenantId) {
      queryParams.append('tenant_id', tenantId);
    }
    
    return fetchApi<{ message: string }>(`/grn/${grnId}?${queryParams.toString()}`, { 
      method: 'DELETE',
    });
  },
  
  updateGrn: async (grnId: string, grnData: CreateGrnData, tenantId: string): Promise<{ message: string }> => {
    const queryParams = new URLSearchParams();
    if (tenantId) {
      queryParams.append('tenant_id', tenantId);
    }
    
    const result = await fetchApi<{ message: string }>(`/grn/${grnId}?${queryParams.toString()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(grnData),
    });
    
    // Dispatch inventory update event
    window.dispatchEvent(new CustomEvent('inventoryUpdated'));
    
    return result;
  },
  
  // Add function to update just the status of a GRN
  updateGrnStatus: async (grnId: string, status: string, tenantId: string): Promise<{ message: string }> => {
    const result = await fetchApi<{ message: string }>(`/grn/${grnId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ new_status: status, tenant_id: tenantId }),
    });
    
    // Dispatch inventory update event if status change affects inventory
    if (status === 'COMPLETED') {
      window.dispatchEvent(new CustomEvent('inventoryUpdated'));
    }
    
    return result;
  },

  // Complete a GRN (DRAFT -> COMPLETED with inventory commitment)
  completeGrn: async (grnId: string, tenantId: string): Promise<{ message: string }> => {
    const result = await fetchApi<{ message: string }>(`/grn/${grnId}/complete`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    
    // Dispatch inventory update event since completing GRN updates inventory
    window.dispatchEvent(new CustomEvent('inventoryUpdated'));
    
    return result;
  },
};
