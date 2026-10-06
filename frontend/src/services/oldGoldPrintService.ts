/**
 * Old Gold Print Service
 * Generates a thermal-style (80mm) credit voucher for old-gold exchanges.
 */

import { OldGoldPurchase, TEST_METHOD_LABELS, TestMethod, PAYMENT_MODE_LABELS, PaymentMode } from './oldGoldService';

interface StoreCtx {
  storeName?: string;
  storeAddress?: string;
  storePhone?: string;
  storeEmail?: string;
  currencyCode?: string;
  countryCode?: string;
}

const fmt = (n: number | null | undefined, currency = 'INR') =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(n);

function toDateStr(d: any): string {
  if (!d) return '—';
  try {
    const dt = d instanceof Date ? d : new Date(d);
    return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

const now = () => new Date().toLocaleString('en-IN', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    width: 72mm;
    margin: 0 auto;
    padding: 4mm 3mm;
    color: #000;
    background: #fff;
  }
  @media print {
    @page { size: 80mm auto; margin: 0; }
    body { width: 72mm; }
  }
  .center { text-align: center; }
  .store-name { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; }
  .store-sub { font-size: 10px; color: #444; margin-top: 2px; line-height: 1.5; }
  .divider { border-top: 1px dashed #999; margin: 5px 0; }
  .divider-solid { border-top: 2px solid #000; margin: 5px 0; }
  .title { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin: 4px 0 2px; }
  .voucher-no { font-size: 16px; font-weight: 900; letter-spacing: 2px; margin: 4px 0; }
  .row { display: flex; justify-content: space-between; font-size: 11px; margin: 2px 0; }
  .row .label { color: #555; flex-shrink: 0; margin-right: 8px; }
  .row .value { text-align: right; font-weight: 600; }
  .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #666; margin: 5px 0 2px; }
  .value-block { text-align: center; padding: 6px 4px; border: 2px solid #000; border-radius: 3px; margin: 6px 0; }
  .value-block .vb-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px; color: #555; }
  .value-block .vb-amount { font-size: 22px; font-weight: 900; letter-spacing: 0.5px; margin-top: 2px; }
  .value-block .vb-type { font-size: 10px; color: #444; margin-top: 2px; }
  .barcode-area { text-align: center; font-family: monospace; font-size: 9px; color: #888; margin: 4px 0; letter-spacing: 2px; }
  .terms { font-size: 8.5px; color: #555; line-height: 1.6; margin-top: 4px; }
  .terms li { margin-left: 10px; margin-bottom: 1px; }
  .sig-line { border-top: 1px solid #aaa; margin-top: 18px; padding-top: 3px; font-size: 8px; color: #666; text-align: center; }
  .printed-at { font-size: 7.5px; color: #999; text-align: center; margin-top: 6px; }
`;

export function generateVoucherHtml(o: OldGoldPurchase, store: StoreCtx): string {
  const currency  = store.currencyCode || 'INR';
  const custName  = [o.customerFirstName, o.customerLastName].filter(Boolean).join(' ') || 'Walk-in Customer';
  const isCredit  = (o as any).voucherType !== 'cash';
  const testLabel = (o as any).testMethod
    ? (TEST_METHOD_LABELS[(o as any).testMethod as TestMethod] ?? (o as any).testMethod)
    : null;
  const pmLabel = (o as any).paymentMode
    ? (PAYMENT_MODE_LABELS[(o as any).paymentMode as PaymentMode] ?? (o as any).paymentMode)
    : null;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Old Gold Voucher – ${o.voucherNo}</title>
<style>${CSS}</style>
</head><body>

  <!-- STORE HEADER -->
  <div class="center">
    <div class="store-name">${store.storeName ?? 'Store'}</div>
    ${store.storeAddress ? `<div class="store-sub">${store.storeAddress}</div>` : ''}
    ${store.storePhone   ? `<div class="store-sub">Tel: ${store.storePhone}</div>` : ''}
  </div>

  <div class="divider-solid"></div>

  <div class="center">
    <div class="title">Old Gold ${isCredit ? 'Credit Voucher' : 'Cash Settlement'}</div>
    <div class="voucher-no">${o.voucherNo}</div>
    <div style="font-size:10px;color:#555">Date: ${toDateStr((o as any).createdAt)}</div>
  </div>

  <div class="divider"></div>

  <!-- CUSTOMER -->
  <div class="section-title">Customer</div>
  <div class="row"><span class="label">Name</span><span class="value">${custName}</span></div>
  ${o.customerPhone ? `<div class="row"><span class="label">Phone</span><span class="value">${o.customerPhone}</span></div>` : ''}

  <div class="divider"></div>

  <!-- METAL DETAILS -->
  <div class="section-title">Metal Details</div>
  ${(o as any).itemDescription ? `<div class="row"><span class="label">Item</span><span class="value">${(o as any).itemDescription}</span></div>` : ''}
  <div class="row"><span class="label">Metal</span><span class="value">${o.metal}</span></div>
  <div class="row"><span class="label">Claimed Purity</span><span class="value">${(o as any).claimedPurityLabel ?? o.purityLabel ?? '—'}</span></div>
  ${o.purityPct && o.purityPct !== (o as any).claimedPurityPct
    ? `<div class="row"><span class="label">Assayed Purity</span><span class="value">${o.purityPct}%${testLabel ? ` (${testLabel})` : ''}</span></div>`
    : ''}
  <div class="row"><span class="label">Gross Weight</span><span class="value">${o.grossWeight}g</span></div>
  ${(o.stoneDeduction ?? 0) > 0 ? `<div class="row"><span class="label">Stone Deduction</span><span class="value">- ${o.stoneDeduction}g</span></div>` : ''}
  <div class="row"><span class="label">Net Weight</span><span class="value">${o.netWeight ?? '—'}g</span></div>
  <div class="row"><span class="label">Rate / g</span><span class="value">${fmt(o.ratePerGram, currency)}</span></div>
  ${(o.amountDeduction ?? 0) > 0 ? `<div class="row"><span class="label">Deductions</span><span class="value">- ${fmt(o.amountDeduction, currency)}</span></div>` : ''}

  <div class="divider"></div>

  <!-- VOUCHER VALUE -->
  <div class="value-block">
    <div class="vb-label">${isCredit ? 'Store Credit Value' : 'Amount Paid'}</div>
    <div class="vb-amount">${fmt(o.valuationAmount, currency)}</div>
    <div class="vb-type">${isCredit ? 'Redeemable against future purchase' : `Paid via ${pmLabel ?? 'Cash'}`}</div>
  </div>

  <!-- BARCODE PLACEHOLDER -->
  <div class="barcode-area">||||| ${o.voucherNo} |||||</div>

  <div class="divider"></div>

  <!-- TERMS (credit vouchers only) -->
  ${isCredit ? `
  <div class="section-title">Terms &amp; Conditions</div>
  <ul class="terms">
    <li>This voucher is redeemable only at this store.</li>
    <li>Non-transferable and cannot be exchanged for cash.</li>
    <li>Present this voucher at time of purchase.</li>
    <li>Store reserves the right to verify authenticity.</li>
  </ul>
  <div class="divider"></div>` : ''}

  <!-- SIGNATURES -->
  <div class="sig-line">Customer Signature</div>
  <div class="sig-line" style="margin-top:20px">Authorised by</div>

  <div class="printed-at">Printed ${now()}</div>

</body></html>`;
}

export function printOldGoldVoucher(o: OldGoldPurchase, store: StoreCtx): void {
  const html = generateVoucherHtml(o, store);
  const win  = window.open('', '_blank', 'width=420,height=700');
  if (!win) { alert('Allow popups for this site to print vouchers.'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}
