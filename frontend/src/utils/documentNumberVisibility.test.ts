import { describe, it, expect } from 'vitest';
import {
  shouldShowDocumentNumber,
  classifyDocument,
  DEFAULT_NUMBER_VISIBILITY,
} from './documentNumberVisibility';

/**
 * Whether the number is PRINTED, as distinct from issued.
 *
 * The rule this file protects: an explicit tenant setting must be able to
 * switch the number OFF as well as on. A "show it" toggle that can only ever
 * add is half a control, and the failure is invisible — the setting appears to
 * save and simply does nothing.
 */

describe('classifyDocument', () => {
  it('treats page sizes as invoices', () => {
    expect(classifyDocument('receipt', 'a4')).toBe('invoice');
    expect(classifyDocument('receipt', 'letter')).toBe('invoice');
  });

  it('treats till-slip widths as receipts', () => {
    expect(classifyDocument('invoice', '58mm')).toBe('receipt');
    expect(classifyDocument('invoice', '80mm')).toBe('receipt');
    expect(classifyDocument('invoice', 'label')).toBe('receipt');
  });

  it('lets paper size win over template type', () => {
    // A jewellery invoice printed to 80mm is being used as a slip — the
    // customer is at the counter. An A4 "receipt" is being used as a page.
    expect(classifyDocument('jewelry_invoice', '80mm')).toBe('receipt');
    expect(classifyDocument('receipt', 'a4')).toBe('invoice');
  });

  it('falls back to the template type when no paper size is known', () => {
    expect(classifyDocument('invoice', null)).toBe('invoice');
    expect(classifyDocument('jewelry_invoice', undefined)).toBe('invoice');
    expect(classifyDocument('receipt', null)).toBe('receipt');
  });

  it('is case-insensitive', () => {
    expect(classifyDocument('INVOICE', 'A4')).toBe('invoice');
  });

  it('defaults to receipt for an unrecognised type', () => {
    // The conservative choice: a receipt hides the number and relies on the
    // barcode, which is safe. Guessing "invoice" would print a number on a
    // document that may have no room for it.
    expect(classifyDocument('something_new', null)).toBe('receipt');
    expect(classifyDocument(null, null)).toBe('receipt');
  });
});

describe('shouldShowDocumentNumber — defaults', () => {
  it('HIDES the number on a till receipt', () => {
    // The slip carries a scannable barcode; the digits are noise on 58-80mm.
    expect(shouldShowDocumentNumber('receipt', '80mm')).toBe(false);
    expect(shouldShowDocumentNumber('receipt', '58mm')).toBe(false);
  });

  it('SHOWS the number on an A4 invoice', () => {
    // Wholesale, trade and high-value retail settle against it.
    expect(shouldShowDocumentNumber('invoice', 'a4')).toBe(true);
    expect(shouldShowDocumentNumber('jewelry_invoice', 'a4')).toBe(true);
  });

  it('matches the documented defaults', () => {
    expect(DEFAULT_NUMBER_VISIBILITY.receipt).toBe(false);
    expect(DEFAULT_NUMBER_VISIBILITY.invoice).toBe(true);
  });
});

describe('shouldShowDocumentNumber — tenant overrides', () => {
  it('can turn a receipt number ON', () => {
    expect(
      shouldShowDocumentNumber('receipt', '80mm', { showNumberOnReceipt: true }),
    ).toBe(true);
  });

  it('can turn an invoice number OFF', () => {
    // The direction that a naive `a || b` implementation gets wrong.
    expect(
      shouldShowDocumentNumber('invoice', 'a4', { showNumberOnInvoice: false }),
    ).toBe(false);
  });

  it('applies the setting matching the document class, not the other one', () => {
    // Turning receipts on must not drag invoices with it, and vice versa.
    const settings = { showNumberOnReceipt: true, showNumberOnInvoice: false };
    expect(shouldShowDocumentNumber('receipt', '80mm', settings)).toBe(true);
    expect(shouldShowDocumentNumber('invoice', 'a4', settings)).toBe(false);
  });

  it('ignores null and undefined, falling back to the default', () => {
    // "Not configured" must not read as "off".
    expect(shouldShowDocumentNumber('invoice', 'a4', { showNumberOnInvoice: null })).toBe(true);
    expect(shouldShowDocumentNumber('invoice', 'a4', { showNumberOnInvoice: undefined })).toBe(true);
    expect(shouldShowDocumentNumber('receipt', '80mm', { showNumberOnReceipt: null })).toBe(false);
  });

  it('respects an override even when it agrees with the default', () => {
    expect(shouldShowDocumentNumber('receipt', '80mm', { showNumberOnReceipt: false })).toBe(false);
    expect(shouldShowDocumentNumber('invoice', 'a4', { showNumberOnInvoice: true })).toBe(true);
  });
});
