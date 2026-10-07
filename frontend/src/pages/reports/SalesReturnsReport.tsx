/**
 * Sales Returns Report
 *
 * Uses the existing salesReturnService to show returns data.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { RotateCcw, Download, FileText, RefreshCw, DollarSign, Hash, Clock, XCircle } from 'lucide-react';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/common/PageHeader';
import { exportToCsv, exportToPdf } from '@/utils/reportExport';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  salesReturnService,
  SalesReturn,
  SalesReturnStats,
  SalesReturnFilters,
} from '@/services/salesReturnService';

const CHART_TOOLTIP_PROPS = {
  contentStyle: { borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' },
  wrapperStyle: { zIndex: 20, outline: 'none' },
  allowEscapeViewBox: { x: false, y: false },
  isAnimationActive: false,
} as const;

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

const SalesReturnsReport = () => {
  const { formatCurrency } = useLocaleFormat();
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [stats, setStats] = useState<SalesReturnStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [period, setPeriod] = useState(30);
  const [statusFilter, setStatusFilter] = useState('');
  const pageSize = 15;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const filters: SalesReturnFilters = {
        page,
        limit: pageSize,
        ...(statusFilter ? { status: statusFilter } : {}),
      };
      const [returnsRes, statsRes] = await Promise.all([
        salesReturnService.getAllReturns(filters),
        salesReturnService.getReturnStats(period),
      ]);
      setReturns(returnsRes.data);
      setTotalPages(returnsRes.pagination.pages || 1);
      setStats(statsRes);
    } catch {
      setReturns([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [page, period, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived
  const statusDonut = useMemo(() => {
    if (!stats) return [];
    return [
      { name: 'Completed', value: stats.completedReturns, color: COLORS[0] },
      { name: 'Pending', value: stats.pendingReturns, color: COLORS[1] },
      { name: 'Cancelled', value: stats.cancelledReturns, color: COLORS[2] },
    ].filter(d => d.value > 0);
  }, [stats]);

  const reasonBreakdown = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    returns.forEach(r => {
      const reason = r.returnReason || 'Not specified';
      const entry = map.get(reason) || { count: 0, amount: 0 };
      entry.count += 1;
      entry.amount += Number(r.totalReturnAmount || 0);
      map.set(reason, entry);
    });
    return Array.from(map.entries())
      .map(([reason, d]) => ({ reason, ...d }))
      .sort((a, b) => b.amount - a.amount);
  }, [returns]);

  const handleCSV = () => {
    exportToCsv(returns, [
      { header: 'Return #', accessor: (r) => r.returnNumber || '' },
      { header: 'Date', accessor: (r) => r.createdAt || '' },
      { header: 'Customer', accessor: (r) => r.customerName || '' },
      { header: 'Reason', accessor: (r) => r.returnReason || '' },
      { header: 'Amount', accessor: (r) => Number(r.totalReturnAmount || 0) },
      { header: 'Status', accessor: (r) => r.status },
    ], 'sales_returns_report');
  };

  const handlePDF = async () => {
    await exportToPdf('Sales Returns Report', [
      { header: 'Return #', dataKey: 'num' },
      { header: 'Date', dataKey: 'date' },
      { header: 'Customer', dataKey: 'customer' },
      { header: 'Reason', dataKey: 'reason' },
      { header: 'Amount', dataKey: 'amount' },
      { header: 'Status', dataKey: 'status' },
    ], returns.map(r => ({
      num: r.returnNumber || '',
      date: r.createdAt || '',
      customer: r.customerName || '—',
      reason: r.returnReason || '',
      amount: formatCurrency(Number(r.totalReturnAmount || 0)),
      status: r.status,
    })), 'sales_returns_report');
  };

  const getStatusVariant = (s: string) => {
    const lower = s?.toLowerCase();
    if (lower === 'completed') return 'success' as const;
    if (lower === 'pending') return 'warning' as const;
    if (lower === 'cancelled') return 'destructive' as const;
    return 'default' as const;
  };

  const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`rounded-xl bg-muted/50 animate-pulse ${className}`} />
  );

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={RotateCcw}
        title="Sales Returns"
        subtitle="Refund tracking, return reasons, and recovery analysis."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleCSV} disabled={!returns.length}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePDF} disabled={!returns.length}>
              <FileText className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        }
      />

      {/* Period selector + status filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Period:</span>
          {[7, 30, 90].map(d => (
            <Button key={d} variant={period === d ? 'default' : 'outline'} size="sm" onClick={() => { setPeriod(d); setPage(1); }}>
              {d}d
            </Button>
          ))}
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />) : stats && (
          <>
            <KpiCard icon={Hash} label="Total Returns" value={String(stats.totalReturns)} color="text-blue-600" bg="bg-blue-500/10" />
            <KpiCard icon={DollarSign} label="Refunded Amount" value={formatCurrency(stats.totalRefundedAmount)} color="text-rose-600" bg="bg-rose-500/10" />
            <KpiCard icon={Clock} label="Pending" value={String(stats.pendingReturns)} color="text-amber-600" bg="bg-amber-500/10" />
            <KpiCard icon={XCircle} label="Cancelled" value={String(stats.cancelledReturns)} color="text-gray-600" bg="bg-gray-500/10" />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Status donut */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground mb-4">Return Status</h2>
          <div className="h-52">
            {loading ? <Skeleton className="h-full" /> : statusDonut.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusDonut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {statusDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: number, name: string) => [`${v} returns`, name]} {...CHART_TOOLTIP_PROPS} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Reason bar chart */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground mb-4">Returns by Reason</h2>
          <div className="h-52">
            {loading ? <Skeleton className="h-full" /> : reasonBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No data.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={reasonBreakdown} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="reason" width={100} tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <RechartsTooltip formatter={(v: number) => [formatCurrency(v), 'Amount']} {...CHART_TOOLTIP_PROPS} />
                  <Bar dataKey="amount" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Returns table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-card-foreground">Return Records</h2>
          <span className="text-sm text-muted-foreground">{returns.length} shown</span>
        </div>
        {loading ? (
          <div className="p-8 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
        ) : returns.length === 0 ? (
          <div className="py-14 text-center text-sm text-muted-foreground">No returns found.</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.returnNumber || '—'}</TableCell>
                    <TableCell>{(() => { try { return format(new Date(r.createdAt || ''), 'PP'); } catch { return '—'; } })()}</TableCell>
                    <TableCell>{r.customerName || 'Walk-in'}</TableCell>
                    <TableCell>{r.returnReason || '—'}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(Number(r.totalReturnAmount || 0))}</TableCell>
                    <TableCell><Badge variant={getStatusVariant(r.status)}>{r.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                  <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

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

export default SalesReturnsReport;
