import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Loader2, Plus, RefreshCcw, BookOpen, AlertCircle, Ban, Trash2, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import DatePickerInput from '@/components/ui/DatePickerInput';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';
import { useCurrency, useDateFormatting } from '@/contexts/LocalizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import { financeService, MoneyAccount, JournalEntry } from '@/services/financeService';

const ALL = '__all';

const SOURCE_LABELS: Record<string, string> = {
  sale: 'Sale', sale_return: 'Return', outgoing_payment: 'Payment',
  layaway_payment: 'Layaway', savings_payment: 'Savings scheme',
  payment_received: 'On-account settlement', manual: 'Manual journal',
};

const sourceBadge = (t: string) => {
  const styles: Record<string, string> = {
    sale: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    sale_return: 'bg-rose-100 text-rose-800 border-rose-200',
    outgoing_payment: 'bg-amber-100 text-amber-800 border-amber-200',
    layaway_payment: 'bg-violet-100 text-violet-800 border-violet-200',
    savings_payment: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
    payment_received: 'bg-sky-100 text-sky-800 border-sky-200',
    manual: 'bg-slate-100 text-slate-800 border-slate-200',
  };
  return <Badge className={styles[t] || 'bg-secondary text-secondary-foreground'}>{SOURCE_LABELS[t] || t}</Badge>;
};

const entryAmount = (e: JournalEntry) =>
  e.lines.reduce((s, l) => s + Number(l.debit || 0), 0);

interface DraftLine { accountId: string; debit: string; credit: string; memo: string; }
const blankLine = (): DraftLine => ({ accountId: '', debit: '', credit: '', memo: '' });

export default function LedgerPage() {
  const { formatCurrency } = useCurrency();
  const { formatDate } = useDateFormatting();
  const { user } = useAuth();
  const canManage = hasAnyPermission(user, ['finance.manage']);
  const [searchParams] = useSearchParams();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accountFilter, setAccountFilter] = useState(searchParams.get('account') || ALL);
  const [sourceFilter, setSourceFilter] = useState(ALL);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [journalOpen, setJournalOpen] = useState(false);
  const [jDate, setJDate] = useState(new Date().toISOString().slice(0, 10));
  const [jMemo, setJMemo] = useState('');
  const [jLines, setJLines] = useState<DraftLine[]>([blankLine(), blankLine()]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [reverseTarget, setReverseTarget] = useState<JournalEntry | null>(null);
  const [reverseMemo, setReverseMemo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeService.listLedger({
        accountId: accountFilter !== ALL ? accountFilter : undefined,
        sourceType: sourceFilter !== ALL ? sourceFilter : undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        limit: 200,
      });
      setEntries(res.entries);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load ledger.');
    } finally {
      setLoading(false);
    }
  }, [accountFilter, sourceFilter, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    financeService.listAccounts().then(r => setAccounts(r.accounts)).catch(() => {});
  }, []);

  const activeAccounts = useMemo(() => accounts.filter(a => a.isActive), [accounts]);
  const sourceTypes = useMemo(
    () => [...new Set(entries.map(e => e.sourceType))],
    [entries],
  );

  // --- journal form ---
  const jTotals = useMemo(() => ({
    debit: jLines.reduce((s, l) => s + (Number(l.debit) || 0), 0),
    credit: jLines.reduce((s, l) => s + (Number(l.credit) || 0), 0),
  }), [jLines]);
  const jBalanced = Math.abs(jTotals.debit - jTotals.credit) < 0.005 && jTotals.debit > 0;

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setJLines(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));

  const openJournal = () => {
    setJDate(new Date().toISOString().slice(0, 10));
    setJMemo('');
    setJLines([blankLine(), blankLine()]);
    setFormError(null);
    setJournalOpen(true);
  };

  const saveJournal = async () => {
    const used = jLines.filter(l => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (used.length < 2) { setFormError('At least two lines with an account and an amount.'); return; }
    if (!jBalanced) { setFormError(`Out of balance by ${formatCurrency(Math.abs(jTotals.debit - jTotals.credit))} — debits must equal credits.`); return; }
    for (const l of used) {
      if (Number(l.debit) > 0 && Number(l.credit) > 0) { setFormError('A line can be a debit OR a credit, not both.'); return; }
    }
    setSaving(true);
    setFormError(null);
    try {
      await financeService.postJournal({
        entryDate: jDate,
        memo: jMemo.trim() || undefined,
        lines: used.map(l => ({
          accountId: l.accountId,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          memo: l.memo.trim() || undefined,
        })),
      });
      setJournalOpen(false);
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Failed to post journal entry.');
    } finally {
      setSaving(false);
    }
  };

  const doReverse = async () => {
    if (!reverseTarget) return;
    try {
      await financeService.reverseJournal(reverseTarget.id, reverseMemo.trim() || undefined);
      setReverseTarget(null);
      setReverseMemo('');
      await load();
    } catch (e: any) {
      setError(e.message || 'Failed to reverse entry.');
      setReverseTarget(null);
    }
  };

  const columns: ColumnDefinition<JournalEntry>[] = [
    {
      accessor: 'entryNumber', Header: 'Entry',
      Cell: (e) => (
        <div>
          <div className="font-mono text-sm font-medium">{e.entryNumber}</div>
          <div className="text-xs text-muted-foreground">{formatDate(e.entryDate)}</div>
        </div>
      ),
    },
    { accessor: 'sourceType', Header: 'Source', Cell: (e) => sourceBadge(e.sourceType) },
    {
      accessor: 'memo', Header: 'Description',
      Cell: (e) => (
        <div className="max-w-[320px]">
          <div className="text-sm truncate">{e.memo || '—'}</div>
          {e.reversalOfId && <div className="text-xs text-muted-foreground">reversal</div>}
        </div>
      ),
    },
    {
      accessor: 'lines', Header: 'Accounts',
      Cell: (e) => (
        <div className="space-y-0.5">
          {e.lines.map((l) => (
            <div key={l.lineNo} className="flex items-baseline gap-2 text-xs font-mono">
              <span className="text-muted-foreground w-20 truncate" title={l.accountName}>{l.accountCode}</span>
              <span className="flex-1 truncate text-muted-foreground">{l.memo || ''}</span>
              <span className="tabular-nums">
                {Number(l.debit) > 0 && `Dr ${formatCurrency(Number(l.debit))}`}
                {Number(l.credit) > 0 && `Cr ${formatCurrency(Number(l.credit))}`}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      accessor: 'amount', Header: 'Amount',
      Cell: (e) => <span className="font-semibold tabular-nums">{formatCurrency(entryAmount(e))}</span>,
      className: 'text-right', headerClassName: 'text-right',
    },
    {
      accessor: 'status', Header: 'Status',
      Cell: (e) => e.status === 'posted'
        ? <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">Posted</Badge>
        : <Badge variant="outline" className="text-muted-foreground">Voided</Badge>,
    },
    ...(canManage ? [{
      accessor: 'actions', Header: '',
      Cell: (e: JournalEntry) => e.status === 'posted' ? (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => setReverseTarget(e)} title="Reverse this entry">
            <Ban className="h-4 w-4 mr-1" /> Reverse
          </Button>
        </div>
      ) : null,
      className: 'text-right w-[110px]',
    } as ColumnDefinition<JournalEntry>] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" /> Ledger</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Every money movement as a balanced journal entry — sales, refunds, payments, deposits.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            title="Export filtered journal lines as CSV"
            onClick={() => financeService.downloadLedgerCsv({
              accountId: accountFilter !== ALL ? accountFilter : undefined,
              sourceType: sourceFilter !== ALL ? sourceFilter : undefined,
              from: fromDate || undefined,
              to: toDate || undefined,
            }).catch((e: any) => setError(e.message || 'Export failed.'))}
          >
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          {canManage && (
            <Button onClick={openJournal}><Plus className="h-4 w-4 mr-2" /> New Journal Entry</Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={accountFilter} onValueChange={setAccountFilter}>
          <SelectTrigger className="w-48 h-11" title="Filter by account"><SelectValue placeholder="All accounts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All accounts</SelectItem>
            {accounts.map(a => (
              <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-44 h-11" title="Filter by source"><SelectValue placeholder="All sources" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sources</SelectItem>
            {['sale', 'sale_return', 'outgoing_payment', 'layaway_payment', 'savings_payment', 'payment_received', 'manual']
              .concat(sourceTypes.filter(t => !['sale', 'sale_return', 'outgoing_payment', 'layaway_payment', 'savings_payment', 'payment_received', 'manual'].includes(t)))
              .map(t => <SelectItem key={t} value={t}>{SOURCE_LABELS[t] || t}</SelectItem>)}
          </SelectContent>
        </Select>
        <DatePickerInput value={fromDate} onChange={setFromDate} placeholder="From" className="w-36" />
        <DatePickerInput value={toDate} onChange={setToDate} placeholder="To" className="w-36" />
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
        {loading && entries.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 px-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading ledger…
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No journal entries match.</p>
          </div>
        ) : (
          <ReusableTable columns={columns} data={entries} isLoading={false} noDataMessage="No entries." />
        )}
      </div>

      {/* New journal entry dialog */}
      <Dialog open={journalOpen} onOpenChange={setJournalOpen}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Journal Entry</DialogTitle>
            <DialogDescription>Manual entry for adjustments, opening balances, or corrections. Debits must equal credits.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <DatePickerInput value={jDate} onChange={setJDate} maxDate="2099-12-31" className="mt-1" />
              </div>
              <div>
                <Label>Memo</Label>
                <Input value={jMemo} onChange={e => setJMemo(e.target.value)} className="mt-1" placeholder="Opening float for drawer…" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_110px_110px_32px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Account</span><span className="text-right">Debit</span><span className="text-right">Credit</span><span />
              </div>
              {jLines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_110px_32px] gap-2 items-center">
                  <Select value={l.accountId} onValueChange={(v) => setLine(i, { accountId: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Account…" /></SelectTrigger>
                    <SelectContent>
                      {activeAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number" min="0" step="0.01" className="h-9 text-right tabular-nums"
                    value={l.debit} placeholder="0.00"
                    onChange={e => setLine(i, { debit: e.target.value })}
                  />
                  <Input
                    type="number" min="0" step="0.01" className="h-9 text-right tabular-nums"
                    value={l.credit} placeholder="0.00"
                    onChange={e => setLine(i, { credit: e.target.value })}
                  />
                  <Button
                    variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"
                    onClick={() => setJLines(prev => prev.filter((_, idx) => idx !== i))}
                    disabled={jLines.length <= 2}
                    title="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setJLines(prev => [...prev, blankLine()])}>
                <Plus className="h-4 w-4 mr-1" /> Add line
              </Button>
            </div>

            <div className={`rounded-lg border p-3 text-sm flex items-center justify-between ${jBalanced ? 'bg-emerald-50 border-emerald-200' : 'bg-muted/40'}`}>
              <span className="tabular-nums">
                Debits {formatCurrency(jTotals.debit)} · Credits {formatCurrency(jTotals.credit)}
              </span>
              <span className={jBalanced ? 'text-emerald-700 font-medium' : 'text-muted-foreground'}>
                {jBalanced ? 'Balanced' : `Off by ${formatCurrency(Math.abs(jTotals.debit - jTotals.credit))}`}
              </span>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setJournalOpen(false)}>Cancel</Button>
            <Button onClick={saveJournal} disabled={saving || !jBalanced}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Post entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse confirmation */}
      <Dialog open={!!reverseTarget} onOpenChange={(o) => { if (!o) setReverseTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reverse {reverseTarget?.entryNumber}?</DialogTitle>
            <DialogDescription>
              Posts a mirror entry that cancels this one. The original stays in the ledger marked voided — nothing is deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>Reason <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={reverseMemo} onChange={e => setReverseMemo(e.target.value)} className="mt-1" placeholder="Entered in error…" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doReverse}>Reverse entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
