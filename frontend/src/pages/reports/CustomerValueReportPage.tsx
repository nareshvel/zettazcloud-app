import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import {
  ColumnDef,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  SortingState,
  ColumnFiltersState,
  PaginationState,
  flexRender,
  HeaderContext,
} from '@tanstack/react-table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  TrendingUp,
  Users,
  DollarSign,
  UserPlus,
  Crown,
  RefreshCw,
  Download,
  FileText,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/common/PageHeader';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useDateFormatting } from '@/contexts/LocalizationContext';
import { toApiDateString, getNowInTimezone } from '@/utils/timezone';
import { exportToCsv, exportToPdf } from '@/utils/reportExport';
import {
  getCustomerValueReport,
  getCustomerValueSummaryMetrics,
} from '@/services/reportsService';
import {
  CustomerValueReportItem,
  CustomerValueSummaryMetrics,
  ReportFilter,
} from '@/types';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const CHART_TOOLTIP_PROPS = {
  contentStyle: {
    borderRadius: '8px',
    border: '1px solid hsl(var(--border))',
    background: 'hsl(var(--card))',
  },
  wrapperStyle: { zIndex: 20, outline: 'none' },
  allowEscapeViewBox: { x: false, y: false },
  isAnimationActive: false,
} as const;

const KpiCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
}> = ({ icon: Icon, label, value, color, bg }) => (
  <div className="rounded-xl border border-border border-r-4 border-r-primary/50 bg-card p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
    </div>
    <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
  </div>
);

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`rounded-xl bg-muted/50 animate-pulse ${className}`} />
);

const getSegmentVariant = (
  segment?: CustomerValueReportItem['customerSegment'],
): 'success' | 'info' | 'default' | 'warning' | 'destructive' => {
  switch (segment) {
    case 'VIP':
      return 'success';
    case 'Loyal':
      return 'info';
    case 'At Risk':
      return 'warning';
    case 'Churned':
      return 'destructive';
    case 'New':
    default:
      return 'default';
  }
};

const CustomerValueReportPage: React.FC = () => {
  const { formatCurrency } = useLocaleFormat();
  const { timezone } = useDateFormatting();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = getNowInTimezone(timezone);
    const monthAgo = new Date(today);
    monthAgo.setDate(today.getDate() - 30);
    return { from: monthAgo, to: today };
  });

  const [reportItems, setReportItems] = useState<CustomerValueReportItem[]>([]);
  const [summaryMetrics, setSummaryMetrics] =
    useState<CustomerValueSummaryMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const sortableHeader = useCallback(
    (title: string) =>
      function Header({ column }: HeaderContext<CustomerValueReportItem, unknown>) {
        const isSorted = column.getIsSorted();
        return (
          <div
            className="flex cursor-pointer select-none items-center gap-1"
            onClick={column.getToggleSortingHandler()}
          >
            <span>{title}</span>
            {isSorted === 'asc' ? (
              <ArrowUp className="h-3 w-3" />
            ) : isSorted === 'desc' ? (
              <ArrowDown className="h-3 w-3" />
            ) : (
              <ArrowUpDown className="h-3 w-3 opacity-50" />
            )}
          </div>
        );
      },
    [],
  );

  const columns = useMemo<ColumnDef<CustomerValueReportItem>[]>(
    () => [
      {
        accessorKey: 'customerName',
        header: sortableHeader('Customer Name'),
      },
      {
        accessorKey: 'totalSpent',
        header: sortableHeader('Total Spent'),
        cell: ({ row }) => formatCurrency(row.original.totalSpent),
      },
      {
        accessorKey: 'transactionCount',
        header: sortableHeader('Transactions'),
      },
      {
        accessorKey: 'averagePurchaseValue',
        header: sortableHeader('Avg. Purchase Value'),
        cell: ({ row }) => formatCurrency(row.original.averagePurchaseValue),
      },
      {
        accessorKey: 'firstPurchaseDate',
        header: sortableHeader('First Purchase'),
        cell: ({ row }) =>
          format(new Date(row.original.firstPurchaseDate), 'PP'),
      },
      {
        accessorKey: 'lastPurchaseDate',
        header: sortableHeader('Last Purchase'),
        cell: ({ row }) =>
          format(new Date(row.original.lastPurchaseDate), 'PP'),
      },
      {
        accessorKey: 'customerSegment',
        header: sortableHeader('Segment'),
        cell: ({ row }) => {
          const segment = row.original.customerSegment;
          return (
            <Badge variant={getSegmentVariant(segment)}>
              {segment ?? 'Unknown'}
            </Badge>
          );
        },
      },
    ],
    [formatCurrency, sortableHeader],
  );

  const table = useReactTable({
    data: reportItems,
    columns,
    state: {
      sorting,
      columnFilters,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const fetchReportData = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);

    const filters: ReportFilter = {
      startDate: toApiDateString(dateRange.from, timezone),
      endDate: toApiDateString(dateRange.to, timezone),
      dateRange,
    };

    try {
      const [itemsResponse, metricsResponse] = await Promise.all([
        getCustomerValueReport(filters),
        getCustomerValueSummaryMetrics(filters),
      ]);

      if (itemsResponse.status === 'success' && itemsResponse.data) {
        setReportItems(itemsResponse.data);
      } else {
        console.error(
          'Failed to fetch customer value report items:',
          itemsResponse.error,
        );
        setReportItems([]);
      }

      if (metricsResponse.status === 'success' && metricsResponse.data) {
        setSummaryMetrics(metricsResponse.data);
      } else {
        console.error(
          'Failed to fetch customer value summary metrics:',
          metricsResponse.error,
        );
        setSummaryMetrics(null);
      }
    } catch (error) {
      console.error('Error fetching customer value report data:', error);
      toast.error('Failed to load customer value report data.');
      setReportItems([]);
      setSummaryMetrics(null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, timezone]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleDateChange = useCallback((newDateRange: DateRange | undefined) => {
    setDateRange(newDateRange);
  }, []);

  const topSpendData = useMemo(() => {
    return [...reportItems]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10)
      .map((item) => ({
        name: item.customerName,
        totalSpent: item.totalSpent,
      }));
  }, [reportItems]);

  const segmentBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    reportItems.forEach((item) => {
      const segment = item.customerSegment ?? 'Unknown';
      counts.set(segment, (counts.get(segment) || 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, value], i) => ({
      name,
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [reportItems]);

  const handleExportCSV = useCallback(() => {
    if (!reportItems.length) {
      toast.error('No data to export.');
      return;
    }
    exportToCsv(
      reportItems,
      [
        { header: 'Customer Name', accessor: 'customerName' },
        { header: 'Segment', accessor: 'customerSegment' },
        { header: 'Transactions', accessor: 'transactionCount' },
        { header: 'Total Spent', accessor: (r) => r.totalSpent },
        { header: 'Avg. Purchase Value', accessor: (r) => r.averagePurchaseValue },
        { header: 'First Purchase Date', accessor: 'firstPurchaseDate' },
        { header: 'Last Purchase Date', accessor: 'lastPurchaseDate' },
      ],
      `customer_value_report_${toApiDateString(
        dateRange?.from || new Date(),
        timezone,
      )}`,
    );
  }, [reportItems, dateRange, timezone]);

  const handleExportPDF = useCallback(async () => {
    if (!reportItems.length) {
      toast.error('No data to export.');
      return;
    }
    await exportToPdf(
      'Customer Value Report',
      [
        { header: 'Customer Name', dataKey: 'customerName' },
        { header: 'Segment', dataKey: 'segment' },
        { header: 'Transactions', dataKey: 'transactions' },
        { header: 'Total Spent', dataKey: 'totalSpent' },
        { header: 'Avg. Purchase Value', dataKey: 'averagePurchaseValue' },
        { header: 'First Purchase', dataKey: 'firstPurchaseDate' },
        { header: 'Last Purchase', dataKey: 'lastPurchaseDate' },
      ],
      reportItems.map((r) => ({
        customerName: r.customerName,
        segment: r.customerSegment ?? 'Unknown',
        transactions: String(r.transactionCount),
        totalSpent: formatCurrency(r.totalSpent),
        averagePurchaseValue: formatCurrency(r.averagePurchaseValue),
        firstPurchaseDate: format(new Date(r.firstPurchaseDate), 'PP'),
        lastPurchaseDate: format(new Date(r.lastPurchaseDate), 'PP'),
      })),
      `customer_value_report_${toApiDateString(
        dateRange?.from || new Date(),
        timezone,
      )}`,
    );
  }, [reportItems, dateRange, timezone, formatCurrency]);

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={TrendingUp}
        title="Customer Value Report"
        subtitle="Understand customer lifetime value, segments, and purchasing behavior."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReportData}
              disabled={isLoading}
            >
              <RefreshCw
                className={`h-4 w-4 mr-1.5 ${
                  isLoading ? 'animate-spin' : ''
                }`}
              />{' '}
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!reportItems.length || isLoading}
            >
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={!reportItems.length || isLoading}
            >
              <FileText className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <DateRangePicker
          initialDateRange={dateRange}
          onDateChange={handleDateChange}
          disabled={isLoading}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
        ) : (
          <>
            <KpiCard
              icon={Users}
              label="Unique Customers"
              value={String(summaryMetrics?.totalUniqueCustomers ?? '—')}
              color="text-blue-600"
              bg="bg-blue-500/10"
            />
            <KpiCard
              icon={DollarSign}
              label="Avg Lifetime Value"
              value={formatCurrency(summaryMetrics?.averageLifetimeValue)}
              color="text-emerald-600"
              bg="bg-emerald-500/10"
            />
            <KpiCard
              icon={UserPlus}
              label="New Customers"
              value={
                summaryMetrics?.newCustomersThisPeriod != null
                  ? String(summaryMetrics.newCustomersThisPeriod)
                  : '—'
              }
              color="text-violet-600"
              bg="bg-violet-500/10"
            />
            <div
              title={
                summaryMetrics?.topCustomerBySpending
                  ? `${summaryMetrics.topCustomerBySpending.name} — ${formatCurrency(
                      summaryMetrics.topCustomerBySpending.amount,
                    )}`
                  : undefined
              }
            >
              <KpiCard
                icon={Crown}
                label="Top Spender"
                value={formatCurrency(
                  summaryMetrics?.topCustomerBySpending?.amount,
                )}
                color="text-amber-600"
                bg="bg-amber-500/10"
              />
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground mb-4">
            Top 10 Customers by Spend
          </h2>
          <div className="h-72">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : topSpendData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No data for the selected period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSpendData} margin={{ top: 8, right: 8, left: 0, bottom: 64 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    angle={-35}
                    textAnchor="end"
                    interval={0}
                    height={70}
                  />
                  <YAxis
                    tickFormatter={(v) => formatCurrency(v)}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    formatter={(v: number) => [formatCurrency(v), 'Total Spent']}
                    {...CHART_TOOLTIP_PROPS}
                  />
                  <Bar
                    dataKey="totalSpent"
                    fill="hsl(var(--chart-1))"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground mb-4">
            Customer Segments
          </h2>
          <div className="h-52">
            {isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : segmentBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                No data.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={segmentBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {segmentBreakdown.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    formatter={(v: number, n: string) => [String(v), n]}
                    {...CHART_TOOLTIP_PROPS}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          {!isLoading && segmentBreakdown.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {segmentBreakdown.map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: entry.color }}
                    />
                    <span className="text-muted-foreground">{entry.name}</span>
                  </div>
                  <span className="font-medium text-foreground">{entry.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Detailed Customer Value</CardTitle>
          <span className="text-sm text-muted-foreground">
            {reportItems.length} record{reportItems.length !== 1 ? 's' : ''}
          </span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext(),
                                )}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {table.getRowModel().rows?.length ? (
                      table.getRowModel().rows.map((row) => (
                        <TableRow
                          key={row.id}
                          data-state={row.getIsSelected() && 'selected'}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <TableCell key={cell.id}>
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center"
                        >
                          No results.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </Button>
                <span className="text-sm">
                  Page {table.getState().pagination.pageIndex + 1} of{' '}
                  {table.getPageCount()}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerValueReportPage;
