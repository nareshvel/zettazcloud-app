/**
 * Sales-mode rules for printed documents.
 *
 * WHY THIS IS SHARED
 * ------------------
 * The canvas and the print renderer are separate implementations of the same
 * template semantics, and they have drifted twice already. Two of the rules
 * below are not cosmetic — getting them wrong produces a document that is
 * invalid for its purpose:
 *
 *   1. A duty-free proof of sale must NOT be marked "duplicate", "reprint" or
 *      "store copy". Stamping one is correct fraud control for ordinary retail
 *      and *destroys* a traveller's ability to use the receipt at customs.
 *
 *   2. Gift receipts must suppress price, discount and payment. Leaking the
 *      total on a gift receipt is a small privacy failure with a very human
 *      cost, and it is easy to reintroduce by adding a block that reads
 *      `data.total` directly.
 *
 * Centralising the decisions means one fix covers both renderers.
 */

/** Block types that reveal what was paid. Suppressed in gift mode. */
const MONETARY_BLOCK_TYPES = new Set([
  'totals',
  'payment',
  'tax',
  'taxSummary',
  'price',
  'savings',
  'taxRefund',
  'changeDue',
]);

/** Item fields that reveal price. Stripped from table columns in gift mode. */
const MONETARY_ACCESSORS = new Set([
  'unitPrice',
  'lineTotal',
  'price',
  'amount',
  'makingCharge',
  'stoneCharge',
  'ratePerGram',
  'pricePerUnit',
  'discount',
  'sellingPrice',
]);

/** True when the document is a gift receipt, from either template or data. */
export const isGiftMode = (blockConfig: any, data: any): boolean =>
  Boolean(blockConfig?.giftMode || data?.giftMode);

/** True when the sale is duty-free or an export supply. */
export const isDutyFreeOrExport = (data: any): boolean => {
  const mode = data?.salesMode;
  return mode === 'duty_free' || mode === 'export'
    || data?.zeroRateReason === 'duty_free'
    || data?.zeroRateReason === 'export';
};

/**
 * Should this block render at all?
 *
 * Returns false for blocks that must be suppressed by the document's mode,
 * regardless of the block's own `visible` flag — a template author cannot
 * opt into printing a reprint stamp on a duty-free invoice.
 */
export const isBlockSuppressed = (block: any, data: any): boolean => {
  const type = block?.type;

  // A duty-free receipt marked as a copy is not valid proof of sale. This is
  // deliberately NOT configurable: it protects the customer's refund, and a
  // template author has no legitimate reason to override it.
  if (type === 'reprintNotice' && isDutyFreeOrExport(data)) return true;

  // Gift receipts hide everything about what was paid.
  if (isGiftMode(block?.config, data) && MONETARY_BLOCK_TYPES.has(type)) return true;

  return false;
};

/** Remove price-revealing columns from a table in gift mode. */
export const filterGiftModeColumns = <T extends { accessor?: string }>(
  columns: T[],
  giftMode: boolean,
): T[] => (giftMode ? columns.filter((c) => !MONETARY_ACCESSORS.has(c.accessor || '')) : columns);

/**
 * Traveller documents to print on a duty-free sale.
 *
 * Not every jurisdiction's duty-free traveller carries a passport, and not
 * every departure is a flight — Caribbean cruise-ship traffic in particular
 * travels on a seaman's book or a national ID and leaves by vessel, not air.
 * `travellerId` / `travelMethod` are therefore generic slots whose LABEL is
 * store-configurable (`travellerIdType` / `travelMethodType` on the block
 * config), while `destination` and `departureDate` stay fixed — those are
 * true regardless of which document or method is involved.
 *
 * `passport` / `flight` are kept as accepted field keys purely for backward
 * compatibility: templates provisioned before this generalization still
 * store `dutyFreeFields: ['passport', 'flight', ...]` in the database, and
 * templateProvisioningService never rewrites existing rows. They are aliased
 * to `travellerId` / `travelMethod` rather than dropped.
 */
export const DUTY_FREE_FIELD_DEFAULTS: Array<
  'travellerId' | 'travelMethod' | 'destination' | 'departureDate'
> = ['travellerId', 'travelMethod', 'destination', 'departureDate'];

/** Pre-generalization field keys, mapped to their generic replacement. */
const LEGACY_DUTY_FREE_FIELD_ALIASES: Record<string, 'travellerId' | 'travelMethod'> = {
  passport: 'travellerId',
  flight: 'travelMethod',
};

const normalizeDutyFreeFields = (fields?: string[]): Set<string> =>
  fields?.length
    ? new Set(fields.map((f) => LEGACY_DUTY_FREE_FIELD_ALIASES[f] || f))
    : new Set(DUTY_FREE_FIELD_DEFAULTS);

export type TravellerIdType = 'passport' | 'national_id' | 'seaman_book' | 'other';
export type TravelMethodType = 'flight' | 'vessel' | 'other';

const TRAVELLER_ID_LABELS: Record<TravellerIdType, string> = {
  passport: 'Passport',
  national_id: 'National ID',
  seaman_book: "Seaman's Book",
  other: 'Traveller ID',
};

const TRAVEL_METHOD_LABELS: Record<TravelMethodType, string> = {
  flight: 'Flight',
  vessel: 'Vessel',
  other: 'Travel by',
};

/** The subset of a dutyFree block's config that affects label wording. */
export interface DutyFreeLabelConfig {
  travellerIdType?: TravellerIdType;
  travellerIdLabel?: string;
  travelMethodType?: TravelMethodType;
  travelMethodLabel?: string;
}

export interface DutyFreeLine {
  label: string;
  value: string;
}

/** Build the label/value rows for a dutyFree block. */
export const buildDutyFreeLines = (
  data: any,
  fields?: string[],
  labelConfig?: DutyFreeLabelConfig,
): DutyFreeLine[] => {
  const want = normalizeDutyFreeFields(fields);
  const lines: DutyFreeLine[] = [];

  if (want.has('travellerId')) {
    // travellerIdNumber/-Country are the generic fields; passportNumber/
    // -Country are the pre-generalization data shape, kept as a fallback so
    // existing sales already captured under that name still print.
    const idNumber = data?.travellerIdNumber || data?.passportNumber || data?.customer?.passport;
    if (idNumber) {
      const country = data?.travellerIdCountry || data?.passportCountry || data?.customer?.country;
      const idType = labelConfig?.travellerIdType || 'passport';
      const label = labelConfig?.travellerIdLabel || TRAVELLER_ID_LABELS[idType];
      lines.push({
        label,
        value: country ? `${idNumber} (${country})` : String(idNumber),
      });
    }
  }

  if (want.has('travelMethod')) {
    // travelMethodRef/-Detail are the generic fields (e.g. vessel name +
    // voyage number); flightNumber is the pre-generalization fallback.
    const ref = data?.travelMethodRef || data?.flightNumber;
    if (ref) {
      const detail = data?.travelMethodDetail;
      const methodType = labelConfig?.travelMethodType || 'flight';
      const label = labelConfig?.travelMethodLabel || TRAVEL_METHOD_LABELS[methodType];
      lines.push({
        label,
        value: detail ? `${ref} · ${detail}` : String(ref),
      });
    }
  }

  if (want.has('destination') && data?.destination) {
    lines.push({ label: 'Destination', value: String(data.destination) });
  }
  if (want.has('departureDate') && data?.departureDate) {
    lines.push({ label: 'Departure', value: String(data.departureDate) });
  }
  return lines;
};

/** Build the label/value rows for a taxRefund block. */
export const buildTaxRefundLines = (data: any): DutyFreeLine[] => {
  const r = data?.taxRefund || {};
  const lines: DutyFreeLine[] = [];
  if (r.formRef || data?.refundFormRef) {
    lines.push({ label: 'Refund form', value: String(r.formRef || data.refundFormRef) });
  }
  if (r.schemeName || data?.taxRefundSchemeName) {
    lines.push({ label: 'Scheme', value: String(r.schemeName || data.taxRefundSchemeName) });
  }
  return lines;
};

export const DEFAULT_REPRINT_TEXT = 'DUPLICATE — NOT A VALID PROOF OF PURCHASE';
