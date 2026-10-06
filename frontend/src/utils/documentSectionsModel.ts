/**
 * Grouped document sections — parties and the page footer.
 *
 * SHARED BY BOTH RENDERERS, deliberately.
 *
 * Every rule about what appears and when lives here; TemplateCanvas and
 * printTemplateRenderer only draw the result. Two implementations of one rule
 * have drifted twice in this codebase already — the document number label, and
 * the custom-row accessor — so new layout work starts shared rather than
 * getting factored out after the first bug.
 */

/** One labelled party or detail column in the band. */
export interface PartyColumn {
  label: string;
  /** Rendered slightly heavier — the name, not the address. */
  heading?: string;
  lines: string[];
}

export interface PartiesConfig {
  /** Show the details column (terms, due date, PO). Default true. */
  showDetails?: boolean;
  /**
   * Force the ship-to column on even when it matches billing.
   * Off by default — see shouldShowShipTo.
   */
  alwaysShowShipTo?: boolean;
  billLabel?: string;
  shipLabel?: string;
  detailsLabel?: string;
  /** Print "Walk-in Customer" under "Bill to" when no customer was selected at
   * checkout, instead of omitting the column entirely. Default true. */
  showWalkInFallback?: boolean;
}

const clean = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));

/** Compare addresses ignoring case, punctuation and whitespace. */
const sameAddress = (a: string, b: string): boolean => {
  const norm = (s: string) => s.toLowerCase().replace(/[\s,.\-]/g, '');
  return norm(a) === norm(b) && norm(a) !== '';
};

/**
 * Should the Ship To column appear?
 *
 * Only when a shipping address EXISTS and DIFFERS from billing. Printing
 * "Ship to" identical to "Bill to" is noise on every counter sale, and it is
 * the common case — most retail has no separate delivery address at all.
 *
 * `alwaysShowShipTo` exists for wholesale operations whose customers expect the
 * column even when the two match, because their goods-in desk looks for it.
 */
export function shouldShowShipTo(data: any, cfg: PartiesConfig = {}): boolean {
  const ship = clean(data?.customer?.shippingAddress ?? data?.shippingAddress);
  if (!ship) return false;
  if (cfg.alwaysShowShipTo) return true;

  const bill = clean(
    data?.customer?.billingAddress ?? data?.customerAddress ?? data?.customer?.address,
  );
  return !sameAddress(ship, bill);
}

/**
 * City/state/postcode as a second address line — but only the parts the
 * address string does not already contain.
 *
 * `address` is inconsistent across customer records: sometimes it is a full
 * one-line address that already includes the city, sometimes it is
 * street-only with city/state/postcode held in separate fields. The old
 * customer-details block composed a second line from those fields, skipping
 * any part already present in the address string so the city never printed
 * twice. Ported here so routing an invoice through the parties band cannot
 * silently drop a customer's city, state or postcode.
 */
function cityLine(customer: any, address: string): string {
  const parts = [customer?.city, customer?.state, customer?.postalCode, customer?.country]
    .map(clean)
    .filter(Boolean);
  const addressLower = address.toLowerCase();
  return parts.filter((p) => !addressLower.includes(p.toLowerCase())).join(', ');
}

/**
 * Build the party columns.
 *
 * Empty lines are dropped rather than printed blank — a "Bill to" heading over
 * three empty rows reads as a fault, and blocks that self-suppress on absent
 * data are how the rest of this renderer behaves.
 */
export function buildParties(data: any, cfg: PartiesConfig = {}): PartyColumn[] {
  const columns: PartyColumn[] = [];

  const customerName = clean(data?.customerName ?? data?.customer?.name);
  const customer = data?.customer || {};
  const billAddress = clean(
    customer.billingAddress ?? data?.customerAddress ?? customer.address,
  );
  const billLines = [
    billAddress,
    cityLine(customer, billAddress),
    clean(data?.customerPhone ?? data?.customer?.phone),
    clean(data?.customerTaxId ?? data?.customer?.taxId),
  ].filter(Boolean);

  // A walk-in sale (no customer selected at checkout) has no name/address to
  // print, but omitting the "Bill to" column entirely made a printed invoice
  // look like the customer section was broken rather than intentionally
  // anonymous — real jewelry/retail invoices conventionally print "Walk-in
  // Customer" for exactly this case rather than leaving it blank.
  if (customerName || billLines.length) {
    columns.push({
      label: cfg.billLabel || 'Bill to',
      heading: customerName || undefined,
      lines: billLines,
    });
  } else if (cfg.showWalkInFallback !== false) {
    columns.push({
      label: cfg.billLabel || 'Bill to',
      heading: 'Walk-in Customer',
      lines: [],
    });
  }

  if (shouldShowShipTo(data, cfg)) {
    columns.push({
      label: cfg.shipLabel || 'Ship to',
      heading: customerName || undefined,
      lines: [clean(data?.customer?.shippingAddress ?? data?.shippingAddress)].filter(Boolean),
    });
  }

  if (cfg.showDetails !== false) {
    const detailLines = [
      data?.terms ? `Terms ${clean(data.terms)}` : '',
      data?.dueDate ? `Due ${clean(data.dueDate)}` : '',
      data?.orderNumber ? `PO ${clean(data.orderNumber)}` : '',
    ].filter(Boolean);
    if (detailLines.length) {
      columns.push({ label: cfg.detailsLabel || 'Details', lines: detailLines });
    }
  }

  return columns;
}

export interface FooterConfig {
  /** Which pieces to print. Defaults to all of them. */
  footerFields?: string[];
}

export interface PageFooterModel {
  /** Left side — who and where. */
  left: string;
  /** Right side — how to reach them, and the tax number. */
  right: string[];
}

/**
 * Build the page footer.
 *
 * WHY THE TAX ID BELONGS HERE
 * ---------------------------
 * Moving the store's contact details out of the header buys the top of the page
 * a lot of air, but in most VAT/GST jurisdictions the seller's address AND tax
 * number must appear on an invoice. The footer satisfies that — provided the
 * tax number actually comes with them.
 *
 * It sits on the right beside the phone and email rather than trailing the
 * address, because it is the line an accounts department looks for and it gets
 * lost at the end of a street address.
 *
 * The renderers repeat this on every page. A footer that lands only on the last
 * page leaves page one non-compliant on its own.
 */
export function buildPageFooter(data: any, cfg: FooterConfig = {}): PageFooterModel | null {
  const want = new Set(cfg.footerFields || ['address', 'phone', 'email', 'taxId']);

  const name = clean(data?.storeName);
  const address = want.has('address') ? clean(data?.storeAddress) : '';
  const left = [name, address].filter(Boolean).join(' · ');

  const contact = [
    want.has('phone') ? clean(data?.storePhone ?? data?.storeTel) : '',
    want.has('email') ? clean(data?.storeEmail) : '',
  ].filter(Boolean).join(' · ');

  const taxLabel = clean(data?.taxIdLabel) || 'Tax ID';
  const taxId = want.has('taxId') && data?.storeTaxId
    ? `${taxLabel} ${clean(data.storeTaxId)}`
    : '';

  const right = [contact, taxId].filter(Boolean);

  // Nothing to say — print nothing rather than an empty rule across the page.
  if (!left && right.length === 0) return null;

  return { left, right };
}
