/**
 * createSaleController — duty-free zero-rating and traveller capture.
 *
 * Covers the fix landed alongside the Sales Hub's Duty-Free Sale intake
 * (docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md, §5 Option A):
 *
 *   * a store whose jurisdiction resolves `zeroRated: true` (duty_free or
 *     export) must have its sale recorded with tax = 0, REGARDLESS of what
 *     the client posted — this was the gap where `calculateSaleTaxesWithJurisdiction`
 *     existed and was unit-tested but had zero callers in the real request path.
 *   * `sales_mode` / `zero_rate_reason` are frozen onto the sale row from the
 *     jurisdiction lookup at creation time.
 *   * a non-zero-rated (domestic/mixed) sale is unaffected — it still goes
 *     through `verifySaleTax` and stores whatever that resolves to.
 *   * traveller/travel-method fields captured by the Hub's Duty-Free intake
 *     form round-trip onto the sale row untouched, and are all NULL when the
 *     sale did not go through that flow.
 *
 * These are unit tests: `../config/db`, `../services/jurisdictionService`,
 * `../services/taxCalculationService`, `../services/documentSequenceService`
 * and `../services/auditLogService` are all stubbed via the require cache
 * (same technique as tests/taxJurisdiction.test.js), so no database is
 * needed and no real transaction is opened.
 */

const assert = require('assert');
const Module = require('module');

function stubModule(modPath, exportsObj) {
  const resolved = require.resolve(modPath);
  const saved = require.cache[resolved];
  const mod = new Module(resolved, null);
  mod.filename = resolved;
  mod.loaded = true;
  mod.exports = exportsObj;
  require.cache[resolved] = mod;
  return { resolved, saved };
}

/**
 * Loads createSaleController fresh with its dependencies stubbed.
 * @param {object} opts
 * @param {object} opts.jurisdiction - what jurisdictionService.getJurisdictionProfile resolves to
 * @param {object} [opts.verifyTaxResult] - what taxCalculationService.verifySaleTax resolves to
 * @param {Array}  [opts.queryLog] - array pushed to on every connection.query call
 */
function loadController({ jurisdiction, verifyTaxResult, queryLog = [], paymentMethodRows = [] }) {
  const controllerPath = require.resolve('../controllers/createSaleController');

  const fakeConnection = {
    async beginTransaction() {},
    async query(sql, values) {
      queryLog.push({ sql, values });
      if (/SELECT stock_quantity FROM products/.test(sql)) {
        return [[{ stock_quantity: 10 }]];
      }
      // sale_items bulk insert and other statements don't need real results.
      return [{ affectedRows: 0, insertId: 0 }];
    },
    async commit() {},
    async rollback() {},
    release() {},
  };

  const stubs = [
    stubModule('../config/db', {
      pool: {
        getConnection: async () => fakeConnection,
        // Only query the pool directly makes (the payment_methods lookup in
        // createSaleController) — everything inside the transaction goes
        // through fakeConnection.query above instead.
        query: async () => [paymentMethodRows],
      },
    }),
    stubModule('../services/jurisdictionService', {
      getJurisdictionProfile: async () => jurisdiction,
    }),
    stubModule('../services/taxCalculationService', {
      verifySaleTax: async () => verifyTaxResult || { tax: 0, reject: false, mismatch: false },
    }),
    stubModule('../services/documentSequenceService', {
      isEnabledFor: async () => ({ enabled: false, mandatory: false }),
      allocate: async () => null,
    }),
    stubModule('../services/auditLogService', {
      logActivity: async () => {},
    }),
  ];

  delete require.cache[controllerPath];
  const controller = require(controllerPath);

  return {
    controller,
    queryLog,
    restore() {
      delete require.cache[controllerPath];
      for (const { resolved, saved } of stubs) {
        if (saved) require.cache[resolved] = saved;
        else delete require.cache[resolved];
      }
    },
  };
}

function fakeReq(body) {
  return {
    body,
    user: { tenant_id: 'tenant-1', id: 'cashier-1', email: 'cashier@example.com' },
    ip: '127.0.0.1',
    headers: {},
  };
}

function fakeRes() {
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return res;
}

const BASE_BODY = {
  items: [{ productId: 'p1', quantity: 1, price: 100 }],
  store_id: 'store-1',
  payment_method_id: 'cash',
  tax: 25, // client-computed tax — deliberately wrong for the zero-rated cases below
};

/** Find the `INSERT INTO sales (...)` call and map its `?` values by column name. */
function findSaleInsert(queryLog) {
  const call = queryLog.find((q) => /INSERT INTO sales \(/.test(q.sql));
  assert.ok(call, 'expected an INSERT INTO sales query');
  const columns = call.sql.match(/INSERT INTO sales \(([^)]+)\)/)[1]
    .split(',').map((c) => c.trim());
  const row = {};
  columns.forEach((col, i) => { row[col] = call.values[i]; });
  return row;
}

describe('createSaleController — duty-free zero-rating', function () {
  it('forces tax to 0 and freezes sales_mode/zero_rate_reason for a duty-free store', async function () {
    const { controller, queryLog, restore } = loadController({
      jurisdiction: { zeroRated: true, isDutyFree: true, isExport: false, salesMode: 'duty_free' },
    });
    try {
      const req = fakeReq({ ...BASE_BODY });
      const res = fakeRes();
      await controller.createSale(req, res);

      assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
      const row = findSaleInsert(queryLog);
      assert.strictEqual(row.tax, 0, 'duty-free sale must be recorded with zero tax regardless of client tax');
      assert.strictEqual(row.sales_mode, 'duty_free');
      assert.strictEqual(row.zero_rate_reason, 'duty_free');
    } finally { restore(); }
  });

  it('forces tax to 0 with an export reason for an export store', async function () {
    const { controller, queryLog, restore } = loadController({
      jurisdiction: { zeroRated: true, isDutyFree: false, isExport: true, salesMode: 'export' },
    });
    try {
      const req = fakeReq({ ...BASE_BODY });
      const res = fakeRes();
      await controller.createSale(req, res);

      const row = findSaleInsert(queryLog);
      assert.strictEqual(row.tax, 0);
      assert.strictEqual(row.sales_mode, 'export');
      assert.strictEqual(row.zero_rate_reason, 'export');
    } finally { restore(); }
  });

  it('leaves a domestic sale unaffected — tax comes from verifySaleTax, zero_rate_reason is null', async function () {
    const { controller, queryLog, restore } = loadController({
      jurisdiction: { zeroRated: false, isDutyFree: false, isExport: false, salesMode: 'domestic' },
      verifyTaxResult: { tax: 25, reject: false, mismatch: false },
    });
    try {
      const req = fakeReq({ ...BASE_BODY });
      const res = fakeRes();
      await controller.createSale(req, res);

      const row = findSaleInsert(queryLog);
      assert.strictEqual(row.tax, 25, 'domestic sale should keep the verified tax figure');
      // sales_mode records the store's mode regardless of zero-rating; only
      // zero_rate_reason is conditional on the sale actually being zero-rated.
      assert.strictEqual(row.sales_mode, 'domestic');
      assert.strictEqual(row.zero_rate_reason, null);
    } finally { restore(); }
  });

  it('does not zero-rate a "mixed" store — that mode is not auto zero-rated', async function () {
    const { controller, queryLog, restore } = loadController({
      jurisdiction: { zeroRated: false, isDutyFree: false, isExport: false, salesMode: 'mixed' },
      verifyTaxResult: { tax: 25, reject: false, mismatch: false },
    });
    try {
      const req = fakeReq({ ...BASE_BODY });
      const res = fakeRes();
      await controller.createSale(req, res);

      const row = findSaleInsert(queryLog);
      assert.strictEqual(row.tax, 25);
      assert.strictEqual(row.sales_mode, 'mixed');
      assert.strictEqual(row.zero_rate_reason, null);
    } finally { restore(); }
  });

  it('fails open (keeps client tax path) when the jurisdiction lookup throws', async function () {
    const controllerPath = require.resolve('../controllers/createSaleController');
    const queryLog = [];
    const fakeConnection = {
      async beginTransaction() {},
      async query(sql, values) {
        queryLog.push({ sql, values });
        if (/SELECT stock_quantity FROM products/.test(sql)) return [[{ stock_quantity: 10 }]];
        return [{}];
      },
      async commit() {}, async rollback() {}, release() {},
    };
    const stubs = [
      stubModule('../config/db', { pool: { getConnection: async () => fakeConnection, query: async () => [[]] } }),
      stubModule('../services/jurisdictionService', {
        getJurisdictionProfile: async () => { throw new Error('lookup boom'); },
      }),
      stubModule('../services/taxCalculationService', {
        verifySaleTax: async () => ({ tax: 25, reject: false, mismatch: false }),
      }),
      stubModule('../services/documentSequenceService', {
        isEnabledFor: async () => ({ enabled: false, mandatory: false }), allocate: async () => null,
      }),
      stubModule('../services/auditLogService', { logActivity: async () => {} }),
    ];
    delete require.cache[controllerPath];
    const controller = require(controllerPath);
    try {
      const req = fakeReq({ ...BASE_BODY });
      const res = fakeRes();
      await controller.createSale(req, res);

      assert.strictEqual(res.statusCode, 201, 'a jurisdiction lookup failure must not block the sale');
      const row = findSaleInsert(queryLog);
      assert.strictEqual(row.tax, 25, 'falls through to the normal verified-tax path');
      assert.strictEqual(row.sales_mode, null);
    } finally {
      delete require.cache[controllerPath];
      for (const { resolved, saved } of stubs) {
        if (saved) require.cache[resolved] = saved; else delete require.cache[resolved];
      }
    }
  });
});

describe('createSaleController — duty-free traveller capture', function () {
  it('persists traveller/travel-method fields when the Hub intake supplied them', async function () {
    const { controller, queryLog, restore } = loadController({
      jurisdiction: { zeroRated: true, isDutyFree: true, isExport: false, salesMode: 'duty_free' },
    });
    try {
      const req = fakeReq({
        ...BASE_BODY,
        travellerIdType: 'passport',
        travellerIdNumber: 'N1234567',
        travellerIdCountry: 'United States',
        travelMethodType: 'flight',
        travelMethodRef: 'AA123',
        travelMethodDetail: 'Gate 12',
        destination: 'London',
        departureDate: '2026-09-01',
      });
      const res = fakeRes();
      await controller.createSale(req, res);

      const row = findSaleInsert(queryLog);
      assert.strictEqual(row.traveller_id_type, 'passport');
      assert.strictEqual(row.traveller_id_number, 'N1234567');
      assert.strictEqual(row.traveller_id_country, 'United States');
      assert.strictEqual(row.travel_method_type, 'flight');
      assert.strictEqual(row.travel_method_ref, 'AA123');
      assert.strictEqual(row.travel_method_detail, 'Gate 12');
      assert.strictEqual(row.destination, 'London');
      assert.strictEqual(row.departure_date, '2026-09-01');
    } finally { restore(); }
  });

  it('accepts snake_case traveller fields the same way as camelCase', async function () {
    const { controller, queryLog, restore } = loadController({
      jurisdiction: { zeroRated: true, isDutyFree: true, isExport: false, salesMode: 'duty_free' },
    });
    try {
      const req = fakeReq({
        ...BASE_BODY,
        traveller_id_type: 'seaman_book',
        traveller_id_number: 'SB-999',
        travel_method_type: 'vessel',
        travel_method_ref: 'MSC Seaside',
      });
      const res = fakeRes();
      await controller.createSale(req, res);

      const row = findSaleInsert(queryLog);
      assert.strictEqual(row.traveller_id_type, 'seaman_book');
      assert.strictEqual(row.traveller_id_number, 'SB-999');
      assert.strictEqual(row.travel_method_type, 'vessel');
      assert.strictEqual(row.travel_method_ref, 'MSC Seaside');
    } finally { restore(); }
  });

  it('leaves every traveller column NULL on an ordinary sale', async function () {
    const { controller, queryLog, restore } = loadController({
      jurisdiction: { zeroRated: false, isDutyFree: false, isExport: false, salesMode: 'domestic' },
      verifyTaxResult: { tax: 25, reject: false, mismatch: false },
    });
    try {
      const req = fakeReq({ ...BASE_BODY });
      const res = fakeRes();
      await controller.createSale(req, res);

      const row = findSaleInsert(queryLog);
      [
        'traveller_id_type', 'traveller_id_number', 'traveller_id_country',
        'travel_method_type', 'travel_method_ref', 'travel_method_detail',
        'destination', 'departure_date',
      ].forEach((col) => {
        assert.strictEqual(row[col], null, `${col} should be null on an ordinary sale`);
      });
    } finally { restore(); }
  });
});

describe('createSaleController — payment method validation', function () {
  const CUSTOM_METHOD_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  it('accepts a UUID payment method whose DB code is not in the fixed system-code list (regression: was 400 "Invalid payment method ID")', async function () {
    const { controller, restore } = loadController({
      jurisdiction: { zeroRated: false, isDutyFree: false, isExport: false, salesMode: 'domestic' },
      verifyTaxResult: { tax: 25, reject: false, mismatch: false },
      // Simulates a tenant-configured payment method (Settings → Payment
      // Methods) with a code that was never in createSaleController's old
      // hardcoded codeMapping dict — e.g. 'online', 'gift_card', 'stripe_terminal'.
      paymentMethodRows: [{ code: 'gift_card', name: 'Gift Card' }],
    });
    try {
      const req = fakeReq({ ...BASE_BODY, payment_method_id: CUSTOM_METHOD_UUID });
      const res = fakeRes();
      await controller.createSale(req, res);

      assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
    } finally { restore(); }
  });

  it('accepts a tenant-owned opaque demo payment method ID and deducts stock in the sale transaction', async function () {
    const { controller, queryLog, restore } = loadController({
      jurisdiction: { zeroRated: true, isDutyFree: true, isExport: false, salesMode: 'duty_free' },
      paymentMethodRows: [{ code: 'cash', name: 'Cash' }],
    });
    try {
      const req = fakeReq({
        ...BASE_BODY,
        payment_method_id: 'demo0001-jw00-0000-0000-00000000pm1',
        tax: 0,
      });
      const res = fakeRes();
      await controller.createSale(req, res);

      assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
      assert.ok(queryLog.some((q) => /UPDATE products SET stock_quantity/.test(q.sql)));
      assert.ok(queryLog.some((q) => /INSERT INTO stock_adjustments/.test(q.sql)));
    } finally { restore(); }
  });

  it('still rejects a UUID that does not resolve to an active payment method for this tenant', async function () {
    const { controller, queryLog, restore } = loadController({
      jurisdiction: { zeroRated: false, isDutyFree: false, isExport: false, salesMode: 'domestic' },
      verifyTaxResult: { tax: 25, reject: false, mismatch: false },
      paymentMethodRows: [], // no matching row — wrong tenant, inactive, or nonexistent
    });
    try {
      const req = fakeReq({ ...BASE_BODY, payment_method_id: CUSTOM_METHOD_UUID });
      const res = fakeRes();
      await controller.createSale(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.message, 'Invalid payment method ID.');
    } finally { restore(); }
  });

  it('still rejects an unrecognized plain (non-UUID) code', async function () {
    const { controller, restore } = loadController({
      jurisdiction: { zeroRated: false, isDutyFree: false, isExport: false, salesMode: 'domestic' },
      verifyTaxResult: { tax: 25, reject: false, mismatch: false },
    });
    try {
      const req = fakeReq({ ...BASE_BODY, payment_method_id: 'not-a-real-method' });
      const res = fakeRes();
      await controller.createSale(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.body.message, 'Invalid payment method ID.');
    } finally { restore(); }
  });

  it('still special-cases an empty-code UUID method as "none" ($0 totals only)', async function () {
    const { controller, restore } = loadController({
      jurisdiction: { zeroRated: false, isDutyFree: false, isExport: false, salesMode: 'domestic' },
      verifyTaxResult: { tax: 0, reject: false, mismatch: false },
      paymentMethodRows: [{ code: '', name: 'No Payment Required' }],
    });
    try {
      const req = fakeReq({
        ...BASE_BODY,
        payment_method_id: CUSTOM_METHOD_UUID,
        items: [{ productId: 'p1', quantity: 1, price: 0 }],
        tax: 0,
      });
      const res = fakeRes();
      await controller.createSale(req, res);

      assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
    } finally { restore(); }
  });
});
