/**
 * Sale Deletion Service
 * Frontend service for handling sale deletion operations
 */

import { fetchApi } from './api';

export interface SaleDeletionPreview {
  saleData: any;
  affectedRecords: Record<string, number>;
  inventoryImpact: Array<{
    productId: string;
    productName: string;
    quantityToRestore: number;
    currentStock: number;
    newStock: number;
  }>;
  validation: {
    canDelete: boolean;
    reasons: string[];
    warnings: string[];
  };
}

export interface SaleDeletionResult {
  success: boolean;
  saleId: string;
  deletedRecords: Record<string, { count: number; affectedRows: number }>;
  inventoryRollback: Array<{
    productId: string;
    productName: string;
    quantityRestored: number;
    previousStock: number;
    newStock: number;
    logId: string;
  }>;
  auditLogId: string;
  error?: string;
}

/**
 * Get sale deletion preview
 */
export const getSaleDeletionPreview = async (saleId: string): Promise<{ status: string; data: SaleDeletionPreview }> => {
  try {
    const response = await fetchApi<{ data: SaleDeletionPreview }>(`/sales-deletion/preview/${saleId}`);
    
    return {
      status: 'success',
      data: response.data || response as any
    };
  } catch (error: any) {
    console.error('Error getting sale deletion preview:', error);
    throw new Error(error.message || 'Failed to get sale deletion preview');
  }
};

/**
 * Validate sale deletion
 */
export const validateSaleDeletion = async (saleId: string): Promise<{ status: string; data: any }> => {
  try {
    const response = await fetchApi<{ data: any }>(`/sales-deletion/validate/${saleId}`);
    
    return {
      status: 'success',
      data: response.data || response
    };
  } catch (error: any) {
    console.error('Error validating sale deletion:', error);
    throw new Error(error.message || 'Failed to validate sale deletion');
  }
};

/**
 * Delete a sale
 */
export const deleteSale = async (
  saleId: string, 
  reason: string, 
  forceDelete: boolean = false
): Promise<{ status: string; data: SaleDeletionResult }> => {
  try {
    const response = await fetchApi<{ data: SaleDeletionResult }>(`/sales-deletion/${saleId}`, {
      method: 'DELETE',
      body: JSON.stringify({
        reason,
        forceDelete
      })
    });
    
    return {
      status: 'success',
      data: response.data || response as any
    };
  } catch (error: any) {
    console.error('Error deleting sale:', error);
    throw new Error(error.message || 'Failed to delete sale');
  }
};
