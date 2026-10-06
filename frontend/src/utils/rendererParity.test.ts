import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  buildDocumentHeader, resolveTitle, resolveNumber,
  resolveNumberLabel, shouldRenderNumber, humaniseType,
} from './documentHeaderModel';
import { formatDocumentDate } from '@/services/templateReceiptService';
import { buildCustomRows } from './verticalBlockModel';

/**
 * Canvas / print parity.
 *
 * There are two renderers — TemplateCanvas (the designer) and
 * printTemplateRenderer (what reaches the printer) — and they drifted:
 *
 *   canvas: `RCT-002250`              print: `Receipt No. RCT-002250`
 *   canvas: ignored the show/hide setting
 *   canvas: 'Payment terms and conditions.'   print: nothing
 *   canvas: 'Duty-free compliance text placeholder.'  print: nothing
 *   both:   a column headed `taxFlag`, from `label || accessor`
 *
 * A designer that misrepresents the printed output is worse than no designer,
 * because people check it and trust it. Two implementations of one rule will
 * always drift; the fix is one implementation, and these tests keep it that
 * way.
 */

const SRC = (rel: string) => readFileSync(join(__dirname, rel), 'utf8');
const CANVAS = SRC('../components/print-templates/TemplateCanvas.tsx');
const PRINT = SRC('./printTemplateRenderer.ts');

describe('parity — the header is built in exactly one place', () => {
  it('both renderers call buildDocumentHeader', () => {
    expect(CANVAS).toContain('buildDocumentHeader');
    expect(PRINT).toContain('buildDocumentHeader');
  });

  it('neither renderer reimplements the title precedence', () => {
    // `mandatoryInvoiceTitle || ... || cfg.content` appearing in a renderer
    // means the rule has been copied back out of the shared module.
    [['canvas', CANVAS], ['print', PRINT]].forEach(([name, src]) => {
      expect(src, `${name} reimplements title precedence`)
        .not.toMatch(/mandatoryInvoiceTitle\s*\n?\s*\|\|/);
    });
  });

  it('neither renderer decides number visibility itself', () => {
    [['canvas', CANVAS], ['print', PRINT]].forEach(([name, src]) => {
      expect(src, `${name} reimplements number visibility`)
        .not.toMatch(/headerFields\.has\(['"]invoiceNumber['"]\)/);
    });
  });

  it('neither renderer builds its own number label', () => {
    [['canvas', CANVAS], ['print', PRINT]].forEach(([name, src]) => {
      expect(src, `${name} reimplements the number label`)
        .not.toMatch(/['"]Receipt No\.['"]/);
    });
  });
});

describe('parity — an empty column label is not a missing one', () => {
  /*
   * The tax flag column sets `label: ''` deliberately; the flags are decoded by
   * a legend beneath the table. `label || accessor` treats '' as missing and
   * resurrects the raw field name, so a column appeared headed `taxFlag` — in
   * BOTH renderers, so it printed too.
   */
  it('canvas uses ?? so a deliberate empty label survives', () => {
    expect(CANVAS).toMatch(/col\.label \?\? col\.accessor/);
    expect(CANVAS).not.toMatch(/col\.label \|\| col\.accessor/);
  });

  it('print uses ?? so a deliberate empty label survives', () => {
    expect(PRINT).toMatch(/col\.label \?\? col\.accessor/);
    expect(PRINT).not.toMatch(/col\.label \|\| col\.accessor/);
  });
});

describe('parity — the canvas invents no body text', () => {
  /*
   * Placeholder strings that read as document content are the subtlest form of
   * this bug: the designer shows wording that will never reach the page.
   * Designer hints are fine — they render dashed and italic with
   * data-designer-only — but they must come from BLOCK_EMPTY_HINTS.
   */
  const INVENTED = [
    'Payment terms and conditions.',
    'Duty-free compliance text placeholder.',
  ];

  INVENTED.forEach((text) => {
    it(`canvas no longer emits "${text}"`, () => {
      expect(CANVAS).not.toContain(text);
    });
  });

  it('those blocks fall back to the designer hint instead', () => {
    expect(CANVAS).toMatch(/return hint\('terms'\)/);
    expect(CANVAS).toMatch(/return hint\('compliance'\)/);
  });
});

describe('documentHeaderModel — the rules themselves', () => {
  it('jurisdiction wording outranks everything', () => {
    // AU / IN / AE mandate the literal words "TAX INVOICE".
    const title = resolveTitle(
      { mandatoryInvoiceTitle: 'TAX INVOICE', forceDocumentTitle: 'REFUND', documentTitle: 'X' },
      { content: 'My Invoice' },
    );
    expect(title).toBe('TAX INVOICE');
  });

  it('a borrowed template cannot impose its own title on a refund', () => {
    const title = resolveTitle(
      { forceDocumentTitle: 'REFUND / CREDIT NOTE' },
      { content: 'SALES RECEIPT' },
    );
    expect(title).toBe('REFUND / CREDIT NOTE');
  });

  it('otherwise the template\'s own title wins', () => {
    expect(resolveTitle({ documentTitle: 'Ignored' }, { content: 'MY RECEIPT' })).toBe('MY RECEIPT');
  });

  it('prefers the issued number over fixture numbers', () => {
    expect(resolveNumber({ documentNumber: 'A', invoiceNumber: 'B', receiptNumber: 'C' })).toBe('A');
  });

  it('labels by document kind', () => {
    expect(resolveNumberLabel({ documentType: 'receipt' })).toBe('Receipt No.');
    expect(resolveNumberLabel({ documentType: 'invoice' })).toBe('Invoice No.');
    expect(resolveNumberLabel({ documentType: 'receipt' }, { numberLabel: 'Slip' })).toBe('Slip');
  });

  describe('whether the number is shown', () => {
    it('a forced number beats a template that omits the field', () => {
      // A refund slip must carry its number even on a borrowed receipt layout.
      expect(shouldRenderNumber(
        { forceDocumentNumber: true }, { headerFields: ['date'] }, '80mm',
      )).toBe(true);
    });

    it('the tenant setting beats the template', () => {
      expect(shouldRenderNumber(
        { documentType: 'receipt', showNumberOnReceipt: true },
        { headerFields: ['date'] }, '80mm',
      )).toBe(true);
    });

    it('the tenant setting can also turn it OFF', () => {
      // The direction a boolean-OR implementation silently ignores.
      expect(shouldRenderNumber(
        { documentType: 'invoice', showNumberOnInvoice: false },
        { headerFields: ['invoiceNumber'] }, 'a4',
      )).toBe(false);
    });

    it('with no setting, the template decides', () => {
      expect(shouldRenderNumber({}, { headerFields: ['invoiceNumber'] }, '80mm')).toBe(true);
      expect(shouldRenderNumber({}, { headerFields: ['date'] }, '80mm')).toBe(false);
    });
  });

  describe('the assembled header', () => {
    const data = {
      documentType: 'receipt',
      documentNumber: 'RCT-002250',
      date: '23/08/2026 13:20',
      cashierName: 'R. Michael',
    };

    it('labels the number rather than printing it bare', () => {
      const { parts } = buildDocumentHeader(
        data, { headerFields: ['invoiceNumber', 'date', 'cashier'] }, '80mm',
      );
      expect(parts[0]).toBe('Receipt No. RCT-002250');
    });

    it('keeps the declared field order', () => {
      const { parts } = buildDocumentHeader(
        data, { headerFields: ['invoiceNumber', 'date', 'cashier'] }, '80mm',
      );
      expect(parts).toEqual([
        'Receipt No. RCT-002250', '23/08/2026 13:20', 'Emp: R. Michael',
      ]);
    });

    it('omits parts with no data rather than printing empty labels', () => {
      const { parts } = buildDocumentHeader(
        { documentType: 'receipt' }, { headerFields: ['invoiceNumber', 'date', 'cashier'] }, '80mm',
      );
      expect(parts).toEqual([]);
    });

    it('never returns an empty title', () => {
      expect(buildDocumentHeader({}, {}, '80mm').title).toBeTruthy();
    });
  });
});

describe('a template with no title of its own', () => {
  /*
   * `invoice` and `jewelry_invoice` ship with `content: ''` — falsy, so the
   * fallback runs. It used to be `documentType.toUpperCase()`, which printed
   * **JEWELRY_INVOICE**, underscore and all, at the top of a high-value
   * jewellery invoice. Found by rendering the real live path rather than by
   * reading the code.
   */
  it('never prints a raw type with underscores', () => {
    expect(humaniseType('jewelry_invoice')).not.toContain('_');
    expect(humaniseType('jewelry_certificate')).not.toContain('_');
  });

  it('uses the conventional wording, not just a prettier string', () => {
    // "TAX INVOICE" is what a jewellery invoice is called; it is a convention,
    // not formatting.
    expect(humaniseType('jewelry_invoice')).toBe('TAX INVOICE');
    expect(humaniseType('jewelry_certificate')).toBe('CERTIFICATE OF AUTHENTICITY');
    expect(humaniseType('return')).toMatch(/REFUND|CREDIT/);
  });

  it('degrades presentably for a type added later', () => {
    expect(humaniseType('delivery_note')).toBe('DELIVERY NOTE');
  });

  it('an empty template title falls through to it', () => {
    // The exact shape of the bug: content is '' rather than absent.
    expect(resolveTitle({ documentType: 'jewelry_invoice' }, { content: '' })).toBe('TAX INVOICE');
  });

  it('but a real template title still wins', () => {
    expect(resolveTitle({ documentType: 'jewelry_invoice' }, { content: 'MY INVOICE' })).toBe('MY INVOICE');
  });
});

describe('dates are formatted on the live path', () => {
  /*
   * saleToPrintData falls back to the raw value when given no formatter — by
   * design, because a visibly unformatted date gets reported while a silently
   * wrong one does not. But nothing on the live path ever supplied one, so
   * every template-printed document showed `2026-08-23T13:20:00.000Z`.
   */
  it('formats an ISO timestamp', () => {
    expect(formatDocumentDate('2026-08-23T13:20:00.000Z', 'DD/MM/YYYY')).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  it('honours the store pattern', () => {
    const dmy = formatDocumentDate('2026-08-23T13:20:00.000Z', 'DD/MM/YYYY');
    const mdy = formatDocumentDate('2026-08-23T13:20:00.000Z', 'MM/DD/YYYY');
    expect(dmy).not.toBe(mdy);
    expect(dmy.startsWith('23')).toBe(true);
    expect(mdy.startsWith('08')).toBe(true);
  });

  it('leaves an already-formatted string alone', () => {
    // Fixtures carry '23/08/2026'; reformatting would corrupt them.
    expect(formatDocumentDate('23/08/2026', 'DD/MM/YYYY')).toBe('23/08/2026');
  });

  it('returns junk unchanged rather than printing "Invalid Date"', () => {
    expect(formatDocumentDate('not a date', 'DD/MM/YYYY')).toBe('not a date');
  });

  it('the live sale path supplies a formatter', async () => {
    // The assertion that would have caught it: exercise renderSaleWithTemplate,
    // not the mapper in isolation.
    const defaults = require('../../../backend/services/printTemplateService').DEFAULT_BLOCKS;
    const { renderSaleWithTemplate } = await import('@/services/templateReceiptService');
    const r = await renderSaleWithTemplate(
      { id: 'a', documentNumber: 'INV-1', createdAt: '2026-08-23T13:20:00.000Z', total: 1, items: [] },
      {
        templateType: 'receipt',
        paperWidth: 80,
        context: { store: { name: 'S' }, dateFormat: 'DD/MM/YYYY' },
        loadTemplates: async () => ([{
          id: 't', tenantId: 'x', name: 'T', templateType: 'receipt', version: 1,
          isPublished: true, isDefault: true, blocks: defaults.receipt,
          createdAt: '', updatedAt: '',
        } as never]),
      },
    );
    expect(r!.html).not.toContain('2026-08-23T13:20:00.000Z');
    expect(r!.html).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe('parity — custom block rows', () => {
  /*
   * Found by LOOKING at the running designer, not by reading code: the refund
   * slip showed "Original Sale —" on the canvas while printing the real number.
   *
   * Cause: accessor support was added to the print renderer and not the canvas,
   * inside the very change that added it. Two implementations of one rule
   * diverge even when written minutes apart.
   */
  it('both renderers use buildCustomRows', () => {
    expect(CANVAS).toContain('buildCustomRows');
    expect(PRINT).toContain('buildCustomRows');
  });

  it('neither resolves custom values on its own', () => {
    /*
     * Scoped to the `custom` block. A blanket search for `f.value || '—'` also
     * matches the `gemstones` block — where BOTH renderers do the same thing,
     * so there is no divergence and flagging it would be a false positive that
     * teaches people to ignore this test.
     */
    const customBlock = (src: string) => {
      const i = src.indexOf("case 'custom'");
      return i === -1 ? '' : src.slice(i, i + 900);
    };
    [['canvas', CANVAS], ['print', PRINT]].forEach(([name, src]) => {
      const block = customBlock(src);
      expect(block, `${name} has no custom block`).not.toBe('');
      expect(block, `${name} resolves custom rows itself`).not.toMatch(/f\.value/);
    });
  });

  it('resolves a value from the document data', () => {
    const rows = buildCustomRows(
      [{ id: 'a', label: 'Original Sale', accessor: 'originalDocumentNumber' }],
      { originalDocumentNumber: 'INV-2026-001180' },
    );
    expect(rows).toEqual([{ label: 'Original Sale', value: 'INV-2026-001180' }]);
  });

  it('still supports a literal value', () => {
    expect(buildCustomRows([{ id: 'a', label: 'Note', value: 'Hand-written' }], {}))
      .toEqual([{ label: 'Note', value: 'Hand-written' }]);
  });

  it('DROPS an unresolvable row rather than showing a dash', () => {
    // "Original Sale —" reads as a fault, on paper and in the designer.
    expect(buildCustomRows([{ id: 'a', label: 'Original Sale', accessor: 'missing' }], {}))
      .toEqual([]);
  });

  it('drops an empty-string value', () => {
    expect(buildCustomRows([{ id: 'a', label: 'X', value: '' }], {})).toEqual([]);
  });
});
