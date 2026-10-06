/**
 * Repair Print Service
 * Generates print-ready HTML for:
 *  - Job Card  (A4, compact one page — printed at intake)
 *  - Collection Receipt (thermal 80mm — printed when ready/delivered)
 */

import { RepairOrder } from './repairService';
import { printReceipt, getPrinterSettings } from './printerService';

/* ─── helpers ──────────────────────────────────────────────────────────────── */
const fmt = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDatetime = () =>
  new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const custName = (o: RepairOrder) =>
  [o.customerFirstName, o.customerLastName].filter(Boolean).join(' ') || 'Walk-in Customer';

const getStoreId = () => (typeof localStorage !== 'undefined' ? localStorage.getItem('store_id') || '' : '');

/* ─── Store context type ────────────────────────────────────────────────────── */
export interface RepairStoreCtx {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
}

/* ════════════════════════════════════════════════════════════════════════════
   JOB CARD CSS  — compact A4
════════════════════════════════════════════════════════════════════════════ */
const JOB_CARD_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, 'Segoe UI', sans-serif; font-size: 10.5px; color: #111; background: #fff; padding: 14px 18px; }
  @media print { body { padding: 0; } @page { size: A4; margin: 8mm 10mm; } }
  .header { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; }
  .store-name { font-size: 16px; font-weight: 900; letter-spacing: -0.3px; }
  .store-sub  { font-size: 9px; color: #555; margin-top: 2px; line-height: 1.5; }
  .doc-title  { text-align: right; }
  .doc-title h1 { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
  .doc-title p  { font-size: 9px; color: #666; margin-top: 2px; font-family: monospace; }
  .info-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .info-box { border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; }
  .info-label { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 3px; }
  .info-val   { font-size: 10px; font-weight: 600; }
  .info-sub   { font-size: 9px; color: #555; margin-top: 1px; }
  .totals-bar { display: grid; grid-template-columns: repeat(4, 1fr);
                border: 1px solid #ddd; border-radius: 4px; overflow: hidden; margin-bottom: 8px; }
  .total-cell { padding: 6px 8px; text-align: center; border-right: 1px solid #ddd; }
  .total-cell:last-child { border-right: none; }
  .total-cell .tc-label { font-size: 8px; text-transform: uppercase; letter-spacing: 0.6px; color: #888; }
  .total-cell .tc-val   { font-size: 12px; font-weight: 800; margin-top: 2px; }
  .total-cell.balance .tc-val { color: #dc2626; }
  .total-cell.paid    .tc-val { color: #16a34a; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
  .section-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #444; margin-bottom: 4px; border-bottom: 1px solid #eee; padding-bottom: 3px; }
  .field-box { border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; margin-bottom: 6px; }
  .field-label { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #888; margin-bottom: 2px; }
  .field-val { font-size: 10px; color: #111; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; }
  th { background: #f3f4f6; font-size: 8px; font-weight: 700; text-transform: uppercase; color: #666;
       padding: 4px 6px; text-align: left; border: 1px solid #e5e7eb; }
  td { padding: 4px 6px; border: 1px solid #e5e7eb; vertical-align: top; }
  .bottom-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #ddd; }
  .terms-list { font-size: 8.5px; color: #555; line-height: 1.6; }
  .terms-list li { margin-bottom: 2px; }
  .sig-line { border-top: 1px solid #aaa; margin-top: 24px; padding-top: 3px; font-size: 8px; color: #666; text-align: center; }
  .printed-at { font-size: 7.5px; color: #aaa; text-align: right; margin-top: 6px; }
`;

/* ════════════════════════════════════════════════════════════════════════════
   THERMAL CSS  — 80mm receipt
════════════════════════════════════════════════════════════════════════════ */
const THERMAL_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; font-size: 12px; width: 72mm; margin: 0 auto; padding: 4mm 3mm; color: #000; background: #fff; }
  @media print { @page { size: 80mm auto; margin: 0; } }
  .center { text-align: center; }
  .store-name { font-size: 15px; font-weight: 900; }
  .divider { border-top: 1px dashed #aaa; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
  .row .label { color: #555; }
  .bold { font-weight: 700; }
  .total-row { display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; margin-top: 4px; }
  .thank-you { text-align: center; font-size: 10px; color: #666; margin-top: 6px; }
  .ticket { font-size: 14px; font-weight: 900; text-align: center; margin: 4px 0; letter-spacing: 1px; }
`;

/* ════════════════════════════════════════════════════════════════════════════
   GENERATE JOB CARD HTML
════════════════════════════════════════════════════════════════════════════ */
export function generateJobCardHtml(order: RepairOrder, store: RepairStoreCtx): string {
  const balance = (order.finalCost ?? order.estimatedCost ?? 0) - (order.advancePaid ?? 0);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Job Card – ${order.ticketNo}</title>
<style>${JOB_CARD_CSS}</style></head>
<body>
  <!-- HEADER -->
  <div class="header">
    <div>
      <div class="store-name">${store.storeName ?? 'Store'}</div>
      <div class="store-sub">${store.storeAddress ?? ''}${store.storePhone ? ` · ${store.storePhone}` : ''}</div>
    </div>
    <div class="doc-title">
      <h1>Repair Job Card</h1>
      <p>${order.ticketNo} · ${fmtDate(order.receivedDate)}</p>
    </div>
  </div>

  <!-- INFO ROW -->
  <div class="info-row">
    <div class="info-box">
      <div class="info-label">Customer</div>
      <div class="info-val">${custName(order)}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Item</div>
      <div class="info-val">${order.itemDescription}</div>
      <div class="info-sub">${order.metal ?? ''}${order.weight ? ` · ${order.weight}g` : ''}</div>
    </div>
    <div class="info-box">
      <div class="info-label">Promise Date</div>
      <div class="info-val" style="color:${order.promisedDate ? '#dc2626' : '#111'}">${fmtDate(order.promisedDate)}</div>
    </div>
  </div>

  <!-- TOTALS BAR -->
  <div class="totals-bar">
    <div class="total-cell">
      <div class="tc-label">Estimated</div>
      <div class="tc-val">${fmt(order.estimatedCost)}</div>
    </div>
    <div class="total-cell paid">
      <div class="tc-label">Advance Paid</div>
      <div class="tc-val">${fmt(order.advancePaid ?? 0)}</div>
    </div>
    <div class="total-cell balance">
      <div class="tc-label">Balance Due</div>
      <div class="tc-val">${balance > 0 ? fmt(balance) : '—'}</div>
    </div>
    <div class="total-cell">
      <div class="tc-label">Status</div>
      <div class="tc-val" style="font-size:10px;text-transform:capitalize">${order.status.replace('_', ' ')}</div>
    </div>
  </div>

  <!-- TWO-COLUMN DETAIL -->
  <div class="two-col">
    <div>
      <div class="section-label">Problem Description</div>
      <div class="field-box">
        <div class="field-val">${order.problemDescription || '—'}</div>
      </div>
      <div class="section-label">Work Required</div>
      <div class="field-box">
        <div class="field-val">${order.workRequired || '—'}</div>
      </div>
    </div>
    <div>
      <div class="section-label">Notes / Condition</div>
      <div class="field-box" style="min-height:60px">
        <div class="field-val" style="white-space:pre-wrap">${order.notes || '—'}</div>
      </div>
      <div class="section-label">Goldsmith / Workshop</div>
      <div class="field-box">
        <div class="field-val">___________________________</div>
      </div>
    </div>
  </div>

  <!-- TERMS + SIGNATURES -->
  <div class="bottom-row">
    <div>
      <div class="section-label">Terms &amp; Conditions</div>
      <ul class="terms-list">
        <li>Items uncollected after 60 days may be disposed of.</li>
        <li>Store is not liable for pre-existing defects not noted here.</li>
        <li>Final cost may vary; customer will be informed before work.</li>
        <li>Advance is non-refundable if customer cancels after work starts.</li>
        <li>Present this card to collect your item.</li>
      </ul>
    </div>
    <div>
      <div class="sig-line">Customer Signature</div>
      <div class="sig-line" style="margin-top:20px">Received By</div>
    </div>
  </div>

  <div class="printed-at">Printed ${fmtDatetime()}</div>
</body></html>`;
}

/* ════════════════════════════════════════════════════════════════════════════
   GENERATE COLLECTION RECEIPT HTML  (thermal)
════════════════════════════════════════════════════════════════════════════ */
export function generateCollectionReceiptHtml(order: RepairOrder, store: RepairStoreCtx): string {
  const finalAmt = order.finalCost ?? order.estimatedCost ?? 0;
  const balance  = finalAmt - (order.advancePaid ?? 0);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Collection Receipt</title>
<style>${THERMAL_CSS}</style></head>
<body>
  <div class="center">
    <div class="store-name">${store.storeName ?? 'Store'}</div>
    ${store.storeAddress ? `<div style="font-size:10px">${store.storeAddress}</div>` : ''}
    ${store.storePhone   ? `<div style="font-size:10px">${store.storePhone}</div>` : ''}
  </div>
  <div class="divider"></div>
  <div class="center" style="font-size:11px;font-weight:700;text-transform:uppercase">Collection Receipt</div>
  <div class="ticket">${order.ticketNo}</div>
  <div class="divider"></div>
  <div class="row"><span class="label">Customer</span><span>${custName(order)}</span></div>
  <div class="row"><span class="label">Item</span><span>${order.itemDescription}</span></div>
  ${order.metal ? `<div class="row"><span class="label">Metal</span><span>${order.metal}${order.weight ? ` · ${order.weight}g` : ''}</span></div>` : ''}
  <div class="divider"></div>
  <div class="row"><span class="label">Job Cost</span><span>${fmt(finalAmt)}</span></div>
  <div class="row"><span class="label">Advance Paid</span><span>- ${fmt(order.advancePaid ?? 0)}</span></div>
  <div class="divider"></div>
  <div class="total-row"><span>Balance Due</span><span>${balance > 0 ? fmt(balance) : 'NIL'}</span></div>
  <div class="divider"></div>
  <div class="row"><span class="label">Collected on</span><span>${fmtDatetime()}</span></div>
  <div class="thank-you">Thank you! Please keep this receipt.</div>
</body></html>`;
}

/* ════════════════════════════════════════════════════════════════════════════
   PRINT HELPERS
════════════════════════════════════════════════════════════════════════════ */
export function printJobCard(order: RepairOrder, store: RepairStoreCtx): void {
  const html = generateJobCardHtml(order, store);
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export async function printCollectionReceipt(order: RepairOrder, store: RepairStoreCtx): Promise<void> {
  const html = generateCollectionReceiptHtml(order, store);
  const css  = THERMAL_CSS;
  try {
    const settings = await getPrinterSettings(getStoreId());
    await printReceipt(html, css, settings, { ticketNo: order.ticketNo }, getStoreId());
  } catch {
    // Fallback to browser print
    const win = window.open('', '_blank', 'width=400,height=600');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }
}
