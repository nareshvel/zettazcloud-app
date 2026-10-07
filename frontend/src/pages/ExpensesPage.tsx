import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Plus, RefreshCcw, Receipt, Wallet, AlertCircle,
  Pencil, Trash2, CheckCircle2, Search, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';
import { useCurrency, useDateFormatting } from '@/contexts/LocalizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import {
  financeService, Expense, ExpenseSummary, ExpensePayload, ExpenseItem, Vendor,
  EXPENSE_CATEGORIES, PAYMENT_METHODS,
} from '@/services/financeService';

const ALL = '__all';
const CUSTOM = '__custom';

const statusBadge = (status: Expense['status']) => {
  if (status === 'paid') return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
  if (status === 'cancelled') return <Badge variant="secondary">Cancelled</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Unpaid</Badge>;
};

import VendorSelect from '@/components/finance/VendorSelect';

export default function ExpensesPage() {
  const { formatCurrency } = useCurrency();
  const { formatDate } = useDateFormatting();
  const { user } = useAuth();
  const canManage = hasAnyPermission(user, ['finance.manage']);

  const [items, setItems] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState(ALL);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  // form state
  const [fVendor, setFVendor] = useState<Vendor | null>(null);
  const [fCategory, setFCategory] = useState('');
  const [fCustomCategory, setFCustomCategory] = useState('');
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [fPaid, setFPaid] = useState(false);
  const [fMethod, setFMethod] = useState('Cash');
  const [fReference, setFReference] = useState('');
  const [fItems, setFItems] = useState<ExpenseItem[]>([{ description: '', quantity: 1, unitCost: null, amount: 0 }]);
  const [fTax, setFTax] = useState('');
  const [fShipping, setFShipping] = useState('');
  const [fDiscount, setFDiscount] = useState('');
  const [fNotes, setFNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeService.listExpenses({
        search: search || undefined,
        category: categoryFilter !== ALL ? categoryFilter : undefined,
        status: statusFilter !== ALL ? statusFilter : undefined,
      });
      setItems(res.items);
      setSummary(res.summary);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load expenses.');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    financeService.listExpenseCategories().then(r => setCategories(r.categories)).catch(() => {});
    financeService.searchVendors('').then(r => setVendors(r.items)).catch(() => {});
  }, []);

  const allCategories = useMemo(
    () => Array.from(new Set([...EXPENSE_CATEGORIES, ...categories])).sort(),
    [categories]
  );

  const num = (v: string) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
  const lineTotal = (it: ExpenseItem) =>
    it.unitCost !== null && it.unitCost !== undefined ? Math.round(it.quantity * it.unitCost * 100) / 100 : it.amount;
  const subtotal = useMemo(() => Math.round(fItems.reduce((s, i) => s + lineTotal(i), 0) * 100) / 100, [fItems]);
  const total = useMemo(
    () => Math.round((subtotal + num(fTax) + num(fShipping) - num(fDiscount)) * 100) / 100,
    [subtotal, fTax, fShipping, fDiscount]
  );

  const openNew = () => {
    setEditing(null);
    setFVendor(null);
    setFCategory(''); setFCustomCategory('');
    setFDate(new Date().toISOString().slice(0, 10));
    setFPaid(false); setFMethod('Cash'); setFReference('');
    setFItems([{ description: '', quantity: 1, unitCost: null, amount: 0 }]);
    setFTax(''); setFShipping(''); setFDiscount(''); setFNotes('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    const known = allCategories.includes(e.category);
    setFCategory(known ? e.category : CUSTOM);
    setFCustomCategory(known ? '' : e.category);
    setFVendor(e.supplierId ? { id: e.supplierId, supplierName: e.supplierName || e.payee || 'Vendor' } : null);
    setFDate(e.expenseDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setFPaid(e.status === 'paid');
    setFMethod(e.paymentMethod || 'Cash'); setFReference(e.reference || '');
    setFItems(e.lineItems?.length
      ? e.lineItems.map(i => ({ description: i.description, quantity: Number(i.quantity), unitCost: i.unitCost !== null ? Number(i.unitCost) : null, amount: Number(i.amount) }))
      : [{ description: e.description || e.category, quantity: 1, unitCost: null, amount: Number(e.amount) }]);
    setFTax(e.taxAmount ? String(e.taxAmount) : '');
    setFShipping(e.shippingAmount ? String(e.shippingAmount) : '');
    setFDiscount(e.discountAmount ? String(e.discountAmount) : '');
    setFNotes(e.notes || '');
    setFormError(null);
    setModalOpen(true);
  };

  const setItem = (idx: number, patch: Partial<ExpenseItem>) => {
    setFItems(prev => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  };

  const save = async () => {
    const category = fCategory === CUSTOM ? fCustomCategory.trim() : fCategory;
    if (!category) { setFormError('Pick or enter a category.'); return; }
    const cleanItems = fItems.filter(i => i.description.trim());
    if (!cleanItems.length) { setFormError('Add at least one line item.'); return; }
    if (cleanItems.some(i => !lineTotal(i) || lineTotal(i) <= 0)) {
      setFormError('Each line needs a unit cost or an amount.'); return;
    }
    if (total <= 0) { setFormError('The payable total must be positive.'); return; }

    setSaving(true);
    setFormError(null);
    try {
      const payload: ExpensePayload = {
        category,
        payee: fVendor?.supplierName,
        amount: total,
        expenseDate: fDate,
        status: fPaid ? 'paid' : 'unpaid',
        paymentMethod: fPaid ? fMethod : undefined,
        reference: fReference || undefined,
        supplierId: fVendor?.id,
        notes: fNotes || undefined,
        items: cleanItems.map(i => ({
          description: i.description.trim(),
          quantity: i.quantity,
          unitCost: i.unitCost ?? null,
          amount: lineTotal(i),
        })),
        taxAmount: num(fTax), shippingAmount: num(fShipping), discountAmount: num(fDiscount),
      };
      if (editing) await financeService.updateExpense(editing.id, payload);
      else await financeService.createExpense(payload);
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const addVendor = async (name: string): Promise<Vendor> => {
    const created = await financeService.createVendor({ name });
    const v: Vendor = { id: created.id, supplierName: created.supplierName || name };
    setVendors(prev => prev.some(x => x.id === v.id) ? prev : [...prev, v]);
    return v;
  };

  const markPaid = async (e: Expense) => {
    try {
      await financeService.updateExpense(e.id, { status: 'paid', paymentMethod: e.paymentMethod || 'Cash' });
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to mark paid.');
    }
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    try {
      await financeService.deleteExpense(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to delete expense.');
      setDeleteTarget(null);
    }
  };

  const columns: ColumnDefinition<Expense>[] = [
    {
      accessor: 'expense', Header: 'Expense',
      Cell: (e) => (
        <div>
          <div className="font-medium">{e.description || e.category}</div>
          <div className="text-xs text-muted-foreground">
            {e.expenseNumber && <span className="font-mono mr-2">{e.expenseNumber}</span>}
            {e.supplierName && <>to {e.supplierName}</>}
            {e.lineItems && e.lineItems.length > 1 && (
              <span className="ml-1">· {e.lineItems.length} items</span>
            )}
          </div>
        </div>
      ),
    },
    { accessor: 'category', Header: 'Category', Cell: (e) => <Badge variant="outline">{e.category}</Badge> },
    { accessor: 'expenseDate', Header: 'Date', Cell: (e) => formatDate(e.expenseDate) },
    {
      accessor: 'amount', Header: 'Amount',
      Cell: (e) => (
        <div className="text-right">
          <span className="font-semibold tabular-nums">{formatCurrency(Number(e.amount))}</span>
          {(Number(e.taxAmount) > 0 || Number(e.shippingAmount) > 0 || Number(e.discountAmount) > 0) && (
            <div className="text-xs text-muted-foreground tabular-nums">
              {Number(e.taxAmount) > 0 && `+${formatCurrency(Number(e.taxAmount))} tax `}
              {Number(e.shippingAmount) > 0 && `+${formatCurrency(Number(e.shippingAmount))} ship `}
              {Number(e.discountAmount) > 0 && `−${formatCurrency(Number(e.discountAmount))} disc`}
            </div>
          )}
        </div>
      ),
      className: 'text-right', headerClassName: 'text-right',
    },
    { accessor: 'status', Header: 'Status', Cell: (e) => statusBadge(e.status) },
    {
      accessor: 'paymentMethod', Header: 'Method',
      Cell: (e) => <span className="text-muted-foreground text-sm">{e.paymentMethod || '—'}</span>,
    },
    ...(canManage ? [{
      accessor: 'actions', Header: '',
      Cell: (e: Expense) => (
        <div className="flex items-center gap-1 justify-end">
          {e.status === 'unpaid' && (
            <Button variant="ghost" size="sm" className="h-8 text-green-700" onClick={() => markPaid(e)} title="Mark as paid">
              <CheckCircle2 className="h-4 w-4 mr-1" /> Pay
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)} title="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(e)} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      className: 'text-right w-[140px]',
    } as ColumnDefinition<Expense>] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6" /> Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Vendor bills and business expenses — itemized, with tax, shipping and discounts.</p>
        </div>
        {canManage && (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Expense</Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> This month</div>
          <div className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(summary?.thisMonth ?? 0)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Unpaid</div>
          <div className="text-xl font-bold mt-1 tabular-nums text-amber-600">{formatCurrency(summary?.unpaidTotal ?? 0)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> All-time</div>
          <div className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(summary?.total ?? 0)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendor, reference, notes…" className="pl-10 h-11" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-32 sm:w-44 h-11 shrink-0" aria-label="Filter by category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-28 sm:w-36 h-11 shrink-0" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={load} disabled={loading} title="Refresh">
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        {loading && items.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 px-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading expenses…
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search || categoryFilter !== ALL || statusFilter !== ALL
                ? 'No expenses match the current filters.'
                : 'No expenses yet. Record your first business expense.'}
            </p>
          </div>
        ) : (
          <ReusableTable columns={columns} data={items} isLoading={false} noDataMessage="No expenses." />
        )}
      </div>

      {/* Add/Edit — wide document-style form */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Expense' : 'New Expense'}</DialogTitle>
            <DialogDescription>Itemized vendor bill — lines add up, then tax, shipping and discount settle the total.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Vendor + meta row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Vendor / Payee</label>
                <VendorSelect
                  vendors={vendors}
                  value={fVendor}
                  onChange={setFVendor}
                  onAdd={addVendor}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="mt-1 h-11" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={fCategory} onValueChange={setFCategory}>
                  <SelectTrigger className="mt-1 w-full h-11"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value={CUSTOM}>Other (enter below)</SelectItem>
                  </SelectContent>
                </Select>
                {fCategory === CUSTOM && (
                  <Input value={fCustomCategory} onChange={e => setFCustomCategory(e.target.value)} placeholder="Category name" className="mt-2" />
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Status</label>
                <div className="mt-1 flex rounded-lg border overflow-hidden h-11">
                  {(['unpaid', 'paid'] as const).map(s => (
                    <button
                      key={s} type="button" onClick={() => setFPaid(s === 'paid')}
                      className={`flex-1 text-sm font-medium transition-colors ${
                        (s === 'paid') === fPaid
                          ? s === 'paid' ? 'bg-green-600 text-white' : 'bg-amber-500 text-white'
                          : 'bg-background text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {s === 'paid' ? 'Paid' : 'Unpaid'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Items</label>
                <Button
                  type="button" variant="outline" size="sm" className="h-8"
                  onClick={() => setFItems(p => [...p, { description: '', quantity: 1, unitCost: null, amount: 0 }])}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add line
                </Button>
              </div>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Description</th>
                      <th className="px-3 py-2 font-medium w-20">Qty</th>
                      <th className="px-3 py-2 font-medium w-28">Unit cost</th>
                      <th className="px-3 py-2 font-medium w-28 text-right">Amount</th>
                      <th className="w-9"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fItems.map((it, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="px-2 py-1.5">
                          <Input
                            value={it.description}
                            onChange={e => setItem(idx, { description: e.target.value })}
                            placeholder="Item or service…"
                            className="h-9 border-0 shadow-none focus-visible:ring-1"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number" min="0" step="1" value={it.quantity}
                            onChange={e => setItem(idx, { quantity: Number(e.target.value) || 0 })}
                            className="h-9 border-0 shadow-none text-right"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <Input
                            type="number" min="0" step="0.01"
                            value={it.unitCost ?? ''}
                            onChange={e => setItem(idx, { unitCost: e.target.value === '' ? null : Number(e.target.value) })}
                            placeholder="—"
                            className="h-9 border-0 shadow-none text-right"
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums font-medium">
                          {it.unitCost !== null && it.unitCost !== undefined ? (
                            formatCurrency(lineTotal(it))
                          ) : (
                            <Input
                              type="number" min="0" step="0.01"
                              value={it.amount || ''}
                              onChange={e => setItem(idx, { amount: Number(e.target.value) || 0 })}
                              placeholder="0.00"
                              className="h-9 border-0 shadow-none text-right"
                            />
                          )}
                        </td>
                        <td className="px-1 py-1.5">
                          <button
                            type="button"
                            disabled={fItems.length === 1}
                            onClick={() => setFItems(p => p.filter((_, i) => i !== idx))}
                            className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                            aria-label="Remove line"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals — GRN-style */}
            <div className="rounded-lg border bg-muted/30 p-3 sm:p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Subtotal</div>
                  <div className="font-semibold tabular-nums h-11 flex items-center">{formatCurrency(subtotal)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Tax paid</div>
                  <Input type="number" min="0" step="0.01" value={fTax} onChange={e => setFTax(e.target.value)} placeholder="0.00" className="h-11 text-right" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Shipping & handling</div>
                  <Input type="number" min="0" step="0.01" value={fShipping} onChange={e => setFShipping(e.target.value)} placeholder="0.00" className="h-11 text-right" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Discount received</div>
                  <Input type="number" min="0" step="0.01" value={fDiscount} onChange={e => setFDiscount(e.target.value)} placeholder="0.00" className="h-11 text-right" />
                </div>
              </div>
              <div className="flex items-center justify-between border-t mt-3 pt-3">
                <span className="text-sm font-medium text-muted-foreground">Total payable</span>
                <span className="text-xl font-bold tabular-nums">{formatCurrency(total)}</span>
              </div>
            </div>

            {/* Payment details when paid */}
            {fPaid && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Payment method</label>
                  <Select value={fMethod} onValueChange={setFMethod}>
                    <SelectTrigger className="mt-1 w-full h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Reference</label>
                  <Input value={fReference} onChange={e => setFReference(e.target.value)} className="mt-1 h-11" placeholder="Cheque / txn no." />
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Notes</label>
              <Input value={fNotes} onChange={e => setFNotes(e.target.value)} className="mt-1" placeholder="Optional" />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Save changes' : 'Add expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete expense?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.description || deleteTarget?.category} — {formatCurrency(Number(deleteTarget?.amount || 0))}.
              Any payment recorded against it will be voided. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
