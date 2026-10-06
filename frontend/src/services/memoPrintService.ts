/**
 * Memo Print Service
 * - printMemoSlip(memo, store)      → 80mm thermal-style slip (quick reference)
 * - printMemoAcknowledgement(memo, store) → A4 formal consignment acknowledgement with signature line
 */

import { Memo, MemoItem } from './jewelryOpsService';

export interface StoreCtx {
  storeName?: string | null;
  storeAddress?: string | null;
  storePhone?: string | null;
  storeEmail?: string | null;
  currencyCode?: string | null;
}

const fmt = (n: number | null | undefined, currency = 'INR') =>
  n == null ? '—'
  : new Intl.NumberFormat('en-IN', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 2 }).format(n);

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const partyName = (m: Memo) =>
  m.supplierName || [m.customerFirstName, m.customerLastName].filter(Boolean).join(' ') || '—';

const dirLabel = (m: Memo) =>
  m.direction === 'in' ? 'Memo In — Received from Supplier' : 'Memo Out — Sent to Customer';

/* ─── thermal slip ─────────────────────────────────────────────────────── */
function slipHtml(m: Memo, store: StoreCtx): string {
  const curr = store.currencyCode || 'INR';
  const items = m.items ?? [];

  const itemRows = items.map(it => `
    <tr>
      <td style="padding:3px 0;border-bottom:1px dashed #ddd;font-size:11px;">${it.description}</td>
      <td style="padding:3px 4px;border-bottom:1px dashed #ddd;text-align:center;font-size:11px;">${Number(it.quantity)}</td>
      <td style="padding:3px 0;border-bottom:1px dashed #ddd;text-align:right;font-size:11px;">${fmt(it.lineValue ?? (Number(it.unitValue||0)*Number(it.quantity)), curr)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Memo ${m.memoNo}</title>
  <style>
    @page { size: 80mm auto; margin: 6mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Courier New', monospace; font-size: 12px; color: #111; width: 68mm; }
    h1  { font-size: 15px; font-weight: 700; text-align: center; margin: 0 0 2px; }
    .sub{ font-size: 10px; text-align: center; color: #555; margin-bottom: 6px; }
    .divider { border-top: 1px dashed #aaa; margin: 5px 0; }
    .kv  { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
    .kv b{ font-weight: 600; }
    table{ width: 100%; border-collapse: collapse; }
    th   { font-size: 10px; text-align: left; font-weight: 700; padding: 2px 0; border-bottom: 1px solid #333; }
    th:last-child, td:last-child { text-align: right; }
    th:nth-child(2), td:nth-child(2) { text-align: center; }
    .total{ font-size: 13px; font-weight: 700; text-align: right; margin-top: 4px; }
    .footer{ font-size: 9px; text-align: center; color: #777; margin-top: 8px; }
  </style></head><body>
  <h1>${store.storeName || 'Store'}</h1>
  ${store.storeAddress ? `<p class="sub">${store.storeAddress}</p>` : ''}
  ${store.storePhone ? `<p class="sub">📞 ${store.storePhone}</p>` : ''}
  <div class="divider"></div>

  <div class="kv"><span><b>Memo #</b></span><span>${m.memoNo}</span></div>
  <div class="kv"><span><b>Type</b></span><span>${dirLabel(m)}</span></div>
  <div class="kv"><span><b>Party</b></span><span>${partyName(m)}</span></div>
  ${m.customerPhone ? `<div class="kv"><span><b>Phone</b></span><span>${m.customerPhone}</span></div>` : ''}
  <div class="kv"><span><b>Issued</b></span><span>${fmtDate(m.issueDate)}</span></div>
  ${m.dueDate ? `<div class="kv"><span><b>Due</b></span><span style="color:#c00;">${fmtDate(m.dueDate)}</span></div>` : ''}
  <div class="divider"></div>

  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Value</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="total">Total: ${fmt(m.totalValue, curr)}</div>
  <div class="divider"></div>
  ${m.notes ? `<p style="font-size:10px;color:#555;">Note: ${m.notes}</p>` : ''}
  <p class="footer">Printed ${new Date().toLocaleString('en-IN')}</p>
  </body></html>`;
}

/* ─── A4 acknowledgement ───────────────────────────────────────────────── */
function ackHtml(m: Memo, store: StoreCtx): string {
  const curr = store.currencyCode || 'INR';
  const items = m.items ?? [];

  const itemRows = items.map((it, i) => `
    <tr style="background:${i % 2 === 0 ? '#fafafa' : '#fff'};">
      <td style="padding:8px 10px;border:1px solid #e5e7eb;">${it.pieceCode || '—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;">${it.description}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">${it.purity || '—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">${it.grossWeight != null ? it.grossWeight + 'g' : '—'}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;">${Number(it.quantity)}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;">${fmt(it.unitValue, curr)}</td>
      <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmt(it.lineValue ?? (Number(it.unitValue||0)*Number(it.quantity)), curr)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Consignment Acknowledgement — ${m.memoNo}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .store-name { font-size: 22px; font-weight: 700; color: #111; }
    .store-sub  { font-size: 11px; color: #666; margin-top: 2px; }
    .doc-title  { font-size: 18px; font-weight: 700; text-align: right; color: #374151; }
    .doc-no     { font-size: 13px; color: #6b7280; text-align: right; margin-top: 4px; }
    .meta-grid  { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
    .meta-box   { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
    .meta-box h4{ font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; margin: 0 0 6px; }
    .meta-box p { margin: 2px 0; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead th { background: #1f2937; color: #fff; padding: 9px 10px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; }
    thead th:last-child, thead th:nth-child(5), thead th:nth-child(6), thead th:nth-child(7) { text-align: right; }
    thead th:nth-child(4), thead th:nth-child(5) { text-align: center; }
    .total-row td { padding: 10px; font-weight: 700; font-size: 14px; border-top: 2px solid #1f2937; }
    .sig-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; }
    .sig-box p  { margin: 0 0 40px; font-size: 12px; color: #6b7280; }
    .sig-line   { border-top: 1px solid #374151; padding-top: 6px; font-size: 12px; color: #374151; }
    .footer     { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
    .status-badge { display:inline-block; padding:2px 10px; border-radius:9999px; font-size:11px; font-weight:600;
      background:${m.status==='open'?'#dcfce7':m.status==='cancelled'?'#fee2e2':'#fef9c3'};
      color:${m.status==='open'?'#166534':m.status==='cancelled'?'#991b1b':'#92400e'}; }
  </style></head><body>

  <div class="header">
    <div>
      <div class="store-name">${store.storeName || 'Store'}</div>
      ${store.storeAddress ? `<div class="store-sub">${store.storeAddress}</div>` : ''}
      ${store.storePhone   ? `<div class="store-sub">📞 ${store.storePhone}</div>` : ''}
      ${store.storeEmail   ? `<div class="store-sub">✉ ${store.storeEmail}</div>` : ''}
    </div>
    <div>
      <div class="doc-title">Consignment Acknowledgement</div>
      <div class="doc-no">${m.memoNo}</div>
      <div style="text-align:right;margin-top:6px;"><span class="status-badge">${m.status.replace(/_/g,' ').toUpperCase()}</span></div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-box">
      <h4>${m.direction === 'in' ? 'Received From (Supplier)' : 'Issued To (Customer)'}</h4>
      <p><strong>${partyName(m)}</strong></p>
      ${m.customerPhone ? `<p>📞 ${m.customerPhone}</p>` : ''}
      ${m.customerEmail ? `<p>✉ ${m.customerEmail}</p>` : ''}
    </div>
    <div class="meta-box">
      <h4>Memo Details</h4>
      <p><strong>Type:</strong> ${dirLabel(m)}</p>
      <p><strong>Issue Date:</strong> ${fmtDate(m.issueDate)}</p>
      ${m.dueDate ? `<p><strong>Due Date:</strong> ${fmtDate(m.dueDate)}</p>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Piece Code</th><th>Description</th><th>Purity</th>
        <th style="text-align:center;">Gross Wt</th>
        <th style="text-align:center;">Qty</th>
        <th style="text-align:right;">Unit Value</th>
        <th style="text-align:right;">Line Value</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="6" style="text-align:right;border:none;">Total Value</td>
        <td style="text-align:right;border:none;">${fmt(m.totalValue, curr)}</td>
      </tr>
    </tfoot>
  </table>

  ${m.notes ? `<div style="background:#fef9c3;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;margin-bottom:16px;font-size:12px;"><strong>Notes:</strong> ${m.notes}</div>` : ''}

  <div style="font-size:12px;color:#6b7280;margin-bottom:8px;">
    The above items are issued on memo/consignment basis. Title remains with the issuer until confirmed
    ${m.direction === 'out' ? 'sold' : 'purchased'}. All items must be returned in original condition if not
    ${m.direction === 'out' ? 'sold' : 'retained'}.
  </div>

  <div class="sig-section">
    <div class="sig-box">
      <p>Issued by (Store Representative)</p>
      <div class="sig-line">Name &amp; Signature / Stamp</div>
    </div>
    <div class="sig-box">
      <p>Received by (${m.direction === 'in' ? 'Store on behalf of Supplier' : 'Customer'})</p>
      <div class="sig-line">Name &amp; Signature</div>
    </div>
  </div>

  <div class="footer">Printed ${new Date().toLocaleString('en-IN')} · ${store.storeName || ''}</div>
  </body></html>`;
}

/* ─── public API ───────────────────────────────────────────────────────── */
function openPrint(html: string, width = 800, height = 900): void {
  const win = window.open('', '_blank', `width=${width},height=${height}`);
  if (!win) { alert('Allow popups for this site to print.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

export function printMemoSlip(memo: Memo, store: StoreCtx): void {
  openPrint(slipHtml(memo, store), 420, 700);
}

export function printMemoAcknowledgement(memo: Memo, store: StoreCtx): void {
  openPrint(ackHtml(memo, store), 900, 1100);
}
