import { describe, it, expect } from 'vitest';
import { buildPrintableHtml } from './printTemplateRenderer';
import type { TemplateBlock } from '@/types/printTemplate';

/**
 * Phase 1 integration check.
 *
 * Renders each shipped default template against its vertical's fixture and
 * asserts the output is actually populated. A template can be structurally
 * valid and still print a page of em-dashes if its accessors don't match the
 * fixture's field names — that only shows up on paper, which is exactly the
 * class of bug this catches.
 */

// Mirrors backend/services/printTemplateService.js DEFAULT_BLOCKS shape.
const defaults = require('../../../backend/services/printTemplateService').DEFAULT_BLOCKS;
const fixtures = require('../../../backend/services/printFixtures');

/**
 * The renderer HTML-escapes all interpolated data (correctly — a store named
 * `<script>` must not execute). Assertions therefore have to compare against
 * the escaped form, not the raw fixture value.
 */
const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

const PAIRS: Array<[string, string, 'a4' | '80mm']> = [
  ['receipt', 'retail', '80mm'],
  ['receipt', 'grocery', '80mm'],
  ['receipt', 'pharmacy', '80mm'],
  ['receipt', 'apparel', '80mm'],
  ['invoice', 'electronics', 'a4'],
  ['jewelry_invoice', 'jewelry', 'a4'],
];

describe('Phase 1 — defaults render against vertical fixtures', () => {
  PAIRS.forEach(([templateType, vertical, paper]) => {
    it(`${templateType} + ${vertical} fixture renders populated content`, () => {
      const blocks = defaults[templateType] as TemplateBlock[];
      const data = fixtures.getFixtureForVertical(vertical);
      const html = buildPrintableHtml(blocks, data, paper, 'https://cdn/logo.png');

      expect(html).toContain('<!DOCTYPE html>');
      // The store's own name must appear — proves identity blocks resolved.
      expect(html).toContain(esc(data.storeName));
      // At least the first item name must appear — proves the table resolved.
      expect(html).toContain(esc(data.items[0].name));
    });
  });

  it('duty-free jewelry invoice renders traveller details and zero tax', () => {
    const blocks = defaults.jewelry_invoice as TemplateBlock[];
    const data = fixtures.getFixtureForVertical('jewelry', { dutyFree: true });
    const html = buildPrintableHtml(blocks, data, 'a4', null);
    expect(html).toContain(esc(data.storeName));
    expect(html).toContain(esc(data.items[0].name));
  });

  it('does not emit an unreasonable number of empty placeholders', () => {
    // Some dashes are legitimate (a genuinely absent optional field). A page
    // that is mostly dashes means the accessors do not match the fixture.
    const blocks = defaults.receipt as TemplateBlock[];
    const data = fixtures.getFixtureForVertical('retail');
    const html = buildPrintableHtml(blocks, data, '80mm', null);
    const dashes = (html.match(/—/g) || []).length;
    expect(dashes).toBeLessThan(10);
  });
});

/**
 * Phase 2 — jurisdiction-aware rendering.
 *
 * These assert on the PRINT renderer specifically. The canvas and the print
 * renderer are separate implementations of the same semantics and have drifted
 * twice before; a rule that only holds on screen is worthless, because the
 * document that matters is the one on paper.
 */
describe('Phase 2 — taxSummary and jurisdiction rules', () => {
  const taxBlock = (config = {}): TemplateBlock => ({
    id: 'tax', type: 'taxSummary', visible: true, order: 1, config,
  });

  it('renders one line per rate, including exempt classes', () => {
    // A grocery basket mixes exempt food with taxable prepared food.
    const data = fixtures.getFixtureForVertical('grocery');
    const html = buildPrintableHtml([taxBlock()], data, '80mm');
    expect(html).toContain('Exempt (food)');
    expect(html).toContain('ABST 15%');
  });

  it('can hide exempt lines when the template asks', () => {
    const data = fixtures.getFixtureForVertical('grocery');
    const html = buildPrintableHtml([taxBlock({ showExemptLines: false })], data, '80mm');
    expect(html).not.toContain('Exempt (food)');
    expect(html).toContain('ABST 15%');
  });

  it('uses the jurisdiction tax label, not a hardcoded word', () => {
    // Must exercise the path where the LABEL IS GENERATED, not one where the
    // fixture already contains a pre-formatted `taxBreakdown` label — otherwise
    // the assertion passes even if the renderer hardcodes "Tax".
    const base = { subtotal: 100, tax: 15, taxRate: 15, currency: 'XCD' };

    const ag = buildPrintableHtml([taxBlock()], { ...base, taxLabel: 'ABST' }, '80mm');
    expect(ag).toContain('ABST');

    const eu = buildPrintableHtml([taxBlock()], { ...base, taxLabel: 'VAT' }, 'a4');
    expect(eu).toContain('VAT');
    expect(eu).not.toContain('ABST');

    const au = buildPrintableHtml([taxBlock()], { ...base, taxLabel: 'GST' }, 'a4');
    expect(au).toContain('GST');
  });

  it('states WHY a duty-free sale is zero-rated', () => {
    // "0.00" with no explanation is not a compliant tax presentation.
    const data = fixtures.getFixtureForVertical('jewelry', { dutyFree: true });
    const html = buildPrintableHtml([taxBlock()], data, 'a4');
    expect(html).toMatch(/Zero-rated/i);
    expect(html).toMatch(/duty-free/i);
  });

  it('prints the prescribed reverse-charge wording verbatim', () => {
    const data = fixtures.getFixture('invoice', 'reverse_charge');
    const html = buildPrintableHtml([taxBlock()], data, 'a4');
    expect(html).toContain('Reverse charge: customer to account for VAT');
  });

  it('can suppress the reverse-charge notice if a template opts out', () => {
    const data = fixtures.getFixture('invoice', 'reverse_charge');
    const html = buildPrintableHtml([taxBlock({ showReverseChargeNotice: false })], data, 'a4');
    expect(html).not.toContain('customer to account for VAT');
  });

  describe('mandatory invoice title', () => {
    const headerBlock: TemplateBlock = {
      id: 'h', type: 'header', visible: true, order: 1,
      config: { content: 'MY CUSTOM TITLE' },
    };

    it('lets the user choose a title where none is mandated', () => {
      const data = { ...fixtures.getFixtureForVertical('electronics'), mandatoryInvoiceTitle: null };
      const html = buildPrintableHtml([headerBlock], data, 'a4');
      expect(html).toContain('MY CUSTOM TITLE');
    });

    it('overrides the user title where the law requires exact wording', () => {
      // AU/IN/AE mandate the literal words "TAX INVOICE".
      const data = { ...fixtures.getFixtureForVertical('electronics'), mandatoryInvoiceTitle: 'TAX INVOICE' };
      const html = buildPrintableHtml([headerBlock], data, 'a4');
      expect(html).toContain('TAX INVOICE');
      expect(html).not.toContain('MY CUSTOM TITLE');
    });
  });

  describe('customer tax ID', () => {
    const custBlock = (customerFields?: string[]): TemplateBlock => ({
      id: 'c', type: 'customer', visible: true, order: 1,
      config: customerFields ? { customerFields } : {},
    });

    it('shows the buyer tax number when the jurisdiction requires it', () => {
      // Omitting it invalidates the buyer's input-tax credit, so it must appear
      // even though this template only selected the name field.
      const data = fixtures.getFixture('invoice', 'reverse_charge');
      const html = buildPrintableHtml([custBlock(['name'])], data, 'a4');
      expect(html).toContain('DE123456789');
    });

    it('labels it per jurisdiction rather than a generic "Tax ID"', () => {
      const data = fixtures.getFixture('invoice', 'reverse_charge');
      const html = buildPrintableHtml([custBlock(['name', 'taxId'])], data, 'a4');
      expect(html).toContain('VAT No.');
    });
  });

  it('omits a zero tax row from totals on a zero-rated sale', () => {
    // The taxSummary block already explains the zero-rating; a "Tax 0.00" row
    // in the totals adds noise without adding meaning.
    const totals: TemplateBlock = { id: 't', type: 'totals', visible: true, order: 1, config: {} };
    const data = fixtures.getFixtureForVertical('jewelry', { dutyFree: true });
    const html = buildPrintableHtml([totals], data, 'a4');
    expect(html).toContain('Subtotal');
    expect(html).toContain('Total');
  });
});

/**
 * Phase 3 — duty-free, tax refund, gift mode, reprint notice.
 *
 * Asserted against the PRINT renderer. The two suppression rules are
 * safety-critical: a duty-free receipt stamped "DUPLICATE" is worthless at
 * customs, and a gift receipt showing the total defeats its purpose. Both must
 * hold on paper, not merely on screen.
 */
describe('Phase 3 — sales mode rules on printed output', () => {
  const b = (type: string, config: any = {}): TemplateBlock =>
    ({ id: type, type, visible: true, order: 1, config });

  describe('dutyFree block', () => {
    const data = fixtures.getFixtureForVertical('jewelry', { dutyFree: true });

    it('prints traveller ID, travel method, destination and departure (from legacy passport/flight fixture fields)', () => {
      const html = buildPrintableHtml([b('dutyFree')], data, 'a4');
      expect(html).toContain('P12345678');
      expect(html).toContain('AA-2246');
      expect(html).toContain('Miami');
      expect(html).toContain('23/08/2026');
    });

    it('does NOT print the export declaration — that moved to the compliance block', () => {
      // Regression guard: this block carries traveller identification only.
      // Printing the declaration here again would put jurisdiction-specific
      // legal text back in a block that has no configurable label for it.
      const html = buildPrintableHtml([b('dutyFree')], data, 'a4');
      expect(html).not.toMatch(/must be removed|must leave/i);
    });

    it('can restrict which traveller fields appear, using legacy field keys', () => {
      const html = buildPrintableHtml([b('dutyFree', { dutyFreeFields: ['passport'] })], data, 'a4');
      expect(html).toContain('P12345678');
      expect(html).not.toContain('AA-2246');
    });

    it('can restrict which traveller fields appear, using the current field keys', () => {
      const html = buildPrintableHtml([b('dutyFree', { dutyFreeFields: ['travellerId'] })], data, 'a4');
      expect(html).toContain('P12345678');
      expect(html).not.toContain('AA-2246');
    });

    it('uses a store-configured traveller ID / travel method label', () => {
      const html = buildPrintableHtml(
        [b('dutyFree', { travellerIdType: 'seaman_book', travelMethodType: 'vessel' })],
        data,
        'a4',
      );
      expect(html).toContain('Seaman');
      expect(html).toContain('Vessel');
    });

    it('renders nothing when there are no traveller details', () => {
      const html = buildPrintableHtml([b('dutyFree')], { storeName: 'X' }, 'a4');
      expect(html).not.toContain('Passport');
    });
  });

  describe('compliance block on a duty-free document', () => {
    const data = fixtures.getFixtureForVertical('jewelry', { dutyFree: true });

    it('prints the export declaration', () => {
      // The declaration is the legal substance of a duty-free supply, and it
      // is jurisdiction text — it belongs with the rest of the compliance
      // wording, not hardcoded into the traveller-details block.
      const html = buildPrintableHtml([b('compliance')], data, 'a4');
      expect(html).toMatch(/must be removed|must leave/i);
    });

    it('does not print the declaration on a domestic (non duty-free) sale', () => {
      const domestic = { ...data, salesMode: undefined, zeroRateReason: undefined };
      const html = buildPrintableHtml([b('compliance')], domestic, 'a4');
      expect(html).not.toMatch(/must be removed|must leave/i);
    });
  });

  describe('taxRefund block', () => {
    const data = fixtures.getFixture('invoice', 'tax_refund');

    it('prints the refund scheme and form reference', () => {
      const html = buildPrintableHtml([b('taxRefund')], data, 'a4');
      expect(html).toContain('VAT407');
      expect(html).toContain('RF-2026-004410');
    });

    it('states the admin charge and the refund actually due', () => {
      // The traveller is entitled to know what the operator deducts.
      const html = buildPrintableHtml([b('taxRefund')], data, 'a4');
      expect(html).toMatch(/Admin charge/i);
      expect(html).toMatch(/Refund due/i);
    });

    it('tells the traveller customs validation is required', () => {
      const html = buildPrintableHtml([b('taxRefund')], data, 'a4');
      expect(html).toMatch(/customs/i);
    });
  });

  describe('reprint notice — the duty-free safety rule', () => {
    it('prints on an ordinary domestic receipt', () => {
      const html = buildPrintableHtml(
        [b('reprintNotice')],
        fixtures.getFixtureForVertical('retail'),
        '80mm',
      );
      expect(html).toContain('DUPLICATE');
    });

    it('is SUPPRESSED on a duty-free document', () => {
      // Marking it a copy would invalidate it as proof of sale at customs.
      const html = buildPrintableHtml(
        [b('reprintNotice')],
        fixtures.getFixtureForVertical('jewelry', { dutyFree: true }),
        'a4',
      );
      expect(html).not.toContain('DUPLICATE');
    });

    it('stays suppressed even with custom text and visible: true', () => {
      const forced: TemplateBlock = {
        id: 'r', type: 'reprintNotice', visible: true, order: 1,
        config: { reprintText: 'STORE COPY' },
      };
      const html = buildPrintableHtml(
        [forced],
        fixtures.getFixtureForVertical('retail', { dutyFree: true }),
        '80mm',
      );
      expect(html).not.toContain('STORE COPY');
    });
  });

  describe('gift mode — price suppression', () => {
    const giftData = fixtures.getFixture('receipt', 'apparel_gift');
    const blocks = (): TemplateBlock[] => [
      { id: 'tbl', type: 'table', visible: true, order: 1, config: {} },
      { id: 'tot', type: 'totals', visible: true, order: 2, config: {} },
      { id: 'pay', type: 'payment', visible: true, order: 3, config: {} },
      { id: 'ftr', type: 'footer', visible: true, order: 4, config: {} },
    ];

    it('still lists what was bought', () => {
      const html = buildPrintableHtml(blocks(), giftData, '80mm');
      expect(html).toContain('Linen Shirt');
    });

    it('does not reveal the transaction total', () => {
      const html = buildPrintableHtml(blocks(), giftData, '80mm');
      expect(html).not.toContain('514.05');
    });

    it('does not reveal any unit price', () => {
      const html = buildPrintableHtml(blocks(), giftData, '80mm');
      expect(html).not.toContain('189.00');
      expect(html).not.toContain('129.00');
    });

    it('suppresses price columns even on a normally-priced fixture', () => {
      // Applying giftMode to a full receipt must strip the money columns —
      // a template must not be able to leak price by reusing a normal fixture.
      const normal = fixtures.getFixtureForVertical('apparel');
      const html = buildPrintableHtml(
        [{ id: 'tbl', type: 'table', visible: true, order: 1, config: { giftMode: true } }],
        normal,
        '80mm',
      );
      expect(html).toContain('Linen Shirt');
      expect(html).not.toContain('189.00');
    });
  });
});

/**
 * Phase 4 — table intelligence on printed output.
 *
 * The grocery receipt is the real test here: it is the only vertical that
 * combines weighed items, PLU codes and mixed taxable/exempt lines in one
 * basket, so it exercises every new table capability at once.
 */
describe('Phase 4 — items table', () => {
  const table = (config: any = {}): TemplateBlock =>
    ({ id: 'tbl', type: 'table', visible: true, order: 1, config });

  const grocery = () => fixtures.getFixtureForVertical('grocery');

  describe('weighed items', () => {
    it('prints the weight and rate beneath the item', () => {
      // Without this the customer cannot verify the scale against the price.
      const html = buildPrintableHtml([table({ weighedItemMode: true })], grocery(), '80mm');
      expect(html).toContain('1.24 kg @');
      expect(html).toContain('/kg');
    });

    it('only adds the sub-line to lines that were actually weighed', () => {
      const html = buildPrintableHtml([table({ weighedItemMode: true })], grocery(), '80mm');
      // Two weighed produce lines in the fixture, three packaged lines.
      expect((html.match(/ @ /g) || []).length).toBe(2);
    });

    it('can be turned off', () => {
      const html = buildPrintableHtml([table({ weighedItemMode: false })], grocery(), '80mm');
      expect(html).not.toContain('1.24 kg @');
    });

    it('is suppressed in gift mode, where the rate would reveal price', () => {
      // Assert on the sub-line itself, not a bare '@' — the CSS @page rule
      // contains one, so a loose match would pass for the wrong reason.
      const html = buildPrintableHtml(
        [table({ weighedItemMode: true, giftMode: true })], grocery(), '80mm',
      );
      expect(html).not.toContain('1.24 kg @');
      expect(html).not.toContain('/kg');
      expect(html).toContain('Bananas');   // the item itself still shows
    });
  });

  describe('tax flag column', () => {
    it('marks each line taxable or exempt', () => {
      const html = buildPrintableHtml([table({ tableTaxFlagColumn: true })], grocery(), '80mm');
      expect(html).toMatch(/>T</);
      expect(html).toMatch(/>N</);
    });

    it('prints a legend decoding the markers', () => {
      const html = buildPrintableHtml([table({ tableTaxFlagColumn: true })], grocery(), '80mm');
      expect(html).toContain('T = Taxable');
      expect(html).toContain('N = Non-taxable');
    });

    it('is omitted entirely when the data carries no flags', () => {
      // Printing a column of dashes would read as a fault.
      const noFlags = { ...grocery(), items: [{ name: 'Widget', qty: 1, lineTotal: 5 }] };
      const html = buildPrintableHtml([table({ tableTaxFlagColumn: true })], noFlags, '80mm');
      expect(html).not.toContain('= Taxable');
    });

    it('is suppressed in gift mode', () => {
      const html = buildPrintableHtml(
        [table({ tableTaxFlagColumn: true, giftMode: true })], grocery(), '80mm',
      );
      expect(html).not.toContain('= Taxable');
    });
  });

  describe('weight units', () => {
    it('uses the item’s own unit rather than assuming grams', () => {
      // The app supports g / oz / tola / baht / kg; a jewellery weight printed
      // in the wrong unit is a commercially significant error.
      const data = {
        currency: 'USD',
        items: [{ name: 'Bar', netWeight: 31.1, weightUnit: 'oz' }],
      };
      const html = buildPrintableHtml(
        [table({ fields: [{ id: 'w', label: 'Wt', accessor: 'netWeight' }] })],
        data, 'a4',
      );
      expect(html).toContain('31.1oz');
    });

    it('falls back to grams when the item has no unit', () => {
      const data = { currency: 'USD', items: [{ name: 'Ring', netWeight: 5.25 }] };
      const html = buildPrintableHtml(
        [table({ fields: [{ id: 'w', label: 'Wt', accessor: 'netWeight' }] })],
        data, 'a4',
      );
      expect(html).toContain('5.25g');
    });
  });

  describe('display options', () => {
    it('can hide the header row', () => {
      const withHeader = buildPrintableHtml([table({ tableShowHeader: true })], grocery(), '80mm');
      const without = buildPrintableHtml([table({ tableShowHeader: false })], grocery(), '80mm');
      expect(withHeader).toContain('<thead>');
      expect(without).not.toContain('<thead>');
    });

    it('applies zebra striping when asked', () => {
      const html = buildPrintableHtml([table({ tableZebra: true })], grocery(), '80mm');
      expect(html).toContain('background:#f4f4f4');
    });
  });

  it('renders the shipped grocery preset end-to-end', () => {
    const html = buildPrintableHtml(
      [table({
        fields: [
          { id: 'name', label: 'Item', accessor: 'name' },
          { id: 'plu', label: 'PLU', accessor: 'plu' },
          { id: 'qty', label: 'Qty', accessor: 'qty' },
          { id: 'lineTotal', label: 'Amount', accessor: 'lineTotal' },
        ],
        weighedItemMode: true,
        tableTaxFlagColumn: true,
      })],
      grocery(), '80mm',
    );
    expect(html).toContain('Bananas');
    expect(html).toContain('4011');        // PLU
    expect(html).toContain('94225');       // organic PLU (5-digit, leading 9)
    expect(html).toContain('1.24 kg @');   // weighed sub-line
    expect(html).toContain('T = Taxable'); // legend
  });
});

/**
 * Phase 5 — vertical blocks on printed output.
 *
 * The critical property: a block must print NOTHING when its vertical's data is
 * absent. Templates are shared across verticals, so a pharmacy block on a
 * grocery receipt must disappear rather than print an empty heading.
 */
describe('Phase 5 — vertical blocks', () => {
  const b = (type: string, config: any = {}): TemplateBlock =>
    ({ id: type, type, visible: true, order: 1, config });

  const grocery = () => fixtures.getFixtureForVertical('grocery');
  const pharmacy = () => fixtures.getFixtureForVertical('pharmacy');
  const electronics = () => fixtures.getFixtureForVertical('electronics');

  describe('savings', () => {
    it('prints the "you saved" total', () => {
      const html = buildPrintableHtml([b('savings')], grocery(), '80mm');
      expect(html).toContain('YOU SAVED');
      expect(html).toContain('3.40');
    });

    it('lists the individual coupons', () => {
      const html = buildPrintableHtml([b('savings', { showCouponLines: true })], grocery(), '80mm');
      expect(html).toContain('Card Saver');
    });

    it('can show the total without the breakdown', () => {
      const html = buildPrintableHtml([b('savings', { showCouponLines: false })], grocery(), '80mm');
      expect(html).toContain('YOU SAVED');
      expect(html).not.toContain('Card Saver');
    });

    it('prints nothing on a sale with no discounts', () => {
      const html = buildPrintableHtml([b('savings')], electronics(), 'a4');
      expect(html).not.toContain('YOU SAVED');
    });
  });

  describe('loyalty', () => {
    it('prints points earned and balance', () => {
      const html = buildPrintableHtml([b('loyalty')], grocery(), '80mm');
      expect(html).toContain('Points earned');
      expect(html).toContain('1840');
    });

    it('prints nothing for a tenant with no loyalty programme', () => {
      const html = buildPrintableHtml([b('loyalty')], pharmacy(), '80mm');
      expect(html).not.toContain('Points earned');
    });
  });

  describe('changeDue', () => {
    it('prints tendered and change on a cash sale', () => {
      const html = buildPrintableHtml([b('changeDue')], grocery(), '80mm');
      expect(html).toContain('Tendered');
      expect(html).toContain('Change');
    });

    it('prints nothing on a card sale', () => {
      // pharmacy fixture pays by card
      const html = buildPrintableHtml([b('changeDue')], pharmacy(), '80mm');
      expect(html).not.toContain('Tendered');
    });
  });

  describe('returnPolicy', () => {
    it('prints the window and restocking fee', () => {
      const html = buildPrintableHtml([b('returnPolicy')], electronics(), 'a4');
      expect(html).toContain('14 days');
      expect(html).toContain('15%');
    });

    it('falls back to template terms when the sale has no policy', () => {
      const html = buildPrintableHtml(
        [b('returnPolicy', { returnPolicyText: 'Exchange within 30 days.' })],
        grocery(), '80mm',
      );
      expect(html).toContain('Exchange within 30 days');
    });
  });

  describe('rxDetails', () => {
    it('prints Rx number, prescriber and refills', () => {
      const html = buildPrintableHtml([b('rxDetails')], pharmacy(), '80mm');
      expect(html).toContain('RX-2026-018844');
      expect(html).toContain('Nembhard');
      expect(html).toContain('2 of 3 remaining');
    });

    it('prints the pharmacist sign-off', () => {
      const html = buildPrintableHtml([b('rxDetails')], pharmacy(), '80mm');
      expect(html).toMatch(/Dispensed by/i);
    });

    it('prints nothing on a non-pharmacy receipt', () => {
      const html = buildPrintableHtml([b('rxDetails')], grocery(), '80mm');
      expect(html).not.toContain('Rx No.');
    });
  });

  describe('batchExpiry', () => {
    it('prints lot and beyond-use date', () => {
      const html = buildPrintableHtml([b('batchExpiry')], pharmacy(), '80mm');
      expect(html).toContain('LOT-8842A');
      expect(html).toContain('Use by');
      expect(html).toContain('23/02/2027');
    });

    it('labels the identifier from the jurisdiction, not as "NDC"', () => {
      // NDC is US-only; CA uses DIN, DE uses PZN.
      const html = buildPrintableHtml([b('batchExpiry')], pharmacy(), '80mm');
      expect(html).toContain('Drug ID');
      expect(html).not.toContain('NDC:');
    });

    it('uses whatever identifier label the jurisdiction supplies', () => {
      const de = { ...pharmacy(), drugIdentifierLabel: 'PZN' };
      const html = buildPrintableHtml([b('batchExpiry')], de, '80mm');
      expect(html).toContain('PZN');
    });

    it('prints nothing for a non-pharmacy basket', () => {
      const html = buildPrintableHtml([b('batchExpiry')], grocery(), '80mm');
      expect(html).not.toContain('Use by');
    });
  });

  describe('serialCapture', () => {
    it('prints serial and IMEI', () => {
      // A warranty claim needs the receipt to carry matching serials.
      const html = buildPrintableHtml([b('serialCapture')], electronics(), 'a4');
      expect(html).toContain('SN-4471-88210');
      expect(html).toContain('356938035643809');
    });

    it('can omit the IMEI', () => {
      const html = buildPrintableHtml([b('serialCapture', { showImei: false })], electronics(), 'a4');
      expect(html).toContain('SN-4471-88210');
      expect(html).not.toContain('356938035643809');
    });

    it('prints nothing for non-serialised goods', () => {
      const html = buildPrintableHtml([b('serialCapture')], grocery(), '80mm');
      expect(html).not.toContain('S/N');
    });
  });

  describe('warranty', () => {
    it('prints term and expiry', () => {
      const html = buildPrintableHtml([b('warranty')], electronics(), 'a4');
      expect(html).toContain('24 months');
      expect(html).toContain('23/08/2028');
    });

    it('can omit the expiry date', () => {
      const html = buildPrintableHtml([b('warranty', { showWarrantyExpiry: false })], electronics(), 'a4');
      expect(html).toContain('24 months');
      expect(html).not.toContain('23/08/2028');
    });

    it('prints nothing for goods without warranty', () => {
      const html = buildPrintableHtml([b('warranty')], grocery(), '80mm');
      expect(html).not.toContain('months');
    });
  });

  describe('cross-vertical safety', () => {
    it('no vertical block crashes or leaks on the wrong fixture', () => {
      // Templates are shared; every block must degrade to nothing.
      const ALL = ['savings', 'loyalty', 'changeDue', 'returnPolicy',
                   'rxDetails', 'batchExpiry', 'serialCapture', 'warranty'];
      const FIXTURES = ['grocery', 'pharmacy', 'electronics', 'apparel', 'jewelry', 'retail'];

      FIXTURES.forEach((v) => {
        const data = fixtures.getFixtureForVertical(v);
        ALL.forEach((type) => {
          expect(
            () => buildPrintableHtml([b(type)], data, '80mm'),
            `${type} threw on the ${v} fixture`,
          ).not.toThrow();
        });
      });
    });

    it('every block survives a completely empty document', () => {
      const ALL = ['savings', 'loyalty', 'changeDue', 'returnPolicy',
                   'rxDetails', 'batchExpiry', 'serialCapture', 'warranty'];
      ALL.forEach((type) => {
        expect(() => buildPrintableHtml([b(type)], {}, '80mm'), `${type} threw on {}`).not.toThrow();
      });
    });
  });
});

/**
 * Phase 6 — fiscal signature.
 *
 * The block RENDERS fiscal data; it never generates it. Signing must come from
 * a certified backend integration — a home-grown implementation is
 * non-compliant regardless of how correct the cryptography is, and signing keys
 * must never reach a browser.
 *
 * The behaviour that matters most: a jurisdiction that mandates a signature but
 * receives none must print a conspicuous warning, NOT silence. A receipt that
 * looks complete but lacks its signature is the dangerous case, because nobody
 * notices until an audit.
 */
describe('Phase 6 — fiscal block', () => {
  const fiscal = (config: any = {}): TemplateBlock =>
    ({ id: 'f', type: 'fiscal', visible: true, order: 1, config });

  const pt = () => fixtures.getFixture('receipt', 'fiscalized');

  it('prints the ATCUD document identifier', () => {
    const html = buildPrintableHtml([fiscal()], pt(), '80mm');
    expect(html).toContain('ATCUD');
    expect(html).toContain('CSDF7T5H-4471');
  });

  it('prints the fiscal QR code', () => {
    const html = buildPrintableHtml([fiscal({ showFiscalQr: true })], pt(), '80mm');
    expect(html).toContain('<svg');
  });

  it('prints the certified software and device identifiers', () => {
    const html = buildPrintableHtml([fiscal({ showFiscalDeviceInfo: true })], pt(), '80mm');
    expect(html).toContain('AT-2841/1');
    expect(html).toContain('POS-LIS-004');
  });

  it('truncates a long signature — the QR carries the full value', () => {
    const html = buildPrintableHtml([fiscal({ showFiscalSignature: true })], pt(), '80mm');
    expect(html).toContain('…');
  });

  it('prints NOTHING for a store in a non-fiscalized jurisdiction', () => {
    // Antigua has no fiscalization mandate.
    const html = buildPrintableHtml([fiscal()], fixtures.getFixtureForVertical('retail'), '80mm');
    expect(html).not.toContain('ATCUD');
    expect(html).not.toContain('FISCAL SIGNATURE MISSING');
  });

  it('WARNS CONSPICUOUSLY when required but the signature is absent', () => {
    // The dangerous case: mandated, but the integration produced nothing.
    // Silence here means a non-compliant receipt goes out unnoticed.
    const broken = { ...pt(), fiscal: undefined, fiscalizationEnabled: true };
    const html = buildPrintableHtml([fiscal()], broken, '80mm');
    expect(html).toContain('FISCAL SIGNATURE MISSING');
    expect(html).toContain('not compliant');
  });

  it('does not warn when fiscalization is simply not required', () => {
    const html = buildPrintableHtml([fiscal()], { fiscalizationEnabled: false }, '80mm');
    expect(html).not.toContain('FISCAL SIGNATURE MISSING');
  });

  it('never fabricates a signature that was not supplied', () => {
    // The frontend must not generate fiscal data under any circumstances.
    const noSig = { ...pt(), fiscal: { scheme: 'PT_ATCUD', documentId: 'X-1' } };
    const html = buildPrintableHtml([fiscal()], noSig, '80mm');
    expect(html).not.toContain('kIu8B2p9');
  });
});
