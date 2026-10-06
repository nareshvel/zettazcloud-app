import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  listMemosPaged, getMemo, createMemo, updateMemo, returnMemoItems, setMemoStatus, getMemoStats,
  Memo, MemoItem, MemoStatus, MemoDirection, MemoStats,
} from '@/services/jewelryOpsService';
import { printMemoSlip, printMemoAcknowledgement } from '@/services/memoPrintService';
import { renderMemoWithTemplate } from '@/services/templateReceiptService';
import { getSuppliers } from '@/services/supplierService';
import { listAllPieces } from '@/services/productPieceService';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useStore } from '@/contexts/StoreContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import CustomerSearchSelect, { CustomerHit } from '@/components/customers/CustomerSearchSelect';
import {
  FileStack, Plus, Loader2, Search, X, ChevronRight, Printer,
  ArrowDownToLine, ArrowUpFromLine, RefreshCw, AlertTriangle,
  Package, RotateCcw, CheckCircle2, Ban, ShoppingBag, Tag,
  Calendar, User, Building2, Edit2, Clock,
} from 'lucide-react';

const PAGE_SIZE = 20;

/* ─── constants ─────────────────────────────────────────────────────────── */
const ALL_STATUSES: MemoStatus[] = ['open','partially_returned','returned','purchased','sold','cancelled'];

// Navy is the only decorative color; green/amber/red survive only as the
// confirmed semantic exception (success/pending/cancelled), same convention
// SalesReturnPage.tsx uses for its statusBadge. "Open"/"partially returned"
// are still-pending states (amber); returned/purchased/sold are completed
// outcomes (green); cancelled is red. No blue/purple/teal decoration.
const STATUS_META: Record<MemoStatus, { label: string; color: string; bg: string }> = {
  open:               { label: 'Open',               color: 'text-amber-700 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-500/15' },
  partially_returned: { label: 'Part. Returned',      color: 'text-amber-700 dark:text-amber-400',   bg: 'bg-amber-100 dark:bg-amber-500/15' },
  returned:           { label: 'Returned',            color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/15' },
  purchased:          { label: 'Purchased',           color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/15' },
  sold:               { label: 'Sold',                color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/15' },
  cancelled:          { label: 'Cancelled',           color: 'text-rose-700 dark:text-rose-400',     bg: 'bg-rose-100 dark:bg-rose-500/15' },
};

const TRANSITIONS: Record<MemoStatus, MemoStatus[]> = {
  open:               ['partially_returned','returned','purchased','sold','cancelled'],
  partially_returned: ['returned','purchased','sold','cancelled'],
  returned:           ['cancelled'],
  purchased:          [],
  sold:               [],
  cancelled:          [],
};

const inputCls = 'w-full px-3.5 py-2.5 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background text-foreground placeholder:text-muted-foreground transition-colors text-sm';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5';

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
const MemoPage: React.FC = () => {
  const { formatCurrency, formatDate, formatWeight } = useLocaleFormat();
  const { store } = useStore();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const fmtC = (n: number | null | undefined) => n != null ? formatCurrency(n) : '—';
  const fmtD = (d: any) => { if (!d) return '—'; try { return formatDate(typeof d === 'string' ? d.slice(0,10) : d); } catch { return '—'; } };

  // Sales Hub quick-action entry point. The Hub's "Memo In/Out" tile
  // navigates here with router state instead of just landing on the ledger —
  // see POSScreen.tsx / DutyFreeIntakeModal.tsx for the existing
  // `fromSalesHub` precedent this follows. `quickActionType` lets the Hub
  // (or a future sub-tile) pre-pick Memo Out vs Memo In/Return; defaults to
  // 'out' since issuing a memo out to a customer is the more common counter
  // action. The full ledger below is always reachable — quick action just
  // means the create-flow opens immediately on mount instead of requiring an
  // extra "New Memo" click.
  const navState = (location.state as { quickAction?: boolean; fromSalesHub?: boolean; quickActionType?: 'out' | 'in'; presetQuery?: string } | null) ?? null;
  const fromSalesHub = Boolean(navState?.fromSalesHub);
  const quickAction = Boolean(navState?.quickAction);
  const quickActionType: MemoDirection = navState?.quickActionType === 'in' ? 'in' : 'out';

  const [rows, setRows]               = useState<Memo[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadError, setLoadError]     = useState<string | null>(null);
  const [direction, setDirection]     = useState<'' | 'in' | 'out'>('');
  const [statusFilter, setStatusFilter] = useState<MemoStatus | '' | 'overdue'>('');
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm]   = useState('');
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalCount, setTotalCount]   = useState(0);
  const [stats, setStats]             = useState<MemoStats | null>(null);
  const [showNew, setShowNew]         = useState(false);
  const [newDirection, setNewDirection] = useState<MemoDirection>('out');
  const [detail, setDetail]           = useState<Memo | null>(null);
  const openedQuickAction = useRef(false);

  // Debounce the search box (same 350ms pattern as SalesReturnPage.tsx).
  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, direction]);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(null);
    try {
      const res = await listMemosPaged({
        direction: direction || undefined,
        status:    (statusFilter && statusFilter !== 'overdue') ? statusFilter : undefined,
        overdue:   statusFilter === 'overdue',
        search:    searchTerm.trim() || undefined,
        page, limit: PAGE_SIZE,
      });
      setRows(res.data || []);
      setTotalPages(res.pagination?.pages || 1);
      setTotalCount(res.pagination?.total ?? (res.data || []).length);
    } catch (e: any) { setLoadError(e?.message ?? 'Failed to load'); setRows([]); }
    finally { setLoading(false); }
  }, [direction, statusFilter, searchTerm, page]);

  useEffect(() => { load(); }, [load]);

  const loadStats = useCallback(async () => {
    try { setStats(await getMemoStats()); } catch { /* non-blocking */ }
  }, []);
  useEffect(() => { loadStats(); }, [loadStats]);

  // Auto-open the create-memo flow on mount when arriving via the Hub's
  // quick action, so the tile's promise ("launch this action") is kept
  // instead of dropping the cashier on the full ledger first.
  useEffect(() => {
    if (quickAction && !openedQuickAction.current) {
      openedQuickAction.current = true;
      setNewDirection(quickActionType);
      setShowNew(true);
    }
  }, [quickAction, quickActionType]);

  const openNewMemo = (dir: MemoDirection = 'out') => { setNewDirection(dir); setShowNew(true); };

  const openDetail = async (m: Memo) => {
    try { setDetail(await getMemo(m.id)); } catch { setDetail(m); }
  };

  const changeStatus = async (m: Memo, s: MemoStatus) => {
    try {
      await setMemoStatus(m.id, s);
      toast({ title: `Status → ${STATUS_META[s].label}` });
      load(); loadStats();
      if (detail?.id === m.id) setDetail(prev => prev ? { ...prev, status: s } : null);
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.message, variant: 'destructive' });
    }
  };

  const storeCtx = {
    storeName:    store?.name,
    storeAddress: store?.address ?? undefined,
    storePhone:   store?.phone   ?? undefined,
    storeEmail:   store?.email   ?? undefined,
    currencyCode: store?.currencyCode,
  };

  const kpiItems = [
    { key: '' as MemoStatus | '' | 'overdue', label: 'Open',           value: stats?.openCount ?? 0,     icon: FileStack, color: 'text-primary' },
    { key: 'partially_returned' as MemoStatus, label: 'Part. Returned', value: stats?.partialCount ?? 0,  icon: RotateCcw, color: 'text-amber-600' },
    { key: 'returned' as MemoStatus,           label: 'Returned',       value: stats?.returnedCount ?? 0, icon: CheckCircle2, color: 'text-emerald-600' },
    { key: 'overdue' as 'overdue',             label: 'Overdue',        value: stats?.overdueCount ?? 0,  icon: Clock, color: 'text-rose-600' },
  ] as const;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header — glass hero, brand navy, matching SalesReturnPage.tsx */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-900 flex items-center justify-center shadow-sm shrink-0">
            <FileStack className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-foreground tracking-tight">Memo & Consignment</h1>
            <p className="text-sm text-muted-foreground">Track goods held on memo — separate from owned inventory.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {fromSalesHub && (
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => navigate('/sales-hub')}>
              Back to Hub
            </Button>
          )}
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => { load(); loadStats(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => openNewMemo('in')}
            variant="outline"
            className="rounded-full gap-1.5"
          >
            <ArrowDownToLine className="h-4 w-4" /> Memo In
          </Button>
          <Button
            onClick={() => openNewMemo('out')}
            className="rounded-full gap-1.5 bg-gradient-to-br from-primary-600 to-primary-900 hover:from-primary-700 hover:to-primary-950 text-white border-0 shadow-sm"
          >
            <Plus className="h-4 w-4" /> New Memo
          </Button>
        </div>
      </div>

      {/* KPI strip — glass cards, navy-active / semantic-status exception */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpiItems.map((item) => {
          const Icon = item.icon;
          const active = statusFilter === item.key;
          return (
            <button
              key={item.label}
              onClick={() => setStatusFilter(active ? '' : item.key)}
              className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all backdrop-blur-md ${
                active
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-white/40 bg-card/70 hover:border-primary/40 hover:shadow-md'
              }`}
            >
              <Icon className={`h-5 w-5 shrink-0 ${item.color}`} />
              <div>
                <p className="text-2xl font-bold text-foreground leading-none">{item.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Value strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/40 bg-card/70 backdrop-blur-md shadow-sm p-3.5">
          <p className="text-xs text-muted-foreground">Value Out (open)</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{fmtC(stats?.valueOut ?? 0)}</p>
        </div>
        <div className="rounded-2xl border border-white/40 bg-card/70 backdrop-blur-md shadow-sm p-3.5">
          <p className="text-xs text-muted-foreground">Value In (open)</p>
          <p className="text-lg font-bold text-foreground mt-0.5">{fmtC(stats?.valueIn ?? 0)}</p>
        </div>
      </div>

      {/* Direction tabs — navy active state */}
      <div className="flex gap-2 flex-wrap">
        {([['', 'All'], ['in', 'Memo In (Received)'], ['out', 'Memo Out (Issued)']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setDirection(val)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
              direction === val ? 'bg-primary text-white border-primary' : 'border-white/40 bg-card/70 backdrop-blur-md text-muted-foreground hover:text-foreground hover:border-primary/40'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Search — glass pill, server-side (memo #, party name/email/phone, notes) */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search memo #, party name, email, phone, notes…"
          className="w-full pl-10 pr-9 py-2.5 rounded-full border border-white/40 bg-card/70 backdrop-blur-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        {searchInput && (
          <button onClick={() => setSearchInput('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Error */}
      {loadError && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive flex-1">{loadError}</span>
          <Button variant="outline" size="sm" onClick={load}>Retry</Button>
        </div>
      )}

      {/* Memo list — glass cards, not a table */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-10 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading memos…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center bg-card/40">
          <FileStack className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            {searchTerm || statusFilter || direction ? 'No memos match this filter.' : 'No memos yet. Create one to get started.'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map(m => {
            const SM = STATUS_META[m.status];
            const overdue = m.status === 'open' && m.dueDate && m.dueDate < new Date().toISOString().slice(0,10);
            const partyName = m.supplierName || [m.customerFirstName, m.customerLastName].filter(Boolean).join(' ') || 'Walk-in';
            return (
              <div
                key={m.id}
                onClick={() => openDetail(m)}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/40 bg-card/70 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer"
              >
                <div className="min-w-[7rem]">
                  <p className="text-xs text-muted-foreground">Memo #</p>
                  <p className="font-mono font-semibold text-sm text-foreground">{m.memoNo}</p>
                </div>
                <div className="min-w-[5.5rem]">
                  <p className="text-xs text-muted-foreground">Direction</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                    {m.direction === 'in' ? <ArrowDownToLine className="h-3.5 w-3.5 text-primary" /> : <ArrowUpFromLine className="h-3.5 w-3.5 text-primary" />}
                    {m.direction === 'in' ? 'In' : 'Out'}
                  </span>
                </div>
                <div className="min-w-[9rem] flex-1">
                  <p className="text-xs text-muted-foreground">Party</p>
                  <p className="text-sm text-foreground truncate">{partyName}</p>
                </div>
                <div className="min-w-[6rem]">
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="text-sm text-foreground">{(m as any).itemCount ?? '?'}</p>
                </div>
                <div className="min-w-[6rem]">
                  <p className="text-xs text-muted-foreground">Due</p>
                  <p className={`text-sm ${overdue ? 'text-rose-600 font-semibold' : 'text-foreground'}`}>
                    {m.dueDate ? fmtD(m.dueDate) : '—'}
                  </p>
                </div>
                <div className="min-w-[6rem]">
                  <p className="text-xs text-muted-foreground">Value</p>
                  <p className="font-semibold text-sm text-foreground">{fmtC(m.totalValue)}</p>
                </div>
                <div className="min-w-[7rem] flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${SM.bg} ${SM.color}`}>{SM.label}</span>
                  {overdue && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400">
                      Overdue
                    </span>
                  )}
                </div>
                <div className="flex items-center ml-auto">
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination — server-side */}
      {!loading && totalCount > 0 && (
        <div className="flex items-center justify-between gap-4 pt-1">
          <p className="text-xs text-muted-foreground">
            {totalCount} memo{totalCount === 1 ? '' : 's'} · page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-full text-sm font-medium border border-white/40 bg-card/70 backdrop-blur-md shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/40 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-full text-sm font-medium border border-white/40 bg-card/70 backdrop-blur-md shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary/40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {showNew && (
        <NewMemoModal
          defaultDirection={newDirection}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); loadStats(); }}
          presetQuery={quickAction ? navState?.presetQuery : undefined}
        />
      )}

      {detail && (
        <MemoDrawer
          memo={detail}
          storeCtx={storeCtx}
          onClose={() => setDetail(null)}
          onStatusChange={changeStatus}
          onRefresh={async () => { try { setDetail(await getMemo(detail.id)); } catch {} load(); loadStats(); }}
        />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   MEMO DETAIL DRAWER
══════════════════════════════════════════════════════════════════════════════ */
const MemoDrawer: React.FC<{
  memo: Memo;
  storeCtx: any;
  onClose: () => void;
  onStatusChange: (m: Memo, s: MemoStatus) => void;
  onRefresh: () => void;
}> = ({ memo, storeCtx, onClose, onStatusChange, onRefresh }) => {
  const { formatCurrency, formatDate } = useLocaleFormat();
  const { store } = useStore();
  const { toast } = useToast();
  const fmtC = (n: any) => n != null ? formatCurrency(Number(n)) : '—';
  const fmtD = (d: any) => { if (!d) return '—'; try { return formatDate(typeof d === 'string' ? d.slice(0,10) : d); } catch { return '—'; } };

  // Try the published memo_slip template first; fall back to the hand-rolled
  // A4 acknowledgement if the store has none published yet — same
  // null-means-fallback contract as the other renderXWithTemplate helpers.
  const handlePrintAcknowledgement = useCallback(async () => {
    try {
      const rendered = await renderMemoWithTemplate(memo, {
        storeId: store?.id,
        logoUrl: store?.logoUrl,
        context: {
          store: {
            name: store?.name, address: store?.address, phone: store?.phone,
            email: store?.email, taxId: store?.taxId, currencyCode: store?.currencyCode,
          },
          formatDate, formatCurrency,
        },
      });
      if (rendered) {
        const win = window.open('', '_blank', 'width=900,height=1100');
        if (win) {
          win.document.write(rendered.html);
          win.document.close();
          win.focus();
          setTimeout(() => win.print(), 400);
        }
        return;
      }
    } catch { /* fall through to the legacy acknowledgement */ }
    printMemoAcknowledgement({ ...memo }, storeCtx);
  }, [memo, store, storeCtx, formatDate, formatCurrency]);

  const [editing, setEditing]       = useState(false);
  const [editDue, setEditDue]       = useState(memo.dueDate ?? '');
  const [editNotes, setEditNotes]   = useState(memo.notes ?? '');
  const [saving, setSaving]         = useState(false);
  const [returning, setReturning]   = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, string>>({});

  const SM = STATUS_META[memo.status];
  const allowed = TRANSITIONS[memo.status] ?? [];
  const partyName = memo.supplierName || [memo.customerFirstName, memo.customerLastName].filter(Boolean).join(' ') || '—';
  const overdue = memo.status === 'open' && memo.dueDate && memo.dueDate < new Date().toISOString().slice(0,10);

  const saveEdit = async () => {
    setSaving(true);
    try {
      await updateMemo(memo.id, { due_date: editDue || null, notes: editNotes || null });
      toast({ title: 'Memo updated' });
      setEditing(false);
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Failed', description: e?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const submitReturn = async () => {
    const items = Object.entries(returnQtys)
      .filter(([, q]) => Number(q) > 0)
      .map(([itemId, quantity]) => ({ itemId, quantity: Number(quantity) }));
    if (!items.length) { toast({ title: 'Enter quantities to return', variant: 'destructive' }); return; }
    setReturning(true);
    try {
      await returnMemoItems(memo.id, items);
      toast({ title: 'Items returned' });
      setReturnQtys({});
      onRefresh();
    } catch (e: any) {
      toast({ title: 'Return failed', description: e?.message, variant: 'destructive' });
    } finally { setReturning(false); }
  };

  const items: MemoItem[] = memo.items ?? [];
  const returnableItems = items.filter(it => (Number(it.quantity) - Number(it.returnedQuantity||0)) > 0 && it.status !== 'returned');

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-md bg-card border-l border-border shadow-2xl flex flex-col h-full">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm font-bold">{memo.memoNo}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SM.bg} ${SM.color}`}>{SM.label}</span>
                {overdue && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Overdue</span>}
              </div>
              <p className="text-sm text-muted-foreground">
                {memo.direction === 'in' ? '↓ Received from' : '↑ Issued to'} <span className="text-foreground font-medium">{partyName}</span>
              </p>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setEditing(e => !e)}
                className={`p-1.5 rounded-md transition-colors ${editing ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted hover:text-primary'}`}>
                <Edit2 className="h-4 w-4" />
              </button>
              <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Edit form */}
          {editing ? (
            <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Edit Memo</p>
              <div>
                <label className={labelCls}>Due Date</label>
                <input type="date" className={inputCls} value={editDue} onChange={e => setEditDue(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={editNotes} onChange={e => setEditNotes(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
                <Button size="sm" className="flex-1" onClick={saveEdit} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            /* Info grid */
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Issued',  value: fmtD(memo.issueDate) },
                { label: 'Due',     value: memo.dueDate ? fmtD(memo.dueDate) : '—', highlight: !!overdue },
                { label: 'Total',   value: fmtC(memo.totalValue) },
                { label: 'Items',   value: `${items.length} item${items.length !== 1 ? 's' : ''}` },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="bg-muted/40 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-sm font-semibold mt-0.5 ${highlight ? 'text-red-600' : 'text-foreground'}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Contact info */}
          {(memo.customerPhone || memo.customerEmail) && !editing && (
            <div className="text-xs text-muted-foreground space-y-0.5 px-1">
              {memo.customerPhone && <p>📞 {memo.customerPhone}</p>}
              {memo.customerEmail && <p>✉ {memo.customerEmail}</p>}
            </div>
          )}
          {memo.notes && !editing && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              {memo.notes}
            </div>
          )}

          {/* Items list */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Items</p>
            <div className="space-y-2">
              {items.length === 0 && <p className="text-xs text-muted-foreground italic">No items loaded</p>}
              {items.map(it => {
                const remaining = Number(it.quantity) - Number(it.returnedQuantity || 0);
                const fullyReturned = remaining <= 0;
                return (
                  <div key={it.id} className={`rounded-lg border px-3 py-2.5 ${fullyReturned ? 'border-border bg-muted/20 opacity-60' : 'border-border bg-card'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{it.description}</p>
                        {it.pieceCode && <p className="text-xs text-muted-foreground font-mono">{it.pieceCode}{it.purity ? ` · ${it.purity}` : ''}{it.grossWeight != null ? ` · ${formatWeight(it.grossWeight)}` : ''}</p>}
                        {it.productName && <p className="text-xs text-muted-foreground">{it.productName}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold text-foreground">{fmtC(it.lineValue)}</p>
                        <p className="text-xs text-muted-foreground">
                          {Number(it.returnedQuantity || 0)}/{Number(it.quantity)} returned
                        </p>
                      </div>
                    </div>

                    {/* Return qty input */}
                    {!fullyReturned && memo.status !== 'sold' && memo.status !== 'purchased' && memo.status !== 'cancelled' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Return:</span>
                        <input type="number" min={0} max={remaining} step={1}
                          className="w-20 border border-border rounded px-2 py-1 text-xs bg-background"
                          placeholder={`0–${remaining}`}
                          value={returnQtys[it.id!] ?? ''}
                          onChange={e => setReturnQtys(prev => ({ ...prev, [it.id!]: e.target.value }))}
                        />
                        <span className="text-xs text-muted-foreground">of {remaining} remaining</span>
                      </div>
                    )}
                    {fullyReturned && (
                      <p className="text-xs text-blue-600 mt-1 font-medium">✓ Fully returned</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Return submit button */}
          {returnableItems.length > 0 && memo.status !== 'sold' && memo.status !== 'purchased' && memo.status !== 'cancelled' && (
            <Button className="w-full gap-1.5" variant="outline" onClick={submitReturn} disabled={returning}>
              {returning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Record Return
            </Button>
          )}

          {/* Status actions */}
          {allowed.length > 0 && (
            <div className="border border-border rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Change Status</p>
              <div className="flex flex-wrap gap-2">
                {allowed.map(s => {
                  const M = STATUS_META[s];
                  const Icon = s === 'cancelled' ? Ban : s === 'purchased' ? ShoppingBag : s === 'sold' ? Tag : s === 'returned' ? CheckCircle2 : RotateCcw;
                  return (
                    <button key={s} onClick={() => onStatusChange(memo, s)}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1 transition-all ${M.bg} ${M.color} border-current/20 hover:opacity-80`}>
                      <Icon className="h-3 w-3" />{M.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer — print */}
        <div className="px-5 py-4 border-t border-border bg-muted/20 shrink-0 space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => printMemoSlip({ ...memo }, storeCtx)}>
              <Printer className="h-3.5 w-3.5" /> Thermal Slip
            </Button>
            <Button variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => { void handlePrintAcknowledgement(); }}>
              <Printer className="h-3.5 w-3.5" /> Acknowledgement
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   NEW MEMO MODAL
══════════════════════════════════════════════════════════════════════════════ */
interface NewItem {
  description: string;
  quantity: string;
  unitValue: string;
  productId: string;
  pieceId: string;
  pieceCode: string;
}

const emptyItem = (): NewItem => ({ description: '', quantity: '1', unitValue: '', productId: '', pieceId: '', pieceCode: '' });

const NewMemoModal: React.FC<{ defaultDirection?: MemoDirection; onClose: () => void; onSaved: () => void; presetQuery?: string }> = ({ defaultDirection = 'out', onClose, onSaved, presetQuery }) => {
  const { formatCurrency, formatWeight } = useLocaleFormat();
  const { toast } = useToast();

  const [direction, setDirection]   = useState<MemoDirection>(defaultDirection);
  const [issueDate, setIssueDate]   = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate]       = useState('');
  const [notes, setNotes]           = useState('');
  const [customer, setCustomer]     = useState<CustomerHit | null>(null);
  const [suppliers, setSuppliers]   = useState<any[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems]           = useState<NewItem[]>([emptyItem()]);
  const [saving, setSaving]         = useState(false);
  const [pieceSearch, setPieceSearch] = useState<Record<number, string>>({});
  const [pieceResults, setPieceResults] = useState<Record<number, any[]>>({});

  useEffect(() => {
    getSuppliers().then(s => setSuppliers(s || [])).catch(() => {});
  }, []);

  const setItem = (i: number, k: keyof NewItem, v: string) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, [k]: v } : it));

  const searchPiece = async (i: number, q: string) => {
    setPieceSearch(prev => ({ ...prev, [i]: q }));
    if (q.length < 2) { setPieceResults(prev => ({ ...prev, [i]: [] })); return; }
    try {
      const results = await listAllPieces({ q, status: 'available', limit: 10 });
      setPieceResults(prev => ({ ...prev, [i]: results || [] }));
    } catch { setPieceResults(prev => ({ ...prev, [i]: [] })); }
  };

  const selectPiece = (i: number, piece: any) => {
    setItems(prev => prev.map((it, idx) => idx === i ? {
      ...it,
      pieceId: piece.id,
      pieceCode: piece.pieceCode,
      productId: piece.productId,
      description: `${piece.productName || ''} ${piece.pieceCode} ${piece.purity || ''} ${piece.grossWeight != null ? formatWeight(piece.grossWeight) : ''}`.trim(),
      unitValue: piece.sellingPrice != null ? String(piece.sellingPrice) : it.unitValue,
    } : it));
    setPieceSearch(prev => ({ ...prev, [i]: '' }));
    setPieceResults(prev => ({ ...prev, [i]: [] }));
  };

  const total = items.reduce((s, it) => s + (Number(it.unitValue)||0) * (Number(it.quantity)||0), 0);

  const save = async () => {
    const validItems = items.filter(it => it.description.trim());
    if (!validItems.length) { toast({ title: 'Add at least one item', variant: 'destructive' }); return; }
    if (direction === 'out' && !customer) { toast({ title: 'Select a customer', variant: 'destructive' }); return; }
    if (direction === 'in' && !supplierId) { toast({ title: 'Select a supplier', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      await createMemo({
        direction,
        issue_date: issueDate,
        due_date:   dueDate || null,
        notes:      notes || null,
        customer_id: direction === 'out' ? customer?.id : null,
        supplier_id: direction === 'in' ? supplierId : null,
        items: validItems.map(it => ({
          description: it.description,
          quantity:    Number(it.quantity) || 1,
          unit_value:  Number(it.unitValue) || 0,
          product_id:  it.productId || null,
          piece_id:    it.pieceId   || null,
        })),
      });
      toast({ title: 'Memo created' });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Failed to create memo', description: e?.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><FileStack className="h-5 w-5 text-primary" /></div>
            <div>
              <h2 className="text-base font-semibold text-foreground">New Memo</h2>
              <p className="text-xs text-muted-foreground">Create a memo / consignment record</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Direction toggle */}
          <div className="flex gap-2">
            <button onClick={() => setDirection('out')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all ${direction === 'out' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
              <ArrowUpFromLine className="h-4 w-4" /> Memo Out (to Customer)
            </button>
            <button onClick={() => setDirection('in')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all ${direction === 'in' ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
              <ArrowDownToLine className="h-4 w-4" /> Memo In (from Supplier)
            </button>
          </div>

          {/* Party */}
          <div>
            <label className={labelCls}>{direction === 'out' ? 'Customer *' : 'Supplier *'}</label>
            {direction === 'out' ? (
              <CustomerSearchSelect selected={customer} onSelect={setCustomer} initialQuery={presetQuery} />
            ) : (
              <select className={inputCls} value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                <option value="">— select supplier —</option>
                {suppliers.map((s: any) => <option key={s.id} value={s.id}>{s.supplierName || s.supplier_name}</option>)}
              </select>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Issue Date</label>
              <input type="date" className={inputCls} value={issueDate} onChange={e => setIssueDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Due Date</label>
              <input type="date" className={inputCls} value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls}>Items *</label>
              <button onClick={() => setItems(p => [...p, emptyItem()])} className="text-xs text-primary hover:text-primary/80 font-medium">+ Add item</button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Item {i + 1}</span>
                    {items.length > 1 && (
                      <button onClick={() => setItems(p => p.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                    )}
                  </div>

                  {/* Piece search (for memo out — serialized pieces) */}
                  {direction === 'out' && (
                    <div className="relative">
                      <input className={inputCls} placeholder="🔍 Search piece code / barcode (optional)"
                        value={pieceSearch[i] ?? ''}
                        onChange={e => searchPiece(i, e.target.value)}
                      />
                      {(pieceResults[i]?.length ?? 0) > 0 && (
                        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                          {pieceResults[i].map((p: any) => (
                            <button key={p.id} className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center justify-between"
                              onClick={() => selectPiece(i, p)}>
                              <span className="font-mono font-semibold">{p.pieceCode}</span>
                              <span className="text-muted-foreground">{p.productName} {p.purity}</span>
                              {p.sellingPrice != null && <span className="text-green-600 font-medium">{formatCurrency(p.sellingPrice)}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div className="col-span-2 sm:col-span-3">
                      <input className={inputCls} placeholder="Description *"
                        value={it.description} onChange={e => setItem(i, 'description', e.target.value)} />
                    </div>
                    <input className={inputCls} type="number" min="0.001" step="0.001" placeholder="Qty"
                      value={it.quantity} onChange={e => setItem(i, 'quantity', e.target.value)} />
                    <input className={inputCls} type="number" min="0" placeholder="Unit value"
                      value={it.unitValue} onChange={e => setItem(i, 'unitValue', e.target.value)} />
                    <div className="col-span-2 sm:col-span-1 flex items-center justify-end text-sm font-semibold text-foreground">
                      {formatCurrency((Number(it.unitValue)||0) * (Number(it.quantity)||0))}
                    </div>
                  </div>
                  {it.pieceCode && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-600">
                      <Tag className="h-3 w-3" /> Linked piece: <span className="font-mono font-semibold">{it.pieceCode}</span>
                      <button onClick={() => setItem(i, 'pieceId', '') || setItem(i, 'pieceCode', '')} className="ml-1 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="flex justify-end mt-3">
              <div className="bg-muted/40 rounded-lg px-4 py-2 text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-bold text-foreground">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional internal notes" />
          </div>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border bg-muted/20 shrink-0 rounded-b-2xl">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Creating…</> : 'Create Memo'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MemoPage;
