/**
 * Sale -> print template data.
 *
 * The print template module could render fixtures beautifully and could not
 * print a single real sale, because nothing mapped one onto the shape the
 * block renderers read. This is that mapping.
 *
 * WHAT THIS IS AND IS NOT
 * -----------------------
 * It is a TRANSLATION, not a calculation. Every monetary figure is copied from
 * the sale as recorded. Nothing here re-derives a subtotal, re-applies a rate,
 * or rounds anything.
 *
 * That restraint is the whole design. A printed document that disagrees with
 * the recorded sale is worse than no document — it is evidence of a discrepancy
 * that does not exist. If a figure looks wrong on paper, the bug is upstream in
 * the sale, and it should be fixed there where it also affects the books.
 *
 * MISSING DATA IS LEFT MISSING
 * ----------------------------
 * Absent fields are passed through as undefined rather than filled with zeroes
 * or placeholders. The block renderers already self-suppress on absent data —
 * that is what stops a grocery receipt printing an empty "Serial" column — and
 * substituting a plausible-looking zero would defeat it.
 */

import { resolveDocumentReference } from './documentReference';

/** A sale as the API returns it, after fetchApi's camelCase conversion. */
export interface PrintableSale {
  id?: string | null;
  documentNumber?: string | null;
  document_number?: string | null;
  createdAt?: string | null;
  subtotal?: number | string | null;
  tax?: number | string | null;
  total?: number | string | null;
  discountAmount?: number | string | null;
  promotionsAmount?: number | string | null;
  currency?: string | null;
  cashierName?: string | null;
  employeeName?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerTaxId?: string | null;
  paymentMethod?: string | null;
  paymentMethodName?: string | null;
  amountTendered?: number | string | null;
  changeDue?: number | string | null;
  taxBreakdown?: unknown;
  items?: PrintableSaleItem[] | null;

  // ---- duty-free / export ---------------------------------------------
  // Frozen on the sale at creation time (createSaleController.js), from the
  // store's jurisdiction setting at that moment — not re-derived from the
  // store's CURRENT setting, so a reprint always matches what was actually
  // charged even if the store's duty-free configuration changes later.
  salesMode?: string | null;
  zeroRateReason?: string | null;
  // Traveller capture from the Sales Hub's Duty-Free Sale intake (see
  // docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md). Field names match
  // salesModeRules.ts's buildDutyFreeLines exactly — this is a passthrough.
  travellerIdType?: string | null;
  travellerIdNumber?: string | null;
  travellerIdCountry?: string | null;
  travelMethodType?: string | null;
  travelMethodRef?: string | null;
  travelMethodDetail?: string | null;
  destination?: string | null;
  departureDate?: string | null;
}

export interface PrintableSaleItem {
  [key: string]: unknown;
  name?: string | null;
  productName?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  lineTotal?: number | string | null;
}

export interface PrintContext {
  store?: {
    name?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    taxId?: string | null;
    currencyCode?: string | null;
  } | null;
  /** Jurisdiction-derived requirements, from the retail profile. */
  jurisdiction?: {
    mandatoryInvoiceTitle?: string | null;
    requiresCustomerTaxId?: boolean;
    taxLabel?: string | null;
    taxIdLabel?: string | null;
    exportDeclarationText?: string | null;
    fiscalizationEnabled?: boolean;
  } | null;
  /** Tenant number-display preferences. */
  numbering?: {
    showNumberOnReceipt?: boolean | null;
    showNumberOnInvoice?: boolean | null;
  } | null;
  documentType?: string;
  documentTitle?: string;
  /** Formatter supplied by the caller, so the org's locale rules are honoured. */
  formatDate?: (value: string) => string;
  /** The store's date pattern (DD/MM/YYYY etc), used to build that formatter. */
  dateFormat?: string | null;
  /** Product field definitions configured for this tenant — used to pick which
   * attributes are shown on receipts (show_on_receipt). */
  fieldOverrides?: Array<{
    fieldKey: string;
    label?: string | null;
    showOnReceipt?: boolean;
    unit?: string | null;
  }>;
}

/** Numeric or undefined — never a coerced zero. */
const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Non-empty string or undefined. */
const str = (v: unknown): string | undefined => {
  if (typeof v !== 'string') return v === null || v === undefined ? undefined : String(v);
  const t = v.trim();
  return t === '' ? undefined : t;
};

/**
 * Builds the per-item "Label: value" lines for fields the tenant has marked
 * `show_on_receipt` (e.g. jewelry purity, weight). Values are read from the
 * sale item's `attributes` map; a direct top-level key is a fallback for
 * callers that already flattened the record.
 */
const buildAttributeLines = (
  item: PrintableSaleItem,
  fieldOverrides: PrintContext['fieldOverrides'],
): string[] | undefined => {
  if (!Array.isArray(fieldOverrides)) return undefined;
  const attrs = (item.attributes ?? {}) as Record<string, unknown>;
  const lines: string[] = [];
  for (const def of fieldOverrides) {
    if (!def.showOnReceipt) continue;
    const raw = attrs[def.fieldKey] ?? (item as Record<string, unknown>)[def.fieldKey];
    const value = str(raw);
    if (!value) continue;
    const label = str(def.label) || def.fieldKey;
    lines.push(`${label}: ${value}${def.unit ? ` ${def.unit}` : ''}`);
  }
  return lines.length ? lines : undefined;
};

/**
 * One sale line.
 *
 * Unknown keys are carried through untouched so vertical-specific fields —
 * serialNumber, imei, weight, plu, size, colour — reach the column accessors
 * that ask for them without this mapper needing to know every vertical. Adding
 * a vertical should not require editing this file.
 */
export function mapSaleItem(item: PrintableSaleItem): Record<string, unknown> {
  const qty = num(item.quantity) ?? num(item.qty);
  const unitPrice = num(item.price) ?? num(item.unitPrice);

  // Only computed when the sale did not record it. Multiplication of two
  // recorded values is a restatement, not a new calculation — but the recorded
  // value always wins, because it is what the customer was charged.
  const lineTotal = num(item.lineTotal)
    ?? (qty !== undefined && unitPrice !== undefined ? qty * unitPrice : undefined);

  return {
    ...item,
    name: str(item.name) ?? str(item.productName) ?? 'Item',
    qty,
    quantity: qty,
    unitPrice,
    price: unitPrice,
    lineTotal,
    // Every other table preset's default "line total" column binds to the
    // `lineTotal` accessor (see itemTableModel.ts's PRESET_FIELDS) — the
    // jewelry preset alone binds to `amount` instead. Emitting both means a
    // jewelry invoice's Amount column is populated regardless of which
    // accessor name a given tenant's published template was saved with,
    // without needing a data migration on already-provisioned templates.
    amount: lineTotal,
  };
}

/**
 * Map a sale onto the structure the block renderers read.
 *
 * @param sale    The sale, as recorded.
 * @param context Store, jurisdiction and display preferences.
 */
export function saleToPrintData(
  sale: PrintableSale | null | undefined,
  context: PrintContext = {},
): Record<string, unknown> {
  if (!sale) return {};

  const { store, jurisdiction, numbering, formatDate, fieldOverrides } = context;

  const docRef = resolveDocumentReference(sale);
  const created = str(sale.createdAt);

  const items = Array.isArray(sale.items)
    ? sale.items.map((item) => {
        const mapped = mapSaleItem(item);
        const attributeLines = buildAttributeLines(item, fieldOverrides);
        if (attributeLines) {
          (mapped as Record<string, unknown>).attributeLines = attributeLines;
        }
        return mapped;
      })
    : [];

  const tendered = num(sale.amountTendered);

  return {
    // ---- identity -----------------------------------------------------
    documentType: context.documentType ?? 'receipt',
    documentTitle: context.documentTitle,
    // The issued sequential number, or the short reference derived from the id.
    // Visibility is decided downstream by the renderer, not here — this mapper
    // reports what the document IS called, not whether to show it.
    documentNumber: docRef?.value,
    saleId: str(sale.id),

    // ---- store --------------------------------------------------------
    storeName: str(store?.name),
    storeAddress: str(store?.address),
    storePhone: str(store?.phone),
    storeEmail: str(store?.email),
    storeTaxId: str(store?.taxId),
    currency: str(sale.currency) ?? str(store?.currencyCode),

    // ---- when / who ---------------------------------------------------
    // Formatted by the caller's locale helper. Falling back to the raw ISO
    // string is deliberate: a visibly unformatted date is a reported bug,
    // whereas a silently wrong format is not.
    date: created ? (formatDate ? formatDate(created) : created) : undefined,
    cashierName: str(sale.cashierName) ?? str(sale.employeeName),

    // ---- customer -----------------------------------------------------
    customerName: str(sale.customerName),
    customerEmail: str(sale.customerEmail),
    customerPhone: str(sale.customerPhone),
    customerAddress: str(sale.customerAddress),
    customerTaxId: str(sale.customerTaxId),

    // ---- lines and money ----------------------------------------------
    // Copied, never recomputed. See the header note.
    items,
    subtotal: num(sale.subtotal),
    tax: num(sale.tax),
    taxAmount: num(sale.tax),
    total: num(sale.total),
    discountAmount: num(sale.discountAmount),
    promotionsAmount: num(sale.promotionsAmount),
    taxBreakdown: sale.taxBreakdown,

    payment: {
      method: str(sale.paymentMethodName) ?? str(sale.paymentMethod),
      amount: num(sale.total),
      // Only meaningful on a cash sale. Undefined elsewhere so the block
      // suppresses itself rather than printing "Change: 0.00" on a card sale.
      tendered,
      changeDue: num(sale.changeDue),
    },

    // ---- jurisdiction --------------------------------------------------
    // Passed through so the renderer can enforce rules this mapper has no
    // business deciding — e.g. the literal words "TAX INVOICE" where mandated.
    mandatoryInvoiceTitle: str(jurisdiction?.mandatoryInvoiceTitle),
    requiresCustomerTaxId: jurisdiction?.requiresCustomerTaxId,
    taxLabel: str(jurisdiction?.taxLabel),
    taxIdLabel: str(jurisdiction?.taxIdLabel),
    // The declaration wording itself is live-fetched jurisdiction text (it can
    // be edited after the sale without needing to rewrite history), but
    // WHETHER a declaration should print at all is a fact about this specific
    // sale — see salesMode/zeroRateReason below.
    exportDeclarationText: str(jurisdiction?.exportDeclarationText),
    fiscalizationEnabled: jurisdiction?.fiscalizationEnabled,

    // ---- duty-free / export ---------------------------------------------
    // Read from the SALE, not the store's current jurisdiction setting — see
    // the comment on PrintableSale.salesMode. This is what
    // salesModeRules.isDutyFreeOrExport gates the compliance declaration on.
    salesMode: str(sale.salesMode),
    zeroRateReason: str(sale.zeroRateReason),

    // Traveller capture from the Sales Hub's Duty-Free Sale intake. Absent on
    // an ordinary sale — the dutyFree block already self-suppresses when
    // these are all missing (see buildDutyFreeLines).
    travellerIdType: str(sale.travellerIdType),
    travellerIdNumber: str(sale.travellerIdNumber),
    travellerIdCountry: str(sale.travellerIdCountry),
    travelMethodType: str(sale.travelMethodType),
    travelMethodRef: str(sale.travelMethodRef),
    travelMethodDetail: str(sale.travelMethodDetail),
    destination: str(sale.destination),
    departureDate: str(sale.departureDate),

    // ---- display preferences -------------------------------------------
    showNumberOnReceipt: numbering?.showNumberOnReceipt ?? undefined,
    showNumberOnInvoice: numbering?.showNumberOnInvoice ?? undefined,
  };
}

/** A sales return, as the API returns it. */
export interface PrintableReturn {
  id?: string | null;
  returnNumber?: string | null;
  return_number?: string | null;
  originalSaleId?: string | null;
  original_sale_id?: string | null;
  originalDocumentNumber?: string | null;
  original_document_number?: string | null;
  returnDate?: string | null;
  return_date?: string | null;
  createdAt?: string | null;
  subtotalAmount?: number | string | null;
  subtotal_amount?: number | string | null;
  taxAmount?: number | string | null;
  tax_amount?: number | string | null;
  totalReturnAmount?: number | string | null;
  total_return_amount?: number | string | null;
  refundMethod?: string | null;
  refund_method?: string | null;
  returnReason?: string | null;
  return_reason?: string | null;
  customerName?: string | null;
  cashierName?: string | null;
  items?: Array<Record<string, unknown>> | null;
}

/** Accept either casing — returns come back from more than one endpoint. */
const either = (a: unknown, b: unknown) => (a === undefined || a === null ? b : a);

/**
 * Map a sales return onto the print data shape.
 *
 * AMOUNTS ARE POSITIVE, DELIBERATELY
 * ----------------------------------
 * A credit note states an amount owed BACK; the direction is carried by the
 * document title, not by a minus sign. Printing "-45.00" under a heading that
 * already says REFUND reads as a double negative, and worse, it is ambiguous
 * when the slip is keyed into an accounts package by hand.
 *
 * The original sale's reference is carried through so the refund can be tied to
 * what it reverses — which is the one thing a return document must do.
 */
export function returnToPrintData(
  ret: PrintableReturn | null | undefined,
  context: PrintContext = {},
): Record<string, unknown> {
  if (!ret) return {};

  const { store, jurisdiction, formatDate } = context;

  const returnNumber = str(either(ret.returnNumber, ret.return_number));
  const when = str(either(either(ret.returnDate, ret.return_date), ret.createdAt));

  // What the original sale was called, resolved through the same helper the
  // original receipt used — so the two documents show the same reference.
  const originalRef = resolveDocumentReference({
    id: str(either(ret.originalSaleId, ret.original_sale_id)),
    documentNumber: str(either(ret.originalDocumentNumber, ret.original_document_number)),
  });

  const items = Array.isArray(ret.items)
    ? ret.items.map((item) => mapSaleItem({
      ...item,
      name: (item.productName ?? item.product_name ?? item.name) as string,
      quantity: (item.quantityReturned ?? item.quantity_returned ?? item.quantity) as number,
      price: (item.unitPrice ?? item.unit_price ?? item.price) as number,
      lineTotal: (item.totalAmount ?? item.total_amount ?? item.lineTotal) as number,
    }))
    : [];

  return {
    documentType: context.documentType ?? 'return',
    documentTitle: context.documentTitle ?? 'REFUND / CREDIT NOTE',
    documentNumber: returnNumber,

    /*
     * A return often borrows the receipt template, whose header block has
     * "SALES RECEIPT" baked into its config and omits the number field. Both
     * would be wrong here: a credit note headed "SALES RECEIPT" misrepresents
     * the document, and one with no reference cannot be matched to anything.
     * These two flags let the return override a template designed for sales.
     */
    forceDocumentTitle: context.documentTitle ?? 'REFUND / CREDIT NOTE',
    forceDocumentNumber: true,

    // The link back to the sale being reversed.
    originalDocumentNumber: originalRef?.value,
    originalDocumentLabel: originalRef ? `Orig. ${originalRef.label}` : undefined,

    storeName: str(store?.name),
    storeAddress: str(store?.address),
    storePhone: str(store?.phone),
    storeEmail: str(store?.email),
    storeTaxId: str(store?.taxId),
    currency: str(store?.currencyCode),

    date: when ? (formatDate ? formatDate(when) : when) : undefined,
    cashierName: str(ret.cashierName),
    customerName: str(ret.customerName),

    items,
    subtotal: num(either(ret.subtotalAmount, ret.subtotal_amount)),
    tax: num(either(ret.taxAmount, ret.tax_amount)),
    taxAmount: num(either(ret.taxAmount, ret.tax_amount)),
    total: num(either(ret.totalReturnAmount, ret.total_return_amount)),

    payment: {
      method: str(either(ret.refundMethod, ret.refund_method)),
      amount: num(either(ret.totalReturnAmount, ret.total_return_amount)),
    },

    returnReason: str(either(ret.returnReason, ret.return_reason)),

    mandatoryInvoiceTitle: str(jurisdiction?.mandatoryInvoiceTitle),
    taxLabel: str(jurisdiction?.taxLabel),
    taxIdLabel: str(jurisdiction?.taxIdLabel),
  };
}
