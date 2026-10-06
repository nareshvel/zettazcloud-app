import { describe, it, expect } from 'vitest';
import { resolveDocumentReference, shortReference } from './documentReference';

/**
 * What a sale is called on paper.
 *
 * The property that matters most here is not formatting — it is that a
 * truncated UUID is never presented as an invoice number. Sequential invoice
 * numbers carry a legal meaning (ordered, gapless, issued by the seller); a
 * slice of a random identifier has none of those properties, and labelling it
 * "Invoice No." would be a false statement on a tax document.
 */

const UUID = '9f2c1a84-3b7e-4d10-b0e1-4471882105cc';

describe('resolveDocumentReference', () => {
  describe('when a sequential number has been issued', () => {
    it('prints the issued number', () => {
      const ref = resolveDocumentReference({ id: UUID, documentNumber: 'INV-2026-000417' });
      expect(ref?.value).toBe('INV-2026-000417');
    });

    it('labels it as an invoice number', () => {
      const ref = resolveDocumentReference({ id: UUID, documentNumber: 'INV-2026-000417' });
      expect(ref?.label).toBe('Invoice No.');
      expect(ref?.isSequential).toBe(true);
    });

    it('prefers the issued number over the id', () => {
      // The id must never win — it is the lookup key, not the document number.
      const ref = resolveDocumentReference({ id: UUID, documentNumber: 'INV-2026-000417' });
      expect(ref?.value).not.toContain('9F2C');
    });

    it('accepts snake_case, since not every caller goes through fetchApi', () => {
      const ref = resolveDocumentReference({ id: UUID, document_number: 'INV-2026-000418' });
      expect(ref?.value).toBe('INV-2026-000418');
      expect(ref?.isSequential).toBe(true);
    });

    it('trims stray whitespace', () => {
      const ref = resolveDocumentReference({ id: UUID, documentNumber: '  INV-1  ' });
      expect(ref?.value).toBe('INV-1');
    });
  });

  describe('when no sequential number exists', () => {
    it('falls back to a short reference', () => {
      const ref = resolveDocumentReference({ id: UUID });
      expect(ref?.value).toBe('9F2C1A84');
    });

    it('does NOT call it an invoice number', () => {
      // The assertion this file exists for. A slice of a UUID is not ordered,
      // not gapless, and not issued — calling it an invoice number on a tax
      // document would be untrue.
      const ref = resolveDocumentReference({ id: UUID });
      expect(ref?.label).not.toMatch(/invoice/i);
      expect(ref?.isSequential).toBe(false);
    });

    it('treats an empty string as no number', () => {
      // A blank column must not print as a blank invoice number.
      expect(resolveDocumentReference({ id: UUID, documentNumber: '' })?.isSequential).toBe(false);
      expect(resolveDocumentReference({ id: UUID, documentNumber: '   ' })?.isSequential).toBe(false);
    });

    it('treats null as no number', () => {
      expect(resolveDocumentReference({ id: UUID, documentNumber: null })?.isSequential).toBe(false);
    });
  });

  describe('when there is nothing to print', () => {
    it('returns null rather than an empty label', () => {
      // The caller renders nothing at all. A stray "Ref:" with no value looks
      // like a bug on a printed receipt.
      expect(resolveDocumentReference(null)).toBeNull();
      expect(resolveDocumentReference(undefined)).toBeNull();
      expect(resolveDocumentReference({})).toBeNull();
      expect(resolveDocumentReference({ id: '' })).toBeNull();
      expect(resolveDocumentReference({ id: '   ' })).toBeNull();
    });
  });

  it('allows the label to be overridden per template', () => {
    const ref = resolveDocumentReference(
      { id: UUID, documentNumber: 'DF-000318' },
      { sequential: 'Duty-Free Invoice No.' },
    );
    expect(ref?.label).toBe('Duty-Free Invoice No.');
  });
});

describe('shortReference', () => {
  it('drops hyphens so it reads as one token', () => {
    expect(shortReference(UUID)).toBe('9F2C1A84');
  });

  it('upper-cases, so it survives being written down', () => {
    expect(shortReference('abcdef12-0000-0000-0000-000000000000')).toBe('ABCDEF12');
  });

  it('is stable for the same id', () => {
    // The reference on a return slip has to match the one on the original
    // receipt exactly, or it cannot be used to tie them together.
    expect(shortReference(UUID)).toBe(shortReference(UUID));
  });

  it('differs for different ids', () => {
    expect(shortReference(UUID)).not.toBe(shortReference('11111111-2222-3333-4444-555555555555'));
  });

  it('handles an id shorter than the reference length', () => {
    expect(shortReference('abc')).toBe('ABC');
  });
});
