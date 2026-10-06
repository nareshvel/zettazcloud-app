/**
 * Frozen snapshot of DEFAULT_BLOCKS.invoice / .jewelry_invoice as they were
 * BEFORE the 2026-08-25 clean-layout rewrite — the shapes an already-provisioned
 * tenant's stored `print_templates.blocks` would still equal if nobody has
 * touched the template since it was created.
 *
 * PULLED OUT OF THE BACKFILL SCRIPT so the classification logic — the part
 * that decides "is this row still the shipped default, or has a tenant
 * customised it" — can be unit tested without a database. Getting this wrong
 * in either direction is a real failure mode: too loose and a tenant's actual
 * customisation gets silently overwritten; too strict and duty-free stores
 * like the one that reported the stale layout stay on the old design forever.
 *
 * Nothing here should ever change again. If DEFAULT_BLOCKS is edited a third
 * time, this file stays exactly as it is — it is a snapshot of one specific
 * moment in the past, not a second copy of "the current default".
 */

'use strict';

const OLD_DOCUMENT_STORE_HEADER = {
  id: 'store_logo', type: 'logo', visible: true, order: 1,
  label: 'Store Header',
  config: {
    logoLayout: 'logo_name_contact',
    logoContactFields: ['address', 'phone', 'email', 'taxId'],
    logoHeight: 18,
    align: 'left',
    paddingBottom: 6,
  },
};

const OLD_INVOICE = [
  OLD_DOCUMENT_STORE_HEADER,
  {
    id: 'invoice_header', type: 'header', visible: true, order: 2,
    label: 'Invoice Header',
    config: {
      content: '', align: 'left', fontSize: 'title', bold: true,
      headerFields: ['invoiceNumber', 'date', 'dueDate'], paddingBottom: 8,
    },
  },
  {
    id: 'customer_details', type: 'customer', visible: true, order: 3,
    label: 'Bill To',
    config: {
      align: 'left', fontSize: 'sm',
      customerFields: ['name', 'address', 'city', 'phone', 'email', 'taxId'],
      paddingBottom: 6,
    },
  },
  {
    id: 'billing_shipping', type: 'address', visible: false, order: 4,
    label: 'Billing / Shipping',
    config: { addressType: 'both', align: 'left', fontSize: 'sm' },
  },
  {
    id: 'items_table', type: 'table', visible: true, order: 5,
    label: 'Items',
    config: {
      tablePreset: 'general', tableShowHeader: true, tableZebra: true, fontSize: 'sm',
      fields: [
        { id: 'name', label: 'Description', accessor: 'name' },
        { id: 'qty', label: 'Qty', accessor: 'qty' },
        { id: 'unitPrice', label: 'Unit Price', accessor: 'unitPrice' },
        { id: 'lineTotal', label: 'Amount', accessor: 'lineTotal' },
      ],
    },
  },
  {
    id: 'tax_section', type: 'taxSummary', visible: true, order: 6,
    label: 'Tax Summary',
    config: {
      align: 'right', fontSize: 'sm', paddingTop: 4,
      showExemptLines: true, showTaxableAmount: true, showTaxTotal: true,
      showReverseChargeNotice: true,
    },
  },
  {
    id: 'totals_section', type: 'totals', visible: true, order: 7,
    label: 'Totals',
    config: { align: 'right', fontSize: 'xl', bold: true, paddingTop: 4 },
  },
  {
    id: 'serial_capture', type: 'serialCapture', visible: true, order: 8,
    label: 'Serial / IMEI',
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
    id: 'payment_terms', type: 'terms', visible: true, order: 11,
    label: 'Terms',
    config: { align: 'left', fontSize: 'xs', paddingTop: 10 },
  },
  {
    id: 'footer', type: 'footer', visible: true, order: 12,
    label: 'Footer',
    config: {
      align: 'center', fontSize: 'xs', paddingTop: 6,
      fields: [{ id: 'f1', label: 'Thank you for your business.' }],
    },
  },
];

const OLD_JEWELRY_INVOICE = [
  OLD_DOCUMENT_STORE_HEADER,
  {
    id: 'invoice_header', type: 'header', visible: true, order: 2,
    label: 'Invoice Header',
    config: {
      content: '', align: 'left', fontSize: 'title', bold: true,
      headerFields: ['invoiceNumber', 'date', 'cashier'], paddingBottom: 8,
    },
  },
  {
    id: 'customer_details', type: 'customer', visible: true, order: 3,
    label: 'Customer',
    config: {
      align: 'left', fontSize: 'sm',
      customerFields: ['name', 'address', 'city', 'phone', 'taxId'],
      paddingBottom: 6,
    },
  },
  {
    id: 'duty_free', type: 'dutyFree', visible: false, order: 4,
    label: 'Duty-Free / Export',
    config: {
      align: 'left', fontSize: 'sm', paddingBottom: 6,
      dutyFreeFields: ['passport', 'flight', 'destination', 'departureDate'],
      showExportDeclaration: true,
    },
  },
  {
    id: 'items_table', type: 'table', visible: true, order: 5,
    label: 'Items',
    config: {
      tablePreset: 'jewelry', tableShowHeader: true, fontSize: 'sm',
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
      showExemptLines: true, showTaxableAmount: true, showTaxTotal: true,
      showReverseChargeNotice: true,
    },
  },
  {
    id: 'totals_section', type: 'totals', visible: true, order: 9,
    label: 'Totals',
    config: { align: 'right', fontSize: 'xl', bold: true, paddingTop: 4 },
  },
  {
    id: 'compliance', type: 'compliance', visible: true, order: 10,
    label: 'Compliance',
    config: { align: 'left', fontSize: 'fine', paddingTop: 8 },
  },
  {
    id: 'barcode_qr', type: 'barcode', visible: true, order: 11,
    label: 'Transaction Barcode',
    config: { symbology: 'code128', barcodeSource: 'invoiceNo', align: 'center', paddingTop: 6 },
  },
  {
    id: 'terms_signatures', type: 'signatures', visible: true, order: 12,
    label: 'Signatures',
    config: { align: 'left', paddingTop: 12 },
  },
];

// The canonical transform lives in printTemplateService — see its comment.
// Re-exported here (rather than redefined) so this snapshot module still
// offers `withDutyFreeVisible` to its own tests without a second copy.
const { withDutyFreeVisible } = require('./printTemplateService');

const OLD_SHAPES = {
  invoice: [
    { blocks: OLD_INVOICE, dutyFree: false },
  ],
  jewelry_invoice: [
    { blocks: OLD_JEWELRY_INVOICE, dutyFree: false },
    { blocks: withDutyFreeVisible(OLD_JEWELRY_INVOICE), dutyFree: true },
  ],
};

const canon = (v) => JSON.stringify(v);

/**
 * Does this stored block set still look like an untouched, auto-provisioned
 * default? Returns `{ matched: true, dutyFree }` if so, `{ matched: false }`
 * if the row has diverged in any way and must be left alone.
 */
function classifyStoredBlocks(templateType, storedBlocks) {
  const candidates = OLD_SHAPES[templateType] || [];
  const storedCanon = canon(storedBlocks);
  const match = candidates.find((c) => canon(c.blocks) === storedCanon);
  return match ? { matched: true, dutyFree: match.dutyFree } : { matched: false };
}

module.exports = {
  OLD_INVOICE,
  OLD_JEWELRY_INVOICE,
  withDutyFreeVisible,
  classifyStoredBlocks,
};
