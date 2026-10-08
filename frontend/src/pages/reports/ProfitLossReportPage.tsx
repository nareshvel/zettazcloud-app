import React, { useState, useEffect, useCallback } from 'react';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import { Scale, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { financeService } from '@/services/financeService';
import type { ProfitLossReport } from '@/services/financeService';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { useDateFormatting } from '@/contexts/LocalizationContext';
import { toApiDateString, getNowInTimezone } from '@/utils/timezone';
import { useOptionalStore } from '@/contexts/StoreContext';

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

const SectionTable: React.FC<{
  title: string;
  rows: { code: string; name: string; subtype?: string | null; amount: number }[];
  total: number;
  totalLabel: string;
  formatCurrency: (v: number) => string;
}> = ({ title, rows, total, totalLabel, formatCurrency }) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-base font-medium">{title}</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.code}>
                <TableCell>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{r.code}</span>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.subtype || '—'}</TableCell>
                <TableCell className="text-right">{formatCurrency(r.amount)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell colSpan={2}>{totalLabel}</TableCell>
              <TableCell className="text-right">{formatCurrency(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </CardContent>
  </Card>
);

const ProfitLossReportPage: React.FC = () => {
  const { formatCurrency } = useLocaleFormat();
  const { timezone } = useDateFormatting();
  const storeCtx = useOptionalStore();
  const storeId = storeCtx?.store?.id;

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = getNowInTimezone(timezone);
    return { from: subDays(today, 30), to: today };
  });
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const res = await financeService.getProfitLoss({
        from: toApiDateString(dateRange.from, timezone),
        to: toApiDateString(dateRange.to, timezone),
        storeId,
      });
      setReport(res ?? null);
    } catch (err) {
      console.error('Failed to load profit & loss report:', err);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, timezone, storeId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const netProfit = report?.netProfit ?? 0;

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Scale}
        title="Profit & Loss"
        subtitle="Revenue and expense activity from the journal for the selected period."
        actions={
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Report Period</CardTitle>
        </CardHeader>
        <CardContent>
          <DateRangePicker
            initialDateRange={dateRange}
            onDateChange={setDateRange}
            disabled={isLoading}
          />
        </CardContent>
      </Card>

      {isLoading || !report ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <KpiCard
            icon={TrendingUp}
            label="Total Revenue"
            value={formatCurrency(report.totalRevenue)}
            color="text-emerald-600"
            bg="bg-emerald-100 dark:bg-emerald-900/30"
          />
          <KpiCard
            icon={TrendingDown}
            label="Total Expenses"
            value={formatCurrency(report.totalExpenses)}
            color="text-rose-600"
            bg="bg-rose-100 dark:bg-rose-900/30"
          />
          <KpiCard
            icon={Scale}
            label={netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
            value={formatCurrency(netProfit)}
            color={netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}
            bg={netProfit >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}
          />
        </div>
      )}

      {report && (
        <>
          <SectionTable
            title="Revenue"
            rows={report.revenue}
            total={report.totalRevenue}
            totalLabel="Total Revenue"
            formatCurrency={formatCurrency}
          />
          <SectionTable
            title="Expenses"
            rows={report.expenses}
            total={report.totalExpenses}
            totalLabel="Total Expenses"
            formatCurrency={formatCurrency}
          />
          <Card>
            <CardContent className="flex items-center justify-between py-5">
              <span className="text-base font-semibold">
                {netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
              </span>
              <span
                className={`text-xl font-bold ${
                  netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {formatCurrency(netProfit)}
              </span>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ProfitLossReportPage;
