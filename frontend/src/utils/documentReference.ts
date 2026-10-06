/**
 * What a sale is called on paper.
 *
 * A sale has two identifiers and they are not interchangeable:
 *
 *   sales.id               a UUID. The lookup key. Never shown to a customer —
 *                          `9f2c1a84-3b7e-4d10-b0e1-...` is unreadable, cannot
 *                          be dictated over the phone, and is meaningless on a
 *                          tax document.
 *
 *   sales.document_number  the issued sequential number, e.g. INV-2026-000417.
 *                          Present only where sequential numbering is switched
 *                          on for the store.
 *
 * Most stores have no document number, so a receipt still needs something a
 * customer can quote back. That is a SHORT REFERENCE derived from the UUID —
 * and it is deliberately labelled differently, because presenting a truncated
 * UUID as an "Invoice No." would be a false claim: it is not sequential, not
 * gapless, and not unique in the way a tax authority means.
 *
 * Centralised here so the thermal receipt, the A4 template renderer and any
 * future print path cannot disagree about what a document is called.
 */

/** How many hex characters of the UUID a short reference keeps. */
const SHORT_REF_LENGTH = 8;

export interface DocumentReference {
  /** What to print. */
  value: string;
  /** What to print beside it. Differs by kind — see above. */
  label: string;
  /** True only for a real issued sequential number. */
  isSequential: boolean;
}

export interface NumberableSale {
  id?: string | null;
  documentNumber?: string | null;
  /** snake_case tolerated: not every caller goes through fetchApi's conversion. */
  document_number?: string | null;
}

/**
 * Resolve what to print for a sale.
 *
 * @param sale
 * @param labels Optional overrides, for templates that set their own wording.
 */
export function resolveDocumentReference(
  sale: NumberableSale | null | undefined,
  labels: { sequential?: string; reference?: string } = {},
): DocumentReference | null {
  if (!sale) return null;

  const issued = sale.documentNumber ?? sale.document_number ?? null;

  if (typeof issued === 'string' && issued.trim() !== '') {
    return {
      value: issued.trim(),
      label: labels.sequential || 'Invoice No.',
      isSequential: true,
    };
  }

  const id = typeof sale.id === 'string' ? sale.id.trim() : '';
  if (!id) return null;

  return {
    value: shortReference(id),
    // NOT "Invoice No." — this is a lookup handle, not a tax document number.
    label: labels.reference || 'Ref',
    isSequential: false,
  };
}

/**
 * A quotable handle derived from a UUID.
 *
 * Hyphens are dropped and the result upper-cased so it reads as one token and
 * survives being written down or read aloud. Eight characters is enough to be
 * unambiguous when scoped to a store and a date, which is how staff look a sale
 * up in practice.
 */
export function shortReference(id: string): string {
  return id.replace(/-/g, '').slice(0, SHORT_REF_LENGTH).toUpperCase();
}
