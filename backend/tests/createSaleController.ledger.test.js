/**
 * createSaleController — ledger posting (money accounts).
 *
 * The Phase-2 accounting hook posts a balanced journal entry inside the
 * sale's own transaction: Dr the tender account for the sale total, Cr
 * sales revenue for the net amount, Cr tax payable for the tax leg. These
 * tests stub moneyPostingService via the require cache (same technique as
 * createSaleController.dutyFree.test.js) and assert the controller builds
 * the right entry, writes the tender record, and rolls the sale back when
 * posting fails.
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

function loadController({
  jurisdiction,
  verifyTaxResult,
  queryLog = [],
  paymentMethodRows = [],
  posted = [],
  tenderCalls = [],
  postEntryError = null,
  resolveMap = {},
}) {
  const controllerPath = require.resolve('../controllers/createSaleController');
  const flags = { rolledBack: false, committed: false };

  const fakeConnection = {
    async beginTransaction() {},
    async query(sql, values) {
      queryLog.push({ sql, values });
      if (/SELECT .*\bstock_quantity\b.*FROM products/.test(sql)) {
        return [[{ store_id: 'store-1', stock_quantity: 10 }]];
      }
      return [{ affectedRows: 0, insertId: 0 }];
    },
    async commit() { flags.committed = true; },
    async rollback() { flags.rolledBack = true; },
    release() {},
  };

  const stubs = [
    stubModule('../config/db', {
      pool: {
        getConnection: async () => fakeConnection,
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
    stubModule('../services/moneyPostingService', {
      tenderAccountId: async (conn, tenantId, code, direction) => {
        tenderCalls.push({ code, direction });
        return 'acct-tender';
      },
      resolveAccountId: async (tenantId, mappingKey) => resolveMap[mappingKey] ?? `acct-${mappingKey}`,
      postEntry: async (input) => {
        if (postEntryError) throw postEntryError;
        posted.push(input);
        return { entryId: 'je-1', entryNumber: 'JE-2026-000001' };
      },
    }),
  ];

  delete require.cache[controllerPath];
  const controller = require(controllerPath);

  return {
    controller,
    queryLog,
    posted,
    tenderCalls,
    flags,
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
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const DOMESTIC = { zeroRated: false, isDutyFree: false, isExport: false, salesMode: 'domestic' };

const BASE_BODY = {
  items: [{ productId: 'p1', quantity: 1, price: 100 }],
  store_id: 'store-1',
  payment_method_id: 'cash',
  tax: 25,
};

const sum = (lines, key) => lines.reduce((s, l) => s + (Number(l[key]) || 0), 0);

describe('createSaleController — ledger posting', function () {

  it('posts a balanced Dr tender / Cr revenue / Cr tax entry inside the sale transaction', async function () {
    const { controller, posted, queryLog, restore } = loadController({
      jurisdiction: DOMESTIC,
      verifyTaxResult: { tax: 25, reject: false, mismatch: false },
    });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({ ...BASE_BODY }), res);
      assert.strictEqual(res.statusCode, 201, `expected 201, got ${JSON.stringify(res.body)}`);

      assert.strictEqual(posted.length, 1);
      const entry = posted[0];
      assert.strictEqual(entry.sourceType, 'sale');
      assert.strictEqual(entry.tenantId, 'tenant-1');
      assert.strictEqual(entry.storeId, 'store-1');
      assert.ok(entry.sourceId, 'entry carries the sale id for idempotency');

      // 100 net + 25 tax = 125 tendered.
      assert.strictEqual(entry.lines.length, 3);
      const debit = entry.lines.find((l) => l.debit > 0);
      const revenue = entry.lines.find((l) => l.accountId === 'acct-event:revenue');
      const tax = entry.lines.find((l) => l.accountId === 'acct-event:tax');
      assert.strictEqual(debit.accountId, 'acct-tender');
      assert.strictEqual(debit.debit, 125);
      assert.strictEqual(revenue.credit, 100);
      assert.strictEqual(tax.credit, 25);
      assert.strictEqual(sum(entry.lines, 'debit'), sum(entry.lines, 'credit'));
    } finally { restore(); }
  });

  it('posts only tender + revenue when the sale carries no tax', async function () {
    const { controller, posted, restore } = loadController({ jurisdiction: DOMESTIC });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({ ...BASE_BODY, tax: 0 }), res);
      assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
      assert.strictEqual(posted.length, 1);
      assert.strictEqual(posted[0].lines.length, 2);
      assert.ok(!posted[0].lines.some((l) => l.accountId === 'acct-event:tax'));
      assert.strictEqual(sum(posted[0].lines, 'debit'), sum(posted[0].lines, 'credit'));
    } finally { restore(); }
  });

  it('resolves the tender account by normalized code for each supported method', async function () {
    for (const method of ['cash', 'card', 'phone', 'on_account', 'stripe', 'paypal']) {
      const { controller, posted, tenderCalls, restore } = loadController({ jurisdiction: DOMESTIC });
      try {
        const res = fakeRes();
        await controller.createSale(fakeReq({ ...BASE_BODY, payment_method_id: method }), res);
        assert.strictEqual(res.statusCode, 201, `${method}: ${JSON.stringify(res.body)}`);
        assert.deepStrictEqual(tenderCalls[0], { code: method, direction: 'in' });
        // on_account posts to AR via its tender mapping — still Dr side.
        assert.strictEqual(posted[0].lines[0].accountId, 'acct-tender');
      } finally { restore(); }
    }
  });

  it('custom tenant payment methods resolve their own code and still post', async function () {
    const { controller, posted, tenderCalls, restore } = loadController({
      jurisdiction: DOMESTIC,
      paymentMethodRows: [{ code: 'wallet', name: 'Store Wallet' }],
    });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({ ...BASE_BODY, payment_method_id: 'pm-custom-uuid-1' }), res);
      assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
      assert.deepStrictEqual(tenderCalls[0], { code: 'wallet', direction: 'in' });
      assert.strictEqual(posted.length, 1);
    } finally { restore(); }
  });

  it('writes a payment_transactions row for the tender', async function () {
    const { controller, queryLog, restore } = loadController({
      jurisdiction: DOMESTIC,
      verifyTaxResult: { tax: 25, reject: false, mismatch: false },
    });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({ ...BASE_BODY }), res);
      assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
      const pt = queryLog.find((q) => /INSERT INTO payment_transactions/.test(q.sql));
      assert.ok(pt, 'payment_transactions insert executed');
      // VALUES (id, tenant_id, sale_id, payment_method_id, amount, 'COMPLETED')
      assert.strictEqual(pt.values[1], 'tenant-1');
      assert.strictEqual(pt.values[3], 'cash');
      assert.strictEqual(pt.values[4], 125);
    } finally { restore(); }
  });

  it('a ledger posting failure rolls the sale back', async function () {
    const { controller, posted, flags, restore } = loadController({
      jurisdiction: DOMESTIC,
      postEntryError: new Error('account inactive'),
    });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({ ...BASE_BODY }), res);
      assert.strictEqual(res.statusCode, 500, JSON.stringify(res.body));
      assert.strictEqual(flags.rolledBack, true);
      assert.strictEqual(flags.committed, false);
      assert.strictEqual(posted.length, 0);
    } finally { restore(); }
  });

  it('a $0 "none" sale skips journal posting entirely', async function () {
    const { controller, posted, tenderCalls, restore } = loadController({ jurisdiction: DOMESTIC });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({
        ...BASE_BODY,
        payment_method_id: 'none',
        tax: 0,
        items: [{ productId: 'p1', quantity: 1, price: 0 }],
      }), res);
      assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
      assert.strictEqual(posted.length, 0);
      assert.strictEqual(tenderCalls.length, 0);
    } finally { restore(); }
  });
});
