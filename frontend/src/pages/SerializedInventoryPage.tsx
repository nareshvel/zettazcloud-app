import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  listAllPieces, getPiece, createPiece, bulkCreatePieces, updatePiece, setPieceStatus,
  ProductPiece, PieceStatus,
} from '@/services/productPieceService';
import { printPieceLabel, printBulkLabels } from '@/services/labelService';
import { getProducts } from '@/services/productService';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useStore } from '@/contexts/StoreContext';
import { Product } from '@/types';
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/common/StatusBadge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import {
  Boxes, Plus, Loader2, Tag, ScanBarcode, Search, X, ChevronRight,
  Layers, Edit2, AlertTriangle, CheckCircle2, Package, Printer,
  RefreshCw, Filter, Barcode, Weight, DollarSign, Hash,
} from 'lucide-react';

/* ─── constants ──────────────────────────────────────────────────────────── */
// Includes 'lost'/'damaged' (added 2026-09-03 alongside Cycle Count's "Mark
// Lost" action — database/migrations/2026-09-03_product_pieces_lost_damaged_status.sql).
// Every status the DB accepts MUST have an entry here: STATUS_META[p.status]
// is dereferenced unconditionally below (M.bg/M.color/M.label), so a status
// missing from this map crashes the row instead of just rendering oddly —
// this page previously didn't know about 'lost'/'damaged' at all, so any
// piece marked lost via Cycle Count would break this table on load.
const STATUSES: PieceStatus[] = ['available', 'hold', 'sold', 'returned', 'melted', 'lost', 'damaged'];

const STATUS_META: Record<PieceStatus, { color: string; bg: string; label: string }> = {
  available: { color: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-950/40',  label: 'Available' },
  hold:      { color: 'text-amber-600',  bg: 'bg-amber-100 dark:bg-amber-950/40',  label: 'On Hold' },
  sold:      { color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-950/40',    label: 'Sold' },
  returned:  { color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-950/40',label: 'Returned' },
  melted:    { color: 'text-gray-400',   bg: 'bg-gray-100 dark:bg-gray-800',       label: 'Melted' },
  lost:      { color: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-950/40',      label: 'Lost' },
  damaged:   { color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-950/40',label: 'Damaged' },
};

const inputCls = 'w-full px-3.5 py-2.5 border border-border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary bg-background text-foreground placeholder:text-muted-foreground transition-colors text-sm';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5';

/* ══════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════════════════ */
const SerializedInventoryPage: React.FC = () => {
  const { formatCurrency, formatDate, formatWeight } = useLocaleFormat();
  const { toast } = useToast();
  const fmtC = (n: number | null | undefined) => n != null ? formatCurrency(n) : '—';

  const [products, setProducts]       = useState<Product[]>([]);
  const [pieces, setPieces]           = useState<ProductPiece[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadError, setLoadError]     = useState<string | null>(null);

  /* filters */
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState<PieceStatus | ''>('');
  const [productFilter, setProductFilter] = useState('');

  /* UI state */
  const [showAdd, setShowAdd]         = useState(false);
  const [detail, setDetail]           = useState<ProductPiece | null>(null);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [bulkPrinting, setBulkPrinting] = useState(false);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  /* load pieces */
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await listAllPieces({
        status:    statusFilter || undefined,
        productId: productFilter || undefined,
        q:         search.trim() || undefined,
        limit:     300,
      });
      setPieces(rows || []);
    } catch (e: any) {
      setLoadError(e?.message ?? 'Failed to load pieces');
      setPieces([]);
    } finally { setLoading(false); }
  }, [statusFilter, productFilter, search]);

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => load(), search ? 350 : 0);
    return () => clearTimeout(searchTimeout.current);
  }, [load, search]);

  useEffect(() => {
    getProducts().then(p => setProducts(p || [])).catch(() => {});
  }, []);

  /* KPIs */
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    pieces.forEach(p => { c[p.status] = (c[p.status] || 0) + 1; });
    return c;
  }, [pieces]);

  const totalAvailableValue = useMemo(() =>
    pieces.filter(p => p.status === 'available').reduce((s, p) => s + (Number(p.sellingPrice) || 0), 0),
    [pieces]
  );

  /* selection */
  const toggleSelect = (id: string) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const toggleAll = () => {
    if (selected.size === pieces.length) { setSelected(new Set()); }
    else { setSelected(new Set(pieces.map(p => p.id))); }
  };
  const clearSelected = () => setSelected(new Set());

  /* actions */
  const openDetail = async (p: ProductPiece) => {
    try { setDetail(await getPiece(p.id)); } catch { setDetail(p); }
  };

  const changeStatus = async (piece: ProductPiece, status: PieceStatus) => {
    if (status === 'melted' && !confirm(`Mark piece ${piece.pieceCode} as melted? This cannot be undone.`)) return;
    try {
      await setPieceStatus(piece.id, status);
      toast({ title: `Status updated to ${status}` });
      load();
      if (detail?.id === piece.id) setDetail(prev => prev ? { ...prev, status } : null);
    } catch (e: any) {
      toast({ title: 'Failed to update status', description: e?.message, variant: 'destructive' });
    }
  };

  const handlePrintOne = async (pieceId: string) => {
    try {
      await printPieceLabel(pieceId);
      toast({ title: 'Label sent to printer' });
    } catch (e: any) {
      toast({ title: 'Print failed', description: e?.message, variant: 'destructive' });
    }
  };

  const handleBulkPrint = async () => {
    if (!selected.size) return;
    setBulkPrinting(true);
    try {
      await printBulkLabels(Array.from(selected));
      toast({ title: `${selected.size} labels sent to printer` });
    } catch (e: any) {
      toast({ title: 'Bulk print failed', description: e?.message, variant: 'destructive' });
    } finally { setBulkPrinting(false); }
  };

  const selectedProduct = products.find(p => p.id === productFilter);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        icon={Boxes}
        title="Serialized Inventory"
        subtitle="Track unique pieces (tag/barcode) for jewelry and one-of-a-kind items."
        actions={
          <div className="flex gap-2 flex-wrap">
            <Link to="/cycle-count">
              <Button variant="outline" size="sm"><ScanBarcode className="h-4 w-4 mr-1" /> Cycle Count</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Pieces
            </Button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {STATUSES.map(s => {
          const M = STATUS_META[s];
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
              className={`rounded-xl border p-3.5 text-left transition-all ${statusFilter === s ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border bg-card hover:border-primary/40'}`}>
              <p className="text-2xl font-bold text-foreground leading-none">{counts[s] ?? 0}</p>
              <p className={`text-xs font-medium mt-1 ${M.color}`}>{M.label}</p>
            </button>
          );
        })}
      </div>

      {/* Available value banner */}
      {totalAvailableValue > 0 && (
        <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-green-600 dark:text-green-400 font-medium">Available Inventory Value</p>
            <p className="text-xl font-bold text-foreground mt-0.5">{fmtC(totalAvailableValue)}</p>
          </div>
          <Package className="h-8 w-8 text-green-300 dark:text-green-700" />
        </div>
      )}

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-9 py-2.5 border border-border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
            placeholder="Search piece code, barcode, product, purity…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          className="border border-border rounded-lg px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 sm:w-56"
          value={productFilter}
          onChange={e => setProductFilter(e.target.value)}>
          <option value="">All products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
        </select>
        {(search || statusFilter || productFilter) && (
          <Button variant="outline" size="sm" className="shrink-0"
            onClick={() => { setSearch(''); setStatusFilter(''); setProductFilter(''); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">{selected.size} selected</span>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleBulkPrint} disabled={bulkPrinting}>
            {bulkPrinting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
            Print Labels
          </Button>
          <button onClick={clearSelected} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {loadError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-sm text-destructive flex-1">{loadError}</span>
          <Button variant="outline" size="sm" onClick={load}>Retry</Button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-8">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading pieces…
        </div>
      ) : pieces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <Boxes className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {search || statusFilter || productFilter ? 'No pieces match this filter.' : 'No pieces yet. Use "Add Pieces" to get started.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 w-8">
                  <input type="checkbox" className="rounded"
                    checked={selected.size === pieces.length && pieces.length > 0}
                    onChange={toggleAll} />
                </th>
                {['Piece / Tag', 'Product', 'Purity', 'Gross', 'Net', 'Selling Price', 'Cost Code', 'Status', '', ''].map(h => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${h === 'Selling Price' ? 'text-right' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pieces.map(p => {
                const M = STATUS_META[p.status];
                const isSelected = selected.has(p.id);
                return (
                  <tr key={p.id}
                    className={`group transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded" checked={isSelected}
                        onChange={() => toggleSelect(p.id)} onClick={e => e.stopPropagation()} />
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => openDetail(p)}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded font-semibold">{p.pieceCode}</span>
                        {p.barcode && <span className="text-xs text-muted-foreground font-mono">{p.barcode}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => openDetail(p)}>
                      <div className="font-medium text-foreground text-xs leading-tight">
                        {p.productName ?? '—'}
                        {p.productSku && <span className="block text-muted-foreground font-normal">{p.productSku}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.purity || '—'}</td>
                    <td className="px-4 py-3 text-xs text-right text-muted-foreground">{formatWeight(p.grossWeight)}</td>
                    <td className="px-4 py-3 text-xs text-right text-muted-foreground">{formatWeight(p.netWeight)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {p.sellingPrice != null ? fmtC(p.sellingPrice) : <span className="text-muted-foreground/50">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.costCode || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${M.bg} ${M.color}`}>
                        {M.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select value="" onChange={e => e.target.value && changeStatus(p, e.target.value as PieceStatus)}
                        onClick={e => e.stopPropagation()}
                        className="border border-border rounded-md px-2 py-1 text-xs bg-background text-muted-foreground focus:outline-none">
                        <option value="">Change…</option>
                        {STATUSES.filter(s => s !== p.status).map(s => (
                          <option key={s} value={s} className="capitalize">{STATUS_META[s].label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button title="Print label" onClick={e => { e.stopPropagation(); handlePrintOne(p.id); }}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary">
                          <Tag className="h-3.5 w-3.5" />
                        </button>
                        <button title="Edit piece" onClick={e => { e.stopPropagation(); openDetail(p); }}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            {pieces.length} piece{pieces.length !== 1 ? 's' : ''} shown
            {pieces.length === 300 && ' (showing first 300 — refine your search to see more)'}
          </div>
        </div>
      )}

      {/* Modals / drawer */}
      {showAdd && (
        <AddPiecesModal
          products={products}
          defaultProductId={productFilter}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); load(); }}
        />
      )}
      {detail && (
        <PieceDrawer
          piece={detail}
          onClose={() => setDetail(null)}
          onSaved={() => { load(); setDetail(null); }}
          onStatusChange={changeStatus}
          onPrint={handlePrintOne}
        />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   PIECE DETAIL / EDIT DRAWER
══════════════════════════════════════════════════════════════════════════════ */
const PieceDrawer: React.FC<{
  piece: ProductPiece;
  onClose: () => void;
  onSaved: () => void;
  onStatusChange: (p: ProductPiece, s: PieceStatus) => void;
  onPrint: (id: string) => void;
}> = ({ piece, onClose, onSaved, onStatusChange, onPrint }) => {
  const { formatCurrency, formatDate, formatWeight, weightUnitLabel } = useLocaleFormat();
  const fmtC = (n: number | null | undefined) => n != null ? formatCurrency(n) : '—';
  const fmtD = (d: any) => { if (!d) return '—'; const s = typeof d === 'string' ? d.slice(0, 10) : null; return s ? formatDate(s) : '—'; };

  const [editing, setEditing] = useState(false);
  const [f, setF]   = useState({
    barcode:       piece.barcode       ?? '',
    grossWeight:   piece.grossWeight   != null ? String(piece.grossWeight)   : '',
    netWeight:     piece.netWeight     != null ? String(piece.netWeight)     : '',
    purity:        piece.purity        ?? '',
    purchasePrice: piece.purchasePrice != null ? String(piece.purchasePrice) : '',
    costPrice:     piece.costPrice     != null ? String(piece.costPrice)     : '',
    sellingPrice:  piece.sellingPrice  != null ? String(piece.sellingPrice)  : '',
    notes:         piece.notes         ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const numOrNull = (v: string) => v === '' ? null : Number(v);

  const save = async () => {
    setSaving(true);
    try {
      await updatePiece(piece.id, {
        barcode:       f.barcode       || null,
        grossWeight:   numOrNull(f.grossWeight),
        netWeight:     numOrNull(f.netWeight),
        purity:        f.purity        || null,
        purchasePrice: numOrNull(f.purchasePrice),
        costPrice:     numOrNull(f.costPrice),
        sellingPrice:  numOrNull(f.sellingPrice),
        notes:         f.notes         || null,
      });
      setEditing(false);
      onSaved();
    } finally { setSaving(false); }
  };

  const M = STATUS_META[piece.status];

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-sm bg-card border-l border-border shadow-2xl flex flex-col h-full">

        {/* Header */}
        <div className="px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm font-bold text-foreground">{piece.pieceCode}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${M.bg} ${M.color}`}>{M.label}</span>
              </div>
              <p className="text-sm font-medium text-foreground">{piece.productName}</p>
              {piece.productSku && <p className="text-xs text-muted-foreground">{piece.productSku}</p>}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setEditing(e => !e)}
                className={`p-1.5 rounded-md transition-colors ${editing ? 'bg-primary text-white' : 'text-muted-foreground hover:text-primary hover:bg-muted'}`}>
                <Edit2 className="h-4 w-4" />
              </button>
              <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Info grid */}
          {!editing ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Barcode',   value: piece.barcode     || '—', icon: Barcode },
                  { label: 'Purity',    value: piece.purity      || '—', icon: Hash },
                  { label: `Gross Wt (${weightUnitLabel})`,  value: formatWeight(piece.grossWeight), icon: Weight },
                  { label: `Net Wt (${weightUnitLabel})`,    value: formatWeight(piece.netWeight),   icon: Weight },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-muted/40 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="h-3 w-3" />{label}</p>
                    <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Purchase</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{fmtC(piece.purchasePrice)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Cost</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{fmtC(piece.costPrice)}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/20 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Selling</p>
                  <p className="text-sm font-bold text-green-600 dark:text-green-400 mt-0.5">{fmtC(piece.sellingPrice)}</p>
                </div>
              </div>

              {piece.costCode && (
                <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-muted-foreground mb-1">Cost Code (cipher)</p>
                  <p className="font-mono text-base font-bold text-foreground tracking-widest">{piece.costCode}</p>
                </div>
              )}

              {piece.notes && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  <span className="font-semibold">Note: </span>{piece.notes}
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-0.5">
                {piece.createdAt && <p>Added: {fmtD(piece.createdAt)}</p>}
                {piece.grnId    && <p>GRN: <span className="font-mono">{piece.grnId}</span></p>}
              </div>
            </>
          ) : (
            /* Edit form */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Barcode</label>
                  <input className={inputCls} value={f.barcode} onChange={e => set('barcode', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Purity</label>
                  <input className={inputCls} value={f.purity} placeholder="e.g. 22K" onChange={e => set('purity', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Gross Weight (g)</label>
                  <input className={inputCls} type="number" step="0.001" value={f.grossWeight} onChange={e => set('grossWeight', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Net Weight (g)</label>
                  <input className={inputCls} type="number" step="0.001" value={f.netWeight} onChange={e => set('netWeight', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Purchase Price</label>
                  <input className={inputCls} type="number" value={f.purchasePrice} onChange={e => set('purchasePrice', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Cost Price</label>
                  <input className={inputCls} type="number" value={f.costPrice} onChange={e => set('costPrice', e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Selling Price</label>
                <input className={`${inputCls} text-base font-semibold`} type="number" value={f.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} />
              </div>
            </div>
          )}

          {/* Status change */}
          {!editing && (
            <div className="border border-border rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Change Status</p>
              <div className="flex flex-wrap gap-2">
                {STATUSES.filter(s => s !== piece.status).map(s => {
                  const SM = STATUS_META[s];
                  return (
                    <button key={s}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${SM.bg} ${SM.color} border-current/20 hover:opacity-80`}
                      onClick={() => onStatusChange(piece, s)}>
                      {SM.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border bg-muted/20 shrink-0 space-y-2">
          {editing ? (
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
              <Button className="flex-1" onClick={save} disabled={saving}>
                {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving…</> : 'Save Changes'}
              </Button>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-1.5" onClick={() => onPrint(piece.id)}>
              <Printer className="h-3.5 w-3.5" /> Print Label
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════════════════
   ADD PIECES MODAL
══════════════════════════════════════════════════════════════════════════════ */
const AddPiecesModal: React.FC<{
  products: Product[];
  defaultProductId: string;
  onClose: () => void;
  onSaved: () => void;
}> = ({ products, defaultProductId, onClose, onSaved }) => {
  const { formatCurrency } = useLocaleFormat();
  const fmtC = (n: number | null | undefined) => n != null ? formatCurrency(n) : '—';

  const [mode, setMode]   = useState<'single' | 'bulk'>('single');
  const [productId, setPid] = useState(defaultProductId || products[0]?.id || '');
  const [f, setF]         = useState({
    pieceCode: '', barcode: '', grossWeight: '', netWeight: '',
    purity: '', purchasePrice: '', costPrice: '', sellingPrice: '',
    notes: '', count: '5',
  });
  const [saving, setSaving]         = useState(false);
  const [lastCreated, setLastCreated] = useState<{ pieceCode: string; costCode?: string }[] | null>(null);

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const n   = (v: string) => v === '' ? null : Number(v);

  const save = async () => {
    if (!productId) return;
    setSaving(true);
    try {
      const common = {
        productId,
        grossWeight:   n(f.grossWeight),
        netWeight:     n(f.netWeight),
        purity:        f.purity        || null,
        purchasePrice: n(f.purchasePrice),
        costPrice:     n(f.costPrice),
        sellingPrice:  n(f.sellingPrice),
        notes:         f.notes || null,
      };
      if (mode === 'single') {
        const r = await createPiece({ ...common, pieceCode: f.pieceCode || undefined, barcode: f.barcode || null });
        setLastCreated([{ pieceCode: r.pieceCode, costCode: r.costCode }]);
      } else {
        const r = await bulkCreatePieces({ ...common, count: Math.max(1, Math.min(500, Number(f.count) || 1)) });
        setLastCreated(r.created.map(c => ({ pieceCode: c.pieceCode, costCode: c.costCode })));
      }
    } finally { setSaving(false); }
  };

  if (lastCreated) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-green-100 dark:bg-green-950/40 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">
                  {lastCreated.length === 1 ? 'Piece created' : `${lastCreated.length} pieces created`}
                </h2>
                <p className="text-xs text-muted-foreground">Codes assigned below</p>
              </div>
            </div>
            <button onClick={onSaved} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>
          <div className="p-6 space-y-2 max-h-72 overflow-y-auto">
            {lastCreated.map((c, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="font-mono text-sm font-semibold text-foreground">{c.pieceCode}</span>
                {c.costCode && <span className="font-mono text-sm text-muted-foreground tracking-widest">{c.costCode}</span>}
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-border flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setLastCreated(null)}>Add More</Button>
            <Button className="flex-1" onClick={onSaved}>Done</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center"><Layers className="h-5 w-5 text-primary" /></div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Add Pieces</h2>
              <p className="text-xs text-muted-foreground">Create serialized inventory pieces</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Product select */}
          <div>
            <label className={labelCls}>Product *</label>
            <select className={inputCls} value={productId} onChange={e => setPid(e.target.value)}>
              <option value="">— choose product —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
            </select>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            {(['single', 'bulk'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`px-4 py-2 text-sm rounded-lg font-medium transition-all capitalize ${mode === m ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {m === 'bulk' ? 'Bulk (auto codes)' : 'Single piece'}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mode === 'single' && (
              <>
                <div>
                  <label className={labelCls}>Piece / Tag Code</label>
                  <input className={inputCls} value={f.pieceCode} onChange={e => set('pieceCode', e.target.value)} placeholder="auto if blank" />
                </div>
                <div>
                  <label className={labelCls}>Barcode</label>
                  <input className={inputCls} value={f.barcode} onChange={e => set('barcode', e.target.value)} />
                </div>
              </>
            )}
            {mode === 'bulk' && (
              <div className="sm:col-span-2">
                <label className={labelCls}>Number of Pieces</label>
                <input className={inputCls} type="number" min={1} max={500}
                  value={f.count} onChange={e => set('count', e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">All pieces get sequential auto codes. Max 500 at once.</p>
              </div>
            )}

            <div>
              <label className={labelCls}>Purity</label>
              <input className={inputCls} value={f.purity} onChange={e => set('purity', e.target.value)} placeholder="e.g. 22K, 916" />
            </div>
            <div>
              <label className={labelCls}>Gross Weight (g)</label>
              <input className={inputCls} type="number" step="0.001" value={f.grossWeight} onChange={e => set('grossWeight', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Net Weight (g)</label>
              <input className={inputCls} type="number" step="0.001" value={f.netWeight} onChange={e => set('netWeight', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Purchase Price</label>
              <input className={inputCls} type="number" value={f.purchasePrice} onChange={e => set('purchasePrice', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Cost Price</label>
              <input className={inputCls} type="number" value={f.costPrice} onChange={e => set('costPrice', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Selling Price</label>
              <input className={inputCls} type="number" value={f.sellingPrice} onChange={e => set('sellingPrice', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notes</label>
              <input className={inputCls} value={f.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Cost code is auto-generated per piece using the cipher configured in Settings → Cost Code.
          </p>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-border bg-muted/20 shrink-0 rounded-b-2xl">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} disabled={saving || !productId}>
            {saving
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Creating…</>
              : mode === 'bulk' ? `Create ${f.count || '?'} Pieces` : 'Create Piece'
            }
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SerializedInventoryPage;
