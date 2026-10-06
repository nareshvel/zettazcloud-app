import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DateRange } from 'react-day-picker';
import { format, subDays } from 'date-fns';
import {
  CreditCard,
  Banknote,
  Scale,
  AlertCircle,
  RefreshCw,
  Download,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import PageHeader from '@/components/common/PageHeader';
import { DateRangePicker } from '@/components/reports/DateRangePicker';
import {
  getChargeAccountReport,
  getChargeAccountSummaryMetrics,
} from '@/services/reportsService';
import {
  ChargeAccountReportItem,
  ChargeAccountSummaryMetrics,
  ReportFilter,
} from '@/types';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useDateFormatting } from '@/contexts/LocalizationContext';
import { toApiDateString, getNowInTimezone } from '@/utils/timezone';
import { exportToCsv, exportToPdf } from '@/utils/reportExport';

type SortDirection = 'asc' | 'desc' | null;
interface SortState {
  key: keyof ChargeAccountReportItem | null;
  direction: SortDirection;
}

const KpiCard: React.FC<{
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  bg: string;
  subtext?: string;
}> = ({ icon: Icon, label, value, color, bg, subtext }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
    </div>
    <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
    {subtext && <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>}
  </div>
);

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

interface AgingTooltipPayload {
  bucket: string;
  balance: number;
  count: number;
  formatter: (value: number) => string;
}

const AgingTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number; payload: AgingTooltipPayload }[];
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0].value;
  const data = payload[0].payload;
  return (
    <div
      style={{
        borderRadius: '8px',
        border: '1px solid hsl(var(--border))',
        background: 'hsl(var(--card))',
        padding: '8px 12px',
      }}
    >
      <p className="text-xs font-medium text-muted-foreground">{data.bucket}</p>
      <p className="text-sm font-semibold text-foreground">{data.formatter(value)}</p>
      <p className="text-xs text-muted-foreground">{data.count} accounts</p>
    </div>
  );
};

const ChargeAccountReportPage: React.FC = () => {
  const { formatCurrency } = useLocaleFormat();
  const { timezone } = useDateFormatting();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = getNowInTimezone(timezone);
    return { from: subDays(today, 30), to: today };
  });

  const [reportItems, setReportItems] = useState<ChargeAccountReportItem[]>([]);
  const [summaryMetrics, setSummaryMetrics] =
    useState<ChargeAccountSummaryMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'currentBalance', direction: 'desc' });
  const [page, setPage] = useState(1);
  const itemsPerPage = 12;

  const fetchReportData = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);

    const filtersForApi: ReportFilter = {
      startDate: toApiDateString(dateRange.from, timezone),
      endDate: toApiDateString(dateRange.to, timezone),
      dateRange,
    };

    try {
      const [itemsResponse, metricsResponse] = await Promise.all([
        getChargeAccountReport(filtersForApi),
        getChargeAccountSummaryMetrics(filtersForApi),
      ]);

      if (itemsResponse.status === 'success' && itemsResponse.data) {
        setReportItems(itemsResponse.data);
      } else {
        console.error('Failed to fetch charge account report items:', itemsResponse.error);
        setReportItems([]);
      }

      if (metricsResponse.status === 'success' && metricsResponse.data) {
        setSummaryMetrics(metricsResponse.data);
      } else {
        console.error('Failed to fetch charge account summary metrics:', metricsResponse.error);
        setSummaryMetrics(null);
      }
    } catch (error) {
      console.error('Error fetching charge account report data:', error);
      setReportItems([]);
      setSummaryMetrics(null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, timezone]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  const handleDateChange = (newDateRange: DateRange | undefined) => {
    setDateRange(newDateRange);
    setPage(1);
  };

  const agingBuckets = useMemo(() => {
    const buckets = [
      { key: 'current', label: 'Current', min: -Infinity, max: 0 },
      { key: '1-30', label: '1-30 Days', min: 1, max: 30 },
      { key: '31-60', label: '31-60 Days', min: 31, max: 60 },
      { key: '61-90', label: '61-90 Days', min: 61, max: 90 },
      { key: '90+', label: '90+ Days', min: 91, max: Infinity },
    ];

    return buckets.map((bucket) => {
      const items = reportItems.filter((item) => {
        const days = item.daysOverdue ?? 0;
        return days >= bucket.min && days <= bucket.max;
      });
      const total = items.reduce((sum, item) => sum + (item.currentBalance || 0), 0);
      return {
        bucket: bucket.label,
        balance: total,
        count: items.length,
        formatter: formatCurrency,
      };
    });
  }, [reportItems, formatCurrency]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const items = q
      ? reportItems.filter(
          (item) =>
            item.customerName.toLowerCase().includes(q) ||
            item.accountType.toLowerCase().includes(q) ||
            item.accountStatus.toLowerCase().includes(q)
        )
      : [...reportItems];

    if (sort.key && sort.direction) {
      items.sort((a, b) => {
        const aVal = a[sort.key as keyof ChargeAccountReportItem];
        const bVal = b[sort.key as keyof ChargeAccountReportItem];

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        if (aVal == null) return sort.direction === 'asc' ? -1 : 1;
        if (bVal == null) return sort.direction === 'asc' ? 1 : -1;
        return sort.direction === 'asc'
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    return items;
  }, [reportItems, searchQuery, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, page]);

  const handleSort = (key: keyof ChargeAccountReportItem) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, direction: 'desc' };
      if (prev.direction === 'desc') return { key, direction: 'asc' };
      if (prev.direction === 'asc') return { key: null, direction: null };
      return { key, direction: 'desc' };
    });
    setPage(1);
  };

  const renderSortIcon = (key: keyof ChargeAccountReportItem) => {
    if (sort.key !== key) return <ArrowUpDown className="ml-2 h-3.5 w-3.5 text-muted-foreground/60" />;
    if (sort.direction === 'asc') return <ArrowUp className="ml-2 h-3.5 w-3.5 text-primary" />;
    return <ArrowDown className="ml-2 h-3.5 w-3.5 text-primary" />;
  };

  const getStatusVariant = (
  status: ChargeAccountReportItem['accountStatus']
): VariantProps<typeof badgeVariants>['variant'] => {
    switch (status) {
      case 'Active':
        return 'success';
      case 'Paid Off':
        return 'success';
      case 'Over Limit':
        return 'destructive';
      case 'Suspended':
        return 'destructive';
      case 'Zero Balance':
        return 'secondary';
      case 'Inactive':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  const handleExportCsv = useCallback(() => {
    exportToCsv(
      filteredItems,
      [
        { header: 'Customer Name', accessor: 'customerName' },
        { header: 'Account Type', accessor: 'accountType' },
        { header: 'Current Balance', accessor: (row) => formatCurrency(row.currentBalance) },
        {
          header: 'Credit Limit',
          accessor: (row) => (row.creditLimit != null ? formatCurrency(row.creditLimit) : 'N/A'),
        },
        {
          header: 'Last Purchase Date',
          accessor: (row) =>
            row.lastPurchaseDate ? format(new Date(row.lastPurchaseDate), 'PP') : 'N/A',
        },
        { header: 'Status', accessor: 'accountStatus' },
        {
          header: 'Days Overdue',
          accessor: (row) => (row.daysOverdue != null ? row.daysOverdue : 'N/A'),
        },
      ],
      `charge-account-report-${format(new Date(), 'yyyy-MM-dd')}`
    );
  }, [filteredItems, formatCurrency]);

  const handleExportPdf = useCallback(async () => {
    const rows = filteredItems.map((row) => ({
      customerName: row.customerName,
      accountType: row.accountType,
      currentBalance: formatCurrency(row.currentBalance),
      creditLimit: row.creditLimit != null ? formatCurrency(row.creditLimit) : 'N/A',
      lastPurchaseDate: row.lastPurchaseDate ? format(new Date(row.lastPurchaseDate), 'PP') : 'N/A',
      accountStatus: row.accountStatus,
      daysOverdue: row.daysOverdue != null ? row.daysOverdue : 'N/A',
    }));

    exportToPdf(
      'Charge Account Report',
      [
        { header: 'Customer Name', dataKey: 'customerName' },
        { header: 'Account Type', dataKey: 'accountType' },
        { header: 'Current Balance', dataKey: 'currentBalance' },
        { header: 'Credit Limit', dataKey: 'creditLimit' },
        { header: 'Last Purchase', dataKey: 'lastPurchaseDate' },
        { header: 'Status', dataKey: 'accountStatus' },
        { header: 'Days Overdue', dataKey: 'daysOverdue' },
      ],
      rows,
      `charge-account-report-${format(new Date(), 'yyyy-MM-dd')}`
    );
  }, [filteredItems, formatCurrency]);

  const utilizationRate = summaryMetrics?.utilizationRate ?? 0;
  const utilizationPercent = Math.min(100, Math.max(0, utilizationRate * 100));

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={CreditCard}
        title="Charge Account Report"
        subtitle="Review customer charge accounts, outstanding receivables, credit limits, and aging."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchReportData}
              disabled={isLoading}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={isLoading}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={isLoading}>
              <FileText className="mr-2 h-4 w-4" />
              PDF
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Report Period</CardTitle>
        </CardHeader>
        <CardContent>
          <DateRangePicker
            initialDateRange={dateRange}
            onDateChange={handleDateChange}
            disabled={isLoading}
          />
        </CardContent>
      </Card>

      {isLoading || !summaryMetrics ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={CreditCard}
            label="Total Accounts"
            value={summaryMetrics.totalAccounts.toLocaleString()}
            color="text-blue-600"
            bg="bg-blue-100 dark:bg-blue-900/30"
            subtext={`Avg ${formatCurrency(summaryMetrics.averageBalancePerAccount)} per account`}
          />
          <KpiCard
            icon={Banknote}
            label="Outstanding Balance"
            value={formatCurrency(summaryMetrics.totalOutstandingBalance)}
            color="text-emerald-600"
            bg="bg-emerald-100 dark:bg-emerald-900/30"
            subtext="Total receivables"
          />
          <KpiCard
            icon={Scale}
            label="Credit Limit"
            value={formatCurrency(summaryMetrics.totalCreditLimit)}
            color="text-violet-600"
            bg="bg-violet-100 dark:bg-violet-900/30"
            subtext="Combined facility"
          />
          <KpiCard
            icon={AlertCircle}
            label="Accounts Over Limit"
            value={summaryMetrics.accountsOverLimit.toLocaleString()}
            color="text-rose-600"
            bg="bg-rose-100 dark:bg-rose-900/30"
            subtext={`${(utilizationRate * 100).toFixed(1)}% utilization`}
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-medium">Aging Buckets</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-64 w-full animate-pulse rounded-lg bg-muted" />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={agingBuckets}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                    <XAxis
                      type="number"
                      tickFormatter={(v: number) => formatCurrency(v)}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      type="category"
                      dataKey="bucket"
                      width={90}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <RechartsTooltip content={<AgingTooltip />} {...CHART_TOOLTIP_PROPS} />
                    <Bar dataKey="balance" radius={[0, 4, 4, 0]} barSize={24}>
                      {agingBuckets.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            index === 0
                              ? 'hsl(var(--chart-1))'
                              : index === 1
                              ? 'hsl(var(--chart-2))'
                              : index === 2
                              ? 'hsl(var(--chart-3))'
                              : index === 3
                              ? 'hsl(var(--chart-4))'
                              : 'hsl(var(--chart-5))'
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-medium">Credit Utilization</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading || !summaryMetrics ? (
              <>
                <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
                <div className="h-4 w-3/4 animate-pulse rounded-md bg-muted" />
                <div className="h-16 w-full animate-pulse rounded-lg bg-muted" />
              </>
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Used</span>
                    <span className="font-semibold text-foreground">
                      {formatCurrency(summaryMetrics.totalOutstandingBalance)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Limit</span>
                    <span className="font-medium text-foreground">
                      {formatCurrency(summaryMetrics.totalCreditLimit)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold text-foreground">
                      {utilizationPercent.toFixed(1)}%
                    </span>
                    <Badge variant={utilizationPercent > 80 ? 'destructive' : utilizationPercent > 50 ? 'warning' : 'success'}>
                      {utilizationPercent > 80 ? 'High' : utilizationPercent > 50 ? 'Moderate' : 'Healthy'}
                    </Badge>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        utilizationPercent > 80
                          ? 'bg-destructive'
                          : utilizationPercent > 50
                          ? 'bg-yellow-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${utilizationPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {summaryMetrics.accountsOverLimit} account
                    {summaryMetrics.accountsOverLimit === 1 ? '' : 's'} currently over limit.
                  </p>
                </div>

                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Utilization compares total outstanding balance against total credit limit.
                    Keep this below 80% to maintain healthy exposure.
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base font-medium">Detailed Accounts</CardTitle>
            <p className="text-sm text-muted-foreground">
              {filteredItems.length} account{filteredItems.length === 1 ? '' : 's'} found
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customer, type, status..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <>
              <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
            </>
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort('customerName')}
                      >
                        <div className="flex items-center">
                          Customer Name
                          {renderSortIcon('customerName')}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort('accountType')}
                      >
                        <div className="flex items-center">
                          Account Type
                          {renderSortIcon('accountType')}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap text-right"
                        onClick={() => handleSort('currentBalance')}
                      >
                        <div className="flex items-center justify-end">
                          Current Balance
                          {renderSortIcon('currentBalance')}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap text-right"
                        onClick={() => handleSort('creditLimit')}
                      >
                        <div className="flex items-center justify-end">
                          Credit Limit
                          {renderSortIcon('creditLimit')}
                        </div>
                      </TableHead>
                      <TableHead className="whitespace-nowrap text-right">Available</TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort('lastPurchaseDate')}
                      >
                        <div className="flex items-center">
                          Last Purchase
                          {renderSortIcon('lastPurchaseDate')}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort('accountStatus')}
                      >
                        <div className="flex items-center">
                          Status
                          {renderSortIcon('accountStatus')}
                        </div>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap text-right"
                        onClick={() => handleSort('daysOverdue')}
                      >
                        <div className="flex items-center justify-end">
                          Days Overdue
                          {renderSortIcon('daysOverdue')}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.length > 0 ? (
                      paginatedItems.map((item) => {
                        const availableCredit =
                          item.creditLimit != null
                            ? item.creditLimit - (item.currentBalance || 0)
                            : null;

                        return (
                          <TableRow key={item.customerId}>
                            <TableCell className="font-medium">{item.customerName}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.accountType}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.currentBalance)}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                              {item.creditLimit != null
                                ? formatCurrency(item.creditLimit)
                                : '—'}
                            </TableCell>
                            <TableCell
                              className={`text-right font-medium ${
                                availableCredit != null && availableCredit < 0
                                  ? 'text-destructive'
                                  : 'text-emerald-600'
                              }`}
                            >
                              {availableCredit != null ? formatCurrency(availableCredit) : '—'}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {item.lastPurchaseDate
                                ? format(new Date(item.lastPurchaseDate), 'PP')
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getStatusVariant(item.accountStatus)}>
                                {item.accountStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.daysOverdue != null && item.daysOverdue > 0 ? (
                                <span className="text-destructive font-medium">
                                  {item.daysOverdue}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                          No accounts match your search.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {filteredItems.length > 0 && (
                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * itemsPerPage + 1}–
                    {Math.min(page * itemsPerPage, filteredItems.length)} of{' '}
                    {filteredItems.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                    >
                      <ChevronsLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 text-sm text-muted-foreground">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                    >
                      <ChevronsRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ChargeAccountReportPage;
