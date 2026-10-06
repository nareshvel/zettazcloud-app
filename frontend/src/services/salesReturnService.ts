import { fetchApi } from './api';

export interface SalesReturn {
  id: string;
  returnNumber: string;
  originalSaleId: string;
  customerId?: string;
  tenantId: string;
  storeId: string;
  returnDate: string;
  returnReason: 'defective' | 'wrong_item' | 'customer_change_mind' | 'damaged' | 'other';
  returnReasonNotes?: string;
  totalReturnAmount: number;
  refundMethod: 'cash' | 'card' | 'store_credit' | 'exchange';
  status: 'pending' | 'completed' | 'cancelled';
  processedByUserId: string;
  createdAt: string;
  updatedAt: string;
  
  // Joined fields
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  originalReceiptNumber?: string;
  originalSaleTotal?: number;
  originalSaleDate?: string;
  processedByName?: string;
  itemsCount?: number;
  items?: SalesReturnItem[];
}

export interface SalesReturnItem {
  id: string;
  sales_return_id: string;
  original_sale_item_id: string;
  product_id: string;
  quantity_returned: number;
  unit_price: number;
  total_amount: number;
  return_condition: 'new' | 'used' | 'damaged' | 'defective';
  restockable: boolean;
  created_at: string;
  
  // Joined fields
  product_name?: string;
  product_sku?: string;
  original_quantity?: number;
  original_unit_price?: number;
}

export interface ReturnableItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  productDescription: string;
  categoryName: string;
  originalQuantity: number;
  unitPrice: number; // Original price per unit before any adjustments
  totalPrice: number; // Original total price for the line item (unitPrice * originalQuantity)
  itemTax: number; // The total prorated tax for this entire line item
  itemDiscount: number; // The total prorated discount for this entire line item
  totalReturned: number;
  returnableQuantity: number;

  // New, accurate per-unit financial data for refunds
  finalPricePerUnit: number; // The true refund value per unit (unitPrice - discountPerUnit + taxPerUnit)
  taxPerUnit: number; // The prorated tax amount per unit
  discountPerUnit: number; // The prorated discount amount per unit
}

export interface SaleInfo {
  id: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  saleDate: string;
  customerName?: string;
  customerEmail?: string;
}

export interface CreateSalesReturnRequest {
  original_sale_id: string;
  customer_id?: string;
  return_reason: string;
  return_reason_notes?: string;
  refund_method: string;
  items: {
    original_sale_item_id: string;
    product_id: string;
    quantity_returned: number;
    // Final unit refund price (unit price after discount/tax adjustments)
    unit_price: number;
    // Extra per-unit economics sent by the UI for transparency/debugging
    base_unit_price?: number;
    discount_per_unit?: number;
    tax_per_unit?: number;
    return_condition?: string;
    restockable?: boolean;
  }[];
}

export interface SalesReturnStats {
  totalReturns: number;
  completedReturns: number;
  pendingReturns: number;
  cancelledReturns: number;
  totalRefundedAmount: number; // fetchApi converts snake_case to camelCase
}

export interface SalesReturnFilters {
  page?: number;
  limit?: number;
  status?: string;
  return_reason?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
}

class SalesReturnService {
  /**
   * Get all sales returns with pagination and filtering
   */
  async getAllReturns(filters: SalesReturnFilters = {}): Promise<{
    data: SalesReturn[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });

    // The backend sends: { status: 'success', data: [...], pagination: {...} }
    // But fetchApi extracts and returns just the data array: [...]
    // However, we need the full response with pagination, so let's use a different approach
    
    try {
      const response = await fetchApi<any>(`/sales-returns?${params.toString()}`);
      
      // If fetchApi returned an array, it means it unwrapped the data
      if (Array.isArray(response)) {
        return {
          data: response as SalesReturn[],
          pagination: {
            page: 1,
            limit: 10,
            total: response.length,
            pages: Math.ceil(response.length / 10)
          }
        };
      }
      
      // If fetchApi returned an object, check if it has the expected structure
      if (response && typeof response === 'object') {
        if (response.data && Array.isArray(response.data)) {
          return {
            data: response.data as SalesReturn[],
            pagination: response.pagination || {
              page: 1,
              limit: 10,
              total: response.data.length,
              pages: Math.ceil(response.data.length / 10)
            }
          };
        }
      }
      
      // Fallback: treat the response as the data array
      const dataArray = Array.isArray(response) ? response : [];
      return {
        data: dataArray as SalesReturn[],
        pagination: {
          page: 1,
          limit: 10,
          total: dataArray.length,
          pages: Math.ceil(dataArray.length / 10)
        }
      };
      
    } catch (error) {
      console.error('Error in getAllReturns:', error);
      // Return empty data on error
      return {
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          pages: 0
        }
      };
    }
  }

  /**
   * Get specific sales return by ID
   */
  async getReturnById(id: string): Promise<SalesReturn> {
    const response = await fetchApi<any>(`/sales-returns/${id}`);
    // Support both wrapped and unwrapped shapes
    if (response && typeof response === 'object') {
      if ('data' in response && response.data) {
        return response.data as SalesReturn;
      }
    }
    return response as SalesReturn;
  }

  /**
   * Get returnable items from a specific sale
   */
  async getReturnableItems(saleId: string): Promise<{ items: ReturnableItem[], saleInfo: SaleInfo }> {
    const response = await fetchApi<{ data: ReturnableItem[], saleInfo: SaleInfo }>(`/sales/${saleId}/returnable-items`);

    // Handle different response structures
    if (response && typeof response === 'object') {
      if ('data' in response && Array.isArray(response.data)) {
        const actualSaleInfo = response.saleInfo || {
          id: '',
          subtotal: 0,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 0,
          saleDate: '',
          customerName: '',
          customerEmail: ''
        };
        
        return {
          items: response.data,
          saleInfo: actualSaleInfo
        };
      } else if (Array.isArray(response)) {
        return {
          items: response as ReturnableItem[],
          saleInfo: {
            id: saleId,
            subtotal: 0,
            taxAmount: 0,
            discountAmount: 0,
            totalAmount: 0,
            saleDate: new Date().toISOString()
          }
        };
      }
    }
    
    return {
      items: [],
      saleInfo: {
        id: saleId,
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
        saleDate: new Date().toISOString()
      }
    };
  }

  /**
   * Create new sales return
   */
  async createReturn(returnData: CreateSalesReturnRequest): Promise<{
    id: string;
    return_number: string;
    total_return_amount: number;
  }> {
    const response = await fetchApi<
      | { id: string; return_number: string; total_return_amount: number }
      | { data: { id: string; return_number: string; total_return_amount: number } }
    >("/sales-returns", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(returnData)
    });
    // fetchApi unwraps { status: 'success', data: {...} } to just {...}
    // But keep backward compatibility if wrapper slips through
    if (response && typeof response === 'object') {
      if ('id' in response) {
        return response as { id: string; return_number: string; total_return_amount: number };
      }
      if ('data' in response && (response as any).data?.id) {
        return (response as any).data as { id: string; return_number: string; total_return_amount: number };
      }
    }
    // As a final fallback, throw to surface unexpected shapes
    throw new Error('Unexpected createReturn response shape');
  }

  /**
   * Complete sales return
   */
  async completeReturn(id: string): Promise<void> {
    await fetchApi(`/sales-returns/${id}/complete`, {
      method: 'PATCH'
    });
  }

  /**
   * Cancel sales return
   */
  async cancelReturn(id: string): Promise<void> {
    await fetchApi(`/sales-returns/${id}/cancel`, {
      method: 'PATCH'
    });
  }

  /**
   * Get sales return statistics
   */
  async getReturnStats(period: number = 30): Promise<SalesReturnStats> {
    const response = await fetchApi<SalesReturnStats>(`/sales-returns/stats?period=${period}`);
    return response;
  }
}

export const salesReturnService = new SalesReturnService();
