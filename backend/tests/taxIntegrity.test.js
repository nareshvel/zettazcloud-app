/**
 * Tax integrity tests.
 *
 * Two related failures are pinned here:
 *
 * 1. SILENT ZERO — calculateSaleTaxes used to catch every error and return
 *    `total_tax_amount: 0`. A transient DB blip therefore undercharged the
 *    customer with no signal anywhere. It must now throw.
 *
 * 2. UNVERIFIED CLIENT TAX — the sale endpoint recalculated subtotal server-side
 *    but took `tax` straight from the request body. A modified client, or a
 *    direct API call, could post `tax: 0` on any sale. verifySaleTax recomputes
 *    and compares.
 *
 * Both are money-correctness issues: wrong in a direction that is invisible
 * until an audit.
 */

const assert = require('assert');
const Module = require('module');

function loadTaxService({ dbQuery }) {
  const dbPath = require.resolve('../config/db');
  const legacyDbPath = require.resolve('../db');
  const taxPath = require.resolve('../services/taxCalculationService');

  const saved = { db: require.cache[dbPath], legacy: require.cache[legacyDbPath] };
  delete require.cache[taxPath];

  const stub = { pool: { query: dbQuery }, query: dbQuery };
  for (const p of [dbPath, legacyDbPath]) {
    require.cache[p] = new Module(p, null);
    require.cache[p].filename = p;
    require.cache[p].loaded = true;
    require.cache[p].exports = stub;
  }

  const svc = require(taxPath);
  return {
    svc,
    restore() {
      delete require.cache[taxPath];
      if (saved.db) require.cache[dbPath] = saved.db; else delete require.cache[dbPath];
      if (saved.legacy) require.cache[legacyDbPath] = saved.legacy; else delete require.cache[legacyDbPath];
    },
  };
}

// `calculateLineItemTax` short-circuits to zero tax when product_id is absent,
// so a realistic fixture must include it — otherwise the tests would pass for
// the wrong reason.
const LINES = [{ id: 'l1', product_id: 'p1', line_total: 100, tax_class_id: 'tc-1' }];

describe('Tax integrity', function () {
  // -------------------------------------------------------------------------
  describe('calculateSaleTaxes must not silently return zero', function () {
    it('throws TaxCalculationError when the database fails', async function () {
      const { svc, restore } = loadTaxService({
        dbQuery: async () => { throw new Error('ER_LOCK_WAIT_TIMEOUT'); },
      });
      try {
        await assert.rejects(
          () => svc.calculateSaleTaxes(LINES, 't', 's', false),
          (err) => {
            assert.strictEqual(err.name, 'TaxCalculationError');
            // May surface from either layer — what matters is that it surfaces.
            assert.match(err.message, /Unable to (calculate|load tax configuration)/i);
            return true;
          },
          'A DB failure must surface, not become a zero-tax sale'
        );
      } finally { restore(); }
    });

    it('preserves the underlying cause for diagnosis', async function () {
      const { svc, restore } = loadTaxService({
        dbQuery: async () => { throw new Error('ECONNREFUSED'); },
      });
      try {
        await svc.calculateSaleTaxes(LINES, 't', 's', false);
        assert.fail('should have thrown');
      } catch (err) {
        assert.strictEqual(err.cause?.message, 'ECONNREFUSED');
      } finally { restore(); }
    });

    it('reports whether tax classes were configured at all', async function () {
      const { svc, restore } = loadTaxService({ dbQuery: async () => [[]] });
      try {
        const r = await svc.calculateSaleTaxes(LINES, 't', 's', false);
        assert.strictEqual(
          r.tax_classes_configured, false,
          'callers must be able to tell "no tax configured" from "tax is zero"'
        );
      } finally { restore(); }
    });
  });

  // -------------------------------------------------------------------------
  describe('verifySaleTax', function () {
    it('accepts the client value when no tax classes are configured', async function () {
      const { svc, restore } = loadTaxService({ dbQuery: async () => [[]] });
      try {
        const r = await svc.verifySaleTax({
          lineItems: LINES, clientTax: 7.5, tenantId: 't', storeId: 's',
        });
        assert.strictEqual(r.tax, 7.5);
        assert.strictEqual(r.verified, false);
        assert.strictEqual(r.reason, 'no_tax_classes_configured');
      } finally { restore(); }
    });

    it('does not block the sale when verification itself fails', async function () {
      const { svc, restore } = loadTaxService({
        dbQuery: async () => { throw new Error('db down'); },
      });
      try {
        const r = await svc.verifySaleTax({
          lineItems: LINES, clientTax: 7.5, tenantId: 't', storeId: 's',
        });
        assert.strictEqual(r.tax, 7.5, 'checkout must still complete');
        assert.strictEqual(r.verified, false);
        assert.strictEqual(r.reason, 'verification_unavailable');
      } finally { restore(); }
    });

    it('coerces a non-numeric client tax to zero rather than NaN', async function () {
      const { svc, restore } = loadTaxService({ dbQuery: async () => [[]] });
      try {
        const r = await svc.verifySaleTax({
          lineItems: LINES, clientTax: 'not-a-number', tenantId: 't', storeId: 's',
        });
        assert.strictEqual(r.tax, 0);
        assert.ok(Number.isFinite(r.tax), 'must never propagate NaN into a money column');
      } finally { restore(); }
    });

    describe('with tax classes configured', function () {
      // One class, one 10% rate. A 100.00 line should attract 10.00 tax.
      const configuredDb = async (sql) => {
        if (/FROM\s+tax_classes/i.test(sql)) {
          return [[{ id: 'tc-1', name: 'Standard', tenant_id: 't', store_id: 's' }]];
        }
        if (/FROM\s+tax_class_rates/i.test(sql)) {
          return [[{
            id: 'r-1', tax_class_id: 'tc-1', tax_rate_name: 'VAT',
            rate: '0.10000', priority: 0, is_compound: 0, is_active: 1,
          }]];
        }
        return [[]];
      };

      it('flags a mismatch when the client under-reports tax', async function () {
        const { svc, restore } = loadTaxService({ dbQuery: configuredDb });
        try {
          const r = await svc.verifySaleTax({
            lineItems: LINES,
            clientTax: 0,              // the attack: claim zero tax
            tenantId: 't', storeId: 's',
            mode: 'warn',
          });
          assert.strictEqual(r.verified, true);
          assert.strictEqual(r.mismatch, true, 'a zero-tax claim on a taxed line must be flagged');
        } finally { restore(); }
      });

      /*
       * Enforce mode REJECTS. It does not substitute.
       *
       * Substituting the server figure was the original behaviour and it is a
       * money bug: the customer has already been quoted — and on a card sale
       * already charged — a total built from the client's tax. Swapping the tax
       * server-side recomputes the recorded total, so the books and the card
       * terminal disagree by the difference, silently.
       *
       * Refusing hands the decision back to the till, which can re-price and
       * re-tender against a number the customer can actually be shown.
       */
      it('REJECTS rather than silently substituting, in enforce mode', async function () {
        const { svc, restore } = loadTaxService({ dbQuery: configuredDb });
        try {
          const r = await svc.verifySaleTax({
            lineItems: LINES,
            clientTax: 0,
            tenantId: 't', storeId: 's',
            mode: 'enforce',
          });
          assert.strictEqual(r.mismatch, true);
          assert.strictEqual(r.reject, true, 'enforce mode must refuse a mismatched sale');
          assert.ok(r.serverTax > 0, 'the server figure must still be reported for the log');
          assert.strictEqual(
            r.tax, r.clientTax,
            'the returned tax must never differ from what the customer was charged',
          );
        } finally { restore(); }
      });

      it('does not reject when the figures agree', async function () {
        // Guards the assertion above against passing because everything rejects.
        const { svc, restore } = loadTaxService({ dbQuery: configuredDb });
        try {
          const matching = await svc.verifySaleTax({
            lineItems: LINES, clientTax: 0, tenantId: 't', storeId: 's', mode: 'warn',
          });
          const r = await svc.verifySaleTax({
            lineItems: LINES,
            clientTax: matching.serverTax,
            tenantId: 't', storeId: 's',
            mode: 'enforce',
          });
          assert.strictEqual(r.mismatch, false);
          assert.strictEqual(r.reject, false, 'a correct sale was rejected');
        } finally { restore(); }
      });

      it('never rejects in warn mode, whatever the mismatch', async function () {
        // warn is the default and must be incapable of blocking a live till.
        const { svc, restore } = loadTaxService({ dbQuery: configuredDb });
        try {
          const r = await svc.verifySaleTax({
            lineItems: LINES, clientTax: 0, tenantId: 't', storeId: 's', mode: 'warn',
          });
          assert.strictEqual(r.mismatch, true);
          assert.strictEqual(r.reject, false, 'warn mode must never block a sale');
        } finally { restore(); }
      });

      it('keeps the client figure in warn mode (default) so checkout is unaffected', async function () {
        const { svc, restore } = loadTaxService({ dbQuery: configuredDb });
        try {
          const r = await svc.verifySaleTax({
            lineItems: LINES,
            clientTax: 0,
            tenantId: 't', storeId: 's',
            mode: 'warn',
          });
          assert.strictEqual(r.tax, 0, 'warn mode observes without changing behaviour');
          assert.strictEqual(r.mismatch, true, 'but still records the discrepancy');
        } finally { restore(); }
      });

      it('accepts a matching client figure without flagging', async function () {
        const { svc, restore } = loadTaxService({ dbQuery: configuredDb });
        try {
          const server = await svc.calculateSaleTaxes(LINES, 't', 's', false);
          const r = await svc.verifySaleTax({
            lineItems: LINES,
            clientTax: server.total_tax_amount,
            tenantId: 't', storeId: 's',
          });
          assert.strictEqual(r.mismatch, false);
          assert.strictEqual(r.reason, 'verified');
        } finally { restore(); }
      });

      it('tolerates sub-cent floating point drift', async function () {
        const { svc, restore } = loadTaxService({ dbQuery: configuredDb });
        try {
          const server = await svc.calculateSaleTaxes(LINES, 't', 's', false);
          const r = await svc.verifySaleTax({
            lineItems: LINES,
            clientTax: server.total_tax_amount + 0.001,
            tenantId: 't', storeId: 's',
          });
          assert.strictEqual(r.mismatch, false, 'float dust must not raise a false alarm');
        } finally { restore(); }
      });
    });
  });
});
