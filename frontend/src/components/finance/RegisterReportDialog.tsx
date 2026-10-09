import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useCurrency, useDateFormatting } from '@/contexts/LocalizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { hasAnyPermission } from '@/utils/permissionUtils';
import { financeService, DrawerReport } from '@/services/financeService';
import { getPrintDocumentSettings, PrintDocumentSetting } from '@/services/printDocumentSettingsService';
import { buildRegisterReportHtml, REGISTER_REPORT_CSS } from '@/utils/registerReportHtml';
import toast from 'react-hot-toast';

interface Props {
  sessionId: string | null;
  storeId: string;
  onClose: () => void;
  /** True right after a register close — honors the store's register_close
   *  auto_print setting by sending the Z-report straight to the configured
   *  route once the report loads. */
  autoPrint?: boolean;
}

const money = (fmt: (n: number) => string, n: number | null | undefined) =>
  n == null ? '—' : fmt(Number(n));

/** Print settings for the register report — the register_close route when the
 *  store configured one, falling back to the receipt route (pre-migration
 *  behavior) so an unconfigured store keeps working. */
function resolveReportSettings(settings: PrintDocumentSetting[]): any {
  const doc = settings.find(d => d.documentType === 'register_close' && d.id)
    || settings.find(d => d.documentType === 'receipt');
  return {
    enabled: doc?.enabled ?? true,
    autoPrint: doc?.autoPrint ?? false,
    print_mode: doc?.deliveryMode === 'local_agent' ? 'local-agent' : doc?.deliveryMode ?? 'browser',
    printer_name: doc?.printerName || undefined,
    paper_width: doc?.paperWidth ?? 80,
    paperWidth: doc?.paperWidth ?? 80,
  };
}

const RegisterReportDialog = ({ sessionId, storeId, onClose, autoPrint = false }: Props) => {
  const { formatCurrency } = useCurrency();
  const { formatDateTime } = useDateFormatting();
  const { user } = useAuth();
  const canPrint = hasAnyPermission(user, ['printer.view', 'printer.settings', 'finance.manage']);

  const [report, setReport] = useState<DrawerReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [showSales, setShowSales] = useState(false);
  const autoPrinted = useRef(false);

  useEffect(() => {
    if (!sessionId) { setReport(null); autoPrinted.current = false; return; }
    setReport(null);
    setError(null);
    setShowSales(false);
    financeService.getDrawerReport(sessionId)
      .then(setReport)
      .catch((e: any) => setError(e.message || 'Failed to load report.'));
  }, [sessionId]);

  const doPrint = async (silent = false) => {
    if (!report || !storeId) return;
    setPrinting(true);
    try {
      const { printReceipt } = await import('@/services/printerService');
      const printerSettings = resolveReportSettings((await getPrintDocumentSettings(storeId)).settings);
      const html = buildRegisterReportHtml(report, formatCurrency, formatDateTime);
      await printReceipt(html, REGISTER_REPORT_CSS, printerSettings, undefined, storeId);
    } catch (e: any) {
      if (!silent) toast.error(e?.message || 'Print failed.');
    } finally {
      setPrinting(false);
    }
  };

  // Auto-print after a register close when the store configured it.
  useEffect(() => {
    if (!autoPrint || !report || report.reportType !== 'z' || autoPrinted.current) return;
    autoPrinted.current = true;
    (async () => {
      try {
        const { settings } = await getPrintDocumentSettings(storeId);
        const doc = settings.find(d => d.documentType === 'register_close' && d.id);
        if (doc?.enabled && doc?.autoPrint && canPrint) {
          await doPrint(true);
          toast.success('Z-report sent to the printer.');
        }
      } catch { /* auto-print is best-effort; the Print button stays */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, autoPrint, storeId]);

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

            {(report.sales?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-border">
                <button type="button" onClick={() => setShowSales(v => !v)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground">
                  SALES IN THIS SESSION ({report.sales.length}{report.salesCount > report.sales.length ? ` of ${report.salesCount}` : ''})
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSales ? 'rotate-180' : ''}`} />
                </button>
                {showSales && (
                  <div className="px-3 py-1.5 divide-y divide-border/50 border-t">
                    {report.sales.map(sale => (
                      <div key={sale.id} className="py-1.5 flex justify-between gap-2">
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{sale.documentNumber || `#${sale.id.slice(0, 8)}`}</span>
                          <span className="text-muted-foreground"> · {formatDateTime(sale.createdAt)}{sale.cashierName ? ` · ${sale.cashierName}` : ''}{sale.tenderIds ? ` · ${sale.tenderIds}` : ''}</span>
                        </span>
                        <span className="tabular-nums shrink-0">{formatCurrency(Number(sale.total))}</span>
                      </div>
                    ))}
                    {report.salesCount > report.sales.length && (
                      <div className="py-1.5 text-xs text-muted-foreground">Showing first {report.sales.length} — use Sales reports for the full list.</div>
                    )}
                  </div>
                )}
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
