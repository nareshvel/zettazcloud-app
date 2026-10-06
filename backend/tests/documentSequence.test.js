/**
 * Sequential document numbering.
 *
 * The property under test is GAPLESSNESS, and it is a property of *where* the
 * allocation happens, not of the arithmetic. So these tests drive the service
 * through a fake connection that models the two things a real one does and a
 * naive fake would not:
 *
 *   * FOR UPDATE takes a row lock, so a second allocator waits
 *   * a rollback discards uncommitted writes
 *
 * Without those, a test would happily pass against an implementation that
 * allocates outside the transaction — which is the bug this feature exists to
 * avoid, and the one the removed duty_free_invoice_sequences shipped with.
 */

const assert = require('assert');
const Module = require('module');
const path = require('path');

// ---------------------------------------------------------------------------
// Load the service with its DB dependencies stubbed.
//
// The service requires config/db and jurisdictionService at module load. Neither
// is needed for allocate(), which is handed a connection, but requiring them
// would open a real pool. Intercepting the resolution keeps this suite free of
// a database while still exercising the real allocate() code.
// ---------------------------------------------------------------------------
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === '../config/db') return { pool: { query: async () => [[]] } };
  if (request === './jurisdictionService') {
    return { getJurisdictionProfile: async () => ({ profile: {} }) };
  }
  return originalLoad.apply(this, arguments);
};
const documentSequence = require('../services/documentSequenceService');
Module._load = originalLoad;

/**
 * A connection that behaves enough like InnoDB to be worth testing against.
 *
 * `store` is committed state. `pending` is this transaction's uncommitted
 * writes. Rolling back throws `pending` away, which is what makes the
 * "no gap after a failed sale" test meaningful rather than decorative.
 */
function makeDb() {
  const store = new Map();   // scopeKey -> { id, current_value, prefix, padding }
  const locks = new Map();   // scopeKey -> owning transaction

  const key = (t, s, d, p) => `${t}|${s}|${d}|${p}`;

  return {
    store,
    connection(txName = 'tx') {
      const pending = new Map();
      let rolledBack = false;

      const view = (k) => (pending.has(k) ? pending.get(k) : store.get(k));

      return {
        txName,
        async query(sql, params) {
          if (rolledBack) throw new Error('transaction already rolled back');

          if (/^\s*SELECT invoice_number_prefix/i.test(sql)) {
            return [[{ prefix: 'INV', reset: 'yearly' }]];
          }

          if (/INSERT IGNORE INTO document_sequences/i.test(sql)) {
            // 7 params, not 8: current_value is the literal 0 in the SQL, so it
            // consumes no placeholder.
            const [id, t, s, d, p, prefix, padding] = params;
            const k = key(t, s, d, p);
            // INSERT IGNORE: the unique key means the second writer is a no-op.
            if (!view(k)) pending.set(k, { id, current_value: 0, prefix, padding });
            return [{ affectedRows: 1 }];
          }

          if (/FROM document_sequences[\s\S]*FOR UPDATE/i.test(sql)) {
            const [t, s, d, p] = params;
            const k = key(t, s, d, p);
            const owner = locks.get(k);
            if (owner && owner !== txName) {
              // A real connection would block here. Throwing makes the
              // violation visible instead of silently interleaving.
              throw new Error(`row ${k} is locked by ${owner}`);
            }
            locks.set(k, txName);
            const row = view(k);
            return [row ? [{ ...row }] : []];
          }

          if (/UPDATE document_sequences SET current_value/i.test(sql)) {
            const [next, id] = params;
            for (const [k, row] of [...store, ...pending]) {
              if (row.id === id) pending.set(k, { ...row, current_value: next });
            }
            return [{ affectedRows: 1 }];
          }

          if (/SELECT current_value/i.test(sql)) {
            const [t, s, d, p] = params;
            const row = view(key(t, s, d, p));
            return [row ? [{ ...row }] : []];
          }

          throw new Error(`unexpected SQL: ${sql.slice(0, 60)}`);
        },
        async commit() {
          for (const [k, v] of pending) store.set(k, v);
          pending.clear();
          for (const [k, owner] of [...locks]) if (owner === txName) locks.delete(k);
        },
        async rollback() {
          rolledBack = true;
          pending.clear();
          for (const [k, owner] of [...locks]) if (owner === txName) locks.delete(k);
        },
      };
    },
  };
}

const SCOPE = { tenantId: 't1', storeId: 's1', docType: 'sale' };
const JAN_2026 = new Date(Date.UTC(2026, 0, 15));

describe('Document sequence — allocation', function () {
  it('refuses to allocate without a connection', function () {
    // Being handed the pool instead of the transaction connection is the
    // mistake that silently reintroduces gaps. It must fail loudly.
    return documentSequence.allocate(null, SCOPE).then(
      () => { throw new Error('expected a rejection'); },
      (err) => assert.match(err.message, /transaction connection, not the pool/),
    );
  });

  it('issues 1 for the first document', async function () {
    const db = makeDb();
    const conn = db.connection();
    const n = await documentSequence.allocate(conn, { ...SCOPE, date: JAN_2026 });
    assert.strictEqual(n, 'INV-2026-000001');
  });

  it('increments without gaps across a run', async function () {
    const db = makeDb();
    const issued = [];
    for (let i = 0; i < 5; i += 1) {
      const conn = db.connection(`tx${i}`);
      issued.push(await documentSequence.allocate(conn, { ...SCOPE, date: JAN_2026 }));
      await conn.commit();
    }
    assert.deepStrictEqual(issued, [
      'INV-2026-000001', 'INV-2026-000002', 'INV-2026-000003',
      'INV-2026-000004', 'INV-2026-000005',
    ]);
  });

  it('never issues the same number twice', async function () {
    const db = makeDb();
    const seen = new Set();
    for (let i = 0; i < 25; i += 1) {
      const conn = db.connection(`tx${i}`);
      const n = await documentSequence.allocate(conn, { ...SCOPE, date: JAN_2026 });
      await conn.commit();
      assert.ok(!seen.has(n), `duplicate number issued: ${n}`);
      seen.add(n);
    }
    assert.strictEqual(seen.size, 25);
  });

  it('takes a row lock, so a second till cannot read the same value', async function () {
    // The lock is the whole mechanism. Without FOR UPDATE two tills read the
    // same current_value and issue the same invoice number.
    const db = makeDb();
    const a = db.connection('till-A');
    const b = db.connection('till-B');

    await documentSequence.allocate(a, { ...SCOPE, date: JAN_2026 });
    await assert.rejects(
      () => documentSequence.allocate(b, { ...SCOPE, date: JAN_2026 }),
      /locked by till-A/,
      'the second allocation was not blocked by the first',
    );
  });

  it('leaves NO GAP when the sale rolls back', async function () {
    // The reason allocate() takes the caller's connection. A failed sale must
    // return its number to the sequence.
    const db = makeDb();

    const ok = db.connection('tx1');
    assert.strictEqual(
      await documentSequence.allocate(ok, { ...SCOPE, date: JAN_2026 }),
      'INV-2026-000001',
    );
    await ok.commit();

    const doomed = db.connection('tx2');
    assert.strictEqual(
      await documentSequence.allocate(doomed, { ...SCOPE, date: JAN_2026 }),
      'INV-2026-000002',
    );
    await doomed.rollback();          // the sale failed

    const next = db.connection('tx3');
    assert.strictEqual(
      await documentSequence.allocate(next, { ...SCOPE, date: JAN_2026 }),
      'INV-2026-000002',
      'a rolled-back sale burned a number and left a gap',
    );
  });

  it('numbers each document type independently', async function () {
    const db = makeDb();
    const a = db.connection('tx1');
    const sale = await documentSequence.allocate(a, { ...SCOPE, date: JAN_2026 });
    await a.commit();

    const b = db.connection('tx2');
    const credit = await documentSequence.allocate(
      b, { ...SCOPE, docType: 'credit_note', date: JAN_2026 },
    );
    await b.commit();

    assert.strictEqual(sale, 'INV-2026-000001');
    assert.strictEqual(credit, 'INV-2026-000001', 'credit notes share the sales counter');
  });

  it('restarts at 1 in a new period', async function () {
    const db = makeDb();
    const a = db.connection('tx1');
    await documentSequence.allocate(a, { ...SCOPE, date: JAN_2026 });
    await a.commit();

    const b = db.connection('tx2');
    const n = await documentSequence.allocate(
      b, { ...SCOPE, date: new Date(Date.UTC(2027, 0, 2)) },
    );
    assert.strictEqual(n, 'INV-2027-000001');
  });
});

describe('Document sequence — period resolution', function () {
  const d = new Date(Date.UTC(2026, 7, 24));

  it('yearly is the default', function () {
    assert.strictEqual(documentSequence.periodFor('yearly', d), '2026');
    assert.strictEqual(documentSequence.periodFor(undefined, d), '2026');
  });

  it('monthly zero-pads, so periods sort correctly as strings', function () {
    // '2026-8' would sort after '2026-10'. The padding is load-bearing.
    assert.strictEqual(documentSequence.periodFor('monthly', d), '2026-08');
  });

  it('never yields a single bucket', function () {
    assert.strictEqual(documentSequence.periodFor('never', d), 'ALL');
  });
});

describe('Document sequence — formatting', function () {
  it('pads to a fixed width', function () {
    assert.strictEqual(
      documentSequence.format({ prefix: 'INV', period: '2026', next: 417 }),
      'INV-2026-000417',
    );
  });

  it('omits the period for a non-resetting sequence', function () {
    // 'ALL' is a bucket label, not something to print on an invoice.
    assert.strictEqual(
      documentSequence.format({ prefix: 'INV', period: 'ALL', next: 7 }),
      'INV-000007',
    );
  });

  it('works with no prefix configured', function () {
    assert.strictEqual(
      documentSequence.format({ prefix: null, period: '2026', next: 7 }),
      '2026-000007',
    );
  });

  it('does not truncate a number wider than the padding', function () {
    // Better a wider number than a wrong one: truncating would issue a
    // duplicate once the counter passes 999999.
    assert.strictEqual(
      documentSequence.format({ prefix: 'INV', period: '2026', next: 12345678, padding: 6 }),
      'INV-2026-12345678',
    );
  });
});

describe('Document sequence — the sale controller uses it correctly', function () {
  const fs = require('fs');
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'controllers', 'createSaleController.js'), 'utf8',
  );

  it('allocates on the transaction connection, not the pool', function () {
    // The single most important line in the feature.
    assert.ok(
      /documentSequenceService\.allocate\(\s*connection\s*,/.test(src),
      'the sale allocates outside its transaction — rolled-back sales will leave gaps',
    );
  });

  it('allocates before the sale INSERT, inside the transaction', function () {
    const begin = src.indexOf('beginTransaction');
    const alloc = src.indexOf('documentSequenceService.allocate');
    const insert = src.indexOf('INSERT INTO sales');
    assert.ok(begin < alloc && alloc < insert, 'allocation is outside the transaction body');
  });

  it('persists the number on the sale', function () {
    assert.ok(/document_number/.test(src), 'the issued number is never stored');
  });

  it('refuses the sale when mandatory numbering fails', function () {
    // An unnumbered invoice where numbering is required is not a valid
    // document. Recording the sale anyway produces paperwork that fails audit.
    const tail = src.slice(src.indexOf('documentSequenceService.isEnabledFor'));
    assert.ok(/mandatory/.test(tail) && /rollback/.test(tail.slice(0, 2000)));
  });
});
