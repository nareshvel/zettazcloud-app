/**
 * The document header line — decided ONCE, for both renderers.
 *
 * WHY THIS MODULE EXISTS
 * ----------------------
 * There are two renderers:
 *
 *   TemplateCanvas.tsx        the designer's live preview (React)
 *   printTemplateRenderer.ts  what actually goes to the printer (HTML string)
 *
 * They were built separately and drifted. The canvas showed a bare
 * `RCT-002250`; the print output showed `Receipt No. RCT-002250`. The canvas
 * ignored the tenant's show/hide setting; print honoured it. The designer was
 * therefore lying about what would come out of the printer — which makes it
 * worse than no preview, because a user checks the preview and trusts it.
 *
 * Every decision about the header line now lives here and both call it. Two
 * renderers with the same rules written twice will diverge again; the only
 * durable fix is one copy of the rules.
 *
 * There is no "canvas version" and "print version" of anything in this file.
 * If a difference is ever genuinely needed, it belongs in a parameter, not in
 * a second implementation.
 */

import { shouldShowDocumentNumber } from './documentNumberVisibility';

export interface HeaderModel {
  /** The document title, after jurisdiction and document-kind overrides. */
  title: string;
  /** Metadata parts, already labelled and ordered. Join with " · ". */
  parts: string[];
}

/** Config a header block may carry. */
export interface HeaderBlockConfig {
  content?: string;
  headerFields?: string[];
  numberLabel?: string;
}

const DEFAULT_FIELDS = ['invoiceNumber', 'date', 'dueDate', 'cashier'];

/**
 * Resolve the document title.
 *
 * Precedence, and each step earns its place:
 *
 *   1. `mandatoryInvoiceTitle` — Australia, India and the UAE mandate the
 *      literal words "TAX INVOICE". A template must not be able to override
 *      the law.
 *   2. `forceDocumentTitle` — the document is a different KIND from the
 *      template it borrows. A refund printed through a receipt template would
 *      otherwise be headed "SALES RECEIPT".
 *   3. the template's own `content` — what the user typed.
 *   4. the data's `documentTitle`, then the type, then a last resort.
 */
export function resolveTitle(data: any, cfg: HeaderBlockConfig = {}): string {
  return data?.mandatoryInvoiceTitle
    || data?.forceDocumentTitle
    || cfg.content
    || data?.documentTitle
    || humaniseType(data?.documentType);
}

/**
 * A readable title for a template type that carries no wording of its own.
 *
 * `invoice` and `jewelry_invoice` ship with `content: ''` — falsy, so the
 * fallback runs. It used to be `documentType.toUpperCase()`, which printed
 * **JEWELRY_INVOICE**, underscore and all, at the top of a high-value
 * jewellery invoice.
 *
 * Named titles come first because "TAX INVOICE" and "CERTIFICATE OF
 * AUTHENTICITY" are conventions, not just prettier strings. Anything unlisted
 * degrades to underscores-as-spaces, which is at least presentable for a
 * document type added later.
 */
const TYPE_TITLES: Record<string, string> = {
  receipt: 'SALES RECEIPT',
  invoice: 'INVOICE',
  jewelry_invoice: 'TAX INVOICE',
  jewelry_certificate: 'CERTIFICATE OF AUTHENTICITY',
  return: 'REFUND / CREDIT NOTE',
  document: 'DOCUMENT',
  label: 'LABEL',
};

export function humaniseType(documentType?: string | null): string {
  if (!documentType) return 'INVOICE';
  const key = String(documentType).toLowerCase();
  return TYPE_TITLES[key] || key.replace(/_/g, ' ').toUpperCase();
}

/**
 * Is the document number printed as text?
 *
 * Three inputs, most specific first:
 *
 *   1. `forceDocumentNumber` — a refund must carry its number even when it
 *      borrows a receipt template whose fields omit it.
 *   2. the tenant's store-wide setting, when they have expressed one — a shop
 *      wanting numbers on till slips should not have to edit every template.
 *   3. otherwise the template's own `headerFields`.
 *
 * Note (2) is NOT OR'd with (3): an explicit "off" has to be able to switch off
 * a number the template asks for, or the setting is only half a control.
 */
export function shouldRenderNumber(
  data: any,
  cfg: HeaderBlockConfig,
  paperSize: string | null | undefined,
): boolean {
  if (data?.forceDocumentNumber) return true;

  const fields = new Set(cfg.headerFields || DEFAULT_FIELDS);

  const hasTenantSetting = data?.showNumberOnReceipt !== undefined
    || data?.showNumberOnInvoice !== undefined;

  if (!hasTenantSetting) return fields.has('invoiceNumber');

  return shouldShowDocumentNumber(data?.documentType, paperSize, {
    showNumberOnReceipt: data?.showNumberOnReceipt,
    showNumberOnInvoice: data?.showNumberOnInvoice,
  });
}

/** The number itself, preferring the one actually issued for the sale. */
export function resolveNumber(data: any): string | undefined {
  const n = data?.documentNumber || data?.invoiceNumber || data?.receiptNumber;
  return n ? String(n) : undefined;
}

/**
 * The label printed beside the number.
 *
 * A bare token between a title and a date is ambiguous on paper — someone
 * quoting it over the phone needs to know what they are reading.
 */
export function resolveNumberLabel(data: any, cfg: HeaderBlockConfig = {}): string {
  if (cfg.numberLabel) return cfg.numberLabel;
  return String(data?.documentType || '').includes('receipt')
    ? 'Receipt No.'
    : 'Invoice No.';
}

/**
 * Build the whole header. Both renderers call this and render the result.
 */
export function buildDocumentHeader(
  data: any,
  cfg: HeaderBlockConfig = {},
  paperSize?: string | null,
): HeaderModel {
  const fields = new Set(cfg.headerFields || DEFAULT_FIELDS);
  const parts: string[] = [];

  const number = resolveNumber(data);
  if (number && shouldRenderNumber(data, cfg, paperSize)) {
    parts.push(`${resolveNumberLabel(data, cfg)} ${number}`);
  }

  if (fields.has('date') && data?.date) parts.push(String(data.date));
  if (fields.has('dueDate') && data?.dueDate) parts.push(`Due: ${data.dueDate}`);
  if (fields.has('cashier') && data?.cashierName) parts.push(`Emp: ${data.cashierName}`);

  return { title: resolveTitle(data, cfg), parts };
}
