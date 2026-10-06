import { describe, it, expect } from 'vitest';
import { buildParties, buildPageFooter, shouldShowShipTo } from './documentSectionsModel';
import { buildPrintableHtml } from './printTemplateRenderer';
import type { TemplateBlock } from '@/types/printTemplate';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const svc = require('../../../backend/services/printTemplateService');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixtures = require('../../../backend/services/printFixtures');

/**
 * The grouped sections behind the clean A4 invoice.
 *
 * Two behaviours carry real weight:
 *
 *   SHIP TO IS CONDITIONAL. Most retail has no separate delivery address, and
 *   a "Ship to" column repeating the billing one is noise on every counter
 *   sale. It appears only when a shipping address exists AND differs.
 *
 *   THE FOOTER CARRIES THE TAX NUMBER. Moving the store's details out of the
 *   header buys the page a lot of air, but most VAT/GST regimes require the
 *   seller's address and tax number on an invoice. A footer without the tax
 *   number trades compliance for whitespace.
 */

const CUSTOMER = {
  name: 'Blue Waters Hotel Ltd',
  billingAddress: '22 Marylebone Lane, London',
  phone: '+44-7700-900733',
  taxId: 'GB432109876',
};

const STORE = {
  storeName: 'Heritage General Store',
  storeAddress: "23 High Street, St. John's",
  storePhone: '+1-268-555-0199',
  storeEmail: 'info@heritagegeneral.ag',
  storeTaxId: 'ABST-77889900',
};

describe('shouldShowShipTo', () => {
  it('hides it when there is no shipping address', () => {
    expect(shouldShowShipTo({ customer: CUSTOMER })).toBe(false);
  });

  it('hides it when shipping matches billing', () => {
    // The common case. Printing it twice is noise.
    expect(shouldShowShipTo({
      customer: { ...CUSTOMER, shippingAddress: '22 Marylebone Lane, London' },
    })).toBe(false);
  });

  it('ignores punctuation, case and spacing when comparing', () => {
    /*
     * Addresses are typed by hand into two fields. "22 Marylebone Lane, London"
     * and "22 marylebone lane london" are the same place, and showing a Ship To
     * column because of a comma would defeat the whole rule.
     */
    expect(shouldShowShipTo({
      customer: { ...CUSTOMER, shippingAddress: '22 marylebone lane  london' },
    })).toBe(false);
  });

  it('SHOWS it when the addresses genuinely differ', () => {
    expect(shouldShowShipTo({
      customer: { ...CUSTOMER, shippingAddress: 'Dickenson Bay, St John\'s' },
    })).toBe(true);
  });

  it('can be forced on for wholesale', () => {
    // Some goods-in desks look for the column even when it matches.
    expect(shouldShowShipTo(
      { customer: { ...CUSTOMER, shippingAddress: '22 Marylebone Lane, London' } },
      { alwaysShowShipTo: true },
    )).toBe(true);
  });

  it('is still hidden when forced on but there is no address', () => {
    // Forcing must not conjure an empty column.
    expect(shouldShowShipTo({ customer: CUSTOMER }, { alwaysShowShipTo: true })).toBe(false);
  });
});

describe('buildParties', () => {
  it('builds bill-to and details for an ordinary sale', () => {
    const cols = buildParties({
      customerName: CUSTOMER.name, customer: CUSTOMER,
      dueDate: '22/09/2026', orderNumber: 'PO-4471',
    });
    expect(cols.map((c) => c.label)).toEqual(['Bill to', 'Details']);
  });

  it('adds ship-to as a third column when it differs', () => {
    const cols = buildParties({
      customerName: CUSTOMER.name,
      customer: { ...CUSTOMER, shippingAddress: 'Dickenson Bay' },
      dueDate: '22/09/2026',
    });
    expect(cols.map((c) => c.label)).toEqual(['Bill to', 'Ship to', 'Details']);
  });

  it('drops the details column when there are no details', () => {
    // An empty "Details" heading reads as a fault.
    const cols = buildParties({ customerName: CUSTOMER.name, customer: CUSTOMER });
    expect(cols.map((c) => c.label)).toEqual(['Bill to']);
  });

  it('drops empty lines rather than printing blanks', () => {
    const cols = buildParties({ customerName: 'Walk-in', customer: { name: 'Walk-in' } });
    expect(cols[0].lines).toEqual([]);
  });

  it('labels the bill-to column "Walk-in Customer" when no customer was selected', () => {
    // Deliberate: real jewelry/retail invoices conventionally print a
    // walk-in label rather than leaving the bill-to blank.
    const cols = buildParties({});
    expect(cols).toEqual([{ label: 'Bill to', heading: 'Walk-in Customer', lines: [] }]);
  });

  it('carries the customer tax number, which a B2B invoice needs', () => {
    const cols = buildParties({ customerName: CUSTOMER.name, customer: CUSTOMER });
    expect(cols[0].lines).toContain('GB432109876');
  });
});

describe('buildPageFooter', () => {
  it('puts the tax number in the footer', () => {
    /*
     * The point of the whole header/footer split. Without this the layout
     * trades compliance for whitespace.
     */
    const f = buildPageFooter(STORE)!;
    expect(f.right.join(' ')).toContain('ABST-77889900');
  });

  it('labels the tax number by jurisdiction', () => {
    // "VAT number" in the UK, "ABN" in Australia, "TRN" in the UAE.
    const f = buildPageFooter({ ...STORE, taxIdLabel: 'VAT No.' })!;
    expect(f.right.join(' ')).toContain('VAT No. ABST-77889900');
  });

  it('keeps the tax number separate from the address line', () => {
    // It is what an accounts department looks for; trailing a street address
    // it gets missed.
    const f = buildPageFooter(STORE)!;
    expect(f.left).not.toContain('ABST-77889900');
  });

  it('honours the configured fields', () => {
    const f = buildPageFooter(STORE, { footerFields: ['address'] })!;
    expect(f.right).toEqual([]);
    expect(f.left).toContain('23 High Street');
  });

  it('returns null when there is nothing to print', () => {
    // Rather than an empty rule across the foot of the page.
    expect(buildPageFooter({})).toBeNull();
  });
});

describe('invoice.clean — the assembled layout', () => {
  const blocks = svc.TEMPLATE_LAYOUTS['invoice.clean'] as TemplateBlock[];
  const data = fixtures.getFixture('invoice', 'retail');
  const render = (d: any = data) => buildPrintableHtml(blocks, d, 'a4', null);
  const visible = (h: string) => h
    .replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  it('exists as a layout variant, not a new template type', () => {
    /*
     * DEFAULT_BLOCKS is the source of truth for which template TYPES exist —
     * seven registries are checked against it. A new look must not register a
     * type, or every one of them needs updating.
     */
    expect(svc.TEMPLATE_LAYOUTS['invoice.clean']).toBeTruthy();
    expect(svc.validTemplateTypes()).not.toContain('invoice.clean');
  });

  it('renders a complete document', () => {
    expect(render()).toContain('<!DOCTYPE html>');
  });

  it('carries a REAL QR code, not a barcode', () => {
    /*
     * This document goes to a CUSTOMER, who scans it with a phone. Code 128
     * stays on the thermal receipt, where a 1D counter scanner reads it for
     * returns — most retail laser scanners cannot read QR at all.
     *
     * Asserted on the viewBox being SQUARE. A first attempt checked only that
     * the viewBox width was >= 21, which a Code 128 barcode also satisfies
     * (JsBarcode emits roughly 285x40) — so the test passed happily when the
     * symbology was downgraded back to a barcode. A QR is a module matrix and
     * is always square; a linear barcode never is.
     */
    const box = render().match(/viewBox="0 0 (\d+) (\d+)"/);
    expect(box, 'no scannable code rendered').not.toBeNull();
    const [w, h] = [Number(box![1]), Number(box![2])];
    expect(w, 'the code is not square — this is a linear barcode, not a QR').toBe(h);
    expect(w).toBeGreaterThanOrEqual(21);
  });

  it('hides ship-to for a sale with one address', () => {
    expect(visible(render())).not.toContain('Ship to');
  });

  it('shows ship-to when the delivery address differs', () => {
    const d = { ...data, customer: { ...data.customer, shippingAddress: 'Dickenson Bay' } };
    expect(visible(render(d))).toContain('Ship to');
  });

  it('prints the store address and tax number in the footer', () => {
    const text = visible(render());
    expect(text).toContain('23 High Street');
    expect(text).toContain('ABST-77889900');
  });

  it('repeats the footer on every printed page', () => {
    // An invoice running to two pages must carry the seller's details on both.
    const html = render();
    expect(html).toContain('doc-page-footer');
    expect(html).toMatch(/@media print[\s\S]*position: fixed/);
  });

  it('shows the line amount, not just the unit price', () => {
    /*
     * `tablePreset` is only the marker for which preset is selected in the
     * properties panel — the renderer reads `fields`. Setting the preset alone
     * inferred columns from the data shape and silently dropped this column.
     */
    expect(visible(render())).toContain('EC$1,080.00');
  });

  it('every table block that names a preset also declares its fields', () => {
    // The trap above, guarded across every shipped layout.
    const offenders: string[] = [];
    const scan = (name: string, list: TemplateBlock[]) => (list || []).forEach((b: any) => {
      if (b?.config?.tablePreset && !(b.config.fields || []).length) {
        offenders.push(`${name}/${b.id}`);
      }
    });
    Object.entries(svc.DEFAULT_BLOCKS).forEach(([k, v]) => scan(k, v as TemplateBlock[]));
    Object.entries(svc.TEMPLATE_LAYOUTS).forEach(([k, v]) => scan(k, v as TemplateBlock[]));
    expect(offenders, 'tablePreset without fields does nothing').toEqual([]);
  });

  it('puts the store name and the title at the top, contact at the foot', () => {
    const text = visible(render());
    const namePos = text.indexOf('Heritage General Store');
    const phonePos = text.lastIndexOf('+1-268-555-0199');
    expect(namePos).toBeGreaterThan(-1);
    expect(phonePos).toBeGreaterThan(namePos);
  });
});
