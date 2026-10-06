import { fetchApi } from './api';

/** Client for the old-gold / metal exchange module at /api/old-gold. */

export type OldGoldStatus  = 'valued' | 'credited' | 'redeemed' | 'cancelled';
export type VoucherType    = 'credit' | 'cash';
export type TestMethod     = 'visual' | 'acid_test' | 'xrf' | 'fire_assay';
/** Payment modes available for old-gold cash settlements. */
export type PaymentMode = 'cash' | 'upi' | 'bank_transfer' | 'cheque';

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  cash:          'Cash',
  upi:           'UPI',
  bank_transfer: 'Bank Transfer',
  cheque:        'Cheque',
};

/** Base modes always available */
export const BASE_PAYMENT_MODES: PaymentMode[] = ['cash', 'bank_transfer', 'cheque'];
/** UPI is only available for India-based organisations */
export const getPaymentModes = (countryCode?: string | null): PaymentMode[] =>
  countryCode?.toUpperCase() === 'IN'
    ? ['cash', 'upi', 'bank_transfer', 'cheque']
    : BASE_PAYMENT_MODES;

export const TEST_METHOD_LABELS: Record<TestMethod, string> = {
  visual:     'Visual Inspection',
  acid_test:  'Acid Test',
  xrf:        'XRF / Spectrometer',
  fire_assay: 'Fire Assay',
};

export interface OldGoldPurchase {
  id: string;
  voucherNo: string;
  customerId?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  employeeId?: string | null;
  itemDescription?: string | null;
  metal: string;
  purityLabel?: string | null;
  purityPct?: number | null;
  claimedPurityLabel?: string | null;
  claimedPurityPct?: number | null;
  testMethod?: TestMethod | null;
  grossWeight: number;
  stoneDeduction?: number | null;
  netWeight?: number | null;
  ratePerGram: number;
  amountDeduction?: number | null;
  valuationAmount: number;
  status: OldGoldStatus;
  voucherType?: VoucherType | null;
  paymentMode?: PaymentMode | null;
  creditedAt?: string | null;
  redeemedAt?: string | null;
  redeemedSaleId?: string | null;
  notes?: string | null;
  createdAt?: string | null;
}

export interface ValuationInput {
  grossWeight: number;
  stoneDeduction?: number;
  purityPct?: number;
  netWeight?: number | null;
  ratePerGram: number;
  amountDeduction?: number;
}

const unwrap = <T,>(r: any): T => (r && r.data !== undefined ? r.data : r);

export async function listOldGold(status?: string, q?: string): Promise<OldGoldPurchase[]> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (q)      params.set('q', q);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return unwrap<OldGoldPurchase[]>(await fetchApi<any>(`/old-gold${qs}`));
}

export interface OldGoldListFilters {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface OldGoldListResult {
  data: OldGoldPurchase[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/**
 * Server-side searched/paginated list — mirrors salesReturnService.getAllReturns's
 * shape-tolerant unwrap (fetchApi already strips the `{ status, data }` envelope
 * when present, but we still defensively handle both shapes here in case a
 * caller hits this through a path where it isn't unwrapped).
 */
export async function listOldGoldPaginated(filters: OldGoldListFilters = {}): Promise<OldGoldListResult> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.append(key, String(value));
  });
  const limit = filters.limit ?? 20;

  try {
    const response = await fetchApi<any>(`/old-gold?${params.toString()}`);

    if (Array.isArray(response)) {
      return {
        data: response as OldGoldPurchase[],
        pagination: { page: filters.page ?? 1, limit, total: response.length, pages: Math.ceil(response.length / limit) || 1 },
      };
    }
    if (response && typeof response === 'object' && Array.isArray(response.data)) {
      return {
        data: response.data as OldGoldPurchase[],
        pagination: response.pagination || {
          page: filters.page ?? 1, limit, total: response.data.length, pages: Math.ceil(response.data.length / limit) || 1,
        },
      };
    }
    return { data: [], pagination: { page: 1, limit, total: 0, pages: 1 } };
  } catch (error) {
    console.error('Error in listOldGoldPaginated:', error);
    return { data: [], pagination: { page: 1, limit, total: 0, pages: 1 } };
  }
}

export async function getOldGold(id: string): Promise<OldGoldPurchase> {
  return unwrap<OldGoldPurchase>(await fetchApi<any>(`/old-gold/${id}`));
}

export async function previewValuation(input: ValuationInput): Promise<{ netWeight: number; valuationAmount: number }> {
  return unwrap(await fetchApi<any>('/old-gold/preview', { method: 'POST', body: JSON.stringify(input) }));
}

export async function createOldGold(payload: Record<string, any>): Promise<{ id: string; voucherNo: string; valuationAmount: number }> {
  return unwrap(await fetchApi<any>('/old-gold', { method: 'POST', body: JSON.stringify(payload) }));
}

export async function updateOldGold(id: string, payload: Record<string, any>): Promise<{ netWeight: number; valuationAmount: number }> {
  return unwrap(await fetchApi<any>(`/old-gold/${id}`, { method: 'PUT', body: JSON.stringify(payload) }));
}

export async function setOldGoldStatus(id: string, status: OldGoldStatus, redeemedSaleId?: string): Promise<void> {
  await fetchApi(`/old-gold/${id}/status`, { method: 'POST', body: JSON.stringify({ status, redeemed_sale_id: redeemedSaleId }) });
}

/** Client-side mirror of the backend valuation formula for instant UI feedback. */
export function computeValuationLocal(i: ValuationInput): { netWeight: number; valuationAmount: number } {
  const gross  = Number(i.grossWeight)    || 0;
  const stone  = Number(i.stoneDeduction) || 0;
  const rate   = Number(i.ratePerGram)    || 0;
  const amtDed = Number(i.amountDeduction)|| 0;

  let net: number;
  if (i.netWeight !== undefined && i.netWeight !== null && (i.netWeight as any) !== '') {
    net = Number(i.netWeight) || 0;
  } else {
    const purity = Number(i.purityPct) || 0;
    net = (gross - stone) * (purity / 100);
  }
  net = Math.max(Math.round(net * 1000) / 1000, 0);
  const valuation = Math.max(Math.round((net * rate - amtDed) * 100) / 100, 0);
  return { netWeight: net, valuationAmount: valuation };
}
