import { fetchApi } from './api';

// Real backend for the Sales Hub "Sales Orders" quick-action flow, backed
// by the `sales_orders` table (database/migrations/2026-08-28_sales_orders.sql)
// + backend/controllers/salesOrdersController.js + routes/salesOrders.routes.js.
// Replaces the old OrdersPage.tsx mock data entirely.

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export type SalesOrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface SalesOrder {
  id: string;
  tenantId: string;
  storeId: string;
  customerId?: string | null;
  orderNumber: string;
  status: SalesOrderStatus;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;

  // Joined fields
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface SalesOrderStats {
  totalOrders: number;
  pendingOrders: number;
  processingOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
}

export interface SalesOrderFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface CreateSalesOrderRequest {
  customer_id?: string | null;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  status?: SalesOrderStatus;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

class OrdersService {
  async getAllOrders(filters: SalesOrderFilters = {}): Promise<PaginatedResponse<SalesOrder>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    try {
      const response = await fetchApi<any>(`/sales-orders?${params.toString()}`);
      if (response && typeof response === 'object' && Array.isArray(response.data)) {
        return {
          data: response.data as SalesOrder[],
          pagination: response.pagination || { page: 1, limit: 20, total: response.data.length, pages: 1 },
        };
      }
      if (Array.isArray(response)) {
        return {
          data: response as SalesOrder[],
          pagination: { page: 1, limit: 20, total: response.length, pages: Math.ceil(response.length / 20) },
        };
      }
      return { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    } catch (error) {
      console.error('Error in getAllOrders:', error);
      return { data: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } };
    }
  }

  async getOrderStats(): Promise<SalesOrderStats> {
    const response = await fetchApi<SalesOrderStats>('/sales-orders/stats');
    return response;
  }

  async getOrderById(id: string): Promise<SalesOrder> {
    const response = await fetchApi<any>(`/sales-orders/${id}`);
    if (response && typeof response === 'object' && 'data' in response) {
      return response.data as SalesOrder;
    }
    return response as SalesOrder;
  }

  async createOrder(order: CreateSalesOrderRequest): Promise<{ id: string; orderNumber: string; status: string; total: number }> {
    const response = await fetchApi<any>('/sales-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
    if (response && typeof response === 'object') {
      if ('id' in response) return response;
      if ('data' in response && response.data?.id) return response.data;
    }
    throw new Error('Unexpected createOrder response shape');
  }

  async updateOrderStatus(id: string, status: SalesOrderStatus): Promise<void> {
    await fetchApi(`/sales-orders/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  }
}

export const ordersService = new OrdersService();
