import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, RefreshCcw, AlertCircle, CheckCircle2, ArrowLeft, Scale,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import PageHeader from '@/components/common/PageHeader';
import { toast } from 'react-toastify';
import { useCurrency } from '@/contexts/LocalizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import {
  financeService, MoneyAccount, Reconciliation, ReconciliationLine,
} from '@/services/financeService';

export default function ReconciliationPage() {
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const canManage = hasAnyPermission(user, ['finance.manage']);

  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [sessions, setSessions] = useState<Reconciliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    reconciliation: Reconciliation;
    lines: ReconciliationLine[];
    clearedBalance: number;
    difference: number;
  } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adjAccount, setAdjAccount] = useState('');
  const [saving, setSaving] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [nAccount, setNAccount] = useState('');
  const [nDate, setNDate] = useState('');
  const [nBalance, setNBalance] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, r] = await Promise.all([
        financeService.listAccounts(),
        financeService.listReconciliations(),
      ]);
      setAccounts(a.accounts.filter((x) => x.isActive && x.accountType === 'asset'));
      setSessions(r.reconciliations);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load reconciliations.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    try {
      const d = await financeService.getReconciliation(id);
      setDetail(d);
      setSelected(new Set());
      setAdjAccount('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to load reconciliation.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (openId) loadDetail(openId); }, [openId, loadDetail]);

  // A line is "in this session" when reconciliation_id === session id; "cleared
  // in an older session" lines show as already reconciled (read-only).
  const inSessionIds = useMemo(() => {
    if (!detail) return new Set<string>();
    return new Set(detail.lines.filter((l) => l.reconciliationId === detail.reconciliation.id).map((l) => l.id));
  }, [detail]);
  const claimedElsewhere = useMemo(() => {
    if (!detail) return new Set<string>();
    return new Set(detail.lines.filter((l) => l.reconciliationId && l.reconciliationId !== detail.reconciliation.id).map((l) => l.id));
  }, [detail]);

  // Pending (checkbox) selection previews on top of already-cleared lines.
  const previewCleared = useMemo(() => {
    if (!detail) return 0;
    const type = (detail.reconciliation as any).accountType;
    const debitNormal = !type || ['asset', 'expense'].includes(type);
    let bal = detail.clearedBalance;
    for (const l of detail.lines) {
      if (!selected.has(l.id)) continue;
      const clearedNow = inSessionIds.has(l.id);
      const delta = (Number(l.debit) - Number(l.credit)) * (debitNormal ? 1 : -1);
      bal += clearedNow ? -delta : delta; // flipping off subtracts, on adds
    }
    return Math.round(bal * 100) / 100;
  }, [detail, inSessionIds, selected]);

  const previewDiff = detail ? Math.round((Number(detail.reconciliation.statementBalance) - previewCleared) * 100) / 100 : 0;
  const isCompleted = detail?.reconciliation.status === 'completed';

  // `selected` = lines whose cleared flag should flip on Apply.
  const toggleLine = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const saveLines = async () => {
    if (!detail || selected.size === 0) return;
    const toClear = [...selected].filter((id) => !inSessionIds.has(id));
    const toUnclear = [...selected].filter((id) => inSessionIds.has(id));
    setSaving(true);
    try {
      if (toClear.length) await financeService.setReconciliationLines(detail.reconciliation.id, toClear, true);
      if (toUnclear.length) await financeService.setReconciliationLines(detail.reconciliation.id, toUnclear, false);
      setSelected(new Set());
      await loadDetail(detail.reconciliation.id);
    } catch (e: any) {
      toast.error(e.message || 'Failed to update cleared lines.');
    } finally {
      setSaving(false);
    }
  };

  const complete = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const diff = Math.abs(previewDiff);
      const res = await financeService.completeReconciliation(
        detail.reconciliation.id,
        diff > 0.005 ? adjAccount || undefined : undefined,
      );
      toast.success(`Reconciliation complete — cleared ${formatCurrency(res.clearedBalance)}.`);
      setOpenId(null);
      setDetail(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Failed to complete reconciliation.');
    } finally {
      setSaving(false);
    }
  };

  const createSession = async () => {
    const bal = Number(nBalance);
    if (!nAccount) { setFormError('Choose an account.'); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nDate)) { setFormError('Pick the statement date.'); return; }
    if (!Number.isFinite(bal)) { setFormError('Enter the ending balance on the statement.'); return; }
    setSaving(true);
    setFormError(null);
    try {
      const res = await financeService.createReconciliation({ accountId: nAccount, statementDate: nDate, statementBalance: bal });
      setNewOpen(false);
      await load();
      setOpenId(res.id);
    } catch (e: any) {
      setFormError(e.message || 'Failed to start reconciliation.');
    } finally {
      setSaving(false);
    }
  };

  // ---- Detail view ---------------------------------------------------------
  if (openId && detail) {
    const r = detail.reconciliation;
    return (
      <div className="p-4 sm:p-6 space-y-5 min-h-screen">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => { setOpenId(null); setDetail(null); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> All reconciliations
          </Button>
          <PageHeader
            icon={Scale}
            title={`${r.accountCode} — ${r.accountName}`}
            subtitle={`Statement ending ${String(r.statementDate).slice(0, 10)} · opened by ${r.createdByName || '—'}`}
            actions={
              <Badge variant="secondary" className={isCompleted
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'}>
                {isCompleted ? 'Completed' : 'In progress'}
              </Badge>
            }
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Statement balance', value: formatCurrency(Number(r.statementBalance)), icon: Scale, color: 'text-primary' },
            { label: 'Cleared in ledger', value: formatCurrency(previewCleared), icon: CheckCircle2, color: 'text-emerald-600' },
            { label: 'Difference', value: formatCurrency(previewDiff), icon: AlertCircle, color: Math.abs(previewDiff) < 0.005 ? 'text-emerald-600' : 'text-amber-600' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-3 rounded-xl border border-border border-r-4 border-r-primary/40 bg-card p-3.5">
                <Icon className={`h-5 w-5 shrink-0 ${item.color}`} />
                <div>
                  <p className="text-2xl font-bold text-foreground leading-none tabular-nums">{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 w-10"></th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Entry</th>
                <th className="px-3 py-2">Memo</th>
                <th className="px-3 py-2 text-right">In</th>
                <th className="px-3 py-2 text-right">Out</th>
              </tr>
            </thead>
            <tbody>
              {detail.lines.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No ledger lines on this account up to the statement date.</td></tr>
              )}
              {detail.lines.map((l) => {
                const clearedHere = inSessionIds.has(l.id);
                const clearedOther = claimedElsewhere.has(l.id);
                const flipped = selected.has(l.id);
                const effective = flipped ? !clearedHere : clearedHere;
                const voided = l.entryStatus === 'voided';
                return (
                  <tr key={l.id} className={`border-b last:border-0 ${clearedOther || isCompleted ? 'opacity-60' : ''}`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={effective}
                        disabled={isCompleted || clearedOther || !canManage}
                        onChange={() => toggleLine(l.id)}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{String(l.entryDate).slice(0, 10)}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {l.entryNumber}
                      <span className="text-muted-foreground"> · {l.sourceType}</span>
                      {voided && <span className="text-red-500"> · voided</span>}
                    </td>
                    <td className="px-3 py-2 max-w-[280px] truncate text-muted-foreground">{l.lineMemo || l.entryMemo || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(l.debit) > 0 ? formatCurrency(Number(l.debit)) : ''}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(l.credit) > 0 ? formatCurrency(Number(l.credit)) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!isCompleted && canManage && (
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="outline" onClick={saveLines} disabled={saving || selected.size === 0}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Apply {selected.size ? `${selected.size} change${selected.size === 1 ? '' : 's'}` : 'changes'}
            </Button>
            {Math.abs(previewDiff) > 0.005 && (
              <div className="flex items-center gap-2">
                <Label className="text-sm whitespace-nowrap">Adjustment to</Label>
                <Select value={adjAccount} onValueChange={setAdjAccount}>
                  <SelectTrigger className="w-64 h-9"><SelectValue placeholder="Expense/other account…" /></SelectTrigger>
                  <SelectContent>
                    {accounts.filter((a) => a.id !== r.accountId).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              onClick={complete}
              disabled={saving || selected.size > 0 || (Math.abs(previewDiff) > 0.005 && !adjAccount)}
              title={Math.abs(previewDiff) > 0.005 && !adjAccount ? 'Pick an account for the residual difference' : undefined}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {Math.abs(previewDiff) > 0.005 ? 'Complete with adjustment' : 'Complete reconciliation'}
            </Button>
            {selected.size > 0 && <span className="text-xs text-muted-foreground">Apply your changes before completing.</span>}
          </div>
        )}
      </div>
    );
  }

  // ---- Session list --------------------------------------------------------
  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Scale}
        title="Reconciliation"
        subtitle="Match ledger lines against a bank or cash statement."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => { setNAccount(''); setNDate(''); setNBalance(''); setFormError(null); setNewOpen(true); }}>
                New reconciliation
              </Button>
            )}
          </>
        }
      />

      {error && <div className="bg-danger-light text-danger-text p-4 rounded-lg flex items-center gap-2"><AlertCircle className="h-4 w-4" /> {error}</div>}

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        {loading && sessions.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 px-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-12 text-center">
            <Scale className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No reconciliations yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Start one to match an account against a statement.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-2">Account</th>
                <th className="px-4 py-2">Statement date</th>
                <th className="px-4 py-2 text-right">Statement balance</th>
                <th className="px-4 py-2 text-right">Difference</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Opened by</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/40 cursor-pointer" onClick={() => setOpenId(s.id)}>
                  <td className="px-4 py-2.5 font-medium">{s.accountCode} — {s.accountName}</td>
                  <td className="px-4 py-2.5">{String(s.statementDate).slice(0, 10)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(Number(s.statementBalance))}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.difference != null ? formatCurrency(Number(s.difference)) : '—'}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="secondary" className={s.status === 'completed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'}>
                      {s.status === 'completed' ? 'Completed' : 'In progress'}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.createdByName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New reconciliation dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New reconciliation</DialogTitle>
            <DialogDescription>Pick the account and enter the ending balance from the statement you're matching against.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Account</Label>
              <Select value={nAccount} onValueChange={setNAccount}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Bank or cash account…" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statement date</Label>
              <Input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Ending balance on statement</Label>
              <Input type="number" step="0.01" value={nBalance} onChange={(e) => setNBalance(e.target.value)} className="mt-1" placeholder="0.00" />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={createSession} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
