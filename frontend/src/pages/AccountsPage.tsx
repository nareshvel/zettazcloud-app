import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, Plus, RefreshCcw, Landmark, AlertCircle, Pencil,
  Wallet, ArrowDownToLine, ArrowUpFromLine, Scale, ArrowRightLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';
import { useCurrency } from '@/contexts/LocalizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import { financeService, MoneyAccount, AccountMapping, AccountType, ACCOUNT_TYPES } from '@/services/financeService';

const typeBadgeVariant: Record<AccountType, string> = {
  asset: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  liability: 'bg-amber-100 text-amber-800 border-amber-200',
  equity: 'bg-sky-100 text-sky-800 border-sky-200',
  revenue: 'bg-violet-100 text-violet-800 border-violet-200',
  expense: 'bg-rose-100 text-rose-800 border-rose-200',
};

/** Friendly labels for the seeded mapping keys. */
const MAPPING_LABELS: Record<string, string> = {
  'tender:cash': 'Cash payments',
  'tender:card': 'Card payments',
  'tender:phone': 'Phone / UPI payments',
  'tender:stripe': 'Stripe payments',
  'tender:paypal': 'PayPal payments',
  'tender:bank_transfer': 'Bank transfers',
  'tender:on_account': 'Charge / on-account sales',
  'event:revenue': 'Sales revenue',
  'event:returns': 'Sales returns & refunds',
  'event:tax': 'Tax payable',
  'event:payable': 'Accounts payable',
  'event:receivable': 'Accounts receivable',
  'event:purchases': 'Supplier payments (debit)',
  'event:expense': 'Expense payments (debit)',
  'event:layaway_liability': 'Layaway deposits held',
  'event:savings_liability': 'Savings-scheme deposits held',
  'event:over_short': 'Cash over/short',
  'event:equity': 'Opening balance / equity',
  'event:default_in': 'Other money in (fallback)',
  'event:default_out': 'Other money out (fallback)',
};

const mappingLabel = (key: string) => {
  if (MAPPING_LABELS[key]) return MAPPING_LABELS[key];
  const [kind, rest] = key.split(':');
  return kind === 'tender' ? `${rest} payments` : `${kind}: ${rest}`;
};

export default function AccountsPage() {
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const canManage = hasAnyPermission(user, ['finance.manage']);
  const navigate = useNavigate();

  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mappingError, setMappingError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MoneyAccount | null>(null);

  const [transferOpen, setTransferOpen] = useState(false);
  const [tFrom, setTFrom] = useState('');
  const [tTo, setTTo] = useState('');
  const [tAmount, setTAmount] = useState('');
  const [tMemo, setTMemo] = useState('');

  // form
  const [fCode, setFCode] = useState('');
  const [fName, setFName] = useState('');
  const [fType, setFType] = useState<AccountType>('asset');
  const [fSubtype, setFSubtype] = useState('');
  const [fOpening, setFOpening] = useState('');
  const [fActive, setFActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, m] = await Promise.all([
        financeService.listAccounts(),
        financeService.listMappings().catch(() => ({ mappings: [] })),
      ]);
      setAccounts(a.accounts);
      setMappings(m.mappings);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeAccounts = useMemo(() => accounts.filter(a => a.isActive), [accounts]);

  const kpis = useMemo(() => {
    const cashish = accounts.filter(a => a.accountType === 'asset' && ['cash', 'bank', 'safe', 'card_clearing'].includes(a.subtype || ''));
    const receivable = accounts.filter(a => a.accountType === 'asset' && a.subtype === 'receivable');
    const liabilities = accounts.filter(a => a.accountType === 'liability');
    const revenue = accounts.filter(a => a.accountType === 'revenue');
    return {
      onHand: cashish.reduce((s, a) => s + Number(a.balance), 0),
      receivable: receivable.reduce((s, a) => s + Number(a.balance), 0),
      liabilities: liabilities.reduce((s, a) => s + Number(a.balance), 0),
      revenueNet: revenue.reduce((s, a) => s + Number(a.balance), 0),
    };
  }, [accounts]);

  const openNew = () => {
    setEditing(null);
    setFCode(''); setFName(''); setFType('asset'); setFSubtype(''); setFOpening(''); setFActive(true);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (a: MoneyAccount) => {
    setEditing(a);
    setFCode(a.code); setFName(a.name); setFType(a.accountType);
    setFSubtype(a.subtype || ''); setFOpening(''); setFActive(!!a.isActive);
    setFormError(null);
    setModalOpen(true);
  };

  const save = async () => {
    if (!editing && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/.test(fCode.trim())) {
      setFormError('Code: 1–40 chars, letters/digits/-/_ (stored uppercase).'); return;
    }
    if (!fName.trim()) { setFormError('Name is required.'); return; }

    setSaving(true);
    setFormError(null);
    try {
      if (editing) {
        await financeService.updateAccount(editing.id, {
          name: fName.trim(),
          subtype: fSubtype.trim() || null,
          isActive: fActive,
        });
      } else {
        await financeService.createAccount({
          code: fCode.trim().toUpperCase(),
          name: fName.trim(),
          accountType: fType,
          subtype: fSubtype.trim() || undefined,
          openingBalance: fOpening === '' ? 0 : Number(fOpening),
        });
      }
      setModalOpen(false);
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Failed to save account.');
    } finally {
      setSaving(false);
    }
  };

  const openTransfer = () => {
    setTFrom(''); setTTo(''); setTAmount(''); setTMemo('');
    setFormError(null);
    setTransferOpen(true);
  };

  const doTransfer = async () => {
    const amt = Number(tAmount);
    if (!tFrom || !tTo || tFrom === tTo) { setFormError('Choose two different accounts.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setFormError('Enter a positive amount.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      await financeService.createTransfer({ fromAccountId: tFrom, toAccountId: tTo, amount: amt, memo: tMemo.trim() || undefined });
      setTransferOpen(false);
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Failed to record transfer.');
    } finally {
      setSaving(false);
    }
  };

  const remap = async (key: string, accountId: string) => {
    setMappingError(null);
    try {
      await financeService.updateMapping(key, accountId);
      setMappings(prev => prev.map(m => m.mappingKey === key ? { ...m, accountId } : m));
    } catch (e: any) {
      setMappingError(e.message || 'Failed to update mapping.');
    }
  };

  const columns: ColumnDefinition<MoneyAccount>[] = [
    {
      accessor: 'code', Header: 'Code',
      Cell: (a) => <span className="font-mono text-sm font-medium">{a.code}</span>,
    },
    { accessor: 'name', Header: 'Account', Cell: (a) => <span className="font-medium">{a.name}</span> },
    {
      accessor: 'accountType', Header: 'Type',
      Cell: (a) => <Badge className={typeBadgeVariant[a.accountType]}>{a.accountType}</Badge>,
    },
    {
      accessor: 'subtype', Header: 'Subtype',
      Cell: (a) => <span className="text-sm text-muted-foreground">{a.subtype || '—'}</span>,
    },
    {
      accessor: 'totalDebit', Header: 'Debits',
      Cell: (a) => <span className="tabular-nums text-sm">{formatCurrency(Number(a.totalDebit))}</span>,
      className: 'text-right', headerClassName: 'text-right',
    },
    {
      accessor: 'totalCredit', Header: 'Credits',
      Cell: (a) => <span className="tabular-nums text-sm">{formatCurrency(Number(a.totalCredit))}</span>,
      className: 'text-right', headerClassName: 'text-right',
    },
    {
      accessor: 'balance', Header: 'Balance',
      Cell: (a) => (
        <span className={`font-semibold tabular-nums ${Number(a.balance) < 0 ? 'text-destructive' : ''}`}>
          {formatCurrency(Number(a.balance))}
        </span>
      ),
      className: 'text-right', headerClassName: 'text-right',
    },
    {
      accessor: 'status', Header: 'Status',
      Cell: (a) => a.isActive
        ? <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>
        : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>,
    },
    ...(canManage ? [{
      accessor: 'actions', Header: '',
      Cell: (a: MoneyAccount) => (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-8" onClick={(e) => { e.stopPropagation(); openEdit(a); }} title="Edit account">
            <Pencil className="h-4 w-4 mr-1" /> Edit
          </Button>
        </div>
      ),
      className: 'text-right w-[100px]',
    } as ColumnDefinition<MoneyAccount>] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Landmark className="h-6 w-6" /> Money Accounts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Chart of accounts — where money sits, and what every sale and payment posts against.</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={openTransfer}><ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer</Button>
            <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Account</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-r-4 border-r-emerald-500 bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Cash &amp; bank on hand</div>
          <div className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(kpis.onHand)}</div>
        </div>
        <div className="rounded-xl border border-r-4 border-r-sky-500 bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowDownToLine className="h-3.5 w-3.5" /> Owed to us (A/R)</div>
          <div className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(kpis.receivable)}</div>
        </div>
        <div className="rounded-xl border border-r-4 border-r-amber-500 bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><ArrowUpFromLine className="h-3.5 w-3.5" /> Liabilities</div>
          <div className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(kpis.liabilities)}</div>
        </div>
        <div className="rounded-xl border border-r-4 border-r-violet-500 bg-card p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5"><Scale className="h-3.5 w-3.5" /> Net revenue</div>
          <div className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(kpis.revenueNet)}</div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading} title="Refresh">
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        {loading && accounts.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 px-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts…
          </div>
        ) : accounts.length === 0 ? (
          <div className="p-12 text-center">
            <Landmark className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No accounts yet — defaults are seeded automatically.</p>
          </div>
        ) : (
          <ReusableTable
            columns={columns}
            data={accounts}
            isLoading={false}
            noDataMessage="No accounts."
            onRowClick={(a) => navigate(`/ledger?account=${a.id}`)}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">Click a row to see its ledger entries.</p>

      {/* Posting rules — which account each tender/event posts to */}
      <div className="rounded-xl border bg-card">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold">Posting rules</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Which account each payment method and business event posts to. Add a <span className="font-mono">tender:&lt;code&gt;</span> mapping for any custom payment method.
          </p>
        </div>
        {mappingError && (
          <div className="mx-4 mt-3 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {mappingError}
          </div>
        )}
        <div className="divide-y">
          {mappings.length === 0 && (
            <div className="px-4 py-8 text-sm text-muted-foreground text-center">No mappings loaded.</div>
          )}
          {mappings.map((m) => (
            <div key={m.mappingKey} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{mappingLabel(m.mappingKey)}</div>
                <div className="text-xs text-muted-foreground font-mono truncate">{m.mappingKey}</div>
              </div>
              {canManage ? (
                <Select value={m.accountId} onValueChange={(v) => remap(m.mappingKey, v)}>
                  <SelectTrigger className="w-56 h-9" title={`Change posting account for ${m.mappingKey}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm text-muted-foreground">{m.code} — {m.name}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* New / edit account dialog */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${editing.code}` : 'New Account'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Rename or deactivate. Codes are immutable once created.'
                : 'Add a custom money account. It becomes available for posting rules and journal entries.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editing && (
              <div>
                <Label>Code</Label>
                <Input value={fCode} onChange={e => setFCode(e.target.value.toUpperCase())} className="mt-1 font-mono" placeholder="PETTY_CASH" maxLength={40} />
              </div>
            )}
            <div>
              <Label>Name</Label>
              <Input value={fName} onChange={e => setFName(e.target.value)} className="mt-1" placeholder="Petty Cash" maxLength={120} />
            </div>
            {!editing && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={fType} onValueChange={(v) => setFType(v as AccountType)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subtype <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input value={fSubtype} onChange={e => setFSubtype(e.target.value)} className="mt-1" placeholder="cash, bank…" />
                </div>
              </div>
            )}
            {editing && (
              <div>
                <Label>Subtype</Label>
                <Input value={fSubtype} onChange={e => setFSubtype(e.target.value)} className="mt-1" />
              </div>
            )}
            {!editing && (
              <div>
                <Label>Opening balance</Label>
                <Input type="number" step="0.01" value={fOpening} onChange={e => setFOpening(e.target.value)} className="mt-1" placeholder="0.00" />
              </div>
            )}
            {editing && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <Label htmlFor="acct-active" className="font-normal">Account is active</Label>
                <Switch id="acct-active" checked={fActive} onCheckedChange={setFActive} />
              </div>
            )}
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? 'Save changes' : 'Create account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer between accounts dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer between accounts</DialogTitle>
            <DialogDescription>Move money — e.g. drawer to safe, or safe to bank for a deposit. Posts one balanced ledger entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From</Label>
                <Select value={tFrom} onValueChange={setTFrom}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Source…" /></SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>To</Label>
                <Select value={tTo} onValueChange={setTTo}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Destination…" /></SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Amount</Label>
              <Input type="number" min="0" step="0.01" value={tAmount} onChange={e => setTAmount(e.target.value)} className="mt-1" placeholder="0.00" />
            </div>
            <div>
              <Label>Memo <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={tMemo} onChange={e => setTMemo(e.target.value)} className="mt-1" placeholder="Night deposit…" />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={doTransfer} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
