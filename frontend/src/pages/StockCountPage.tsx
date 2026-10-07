/**
 * StockCountPage
 * Guided stock-count session for non-serialized (quantity-based) products —
 * available to every business vertical. Sibling of CycleCountPage
 * (jewelry/electronics-only, per serialized piece).
 *
 * Mental model — a floor workflow, not a spreadsheet:
 *   1. SCOPE  — scan a barcode or narrow the sheet by category / search.
 *   2. COUNT  — progress is "counted X of Y in scope". Every row has a
 *      state (uncounted / counted-match / variance), a scanner loop
 *      (scan → jump to row → type qty → Enter → next scan), tap-friendly
 *      steppers, "match" and "out of stock" one-tap actions, and an
 *      optional blind mode that hides expected stock to prevent the
 *      classic confirmation-bias problem in physical counts.
 *   3. REVIEW — only variances need attention. Each gets a reason code
 *      (damage, theft, found stock…) with optional detail instead of a
 *      mandatory essay — required free text is the "paperwork that gets
 *      skipped" anti-pattern from real count-app design.
 *   4. POST   — one transaction; a summary card reports applied/skipped.
 *
 * Counts auto-save to a per-store localStorage draft — a count interrupted
 * by a dead phone, shift change or accidental refresh resumes where it
 * stopped. Serialized products are excluded by the backend — they're
 * counted piece-by-piece via Cycle Count.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ClipboardList, RefreshCcw, CheckCircle2, AlertCircle, Loader2,
  Minus, Plus, ScanBarcode, X, PackageSearch, Check, Eye, EyeOff,
  RotateCcw, SearchX, PackageX,
} from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { fetchApi } from '@/services/api';
import { getCategories } from '@/services/inventoryService';
import { useAuth } from '@/contexts/AuthContext';
import { useOptionalStore } from '@/contexts/StoreContext';
import { Category } from '@/types';

interface CountableProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isShared: boolean;
  currentStock: number;
  lowStockThreshold: number | null;
  lastCountedAt: string | null;
}

const ALL_CATEGORIES = '__all__';
const FETCH_LIMIT = 500; // backend caps at 500; a count scope bigger than that should be narrowed anyway
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

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never counted';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return 'Never counted';
  const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function StockCountPage() {
  const { user } = useAuth();
  const storeCtx = useOptionalStore();

  // --- scope ---------------------------------------------------------------
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>(ALL_CATEGORIES);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<SheetFilter>('all');
  const [hideExpected, setHideExpected] = useState(false); // blind count

  // --- data ----------------------------------------------------------------
  const [products, setProducts] = useState<CountableProduct[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ applied: number; skipped: number } | null>(null);

  // --- count state ----------------------------------------------------------
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [noteDetails, setNoteDetails] = useState<Record<string, string>>({});
  const [scanMiss, setScanMiss] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [draftRestoredAt, setDraftRestoredAt] = useState<Date | null>(null);

  // --- review / submit -------------------------------------------------------
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const scanRef = useRef<HTMLInputElement>(null);
  const qtyRefs = useRef(new Map<string, HTMLInputElement>());
  const rowRefs = useRef(new Map<string, HTMLDivElement>());
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- draft persistence -----------------------------------------------------
  const tenantId = user?.tenantId || localStorage.getItem('tenant_id') || '';
  const storeId = user?.storeId || localStorage.getItem('store_id') || '';
  const draftKey = tenantId && storeId ? `zettaz:stockcount:${tenantId}:${storeId}` : null;
  const draftLoaded = useRef(false);

  // Restore an interrupted count for this store.
  useEffect(() => {
    if (!draftKey || draftLoaded.current) return;
    draftLoaded.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft?.counted && typeof draft.counted === 'object') setCounted(draft.counted);
      if (draft?.reasons && typeof draft.reasons === 'object') setReasons(draft.reasons);
      if (draft?.noteDetails && typeof draft.noteDetails === 'object') setNoteDetails(draft.noteDetails);
      if (draft?.savedAt) setDraftRestoredAt(new Date(draft.savedAt));
    } catch { /* corrupted draft — start clean */ }
  }, [draftKey]);

  // Auto-save (debounced) — never lose a count to a refresh or dead battery.
  useEffect(() => {
    if (!draftKey || !draftLoaded.current) return;
    const t = setTimeout(() => {
      try {
        if (Object.keys(counted).length === 0) {
          localStorage.removeItem(draftKey);
        } else {
          localStorage.setItem(draftKey, JSON.stringify({ counted, reasons, noteDetails, savedAt: new Date().toISOString() }));
        }
      } catch { /* private mode / quota — draft persistence is best-effort */ }
    }, 400);
    return () => clearTimeout(t);
  }, [counted, reasons, noteDetails, draftKey]);

  const clearDraft = useCallback(() => {
    try { if (draftKey) localStorage.removeItem(draftKey); } catch { /* noop */ }
    setDraftRestoredAt(null);
  }, [draftKey]);

  // --- data loading ----------------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    getCategories('active').then(setCategories).catch(() => setCategories([]));
  }, []);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (categoryId !== ALL_CATEGORIES) params.set('category_id', categoryId);
      params.set('limit', String(FETCH_LIMIT));
      // fetchApi already unwraps { status, data } to just the data payload.
      const res = await fetchApi<any>(`/stock-counts/products?${params.toString()}`);
      const payload = (res && res.items) ? res : (res && res.data) ? res.data : res;
      setProducts(Array.isArray(payload) ? payload : (payload?.items || []));
      setTotalCount(Array.isArray(payload) ? null : (payload?.total ?? null));
    } catch (err: any) {
      setError(err.message || 'Failed to load products.');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, categoryId]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  useEffect(() => () => { if (focusTimer.current) clearTimeout(focusTimer.current); }, []);

  // Focus the scan box on mount — scanner-first workflow. (Autofocus no longer
  // hides the bottom nav: useKeyboard only reacts to real viewport shrink.)
  useEffect(() => { scanRef.current?.focus(); }, []);

  // --- count helpers ----------------------------------------------------------
  const setCount = (productId: string, value: string) => {
    setCounted(prev => ({ ...prev, [productId]: value }));
  };

  const step = (product: CountableProduct, delta: number) => {
    const current = counted[product.id];
    const hasEntry = current !== undefined && current !== '' && !isNaN(Number(current));
    // In blind mode an empty input steps from 0 — basing it on currentStock
    // would leak the expected quantity through the entered value.
    const base = hasEntry ? Number(current) : (hideExpected ? 0 : product.currentStock);
    setCount(product.id, String(Math.max(0, base + delta)));
  };

  const deltaFor = (p: CountableProduct): number | null => {
    const v = counted[p.id];
    if (v === undefined || v === '') return null;
    const n = Number(v);
    if (isNaN(n)) return null;
    return n - p.currentStock;
  };

  const statusOf = (p: CountableProduct): RowStatus => {
    const d = deltaFor(p);
    if (d === null) return 'uncounted';
    return d === 0 ? 'match' : 'variance';
  };

  const countedProducts = useMemo(
    () => products.filter(p => statusOf(p) !== 'uncounted'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, counted]
  );
  const changedProducts = useMemo(
    () => products.filter(p => statusOf(p) === 'variance'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, counted]
  );
  const netDelta = useMemo(
    () => changedProducts.reduce((sum, p) => sum + (deltaFor(p) || 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [changedProducts, counted]
  );
  const remaining = products.length - countedProducts.length;

  const visibleProducts = useMemo(() => {
    switch (filter) {
      case 'remaining': return products.filter(p => statusOf(p) === 'uncounted');
      case 'counted': return countedProducts;
      case 'variances': return changedProducts;
      default: return products;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, products, countedProducts, changedProducts]);

  // --- scanner loop ------------------------------------------------------------
  /** Jump the sheet to a product and arm its qty input for immediate typing. */
  const focusProduct = (id: string) => {
    setFocusId(id);
    if (focusTimer.current) clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => setFocusId(null), 2500);
    requestAnimationFrame(() => {
      rowRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = qtyRefs.current.get(id);
      input?.focus();
      input?.select();
    });
  };

  /**
   * Barcode scan: exact barcode/SKU match → jump to the row, select the qty
   * field for instant overwrite, then Enter on that field refocuses the scan
   * box — the classic scan → qty → scan wedge-scanner loop. If the product
   * isn't in the loaded scope, do a targeted lookup and upsert it so a scan
   * never dead-ends just because the sheet is filtered elsewhere.
   */
  const handleScanKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const code = search.trim();
    if (!code) return;

    const exact = (list: CountableProduct[]) =>
      list.find(p => p.barcode && p.barcode === code) ||
      list.find(p => p.sku && p.sku.toLowerCase() === code.toLowerCase());

    let match = exact(products);
    if (!match) {
      try {
        const res = await fetchApi<any>(`/stock-counts/products?search=${encodeURIComponent(code)}&limit=10`);
        const payload = (res && res.items) ? res : (res && res.data) ? res.data : res;
        const items: CountableProduct[] = Array.isArray(payload) ? payload : (payload?.items || []);
        match = exact(items);
        if (match && !products.some(p => p.id === match!.id)) {
          setProducts(prev => [match!, ...prev]);
        }
      } catch { /* fall through to the miss message */ }
    }

    if (!match) {
      setScanMiss(code);
      return;
    }
    setScanMiss(null);
    setSearch('');
    setDebouncedSearch('');
    setFilter('all'); // a match under "Remaining"/"Variances" would be filtered out before we could focus it
    // Pre-fill expected stock for a one-tap confirm — but never in blind mode,
    // where revealing the expected qty defeats the purpose.
    if (!hideExpected) {
      setCounted(prev => (prev[match!.id] !== undefined ? prev : { ...prev, [match!.id]: String(match!.currentStock) }));
    }
    focusProduct(match.id);
  };

  /** Enter on a qty field = "done with this row" → back to the scan box. */
  const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.currentTarget.blur();
    scanRef.current?.focus();
  };

  // --- review & submit -----------------------------------------------------------
  const setReason = (productId: string, code: string) =>
    setReasons(prev => ({ ...prev, [productId]: code }));
  const setNoteDetail = (productId: string, value: string) =>
    setNoteDetails(prev => ({ ...prev, [productId]: value }));

  const noteFor = (productId: string): string => {
    const code = reasons[productId];
    const opt = REASONS.find(r => r.code === code);
    if (!opt) return '';
    const detail = (noteDetails[productId] || '').trim();
    if (opt.code === 'other') return detail ? `Other: ${detail}` : '';
    return detail ? `${opt.label} — ${detail}` : opt.label;
  };

  const missingReasons = changedProducts.filter(p => !noteFor(p.id)).length;

  const openConfirm = () => {
    if (changedProducts.length === 0) {
      setError('No variances — every counted product matches system stock. Nothing to reconcile.');
      return;
    }
    setError(null);
    setConfirmOpen(true);
  };

  const applyReasonToAll = (code: string) => {
    setReasons(prev => {
      const next = { ...prev };
      changedProducts.forEach(p => { if (!next[p.id]) next[p.id] = code; });
      return next;
    });
  };

  const handleSubmit = async () => {
    if (missingReasons > 0) return; // button is disabled; guard anyway
    const counts = changedProducts.map(p => ({
      productId: p.id,
      countedQuantity: Number(counted[p.id]),
      notes: noteFor(p.id),
    }));
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetchApi<any>('/stock-counts/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ counts, reasonCode: 'CYCLE_COUNT' }),
      });
      const data = (res && res.data) ? res.data : res;
      setResult({ applied: (data?.applied || []).length, skipped: (data?.skipped || []).length });
      setCounted({});
      setReasons({});
      setNoteDetails({});
      clearDraft();
      setConfirmOpen(false);
      await loadProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to submit stock count.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetCount = () => {
    setCounted({});
    setReasons({});
    setNoteDetails({});
    clearDraft();
    scanRef.current?.focus();
  };

  const startNewCount = () => {
    resetCount();
    setResult(null);
    setSearch('');
    setDebouncedSearch('');
    setCategoryId(ALL_CATEGORIES);
    setFilter('all');
  };

  const progressPct = products.length === 0 ? 0 : Math.round((countedProducts.length / products.length) * 100);

  return (
    <div className="p-4 sm:p-6 space-y-4 min-h-screen">
      <PageHeader
        title="Stock Count"
        subtitle={storeCtx?.store?.name ? `Physical count · ${storeCtx.store.name}` : 'Count a shelf or section and reconcile against system stock'}
        icon={ClipboardList}
      />

      {/* Progress header — "counted X of Y" is the question on the floor */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-2xl font-bold tabular-nums">{countedProducts.length}</span>
            <span className="text-muted-foreground"> / {loading ? '—' : products.length} counted</span>
            {remaining > 0 && !loading && (
              <span className="text-muted-foreground"> · {remaining} remaining</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setHideExpected(v => !v)}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
              hideExpected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input hover:bg-muted'
            }`}
            title="Blind count — hide expected stock so the count can't be influenced"
          >
            {hideExpected ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            Blind
          </button>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progressPct === 100 ? 'bg-green-500' : 'bg-primary'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {hideExpected
              ? 'Blind count — expected stock and variances hidden until review'
              : changedProducts.length > 0
                ? <span><span className="font-medium text-amber-600">{changedProducts.length} variance{changedProducts.length === 1 ? '' : 's'}</span> · net <span className={`font-medium ${netDelta > 0 ? 'text-green-600' : netDelta < 0 ? 'text-red-600' : ''}`}>{netDelta > 0 ? `+${netDelta}` : netDelta}</span></span>
                : 'No variances yet'}
          </span>
          {draftRestoredAt && (
            <span className="text-muted-foreground">
              Draft restored · {draftRestoredAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Scope controls */}
      <div className="rounded-xl border bg-card p-3 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <ScanBarcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={scanRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleScanKeyDown}
              placeholder="Scan barcode, or search name / SKU…"
              className="pl-10 h-11 text-base font-mono"
              autoComplete="off"
              enterKeyHint="go"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={loadProducts} disabled={loading} title="Refresh list">
            <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Category scope — thumb-friendly horizontal chips */}
        {categories.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <button
              type="button"
              onClick={() => setCategoryId(ALL_CATEGORIES)}
              className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                categoryId === ALL_CATEGORIES ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input hover:bg-muted'
              }`}
            >
              All categories
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id === categoryId ? ALL_CATEGORIES : c.id)}
                className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  categoryId === c.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input hover:bg-muted'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Sheet filter — "Remaining" answers what's left to count */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {([
            ['all', `All (${products.length})`],
            ['remaining', `Remaining (${remaining})`],
            ['counted', `Counted (${countedProducts.length})`],
            ['variances', `Variances (${changedProducts.length})`],
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
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700 flex items-center"><AlertCircle size={16} className="mr-2 flex-shrink-0" /> {error}</p>
        </div>
      )}
      {result && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-start justify-between gap-3">
          <p className="text-sm text-green-800 flex items-center">
            <CheckCircle2 size={18} className="mr-2 flex-shrink-0" />
            Reconciliation applied: {result.applied} product{result.applied === 1 ? '' : 's'} adjusted{result.skipped > 0 ? `, ${result.skipped} skipped` : ''}.
          </p>
          <Button size="sm" variant="outline" onClick={startNewCount}>Start new count</Button>
        </div>
      )}
      {!loading && totalCount !== null && totalCount > products.length && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Showing {products.length} of {totalCount} products — narrow the search or pick a category to scope the rest.
        </p>
      )}

      {/* Count sheet */}
      <div className="rounded-xl border divide-y overflow-hidden bg-card">
        {loading && (
          <div className="px-4 py-10 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading products…
          </div>
        )}
        {!loading && visibleProducts.length === 0 && (
          <div className="px-4 py-10 text-center text-muted-foreground text-sm space-y-1">
            <PackageSearch className="h-8 w-8 mx-auto mb-2 opacity-40" />
            {filter === 'remaining' ? 'Everything in scope is counted.'
              : filter === 'counted' ? 'Nothing counted yet — scan or tap through the list.'
              : filter === 'variances' ? 'No variances — every count matched.'
              : 'No products found for this scope.'}
          </div>
        )}
        {!loading && visibleProducts.map(p => {
          const val = counted[p.id] ?? '';
          const delta = deltaFor(p);
          const status = statusOf(p);
          const isLow = p.lowStockThreshold != null && p.currentStock < p.lowStockThreshold;
          const isFocused = focusId === p.id;
          return (
            <div
              key={p.id}
              ref={el => { if (el) rowRefs.current.set(p.id, el); else rowRefs.current.delete(p.id); }}
              className={`px-3 sm:px-4 py-3 transition-colors ${isFocused ? 'bg-primary/5 ring-2 ring-inset ring-primary/50' : 'hover:bg-muted/30'} ${status === 'match' ? 'bg-green-50/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium leading-snug">{p.name}</span>
                    {p.categoryName && <Badge variant="secondary" className="font-normal">{p.categoryName}</Badge>}
                    {p.isShared && <Badge variant="outline" className="font-normal">Shared</Badge>}
                    {isLow && <Badge variant="warning">Low</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {p.sku ? `SKU ${p.sku}` : 'No SKU'}{p.barcode ? ` · ${p.barcode}` : ''}
                    {' · '}
                    {hideExpected ? 'Expected: •••' : <>Stock: <span className="font-medium text-foreground">{p.currentStock}</span></>}
                    {' · '}<span className={p.lastCountedAt ? '' : 'text-amber-600'}>{p.lastCountedAt ? `Counted ${timeAgo(p.lastCountedAt)}` : 'Never counted'}</span>
                  </p>
                </div>
                <div className="shrink-0 pt-0.5">
                  {status === 'uncounted' ? (
                    <span className="text-[11px] text-muted-foreground border border-dashed rounded-full px-2 py-0.5">Uncounted</span>
                  ) : hideExpected ? (
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
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => step(p, -1)} aria-label="Decrease">
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  ref={el => { if (el) qtyRefs.current.set(p.id, el); else qtyRefs.current.delete(p.id); }}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={val}
                  onChange={e => setCount(p.id, e.target.value)}
                  onKeyDown={handleQtyKeyDown}
                  className="w-24 text-center h-10 text-base"
                  placeholder={hideExpected ? 'Qty' : String(p.currentStock)}
                  aria-label={`Counted quantity for ${p.name}`}
                />
                <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => step(p, 1)} aria-label="Increase">
                  <Plus className="h-4 w-4" />
                </Button>
                {!hideExpected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-10 px-2 text-xs text-muted-foreground"
                    onClick={() => setCount(p.id, String(p.currentStock))}
                    title="Counted — matches system stock"
                  >
                    <Check className="h-4 w-4 mr-1" />Match
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-10 px-2 text-xs text-muted-foreground"
                  onClick={() => setCount(p.id, '0')}
                  title="Not found on the shelf — set counted qty to 0"
                >
                  <PackageX className="h-4 w-4 mr-1" />0
                </Button>
                <span className="ml-auto hidden sm:inline text-[11px] text-muted-foreground">Enter ↩ next scan</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky action bar — stays in the scroll column so it can't overlap
          the sidebar, and sits above the mobile bottom nav naturally. */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-6 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="px-4 sm:px-6 py-3 flex items-center gap-2">
          <div className="flex-1 min-w-0 text-sm text-muted-foreground truncate">
            {changedProducts.length > 0
              ? <span><span className="font-semibold text-foreground">{changedProducts.length}</span> variance{changedProducts.length === 1 ? '' : 's'}{hideExpected ? '' : <> · net <span className={`font-semibold ${netDelta > 0 ? 'text-green-600' : netDelta < 0 ? 'text-red-600' : ''}`}>{netDelta > 0 ? `+${netDelta}` : netDelta}</span></>}</span>
              : countedProducts.length > 0
                ? `${countedProducts.length} counted — all matched`
                : 'Scan or enter counted quantities'}
          </div>
          {Object.keys(counted).length > 0 && (
            <Button variant="ghost" size="sm" onClick={resetCount} title="Clear all entered counts and the saved draft">
              <RotateCcw className="h-4 w-4 mr-1" />Reset
            </Button>
          )}
          <Button onClick={openConfirm} disabled={submitting || changedProducts.length === 0}>
            Review{changedProducts.length > 0 ? ` (${changedProducts.length})` : ''}
          </Button>
        </div>
      </div>

      {/* Variance review — reason codes, not essays */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>Review variances</DialogTitle>
            <DialogDescription>
              {changedProducts.length} product{changedProducts.length === 1 ? '' : 's'} differ from system stock
              {remaining > 0 ? ` — ${remaining} uncounted item${remaining === 1 ? '' : 's'} will be left unchanged` : ''}.
              Pick a reason for each variance before posting.
            </DialogDescription>
          </DialogHeader>

          {changedProducts.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
              <span className="font-medium">Set all:</span>
              {REASONS.map(r => (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => applyReasonToAll(r.code)}
                  className="px-2 py-1 rounded-full border border-input hover:bg-muted transition-colors"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
            {changedProducts.map(p => {
              const delta = deltaFor(p) || 0;
              const code = reasons[p.id];
              const missing = !noteFor(p.id);
              return (
                <div key={p.id} className="px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="truncate font-medium">{p.name}</span>
                    <span className="flex items-center gap-2 flex-shrink-0 tabular-nums">
                      <span className="text-muted-foreground">{p.currentStock} → {counted[p.id]}</span>
                      {delta > 0 ? <Badge variant="info">+{delta}</Badge> : <Badge variant="destructive">{delta}</Badge>}
                    </span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {REASONS.map(r => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => setReason(p.id, r.code)}
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
                  {(code === 'other' || noteDetails[p.id]) && (
                    <Input
                      value={noteDetails[p.id] || ''}
                      onChange={e => setNoteDetail(p.id, e.target.value)}
                      placeholder="Add detail (required for Other)…"
                      className={`h-8 text-sm ${code === 'other' && !(noteDetails[p.id] || '').trim() ? 'border-red-300 focus-visible:ring-red-400' : ''}`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>Back to counting</Button>
            <Button onClick={handleSubmit} disabled={submitting || missingReasons > 0}>
              {submitting
                ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Posting…</>)
                : missingReasons > 0
                  ? `${missingReasons} reason${missingReasons === 1 ? '' : 's'} missing`
                  : `Post ${changedProducts.length} adjustment${changedProducts.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
