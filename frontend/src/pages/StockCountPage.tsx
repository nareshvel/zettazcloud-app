/**
 * StockCountPage — guided stock-count sessions for non-serialized products.
 *
 * Mental model — a real floor workflow, not a spreadsheet:
 *   1. SESSION LIST — every count is a named session that auto-saves
 *      per-item server-side. Dead phones, shift handoffs and device
 *      switches are all free: anyone with inventory.adjust opens the
 *      in-progress count and keeps going. History (posted/cancelled)
 *      is the count audit trail.
 *   2. COUNT — "counted X of Y" progress, scan→jump→qty→Enter loop,
 *      per-item state (uncounted/match/variance), one-tap Match and
 *      not-found (0) actions, sheet filters (All/Remaining/Counted/
 *      Variances), and a Blind option set at session create that hides
 *      expected stock to prevent confirmation bias.
 *   3. REVIEW — only variances need attention; each gets a reason code
 *      (damage, theft, found stock…) not a mandatory essay.
 *   4. POST — sessions created with "requires approval" wait in
 *      'submitted' until someone holding inventory.count_approve
 *      posts them; others post immediately. Uncounted items are
 *      explicitly left unchanged.
 *
 * Serialized products are excluded server-side — they're counted
 * piece-by-piece via Cycle Count.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ClipboardList, RefreshCcw, CheckCircle2, AlertCircle, Loader2,
  Minus, Plus, ScanBarcode, X, PackageSearch, Check, EyeOff,
  SearchX, PackageX, ChevronLeft, PlusCircle, Clock,
  ShieldCheck, Ban,
} from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { getCategories } from '@/services/inventoryService';
import * as sc from '@/services/stockCountService';
import { useAuth } from '@/contexts/AuthContext';
import { useOptionalStore } from '@/contexts/StoreContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import { Category } from '@/types';

const ALL_CATEGORIES = '__all__';
const ROW_CAP = 300; // a full-store count can hold thousands — render in chunks
type SheetFilter = 'all' | 'remaining' | 'counted' | 'variances';
type RowStatus = 'uncounted' | 'match' | 'variance';

/** Discrepancy reason codes — chips instead of mandatory free text.
 *  `other` requires a detail line; everything else is one tap. */
const REASONS = [
  { code: 'count_error', label: 'Counted wrong before' },
  { code: 'damaged', label: 'Damaged' },
  { code: 'theft_loss', label: 'Theft / loss' },
  { code: 'found', label: 'Found stock' },
  { code: 'expired', label: 'Expired' },
  { code: 'other', label: 'Other' },
] as const;

const STATUS_META: Record<sc.CountSessionStatus, { label: string; variant: 'info' | 'warning' | 'success' | 'secondary' }> = {
  in_progress: { label: 'In progress', variant: 'info' },
  submitted: { label: 'Awaiting approval', variant: 'warning' },
  posted: { label: 'Posted', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
};

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ===========================================================================
// Session list — pick an in-progress count, review a submitted one, or start
// a new session. This is the default view.
// ===========================================================================
function SessionList({
  sessions, loading, onOpen, onNew, onRefresh, canApprove,
}: {
  sessions: sc.CountSession[];
  loading: boolean;
  onOpen: (s: sc.CountSession) => void;
  onNew: () => void;
  onRefresh: () => void;
  canApprove: boolean;
}) {
  const active = sessions.filter(s => s.status === 'in_progress' || s.status === 'submitted');
  const history = sessions.filter(s => s.status === 'posted' || s.status === 'cancelled');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {active.length > 0
            ? `${active.length} open count${active.length === 1 ? '' : 's'} — tap to ${active.some(s => s.status === 'submitted') && canApprove ? 'review or ' : ''}continue`
            : 'Start a count to reconcile physical stock against the system.'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={onRefresh} disabled={loading} title="Refresh">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={onNew}>
            <PlusCircle className="h-4 w-4 mr-1.5" />New count
          </Button>
        </div>
      </div>

      {loading && sessions.length === 0 && (
        <div className="px-4 py-10 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading counts…
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="rounded-xl border border-dashed px-4 py-12 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium text-foreground">No stock counts yet</p>
          <p className="text-sm mt-1">Create a count, work through the list on the floor, and post the variances.</p>
          <Button className="mt-4" onClick={onNew}><PlusCircle className="h-4 w-4 mr-1.5" />Start first count</Button>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-2">
          {active.map(s => {
            const total = s.itemCount ?? 0;
            const done = s.countedCount ?? 0;
            const pct = total === 0 ? 0 : Math.round((done / total) * 100);
            const meta = STATUS_META[s.status];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onOpen(s)}
                className="w-full text-left rounded-xl border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold truncate">{s.name}</span>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {s.blind ? <Badge variant="outline"><EyeOff className="h-3 w-3 mr-1" />Blind</Badge> : null}
                      {s.requiresApproval ? <Badge variant="outline"><ShieldCheck className="h-3 w-3 mr-1" />Approval</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {s.scopeCategoryName || 'All categories'} · started {fmtDate(s.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{done}/{total}</div>
                    {(s.varianceCount ?? 0) > 0 && (
                      <div className="text-xs text-amber-600 font-medium">{s.varianceCount} variance{s.varianceCount === 1 ? '' : 's'}</div>
                    )}
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-3">
                  <div className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">History</h3>
          <div className="rounded-xl border divide-y bg-card overflow-hidden">
            {history.map(s => {
              const meta = STATUS_META[s.status];
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpen(s)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/30 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{s.name}</span>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {s.scopeCategoryName || 'All categories'} · {fmtDate(s.postedAt || s.createdAt)}
                    </p>
                  </div>
                  {s.status === 'posted' && (
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {s.appliedCount} adjusted{s.skippedCount > 0 ? ` · ${s.skippedCount} skipped` : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Page
// ===========================================================================
export default function StockCountPage() {
  const { user } = useAuth();
  const storeCtx = useOptionalStore();
  const canApprove = hasAnyPermission(user, ['inventory.count_approve']);

  // --- list ------------------------------------------------------------------
  const [sessions, setSessions] = useState<sc.CountSession[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // --- active session ----------------------------------------------------------
  const [session, setSession] = useState<sc.CountSession | null>(null);
  const [items, setItems] = useState<sc.CountSessionItem[]>([]);
  const [entryValues, setEntryValues] = useState<Record<string, string>>({});
  const [sessionLoading, setSessionLoading] = useState(false);

  // --- count sheet controls -----------------------------------------------------
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SheetFilter>('all');
  const [rowCap, setRowCap] = useState(ROW_CAP);
  const [scanMiss, setScanMiss] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [noteDetails, setNoteDetails] = useState<Record<string, string>>({});

  // --- new session form -----------------------------------------------------------
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState('');
  const [newCategoryId, setNewCategoryId] = useState(ALL_CATEGORIES);
  const [newBlind, setNewBlind] = useState(false);
  const [newRequiresApproval, setNewRequiresApproval] = useState(false);
  const [creating, setCreating] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);
  const qtyRefs = useRef(new Map<string, HTMLInputElement>());
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pending server saves — the source of truth for "what hasn't hit the
  // API yet". Flushed on a debounce and always before submit.
  const pending = useRef(new Map<string, sc.ItemUpdate>());
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef<sc.CountSession | null>(null);
  sessionRef.current = session;

  const isReadOnly = !!session && session.status !== 'in_progress';
  const blind = !!session?.blind;

  // ---------------------------------------------------------------- sessions
  const loadSessions = useCallback(async () => {
    setListLoading(true);
    try {
      setSessions(await sc.listSessions());
    } catch (e: any) {
      setError(e.message || 'Failed to load count sessions.');
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);
  useEffect(() => { getCategories('active').then(setCategories).catch(() => setCategories([])); }, []);
  useEffect(() => () => { if (focusTimer.current) clearTimeout(focusTimer.current); if (flushTimer.current) clearTimeout(flushTimer.current); }, []);
  // Scanner-first: arm the scan box when a count opens.
  useEffect(() => { if (session?.status === 'in_progress') scanRef.current?.focus(); }, [session?.id, session?.status]);

  const openSession = async (s: sc.CountSession) => {
    setSessionLoading(true);
    setError(null);
    setResult(null);
    try {
      const { session: fresh, items: sessionItems } = await sc.getSession(s.id);
      setSession(fresh);
      setItems(sessionItems);
      // Seed the entry map from server counts so resumed sessions show
      // exactly what was already entered (on any device).
      const seeded: Record<string, string> = {};
      sessionItems.forEach(i => { if (i.countedQty !== null) seeded[i.productId] = String(i.countedQty); });
      setEntryValues(seeded);
      setReasons({});
      setNoteDetails({});
      setSearch('');
      setFilter('all');
      setRowCap(ROW_CAP);
      pending.current.clear();
    } catch (e: any) {
      setError(e.message || 'Failed to open session.');
    } finally {
      setSessionLoading(false);
    }
  };

  const closeSession = async () => {
    await flushPending();
    setSession(null);
    setItems([]);
    setEntryValues({});
    setReasons({});
    setNoteDetails({});
    pending.current.clear();
    loadSessions();
  };

  const createSession = async () => {
    setCreating(true);
    setError(null);
    try {
      const created = await sc.createSession({
        name: newName.trim() || undefined,
        categoryId: newCategoryId === ALL_CATEGORIES ? undefined : newCategoryId,
        blind: newBlind,
        requiresApproval: newRequiresApproval,
      });
      setCreateOpen(false);
      setNewName('');
      setNewCategoryId(ALL_CATEGORIES);
      setNewBlind(false);
      setNewRequiresApproval(false);
      await openSession(created);
    } catch (e: any) {
      setError(e.message || 'Failed to create count session.');
    } finally {
      setCreating(false);
    }
  };

  // --------------------------------------------------------------- saving
  const flushPending = useCallback(async () => {
    if (flushTimer.current) { clearTimeout(flushTimer.current); flushTimer.current = null; }
    const s = sessionRef.current;
    if (!s || pending.current.size === 0) return;
    const batch = Array.from(pending.current.values());
    pending.current.clear();
    try {
      await sc.updateSessionItems(s.id, batch);
    } catch (e: any) {
      setError(e.message || 'Failed to save counts — check your connection.');
    }
  }, []);

  const queueUpdate = (update: sc.ItemUpdate) => {
    pending.current.set(update.productId, { ...pending.current.get(update.productId), ...update });
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flushPending, 700);
  };

  // ---------------------------------------------------------------- items
  const setCount = (item: sc.CountSessionItem, value: string) => {
    if (isReadOnly) return;
    setEntryValues(prev => ({ ...prev, [item.productId]: value }));
    const n = value === '' ? null : Number(value);
    const qty = n === null || isNaN(n) ? null : n;
    setItems(prev => prev.map(i => i.productId === item.productId
      ? { ...i, countedQty: qty, variance: qty === null ? null : qty - i.expectedQty }
      : i));
    queueUpdate({ productId: item.productId, countedQty: qty });
  };

  const step = (item: sc.CountSessionItem, delta: number) => {
    const current = entryValues[item.productId];
    const hasEntry = current !== undefined && current !== '' && !isNaN(Number(current));
    // Blind mode steps from 0 — basing on expected_qty would leak it.
    const base = hasEntry ? Number(current) : (blind ? 0 : item.expectedQty);
    setCount(item, String(Math.max(0, base + delta)));
  };

  const deltaFor = (item: sc.CountSessionItem): number | null => {
    const v = entryValues[item.productId];
    if (v === undefined || v === '') return null;
    const n = Number(v);
    if (isNaN(n)) return null;
    return n - item.expectedQty;
  };

  const statusOf = (item: sc.CountSessionItem): RowStatus => {
    const d = deltaFor(item);
    if (d === null) return 'uncounted';
    return d === 0 ? 'match' : 'variance';
  };

  const countedItems = useMemo(() => items.filter(i => statusOf(i) !== 'uncounted'), // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, entryValues]);
  const varianceItems = useMemo(() => items.filter(i => statusOf(i) === 'variance'), // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, entryValues]);
  const netDelta = useMemo(() => varianceItems.reduce((sum, i) => sum + (deltaFor(i) || 0), 0), // eslint-disable-next-line react-hooks/exhaustive-deps
    [varianceItems, entryValues]);
  const remaining = items.length - countedItems.length;

  // Search filters the session's items locally — the sheet is fixed at
  // create time; scanning a barcode can still pull in out-of-scope products.
  const needle = search.trim().toLowerCase();
  const searched = useMemo(() => {
    if (!needle) return items;
    return items.filter(i =>
      i.productName.toLowerCase().includes(needle) ||
      (i.sku && i.sku.toLowerCase().includes(needle)) ||
      (i.barcode && i.barcode.toLowerCase().includes(needle))
    );
  }, [items, needle]);

  const visibleItems = useMemo(() => {
    let list = searched;
    if (filter === 'remaining') list = list.filter(i => statusOf(i) === 'uncounted');
    else if (filter === 'counted') list = list.filter(i => statusOf(i) !== 'uncounted');
    else if (filter === 'variances') list = list.filter(i => statusOf(i) === 'variance');
    return list;
  }, [searched, filter, entryValues]); // eslint-disable-line react-hooks/exhaustive-deps

  const shownItems = visibleItems.slice(0, rowCap);
  const progressPct = items.length === 0 ? 0 : Math.round((countedItems.length / items.length) * 100);

  // ------------------------------------------------------------ scan loop
  const focusItem = (productId: string) => {
    setFocusId(productId);
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setFocusId(null), 2500);
    requestAnimationFrame(() => {
      rowRefs.current.get(productId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = qtyRefs.current.get(productId);
      input?.focus();
      input?.select();
    });
  };

  const handleScanKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter' || isReadOnly) return;
    const code = search.trim();
    if (!code) return;

    const exact = (list: { productId?: string; barcode: string | null; sku: string | null }[]) =>
      list.find(i => i.barcode && i.barcode === code) ||
      list.find(i => i.sku && i.sku.toLowerCase() === code.toLowerCase());

    const match = exact(items);
    if (match) {
      setScanMiss(null);
      setSearch('');
      setFilter('all');
      if (!blind && entryValues[match.productId] === undefined) {
        setCount(match, String(match.expectedQty));
      }
      focusItem(match.productId);
      return;
    }

    // Out of scope — look the product up and add it to the session.
    try {
      const { items: found } = await sc.listCountableProducts({ search: code, limit: 10 });
      const prod = exact(found);
      if (prod && sessionRef.current && sessionRef.current.status === 'in_progress') {
        const qty = blind ? null : prod.currentStock;
        await sc.updateSessionItems(sessionRef.current.id, [{ productId: prod.id, countedQty: qty }]);
        const newItem: sc.CountSessionItem = {
          id: `tmp-${prod.id}`, sessionId: sessionRef.current.id, productId: prod.id,
          productName: prod.name, sku: prod.sku, barcode: prod.barcode,
          categoryName: prod.categoryName, expectedQty: prod.currentStock,
          countedQty: qty, variance: qty === null ? null : 0,
          reasonCode: null, notes: null, addedDuringCount: true,
          countedBy: null, countedAt: new Date().toISOString(),
        };
        setItems(prev => [newItem, ...prev]);
        if (qty !== null) setEntryValues(prev => ({ ...prev, [prod.id]: String(qty) }));
        setScanMiss(null);
        setSearch('');
        setFilter('all');
        focusItem(prod.id);
        return;
      }
    } catch { /* fall through */ }
    setScanMiss(code);
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.currentTarget.blur();
    scanRef.current?.focus();
  };

  // ------------------------------------------------------------- review
  const setReason = (pid: string, code: string) => setReasons(prev => ({ ...prev, [pid]: code }));
  const setNoteDetail = (pid: string, v: string) => setNoteDetails(prev => ({ ...prev, [pid]: v }));

  const noteFor = (pid: string): string => {
    const opt = REASONS.find(r => r.code === reasons[pid]);
    if (!opt) return '';
    const detail = (noteDetails[pid] || '').trim();
    if (opt.code === 'other') return detail ? `Other: ${detail}` : '';
    return detail ? `${opt.label} — ${detail}` : opt.label;
  };

  const missingReasons = varianceItems.filter(i => !noteFor(i.productId)).length;

  const openConfirm = () => {
    // A fully-matching count is still worth submitting — it marks the
    // count complete and records it in history with zero adjustments.
    setError(null);
    setConfirmOpen(true);
  };

  const applyReasonToAll = (code: string) => {
    setReasons(prev => {
      const next = { ...prev };
      varianceItems.forEach(i => { if (!next[i.productId]) next[i.productId] = code; });
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!session || missingReasons > 0) return;
    setBusy(true);
    setError(null);
    try {
      await flushPending();
      // Attach reasons to variance items before the server validates them.
      const reasonUpdates = varianceItems.map(i => ({
        productId: i.productId,
        reasonCode: reasons[i.productId],
        notes: noteFor(i.productId),
      }));
      if (reasonUpdates.length) await sc.updateSessionItems(session.id, reasonUpdates);
      const res = await sc.submitSession(session.id);
      setConfirmOpen(false);
      if (res.status === 'submitted') {
        setResult('Submitted for approval — an approver can post it from the counts list.');
        await closeSession();
      } else {
        setResult(`Posted — ${res.applied?.length ?? 0} adjustment${(res.applied?.length ?? 0) === 1 ? '' : 's'} applied${(res.skipped?.length ?? 0) > 0 ? `, ${res.skipped!.length} skipped` : ''}.`);
        await closeSession();
      }
    } catch (e: any) {
      setError(e.message || 'Failed to submit count.');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const res = await sc.approveSession(session.id);
      setResult(`Approved and posted — ${res.applied?.length ?? 0} adjustment${(res.applied?.length ?? 0) === 1 ? '' : 's'} applied.`);
      await closeSession();
    } catch (e: any) {
      setError(e.message || 'Failed to approve count.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await sc.cancelSession(session.id);
      setCancelOpen(false);
      await closeSession();
    } catch (e: any) {
      setError(e.message || 'Failed to cancel session.');
    } finally {
      setBusy(false);
    }
  };

  // =========================================================================
  // Render
  // =========================================================================
  return (
    <div className="p-4 sm:p-6 space-y-4 min-h-screen">
      <PageHeader
        title="Stock Count"
        subtitle={storeCtx?.store?.name ? `Physical counts · ${storeCtx.store.name}` : 'Physical stock counts'}
        icon={ClipboardList}
      />

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 flex items-center"><AlertCircle size={16} className="mr-2 flex-shrink-0" /> {error}</p>
        </div>
      )}
      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
          <p className="text-sm text-green-800 flex items-center"><CheckCircle2 size={18} className="mr-2 flex-shrink-0" />{result}</p>
        </div>
      )}

      {!session ? (
        <SessionList
          sessions={sessions}
          loading={listLoading || sessionLoading}
          onOpen={openSession}
          onNew={() => setCreateOpen(true)}
          onRefresh={loadSessions}
          canApprove={canApprove}
        />
      ) : sessionLoading ? (
        <div className="px-4 py-10 text-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading count…
        </div>
      ) : (
        <>
          {/* Session header */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <button type="button" onClick={closeSession} className="p-1 -ml-1 rounded text-muted-foreground hover:text-foreground" aria-label="Back to counts">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{session.name}</span>
                    <Badge variant={STATUS_META[session.status].variant}>{STATUS_META[session.status].label}</Badge>
                    {blind && <Badge variant="outline"><EyeOff className="h-3 w-3 mr-1" />Blind</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {session.scopeCategoryName || 'All categories'} · started {fmtDate(session.createdAt)}
                  </p>
                </div>
              </div>
              {!isReadOnly && (
                <Button variant="ghost" size="sm" className="text-muted-foreground shrink-0" onClick={() => setCancelOpen(true)}>
                  <Ban className="h-4 w-4 mr-1" />Cancel
                </Button>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <span>
                <span className="text-2xl font-bold tabular-nums">{countedItems.length}</span>
                <span className="text-muted-foreground"> / {items.length} counted</span>
                {remaining > 0 && <span className="text-muted-foreground"> · {remaining} left</span>}
              </span>
              {!blind && varianceItems.length > 0 && (
                <span className="text-xs">
                  <span className="font-medium text-amber-600">{varianceItems.length} variance{varianceItems.length === 1 ? '' : 's'}</span>
                  {' · net '}<span className={`font-medium ${netDelta > 0 ? 'text-green-600' : netDelta < 0 ? 'text-red-600' : ''}`}>{netDelta > 0 ? `+${netDelta}` : netDelta}</span>
                </span>
              )}
              {blind && <span className="text-xs text-muted-foreground">Expected hidden until review</span>}
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${progressPct === 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {session.status === 'submitted' && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
              <p className="text-sm text-amber-800 flex items-center">
                <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                Submitted {fmtDate(session.submittedAt)} — waiting for approval before posting.
              </p>
              {canApprove && (
                <Button onClick={handleApprove} disabled={busy} className="shrink-0">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="h-4 w-4 mr-1.5" />Approve &amp; post</>}
                </Button>
              )}
            </div>
          )}

          {/* Scope + filter controls — hidden for read-only sessions except search */}
          <div className="rounded-xl border bg-card p-3 space-y-3">
            <div className="relative">
              <ScanBarcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={scanRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleScanKeyDown}
                placeholder={isReadOnly ? 'Search this count…' : 'Scan barcode, or search name / SKU…'}
                className="pl-10 h-11 text-base font-mono"
                autoComplete="off"
                enterKeyHint="go"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Clear search">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {([
                ['all', `All (${items.length})`],
                ['remaining', `Remaining (${remaining})`],
                ['counted', `Counted (${countedItems.length})`],
                ['variances', `Variances (${varianceItems.length})`],
              ] as [SheetFilter, string][]).map(([key, lbl]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    filter === key ? 'bg-foreground text-background border-foreground' : 'bg-background text-muted-foreground border-input hover:bg-muted'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {scanMiss && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
              <p className="text-sm text-amber-800 flex items-center"><SearchX size={16} className="mr-2 flex-shrink-0" /> No countable product found for “{scanMiss}”.</p>
              <button type="button" onClick={() => setScanMiss(null)} className="text-amber-600 hover:text-amber-800" aria-label="Dismiss"><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* Count sheet */}
          <div className="rounded-xl border divide-y overflow-hidden bg-card">
            {visibleItems.length === 0 && (
              <div className="px-4 py-10 text-center text-muted-foreground text-sm space-y-1">
                <PackageSearch className="h-8 w-8 mx-auto mb-2 opacity-40" />
                {filter === 'remaining' ? 'Everything in scope is counted.'
                  : filter === 'counted' ? 'Nothing counted yet — scan or tap through the list.'
                  : filter === 'variances' ? 'No variances — every count matched.'
                  : 'No items in this count.'}
              </div>
            )}
            {shownItems.map(item => {
              const val = entryValues[item.productId] ?? '';
              const delta = deltaFor(item);
              const status = statusOf(item);
              const isFocused = focusId === item.productId;
              return (
                <div
                  key={item.productId}
                  ref={el => { if (el) rowRefs.current.set(item.productId, el); else rowRefs.current.delete(item.productId); }}
                  className={`px-3 sm:px-4 py-3 transition-colors ${isFocused ? 'bg-primary/5 ring-2 ring-inset ring-primary/50' : 'hover:bg-muted/30'} ${status === 'match' ? 'bg-green-50/40' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium leading-snug">{item.productName}</span>
                        {item.categoryName && <Badge variant="secondary" className="font-normal">{item.categoryName}</Badge>}
                        {item.addedDuringCount && <Badge variant="outline" className="font-normal">Out of scope</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.sku ? `SKU ${item.sku}` : 'No SKU'}{item.barcode ? ` · ${item.barcode}` : ''}
                        {' · '}
                        {blind && !isReadOnly ? 'Expected: •••' : <>Expected: <span className="font-medium text-foreground">{item.expectedQty}</span></>}
                        {item.countedAt ? ` · counted ${timeAgo(item.countedAt)}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 pt-0.5">
                      {status === 'uncounted' ? (
                        <span className="text-[11px] text-muted-foreground border border-dashed rounded-full px-2 py-0.5">Uncounted</span>
                      ) : blind && !isReadOnly ? (
                        <Badge variant="success"><Check className="h-3 w-3 mr-0.5" />Counted</Badge>
                      ) : delta === 0 ? (
                        <Badge variant="success"><Check className="h-3 w-3 mr-0.5" />Match</Badge>
                      ) : delta! > 0 ? (
                        <Badge variant="info">+{delta}</Badge>
                      ) : (
                        <Badge variant="destructive">{delta}</Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => step(item, -1)} disabled={isReadOnly} aria-label="Decrease">
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      ref={el => { if (el) qtyRefs.current.set(item.productId, el); else qtyRefs.current.delete(item.productId); }}
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.01"
                      value={val}
                      onChange={e => setCount(item, e.target.value)}
                      onKeyDown={handleQtyKeyDown}
                      onBlur={flushPending}
                      disabled={isReadOnly}
                      className="w-24 text-center h-10 text-base"
                      placeholder={blind ? 'Qty' : String(item.expectedQty)}
                      aria-label={`Counted quantity for ${item.productName}`}
                    />
                    <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => step(item, 1)} disabled={isReadOnly} aria-label="Increase">
                      <Plus className="h-4 w-4" />
                    </Button>
                    {!isReadOnly && !blind && (
                      <Button type="button" variant="ghost" size="sm" className="h-10 px-2 text-xs text-muted-foreground" onClick={() => setCount(item, String(item.expectedQty))} title="Counted — matches expected">
                        <Check className="h-4 w-4 mr-1" />Match
                      </Button>
                    )}
                    {!isReadOnly && (
                      <Button type="button" variant="ghost" size="sm" className="h-10 px-2 text-xs text-muted-foreground" onClick={() => setCount(item, '0')} title="Not found on the shelf — set counted qty to 0">
                        <PackageX className="h-4 w-4 mr-1" />0
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {visibleItems.length > rowCap && (
              <button type="button" onClick={() => setRowCap(c => c + ROW_CAP)} className="w-full px-4 py-3 text-sm text-primary hover:bg-muted/30">
                Show {Math.min(ROW_CAP, visibleItems.length - rowCap)} more of {visibleItems.length - rowCap} remaining…
              </button>
            )}
          </div>

          {/* Sticky action bar */}
          {!isReadOnly && (
            <div className="sticky bottom-0 -mx-4 sm:-mx-6 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="px-4 sm:px-6 py-3 flex items-center gap-2">
                <div className="flex-1 min-w-0 text-sm text-muted-foreground truncate">
                  {varianceItems.length > 0
                    ? <span><span className="font-semibold text-foreground">{varianceItems.length}</span> variance{varianceItems.length === 1 ? '' : 's'}{blind ? '' : <> · net <span className={`font-semibold ${netDelta > 0 ? 'text-green-600' : netDelta < 0 ? 'text-red-600' : ''}`}>{netDelta > 0 ? `+${netDelta}` : netDelta}</span></>}</span>
                    : countedItems.length > 0
                      ? `${countedItems.length} counted — all matched`
                      : 'Scan or enter counted quantities'}
                </div>
                {pending.current.size > 0 && <span className="text-xs text-muted-foreground flex items-center"><Loader2 className="h-3 w-3 animate-spin mr-1" />saving</span>}
                <Button onClick={openConfirm} disabled={busy || countedItems.length === 0}>
                  Review{varianceItems.length > 0 ? ` (${varianceItems.length})` : ''}
                </Button>
              </div>
            </div>
          )}

          {/* Read-only summary for posted/cancelled sessions */}
          {isReadOnly && session.status !== 'submitted' && (
            <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
              {session.status === 'posted'
                ? <>Posted {fmtDate(session.postedAt)} · {session.appliedCount} adjustment{session.appliedCount === 1 ? '' : 's'}{session.skippedCount > 0 ? ` · ${session.skippedCount} skipped` : ''}</>
                : 'This count was cancelled — no adjustments were posted.'}
            </div>
          )}
        </>
      )}

      {/* New session dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>New stock count</DialogTitle>
            <DialogDescription>
              Pick a scope and start counting. The count saves as you go — anyone with inventory access can resume it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder={`Count ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Scope</label>
              <div className="flex gap-2 overflow-x-auto pb-1 mt-1 -mx-1 px-1">
                <button
                  type="button"
                  onClick={() => setNewCategoryId(ALL_CATEGORIES)}
                  className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                    newCategoryId === ALL_CATEGORIES ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input hover:bg-muted'
                  }`}
                >
                  All categories
                </button>
                {categories.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setNewCategoryId(c.id === newCategoryId ? ALL_CATEGORIES : c.id)}
                    className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                      newCategoryId === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input hover:bg-muted'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30">
                <input type="checkbox" checked={newBlind} onChange={e => setNewBlind(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>
                  <span className="text-sm font-medium flex items-center gap-1.5"><EyeOff className="h-4 w-4" />Blind count</span>
                  <span className="text-xs text-muted-foreground">Hide expected stock while counting — counters can't be influenced by the system quantity.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/30">
                <input type="checkbox" checked={newRequiresApproval} onChange={e => setNewRequiresApproval(e.target.checked)} className="mt-0.5 h-4 w-4" />
                <span>
                  <span className="text-sm font-medium flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" />Require approval</span>
                  <span className="text-xs text-muted-foreground">Submitted counts wait for a reviewer (inventory.count_approve) before variances post.</span>
                </span>
              </label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
            <Button onClick={createSession} disabled={creating}>
              {creating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Start counting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review variances dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Review &amp; submit</DialogTitle>
            <DialogDescription>
              {varianceItems.length === 0
                ? `All ${countedItems.length} counted item${countedItems.length === 1 ? '' : 's'} match expected stock — nothing will be adjusted.`
                : `${varianceItems.length} variance${varianceItems.length === 1 ? '' : 's'} will be adjusted — pick a reason for each.`}
              {remaining > 0 ? ` ${remaining} uncounted item${remaining === 1 ? '' : 's'} left unchanged.` : ''}
              {session?.requiresApproval ? ' This count needs approval before it posts.' : ''}
            </DialogDescription>
          </DialogHeader>

          {varianceItems.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
              <span className="font-medium">Set all:</span>
              {REASONS.map(r => (
                <button key={r.code} type="button" onClick={() => applyReasonToAll(r.code)} className="px-2 py-1 rounded-full border border-input hover:bg-muted transition-colors">
                  {r.label}
                </button>
              ))}
            </div>
          )}

          {varianceItems.length > 0 && (
            <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
              {varianceItems.map(item => {
                const delta = deltaFor(item) || 0;
                const code = reasons[item.productId];
                const missing = !noteFor(item.productId);
                return (
                  <div key={item.productId} className="px-3 py-2.5 space-y-2">
                    <div className="flex items-center justify-between text-sm gap-2">
                      <span className="truncate font-medium">{item.productName}</span>
                      <span className="flex items-center gap-2 flex-shrink-0 tabular-nums">
                        <span className="text-muted-foreground">{item.expectedQty} → {entryValues[item.productId]}</span>
                        {delta > 0 ? <Badge variant="info">+{delta}</Badge> : <Badge variant="destructive">{delta}</Badge>}
                      </span>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {REASONS.map(r => (
                        <button
                          key={r.code}
                          type="button"
                          onClick={() => setReason(item.productId, r.code)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                            code === r.code
                              ? 'bg-primary text-primary-foreground border-primary'
                              : missing && !code
                                ? 'border-red-300 text-muted-foreground hover:bg-muted'
                                : 'border-input text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                    {(code === 'other' || noteDetails[item.productId]) && (
                      <Input
                        value={noteDetails[item.productId] || ''}
                        onChange={e => setNoteDetail(item.productId, e.target.value)}
                        placeholder="Add detail (required for Other)…"
                        className={`h-8 text-sm ${code === 'other' && !(noteDetails[item.productId] || '').trim() ? 'border-red-300 focus-visible:ring-red-400' : ''}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={busy}>Back to counting</Button>
            <Button onClick={handleSubmit} disabled={busy || missingReasons > 0}>
              {busy
                ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>)
                : missingReasons > 0
                  ? `${missingReasons} reason${missingReasons === 1 ? '' : 's'} missing`
                  : session?.requiresApproval
                    ? 'Submit for approval'
                    : varianceItems.length > 0
                      ? `Post ${varianceItems.length} adjustment${varianceItems.length === 1 ? '' : 's'}`
                      : 'Submit count'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel session confirm */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-sm p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Cancel this count?</DialogTitle>
            <DialogDescription>
              “{session?.name}” and its {countedItems.length} counted item{countedItems.length === 1 ? '' : 's'} will be discarded. No stock changes have posted yet.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={busy}>Keep counting</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cancel count'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
