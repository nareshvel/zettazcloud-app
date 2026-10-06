/**
 * Print Template Service
 * Manages print templates with structured blocks, versioning, and publishing
 */

const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Template type constants
 */
/**
 * Template type constants.
 *
 * DERIVED FROM DEFAULT_BLOCKS — see the getter below. This used to be a
 * hand-maintained object, which made it a second registry of document types
 * alongside DEFAULT_BLOCKS, the database enum, and three frontend lists.
 *
 * Adding `return` to DEFAULT_BLOCKS and the enum but not here produced
 * "Invalid template_type: return" at provisioning time — a type the renderer
 * could draw and the database would store, refused by a list nobody thought to
 * update. A document type must be addable in one place.
 *
 * The named keys are kept because callers reference TemplateType.RECEIPT, but
 * the VALUES are now generated so they cannot fall behind.
 */
const TemplateType = {
  RECEIPT: 'receipt',
  INVOICE: 'invoice',
  LABEL: 'label',
  DOCUMENT: 'document',
  JEWELRY_INVOICE: 'jewelry_invoice',
  JEWELRY_CERTIFICATE: 'jewelry_certificate',
  RETURN: 'return',
  REPAIR_TICKET: 'repair_ticket',
  OLD_GOLD_VOUCHER: 'old_gold_voucher',
  MEMO_SLIP: 'memo_slip',
  LAYAWAY_AGREEMENT: 'layaway_agreement',
  LAYAWAY_RECEIPT: 'layaway_receipt',
  SAVINGS_ENROLLMENT: 'savings_enrollment',
  ORDER_ACKNOWLEDGEMENT: 'order_acknowledgement'
};

/**
 * Every type the system can actually produce a document for.
 *
 * A type is valid precisely when DEFAULT_BLOCKS knows how to lay it out —
 * which is the honest definition. Anything else would either be unrenderable
 * or silently fall back to receipt blocks.
 */
const validTemplateTypes = () => Object.keys(DEFAULT_BLOCKS);

/**
 * Turn the `dutyFree` block visible on a block set.
 *
 * DEFAULT_BLOCKS ships it hidden — meaningless on a domestic sale. THE ONE
 * PLACE THIS TRANSFORM LIVES: templateProvisioningService applies it when
 * creating a duty-free template, and the /reset-defaults route applies it
 * when refreshing one, so a store's duty-free document doesn't lose its
 * passport/flight/destination fields the moment it picks up a new layout.
 * Written once and reused rather than copied, after the exact copy-drift
 * this codebase has been bitten by more than once already.
 */
const withDutyFreeVisible = (blocks) =>
  blocks.map((b) => (b.type === 'dutyFree' ? { ...b, visible: true } : b));

/**
 * The blocks a template should adopt when reset to its type's current
 * defaults — starting from the fresh default, but carrying forward the ONE
 * piece of state that reset has no other way to know: whether this
 * particular template's `dutyFree` block was switched on.
 *
 * Pulled out of the /reset-defaults route so the decision is unit-testable
 * without a database, and so the route stays a thin HTTP wrapper around it.
 */
const blocksForReset = (existingBlocks, freshDefaults) => {
  const existing = Array.isArray(existingBlocks) ? existingBlocks : [];
  const wasDutyFreeVisible = existing.some((b) => b?.type === 'dutyFree' && b?.visible === true);
  const fresh = JSON.parse(JSON.stringify(freshDefaults));
  return wasDutyFreeVisible ? withDutyFreeVisible(fresh) : fresh;
};

/**
 * Safely parse a JSON column value. mysql2 auto-parses JSON-typed columns into
 * JS objects/arrays already, but some code paths may still receive a raw string
 * (e.g. depending on driver/version). Handle both without throwing.
 */
const safeParseJSON = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    logger.error('Failed to parse JSON column value:', error.message);
    return null;
  }
};

/**
 * Default block definitions per template type.
 *
 * WHY THESE CARRY CONFIG
 * ----------------------
 * These used to be bare — `{ id, type, visible, order }` with no `config` at
 * all. Every configuration surface in the designer (alignment, font scale,
 * logo layout, table preset, field selection) therefore started empty, so every
 * new template rendered flat and unstyled and each user had to configure 8-12
 * blocks from scratch before their first receipt looked right.
 *
 * The defaults below encode the conventions that hold across retail:
 *   * store identity centred at the top of a thermal receipt, left on an A4 invoice
 *   * the TOTAL is the single most-read figure on the document, so it is bold
 *     and a size larger than body text
 *   * the transaction barcode encodes the receipt number so a cashier can scan
 *     it for a return instead of searching manually
 *   * table columns follow the vertical's own shape rather than a generic
 *     Item/Qty/Price that suits nobody
 *
 * A user can still change all of it — this is a sensible starting point, not a
 * constraint.
 *
 * NOTE ON JURISDICTION: nothing here hardcodes a country. Tax labels, mandatory
 * invoice titles and hallmark fields come from the jurisdiction profile at
 * render time. `mandatoryInvoiceTitle` will override a `header` block's content
 * where the law requires exact wording (AU/IN/AE).
 */

// Shared fragments -----------------------------------------------------------

/** Store identity for a thermal receipt: logo + name + contact, centred. */
const thermalStoreHeader = (order) => ({
  id: 'store_logo', type: 'logo', visible: true, order,
  label: 'Store Header',
  config: {
    logoLayout: 'logo_name_contact',
    logoContactFields: ['address', 'phone'],
    logoHeight: 12,
    align: 'center',
    paddingBottom: 4,
  },
});

/** Store identity for an A4 document: logo left, full contact block beside it. */
const documentStoreHeader = (order) => ({
  id: 'store_logo', type: 'logo', visible: true, order,
  label: 'Store Header',
  config: {
    logoLayout: 'logo_name_contact',
    logoContactFields: ['address', 'phone', 'email', 'taxId'],
    logoHeight: 18,
    align: 'left',
    paddingBottom: 6,
  },
});

/** Totals: the most-read figure on the page. */
const totalsBlock = (order, { paper = 'thermal' } = {}) => ({
  id: 'totals_section', type: 'totals', visible: true, order,
  label: 'Totals',
  config: {
    align: 'right',
    fontSize: paper === 'a4' ? 'xl' : 'lg',
    bold: true,
    paddingTop: 4,
  },
});

const barcodeBlock = (order, source = 'receiptNo') => ({
  id: 'barcode_qr', type: 'barcode', visible: true, order,
  label: 'Transaction Barcode',
  config: {
    symbology: 'code128',
    // Encoding the transaction number lets a cashier scan the receipt for a
    // return or exchange instead of looking the sale up by hand.
    barcodeSource: source,
    align: 'center',
    paddingTop: 6,
  },
});

const footerBlock = (order, lines) => ({
  id: 'footer', type: 'footer', visible: true, order,
  label: 'Footer',
  config: {
    align: 'center',
    fontSize: 'xs',
    paddingTop: 6,
    fields: lines.map((text, i) => ({ id: `f${i + 1}`, label: text })),
  },
});

/**
 * Named layout VARIANTS.
 *
 * A template type has one canonical block set in DEFAULT_BLOCKS. A variant is a
 * different arrangement of the SAME document — same type, same data, different
 * look — which a preset can opt into.
 *
 * Deliberately a separate map. DEFAULT_BLOCKS is the source of truth for which
 * template types exist (validTemplateTypes reads its keys, and seven registries
 * are checked against it), so adding a look here must not register a new type.
 *
 * A store only gets a variant by choosing the preset that names it. Nobody's
 * existing invoice is restyled underneath them.
 */
const TEMPLATE_LAYOUTS = {};

const DEFAULT_BLOCKS = {
  // -------------------------------------------------------------------------
  // RECEIPT — 80mm thermal, general retail shape
  // -------------------------------------------------------------------------
  receipt: [
    thermalStoreHeader(1),
    {
      id: 'doc_header', type: 'header', visible: true, order: 2,
      label: 'Document Header',
      config: {
        content: 'SALES RECEIPT',
        align: 'center',
        fontSize: 'base',
        bold: true,
        // No 'invoiceNumber' here, deliberately. This slip carries a scannable
        // barcode further down (barcodeBlock), which is how a cashier actually
        // identifies the sale for a return or an online lookup. Printing the
        // digits as well is noise on a 58-80mm receipt.
        //
        // A tenant that wants them can switch `show_number_on_receipt` on in
        // Settings, which adds the field back — see documentNumberVisibility.
        headerFields: ['date', 'cashier'],
        paddingBottom: 4,
      },
    },
    {
      id: 'items_table', type: 'table', visible: true, order: 3,
      label: 'Items',
      config: {
        tablePreset: 'general',
        tableShowHeader: true,
        tableCompact: true,
        fontSize: 'sm',
        // Weighed produce/deli prints "1.24 kg @ $3.99/kg" beneath the item so
        // the customer can verify the scale. Harmless on non-weighed lines —
        // the sub-line only appears when weight AND rate are both present.
        weighedItemMode: true,
        // Marks each line taxable/exempt with a decoding legend. Essential
        // wherever basic food is exempt but prepared food is taxed in the same
        // basket; the column is dropped automatically if the data has no flags.
        tableTaxFlagColumn: true,
        fields: [
          { id: 'name', label: 'Item', accessor: 'name' },
          { id: 'qty', label: 'Qty', accessor: 'qty' },
          { id: 'unitPrice', label: 'Price', accessor: 'unitPrice' },
          { id: 'lineTotal', label: 'Amount', accessor: 'lineTotal' },
        ],
      },
    },
    {
      id: 'tax_section', type: 'taxSummary', visible: true, order: 4,
      label: 'Tax Summary',
      config: {
        align: 'right', fontSize: 'sm',
        // Exempt lines matter on a receipt: many jurisdictions exempt basic
        // food while taxing prepared food and non-food in the same basket.
        showExemptLines: true,
        showTaxableAmount: false,   // too wide for 58/80mm
        showTaxTotal: true,
        showReverseChargeNotice: true,
      },
    },
    totalsBlock(5),
    {
      id: 'savings_section', type: 'savings', visible: true, order: 6,
      label: 'Savings',
      // Renders nothing unless the sale carried coupons, so it is safe to leave
      // on for verticals that never discount.
      config: { align: 'right', fontSize: 'sm', showCouponLines: true, paddingTop: 2 },
    },
    {
      id: 'payment_section', type: 'payment', visible: true, order: 7,
      label: 'Payment',
      config: { align: 'right', fontSize: 'sm', paddingTop: 2 },
    },
    {
      id: 'change_due', type: 'changeDue', visible: true, order: 8,
      label: 'Tendered / Change',
      // Cash only — the block self-suppresses on card sales.
      config: { align: 'right', fontSize: 'sm' },
    },
    {
      id: 'loyalty_section', type: 'loyalty', visible: true, order: 9,
      label: 'Loyalty',
      config: { align: 'right', fontSize: 'xs', showPointsBalance: true, paddingTop: 2 },
    },
    {
      id: 'return_policy', type: 'returnPolicy', visible: true, order: 10,
      label: 'Return Policy',
      config: { align: 'center', fontSize: 'xs', showReturnWindow: true, paddingTop: 4 },
    },
    barcodeBlock(11, 'receiptNo'),
    footerBlock(12, [
      'Thank you for your purchase!',
      'Exchange within 30 days with receipt.',
    ]),
  ],

  // -------------------------------------------------------------------------
  // RETURN — refund / credit note, thermal
  // -------------------------------------------------------------------------
  // Shaped like a receipt because that is what it is: a slip handed across the
  // counter. The differences are the ones that matter for a refund.
  //
  //   * the number IS shown. A credit note nobody can reference is not usable,
  //     so unlike a sales receipt this is not left to the barcode.
  //   * the original sale's reference is printed, because tying the refund to
  //     what it reverses is the one thing this document must do.
  //   * no loyalty, no savings, no return policy — none apply to a refund, and
  //     "Exchange within 30 days" on a refund slip is actively confusing.
  //   * amounts are POSITIVE. The title carries the direction; see
  //     returnToPrintData for why a minus sign here is a mistake.
  // -------------------------------------------------------------------------
  return: [
    thermalStoreHeader(1),
    {
      id: 'doc_header', type: 'header', visible: true, order: 2,
      label: 'Document Header',
      config: {
        content: 'REFUND / CREDIT NOTE',
        align: 'center',
        fontSize: 'base',
        bold: true,
        headerFields: ['invoiceNumber', 'date', 'cashier'],
        numberLabel: 'Refund No.',
        paddingBottom: 4,
      },
    },
    {
      id: 'original_sale', type: 'custom', visible: true, order: 3,
      label: 'Original Sale',
      // The audit trail. Without it a refund cannot be matched to a sale.
      // A `custom` block renders its fields as label/value rows, and the
      // renderer resolves `originalDocumentNumber` from the return data.
      config: {
        align: 'center', fontSize: 'xs', paddingBottom: 2,
        fields: [
          { id: 'orig', label: 'Original Sale', accessor: 'originalDocumentNumber' },
        ],
      },
    },
    {
      id: 'items_table', type: 'table', visible: true, order: 4,
      label: 'Returned Items',
      config: {
        tablePreset: 'general',
        tableShowHeader: true,
        tableCompact: true,
        fontSize: 'sm',
        fields: [
          { id: 'name', label: 'Item', accessor: 'name' },
          { id: 'qty', label: 'Qty', accessor: 'qty' },
          { id: 'unitPrice', label: 'Price', accessor: 'unitPrice' },
          { id: 'lineTotal', label: 'Refund', accessor: 'lineTotal' },
        ],
      },
    },
    {
      id: 'tax_section', type: 'taxSummary', visible: true, order: 5,
      label: 'Tax Refunded',
      config: {
        align: 'right', fontSize: 'sm',
        showExemptLines: true,
        showTaxableAmount: false,
        showTaxTotal: true,
      },
    },
    totalsBlock(6),
    {
      id: 'payment_section', type: 'payment', visible: true, order: 7,
      label: 'Refund Method',
      config: { align: 'right', fontSize: 'sm', paddingTop: 2 },
    },
    {
      id: 'signature', type: 'signatures', visible: true, order: 8,
      label: 'Customer Signature',
      // A refund moves money out of the till. Many operators require the
      // customer to sign for it, and the line is easier to leave visible and
      // unused than to discover missing after the fact.
      config: { align: 'left', fontSize: 'xs', paddingTop: 6 },
    },
    barcodeBlock(9, 'receiptNo'),
    footerBlock(10, [
      'Refund processed. Please retain this slip.',
    ]),
  ],

  // -------------------------------------------------------------------------
  // INVOICE — A4, B2B shape with addresses and terms
  // -------------------------------------------------------------------------
  //
  // The clean A4 look — logo+name inline, a parties band instead of stacked
  // address blocks, a QR code rather than a linear barcode, and a page footer
  // (address, contact, tax number) pinned to the bottom of every printed page.
  // Originally shipped as an opt-in "Invoice (Clean)" alternate; promoted to
  // the default here once it had proven itself, rather than leaving two
  // near-identical invoice documents in every store's template list.
  //
  invoice: [
    {
      id: 'store_logo', type: 'logo', visible: true, order: 1,
      label: 'Logo & Name',
      config: { logoLayout: 'logo_name_inline', logoHeight: 12, align: 'left' },
    },
    {
      id: 'invoice_header', type: 'header', visible: true, order: 2,
      label: 'Invoice Header',
      // Content left blank: where a jurisdiction mandates exact wording (AU/IN/AE
      // require the literal words "TAX INVOICE"), the profile supplies it.
      config: {
        content: '',
        align: 'right',
        fontSize: 'xl',
        bold: true,
        headerFields: ['invoiceNumber', 'date'],
        paddingBottom: 6,
      },
    },
    {
      id: 'parties', type: 'parties', visible: true, order: 3,
      label: 'Bill To / Ship To / Details',
      // Ship to only when it differs from billing — most retail has no
      // separate delivery address, and repeating it is noise on every
      // counter sale. Details carries terms, due date and PO.
      config: { showDetails: true, alwaysShowShipTo: false, fontSize: 'sm', paddingBottom: 6 },
    },
    {
      id: 'items_table', type: 'table', visible: true, order: 4,
      label: 'Items',
      config: {
        tablePreset: 'general',
        tableShowHeader: true,
        fontSize: 'sm',
        fields: [
          { id: 'name', label: 'Description', accessor: 'name' },
          { id: 'qty', label: 'Qty', accessor: 'qty' },
          { id: 'unitPrice', label: 'Unit Price', accessor: 'unitPrice' },
          { id: 'lineTotal', label: 'Amount', accessor: 'lineTotal' },
        ],
      },
    },
    {
      id: 'tax_section', type: 'taxSummary', visible: true, order: 5,
      label: 'Tax Summary',
      config: {
        align: 'right', fontSize: 'sm', paddingTop: 4,
        showExemptLines: true,
        showTaxableAmount: true,    // A4 has room for the taxable base
        showTaxTotal: true,
        showReverseChargeNotice: true,
      },
    },
    totalsBlock(6, { paper: 'a4' }),
    {
      id: 'payment_section', type: 'payment', visible: true, order: 7,
      label: 'Payment',
      config: { align: 'right', fontSize: 'sm', paddingTop: 2 },
    },
    {
      id: 'serial_capture', type: 'serialCapture', visible: true, order: 8,
      label: 'Serial / IMEI',
      // Self-suppresses when no line carries a serial, so it is harmless on
      // non-serialised invoices (general retail never shows it).
      config: { align: 'left', fontSize: 'xs', showImei: true, paddingTop: 6 },
    },
    {
      id: 'warranty_section', type: 'warranty', visible: true, order: 9,
      label: 'Warranty',
      config: { align: 'left', fontSize: 'xs', showWarrantyExpiry: true, paddingTop: 2 },
    },
    {
      id: 'return_policy', type: 'returnPolicy', visible: true, order: 10,
      label: 'Return Policy',
      config: { align: 'left', fontSize: 'xs', showReturnWindow: true, showRestockingFee: true, paddingTop: 6 },
    },
    {
      id: 'barcode_qr', type: 'barcode', visible: true, order: 11,
      label: 'QR Code',
      // This document goes to a CUSTOMER, who scans it with a phone — a QR,
      // not the Code 128 the thermal receipt carries for the cashier's 1D
      // scanner. Encodes the document number today; a public invoice URL can
      // be swapped in later without touching the layout.
      config: { symbology: 'qr', barcodeSource: 'invoiceNo', align: 'left', paddingTop: 6 },
    },
    {
      id: 'payment_terms', type: 'terms', visible: true, order: 12,
      label: 'Terms',
      config: { align: 'left', fontSize: 'xs', paddingTop: 4 },
    },
    {
      id: 'page_footer', type: 'pageFooter', visible: true, order: 13,
      label: 'Page Footer',
      // Repeats on every printed page — see buildPageFooter. A footer only on
      // the last page of a multi-page invoice leaves page one non-compliant
      // on its own in most VAT/GST jurisdictions.
      config: { footerFields: ['address', 'phone', 'email', 'taxId'] },
    },
  ],

  // -------------------------------------------------------------------------
  // JEWELRY INVOICE — A4, purity / weight / making charges itemised
  // -------------------------------------------------------------------------
  //
  // Same clean layout decisions as `invoice` (logo+name inline, parties band,
  // QR, pinned page footer), with the jewelry-specific weight/purity/hallmark
  // itemisation, duty-free traveller capture and compliance blocks preserved
  // exactly as they were — the redesign is about the header/parties/footer
  // arrangement, not the vertical's own item shape.
  //
  jewelry_invoice: [
    {
      id: 'store_logo', type: 'logo', visible: true, order: 1,
      label: 'Logo & Name',
      config: { logoLayout: 'logo_name_inline', logoHeight: 12, align: 'left' },
    },
    {
      id: 'invoice_header', type: 'header', visible: true, order: 2,
      label: 'Invoice Header',
      config: {
        content: '',
        align: 'right',
        fontSize: 'xl',
        bold: true,
        headerFields: ['invoiceNumber', 'date', 'cashier'],
        paddingBottom: 6,
      },
    },
    {
      id: 'parties', type: 'parties', visible: true, order: 3,
      label: 'Bill To / Ship To / Details',
      config: { showDetails: true, alwaysShowShipTo: false, fontSize: 'sm', paddingBottom: 6 },
    },
    {
      id: 'duty_free', type: 'dutyFree', visible: false, order: 4,
      label: 'Duty-Free / Export',
      // Off by default: only meaningful when the store sells duty-free. The
      // duty-free plan entry (retailProfileService) switches this on — the
      // renderer omits it if no traveller details are present either way.
      //
      // This block carries traveller identification only — NOT the legal
      // export declaration text. That varies tenant to tenant and country to
      // country, so it lives in the `compliance` block below instead of
      // being hardcoded/toggled here. travellerIdType/travelMethodType pick
      // the label shown ("Passport" vs "National ID" vs "Seaman's Book";
      // "Flight" vs "Vessel") — not every duty-free traveller flies in on a
      // passport, e.g. Caribbean cruise-ship traffic.
      config: {
        align: 'left', fontSize: 'sm', paddingBottom: 6,
        dutyFreeFields: ['travellerId', 'travelMethod', 'destination', 'departureDate'],
        travellerIdType: 'passport',
        travelMethodType: 'flight',
      },
    },
    {
      id: 'items_table', type: 'table', visible: true, order: 5,
      label: 'Items',
      config: {
        tablePreset: 'jewelry',
        tableShowHeader: true,
        fontSize: 'sm',
        // Where hallmarking applies the invoice must separately itemise
        // description, net precious-metal weight, purity, and hallmark charges.
        fields: [
          { id: 'name', label: 'Item', accessor: 'name' },
          { id: 'purity', label: 'Purity', accessor: 'purity' },
          { id: 'grossWeight', label: 'Gross Wt', accessor: 'grossWeight' },
          { id: 'netWeight', label: 'Net Wt', accessor: 'netWeight' },
          { id: 'makingCharge', label: 'Making', accessor: 'makingCharge' },
          { id: 'amount', label: 'Amount', accessor: 'amount' },
        ],
      },
    },
    {
      id: 'purity_weight', type: 'purity', visible: true, order: 6,
      label: 'Purity & Weight',
      config: { align: 'left', fontSize: 'sm', paddingTop: 4 },
    },
    {
      id: 'gemstones', type: 'gemstones', visible: true, order: 7,
      label: 'Gemstones',
      config: { align: 'left', fontSize: 'sm' },
    },
    {
      id: 'tax_section', type: 'taxSummary', visible: true, order: 8,
      label: 'Tax Summary',
      config: {
        align: 'right', fontSize: 'sm', paddingTop: 4,
        showExemptLines: true,
        showTaxableAmount: true,
        showTaxTotal: true,
        showReverseChargeNotice: true,
      },
    },
    totalsBlock(9, { paper: 'a4' }),
    {
      id: 'payment_section', type: 'payment', visible: true, order: 10,
      label: 'Payment',
      config: { align: 'right', fontSize: 'sm', paddingTop: 2 },
    },
    {
      id: 'compliance', type: 'compliance', visible: true, order: 11,
      label: 'Compliance',
      // Left empty deliberately. Hallmark/HUID declarations are jurisdiction
      // specific (BIS in India); Antigua has no equivalent mandate. The text
      // must come from the jurisdiction profile, never be hardcoded. On a
      // duty-free/export sale this is also where the export declaration
      // ("goods must leave the territory") text prints — see the dutyFree
      // block above for why it isn't printed there instead.
      config: { align: 'left', fontSize: 'fine', paddingTop: 8 },
    },
    {
      id: 'barcode_qr', type: 'barcode', visible: true, order: 12,
      label: 'QR Code',
      // A QR, not the Code 128 a thermal receipt carries — this document goes
      // to the customer, who scans it with a phone rather than a counter
      // laser scanner.
      config: { symbology: 'qr', barcodeSource: 'invoiceNo', align: 'left', paddingTop: 6 },
    },
    {
      id: 'terms_signatures', type: 'signatures', visible: true, order: 13,
      label: 'Signatures',
      config: { align: 'left', paddingTop: 12 },
    },
    {
      id: 'page_footer', type: 'pageFooter', visible: true, order: 14,
      label: 'Page Footer',
      // The jewelry invoice previously had no page-level footer at all, so a
      // multi-page invoice carried the seller's address and tax number on
      // whichever page the block happened to fall on — usually only the
      // first. Pinned to every page now, same as `invoice`.
      config: { footerFields: ['address', 'phone', 'email', 'taxId'] },
    },
  ],

  // -------------------------------------------------------------------------
  // JEWELRY CERTIFICATE
  // -------------------------------------------------------------------------
  jewelry_certificate: [
    documentStoreHeader(1),
    {
      id: 'cert_header', type: 'header', visible: true, order: 2,
      label: 'Certificate Header',
      config: {
        content: 'CERTIFICATE OF AUTHENTICITY',
        align: 'center',
        fontSize: 'title',
        bold: true,
        headerFields: ['invoiceNumber', 'date'],
        paddingBottom: 10,
      },
    },
    {
      id: 'customer_details', type: 'customer', visible: true, order: 3,
      label: 'Issued To',
      config: { align: 'center', fontSize: 'base', customerFields: ['name'], paddingBottom: 8 },
    },
    {
      id: 'purity_weight', type: 'purity', visible: true, order: 4,
      label: 'Specification',
      config: { align: 'center', fontSize: 'base' },
    },
    {
      id: 'gemstones', type: 'gemstones', visible: true, order: 5,
      label: 'Gemstone Detail',
      config: { align: 'center', fontSize: 'sm', paddingTop: 4 },
    },
    {
      id: 'compliance', type: 'compliance', visible: true, order: 6,
      label: 'Declaration',
      config: { align: 'center', fontSize: 'fine', paddingTop: 10 },
    },
    {
      id: 'terms_signatures', type: 'signatures', visible: true, order: 7,
      label: 'Signatures',
      config: { align: 'center', paddingTop: 16 },
    },
  ],

  // -------------------------------------------------------------------------
  // REPAIR TICKET — A4 job card, printed at intake and again at collection.
  //
  // Composed entirely from existing generic block types (header/customer/
  // custom/terms/signatures/footer) rather than inventing repair-specific
  // ones — the same `custom` label/value block that a refund slip uses for
  // "Original Sale" is exactly the right shape for "Ticket #", "Estimated
  // Cost", "Balance Due", etc. See repairToPrintData.ts (frontend) for the
  // field names each `accessor` below resolves against.
  // -------------------------------------------------------------------------
  repair_ticket: [
    documentStoreHeader(1),
    {
      id: 'doc_header', type: 'header', visible: true, order: 2,
      label: 'Document Header',
      config: {
        content: 'REPAIR JOB CARD',
        numberLabel: 'Ticket No.',
        headerFields: ['invoiceNumber', 'date'],
        fontSize: 'title',
        bold: true,
        paddingBottom: 6,
      },
    },
    {
      id: 'customer_details', type: 'customer', visible: true, order: 3,
      label: 'Customer',
      config: { align: 'left', fontSize: 'sm', customerFields: ['name', 'phone', 'email'], paddingBottom: 6 },
    },
    {
      id: 'item_details', type: 'custom', visible: true, order: 4,
      label: 'Item & Repair Details',
      config: {
        fontSize: 'sm', paddingBottom: 6,
        fields: [
          { id: 'item', label: 'Item', accessor: 'itemDescription' },
          { id: 'metal', label: 'Metal / Weight', accessor: 'metalWeightDisplay' },
          { id: 'promised', label: 'Promise Date', accessor: 'promisedDateDisplay' },
        ],
      },
    },
    {
      id: 'cost_summary', type: 'custom', visible: true, order: 5,
      label: 'Cost Summary',
      config: {
        fontSize: 'sm', bold: true, paddingBottom: 6,
        fields: [
          { id: 'estimated', label: 'Estimated Cost', accessor: 'estimatedCostDisplay' },
          { id: 'advance', label: 'Advance Paid', accessor: 'advancePaidDisplay' },
          { id: 'balance', label: 'Balance Due', accessor: 'balanceDueDisplay' },
          { id: 'status', label: 'Status', accessor: 'statusLabel' },
        ],
      },
    },
    {
      id: 'work_details', type: 'custom', visible: true, order: 6,
      label: 'Work Details',
      config: {
        fontSize: 'sm', paddingBottom: 6,
        fields: [
          { id: 'problem', label: 'Problem Description', accessor: 'problemDescription' },
          { id: 'work', label: 'Work Required', accessor: 'workRequired' },
          { id: 'notes', label: 'Notes / Condition', accessor: 'repairNotes' },
        ],
      },
    },
    {
      id: 'terms', type: 'terms', visible: true, order: 7,
      label: 'Terms',
      config: {
        fontSize: 'fine', paddingBottom: 4,
        content: 'Items uncollected after 60 days may be disposed of. Store is not liable for pre-existing '
          + 'defects not noted here. Final cost may vary; customer will be informed before work. Advance is '
          + 'non-refundable if customer cancels after work starts. Present this card to collect your item.',
      },
    },
    {
      id: 'signatures', type: 'signatures', visible: true, order: 8,
      label: 'Signatures',
      config: { paddingTop: 4 },
    },
  ],

  // -------------------------------------------------------------------------
  // OLD GOLD VOUCHER — 80mm thermal, credit/cash settlement slip
  // -------------------------------------------------------------------------
  old_gold_voucher: [
    thermalStoreHeader(1),
    {
      id: 'doc_header', type: 'header', visible: true, order: 2,
      label: 'Document Header',
      config: {
        content: 'OLD GOLD VOUCHER', numberLabel: 'Voucher No.',
        headerFields: ['invoiceNumber', 'date'], align: 'center', fontSize: 'base', bold: true, paddingBottom: 4,
      },
    },
    {
      id: 'customer_details', type: 'customer', visible: true, order: 3,
      label: 'Customer',
      config: { align: 'left', fontSize: 'sm', customerFields: ['name', 'phone'], paddingBottom: 4 },
    },
    {
      id: 'metal_details', type: 'custom', visible: true, order: 4,
      label: 'Metal Details',
      config: {
        fontSize: 'sm', paddingBottom: 4,
        fields: [
          { id: 'item', label: 'Item', accessor: 'itemDescription' },
          { id: 'metal', label: 'Metal', accessor: 'metal' },
          { id: 'purity', label: 'Purity', accessor: 'purityDisplay' },
          { id: 'gross', label: 'Gross Weight', accessor: 'grossWeightDisplay' },
          { id: 'net', label: 'Net Weight', accessor: 'netWeightDisplay' },
          { id: 'rate', label: 'Rate / g', accessor: 'ratePerGramDisplay' },
        ],
      },
    },
    {
      id: 'voucher_value', type: 'custom', visible: true, order: 5,
      label: 'Voucher Value',
      config: {
        fontSize: 'base', bold: true, paddingBottom: 4,
        fields: [
          { id: 'value', label: 'Voucher Value', accessor: 'valuationDisplay' },
          { id: 'type', label: 'Settlement', accessor: 'settlementDisplay' },
        ],
      },
    },
    barcodeBlock(6, 'receiptNo'),
    {
      id: 'terms', type: 'terms', visible: true, order: 7,
      label: 'Terms',
      config: {
        fontSize: 'fine', align: 'center', paddingBottom: 4,
        content: 'Redeemable only at this store. Non-transferable and cannot be exchanged for cash. '
          + 'Present this voucher at time of purchase. Store reserves the right to verify authenticity.',
      },
    },
    {
      id: 'signatures', type: 'signatures', visible: true, order: 8,
      label: 'Signatures',
      config: { paddingTop: 4 },
    },
  ],

  // -------------------------------------------------------------------------
  // MEMO SLIP — A4 consignment acknowledgement (memo in / memo out)
  // -------------------------------------------------------------------------
  memo_slip: [
    documentStoreHeader(1),
    {
      id: 'doc_header', type: 'header', visible: true, order: 2,
      label: 'Document Header',
      config: {
        content: 'CONSIGNMENT MEMO', numberLabel: 'Memo No.',
        headerFields: ['invoiceNumber', 'date'], fontSize: 'title', bold: true, paddingBottom: 6,
      },
    },
    {
      id: 'memo_details', type: 'custom', visible: true, order: 3,
      label: 'Memo Details',
      config: {
        fontSize: 'sm', paddingBottom: 6,
        fields: [
          { id: 'direction', label: 'Type', accessor: 'directionLabel' },
          { id: 'due', label: 'Due Date', accessor: 'dueDateDisplay' },
        ],
      },
    },
    {
      id: 'party_details', type: 'customer', visible: true, order: 4,
      label: 'Party',
      config: { align: 'left', fontSize: 'sm', customerFields: ['name', 'phone', 'email'], paddingBottom: 6 },
    },
    {
      id: 'items_table', type: 'table', visible: true, order: 5,
      label: 'Items',
      config: {
        tablePreset: 'jewelry', tableShowHeader: true, tableZebra: true, fontSize: 'sm',
        fields: [
          { id: 'pieceCode', label: 'Piece Code', accessor: 'pieceCode' },
          { id: 'description', label: 'Description', accessor: 'description' },
          { id: 'purity', label: 'Purity', accessor: 'purity' },
          { id: 'grossWeight', label: 'Gross Wt', accessor: 'grossWeight' },
          { id: 'qty', label: 'Qty', accessor: 'qty' },
          { id: 'unitPrice', label: 'Unit Value', accessor: 'unitPrice' },
          { id: 'lineTotal', label: 'Line Value', accessor: 'lineTotal' },
        ],
      },
    },
    {
      id: 'total_value', type: 'custom', visible: true, order: 6,
      label: 'Total',
      config: {
        align: 'right', fontSize: 'lg', bold: true, paddingTop: 4, paddingBottom: 4,
        fields: [
          { id: 'total', label: 'Total Value', accessor: 'totalValueDisplay' },
        ],
      },
    },
    {
      id: 'terms', type: 'terms', visible: true, order: 7,
      label: 'Terms',
      config: {
        fontSize: 'fine', paddingBottom: 4,
        content: 'These items are issued on memo/consignment basis. Title remains with the issuer until '
          + 'confirmed sold or purchased. All items must be returned in original condition if not sold or retained.',
      },
    },
    {
      id: 'signatures', type: 'signatures', visible: true, order: 8,
      label: 'Signatures',
      config: { paddingTop: 4 },
    },
  ],

  // -------------------------------------------------------------------------
  // LAYAWAY AGREEMENT — A4, signed at plan signup
  // -------------------------------------------------------------------------
  layaway_agreement: [
    documentStoreHeader(1),
    {
      id: 'doc_header', type: 'header', visible: true, order: 2,
      label: 'Document Header',
      config: {
        content: 'LAYAWAY AGREEMENT', numberLabel: 'Plan No.',
        headerFields: ['invoiceNumber', 'date'], fontSize: 'title', bold: true, paddingBottom: 6,
      },
    },
    {
      id: 'customer_details', type: 'customer', visible: true, order: 3,
      label: 'Customer',
      config: { align: 'left', fontSize: 'sm', customerFields: ['name', 'phone', 'email'], paddingBottom: 6 },
    },
    {
      id: 'plan_summary', type: 'custom', visible: true, order: 4,
      label: 'Plan Summary',
      config: {
        fontSize: 'sm', paddingBottom: 6,
        fields: [
          { id: 'schedule', label: 'Schedule', accessor: 'scheduleDisplay' },
          { id: 'start', label: 'Start Date', accessor: 'startDateDisplay' },
          { id: 'due', label: 'Due Date', accessor: 'dueDateDisplay' },
          { id: 'each', label: 'Each Instalment', accessor: 'installmentAmountDisplay' },
          { id: 'status', label: 'Status', accessor: 'statusLabel' },
        ],
      },
    },
    {
      id: 'items_table', type: 'table', visible: true, order: 5,
      label: 'Reserved Items',
      config: {
        tablePreset: 'jewelry', tableShowHeader: true, tableZebra: true, fontSize: 'sm',
        fields: [
          { id: 'description', label: 'Description', accessor: 'description' },
          { id: 'qty', label: 'Qty', accessor: 'qty' },
          { id: 'unitPrice', label: 'Price', accessor: 'unitPrice' },
          { id: 'lineTotal', label: 'Total', accessor: 'lineTotal' },
        ],
      },
    },
    {
      id: 'payment_summary', type: 'custom', visible: true, order: 6,
      label: 'Payment Summary',
      config: {
        fontSize: 'sm', bold: true, paddingTop: 4, paddingBottom: 6,
        fields: [
          { id: 'total', label: 'Plan Total', accessor: 'totalAmountDisplay' },
          { id: 'down', label: 'Down Payment', accessor: 'downPaymentDisplay' },
          { id: 'paid', label: 'Total Paid', accessor: 'paidAmountDisplay' },
          { id: 'balance', label: 'Balance Due', accessor: 'balanceDisplay' },
        ],
      },
    },
    {
      id: 'terms', type: 'terms', visible: true, order: 7,
      label: 'Terms',
      config: {
        fontSize: 'fine', paddingBottom: 4,
        content: 'Reserved items are held until the due date or full payment, whichever comes first. '
          + 'Instalments are due on scheduled dates; late payments may attract a penalty. Items are released only '
          + 'upon full payment; no exchanges once the plan is active. Cancellations attract a processing fee, with '
          + 'the balance refunded after deduction. The store may cancel the plan after 30 days of non-payment.',
      },
    },
    {
      id: 'signatures', type: 'signatures', visible: true, order: 8,
      label: 'Signatures',
      config: { paddingTop: 4 },
    },
  ],

  // -------------------------------------------------------------------------
  // LAYAWAY PAYMENT RECEIPT — 80mm thermal, issued after each instalment
  // -------------------------------------------------------------------------
  layaway_receipt: [
    thermalStoreHeader(1),
    {
      id: 'doc_header', type: 'header', visible: true, order: 2,
      label: 'Document Header',
      config: {
        content: 'PAYMENT RECEIPT', numberLabel: 'Plan No.',
        headerFields: ['invoiceNumber', 'date'], align: 'center', fontSize: 'base', bold: true, paddingBottom: 4,
      },
    },
    {
      id: 'customer_details', type: 'customer', visible: true, order: 3,
      label: 'Customer',
      config: { align: 'left', fontSize: 'sm', customerFields: ['name', 'phone'], paddingBottom: 4 },
    },
    {
      id: 'payment_details', type: 'custom', visible: true, order: 4,
      label: 'Payment',
      config: {
        fontSize: 'sm', paddingBottom: 4,
        fields: [
          { id: 'method', label: 'Payment Method', accessor: 'paymentMethodDisplay' },
          { id: 'reference', label: 'Reference', accessor: 'reference' },
          { id: 'amount', label: 'Amount Paid', accessor: 'paymentAmountDisplay' },
        ],
      },
    },
    {
      id: 'balance_summary', type: 'custom', visible: true, order: 5,
      label: 'Balance',
      config: {
        fontSize: 'sm', bold: true, paddingBottom: 4,
        fields: [
          { id: 'total', label: 'Total Amount', accessor: 'totalAmountDisplay' },
          { id: 'prev', label: 'Previously Paid', accessor: 'previouslyPaidDisplay' },
          { id: 'this', label: 'This Payment', accessor: 'paymentAmountDisplay' },
          { id: 'balance', label: 'Balance Due', accessor: 'newBalanceDisplay' },
        ],
      },
    },
    footerBlock(6, ['Thank you for your payment!', 'Items held until full payment received.']),
  ],

  // -------------------------------------------------------------------------
  // SAVINGS ENROLLMENT — A4 passbook, printed on demand
  // -------------------------------------------------------------------------
  savings_enrollment: [
    documentStoreHeader(1),
    {
      id: 'doc_header', type: 'header', visible: true, order: 2,
      label: 'Document Header',
      config: {
        content: 'SAVINGS SCHEME PASSBOOK', numberLabel: 'Enrollment No.',
        headerFields: ['invoiceNumber', 'date'], fontSize: 'title', bold: true, paddingBottom: 6,
      },
    },
    {
      id: 'plan_details', type: 'custom', visible: true, order: 3,
      label: 'Plan Details',
      config: {
        fontSize: 'sm', paddingBottom: 6,
        fields: [
          { id: 'plan', label: 'Plan', accessor: 'planName' },
          { id: 'start', label: 'Start Date', accessor: 'startDateDisplay' },
          { id: 'maturity', label: 'Maturity Date', accessor: 'maturityDateDisplay' },
          { id: 'status', label: 'Status', accessor: 'statusLabel' },
        ],
      },
    },
    {
      id: 'customer_details', type: 'customer', visible: true, order: 4,
      label: 'Customer',
      config: { align: 'left', fontSize: 'sm', customerFields: ['name', 'phone'], paddingBottom: 6 },
    },
    {
      id: 'progress', type: 'custom', visible: true, order: 5,
      label: 'Progress',
      config: {
        fontSize: 'sm', paddingBottom: 6,
        fields: [
          { id: 'progress', label: 'Progress', accessor: 'progressDisplay' },
          { id: 'collected', label: 'Collected', accessor: 'totalPaidDisplay' },
        ],
      },
    },
    {
      id: 'payments_table', type: 'table', visible: true, order: 6,
      label: 'Payment History',
      config: {
        tablePreset: 'general', tableShowHeader: true, tableZebra: true, fontSize: 'sm',
        fields: [
          { id: 'no', label: '#', accessor: 'no' },
          { id: 'date', label: 'Date', accessor: 'dateDisplay' },
          { id: 'amount', label: 'Amount', accessor: 'amount' },
          { id: 'method', label: 'Method', accessor: 'method' },
          { id: 'reference', label: 'Reference', accessor: 'reference' },
        ],
      },
    },
    {
      id: 'summary', type: 'custom', visible: true, order: 7,
      label: 'Summary',
      config: {
        fontSize: 'base', bold: true, paddingTop: 4, paddingBottom: 6,
        fields: [
          { id: 'total', label: 'Total Paid', accessor: 'totalPaidDisplay' },
          { id: 'bonus', label: 'Bonus', accessor: 'bonusDisplay' },
          { id: 'redeemable', label: 'Redeemable Value', accessor: 'redeemableValueDisplay' },
        ],
      },
    },
    {
      id: 'signatures', type: 'signatures', visible: true, order: 8,
      label: 'Signatures',
      config: { paddingTop: 4 },
    },
  ],

  // -------------------------------------------------------------------------
  // ORDER ACKNOWLEDGEMENT — A4, special/back order confirmation
  // -------------------------------------------------------------------------
  order_acknowledgement: [
    documentStoreHeader(1),
    {
      id: 'doc_header', type: 'header', visible: true, order: 2,
      label: 'Document Header',
      config: {
        content: 'ORDER ACKNOWLEDGEMENT', numberLabel: 'Order No.',
        headerFields: ['invoiceNumber', 'date'], fontSize: 'title', bold: true, paddingBottom: 6,
      },
    },
    {
      id: 'customer_details', type: 'customer', visible: true, order: 3,
      label: 'Customer',
      config: { align: 'left', fontSize: 'sm', customerFields: ['name', 'phone', 'email'], paddingBottom: 6 },
    },
    {
      id: 'order_details', type: 'custom', visible: true, order: 4,
      label: 'Order Details',
      config: {
        fontSize: 'sm', paddingBottom: 6,
        fields: [
          { id: 'status', label: 'Status', accessor: 'statusLabel' },
        ],
      },
    },
    {
      id: 'items_table', type: 'table', visible: true, order: 5,
      label: 'Items',
      config: {
        tablePreset: 'general', tableShowHeader: true, tableZebra: true, fontSize: 'sm',
        fields: [
          { id: 'name', label: 'Item', accessor: 'name' },
          { id: 'qty', label: 'Qty', accessor: 'qty' },
          { id: 'unitPrice', label: 'Unit Price', accessor: 'unitPrice' },
          { id: 'lineTotal', label: 'Total', accessor: 'lineTotal' },
        ],
      },
    },
    totalsBlock(6, { paper: 'a4' }),
    {
      id: 'order_notes', type: 'custom', visible: true, order: 7,
      label: 'Notes',
      config: {
        fontSize: 'sm', paddingTop: 4, paddingBottom: 4,
        fields: [
          { id: 'notes', label: 'Notes', accessor: 'notes' },
        ],
      },
    },
    {
      id: 'signatures', type: 'signatures', visible: true, order: 8,
      label: 'Signatures',
      config: { paddingTop: 4 },
    },
  ],

  // -------------------------------------------------------------------------
  // LABEL — small format, price and barcode dominate
  // -------------------------------------------------------------------------
  label: [
    {
      id: 'store_name', type: 'text', visible: true, order: 1,
      label: 'Store Name',
      config: { align: 'center', fontSize: 'fine', storeFields: ['name'] },
    },
    {
      id: 'product_name', type: 'text', visible: true, order: 2,
      label: 'Product Name',
      config: { align: 'center', fontSize: 'xs', bold: true },
    },
    {
      id: 'attributes', type: 'attributes', visible: true, order: 3,
      label: 'Attributes',
      config: { align: 'center', fontSize: 'fine' },
    },
    {
      id: 'price', type: 'price', visible: true, order: 4,
      label: 'Price',
      config: { align: 'center', fontSize: 'lg', bold: true },
    },
    {
      id: 'barcode', type: 'barcode', visible: true, order: 5,
      label: 'Barcode',
      config: { symbology: 'code128', barcodeSource: 'productSku', align: 'center' },
    },
  ],

  // -------------------------------------------------------------------------
  // DOCUMENT — generic A4 fallback
  // -------------------------------------------------------------------------
  document: [
    documentStoreHeader(1),
    {
      id: 'doc_header', type: 'header', visible: true, order: 2,
      label: 'Document Header',
      config: { content: '', align: 'left', fontSize: 'title', bold: true, paddingBottom: 8 },
    },
    {
      id: 'customer_details', type: 'customer', visible: true, order: 3,
      label: 'Recipient',
      config: { align: 'left', fontSize: 'sm', paddingBottom: 6 },
    },
    {
      id: 'items_table', type: 'table', visible: true, order: 4,
      label: 'Items',
      config: {
        tablePreset: 'general', tableShowHeader: true, fontSize: 'sm',
        // Without `fields` the renderer infers columns from the data shape and
        // the preset does nothing — see the note in TEMPLATE_LAYOUTS.
        fields: [
          { id: 'name', label: 'Item', accessor: 'name' },
          { id: 'qty', label: 'Qty', accessor: 'qty' },
          { id: 'unitPrice', label: 'Unit price', accessor: 'unitPrice' },
          { id: 'lineTotal', label: 'Amount', accessor: 'lineTotal' },
        ],
      },
    },
    totalsBlock(5, { paper: 'a4' }),
    footerBlock(6, ['Thank you.']),
  ],
};

/*
 * invoice.clean — the A4 look chosen from the layout explorations.
 *
 * Four decisions distinguish it from the stock invoice, and each is doing work:
 *
 *   1. LOGO AND NAME INLINE. Contact details move to the page footer, leaving
 *      the store name and the word "Invoice" as the only two things at eye
 *      level. The page reads faster for it.
 *
 *   2. A PARTIES BAND instead of stacked address blocks. Bill to / Ship to /
 *      Details sit side by side in one tinted group, and Ship to only appears
 *      when it differs from billing.
 *
 *   3. A QR CODE, not a barcode. This document goes to a CUSTOMER, who will
 *      scan it with a phone. Code 128 stays on the thermal receipt, where a
 *      1D counter scanner reads it for returns — most retail laser scanners
 *      cannot read QR at all, so switching that would break the till.
 *
 *   4. A PAGE FOOTER carrying the address, contact and tax number, repeated on
 *      every page. Most VAT/GST regimes require the seller's address and tax
 *      number on an invoice; a footer only on the last page leaves page one
 *      non-compliant on its own.
 *
 * No table grid and no filler rows: the table ends where the items end.
 */
TEMPLATE_LAYOUTS['invoice.clean'] = [
  {
    id: 'store_logo', type: 'logo', visible: true, order: 1,
    label: 'Logo & Name',
    config: { logoLayout: 'logo_name_inline', logoHeight: 12, align: 'left' },
  },
  {
    id: 'doc_header', type: 'header', visible: true, order: 2,
    label: 'Document Header',
    config: {
      align: 'right', fontSize: 'xl', bold: true,
      headerFields: ['invoiceNumber', 'date'],
      paddingBottom: 6,
    },
  },
  {
    id: 'parties', type: 'parties', visible: true, order: 3,
    label: 'Bill To / Ship To / Details',
    // showDetails carries terms, due date and PO. alwaysShowShipTo is off:
    // most retail has no separate delivery address, and a Ship To column
    // repeating Bill To is noise on every counter sale.
    config: { showDetails: true, alwaysShowShipTo: false, fontSize: 'sm', paddingBottom: 6 },
  },
  {
    id: 'items_table', type: 'table', visible: true, order: 4,
    label: 'Items',
    config: {
      tablePreset: 'general',
      tableShowHeader: true,
      fontSize: 'sm',
      tableTaxFlagColumn: true,
      weighedItemMode: true,
      /*
       * `fields` is what the renderer actually reads. `tablePreset` above is
       * only the marker showing which preset is selected in the properties
       * panel — setting it alone produces columns inferred from the data
       * shape, which silently dropped the line-total column here.
       */
      fields: [
        { id: 'name', label: 'Item', accessor: 'name' },
        { id: 'qty', label: 'Qty', accessor: 'qty' },
        { id: 'unitPrice', label: 'Unit price', accessor: 'unitPrice' },
        { id: 'lineTotal', label: 'Amount', accessor: 'lineTotal' },
      ],
    },
  },
  {
    id: 'tax_section', type: 'taxSummary', visible: true, order: 5,
    label: 'Tax Summary',
    config: { align: 'right', fontSize: 'sm', showExemptLines: true, showTaxTotal: true, showTaxableAmount: true },
  },
  totalsBlock(6, { paper: 'a4' }),
  {
    id: 'payment_section', type: 'payment', visible: true, order: 7,
    label: 'Payment',
    config: { align: 'right', fontSize: 'sm', paddingTop: 2 },
  },
  {
    id: 'barcode_qr', type: 'barcode', visible: true, order: 8,
    label: 'QR Code',
    // Encodes the document number today. A public invoice URL can be swapped
    // in later without touching this layout — only the value changes.
    config: { symbology: 'qr', barcodeSource: 'invoiceNo', align: 'left', paddingTop: 6 },
  },
  {
    id: 'terms', type: 'terms', visible: true, order: 9,
    label: 'Payment Terms',
    config: { fontSize: 'xs', paddingTop: 2 },
  },
  {
    id: 'page_footer', type: 'pageFooter', visible: true, order: 10,
    label: 'Page Footer',
    config: { footerFields: ['address', 'phone', 'email', 'taxId'] },
  },
];


/**
 * Create a new template
 */
async function createTemplate(data) {
  const {
    tenant_id,
    store_id,
    name,
    template_type,
    document_subtype = null,
    blocks = null,
    styles = null,
    layout_config = null,
    created_by
  } = data;

  // Validate against DEFAULT_BLOCKS, the one registry that has to be right for
  // the document to render at all. The message names the alternatives, because
  // "Invalid template_type: return" told us nothing about what was allowed.
  const validTypes = validTemplateTypes();
  if (!validTypes.includes(template_type)) {
    throw new Error(
      `Invalid template_type: ${template_type}. Known types: ${validTypes.join(', ')}`,
    );
  }

  // Use default blocks if not provided
  const templateBlocks = blocks || DEFAULT_BLOCKS[template_type] || DEFAULT_BLOCKS.receipt;

  const templateId = uuidv4();

  await pool.query(
    `INSERT INTO print_templates
     (id, tenant_id, store_id, name, template_type, document_subtype, version,
      blocks, styles, layout_config, is_published, is_default, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 0, 0, ?, ?)`,
    [
      templateId,
      tenant_id,
      store_id,
      name,
      template_type,
      document_subtype,
      JSON.stringify(templateBlocks),
      styles ? JSON.stringify(styles) : null,
      layout_config ? JSON.stringify(layout_config) : null,
      created_by,
      created_by
    ]
  );

  // Create initial version record
  await pool.query(
    `INSERT INTO template_versions
     (id, template_id, version, blocks, styles, layout_config, change_description, created_by)
     VALUES (?, ?, 1, ?, ?, ?, 'Initial version', ?)`,
    [
      uuidv4(),
      templateId,
      JSON.stringify(templateBlocks),
      styles ? JSON.stringify(styles) : null,
      layout_config ? JSON.stringify(layout_config) : null,
      created_by
    ]
  );

  return await getTemplate(templateId, tenant_id);
}

/**
 * Get a template by ID
 */
async function getTemplate(templateId, tenantId) {
  const [templates] = await pool.query(
    `SELECT * FROM print_templates WHERE id = ? AND tenant_id = ?`,
    [templateId, tenantId]
  );

  if (templates.length === 0) {
    return null;
  }

  const template = templates[0];
  template.blocks = safeParseJSON(template.blocks);
  template.styles = safeParseJSON(template.styles);
  template.layout_config = safeParseJSON(template.layout_config);
  template.preview_data = safeParseJSON(template.preview_data);

  return template;
}

/**
 * List templates for tenant/store with filters
 */
async function listTemplates(tenantId, storeId = null, filters = {}) {
  const { template_type, is_published, is_default } = filters;

  let query = `SELECT * FROM print_templates WHERE tenant_id = ?`;
  const params = [tenantId];

  if (storeId) {
    query += ` AND (store_id = ? OR store_id IS NULL)`;
    params.push(storeId);
  }

  if (template_type) {
    query += ` AND template_type = ?`;
    params.push(template_type);
  }

  if (is_published !== undefined) {
    query += ` AND is_published = ?`;
    params.push(is_published ? 1 : 0);
  }

  if (is_default !== undefined) {
    query += ` AND is_default = ?`;
    params.push(is_default ? 1 : 0);
  }

  query += ` ORDER BY is_default DESC, name ASC`;

  const [templates] = await pool.query(query, params);

  return templates.map(t => ({
    ...t,
    blocks: safeParseJSON(t.blocks),
    styles: safeParseJSON(t.styles),
    layout_config: safeParseJSON(t.layout_config),
    preview_data: safeParseJSON(t.preview_data)
  }));
}

/**
 * Update a template
 */
async function updateTemplate(templateId, tenantId, data, userId) {
  const { name, blocks, styles, layout_config, thumbnail_url } = data;

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }

  if (blocks !== undefined) {
    updates.push('blocks = ?');
    params.push(JSON.stringify(blocks));
  }

  if (styles !== undefined) {
    updates.push('styles = ?');
    params.push(JSON.stringify(styles));
  }

  if (layout_config !== undefined) {
    updates.push('layout_config = ?');
    params.push(JSON.stringify(layout_config));
  }

  if (thumbnail_url !== undefined) {
    updates.push('thumbnail_url = ?');
    params.push(thumbnail_url);
  }

  if (updates.length === 0) {
    return await getTemplate(templateId, tenantId);
  }

  updates.push('updated_by = ?', 'updated_at = NOW()');
  params.push(userId, templateId, tenantId);

  await pool.query(
    `UPDATE print_templates SET ${updates.join(', ')} WHERE id = ? AND tenant_id = ?`,
    params
  );

  return await getTemplate(templateId, tenantId);
}

/**
 * Publish a template (creates new version)
 */
async function publishTemplate(templateId, tenantId, userId) {
  const template = await getTemplate(templateId, tenantId);

  if (!template) {
    throw new Error('Template not found');
  }

  // Increment version
  const newVersion = template.version + 1;

  // Create version record
  await pool.query(
    `INSERT INTO template_versions
     (id, template_id, version, blocks, styles, layout_config, change_description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'Published version', ?)`,
    [
      uuidv4(),
      templateId,
      newVersion,
      JSON.stringify(template.blocks),
      template.styles ? JSON.stringify(template.styles) : null,
      template.layout_config ? JSON.stringify(template.layout_config) : null,
      userId
    ]
  );

  // Update template
  await pool.query(
    `UPDATE print_templates
     SET version = ?, is_published = 1, published_at = NOW(), published_by = ?, updated_by = ?, updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [newVersion, userId, userId, templateId, tenantId]
  );

  // If setting as default, unset other defaults
  await pool.query(
    `UPDATE print_templates SET is_default = 0
     WHERE tenant_id = ? AND template_type = ? AND (store_id <=> ?) AND id != ?`,
    [tenantId, template.template_type, template.store_id, templateId]
  );

  await pool.query(
    `UPDATE print_templates SET is_default = 1 WHERE id = ?`,
    [templateId]
  );

  return await getTemplate(templateId, tenantId);
}

/**
 * Set template as default
 */
async function setAsDefault(templateId, tenantId, userId) {
  const template = await getTemplate(templateId, tenantId);

  if (!template) {
    throw new Error('Template not found');
  }

  // Unset other defaults of same type
  await pool.query(
    `UPDATE print_templates SET is_default = 0
     WHERE tenant_id = ? AND template_type = ? AND (store_id <=> ?) AND id != ?`,
    [tenantId, template.template_type, template.store_id, templateId]
  );

  // Set as default
  await pool.query(
    `UPDATE print_templates SET is_default = 1, updated_by = ?, updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [userId, templateId, tenantId]
  );

  return await getTemplate(templateId, tenantId);
}

/**
 * Delete a template
 */
async function deleteTemplate(templateId, tenantId) {
  await pool.query(
    `DELETE FROM print_templates WHERE id = ? AND tenant_id = ?`,
    [templateId, tenantId]
  );
}

/**
 * Get template version history
 */
async function getTemplateVersions(templateId, tenantId) {
  const [versions] = await pool.query(
    `SELECT tv.*, pt.name as template_name
     FROM template_versions tv
     JOIN print_templates pt ON tv.template_id = pt.id
     WHERE tv.template_id = ? AND pt.tenant_id = ?
     ORDER BY tv.version DESC`,
    [templateId, tenantId]
  );

  return versions.map(v => ({
    ...v,
    blocks: safeParseJSON(v.blocks),
    styles: safeParseJSON(v.styles),
    layout_config: safeParseJSON(v.layout_config)
  }));
}

/**
 * Rollback to a specific version
 */
async function rollbackTemplate(templateId, tenantId, version, userId) {
  const template = await getTemplate(templateId, tenantId);

  if (!template) {
    throw new Error('Template not found');
  }

  // Get version data
  const [versions] = await pool.query(
    `SELECT * FROM template_versions WHERE template_id = ? AND version = ?`,
    [templateId, version]
  );

  if (versions.length === 0) {
    throw new Error('Version not found');
  }

  const versionData = versions[0];

  // Update template with version data
  await pool.query(
    `UPDATE print_templates
     SET blocks = ?, styles = ?, layout_config = ?, version = ?, updated_by = ?, updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [
      versionData.blocks,
      versionData.styles,
      versionData.layout_config,
      version,
      userId,
      templateId,
      tenantId
    ]
  );

  // Create new version record for the rollback
  await pool.query(
    `INSERT INTO template_versions
     (id, template_id, version, blocks, styles, layout_config, change_description, created_by)
     VALUES (?, ?, ?, ?, ?, ?, 'Rolled back to version ' + ?, ?)`,
    [
      uuidv4(),
      templateId,
      version + 1,
      versionData.blocks,
      versionData.styles,
      versionData.layout_config,
      version,
      userId
    ]
  );

  return await getTemplate(templateId, tenantId);
}

module.exports = {
  TemplateType,
  validTemplateTypes,
  TEMPLATE_LAYOUTS,
  DEFAULT_BLOCKS,
  withDutyFreeVisible,
  blocksForReset,
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  publishTemplate,
  setAsDefault,
  deleteTemplate,
  getTemplateVersions,
  rollbackTemplate
};
