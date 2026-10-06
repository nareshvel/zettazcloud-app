/**
 * Vertical-specific block models.
 *
 * Data extraction and shaping for the blocks each retail vertical needs. Kept
 * out of the renderers so canvas and print agree, and so the rules that carry
 * real-world consequences are stated once, near the reasoning.
 *
 * COMMERCIAL   savings · loyalty · changeDue · returnPolicy
 * COMPLIANCE   rxDetails · batchExpiry · serialCapture · warranty
 *
 * The compliance blocks are the ones that matter beyond aesthetics: a warranty
 * claim needs a serial number that matches, and a dispensed medicine needs a
 * traceable identifier and beyond-use date.
 */

export interface LabelValueLine {
  label: string;
  value: string;
  /** Emphasise on the printed document (totals, refund due, etc.). */
  emphasis?: boolean;
}

const str = (v: unknown): string => (v == null ? '' : String(v));

/**
 * Safe item list.
 *
 * `items` may arrive malformed from a partial API response or a hand-built
 * template preview. A print job must never crash on bad input — the worst
 * acceptable outcome is a block that renders nothing.
 */
const itemsOf = (data: any): any[] => (Array.isArray(data?.items) ? data.items : []);
const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

// ===========================================================================
// COMMERCIAL
// ===========================================================================

export interface SavingsModel {
  couponLines: Array<{ description: string; amount: number }>;
  total: number;
  hasSavings: boolean;
}

/**
 * "You saved" summary.
 *
 * Convention is that coupon discounts print as negative amounts beneath the item
 * they apply to, then total into a single figure near the bottom. The total is
 * the part customers actually look for, so it is emphasised.
 */
export const buildSavings = (data: any): SavingsModel => {
  const couponLines = Array.isArray(data?.couponLines)
    ? data.couponLines.map((c: any) => ({
        description: str(c.description || c.label),
        amount: num(c.amount),
      }))
    : [];

  // Prefer an explicit total: a chain may include savings we cannot see in the
  // line detail (basket-level promotions, card discounts applied at close).
  const total = data?.savingsTotal != null
    ? num(data.savingsTotal)
    : couponLines.reduce((s, c) => s + Math.abs(c.amount), 0);

  return { couponLines, total, hasSavings: total > 0 || couponLines.length > 0 };
};

export interface LoyaltyModel {
  lines: LabelValueLine[];
  hasLoyalty: boolean;
}

export const buildLoyalty = (data: any): LoyaltyModel => {
  const lines: LabelValueLine[] = [];
  if (data?.loyaltyPointsEarned != null) {
    lines.push({ label: 'Points earned', value: str(data.loyaltyPointsEarned) });
  }
  if (data?.loyaltyBalance != null) {
    lines.push({ label: 'Points balance', value: str(data.loyaltyBalance), emphasis: true });
  }
  if (data?.loyaltyTier) {
    lines.push({ label: 'Tier', value: str(data.loyaltyTier) });
  }
  return { lines, hasLoyalty: lines.length > 0 };
};

export interface ChangeDueModel {
  lines: LabelValueLine[];
  hasChange: boolean;
}

/**
 * Cash tendered and change given.
 *
 * Only meaningful for cash: card and digital payments have no tender or change,
 * and printing "Change 0.00" on a card sale is noise. Also the place where cash
 * rounding becomes visible (AU/CA round to 5c), so a rounding adjustment is
 * shown explicitly rather than silently altering the total.
 */
export const buildChangeDue = (data: any): ChangeDueModel => {
  const p = data?.payment || {};
  const method = str(p.method).toLowerCase();
  const isCash = method.includes('cash');
  if (!isCash || p.tendered == null) return { lines: [], hasChange: false };

  const lines: LabelValueLine[] = [
    { label: 'Tendered', value: str(p.tendered) },
  ];
  if (p.roundingAdjustment != null && num(p.roundingAdjustment) !== 0) {
    lines.push({ label: 'Rounding', value: str(p.roundingAdjustment) });
  }
  if (p.change != null) {
    lines.push({ label: 'Change', value: str(p.change), emphasis: true });
  }
  return { lines, hasChange: true };
};

export interface ReturnPolicyModel {
  windowDays: number | null;
  restockingFeePct: number | null;
  terms: string;
  hasPolicy: boolean;
}

export const buildReturnPolicy = (data: any, fallbackTerms?: string): ReturnPolicyModel => {
  const r = data?.returnPolicy || {};
  const terms = str(r.terms || fallbackTerms || '');
  return {
    windowDays: r.windowDays != null ? num(r.windowDays) : null,
    restockingFeePct: r.restockingFeePct != null ? num(r.restockingFeePct) : null,
    terms,
    hasPolicy: Boolean(terms || r.windowDays != null),
  };
};

// ===========================================================================
// COMPLIANCE
// ===========================================================================

export interface RxModel {
  lines: LabelValueLine[];
  pharmacistName: string | null;
  counsellingNotice: string | null;
  hasRx: boolean;
}

/**
 * Prescription detail.
 *
 * Refills remaining is shown even when zero — "0 refills remaining" is
 * actionable information telling the patient to contact their prescriber,
 * whereas an absent line is ambiguous.
 */
export const buildRxDetails = (data: any): RxModel => {
  const lines: LabelValueLine[] = [];
  if (data?.rxNumber)   lines.push({ label: 'Rx No.', value: str(data.rxNumber), emphasis: true });
  if (data?.prescriber) lines.push({ label: 'Prescriber', value: str(data.prescriber) });

  if (data?.refillsRemaining != null) {
    const remaining = num(data.refillsRemaining);
    const authorized = data.refillsAuthorized != null ? num(data.refillsAuthorized) : null;
    lines.push({
      label: 'Refills',
      value: authorized != null ? `${remaining} of ${authorized} remaining` : `${remaining} remaining`,
      emphasis: remaining === 0,
    });
  }
  if (data?.dateFilled) lines.push({ label: 'Filled', value: str(data.dateFilled) });

  return {
    lines,
    pharmacistName: data?.pharmacistName ? str(data.pharmacistName) : null,
    counsellingNotice: data?.counsellingNotice ? str(data.counsellingNotice) : null,
    hasRx: lines.length > 0,
  };
};

export interface BatchExpiryRow {
  itemName: string;
  drugId: string | null;
  lotNumber: string | null;
  expiry: string | null;
}

/**
 * Batch / lot / expiry per dispensed or perishable item.
 *
 * The identifier LABEL is jurisdiction data — NDC (US), DIN (Canada), PZN
 * (Germany), GTIN elsewhere. Hardcoding "NDC" would be wrong outside the US.
 *
 * Beyond-use date is distinct from the manufacturer expiry: it is the date after
 * which a repackaged medicine must be discarded, and is what the patient acts on.
 */
export const buildBatchExpiry = (data: any): BatchExpiryRow[] =>
  itemsOf(data)
    .filter((i: any) => i?.drugId || i?.lotNumber || i?.beyondUseDate || i?.expiryDate)
    .map((i: any) => ({
      itemName: str(i.name),
      drugId: i.drugId ? str(i.drugId) : null,
      lotNumber: i.lotNumber ? str(i.lotNumber) : null,
      // Beyond-use date takes precedence — it is the operative date for the patient.
      expiry: i.beyondUseDate ? str(i.beyondUseDate) : (i.expiryDate ? str(i.expiryDate) : null),
    }));

export interface SerialRow {
  itemName: string;
  serialNumber: string | null;
  imei: string | null;
}

/**
 * Serial / IMEI capture.
 *
 * A warranty claim requires the original receipt with MATCHING serial numbers,
 * and warranty lookup is performed by IMEI or serial. A receipt without them is
 * of limited use to the customer when something fails.
 */
export const buildSerialRows = (data: any): SerialRow[] =>
  itemsOf(data)
    .filter((i: any) => i?.serialNumber || i?.imei)
    .map((i: any) => ({
      itemName: str(i.name),
      serialNumber: i.serialNumber ? str(i.serialNumber) : null,
      imei: i.imei ? str(i.imei) : null,
    }));

export interface WarrantyRow {
  itemName: string;
  term: string | null;
  expiry: string | null;
}

export const buildWarrantyRows = (data: any): WarrantyRow[] =>
  itemsOf(data)
    .filter((i: any) => i?.warrantyMonths != null || i?.warrantyExpiry)
    .map((i: any) => ({
      itemName: str(i.name),
      term: i.warrantyMonths != null ? `${num(i.warrantyMonths)} months` : null,
      expiry: i.warrantyExpiry ? str(i.warrantyExpiry) : null,
    }));

/** Blocks that render nothing without their vertical's data — used for previews. */
/**
 * Rows for a `custom` block.
 *
 * SHARED BY BOTH RENDERERS. It was not, and they diverged inside a single
 * change: `accessor` support was added to the print renderer so a refund slip
 * could name the sale it reverses, and the canvas was left resolving only
 * `value`. The designer therefore showed "Original Sale —" for a document that
 * printed "Original Sale INV-2026-001180".
 *
 * A row that resolves to nothing is DROPPED rather than rendered with a dash.
 * A dangling "Original Sale:" with no value reads as a fault on paper, and on
 * the canvas it reads as a bug in the template the user is editing.
 */
export interface CustomRow { label: string; value: string; }

export function buildCustomRows(
  fields: Array<{ id?: string; label?: string; value?: unknown; accessor?: string }> = [],
  data: any = {},
): CustomRow[] {
  return fields
    .map((f) => {
      const raw = f.value ?? (f.accessor ? data?.[f.accessor] : undefined);
      return { label: f.label || '', value: raw === undefined || raw === null ? '' : String(raw) };
    })
    .filter((r) => r.value !== '');
}

export const BLOCK_EMPTY_HINTS: Record<string, string> = {
  gemstones: 'No gemstone details in sample data',
  attributes: 'No attributes in sample data',
  taxSummary: 'No tax data in sample',
  dutyFree: 'No traveller details in sample',
  taxRefund: 'No refund details in sample',
  savings: 'No coupon or savings data in sample',
  loyalty: 'No loyalty data in sample',
  changeDue: 'Only shown on cash payments',
  returnPolicy: 'No return policy in sample',
  rxDetails: 'No prescription data in sample',
  batchExpiry: 'No batch / lot data in sample',
  serialCapture: 'No serial or IMEI in sample',
  warranty: 'No warranty data in sample',
  // Both of these previously fell back to invented body text on the canvas
  // ('Payment terms and conditions.', 'Duty-free compliance text placeholder.')
  // which the print renderer never produces.
  terms: 'No payment terms in sample',
  compliance: 'No legal / compliance text in sample',
  // Shown when nothing can be encoded — the designer must see this rather than
  // a healthy-looking barcode for a document that would print an empty one.
  barcode: 'Nothing to encode — no document number in sample',
  custom: 'No values for these fields in sample',
  parties: 'No customer or terms in sample',
  pageFooter: 'No store address or tax ID in sample',
};
