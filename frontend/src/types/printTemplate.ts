// Shared types for the Print Template Designer

export type PaperSize = '58mm' | '80mm' | 'a4' | 'label';

/** A single user-managed field within a block (e.g. a footer line, a table
 * column, or a free-form label/value pair). Fields can be freely added,
 * renamed, reordered and deleted from the properties panel. */
export interface TemplateField {
  id: string;
  label: string;
  /** Free-text value (used by 'custom' blocks and footer lines) */
  value?: string;
  /** Bound data key (used by table columns), e.g. 'name' | 'qty' | 'unitPrice' */
  accessor?: string;
}

/** Logo block layout preset — controls what identity elements appear alongside the image. */
export type LogoLayout =
  | 'logo_only'           // image only
  | 'logo_name'           // image + store name
  | 'logo_name_contact'   // image + store name + address / phone / email
  | 'name_only'           // store name as styled header, no image
  | 'name_contact';       // store name + full contact block, no image

/** Table block — which business-type preset populated the columns. */
export type TablePreset = 'general' | 'jewelry' | 'service' | 'restaurant' | 'custom';

/** What data a barcode/QR block should encode. */
export type BarcodeSource =
  | 'receiptNo' | 'invoiceNo' | 'orderNo'
  | 'customerId' | 'productSku' | 'pieceId'
  | 'custom';

export interface BlockConfig {
  align?: 'left' | 'center' | 'right';
  fontSize?: 'fine' | 'xs' | 'sm' | 'base' | 'lg' | 'xl' | 'title';
  bold?: boolean;
  content?: string;
  imageUrl?: string;
  /** Logo height in mm. Applies to `logo` blocks. */
  logoHeight?: number;
  /** Layout preset for logo blocks — controls what identity info is shown. */
  logoLayout?: LogoLayout;
  /** Store contact fields to show alongside the logo (for logo_name_contact layout). */
  logoContactFields?: ('address' | 'phone' | 'email' | 'taxId')[];

  columns?: string[];
  symbology?: 'code128' | 'qr';
  /** Which data field to encode in a barcode/QR block. */
  barcodeSource?: BarcodeSource;
  /** Custom text/value to encode when barcodeSource === 'custom'. */
  barcodeCustomValue?: string;

  source?: string;
  lines?: string[];

  /** User-managed dynamic fields — see TemplateField. Used by footer, table,
   * custom, attributes, gemstones and compliance blocks. */
  fields?: TemplateField[];

  /** Which store identity fields to show in a `text` block (name/address/phone/email/taxId). */
  storeFields?: ('name' | 'address' | 'phone' | 'email' | 'taxId')[];
  /** Which customer identity fields to show in a `customer` block. */
  customerFields?: ('name' | 'address' | 'city' | 'phone' | 'email' | 'taxId' | 'passport')[];
  /** Which header metadata fields to show in a `header` block. */
  headerFields?: ('invoiceNumber' | 'date' | 'dueDate' | 'cashier')[];
  /** Which customer address to render in an `address` block. */
  addressType?: 'billing' | 'shipping' | 'both';

  /** Table block options */
  tablePreset?: TablePreset;
  tableShowHeader?: boolean;  // default true
  tableZebra?: boolean;       // alternate row shading
  tableCompact?: boolean;     // tighter row padding

  /** Per-block vertical spacing (in px equivalent) above and below */
  paddingTop?: number;
  paddingBottom?: number;

  /** ---- taxSummary block ----
   * All jurisdiction-driven. The tax label itself is NOT stored here — it comes
   * from the jurisdiction profile at render time so one template works in any
   * country. */
  /** Show the amount each rate was applied to, not just the tax charged. */
  showTaxableAmount?: boolean;
  /** Render exempt / zero-rated classes as their own lines (grocery, pharmacy). */
  showExemptLines?: boolean;
  /** Print the prescribed reverse-charge wording when the sale uses it. */
  showReverseChargeNotice?: boolean;
  /** Show a combined total beneath the per-rate lines. */
  showTaxTotal?: boolean;

  /** ---- dutyFree block ----
   * Which traveller fields to print. Duty-free proof of sale requires the
   * purchaser's name to match their travel document, so travellerId is on
   * by default. `passport`/`flight` are accepted as legacy aliases for
   * `travellerId`/`travelMethod` — see salesModeRules.ts. */
  dutyFreeFields?: ('travellerId' | 'travelMethod' | 'destination' | 'departureDate' | 'passport' | 'flight')[];
  /** Which document type the traveller ID line represents — not every
   * duty-free traveller carries a passport (e.g. Caribbean cruise-ship
   * traffic on a seaman's book or national ID). Controls the printed label. */
  travellerIdType?: 'passport' | 'national_id' | 'seaman_book' | 'other';
  /** Custom label override, used instead of travellerIdType's default wording. */
  travellerIdLabel?: string;
  /** Which travel method the traveller-method line represents — not every
   * departure is a flight. Controls the printed label. */
  travelMethodType?: 'flight' | 'vessel' | 'other';
  /** Custom label override, used instead of travelMethodType's default wording. */
  travelMethodLabel?: string;
  /**
   * The export declaration ("goods must leave the territory") no longer
   * renders from this block — it varies tenant to tenant and country to
   * country, so it prints from the `compliance` block's jurisdiction-sourced
   * legal text instead. Kept here (unused) so a template saved before this
   * change doesn't fail validation on its stored config.
   * @deprecated moved to the compliance block.
   */
  showExportDeclaration?: boolean;

  /** ---- taxRefund block ----
   * Retailer obligations: goods description, price, admin charge, refund due,
   * and a marking on the till receipt showing the goods were included. */
  showRefundBreakdown?: boolean;
  showRefundFormRef?: boolean;

  /** ---- reprintNotice block ---- */
  reprintText?: string;

  /** ---- savings block ---- */
  showCouponLines?: boolean;
  savingsLabel?: string;

  /** ---- loyalty block ---- */
  showPointsBalance?: boolean;

  /** ---- returnPolicy block ---- */
  showReturnWindow?: boolean;
  showRestockingFee?: boolean;
  returnPolicyText?: string;

  /** ---- rxDetails block ---- */
  showPrescriber?: boolean;
  showRefills?: boolean;
  showPharmacistSignoff?: boolean;

  /** ---- batchExpiry block ---- */
  showLotNumber?: boolean;
  showDrugIdentifier?: boolean;

  /** ---- serialCapture / warranty blocks ---- */
  showImei?: boolean;
  showWarrantyExpiry?: boolean;

  /** ---- fiscal block ----
   * Signing is performed by a certified backend integration; these only control
   * what is laid out on the document. */
  showFiscalQr?: boolean;
  showFiscalSignature?: boolean;
  showFiscalDeviceInfo?: boolean;

  /** ---- gift mode ----
   * Suppresses price, discount and payment so a recipient can return an item
   * without learning what was paid. Set on the TEMPLATE, applied to all blocks. */
  giftMode?: boolean;

  [key: string]: unknown;
}

export interface TemplateBlock {
  id: string;
  type: string;
  visible: boolean;
  order: number;
  label?: string;
  config?: BlockConfig;
}

export interface BlockTypeMeta {
  label: string;
  description: string;
  /** Groups the block in the palette, mirroring how modern template builders
   * (e.g. Invotify) organize blocks: Identity, Items, Totals, Info, Compliance, General. */
  category: 'identity' | 'items' | 'totals' | 'info' | 'compliance' | 'general';
  /** Whether this block type supports the dynamic field editor (add/rename/delete/reorder). */
  hasFields?: boolean;
}

// Known block "kinds" produced by the backend defaults (printTemplateService.js DEFAULT_BLOCKS)
// plus the generic ones addable from the palette.
export const BLOCK_TYPE_META: Record<string, BlockTypeMeta> = {
  logo: { label: 'Logo', description: 'Store logo image', category: 'identity' },
  text: { label: 'Text', description: 'Free text / store header', category: 'identity' },
  header: { label: 'Header', description: 'Document title & meta', category: 'identity' },
  customer: { label: 'Customer Details', description: 'Customer name & contact info', category: 'info' },
  address: { label: 'Billing / Shipping', description: 'Billing and shipping addresses', category: 'info' },
  parties: { label: 'Parties Band', description: 'Bill to, ship to and terms, side by side', category: 'info' },
  pageFooter: { label: 'Page Footer', description: 'Store address and tax ID, repeated on every page', category: 'identity' },
  table: { label: 'Items Table', description: 'Line items table', category: 'items', hasFields: true },
  itemAttributes: { label: 'Item Attributes', description: 'Per-item attributes marked show-on-receipt (purity, weight, etc.)', category: 'items' },
  attributes: { label: 'Attributes', description: 'Jewelry attributes (purity, weight, etc.)', category: 'items', hasFields: true },
  purity: { label: 'Purity & Weight', description: 'Metal purity and weight breakdown', category: 'items', hasFields: true },
  gemstones: { label: 'Gemstones', description: 'Gemstone details', category: 'items', hasFields: true },
  tax: { label: 'Tax (simple)', description: 'Single-rate tax line', category: 'totals' },
  taxSummary: {
    label: 'Tax Summary',
    description: 'Multi-rate breakdown — exempt classes, compound tax, reverse charge',
    category: 'totals',
  },
  totals: { label: 'Totals', description: 'Subtotal / tax / total summary', category: 'totals' },
  payment: { label: 'Payment', description: 'Payment method and amount', category: 'totals' },
  terms: { label: 'Terms', description: 'Payment terms & notes', category: 'compliance' },
  compliance: { label: 'Compliance', description: 'Duty-free / legal compliance text', category: 'compliance', hasFields: true },
  // ── Commercial ──
  savings: {
    label: 'Savings',
    description: '"You saved" total and coupon breakdown',
    category: 'totals',
  },
  loyalty: {
    label: 'Loyalty',
    description: 'Points earned, balance and tier',
    category: 'totals',
  },
  changeDue: {
    label: 'Tendered / Change',
    description: 'Cash tendered, rounding and change given',
    category: 'totals',
  },
  returnPolicy: {
    label: 'Return Policy',
    description: 'Return window, restocking fee and terms',
    category: 'compliance',
  },

  // ── Compliance ──
  serialCapture: {
    label: 'Serial / IMEI',
    description: 'Per-item serial numbers — required for warranty claims',
    category: 'items',
  },
  warranty: {
    label: 'Warranty',
    description: 'Warranty term and expiry per item',
    category: 'compliance',
  },

  fiscal: {
    label: 'Fiscal Signature',
    description: 'Signed fiscal QR / ATCUD — required in ~30 countries',
    category: 'compliance',
  },
  dutyFree: {
    label: 'Duty-Free / Export',
    description: 'Traveller ID, travel method, destination and departure',
    category: 'compliance',
  },
  taxRefund: {
    label: 'Tax Refund Form',
    description: 'Traveller VAT-refund reference, admin charge and refund due',
    category: 'compliance',
  },
  barcode: { label: 'Barcode / QR', description: 'Scannable barcode or QR code', category: 'general' },
  signatures: { label: 'Signatures', description: 'Customer / authorized signature lines', category: 'general' },
  footer: { label: 'Footer', description: 'Footer message lines', category: 'general', hasFields: true },
  price: { label: 'Price', description: 'Price display (labels)', category: 'totals' },
  custom: { label: 'Custom Fields', description: 'Add any label / value pairs you need', category: 'general', hasFields: true },
};

export const BLOCK_CATEGORY_LABELS: Record<BlockTypeMeta['category'], string> = {
  identity: 'Identity & Branding',
  items: 'Items & Products',
  totals: 'Totals & Payment',
  info: 'Customer Info',
  compliance: 'Terms & Compliance',
  general: 'General',
};

export const TABLE_COLUMN_ACCESSOR_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'name', label: 'Item Name' },
  { value: 'description', label: 'Description' },
  { value: 'qty', label: 'Quantity' },
  { value: 'unitPrice', label: 'Unit Price' },
  { value: 'lineTotal', label: 'Line Total' },
  { value: 'purity', label: 'Purity' },
  { value: 'netWeight', label: 'Net Weight' },
  { value: 'grossWeight', label: 'Gross Weight' },
  { value: 'makingCharge', label: 'Making Charge' },
];

export const PAPER_SIZE_LABELS: Record<PaperSize, string> = {
  '58mm': '58mm Thermal',
  '80mm': '80mm Thermal',
  a4: 'A4 / Letter',
  label: 'Label',
};

// Map a template_type to its natural default paper size for preview purposes
export const DEFAULT_PAPER_SIZE_FOR_TYPE: Record<string, PaperSize> = {
  receipt: '80mm',
  invoice: 'a4',
  jewelry_invoice: 'a4',
  jewelry_certificate: 'a4',
  // A refund slip is handed across a counter, like the receipt it mirrors.
  return: '80mm',
  document: 'a4',
  label: 'label',
  // Repair ticket is a compact A4 job card, mirroring the existing hand-rolled
  // repairPrintService.ts Job Card it replaces — see repairToPrintData.ts.
  repair_ticket: 'a4',
  // Old gold voucher is a thermal credit/cash-settlement slip, mirroring the
  // existing hand-rolled oldGoldPrintService.ts voucher it replaces.
  old_gold_voucher: '80mm',
  // Memo slip is the formal A4 consignment acknowledgement, mirroring the
  // existing hand-rolled memoPrintService.ts ackHtml it replaces.
  memo_slip: 'a4',
  // Layaway agreement mirrors layawayPrintService.ts's generateAgreementHtml
  // (A4); the payment receipt mirrors generatePaymentReceiptHtml (80mm).
  layaway_agreement: 'a4',
  layaway_receipt: '80mm',
  // Savings enrollment is an A4 passbook, mirroring SavingsSchemesPage.tsx's
  // inline printPassbook it replaces.
  savings_enrollment: 'a4',
  // Order acknowledgement is the first print surface OrdersPage.tsx has ever
  // had — built from scratch this phase, A4 to match the other confirmation
  // documents.
  order_acknowledgement: 'a4',
};

// Canvas pixel widths used purely for on-screen proofing (not physical mm).
// A4 is intentionally wider than the old 480px so body text can use realistic
// invoice type sizes (10-12pt equivalent) instead of being squeezed as small
// as a thermal receipt — see printTemplateRenderer.ts for the physically
// accurate mm/pt sizing used by the actual Print Preview.
export const PAPER_SIZE_WIDTH_PX: Record<PaperSize, number> = {
  '58mm': 220,
  '80mm': 300,
  a4: 640,
  label: 260,
};

// Physical page sizing for the real Print Preview (mm), used with @page CSS.
export const PAPER_SIZE_PHYSICAL: Record<PaperSize, { width: string; height?: string; margin: string }> = {
  '58mm': { width: '58mm', margin: '2mm 3mm' },
  '80mm': { width: '80mm', margin: '3mm 4mm' },
  a4: { width: '210mm', height: '297mm', margin: '18mm 16mm' },
  label: { width: '50mm', height: '25mm', margin: '2mm' },
};

let fieldIdCounter = 0;
/** Generates a locally-unique id for a new field/block without pulling in a uuid dependency. */
export const createLocalId = (prefix: string): string => {
  fieldIdCounter += 1;
  return `${prefix}-${Date.now()}-${fieldIdCounter}`;
};

/**
 * Blocks that exist and render correctly, but are deliberately NOT offered in
 * the palette yet.
 *
 * `rxDetails` / `batchExpiry` — pharmacy. Dispensing records carry regulatory
 *   weight and the rules differ per board of pharmacy. Held back until reviewed
 *   by someone with pharmacy operations knowledge in each target market.
 *
 * `reprintNotice` — superseded. Rather than stamping paper, print attempts are
 *   counted per document in settings, which is both less intrusive and more
 *   auditable. The renderer is retained so existing templates do not break.
 */
export const HIDDEN_BLOCK_TYPES = new Set(['rxDetails', 'batchExpiry', 'reprintNotice']);

/** True when a block should be offered in the designer palette. */
export const isBlockAvailable = (type: string): boolean => !HIDDEN_BLOCK_TYPES.has(type);
