import { describe, it, expect } from 'vitest';
import { buildPrintableHtml } from './printTemplateRenderer';
import type { TemplateBlock } from '@/types/printTemplate';

/**
 * Print renderer tests.
 *
 * The print renderer and the on-screen canvas are two separate implementations of
 * the same template semantics. They have drifted twice already:
 *   * logo layout presets rendered on canvas but were ignored in print
 *   * `barcodeSource` was configurable in the UI but neither renderer read it
 *
 * These tests pin the behaviours that drift silently — a wrong receipt is only
 * discovered on paper, usually by a customer.
 */

const block = (over: Partial<TemplateBlock> & { type: string }): TemplateBlock => ({
  id: `${over.type}-1`,
  visible: true,
  order: 1,
  ...over,
});

const FIXTURE = {
  storeName: 'Diamond Republic',
  storeAddress: '100 Heritage Quay, St. John’s',
  storePhone: '+1-268-555-0100',
  storeEmail: 'sales@diamondrepublic.ag',
  storeTaxId: 'ABST-0001',
  receiptNumber: 'RCT-000042',
  invoiceNumber: 'INV-000042',
  date: '23/08/2026',
  cashierName: 'Marcus Hill',
  currency: 'USD',
  customer: { name: 'Jane Doe', address: '456 Traveler Ave' },
  items: [
    { name: '22KT Gold Ring', qty: 1, unitPrice: 450, lineTotal: 450, sku: 'SKU-1', pieceCode: 'PC-000001' },
  ],
  subtotal: 450,
  total: 517.5,
};

describe('buildPrintableHtml', () => {
  it('produces a complete HTML document', () => {
    const html = buildPrintableHtml([block({ type: 'header' })], FIXTURE, 'a4');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('@page');
  });

  it('omits blocks marked not visible', () => {
    const html = buildPrintableHtml(
      [block({ type: 'header', config: { content: 'SHOULD NOT APPEAR' }, visible: false })],
      FIXTURE,
      'a4',
    );
    expect(html).not.toContain('SHOULD NOT APPEAR');
  });

  it('renders blocks in `order`, not array position', () => {
    const html = buildPrintableHtml(
      [
        block({ id: 'b', type: 'header', order: 2, config: { content: 'SECOND' } }),
        block({ id: 'a', type: 'header', order: 1, config: { content: 'FIRST' } }),
      ],
      FIXTURE,
      'a4',
    );
    expect(html.indexOf('FIRST')).toBeLessThan(html.indexOf('SECOND'));
  });

  it('escapes user-supplied content (no HTML injection via template config)', () => {
    const html = buildPrintableHtml(
      [block({ type: 'header', config: { content: '<script>alert(1)</script>' } })],
      FIXTURE,
      'a4',
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  describe('paper sizing', () => {
    it.each([
      ['58mm', '58mm'],
      ['80mm', '80mm'],
      ['a4', '210mm'],
    ] as const)('%s uses the correct physical page width', (paper, expected) => {
      const html = buildPrintableHtml([block({ type: 'header' })], FIXTURE, paper);
      expect(html).toContain(expected);
    });

    it('gives A4 a fixed height but leaves thermal roll length automatic', () => {
      expect(buildPrintableHtml([block({ type: 'header' })], FIXTURE, 'a4')).toContain('297mm');
      expect(buildPrintableHtml([block({ type: 'header' })], FIXTURE, '80mm')).toContain('auto');
    });
  });

  describe('logo layouts — must match the on-screen canvas', () => {
    const logo = (config: Record<string, unknown>) =>
      buildPrintableHtml([block({ type: 'logo', config })], FIXTURE, 'a4', 'https://cdn/logo.png');

    it('logo_only shows the image and no store name', () => {
      const html = logo({ logoLayout: 'logo_only' });
      expect(html).toContain('https://cdn/logo.png');
      expect(html).not.toContain('Diamond Republic');
    });

    it('logo_name shows both image and store name', () => {
      const html = logo({ logoLayout: 'logo_name' });
      expect(html).toContain('https://cdn/logo.png');
      expect(html).toContain('Diamond Republic');
    });

    it('name_only shows the store name and no image', () => {
      const html = logo({ logoLayout: 'name_only' });
      expect(html).toContain('Diamond Republic');
      expect(html).not.toContain('https://cdn/logo.png');
    });

    it('logo_name_contact includes the selected contact fields', () => {
      const html = logo({
        logoLayout: 'logo_name_contact',
        logoContactFields: ['address', 'phone'],
      });
      expect(html).toContain('100 Heritage Quay');
      expect(html).toContain('+1-268-555-0100');
      // email was not selected
      expect(html).not.toContain('sales@diamondrepublic.ag');
    });

    it('centre alignment stacks image above text (column layout)', () => {
      const html = logo({ logoLayout: 'logo_name', align: 'center' });
      expect(html).toContain('flex-direction:column');
    });

    it('right alignment puts text before the image in source order', () => {
      const html = logo({ logoLayout: 'logo_name', align: 'right' });
      expect(html.indexOf('Diamond Republic')).toBeLessThan(html.indexOf('https://cdn/logo.png'));
    });

    it('left alignment puts the image before the text', () => {
      const html = logo({ logoLayout: 'logo_name', align: 'left' });
      expect(html.indexOf('https://cdn/logo.png')).toBeLessThan(html.indexOf('Diamond Republic'));
    });

    it('does not leak a DEFINER-style raw src when no logo is configured', () => {
      const html = buildPrintableHtml(
        [block({ type: 'logo', config: { logoLayout: 'logo_only' } })],
        FIXTURE,
        'a4',
        null,
      );
      expect(html).not.toContain('<img');
    });
  });

  describe('barcode source resolution', () => {
    const barcode = (config: Record<string, unknown>) =>
      buildPrintableHtml([block({ type: 'barcode', config })], FIXTURE, '80mm');

    it('defaults to the receipt number', () => {
      expect(barcode({})).toContain('RCT-000042');
    });

    it('honours invoiceNo', () => {
      const html = barcode({ barcodeSource: 'invoiceNo' });
      expect(html).toContain('INV-000042');
    });

    it('honours productSku', () => {
      expect(barcode({ barcodeSource: 'productSku' })).toContain('SKU-1');
    });

    it('honours pieceId', () => {
      expect(barcode({ barcodeSource: 'pieceId' })).toContain('PC-000001');
    });

    it('honours a custom literal value', () => {
      const html = barcode({ barcodeSource: 'custom', barcodeCustomValue: 'CUSTOM-XYZ' });
      expect(html).toContain('CUSTOM-XYZ');
      expect(html).not.toContain('RCT-000042');
    });
  });

  describe('header metadata', () => {
    it('labels the operator as "Emp", matching the canvas', () => {
      const html = buildPrintableHtml(
        [block({ type: 'header', config: { headerFields: ['cashier'] } })],
        FIXTURE,
        '80mm',
      );
      expect(html).toContain('Emp:');
      expect(html).not.toContain('Cashier:');
    });

    it('renders only the selected metadata fields', () => {
      const html = buildPrintableHtml(
        [block({ type: 'header', config: { headerFields: ['date'] } })],
        FIXTURE,
        '80mm',
      );
      expect(html).toContain('23/08/2026');
      expect(html).not.toContain('Emp:');
    });
  });

  describe('items table', () => {
    it('renders configured columns with resolved values', () => {
      const html = buildPrintableHtml(
        [block({
          type: 'table',
          config: {
            fields: [
              { id: 'n', label: 'Item', accessor: 'name' },
              { id: 'q', label: 'Qty', accessor: 'qty' },
            ],
          },
        })],
        FIXTURE,
        '80mm',
      );
      expect(html).toContain('Item');
      expect(html).toContain('22KT Gold Ring');
    });

    it('does not emit a placeholder dash for data that is present', () => {
      const html = buildPrintableHtml(
        [block({
          type: 'table',
          config: { fields: [{ id: 'n', label: 'Item', accessor: 'name' }] },
        })],
        FIXTURE,
        '80mm',
      );
      expect(html).not.toContain('>—<');
    });
  });

  it('survives an empty fixture without throwing', () => {
    expect(() =>
      buildPrintableHtml(
        [block({ type: 'table' }), block({ type: 'totals' }), block({ type: 'barcode' })],
        {},
        '80mm',
      ),
    ).not.toThrow();
  });
});
