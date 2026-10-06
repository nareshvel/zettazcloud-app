import { fetchApi } from './api';

/**
 * Client for the Sales Hub universal search — one request that fans out
 * across customers + every actionable per-feature record (open repairs,
 * old-gold credits, unreturned memos, active layaways, active savings
 * enrollments, recent completed sales) so the Hub can render a single
 * customer-centric result instead of six separate "find the record" modals.
 *
 * Backend: GET /api/sales-hub/search?q= (backend/controllers/salesHubController.js)
 */

export type SalesHubRecordType =
  | 'repair'
  | 'old-gold'
  | 'memo'
  | 'layaway'
  | 'savings-enrollment'
  | 'sale';

export type SalesHubAction =
  | 'check-in'
  | 'collect-payment'
  | 'redeem-credit'
  | 'return-item'
  | 'return';

export interface SalesHubRecord {
  type: SalesHubRecordType;
  id: string;
  label: string;
  status: string;
  statusLabel: string;
  action: SalesHubAction;
  actionLabel: string;
  date: string | null;
}

export interface SalesHubCustomer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  records: SalesHubRecord[];
}

export interface SalesHubSearchResult {
  customers: SalesHubCustomer[];
  standaloneRecords: SalesHubRecord[];
}

/**
 * Search the Sales Hub for a customer or record number (repair ticket,
 * layaway/memo/enrollment reference, receipt/sale number, phone, email, name).
 * Returns an empty result for queries under 2 characters — mirrors the
 * backend's own minimum-length guard, so callers can skip firing the
 * request entirely on very short input.
 */
export async function searchSalesHub(query: string): Promise<SalesHubSearchResult> {
  const q = (query || '').trim();
  if (q.length < 2) {
    return { customers: [], standaloneRecords: [] };
  }

  const result = await fetchApi<SalesHubSearchResult>(
    `/sales-hub/search?q=${encodeURIComponent(q)}`
  );

  return result ?? { customers: [], standaloneRecords: [] };
}

export interface SalesHubGlance {
  repairsReady: number;
  memosOverdue: number;
}

export async function getSalesHubGlance(): Promise<SalesHubGlance> {
  const result = await fetchApi<SalesHubGlance>('/sales-hub/glance');
  return result ?? { repairsReady: 0, memosOverdue: 0 };
}
