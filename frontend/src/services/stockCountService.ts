/**
 * Stock count sessions — typed client for /api/stock-counts.
 * Sessions are the unit of work for physical counts: created with an
 * optional category scope, counted incrementally (each item save hits
 * PUT /sessions/:id/items so any device can resume), then submitted —
 * posting immediately or waiting for an inventory.count_approve review
 * depending on the session's requires_approval flag.
 */
import { fetchApi } from './api';

export type CountSessionStatus = 'in_progress' | 'submitted' | 'posted' | 'cancelled';

export interface CountSession {
  id: string;
  tenantId: string;
  storeId: string;
  name: string;
  scopeCategoryId: string | null;
  scopeCategoryName: string | null;
  blind: boolean;
  requiresApproval: boolean;
  status: CountSessionStatus;
  createdBy: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  appliedCount: number;
  skippedCount: number;
  createdAt: string;
  updatedAt: string;
  // list aggregates (GET /sessions only)
  itemCount?: number;
  countedCount?: number;
  varianceCount?: number;
}

export interface CountSessionItem {
  id: string;
  sessionId: string;
  productId: string;
  productName: string;
  sku: string | null;
  barcode: string | null;
  categoryName: string | null;
  expectedQty: number;
  countedQty: number | null;
  variance: number | null;
  reasonCode: string | null;
  notes: string | null;
  addedDuringCount: boolean;
  countedBy: string | null;
  countedAt: string | null;
}

export interface CountableProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isShared: boolean;
  currentStock: number;
  lowStockThreshold: number | null;
  lastCountedAt: string | null;
}

export interface ItemUpdate {
  productId: string;
  countedQty?: number | null;
  reasonCode?: string;
  notes?: string;
}

export interface PostResult {
  status: 'submitted' | 'posted';
  applied?: { productId: string; before: number; after: number; delta: number }[];
  skipped?: { productId: string; reason: string }[];
}

const unwrap = <T>(res: any): T => ((res && res.data) ? res.data : res) as T;

export const listCountableProducts = async (params: { search?: string; categoryId?: string; limit?: number } = {}) => {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  if (params.categoryId) q.set('category_id', params.categoryId);
  q.set('limit', String(params.limit ?? 200));
  const res = await fetchApi<any>(`/stock-counts/products?${q.toString()}`);
  const payload = unwrap<any>(res);
  return {
    items: (Array.isArray(payload) ? payload : payload?.items || []) as CountableProduct[],
    total: (Array.isArray(payload) ? null : payload?.total ?? null) as number | null,
  };
};

export const listSessions = async (status?: CountSessionStatus) => {
  const res = await fetchApi<any>(`/stock-counts/sessions${status ? `?status=${status}` : ''}`);
  const payload = unwrap<any>(res);
  return (Array.isArray(payload) ? payload : payload?.items || []) as CountSession[];
};

export const getSession = async (id: string) => {
  const res = await fetchApi<any>(`/stock-counts/sessions/${id}`);
  const payload = unwrap<any>(res);
  return payload as { session: CountSession; items: CountSessionItem[] };
};

export const createSession = async (body: { name?: string; categoryId?: string; blind?: boolean; requiresApproval?: boolean }) =>
  unwrap<CountSession>(await fetchApi<any>('/stock-counts/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }));

export const updateSessionItems = async (sessionId: string, items: ItemUpdate[]) =>
  unwrap<{ updated: number; added: string[]; failed: { productId: string; reason: string }[] }>(
    await fetchApi<any>(`/stock-counts/sessions/${sessionId}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
  );

export const submitSession = async (sessionId: string) =>
  unwrap<PostResult>(await fetchApi<any>(`/stock-counts/sessions/${sessionId}/submit`, { method: 'POST' }));

export const approveSession = async (sessionId: string) =>
  unwrap<PostResult>(await fetchApi<any>(`/stock-counts/sessions/${sessionId}/approve`, { method: 'POST' }));

export const cancelSession = async (sessionId: string) =>
  unwrap<{ status: 'cancelled' }>(await fetchApi<any>(`/stock-counts/sessions/${sessionId}/cancel`, { method: 'POST' }));
