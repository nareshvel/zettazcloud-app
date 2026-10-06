import { fetchApi } from './api';

/** Client for the repair-order module mounted at /api/repairs. */

export type RepairStatus = 'received' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';

export type PaymentMode = 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque' | 'other';

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash:          'Cash',
  card:          'Card',
  upi:           'UPI',
  bank_transfer: 'Bank Transfer',
  cheque:        'Cheque',
  other:         'Other',
};

export const PAYMENT_MODES = Object.keys(PAYMENT_MODE_LABELS) as PaymentMode[];

export interface RepairOrder {
  id: string;
  ticketNo: string;
  customerId?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  employeeId?: string | null;
  itemDescription: string;
  metal?: string | null;
  weight?: number | null;
  problemDescription?: string | null;
  workRequired?: string | null;
  jobType?: string | null;
  conditionNotes?: string | null;
  goldsmiathName?: string | null;
  estimatedCost?: number | null;
  finalCost?: number | null;
  advancePaid?: number | null;
  advancePaymentMode?: PaymentMode | null;
  balancePaid?: number | null;
  balancePaidAt?: string | null;
  balancePaymentMode?: PaymentMode | null;
  paymentGateway?: string | null;
  paymentGatewayRef?: string | null;
  status: RepairStatus;
  receivedDate?: string | null;
  promisedDate?: string | null;
  deliveredDate?: string | null;
  notes?: string | null;
  history?: { status: string; note?: string; createdAt: string }[];
}

export interface RepairListPagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface RepairListResult {
  data: RepairOrder[];
  pagination: RepairListPagination;
}

export interface RepairStats {
  total: number;
  received: number;
  inProgress: number;
  ready: number;
  delivered: number;
  cancelled: number;
}

const unwrap = <T,>(r: any): T => (r && r.data !== undefined ? r.data : r);

export async function listRepairs(status?: string): Promise<RepairOrder[]> {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return unwrap<RepairOrder[]>(await fetchApi<any>(`/repairs${q}`));
}

/**
 * Server-side search + status filter + pagination — mirrors
 * salesReturnService.getAllReturns. fetchApi unwraps `data`, so we call the
 * raw response shape here to keep `pagination` alongside it.
 */
export async function listRepairsPaged(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<RepairListResult> {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.status) qs.set('status', params.status);
  if (params.search) qs.set('search', params.search);
  const response: any = await fetchApi<any>(`/repairs?${qs.toString()}`);
  const data: RepairOrder[] = Array.isArray(response) ? response : (response?.data ?? []);
  const pagination: RepairListPagination = (!Array.isArray(response) && response?.pagination)
    ? response.pagination
    : { total: data.length, page: params.page ?? 1, limit: params.limit ?? 20, pages: 1 };
  return { data, pagination };
}

export async function getRepairStats(): Promise<RepairStats> {
  return unwrap<RepairStats>(await fetchApi<any>('/repairs/stats'));
}

export async function getRepair(id: string): Promise<RepairOrder> {
  return unwrap<RepairOrder>(await fetchApi<any>(`/repairs/${id}`));
}

export async function createRepair(payload: Partial<RepairOrder>): Promise<{ id: string; ticketNo: string }> {
  return unwrap(await fetchApi<any>('/repairs', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function updateRepair(id: string, payload: Partial<RepairOrder>): Promise<void> {
  await fetchApi(`/repairs/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function setRepairStatus(id: string, status: RepairStatus, note?: string): Promise<void> {
  await fetchApi(`/repairs/${id}/status`, { method: 'POST', body: JSON.stringify({ status, note }) });
}

export async function collectBalance(id: string, payload: {
  amount: number;
  paymentMode: PaymentMode;
  gateway?: string;
  gatewayRef?: string;
  markDelivered?: boolean;
}): Promise<void> {
  await fetchApi(`/repairs/${id}/collect-balance`, {
    method: 'POST',
    body: JSON.stringify({
      amount:           payload.amount,
      payment_mode:     payload.paymentMode,
      gateway:          payload.gateway,
      gateway_ref:      payload.gatewayRef,
      mark_delivered:   payload.markDelivered ?? true,
    }),
  });
}

export async function sendRepairEmail(id: string, payload: {
  to: string; subject?: string; message?: string; docType?: 'job_card' | 'status_update';
}): Promise<void> {
  const r: any = await fetchApi<any>(`/repairs/${id}/email`, { method: 'POST', body: JSON.stringify(payload) });
  return r && r.data !== undefined ? r.data : r;
}
