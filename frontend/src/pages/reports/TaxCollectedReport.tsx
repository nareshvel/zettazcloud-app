/**
 * Tax Collected Report
 *
 * Derives tax data from the existing sales transactions API.
 * Each completed sale has a taxAmount field - we aggregate it by date and payment method.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Receipt, Download, FileText, RefreshCw, DollarSign, Hash, TrendingUp, Percent } from 'lucide-react';
import { SalesReportTransaction, ReportFilter } from '@/types';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useDateFormatting } from '@/contexts/LocalizationContext';
import { toApiDateString, getNowInTimezone } from '@/utils/timezone';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { getSalesTransactions } from '@/services/reportsService';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/common/PageHeader';
import { exportToCsv, exportToPdf } from '@/utils/reportExport';
import { format, parseISO } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
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

const TaxCollectedReport = () => {
  const { formatCurrency } = useLocaleFormat();
  const { timezone } = useDateFormatting();
  const [sales, setSales] = useState<SalesReportTransaction[]>([]);
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
      const res = await getSalesTransactions(filters);
      setSales(res.status === 'success' && res.data ? res.data : []);
    } catch {
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange, timezone]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived data
  const completedSales = useMemo(() => sales.filter(s => s.status === 'completed'), [sales]);

  const metrics = useMemo(() => {
    const totalTax = completedSales.reduce((s, t) => s + (t.taxAmount || 0), 0);
    const totalRevenue = completedSales.reduce((s, t) => s + (t.totalAmount || 0), 0);
    const effectiveRate = totalRevenue > 0 ? (totalTax / totalRevenue) * 100 : 0;
    return { totalTax, totalRevenue, effectiveRate, txCount: completedSales.length };
  }, [completedSales]);

  // Tax by date
  const dailyTax = useMemo(() => {
    const map = new Map<string, { date: string; tax: number; revenue: number }>();
    completedSales.forEach(t => {
      const d = t.transactionDate?.substring(0, 10) || 'unknown';
      const entry = map.get(d) || { date: d, tax: 0, revenue: 0 };
      entry.tax += t.taxAmount || 0;
      entry.revenue += t.totalAmount || 0;
      map.set(d, entry);
    });
    return Array.from(map.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        date: (() => { try { return format(parseISO(d.date), 'MMM d'); } catch { return d.date; } })(),
        tax: d.tax,
        revenue: d.revenue,
      }));
  }, [completedSales]);

  // Tax by payment method
  const methodTax = useMemo(() => {
    const map = new Map<string, { method: string; tax: number; count: number }>();
    completedSales.forEach(t => {
      const m = t.paymentMethod || 'Other';
      const entry = map.get(m) || { method: m, tax: 0, count: 0 };
      entry.tax += t.taxAmount || 0;
      entry.count += 1;
      map.set(m, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.tax - a.tax);
  }, [completedSales]);

  const handleCSV = () => {
    exportToCsv(completedSales, [
      { header: 'Date', accessor: (r) => r.transactionDate },
      { header: 'Payment', accessor: 'paymentMethod' },
      { header: 'Subtotal', accessor: (r) => r.subtotalAmount ?? 0 },
      { header: 'Tax', accessor: (r) => r.taxAmount ?? 0 },
      { header: 'Total', accessor: (r) => r.totalAmount },
    ], `tax_collected_${toApiDateString(dateRange?.from || new Date(), timezone)}`);
  };

  const handlePDF = async () => {
    await exportToPdf('Tax Collected Report', [
      { header: 'Date', dataKey: 'date' },
      { header: 'Payment', dataKey: 'payment' },
      { header: 'Subtotal', dataKey: 'subtotal' },
      { header: 'Tax', dataKey: 'tax' },
      { header: 'Total', dataKey: 'total' },
    ], completedSales.map(r => ({
      date: r.transactionDate,
      payment: r.paymentMethod,
      subtotal: formatCurrency(r.subtotalAmount ?? 0),
      tax: formatCurrency(r.taxAmount ?? 0),
      total: formatCurrency(r.totalAmount),
    })), `tax_collected_${toApiDateString(dateRange?.from || new Date(), timezone)}`);
  };

  const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`rounded-xl bg-muted/50 animate-pulse ${className}`} />
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Receipt}
        title="Tax Collected"
        subtitle="Tax breakdown by date, payment method, and effective rates."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleCSV} disabled={!completedSales.length}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePDF} disabled={!completedSales.length}>
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
            <KpiCard icon={DollarSign} label="Total Tax" value={formatCurrency(metrics.totalTax)} color="text-emerald-600" bg="bg-emerald-500/10" />
            <KpiCard icon={TrendingUp} label="Total Revenue" value={formatCurrency(metrics.totalRevenue)} color="text-blue-600" bg="bg-blue-500/10" />
            <KpiCard icon={Percent} label="Effective Rate" value={`${metrics.effectiveRate.toFixed(2)}%`} color="text-violet-600" bg="bg-violet-500/10" />
            <KpiCard icon={Hash} label="Transactions" value={String(metrics.txCount)} color="text-amber-600" bg="bg-amber-500/10" />
          </>
        )}
      </div>

      {/* Bar chart - daily tax */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-card-foreground mb-4">Daily Tax Collected</h2>
        <div className="h-64">
          {loading ? <Skeleton className="h-full w-full" /> : dailyTax.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data for the selected period.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTax}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <RechartsTooltip formatter={(v: number) => [formatCurrency(v), 'Tax']} {...CHART_TOOLTIP_PROPS} />
                <Bar dataKey="tax" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Tax by payment method */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-card-foreground">Tax by Payment Method</h2>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : methodTax.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No data.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment Method</TableHead>
                <TableHead className="text-right">Transactions</TableHead>
                <TableHead className="text-right">Tax Collected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {methodTax.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{row.method}</TableCell>
                  <TableCell className="text-right">{row.count}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(row.tax)}</TableCell>
                </TableRow>
              ))}
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
    <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
  </div>
);

export default TaxCollectedReport;
