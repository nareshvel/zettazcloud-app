import { describe, it, expect, vi } from 'vitest';
import {
  renderSaleWithTemplate,
  selectTemplate,
  paperSizeFromWidth,
  renderReturnWithTemplate,
} from './templateReceiptService';
import type { PrintTemplate } from './printService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const defaults = require('../../../backend/services/printTemplateService').DEFAULT_BLOCKS;

/**
 * Template-driven printing of a real sale.
 *
 * The property that matters most is NOT that templates render — it is that a
 * template problem never stops a receipt being printed. A cashier has a
 * customer at the counter. A slightly-wrong receipt is recoverable; no receipt
 * is not.
 *
 * So every failure path here must return null (meaning "use the built-in
 * receipt") rather than throw. Each test below is one way the template path can
 * fail in the field.
 */

const SALE = {
  id: '9f2c1a84-3b7e-4d10-b0e1-4471882105cc',
  documentNumber: 'INV-2026-000417',
  createdAt: '2026-08-23T13:20:00.000Z',
  subtotal: 2930,
  tax: 439.5,
  total: 3369.5,
  cashierName: 'K. Browne',
  items: [{ name: 'Smartphone X200', quantity: 1, price: 2450, lineTotal: 2450 }],
};

const template = (over: Partial<PrintTemplate> = {}): PrintTemplate => ({
  id: 't1',
  tenantId: 'tenant',
  name: 'Sales Receipt',
  templateType: 'receipt',
  version: 1,
  isPublished: true,
  isDefault: true,
  blocks: defaults.receipt,
  createdAt: '',
  updatedAt: '',
  ...over,
} as PrintTemplate);

const render = (templates: PrintTemplate[] | Promise<never>, opts = {}) =>
  renderSaleWithTemplate(SALE, {
    storeId: 's1',
    paperWidth: 80,
    context: { store: { name: 'Circuit Point', currencyCode: 'AED' } },
    loadTemplates: () => (Array.isArray(templates)
      ? Promise.resolve(templates)
      : templates as Promise<never>),
    ...opts,
  });

describe('paperSizeFromWidth', () => {
  it('maps thermal widths', () => {
    expect(paperSizeFromWidth(58)).toBe('58mm');
    expect(paperSizeFromWidth(80)).toBe('80mm');
    expect(paperSizeFromWidth('80')).toBe('80mm');
  });

  it('treats a page-width setting as A4', () => {
    expect(paperSizeFromWidth(210)).toBe('a4');
  });

  it('defaults to 80mm when unset or unrecognised', () => {
    // The common POS case. Guessing A4 would send a page layout to a till roll.
    expect(paperSizeFromWidth(null)).toBe('80mm');
    expect(paperSizeFromWidth(undefined)).toBe('80mm');
    expect(paperSizeFromWidth('wide')).toBe('80mm');
  });
});

describe('selectTemplate', () => {
  it('prefers the template marked default', () => {
    const chosen = selectTemplate([
      template({ id: 'a', isDefault: false }),
      template({ id: 'b', isDefault: true }),
    ], 'receipt');
    expect(chosen?.id).toBe('b');
  });

  it('falls back to any published template of the type', () => {
    // A store that published exactly one and never marked it default clearly
    // means to use it. Refusing would drop them onto the legacy receipt for a
    // reason they could not guess.
    const chosen = selectTemplate([template({ id: 'a', isDefault: false })], 'receipt');
    expect(chosen?.id).toBe('a');
  });

  it('never uses an unpublished template', () => {
    // A draft is work in progress and may be half-edited.
    expect(selectTemplate([template({ isPublished: false })], 'receipt')).toBeNull();
  });

  it('never uses a template of a different type', () => {
    expect(selectTemplate([template({ templateType: 'invoice' })], 'receipt')).toBeNull();
  });

  it('returns null when there is nothing to choose', () => {
    expect(selectTemplate([], 'receipt')).toBeNull();
  });

  it('honors an explicit published template over the default', () => {
    const chosen = selectTemplate([
      template({ id: 'default', isDefault: true }),
      template({ id: 'configured', isDefault: false }),
    ], 'receipt', 'configured');
    expect(chosen?.id).toBe('configured');
  });

  it('rejects an explicit template when it is unpublished or incompatible', () => {
    expect(selectTemplate([
      template({ id: 'draft', isPublished: false }),
    ], 'receipt', 'draft')).toBeNull();
    expect(selectTemplate([
      template({ id: 'invoice', templateType: 'invoice' }),
    ], 'receipt', 'invoice')).toBeNull();
  });
});

describe('renderSaleWithTemplate — the happy path', () => {
  it('renders a complete document', async () => {
    const result = await render([template()]);
    expect(result).not.toBeNull();
    expect(result!.html).toContain('<!DOCTYPE html>');
    expect(result!.templateName).toBe('Sales Receipt');
  });

  it('renders the real sale, not a fixture', async () => {
    const result = await render([template()]);
    expect(result!.html).toContain('Smartphone X200');
    expect(result!.html).toContain('Circuit Point');
  });

  it('renders the explicitly configured template', async () => {
    const result = await render([
      template({ id: 'default', name: 'Default Receipt', isDefault: true }),
      template({ id: 'configured', name: 'Configured Receipt', isDefault: false }),
    ], { templateId: 'configured' });
    expect(result!.templateId).toBe('configured');
    expect(result!.templateName).toBe('Configured Receipt');
  });

  it('carries the recorded total', async () => {
    const result = await render([template()]);
    expect(result!.html).toContain('3,369.50');
  });

  it('returns css alongside html to match the legacy shape', async () => {
    // buildPrintableHtml inlines its styles, so css is empty — but the shape
    // has to match or the caller destructures undefined.
    const result = await render([template()]);
    expect(result!.css).toBe('');
  });
});

describe('renderSaleWithTemplate — falls back instead of failing', () => {
  /*
   * Each of these is a real way the template path breaks in the field. In every
   * one the answer is null, so the caller prints the built-in receipt.
   */

  it('when the store has no template', async () => {
    expect(await render([])).toBeNull();
  });

  it('when the only template is unpublished', async () => {
    expect(await render([template({ isPublished: false })])).toBeNull();
  });

  it('when the template has no blocks', async () => {
    // Would otherwise render a blank page, which looks like a printer fault.
    expect(await render([template({ blocks: [] })])).toBeNull();
    expect(await render([template({ blocks: null as any })])).toBeNull();
  });

  it('when the template API call fails', async () => {
    // Offline till, expired session, backend restart.
    const result = await renderSaleWithTemplate(SALE, {
      loadTemplates: () => Promise.reject(new Error('network down')),
    });
    expect(result).toBeNull();
  });

  it('when rendering itself throws', async () => {
    const result = await renderSaleWithTemplate(SALE, {
      loadTemplates: () => Promise.resolve([template({ blocks: 'not-an-array' as any })]),
    });
    expect(result).toBeNull();
  });

  it('when there is no sale', async () => {
    expect(await renderSaleWithTemplate(null as any)).toBeNull();
  });

  it('never throws, whatever it is given', async () => {
    // The guarantee the caller relies on to keep the till working.
    const nasty = [
      () => Promise.reject(new Error('boom')),
      () => Promise.resolve(null as any),
      () => Promise.resolve(undefined as any),
      () => { throw new Error('sync throw'); },
    ];
    for (const loadTemplates of nasty) {
      await expect(
        renderSaleWithTemplate(SALE, { loadTemplates: loadTemplates as any }),
      ).resolves.toBeDefined();
    }
  });
});

describe('renderReturnWithTemplate', () => {
  const RETURN = {
    return_number: 'RET-000012',
    original_sale_id: '9f2c1a84-3b7e-4d10-b0e1-4471882105cc',
    return_date: '2026-08-25T10:00:00.000Z',
    subtotal_amount: 2450,
    tax_amount: 122.5,
    total_return_amount: 2572.5,
    refund_method: 'card',
    items: [
      { product_name: 'Smartphone X200', quantity_returned: 1, unit_price: 2450, total_amount: 2450 },
    ],
  };

  const renderReturn = (byType: Record<string, PrintTemplate[]>) =>
    renderReturnWithTemplate(RETURN, {
      paperWidth: 80,
      context: { store: { name: 'Circuit Point', currencyCode: 'AED' } },
      loadTemplates: ({ templateType }) => Promise.resolve(byType[templateType!] || []),
    });

  it('uses a dedicated return template when one exists', async () => {
    const result = await renderReturn({
      return: [template({ id: 'ret', templateType: 'return', name: 'Refund Slip' })],
      receipt: [template()],
    });
    expect(result!.templateName).toBe('Refund Slip');
  });

  it('does not fall back to a sale receipt when no return template exists', async () => {
    const result = await renderReturn({ return: [], receipt: [template()] });
    expect(result).toBeNull();
  });

  it('titles the document as a refund, not a sale', async () => {
    const result = await renderReturn({
      return: [template({ id: 'ret', templateType: 'return', name: 'Refund Slip' })],
    });
    expect(result!.html).toMatch(/REFUND|CREDIT NOTE/i);
  });

  it('shows the return number and the returned line', async () => {
    const result = await renderReturn({
      return: [template({ id: 'ret', templateType: 'return', name: 'Refund Slip' })],
    });
    expect(result!.html).toContain('RET-000012');
    expect(result!.html).toContain('Smartphone X200');
  });

  it('falls back rather than throwing when the API fails', async () => {
    const result = await renderReturnWithTemplate(RETURN, {
      loadTemplates: () => Promise.reject(new Error('offline')),
    });
    expect(result).toBeNull();
  });

  it('falls back when the store has no templates at all', async () => {
    expect(await renderReturn({ return: [], receipt: [] })).toBeNull();
  });

  it('returns null for no return', async () => {
    expect(await renderReturnWithTemplate(null as any)).toBeNull();
  });
});
