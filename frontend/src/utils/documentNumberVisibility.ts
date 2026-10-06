/**
 * Whether the document number is PRINTED — as distinct from issued.
 *
 * Two separate decisions, and conflating them is wrong in both directions:
 *
 *   issued   `sequential_numbering_optin` — is a gapless number allocated?
 *   printed  this module — does it appear as readable text on the page?
 *
 * A shop can want gapless numbering for its own books without cluttering a
 * 58mm slip. A wholesaler can need the number on the page regardless of how it
 * was produced.
 *
 * WHY THE DEFAULT DIFFERS BY DOCUMENT
 * -----------------------------------
 * A thermal receipt already carries a barcode or QR. The cashier scans it for a
 * return or to pull the sale up online — nobody reads the digits aloud — so
 * printing them as well is noise on a narrow slip.
 *
 * An A4/Letter invoice is the opposite. Wholesale, trade supply and high-value
 * retail settle against the invoice number: it goes on the remittance advice,
 * the purchase order and the customer's ledger. The printed number is the point
 * of the document.
 */

/** Paper sizes that are a page rather than a till slip. */
const PAGE_SIZES = new Set(['a4', 'letter', 'legal']);

/** Template types that are a formal invoice rather than a receipt. */
const INVOICE_TYPES = new Set([
  'invoice', 'jewelry_invoice', 'jewelry_certificate', 'document',
]);

export type DocumentClass = 'receipt' | 'invoice';

export interface NumberVisibilitySettings {
  /** Tenant override for till slips. Undefined means "use the default". */
  showNumberOnReceipt?: boolean | null;
  /** Tenant override for pages. Undefined means "use the default". */
  showNumberOnInvoice?: boolean | null;
}

/**
 * Is this a receipt or an invoice, for numbering purposes?
 *
 * Paper size decides it when the two disagree. A jewellery invoice printed to
 * 80mm thermal is being used as a slip — the customer is standing at the
 * counter — and an A4 sales receipt is being used as a page, most likely
 * because someone needs it for their records.
 */
export function classifyDocument(
  templateType?: string | null,
  paperSize?: string | null,
): DocumentClass {
  const paper = String(paperSize || '').toLowerCase();
  if (PAGE_SIZES.has(paper)) return 'invoice';
  if (paper) return 'receipt'; // 58mm, 80mm, label

  // No paper size known — fall back to what the document claims to be.
  return INVOICE_TYPES.has(String(templateType || '').toLowerCase())
    ? 'invoice'
    : 'receipt';
}

/**
 * Should the number be printed as text?
 *
 * @param settings Tenant overrides. Null/undefined fields fall back to default.
 */
export function shouldShowDocumentNumber(
  templateType: string | null | undefined,
  paperSize: string | null | undefined,
  settings: NumberVisibilitySettings = {},
): boolean {
  const documentClass = classifyDocument(templateType, paperSize);

  const override = documentClass === 'invoice'
    ? settings.showNumberOnInvoice
    : settings.showNumberOnReceipt;

  // Explicit false must win. `??` rather than `||` so that switching a
  // normally-on invoice number OFF actually takes effect.
  if (override === true || override === false) return override;

  return documentClass === 'invoice';
}

/** The defaults, exposed so Settings can show what "not configured" means. */
export const DEFAULT_NUMBER_VISIBILITY: Record<DocumentClass, boolean> = {
  receipt: false,
  invoice: true,
};
