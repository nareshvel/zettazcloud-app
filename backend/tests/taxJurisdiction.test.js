/**
 * Jurisdiction-aware tax calculation tests.
 *
 * These cover the rules that decide whether tax is charged AT ALL — the most
 * financially consequential branch in the system:
 *
 *   * duty-free / export sales must be zero-rated
 *   * reverse charge must be refused where the jurisdiction does not permit it,
 *     and refused without the buyer's tax number (the invoice would be invalid)
 *   * domestic sales must still go through the normal calculator
 *
 * Getting these wrong means either charging tax that must not be charged, or
 * failing to charge tax that must be — both are reportable errors, not bugs you
 * can quietly patch later.
 */

const assert = require('assert');
const Module = require('module');

/**
 * Load taxCalculationService with both `../config/db` and `./jurisdictionService`
 * stubbed, so these tests need no database.
 */
function loadWithStubs({ jurisdiction, dbQuery }) {
  const dbPath = require.resolve('../config/db');
  const jurPath = require.resolve('../services/jurisdictionService');
  const taxPath = require.resolve('../services/taxCalculationService');
  const legacyDbPath = require.resolve('../db');

  const saved = {
    db: require.cache[dbPath],
    legacyDb: require.cache[legacyDbPath],
    jur: require.cache[jurPath],
  };
  delete require.cache[taxPath];

  const stubDb = { pool: { query: dbQuery || (async () => [[]]) }, query: dbQuery || (async () => [[]]) };
  for (const p of [dbPath, legacyDbPath]) {
    require.cache[p] = new Module(p, null);
    require.cache[p].filename = p;
    require.cache[p].loaded = true;
    require.cache[p].exports = stubDb;
  }

  require.cache[jurPath] = new Module(jurPath, null);
  require.cache[jurPath].filename = jurPath;
  require.cache[jurPath].loaded = true;
  require.cache[jurPath].exports = {
    getJurisdictionProfile: async () => jurisdiction,
  };

  const svc = require(taxPath);

  return {
    svc,
    restore() {
      delete require.cache[taxPath];
      for (const [key, path] of [['db', dbPath], ['legacyDb', legacyDbPath], ['jur', jurPath]]) {
        if (saved[key]) require.cache[path] = saved[key];
        else delete require.cache[path];
      }
    },
  };
}

const PROFILE_AG = {
  displayName: 'Antigua and Barbuda',
  taxLabel: 'ABST',
  taxIdLabel: 'ABST No.',
  pricesIncludeTax: false,
  supportsReverseCharge: false,
  reverseChargeText: null,
  mandatoryInvoiceTitle: null,
  requiresCustomerTaxId: false,
  cashRoundingIncrement: 0,
};

const PROFILE_EU = {
  ...PROFILE_AG,
  displayName: 'European Union (generic)',
  taxLabel: 'VAT',
  pricesIncludeTax: true,
  supportsReverseCharge: true,
  reverseChargeText: 'Reverse charge: customer to account for VAT',
  requiresCustomerTaxId: true,
};

const ctx = (over = {}) => ({
  profile: PROFILE_AG,
  store: { exportDeclarationText: null, requiresPassport: false, requiresBoardingPass: false },
  salesMode: 'domestic',
  isDutyFree: false,
  isExport: false,
  zeroRated: false,
  ...over,
});

const LINES = [
  { id: 'l1', line_total: 450, tax_class_id: 'tc-1' },
  { id: 'l2', line_total: 1250, tax_class_id: 'tc-1' },
];

describe('calculateSaleTaxesWithJurisdiction', function () {
  describe('duty-free', function () {
    it('zero-rates every line', async function () {
      const { svc, restore } = loadWithStubs({
        jurisdiction: ctx({
          salesMode: 'duty_free', isDutyFree: true, zeroRated: true,
          store: {
            exportDeclarationText: 'Goods must leave the territory',
            requiresPassport: true, requiresBoardingPass: true,
          },
        }),
      });
      try {
        const r = await svc.calculateSaleTaxesWithJurisdiction(LINES, 't', 's');
        assert.strictEqual(r.total_tax_amount, 0);
        assert.ok(r.line_items.every((l) => l.tax_amount === 0), 'every line must be zero-rated');
        assert.strictEqual(r.jurisdiction.zeroRated, true);
        assert.strictEqual(r.jurisdiction.zeroRateReason, 'duty_free');
      } finally { restore(); }
    });

    it('surfaces the export declaration and document requirements', async function () {
      const { svc, restore } = loadWithStubs({
        jurisdiction: ctx({
          salesMode: 'duty_free', isDutyFree: true, zeroRated: true,
          store: {
            exportDeclarationText: 'Goods must leave the territory',
            requiresPassport: true, requiresBoardingPass: true,
          },
        }),
      });
      try {
        const r = await svc.calculateSaleTaxesWithJurisdiction(LINES, 't', 's');
        assert.strictEqual(r.jurisdiction.declarationText, 'Goods must leave the territory');
        assert.strictEqual(r.jurisdiction.requiresPassport, true);
        assert.strictEqual(r.jurisdiction.requiresBoardingPass, true);
      } finally { restore(); }
    });

    it('preserves line identity so the invoice can still itemise', async function () {
      const { svc, restore } = loadWithStubs({
        jurisdiction: ctx({ salesMode: 'duty_free', isDutyFree: true, zeroRated: true }),
      });
      try {
        const r = await svc.calculateSaleTaxesWithJurisdiction(LINES, 't', 's');
        assert.deepStrictEqual(r.line_items.map((l) => l.id), ['l1', 'l2']);
        assert.strictEqual(r.line_items[0].line_total, 450);
      } finally { restore(); }
    });
  });

  describe('export', function () {
    it('zero-rates with an export reason', async function () {
      const { svc, restore } = loadWithStubs({
        jurisdiction: ctx({ salesMode: 'export', isExport: true, zeroRated: true }),
      });
      try {
        const r = await svc.calculateSaleTaxesWithJurisdiction(LINES, 't', 's');
        assert.strictEqual(r.total_tax_amount, 0);
        assert.strictEqual(r.jurisdiction.zeroRateReason, 'export');
      } finally { restore(); }
    });
  });

  describe('reverse charge', function () {
    it('is refused where the jurisdiction does not permit it', async function () {
      const { svc, restore } = loadWithStubs({ jurisdiction: ctx({ profile: PROFILE_AG }) });
      try {
        await assert.rejects(
          () => svc.calculateSaleTaxesWithJurisdiction(LINES, 't', 's', {
            reverseCharge: true, customerTaxId: 'VAT-123',
          }),
          /not available/
        );
      } finally { restore(); }
    });

    it('is refused without the customer tax ID', async function () {
      const { svc, restore } = loadWithStubs({ jurisdiction: ctx({ profile: PROFILE_EU }) });
      try {
        await assert.rejects(
          () => svc.calculateSaleTaxesWithJurisdiction(LINES, 't', 's', { reverseCharge: true }),
          /customer tax ID/
        );
      } finally { restore(); }
    });

    it('zero-rates and attaches the prescribed wording when valid', async function () {
      const { svc, restore } = loadWithStubs({ jurisdiction: ctx({ profile: PROFILE_EU }) });
      try {
        const r = await svc.calculateSaleTaxesWithJurisdiction(LINES, 't', 's', {
          reverseCharge: true, customerTaxId: 'DE123456789',
        });
        assert.strictEqual(r.total_tax_amount, 0);
        assert.strictEqual(r.jurisdiction.zeroRateReason, 'reverse_charge');
        assert.strictEqual(
          r.jurisdiction.reverseChargeText,
          'Reverse charge: customer to account for VAT'
        );
        assert.strictEqual(r.jurisdiction.customerTaxId, 'DE123456789');
      } finally { restore(); }
    });
  });

  describe('domestic sales', function () {
    it('defaults pricesIncludeTax from the jurisdiction', async function () {
      const { svc, restore } = loadWithStubs({ jurisdiction: ctx({ profile: PROFILE_EU }) });
      try {
        const r = await svc.calculateSaleTaxesWithJurisdiction(LINES, 't', 's');
        assert.strictEqual(r.jurisdiction.pricesIncludeTax, true, 'EU is tax-inclusive');
      } finally { restore(); }
    });

    it('lets an explicit caller override the jurisdiction default', async function () {
      const { svc, restore } = loadWithStubs({ jurisdiction: ctx({ profile: PROFILE_EU }) });
      try {
        const r = await svc.calculateSaleTaxesWithJurisdiction(LINES, 't', 's', {
          pricesIncludeTax: false,
        });
        assert.strictEqual(r.jurisdiction.pricesIncludeTax, false);
      } finally { restore(); }
    });

    it('passes through presentation hints the renderer needs', async function () {
      const { svc, restore } = loadWithStubs({ jurisdiction: ctx({ profile: PROFILE_EU }) });
      try {
        const r = await svc.calculateSaleTaxesWithJurisdiction(LINES, 't', 's');
        assert.strictEqual(r.jurisdiction.taxLabel, 'VAT');
        assert.strictEqual(r.jurisdiction.requiresCustomerTaxId, true);
        assert.strictEqual(r.jurisdiction.zeroRated, false);
      } finally { restore(); }
    });
  });
});

describe('applyCashRounding', function () {
  const { svc, restore } = loadWithStubs({ jurisdiction: ctx() });
  after(() => restore());

  it('is a no-op when no increment is configured', function () {
    assert.strictEqual(svc.applyCashRounding(12.34, 0), 12.34);
    assert.strictEqual(svc.applyCashRounding(12.34, null), 12.34);
  });

  it('rounds to the nearest 5c where 1c/2c coins are withdrawn (AU/CA)', function () {
    assert.strictEqual(Number(svc.applyCashRounding(12.32, 0.05).toFixed(2)), 12.30);
    assert.strictEqual(Number(svc.applyCashRounding(12.33, 0.05).toFixed(2)), 12.35);
    assert.strictEqual(Number(svc.applyCashRounding(12.38, 0.05).toFixed(2)), 12.40);
  });

  it('leaves an already-round amount untouched', function () {
    assert.strictEqual(Number(svc.applyCashRounding(12.35, 0.05).toFixed(2)), 12.35);
  });
});
