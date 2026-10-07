import { fetchApi } from './api';

export interface ExpenseItem {
  id?: string;
  description: string;
  quantity: number;
  unitCost?: number | null;
  amount: number;
}

export type ExpenseStatus = 'unpaid' | 'partial' | 'paid' | 'pending_approval' | 'cancelled';

export interface Expense {
  id: string;
  expenseNumber?: string;
  category: string;
  payee?: string;
  description?: string;
  amount: number;
  subtotal?: number;
  taxAmount?: number;
  taxInclusive?: number | boolean;
  shippingAmount?: number;
  discountAmount?: number;
  lineItems?: ExpenseItem[];
  expenseDate: string;
  dueDate?: string;
  status: ExpenseStatus;
  paidAmount?: number;
  paymentMethod?: string;
  reference?: string;
  supplierId?: string;
  supplierName?: string;
  notes?: string;
  isRecurring?: number | boolean;
  recurrenceInterval?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextOccurrence?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdByName?: string;
  createdAt?: string;
}

export interface ExpenseSummary {
  total: number;
  paidTotal: number;
  unpaidTotal: number;
  overdueTotal?: number;
  thisMonth: number;
}

export interface OutgoingPayment {
  id: string;
  paymentNumber?: string;
  payeeType: 'supplier' | 'expense' | 'other';
  payeeName?: string;
  supplierId?: string;
  supplierName?: string;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  expenseId?: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  status: 'completed' | 'voided';
  createdByName?: string;
  createdAt?: string;
}

export interface PaymentSummary {
  totalPaid: number;
  thisMonth: number;
  supplierOutstanding: number;
}

export interface SupplierOutstandingPo {
  id: string;
  purchaseOrderNumber?: string;
  orderDate?: string;
  expectedDeliveryDate?: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
}

export interface ExpensePayload {
  category: string;
  payee?: string;
  description?: string;
  amount: number;
  expenseDate: string;
  dueDate?: string;
  status?: 'unpaid' | 'paid';
  paymentMethod?: string;
  reference?: string;
  supplierId?: string;
  notes?: string;
  items?: ExpenseItem[];
  taxAmount?: number;
  shippingAmount?: number;
  discountAmount?: number;
  taxInclusive?: boolean;
  isRecurring?: boolean;
  recurrenceInterval?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextOccurrence?: string;
}

export interface FinanceSettings {
  expenseApprovalThreshold?: number | null;
}

export const RECURRENCE_INTERVALS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
] as const;

export interface Vendor {
  id: string;
  supplierName: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
}

export interface PaymentPayload {
  payeeType: 'supplier' | 'expense' | 'other';
  supplierId?: string;
  purchaseOrderId?: string;
  expenseId?: string;
  payeeName?: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  reference?: string;
  notes?: string;
}

export const EXPENSE_CATEGORIES = [
  'Rent', 'Utilities', 'Salaries & Wages', 'Supplies', 'Marketing',
  'Transport & Fuel', 'Maintenance & Repairs', 'Insurance', 'Taxes & Licenses',
  'Supplier Bill', 'Miscellaneous',
];

export const PAYMENT_METHODS = [
  'Cash', 'Bank Transfer', 'Card', 'Cheque', 'Mobile Money', 'Other',
];

export const financeService = {
  async listExpenses(params: { search?: string; category?: string; status?: string; supplierId?: string; from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    const res = await fetchApi<{ items: Expense[]; summary: ExpenseSummary }>(`/finance/expenses?${qs.toString()}`);
    return res;
  },

  async listExpenseCategories() {
    return fetchApi<{ categories: string[] }>('/finance/expenses/categories');
  },

  async createExpense(payload: ExpensePayload) {
    return fetchApi<{ id: string; expenseNumber: string }>('/finance/expenses', { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateExpense(id: string, payload: Partial<ExpensePayload>) {
    return fetchApi<{ ok: boolean }>(`/finance/expenses/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async deleteExpense(id: string) {
    return fetchApi<{ ok: boolean }>(`/finance/expenses/${id}`, { method: 'DELETE' });
  },

  async approveExpense(id: string, opts: { paid?: boolean; paymentMethod?: string; reference?: string } = {}) {
    return fetchApi<{ ok: boolean; status: string }>(`/finance/expenses/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ status: opts.paid ? 'paid' : 'unpaid', paymentMethod: opts.paymentMethod, reference: opts.reference }),
    });
  },

  async getSettings() {
    return fetchApi<FinanceSettings>('/finance/settings');
  },

  async updateSettings(s: FinanceSettings) {
    return fetchApi<{ ok: boolean }>('/finance/settings', { method: 'PUT', body: JSON.stringify(s) });
  },

  /** Authenticated CSV download (GL hand-off) — same pattern as platformApi's export. */
  async downloadExpensesCsv(params: { search?: string; category?: string; status?: string; from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    const token = localStorage.getItem('auth_token');
    const storeId = localStorage.getItem('store_id') || '';
    const base = ((import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5172') as string)
      .replace(/\/api\/?$/, '');
    const res = await fetch(`${base}/api/finance/expenses/export.csv?${qs.toString()}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(storeId ? { 'x-store-id': storeId, 'store-id': storeId } : {}),
      },
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },

  async listPayments(params: { search?: string; payeeType?: string; supplierId?: string; from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, v); });
    return fetchApi<{ items: OutgoingPayment[]; summary: PaymentSummary }>(`/finance/payments?${qs.toString()}`);
  },

  async createPayment(payload: PaymentPayload) {
    return fetchApi<{ id: string; paymentNumber: string }>('/finance/payments', { method: 'POST', body: JSON.stringify(payload) });
  },

  async voidPayment(id: string, reason?: string) {
    return fetchApi<{ ok: boolean }>(`/finance/payments/${id}/void`, { method: 'POST', body: JSON.stringify({ reason }) });
  },

  async supplierOutstanding(supplierId: string) {
    return fetchApi<{ items: SupplierOutstandingPo[] }>(`/finance/supplier-outstanding?supplierId=${supplierId}`);
  },

  async searchVendors(search = '') {
    return fetchApi<{ items: Vendor[] }>(`/finance/vendors?search=${encodeURIComponent(search)}`);
  },

  async createVendor(payload: { name: string; contactPerson?: string; email?: string; phone?: string }) {
    return fetchApi<{ id: string; supplierName: string }>('/finance/vendors', { method: 'POST', body: JSON.stringify(payload) });
  },
};
