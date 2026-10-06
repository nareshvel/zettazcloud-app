/**
 * Demo sales arithmetic.
 *
 * Demo money that does not add up is worse than no demo money at all: it makes
 * correct software look broken, and it is discovered in front of a customer.
 *
 * This suite re-derives every figure from the seed file independently of the
 * generator that produced it. That independence is the point — checking the
 * numbers with the same code that wrote them would prove nothing.
 *
 * It already earned its keep. The first version of the seed stored
 * `tax_per_unit` rounded to 2dp, so a 5-unit line of bananas
 * (3.99 @ ABST 15% = 0.5985/unit) reconciled to 3.00 against a sale header of
 * 2.99. Money is rounded ONCE, at the line; per-unit values are held at the
 * full 4dp the column provides.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SEED = (() => {
  const dirs = [
    path.join(__dirname, '..', '..', 'database', 'migrations'),
    path.join(__dirname, '..', '..', 'database', 'migrations', 'applied'),
  ].filter(fs.existsSync);

  const found = dirs
    .flatMap((d) => fs.readdirSync(d).map((f) => path.join(d, f)))
    .find((f) => f.endsWith('_demo_sales_history.demo.sql'));

  return found ? fs.readFileSync(found, 'utf8') : null;
})();

/** Rows of one INSERT block, as arrays of raw value tokens. */
function rowsOf(sql, table) {
  const block = new RegExp(
    `INSERT IGNORE INTO \\\`${table}\\\`[\\s\\S]*?VALUES\\n([\\s\\S]*?);`,
  ).exec(sql);
  if (!block) return [];
  return (block[1].match(/\(([^()]*)\)/g) || []).map((row) =>
    row.slice(1, -1).match(/'[^']*'|NULL|[-\d.]+/g) || []);
}

const num = (t) => Number(t);
const str = (t) => String(t).replace(/^'|'$/g, '');
/** Compare in integer cents to avoid comparing floats. */
const cents = (n) => Math.round(n * 100);

describe('Demo sales history', function () {
  before(function () {
    if (!SEED) this.skip(); // seed not present in this checkout
  });

  const sales = () => rowsOf(SEED, 'sales').map((r) => ({
    id: str(r[0]), tenantId: str(r[1]),
    subtotal: num(r[4]), tax: num(r[5]), total: num(r[6]),
    docNumber: str(r[11]),
  }));

  const items = () => rowsOf(SEED, 'sale_items').map((r) => ({
    saleId: str(r[1]), qty: num(r[3]), price: num(r[4]), taxPerUnit: num(r[6]),
  }));

  it('seeds sales for every demo tenant', function () {
    const tenants = new Set(sales().map((s) => s.tenantId));
    assert.strictEqual(tenants.size, 5, 'expected sales across all five demo tenants');
  });

  it('every sale has line items', function () {
    const withLines = new Set(items().map((i) => i.saleId));
    const orphans = sales().filter((s) => !withLines.has(s.id)).map((s) => s.id);
    assert.deepStrictEqual(orphans, [], 'sales with no lines render an empty receipt');
  });

  it('subtotal equals the sum of its lines', function () {
    const all = items();
    sales().forEach((s) => {
      const lines = all.filter((i) => i.saleId === s.id);
      const sum = lines.reduce((n, i) => n + cents(i.price) * i.qty, 0);
      assert.strictEqual(
        sum, cents(s.subtotal),
        `${s.id}: subtotal ${s.subtotal} but lines sum to ${sum / 100}`,
      );
    });
  });

  it('line tax reconciles to the sale tax', function () {
    // Tolerance of half a cent per line: tax is rounded once at the line, so
    // qty x tax_per_unit can differ in the sub-cent digits. It must NOT differ
    // by a whole cent — that is the 2dp-storage bug this suite was written for.
    const all = items();
    sales().forEach((s) => {
      const lines = all.filter((i) => i.saleId === s.id);
      const sum = lines.reduce((n, i) => n + i.taxPerUnit * i.qty, 0);
      const drift = Math.abs(sum - s.tax);
      assert.ok(
        drift < 0.005 * Math.max(lines.length, 1),
        `${s.id}: tax ${s.tax} but lines give ${sum.toFixed(4)} — `
        + 'is tax_per_unit stored at 2dp instead of 4dp?',
      );
    });
  });

  it('total is subtotal plus tax', function () {
    sales().forEach((s) => {
      assert.strictEqual(
        cents(s.total), cents(s.subtotal) + cents(s.tax),
        `${s.id}: total ${s.total} != ${s.subtotal} + ${s.tax}`,
      );
    });
  });

  it('the duty-free tenant is charged NO tax', function () {
    // The single property that makes it a duty-free demo.
    const dutyFree = sales().filter((s) => s.tenantId.includes('jw00'));
    assert.ok(dutyFree.length > 0, 'no jewelry sales seeded');
    dutyFree.forEach((s) => {
      assert.strictEqual(s.tax, 0, `${s.id}: duty-free sale carries ${s.tax} tax`);
    });
  });

  it('a non-duty-free tenant IS charged tax', function () {
    // Guards against the previous assertion passing because nothing is taxed.
    const taxed = sales().filter((s) => !s.tenantId.includes('jw00'));
    assert.ok(taxed.every((s) => s.tax > 0), 'a domestic demo sale has zero tax');
  });

  it('document numbers are unique within a tenant', function () {
    const seen = new Map();
    sales().forEach((s) => {
      const key = `${s.tenantId}|${s.docNumber}`;
      assert.ok(!seen.has(key), `duplicate document number ${s.docNumber}`);
      seen.set(key, true);
    });
  });

  it('sequence counters match the highest number issued', function () {
    // If the counters lag, the next real sale reissues a number already on a
    // receipt and trips the unique key on (tenant_id, document_number).
    const counters = rowsOf(SEED, 'document_sequences')
      .map((r) => ({ tenantId: str(r[1]), value: num(r[5]) }));

    assert.ok(counters.length > 0, 'no sequence counters seeded');

    const highest = new Map();
    sales().forEach((s) => {
      const n = Number(s.docNumber.split('-').pop());
      highest.set(s.tenantId, Math.max(highest.get(s.tenantId) || 0, n));
    });

    highest.forEach((max, tenantId) => {
      const counter = counters.find((c) => c.tenantId === tenantId);
      assert.ok(counter, `no counter seeded for ${tenantId}`);
      assert.strictEqual(
        counter.value, max,
        `${tenantId}: counter at ${counter.value} but ${max} numbers were issued — `
        + 'the next sale would reissue an existing number',
      );
    });
  });
});
