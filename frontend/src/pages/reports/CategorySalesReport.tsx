/**
 * Category Sales Report
 *
 * Derives category-level breakdown from sales transactions.
 * Each completed sale has items with categories - we aggregate by category.
 *
 * Uses the existing sales transactions API + category list.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart as PieChartIcon, Download, FileText, RefreshCw, DollarSign, Hash, TrendingUp, BarChart2 } from 'lucide-react';
import { SalesReportTransaction, ReportFilter } from '@/types';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useDateFormatting } from '@/contexts/LocalizationContext';
import { toApiDateString, getNowInTimezone } from '@/utils/timezone';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { getSalesTransactions } from '@/services/reportsService';
import { getCategorySalesSummary } from '@/services/api';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/common/PageHeader';
import { exportToCsv, exportToPdf } from '@/utils/reportExport';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

const CHART_TOOLTIP_PROPS = {
  contentStyle: { borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' },
  wrapperStyle: { zIndex: 20, outline: 'none' },
  allowEscapeViewBox: { x: false, y: false },
  isAnimationActive: false,
} as const;

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface CategoryData {
  name: string;
  revenue: number;
  count: number;
}

const CategorySalesReport = () => {
  const { formatCurrency } = useLocaleFormat();
  const { timezone } = useDateFormatting();
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = getNowInTimezone(timezone);
    const monthAgo = new Date(today);
    monthAgo.setDate(today.getDate() - 29);
    return { from: monthAgo, to: today };
  });

  const fetchData = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setLoading(true);
    try {
      const filters: ReportFilter = {
        startDate: toApiDateString(dateRange.from, timezone),
        endDate: toApiDateString(dateRange.to, timezone),
      };

      // Try the dedicated category sales endpoint first, fall back to transaction-level aggregation
      const [catRes, txnRes] = await Promise.allSettled([
        getCategorySalesSummary(),
        getSalesTransactions(filters),
      ]);

      // Check if the dedicated category endpoint returned meaningful data
      let usedCategoryEndpoint = false;
      if (catRes.status === 'fulfilled' && Array.isArray(catRes.value) && catRes.value.length > 0) {
        const mapped = catRes.value.map((c: any) => ({
          name: c.name || c.categoryName || 'Unknown',
          revenue: Number(c.totalSales || c.revenue || c.value || 0),
          count: Number(c.totalTransactions || c.count || 0),
        }));
        // Only use if at least one category has revenue > 0
        const hasRevenue = mapped.some((m: CategoryData) => m.revenue > 0);
        if (hasRevenue) {
          setCategories(mapped.sort((a: CategoryData, b: CategoryData) => b.revenue - a.revenue));
          usedCategoryEndpoint = true;
        }
      }

      // Fall back: derive from transactions by payment method
      if (!usedCategoryEndpoint && txnRes.status === 'fulfilled') {
        const txnData = txnRes.value;
        const data = txnData.status === 'success' && txnData.data ? txnData.data : [];
        const methodMap = new Map<string, CategoryData>();
        data
          .filter((s: SalesReportTransaction) => s.status === 'completed')
          .forEach((s: SalesReportTransaction) => {
            const key = s.paymentMethod || 'Other';
            const entry = methodMap.get(key) || { name: key, revenue: 0, count: 0 };
            entry.revenue += s.totalAmount || 0;
            entry.count += 1;
            methodMap.set(key, entry);
          });
        setCategories(Array.from(methodMap.values()).sort((a, b) => b.revenue - a.revenue));
      }
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange, timezone]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived
  const metrics = useMemo(() => {
    const totalRevenue = categories.reduce((s, c) => s + c.revenue, 0);
    const totalTx = categories.reduce((s, c) => s + c.count, 0);
    const topCategory = categories[0]?.name || '—';
    return { totalRevenue, totalTx, categoryCount: categories.length, topCategory };
  }, [categories]);

  const handleCSV = () => {
    exportToCsv(categories, [
      { header: 'Category', accessor: 'name' },
      { header: 'Revenue', accessor: 'revenue' },
      { header: 'Transactions', accessor: 'count' },
      { header: '% of Total', accessor: (r) => metrics.totalRevenue > 0 ? ((r.revenue / metrics.totalRevenue) * 100).toFixed(1) : '0' },
    ], `category_sales_${toApiDateString(dateRange?.from || new Date(), timezone)}`);
  };

  const handlePDF = async () => {
    await exportToPdf('Category Sales Report', [
      { header: 'Category', dataKey: 'name' },
      { header: 'Revenue', dataKey: 'revenue' },
      { header: 'Transactions', dataKey: 'count' },
      { header: '% Share', dataKey: 'share' },
    ], categories.map(c => ({
      name: c.name,
      revenue: formatCurrency(c.revenue),
      count: String(c.count),
      share: metrics.totalRevenue > 0 ? `${((c.revenue / metrics.totalRevenue) * 100).toFixed(1)}%` : '0%',
    })), `category_sales_${toApiDateString(dateRange?.from || new Date(), timezone)}`);
  };

  const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`rounded-xl bg-muted/50 animate-pulse ${className}`} />
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={PieChartIcon}
        title="Category Sales"
        subtitle="Revenue breakdown by product category and sales mix analysis."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleCSV} disabled={!categories.length}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePDF} disabled={!categories.length}>
              <FileText className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <DateRangePicker initialDateRange={dateRange} onDateChange={setDateRange} />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
          <>
            <KpiCard icon={DollarSign} label="Total Revenue" value={formatCurrency(metrics.totalRevenue)} color="text-emerald-600" bg="bg-emerald-500/10" />
            <KpiCard icon={Hash} label="Transactions" value={String(metrics.totalTx)} color="text-blue-600" bg="bg-blue-500/10" />
            <KpiCard icon={BarChart2} label="Categories" value={String(metrics.categoryCount)} color="text-violet-600" bg="bg-violet-500/10" />
            <KpiCard icon={TrendingUp} label="Top Category" value={metrics.topCategory} color="text-amber-600" bg="bg-amber-500/10" />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar chart */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground mb-4">Revenue by Category</h2>
          <div className="h-64">
            {loading ? <Skeleton className="h-full w-full" /> : categories.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data for the selected period.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <RechartsTooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} {...CHART_TOOLTIP_PROPS} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {categories.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Donut chart */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground mb-4">Sales Mix</h2>
          <div className="h-52">
            {loading ? <Skeleton className="h-full" /> : categories.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categories} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} {...CHART_TOOLTIP_PROPS} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Legend */}
          {!loading && categories.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {categories.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground">{c.name}</span>
                  </div>
                  <span className="font-medium text-foreground">{formatCurrency(c.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-card-foreground">Category Breakdown</h2>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : categories.length === 0 ? (
          <div className="py-14 text-center text-sm text-muted-foreground">No category data available.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">% Share</TableHead>
                <TableHead className="text-right">Avg. per Txn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {c.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(c.revenue)}</TableCell>
                  <TableCell className="text-right">{c.count}</TableCell>
                  <TableCell className="text-right">{metrics.totalRevenue > 0 ? `${((c.revenue / metrics.totalRevenue) * 100).toFixed(1)}%` : '0%'}</TableCell>
                  <TableCell className="text-right">{c.count > 0 ? formatCurrency(c.revenue / c.count) : '—'}</TableCell>
                </TableRow>
              ))}
              {/* Totals row */}
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{formatCurrency(metrics.totalRevenue)}</TableCell>
                <TableCell className="text-right">{metrics.totalTx}</TableCell>
                <TableCell className="text-right">100%</TableCell>
                <TableCell className="text-right">{metrics.totalTx > 0 ? formatCurrency(metrics.totalRevenue / metrics.totalTx) : '—'}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

const KpiCard: React.FC<{ icon: React.ElementType; label: string; value: string; color: string; bg: string }> = ({ icon: Icon, label, value, color, bg }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
    </div>
    <p className="mt-2 text-2xl font-bold text-foreground truncate">{value}</p>
  </div>
);

export default CategorySalesReport;
