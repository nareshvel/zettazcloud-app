import { describe, it, expect } from 'vitest';
import { saleToPrintData, mapSaleItem, returnToPrintData } from './saleToPrintData';
import { buildPrintableHtml } from './printTemplateRenderer';
import type { TemplateBlock, PaperSize } from '@/types/printTemplate';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const defaults = require('../../../backend/services/printTemplateService').DEFAULT_BLOCKS;

/**
 * Sale -> print template data.
 *
 * The property this suite defends above all others: the mapper TRANSLATES and
 * never CALCULATES. A printed document that disagrees with the recorded sale is
 * evidence of a discrepancy that does not exist, and it is discovered by a
 * customer or an auditor rather than by us.
 *
 * The second property is that absent data stays absent. Blocks self-suppress on
 * undefined — that is what keeps a grocery receipt from printing an empty
 * "Serial" column — and a helpfully-substituted zero defeats it silently.
 */

const SALE = {
  id: '9f2c1a84-3b7e-4d10-b0e1-4471882105cc',
  documentNumber: 'INV-2026-000417',
  createdAt: '2026-08-23T13:20:00.000Z',
  subtotal: 2930,
  tax: 439.5,
  total: 3369.5,
  cashierName: 'K. Browne',
  customerName: 'Jane Doe',
  paymentMethodName: 'Card',
  items: [
    { name: 'Smartphone X200', quantity: 1, price: 2450, lineTotal: 2450 },
    { name: 'Wireless Earbuds Pro', quantity: 1, price: 480, lineTotal: 480 },
  ],
};

const STORE = {
  name: 'Circuit Point',
  address: 'Sheikh Zayed Road, Dubai',
  phone: '+971-4-555-0611',
  currencyCode: 'AED',
};

describe('saleToPrintData — money is copied, never recomputed', () => {
  it('carries the recorded totals through unchanged', () => {
    const d = saleToPrintData(SALE, { store: STORE });
    expect(d.subtotal).toBe(2930);
    expect(d.tax).toBe(439.5);
    expect(d.total).toBe(3369.5);
  });

  it('does NOT recompute a total that disagrees with its lines', () => {
    /*
     * The critical case. If a sale was recorded with a total that does not
     * match its lines — a discount applied at the till, a historical rounding
     * difference, or a genuine bug — the printed document must show what was
     * RECORDED. Silently "fixing" it on paper hides a real discrepancy and
     * produces a receipt that does not match the books.
     */
    const inconsistent = { ...SALE, total: 9999.99 };
    const d = saleToPrintData(inconsistent, { store: STORE });
    expect(d.total).toBe(9999.99);
  });

  it('does not invent a subtotal from the lines when none was recorded', () => {
    const { subtotal, ...noSubtotal } = SALE;
    const d = saleToPrintData(noSubtotal, { store: STORE });
    expect(d.subtotal).toBeUndefined();
  });

  it('does not turn a missing tax into zero', () => {
    // Zero tax is a claim — that the sale was exempt or zero-rated. Absent tax
    // is not that claim, and printing "Tax 0.00" would make it.
    const { tax, ...noTax } = SALE;
    const d = saleToPrintData(noTax, { store: STORE });
    expect(d.tax).toBeUndefined();
  });

  it('keeps a genuine zero tax as zero', () => {
    // Duty-free. Distinct from absent, and must survive.
    const d = saleToPrintData({ ...SALE, tax: 0 }, { store: STORE });
    expect(d.tax).toBe(0);
  });
});

describe('saleToPrintData — line items', () => {
  it('maps name, quantity and price onto the column accessors', () => {
    const d = saleToPrintData(SALE, { store: STORE }) as any;
    expect(d.items[0].name).toBe('Smartphone X200');
    expect(d.items[0].qty).toBe(1);
    expect(d.items[0].unitPrice).toBe(2450);
    expect(d.items[0].lineTotal).toBe(2450);
  });

  it('prefers the recorded line total over qty x price', () => {
    // The recorded figure is what the customer was charged.
    const item = mapSaleItem({ name: 'X', quantity: 3, price: 10, lineTotal: 25 });
    expect(item.lineTotal).toBe(25);
  });

  it('derives a line total only when none was recorded', () => {
    const item = mapSaleItem({ name: 'X', quantity: 3, price: 10 });
    expect(item.lineTotal).toBe(30);
  });

  it('leaves the line total undefined when it cannot be known', () => {
    const item = mapSaleItem({ name: 'X' });
    expect(item.lineTotal).toBeUndefined();
  });

  it('carries unknown vertical fields through untouched', () => {
    /*
     * Adding a vertical must not require editing this mapper. Serial numbers,
     * IMEIs, weights, PLUs and size/colour reach their column accessors because
     * unknown keys survive the mapping.
     */
    const item = mapSaleItem({
      name: 'Ring', quantity: 1, price: 100,
      weight: 21.9, weightUnit: 'g', serialNumber: 'SN-1', imei: '3569', plu: '4011',
      size: 'M', color: 'Navy', taxFlag: 'T',
    });
    expect(item.weight).toBe(21.9);
    expect(item.serialNumber).toBe('SN-1');
    expect(item.imei).toBe('3569');
    expect(item.plu).toBe('4011');
    expect(item.size).toBe('M');
    expect(item.taxFlag).toBe('T');
  });

  it('yields an empty list rather than throwing on a sale with no items', () => {
    expect((saleToPrintData({ id: 'x' }) as any).items).toEqual([]);
    expect((saleToPrintData({ id: 'x', items: null }) as any).items).toEqual([]);
    // A non-array `items` has crashed this codebase before.
    expect((saleToPrintData({ id: 'x', items: 'nope' as any }) as any).items).toEqual([]);
  });
});

describe('saleToPrintData — absent data stays absent', () => {
  it('returns an empty object for no sale', () => {
    expect(saleToPrintData(null)).toEqual({});
    expect(saleToPrintData(undefined)).toEqual({});
  });

  it('leaves blank strings undefined rather than printing empty labels', () => {
    const d = saleToPrintData({ ...SALE, customerName: '   ' }, { store: STORE });
    expect(d.customerName).toBeUndefined();
  });

  it('omits change due on a card sale', () => {
    // Undefined so the block suppresses itself. "Change: 0.00" on a card
    // receipt is wrong, not merely redundant.
    const d = saleToPrintData(SALE, { store: STORE }) as any;
    expect(d.payment.tendered).toBeUndefined();
    expect(d.payment.changeDue).toBeUndefined();
  });

  it('includes change due on a cash sale', () => {
    const d = saleToPrintData(
      { ...SALE, amountTendered: 3400, changeDue: 30.5 }, { store: STORE },
    ) as any;
    expect(d.payment.tendered).toBe(3400);
    expect(d.payment.changeDue).toBe(30.5);
  });
});

describe('saleToPrintData — identity and jurisdiction', () => {
  it('uses the issued number when there is one', () => {
    expect(saleToPrintData(SALE).documentNumber).toBe('INV-2026-000417');
  });

  it('falls back to a short reference derived from the id', () => {
    const { documentNumber, ...unnumbered } = SALE;
    expect(saleToPrintData(unnumbered).documentNumber).toBe('9F2C1A84');
  });

  it('does not decide whether the number is SHOWN', () => {
    // Visibility is the renderer's job. This mapper reports what the document
    // is called; conflating the two would put the policy in two places.
    const d = saleToPrintData(SALE, { numbering: { showNumberOnReceipt: false } });
    expect(d.documentNumber).toBe('INV-2026-000417');
    expect(d.showNumberOnReceipt).toBe(false);
  });

  it('passes the mandatory invoice title through untouched', () => {
    // Australia, India and the UAE mandate the literal words "TAX INVOICE".
    const d = saleToPrintData(SALE, {
      jurisdiction: { mandatoryInvoiceTitle: 'TAX INVOICE' },
    });
    expect(d.mandatoryInvoiceTitle).toBe('TAX INVOICE');
  });

  it('uses the caller-supplied date formatter', () => {
    // Locale rules belong to the org, not to this module.
    const d = saleToPrintData(SALE, { formatDate: () => '23/08/2026' });
    expect(d.date).toBe('23/08/2026');
  });

  it('falls back to the raw date rather than printing nothing', () => {
    // A visibly unformatted date gets reported; a missing one does not.
    const d = saleToPrintData(SALE);
    expect(d.date).toContain('2026-08-23');
  });
});

describe('saleToPrintData — renders a real document end to end', () => {
  /*
   * The point of the whole exercise: a real sale, through the real mapper,
   * into the real renderer. Until this existed the template module could only
   * print fixtures.
   */
  const render = (templateType: string, paper: PaperSize, extra = {}) =>
    buildPrintableHtml(
      defaults[templateType] as TemplateBlock[],
      saleToPrintData(SALE, { store: STORE, documentType: templateType, ...extra }),
      paper,
      null,
    );

  const visible = (html: string) => html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  it('produces a complete document', () => {
    const html = render('receipt', '80mm');
    expect(html).toContain('<!DOCTYPE html>');
    expect(html.length).toBeGreaterThan(500);
  });

  it('shows the store', () => {
    const text = visible(render('receipt', '80mm'));
    expect(text).toContain('Circuit Point');
  });

  it('shows the customer on a document that has a customer block', () => {
    // An 80mm till receipt deliberately has no customer block — a walk-in sale
    // does not name the buyer. The A4 invoice does, and that is where the
    // mapped customer fields have to land.
    const text = visible(render('invoice', 'a4'));
    expect(text).toContain('Jane Doe');
  });

  it('shows every line item', () => {
    const text = visible(render('receipt', '80mm'));
    expect(text).toContain('Smartphone X200');
    expect(text).toContain('Wireless Earbuds Pro');
  });

  it('shows the recorded total, currency-formatted', () => {
    // 3,369.50 — grouped, as money is printed. The assertion is on the value
    // reaching the page, not on the mapper doing any formatting itself.
    const text = visible(render('receipt', '80mm'));
    expect(text).toContain('3,369.50');
  });

  it('does not print an unformatted ISO timestamp when a formatter is given', () => {
    const text = visible(render('receipt', '80mm', { formatDate: () => '23/08/2026' }));
    expect(text).toContain('23/08/2026');
    expect(text).not.toContain('T13:20:00');
  });

  it('does not degenerate into unresolved placeholders', () => {
    // A page of em-dashes means the mapper and the accessors disagree about
    // field names — which is exactly the failure this mapper exists to avoid.
    const text = visible(render('invoice', 'a4'));
    const dashes = (text.match(/—/g) || []).length;
    const words = text.split(' ').length;
    expect(dashes / Math.max(words, 1)).toBeLessThan(0.15);
  });

  it('never prints a raw UUID on the page', () => {
    // The reason documentReference exists.
    const text = visible(render('invoice', 'a4'));
    expect(text).not.toContain(SALE.id);
  });
});

describe('returnToPrintData', () => {
  /*
   * A refund document has one job beyond stating an amount: tying itself to the
   * sale it reverses. A credit note that cannot be matched to an original is
   * not auditable.
   */
  const RETURN = {
    id: 'r-1',
    return_number: 'RET-000012',
    original_sale_id: '9f2c1a84-3b7e-4d10-b0e1-4471882105cc',
    return_date: '2026-08-25T10:00:00.000Z',
    subtotal_amount: 2450,
    tax_amount: 122.5,
    total_return_amount: 2572.5,
    refund_method: 'card',
    return_reason: 'defective',
    customerName: 'Jane Doe',
    items: [
      { product_name: 'Smartphone X200', quantity_returned: 1, unit_price: 2450, total_amount: 2450 },
    ],
  };

  it('uses the return number as the document number', () => {
    expect(returnToPrintData(RETURN).documentNumber).toBe('RET-000012');
  });

  it('titles the document as a refund', () => {
    // The title carries the direction, which is why amounts stay positive.
    expect(String(returnToPrintData(RETURN).documentTitle)).toMatch(/REFUND|CREDIT/i);
  });

  it('states amounts POSITIVELY', () => {
    /*
     * Under a heading that already says REFUND, "-2572.50" reads as a double
     * negative — and is genuinely ambiguous when someone keys the slip into an
     * accounts package by hand.
     */
    const d = returnToPrintData(RETURN);
    expect(d.total).toBe(2572.5);
    expect(d.subtotal).toBe(2450);
    expect(d.tax).toBe(122.5);
  });

  it('links back to the original sale', () => {
    const d = returnToPrintData(RETURN);
    expect(d.originalDocumentNumber).toBe('9F2C1A84');
    expect(String(d.originalDocumentLabel)).toMatch(/Orig\./);
  });

  it('uses the original sale issued number when it has one', () => {
    const d = returnToPrintData({ ...RETURN, original_document_number: 'INV-2026-000417' });
    expect(d.originalDocumentNumber).toBe('INV-2026-000417');
  });

  it('shows the same reference the original receipt showed', () => {
    // If these disagree the two documents cannot be matched up, which defeats
    // the purpose of printing the reference at all.
    const onSale = saleToPrintData({ id: RETURN.original_sale_id }).documentNumber;
    const onReturn = returnToPrintData(RETURN).originalDocumentNumber;
    expect(onReturn).toBe(onSale);
  });

  it('maps the returned lines onto the column accessors', () => {
    const d = returnToPrintData(RETURN) as any;
    expect(d.items[0].name).toBe('Smartphone X200');
    expect(d.items[0].qty).toBe(1);
    expect(d.items[0].lineTotal).toBe(2450);
  });

  it('carries the refund method and reason', () => {
    const d = returnToPrintData(RETURN) as any;
    expect(d.payment.method).toBe('card');
    expect(d.returnReason).toBe('defective');
  });

  it('accepts camelCase as well as snake_case', () => {
    // Returns come back from more than one endpoint, with different casing.
    const d = returnToPrintData({
      returnNumber: 'RET-9', totalReturnAmount: 10, refundMethod: 'cash',
    }) as any;
    expect(d.documentNumber).toBe('RET-9');
    expect(d.total).toBe(10);
    expect(d.payment.method).toBe('cash');
  });

  it('returns an empty object for no return', () => {
    expect(returnToPrintData(null)).toEqual({});
    expect(returnToPrintData(undefined)).toEqual({});
  });

  it('does not throw on a return with no items', () => {
    expect((returnToPrintData({ return_number: 'RET-1' }) as any).items).toEqual([]);
  });
});

describe('the title/number override belongs to returns only', () => {
  /*
   * forceDocumentTitle and forceDocumentNumber exist so a refund borrowing a
   * receipt template is not headed "SALES RECEIPT" with no reference on it.
   *
   * A SALE must never set them. If it did, every sale would ignore its own
   * template's chosen title and override the tenant's number-visibility
   * setting — silently undoing two features that were built deliberately.
   */
  it('a sale sets neither', () => {
    const d = saleToPrintData(SALE, { store: STORE });
    expect(d.forceDocumentTitle).toBeUndefined();
    expect(d.forceDocumentNumber).toBeUndefined();
  });

  it('a return sets both', () => {
    const d = returnToPrintData({ return_number: 'RET-1' });
    expect(String(d.forceDocumentTitle)).toMatch(/REFUND|CREDIT/i);
    expect(d.forceDocumentNumber).toBe(true);
  });

  it('a caller can still choose the return wording', () => {
    const d = returnToPrintData({ return_number: 'RET-1' }, { documentTitle: 'CREDIT NOTE' });
    expect(d.forceDocumentTitle).toBe('CREDIT NOTE');
  });
});
