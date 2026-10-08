import { useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useCurrency, useDateFormatting } from '@/contexts/LocalizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import { financeService, DrawerReport } from '@/services/financeService';
import { getPrintDocumentSettings, PrintDocumentSetting } from '@/services/printDocumentSettingsService';
import toast from 'react-hot-toast';

interface Props {
  sessionId: string | null;
  storeId: string;
  onClose: () => void;
}

const money = (fmt: (n: number) => string, n: number | null | undefined) =>
  n == null ? '—' : fmt(Number(n));

/** Minimal thermal-friendly HTML for the report — printed through the same
 *  pipeline as receipts (local agent / network / browser by document settings). */
function buildReportHtml(report: DrawerReport, fmt: (n: number) => string, fmtDT: (d: string) => string): string {
  const s = report.session;
  const row = (l: string, v: string, bold = false) =>
    `<tr><td style="padding:2px 0;${bold ? 'font-weight:700;' : ''}">${l}</td><td style="text-align:right;padding:2px 0;${bold ? 'font-weight:700;' : ''}">${v}</td></tr>`;
  const hr = `<tr><td colspan="2" style="border-top:1px dashed #999;padding:0;"></td></tr>`;

  const tenderRows = report.tenders.length
    ? report.tenders.map(t => row(`${t.methodName} (${t.txns})`, fmt(Number(t.total)))).join('')
    : row('No sales in window', '—');

  const moveRows = report.movements.length
    ? report.movements.map(m =>
        row(
          `${m.direction === 'paid_in' ? 'Paid in' : 'Paid out'}${m.reason ? ` — ${m.reason}` : ''}`,
          `${m.direction === 'paid_in' ? '+' : '−'}${fmt(Number(m.amount))}`,
        )).join('')
    : '';

  return `
    <div style="font-family:monospace;font-size:12px;max-width:280px;margin:0 auto;">
      <div style="text-align:center;">
        <div style="font-size:15px;font-weight:700;">${report.reportType === 'z' ? 'Z-REPORT' : 'X-REPORT'}</div>
        <div>${s.sessionNo || ''} — ${s.storeName || 'Register'}</div>
        <div style="font-size:11px;">${fmtDT(s.openedAt)}${s.closedAt ? ` → ${fmtDT(s.closedAt)}` : ' (still open)'}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;margin-top:8px;">
        ${row('Opened by', s.openedByName || '—')}
        ${s.closedByName ? row('Closed by', s.closedByName) : ''}
        ${row('Opening float', fmt(Number(s.openingFloat)))}
        ${hr}
        <tr><td colspan="2" style="padding:4px 0 0;font-weight:700;">SALES BY TENDER</td></tr>
        ${tenderRows}
        ${row('Sales count', String(report.salesCount))}
        ${row('Gross sales', fmt(report.grossSales), true)}
        ${moveRows ? `${hr}<tr><td colspan="2" style="padding:4px 0 0;font-weight:700;">PAID IN / OUT</td></tr>${moveRows}` : ''}
        ${hr}
        ${row('Expected in register', fmt(report.expectedCashLive), true)}
        ${report.reportType === 'z' ? row('Counted cash', fmt(Number(s.countedCash)), true) : ''}
        ${report.reportType === 'z' && s.variance != null ? row(`Variance (${Number(s.variance) < -0.004 ? 'short' : Number(s.variance) > 0.004 ? 'over' : 'matched'})`, `${Number(s.variance) > 0 ? '+' : ''}${fmt(Number(s.variance))}`, true) : ''}
      </table>
      <div style="text-align:center;margin-top:10px;font-size:11px;">— end of report —</div>
    </div>`;
}

const REPORT_CSS = `
  body { margin: 0; padding: 8px; }
  @media print { body { margin: 0; } }
`;

const RegisterReportDialog = ({ sessionId, storeId, onClose }: Props) => {
  const { formatCurrency } = useCurrency();
  const { formatDateTime } = useDateFormatting();
  const { user } = useAuth();
  const canPrint = hasAnyPermission(user, ['printer.view', 'printer.settings', 'finance.manage']);

  const [report, setReport] = useState<DrawerReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!sessionId) { setReport(null); return; }
    setReport(null);
    setError(null);
    financeService.getDrawerReport(sessionId)
      .then(setReport)
      .catch((e: any) => setError(e.message || 'Failed to load report.'));
  }, [sessionId]);

  const doPrint = async () => {
    if (!report || !storeId) return;
    setPrinting(true);
    try {
      const { printReceipt } = await import('@/services/printerService');
      const { settings } = await getPrintDocumentSettings(storeId);
      const doc: PrintDocumentSetting | undefined = settings.find(d => d.documentType === 'receipt');
      const printerSettings: any = {
        enabled: doc?.enabled ?? true,
        print_mode: doc?.deliveryMode === 'local_agent' ? 'local-agent' : doc?.deliveryMode ?? 'browser',
        printer_name: doc?.printerName || undefined,
        paper_width: doc?.paperWidth ?? 80,
        paperWidth: doc?.paperWidth ?? 80,
      };
      const html = buildReportHtml(report, formatCurrency, formatDateTime);
      await printReceipt(html, REPORT_CSS, printerSettings, undefined, storeId);
    } catch (e: any) {
      toast.error(e?.message || 'Print failed.');
    } finally {
      setPrinting(false);
    }
  };

  const s = report?.session;

  return (
    <Dialog open={!!sessionId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {report ? (report.reportType === 'z' ? 'Z-Report — session closed' : 'X-Report — session snapshot') : 'Register report'}
          </DialogTitle>
          <DialogDescription>
            {s ? `${s.sessionNo || 'Session'} · ${s.storeName || ''}` : 'Loading…'}
          </DialogDescription>
        </DialogHeader>

        {!report && !error && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
          </div>
        )}
        {error && <p className="text-sm text-destructive py-4">{error}</p>}

        {report && s && (
          <div className="text-sm space-y-3 py-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Opened</span>
              <span className="text-right">{formatDateTime(s.openedAt)}{s.openedByName ? ` · ${s.openedByName}` : ''}</span>
              {s.closedAt && <><span className="text-muted-foreground">Closed</span>
              <span className="text-right">{formatDateTime(s.closedAt)}{s.closedByName ? ` · ${s.closedByName}` : ''}</span></>}
              <span className="text-muted-foreground">Opening float</span>
              <span className="text-right tabular-nums">{money(formatCurrency, s.openingFloat)}</span>
            </div>

            <div className="rounded-lg border border-border">
              <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground">SALES BY TENDER</div>
              <div className="px-3 py-1.5 divide-y divide-border/50">
                {report.tenders.length === 0 && <div className="py-1.5 text-muted-foreground">No sales in this window.</div>}
                {report.tenders.map(t => (
                  <div key={t.methodCode} className="py-1.5 flex justify-between">
                    <span>{t.methodName} <span className="text-muted-foreground">({t.txns})</span></span>
                    <span className="tabular-nums">{formatCurrency(Number(t.total))}</span>
                  </div>
                ))}
                <div className="py-1.5 flex justify-between font-semibold">
                  <span>Gross sales ({report.salesCount})</span>
                  <span className="tabular-nums">{formatCurrency(report.grossSales)}</span>
                </div>
              </div>
            </div>

            {report.movements.length > 0 && (
              <div className="rounded-lg border border-border">
                <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground">PAID IN / OUT</div>
                <div className="px-3 py-1.5 divide-y divide-border/50">
                  {report.movements.map(m => (
                    <div key={m.id} className="py-1.5 flex justify-between">
                      <span className="text-muted-foreground">
                        {m.direction === 'paid_in' ? 'In' : 'Out'}{m.reason ? ` — ${m.reason}` : ''}
                      </span>
                      <span className={`tabular-nums ${m.direction === 'paid_in' ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {m.direction === 'paid_in' ? '+' : '−'}{formatCurrency(Number(m.amount))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-medium">
              <span>Expected in register</span>
              <span className="text-right tabular-nums">{formatCurrency(report.expectedCashLive)}</span>
              {report.reportType === 'z' && <>
                <span>Counted cash</span>
                <span className="text-right tabular-nums">{money(formatCurrency, s.countedCash)}</span>
                <span>Variance</span>
                <span className={`text-right tabular-nums ${Number(s.variance) < -0.004 ? 'text-destructive' : Number(s.variance) > 0.004 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {Number(s.variance) > 0 ? '+' : ''}{money(formatCurrency, s.variance)}
                </span>
              </>}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {report && canPrint && (
            <Button onClick={doPrint} disabled={printing}>
              {printing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
              Print
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegisterReportDialog;
