import type { DrawerReport } from '@/services/financeService';

export const REGISTER_REPORT_CSS = `
  body { margin: 0; padding: 8px; }
  @media print { body { margin: 0; } }
`;

/** Minimal thermal-friendly HTML for the register X/Z report — printed through
 *  the same pipeline as receipts (local agent / network / browser). */
export function buildRegisterReportHtml(
  report: DrawerReport,
  fmt: (n: number) => string,
  fmtDT: (d: string) => string,
): string {
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

/** Sample Z-report for route test-prints in Printer Settings — shape matches
 *  DrawerReport so the real builder renders it unchanged. */
export function sampleRegisterReport(storeName: string): DrawerReport {
  const now = new Date();
  const opened = new Date(now.getTime() - 8 * 3600_000);
  return {
    reportType: 'z',
    session: {
      id: 'sample', sessionNo: 'REG-0000', storeName,
      openedAt: opened.toISOString(), closedAt: now.toISOString(),
      openedByName: 'Test Cashier', closedByName: 'Test Manager',
      openingFloat: 200, countedCash: 1245.5, variance: 0,
    } as DrawerReport['session'],
    tenders: [
      { methodCode: 'cash', methodName: 'Cash', total: 1045.5, txns: 12 },
      { methodCode: 'card', methodName: 'Card', total: 623.0, txns: 7 },
    ],
    movements: [
      { id: 'm1', direction: 'paid_out', amount: 40, reason: 'Petty cash' } as DrawerReport['movements'][number],
    ],
    sales: [],
    salesCount: 19,
    grossSales: 1668.5,
    expectedCashLive: 1245.5,
  };
}
