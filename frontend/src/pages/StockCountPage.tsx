/**
 * StockCountPage
 * Bulk stock count / reconciliation for non-serialized (quantity-based)
 * products — available to every business vertical. Sibling of
 * CycleCountPage (jewelry/electronics-only, per serialized piece): here a
 * cashier/stock-taker filters down to a shelf/section (search + category),
 * enters what they physically counted per product with large tap-friendly
 * +/- steppers, and submits the whole sheet as one reconciliation. Only
 * products whose counted quantity differs from system stock produce an
 * adjustment — everything else is silently skipped server-side.
 *
 * Designed for real-time, on-the-floor use (tablet or desktop): a sticky
 * summary/submit bar that never scrolls out of view, a "last counted"
 * indicator per product so stale shelves are obvious, and a confirmation
 * step that requires a per-product reason before anything is committed —
 * a single note glued onto a whole multi-product sheet doesn't tell a store
 * owner reviewing shrinkage why any one item moved.
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ClipboardList, RefreshCcw, CheckCircle2, AlertCircle, Loader2,
  Minus, Plus, ScanBarcode, X, ListFilter, PackageSearch,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { fetchApi } from '@/services/api';
import { getCategories } from '@/services/inventoryService';
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

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never counted';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return 'Never counted';
  const days = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'Counted today';
  if (days === 1) return 'Counted yesterday';
  if (days < 30) return `Counted ${days}d ago`;
  const months = Math.floor(days / 30);
  return `Counted ${months}mo ago`;
}

export default function StockCountPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>(ALL_CATEGORIES);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showChangedOnly, setShowChangedOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const ITEMS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

  const [products, setProducts] = useState<CountableProduct[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<{ applied: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scanRef = useRef<HTMLInputElement>(null);

  // Debounce search so every keystroke doesn't fire a request.
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
      params.set('limit', '200');
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

  // Focus the scan/search box on mount for a scanner-first workflow.
  useEffect(() => { scanRef.current?.focus(); }, []);

  const setCount = (productId: string, value: string) => {
    setCounted(prev => ({ ...prev, [productId]: value }));
  };

  const step = (product: CountableProduct, delta: number) => {
    const current = counted[product.id];
    const base = current !== undefined && current !== '' && !isNaN(Number(current)) ? Number(current) : product.currentStock;
    const next = Math.max(0, base + delta);
    setCount(product.id, String(next));
  };

  const deltaFor = (p: CountableProduct): number | null => {
    const v = counted[p.id];
    if (v === undefined || v === '') return null;
    const n = Number(v);
    if (isNaN(n)) return null;
    return n - p.currentStock;
  };

  const changedProducts = useMemo(
    () => products.filter(p => { const d = deltaFor(p); return d !== null && d !== 0; }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [products, counted]
  );

  const netDelta = useMemo(
    () => changedProducts.reduce((sum, p) => sum + (deltaFor(p) || 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [changedProducts, counted]
  );

  const visibleProducts = showChangedOnly ? changedProducts : products;

  // Reset to page 1 whenever the underlying list changes shape (new search/
  // category results, or toggling "changed only") so we never land on a
  // now-empty trailing page.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, categoryId, showChangedOnly, products.length, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / itemsPerPage));

  useEffect(() => {
    setCurrentPage(p => Math.min(p, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const paginatedProducts = useMemo(
    () => visibleProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [visibleProducts, currentPage, itemsPerPage]
  );

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(clamped);
  };

  // Barcode scan: if the typed/scanned code matches a product's barcode
  // exactly, jump straight to counting it instead of just filtering the list.
  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const code = search.trim();
    if (!code) return;
    const match = products.find(p => p.barcode && p.barcode === code) ||
      products.find(p => p.sku && p.sku.toLowerCase() === code.toLowerCase());
    if (match) {
      setSearch('');
      setDebouncedSearch('');
      // Nudge the counted value into focus range by pre-filling current stock
      // so the stock-taker only needs to confirm or adjust it.
      setCounted(prev => (prev[match.id] !== undefined ? prev : { ...prev, [match.id]: String(match.currentStock) }));
    }
  };

  const setItemNote = (productId: string, value: string) => {
    setItemNotes(prev => ({ ...prev, [productId]: value }));
  };

  const missingNotesCount = changedProducts.filter(p => !(itemNotes[p.id] || '').trim()).length;

  const openConfirm = () => {
    if (changedProducts.length === 0) {
      setError('No counted quantities differ from current stock — nothing to submit.');
      return;
    }
    setError(null);
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    if (missingNotesCount > 0) {
      setError(`Add a note for every changed product before submitting (${missingNotesCount} missing).`);
      return;
    }
    const counts = changedProducts.map(p => ({
      productId: p.id,
      countedQuantity: Number(counted[p.id]),
      notes: (itemNotes[p.id] || '').trim(),
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
      setItemNotes({});
      setConfirmOpen(false);
      await loadProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to submit stock count.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        title="Stock Count"
        subtitle="Count a shelf or section and reconcile it against system stock"
        icon={ClipboardList}
      />
      <div className="space-y-5">

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <PackageSearch className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
            <div className="text-xl font-bold">{loading ? '—' : products.length}</div>
            <div className="text-xs text-muted-foreground">Products loaded</div>
          </div>
          <div className="rounded-lg border bg-blue-50 p-3 text-center">
            <ListFilter className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-blue-700">{Object.keys(counted).filter(k => counted[k] !== '').length}</div>
            <div className="text-xs text-blue-600">Entered</div>
          </div>
          <div className="rounded-lg border bg-amber-50 p-3 text-center">
            <AlertCircle className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <div className="text-xl font-bold text-amber-700">{changedProducts.length}</div>
            <div className="text-xs text-amber-600">Changed</div>
          </div>
          <div className={`rounded-lg border p-3 text-center ${netDelta === 0 ? 'bg-muted/40' : netDelta > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            {netDelta >= 0
              ? <Plus className={`h-5 w-5 mx-auto mb-1 ${netDelta === 0 ? 'text-muted-foreground' : 'text-green-600'}`} />
              : <Minus className="h-5 w-5 text-red-600 mx-auto mb-1" />}
            <div className={`text-xl font-bold ${netDelta === 0 ? '' : netDelta > 0 ? 'text-green-700' : 'text-red-700'}`}>
              {netDelta > 0 ? `+${netDelta}` : netDelta}
            </div>
            <div className="text-xs text-muted-foreground">Net delta</div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-3 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <ScanBarcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={scanRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleScanKeyDown}
                placeholder="Scan barcode, or search by name / SKU…"
                className="pl-10 font-mono"
                autoComplete="off"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={loadProducts} disabled={loading} title="Refresh">
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowChangedOnly(v => !v)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                showChangedOnly ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input hover:bg-muted'
              }`}
            >
              {showChangedOnly ? 'Showing changed only' : 'Show changed only'}
            </button>
            <span className="text-xs text-muted-foreground">Scanning a known barcode pre-fills its current stock for a quick confirm.</span>
          </div>
        </div>

        {!loading && totalCount !== null && (
          <p className="text-xs text-muted-foreground -mt-2">
            Showing {products.length} of {totalCount} product{totalCount === 1 ? '' : 's'}
            {totalCount > products.length ? ' — narrow your search or category to see the rest.' : ''}
          </p>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700 flex items-center"><AlertCircle size={16} className="mr-2 flex-shrink-0" /> {error}</p>
          </div>
        )}
        {result && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700 flex items-center">
              <CheckCircle2 size={16} className="mr-2 flex-shrink-0" />
              Reconciliation applied: {result.applied} product{result.applied === 1 ? '' : 's'} adjusted, {result.skipped} skipped.
            </p>
          </div>
        )}

        {/* Product count list */}
        <div className="rounded-lg border divide-y overflow-hidden">
          {loading && (
            <div className="px-4 py-10 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading products…
            </div>
          )}
          {!loading && visibleProducts.length === 0 && (
            <div className="px-4 py-10 text-center text-muted-foreground text-sm">
              {showChangedOnly ? 'No counted quantities differ yet.' : 'No products found for this filter.'}
            </div>
          )}
          {!loading && paginatedProducts.map(p => {
            const val = counted[p.id] ?? '';
            const delta = deltaFor(p);
            const isLow = p.lowStockThreshold != null && p.currentStock < p.lowStockThreshold;
            return (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{p.name}</span>
                    {p.categoryName && <Badge variant="secondary" className="font-normal">{p.categoryName}</Badge>}
                    {isLow && <Badge variant="warning">Low stock</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.sku ? `SKU ${p.sku}` : 'No SKU'}{p.barcode ? ` · ${p.barcode}` : ''} · System stock: <span className="font-medium text-foreground">{p.currentStock}</span>
                    {' · '}<span className={p.lastCountedAt ? '' : 'text-amber-600'}>{timeAgo(p.lastCountedAt)}</span>
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => step(p, -1)}>
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={val}
                    onChange={e => setCount(p.id, e.target.value)}
                    className="w-20 text-center h-8"
                    placeholder={String(p.currentStock)}
                  />
                  <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => step(p, 1)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="w-16 text-right">
                  {delta === null ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : delta === 0 ? (
                    <Badge variant="secondary">match</Badge>
                  ) : delta > 0 ? (
                    <Badge variant="success">+{delta}</Badge>
                  ) : (
                    <Badge variant="destructive">{delta}</Badge>
                  )}
                </div>
              </div>
            );
          })}

          {/* Pagination Controls — mirrors ReusableTable.tsx's pattern (see
              CustomersPage.tsx) for a consistent pagination UX app-wide. */}
          {!loading && visibleProducts.length > 0 && (
            <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2 border-t bg-background">
              <div className="flex-1 flex justify-start items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Showing {Math.min((currentPage - 1) * itemsPerPage + 1, visibleProducts.length)} - {Math.min(currentPage * itemsPerPage, visibleProducts.length)} of {visibleProducts.length} results
                </span>
                <label className="flex items-center gap-1.5">
                  <span>Show</span>
                  <select
                    value={itemsPerPage}
                    onChange={e => setItemsPerPage(Number(e.target.value))}
                    className="px-2 py-1 border rounded-md text-sm bg-background focus:ring-1 focus:ring-primary focus:border-primary"
                  >
                    {ITEMS_PER_PAGE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <span>per page</span>
                </label>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="First page"
                >
                  <ChevronsLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={20} />
                </button>

                <div className="flex items-center space-x-1">
                  <span className="text-sm text-muted-foreground">Page</span>
                  <input
                    type="number"
                    value={pageInput}
                    onChange={e => setPageInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const n = parseInt(pageInput, 10);
                        if (!isNaN(n)) goToPage(n);
                      }
                    }}
                    onBlur={() => {
                      const n = parseInt(pageInput, 10);
                      if (!isNaN(n)) goToPage(n); else setPageInput(String(currentPage));
                    }}
                    className="w-12 px-2 py-1 border rounded-md text-sm text-center bg-background focus:ring-1 focus:ring-primary focus:border-primary"
                    min="1"
                    max={totalPages}
                  />
                  <span className="text-sm text-muted-foreground">of {totalPages}</span>
                </div>

                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next page"
                >
                  <ChevronRight size={20} />
                </button>
                <button
                  type="button"
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded text-primary hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  aria-label="Last page"
                >
                  <ChevronsRight size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky submit bar — `sticky` (not `fixed`) so it stays within the
          scrollable content column instead of escaping to the full viewport
          and overlapping the sidebar (AppLayout.tsx puts the sidebar as a
          flex sibling, not a fixed-position element, so `fixed left-0`
          would sit on top of it). */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-6 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 text-sm text-muted-foreground">
            {changedProducts.length > 0
              ? <span><span className="font-semibold text-foreground">{changedProducts.length}</span> product{changedProducts.length === 1 ? '' : 's'} changed · net delta <span className={`font-semibold ${netDelta > 0 ? 'text-green-600' : netDelta < 0 ? 'text-red-600' : ''}`}>{netDelta > 0 ? `+${netDelta}` : netDelta}</span></span>
              : 'No changes yet — enter counted quantities above.'}
          </div>
          <Button onClick={openConfirm} disabled={submitting || changedProducts.length === 0}>
            Review &amp; Submit{changedProducts.length > 0 ? ` (${changedProducts.length})` : ''}
          </Button>
        </div>
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm stock count</DialogTitle>
            <DialogDescription>
              {changedProducts.length} product{changedProducts.length === 1 ? '' : 's'} will be adjusted. A note is required for each one — why did the count come out different? This cannot be undone automatically, so review before submitting.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-80 overflow-y-auto border rounded-md divide-y">
            {changedProducts.map(p => {
              const delta = deltaFor(p) || 0;
              const noteVal = itemNotes[p.id] || '';
              const noteMissing = !noteVal.trim();
              return (
                <div key={p.id} className="px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate mr-2 font-medium">{p.name}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-muted-foreground">{p.currentStock} → {counted[p.id]}</span>
                      {delta > 0 ? <Badge variant="success">+{delta}</Badge> : <Badge variant="destructive">{delta}</Badge>}
                    </span>
                  </div>
                  <Input
                    value={noteVal}
                    onChange={e => setItemNote(p.id, e.target.value)}
                    placeholder="Reason for this change (required)…"
                    className={`h-8 text-sm ${noteMissing ? 'border-red-300 focus-visible:ring-red-400' : ''}`}
                  />
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={submitting || missingNotesCount > 0}>
              {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>) : missingNotesCount > 0 ? `Add ${missingNotesCount} more note${missingNotesCount === 1 ? '' : 's'}` : 'Confirm & Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
