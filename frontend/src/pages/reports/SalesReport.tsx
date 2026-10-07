import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart2, Download, RefreshCw, FileText, TrendingUp, ShoppingCart, ArrowDownRight, Hash } from 'lucide-react';
import { SalesReportTransaction, SalesChartDataPoint, ReportFilter } from '@/types';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import toast from 'react-hot-toast';
import { DateRangePicker } from '../../components/reports/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { getSalesTransactions, getSalesChartData } from '../../services/reportsService';
import ReusableTable, { ColumnDefinition } from '../../components/ReusableTable';
import { useDateFormatting } from '@/contexts/LocalizationContext';
import { toApiDateString, getNowInTimezone } from '@/utils/timezone';
import PageHeader from '@/components/common/PageHeader';
import { exportToCsv, exportToPdf } from '@/utils/reportExport';
import { format, parseISO } from 'date-fns';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Shared tooltip style (mirrors Dashboard)
const CHART_TOOLTIP_PROPS = {
  contentStyle: { borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' },
  wrapperStyle: { zIndex: 20, outline: 'none' },
  allowEscapeViewBox: { x: false, y: false },
  isAnimationActive: false,
} as const;

const SalesReport = () => {
  const { formatCurrency, formatDate: fmtDate } = useLocaleFormat();
  const { timezone } = useDateFormatting();

  const [sales, setSales] = useState<SalesReportTransaction[]>([]);
  const [chartData, setChartData] = useState<SalesChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [currentDateRange, setCurrentDateRange] = useState<DateRange | undefined>(() => {
    const today = getNowInTimezone(timezone);
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    return { from: weekAgo, to: today };
  });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // ---- Data fetching ----
  const fetchReportData = useCallback(async () => {
    if (!currentDateRange?.from || !currentDateRange?.to) return;
    setIsLoading(true);
    try {
      const filters: ReportFilter = {
        startDate: toApiDateString(currentDateRange.from, timezone),
        endDate: toApiDateString(currentDateRange.to, timezone),
      };

      const [txnRes, chartRes] = await Promise.all([
        getSalesTransactions(filters),
        getSalesChartData(filters),
      ]);

      setSales(txnRes.status === 'success' && txnRes.data ? txnRes.data : []);
      setChartData(chartRes.status === 'success' && chartRes.data ? chartRes.data : []);
    } catch {
      toast.error('Failed to load sales data.');
      setSales([]);
      setChartData([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentDateRange, timezone]);

  useEffect(() => { fetchReportData(); }, [fetchReportData]);

  // ---- Derived metrics ----
  const metrics = useMemo(() => {
    const totalRevenue = sales.reduce((s, t) => s + (t.totalAmount || 0), 0);
    const totalTx = sales.length;
    const avgSale = totalTx > 0 ? totalRevenue / totalTx : 0;
    const totalRefunds = sales.filter(t => t.status === 'refunded').reduce((s, t) => s + (t.totalAmount || 0), 0);
    return { totalRevenue, totalTx, avgSale, totalRefunds };
  }, [sales]);

  // Payment method breakdown for donut chart
  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    sales.forEach(t => {
      const method = t.paymentMethod || 'Other';
      map.set(method, (map.get(method) || 0) + t.totalAmount);
    });
    const colors = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];
    return Array.from(map.entries()).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [sales]);

  // ---- Pagination ----
  const totalPages = Math.ceil(sales.length / itemsPerPage);

  // ---- Table columns ----
  const columns: ColumnDefinition<SalesReportTransaction>[] = [
    {
      accessor: 'transactionDate', Header: 'Date',
      Cell: (d) => fmtDate(d.transactionDate),
    },
    {
      accessor: 'totalItems', Header: 'Items',
      Cell: (d) => `${d.totalItems}`,
    },
    {
      accessor: 'paymentMethod', Header: 'Payment',
    },
    {
      accessor: 'status', Header: 'Status',
      Cell: (d) => {
        const s = d.status?.toLowerCase();
        type BadgeVariant = 'success' | 'info' | 'warning' | 'destructive';
        const variant: BadgeVariant = s === 'completed' ? 'success' : s === 'refunded' ? 'info' : s === 'pending' ? 'warning' : 'destructive';
        return <Badge variant={variant}>{d.status.charAt(0).toUpperCase() + d.status.slice(1)}</Badge>;
      },
    },
    {
      accessor: 'totalAmount', Header: 'Total',
      Cell: (d) => formatCurrency(d.totalAmount),
      headerClassName: 'text-right', className: 'text-right font-medium',
    },
  ];

  // ---- Export ----
  const handleExportCSV = () => {
    exportToCsv(sales, [
      { header: 'Date', accessor: (r) => r.transactionDate },
      { header: 'Items', accessor: 'totalItems' },
      { header: 'Payment Method', accessor: 'paymentMethod' },
      { header: 'Status', accessor: 'status' },
      { header: 'Subtotal', accessor: (r) => r.subtotalAmount ?? 0 },
      { header: 'Tax', accessor: (r) => r.taxAmount ?? 0 },
      { header: 'Total', accessor: (r) => r.totalAmount },
    ], `sales_report_${toApiDateString(currentDateRange?.from || new Date(), timezone)}`);
  };

  const handleExportPDF = async () => {
    await exportToPdf(
      'Sales Report',
      [
        { header: 'Date', dataKey: 'date' },
        { header: 'Items', dataKey: 'items' },
        { header: 'Payment', dataKey: 'payment' },
        { header: 'Status', dataKey: 'status' },
        { header: 'Total', dataKey: 'total' },
      ],
      sales.map(r => ({
        date: r.transactionDate,
        items: String(r.totalItems),
        payment: r.paymentMethod,
        status: r.status,
        total: formatCurrency(r.totalAmount),
      })),
      `sales_report_${toApiDateString(currentDateRange?.from || new Date(), timezone)}`,
    );
  };

  // ---- Chart data ----
  const areaData = useMemo(() =>
    chartData.map(d => ({
      date: (() => { try { return format(parseISO(d.date), 'MMM d'); } catch { return d.date; } })(),
      revenue: d.totalSales || 0,
      transactions: d.transactions || 0,
    })),
  [chartData]);

  // ---- Loading skeleton ----
  const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`rounded-xl bg-muted/50 animate-pulse ${className}`} />
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      {/* Header */}
      <PageHeader
        icon={BarChart2}
        title="Sales Report"
        subtitle="Revenue trends, transactions, and payment analysis."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchReportData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={!sales.length}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={!sales.length}>
              <FileText className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        }
      />

      {/* Date picker */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <DateRangePicker initialDateRange={currentDateRange} onDateChange={setCurrentDateRange} />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <KpiCard icon={TrendingUp} label="Total Revenue" value={formatCurrency(metrics.totalRevenue)} color="text-emerald-600" bg="bg-emerald-500/10" />
            <KpiCard icon={Hash} label="Transactions" value={String(metrics.totalTx)} color="text-blue-600" bg="bg-blue-500/10" />
            <KpiCard icon={ShoppingCart} label="Avg. Sale" value={formatCurrency(metrics.avgSale)} color="text-violet-600" bg="bg-violet-500/10" />
            <KpiCard icon={ArrowDownRight} label="Refunds" value={formatCurrency(metrics.totalRefunds)} color="text-rose-600" bg="bg-rose-500/10" />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Revenue area chart */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-semibold text-card-foreground">Revenue Trend</h2>
          </div>
          <div className="h-72">
            {isLoading ? <Skeleton className="h-full w-full" /> : areaData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data for the selected period.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <RechartsTooltip formatter={(v: number) => [formatCurrency(v), 'Revenue']} {...CHART_TOOLTIP_PROPS} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#salesGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Payment method donut */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground mb-4">Payment Methods</h2>
          <div className="h-52">
            {isLoading ? <Skeleton className="h-full w-full" /> : paymentBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {paymentBreakdown.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: number) => [formatCurrency(v), 'Amount']} {...CHART_TOOLTIP_PROPS} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Legend */}
          {!isLoading && paymentBreakdown.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {paymentBreakdown.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                    <span className="text-muted-foreground">{p.name}</span>
                  </div>
                  <span className="font-medium text-foreground">{formatCurrency(p.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Transaction table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-card-foreground">Transactions</h2>
          <span className="text-sm text-muted-foreground">{sales.length} record{sales.length !== 1 ? 's' : ''}</span>
        </div>
        {isLoading ? (
          <div className="p-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : (
          <ReusableTable
            columns={columns}
            data={sales}
            noDataMessage="No transactions for the selected period."
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={sales.length}
          />
        )}
      </div>
    </div>
  );
};

// ---- KPI card sub-component ----
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

export default SalesReport;
