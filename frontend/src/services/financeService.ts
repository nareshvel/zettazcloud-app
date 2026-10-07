import { fetchApi } from './api';

export interface Expense {
  id: string;
  expenseNumber?: string;
  category: string;
  payee?: string;
  description?: string;
  amount: number;
  expenseDate: string;
  status: 'unpaid' | 'paid' | 'cancelled';
  paymentMethod?: string;
  reference?: string;
  supplierId?: string;
  supplierName?: string;
  notes?: string;
  createdByName?: string;
  createdAt?: string;
}

export interface ExpenseSummary {
  total: number;
  paidTotal: number;
  unpaidTotal: number;
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
  status?: 'unpaid' | 'paid';
  paymentMethod?: string;
  reference?: string;
  supplierId?: string;
  notes?: string;
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
};
