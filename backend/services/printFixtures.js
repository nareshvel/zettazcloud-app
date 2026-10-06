/**
 * Print Module Fixture Data
 *
 * Sample data used to render template previews and for print QA.
 *
 * WHY THIS WAS REBUILT
 * --------------------
 * Every fixture used to be jewelry ("ZETTAZ JEWELRY", 22KT gold rings), and was
 * reused for all template types. A pharmacy owner designing a receipt template
 * previewed gold jewellery; a grocer saw diamond earrings. Worse, none of the
 * fields those verticals actually need existed, so their templates could not be
 * designed at all.
 *
 * Fixtures are now organised on the three axes the product actually varies on:
 *
 *   VERTICAL      jewelry | grocery | pharmacy | electronics | apparel | retail
 *   JURISDICTION  tax label, tax-inclusive pricing, mandatory titles
 *   SALES MODE    domestic | duty_free
 *
 * FIELD NAMING: camelCase. printService.ts converts snake_case to camelCase on
 * the way to the client, so a snake_case key here would arrive renamed and the
 * template accessor would silently resolve to "—".
 */

// ---------------------------------------------------------------------------
// Shared store identities
// ---------------------------------------------------------------------------

const STORE_JEWELRY = {
  storeName: 'Diamond Republic',
  storeAddress: '100 Heritage Quay, St. John\'s, Antigua and Barbuda',
  storePhone: '+1-268-555-0100',
  storeTel: '+1-268-555-0100',
  storeEmail: 'sales@diamondrepublic.ag',
  storeTaxId: 'ABST-88990011',
  taxLabel: 'ABST',
};

const STORE_GROCERY = {
  storeName: 'Harbour Fresh Market',
  storeAddress: '42 Market Street, St. John\'s',
  storePhone: '+1-268-555-0288',
  storeTel: '+1-268-555-0288',
  storeEmail: 'hello@harbourfresh.ag',
  storeTaxId: 'ABST-11223344',
  taxLabel: 'ABST',
};

const STORE_PHARMACY = {
  storeName: 'Bayside Pharmacy',
  storeAddress: '8 Clinic Road, St. John\'s',
  storePhone: '+1-268-555-0455',
  storeTel: '+1-268-555-0455',
  storeEmail: 'care@baysidepharmacy.ag',
  storeTaxId: 'ABST-55667788',
  pharmacyLicense: 'PH-AG-2291',
  taxLabel: 'ABST',
};

const STORE_ELECTRONICS = {
  storeName: 'Circuit Point',
  storeAddress: '17 Technology Park, St. John\'s',
  storePhone: '+1-268-555-0611',
  storeTel: '+1-268-555-0611',
  storeEmail: 'support@circuitpoint.ag',
  storeTaxId: 'ABST-99001122',
  taxLabel: 'ABST',
};

const STORE_APPAREL = {
  storeName: 'Coral & Thread',
  storeAddress: '5 Redcliffe Quay, St. John\'s',
  storePhone: '+1-268-555-0733',
  storeTel: '+1-268-555-0733',
  storeEmail: 'shop@coralandthread.ag',
  storeTaxId: 'ABST-33445566',
  taxLabel: 'ABST',
};

const STORE_RETAIL = {
  storeName: 'Heritage General Store',
  storeAddress: '23 High Street, St. John\'s',
  storePhone: '+1-268-555-0199',
  storeTel: '+1-268-555-0199',
  storeEmail: 'info@heritagegeneral.ag',
  storeTaxId: 'ABST-77889900',
  taxLabel: 'ABST',
};

const STORE_SOUVENIR = {
  storeName: 'Island Treasures Gift Shop',
  storeAddress: '2 Heritage Quay, St. John\'s',
  storePhone: '+1-268-555-0922',
  storeTel: '+1-268-555-0922',
  storeEmail: 'hello@islandtreasures.ag',
  storeTaxId: 'ABST-22110033',
  taxLabel: 'ABST',
};

const CUSTOMER_LOCAL = {
  name: 'Marcia Joseph',
  address: '14 Cassada Gardens',
  billingAddress: '14 Cassada Gardens, St. John\'s',
  shippingAddress: '14 Cassada Gardens, St. John\'s',
  city: 'St. John\'s',
  state: 'St. John',
  postalCode: 'AG-1000',
  country: 'Antigua and Barbuda',
  email: 'marcia.joseph@example.ag',
  phone: '+1-268-555-0142',
  taxId: null,
};

const CUSTOMER_TRAVELLER = {
  name: 'Jane Doe',
  passport: 'P12345678',
  address: '456 Traveler Ave, New York, NY 10001',
  billingAddress: '456 Traveler Ave, New York, NY 10001',
  shippingAddress: '456 Traveler Ave, New York, NY 10001',
  city: 'New York',
  state: 'NY',
  postalCode: '10001',
  country: 'USA',
  email: 'jane.doe@example.com',
  phone: '+1-555-0123',
  taxId: 'TAX-12345678',
};

// ---------------------------------------------------------------------------
// GROCERY — weighed items, PLU codes, per-line tax flags, coupon savings
// ---------------------------------------------------------------------------
const groceryReceipt = {
  ...STORE_GROCERY,
  documentType: 'receipt',
  documentTitle: 'SALES RECEIPT',
  receiptNumber: 'RCT-004821',
  transactionNumber: '4821',
  laneNumber: '03',
  date: '23/08/2026 09:14',
  cashierName: 'Andre P.',
  currency: 'XCD',
  customer: { name: 'Walk-in' },
  items: [
    // Loose produce: 4/5-digit PLU, priced by weight
    { name: 'Bananas', plu: '4011', weight: 1.24, weightUnit: 'kg', pricePerUnit: 3.99,
      qty: 1, unitPrice: 4.95, lineTotal: 4.95, taxFlag: 'N', department: 'Produce' },
    { name: 'Organic Avocado', plu: '94225', weight: 0.62, weightUnit: 'kg', pricePerUnit: 12.50,
      qty: 1, unitPrice: 7.75, lineTotal: 7.75, taxFlag: 'N', department: 'Produce' },
    // Packaged grocery — exempt
    { name: 'Whole Milk 2L', sku: '0007312', qty: 2, unitPrice: 6.20, lineTotal: 12.40,
      taxFlag: 'N', department: 'Dairy' },
    // Prepared food and non-food — taxable
    { name: 'Rotisserie Chicken', sku: '0091144', qty: 1, unitPrice: 24.00, lineTotal: 24.00,
      taxFlag: 'T', department: 'Deli' },
    { name: 'Dish Soap 500ml', sku: '0044820', qty: 1, unitPrice: 9.50, lineTotal: 9.50,
      taxFlag: 'T', department: 'Household' },
  ],
  couponLines: [
    { description: 'Card Saver — Milk 2 for', amount: -1.40 },
    { description: 'Digital Coupon — Dish Soap', amount: -2.00 },
  ],
  savingsTotal: 3.40,
  subtotal: 58.60,
  taxBreakdown: [
    { label: 'Exempt (food)', rate: 0, taxableAmount: 25.10, taxAmount: 0 },
    { label: 'ABST 15%', rate: 15, taxableAmount: 33.50, taxAmount: 5.03 },
  ],
  tax: 5.03,
  total: 60.23,
  payment: { method: 'Cash', amount: 65.00, tendered: 65.00, change: 4.77 },
  loyaltyPointsEarned: 60,
  loyaltyBalance: 1840,
  footer: [
    'Thank you for shopping with us!',
    'Returns accepted within 14 days with receipt.',
  ],
};

// ---------------------------------------------------------------------------
// PHARMACY — Rx details, drug identifier, lot, beyond-use date
// ---------------------------------------------------------------------------
// NOTE: `drugIdentifierLabel` is data, not a constant. NDC is US-specific;
// Canada uses DIN, Germany PZN. The template reads the label from the
// jurisdiction profile — never hardcode "NDC".
// ---------------------------------------------------------------------------
const pharmacyReceipt = {
  ...STORE_PHARMACY,
  documentType: 'receipt',
  documentTitle: 'PHARMACY RECEIPT',
  receiptNumber: 'RX-018844',
  date: '23/08/2026 11:02',
  cashierName: 'S. Emmanuel',
  pharmacistName: 'Dr. L. Charles, RPh',
  currency: 'XCD',
  drugIdentifierLabel: 'Drug ID',
  customer: { name: 'Marcia Joseph', phone: '+1-268-555-0142' },
  rxNumber: 'RX-2026-018844',
  prescriber: 'Dr. A. Nembhard',
  refillsRemaining: 2,
  refillsAuthorized: 3,
  items: [
    {
      name: 'Amoxicillin', strength: '500 mg', form: 'Capsule',
      qty: 21, daysSupply: 7,
      drugId: '00093-4155-73', lotNumber: 'LOT-8842A', beyondUseDate: '23/02/2027',
      unitPrice: 1.90, lineTotal: 39.90, taxFlag: 'N',
    },
    {
      name: 'Ibuprofen', strength: '200 mg', form: 'Tablet',
      qty: 24, daysSupply: 6,
      drugId: '00573-0164-40', lotNumber: 'LOT-1190C', beyondUseDate: '30/11/2027',
      unitPrice: 0.55, lineTotal: 13.20, taxFlag: 'T',
    },
  ],
  subtotal: 53.10,
  taxBreakdown: [
    { label: 'Exempt (prescription)', rate: 0, taxableAmount: 39.90, taxAmount: 0 },
    { label: 'ABST 15%', rate: 15, taxableAmount: 13.20, taxAmount: 1.98 },
  ],
  tax: 1.98,
  total: 55.08,
  payment: { method: 'Card', amount: 55.08, last4: '4242', insuranceCovered: 0.00, patientPays: 55.08 },
  counsellingNotice: 'Pharmacist counselling is available on request.',
  footer: ['Keep out of reach of children.', 'Questions? Call +1-268-555-0455'],
};

// ---------------------------------------------------------------------------
// ELECTRONICS — serial/IMEI, warranty, RMA return policy
// ---------------------------------------------------------------------------
/**
 * General-retail A4 invoice.
 *
 * Deliberately plain: no serial numbers, no IMEI, no warranty columns. A gift
 * shop invoicing a hotel needs a line description, a quantity, a price and a
 * tax summary — nothing more. The electronics invoice was standing in for this
 * one, which put warranty and serial columns on documents that could never
 * populate them.
 */
const retailInvoice = {
  ...STORE_RETAIL,
  documentType: 'invoice',
  documentTitle: 'INVOICE',
  invoiceNumber: 'INV-2026-01180',
  orderNumber: 'SO-01180',
  date: '23/08/2026',
  dueDate: '22/09/2026',
  cashierName: 'D. Simmons',
  currency: 'XCD',
  // A business buyer, because an A4 invoice (rather than a till receipt) is
  // almost always going to an account customer who needs it for their books.
  customer: {
    ...CUSTOMER_LOCAL,
    name: 'Blue Waters Hotel Ltd',
    taxId: 'ABST-CUST-9014',
  },
  items: [
    { name: 'Beach Towel', sku: 'BT-880', qty: 24, unitPrice: 45.00, lineTotal: 1080.00, taxFlag: 'T' },
    { name: 'Sunscreen SPF50 200ml', sku: 'SS-501', qty: 36, unitPrice: 38.00, lineTotal: 1368.00, taxFlag: 'T' },
    { name: 'Straw Hat', sku: 'SH-220', qty: 12, unitPrice: 65.00, lineTotal: 780.00, taxFlag: 'T' },
  ],
  subtotal: 3228.00,
  taxBreakdown: [{ label: 'ABST 15%', rate: 15, taxableAmount: 3228.00, taxAmount: 484.20 }],
  tax: 484.20,
  total: 3712.20,
  payment: { method: 'On Account', amount: 0, reference: 'NET-30' },
  returnPolicy: {
    windowDays: 30,
    terms: 'Unused goods may be returned within 30 days with this invoice. '
         + 'Refunds are issued to the original payment method or as account credit.',
  },
  signatures: { customer: 'Received By', authorized: 'Authorized Signature' },
};

/**
 * Refund slip.
 *
 * Amounts are POSITIVE — the title carries the direction. See
 * returnToPrintData for why a minus sign under a REFUND heading is a mistake.
 */
const retailReturn = {
  ...STORE_RETAIL,
  documentType: 'return',
  documentTitle: 'REFUND / CREDIT NOTE',
  forceDocumentTitle: 'REFUND / CREDIT NOTE',
  forceDocumentNumber: true,
  documentNumber: 'RET-000012',
  originalDocumentNumber: 'INV-2026-001180',
  date: '25/08/2026',
  cashierName: 'D. Simmons',
  currency: 'XCD',
  customer: CUSTOMER_LOCAL,
  customerName: 'Marcia Joseph',
  items: [
    { name: 'Beach Towel', sku: 'BT-880', qty: 1, unitPrice: 45.00, lineTotal: 45.00, taxFlag: 'T' },
  ],
  subtotal: 45.00,
  taxBreakdown: [{ label: 'ABST 15%', rate: 15, taxableAmount: 45.00, taxAmount: 6.75 }],
  tax: 6.75,
  total: 51.75,
  payment: { method: 'Card', amount: 51.75, last4: '4242' },
  returnReason: 'defective',
  signatures: { customer: 'Customer Signature', authorized: 'Authorized Signature' },
};

const electronicsInvoice = {
  ...STORE_ELECTRONICS,
  documentType: 'invoice',
  documentTitle: 'TAX INVOICE',
  invoiceNumber: 'INV-2026-00417',
  orderNumber: 'SO-00417',
  date: '23/08/2026',
  dueDate: '22/09/2026',
  cashierName: 'K. Browne',
  currency: 'XCD',
  customer: { ...CUSTOMER_LOCAL, taxId: 'ABST-CUST-4471' },
  items: [
    {
      name: 'Smartphone X200', model: 'X200-128-BLK', sku: 'SP-X200-128',
      serialNumber: 'SN-4471-88210', imei: '356938035643809',
      warrantyMonths: 24, warrantyExpiry: '23/08/2028',
      qty: 1, unitPrice: 2450.00, lineTotal: 2450.00, taxFlag: 'T',
    },
    {
      name: 'Wireless Earbuds Pro', model: 'WE-PRO-2', sku: 'WE-PRO-2',
      serialNumber: 'SN-4471-88211', imei: null,
      warrantyMonths: 12, warrantyExpiry: '23/08/2027',
      qty: 1, unitPrice: 480.00, lineTotal: 480.00, taxFlag: 'T',
    },
  ],
  subtotal: 2930.00,
  taxBreakdown: [{ label: 'ABST 15%', rate: 15, taxableAmount: 2930.00, taxAmount: 439.50 }],
  tax: 439.50,
  total: 3369.50,
  payment: { method: 'Card', amount: 3369.50, last4: '4242', reference: 'AUTH-88213' },
  returnPolicy: {
    windowDays: 14,
    restockingFeePct: 15,
    terms: 'Returns require the original receipt and matching serial numbers. '
         + 'Goods must be in original condition with all contents. '
         + 'An RMA number is required for any return sent by shipment.',
  },
  signatures: { customer: 'Customer Signature', authorized: 'Authorized Signature' },
};

// ---------------------------------------------------------------------------
// APPAREL — size/colour, exchange-first policy, gift-receipt variant
// ---------------------------------------------------------------------------
const apparelReceipt = {
  ...STORE_APPAREL,
  documentType: 'receipt',
  documentTitle: 'SALES RECEIPT',
  receiptNumber: 'RCT-009133',
  transactionNumber: '9133',
  date: '23/08/2026 15:47',
  cashierName: 'T. Simon',
  currency: 'XCD',
  customer: { name: 'Walk-in' },
  items: [
    { name: 'Linen Shirt', sku: 'LS-114-M-WHT', size: 'M', color: 'White',
      qty: 1, unitPrice: 189.00, lineTotal: 189.00, taxFlag: 'T' },
    { name: 'Cotton Shorts', sku: 'CS-207-32-NVY', size: '32', color: 'Navy',
      qty: 2, unitPrice: 129.00, lineTotal: 258.00, taxFlag: 'T' },
  ],
  subtotal: 447.00,
  taxBreakdown: [{ label: 'ABST 15%', rate: 15, taxableAmount: 447.00, taxAmount: 67.05 }],
  tax: 67.05,
  total: 514.05,
  payment: { method: 'Card', amount: 514.05, last4: '1881' },
  loyaltyPointsEarned: 51,
  loyaltyBalance: 320,
  returnPolicy: {
    windowDays: 30,
    // Best practice is to make exchange the easy default and refund the extra step.
    terms: 'Exchange within 30 days with receipt. Refunds available on request '
         + 'for unworn items with tags attached.',
  },
  footer: ['Thank you!', 'coralandthread.ag'],
};

/**
 * Gift receipt: same transaction with price, discount and payment suppressed.
 * The recipient can return without learning what was paid; the transaction
 * barcode still allows the cashier to look the sale up.
 */
const apparelGiftReceipt = {
  ...apparelReceipt,
  documentTitle: 'GIFT RECEIPT',
  giftMode: true,
  items: apparelReceipt.items.map(({ name, sku, size, color, qty }) => ({
    name, sku, size, color, qty,
  })),
  subtotal: null,
  taxBreakdown: [],
  tax: null,
  total: null,
  payment: null,
  loyaltyPointsEarned: null,
  loyaltyBalance: null,
};

// ---------------------------------------------------------------------------
// GENERAL RETAIL
// ---------------------------------------------------------------------------
const retailReceipt = {
  ...STORE_RETAIL,
  documentType: 'receipt',
  documentTitle: 'SALES RECEIPT',
  receiptNumber: 'RCT-002250',
  transactionNumber: '2250',
  laneNumber: '01',
  date: '23/08/2026 13:20',
  cashierName: 'R. Michael',
  currency: 'XCD',
  customer: { name: 'Walk-in' },
  items: [
    { name: 'Beach Towel', sku: 'BT-880', qty: 2, unitPrice: 45.00, lineTotal: 90.00, taxFlag: 'T' },
    { name: 'Sunscreen SPF50', sku: 'SS-501', qty: 1, unitPrice: 38.00, lineTotal: 38.00, taxFlag: 'T' },
    { name: 'Straw Hat', sku: 'SH-220', qty: 1, unitPrice: 65.00, lineTotal: 65.00, taxFlag: 'T' },
  ],
  subtotal: 193.00,
  taxBreakdown: [{ label: 'ABST 15%', rate: 15, taxableAmount: 193.00, taxAmount: 28.95 }],
  tax: 28.95,
  total: 221.95,
  payment: { method: 'Cash', amount: 225.00, tendered: 225.00, change: 3.05 },
  loyaltyPointsEarned: 22,
  loyaltyBalance: 145,
  footer: ['Thank you for your purchase!', 'Exchange within 30 days with receipt.'],
};

// ---------------------------------------------------------------------------
// SOUVENIR & GIFTS — item type / theme per line, final-sale wording (most
// tourist-facing gift shops sell final-sale or exchange-only, not refund),
// and a gift-receipt variant since "buying this as a gift" is the norm here,
// not the exception, unlike most other verticals.
// ---------------------------------------------------------------------------
const souvenirReceipt = {
  ...STORE_SOUVENIR,
  documentType: 'receipt',
  documentTitle: 'SALES RECEIPT',
  receiptNumber: 'RCT-006612',
  transactionNumber: '6612',
  date: '23/08/2026 14:05',
  cashierName: 'K. Francis',
  currency: 'XCD',
  customer: { name: 'Walk-in' },
  items: [
    { name: 'Eiffel Tower Keychain', sku: 'SV-KEY-014', itemType: 'Keychain',
      qty: 3, unitPrice: 8.00, lineTotal: 24.00, taxFlag: 'T' },
    { name: 'City Skyline Mug', sku: 'SV-MUG-071', itemType: 'Mug',
      qty: 1, unitPrice: 15.00, lineTotal: 15.00, taxFlag: 'T' },
    { name: 'Handwoven Basket', sku: 'SV-DEC-032', itemType: 'Home Decor',
      qty: 1, unitPrice: 42.00, lineTotal: 42.00, taxFlag: 'T' },
  ],
  subtotal: 81.00,
  taxBreakdown: [{ label: 'ABST 15%', rate: 15, taxableAmount: 81.00, taxAmount: 12.15 }],
  tax: 12.15,
  total: 93.15,
  payment: { method: 'Card', amount: 93.15, last4: '4402' },
  loyaltyPointsEarned: null,
  loyaltyBalance: null,
  returnPolicy: {
    windowDays: 0,
    // Tourist/gift retail is typically final-sale or exchange-only — unlike
    // apparel's 30-day exchange-first policy above, there is usually no
    // return window at all once the customer has left with the item.
    terms: 'All sales are final. Defective items may be exchanged within '
         + '7 days with receipt.',
  },
  footer: ['Thank you for shopping with us!', 'Safe travels!'],
};

/**
 * Gift receipt: same transaction with price, discount and payment suppressed
 * — same pattern as apparelGiftReceipt above, but arguably more relevant
 * here since a meaningful share of souvenir/gift-shop purchases ARE gifts.
 */
const souvenirGiftReceipt = {
  ...souvenirReceipt,
  documentTitle: 'GIFT RECEIPT',
  giftMode: true,
  items: souvenirReceipt.items.map(({ name, sku, itemType, qty }) => ({
    name, sku, itemType, qty,
  })),
  subtotal: null,
  taxBreakdown: [],
  tax: null,
  total: null,
  payment: null,
  loyaltyPointsEarned: null,
  loyaltyBalance: null,
};

// ---------------------------------------------------------------------------
// JEWELRY — purity, weights, making charges
// ---------------------------------------------------------------------------
// `hallmarkCharge` and `huid` are present but only rendered where the
// jurisdiction profile sets a hallmark regime (BIS_IN). Antigua has no
// equivalent mandate, so these must never be hardcoded into a template.
// ---------------------------------------------------------------------------
const jewelryInvoice = {
  ...STORE_JEWELRY,
  documentType: 'invoice',
  documentTitle: 'TAX INVOICE',
  invoiceNumber: 'INV-DR-002201',
  date: '23/08/2026',
  dueDate: '23/08/2026',
  cashierName: 'Marcus Hill',
  currency: 'USD',
  customer: CUSTOMER_LOCAL,
  items: [
    {
      name: '22KT Gold Necklace', sku: 'JW-N-2201', pieceCode: 'PC-000001',
      purity: '22KT', fineness: '916',
      grossWeight: 15.5, netWeight: 14.8, weightUnit: 'g',
      ratePerGram: 84.30, makingCharge: 185.00, stoneCharge: 0.00,
      hallmarkCharge: 45.00, huid: 'HUID-12345',
      qty: 1, amount: 1432.64, lineTotal: 1432.64, taxFlag: 'T',
    },
    {
      name: 'Diamond Stud Earrings', sku: 'JW-E-1104', pieceCode: 'PC-000002',
      purity: '18KT', fineness: '750',
      grossWeight: 3.8, netWeight: 3.2, weightUnit: 'g',
      ratePerGram: 69.00, makingCharge: 120.00, stoneCharge: 340.00,
      hallmarkCharge: 45.00, huid: 'HUID-12346',
      qty: 1, amount: 680.80, lineTotal: 680.80, taxFlag: 'T',
    },
  ],
  gemstones: [
    { type: 'Diamond', shape: 'Round Brilliant', carat: 0.50, colorGrade: 'G', clarity: 'VS1', count: 2 },
  ],
  subtotal: 2113.44,
  taxBreakdown: [{ label: 'ABST 15%', rate: 15, taxableAmount: 2113.44, taxAmount: 317.02 }],
  tax: 317.02,
  total: 2430.46,
  payment: { method: 'Card', amount: 2430.46, last4: '4242' },
  signatures: { customer: 'Customer Signature', authorized: 'Authorized Signature' },
  footer: ['Certificate of authenticity included.'],
};

// ---------------------------------------------------------------------------
// REPAIR TICKET — jewelry + electronics job card
// ---------------------------------------------------------------------------
// Fields not covered by a generic block (customer/header/store) are supplied
// as flat, pre-formatted display strings for the `custom` block's `accessor`
// lookups (see DEFAULT_BLOCKS.repair_ticket) — that block does no money/date
// formatting of its own, it just stringifies whatever the accessor resolves
// to. repairToPrintData.ts (frontend) builds these same field names from a
// real RepairOrder at print time.
const repairTicket = {
  ...STORE_JEWELRY,
  documentType: 'repair_ticket',
  documentNumber: 'RPR-2026-00142',
  date: '02/09/2026',
  customer: CUSTOMER_LOCAL,
  itemDescription: '18KT Gold Bracelet — clasp repair',
  metalWeightDisplay: '18KT · 12.4g',
  promisedDateDisplay: '09 Sep 2026',
  estimatedCostDisplay: '$85.00',
  advancePaidDisplay: '$40.00',
  balanceDueDisplay: '$45.00',
  statusLabel: 'In progress',
  problemDescription: 'Clasp is loose and one link is bent; customer reports it came apart while wearing.',
  workRequired: 'Re-solder clasp, straighten and re-polish affected link.',
  repairNotes: 'Minor scratching on the back of the clasp, noted at intake — pre-existing.',
  signatures: { customer: 'Customer Signature', authorized: 'Received By' },
};

const oldGoldVoucher = {
  ...STORE_JEWELRY,
  documentType: 'old_gold_voucher',
  documentNumber: 'OGV-2026-00087',
  date: '02/09/2026',
  customer: CUSTOMER_LOCAL,
  itemDescription: 'Old gold chain (broken)',
  metal: '22KT Gold',
  purityDisplay: '22KT (91.6%)',
  grossWeightDisplay: '18.500g',
  netWeightDisplay: '17.200g',
  ratePerGramDisplay: '$62.40',
  valuationDisplay: '$1,073.28',
  settlementDisplay: 'Redeemable against future purchase',
  signatures: { customer: 'Customer Signature', authorized: 'Authorised By' },
};

const memoSlip = {
  ...STORE_JEWELRY,
  documentType: 'memo_slip',
  documentNumber: 'MEMO-2026-00219',
  date: '02/09/2026',
  directionLabel: 'Memo Out — Sent to Customer',
  dueDateDisplay: '16 Sep 2026',
  customer: CUSTOMER_LOCAL,
  totalValueDisplay: '$4,280.00',
  items: [
    {
      pieceCode: 'RNG-00812', description: 'Diamond Solitaire Ring, 18KT',
      purity: '18KT', grossWeight: 6.2, qty: 1, unitPrice: 2850, lineTotal: 2850,
    },
    {
      pieceCode: 'ERR-00445', description: 'Pearl Drop Earrings, 14KT',
      purity: '14KT', grossWeight: 4.1, qty: 2, unitPrice: 715, lineTotal: 1430,
    },
  ],
  signatures: { customer: 'Customer Signature', authorized: 'Store Representative' },
};

const layawayAgreement = {
  ...STORE_JEWELRY,
  documentType: 'layaway_agreement',
  documentNumber: 'LAY-2026-00156',
  date: '02/09/2026',
  customer: CUSTOMER_LOCAL,
  scheduleDisplay: 'Monthly · 6 instalments',
  startDateDisplay: '02 Sep 2026',
  dueDateDisplay: '02 Mar 2027',
  installmentAmountDisplay: '$213.33',
  statusLabel: 'Active',
  items: [
    { description: 'Sapphire & Diamond Necklace, 18KT', qty: 1, unitPrice: 1280, lineTotal: 1280 },
  ],
  totalAmountDisplay: '$1,280.00',
  downPaymentDisplay: '$200.00',
  paidAmountDisplay: '$413.33',
  balanceDisplay: '$866.67',
  signatures: { customer: 'Customer Signature & Date', authorized: 'Authorised Staff & Date' },
};

const layawayReceipt = {
  ...STORE_JEWELRY,
  documentType: 'layaway_receipt',
  documentNumber: 'LAY-2026-00156',
  date: '02/10/2026',
  customer: CUSTOMER_LOCAL,
  paymentMethodDisplay: 'Cash',
  paymentAmountDisplay: '$213.33',
  totalAmountDisplay: '$1,280.00',
  previouslyPaidDisplay: '$413.33',
  newBalanceDisplay: '$653.34',
};

const savingsEnrollment = {
  ...STORE_JEWELRY,
  documentType: 'savings_enrollment',
  documentNumber: 'SSE-2026-00073',
  date: '02/09/2026',
  planName: 'Gold Plus 11+1',
  startDateDisplay: '15 Jan 2026',
  maturityDateDisplay: '15 Dec 2026',
  statusLabel: 'Active',
  customer: CUSTOMER_LOCAL,
  progressDisplay: '8 / 12 instalments (67%)',
  totalPaidDisplay: '$1,600.00',
  items: [
    { no: 1, dateDisplay: '15 Jan 2026', amount: 200, method: 'Cash', reference: '—' },
    { no: 2, dateDisplay: '15 Feb 2026', amount: 200, method: 'UPI', reference: 'UPI4471' },
    { no: 3, dateDisplay: '15 Mar 2026', amount: 200, method: 'Cash', reference: '—' },
  ],
  bonusDisplay: '+ $200.00',
  redeemableValueDisplay: '$1,800.00',
  signatures: { customer: 'Customer Signature', authorized: 'Authorised By' },
};

const orderAcknowledgement = {
  ...STORE_RETAIL,
  documentType: 'order_acknowledgement',
  documentNumber: 'ORD-2026-00341',
  date: '02/09/2026',
  customer: CUSTOMER_LOCAL,
  statusLabel: 'Processing',
  items: [
    { name: 'Wireless Mechanical Keyboard', qty: 1, unitPrice: 129, lineTotal: 129 },
    { name: 'USB-C Docking Station', qty: 2, unitPrice: 89, lineTotal: 178 },
  ],
  subtotal: 307,
  tax: 25.33,
  total: 332.33,
  notes: 'Backordered item — expected to ship within 5 business days.',
  signatures: { customer: 'Customer Signature', authorized: 'Authorised By' },
};

// ---------------------------------------------------------------------------
// DUTY-FREE — zero-rated export sale
// ---------------------------------------------------------------------------
// Duty-free requires passport AND boarding pass at the point of sale, and the
// purchaser's name must match the passport. A valid proof of sale must NOT be
// marked duplicate or reprint — so templates in this mode deliberately omit any
// reprint notice.
// ---------------------------------------------------------------------------
const dutyFreeJewelryInvoice = {
  ...STORE_JEWELRY,
  documentType: 'invoice',
  documentTitle: 'DUTY-FREE INVOICE',
  invoiceNumber: 'INV-DF-000318',
  date: '23/08/2026',
  cashierName: 'Marcus Hill',
  currency: 'USD',
  salesMode: 'duty_free',
  zeroRated: true,
  zeroRateReason: 'duty_free',

  customer: CUSTOMER_TRAVELLER,
  // Traveller documents captured at sale
  passportNumber: 'P12345678',
  passportCountry: 'USA',
  flightNumber: 'AA-2246',
  destination: 'Miami (MIA), USA',
  departureDate: '23/08/2026',

  items: [
    {
      name: '22KT Gold Bangle', sku: 'JW-B-3310', pieceCode: 'PC-000318',
      purity: '22KT', fineness: '916',
      grossWeight: 22.4, netWeight: 21.9, weightUnit: 'g',
      ratePerGram: 84.30, makingCharge: 240.00,
      qty: 1, amount: 2086.17, lineTotal: 2086.17, taxFlag: 'Z',
    },
  ],
  subtotal: 2086.17,
  taxBreakdown: [{ label: 'Zero-rated (export)', rate: 0, taxableAmount: 2086.17, taxAmount: 0 }],
  tax: 0.00,
  total: 2086.17,
  payment: { method: 'Card', amount: 2086.17, last4: '4242' },
  exportDeclaration:
    'These goods are supplied free of local consumption tax for export. '
    + 'They must be removed from Antigua and Barbuda by the purchaser and may not '
    + 'be consumed or resold within the territory.',
  legalText: [
    'Passport and boarding pass verified at point of sale.',
    'Purchaser name matches travel document.',
  ],
  signatures: { customer: 'Customer Signature', authorized: 'Authorized Signature' },
};

const dutyFreeRetailReceipt = {
  ...STORE_RETAIL,
  storeName: 'Heritage Duty-Free',
  documentType: 'receipt',
  documentTitle: 'DUTY-FREE RECEIPT',
  receiptNumber: 'DF-011902',
  date: '23/08/2026 16:05',
  cashierName: 'R. Michael',
  currency: 'USD',
  salesMode: 'duty_free',
  zeroRated: true,
  zeroRateReason: 'duty_free',
  customer: CUSTOMER_TRAVELLER,
  passportNumber: 'P12345678',
  passportCountry: 'USA',
  flightNumber: 'AA-2246',
  destination: 'Miami (MIA), USA',
  departureDate: '23/08/2026',
  items: [
    { name: 'Caribbean Rum 1L', sku: 'LQ-RUM-1L', qty: 2, unitPrice: 32.00, lineTotal: 64.00, taxFlag: 'Z' },
    { name: 'Perfume 100ml', sku: 'PF-100', qty: 1, unitPrice: 89.00, lineTotal: 89.00, taxFlag: 'Z' },
  ],
  subtotal: 153.00,
  taxBreakdown: [{ label: 'Zero-rated (export)', rate: 0, taxableAmount: 153.00, taxAmount: 0 }],
  tax: 0.00,
  total: 153.00,
  payment: { method: 'Card', amount: 153.00, last4: '4242' },
  exportDeclaration:
    'Goods supplied for export. Liquids must remain in the sealed tamper-evident '
    + 'bag with this receipt visible until final destination.',
  footer: ['Safe travels!'],
};

// ---------------------------------------------------------------------------
// REVERSE CHARGE — cross-border B2B, liability shifts to the buyer
// ---------------------------------------------------------------------------
// Available in 165+ VAT/GST countries. The seller charges nothing but the
// invoice MUST carry prescribed wording and the buyer's tax number, otherwise
// it is not valid for the scheme. Demonstrates a jurisdiction (EU) whose
// mandatory title, tax label and tax-ID label all differ from Antigua.
// ---------------------------------------------------------------------------
const reverseChargeInvoice = {
  storeName: 'Zettaz Trading BV',
  storeAddress: 'Keizersgracht 120, 1015 CV Amsterdam',
  storePhone: '+31-20-555-0110',
  storeTel: '+31-20-555-0110',
  storeEmail: 'invoices@zettaz.nl',
  storeTaxId: 'NL857441932B01',

  documentType: 'invoice',
  documentTitle: 'INVOICE',
  // Supplied by the jurisdiction profile; overrides any user-set title.
  mandatoryInvoiceTitle: null,
  taxLabel: 'VAT',
  taxIdLabel: 'VAT No.',
  requiresCustomerTaxId: true,

  invoiceNumber: 'INV-NL-002091',
  date: '23/08/2026',
  dueDate: '22/09/2026',
  currency: 'EUR',

  customer: {
    name: 'Beispiel GmbH',
    address: 'Friedrichstrasse 88',
    city: 'Berlin',
    postalCode: '10117',
    country: 'Germany',
    email: 'ap@beispiel.de',
    taxId: 'DE123456789',
  },

  items: [
    { name: 'Consulting Services', description: 'Implementation, August 2026',
      qty: 40, unitPrice: 125.00, lineTotal: 5000.00, taxFlag: 'RC' },
  ],

  subtotal: 5000.00,
  taxBreakdown: [
    { label: 'Reverse charge — 0%', rate: 0, taxableAmount: 5000.00, taxAmount: 0 },
  ],
  tax: 0.00,
  total: 5000.00,
  zeroRated: true,
  zeroRateReason: 'reverse_charge',
  reverseChargeText: 'Reverse charge: customer to account for VAT',
  payment: { method: 'Bank Transfer', amount: 5000.00, reference: 'INV-NL-002091' },
  terms: 'Payment due within 30 days.',
};

// ---------------------------------------------------------------------------
// TAX REFUND — tax-free shopping (traveller pays tax, reclaims on export)
// ---------------------------------------------------------------------------
// Distinct from duty-free: here the tax IS charged and the traveller reclaims it
// after customs validates the export. The retailer must state the goods, the
// price, the admin charge and the refund actually due, and must mark the till
// receipt to show the goods were included on a refund form.
// ---------------------------------------------------------------------------
const taxRefundInvoice = {
  storeName: 'Zettaz London',
  storeAddress: '18 Regent Street, London SW1Y 4PZ',
  storePhone: '+44-20-7555-0130',
  storeTel: '+44-20-7555-0130',
  storeEmail: 'retail@zettaz.co.uk',
  storeTaxId: 'GB432109876',

  documentType: 'invoice',
  documentTitle: 'TAX FREE SHOPPING INVOICE',
  taxLabel: 'VAT',
  taxIdLabel: 'VAT No.',
  currency: 'GBP',
  invoiceNumber: 'INV-UK-004410',
  date: '23/08/2026',
  salesMode: 'domestic',

  customer: { ...CUSTOMER_TRAVELLER, name: 'Jane Doe', country: 'USA' },
  passportNumber: 'P12345678',
  passportCountry: 'USA',
  flightNumber: 'BA-0117',
  destination: 'New York (JFK), USA',
  departureDate: '26/08/2026',
  arrivalDate: '18/08/2026',

  items: [
    { name: 'Cashmere Coat', sku: 'CC-880-M', size: 'M', color: 'Camel',
      qty: 1, unitPrice: 750.00, lineTotal: 750.00, taxFlag: 'T' },
  ],

  subtotal: 625.00,
  taxBreakdown: [
    { label: 'VAT 20%', rate: 20, taxableAmount: 625.00, taxAmount: 125.00 },
  ],
  tax: 125.00,
  total: 750.00,
  payment: { method: 'Card', amount: 750.00, last4: '4242' },

  taxRefund: {
    schemeName: 'VAT407',
    formRef: 'RF-2026-004410',
    adminCharge: 18.75,
    refundDue: 106.25,
  },
  taxRefundSchemeName: 'VAT407',
};

// ---------------------------------------------------------------------------
// FISCALIZED — Portugal (ATCUD + QR + AT-certified software)
// ---------------------------------------------------------------------------
// The fiscal signature here is ILLUSTRATIVE ONLY. In production it is produced
// per-transaction by a certified backend integration; nothing in the frontend
// generates it. See frontend/src/utils/fiscalBlockModel.ts.
// ---------------------------------------------------------------------------
const fiscalizedReceipt = {
  storeName: 'Zettaz Lisboa',
  storeAddress: 'Rua Augusta 210, 1100-053 Lisboa',
  storePhone: '+351-21-555-0140',
  storeTel: '+351-21-555-0140',
  storeEmail: 'loja@zettaz.pt',
  storeTaxId: '514289377',

  documentType: 'receipt',
  documentTitle: 'FATURA SIMPLIFICADA',
  taxLabel: 'IVA',
  taxIdLabel: 'NIF',
  currency: 'EUR',
  receiptNumber: 'FS 2026/004471',
  date: '23/08/2026 14:22',
  cashierName: 'M. Sousa',

  // Jurisdiction says this country mandates fiscal receipts.
  fiscalizationEnabled: true,
  fiscalizationScheme: 'PT_ATCUD',

  fiscal: {
    scheme: 'PT_ATCUD',
    documentId: 'CSDF7T5H-4471',
    signature: 'kIu8B2p9wQrX7mNvLd3JhFgT6yUiOp1aSdFgHjKlZxCvBnM=',
    qrPayload: 'A:514289377*B:999999990*C:PT*D:FS*E:N*F:20260823*G:FS 2026/004471',
    softwareId: 'AT-2841/1',
    deviceSerial: 'POS-LIS-004',
  },

  customer: { name: 'Consumidor Final' },
  items: [
    { name: 'Café', qty: 2, unitPrice: 0.85, lineTotal: 1.70, taxFlag: 'T' },
    { name: 'Pastel de Nata', qty: 3, unitPrice: 1.20, lineTotal: 3.60, taxFlag: 'T' },
  ],
  subtotal: 4.31,
  taxBreakdown: [
    { label: 'IVA 23%', rate: 23, taxableAmount: 4.31, taxAmount: 0.99 },
  ],
  tax: 0.99,
  total: 5.30,
  payment: { method: 'Cash', amount: 10.00, tendered: 10.00, change: 4.70 },
  footer: ['Obrigado pela sua visita!'],
};

// ---------------------------------------------------------------------------
// LABELS
// ---------------------------------------------------------------------------
const labelJewelry50x25 = {
  pieceCode: 'PC-000001',
  name: '22KT Gold Ring',
  sku: 'JW-R-1001',
  purity: '22KT',
  netWeight: 5.25,
  weightUnit: 'g',
  sellingPrice: 450.00,
  currency: 'USD',
  barcode: 'PC-000001',
};

const labelApparel40x20 = {
  name: 'Linen Shirt',
  sku: 'LS-114-M-WHT',
  size: 'M',
  color: 'White',
  sellingPrice: 189.00,
  currency: 'XCD',
  barcode: 'LS-114-M-WHT',
};

const labelGrocery40x20 = {
  name: 'Bananas',
  plu: '4011',
  weight: 1.24,
  weightUnit: 'kg',
  pricePerUnit: 3.99,
  sellingPrice: 4.95,
  currency: 'XCD',
  barcode: '2040110004954',
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------
// Keyed by template_type, then fixture name. FIXTURE_FOR() in the designer maps
// a template's type + paper size onto one of these.
// ---------------------------------------------------------------------------
const printFixtureSuite = {
  receipt: {
    '58mm_receipt': retailReceipt,
    '80mm_receipt': retailReceipt,
    grocery: groceryReceipt,
    pharmacy: pharmacyReceipt,
    apparel: apparelReceipt,
    apparel_gift: apparelGiftReceipt,
    souvenir: souvenirReceipt,
    souvenir_gift: souvenirGiftReceipt,
    retail: retailReceipt,
    duty_free: dutyFreeRetailReceipt,
    fiscalized: fiscalizedReceipt,
  },
  invoice: {
    a4_letter: retailInvoice,
    electronics: electronicsInvoice,
    // Was electronicsInvoice, which meant a general-retail invoice previewed
    // with serial numbers, IMEIs and warranty terms — content a hardware shop
    // has no rows for. A vertical must not borrow another vertical's fixture.
    retail: retailInvoice,
    reverse_charge: reverseChargeInvoice,
    tax_refund: taxRefundInvoice,
  },
  return: {
    retail: retailReturn,
    domestic: retailReturn,
  },
  jewelry_invoice: {
    duty_free: dutyFreeJewelryInvoice,
    domestic: jewelryInvoice,
  },
  jewelry_certificate: {
    domestic: jewelryInvoice,
  },
  document: {
    a4_letter: electronicsInvoice,
  },
  label: {
    '50x25_jewelry_tag': labelJewelry50x25,
    '40x20_jewelry_tag': labelJewelry50x25,
    '40x20_apparel_tag': labelApparel40x20,
    '40x20_grocery_tag': labelGrocery40x20,
  },
  repair_ticket: {
    domestic: repairTicket,
  },
  old_gold_voucher: {
    domestic: oldGoldVoucher,
  },
  memo_slip: {
    domestic: memoSlip,
  },
  layaway_agreement: {
    domestic: layawayAgreement,
  },
  layaway_receipt: {
    domestic: layawayReceipt,
  },
  savings_enrollment: {
    domestic: savingsEnrollment,
  },
  order_acknowledgement: {
    domestic: orderAcknowledgement,
  },
};

/** Vertical -> the fixture that best demonstrates it. Drives preset previews. */
const FIXTURE_BY_VERTICAL = {
  jewelry: ['jewelry_invoice', 'domestic'],
  grocery: ['receipt', 'grocery'],
  pharmacy: ['receipt', 'pharmacy'],
  electronics: ['invoice', 'electronics'],
  apparel: ['receipt', 'apparel'],
  retail: ['receipt', 'retail'],
  souvenir_gifts: ['receipt', 'souvenir'],
};

/** Get fixture data by type and name. */
function getFixture(type, name) {
  return (printFixtureSuite[type] && printFixtureSuite[type][name]) || null;
}

/** Resolve the best fixture for a vertical, optionally in duty-free mode. */
function getFixtureForVertical(vertical, { dutyFree = false } = {}) {
  if (dutyFree) {
    return vertical === 'jewelry'
      ? dutyFreeJewelryInvoice
      : dutyFreeRetailReceipt;
  }
  const mapping = FIXTURE_BY_VERTICAL[vertical];
  return mapping ? getFixture(mapping[0], mapping[1]) : null;
}

/** List available fixtures as "type/name" strings. */
function listFixtures() {
  const result = [];
  for (const [type, fixtures] of Object.entries(printFixtureSuite)) {
    for (const name of Object.keys(fixtures)) {
      result.push(`${type}/${name}`);
    }
  }
  return result;
}

module.exports = {
  printFixtureSuite,
  FIXTURE_BY_VERTICAL,

  // Per-vertical
  groceryReceipt,
  pharmacyReceipt,
  electronicsInvoice,
  apparelReceipt,
  apparelGiftReceipt,
  souvenirReceipt,
  souvenirGiftReceipt,
  retailReceipt,
  retailInvoice,
  retailReturn,
  jewelryInvoice,

  // Duty-free
  dutyFreeJewelryInvoice,
  dutyFreeRetailReceipt,

  // Cross-border B2B
  reverseChargeInvoice,

  // Tax-free shopping (traveller VAT refund)
  taxRefundInvoice,

  // Fiscalized jurisdiction (Portugal ATCUD)
  fiscalizedReceipt,

  // Labels
  labelJewelry50x25,
  labelApparel40x20,
  labelGrocery40x20,

  getFixture,
  getFixtureForVertical,
  listFixtures,
};
