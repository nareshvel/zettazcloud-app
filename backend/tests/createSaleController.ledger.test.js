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
  unitCostValue = 0,
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
      unitCost: async () => unitCostValue,
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
        // on_account requires a customer on the ticket (receivable needs an owner).
        const body = method === 'on_account' ? { ...BASE_BODY, customerId: 'cust-1' } : BASE_BODY;
        await controller.createSale(fakeReq({ ...body, payment_method_id: method }), res);
        assert.strictEqual(res.statusCode, 201, `${method}: ${JSON.stringify(res.body)}`);
        assert.deepStrictEqual(tenderCalls[0], { code: method, direction: 'in' });
        // on_account posts to AR via its tender mapping — still Dr side.
        assert.strictEqual(posted[0].lines[0].accountId, 'acct-tender');
      } finally { restore(); }
    }
  });

  it('bumps customers.outstanding_credit for an on_account sale', async function () {
    const { controller, queryLog, restore } = loadController({ jurisdiction: DOMESTIC });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({ ...BASE_BODY, payment_method_id: 'on_account', customerId: 'cust-9', tax: 0 }), res);
      assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
      const bump = queryLog.find((q) => /UPDATE customers SET outstanding_credit = outstanding_credit \+/.test(q.sql));
      assert.ok(bump, 'expected an outstanding_credit increment');
      assert.strictEqual(bump.values[0], 100); // full sale total goes on account
      assert.strictEqual(bump.values[1], 'cust-9');
    } finally { restore(); }
  });

  it('rejects an on_account sale without a customer', async function () {
    const { controller, restore } = loadController({ jurisdiction: DOMESTIC });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({ ...BASE_BODY, payment_method_id: 'on_account' }), res);
      assert.strictEqual(res.statusCode, 400, JSON.stringify(res.body));
      assert.match(res.body.message, /customer/i);
    } finally { restore(); }
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

  it('split tenders produce one debit leg per method and a payment row per leg', async function () {
    const { controller, posted, tenderCalls, queryLog, restore } = loadController({ jurisdiction: DOMESTIC });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({
        ...BASE_BODY,
        tax: 0,
        tenders: [{ method: 'cash', amount: 60 }, { method: 'card', amount: 40 }],
      }), res);
      assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
      assert.strictEqual(posted.length, 1);
      const debits = posted[0].lines.filter((l) => l.debit > 0);
      assert.strictEqual(debits.length, 2, 'one tender debit per leg');
      assert.deepStrictEqual(tenderCalls.map((t) => t.code), ['cash', 'card']);
      assert.strictEqual(sum(posted[0].lines, 'debit'), sum(posted[0].lines, 'credit'));
      const pt = queryLog.filter((q) => /INSERT INTO payment_transactions/.test(q.sql));
      assert.strictEqual(pt.length, 2, 'one payment_transactions row per leg');
      const saleInsert = queryLog.find((q) => /INSERT INTO sales\b/.test(q.sql));
      assert.ok(saleInsert, 'sales row written');
    } finally { restore(); }
  });

  it('rejects split tenders that do not sum to the sale total', async function () {
    const { controller, posted, restore } = loadController({ jurisdiction: DOMESTIC });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({
        ...BASE_BODY,
        tax: 0,
        tenders: [{ method: 'cash', amount: 60 }, { method: 'card', amount: 30 }],
      }), res);
      assert.strictEqual(res.statusCode, 400, JSON.stringify(res.body));
      assert.match(res.body.message, /equal the sale total/i);
      assert.strictEqual(posted.length, 0);
    } finally { restore(); }
  });

  it('rejects a split tender with an on_account leg and no customer', async function () {
    const { controller, restore } = loadController({ jurisdiction: DOMESTIC });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({
        ...BASE_BODY,
        tax: 0,
        tenders: [{ method: 'cash', amount: 60 }, { method: 'on_account', amount: 40 }],
      }), res);
      assert.strictEqual(res.statusCode, 400, JSON.stringify(res.body));
      assert.match(res.body.message, /customer/i);
    } finally { restore(); }
  });

  it('only the on_account leg of a split bumps outstanding_credit', async function () {
    const { controller, queryLog, restore } = loadController({ jurisdiction: DOMESTIC });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({
        ...BASE_BODY,
        tax: 0,
        customerId: 'cust-7',
        tenders: [{ method: 'cash', amount: 60 }, { method: 'on_account', amount: 40 }],
      }), res);
      assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
      const bump = queryLog.find((q) => /UPDATE customers SET outstanding_credit = outstanding_credit \+/.test(q.sql));
      assert.ok(bump, 'expected an outstanding_credit increment');
      assert.strictEqual(bump.values[0], 40, 'only the on-account leg accrues');
      assert.strictEqual(bump.values[1], 'cust-7');
    } finally { restore(); }
  });

  it('adds COGS and inventory legs valued from the unit cost snapshot', async function () {
    const { controller, posted, queryLog, restore } = loadController({
      jurisdiction: DOMESTIC,
      unitCostValue: 42.50,
    });
    try {
      const res = fakeRes();
      await controller.createSale(fakeReq({ ...BASE_BODY, tax: 0 }), res);
      assert.strictEqual(res.statusCode, 201, JSON.stringify(res.body));
      const entry = posted[0];
      const cogs = entry.lines.find((l) => l.accountId === 'acct-event:cogs');
      const inv = entry.lines.find((l) => l.accountId === 'acct-event:inventory');
      assert.ok(cogs && inv, 'COGS + inventory legs present');
      assert.strictEqual(cogs.debit, 42.50);
      assert.strictEqual(inv.credit, 42.50);
      assert.strictEqual(sum(entry.lines, 'debit'), sum(entry.lines, 'credit'));
      const itemInsert = queryLog.find((q) => /INSERT INTO sale_items/.test(q.sql));
      assert.ok(itemInsert, 'sale_items written with the unit_cost snapshot');
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
