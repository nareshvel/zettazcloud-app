/**
 * Template preset catalog.
 *
 * A preset is a starting point, not a constraint — everything remains editable
 * afterwards. The value is that a pharmacist should not have to discover, from a
 * blank canvas, that their receipt needs an Rx block, a drug identifier, a lot
 * number and a beyond-use date.
 *
 * COMPOSED, NOT ENUMERATED
 * ------------------------
 * Presets sit on the same three axes as the rest of the module:
 *
 *   VERTICAL × SALES MODE × DOCUMENT TYPE
 *
 * so a duty-free jeweller and a domestic jeweller share one vertical and differ
 * only in mode. Enumerating every combination would give ~100 entries; the
 * shipped set covers the combinations that actually occur in practice.
 *
 * Jurisdiction is deliberately NOT an axis here — it is resolved per store at
 * render time, so one preset works in any country.
 */

export type PresetVertical =
  | 'retail' | 'grocery' | 'pharmacy' | 'electronics' | 'apparel' | 'jewelry' | 'souvenir';

export type PresetSalesMode = 'domestic' | 'duty_free' | 'tax_refund' | 'b2b';

export interface TemplatePreset {
  id: string;
  name: string;
  /** One line explaining what makes this preset different. */
  description: string;
  vertical: PresetVertical;
  salesMode: PresetSalesMode;
  /** Maps to the backend template_type, which selects the DEFAULT_BLOCKS set. */
  templateType: string;
  paperSize: '58mm' | '80mm' | 'a4' | 'label';
  /** Blocks worth calling out — what the user gets that a blank template lacks. */
  highlights: string[];
  /** Fixture used to preview this preset: [type, name]. */
  fixture: [string, string];
  /** Applied over the template after creation (e.g. gift mode). */
  overrides?: Record<string, unknown>;
}

export const VERTICAL_LABELS: Record<PresetVertical, string> = {
  retail: 'General Retail',
  grocery: 'Grocery & Supermarket',
  pharmacy: 'Pharmacy',
  electronics: 'Electronics',
  apparel: 'Apparel & Fashion',
  jewelry: 'Jewelry & Bullion',
  souvenir: 'Souvenir & Gifts',
};

export const SALES_MODE_LABELS: Record<PresetSalesMode, string> = {
  domestic: 'Domestic',
  duty_free: 'Duty-Free',
  tax_refund: 'Tax-Free Shopping',
  b2b: 'B2B / Reverse Charge',
};

export const TEMPLATE_PRESETS: TemplatePreset[] = [
  // ── General retail ──────────────────────────────────────────────────────
  {
    id: 'retail-receipt-80',
    name: 'Retail Receipt',
    description: 'Everyday counter receipt with tax summary, loyalty and return policy.',
    vertical: 'retail', salesMode: 'domestic',
    templateType: 'receipt', paperSize: '80mm',
    highlights: ['Tax summary', 'Change due', 'Loyalty points', 'Transaction barcode'],
    fixture: ['receipt', 'retail'],
  },
  {
    id: 'retail-invoice-a4',
    name: 'Retail Invoice',
    description:
      'Logo beside the name, one band for bill-to and terms, QR to scan, and the address in a repeating page footer.',
    // Deliberately carries no serial, IMEI or warranty columns. General retail
    // previously borrowed the electronics invoice, which put fields on the page
    // that a gift shop can never populate.
    vertical: 'retail', salesMode: 'domestic',
    templateType: 'invoice', paperSize: 'a4',
    highlights: ['Ship-to only when it differs', 'QR for the customer', 'Repeating page footer', 'Payment terms / due date'],
    fixture: ['invoice', 'retail'],
  },

  {
    id: 'retail-return-80',
    name: 'Refund / Credit Note',
    description:
      'Refund slip with the original sale reference, refund method and a signature line.',
    // Every vertical refunds, so this is vertical-neutral by design.
    vertical: 'retail', salesMode: 'domestic',
    templateType: 'return', paperSize: '80mm',
    highlights: ['Original sale reference', 'Refund method', 'Customer signature', 'Scannable barcode'],
    fixture: ['return', 'retail'],
  },

  // ── Grocery ─────────────────────────────────────────────────────────────
  {
    id: 'grocery-receipt-80',
    name: 'Grocery Receipt',
    description:
      'Weighed produce with PLU codes, per-line taxable/exempt flags, and a "you saved" total.',
    vertical: 'grocery', salesMode: 'domestic',
    templateType: 'receipt', paperSize: '80mm',
    highlights: ['Weight sub-lines (1.24 kg @ rate)', 'Tax flags + legend', 'Savings total', 'Lane / txn number'],
    fixture: ['receipt', 'grocery'],
  },

  // ── Pharmacy ────────────────────────────────────────────────────────────
  {
    id: 'pharmacy-receipt-80',
    name: 'Pharmacy Receipt',
    description:
      'Prescription details, drug identifier, lot number and beyond-use date, with pharmacist sign-off.',
    vertical: 'pharmacy', salesMode: 'domestic',
    templateType: 'receipt', paperSize: '80mm',
    highlights: ['Rx number & prescriber', 'Refills remaining', 'Lot / beyond-use date', 'Exempt vs taxable split'],
    fixture: ['receipt', 'pharmacy'],
  },

  // ── Electronics ─────────────────────────────────────────────────────────
  {
    id: 'electronics-invoice-a4',
    name: 'Electronics Invoice',
    description:
      'Serial and IMEI per line, warranty terms, and an RMA return policy — what a warranty claim needs.',
    vertical: 'electronics', salesMode: 'domestic',
    templateType: 'invoice', paperSize: 'a4',
    highlights: ['Serial / IMEI capture', 'Warranty term & expiry', 'RMA return policy', 'QR + repeating page footer'],
    fixture: ['invoice', 'electronics'],
  },

  // ── Apparel ─────────────────────────────────────────────────────────────
  {
    id: 'apparel-receipt-80',
    name: 'Apparel Receipt',
    description: 'Size and colour per line, with exchange-first return wording.',
    vertical: 'apparel', salesMode: 'domestic',
    templateType: 'receipt', paperSize: '80mm',
    highlights: ['SKU / size / colour', 'Exchange-first policy', 'Transaction barcode'],
    fixture: ['receipt', 'apparel'],
  },
  {
    id: 'apparel-gift-80',
    name: 'Apparel Gift Receipt',
    description:
      'Items and quantities with every price suppressed, so the recipient can return without seeing what was paid.',
    vertical: 'apparel', salesMode: 'domestic',
    templateType: 'receipt', paperSize: '80mm',
    highlights: ['No prices anywhere', 'Scannable transaction barcode', 'Return policy'],
    fixture: ['receipt', 'apparel_gift'],
    overrides: { giftMode: true },
  },

  // ── Souvenir & Gifts ────────────────────────────────────────────────────
  {
    id: 'souvenir-receipt-80',
    name: 'Souvenir & Gifts Receipt',
    description: 'Item type per line, with final-sale/exchange-only wording common to tourist retail.',
    vertical: 'souvenir', salesMode: 'domestic',
    templateType: 'receipt', paperSize: '80mm',
    highlights: ['SKU / item type', 'Final-sale return policy', 'Transaction barcode'],
    fixture: ['receipt', 'souvenir'],
  },
  {
    id: 'souvenir-gift-80',
    name: 'Souvenir Gift Receipt',
    description:
      'Items and quantities with every price suppressed — a meaningful share of souvenir/gift purchases are themselves gifts.',
    vertical: 'souvenir', salesMode: 'domestic',
    templateType: 'receipt', paperSize: '80mm',
    highlights: ['No prices anywhere', 'Scannable transaction barcode'],
    fixture: ['receipt', 'souvenir_gift'],
    overrides: { giftMode: true },
  },

  // ── Jewelry ─────────────────────────────────────────────────────────────
  {
    id: 'jewelry-invoice-a4',
    name: 'Jewelry Invoice',
    description:
      'Purity, gross and net weight, and making charges itemised separately — as hallmarking regimes require.',
    vertical: 'jewelry', salesMode: 'domestic',
    templateType: 'jewelry_invoice', paperSize: 'a4',
    highlights: ['Purity & fineness', 'Gross / net weight', 'Making charges', 'QR + repeating page footer'],
    fixture: ['jewelry_invoice', 'domestic'],
  },
  {
    id: 'jewelry-certificate-a4',
    name: 'Certificate of Authenticity',
    description: 'Centred certificate with specification, gemstone detail and signature lines.',
    vertical: 'jewelry', salesMode: 'domestic',
    templateType: 'jewelry_certificate', paperSize: 'a4',
    highlights: ['Centred layout', 'Specification', 'Declaration', 'Signatures'],
    fixture: ['jewelry_certificate', 'domestic'],
  },
  {
    id: 'repair-ticket-a4',
    name: 'Repair Ticket',
    description: 'Compact A4 job card for repairs — item, cost summary and signatures. Used by jewelry and electronics.',
    vertical: 'jewelry', salesMode: 'domestic',
    templateType: 'repair_ticket', paperSize: 'a4',
    highlights: ['Item & repair details', 'Cost summary', 'Work details', 'Signatures'],
    fixture: ['repair_ticket', 'domestic'],
  },
  {
    id: 'old-gold-voucher-80',
    name: 'Old Gold Voucher',
    description: 'Thermal credit/cash settlement slip for old-gold exchange — metal detail, voucher value, terms.',
    vertical: 'jewelry', salesMode: 'domestic',
    templateType: 'old_gold_voucher', paperSize: '80mm',
    highlights: ['Metal & purity detail', 'Voucher value', 'Scannable barcode', 'Signatures'],
    fixture: ['old_gold_voucher', 'domestic'],
  },
  {
    id: 'memo-slip-a4',
    name: 'Consignment Memo',
    description: 'Formal A4 acknowledgement for memo in/out — itemised pieces, total value and signature lines.',
    vertical: 'jewelry', salesMode: 'domestic',
    templateType: 'memo_slip', paperSize: 'a4',
    highlights: ['Piece-level item table', 'Total value', 'Consignment terms', 'Signatures'],
    fixture: ['memo_slip', 'domestic'],
  },
  {
    id: 'layaway-agreement-a4',
    name: 'Layaway Agreement',
    description: 'Signed at plan signup — reserved items, plan summary, payment summary and signature lines.',
    vertical: 'jewelry', salesMode: 'domestic',
    templateType: 'layaway_agreement', paperSize: 'a4',
    highlights: ['Reserved items table', 'Plan & payment summary', 'Terms', 'Signatures'],
    fixture: ['layaway_agreement', 'domestic'],
  },
  {
    id: 'layaway-receipt-80',
    name: 'Layaway Payment Receipt',
    description: 'Thermal receipt issued after each instalment — amount paid and running balance.',
    vertical: 'jewelry', salesMode: 'domestic',
    templateType: 'layaway_receipt', paperSize: '80mm',
    highlights: ['Amount paid', 'Running balance', 'Payment method & reference'],
    fixture: ['layaway_receipt', 'domestic'],
  },
  {
    id: 'savings-enrollment-a4',
    name: 'Savings Passbook',
    description: 'Printed on demand — plan details, payment history and redeemable value.',
    vertical: 'jewelry', salesMode: 'domestic',
    templateType: 'savings_enrollment', paperSize: 'a4',
    highlights: ['Payment history table', 'Progress summary', 'Bonus & redeemable value', 'Signatures'],
    fixture: ['savings_enrollment', 'domestic'],
  },
  {
    id: 'order-acknowledgement-a4',
    name: 'Order Acknowledgement',
    description: 'Confirms a special/back order — items, status and totals for the customer to keep.',
    vertical: 'retail', salesMode: 'domestic',
    templateType: 'order_acknowledgement', paperSize: 'a4',
    highlights: ['Item table', 'Order status', 'Totals', 'Signatures'],
    fixture: ['order_acknowledgement', 'domestic'],
  },

  // ── Duty-free ───────────────────────────────────────────────────────────
  {
    id: 'jewelry-dutyfree-a4',
    name: 'Duty-Free Jewelry Invoice',
    description:
      'Zero-rated export sale with passport, flight and export declaration. No reprint stamp — a duplicate is invalid at customs.',
    vertical: 'jewelry', salesMode: 'duty_free',
    templateType: 'jewelry_invoice', paperSize: 'a4',
    highlights: ['Passport & flight', 'Export declaration', 'Zero-rated tax summary', 'No reprint notice'],
    fixture: ['jewelry_invoice', 'duty_free'],
    // Same clean header/parties/footer treatment as the domestic jewelry
    // invoice — QR for the customer, page footer pinned to every page.
  },
  {
    id: 'retail-dutyfree-80',
    name: 'Duty-Free Retail Receipt',
    description: 'Traveller retail receipt, zero-rated, with sealed-bag wording for liquids.',
    vertical: 'retail', salesMode: 'duty_free',
    templateType: 'receipt', paperSize: '80mm',
    highlights: ['Passport & boarding pass', 'Export declaration', 'Zero-rated'],
    fixture: ['receipt', 'duty_free'],
  },

  // ── Tax-free shopping ───────────────────────────────────────────────────
  {
    id: 'taxrefund-invoice-a4',
    name: 'Tax-Free Shopping Invoice',
    description:
      'Traveller pays tax and reclaims it on export. States the admin charge and the refund actually due.',
    vertical: 'retail', salesMode: 'tax_refund',
    templateType: 'invoice', paperSize: 'a4',
    highlights: ['Refund form reference', 'Admin charge & refund due', 'Customs validation notice'],
    fixture: ['invoice', 'tax_refund'],
  },

  // ── B2B ─────────────────────────────────────────────────────────────────
  {
    id: 'b2b-reverse-charge-a4',
    name: 'B2B Reverse-Charge Invoice',
    description:
      'Cross-border B2B where the buyer accounts for tax. Carries the prescribed wording and the buyer tax number.',
    vertical: 'retail', salesMode: 'b2b',
    templateType: 'invoice', paperSize: 'a4',
    highlights: ['Reverse-charge wording', 'Buyer tax number', 'Zero-rated with reason'],
    fixture: ['invoice', 'reverse_charge'],
  },
];

/** Presets grouped by vertical, for the gallery. */
export const presetsByVertical = (): Array<{ vertical: PresetVertical; presets: TemplatePreset[] }> => {
  const order: PresetVertical[] = ['retail', 'grocery', 'pharmacy', 'electronics', 'apparel', 'souvenir', 'jewelry'];
  return order
    .map((v) => ({ vertical: v, presets: TEMPLATE_PRESETS.filter((p) => p.vertical === v) }))
    .filter((g) => g.presets.length > 0);
};

export const findPreset = (id: string): TemplatePreset | undefined =>
  TEMPLATE_PRESETS.find((p) => p.id === id);
