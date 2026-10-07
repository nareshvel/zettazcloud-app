/**
 * CycleCountPage
 * Barcode / RFID cycle-count reconciliation for serialized pieces.
 *
 * Workflow:
 *   1. User selects a product (optional) to scope the count.
 *   2. User scans piece barcodes / piece codes one at a time.
 *   3. Page groups pieces into: Scanned ✅ | Missing (expected but not scanned) ❌ | Unexpected (not in DB) ⚠
 *   4. User can export discrepancies, or mark a missing piece lost so its
 *      stock is actually written off with an audit trail — not just listed.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { ScanBarcode, RefreshCcw, Download, AlertTriangle, CheckCircle2, XCircle, PackageX } from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchApi } from '@/services/api';
import { setPieceStatus } from '@/services/productPieceService';

interface Piece {
  id: string;
  piece_code: string;
  barcode: string | null;
  product_name: string;
  status: string;
  purity: string | null;
  selling_price: number | null;
}

interface ScanResult {
  scannedCode: string;
  piece: Piece | null;   // null = unexpected / not found in DB
  timestamp: Date;
}

type ReconcileStatus = 'scanned' | 'missing' | 'unexpected';

export default function CycleCountPage() {
  const [inputValue,  setInputValue]  = useState('');
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [expectedPieces, setExpectedPieces] = useState<Piece[]>([]);
  const [productFilter, setProductFilter] = useState('');
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingLostId, setMarkingLostId] = useState<string | null>(null);
  const [lostIds, setLostIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus scan input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Load product list for the filter dropdown
  useEffect(() => {
    fetchApi<any>('/products?is_serialized=1&limit=200')
      .then(r => setProducts(((r && r.data) ? r.data : (r || [])).map((p: any) => ({ id: p.id, name: p.name }))))
      .catch(() => {});
  }, []);

  // Load expected pieces when product filter changes
  const loadExpected = useCallback(async () => {
    setLoading(true);
    try {
      const url = productFilter
        ? `/product-pieces/product/${productFilter}?status=available`
        : '/product-pieces/all?status=available';
      const res = await fetchApi<any>(url);
      setExpectedPieces((res && res.data) ? res.data : (res || []));
    } catch { setExpectedPieces([]); } finally { setLoading(false); }
  }, [productFilter]);

  useEffect(() => { loadExpected(); }, [loadExpected]);

  // Handle a barcode scan / manual entry
  const handleScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setInputValue('');

    // Lookup piece in DB
    try {
      const res = await fetchApi<any>(`/product-pieces/lookup?barcode=${encodeURIComponent(trimmed)}`);
      const piece = ((res && res.data) ? res.data : res) as Piece;
      setScanResults(prev => [{ scannedCode: trimmed, piece, timestamp: new Date() }, ...prev]);
    } catch {
      // Not found
      setScanResults(prev => [{ scannedCode: trimmed, piece: null, timestamp: new Date() }, ...prev]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleScan(inputValue);
  };

  // Reconcile
  const scannedIds   = new Set(scanResults.filter(r => r.piece).map(r => r.piece!.id));
  const unexpected   = scanResults.filter(r => !r.piece);
  const scanned      = expectedPieces.filter(p => scannedIds.has(p.id));
  const missing      = expectedPieces.filter(p => !scannedIds.has(p.id) && !lostIds.has(p.id));

  const exportCsv = () => {
    const rows = [
      ['Status', 'Piece Code', 'Barcode', 'Product', 'Purity', 'Price'],
      ...scanned.map(p => ['Scanned', p.piece_code, p.barcode || '', p.product_name, p.purity || '', String(p.selling_price || '')]),
      ...missing.map(p => ['Missing', p.piece_code, p.barcode || '', p.product_name, p.purity || '', String(p.selling_price || '')]),
      ...unexpected.map(r => ['Unexpected', r.scannedCode, '', '', '', '']),
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `cycle-count-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  const reset = () => { setScanResults([]); setLostIds(new Set()); inputRef.current?.focus(); };

  // Write off a missing piece: flips its status to 'lost' (excluded from the
  // available count, same as sold/returned/melted) and writes an
  // inventory_logs audit row server-side — this is the actual stock
  // adjustment a cycle-count discrepancy needs, not just a CSV export.
  const markLost = async (piece: Piece) => {
    setMarkingLostId(piece.id);
    try {
      await setPieceStatus(piece.id, 'lost', undefined, 'Marked lost via Cycle Count reconciliation');
      setLostIds(prev => new Set(prev).add(piece.id));
    } catch {
      // Leave it in the missing list; user can retry.
    } finally {
      setMarkingLostId(null);
    }
  };

  const statusBadge = (s: ReconcileStatus) => {
    if (s === 'scanned')    return <Badge className="bg-green-100 text-green-800">Scanned</Badge>;
    if (s === 'missing')    return <Badge className="bg-red-100 text-red-800">Missing</Badge>;
    return <Badge className="bg-yellow-100 text-yellow-700">Unexpected</Badge>;
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 min-h-screen">
      <PageHeader
        title="Cycle Count"
        subtitle="Scan piece barcodes to reconcile your serialized inventory"
        icon={ScanBarcode}
      />

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={productFilter}
          onChange={e => setProductFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm w-full sm:w-64"
        >
          <option value="">All serialized products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <Button variant="outline" size="sm" onClick={loadExpected} disabled={loading}>
          <RefreshCcw className="h-4 w-4 mr-1" /> Refresh expected
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={!scanResults.length && !missing.length}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
        <Button variant="outline" size="sm" onClick={reset}>
          Reset scan
        </Button>
      </div>

      {/* Scan input */}
      <div className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 space-y-2">
        <p className="text-sm font-medium text-primary">Scan barcode or enter piece code</p>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Scan or type barcode, then press Enter…"
          className="w-full rounded-md border border-input bg-white dark:bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">Barcode scanners send Enter automatically. For manual entry press Enter after typing.</p>
      </div>

      {/* Summary counters */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-r-4 border-r-green-500 bg-green-50 p-4 text-center">
          <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-green-700">{scanned.length}</div>
          <div className="text-xs text-green-600">Scanned</div>
        </div>
        <div className="rounded-lg border border-r-4 border-r-red-500 bg-red-50 p-4 text-center">
          <XCircle className="h-6 w-6 text-red-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-red-600">{missing.length}</div>
          <div className="text-xs text-red-500">Missing</div>
        </div>
        <div className="rounded-lg border border-r-4 border-r-yellow-500 bg-yellow-50 p-4 text-center">
          <AlertTriangle className="h-6 w-6 text-yellow-600 mx-auto mb-1" />
          <div className="text-2xl font-bold text-yellow-700">{unexpected.length}</div>
          <div className="text-xs text-yellow-600">Unexpected</div>
        </div>
      </div>

      {/* Scan log */}
      {scanResults.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Scan log</h3>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Code scanned</th>
                  <th className="px-3 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-left font-medium">Purity</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {scanResults.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono text-xs">{r.scannedCode}</td>
                    <td className="px-3 py-2">{r.piece?.product_name ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{r.piece?.purity ?? '—'}</td>
                    <td className="px-3 py-2 text-xs capitalize">{r.piece?.status ?? '—'}</td>
                    <td className="px-3 py-2">{statusBadge(r.piece ? 'scanned' : 'unexpected')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Missing pieces */}
      {missing.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-red-700">Missing pieces ({missing.length})</h3>
          <div className="rounded-lg border border-red-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-red-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Piece code</th>
                  <th className="px-3 py-2 text-left font-medium">Product</th>
                  <th className="px-3 py-2 text-left font-medium">Purity</th>
                  <th className="px-3 py-2 text-left font-medium">Price</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100">
                {missing.map(p => (
                  <tr key={p.id} className="hover:bg-red-50/60">
                    <td className="px-3 py-2 font-mono text-xs">{p.piece_code}</td>
                    <td className="px-3 py-2">{p.product_name}</td>
                    <td className="px-3 py-2 text-xs">{p.purity ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{p.selling_price != null ? Number(p.selling_price).toLocaleString() : '—'}</td>
                    <td className="px-3 py-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-100"
                        disabled={markingLostId === p.id}
                        onClick={() => markLost(p)}
                      >
                        <PackageX className="h-3.5 w-3.5 mr-1" />
                        {markingLostId === p.id ? 'Marking…' : 'Mark Lost'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
