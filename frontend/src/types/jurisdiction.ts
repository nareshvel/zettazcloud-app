/**
 * Jurisdiction types — the tax, invoicing and fiscal rules of the place a store
 * operates, plus the mode it sells in.
 *
 * The application is country-agnostic and supports duty-free retail, so nothing
 * here may assume a particular country. Every label (`taxLabel`, `taxIdLabel`,
 * `drugIdentifierLabel`) and every compliance flag is data, not a constant.
 *
 * Mirrors backend/services/jurisdictionService.js.
 */

/** How a store sells. Changes what a document must contain and whether tax applies. */
export type SalesMode =
  | 'domestic'   // ordinary local sale — tax as normal
  | 'duty_free'  // traveller retail — zero-rated, passport/boarding pass required
  | 'export'     // goods leave the territory — zero-rated
  | 'mixed';     // store does both; the mode is chosen per transaction

/** Why a sale carried no tax. `null` when tax was charged normally. */
export type ZeroRateReason = 'duty_free' | 'export' | 'reverse_charge' | null;

/**
 * Known fiscalization schemes. Where one applies, receipts must carry a
 * cryptographic signature (and usually a QR code) produced by certified
 * software — this is a legal obligation, not a formatting choice.
 */
export type FiscalizationScheme =
  | 'AT_RKSV'       // Austria — Signaturpflicht §131b BAO
  | 'PT_ATCUD'      // Portugal — ATCUD + QR, AT-certified software, SAF-T (PT)
  | 'DE_DSFINV_K'   // Germany — TSE signing, DsFinV-K export
  | 'BG_USN'        // Bulgaria — USN number + QR, 5-minute XML transmission
  | 'IT_RT'         // Italy — Registratore Telematico
  | string;         // open-ended: more countries are adopting these continuously

/** Regimes that impose extra itemisation on precious-metal sales. */
export type HallmarkRegime = 'BIS_IN' | null;

/**
 * A country's (optionally a region's) rules. Shared catalog — tenant-agnostic.
 */
export interface JurisdictionProfile {
  id: string | null;
  countryCode: string | null;
  /** Set where sub-national tax differs, e.g. Canadian provinces. */
  regionCode: string | null;
  displayName: string;

  // --- Tax presentation ---
  /** What consumption tax is called locally: VAT, GST, HST, ABST, Sales Tax… */
  taxLabel: string;
  /** What the business tax number is called: VAT No., GSTIN, ABN, TRN… */
  taxIdLabel: string;
  /** Regional retail convention — EU/AU/IN display inclusive, US/CA exclusive. */
  pricesIncludeTax: boolean;

  // --- Invoice rules ---
  /** Literal wording the law requires, e.g. "TAX INVOICE" in AU/IN/AE. */
  mandatoryInvoiceTitle: string | null;
  /** B2B invoices must carry the buyer's tax number (most of the EU). */
  requiresCustomerTaxId: boolean;
  /** Gapless sequential invoice numbering (EU). */
  requiresSequentialNumbering: boolean;
  supportsReverseCharge: boolean;
  /** Exact wording to print when reverse charge applies. */
  reverseChargeText: string | null;

  // --- Fiscalization ---
  fiscalizationEnabled: boolean;
  fiscalizationScheme: FiscalizationScheme | null;
  fiscalizationRequiresQr: boolean;

  // --- Vertical-specific ---
  hallmarkRegime: HallmarkRegime;
  /** NDC (US) | DIN (CA) | PZN (DE) | GTIN — never hardcode "NDC". */
  drugIdentifierLabel: string;

  // --- Tax-free shopping ---
  supportsTaxRefund: boolean;
  taxRefundSchemeName: string | null;

  // --- Formatting ---
  defaultCurrencyCode: string | null;
  dateFormat: string;
  /** Smallest circulating coin, e.g. 0.05 in AU/CA. 0 = no cash rounding. */
  cashRoundingIncrement: number;

  notes?: string | null;

  /**
   * True when no profile matched and a permissive fallback was used. Surface
   * this in settings UIs — an unconfigured store may be producing documents
   * that do not meet local requirements.
   */
  isNeutralFallback: boolean;
}

/** Store-specific settings that sit on top of the shared profile. */
export interface StoreJurisdictionSettings {
  salesMode: SalesMode;
  requiresPassport: boolean;
  requiresBoardingPass: boolean;
  exportDeclarationText: string | null;
  businessTaxId: string | null;
  fiscalDeviceSerial: string | null;
  fiscalSoftwareId: string | null;
  invoiceNumberPrefix: string | null;
}

/** Everything a caller needs to render a compliant document for this store. */
export interface JurisdictionContext {
  profile: JurisdictionProfile;
  store: StoreJurisdictionSettings;
  salesMode: SalesMode;
  isDutyFree: boolean;
  isExport: boolean;
  /** True when no local consumption tax applies to the sale. */
  zeroRated: boolean;
}

/** Payload for updating a store's jurisdiction settings. */
export interface JurisdictionSettingsPatch {
  jurisdictionProfileId?: string | null;
  salesMode?: SalesMode;
  requiresPassport?: boolean;
  requiresBoardingPass?: boolean;
  exportDeclarationText?: string | null;
  businessTaxId?: string | null;
  fiscalDeviceSerial?: string | null;
  fiscalSoftwareId?: string | null;
  invoiceNumberPrefix?: string | null;
  overrides?: Partial<JurisdictionProfile> | null;
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const SALES_MODE_LABELS: Record<SalesMode, string> = {
  domestic: 'Domestic',
  duty_free: 'Duty-Free',
  export: 'Export',
  mixed: 'Mixed',
};

export const SALES_MODE_DESCRIPTIONS: Record<SalesMode, string> = {
  domestic: 'Ordinary local sales. Tax charged at the applicable rate.',
  duty_free: 'Traveller retail. Zero-rated; passport and boarding pass captured at sale.',
  export: 'Goods leave the territory. Zero-rated with an export declaration.',
  mixed: 'Both domestic and duty-free. The mode is chosen per transaction.',
};

/**
 * True when the store must capture traveller documents at the point of sale.
 * Duty-free proof of sale requires the purchaser's name to match the passport.
 */
export const requiresTravellerDocuments = (ctx: JurisdictionContext): boolean =>
  ctx.store.requiresPassport || ctx.store.requiresBoardingPass;

/**
 * True when a `fiscal` block must be rendered on documents for this store.
 * Never infer this from country code in UI code — read the profile.
 */
export const requiresFiscalBlock = (ctx: JurisdictionContext): boolean =>
  ctx.profile.fiscalizationEnabled;

/**
 * Document title for an invoice. Jurisdictions such as AU, IN and AE mandate
 * exact wording, in which case the user's own title must not be used.
 */
export const resolveInvoiceTitle = (
  ctx: JurisdictionContext,
  userTitle?: string | null,
): string => ctx.profile.mandatoryInvoiceTitle || userTitle || 'INVOICE';
