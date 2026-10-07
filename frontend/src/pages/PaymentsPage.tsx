import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Plus, RefreshCcw, HandCoins, AlertCircle, Search,
  Ban, Building2, Receipt, CircleDollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';
import { useCurrency } from '@/contexts/LocalizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import {
  financeService, OutgoingPayment, PaymentSummary, PaymentPayload,
  SupplierOutstandingPo, Expense, PAYMENT_METHODS,
} from '@/services/financeService';
import { fetchApi } from '@/services/api';

interface SupplierLite { id: string; name: string; }

const ALL = '__all';
const NONE = '__none';

const typeBadge = (t: OutgoingPayment['payeeType']) => {
  if (t === 'supplier') return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Supplier</Badge>;
  if (t === 'expense') return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Expense</Badge>;
  return <Badge variant="secondary">Other</Badge>;
};

export default function PaymentsPage() {
  const { formatCurrency, formatDate } = useCurrency();
  const { user } = useAuth();
  const canManage = hasAnyPermission(user, ['finance.manage']);

  const [items, setItems] = useState<OutgoingPayment[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);
  const [unpaidExpenses, setUnpaidExpenses] = useState<Expense[]>([]);
  const [outstandingPos, setOutstandingPos] = useState<SupplierOutstandingPo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(ALL);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<OutgoingPayment | null>(null);

  // form
  const [fType, setFType] = useState<'supplier' | 'expense' | 'other'>('supplier');
  const [fSupplier, setFSupplier] = useState('');
  const [fPo, setFPo] = useState(NONE);
  const [fExpense, setFExpense] = useState(NONE);
  const [fPayee, setFPayee] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [fMethod, setFMethod] = useState('Cash');
  const [fReference, setFReference] = useState('');
  const [fNotes, setFNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeService.listPayments({
        search: search || undefined,
        payeeType: typeFilter !== ALL ? typeFilter : undefined,
      });
      setItems(res.items);
      setSummary(res.summary);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetchApi<any>('/suppliers?limit=200')
      .then((r: any) => {
        const list = Array.isArray(r) ? r : (r.suppliers || r.items || []);
        setSuppliers(list.map((s: any) => ({ id: s.id, name: s.name })));
      })
      .catch(() => {});
    financeService.listExpenses({ status: 'unpaid' })
      .then(r => setUnpaidExpenses(r.items))
      .catch(() => {});
  }, []);

  // Outstanding POs for the chosen supplier
  useEffect(() => {
    if (!fSupplier) { setOutstandingPos([]); return; }
    financeService.supplierOutstanding(fSupplier)
      .then(r => setOutstandingPos(r.items))
      .catch(() => setOutstandingPos([]));
  }, [fSupplier]);

  const openNew = () => {
    setFType('supplier'); setFSupplier(''); setFPo(NONE); setFExpense(NONE);
    setFPayee(''); setFAmount(''); setFDate(new Date().toISOString().slice(0, 10));
    setFMethod('Cash'); setFReference(''); setFNotes('');
    setOutstandingPos([]);
    setFormError(null);
    setModalOpen(true);
  };

  const pickExpense = (expenseId: string) => {
    setFExpense(expenseId);
    const exp = unpaidExpenses.find(e => e.id === expenseId);
    if (exp) setFAmount(String(exp.amount));
  };

  const selectedPo = outstandingPos.find(p => p.id === fPo);

  const save = async () => {
    const amt = Number(fAmount);
    if (!Number.isFinite(amt) || amt <= 0) { setFormError('Enter a positive amount.'); return; }
    if (fType === 'supplier' && !fSupplier) { setFormError('Choose a supplier.'); return; }
    if (fType === 'expense' && fExpense === NONE) { setFormError('Choose an unpaid expense.'); return; }
    if (fType === 'other' && !fPayee.trim()) { setFormError('Enter who the payment is to.'); return; }

    setSaving(true);
    setFormError(null);
    try {
      const payload: PaymentPayload = {
        payeeType: fType,
        supplierId: fType === 'supplier' ? fSupplier : undefined,
        purchaseOrderId: fType === 'supplier' && fPo !== NONE ? fPo : undefined,
        expenseId: fType === 'expense' && fExpense !== NONE ? fExpense : undefined,
        payeeName: fType === 'other' ? fPayee.trim() : undefined,
        amount: amt, paymentDate: fDate, paymentMethod: fMethod,
        reference: fReference || undefined, notes: fNotes || undefined,
      };
      await financeService.createPayment(payload);
      setModalOpen(false);
      // expense list may have changed (one marked paid)
      financeService.listExpenses({ status: 'unpaid' }).then(r => setUnpaidExpenses(r.items)).catch(() => {});
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Failed to record payment.');
    } finally {
      setSaving(false);
    }
  };

  const doVoid = async () => {
    if (!voidTarget) return;
    try {
      await financeService.voidPayment(voidTarget.id);
      setVoidTarget(null);
      financeService.listExpenses({ status: 'unpaid' }).then(r => setUnpaidExpenses(r.items)).catch(() => {});
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to void payment.');
      setVoidTarget(null);
    }
  };

  const columns: ColumnDefinition<OutgoingPayment>[] = [
    {
      accessor: 'payment', Header: 'Payment',
      Cell: (p) => (
        <div>
          <div className="font-medium">{p.payeeName || '—'}</div>
          <div className="text-xs text-muted-foreground">
            {p.paymentNumber && <span className="font-mono mr-2">{p.paymentNumber}</span>}
            {p.purchaseOrderNumber && <>for PO {p.purchaseOrderNumber}</>}
          </div>
        </div>
      ),
    },
    { accessor: 'payeeType', Header: 'Type', Cell: (p) => typeBadge(p.payeeType) },
    { accessor: 'paymentDate', Header: 'Date', Cell: (p) => formatDate(p.paymentDate) },
    {
      accessor: 'amount', Header: 'Amount',
      Cell: (p) => <span className="font-semibold tabular-nums">{formatCurrency(Number(p.amount))}</span>,
      className: 'text-right', headerClassName: 'text-right',
    },
    { accessor: 'paymentMethod', Header: 'Method', Cell: (p) => <span className="text-sm text-muted-foreground">{p.paymentMethod || '—'}</span> },
    { accessor: 'reference', Header: 'Reference', Cell: (p) => <span className="text-sm text-muted-foreground font-mono">{p.reference || '—'}</span> },
    ...(canManage ? [{
      accessor: 'actions', Header: '',
      Cell: (p: OutgoingPayment) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => setVoidTarget(p)} title="Void payment">
            <Ban className="h-4 w-4 mr-1" /> Void
          </Button>
        </div>
      ),
      className: 'text-right w-[100px]',
    } as ColumnDefinition<OutgoingPayment>] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><HandCoins className="h-6 w-6" /> Payments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Money out — supplier settlements, expense payments and other payouts.</p>
        </div>
        {canManage && (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Record Payment</Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><CircleDollarSign className="h-3.5 w-3.5" /> Paid this month</div>
          <div className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(summary?.thisMonth ?? 0)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Owed to suppliers</div>
          <div className="text-xl font-bold mt-1 tabular-nums text-amber-600">{formatCurrency(summary?.supplierOutstanding ?? 0)}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Receipt className="h-3.5 w-3.5" /> Paid all-time</div>
          <div className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(summary?.totalPaid ?? 0)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search payee, reference, payment no…" className="pl-10 h-11" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32 sm:w-40 h-11 shrink-0" aria-label="Filter by payment type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            <SelectItem value="supplier">Supplier</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
            <SelectItem value="other">Other</SelectItem>
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
            <Loader2 className="h-4 w-4 animate-spin" /> Loading payments…
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <HandCoins className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search || typeFilter !== ALL ? 'No payments match the current filters.' : 'No payments recorded yet.'}
            </p>
          </div>
        ) : (
          <ReusableTable columns={columns} data={items} isLoading={false} noDataMessage="No payments." />
        )}
      </div>

      {/* Record payment dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Log money paid out — to a supplier, against an expense, or anyone else.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              {([['supplier', 'Supplier', Building2], ['expense', 'Expense', Receipt], ['other', 'Other', CircleDollarSign]] as const).map(([t, lbl, Icon]) => (
                <button
                  key={t} type="button" onClick={() => setFType(t)}
                  className={`flex-1 flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    fType === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input hover:bg-muted'
                  }`}
                >
                  <Icon className="h-4 w-4" /> {lbl}
                </button>
              ))}
            </div>

            {fType === 'supplier' && (
              <>
                <div>
                  <label className="text-sm font-medium">Supplier</label>
                  <Select value={fSupplier || NONE} onValueChange={v => { setFSupplier(v === NONE ? '' : v); setFPo(NONE); }}>
                    <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select supplier…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Select supplier…</SelectItem>
                      {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {fSupplier && (
                  <div>
                    <label className="text-sm font-medium">Apply to purchase order <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <Select value={fPo} onValueChange={setFPo}>
                      <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>On account (no specific PO)</SelectItem>
                        {outstandingPos.map(po => (
                          <SelectItem key={po.id} value={po.id}>
                            {po.purchaseOrderNumber || po.id.slice(0, 8)} — {formatCurrency(po.outstanding)} outstanding
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fSupplier && outstandingPos.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">No open POs with a balance for this supplier.</p>
                    )}
                  </div>
                )}
              </>
            )}

            {fType === 'expense' && (
              <div>
                <label className="text-sm font-medium">Unpaid expense</label>
                <Select value={fExpense} onValueChange={pickExpense}>
                  <SelectTrigger className="mt-1 w-full"><SelectValue placeholder="Select expense…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Select expense…</SelectItem>
                    {unpaidExpenses.map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.description || e.category} — {formatCurrency(Number(e.amount))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {unpaidExpenses.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">No unpaid expenses — add one under Expenses first.</p>
                )}
              </div>
            )}

            {fType === 'other' && (
              <div>
                <label className="text-sm font-medium">Payee</label>
                <Input value={fPayee} onChange={e => setFPayee(e.target.value)} className="mt-1" placeholder="Who is this payment to?" />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Amount</label>
                <Input type="number" min="0" step="0.01" value={fAmount} onChange={e => setFAmount(e.target.value)} className="mt-1" placeholder="0.00" />
                {selectedPo && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Outstanding on this PO: {formatCurrency(selectedPo.outstanding)}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Method</label>
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
              Record payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void confirm */}
      <Dialog open={!!voidTarget} onOpenChange={(o) => !o && setVoidTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Void this payment?</DialogTitle>
            <DialogDescription>
              {voidTarget?.payeeName} — {formatCurrency(Number(voidTarget?.amount || 0))} ({voidTarget?.paymentNumber}).
              If it paid an expense, that expense becomes unpaid again; if it applied to a PO, the balance re-opens.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doVoid}>Void payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
