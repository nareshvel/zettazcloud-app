/**
 * printDocumentSettingsController — pool.query() return-shape regression.
 *
 * WHY THIS EXISTS
 * ----------------
 * `backend/config/db.js` exports two different things both casually called
 * "pool" depending on how a controller requires it:
 *
 *   const pool = require('../config/db')          // whole exports object
 *   pool.query(sql, params)                        // -> returns ROWS ARRAY directly
 *
 *   const { pool } = require('../config/db')       // real mysql2 pool
 *   pool.query(sql, params)                        // -> returns [rows, fields] TUPLE
 *
 * printDocumentSettingsController.js uses the first style (matching
 * printerSettingsController.js's existing convention), so destructuring the
 * result with `const [rows] = await pool.query(...)` silently grabs row zero
 * instead of the rows array — every GET returned a 500 in production the
 * first time this shipped (2026-08-26), caught by a real browser console
 * error. printerSettingsController.js's `updatePrinterSettings`/
 * `testPrintSettings` had the identical latent bug, fixed in the same pass.
 *
 * This test stubs `../config/db` as the flat, non-tuple shape and asserts the
 * controller returns real settings data rather than crashing.
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

function loadController(queryImpl, extraDb = {}) {
  const controllerPath = require.resolve('../controllers/printDocumentSettingsController');
  const stub = stubModule('../config/db', { query: queryImpl, ...extraDb });
  delete require.cache[controllerPath];
  const controller = require('../controllers/printDocumentSettingsController');
  return { controller, restore: () => { require.cache[stub.resolved] = stub.saved; delete require.cache[controllerPath]; } };
}

function fakeRes() {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

describe('printDocumentSettingsController — pool.query() return shape', function () {
  it('getPrintDocumentSettings returns settings when the store has existing rows (flat array, not a tuple)', async function () {
    const existingRows = [
      { id: 'row-1', document_type: 'receipt', delivery_mode: 'browser', printer_name: null, paper_width: 80, template_id: null, copies: 1, enabled: 1, auto_print: 0 },
    ];
    const { controller, restore } = loadController(async (sql) => {
      if (/FROM print_document_settings/.test(sql)) return existingRows;
      if (/FROM stores/.test(sql)) return [{ default_sale_document_type: 'receipt' }];
      return [];
    });
    try {
      const req = { params: { storeId: 'store-1' }, headers: { 'x-tenant-id': 'tenant-1' }, query: {} };
      const res = fakeRes();
      await controller.getPrintDocumentSettings(req, res);

      assert.strictEqual(res.statusCode, 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.status, 'success');
      assert.ok(Array.isArray(res.body.data.settings), 'settings must be an array');
      assert.strictEqual(res.body.data.settings.length, 2, 'one row per document type (receipt, invoice)');
      const receiptRow = res.body.data.settings.find((s) => s.document_type === 'receipt');
      assert.strictEqual(receiptRow.id, 'row-1', 'the real existing row must be used, not a default');
      assert.strictEqual(res.body.data.defaultSaleDocumentType, 'receipt');
    } finally {
      restore();
    }
  });

  it('getPrintDocumentSettings falls back to defaults for a store with no rows yet, without crashing', async function () {
    const { controller, restore } = loadController(async (sql) => {
      if (/FROM print_document_settings/.test(sql)) return [];
      if (/FROM stores/.test(sql)) return [];
      return [];
    });
    try {
      const req = { params: { storeId: 'store-2' }, headers: { 'x-tenant-id': 'tenant-1' }, query: {} };
      const res = fakeRes();
      await controller.getPrintDocumentSettings(req, res);

      assert.strictEqual(res.statusCode, 200, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
      assert.strictEqual(res.body.data.settings.length, 2);
      assert.strictEqual(res.body.data.defaultSaleDocumentType, 'receipt');
    } finally {
      restore();
    }
  });
});

describe('printDocumentSettingsController — atomic validated save', function () {
  const setting = (documentType, templateId) => ({
    id: null, storeId: 'store-1', documentType, deliveryMode: 'browser',
    printerName: null, paperWidth: documentType === 'invoice' ? 210 : 80,
    mediaSize: documentType === 'invoice' ? 'a4' : '80mm', templateId,
    copies: 1, enabled: true, autoPrint: false,
  });

  it('saves both routes and the default format in one transaction', async function () {
    const queries = [];
    const connection = {
      query: async (sql, values) => {
        queries.push({ sql, values });
        if (/SELECT id FROM stores/.test(sql)) return [[{ id: 'store-1' }]];
        if (/SELECT id FROM print_templates/.test(sql)) return [[{ id: values[0] }]];
        return [{ affectedRows: 1 }];
      },
    };
    const { controller, restore } = loadController(async () => [], {
      executeTransaction: async (callback) => callback(connection),
    });
    try {
      const req = {
        params: { storeId: 'store-1' }, user: { tenant_id: 'tenant-1' },
        body: {
          default_sale_document_type: 'invoice',
          settings: {
            receipt: {
              ...setting('receipt', 'receipt-template'),
              delivery_mode: 'browser', media_size: '80mm', template_id: 'receipt-template', auto_print: false,
              deliveryMode: undefined, mediaSize: undefined, templateId: undefined, autoPrint: undefined,
            },
            invoice: {
              ...setting('invoice', 'invoice-template'),
              delivery_mode: 'browser', media_size: 'a4', template_id: 'invoice-template', auto_print: false,
              deliveryMode: undefined, mediaSize: undefined, templateId: undefined, autoPrint: undefined,
            },
          },
        },
      };
      const res = fakeRes();
      await controller.updateAllPrintDocumentSettings(req, res);

      assert.strictEqual(res.statusCode, 200, JSON.stringify(res.body));
      assert.strictEqual(queries.filter((q) => /INSERT INTO print_document_settings/.test(q.sql)).length, 2);
      assert.ok(queries.some((q) => /UPDATE stores SET default_sale_document_type/.test(q.sql)));
    } finally { restore(); }
  });

  it('rejects a disabled default route before opening a transaction', async function () {
    let transactionStarted = false;
    const { controller, restore } = loadController(async () => [], {
      executeTransaction: async () => { transactionStarted = true; },
    });
    try {
      const invoice = setting('invoice', 'invoice-template');
      invoice.enabled = false;
      const req = {
        params: { storeId: 'store-1' }, user: { tenant_id: 'tenant-1' },
        body: {
          defaultSaleDocumentType: 'invoice',
          settings: { receipt: setting('receipt', 'receipt-template'), invoice },
        },
      };
      const res = fakeRes();
      await controller.updateAllPrintDocumentSettings(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(transactionStarted, false);
      assert.ok(res.body.errors['invoice.enabled']);
    } finally { restore(); }
  });
});
