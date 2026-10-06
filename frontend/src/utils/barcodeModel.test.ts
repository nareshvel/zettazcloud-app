import { describe, it, expect } from 'vitest';
import {
  buildBarcode, buildQrCode, buildScannable, resolveBarcodeValue,
} from './barcodeModel';
import { saleToPrintData, returnToPrintData } from './saleToPrintData';
import { buildPrintableHtml } from './printTemplateRenderer';
import type { TemplateBlock, PaperSize } from '@/types/printTemplate';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const defaults = require('../../../backend/services/printTemplateService').DEFAULT_BLOCKS;

/**
 * Barcodes that actually scan.
 *
 * TWO REAL BUGS THIS SUITE EXISTS FOR
 * -----------------------------------
 * 1. `resolveBarcodeValue` never looked at `documentNumber` — the field the
 *    sale mapper actually produces. The value was an EMPTY STRING for every
 *    real sale and every real refund.
 *
 * 2. The renderers drew a decorative SVG whose bar widths came from character
 *    codes. It looked like a barcode and scanned as nothing. An empty value
 *    fell back to the literal '0000000000', so the slip printed a barcode
 *    encoding a constant.
 *
 * Together those meant a receipt with the number text hidden by default —
 * hidden precisely BECAUSE "the barcode identifies the sale" — carried no
 * usable identifier at all.
 *
 * The tests below assert against the encoded output, not against the fact that
 * some SVG was produced. A test that only checked "an <svg> came back" would
 * have passed happily throughout both bugs.
 */

const SALE = saleToPrintData({
  id: '9f2c1a84-3b7e-4d10-b0e1-4471882105cc',
  documentNumber: 'INV-2026-000417',
  items: [],
});

const RETURN = returnToPrintData({ return_number: 'RET-000012', items: [] });

describe('resolveBarcodeValue — real mapped data', () => {
  it('finds a value for a real SALE', () => {
    // The bug: this returned '' because only receiptNumber/invoiceNumber were
    // consulted, and the mapper emits documentNumber.
    expect(resolveBarcodeValue({ barcodeSource: 'receiptNo' }, SALE)).toBe('INV-2026-000417');
  });

  it('finds a value for a real REFUND', () => {
    expect(resolveBarcodeValue({ barcodeSource: 'receiptNo' }, RETURN)).toBe('RET-000012');
  });

  it('finds a value with the default (unset) source', () => {
    // DEFAULT_BLOCKS relies on the default branch, so it has to work unset.
    expect(resolveBarcodeValue({}, SALE)).toBe('INV-2026-000417');
  });

  it('falls back to the sale id rather than nothing', () => {
    /*
     * A UUID is unreadable but still resolves to the right sale when scanned,
     * which is the barcode's entire job. Better than an unidentifiable slip.
     */
    const unnumbered = saleToPrintData({ id: '9f2c1a84-3b7e-4d10-b0e1-4471882105cc', items: [] });
    expect(resolveBarcodeValue({}, unnumbered)).toBeTruthy();
  });

  it('returns empty when there is genuinely nothing', () => {
    expect(resolveBarcodeValue({}, {})).toBe('');
    expect(resolveBarcodeValue({}, null)).toBe('');
  });

  it('treats a blank string as nothing', () => {
    // Otherwise a whitespace value would be "encoded" into a meaningless code.
    expect(resolveBarcodeValue({ barcodeSource: 'custom', barcodeCustomValue: '   ' }, {})).toBe('');
  });
});

describe('buildBarcode — a real Code 128', () => {
  it('encodes to many bars, not one per character', () => {
    /*
     * The decorative version emitted exactly one <rect> per character. Real
     * Code 128 emits 11 modules per symbol plus start, checksum and stop, so a
     * 15-character value produces far more bars than 15. This is the assertion
     * that tells the two apart.
     */
    const result = buildBarcode('INV-2026-000417', 'code128');
    expect(result).not.toBeNull();
    const bars = (result!.svg.match(/<rect/g) || []).length;
    expect(bars).toBeGreaterThan(20);
  });

  it('produces different bar patterns for different values', () => {
    const a = buildBarcode('INV-2026-000417', 'code128')!;
    const b = buildBarcode('INV-2026-000418', 'code128')!;
    expect(a.svg).not.toBe(b.svg);
  });

  it('is deterministic for the same value', () => {
    // A reprint must scan to the same thing as the original.
    expect(buildBarcode('INV-1', 'code128')!.svg).toBe(buildBarcode('INV-1', 'code128')!.svg);
  });

  it('reports the value it encoded, for the printed caption', () => {
    expect(buildBarcode('INV-2026-000417', 'code128')!.value).toBe('INV-2026-000417');
  });

  it('returns NULL for an empty value rather than encoding zeros', () => {
    /*
     * The dangerous case. '0000000000' looks like a healthy barcode and scans
     * to a constant — a cashier could refund against whatever sale happens to
     * carry that reference. No barcode is strictly better: staff look it up.
     */
    expect(buildBarcode('', 'code128')).toBeNull();
    expect(buildBarcode('   ' as string, 'code128')?.value).not.toBe('0000000000');
  });

  it('returns null rather than throwing on a value the symbology cannot hold', () => {
    // EAN-13 is digits-only and fixed length; JsBarcode throws on violation,
    // and a thrown error inside a block would take down the whole receipt.
    expect(buildBarcode('NOT-DIGITS', 'ean13')).toBeNull();
    expect(buildBarcode('123', 'ean13')).toBeNull();
    expect(() => buildBarcode('lower case', 'code39')).not.toThrow();
  });

  it('encodes a valid EAN-13', () => {
    const result = buildBarcode('123456789012', 'ean13');
    expect(result).not.toBeNull();
  });
});

describe('buildQrCode — a real QR', () => {
  it('produces a genuine module matrix, not a decorative grid', () => {
    /*
     * The decorative version was a fixed 9x9 pattern. A real QR is at least
     * 21x21 (version 1), and the viewBox reports it.
     */
    const result = buildQrCode('INV-2026-000417');
    expect(result).not.toBeNull();
    const viewBox = result!.svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    expect(viewBox).not.toBeNull();
    expect(Number(viewBox![1])).toBeGreaterThanOrEqual(21);
  });

  it('grows with the payload, as a real QR must', () => {
    const short = buildQrCode('A')!;
    const long = buildQrCode('A'.repeat(200))!;
    const modules = (svg: string) => Number(svg.match(/viewBox="0 0 (\d+)/)![1]);
    expect(modules(long.svg)).toBeGreaterThan(modules(short.svg));
  });

  it('returns null for an empty payload', () => {
    expect(buildQrCode('')).toBeNull();
  });
});

describe('buildScannable — what the renderers call', () => {
  it('returns a barcode for a real sale', () => {
    expect(buildScannable({ barcodeSource: 'receiptNo' }, SALE)).not.toBeNull();
  });

  it('returns a QR when the block asks for one', () => {
    const r = buildScannable({ symbology: 'qr' }, SALE);
    expect(r!.svg).toContain('viewBox');
  });

  it('returns null when there is nothing to encode', () => {
    expect(buildScannable({}, {})).toBeNull();
  });
});

describe('end to end — every default template that carries a barcode', () => {
  /*
   * The check that would have caught the original bug. It renders each stock
   * template with REAL mapped sale data and asserts the barcode is present and
   * encodes the right value — rather than asserting some SVG exists.
   */
  const visible = (html: string) => html
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const withBarcode = Object.keys(defaults).filter((type) =>
    (defaults[type] as TemplateBlock[]).some((b) => b.type === 'barcode' && b.visible));

  it('there are templates with barcodes to check', () => {
    expect(withBarcode.length).toBeGreaterThan(0);
  });

  /*
   * Each template is fed data appropriate to what its barcode block ENCODES.
   *
   * A product label encodes the item's SKU, not the invoice number — feeding it
   * a document number and asserting that appears would be testing the wrong
   * thing, and "fixing" the code to satisfy it would put an invoice number on a
   * shelf label.
   */
  const dataFor = (type: string) => (type === 'label'
    ? saleToPrintData({
      id: '9f2c1a84-3b7e-4d10-b0e1-4471882105cc',
      documentNumber: 'INV-2026-000417',
      items: [{ name: 'Gold Bangle', sku: 'JW-B-3310', quantity: 1, price: 100 }],
    })
    : SALE);

  const expectedValue = (type: string) => (type === 'label' ? 'JW-B-3310' : 'INV-2026-000417');

  // A4 documents (invoice, jewelry_invoice) carry a QR for the customer, not
  // the Code 128 a thermal receipt/label carries for a counter scanner — see
  // DEFAULT_BLOCKS. Rendering an A4 template as '80mm' would also apply the
  // wrong paper styling, independent of the symbology question.
  const PAPER_BY_TYPE: Record<string, PaperSize> = {
    label: 'label', invoice: 'a4', jewelry_invoice: 'a4',
  };
  const paperFor = (type: string): PaperSize => PAPER_BY_TYPE[type] || '80mm';

  const symbologyFor = (type: string): string => {
    const block = (defaults[type] as TemplateBlock[]).find((b) => b.type === 'barcode');
    return (block?.config as any)?.symbology || 'code128';
  };

  withBarcode.forEach((type) => {
    const paper = paperFor(type);
    const isQr = symbologyFor(type) === 'qr';

    it(`${type}: prints a real ${isQr ? 'QR code' : 'barcode'}`, () => {
      const html = buildPrintableHtml(defaults[type] as TemplateBlock[], dataFor(type), paper, null);
      if (isQr) {
        // A real QR is a square module matrix (version 1 is 21x21+); the
        // decorative version it replaced was a fixed, non-scannable grid.
        const box = html.match(/viewBox="0 0 (\d+) (\d+)"/);
        expect(box, 'no scannable code rendered').not.toBeNull();
        const [w, h] = [Number(box![1]), Number(box![2])];
        expect(w, 'not square — this is a linear barcode, not a QR').toBe(h);
        expect(w).toBeGreaterThanOrEqual(21);
      } else {
        // Real Code 128 has well over 20 bars; the decorative version emitted
        // exactly one per character.
        expect((html.match(/<rect/g) || []).length).toBeGreaterThan(20);
      }
    });

    it(`${type}: prints the encoded value beneath it`, () => {
      const html = buildPrintableHtml(defaults[type] as TemplateBlock[], dataFor(type), paper, null);
      expect(visible(html)).toContain(expectedValue(type));
    });

    it(`${type}: never prints the placeholder constant`, () => {
      const html = buildPrintableHtml(defaults[type] as TemplateBlock[], dataFor(type), paper, null);
      expect(visible(html)).not.toContain('0000000000');
    });
  });

  it('a product label encodes the SKU, NOT the invoice number', () => {
    // Stated explicitly so the distinction above is not mistaken for a
    // workaround. An invoice number on a shelf label would be wrong.
    const html = buildPrintableHtml(
      defaults.label as TemplateBlock[], dataFor('label'), 'label', null,
    );
    expect(visible(html)).toContain('JW-B-3310');
    expect(visible(html)).not.toContain('INV-2026-000417');
  });

  it('the refund slip carries a scannable refund number', () => {
    const html = buildPrintableHtml(defaults.return as TemplateBlock[], RETURN, '80mm', null);
    expect((html.match(/<rect/g) || []).length).toBeGreaterThan(20);
    expect(visible(html)).toContain('RET-000012');
  });

  it('a document with nothing to encode prints NO barcode at all', () => {
    // Rather than a barcode for '0000000000'.
    const html = buildPrintableHtml(defaults.receipt as TemplateBlock[], { storeName: 'X' }, '80mm', null);
    expect(visible(html)).not.toContain('0000000000');
  });
});
