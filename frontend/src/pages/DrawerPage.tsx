import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, RefreshCcw, Vault, AlertCircle, ArrowDownToLine,
  ArrowUpFromLine, Lock, PlayCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';
import { useCurrency, useDateFormatting } from '@/contexts/LocalizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import { financeService, DrawerSession, DrawerMovement, MoneyAccount } from '@/services/financeService';

export default function DrawerPage() {
  const { formatCurrency, currencySymbol } = useCurrency();
  const { formatDateTime } = useDateFormatting();
  const { user } = useAuth();
  const canManage = hasAnyPermission(user, ['finance.manage']);
  const storeId = user?.storeId || localStorage.getItem('store_id') || '';

  const [session, setSession] = useState<(DrawerSession & { expectedCashLive: number }) | null>(null);
  const [movements, setMovements] = useState<DrawerMovement[]>([]);
  const [history, setHistory] = useState<DrawerSession[]>([]);
  const [accounts, setAccounts] = useState<MoneyAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openOpen, setOpenOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState<'paid_in' | 'paid_out' | null>(null);
  const [closeOpen, setCloseOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [fFloat, setFFloat] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fReason, setFReason] = useState('');
  const [fCount, setFCount] = useState('');
  const [closeResult, setCloseResult] = useState<{ expectedCash: number; variance: number } | null>(null);

  const load = useCallback(async () => {
    if (!storeId) { setLoading(false); setError('No store selected.'); return; }
    setLoading(true);
    try {
      const [cur, hist, accts] = await Promise.all([
        financeService.currentDrawerSession(storeId),
        financeService.listDrawerSessions({ storeId, limit: 25 }),
        financeService.listAccounts().catch(() => ({ accounts: [] as MoneyAccount[] })),
      ]);
      setSession(cur.session);
      setMovements(cur.movements || []);
      setHistory(hist.sessions);
      setAccounts(accts.accounts.filter(a => a.isActive));
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to load drawer.');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const liveExpected = session ? Number(session.expectedCashLive) : 0;
  const countNum = Number(fCount);
  const previewVariance = session && fCount !== '' && Number.isFinite(countNum)
    ? Math.round((countNum - liveExpected) * 100) / 100
    : null;

  const doOpen = async () => {
    const f = Number(fFloat);
    if (!Number.isFinite(f) || f < 0) { setFormError('Enter the opening float (0 or more).'); return; }
    setSaving(true); setFormError(null);
    try {
      await financeService.openDrawer({ storeId, openingFloat: f, notes: fReason.trim() || undefined });
      setOpenOpen(false); setFFloat(''); setFReason('');
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Failed to open drawer.');
    } finally { setSaving(false); }
  };

  const doMovement = async () => {
    if (!session || !moveOpen) return;
    const a = Number(fAmount);
    if (!Number.isFinite(a) || a <= 0) { setFormError('Enter a positive amount.'); return; }
    setSaving(true); setFormError(null);
    try {
      await financeService.drawerMovement(session.id, { direction: moveOpen, amount: a, reason: fReason.trim() || undefined });
      setMoveOpen(null); setFAmount(''); setFReason('');
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Failed to record movement.');
    } finally { setSaving(false); }
  };

  const doClose = async () => {
    if (!session) return;
    if (!Number.isFinite(countNum) || countNum < 0) { setFormError('Enter the counted cash.'); return; }
    setSaving(true); setFormError(null);
    try {
      const r = await financeService.closeDrawer(session.id, countNum);
      setCloseResult({ expectedCash: r.expectedCash, variance: r.variance });
      setCloseOpen(false); setFCount('');
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Failed to close drawer.');
    } finally { setSaving(false); }
  };

  const historyColumns: ColumnDefinition<DrawerSession>[] = [
    {
      accessor: 'openedAt', Header: 'Session',
      Cell: (s) => (
        <div>
          <div className="text-sm font-medium">{formatDateTime(s.openedAt)}</div>
          <div className="text-xs text-muted-foreground">{s.openedByName || '—'} · {s.accountCode}</div>
        </div>
      ),
    },
    {
      accessor: 'openingFloat', Header: 'Float',
      Cell: (s) => <span className="tabular-nums">{formatCurrency(Number(s.openingFloat))}</span>,
      className: 'text-right', headerClassName: 'text-right',
    },
    {
      accessor: 'expectedCash', Header: 'Expected',
      Cell: (s) => <span className="tabular-nums">{s.expectedCash != null ? formatCurrency(Number(s.expectedCash)) : '—'}</span>,
      className: 'text-right', headerClassName: 'text-right',
    },
    {
      accessor: 'countedCash', Header: 'Counted',
      Cell: (s) => <span className="tabular-nums">{s.countedCash != null ? formatCurrency(Number(s.countedCash)) : '—'}</span>,
      className: 'text-right', headerClassName: 'text-right',
    },
    {
      accessor: 'variance', Header: 'Variance',
      Cell: (s) => s.variance == null ? <span className="text-muted-foreground">—</span> : (
        <span className={`font-semibold tabular-nums ${Number(s.variance) < -0.004 ? 'text-destructive' : Number(s.variance) > 0.004 ? 'text-amber-600' : 'text-emerald-600'}`}>
          {Number(s.variance) > 0 ? '+' : ''}{formatCurrency(Number(s.variance))}
        </span>
      ),
      className: 'text-right', headerClassName: 'text-right',
    },
    {
      accessor: 'closedAt', Header: 'Closed',
      Cell: (s) => <span className="text-sm text-muted-foreground">{s.closedAt ? formatDateTime(s.closedAt) : '—'}</span>,
    },
    {
      accessor: 'status', Header: 'Status',
      Cell: (s) => s.status === 'open'
        ? <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Open</Badge>
        : <Badge variant="secondary">Closed</Badge>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Vault className="h-6 w-6" /> Cash Drawer</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Open the till, record paid-ins/outs, and close with a counted-vs-expected check.</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} title="Refresh">
          <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      {closeResult && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between ${Math.abs(closeResult.variance) < 0.005 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
          <span>
            Drawer closed — expected {formatCurrency(closeResult.expectedCash)},
            variance {closeResult.variance > 0 ? '+' : ''}{formatCurrency(closeResult.variance)}.
          </span>
          <Button variant="ghost" size="sm" onClick={() => setCloseResult(null)}>Dismiss</Button>
        </div>
      )}

      {/* Open session panel */}
      {session ? (
        <div className="rounded-xl border bg-card">
          <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-semibold flex items-center gap-2">
                Drawer open <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{session.accountCode}</Badge>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Opened {formatDateTime(session.openedAt)} · float {formatCurrency(Number(session.openingFloat))}
              </p>
            </div>
            {canManage && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setMoveOpen('paid_in'); setFAmount(''); setFReason(''); setFormError(null); }}>
                  <ArrowDownToLine className="h-4 w-4 mr-1" /> Paid in
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setMoveOpen('paid_out'); setFAmount(''); setFReason(''); setFormError(null); }}>
                  <ArrowUpFromLine className="h-4 w-4 mr-1" /> Paid out
                </Button>
                <Button size="sm" onClick={() => { setCloseOpen(true); setFCount(''); setFormError(null); }}>
                  <Lock className="h-4 w-4 mr-1" /> Close drawer
                </Button>
              </div>
            )}
          </div>
          <div className="px-4 py-4">
            <div className="text-xs text-muted-foreground">Expected in drawer</div>
            <div className="text-3xl font-bold tabular-nums">{formatCurrency(liveExpected)}</div>
            <div className="mt-4 space-y-1.5">
              {movements.length === 0 && (
                <p className="text-sm text-muted-foreground">No paid-ins or paid-outs yet.</p>
              )}
              {movements.map(m => (
                <div key={m.id} className="flex items-center gap-3 text-sm">
                  {m.direction === 'paid_in'
                    ? <ArrowDownToLine className="h-4 w-4 text-emerald-600 shrink-0" />
                    : <ArrowUpFromLine className="h-4 w-4 text-rose-600 shrink-0" />}
                  <span className={`tabular-nums font-medium ${m.direction === 'paid_in' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {m.direction === 'paid_in' ? '+' : '−'}{formatCurrency(Number(m.amount))}
                  </span>
                  <span className="text-muted-foreground truncate">{m.reason || (m.direction === 'paid_in' ? 'Paid in' : 'Paid out')}</span>
                  <span className="ml-auto text-xs text-muted-foreground shrink-0">{m.createdByName || ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : !loading && (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <Vault className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-medium">No drawer open for this store</p>
          <p className="text-sm text-muted-foreground mt-1">Open the drawer to start tracking today's cash.</p>
          {canManage && (
            <Button className="mt-4" onClick={() => { setOpenOpen(true); setFFloat(''); setFReason(''); setFormError(null); }}>
              <PlayCircle className="h-4 w-4 mr-2" /> Open drawer
            </Button>
          )}
        </div>
      )}

      {/* History */}
      <div className="overflow-x-auto rounded-xl border bg-card">
        <div className="px-4 py-3 border-b">
          <h2 className="font-semibold text-sm">Recent sessions</h2>
        </div>
        {loading && history.length === 0 ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 px-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : history.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No drawer sessions yet.</div>
        ) : (
          <ReusableTable columns={historyColumns} data={history} isLoading={false} noDataMessage="No sessions." />
        )}
      </div>

      {/* Open drawer dialog */}
      <Dialog open={openOpen} onOpenChange={setOpenOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Open drawer</DialogTitle>
            <DialogDescription>Count the starting cash in the till — that becomes the opening float.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Opening float</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                <Input type="number" min="0" step="0.01" autoFocus value={fFloat} onChange={e => setFFloat(e.target.value)} className="pl-8 h-12 text-lg font-semibold" placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input value={fReason} onChange={e => setFReason(e.target.value)} className="mt-1" placeholder="Morning shift…" />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenOpen(false)}>Cancel</Button>
            <Button onClick={doOpen} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Open drawer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paid in / out dialog */}
      <Dialog open={!!moveOpen} onOpenChange={(o) => { if (!o) setMoveOpen(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{moveOpen === 'paid_in' ? 'Paid in' : 'Paid out'}</DialogTitle>
            <DialogDescription>
              {moveOpen === 'paid_in'
                ? 'Cash added to the drawer (e.g. change from the safe).'
                : 'Cash taken from the drawer (e.g. a petty expense).'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Amount</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                <Input type="number" min="0" step="0.01" autoFocus value={fAmount} onChange={e => setFAmount(e.target.value)} className="pl-8 h-12 text-lg font-semibold" placeholder="0.00" />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Input value={fReason} onChange={e => setFReason(e.target.value)} className="mt-1" placeholder={moveOpen === 'paid_in' ? 'Change fund' : 'Taxi fare, supplies…'} />
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(null)}>Cancel</Button>
            <Button onClick={doMovement} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close drawer dialog */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Close drawer</DialogTitle>
            <DialogDescription>Count the cash in the till. Any difference from the expected amount posts to Cash Over/Short.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/40 p-3 text-sm flex justify-between">
              <span className="text-muted-foreground">Expected</span>
              <span className="font-semibold tabular-nums">{formatCurrency(liveExpected)}</span>
            </div>
            <div>
              <Label>Counted cash</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currencySymbol}</span>
                <Input type="number" min="0" step="0.01" autoFocus value={fCount} onChange={e => setFCount(e.target.value)} className="pl-8 h-12 text-lg font-semibold" placeholder="0.00" />
              </div>
            </div>
            {previewVariance !== null && (
              <div className={`rounded-lg p-3 text-sm flex justify-between ${Math.abs(previewVariance) < 0.005 ? 'bg-emerald-50 text-emerald-800' : previewVariance < 0 ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
                <span>Variance</span>
                <span className="font-semibold tabular-nums">{previewVariance > 0 ? '+' : ''}{formatCurrency(previewVariance)}</span>
              </div>
            )}
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancel</Button>
            <Button onClick={doClose} disabled={saving || previewVariance === null}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Close drawer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
