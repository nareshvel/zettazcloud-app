import React, { useEffect, useState } from 'react';
import { getPurityValuation, getPieceStatusReport } from '@/services/jewelryOpsService';
import PageHeader from '@/components/common/PageHeader';
import StatusBadge from '@/components/common/StatusBadge';
import { Gem, Loader2, Download, FileText } from 'lucide-react';
import { useLocaleFormat } from '@/hooks/useLocaleFormat';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import { exportToCsv, exportToPdf } from '@/utils/reportExport';

const CHART_TOOLTIP_PROPS = {
  contentStyle: { borderRadius: '8px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' },
  wrapperStyle: { zIndex: 20, outline: 'none' },
  allowEscapeViewBox: { x: false, y: false },
  isAnimationActive: false,
} as const;

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const JewelryValuationReport: React.FC = () => {
  const { formatCurrency, formatWeight } = useLocaleFormat();
  const [data, setData] = useState<any>(null);
  const [pieceStatus, setPieceStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPurityValuation(), getPieceStatusReport()])
      .then(([v, s]) => { setData(v); setPieceStatus(s || []); })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center gap-2 text-sm text-muted-foreground min-h-[50vh]">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading valuation data...
      </div>
    );
  }

  const totals = data?.totals || {};
  const serialized = data?.serialized || [];
  const nonSerialized = data?.nonSerialized || [];

  // Chart data from serialized
  const purityChartData = serialized.map((r: any) => ({
    purity: r.purity,
    cost: Number(r.costValue ?? r.cost_value) || 0,
    retail: Number(r.retailValue ?? r.retail_value) || 0,
  }));

  // Piece status donut
  const statusDonutData = pieceStatus.map((s: any) => ({
    name: s.status,
    value: Number(s.count) || 0,
  }));

  const handleCSV = () => {
    const allRows = [
      ...serialized.map((r: any) => ({
        type: 'Serialized',
        purity: r.purity,
        count: r.pieceCount ?? r.piece_count,
        gross: r.grossWeight ?? r.gross_weight,
        net: r.netWeight ?? r.net_weight,
        cost: r.costValue ?? r.cost_value,
        retail: r.retailValue ?? r.retail_value,
      })),
      ...nonSerialized.map((r: any) => ({
        type: 'Non-Serialized',
        purity: r.purity,
        count: r.productCount ?? r.product_count,
        gross: '',
        net: r.units,
        cost: r.costValue ?? r.cost_value,
        retail: r.retailValue ?? r.retail_value,
      })),
    ];
    exportToCsv(allRows, [
      { header: 'Type', accessor: (r: any) => r.type },
      { header: 'Purity', accessor: (r: any) => r.purity },
      { header: 'Count', accessor: (r: any) => r.count },
      { header: 'Gross Weight', accessor: (r: any) => r.gross },
      { header: 'Net/Units', accessor: (r: any) => r.net },
      { header: 'Cost Value', accessor: (r: any) => r.cost },
      { header: 'Retail Value', accessor: (r: any) => r.retail },
    ], 'jewelry_valuation_report');
  };

  const handlePDF = async () => {
    const rows = serialized.map((r: any) => ({
      purity: r.purity,
      pieces: String(r.pieceCount ?? r.piece_count),
      gross: String(r.grossWeight ?? r.gross_weight),
      net: String(r.netWeight ?? r.net_weight),
      cost: formatCurrency(r.costValue ?? r.cost_value),
      retail: formatCurrency(r.retailValue ?? r.retail_value),
    }));
    await exportToPdf('Purity-wise Valuation', [
      { header: 'Purity', dataKey: 'purity' },
      { header: 'Pieces', dataKey: 'pieces' },
      { header: 'Gross (g)', dataKey: 'gross' },
      { header: 'Net (g)', dataKey: 'net' },
      { header: 'Cost', dataKey: 'cost' },
      { header: 'Retail', dataKey: 'retail' },
    ], rows, 'jewelry_valuation_report');
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 min-h-screen">
      <PageHeader
        icon={Gem}
        title="Purity-wise Valuation"
        subtitle="Stock value grouped by metal purity, for serialized pieces and regular products."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCSV} disabled={!serialized.length && !nonSerialized.length}>
              <Download className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePDF} disabled={!serialized.length}>
              <FileText className="h-4 w-4 mr-1.5" /> PDF
            </Button>
          </div>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total Cost Value" value={formatCurrency(totals.total_cost ?? 0)} color="text-emerald-600" bg="bg-emerald-500/10" />
        <KpiCard label="Total Retail Value" value={formatCurrency(totals.total_retail ?? 0)} color="text-blue-600" bg="bg-blue-500/10" />
        <KpiCard label="Net Weight" value={formatWeight(totals.net_weight ?? 0)} color="text-violet-600" bg="bg-violet-500/10" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Bar chart: Cost vs Retail by purity */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground mb-4">Cost vs Retail by Purity</h2>
          <div className="h-64">
            {purityChartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={purityChartData} margin={{ left: 10, right: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="purity" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={v => formatCurrency(v)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                  <RechartsTooltip formatter={(v: number, name: string) => [formatCurrency(v), name === 'cost' ? 'Cost' : 'Retail']} {...CHART_TOOLTIP_PROPS} />
                  <Bar dataKey="cost" name="Cost" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="retail" name="Retail" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No serialized data.</div>
            )}
          </div>
        </div>

        {/* Donut: Piece status */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground mb-4">Pieces by Status</h2>
          <div className="h-52">
            {statusDonutData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusDonutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={72} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {statusDonutData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: number, name: string) => [`${v} pieces`, name]} {...CHART_TOOLTIP_PROPS} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No pieces recorded.</div>
            )}
          </div>
          {/* Legend */}
          {statusDonutData.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {statusDonutData.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground">{s.name}</span>
                  <span className="ml-auto font-medium text-foreground">{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Serialized pieces table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-card-foreground">Serialized Pieces by Purity</h2>
          <Badge variant="secondary">{serialized.length} purities</Badge>
        </div>
        {!serialized.length ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No serialized pieces in stock.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purity</TableHead>
                <TableHead className="text-right">Pieces</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Retail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serialized.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.purity}</TableCell>
                  <TableCell className="text-right">{r.pieceCount ?? r.piece_count}</TableCell>
                  <TableCell className="text-right">{formatWeight(r.grossWeight ?? r.gross_weight)}</TableCell>
                  <TableCell className="text-right">{formatWeight(r.netWeight ?? r.net_weight)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.costValue ?? r.cost_value)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.retailValue ?? r.retail_value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Non-serialized products table */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold text-card-foreground">Non-serialized Products by Purity</h2>
          <Badge variant="secondary">{nonSerialized.length} purities</Badge>
        </div>
        {!nonSerialized.length ? (
          <div className="py-10 text-center text-sm text-muted-foreground">No non-serialized stock with purity recorded.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Purity</TableHead>
                <TableHead className="text-right">Products</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Retail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {nonSerialized.map((r: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{r.purity}</TableCell>
                  <TableCell className="text-right">{r.productCount ?? r.product_count}</TableCell>
                  <TableCell className="text-right">{r.units}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.costValue ?? r.cost_value)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(r.retailValue ?? r.retail_value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Piece status badges */}
      {pieceStatus.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-card-foreground mb-4">Status Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {pieceStatus.map((s: any, i: number) => (
              <div key={i} className="rounded-lg border border-border bg-background p-4">
                <StatusBadge status={s.status} />
                <div className="mt-2 text-2xl font-bold text-foreground">{s.count}</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(s.costValue ?? s.cost_value ?? 0)} cost</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: string; color: string; bg: string }> = ({ label, value, color, bg }) => (
  <div className="rounded-xl border border-border border-r-4 border-r-primary/50 bg-card p-4 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg}`}>
        <Gem className={`h-4 w-4 ${color}`} />
      </div>
    </div>
    <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
  </div>
);

export default JewelryValuationReport;
