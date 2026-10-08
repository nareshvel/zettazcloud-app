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

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface MoneyAccount {
  id: string;
  code: string;
  name: string;
  accountType: AccountType;
  subtype?: string | null;
  storeId?: string | null;
  openingBalance: number;
  isSystem: number | boolean;
  isActive: number | boolean;
  totalDebit: number;
  totalCredit: number;
  balance: number;
  debitNormal: number | boolean;
}

export interface AccountMapping {
  mappingKey: string;
  accountId: string;
  code: string;
  name: string;
  accountType: AccountType;
  isActive: number | boolean;
}

export interface JournalLine {
  lineNo: number;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  memo?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
}

export interface JournalEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  sourceType: string;
  sourceId?: string | null;
  memo?: string | null;
  status: 'posted' | 'voided';
  reversalOfId?: string | null;
  storeId?: string | null;
  createdAt: string;
  lines: JournalLine[];
}

export const ACCOUNT_TYPES: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

export interface DrawerSession {
  id: string;
  storeId: string;
  accountId: string;
  openingFloat: number;
  openedAt: string;
  openedBy?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  countedCash?: number | null;
  expectedCash?: number | null;
  variance?: number | null;
  status: 'open' | 'closed';
  notes?: string | null;
  accountCode?: string;
  accountName?: string;
  storeName?: string;
  openedByName?: string;
  closedByName?: string;
}

export interface DrawerMovement {
  id: string;
  sessionId: string;
  direction: 'paid_in' | 'paid_out';
  amount: number;
  reason?: string | null;
  journalEntryId?: string | null;
  createdByName?: string;
  createdAt: string;
}

export interface CashFlowAccountRow {
  id: string;
  code: string;
  name: string;
  subtype?: string | null;
  storeId?: string | null;
  opening: number;
  inflow: number;
  outflow: number;
  closing: number;
}

export interface CashFlowReport {
  from?: string | null;
  to?: string | null;
  accounts: CashFlowAccountRow[];
  bySource: { sourceType: string; moneyIn: number; moneyOut: number }[];
  totals: { opening: number; inflow: number; outflow: number; closing: number };
}

export interface ProfitLossLine {
  code: string;
  name: string;
  subtype?: string | null;
  amount: number;
}

export interface ProfitLossReport {
  from?: string | null;
  to?: string | null;
  revenue: ProfitLossLine[];
  expenses: ProfitLossLine[];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}

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

  // ---- Money accounts + ledger -------------------------------------------

  async listAccounts(params: { storeId?: string } = {}) {
    const qs = params.storeId ? `?store_id=${encodeURIComponent(params.storeId)}` : '';
    return fetchApi<{ accounts: MoneyAccount[] }>(`/finance/accounts${qs}`);
  },

  async createAccount(payload: { code: string; name: string; accountType: AccountType; subtype?: string; storeId?: string; openingBalance?: number }) {
    return fetchApi<{ id: string; code: string }>('/finance/accounts', { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateAccount(id: string, payload: { name?: string; subtype?: string | null; isActive?: boolean; openingBalance?: number }) {
    return fetchApi<{ ok: boolean }>(`/finance/accounts/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async listMappings() {
    return fetchApi<{ mappings: AccountMapping[] }>('/finance/mappings');
  },

  async updateMapping(key: string, accountId: string) {
    return fetchApi<{ ok: boolean }>(`/finance/mappings/${encodeURIComponent(key)}`, { method: 'PUT', body: JSON.stringify({ accountId }) });
  },

  async listLedger(params: { accountId?: string; sourceType?: string; from?: string; to?: string; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.accountId) qs.set('account_id', params.accountId);
    if (params.sourceType) qs.set('source_type', params.sourceType);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.limit) qs.set('limit', String(params.limit));
    return fetchApi<{ entries: JournalEntry[] }>(`/finance/ledger?${qs.toString()}`);
  },

  async postJournal(payload: { entryDate?: string; memo?: string; lines: { accountId?: string; accountCode?: string; debit?: number; credit?: number; memo?: string }[] }) {
    return fetchApi<{ entryId: string; entryNumber: string }>('/finance/journal', { method: 'POST', body: JSON.stringify(payload) });
  },

  async reverseJournal(id: string, memo?: string) {
    return fetchApi<{ entryId: string; entryNumber: string }>(`/finance/journal/${id}/reverse`, { method: 'POST', body: JSON.stringify({ memo }) });
  },

  // ---- Cash drawer sessions + transfers ----------------------------------

  async listDrawerSessions(params: { status?: string; storeId?: string; limit?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.storeId) qs.set('store_id', params.storeId);
    if (params.limit) qs.set('limit', String(params.limit));
    return fetchApi<{ sessions: DrawerSession[] }>(`/finance/drawer-sessions?${qs.toString()}`);
  },

  async currentDrawerSession(storeId: string) {
    return fetchApi<{ session: (DrawerSession & { expectedCashLive: number }) | null; movements: DrawerMovement[] }>(
      `/finance/drawer-sessions/current?store_id=${encodeURIComponent(storeId)}`
    );
  },

  async openDrawer(payload: { storeId: string; openingFloat: number; accountId?: string; notes?: string }) {
    return fetchApi<{ id: string }>('/finance/drawer-sessions', { method: 'POST', body: JSON.stringify(payload) });
  },

  async drawerMovement(sessionId: string, payload: { direction: 'paid_in' | 'paid_out'; amount: number; reason?: string; counterpartAccountId?: string }) {
    return fetchApi<{ id: string; entryNumber: string }>(`/finance/drawer-sessions/${sessionId}/movements`, { method: 'POST', body: JSON.stringify(payload) });
  },

  async closeDrawer(sessionId: string, countedCash: number) {
    return fetchApi<{ expectedCash: number; countedCash: number; variance: number; varianceEntry?: string | null }>(
      `/finance/drawer-sessions/${sessionId}/close`, { method: 'POST', body: JSON.stringify({ countedCash }) }
    );
  },

  async createTransfer(payload: { fromAccountId: string; toAccountId: string; amount: number; memo?: string; entryDate?: string; storeId?: string }) {
    return fetchApi<{ entryId: string; entryNumber: string }>('/finance/transfers', { method: 'POST', body: JSON.stringify(payload) });
  },

  // ---- Reports -----------------------------------------------------------

  async getCashFlow(params: { from?: string; to?: string; storeId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.storeId) qs.set('store_id', params.storeId);
    return fetchApi<CashFlowReport>(`/finance/reports/cash-flow?${qs.toString()}`);
  },

  async getProfitLoss(params: { from?: string; to?: string; storeId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.storeId) qs.set('store_id', params.storeId);
    return fetchApi<ProfitLossReport>(`/finance/reports/profit-loss?${qs.toString()}`);
  },

  /** Authenticated journal-lines CSV download — same pattern as expenses export. */
  async downloadLedgerCsv(params: { accountId?: string; sourceType?: string; from?: string; to?: string; storeId?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.accountId) qs.set('account_id', params.accountId);
    if (params.storeId) qs.set('store_id', params.storeId);
    if (params.sourceType) qs.set('source_type', params.sourceType);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const token = localStorage.getItem('auth_token');
    const storeId = localStorage.getItem('store_id') || '';
    const base = ((import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5172') as string)
      .replace(/\/api\/?$/, '');
    const res = await fetch(`${base}/api/finance/ledger/export.csv?${qs.toString()}`, {
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
    a.download = `journal-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  },
};
