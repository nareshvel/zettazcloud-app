/**
 * Barcodes and QR codes that actually scan.
 *
 * WHAT WAS WRONG
 * --------------
 * The renderers drew `fakeBarcodeSvg` / `fakeQrSvg` — decorative SVGs whose bar
 * widths came from character codes. They look like a barcode and scan as
 * nothing. That was fine while `buildPrintableHtml` only ever fed the
 * designer's preview; it stopped being fine the moment real sales printed
 * through it.
 *
 * Two failures compounded:
 *
 *   1. `resolveBarcodeValue` never looked at `documentNumber`, the field the
 *      sale mapper actually produces — so the value was an empty string for
 *      every real sale and every real refund.
 *   2. An empty value fell back to the literal `'0000000000'`, so the slip
 *      printed a barcode encoding a constant. Scanning it finds nothing, or —
 *      worse — whatever sale happens to carry that reference.
 *
 * Taken together: a receipt with the number text hidden by default (because
 * "the barcode identifies the sale") carried NO usable identifier at all.
 *
 * WHY NOT PRINT SOMETHING ANYWAY
 * ------------------------------
 * A barcode that scans to the wrong value is worse than no barcode. A cashier
 * seeing no barcode looks the sale up by hand; a cashier scanning a wrong one
 * refunds the wrong transaction. `buildBarcode` returns null rather than
 * inventing a value, and callers render nothing.
 */

import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export type Symbology = 'code128' | 'code39' | 'ean13' | 'qr';

export interface BarcodeResult {
  /** Inline SVG markup, ready to embed. */
  svg: string;
  /** The value encoded — printed beneath so it can be read out if scanning fails. */
  value: string;
}

/**
 * The value a barcode block should encode.
 *
 * Ordered most-specific first. `documentNumber` leads because it is what the
 * sequence allocator issues and what the customer sees; `saleId` is the last
 * resort because a UUID is unreadable but still resolves to the right sale when
 * scanned, which is the barcode's whole job.
 */
export function resolveBarcodeValue(cfg: any, data: any): string {
  const src = cfg?.barcodeSource || 'receiptNo';
  const firstItem = data?.items?.[0] || {};

  const pick = (...candidates: unknown[]): string => {
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim() !== '') return c.trim();
      if (typeof c === 'number' && Number.isFinite(c)) return String(c);
    }
    return '';
  };

  switch (src) {
    case 'custom':
      return pick(cfg?.barcodeCustomValue);
    case 'invoiceNo':
      // documentNumber first: it is what the sequence allocator actually
      // issued. invoiceNumber only ever appears as a static fixture/preview
      // field (saleToPrintData never sets it on a real sale) — putting it
      // first meant a QR/barcode on the invoice could encode a stale demo
      // number instead of the number printed everywhere else on the page.
      return pick(data?.documentNumber, data?.invoiceNumber, data?.saleId);
    case 'orderNo':
      return pick(data?.orderNumber, data?.documentNumber, data?.invoiceNumber, data?.saleId);
    case 'customerId':
      return pick(data?.customer?.id, data?.customerId, data?.customer?.code);
    case 'productSku':
      return pick(firstItem.sku, firstItem.barcode, data?.barcode);
    case 'pieceId':
      return pick(firstItem.pieceCode, data?.pieceCode, data?.barcode);
    case 'receiptNo':
    default:
      // `documentNumber` was missing here, which is the bug described above.
      return pick(
        data?.receiptNumber, data?.documentNumber, data?.invoiceNumber,
        data?.barcode, data?.saleId,
      );
  }
}

/**
 * Code 39 and EAN-13 have alphabet and length rules that Code 128 does not.
 * Asking JsBarcode to encode an invalid value throws; we would rather print no
 * barcode than crash a receipt, so validity is checked up front.
 */
function isEncodable(value: string, symbology: Symbology): boolean {
  if (!value) return false;
  switch (symbology) {
    case 'ean13':
      // 12 digits + check, or 13 with one supplied.
      return /^\d{12,13}$/.test(value);
    case 'code39':
      return /^[0-9A-Z\-. $/+%]+$/.test(value);
    case 'code128':
    default:
      // Code 128 covers ASCII 0-127.
      // eslint-disable-next-line no-control-regex
      return /^[\x00-\x7F]+$/.test(value);
  }
}

/** JsBarcode's format names for the symbologies we expose. */
const JSBARCODE_FORMAT: Record<string, string> = {
  code128: 'CODE128',
  code39: 'CODE39',
  ean13: 'EAN13',
};

/**
 * Render a real, scannable barcode as inline SVG.
 *
 * @returns null when there is nothing valid to encode — print nothing.
 */
export function buildBarcode(
  value: string,
  symbology: Symbology = 'code128',
  opts: { heightPx?: number; showText?: boolean } = {},
): BarcodeResult | null {
  const { heightPx = 40, showText = false } = opts;
  if (!isEncodable(value, symbology)) return null;

  try {
    // JsBarcode writes into a DOM-ish node. jsdom (tests) and the browser both
    // provide createElementNS; if neither does we return null rather than throw.
    if (typeof document === 'undefined') return null;

    const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    JsBarcode(node, value, {
      format: JSBARCODE_FORMAT[symbology] || 'CODE128',
      height: heightPx,
      width: 1.6,
      // The caption is rendered by the caller so it can be styled with the rest
      // of the document; letting JsBarcode draw it would use its own font.
      displayValue: showText,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    });

    return { svg: node.outerHTML, value };
  } catch {
    // An unencodable value that slipped past isEncodable. Print nothing.
    return null;
  }
}

/**
 * Render a real QR code as inline SVG.
 *
 * Synchronous because the renderers build an HTML string in one pass.
 * `qrcode` exposes a sync SVG path via `toString` with `type: 'svg'`, which is
 * why this can avoid making the whole renderer async.
 */
export function buildQrCode(value: string, sizePx = 80): BarcodeResult | null {
  if (!value) return null;

  try {
    let svg = '';
    // The callback form of toString() is synchronous for the SVG renderer.
    QRCode.toString(
      value,
      { type: 'svg', errorCorrectionLevel: 'M', margin: 0, width: sizePx },
      (err: Error | null | undefined, result: string) => {
        if (!err && result) svg = result;
      },
    );
    return svg ? { svg, value } : null;
  } catch {
    return null;
  }
}

/**
 * One entry point for both, so the renderers do not each decide which to call.
 */
export function buildScannable(
  cfg: any,
  data: any,
  opts: { heightPx?: number; qrSizePx?: number } = {},
): BarcodeResult | null {
  const value = resolveBarcodeValue(cfg, data);
  if (!value) return null;

  return cfg?.symbology === 'qr'
    ? buildQrCode(value, opts.qrSizePx ?? 80)
    : buildBarcode(value, (cfg?.symbology as Symbology) || 'code128', {
      heightPx: opts.heightPx ?? 40,
    });
}
