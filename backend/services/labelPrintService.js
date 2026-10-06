/**
 * labelPrintService
 * =============================================================================
 * Generates and dispatches label/tag print jobs for jewelry piece tags and
 * product shelf-labels.
 *
 * Supported printer drivers:
 *   zebra_zpl   — Zebra ZPL II over TCP (network port 9100 default)
 *   tsc_network — TSC / Godex TSPL-EZ over TCP (same port convention)
 *   browser     — Returns an HTML string; frontend opens a print window
 *
 * Usage:
 *   const svc = require('./labelPrintService');
 *   const zpl = svc.buildZpl(piece, settings);
 *   await svc.printLabel({ driver, address, zpl });
 */

'use strict';

const net = require('net');

// ---------------------------------------------------------------------------
// ZPL II generator  (Zebra)
// Label size defaults: 50 × 25 mm @ 203 dpi
// ---------------------------------------------------------------------------

/**
 * Build a ZPL II label string for a serialized piece or a product.
 *
 * @param {object} item
 *   piece_code|sku, name, purity (optional), net_weight (optional),
 *   selling_price, barcode (optional fallback to piece_code)
 * @param {object} settings
 *   widthMm (default 50), heightMm (default 25), storeName
 */
function buildZpl(item, settings = {}) {
  const w   = settings.widthMm  || 50;
  const h   = settings.heightMm || 25;
  const dpi = 203;                           // standard for most Zebra label printers

  // Convert mm → dots
  const dots = (mm) => Math.round((mm / 25.4) * dpi);
  const labelW = dots(w);   // e.g. 50 mm → 400 dots
  const labelH = dots(h);   // e.g. 25 mm → 200 dots

  const code      = item.piece_code || item.sku || item.id || '';
  const barcode   = item.barcode    || code;
  const name      = (item.name || item.product_name || 'Item').substring(0, 32);
  const purity    = item.purity     ? `${item.purity}` : null;
  const weight    = item.net_weight ? `Wt: ${parseFloat(item.net_weight).toFixed(2)}g` : null;
  const price     = item.selling_price != null
    ? `${parseFloat(item.selling_price).toFixed(2)}`
    : '';
  const store     = (settings.storeName || '').substring(0, 30);

  const lines = [
    `^XA`,
    `^PW${labelW}`,            // label width
    `^LL${labelH}`,            // label length
    `^LH0,0`,                  // label home
    // Store name — small, top-left
    store ? `^FO8,6^A0N,14,14^FD${store}^FS` : '',
    // Product name — bold, line 2
    `^FO8,22^A0N,18,18^FD${name}^FS`,
    // Attributes row: purity + weight
    (purity || weight)
      ? `^FO8,44^A0N,14,14^FD${[purity, weight].filter(Boolean).join('  ')}^FS`
      : '',
    // Price — large, right side
    price
      ? `^FO${labelW - 110},22^A0N,22,22^FD${price}^FS`
      : '',
    // Code128 barcode — bottom
    `^FO8,${labelH - 60}^BY1.5,2,40^BCN,,Y,N^FD${barcode}^FS`,
    `^XZ`,
  ].filter(Boolean).join('\n');

  return lines;
}

// ---------------------------------------------------------------------------
// TSPL-EZ generator  (TSC / Godex)
// ---------------------------------------------------------------------------

/**
 * Build a TSPL-EZ label string.
 */
function buildTspl(item, settings = {}) {
  const w    = settings.widthMm  || 50;
  const h    = settings.heightMm || 25;
  const code = item.piece_code || item.sku || item.id || '';
  const bar  = item.barcode || code;
  const name = (item.name || item.product_name || 'Item').substring(0, 32);
  const purity = item.purity ? `${item.purity}` : '';
  const weight = item.net_weight ? `Wt:${parseFloat(item.net_weight).toFixed(2)}g` : '';
  const price  = item.selling_price != null
    ? `${parseFloat(item.selling_price).toFixed(2)}`
    : '';
  const store  = (settings.storeName || '').substring(0, 30);

  return [
    `SIZE ${w} mm, ${h} mm`,
    `GAP 2 mm, 0 mm`,
    `DIRECTION 0`,
    `CLS`,
    store  ? `TEXT 8,4,"3",0,1,1,"${store}"` : '',
    `TEXT 8,20,"4",0,1,1,"${name}"`,
    (purity || weight) ? `TEXT 8,42,"3",0,1,1,"${[purity, weight].filter(Boolean).join(' ')}"` : '',
    price  ? `TEXT ${w * 4 - 80},20,"4",0,1,1,"${price}"` : '',
    `BARCODE 8,${h * 4 - 64},"128",48,1,0,2,2,"${bar}"`,
    `PRINT 1,1`,
    ``,
  ].filter(Boolean).join('\r\n');
}

// ---------------------------------------------------------------------------
// Browser/PDF HTML label (returned as string; frontend opens print window)
// ---------------------------------------------------------------------------

function buildHtmlLabel(item, settings = {}) {
  const code  = item.piece_code || item.sku || item.id || '';
  const name  = item.name || item.product_name || 'Item';
  const purity = item.purity ? `${item.purity}` : '';
  const weight = item.net_weight ? `${parseFloat(item.net_weight).toFixed(2)} g` : '';
  const price  = item.selling_price != null
    ? parseFloat(item.selling_price).toFixed(2)
    : '';
  const store  = settings.storeName || '';
  const w      = settings.widthMm  || 50;
  const h      = settings.heightMm || 25;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { size: ${w}mm ${h}mm; margin: 0; }
  body  { margin:0; padding:2mm; font-family:Arial,sans-serif; width:${w - 4}mm; height:${h - 4}mm; overflow:hidden; }
  .store  { font-size:6pt; color:#555; }
  .name   { font-size:9pt; font-weight:bold; margin:1mm 0; white-space:nowrap; overflow:hidden; }
  .attrs  { font-size:7pt; color:#333; }
  .price  { font-size:12pt; font-weight:bold; text-align:right; }
  .code   { font-size:7pt; text-align:center; margin-top:1mm; letter-spacing:1px; }
  svg     { display:block; margin:0 auto; }
</style>
</head><body>
${store ? `<div class="store">${store}</div>` : ''}
<div class="name">${name}</div>
<div style="display:flex;justify-content:space-between;align-items:flex-end">
  <div class="attrs">${[purity, weight].filter(Boolean).join(' · ')}</div>
  ${price ? `<div class="price">${price}</div>` : ''}
</div>
<div class="code">${code}</div>
<script>window.onload=()=>window.print();</script>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Network dispatch (TCP, port 9100 default)
// ---------------------------------------------------------------------------

function sendToNetworkPrinter(address, data) {
  return new Promise((resolve, reject) => {
    const [host, portStr = '9100'] = (address || '').split(':');
    const port = parseInt(portStr, 10) || 9100;
    const sock = new net.Socket();
    const timer = setTimeout(() => {
      sock.destroy();
      reject(new Error(`Label printer at ${host}:${port} timed out`));
    }, 6000);
    sock.on('error', (e) => { clearTimeout(timer); reject(e); });
    sock.connect(port, host, () => {
      sock.write(typeof data === 'string' ? Buffer.from(data, 'binary') : data, () => {
        sock.end();
        clearTimeout(timer);
        resolve();
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Print a label.
 *
 * @param {object} opts
 *   driver      'zebra_zpl' | 'tsc_network' | 'browser'
 *   address     'IP:port' — required for network drivers
 *   item        piece / product data object
 *   settings    { widthMm, heightMm, storeName }
 *
 * @returns {object}  { ok, html? }
 *   html is populated when driver = 'browser' so the route can return it to
 *   the frontend for a window.print() call.
 */
async function printLabel({ driver, address, item, settings = {} }) {
  if (driver === 'browser') {
    return { ok: true, html: buildHtmlLabel(item, settings) };
  }
  if (driver === 'zebra_zpl') {
    const zpl = buildZpl(item, settings);
    await sendToNetworkPrinter(address, zpl);
    return { ok: true };
  }
  if (driver === 'tsc_network') {
    const tspl = buildTspl(item, settings);
    await sendToNetworkPrinter(address, tspl);
    return { ok: true };
  }
  throw new Error(`Unknown label printer driver: ${driver}`);
}

module.exports = { buildZpl, buildTspl, buildHtmlLabel, printLabel };
