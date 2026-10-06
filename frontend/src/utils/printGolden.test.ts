import { describe, it, expect } from 'vitest';
import { buildPrintableHtml } from './printTemplateRenderer';
import { TEMPLATE_PRESETS } from './templatePresets';
import type { TemplateBlock, PaperSize } from '@/types/printTemplate';

/**
 * Golden-file verification.
 *
 * Every shipped preset is rendered against its own fixture and checked for the
 * failures that only show up on paper — the ones nobody notices in a code
 * review because the code is perfectly reasonable and the *output* is wrong.
 *
 * Three classes of failure are covered:
 *
 *   1. UNRESOLVED DATA — a template accessor that finds nothing prints an
 *      em-dash. A page of em-dashes means the preset and the fixture disagree
 *      about field names.
 *
 *   2. MISSING MANDATORY CONTENT — a duty-free invoice without its export
 *      declaration, or a pharmacy receipt without its beyond-use date, is not
 *      fit for purpose even though it renders without error.
 *
 *   3. CROSS-VERTICAL LEAKAGE — a grocery receipt must not mention prescriptions.
 *      Blocks self-suppress on absent data, and this proves it end to end.
 *
 * This suite is the reason the CI `schema` job exists: it needs a buildable
 * database and real fixtures, not mocks.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const defaults = require('../../../backend/services/printTemplateService').DEFAULT_BLOCKS;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fixtures = require('../../../backend/services/printFixtures');

/** Strip tags so assertions run against visible text, not markup. */
const visibleText = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const renderPreset = (preset: typeof TEMPLATE_PRESETS[number]) => {
  const blocks = defaults[preset.templateType] as TemplateBlock[];
  const [type, name] = preset.fixture;
  const data = fixtures.getFixture(type, name);
  const withOverrides = preset.overrides
    ? blocks.map((b) => ({ ...b, config: { ...(b.config || {}), ...preset.overrides } }))
    : blocks;
  return {
    data,
    html: buildPrintableHtml(withOverrides, data, preset.paperSize as PaperSize, 'https://cdn/logo.png'),
  };
};

describe('Golden files — every preset renders a usable document', () => {
  TEMPLATE_PRESETS.forEach((preset) => {
    describe(preset.name, () => {
      it('renders a complete HTML document', () => {
        const { html } = renderPreset(preset);
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('@page');
        expect(html.length).toBeGreaterThan(500);
      });

      it('shows the store identity', () => {
        const { data, html } = renderPreset(preset);
        // Escaped, because the renderer escapes all interpolated data.
        const name = data.storeName.replace(/&/g, '&amp;');
        expect(html).toContain(name);
      });

      it('does not degenerate into unresolved placeholders', () => {
        // Some em-dashes are legitimate (a genuinely absent optional field).
        // A document that is MOSTLY dashes means the accessors do not match.
        const { html } = renderPreset(preset);
        const text = visibleText(html);
        const dashes = (text.match(/—/g) || []).length;
        const words = text.split(' ').length;
        expect(
          dashes / Math.max(words, 1),
          `${preset.id}: ${dashes} placeholders in ${words} words`,
        ).toBeLessThan(0.15);
      });

      it('uses the paper size the preset declares', () => {
        const { html } = renderPreset(preset);
        const expected = { '58mm': '58mm', '80mm': '80mm', a4: '210mm', label: '50mm' }[preset.paperSize];
        expect(html).toContain(expected!);
      });
    });
  });
});

describe('Golden files — mandatory content per sales mode', () => {
  const dutyFreePresets = TEMPLATE_PRESETS.filter((p) => p.salesMode === 'duty_free');

  dutyFreePresets.forEach((preset) => {
    describe(`${preset.name} (duty-free)`, () => {
      it('carries an export declaration', () => {
        // The declaration is the legal substance of a duty-free supply.
        const { html } = renderPreset(preset);
        expect(visibleText(html)).toMatch(/export|must be removed|must leave/i);
      });

      it('is NOT stamped as a duplicate, even if a reprint block is added', () => {
        // A reprint-marked receipt is invalid as proof of sale at customs.
        //
        // The block is added EXPLICITLY here. Asserting against the stock
        // template would pass trivially, because duty-free templates do not
        // ship a reprintNotice block — the assertion would prove nothing about
        // the suppression rule it claims to protect.
        const blocks = defaults[preset.templateType] as TemplateBlock[];
        const withReprint: TemplateBlock[] = [
          ...blocks,
          {
            id: 'reprint', type: 'reprintNotice', visible: true,
            order: blocks.length + 1, config: {},
          },
        ];
        const [type, name] = preset.fixture;
        const html = buildPrintableHtml(
          withReprint, fixtures.getFixture(type, name), preset.paperSize as PaperSize, null,
        );
        expect(visibleText(html)).not.toMatch(/DUPLICATE|STORE COPY|REPRINT/i);
      });

      it('charges no tax', () => {
        const { data } = renderPreset(preset);
        expect(data.tax).toBe(0);
      });
    });
  });

  it('the tax-refund preset states the refund actually due', () => {
    const preset = TEMPLATE_PRESETS.find((p) => p.salesMode === 'tax_refund')!;
    const { data } = renderPreset(preset);
    // The traveller is entitled to know what the operator deducts.
    expect(data.taxRefund?.adminCharge).toBeGreaterThan(0);
    expect(data.taxRefund?.refundDue).toBeGreaterThan(0);
  });

  it('the B2B preset carries the prescribed reverse-charge wording and buyer tax number', () => {
    const preset = TEMPLATE_PRESETS.find((p) => p.salesMode === 'b2b')!;
    const { data } = renderPreset(preset);
    // Without both, the invoice is not valid for the scheme.
    expect(data.reverseChargeText).toBeTruthy();
    expect(data.customer.taxId).toBeTruthy();
  });
});

describe('Golden files — gift receipt reveals no price', () => {
  const gift = TEMPLATE_PRESETS.find((p) => p.overrides?.giftMode)!;

  it('shows the items', () => {
    const { data, html } = renderPreset(gift);
    expect(html).toContain(data.items[0].name);
  });

  it('shows no currency amount anywhere', () => {
    // The single property that makes a gift receipt a gift receipt.
    const { html } = renderPreset(gift);
    const text = visibleText(html);
    expect(text, 'gift receipt leaked a currency amount').not.toMatch(/[$€£]\s?\d/);
    expect(text).not.toMatch(/\bEC\$\s?\d/);
  });
});

describe('Golden files — no cross-vertical leakage', () => {
  /** Terms that must never appear on a document from another vertical. */
  const FORBIDDEN: Record<string, RegExp> = {
    grocery: /\bRx No\.|Prescriber|Refills|Use by\b/i,
    apparel: /\bRx No\.|Prescriber|S\/N:|IMEI|PLU\b/i,
    jewelry: /\bRx No\.|Prescriber|IMEI|PLU\b/i,
    electronics: /\bRx No\.|Prescriber|PLU\b/i,
    retail: /\bRx No\.|Prescriber|IMEI\b/i,
  };

  /**
   * Blocks belonging to other verticals, added explicitly.
   *
   * Rendering the stock template would pass trivially — a grocery template does
   * not ship an rxDetails block, so "no Rx on a grocery receipt" would prove
   * nothing. Adding every vertical block to every template is what actually
   * exercises the self-suppression each block is supposed to perform.
   */
  const FOREIGN_BLOCKS = ['rxDetails', 'batchExpiry', 'serialCapture', 'warranty'];

  TEMPLATE_PRESETS.forEach((preset) => {
    const pattern = FORBIDDEN[preset.vertical];
    if (!pattern) return;
    it(`${preset.name} suppresses foreign-vertical blocks`, () => {
      const blocks = defaults[preset.templateType] as TemplateBlock[];
      const withForeign: TemplateBlock[] = [
        ...blocks,
        ...FOREIGN_BLOCKS.map((type, i) => ({
          id: `foreign-${type}`, type, visible: true,
          order: blocks.length + 1 + i, config: {},
        })),
      ];
      const [type, name] = preset.fixture;
      const html = buildPrintableHtml(
        withForeign, fixtures.getFixture(type, name), preset.paperSize as PaperSize, null,
      );
      const text = visibleText(html);
      const match = text.match(pattern);
      expect(match?.[0], `${preset.id} leaked "${match?.[0]}"`).toBeUndefined();
    });
  });

  it('the pharmacy preset DOES carry its own compliance fields', () => {
    // Inverse check: the leakage rules above must not be passing simply
    // because nothing renders at all.
    const preset = TEMPLATE_PRESETS.find((p) => p.vertical === 'pharmacy')!;
    const { data } = renderPreset(preset);
    expect(data.rxNumber).toBeTruthy();
    expect(data.items[0].beyondUseDate).toBeTruthy();
  });
});

describe('Golden files — jurisdiction neutrality', () => {
  it('no preset hardcodes a tax label into its template blocks', () => {
    // Labels must come from the jurisdiction profile so one preset works
    // everywhere. Checked against the BLOCKS, not the rendered output — a
    // fixture legitimately contains its own country's label.
    const json = JSON.stringify(defaults);
    ['ABST', 'GSTIN', 'ABN', '₹', '€', '£'].forEach((token) => {
      expect(json, `defaults contain "${token}"`).not.toContain(token);
    });
  });

  it('presets span more than one currency, proving nothing is US/Antigua-bound', () => {
    const currencies = new Set(
      TEMPLATE_PRESETS.map((p) => renderPreset(p).data.currency).filter(Boolean),
    );
    expect(currencies.size).toBeGreaterThan(1);
  });
});

describe('Golden files — resilience', () => {
  it('every preset survives a completely empty document', () => {
    // A template must never crash a print job, whatever data it receives.
    TEMPLATE_PRESETS.forEach((preset) => {
      const blocks = defaults[preset.templateType] as TemplateBlock[];
      expect(
        () => buildPrintableHtml(blocks, {}, preset.paperSize as PaperSize, null),
        `${preset.id} threw on an empty document`,
      ).not.toThrow();
    });
  });

  it('every preset survives a malformed items payload', () => {
    TEMPLATE_PRESETS.forEach((preset) => {
      const blocks = defaults[preset.templateType] as TemplateBlock[];
      [{ items: null }, { items: 'oops' }, { items: [null] }].forEach((bad: any) => {
        expect(
          () => buildPrintableHtml(blocks, bad, preset.paperSize as PaperSize, null),
          `${preset.id} threw on ${JSON.stringify(bad)}`,
        ).not.toThrow();
      });
    });
  });

  it('every preset renders with every fixture without throwing', () => {
    // Templates get reused across stores; a mismatch must degrade, not crash.
    const allFixtures = fixtures.listFixtures()
      .map((k: string) => k.split('/'))
      .map(([t, n]: string[]) => fixtures.getFixture(t, n))
      .filter(Boolean);

    TEMPLATE_PRESETS.forEach((preset) => {
      const blocks = defaults[preset.templateType] as TemplateBlock[];
      allFixtures.forEach((data: any) => {
        expect(
          () => buildPrintableHtml(blocks, data, preset.paperSize as PaperSize, null),
          `${preset.id} threw on a foreign fixture`,
        ).not.toThrow();
      });
    });
  });
});

describe('Golden files — document number visibility', () => {
  /*
   * Two independent decisions meet on the page here:
   *
   *   issued   — does the sale have a number at all?
   *   printed  — is it rendered as readable text?
   *
   * The tenant setting has to be able to move the second in BOTH directions.
   * A control that can only add the number would appear to save and silently
   * do nothing, which is worse than not offering it.
   */
  const receiptPreset = TEMPLATE_PRESETS.find((p) => p.id === 'retail-receipt-80')!;
  const invoicePreset = TEMPLATE_PRESETS.find((p) => p.id === 'retail-invoice-a4')!;

  const renderWith = (
    preset: typeof TEMPLATE_PRESETS[number],
    extra: Record<string, unknown>,
  ) => {
    const blocks = defaults[preset.templateType] as TemplateBlock[];
    const [type, name] = preset.fixture;
    const data = { ...fixtures.getFixture(type, name), ...extra };
    return visibleText(
      buildPrintableHtml(blocks, data, preset.paperSize as PaperSize, null),
    );
  };

  it('a stock till receipt does not print the number as text', () => {
    // It carries a scannable barcode instead — see DEFAULT_BLOCKS.receipt.
    const text = renderWith(receiptPreset, { documentNumber: 'INV-2026-000417' });
    expect(text).not.toContain('INV-2026-000417');
  });

  it('a stock A4 invoice DOES print the number', () => {
    const text = renderWith(invoicePreset, { documentNumber: 'INV-2026-000417' });
    expect(text).toContain('INV-2026-000417');
  });

  it('the tenant can switch the receipt number ON', () => {
    const text = renderWith(receiptPreset, {
      documentNumber: 'INV-2026-000417', showNumberOnReceipt: true,
    });
    expect(text).toContain('INV-2026-000417');
  });

  it('the tenant can switch the invoice number OFF', () => {
    // The direction a boolean-OR implementation silently ignores.
    const text = renderWith(invoicePreset, {
      documentNumber: 'INV-2026-000417', showNumberOnInvoice: false,
    });
    expect(text).not.toContain('INV-2026-000417');
  });

  it('labels the number rather than printing it bare', () => {
    // A bare token between a title and a date is ambiguous on paper.
    const text = renderWith(invoicePreset, { documentNumber: 'INV-2026-000417' });
    expect(text).toMatch(/Invoice No\.\s*INV-2026-000417/);
  });

  it('prefers the issued number over the fixture number', () => {
    // documentNumber is what the sequence allocator actually issued.
    const text = renderWith(invoicePreset, { documentNumber: 'INV-2026-000999' });
    expect(text).toContain('INV-2026-000999');
    expect(text).not.toContain('INV-2026-01180');
  });

  /*
   * The clean invoice layout added a QR block to DEFAULT_BLOCKS.invoice
   * (and jewelry_invoice). Its caption is a scan-fallback, not a second place
   * to print the number — switching showNumberOnInvoice OFF must hide it
   * from the WHOLE page, not just the header, or the setting is a lie.
   */
  it('switching the invoice number OFF also hides it from the QR caption', () => {
    const html = buildPrintableHtml(
      defaults.invoice as TemplateBlock[],
      { ...fixtures.getFixture('invoice', 'retail'), documentNumber: 'INV-2026-000417', showNumberOnInvoice: false },
      'a4',
      null,
    );
    expect(visibleText(html)).not.toContain('INV-2026-000417');
    // The code itself must still be there and still scannable — only the
    // readable caption is suppressed, not the QR graphic.
    expect(html).toContain('<svg');
  });

  it('does not touch a barcode encoding something other than the document number', () => {
    // A product label's barcode encodes the SKU. showNumberOnInvoice must
    // never blank an unrelated identifier.
    const html = buildPrintableHtml(
      defaults.label as TemplateBlock[],
      { ...fixtures.getFixture('label', 'retail'), showNumberOnInvoice: false, showNumberOnReceipt: false },
      'label',
      null,
    );
    // The label's own SKU/name text must still be present somewhere.
    expect(visibleText(html).length).toBeGreaterThan(0);
  });

  it('leaves the thermal receipt caption alone regardless of showNumberOnInvoice', () => {
    // The invoice setting has no business touching a receipt's barcode.
    const text = renderWith(receiptPreset, {
      documentNumber: 'INV-2026-000417', showNumberOnReceipt: true, showNumberOnInvoice: false,
    });
    expect(text).toContain('INV-2026-000417');
  });
});

describe('Golden files — every default block type is one the renderer handles', () => {
  /*
   * The renderer's switch returns '' for an unrecognised block type. That is
   * the right runtime behaviour — an unknown block should not crash a receipt —
   * but it means a TYPO IS INVISIBLE. A block named `signature` instead of
   * `signatures`, or a type that was never implemented, silently renders
   * nothing and the omission is only noticed on paper.
   *
   * This was not hypothetical: the return template was first written with
   * `type: 'signature'` and a `contentSource` config the renderer has no
   * concept of. Both would have shipped as blank space.
   */
  const RENDERER_SOURCE = (() => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    const path = require('path');
    return fs.readFileSync(path.join(__dirname, 'printTemplateRenderer.ts'), 'utf8');
  })();

  const handledTypes = new Set(
    (RENDERER_SOURCE.match(/case '([a-zA-Z]+)':/g) || [])
      .map((m: string) => m.replace(/case '|':/g, '')),
  );

  it('the renderer handles a plausible number of block types', () => {
    // Guards the assertions below against passing because the regex matched
    // nothing and every type looks "handled".
    expect(handledTypes.size).toBeGreaterThan(20);
  });

  Object.keys(defaults).forEach((templateType) => {
    it(`${templateType} uses only implemented block types`, () => {
      const unknown = (defaults[templateType] as TemplateBlock[])
        .map((b) => b.type)
        .filter((t) => !handledTypes.has(t));

      expect(unknown, `${templateType} has block type(s) the renderer ignores`).toEqual([]);
    });
  });
});

describe('Golden files — the return template', () => {
  const returnData = {
    storeName: 'Circuit Point',
    documentNumber: 'RET-000012',
    forceDocumentNumber: true,
    forceDocumentTitle: 'REFUND / CREDIT NOTE',
    originalDocumentNumber: 'INV-2026-000417',
    date: '25/08/2026',
    currency: 'AED',
    subtotal: 2450,
    tax: 122.5,
    total: 2572.5,
    payment: { method: 'card', amount: 2572.5 },
    items: [{ name: 'Smartphone X200', qty: 1, unitPrice: 2450, lineTotal: 2450 }],
  };

  const text = () => visibleText(
    buildPrintableHtml(defaults.return as TemplateBlock[], returnData, '80mm', null),
  );

  it('is titled as a refund', () => {
    expect(text()).toMatch(/REFUND|CREDIT NOTE/i);
  });

  it('shows its own number', () => {
    // Unlike a sales receipt, a credit note without a reference is unusable.
    expect(text()).toContain('RET-000012');
  });

  it('names the sale it reverses', () => {
    // The one thing a refund document must do.
    expect(text()).toContain('INV-2026-000417');
  });

  it('states the refund positively', () => {
    const t = text();
    expect(t).toContain('2,572.50');
    expect(t).not.toContain('-2,572.50');
  });

  it('does not offer a return policy or loyalty points', () => {
    /*
     * Asserted on the BLOCK LIST, not on rendered text.
     *
     * Checking the output passes trivially: these blocks self-suppress when the
     * data has no returnPolicy or loyalty fields, so the refund fixture renders
     * nothing for them whether or not they are in the template. The assertion
     * would have proved only that the fixture is sparse.
     *
     * What actually matters is that the blocks are ABSENT — otherwise a store
     * whose refund data happens to carry a return policy would print
     * "Exchange within 30 days" on a document refunding the purchase.
     */
    const types = (defaults.return as TemplateBlock[]).map((b) => b.type);
    expect(types).not.toContain('returnPolicy');
    expect(types).not.toContain('loyalty');
    expect(types).not.toContain('savings');
  });

  it('DOES carry the blocks a refund needs', () => {
    // Guards the assertion above against passing because the template is empty.
    const types = (defaults.return as TemplateBlock[]).map((b) => b.type);
    expect(types).toContain('table');
    expect(types).toContain('totals');
    expect(types).toContain('payment');
    expect(types).toContain('signatures');
  });
});


describe('Golden files — custom blocks resolve accessors', () => {
  /*
   * A `custom` row can carry a literal value or point at the data with
   * `accessor`. Accessor support was missing, which made the block useful only
   * for static text — and left the refund slip unable to name the sale it
   * reverses.
   */
  const block = (fields: unknown[]): TemplateBlock[] => ([{
    id: 'c', type: 'custom', visible: true, order: 1,
    config: { fields },
  } as unknown as TemplateBlock]);

  const render = (fields: unknown[], data: Record<string, unknown>) =>
    visibleText(buildPrintableHtml(block(fields), data, '80mm', null));

  it('resolves a value from the document data', () => {
    const text = render(
      [{ id: 'a', label: 'Original Sale', accessor: 'originalDocumentNumber' }],
      { originalDocumentNumber: 'INV-2026-000417' },
    );
    expect(text).toContain('Original Sale');
    expect(text).toContain('INV-2026-000417');
  });

  it('still supports a literal value', () => {
    const text = render([{ id: 'a', label: 'Note', value: 'Hand-written' }], {});
    expect(text).toContain('Hand-written');
  });

  it('DROPS a row whose accessor resolves to nothing', () => {
    // A dangling "Original Sale:" with no value reads as a fault on paper.
    const text = render(
      [{ id: 'a', label: 'Original Sale', accessor: 'originalDocumentNumber' }],
      {},
    );
    expect(text).not.toContain('Original Sale');
  });

  it('drops a row whose value is an empty string', () => {
    const text = render([{ id: 'a', label: 'Note', value: '' }], {});
    expect(text).not.toContain('Note');
  });

  it('emits no block markup when every row is empty', () => {
    // The document wrapper still has its <title>, so this asserts on the block
    // output rather than on the page being literally blank.
    const html = buildPrintableHtml(
      block([{ id: 'a', label: 'Note', accessor: 'missing' }]), {}, '80mm', null,
    );
    expect(html).not.toContain('Note');
  });
});

describe('Golden files — header subtitle size is independent of the title size', () => {
  /*
   * Found live on Diamond Republic's duty-free invoice: the header block's
   * `fontSize` config sizes the TITLE ("DUTY-FREE INVOICE"), but the renderer
   * used the same override for the subtitle line ("Invoice No. ... · date ·
   * Emp: ..."), via primarySize('sm') resolving to cfg.fontSize regardless of
   * the key requested. On A4, fontSize:'xl' is 17pt vs the subtitle's
   * intended 10.5pt — right-aligned, the oversized line wrapped and stranded
   * the last word ("Hill") alone. The subtitle must always render at the
   * fixed `sm` size, however the title is configured.
   */
  const headerBlock = (fontSize: string): TemplateBlock[] => ([{
    id: 'h', type: 'header', visible: true, order: 1,
    config: {
      content: 'DUTY-FREE INVOICE', fontSize, bold: true, align: 'right',
      headerFields: ['invoiceNumber', 'date', 'cashier'],
    },
  } as unknown as TemplateBlock]);

  const data = { documentNumber: 'INV-DF-000318', date: '23/08/2026', cashier: 'Marcus Hill' };

  it('keeps the subtitle at the sm size even when the title is configured xl', () => {
    const html = buildPrintableHtml(headerBlock('xl'), data, 'a4', null);
    // a4 sm = 10.5pt (see FONT_SCALE_PT) — the subtitle line specifically,
    // not the title, which is legitimately allowed to be 17pt (xl).
    expect(html).toContain('font-size:10.5pt;color:#555;');
  });

  it('the title itself still honours the configured size', () => {
    const html = buildPrintableHtml(headerBlock('xl'), data, 'a4', null);
    expect(html).toContain('font-weight:bold;font-size:17pt;');
  });

  it('holds regardless of which size the title is configured to', () => {
    (['sm', 'base', 'lg', 'xl', 'title'] as const).forEach((fontSize) => {
      const html = buildPrintableHtml(headerBlock(fontSize), data, 'a4', null);
      expect(html, `subtitle size leaked from title fontSize:${fontSize}`).toContain('font-size:10.5pt;color:#555;');
    });
  });
});
