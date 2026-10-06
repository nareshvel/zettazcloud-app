/**
 * Items-table model.
 *
 * Shared by the canvas and the print renderer so column resolution, weighed-item
 * rendering and tax-flag handling cannot diverge between preview and paper.
 *
 * WHY WEIGHED ITEMS NEED SPECIAL HANDLING
 * ---------------------------------------
 * Loose produce, deli and meat are sold by weight. A grocery receipt showing
 * only "Bananas ... 4.95" is not verifiable — the customer cannot check the
 * scale. Convention is a sub-line beneath the item:
 *
 *     Bananas                    4011
 *       1.24 kg @ $3.99/kg              4.95
 *
 * Organic produce uses a 5-digit PLU beginning with 9, which is why the PLU is
 * shown rather than an internal SKU.
 *
 * WHY PER-LINE TAX FLAGS
 * ----------------------
 * Many jurisdictions exempt basic food while taxing prepared food and non-food
 * in the same basket. Registers therefore print a marker against each price so
 * the customer can reconcile the tax line at the bottom against the items that
 * produced it. The flag CHARACTERS are conventional, not universal, so they are
 * data — never hardcoded.
 */

import type { TemplateField } from '@/types/printTemplate';

// ---------------------------------------------------------------------------
// Accessors
// ---------------------------------------------------------------------------

/** Accessors rendered as currency. */
export const MONEY_ACCESSORS = new Set([
  'unitPrice', 'lineTotal', 'price', 'amount',
  'makingCharge', 'stoneCharge', 'hallmarkCharge', 'ratePerGram',
  'pricePerUnit', 'sellingPrice', 'discount',
]);

/** Accessors rendered as a weight, using the item's own unit where present. */
export const WEIGHT_ACCESSORS = new Set(['netWeight', 'grossWeight', 'weight']);

/** Accessors that should sit right-aligned (numeric / money columns). */
export const NUMERIC_ACCESSORS = new Set([
  ...MONEY_ACCESSORS, ...WEIGHT_ACCESSORS,
  'qty', 'quantity', 'daysSupply', 'warrantyMonths',
]);

/** Every accessor a template may bind a column to, grouped for the UI. */
export const ACCESSOR_GROUPS: Array<{ group: string; options: Array<{ value: string; label: string }> }> = [
  {
    group: 'General',
    options: [
      { value: 'name',        label: 'Item Name' },
      { value: 'description', label: 'Description' },
      { value: 'sku',         label: 'SKU' },
      { value: 'qty',         label: 'Quantity' },
      { value: 'unitPrice',   label: 'Unit Price' },
      { value: 'lineTotal',   label: 'Line Total' },
      { value: 'taxFlag',     label: 'Tax Flag' },
    ],
  },
  {
    group: 'Grocery',
    options: [
      { value: 'plu',          label: 'PLU Code' },
      { value: 'weight',       label: 'Weight' },
      { value: 'pricePerUnit', label: 'Price per Unit' },
      { value: 'department',   label: 'Department' },
    ],
  },
  {
    group: 'Jewelry',
    options: [
      { value: 'purity',        label: 'Purity' },
      { value: 'fineness',      label: 'Fineness' },
      { value: 'grossWeight',   label: 'Gross Weight' },
      { value: 'netWeight',     label: 'Net Weight' },
      { value: 'makingCharge',  label: 'Making Charge' },
      { value: 'stoneCharge',   label: 'Stone Charge' },
      { value: 'hallmarkCharge',label: 'Hallmark Charge' },
      { value: 'huid',          label: 'HUID' },
      { value: 'amount',        label: 'Amount' },
    ],
  },
  {
    group: 'Pharmacy',
    options: [
      { value: 'strength',      label: 'Strength' },
      { value: 'form',          label: 'Form' },
      { value: 'daysSupply',    label: 'Days Supply' },
      { value: 'drugId',        label: 'Drug Identifier' },
      { value: 'lotNumber',     label: 'Lot Number' },
      { value: 'beyondUseDate', label: 'Beyond-Use Date' },
    ],
  },
  {
    group: 'Electronics',
    options: [
      { value: 'model',          label: 'Model' },
      { value: 'serialNumber',   label: 'Serial Number' },
      { value: 'imei',           label: 'IMEI' },
      { value: 'warrantyMonths', label: 'Warranty (months)' },
      { value: 'warrantyExpiry', label: 'Warranty Expiry' },
    ],
  },
  {
    group: 'Apparel',
    options: [
      { value: 'size',  label: 'Size' },
      { value: 'color', label: 'Colour' },
    ],
  },
  {
    group: 'Souvenir & Gifts',
    options: [
      { value: 'itemType', label: 'Item Type' },
      { value: 'theme',    label: 'Theme/Collection' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Table presets
// ---------------------------------------------------------------------------

export type TablePresetKey =
  | 'general' | 'jewelry' | 'service' | 'restaurant'
  | 'grocery' | 'pharmacy' | 'electronics' | 'apparel' | 'souvenir' | 'dutyFree' | 'custom';

export const TABLE_PRESET_FIELDS: Record<TablePresetKey, TemplateField[]> = {
  general: [
    { id: 'name',      label: 'Item',       accessor: 'name' },
    { id: 'qty',       label: 'Qty',        accessor: 'qty' },
    { id: 'unitPrice', label: 'Unit Price', accessor: 'unitPrice' },
    { id: 'lineTotal', label: 'Total',      accessor: 'lineTotal' },
  ],
  // Weight and price-per-unit are rendered as a sub-line, not columns — an 80mm
  // receipt is ~48 characters wide and cannot carry six columns legibly.
  grocery: [
    { id: 'name',      label: 'Item',   accessor: 'name' },
    { id: 'plu',       label: 'PLU',    accessor: 'plu' },
    { id: 'qty',       label: 'Qty',    accessor: 'qty' },
    { id: 'lineTotal', label: 'Amount', accessor: 'lineTotal' },
  ],
  pharmacy: [
    { id: 'name',       label: 'Drug',    accessor: 'name' },
    { id: 'strength',   label: 'Strength',accessor: 'strength' },
    { id: 'qty',        label: 'Qty',     accessor: 'qty' },
    { id: 'daysSupply', label: 'Days',    accessor: 'daysSupply' },
    { id: 'lineTotal',  label: 'Amount',  accessor: 'lineTotal' },
  ],
  electronics: [
    { id: 'name',         label: 'Item',   accessor: 'name' },
    { id: 'model',        label: 'Model',  accessor: 'model' },
    { id: 'serialNumber', label: 'Serial', accessor: 'serialNumber' },
    { id: 'qty',          label: 'Qty',    accessor: 'qty' },
    { id: 'lineTotal',    label: 'Amount', accessor: 'lineTotal' },
  ],
  apparel: [
    { id: 'name',      label: 'Item',   accessor: 'name' },
    { id: 'sku',       label: 'SKU',    accessor: 'sku' },
    { id: 'size',      label: 'Size',   accessor: 'size' },
    { id: 'color',     label: 'Colour', accessor: 'color' },
    { id: 'qty',       label: 'Qty',    accessor: 'qty' },
    { id: 'lineTotal', label: 'Amount', accessor: 'lineTotal' },
  ],
  souvenir: [
    { id: 'name',      label: 'Item',      accessor: 'name' },
    { id: 'sku',       label: 'SKU',       accessor: 'sku' },
    { id: 'itemType',  label: 'Item Type', accessor: 'itemType' },
    { id: 'qty',       label: 'Qty',       accessor: 'qty' },
    { id: 'lineTotal', label: 'Amount',    accessor: 'lineTotal' },
  ],
  jewelry: [
    { id: 'name',         label: 'Item',     accessor: 'name' },
    { id: 'purity',       label: 'Purity',   accessor: 'purity' },
    { id: 'grossWeight',  label: 'Gross Wt', accessor: 'grossWeight' },
    { id: 'netWeight',    label: 'Net Wt',   accessor: 'netWeight' },
    { id: 'makingCharge', label: 'Making',   accessor: 'makingCharge' },
    { id: 'amount',       label: 'Amount',   accessor: 'amount' },
  ],
  // Duty-free prices are tax-free by definition, so no tax column.
  dutyFree: [
    { id: 'name',      label: 'Item',              accessor: 'name' },
    { id: 'qty',       label: 'Qty',               accessor: 'qty' },
    { id: 'unitPrice', label: 'Unit Price',        accessor: 'unitPrice' },
    { id: 'lineTotal', label: 'Amount',            accessor: 'lineTotal' },
  ],
  service: [
    { id: 'description', label: 'Description', accessor: 'description' },
    { id: 'qty',         label: 'Hours / Qty', accessor: 'qty' },
    { id: 'unitPrice',   label: 'Rate',        accessor: 'unitPrice' },
    { id: 'lineTotal',   label: 'Amount',      accessor: 'lineTotal' },
  ],
  restaurant: [
    { id: 'name',      label: 'Item',   accessor: 'name' },
    { id: 'qty',       label: 'Qty',    accessor: 'qty' },
    { id: 'unitPrice', label: 'Price',  accessor: 'unitPrice' },
    { id: 'lineTotal', label: 'Amount', accessor: 'lineTotal' },
  ],
  custom: [],
};

// ---------------------------------------------------------------------------
// Weighed items
// ---------------------------------------------------------------------------

/**
 * True when a line was priced by weight and should carry a sub-line showing the
 * measured weight and the rate applied.
 */
export const isWeighedItem = (item: any): boolean =>
  item?.weight != null && item?.pricePerUnit != null;

/**
 * "1.24 kg @ $3.99/kg" — the customer's means of verifying the scale.
 * Returns null when the line was not weighed.
 */
export const buildWeighedSubLine = (
  item: any,
  formatMoney: (v: unknown) => string,
): string | null => {
  if (!isWeighedItem(item)) return null;
  const unit = item.weightUnit || 'kg';
  return `${item.weight} ${unit} @ ${formatMoney(item.pricePerUnit)}/${unit}`;
};

// ---------------------------------------------------------------------------
// Tax flags
// ---------------------------------------------------------------------------

/**
 * Meaning of each conventional flag character. Used for the receipt legend, so
 * a customer can decode the markers rather than guessing.
 *
 * These are common conventions, not a standard — a jurisdiction or chain may
 * use different characters, so they are only defaults.
 */
export const TAX_FLAG_LABELS: Record<string, string> = {
  T: 'Taxable',
  N: 'Non-taxable / exempt',
  Z: 'Zero-rated',
  E: 'Exempt',
  RC: 'Reverse charge',
};

/** Distinct flags present on a set of items, for rendering a legend. */
export const collectTaxFlags = (items: any[]): string[] => {
  const seen = new Set<string>();
  // `items` may be malformed from a partial API response — a print job must
  // degrade to an empty result, never throw.
  (Array.isArray(items) ? items : []).forEach((i) => {
    if (i?.taxFlag) seen.add(String(i.taxFlag));
  });
  return [...seen].sort();
};

/** Legend text, e.g. "T = Taxable · N = Non-taxable / exempt". */
export const buildTaxFlagLegend = (items: any[]): string | null => {
  const flags = collectTaxFlags(items);
  if (flags.length < 2) return null; // a single flag explains nothing useful
  return flags
    .map((f) => `${f} = ${TAX_FLAG_LABELS[f] || 'See tax summary'}`)
    .join(' · ');
};

// ---------------------------------------------------------------------------
// Column resolution
// ---------------------------------------------------------------------------

/** True when a column should be right-aligned. */
export const isNumericColumn = (accessor?: string): boolean =>
  Boolean(accessor && NUMERIC_ACCESSORS.has(accessor));

/**
 * Resolve the columns actually rendered.
 *
 * Appends a tax-flag column when the template asks for one AND the data has
 * flags — requesting the column on data that has none would print a column of
 * dashes.
 */
export const resolveColumns = (
  configured: TemplateField[],
  items: any[],
  opts: { taxFlagColumn?: boolean } = {},
): TemplateField[] => {
  const cols = [...configured];
  const wantFlag = opts.taxFlagColumn && collectTaxFlags(items).length > 0;
  const alreadyHasFlag = cols.some((c) => c.accessor === 'taxFlag');
  if (wantFlag && !alreadyHasFlag) {
    cols.push({ id: 'taxFlag', label: '', accessor: 'taxFlag' });
  }
  return cols;
};
