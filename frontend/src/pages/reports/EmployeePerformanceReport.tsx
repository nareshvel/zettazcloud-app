/**
 * Employee Performance Report
 *
 * Uses the bulk /employees/performance-summary endpoint to fetch all employee
 * performance data in a single query (no N+1).
 * Target matching uses date-range overlap, not exact match.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { UserCheck, Download, FileText, RefreshCw, DollarSign, Users, Target, Award } from 'lucide-react';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useDateFormatting } from '@/contexts/LocalizationContext';
import { toApiDateString, getNowInTimezone } from '@/utils/timezone';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/common/PageHeader';
import { exportToCsv, exportToPdf } from '@/utils/reportExport';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  getPerformanceSummary,
  EmployeePerformanceSummaryRow,
} from '@/services/employeeService';

const CHART_TOOLTIP_PROPS = {
  contentStyle: { borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' },
  wrapperStyle: { zIndex: 20, outline: 'none' },
  allowEscapeViewBox: { x: false, y: false },
  isAnimationActive: false,
} as const;

const EmployeePerformanceReport = () => {
  const { formatCurrency } = useLocaleFormat();
  const { timezone } = useDateFormatting();
  const [rows, setRows] = useState<EmployeePerformanceSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = getNowInTimezone(timezone);
    const monthAgo = new Date(today);
    monthAgo.setDate(today.getDate() - 29);
    return { from: monthAgo, to: today };
  });

  const fetchData = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setLoading(true);
    setError(null);
    try {
      const start = toApiDateString(dateRange.from, timezone);
      const end = toApiDateString(dateRange.to, timezone);
      const data = await getPerformanceSummary(start, end);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Employee performance fetch failed:', err);
      setRows([]);
      setError('Failed to load employee performance data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [dateRange, timezone]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const metrics = useMemo(() => {
    const totalSales = rows.reduce((s, r) => s + (r.achieved || 0), 0);
    const totalIncentives = rows.reduce((s, r) => s + (r.computedIncentive || 0), 0);
    const metTarget = rows.filter(r => r.metTarget === true).length;
    const withSales = rows.filter(r => r.numSales > 0).length;
    return { totalSales, totalIncentives, metTarget, count: rows.length, withSales };
  }, [rows]);

  // Chart data - top 10 by achieved sales
  const chartData = useMemo(() =>
    rows
      .filter(r => r.achieved > 0 || (r.target != null && r.target > 0))
      .slice(0, 10)
      .map(r => ({
        name: `${r.firstName} ${r.lastName || ''}`.trim(),
        achieved: r.achieved || 0,
        target: r.target || 0,
      })),
  [rows]);

  const handleCSV = () => {
    exportToCsv(rows, [
      { header: 'Employee', accessor: (r) => `${r.firstName} ${r.lastName || ''}`.trim() },
      { header: 'Job Title', accessor: (r) => r.jobTitle || '' },
      { header: '# Sales', accessor: (r) => r.numSales || 0 },
      { header: 'Achieved', accessor: (r) => r.achieved || 0 },
      { header: 'Target', accessor: (r) => r.target ?? 'N/A' },
      { header: 'Incentive', accessor: (r) => r.computedIncentive || 0 },
      { header: 'Met Target', accessor: (r) => r.metTarget == null ? '—' : r.metTarget ? 'Yes' : 'No' },
    ], `employee_performance_${toApiDateString(dateRange?.from || new Date(), timezone)}`);
  };

  const handlePDF = async () => {
    await exportToPdf('Employee Performance Report', [
      { header: 'Employee', dataKey: 'name' },
      { header: '# Sales', dataKey: 'sales' },
      { header: 'Achieved', dataKey: 'achieved' },
      { header: 'Target', dataKey: 'target' },
      { header: 'Incentive', dataKey: 'incentive' },
    ], rows.map(r => ({
      name: `${r.firstName} ${r.lastName || ''}`.trim(),
      sales: String(r.numSales || 0),
      achieved: formatCurrency(r.achieved || 0),
      target: r.target != null ? formatCurrency(r.target) : 'N/A',
      incentive: formatCurrency(r.computedIncentive || 0),
    })), `employee_performance_${toApiDateString(dateRange?.from || new Date(), timezone)}`);
  };

  const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`rounded-xl bg-muted/50 animate-pulse ${className}`} />
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={UserCheck}
        title="Employee Performance"
        subtitle="Sales targets, achievements, and incentive tracking by employee."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleCSV} disabled={!rows.length}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePDF} disabled={!rows.length}>
              <FileText className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <DateRangePicker initialDateRange={dateRange} onDateChange={setDateRange} />
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : (
          <>
            <KpiCard icon={Users} label="Active Employees" value={String(metrics.count)} color="text-blue-600" bg="bg-blue-500/10" />
            <KpiCard icon={DollarSign} label="Total Sales" value={formatCurrency(metrics.totalSales)} color="text-emerald-600" bg="bg-emerald-500/10" />
            <KpiCard icon={Target} label="Met Target" value={`${metrics.metTarget} of ${metrics.count}`} color="text-violet-600" bg="bg-violet-500/10" />
            <KpiCard icon={Award} label="Total Incentives" value={formatCurrency(metrics.totalIncentives)} color="text-amber-600" bg="bg-amber-500/10" />
          </>
        )}
      </div>

      {/* Chart - Achieved vs Target */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-base font-semibold text-card-foreground mb-4">Top Performers — Achieved vs Target</h2>
        <div className="h-72">
          {loading ? <Skeleton className="h-full w-full" /> : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              {rows.length === 0 ? 'No employees found.' : 'No sales recorded in this period.'}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 10, right: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={60} />
                <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                <RechartsTooltip formatter={(v: number, name: string) => [formatCurrency(v), name === 'achieved' ? 'Achieved' : 'Target']} {...CHART_TOOLTIP_PROPS} />
                <Bar dataKey="achieved" name="Achieved" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} maxBarSize={30} />
                <Bar dataKey="target" name="Target" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} maxBarSize={30} opacity={0.5} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-card-foreground">Performance Details</h2>
          {!loading && rows.length > 0 && (
            <span className="text-sm text-muted-foreground">{metrics.withSales} of {metrics.count} with sales</span>
          )}
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : rows.length === 0 ? (
          <div className="py-14 text-center text-sm text-muted-foreground">No employee performance data available.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Job Title</TableHead>
                <TableHead className="text-right"># Sales</TableHead>
                <TableHead className="text-right">Achieved</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Incentive</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.employeeId}>
                  <TableCell className="font-medium">{`${r.firstName} ${r.lastName || ''}`.trim()}</TableCell>
                  <TableCell>{r.jobTitle || '—'}</TableCell>
                  <TableCell className="text-right">{r.numSales}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.achieved)}</TableCell>
                  <TableCell className="text-right">{r.target != null ? formatCurrency(r.target) : '—'}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.computedIncentive)}</TableCell>
                  <TableCell>
                    {r.metTarget == null ? (
                      <Badge variant="secondary">No target</Badge>
                    ) : r.metTarget ? (
                      <Badge variant="success">Met</Badge>
                    ) : (
                      <Badge variant="warning">Below</Badge>
                    )}
                  </TableCell>
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

export default EmployeePerformanceReport;
