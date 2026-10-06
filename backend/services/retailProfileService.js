/**
 * Retail Profile Service
 *
 * Answers one question: **what kind of shop is this, and therefore which
 * documents does it need?**
 *
 * A store's retail profile is two facts:
 *   INDUSTRY    jewelry | grocery | electronics | apparel | pharmacy | general_retail
 *   SALES MODE  domestic | duty_free | export | mixed
 *
 * Those two determine the template set. Keeping the decision here — rather than
 * scattered through the print module — means adding a vertical is one change,
 * and the same answer drives onboarding, the template gallery, and the
 * auto-provisioning that gives a new tenant working documents on day one.
 *
 * SINGLE SOURCE OF TRUTH
 * ----------------------
 * Duty-free lives in `store_jurisdiction_settings.sales_mode`, which the tax
 * engine already reads. `stores.is_duty_free` is a denormalised mirror kept in
 * sync by this service, never edited directly — two independently writable
 * copies is how you end up with a checkbox that says duty-free while the
 * receipt charges tax.
 */

'use strict';

const { pool } = require('../config/db');
const jurisdictionService = require('./jurisdictionService');

// ---------------------------------------------------------------------------
// Verticals
// ---------------------------------------------------------------------------

/** Codes mirror industry_types and backend/services/industryMapping.js. */
const INDUSTRIES = {
  general_retail: { label: 'General Retail', available: true },
  grocery:        { label: 'Grocery & Supermarket', available: true },
  electronics:    { label: 'Electronics', available: true },
  apparel:        { label: 'Apparel & Fashion', available: true },
  jewelry:        { label: 'Jewelry & Bullion', available: true },
  // Held back pending review of dispensing records against each target market's
  // board-of-pharmacy rules. The code path works; it is simply not offered.
  pharmacy:       { label: 'Pharmacy', available: false,
                    unavailableReason: 'Pending regulatory review' },
  souvenir_gifts: { label: 'Souvenir & Gifts', available: true },
};
// NOTE: this list is a separate, hardcoded mirror of the `industry_types`
// table (see backend/services/industryFieldService.js, which reads that
// table directly) rather than querying it — a real duplication risk flagged
// in docs/17-migration-and-roadmap/22_Tenant_vs_Store_Business_Identity_Audit_And_Plan.md.
// Adding a new industry_types row (as souvenir_gifts's seed did) requires
// remembering to also add it HERE or it silently can't be selected as a
// per-store override even though it works everywhere else. Not refactored to
// read the table dynamically in this pass — availableIndustries() is called
// synchronously from its route handler, so doing so would also require
// converting that call site to async.

const DEFAULT_INDUSTRY = 'general_retail';

const isIndustryAvailable = (code) => Boolean(INDUSTRIES[code]?.available);

/** Verticals a tenant may actually select. */
const availableIndustries = () =>
  Object.entries(INDUSTRIES)
    .filter(([, v]) => v.available)
    .map(([code, v]) => ({ code, label: v.label }));

// ---------------------------------------------------------------------------
// Template plan
// ---------------------------------------------------------------------------

/**
 * Documents each vertical needs.
 *
 * `templateType` selects the DEFAULT_BLOCKS set; `presetId` links to the
 * frontend preset catalog so the gallery and auto-provisioning agree.
 */
const INDUSTRY_TEMPLATES = {
  general_retail: [
    { presetId: 'retail-receipt-80',   name: 'Sales Receipt',  templateType: 'receipt', isDefault: true },
    // 'invoice' DEFAULT_BLOCKS is the clean A4 look as of 2026-08 — it used to
    // ship as a separate opt-in "Invoice (Clean)" preset; promoted to the
    // default rather than leaving two near-identical invoices in the plan.
    { presetId: 'retail-invoice-a4',   name: 'Invoice',        templateType: 'invoice' },
    { presetId: 'order-acknowledgement-a4', name: 'Order Acknowledgement', templateType: 'order_acknowledgement' },
  ],
  grocery: [
    { presetId: 'grocery-receipt-80',  name: 'Grocery Receipt', templateType: 'receipt', isDefault: true },
    { presetId: 'order-acknowledgement-a4', name: 'Order Acknowledgement', templateType: 'order_acknowledgement' },
  ],
  electronics: [
    { presetId: 'retail-receipt-80',      name: 'Sales Receipt', templateType: 'receipt', isDefault: true },
    { presetId: 'electronics-invoice-a4', name: 'Tax Invoice',   templateType: 'invoice' },
    // Repairs is jewelry + electronics (see RepairsPage.tsx's IndustryRoute
    // guard) — both verticals need the same Repair Ticket document type.
    { presetId: 'repair-ticket-a4', name: 'Repair Ticket', templateType: 'repair_ticket' },
    { presetId: 'order-acknowledgement-a4', name: 'Order Acknowledgement', templateType: 'order_acknowledgement' },
  ],
  apparel: [
    { presetId: 'apparel-receipt-80', name: 'Sales Receipt', templateType: 'receipt', isDefault: true },
    { presetId: 'apparel-gift-80',    name: 'Gift Receipt',  templateType: 'receipt',
      overrides: { giftMode: true } },
    { presetId: 'order-acknowledgement-a4', name: 'Order Acknowledgement', templateType: 'order_acknowledgement' },
  ],
  souvenir_gifts: [
    { presetId: 'souvenir-receipt-80', name: 'Sales Receipt', templateType: 'receipt', isDefault: true },
    { presetId: 'souvenir-gift-80',    name: 'Gift Receipt',  templateType: 'receipt',
      overrides: { giftMode: true } },
    { presetId: 'order-acknowledgement-a4', name: 'Order Acknowledgement', templateType: 'order_acknowledgement' },
  ],
  jewelry: [
    { presetId: 'retail-receipt-80',        name: 'Sales Receipt',  templateType: 'receipt', isDefault: true },
    { presetId: 'jewelry-invoice-a4',       name: 'Jewelry Invoice', templateType: 'jewelry_invoice' },
    { presetId: 'jewelry-certificate-a4',   name: 'Certificate of Authenticity',
      templateType: 'jewelry_certificate' },
    { presetId: 'repair-ticket-a4', name: 'Repair Ticket', templateType: 'repair_ticket' },
    { presetId: 'old-gold-voucher-80', name: 'Old Gold Voucher', templateType: 'old_gold_voucher' },
    { presetId: 'memo-slip-a4', name: 'Consignment Memo', templateType: 'memo_slip' },
    { presetId: 'layaway-agreement-a4', name: 'Layaway Agreement', templateType: 'layaway_agreement' },
    { presetId: 'layaway-receipt-80', name: 'Layaway Payment Receipt', templateType: 'layaway_receipt' },
    { presetId: 'savings-enrollment-a4', name: 'Savings Passbook', templateType: 'savings_enrollment' },
    { presetId: 'order-acknowledgement-a4', name: 'Order Acknowledgement', templateType: 'order_acknowledgement' },
  ],
  pharmacy: [
    { presetId: 'pharmacy-receipt-80', name: 'Pharmacy Receipt', templateType: 'receipt', isDefault: true },
    { presetId: 'order-acknowledgement-a4', name: 'Order Acknowledgement', templateType: 'order_acknowledgement' },
  ],
};

/**
 * Extra documents a duty-free store needs, on top of its vertical's set.
 *
 * Duty-free is a MODE, not a vertical — a duty-free jeweller needs both a
 * domestic invoice (local walk-in customers) and a duty-free one (departing
 * travellers). It adds documents rather than replacing them.
 */
const DUTY_FREE_TEMPLATES = {
  jewelry: [
    { presetId: 'jewelry-dutyfree-a4', name: 'Duty-Free Invoice',
      templateType: 'jewelry_invoice', salesMode: 'duty_free' },
  ],
  _default: [
    { presetId: 'retail-dutyfree-80', name: 'Duty-Free Receipt',
      templateType: 'receipt', salesMode: 'duty_free' },
  ],
};

/**
 * The template set a store should have.
 *
 * @param {string}  industryCode
 * @param {object}  opts
 * @param {boolean} opts.dutyFree   Store sells duty-free / export
 * @param {boolean} opts.taxRefund  Jurisdiction runs a traveller refund scheme
 * @returns {Array} plan entries
 */
function planTemplates(industryCode, { dutyFree = false, taxRefund = false } = {}) {
  const industry = INDUSTRIES[industryCode] ? industryCode : DEFAULT_INDUSTRY;
  const plan = [...(INDUSTRY_TEMPLATES[industry] || INDUSTRY_TEMPLATES[DEFAULT_INDUSTRY])];

  /*
   * Every vertical refunds, so every vertical needs a refund slip. Adding it
   * per-vertical would be five copies of the same line, and the one that got
   * forgotten would only surface when a customer asked for their money back.
   *
   * Not a default: `isDefault` marks the document printed for a SALE.
   */
  plan.push({
    presetId: 'retail-return-80',
    name: 'Refund / Credit Note',
    templateType: 'return',
  });

  if (dutyFree) {
    plan.push(...(DUTY_FREE_TEMPLATES[industry] || DUTY_FREE_TEMPLATES._default));
  }

  // Tax-free shopping is distinct from duty-free: the traveller pays tax and
  // reclaims it on export, so the store needs a refund-form document too.
  if (taxRefund) {
    plan.push({
      presetId: 'taxrefund-invoice-a4',
      name: 'Tax-Free Shopping Invoice',
      templateType: 'invoice',
      salesMode: 'tax_refund',
    });
  }

  return plan;
}

// ---------------------------------------------------------------------------
// Reading and writing a store's profile
// ---------------------------------------------------------------------------

/**
 * Resolve a store's full retail profile, including the templates it should have.
 */
async function getRetailProfile(tenantId, storeId) {
  if (!tenantId) throw new Error('getRetailProfile requires a tenantId');

  const [rows] = await pool.query(
    `SELECT s.id, s.name, s.industry_code AS store_industry, s.is_duty_free,
            s.country_code, s.currency_code,
            t.industry_code AS tenant_industry, t.settings AS tenant_settings
       FROM stores s
       JOIN tenants t ON t.id = s.tenant_id
      WHERE s.id = ? AND s.tenant_id = ?
      LIMIT 1`,
    [storeId, tenantId],
  );

  const row = rows[0];

  // Some tenants — pre-dating the dedicated `tenants.industry_code` column —
  // only ever had their industry written into the `tenants.settings` JSON
  // blob during onboarding. industryFieldService.getTenantIndustry() already
  // falls back to that blob; this resolution has to match it, or a tenant the
  // rest of the app correctly treats as jewelry silently gets planned as
  // general_retail here — which is exactly what happened: the print-template
  // backfill script found only "Order Acknowledgement" missing for several
  // real jewelry tenants because their 6 jewelry-specific documents were
  // never even in the plan, `general_retail` doesn't carry them.
  let tenantIndustryFromSettings = null;
  if (!row?.tenant_industry && row?.tenant_settings) {
    try {
      const settings = typeof row.tenant_settings === 'string'
        ? JSON.parse(row.tenant_settings) : row.tenant_settings;
      tenantIndustryFromSettings = settings?.industry_code || null;
    } catch (_) { /* ignore malformed settings JSON */ }
  }

  // Store industry wins over tenant — a group may run mixed formats.
  const industryCode = row?.store_industry || row?.tenant_industry
    || tenantIndustryFromSettings || DEFAULT_INDUSTRY;

  const jurisdiction = await jurisdictionService.getJurisdictionProfile(tenantId, storeId);
  const dutyFree = jurisdiction.isDutyFree || jurisdiction.isExport;
  const taxRefund = Boolean(jurisdiction.profile?.supportsTaxRefund);

  // Document-number display. Separate from whether a number is ISSUED — a shop
  // can want gapless numbering for its books without printing it on a slip.
  const [numbering] = await pool.query(
    `SELECT sequential_numbering_optin AS optin,
            show_number_on_receipt     AS on_receipt,
            show_number_on_invoice     AS on_invoice
       FROM store_jurisdiction_settings
      WHERE store_id = ? AND tenant_id = ?
      LIMIT 1`,
    [storeId, tenantId],
  );
  const numberingRow = numbering[0] || {};

  return {
    storeId,
    storeName: row?.name || null,
    industryCode,
    industryLabel: INDUSTRIES[industryCode]?.label || industryCode,
    industryAvailable: isIndustryAvailable(industryCode),
    // True when THIS store has its own stores.industry_code value rather
    // than inheriting the tenant's company-wide default. Lets the UI show
    // "Inherit from company (General Retail)" vs "Overridden: Jewelry".
    industryIsOverride: Boolean(row?.store_industry),
    salesMode: jurisdiction.salesMode,
    isDutyFree: dutyFree,
    supportsTaxRefund: taxRefund,
    countryCode: row?.country_code || null,
    currencyCode: row?.currency_code || null,

    // Is a gapless number allocated? Forced on where the jurisdiction demands
    // it — a tenant must not be able to switch off a legal obligation.
    sequentialNumbering: Boolean(
      jurisdiction.profile?.requiresSequentialNumbering
      || Number(numberingRow.optin) === 1,
    ),
    sequentialNumberingMandatory: Boolean(jurisdiction.profile?.requiresSequentialNumbering),

    // Is it PRINTED as text? A separate decision — see documentNumberVisibility.
    showNumberOnReceipt: Boolean(Number(numberingRow.on_receipt)),
    showNumberOnInvoice: numberingRow.on_invoice === undefined
      ? true
      : Boolean(Number(numberingRow.on_invoice)),

    templatePlan: planTemplates(industryCode, { dutyFree, taxRefund }),
  };
}

/**
 * Update a store's retail profile.
 *
 * Duty-free writes through to `store_jurisdiction_settings.sales_mode` — the
 * single source of truth — and the `stores.is_duty_free` mirror is refreshed in
 * the same transaction so the two cannot drift.
 */
async function updateRetailProfile(tenantId, storeId, {
  industryCode,
  isDutyFree,
  sequentialNumbering,
  showNumberOnReceipt,
  showNumberOnInvoice,
} = {}) {
  if (!tenantId || !storeId) throw new Error('tenantId and storeId are required');

  // `industryCode: null` (explicit) means "reset this store to inherit the
  // tenant's company-wide default" — distinct from `undefined`, which means
  // "don't touch this field at all" (e.g. a request that's only changing
  // duty-free). Only a real code string goes through the catalog check.
  const resettingToInherit = industryCode === null;
  if (industryCode !== undefined && !resettingToInherit) {
    if (!INDUSTRIES[industryCode]) {
      const err = new Error(`Unknown industry: ${industryCode}`);
      err.statusCode = 400;
      throw err;
    }
    if (!isIndustryAvailable(industryCode)) {
      const err = new Error(
        `${INDUSTRIES[industryCode].label} is not available yet — `
        + `${INDUSTRIES[industryCode].unavailableReason}`,
      );
      err.statusCode = 400;
      throw err;
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (industryCode !== undefined) {
      await conn.query(
        'UPDATE stores SET industry_code = ? WHERE id = ? AND tenant_id = ?',
        [resettingToInherit ? null : industryCode, storeId, tenantId],
      );
    }

    if (isDutyFree !== undefined) {
      const salesMode = isDutyFree ? 'duty_free' : 'domestic';

      // Source of truth. Duty-free requires traveller documents at the point of
      // sale, so those requirements are set together — a duty-free store that
      // does not capture a passport cannot evidence the export.
      await conn.query(
        `INSERT INTO store_jurisdiction_settings
           (store_id, tenant_id, sales_mode, requires_passport, requires_boarding_pass)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           sales_mode = VALUES(sales_mode),
           requires_passport = VALUES(requires_passport),
           requires_boarding_pass = VALUES(requires_boarding_pass)`,
        [storeId, tenantId, salesMode, isDutyFree ? 1 : 0, isDutyFree ? 1 : 0],
      );

      // Denormalised mirror, updated in the same transaction.
      await conn.query(
        'UPDATE stores SET is_duty_free = ? WHERE id = ? AND tenant_id = ?',
        [isDutyFree ? 1 : 0, storeId, tenantId],
      );
    }

    /*
     * Numbering settings.
     *
     * WHY THIS IS NOT A SINGLE UPSERT
     * -------------------------------
     * It was, and it failed with a 500 on every save. The three columns are
     * `NOT NULL`, and the upsert passed NULL for any field the caller had not
     * supplied — so a PUT that changed only `sequentialNumbering` violated the
     * constraint on the other two. MySQL validates the INSERT row before the
     * ON DUPLICATE KEY branch is reached, so the duplicate-key path never saved
     * it either.
     *
     * Only the fields actually provided are written. A partial update must stay
     * partial: sending one setting must not overwrite the others with defaults.
     */
    const numberingColumns = [
      ['sequential_numbering_optin', sequentialNumbering],
      ['show_number_on_receipt', showNumberOnReceipt],
      ['show_number_on_invoice', showNumberOnInvoice],
    ].filter(([, value]) => value !== undefined);

    if (numberingColumns.length > 0) {
      const [updated] = await conn.query(
        `UPDATE store_jurisdiction_settings
            SET ${numberingColumns.map(([col]) => `${col} = ?`).join(', ')}
          WHERE store_id = ? AND tenant_id = ?`,
        [...numberingColumns.map(([, value]) => (value ? 1 : 0)), storeId, tenantId],
      );

      /*
       * A store with no jurisdiction row yet still has to be able to save.
       * Insert with the supplied values and let every other column take its
       * schema default, rather than naming columns we have no value for.
       */
      if (updated.affectedRows === 0) {
        await conn.query(
          `INSERT INTO store_jurisdiction_settings
             (store_id, tenant_id${numberingColumns.map(([col]) => `, ${col}`).join('')})
           VALUES (?, ?${numberingColumns.map(() => ', ?').join('')})`,
          [storeId, tenantId, ...numberingColumns.map(([, value]) => (value ? 1 : 0))],
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  jurisdictionService.invalidateCache(storeId);
  return getRetailProfile(tenantId, storeId);
}

module.exports = {
  INDUSTRIES,
  DEFAULT_INDUSTRY,
  INDUSTRY_TEMPLATES,
  DUTY_FREE_TEMPLATES,
  availableIndustries,
  isIndustryAvailable,
  planTemplates,
  getRetailProfile,
  updateRetailProfile,
};
