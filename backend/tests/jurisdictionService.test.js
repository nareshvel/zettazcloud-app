/**
 * Jurisdiction service tests.
 *
 * The riskiest behaviour here is the fallback. If a store has no jurisdiction
 * configured, the resolver must fail CLOSED on every compliance-bearing flag —
 * claiming a fiscalization scheme or a hallmark regime that isn't there would
 * silently produce non-compliant documents. These tests pin that.
 *
 * DB-backed paths are exercised in the CI `schema` job against a real MySQL;
 * here we test the pure logic and the fallback contract.
 */

const assert = require('assert');
const path = require('path');
const Module = require('module');

// ---------------------------------------------------------------------------
// Load the service with `../config/db` stubbed, so no database is required.
// ---------------------------------------------------------------------------
function loadServiceWithStub(queryImpl) {
  const dbPath = require.resolve('../config/db');
  const servicePath = require.resolve('../services/jurisdictionService');

  const originalDb = require.cache[dbPath];
  delete require.cache[servicePath];

  require.cache[dbPath] = new Module(dbPath, null);
  require.cache[dbPath].filename = dbPath;
  require.cache[dbPath].loaded = true;
  require.cache[dbPath].exports = {
    pool: { query: queryImpl || (async () => [[]]) },
  };

  const svc = require(servicePath);

  return {
    svc,
    restore() {
      delete require.cache[servicePath];
      if (originalDb) require.cache[dbPath] = originalDb;
      else delete require.cache[dbPath];
    },
  };
}

describe('jurisdictionService', function () {
  describe('NEUTRAL_PROFILE — must fail closed', function () {
    const { svc, restore } = loadServiceWithStub();
    after(() => restore());

    it('claims no fiscalization', function () {
      assert.strictEqual(svc.NEUTRAL_PROFILE.fiscalizationEnabled, false);
      assert.strictEqual(svc.NEUTRAL_PROFILE.fiscalizationScheme, null);
      assert.strictEqual(svc.NEUTRAL_PROFILE.fiscalizationRequiresQr, false);
    });

    it('claims no hallmark regime', function () {
      assert.strictEqual(svc.NEUTRAL_PROFILE.hallmarkRegime, null);
    });

    it('imposes no mandatory invoice title', function () {
      assert.strictEqual(svc.NEUTRAL_PROFILE.mandatoryInvoiceTitle, null);
    });

    it('claims no reverse-charge or tax-refund capability', function () {
      assert.strictEqual(svc.NEUTRAL_PROFILE.supportsReverseCharge, false);
      assert.strictEqual(svc.NEUTRAL_PROFILE.supportsTaxRefund, false);
    });

    it('is marked as a fallback so callers can detect misconfiguration', function () {
      assert.strictEqual(svc.NEUTRAL_PROFILE.isNeutralFallback, true);
    });

    it('is frozen — a caller mutating it must not poison other stores', function () {
      assert.throws(
        () => { 'use strict'; svc.NEUTRAL_PROFILE.fiscalizationEnabled = true; },
        TypeError
      );
    });
  });

  describe('getJurisdictionProfile', function () {
    it('requires a tenantId', async function () {
      const { svc, restore } = loadServiceWithStub();
      try {
        await assert.rejects(
          () => svc.getJurisdictionProfile(null, 'store-1'),
          /requires a tenantId/
        );
      } finally { restore(); }
    });

    it('falls back to the neutral profile for an unknown store', async function () {
      const { svc, restore } = loadServiceWithStub(async () => [[]]);
      try {
        const r = await svc.getJurisdictionProfile('tenant-1', 'nonexistent-store');
        assert.strictEqual(r.profile.isNeutralFallback, true);
        assert.strictEqual(r.salesMode, 'domestic');
        assert.strictEqual(r.zeroRated, false);
      } finally { restore(); }
    });

    it('maps a seeded profile row and marks it non-fallback', async function () {
      let call = 0;
      const { svc, restore } = loadServiceWithStub(async () => {
        call += 1;
        if (call === 1) {
          return [[{
            store_id: 'store-1', tenant_id: 'tenant-1', sales_mode: 'domestic',
            requires_passport: 0, requires_boarding_pass: 0,
            overrides: null, bound_id: 'jp-ag', byc_id: null,
            store_country_code: 'AG',
          }]];
        }
        return [[{
          id: 'jp-ag', country_code: 'AG', region_code: null,
          display_name: 'Antigua and Barbuda',
          tax_label: 'ABST', tax_id_label: 'ABST No.', prices_include_tax: 0,
          mandatory_invoice_title: null, requires_customer_tax_id: 0,
          requires_sequential_numbering: 0, supports_reverse_charge: 0,
          reverse_charge_text: null,
          fiscalization_enabled: 0, fiscalization_scheme: null,
          fiscalization_requires_qr: 0,
          hallmark_regime: null, drug_identifier_label: 'Drug ID',
          supports_tax_refund: 0, tax_refund_scheme_name: null,
          default_currency_code: 'XCD', date_format: 'DD/MM/YYYY',
          cash_rounding_increment: '0.000',
        }]];
      });
      try {
        const r = await svc.getJurisdictionProfile('tenant-1', 'store-1');
        assert.strictEqual(r.profile.taxLabel, 'ABST');
        assert.strictEqual(r.profile.countryCode, 'AG');
        assert.strictEqual(r.profile.isNeutralFallback, false);
        assert.strictEqual(r.profile.cashRoundingIncrement, 0);
      } finally { restore(); }
    });

    it('zero-rates duty-free sales', async function () {
      let call = 0;
      const { svc, restore } = loadServiceWithStub(async () => {
        call += 1;
        if (call === 1) {
          return [[{
            store_id: 's', tenant_id: 't', sales_mode: 'duty_free',
            requires_passport: 1, requires_boarding_pass: 1,
            export_declaration_text: 'Goods must leave the territory',
            overrides: null, bound_id: null, byc_id: null, store_country_code: 'AG',
          }]];
        }
        return [[]];
      });
      try {
        const r = await svc.getJurisdictionProfile('t', 's');
        assert.strictEqual(r.isDutyFree, true);
        assert.strictEqual(r.zeroRated, true, 'duty-free sales must be zero-rated');
        assert.strictEqual(r.store.requiresPassport, true);
        assert.strictEqual(r.store.requiresBoardingPass, true);
      } finally { restore(); }
    });

    it('zero-rates export sales', async function () {
      let call = 0;
      const { svc, restore } = loadServiceWithStub(async () => {
        call += 1;
        if (call === 1) {
          return [[{
            store_id: 's', tenant_id: 't', sales_mode: 'export',
            requires_passport: 0, requires_boarding_pass: 0,
            overrides: null, bound_id: null, byc_id: null, store_country_code: 'AG',
          }]];
        }
        return [[]];
      });
      try {
        const r = await svc.getJurisdictionProfile('t', 's');
        assert.strictEqual(r.isExport, true);
        assert.strictEqual(r.zeroRated, true);
      } finally { restore(); }
    });

    it('does NOT zero-rate domestic sales', async function () {
      let call = 0;
      const { svc, restore } = loadServiceWithStub(async () => {
        call += 1;
        if (call === 1) {
          return [[{
            store_id: 's', tenant_id: 't', sales_mode: 'domestic',
            overrides: null, bound_id: null, byc_id: null, store_country_code: 'AG',
          }]];
        }
        return [[]];
      });
      try {
        const r = await svc.getJurisdictionProfile('t', 's');
        assert.strictEqual(r.zeroRated, false);
      } finally { restore(); }
    });

    it('applies per-store overrides over the catalog', async function () {
      let call = 0;
      const { svc, restore } = loadServiceWithStub(async () => {
        call += 1;
        if (call === 1) {
          return [[{
            store_id: 's', tenant_id: 't', sales_mode: 'domestic',
            overrides: JSON.stringify({ taxLabel: 'LOCAL LEVY' }),
            bound_id: 'jp-x', byc_id: null, store_country_code: 'AG',
          }]];
        }
        return [[{
          id: 'jp-x', country_code: 'AG', region_code: null, display_name: 'X',
          tax_label: 'ABST', tax_id_label: 'No.', prices_include_tax: 0,
          drug_identifier_label: 'Drug ID', date_format: 'DD/MM/YYYY',
          cash_rounding_increment: '0.000',
        }]];
      });
      try {
        const r = await svc.getJurisdictionProfile('t', 's');
        assert.strictEqual(r.profile.taxLabel, 'LOCAL LEVY', 'override should win');
        assert.strictEqual(r.profile.countryCode, 'AG', 'non-overridden fields survive');
      } finally { restore(); }
    });

    it('caches per store, then honours invalidation', async function () {
      let queries = 0;
      const { svc, restore } = loadServiceWithStub(async () => {
        queries += 1;
        return [[]];
      });
      try {
        await svc.getJurisdictionProfile('t', 'store-cache');
        const afterFirst = queries;
        await svc.getJurisdictionProfile('t', 'store-cache');
        assert.strictEqual(queries, afterFirst, 'second call should be served from cache');

        svc.invalidateCache('store-cache');
        await svc.getJurisdictionProfile('t', 'store-cache');
        assert.ok(queries > afterFirst, 'invalidation should force a re-read');
      } finally { restore(); }
    });
  });
});
