import { useState, useEffect, useCallback, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { format, subDays } from 'date-fns';
import { DateRangePicker } from '../../components/reports/DateRangePicker';
import { getInventoryReportItems, getInventorySummaryMetrics } from '../../services/reportsService';
import { InventoryReportItem, InventorySummaryMetrics } from '../../types';
import { getTenantFieldOverrides, type TenantFieldOverride } from '../../services/industryService';
import toast from 'react-hot-toast';
import {
  RefreshCw, Download, FileText, Package, DollarSign,
  AlertTriangle, AlertCircle, Archive, BarChart3, Search,
  ArrowUpDown,
} from 'lucide-react';
import PageHeader from '@/components/common/PageHeader';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { exportToCsv, exportToPdf } from '@/utils/reportExport';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, PieChart, Pie, ResponsiveContainer,
} from 'recharts';

const CHART_TOOLTIP_PROPS = {
  contentStyle: { borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' },
  wrapperStyle: { zIndex: 20, outline: 'none' },
  allowEscapeViewBox: { x: false, y: false },
  isAnimationActive: false,
} as const;

const STOCK_COLORS = { healthy: 'hsl(var(--chart-2))', low: 'hsl(var(--chart-4))', out: 'hsl(var(--chart-1))' };

const InventoryReportPage: React.FC = () => {
  const { formatCurrency } = useLocaleFormat();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30), to: new Date(),
  });
  const [items, setItems] = useState<InventoryReportItem[]>([]);
  const [metrics, setMetrics] = useState<InventorySummaryMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('stockValue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const [industryFields, setIndustryFields] = useState<TenantFieldOverride[]>([]);

  // ---- Fetch ----
  const fetchData = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setLoading(true);
    try {
      const startDate = format(dateRange.from, 'yyyy-MM-dd');
      const endDate = format(dateRange.to, 'yyyy-MM-dd');

      const [itemsRes, metricsRes] = await Promise.all([
        getInventoryReportItems({ startDate, endDate }),
        getInventorySummaryMetrics({ startDate, endDate }),
      ]);

      setItems(itemsRes.status === 'success' && itemsRes.data ? itemsRes.data : []);
      setMetrics(metricsRes.status === 'success' && metricsRes.data ? metricsRes.data : null);
    } catch {
      toast.error('Failed to load inventory data.');
      setItems([]);
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    getTenantFieldOverrides('product')
      .then(f => setIndustryFields(f.filter(x => x.isEnabled !== false)))
      .catch(() => {});
  }, []);

  // ---- Derived data ----
  const categories = useMemo(() => {
    const s = new Set<string>();
    items.forEach(i => { if (i.categoryName) s.add(i.categoryName); });
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let list = [...items];
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(i =>
        i.productName.toLowerCase().includes(q) ||
        (i.sku && i.sku.toLowerCase().includes(q)) ||
        (i.categoryName && i.categoryName.toLowerCase().includes(q)),
      );
    }
    if (categoryFilter !== 'all') list = list.filter(i => i.categoryName === categoryFilter);
    list.sort((a, b) => {
      const av = a[sortBy as keyof InventoryReportItem] as any;
      const bv = b[sortBy as keyof InventoryReportItem] as any;
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      return sortDir === 'asc' ? String(av || '').localeCompare(String(bv || '')) : String(bv || '').localeCompare(String(av || ''));
    });
    return list;
  }, [items, searchTerm, categoryFilter, sortBy, sortDir]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page]);

  // Charts
  const stockStatusData = useMemo(() => {
    if (!metrics) return [];
    const healthy = metrics.totalUniqueItems - metrics.lowStockItemsCount - metrics.outOfStockItemsCount;
    return [
      { name: 'Healthy', value: Math.max(healthy, 0), color: STOCK_COLORS.healthy },
      { name: 'Low Stock', value: metrics.lowStockItemsCount, color: STOCK_COLORS.low },
      { name: 'Out of Stock', value: metrics.outOfStockItemsCount, color: STOCK_COLORS.out },
    ];
  }, [metrics]);

  const categoryChartData = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach(i => {
      const cat = i.categoryName || 'Uncategorized';
      map.set(cat, (map.get(cat) || 0) + i.stockValue);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [items]);

  const topProducts = useMemo(() =>
    [...items].sort((a, b) => b.stockValue - a.stockValue).slice(0, 10),
  [items]);

  // ---- Sorting helper ----
  const toggleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('desc'); }
  };
  const SortIcon = ({ col }: { col: string }) => sortBy === col
    ? <span className="ml-1 text-xs">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
    : <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />;

  // ---- Export ----
  const handleCSV = () => {
    exportToCsv(filtered, [
      { header: 'Product', accessor: 'productName' },
      { header: 'SKU', accessor: (r) => r.sku || '' },
      { header: 'Category', accessor: (r) => r.categoryName || '' },
      { header: 'Stock', accessor: 'currentStock' },
      { header: 'Cost Price', accessor: (r) => r.costPrice ?? 0 },
      { header: 'Stock Value', accessor: 'stockValue' },
    ], `inventory_report_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const handlePDF = async () => {
    await exportToPdf('Inventory Report', [
      { header: 'Product', dataKey: 'name' },
      { header: 'SKU', dataKey: 'sku' },
      { header: 'Category', dataKey: 'cat' },
      { header: 'Stock', dataKey: 'stock' },
      { header: 'Value', dataKey: 'value' },
    ], filtered.map(r => ({
      name: r.productName,
      sku: r.sku || '—',
      cat: r.categoryName || '—',
      stock: String(r.currentStock),
      value: formatCurrency(r.stockValue),
    })), `inventory_report_${format(new Date(), 'yyyy-MM-dd')}`);
  };

  const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`rounded-xl bg-muted/50 animate-pulse ${className}`} />
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={BarChart3}
        title="Inventory Report"
        subtitle="Stock levels, valuation, and product performance."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleCSV} disabled={!items.length}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePDF} disabled={!items.length}>
              <FileText className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        }
      />

      {/* Date picker */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <DateRangePicker initialDateRange={dateRange} onDateChange={setDateRange} />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {loading ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />) : metrics && (
          <>
            <KpiCard icon={Package} label="Unique Items" value={String(metrics.totalUniqueItems)} color="text-blue-600" bg="bg-blue-500/10" />
            <KpiCard icon={Archive} label="Total in Stock" value={String(metrics.totalItemsInStock)} color="text-emerald-600" bg="bg-emerald-500/10" />
            <KpiCard icon={DollarSign} label="Stock Value" value={formatCurrency(metrics.totalStockValue)} color="text-violet-600" bg="bg-violet-500/10" />
            <KpiCard icon={AlertTriangle} label="Low Stock" value={String(metrics.lowStockItemsCount)} color="text-amber-600" bg="bg-amber-500/10" />
            <KpiCard icon={AlertCircle} label="Out of Stock" value={String(metrics.outOfStockItemsCount)} color="text-rose-600" bg="bg-rose-500/10" />
          </>
        )}
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* ---- Overview tab ---- */}
        <TabsContent value="overview" className="space-y-5 mt-4">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Skeleton className="h-72" /> <Skeleton className="h-72" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Stock status pie */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h2 className="text-base font-semibold text-card-foreground mb-4">Stock Status</h2>
                  <div className="h-56">
                    {stockStatusData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={stockStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                            {stockStatusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                          <RechartsTooltip formatter={(v: number, name: string) => [`${v} products`, name]} {...CHART_TOOLTIP_PROPS} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data.</div>
                    )}
                  </div>
                </div>

                {/* Category bar chart */}
                <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <h2 className="text-base font-semibold text-card-foreground mb-4">Top Categories by Value</h2>
                  <div className="h-56">
                    {categoryChartData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                          <XAxis type="number" tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                          <RechartsTooltip formatter={(v: number) => [formatCurrency(v), 'Value']} {...CHART_TOOLTIP_PROPS} />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="hsl(var(--primary))" maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Top products table */}
              {topProducts.length > 0 && (
                <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-border">
                    <h2 className="text-base font-semibold text-card-foreground">Top Products by Value</h2>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topProducts.map(p => (
                        <TableRow key={p.productId}>
                          <TableCell className="font-medium">{p.productName}</TableCell>
                          <TableCell>{p.categoryName || '—'}</TableCell>
                          <TableCell className="text-right">{p.currentStock}</TableCell>
                          <TableCell className="text-right">{formatCurrency(p.stockValue)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ---- Details tab ---- */}
        <TabsContent value="details" className="space-y-4 mt-4">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text" placeholder="Search products..."
                value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
                className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-14 text-center text-sm text-muted-foreground">No inventory data available.</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('productName')}>Product <SortIcon col="productName" /></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('sku')}>SKU <SortIcon col="sku" /></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('categoryName')}>Category <SortIcon col="categoryName" /></TableHead>
                      <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('currentStock')}>Stock <SortIcon col="currentStock" /></TableHead>
                      <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('costPrice')}>Cost <SortIcon col="costPrice" /></TableHead>
                      <TableHead className="cursor-pointer select-none text-right" onClick={() => toggleSort('stockValue')}>Value <SortIcon col="stockValue" /></TableHead>
                      {industryFields.length > 0 && <TableHead>Attributes</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map(item => {
                      const attrs: Record<string, any> = (() => {
                        try { const r = (item as any).attributes; if (!r) return {}; return typeof r === 'string' ? JSON.parse(r) : r; } catch { return {}; }
                      })();
                      const parts = industryFields
                        .filter(f => attrs[f.fieldKey] != null && attrs[f.fieldKey] !== '')
                        .map(f => `${f.label ?? f.fieldKey}: ${attrs[f.fieldKey]}`);
                      return (
                        <TableRow key={item.productId}>
                          <TableCell className="font-medium">{item.productName}</TableCell>
                          <TableCell>{item.sku || '—'}</TableCell>
                          <TableCell>{item.categoryName || '—'}</TableCell>
                          <TableCell className="text-right">{item.currentStock}</TableCell>
                          <TableCell className="text-right">{item.costPrice != null ? formatCurrency(item.costPrice) : '—'}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(item.stockValue)}</TableCell>
                          {industryFields.length > 0 && (
                            <TableCell className="text-xs text-muted-foreground">{parts.length ? parts.join(' \u00b7 ') : '—'}</TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-border px-5 py-3">
                    <span className="text-sm text-muted-foreground">
                      {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                      <span className="px-2 text-sm text-muted-foreground">{page} / {totalPages}</span>
                      <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ---- Sub-component ----
const KpiCard: React.FC<{ icon: React.ElementType; label: string; value: string; color: string; bg: string }> = ({ icon: Icon, label, value, color, bg }) => (
  <div className="rounded-xl border border-border border-r-4 border-r-primary/50 bg-card p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
    </div>
    <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
  </div>
);

export default InventoryReportPage;
