/**
 * Tax summary normalisation.
 *
 * The `taxSummary` block must render the SAME data the backend already
 * computes. `taxCalculationService.generateTaxSummary()` handles tax classes,
 * multiple rates per class, and compound tax (tax-on-tax, e.g. Quebec QST on
 * GST) — building a second tax model in the renderer would guarantee the two
 * drift apart, and a receipt that disagrees with the ledger is worse than one
 * that is merely ugly.
 *
 * So this module only *normalises* shapes. It performs no tax arithmetic.
 *
 * Two shapes arrive in practice:
 *
 *   BACKEND  generateTaxSummary() — snake_case, grouped by tax class
 *     [{ tax_class_name, total_tax_amount,
 *        rate_summaries: [{ tax_rate_name, rate, is_compound, total_tax_amount }] }]
 *
 *   FIXTURE  a flat presentation-ready list used for previews
 *     [{ label, rate, taxableAmount, taxAmount }]
 *
 * Note `fetchApi` converts snake_case to camelCase in transit, so the backend
 * shape may arrive either way. Both are handled.
 */

/** One line in a rendered tax summary. */
export interface TaxSummaryLine {
  /** Display label, e.g. "ABST 15%", "Exempt (food)", "QST 9.975% (compound)". */
  label: string;
  /** Percentage rate. 0 for exempt/zero-rated lines. */
  rate: number;
  /** Amount the rate was applied to, when known. */
  taxableAmount: number | null;
  /** Tax charged for this line. */
  taxAmount: number;
  /** True where the rate was applied on top of other taxes. */
  isCompound: boolean;
  /** True for exempt / zero-rated lines — rendered but contributing nothing. */
  isZeroRated: boolean;
}

export interface TaxSummaryModel {
  lines: TaxSummaryLine[];
  totalTax: number;
  /** True when there is genuinely nothing to show (not merely zero tax). */
  isEmpty: boolean;
  /** Set when the whole sale was zero-rated, e.g. duty-free or reverse charge. */
  zeroRateReason: string | null;
  /** Prescribed wording that must appear when reverse charge applies. */
  reverseChargeText: string | null;
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
};

/** Rates may arrive as a percentage (15) or a fraction (0.15). Normalise to percent. */
const toPercent = (v: unknown): number => {
  const n = num(v);
  // A "rate" below 1 is a fraction in every real tax regime — no jurisdiction
  // levies 0.15%. Above 1 it is already a percentage.
  return n > 0 && n < 1 ? n * 100 : n;
};

/** Trim trailing zeros so 9.975 stays exact but 15.00 shows as 15. */
const formatRate = (pct: number): string =>
  Number.isInteger(pct) ? String(pct) : String(parseFloat(pct.toFixed(3)));

/**
 * Build a render-ready tax summary from whatever shape the caller supplies.
 *
 * @param data      The document fixture / sale payload
 * @param taxLabel  Jurisdiction tax label (VAT / GST / ABST / Sales Tax…).
 *                  Never hardcode this — it comes from the jurisdiction profile.
 */
export const buildTaxSummary = (data: any, taxLabel = 'Tax'): TaxSummaryModel => {
  const zeroRateReason: string | null = data?.zeroRateReason ?? null;
  const reverseChargeText: string | null =
    data?.reverseChargeText ?? data?.jurisdiction?.reverseChargeText ?? null;

  // --- Shape 1: presentation-ready breakdown (fixtures, and any caller that
  // has already flattened the backend output) -------------------------------
  const breakdown = data?.taxBreakdown;
  if (Array.isArray(breakdown) && breakdown.length > 0) {
    const lines: TaxSummaryLine[] = breakdown.map((b: any) => {
      const rate = toPercent(b.rate);
      const taxAmount = num(b.taxAmount ?? b.tax_amount);
      return {
        label: b.label || (rate > 0 ? `${taxLabel} ${formatRate(rate)}%` : 'Exempt'),
        rate,
        taxableAmount: b.taxableAmount ?? b.taxable_amount ?? null,
        taxAmount,
        isCompound: Boolean(b.isCompound ?? b.is_compound),
        isZeroRated: rate === 0,
      };
    });
    return {
      lines,
      totalTax: lines.reduce((s, l) => s + l.taxAmount, 0),
      isEmpty: false,
      zeroRateReason,
      reverseChargeText,
    };
  }

  // --- Shape 2: backend generateTaxSummary() grouped by tax class -----------
  const summary = data?.taxSummary ?? data?.tax_summary;
  if (Array.isArray(summary) && summary.length > 0) {
    const lines: TaxSummaryLine[] = [];
    summary.forEach((cls: any) => {
      const rates = cls.rate_summaries ?? cls.rateSummaries ?? [];
      if (!Array.isArray(rates) || rates.length === 0) {
        // A class with no rate breakdown still contributes a total.
        lines.push({
          label: cls.tax_class_name ?? cls.taxClassName ?? taxLabel,
          rate: 0,
          taxableAmount: null,
          taxAmount: num(cls.total_tax_amount ?? cls.totalTaxAmount),
          isCompound: false,
          isZeroRated: false,
        });
        return;
      }
      rates.forEach((r: any) => {
        const rate = toPercent(r.rate);
        const name = r.tax_rate_name ?? r.taxRateName ?? taxLabel;
        const isCompound = Boolean(r.is_compound ?? r.isCompound);
        lines.push({
          label: `${name} ${formatRate(rate)}%${isCompound ? ' (compound)' : ''}`,
          rate,
          taxableAmount: null,
          taxAmount: num(r.total_tax_amount ?? r.totalTaxAmount),
          isCompound,
          isZeroRated: rate === 0,
        });
      });
    });
    return {
      lines,
      totalTax: lines.reduce((s, l) => s + l.taxAmount, 0),
      isEmpty: lines.length === 0,
      zeroRateReason,
      reverseChargeText,
    };
  }

  // --- Shape 3: a single flat tax figure (legacy / simple sales) ------------
  const flatTax = data?.taxAmount ?? data?.tax;
  if (flatTax !== undefined && flatTax !== null) {
    const rate = toPercent(data?.taxRate);
    const amount = num(flatTax);
    return {
      lines: [{
        label: rate > 0 ? `${taxLabel} ${formatRate(rate)}%` : taxLabel,
        rate,
        taxableAmount: data?.subtotal ?? null,
        taxAmount: amount,
        isCompound: false,
        isZeroRated: amount === 0,
      }],
      totalTax: amount,
      isEmpty: false,
      zeroRateReason,
      reverseChargeText,
    };
  }

  return {
    lines: [],
    totalTax: 0,
    isEmpty: true,
    zeroRateReason,
    reverseChargeText,
  };
};

/** Human wording for why a sale carried no tax. */
export const ZERO_RATE_LABELS: Record<string, string> = {
  duty_free: 'Zero-rated — duty-free export',
  export: 'Zero-rated — export',
  reverse_charge: 'Reverse charge — customer accounts for tax',
};
