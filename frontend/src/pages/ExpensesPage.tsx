import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Plus, RefreshCcw, Receipt, Wallet, AlertCircle,
  Pencil, Trash2, CheckCircle2, Search,
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
  financeService, Expense, ExpenseSummary, ExpensePayload,
  EXPENSE_CATEGORIES, PAYMENT_METHODS,
} from '@/services/financeService';
import { fetchApi } from '@/services/api';

interface SupplierLite { id: string; name: string; }

const ALL = '__all';

const statusBadge = (status: Expense['status']) => {
  if (status === 'paid') return <Badge className="bg-green-100 text-green-800 border-green-200">Paid</Badge>;
  if (status === 'cancelled') return <Badge variant="secondary">Cancelled</Badge>;
  return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Unpaid</Badge>;
};

export default function ExpensesPage() {
  const { formatCurrency } = useCurrency();
  const { formatDate } = useDateFormatting();
  const { user } = useAuth();
  const canManage = hasAnyPermission(user, ['finance.manage']);

  const [items, setItems] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
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

  // form fields
  const [fCategory, setFCategory] = useState('');
  const [fCustomCategory, setFCustomCategory] = useState('');
  const [fPayee, setFPayee] = useState('');
  const [fDescription, setFDescription] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [fStatus, setFStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [fMethod, setFMethod] = useState('Cash');
  const [fReference, setFReference] = useState('');
  const [fSupplier, setFSupplier] = useState('');
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
    financeService.listExpenseCategories()
      .then(r => setCategories(r.categories))
      .catch(() => {});
    fetchApi<{ suppliers?: SupplierLite[]; items?: SupplierLite[] } | SupplierLite[]>('/suppliers?limit=200')
      .then((r: any) => {
        const list = Array.isArray(r) ? r : (r.suppliers || r.items || []);
        setSuppliers(list.map((s: any) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {});
  }, []);

  const allCategories = useMemo(
    () => Array.from(new Set([...EXPENSE_CATEGORIES, ...categories])).sort(),
    [categories]
  );

  const openNew = () => {
    setEditing(null);
    setFCategory(''); setFCustomCategory(''); setFPayee(''); setFDescription('');
    setFAmount(''); setFDate(new Date().toISOString().slice(0, 10));
    setFStatus('unpaid'); setFMethod('Cash'); setFReference(''); setFSupplier(''); setFNotes('');
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (e: Expense) => {
    setEditing(e);
    const known = allCategories.includes(e.category) || EXPENSE_CATEGORIES.includes(e.category);
    setFCategory(known ? e.category : '__custom');
    setFCustomCategory(known ? '' : e.category);
    setFPayee(e.payee || ''); setFDescription(e.description || '');
    setFAmount(String(e.amount));
    setFDate(e.expenseDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setFStatus(e.status === 'paid' ? 'paid' : 'unpaid');
    setFMethod(e.paymentMethod || 'Cash'); setFReference(e.reference || '');
    setFSupplier(e.supplierId || ''); setFNotes(e.notes || '');
    setFormError(null);
    setModalOpen(true);
  };

  const save = async () => {
    const category = fCategory === '__custom' ? fCustomCategory.trim() : fCategory;
    if (!category) { setFormError('Pick or enter a category.'); return; }
    const amt = Number(fAmount);
    if (!Number.isFinite(amt) || amt <= 0) { setFormError('Enter a positive amount.'); return; }

    setSaving(true);
    setFormError(null);
    try {
      const payload: ExpensePayload = {
        category, payee: fPayee || undefined, description: fDescription || undefined,
        amount: amt, expenseDate: fDate, status: fStatus,
        paymentMethod: fStatus === 'paid' ? fMethod : undefined,
        reference: fReference || undefined,
        supplierId: fSupplier || undefined, notes: fNotes || undefined,
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
            {e.payee && <>to {e.payee}</>}
            {e.supplierName && <span className="ml-1">({e.supplierName})</span>}
          </div>
        </div>
      ),
    },
    { accessor: 'category', Header: 'Category', Cell: (e) => <Badge variant="outline">{e.category}</Badge> },
    { accessor: 'expenseDate', Header: 'Date', Cell: (e) => formatDate(e.expenseDate) },
    {
      accessor: 'amount', Header: 'Amount',
      Cell: (e) => <span className="font-semibold tabular-nums">{formatCurrency(Number(e.amount))}</span>,
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
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6" /> Expenses</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Business expenses — bills, rent, wages, purchases not tied to inventory.</p>
        </div>
        {canManage && (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Add Expense</Button>
        )}
      </div>

      {/* KPI cards */}
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

      {/* Toolbar — one row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payee, reference, notes…" className="pl-10 h-11" />
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

      {/* List */}
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

      {/* Add/Edit dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
            <DialogDescription>Record a business expense. Paid expenses also appear under Payments.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select value={fCategory} onValueChange={setFCategory}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value="__custom">Other (enter below)</SelectItem>
                  </SelectContent>
                </Select>
                {fCategory === '__custom' && (
                  <Input value={fCustomCategory} onChange={e => setFCustomCategory(e.target.value)} placeholder="Category name" className="mt-2" />
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Amount</label>
                <Input type="number" min="0" step="0.01" value={fAmount} onChange={e => setFAmount(e.target.value)} className="mt-1" placeholder="0.00" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Payee</label>
                <Input value={fPayee} onChange={e => setFPayee(e.target.value)} className="mt-1" placeholder="Who gets paid" />
              </div>
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Input value={fDescription} onChange={e => setFDescription(e.target.value)} className="mt-1" placeholder="e.g. October shop rent" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Status</label>
                <Select value={fStatus} onValueChange={v => setFStatus(v as 'unpaid' | 'paid')}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Linked supplier <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Select value={fSupplier || '__none'} onValueChange={v => setFSupplier(v === '__none' ? '' : v)}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {fStatus === 'paid' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium">Payment method</label>
                  <Select value={fMethod} onValueChange={setFMethod}>
                    <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Reference</label>
                  <Input value={fReference} onChange={e => setFReference(e.target.value)} className="mt-1" placeholder="Cheque / txn no." />
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
