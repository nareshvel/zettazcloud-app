import React, { useState, useEffect, useCallback } from 'react';
import { DateRange } from 'react-day-picker';
import { subDays } from 'date-fns';
import { Banknote, TrendingUp, TrendingDown, Wallet, RefreshCw } from 'lucide-react';

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
import type { CashFlowReport } from '@/services/financeService';
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

const CashFlowReportPage: React.FC = () => {
  const { formatCurrency } = useLocaleFormat();
  const { timezone } = useDateFormatting();
  const storeCtx = useOptionalStore();
  const storeId = storeCtx?.store?.id;

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = getNowInTimezone(timezone);
    return { from: subDays(today, 30), to: today };
  });
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    if (!dateRange?.from || !dateRange?.to) return;
    setIsLoading(true);
    try {
      const res = await financeService.getCashFlow({
        from: toApiDateString(dateRange.from, timezone),
        to: toApiDateString(dateRange.to, timezone),
        storeId,
      });
      setReport(res ?? null);
    } catch (err) {
      console.error('Failed to load cash-flow report:', err);
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, timezone, storeId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const netChange = (report?.totals.inflow ?? 0) - (report?.totals.outflow ?? 0);

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Banknote}
        title="Cash Flow"
        subtitle="Money in and out of every cash, bank, and clearing account."
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Wallet}
            label="Opening Balance"
            value={formatCurrency(report.totals.opening)}
            color="text-blue-600"
            bg="bg-blue-100 dark:bg-blue-900/30"
          />
          <KpiCard
            icon={TrendingUp}
            label="Money In"
            value={formatCurrency(report.totals.inflow)}
            color="text-emerald-600"
            bg="bg-emerald-100 dark:bg-emerald-900/30"
          />
          <KpiCard
            icon={TrendingDown}
            label="Money Out"
            value={formatCurrency(report.totals.outflow)}
            color="text-rose-600"
            bg="bg-rose-100 dark:bg-rose-900/30"
          />
          <KpiCard
            icon={Banknote}
            label="Closing Balance"
            value={formatCurrency(report.totals.closing)}
            color={netChange >= 0 ? 'text-emerald-600' : 'text-rose-600'}
            bg={netChange >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30'}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Movement by Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Money In</TableHead>
                  <TableHead className="text-right">Money Out</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report?.accounts ?? []).map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <span className="font-medium">{a.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{a.code}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{a.subtype || '—'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(a.opening)}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      {a.inflow ? formatCurrency(a.inflow) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-rose-600">
                      {a.outflow ? formatCurrency(a.outflow) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(a.closing)}
                    </TableCell>
                  </TableRow>
                ))}
                {report && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.totals.opening)}</TableCell>
                    <TableCell className="text-right text-emerald-600">{formatCurrency(report.totals.inflow)}</TableCell>
                    <TableCell className="text-right text-rose-600">{formatCurrency(report.totals.outflow)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(report.totals.closing)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Movement by Source</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Money In</TableHead>
                  <TableHead className="text-right">Money Out</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(report?.bySource ?? []).map((s) => {
                  const net = s.moneyIn - s.moneyOut;
                  return (
                    <TableRow key={s.sourceType}>
                      <TableCell className="capitalize">{s.sourceType.replace(/_/g, ' ')}</TableCell>
                      <TableCell className="text-right text-emerald-600">{formatCurrency(s.moneyIn)}</TableCell>
                      <TableCell className="text-right text-rose-600">{formatCurrency(s.moneyOut)}</TableCell>
                      <TableCell className={`text-right font-medium ${net < 0 ? 'text-rose-600' : ''}`}>
                        {formatCurrency(net)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {report && report.bySource.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No cash movements in this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CashFlowReportPage;
