/**
 * Jurisdiction Service
 *
 * Single source of truth for "what are the tax, invoicing and fiscal rules where
 * this store operates, and in what mode does it sell?"
 *
 * Consumed by:
 *   * taxCalculationService  - reverse charge, zero-rated export
 *   * print templates        - tax label, mandatory invoice title, fiscal blocks
 *   * invoice numbering      - sequential/gapless requirements
 *
 * RESOLUTION ORDER
 * ----------------
 *   1. store_jurisdiction_settings.jurisdiction_profile_id  (explicit binding)
 *   2. jurisdiction_profiles matched on stores.country_code (+ region if set)
 *   3. NEUTRAL_PROFILE - a permissive fallback so an unconfigured store still
 *      transacts. It deliberately claims NO regulatory capability: no
 *      fiscalization, no mandatory title, no hallmark regime. Failing "open" on
 *      a compliance flag would silently produce non-compliant documents, so
 *      every such flag defaults to false/null.
 *
 * Per-store `overrides` JSON is applied last and shallow-merges over the catalog.
 */

const { pool } = require('../config/db');

// ---------------------------------------------------------------------------
// Fallback used when a store has no country and no binding.
// Every compliance-bearing field is off. See resolution note above.
// ---------------------------------------------------------------------------
const NEUTRAL_PROFILE = Object.freeze({
  id: null,
  countryCode: null,
  regionCode: null,
  displayName: 'Unconfigured (neutral)',

  taxLabel: 'Tax',
  taxIdLabel: 'Tax ID',
  pricesIncludeTax: false,

  mandatoryInvoiceTitle: null,
  requiresCustomerTaxId: false,
  requiresSequentialNumbering: false,
  supportsReverseCharge: false,
  reverseChargeText: null,

  fiscalizationEnabled: false,
  fiscalizationScheme: null,
  fiscalizationRequiresQr: false,

  hallmarkRegime: null,
  drugIdentifierLabel: 'Drug ID',

  supportsTaxRefund: false,
  taxRefundSchemeName: null,

  defaultCurrencyCode: null,
  dateFormat: 'DD/MM/YYYY',
  cashRoundingIncrement: 0,

  isNeutralFallback: true,
});

const NEUTRAL_STORE_SETTINGS = Object.freeze({
  salesMode: 'domestic',
  requiresPassport: false,
  requiresBoardingPass: false,
  exportDeclarationText: null,
  businessTaxId: null,
  fiscalDeviceSerial: null,
  fiscalSoftwareId: null,
  invoiceNumberPrefix: null,
});

// ---------------------------------------------------------------------------
// Cache. Jurisdiction rules change on the order of legislation, not requests,
// so a short TTL removes a join from every sale without risking staleness.
// ---------------------------------------------------------------------------
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map(); // storeId -> { value, expiresAt }

const getCached = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) { cache.delete(key); return null; }
  return hit.value;
};

const setCached = (key, value) => {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

/** Clear cached jurisdiction data. Call after editing settings. */
function invalidateCache(storeId = null) {
  if (storeId) cache.delete(storeId);
  else cache.clear();
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------
const bool = (v) => v === 1 || v === true || v === '1';

function mapProfileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    countryCode: row.country_code,
    regionCode: row.region_code,
    displayName: row.display_name,

    taxLabel: row.tax_label,
    taxIdLabel: row.tax_id_label,
    pricesIncludeTax: bool(row.prices_include_tax),

    mandatoryInvoiceTitle: row.mandatory_invoice_title,
    requiresCustomerTaxId: bool(row.requires_customer_tax_id),
    requiresSequentialNumbering: bool(row.requires_sequential_numbering),
    supportsReverseCharge: bool(row.supports_reverse_charge),
    reverseChargeText: row.reverse_charge_text,

    fiscalizationEnabled: bool(row.fiscalization_enabled),
    fiscalizationScheme: row.fiscalization_scheme,
    fiscalizationRequiresQr: bool(row.fiscalization_requires_qr),

    hallmarkRegime: row.hallmark_regime,
    drugIdentifierLabel: row.drug_identifier_label,

    supportsTaxRefund: bool(row.supports_tax_refund),
    taxRefundSchemeName: row.tax_refund_scheme_name,

    defaultCurrencyCode: row.default_currency_code,
    dateFormat: row.date_format,
    cashRoundingIncrement: Number(row.cash_rounding_increment ?? 0),

    notes: row.notes,
    isNeutralFallback: false,
  };
}

function mapStoreSettingsRow(row) {
  if (!row) return { ...NEUTRAL_STORE_SETTINGS };
  return {
    salesMode: row.sales_mode || 'domestic',
    requiresPassport: bool(row.requires_passport),
    requiresBoardingPass: bool(row.requires_boarding_pass),
    exportDeclarationText: row.export_declaration_text,
    businessTaxId: row.business_tax_id,
    fiscalDeviceSerial: row.fiscal_device_serial,
    fiscalSoftwareId: row.fiscal_software_id,
    invoiceNumberPrefix: row.invoice_number_prefix,
  };
}

/** MySQL returns JSON columns as objects on some drivers, strings on others. */
function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}

// ---------------------------------------------------------------------------
// Core resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the effective jurisdiction context for a store.
 *
 * @param {string} tenantId
 * @param {string} storeId
 * @returns {Promise<{profile: object, store: object, salesMode: string,
 *                    isDutyFree: boolean, isExport: boolean, zeroRated: boolean}>}
 */
async function getJurisdictionProfile(tenantId, storeId) {
  if (!tenantId) throw new Error('getJurisdictionProfile requires a tenantId');

  if (storeId) {
    const cached = getCached(storeId);
    if (cached) return cached;
  }

  let profileRow = null;
  let settingsRow = null;
  let overrides = null;

  if (storeId) {
    // One round trip: settings + explicitly-bound profile + country-matched profile.
    const [rows] = await pool.query(
      `SELECT
         sjs.store_id, sjs.tenant_id, sjs.sales_mode, sjs.requires_passport,
         sjs.requires_boarding_pass, sjs.export_declaration_text, sjs.business_tax_id,
         sjs.fiscal_device_serial, sjs.fiscal_software_id, sjs.invoice_number_prefix,
         sjs.overrides,
         bound.id  AS bound_id,
         byc.id    AS byc_id,
         s.country_code AS store_country_code
       FROM stores s
       LEFT JOIN store_jurisdiction_settings sjs
              ON sjs.store_id = s.id
       LEFT JOIN jurisdiction_profiles bound
              ON bound.id = sjs.jurisdiction_profile_id
             AND bound.is_active = 1
       LEFT JOIN jurisdiction_profiles byc
              ON byc.country_code = s.country_code
             AND byc.region_code IS NULL
             AND byc.is_active = 1
       WHERE s.id = ? AND s.tenant_id = ?
       LIMIT 1`,
      [storeId, tenantId]
    );

    if (rows.length) {
      const r = rows[0];
      settingsRow = r.store_id ? r : null;
      overrides = parseJson(r.overrides);

      const profileId = r.bound_id || r.byc_id;
      if (profileId) {
        const [pRows] = await pool.query(
          'SELECT * FROM jurisdiction_profiles WHERE id = ? LIMIT 1',
          [profileId]
        );
        profileRow = pRows[0] || null;
      }
    }
  }

  const profile = mapProfileRow(profileRow) || { ...NEUTRAL_PROFILE };
  const store = mapStoreSettingsRow(settingsRow);

  // Per-store overrides win over the shared catalog.
  const effective = overrides && typeof overrides === 'object'
    ? { ...profile, ...overrides }
    : profile;

  const salesMode = store.salesMode;
  const isDutyFree = salesMode === 'duty_free';
  const isExport = salesMode === 'export';

  const result = {
    profile: effective,
    store,
    salesMode,
    isDutyFree,
    isExport,
    // Duty-free and export sales are supplied free of local consumption tax.
    // taxCalculationService reads this to zero-rate the sale.
    zeroRated: isDutyFree || isExport,
  };

  if (storeId) setCached(storeId, result);
  return result;
}

/** List the catalog. Used by settings UIs to offer a country picker. */
async function listProfiles({ activeOnly = true } = {}) {
  const [rows] = await pool.query(
    `SELECT * FROM jurisdiction_profiles
      ${activeOnly ? 'WHERE is_active = 1' : ''}
      ORDER BY country_code, region_code`
  );
  return rows.map(mapProfileRow);
}

/**
 * Update a store's jurisdiction settings. Upserts so a store without a row is
 * handled transparently.
 */
async function updateStoreSettings(tenantId, storeId, patch = {}) {
  if (!tenantId || !storeId) throw new Error('tenantId and storeId are required');

  const allowed = {
    jurisdiction_profile_id: patch.jurisdictionProfileId,
    sales_mode: patch.salesMode,
    requires_passport: patch.requiresPassport,
    requires_boarding_pass: patch.requiresBoardingPass,
    export_declaration_text: patch.exportDeclarationText,
    business_tax_id: patch.businessTaxId,
    fiscal_device_serial: patch.fiscalDeviceSerial,
    fiscal_software_id: patch.fiscalSoftwareId,
    invoice_number_prefix: patch.invoiceNumberPrefix,
    overrides: patch.overrides !== undefined ? JSON.stringify(patch.overrides) : undefined,
  };

  const cols = Object.entries(allowed).filter(([, v]) => v !== undefined);
  if (cols.length === 0) return getJurisdictionProfile(tenantId, storeId);

  const insertCols = ['store_id', 'tenant_id', ...cols.map(([k]) => k)];
  const insertVals = [storeId, tenantId, ...cols.map(([, v]) => v)];
  const placeholders = insertCols.map(() => '?').join(', ');
  const updateClause = cols.map(([k]) => `\`${k}\` = VALUES(\`${k}\`)`).join(', ');

  await pool.query(
    `INSERT INTO store_jurisdiction_settings (${insertCols.map((c) => `\`${c}\``).join(', ')})
     VALUES (${placeholders})
     ON DUPLICATE KEY UPDATE ${updateClause}`,
    insertVals
  );

  invalidateCache(storeId);
  return getJurisdictionProfile(tenantId, storeId);
}

module.exports = {
  getJurisdictionProfile,
  listProfiles,
  updateStoreSettings,
  invalidateCache,
  NEUTRAL_PROFILE,
};
