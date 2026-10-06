/**
 * Layaway Print Service
 * Generates print-ready HTML for:
 *  - Layaway Agreement  (A4, detailed, created at plan signup)
 *  - Payment Receipt    (thermal 80mm, issued after each payment)
 *  - Account Statement  (A4, on-demand full history)
 *  - Completion Notice  (thermal 80mm, when plan is fully paid)
 */

import { Layaway } from './jewelryOpsService';
import { printReceipt, getPrinterSettings, PrinterSettings } from './printerService';

/* ─── helpers ──────────────────────────────────────────────────────────────── */

const fmt = (n: number | null | undefined, currency = 'INR') =>
  n == null
    ? '—'
    : new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDatetime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const customerName = (plan: Layaway) =>
  [plan.customerFirstName, plan.customerLastName].filter(Boolean).join(' ') || 'Walk-in Customer';

const getStoreId = () => localStorage.getItem('store_id') || '';

/* ─── Agreement CSS — compact one-page A4 ───────────────────────────────────── */

const AGREEMENT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, 'Segoe UI', sans-serif;
    font-size: 10.5px;
    color: #111;
    background: #fff;
    padding: 14px 18px;
  }
  @media print {
    body { padding: 0; }
    @page { size: A4; margin: 8mm 10mm; }
  }
  /* ── header ── */
  .header { display: flex; justify-content: space-between; align-items: center;
            border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .store-name { font-size: 16px; font-weight: 900; letter-spacing: -0.3px; }
  .store-sub  { font-size: 9px; color: #555; margin-top: 2px; line-height: 1.5; }
  .doc-title  { text-align: right; }
  .doc-title h1 { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .doc-title p  { font-size: 9px; color: #666; margin-top: 2px; font-family: monospace; }
  /* ── info row ── */
  .info-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .info-box { border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; }
  .info-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 4px; }
  .info-val   { font-size: 10px; font-weight: 600; }
  .info-sub   { font-size: 9px; color: #555; margin-top: 1px; line-height: 1.4; }
  /* ── totals bar ── */
  .totals-bar { display: grid; grid-template-columns: repeat(4, 1fr);
                border: 1px solid #ddd; border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
  .total-cell { padding: 6px 8px; text-align: center; border-right: 1px solid #ddd; }
  .total-cell:last-child { border-right: none; }
  .total-cell .tc-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.6px; color: #888; }
  .total-cell .tc-val   { font-size: 12px; font-weight: 800; margin-top: 2px; }
  .total-cell.balance .tc-val { color: #dc2626; }
  .total-cell.paid    .tc-val { color: #16a34a; }
  /* ── progress ── */
  .progress-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; font-size: 9px; color: #555; }
  .bar { flex: 1; height: 5px; background: #e5e7eb; border-radius: 99px; overflow: hidden; }
  .bar-fill { height: 100%; background: #16a34a; border-radius: 99px; }
  /* ── two-col tables ── */
  .tables-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .section-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #444; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f3f4f6; }
  th { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; color: #666;
       padding: 4px 6px; text-align: left; border-bottom: 1px solid #ddd; }
  th.r, td.r { text-align: right; }
  td { font-size: 9.5px; padding: 3px 6px; border-bottom: 1px solid #f0f0f0; }
  tr.alt td { background: #fafafa; }
  tr:last-child td { border-bottom: none; }
  tr.paid  td { color: #16a34a; }
  tr.overdue td { color: #dc2626; font-weight: 600; }
  /* ── bottom row: terms + signatures ── */
  .bottom-row { display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-top: 8px; }
  .terms { border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; background: #fafafa; }
  .terms .section-label { margin-bottom: 3px; }
  .terms ol { padding-left: 14px; font-size: 8.5px; color: #555; line-height: 1.7; }
  .sigs { display: flex; flex-direction: column; gap: 12px; justify-content: flex-end; }
  .sig-line { border-top: 1px solid #555; padding-top: 3px; font-size: 8.5px; color: #666; text-align: center; margin-top: 24px; }
  .footer { margin-top: 6px; font-size: 8.5px; color: #bbb; text-align: center; border-top: 1px solid #eee; padding-top: 5px; }
`;

/* ─── Statement CSS — full-detail A4 ────────────────────────────────────────── */

const STATEMENT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, 'Segoe UI', sans-serif;
    font-size: 11px;
    color: #111;
    background: #fff;
    padding: 18px 22px;
  }
  @media print {
    body { padding: 0; }
    @page { size: A4; margin: 10mm 12mm; }
    .page-break { page-break-before: always; }
  }
  .header { display: flex; justify-content: space-between; align-items: center;
            border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 12px; }
  .store-name { font-size: 18px; font-weight: 900; }
  .store-sub  { font-size: 9.5px; color: #555; margin-top: 3px; line-height: 1.5; }
  .doc-title  { text-align: right; }
  .doc-title h1 { font-size: 15px; font-weight: 800; }
  .doc-title p  { font-size: 9.5px; color: #666; font-family: monospace; margin-top: 2px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .box { border: 1px solid #ddd; border-radius: 5px; padding: 8px 10px; }
  .box-label { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 5px; }
  .box-row { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 3px; }
  .box-row span:last-child { font-weight: 600; }
  .totals { display: grid; grid-template-columns: repeat(3,1fr); border: 1px solid #ddd; border-radius: 5px; overflow: hidden; margin-bottom: 10px; }
  .tc { padding: 7px 10px; text-align: center; border-right: 1px solid #ddd; }
  .tc:last-child { border-right: none; }
  .tc-label { font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }
  .tc-val   { font-size: 14px; font-weight: 800; margin-top: 2px; }
  .tc.balance .tc-val { color: #dc2626; }
  .tc.paid    .tc-val { color: #16a34a; }
  .progress-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 9.5px; color: #555; }
  .bar { flex: 1; height: 5px; background: #e5e7eb; border-radius: 99px; overflow: hidden; }
  .bar-fill { height: 100%; background: #16a34a; }
  .sec-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #333; margin: 10px 0 4px; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #f3f4f6; }
  th { font-size: 9px; font-weight: 700; text-transform: uppercase; color: #666; padding: 5px 7px; text-align: left; border-bottom: 1px solid #ddd; }
  th.r, td.r { text-align: right; }
  td { font-size: 10px; padding: 4px 7px; border-bottom: 1px solid #f0f0f0; }
  tr.alt td { background: #fafafa; }
  tr:last-child td { border-bottom: none; }
  tr.paid  td { color: #16a34a; }
  tr.overdue td { color: #dc2626; font-weight: 600; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 99px; font-size: 9px; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-amber { background: #fef9c3; color: #854d0e; }
  .badge-blue  { background: #dbeafe; color: #1e40af; }
  .badge-red   { background: #fee2e2; color: #991b1b; }
  .footer { margin-top: 12px; font-size: 9px; color: #bbb; text-align: center; border-top: 1px solid #eee; padding-top: 6px; }
`;

/* ─── shared thermal CSS ─────────────────────────────────────────────────────── */

const THERMAL_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    color: #000;
    background: #fff;
    width: 80mm;
    margin: 0 auto;
    padding: 4px 2px;
  }
  @media print {
    @page { size: 80mm auto; margin: 0; }
    body { padding: 2px 0; }
  }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }
  .divider { border-top: 1px dashed #000; margin: 6px 0; }
  .store-name { font-size: 15px; font-weight: 900; text-align: center; letter-spacing: 0.5px; }
  .plan-no  { font-size: 11px; text-align: center; margin: 2px 0; }
  .doc-type { font-size: 13px; font-weight: 700; text-align: center; margin: 5px 0 2px; letter-spacing: 0.5px; }
  .row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
  .row .label { color: #444; }
  .row .val   { font-weight: 600; text-align: right; }
  .amount-box { border: 1px solid #000; margin: 8px 0; padding: 6px; text-align: center; }
  .amount-box .amt { font-size: 20px; font-weight: 900; }
  .amount-box .sub { font-size: 10px; color: #444; margin-top: 2px; }
  .item-row { font-size: 11px; margin: 2px 0; }
  .balance-row { font-size: 13px; font-weight: 700; display: flex; justify-content: space-between; padding: 4px 0; border-top: 1px solid #000; margin-top: 4px; }
  .thank-you { text-align: center; font-size: 11px; margin-top: 6px; }
  .footer { text-align: center; font-size: 10px; color: #666; margin-top: 4px; }
`;

/* ════════════════════════════════════════════════════════════════════════════
   1. LAYAWAY AGREEMENT  (A4)
════════════════════════════════════════════════════════════════════════════ */

export interface AgreementData {
  plan: Layaway;
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  logoUrl?: string;
  currency?: string;
}

export const generateAgreementHtml = (d: AgreementData): string => {
  const { plan } = d;
  const cur = d.currency || 'INR';
  const items = plan.items ?? [];
  const paidPct = plan.paidPct ?? 0;
  const balance = plan.balance ?? (plan.totalAmount - plan.paidAmount);
  const todayStr = new Date().toISOString().slice(0, 10);

  const scheduleRows = buildInstSchedule(
    plan.startDate, plan.frequency,
    plan.installmentCount ?? 1, plan.installmentAmount ?? 0,
  );
  const paidInstCount = Math.max(0, Math.floor((plan.paidAmount - plan.downPayment) / (plan.installmentAmount || 1)));

  const itemRows = items.map((it, i) => {
    const qty = it.quantity ?? 1;
    const price = it.unit_price ?? (it as any).unitPrice ?? 0;
    const total = it.line_total ?? (it as any).lineTotal ?? qty * price;
    return `<tr class="${i % 2 ? 'alt' : ''}">
      <td>${it.description || 'Item'}</td>
      <td class="r">${qty}</td>
      <td class="r">${fmt(price, cur)}</td>
      <td class="r">${fmt(total, cur)}</td>
    </tr>`;
  }).join('');

  const schRows = scheduleRows.map((s, i) => {
    const isPaid = i < paidInstCount;
    const isOD = !isPaid && s.dueDate < todayStr;
    const cls = isPaid ? 'paid' : isOD ? 'overdue' : '';
    const status = isPaid ? '✓' : isOD ? 'OVERDUE' : '—';
    return `<tr class="${cls}"><td>${s.no}</td><td>${fmtDate(s.dueDate)}</td><td class="r">${fmt(s.amount, cur)}</td><td>${status}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Layaway Agreement — ${plan.planNo}</title><style>${AGREEMENT_CSS}</style></head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="store-name">${d.storeName || 'Store'}</div>
      <div class="store-sub">${[d.storeAddress, d.storePhone ? 'Ph: ' + d.storePhone : '', d.storeEmail].filter(Boolean).join(' · ')}</div>
    </div>
    <div class="doc-title">
      <h1>Layaway Agreement</h1>
      <p>${plan.planNo} &nbsp;·&nbsp; ${fmtDatetime()}</p>
    </div>
  </div>

  <!-- 3-COLUMN INFO STRIP -->
  <div class="info-row">
    <div class="info-box">
      <div class="info-label">Customer</div>
      <div class="info-val">${customerName(plan)}</div>
      <div class="info-sub">${[plan.customerPhone, plan.customerEmail].filter(Boolean).join(' · ') || '—'}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Plan</div>
      <div class="info-val" style="font-family:monospace">${plan.planNo}</div>
      <div class="info-sub">${fmtDate(plan.startDate)} → ${fmtDate(plan.dueDate)}<br>
        <span style="text-transform:capitalize">${plan.frequency}</span> · ${plan.installmentCount} instalments</div>
    </div>
    <div class="info-box">
      <div class="info-label">Each Instalment</div>
      <div class="info-val" style="font-size:14px">${fmt(plan.installmentAmount, cur)}</div>
      <div class="info-sub">Status: <strong style="text-transform:capitalize">${plan.status}</strong></div>
    </div>
  </div>

  <!-- TOTALS BAR -->
  <div class="totals-bar">
    <div class="total-cell">
      <div class="tc-label">Plan Total</div>
      <div class="tc-val">${fmt(plan.totalAmount, cur)}</div>
    </div>
    <div class="total-cell paid">
      <div class="tc-label">Down Payment</div>
      <div class="tc-val">${fmt(plan.downPayment, cur)}</div>
    </div>
    <div class="total-cell paid">
      <div class="tc-label">Total Paid</div>
      <div class="tc-val">${fmt(plan.paidAmount, cur)}</div>
    </div>
    <div class="total-cell balance">
      <div class="tc-label">Balance Due</div>
      <div class="tc-val">${fmt(balance, cur)}</div>
    </div>
  </div>

  <!-- PROGRESS BAR -->
  <div class="progress-row">
    <span>Payment progress</span>
    <div class="bar"><div class="bar-fill" style="width:${Math.min(paidPct, 100)}%"></div></div>
    <span><strong>${Math.round(paidPct)}%</strong> paid</span>
  </div>

  <!-- ITEMS + SCHEDULE side by side -->
  <div class="tables-row">
    <div>
      <div class="section-label">Reserved Items</div>
      <table>
        <thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Total</th></tr></thead>
        <tbody>${itemRows || '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:6px">No items</td></tr>'}</tbody>
      </table>
    </div>
    <div>
      <div class="section-label">Instalment Schedule</div>
      <table>
        <thead><tr><th>#</th><th>Due Date</th><th class="r">Amount</th><th>Status</th></tr></thead>
        <tbody>${schRows || '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:6px">—</td></tr>'}</tbody>
      </table>
    </div>
  </div>

  <!-- TERMS + SIGNATURES -->
  <div class="bottom-row">
    <div class="terms">
      <div class="section-label">Terms &amp; Conditions</div>
      <ol>
        <li>Reserved items are held until the due date or full payment, whichever comes first.</li>
        <li>Instalments are due on scheduled dates; late payments may attract a penalty.</li>
        <li>Items are released only upon full payment. No exchanges once plan is active.</li>
        <li>Cancellations attract a processing fee; balance refunded after deduction.</li>
        <li>The store may cancel the plan after 30 days of non-payment.</li>
      </ol>
    </div>
    <div class="sigs">
      <div><div class="sig-line">Customer Signature &amp; Date</div></div>
      <div><div class="sig-line">Authorised Staff &amp; Date</div></div>
    </div>
  </div>

  <div class="footer">Computer-generated document · ${d.storeName || ''} · ${plan.planNo} · ${fmtDatetime()}</div>
</body>
</html>`;
};

/* ════════════════════════════════════════════════════════════════════════════
   2. PAYMENT RECEIPT  (thermal 80mm)
════════════════════════════════════════════════════════════════════════════ */

export interface PaymentReceiptData {
  plan: Layaway;
  paymentAmount: number;
  paymentMethod: string;
  reference?: string | null;
  newPaidAmount: number;
  newBalance: number;
  isComplete?: boolean;
  storeName?: string;
  storePhone?: string;
  currency?: string;
  receiptNo?: string;
}

export const generatePaymentReceiptHtml = (d: PaymentReceiptData): { html: string; css: string } => {
  const cur = d.currency || 'INR';
  const methodLabel: Record<string, string> = {
    cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank Transfer', cheque: 'Cheque',
  };
  const mLabel = methodLabel[d.paymentMethod?.toLowerCase()] || d.paymentMethod || 'Cash';

  const html = `
<div class="center">
  <div class="store-name">${d.storeName || 'Store'}</div>
  ${d.storePhone ? `<div style="font-size:11px;margin-top:2px">${d.storePhone}</div>` : ''}
  <div class="divider"></div>
  <div class="doc-type">PAYMENT RECEIPT</div>
  <div class="plan-no">${d.plan.planNo}</div>
  ${d.receiptNo ? `<div style="font-size:10px;color:#555">Rcpt#: ${d.receiptNo}</div>` : ''}
  <div style="font-size:10px;margin-top:2px">${fmtDatetime()}</div>
</div>

<div class="divider"></div>

<div class="row"><span class="label">Customer</span><span class="val">${customerName(d.plan)}</span></div>
${d.plan.customerPhone ? `<div class="row"><span class="label">Phone</span><span class="val">${d.plan.customerPhone}</span></div>` : ''}
<div class="row"><span class="label">Payment Method</span><span class="val">${mLabel}</span></div>
${d.reference ? `<div class="row"><span class="label">Reference</span><span class="val">${d.reference}</span></div>` : ''}

<div class="divider"></div>

<div class="amount-box">
  <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#555;margin-bottom:4px">Amount Paid</div>
  <div class="amt">${fmt(d.paymentAmount, cur)}</div>
</div>

<div class="row"><span class="label">Total Amount</span><span class="val">${fmt(d.plan.totalAmount, cur)}</span></div>
<div class="row"><span class="label">Previously Paid</span><span class="val">${fmt(d.newPaidAmount - d.paymentAmount, cur)}</span></div>
<div class="row"><span class="label">This Payment</span><span class="val">${fmt(d.paymentAmount, cur)}</span></div>
<div class="balance-row"><span>BALANCE DUE</span><span>${fmt(d.newBalance, cur)}</span></div>

<div class="divider"></div>

${d.isComplete ? `
<div class="center bold" style="font-size:13px;padding:6px 0">
  ✓ PLAN COMPLETE — READY FOR PICKUP
</div>
<div class="divider"></div>
` : ''}

<div class="thank-you">Thank you for your payment!</div>
<div class="footer">Items held until full payment received.</div>
<div class="footer">${d.plan.planNo} · ${fmtDate(new Date().toISOString().slice(0, 10))}</div>
<div style="margin-top:10px"></div>`;

  return { html, css: THERMAL_CSS };
};

/* ════════════════════════════════════════════════════════════════════════════
   3. ACCOUNT STATEMENT  (A4, on-demand)
════════════════════════════════════════════════════════════════════════════ */

export const generateStatementHtml = (d: AgreementData): string => {
  const { plan } = d;
  const cur = d.currency || 'INR';
  const items = plan.items ?? [];
  const payments = plan.payments ?? [];
  const balance = plan.balance ?? (plan.totalAmount - plan.paidAmount);
  const paidPct = plan.paidPct ?? 0;

  const itemRows = items.map((it, i) => `
    <tr class="${i % 2 ? 'alt' : ''}">
      <td>${it.description || 'Item'}</td>
      <td class="r">${it.quantity ?? 1}</td>
      <td class="r">${fmt(it.unit_price ?? (it as any).unitPrice, cur)}</td>
      <td class="r">${fmt(it.line_total ?? (it as any).lineTotal ?? (it.quantity ?? 1) * (it.unit_price ?? (it as any).unitPrice ?? 0), cur)}</td>
    </tr>`).join('');

  const payRows = payments.map((p, i) => {
    const isDown = p.notes === 'Down payment';
    const instNo = isDown ? 0 : payments.filter((x: any, xi: number) => xi < i && x.notes !== 'Down payment').length + 1;
    return `<tr class="${i % 2 ? 'alt' : ''}">
      <td>${fmtDatetime(p.paid_at || p.paidAt)}</td>
      <td>${isDown ? '<span class="badge badge-amber">Down Payment</span>' : `<span class="badge badge-green">Inst. ${instNo}</span>`}</td>
      <td>${p.payment_method || p.paymentMethod || '—'}</td>
      <td>${p.reference || p.ref || '—'}</td>
      <td class="r" style="font-weight:600;color:#16a34a">${fmt(Number(p.amount), cur)}</td>
    </tr>`;
  }).join('');

  const scheduleRows = buildInstSchedule(plan.startDate, plan.frequency, plan.installmentCount ?? 1, plan.installmentAmount ?? 0);
  const paidCount = payments.filter((p: any) => p.notes !== 'Down payment').length;
  const todayStr2 = new Date().toISOString().slice(0, 10);
  const schRows = scheduleRows.map((s, i) => {
    const isPaid = i < paidCount;
    const isOD = !isPaid && s.dueDate < todayStr2;
    const cls = isPaid ? 'paid' : isOD ? 'overdue' : '';
    const badge = isPaid
      ? '<span class="badge badge-green">Paid</span>'
      : isOD ? '<span class="badge badge-red">Overdue</span>'
      : '<span class="badge badge-blue">Upcoming</span>';
    const mp = isPaid ? payments.filter((p: any) => p.notes !== 'Down payment')[i] : null;
    return `<tr class="${cls}">
      <td>${s.no}</td><td>${fmtDate(s.dueDate)}</td>
      <td class="r">${fmt(s.amount, cur)}</td>
      <td>${mp ? fmtDatetime(mp.paid_at || mp.paidAt) : '—'}</td>
      <td>${badge}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Layaway Statement — ${plan.planNo}</title><style>${STATEMENT_CSS}</style></head>
<body>
  <div class="header">
    <div>
      <div class="store-name">${d.storeName || 'Store'}</div>
      <div class="store-sub">${[d.storeAddress, d.storePhone ? 'Ph: ' + d.storePhone : '', d.storeEmail].filter(Boolean).join(' · ')}</div>
    </div>
    <div class="doc-title">
      <h1>Account Statement</h1>
      <p>${plan.planNo} &nbsp;·&nbsp; Printed: ${fmtDatetime()}</p>
    </div>
  </div>

  <div class="two-col">
    <div class="box">
      <div class="box-label">Customer</div>
      <div style="font-size:13px;font-weight:700;margin-bottom:4px">${customerName(plan)}</div>
      ${plan.customerPhone ? `<div class="box-row"><span>Phone</span><span>${plan.customerPhone}</span></div>` : ''}
      ${plan.customerEmail ? `<div class="box-row"><span>Email</span><span>${plan.customerEmail}</span></div>` : ''}
    </div>
    <div class="box">
      <div class="box-label">Plan Details</div>
      <div class="box-row"><span>Plan No</span><span style="font-family:monospace">${plan.planNo}</span></div>
      <div class="box-row"><span>Period</span><span>${fmtDate(plan.startDate)} → ${fmtDate(plan.dueDate)}</span></div>
      <div class="box-row"><span>Frequency</span><span style="text-transform:capitalize">${plan.frequency} · ${plan.installmentCount} instalments</span></div>
      <div class="box-row"><span>Status</span><span style="text-transform:capitalize;font-weight:700">${plan.status}</span></div>
    </div>
  </div>

  <div class="totals">
    <div class="tc"><div class="tc-label">Plan Total</div><div class="tc-val">${fmt(plan.totalAmount, cur)}</div></div>
    <div class="tc paid"><div class="tc-label">Total Paid</div><div class="tc-val">${fmt(plan.paidAmount, cur)}</div></div>
    <div class="tc balance"><div class="tc-label">Balance Due</div><div class="tc-val">${fmt(balance, cur)}</div></div>
  </div>
  <div class="progress-row">
    <span>Progress</span>
    <div class="bar"><div class="bar-fill" style="width:${Math.min(paidPct, 100)}%"></div></div>
    <span><strong>${Math.round(paidPct)}%</strong> paid</span>
  </div>

  <div class="sec-title">Reserved Items</div>
  <table>
    <thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Unit Price</th><th class="r">Total</th></tr></thead>
    <tbody>${itemRows || '<tr><td colspan="4" style="text-align:center;color:#aaa;padding:8px">No items</td></tr>'}</tbody>
  </table>

  <div class="sec-title">Payment History (${payments.length})</div>
  <table>
    <thead><tr><th>Date &amp; Time</th><th>Type</th><th>Method</th><th>Reference</th><th class="r">Amount</th></tr></thead>
    <tbody>${payRows || '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:8px">No payments</td></tr>'}</tbody>
  </table>

  <div class="sec-title">Instalment Schedule</div>
  <table>
    <thead><tr><th>#</th><th>Due Date</th><th class="r">Amount</th><th>Paid On</th><th>Status</th></tr></thead>
    <tbody>${schRows || '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:8px">No schedule</td></tr>'}</tbody>
  </table>

  <div class="footer">Account Statement · ${d.storeName || ''} · ${plan.planNo} · ${fmtDatetime()}</div>
</body>
</html>`;
};

/* ════════════════════════════════════════════════════════════════════════════
   4. COMPLETION NOTICE  (thermal 80mm)
════════════════════════════════════════════════════════════════════════════ */

export const generateCompletionNoticeHtml = (d: PaymentReceiptData): { html: string; css: string } => {
  const cur = d.currency || 'INR';
  const items = d.plan.items ?? [];

  const html = `
<div class="center">
  <div class="store-name">${d.storeName || 'Store'}</div>
  ${d.storePhone ? `<div style="font-size:11px;margin-top:2px">${d.storePhone}</div>` : ''}
  <div class="divider"></div>
  <div class="doc-type">✓ LAYAWAY COMPLETE</div>
  <div class="doc-type" style="font-size:12px">COLLECTION NOTICE</div>
  <div class="plan-no">${d.plan.planNo}</div>
  <div style="font-size:10px;margin-top:2px">${fmtDatetime()}</div>
</div>

<div class="divider"></div>

<div class="row"><span class="label">Customer</span><span class="val">${customerName(d.plan)}</span></div>
${d.plan.customerPhone ? `<div class="row"><span class="label">Phone</span><span class="val">${d.plan.customerPhone}</span></div>` : ''}

<div class="divider"></div>

<div class="center bold" style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Items Ready for Collection</div>
${items.map(it => `
<div class="item-row">· ${it.description || 'Item'}${it.quantity > 1 ? ` × ${it.quantity}` : ''}</div>
`).join('')}

<div class="divider"></div>

<div class="row"><span class="label">Total Plan Value</span><span class="val">${fmt(d.plan.totalAmount, cur)}</span></div>
<div class="row"><span class="label">Total Paid</span><span class="val">${fmt(d.plan.paidAmount, cur)}</span></div>
<div class="row" style="font-weight:700"><span>BALANCE</span><span>${fmt(0, cur)}</span></div>

<div class="divider"></div>

<div class="thank-you bold" style="font-size:13px">Thank you for your patience!</div>
<div class="thank-you" style="margin-top:4px">Please present this slip to collect your item(s).</div>
<div class="footer" style="margin-top:8px">${d.plan.planNo} · ${fmtDate(new Date().toISOString().slice(0, 10))}</div>
<div style="margin-top:12px"></div>`;

  return { html, css: THERMAL_CSS };
};

/* ════════════════════════════════════════════════════════════════════════════
   ACTIONS — call these from the UI
════════════════════════════════════════════════════════════════════════════ */

interface StoreContext {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  currency?: string;
}

/** Open browser print dialog for A4 documents (Agreement / Statement). */
export const printA4Document = (html: string) => {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
};

/** Print payment receipt via store's configured printer (thermal or browser). */
export const printPaymentReceipt = async (data: PaymentReceiptData) => {
  const { html, css } = generatePaymentReceiptHtml(data);
  const storeId = getStoreId();
  let settings: PrinterSettings | null = null;
  if (storeId) {
    try { settings = await getPrinterSettings(storeId); } catch {}
  }
  return printReceipt(html, css, settings, undefined, storeId || undefined);
};

/** Print completion notice via store's configured printer. */
export const printCompletionNotice = async (data: PaymentReceiptData) => {
  const { html, css } = generateCompletionNoticeHtml(data);
  const storeId = getStoreId();
  let settings: PrinterSettings | null = null;
  if (storeId) {
    try { settings = await getPrinterSettings(storeId); } catch {}
  }
  return printReceipt(html, css, settings, undefined, storeId || undefined);
};

/** Print layaway agreement as A4. */
export const printAgreement = (plan: Layaway, store: StoreContext) => {
  printA4Document(generateAgreementHtml({ plan, ...store }));
};

/** Print account statement as A4. */
export const printStatement = (plan: Layaway, store: StoreContext) => {
  printA4Document(generateStatementHtml({ plan, ...store }));
};

/* ─── schedule helper ───────────────────────────────────────────────────────── */

function buildInstSchedule(
  startDate: string,
  frequency: string,
  count: number,
  amount: number,
): { no: number; dueDate: string; amount: number }[] {
  const result = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(startDate);
    if (frequency === 'weekly')   d.setDate(d.getDate() + (i + 1) * 7);
    else if (frequency === 'biweekly') d.setDate(d.getDate() + (i + 1) * 14);
    else d.setMonth(d.getMonth() + i + 1);
    result.push({ no: i + 1, dueDate: d.toISOString().slice(0, 10), amount });
  }
  return result;
}
