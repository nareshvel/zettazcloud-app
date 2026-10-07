import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Banknote,
  CreditCard,
  DollarSign,
  Download,
  FileText,
  Landmark,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';
import { PaymentReportItem, PaymentSummaryMetrics, ReportFilter } from '@/types';
import { getPaymentReportItems, getPaymentSummaryMetrics } from '@/services/reportsService';
import PageHeader from '@/components/common/PageHeader';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import ReusableTable, { ColumnDefinition } from '@/components/ReusableTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useDateFormatting } from '@/contexts/LocalizationContext';
import { getNowInTimezone, toApiDateString } from '@/utils/timezone';
import { exportToCsv, exportToPdf } from '@/utils/reportExport';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const TOOLTIP_PROPS = {
  contentStyle: {
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--card))',
  },
  wrapperStyle: { zIndex: 20, outline: 'none' },
  allowEscapeViewBox: { x: false, y: false },
  isAnimationActive: false,
} as const;

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  color: string;
  bg: string;
}

const KpiCard = ({ icon: Icon, label, value, color, bg }: KpiCardProps) => (
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

const statusVariant: Record<PaymentReportItem['status'], 'success' | 'warning' | 'destructive' | 'info'> = {
  Completed: 'success',
  Pending: 'warning',
  Failed: 'destructive',
  Refunded: 'info',
};

const PaymentReportPage: React.FC = () => {
  const { formatCurrency, formatDate } = useLocaleFormat();
  const { timezone } = useDateFormatting();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const to = getNowInTimezone(timezone);
    const from = new Date(to);
    from.setDate(from.getDate() - 29);
    return { from, to };
  });
  const [paymentItems, setPaymentItems] = useState<PaymentReportItem[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<PaymentSummaryMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(paymentItems.length / itemsPerPage));

  const fetchData = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;

    setIsLoading(true);
    const filters: ReportFilter = {
      startDate: toApiDateString(dateRange.from, timezone),
      endDate: toApiDateString(dateRange.to, timezone),
    };

    try {
      const [itemsResponse, metricsResponse] = await Promise.all([
        getPaymentReportItems(filters),
        getPaymentSummaryMetrics(filters),
      ]);

      type PaginatedPayments = { items: PaymentReportItem[]; totalPages?: number };
      const itemData = itemsResponse.status === 'success'
        ? itemsResponse.data as PaymentReportItem[] | PaginatedPayments | undefined
        : undefined;

      if (Array.isArray(itemData)) setPaymentItems(itemData);
      else if (itemData && Array.isArray(itemData.items)) setPaymentItems(itemData.items);
      else setPaymentItems([]);

      setSummaryMetrics(metricsResponse.status === 'success' ? metricsResponse.data ?? null : null);
      setCurrentPage(1);
    } catch (error) {
      console.error('Failed to fetch payment report data:', error);
      setPaymentItems([]);
      setSummaryMetrics(null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, timezone]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = useMemo(
    () => summaryMetrics?.paymentsByMethod.map((payment) => ({
      method: payment.method,
      revenue: Number(payment.totalAmount),
      transactions: Number(payment.count),
    })) ?? [],
    [summaryMetrics],
  );

  const exportFilename = dateRange?.from && dateRange?.to
    ? `payment-report-${toApiDateString(dateRange.from, timezone)}-to-${toApiDateString(dateRange.to, timezone)}`
    : 'payment-report';

  const handleCsvExport = () => exportToCsv(paymentItems, [
    { header: 'Date', accessor: (row) => formatDate(row.date) },
    { header: 'Invoice ID', accessor: 'invoiceId' },
    { header: 'Customer', accessor: (row) => row.customerName?.trim() || 'Walk-In Customer' },
    { header: 'Payment Method', accessor: 'paymentMethod' },
    { header: 'Amount', accessor: (row) => formatCurrency(row.amount) },
    { header: 'Status', accessor: 'status' },
    { header: 'Processed By', accessor: 'processedBy' },
  ], exportFilename);

  const handlePdfExport = () => exportToPdf(
    'Payment Report',
    [
      { header: 'Date', dataKey: 'date' },
      { header: 'Invoice', dataKey: 'invoiceId' },
      { header: 'Customer', dataKey: 'customer' },
      { header: 'Method', dataKey: 'method' },
      { header: 'Amount', dataKey: 'amount' },
      { header: 'Status', dataKey: 'status' },
      { header: 'Processed By', dataKey: 'processedBy' },
    ],
    paymentItems.map((row) => ({
      date: formatDate(row.date),
      invoiceId: row.invoiceId,
      customer: row.customerName?.trim() || 'Walk-In Customer',
      method: row.paymentMethod,
      amount: formatCurrency(row.amount),
      status: row.status,
      processedBy: row.processedBy,
    })),
    exportFilename,
  );

  const columns = useMemo<ColumnDefinition<PaymentReportItem>[]>(() => [
    {
      accessor: 'date',
      Header: 'Date',
      Cell: (row) => format(new Date(row.date), 'PP'),
    },
    {
      accessor: 'invoiceId',
      Header: 'Invoice',
      Cell: (row) => <span className="font-medium text-foreground">{row.invoiceId}</span>,
    },
    {
      accessor: 'customerName',
      Header: 'Customer',
      Cell: (row) => row.customerName?.trim() || 'Walk-In Customer',
    },
    { accessor: 'paymentMethod', Header: 'Payment Method' },
    {
      accessor: 'amount',
      Header: 'Amount',
      className: 'text-right font-semibold',
      headerClassName: 'text-right',
      Cell: (row) => formatCurrency(row.amount),
    },
    {
      accessor: 'status',
      Header: 'Status',
      Cell: (row) => <Badge variant={statusVariant[row.status]}>{row.status}</Badge>,
    },
    { accessor: 'processedBy', Header: 'Processed By' },
  ], [formatCurrency]);

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={DollarSign}
        title="Payment Report"
        subtitle="Track revenue, refunds, payment trends, and every transaction in one place."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleCsvExport} disabled={isLoading || !paymentItems.length}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button size="sm" onClick={handlePdfExport} disabled={isLoading || !paymentItems.length}>
              <FileText className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </div>
        )}
      />

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-foreground">Reporting period</p>
            <p className="text-xs text-muted-foreground">Choose a date range to refresh all metrics and transactions.</p>
          </div>
          <DateRangePicker initialDateRange={dateRange} onDateChange={setDateRange} disabled={isLoading} />
        </CardContent>
      </Card>

      {isLoading && !summaryMetrics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="rounded-xl bg-muted/50 animate-pulse h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <KpiCard icon={TrendingUp} label="Total Revenue" value={formatCurrency(summaryMetrics?.totalRevenue ?? 0)} color="text-emerald-600" bg="bg-emerald-500/10" />
          <KpiCard icon={Landmark} label="Net Revenue" value={formatCurrency(summaryMetrics?.netRevenue ?? 0)} color="text-primary" bg="bg-primary/10" />
          <KpiCard icon={CreditCard} label="Transactions" value={summaryMetrics?.totalTransactions ?? 0} color="text-blue-600" bg="bg-blue-500/10" />
          <KpiCard icon={Banknote} label="Avg Value" value={formatCurrency(summaryMetrics?.averageTransactionValue ?? 0)} color="text-violet-600" bg="bg-violet-500/10" />
          <KpiCard icon={RotateCcw} label="Refunds" value={formatCurrency(summaryMetrics?.totalRefunds ?? 0)} color="text-amber-600" bg="bg-amber-500/10" />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="rounded-xl border border-border bg-card shadow-sm lg:col-span-3">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-base">Revenue by payment method</CardTitle>
            <p className="text-sm text-muted-foreground">Total processed value for each payment channel.</p>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 12, right: 8, left: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="method" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value)} width={86} />
                  <Tooltip {...TOOLTIP_PROPS} formatter={(value: number) => [formatCurrency(value), 'Revenue']} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.35 }} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-border bg-card shadow-sm lg:col-span-2">
          <CardHeader className="p-5 pb-2">
            <CardTitle className="text-base">Transaction mix</CardTitle>
            <p className="text-sm text-muted-foreground">Share of transaction count by method.</p>
          </CardHeader>
          <CardContent className="p-5 pt-2">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="transactions" nameKey="method" innerRadius={65} outerRadius={95} paddingAngle={3} stroke="hsl(var(--card))" strokeWidth={3}>
                    {chartData.map((entry, index) => <Cell key={entry.method} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_PROPS} formatter={(value: number) => [value, 'Transactions']} />
                  <Legend iconType="circle" wrapperStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between p-5 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ReceiptText className="h-4 w-4 text-primary" />
              Payment transactions
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{paymentItems.length} transactions in the selected period.</p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ReusableTable
            columns={columns}
            data={paymentItems}
            isLoading={isLoading}
            noDataMessage="No payment transactions found for the selected period."
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={itemsPerPage}
            totalItems={paymentItems.length}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentReportPage;
