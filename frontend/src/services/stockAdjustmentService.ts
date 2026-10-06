import { fetchApi } from './api'; // Assuming api.ts is in the same directory

export interface StockAdjustmentPayload {
  productId: string;
  variantId?: string | null; // For future use
  adjustmentType: 'INCREMENT' | 'DECREMENT';
  reasonCode: string;
  quantity: number;
  notes?: string;
  adjustmentDate: string; // ISO string format
  // tenantId, storeId, userId will be added by the backend from authenticated user
}

export interface StockAdjustment {
  id: string;
  productId: string;
  variantId?: string | null;
  adjustmentType: 'INCREMENT' | 'DECREMENT';
  reasonCode: string;
  quantityAdjusted: number;
  stockBeforeAdjustment: number;
  stockAfterAdjustment: number;
  notes?: string;
  adjustmentDate: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
  tenantId: string;
  storeId: string;
}

export interface StockAdjustmentResponse {
  status?: string;
  message?: string;
  error?: string;
  data: StockAdjustment;
}

const stockAdjustmentService = {
  createAdjustment: async (payload: StockAdjustmentPayload): Promise<StockAdjustment> => {
    try {
      const response = await fetchApi<StockAdjustment>('/stock-adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // fetchApi already handles the wrapper and returns the parsed data (StockAdjustment)
      // If there's an error, fetchApi will throw it
      return response;
    } catch (error) {
      console.error('Error creating stock adjustment:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('An unexpected error occurred while creating stock adjustment.');
    }
  },
};

export default stockAdjustmentService;
