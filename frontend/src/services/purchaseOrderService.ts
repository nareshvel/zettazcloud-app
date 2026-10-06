import { fetchApi } from './api'; // Import fetchApi
import type { PurchaseOrder, PurchaseOrderItem } from '@/types'; // Import from centralized types

const API_URL = '/purchase-orders'; // Base URL already includes /api prefix

// Define interfaces based on your backend data structure
export interface NewPurchaseOrderData {
  tenant_id: string; // Assuming this is known or selected
  store_id?: string;
  supplier_id: string;
  purchase_order_number?: string;
  order_date: string; // format YYYY-MM-DD
  expected_delivery_date?: string; // format YYYY-MM-DD
  status?: PurchaseOrder['status']; // Use the main PO status type for consistency
  notes?: string;
  // total_amount is calculated on backend
  items?: Omit<NewPurchaseOrderItemData, 'id' | 'purchase_order_id' | 'line_total'>[]; // Added to support creating PO with items
}

export interface NewPurchaseOrderItemData {
  product_id: string;
  quantity_ordered: number;
  cost_price: number;
}

// Fetch all purchase orders (with optional filters)
export const getPurchaseOrders = async (filters: { tenant_id?: string; store_id?: string; supplier_id?: string; status?: string } = {}): Promise<PurchaseOrder[]> => {
  const queryParams = new URLSearchParams(filters as Record<string, string>).toString();
  const response = await fetchApi<{ data: PurchaseOrder[]; pagination: any }>(`${API_URL}${queryParams ? `?${queryParams}` : ''}`);
  return response.data; // Extract the data array from the response
};

// Fetch a single purchase order by ID
export const getPurchaseOrderById = async (id: string): Promise<PurchaseOrder> => {
  return fetchApi<PurchaseOrder>(`${API_URL}/${id}`);
};

// Create a new purchase order
export const createPurchaseOrder = async (data: NewPurchaseOrderData): Promise<PurchaseOrder> => {
  return fetchApi<PurchaseOrder>(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

// Update an existing purchase order
export const updatePurchaseOrder = async (id: string, data: Partial<NewPurchaseOrderData>): Promise<PurchaseOrder> => {
  return fetchApi<PurchaseOrder>(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
};

// Cancel (soft delete) a purchase order
export const cancelPurchaseOrder = async (id: string): Promise<PurchaseOrder> => {
  // A cancellation is an update of the status field.
  return updatePurchaseOrder(id, { status: 'CANCELLED' });
};

// Delete a purchase order (hard delete)
export const deletePurchaseOrder = async (purchaseOrderId: string, tenantId: string, hardDelete: boolean = false): Promise<void> => {
  const queryParams = new URLSearchParams({
    tenant_id: tenantId,
    hard_delete: String(hardDelete),
  }).toString();

  // fetchApi will throw an error for non-successful responses.
  // The error message will be derived from the response body (if JSON with error/message) or status text.
  await fetchApi<void>(`${API_URL}/${purchaseOrderId}?${queryParams}`, { method: 'DELETE' });
  // No explicit return needed for a successful void promise
};

// Add an item to a purchase order
export const addPurchaseOrderItem = async (poId: string, itemData: NewPurchaseOrderItemData): Promise<PurchaseOrderItem> => {
  return fetchApi<PurchaseOrderItem>(`${API_URL}/${poId}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemData),
  });
};

// Update an item in a purchase order
export const updatePurchaseOrderItem = async (poId: string, itemId: string, itemData: Partial<NewPurchaseOrderItemData>): Promise<PurchaseOrderItem> => {
  return fetchApi<PurchaseOrderItem>(`${API_URL}/${poId}/items/${itemId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itemData),
  });
};

// Remove an item from a purchase order
export const removePurchaseOrderItem = async (poId: string, itemId: string): Promise<{ message: string; itemId: string }> => {
  return fetchApi<{ message: string; itemId: string }>(`${API_URL}/${poId}/items/${itemId}`, {
    method: 'DELETE',
  });
};
