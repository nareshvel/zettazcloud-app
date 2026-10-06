import { fetchApi } from './api';

/**
 * Client for the jewelry/retail operations modules:
 * memo & consignment, layaway, savings schemes, metal rates,
 * attachments, catalog sync and jewelry reports.
 */

const unwrap = <T,>(r: any): T => (r && r.data !== undefined ? r.data : r);

/* ------------------------------ Memo / consignment ------------------------------ */
export type MemoDirection = 'in' | 'out';
export type MemoStatus = 'open' | 'partially_returned' | 'returned' | 'purchased' | 'sold' | 'cancelled';

export interface MemoItem {
  id?: string;
  memoId?: string;
  productId?: string | null;
  productName?: string | null;
  productSku?: string | null;
  pieceId?: string | null;
  pieceCode?: string | null;
  barcode?: string | null;
  purity?: string | null;
  grossWeight?: number | null;
  netWeight?: number | null;
  description: string;
  quantity: number;
  returnedQuantity?: number;
  unitValue?: number | null;
  lineValue?: number | null;
  status?: 'held' | 'returned' | 'purchased' | 'sold';
}

export interface Memo {
  id: string;
  memoNo: string;
  direction: MemoDirection;
  status: MemoStatus;
  supplierId?: string | null;
  customerId?: string | null;
  supplierName?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  employeeId?: string | null;
  issueDate: string;
  dueDate?: string | null;
  totalValue: number;
  notes?: string | null;
  itemCount?: number;
  returnedCount?: number;
  items?: MemoItem[];
}

export interface MemoListResponse {
  data: Memo[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export interface MemoStats {
  total: number;
  openCount: number;
  partialCount: number;
  returnedCount: number;
  overdueCount: number;
  valueOut: number;
  valueIn: number;
}

// Returns the raw { data, pagination } envelope (server-side search + paging,
// same pattern as salesReturnService.getAllReturns) so the page can drive a
// Previous/Next list instead of loading everything into memory.
export const listMemosPaged = async (params?: {
  direction?: string; status?: string; overdue?: boolean; search?: string; page?: number; limit?: number;
}): Promise<MemoListResponse> => {
  const q = new URLSearchParams();
  if (params?.direction) q.set('direction', params.direction);
  if (params?.status)    q.set('status', params.status);
  if (params?.overdue)   q.set('overdue', '1');
  if (params?.search)    q.set('search', params.search);
  q.set('page',  String(params?.page  ?? 1));
  q.set('limit', String(params?.limit ?? 20));
  const res: any = await fetchApi<any>(`/memos?${q.toString()}`);
  return { data: res?.data ?? [], pagination: res?.pagination ?? { total: 0, page: 1, limit: 20, pages: 1 } };
};

export const getMemoStats = async (): Promise<MemoStats> =>
  unwrap<MemoStats>(await fetchApi<any>('/memos/stats'));

export const listMemos = async (params?: { direction?: string; status?: string; q?: string }): Promise<Memo[]> => {
  const q = new URLSearchParams();
  if (params?.direction) q.set('direction', params.direction);
  if (params?.status)    q.set('status', params.status);
  if (params?.q)         q.set('q', params.q);
  const qs = q.toString();
  return unwrap<Memo[]>(await fetchApi<any>(`/memos${qs ? `?${qs}` : ''}`));
};
export const getMemo = async (id: string): Promise<Memo> =>
  unwrap(await fetchApi<any>(`/memos/${id}`));
export const createMemo = async (payload: any) =>
  unwrap(await fetchApi<any>('/memos', { method: 'POST', body: JSON.stringify(payload) }));
export const updateMemo = async (id: string, payload: { due_date?: string | null; notes?: string | null; employee_id?: string | null }) =>
  fetchApi(`/memos/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const returnMemoItems = async (id: string, items: { itemId: string; quantity?: number }[]) =>
  unwrap(await fetchApi<any>(`/memos/${id}/return`, {
    method: 'POST',
    body: JSON.stringify({ items: items.map(i => ({ item_id: i.itemId, quantity: i.quantity })) }),
  }));
export const setMemoStatus = async (id: string, status: MemoStatus) =>
  fetchApi(`/memos/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });

/* ------------------------------ Layaway ------------------------------ */
export type LayawayStatus = 'active' | 'completed' | 'cancelled' | 'defaulted';
export interface Layaway {
  id: string; planNo: string; customerId?: string | null;
  customerFirstName?: string | null; customerLastName?: string | null;
  customerPhone?: string | null; customerEmail?: string | null;
  totalAmount: number; downPayment: number; paidAmount: number; balance?: number;
  installmentAmount?: number | null; installmentCount?: number | null;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  startDate: string; dueDate?: string | null; status: LayawayStatus;
  isComplete?: boolean; paidPct?: number; items?: any[]; payments?: any[];
}

/** Normalise a raw DB row (snake_case) → Layaway (camelCase). */
const mapLayaway = (r: any): Layaway => ({
  id: r.id,
  planNo: r.plan_no ?? r.planNo ?? '',
  customerId: r.customer_id ?? r.customerId ?? null,
  customerFirstName: r.customer_first_name ?? r.customerFirstName ?? null,
  customerLastName: r.customer_last_name ?? r.customerLastName ?? null,
  customerPhone: r.customer_phone ?? r.customerPhone ?? null,
  customerEmail: r.customer_email ?? r.customerEmail ?? null,
  totalAmount: Number(r.total_amount ?? r.totalAmount ?? 0),
  downPayment: Number(r.down_payment ?? r.downPayment ?? 0),
  paidAmount: Number(r.paid_amount ?? r.paidAmount ?? 0),
  balance: r.balance != null ? Number(r.balance) : undefined,
  installmentAmount: r.installment_amount != null ? Number(r.installment_amount) : (r.installmentAmount != null ? Number(r.installmentAmount) : null),
  installmentCount: r.installment_count != null ? Number(r.installment_count) : (r.installmentCount != null ? Number(r.installmentCount) : null),
  frequency: r.frequency ?? 'monthly',
  startDate: r.start_date ?? r.startDate ?? '',
  dueDate: r.due_date ?? r.dueDate ?? null,
  status: r.status ?? 'active',
  isComplete: r.isComplete ?? r.is_complete ?? false,
  paidPct: r.paidPct ?? r.paid_pct ?? 0,
  items: r.items,
  payments: r.payments,
});

/** Back-compat simple listing (no pagination) — kept for any external caller. */
export const listLayaways = async (status?: string): Promise<Layaway[]> => {
  const raw = unwrap<any[]>(await fetchApi<any>(`/layaways${status ? `?status=${status}` : ''}`));
  return (Array.isArray(raw) ? raw : []).map(mapLayaway);
};

export interface LayawayListResult {
  data: Layaway[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/** Server-side paginated + searched listing, mirroring salesReturnService.getAllReturns. */
export const getLayaways = async (params?: {
  status?: string; search?: string; page?: number; limit?: number;
}): Promise<LayawayListResult> => {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.search) q.set('search', params.search);
  q.set('page', String(params?.page ?? 1));
  q.set('limit', String(params?.limit ?? 20));
  const res: any = await fetchApi<any>(`/layaways?${q.toString()}`);
  const rows = Array.isArray(res?.data) ? res.data : [];
  return {
    data: rows.map(mapLayaway),
    pagination: res?.pagination ?? { page: 1, limit: 20, total: rows.length, pages: 1 },
  };
};

/** Lightweight active-plan search used by the Sales Hub "Collect Payment" quick action. */
export const searchLayaways = async (q: string): Promise<Layaway[]> => {
  if (!q.trim()) return [];
  const raw = unwrap<any[]>(await fetchApi<any>(`/layaways/search?q=${encodeURIComponent(q)}`));
  return (Array.isArray(raw) ? raw : []).map(mapLayaway);
};

export const getLayaway = async (id: string): Promise<Layaway> => mapLayaway(unwrap(await fetchApi<any>(`/layaways/${id}`)));
export const previewLayaway = async (payload: any) => unwrap(await fetchApi<any>('/layaways/preview', { method: 'POST', body: JSON.stringify(payload) }));
export const createLayaway = async (payload: any) => unwrap(await fetchApi<any>('/layaways', { method: 'POST', body: JSON.stringify(payload) }));
export const addLayawayPayment = async (id: string, payload: any) =>
  unwrap(await fetchApi<any>(`/layaways/${id}/payments`, { method: 'POST', body: JSON.stringify(payload) }));
export const setLayawayStatus = async (id: string, status: LayawayStatus) =>
  fetchApi(`/layaways/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) });

export const sendLayawayEmail = async (id: string, payload: {
  to: string; subject?: string; message?: string; docType?: 'agreement' | 'statement';
}) => unwrap(await fetchApi<any>(`/layaways/${id}/email`, { method: 'POST', body: JSON.stringify(payload) }));

/* ------------------------------ Savings schemes ------------------------------ */
export interface SchemePlan {
  id: string;
  name: string;
  accrualType: 'amount' | 'weight';
  installmentAmount?: number | null;
  durationMonths: number;
  bonusType: 'none' | 'extra_installment' | 'percentage';
  bonusValue: number;
  isActive?: boolean | number;
  terms?: string | null;
}

export interface SchemeEnrollment {
  id: string;
  enrollmentNo: string;
  planId?: string;
  planName?: string;
  installmentAmount?: number | null;
  customerId: string;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  employeeId?: string | null;
  startDate: string;
  maturityDate?: string | null;
  paidInstallments: number;
  totalPaid: number;
  totalWeight: number;
  bonusAmount?: number;
  notes?: string | null;
  status: 'active' | 'matured' | 'redeemed' | 'cancelled';
  redeemableValue?: number;
  bonus?: number;
  payments?: any[];
  accrualType?: string;
  durationMonths?: number;
  bonusType?: string;
  bonusValue?: number;
  redeemedSaleId?: string | null;
}

/** List all active plans (pass all=true to include inactive) */
export const listSchemePlans = async (all = false): Promise<SchemePlan[]> =>
  unwrap(await fetchApi<any>(`/savings-schemes/plans${all ? '?all=1' : ''}`));

export const createSchemePlan = async (payload: any) =>
  unwrap(await fetchApi<any>('/savings-schemes/plans', { method: 'POST', body: JSON.stringify(payload) }));

export const updateSchemePlan = async (id: string, payload: any) =>
  unwrap(await fetchApi<any>(`/savings-schemes/plans/${id}`, { method: 'PUT', body: JSON.stringify(payload) }));

/** List enrollments; optionally filter by status and/or free-text search */
export const listEnrollments = async (status?: string, q?: string): Promise<SchemeEnrollment[]> => {
  const p = new URLSearchParams();
  if (status) p.set('status', status);
  if (q)      p.set('q', q);
  const qs = p.toString() ? `?${p.toString()}` : '';
  return unwrap(await fetchApi<any>(`/savings-schemes/enrollments${qs}`));
};

export interface Pagination { total: number; page: number; pages: number; limit: number; }

/**
 * Server-side paginated + searched enrollment list, mirroring
 * salesReturnService.getAllReturns — used by the redesigned enrollment
 * list view and by the Sales Hub "Collect Payment" quick-action search
 * (status: 'active', small limit). Search matches enrollment number,
 * customer name, phone, email, and plan name (see savingsSchemes.routes.js).
 */
export const listEnrollmentsPaged = async (opts: {
  status?: string; q?: string; page?: number; limit?: number;
}): Promise<{ data: SchemeEnrollment[]; pagination: Pagination }> => {
  const p = new URLSearchParams();
  if (opts.status) p.set('status', opts.status);
  if (opts.q)      p.set('q', opts.q);
  p.set('page',  String(opts.page ?? 1));
  p.set('limit', String(opts.limit ?? 20));
  // Backend nests { data, pagination } inside its own `data` field (not as
  // a sibling of it) specifically so fetchApi's status/data unwrap doesn't
  // strip pagination — see savingsSchemes.routes.js's GET /enrollments.
  const unwrapped = await fetchApi<{ data: SchemeEnrollment[]; pagination: Pagination }>(
    `/savings-schemes/enrollments?${p.toString()}`
  );
  return { data: unwrapped?.data ?? [], pagination: unwrapped?.pagination };
};

export const getEnrollment = async (id: string): Promise<SchemeEnrollment> =>
  unwrap(await fetchApi<any>(`/savings-schemes/enrollments/${id}`));

export const createEnrollment = async (payload: any) =>
  unwrap(await fetchApi<any>('/savings-schemes/enrollments', { method: 'POST', body: JSON.stringify(payload) }));

export const addSchemePayment = async (id: string, payload: any) =>
  unwrap(await fetchApi<any>(`/savings-schemes/enrollments/${id}/payments`, {
    method: 'POST', body: JSON.stringify(payload),
  }));

export const setSchemeStatus = async (
  id: string,
  status: 'matured' | 'redeemed' | 'cancelled',
  redeemedSaleId?: string
) =>
  fetchApi(`/savings-schemes/enrollments/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, redeemed_sale_id: redeemedSaleId }),
  });

/* ------------------------------ Metal rates ------------------------------ */
export interface MetalRate {
  id: string; metal: string; purityLabel: string; purityPct?: number | null;
  ratePerGram: number; buyRatePerGram?: number | null; effectiveFrom: string; effectiveTo?: string | null;
}
export interface PricingSettings {
  weightPricingEnabled: number | boolean;
  defaultMakingChargeType: 'per_gram' | 'percentage' | 'flat';
  defaultMakingChargeValue: number;
  defaultWastagePct: number;
  marketRateApiKey?: string | null;
  marketRateLocalPremiumPct?: number;
  marketRateAutoPublish?: number | boolean;
  marketRateFetchTime?: string;
  weightUnit?: 'g' | 'oz' | 'tola' | 'baht' | 'kg';
}

export interface MarketRatePreview {
  metal: string;
  purityLabel: string;
  purityPct: number;
  ratePerGram: number;
  buyRatePerGram?: number | null;
  ratePerUnit: number;
  buyRatePerUnit?: number | null;
  spotPerTroyOz: number;
  currency: string;
  weightUnit: string;
  premiumPct: number;
  fetchedAt: string;
}

export interface MarketFetchResult {
  rates: MarketRatePreview[];
  errors: { metal: string; error: string }[];
  fetchedAt: string;
}

export const getPricingSettings = async (): Promise<PricingSettings> => unwrap(await fetchApi<any>('/metal-rates/settings'));
export const savePricingSettings = async (payload: any) => fetchApi('/metal-rates/settings', { method: 'PUT', body: JSON.stringify(payload) });
export const getCurrentRates = async (): Promise<MetalRate[]> => unwrap(await fetchApi<any>('/metal-rates/current'));
export const getRateHistory = async (): Promise<MetalRate[]> => unwrap(await fetchApi<any>('/metal-rates/history'));
export const publishRate = async (payload: any) => unwrap(await fetchApi<any>('/metal-rates', { method: 'POST', body: JSON.stringify(payload) }));
export const calculateWeightPrice = async (payload: any) => unwrap(await fetchApi<any>('/metal-rates/calculate', { method: 'POST', body: JSON.stringify(payload) }));

/** Fetch live market rates from goldapi.io — returns preview without publishing */
export const fetchMarketRates = async (metals?: string[]): Promise<MarketFetchResult> =>
  unwrap(await fetchApi<any>('/metal-rates/fetch-market', {
    method: 'POST',
    body: JSON.stringify(metals ? { metals } : {}),
  }));

/** Fetch live market rates AND publish them immediately */
export const fetchAndPublishMarketRates = async (metals?: string[]): Promise<{ published: number; errors: any[]; fetchedAt: string }> =>
  unwrap(await fetchApi<any>('/metal-rates/fetch-market/publish', {
    method: 'POST',
    body: JSON.stringify(metals ? { metals } : {}),
  }));

/* ------------------------------ Attachments ------------------------------ */
export interface Attachment {
  id: string; kind: string; label?: string | null; referenceNo?: string | null; issuer?: string | null;
  fileName: string; url: string; mimeType?: string | null; sizeBytes?: number | null; createdAt?: string;
}

export const listAttachments = async (entityType: string, entityId: string): Promise<Attachment[]> =>
  unwrap(await fetchApi<any>(`/attachments/${entityType}/${entityId}`));

/** Upload uses FormData, which the api client does NOT case-convert — send snake_case keys. */
export const uploadAttachment = async (
  entityType: string, entityId: string, file: File,
  meta?: { kind?: string; label?: string; reference_no?: string; issuer?: string }
) => {
  const fd = new FormData();
  fd.append('file', file);
  Object.entries(meta || {}).forEach(([k, v]) => { if (v) fd.append(k, String(v)); });
  return unwrap(await fetchApi<any>(`/attachments/${entityType}/${entityId}`, { method: 'POST', body: fd }));
};

export const deleteAttachment = async (id: string) => fetchApi(`/attachments/${id}`, { method: 'DELETE' });

/* ------------------------------ Catalog sync ------------------------------ */
export interface SalesChannel {
  id: string; name: string; platform: string;
  status: 'disconnected' | 'connected' | 'error' | 'paused';
  autoSync?: number | boolean; lastSyncAt?: string | null; lastError?: string | null; hasCredentials?: boolean;
}
export const listChannels = async (): Promise<SalesChannel[]> => unwrap(await fetchApi<any>('/catalog/channels'));
export const createChannel = async (payload: any) => unwrap(await fetchApi<any>('/catalog/channels', { method: 'POST', body: JSON.stringify(payload) }));
export const updateChannel = async (id: string, payload: any) => fetchApi(`/catalog/channels/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
export const getChannelProducts = async (id: string) => unwrap<any[]>(await fetchApi<any>(`/catalog/channels/${id}/products`));
export const publishToChannel = async (id: string, productIds: string[], publish = true) =>
  unwrap(await fetchApi<any>(`/catalog/channels/${id}/publish`, { method: 'POST', body: JSON.stringify({ productIds, publish }) }));
export const getSyncQueue = async () => unwrap<any[]>(await fetchApi<any>('/catalog/queue'));

/* ------------------------------ Jewelry reports ------------------------------ */
export const getPurityValuation = async () => unwrap<any>(await fetchApi<any>('/jewelry-reports/purity-valuation'));
export const getPieceStatusReport = async () => unwrap<any[]>(await fetchApi<any>('/jewelry-reports/piece-status'));
export const getOldGoldSummary = async () => unwrap<any[]>(await fetchApi<any>('/jewelry-reports/old-gold-summary'));
