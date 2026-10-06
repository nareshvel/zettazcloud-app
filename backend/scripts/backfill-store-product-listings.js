/**
 * backfill-store-product-listings.js
 *
 * Part of the multi-store data-sharing model:
 * docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md §3, §9
 * Phase 2.
 *
 * `store_product_listings` (added by
 * database/migrations/2026-09-07_store_product_listings.sql) is how a
 * tenant-wide shared product (`products.store_id IS NULL`) gets a per-store
 * price/stock. Until a row exists for a given (store, product) pair, that
 * product cannot be sold at that store — createSaleController.js's
 * `adjustStockForUpdate` throws when no row is found.
 *
 * This script creates the missing rows: for every tenant, for every shared
 * product, for every active (non-deleted) store owned by that tenant, insert
 * a `store_product_listings` row if one doesn't already exist. `price` and
 * `cost_price_override` are left NULL (inherit from the product), and
 * `stock_quantity` starts at 0 — per the product owner's answer to open
 * question #1 (stock is never shared/copied; it's stocked at each store via
 * its own GRN/stock-adjustment flow after this backfill runs).
 *
 * Idempotent: safe to re-run. Only inserts rows that don't already exist
 * (checked via the table's own `UNIQUE(store_id, product_id)` — this script
 * uses `INSERT IGNORE` so a concurrent/partial prior run can't collide).
 *
 * Usage:
 *   node scripts/backfill-store-product-listings.js            (dry run — reports only)
 *   node scripts/backfill-store-product-listings.js --execute   (actually inserts)
 *   node scripts/backfill-store-product-listings.js --execute --tenant <tenantId>  (scope to one tenant)
 */

const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');

const EXECUTE = process.argv.includes('--execute');
const tenantArgIdx = process.argv.indexOf('--tenant');
const ONLY_TENANT = tenantArgIdx !== -1 ? process.argv[tenantArgIdx + 1] : null;

async function main() {
  const connection = await pool.getConnection();
  try {
    const tenantFilter = ONLY_TENANT ? 'AND p.tenant_id = ?' : '';
    const params = ONLY_TENANT ? [ONLY_TENANT] : [];

    // Every shared product crossed with every active store in the same tenant,
    // excluding pairs that already have a listing row.
    const [missing] = await connection.query(
      `SELECT p.tenant_id, p.id AS product_id, s.id AS store_id
       FROM products p
       JOIN stores s ON s.tenant_id = p.tenant_id AND s.deleted_at IS NULL
       LEFT JOIN store_product_listings spl
         ON spl.product_id = p.id AND spl.store_id = s.id
       WHERE p.store_id IS NULL ${tenantFilter}
         AND spl.id IS NULL`,
      params
    );

    if (missing.length === 0) {
      console.log('No missing store_product_listings rows found. Nothing to do.');
      return;
    }

    const byTenant = {};
    for (const row of missing) {
      byTenant[row.tenant_id] = (byTenant[row.tenant_id] || 0) + 1;
    }
    console.log(`Found ${missing.length} missing listing row(s) across ${Object.keys(byTenant).length} tenant(s):`);
    for (const [tenantId, count] of Object.entries(byTenant)) {
      console.log(`  - tenant ${tenantId}: ${count} row(s)`);
    }
    console.log('');

    if (!EXECUTE) {
      console.log('Dry run only — no rows were inserted. Re-run with --execute to actually backfill.');
      return;
    }

    let inserted = 0;
    for (const row of missing) {
      const [result] = await connection.query(
        `INSERT IGNORE INTO store_product_listings
          (id, tenant_id, store_id, product_id, price, cost_price_override, stock_quantity, is_active)
         VALUES (?, ?, ?, ?, NULL, NULL, 0, 1)`,
        [uuidv4(), row.tenant_id, row.store_id, row.product_id]
      );
      inserted += result.affectedRows;
    }

    console.log(`\nBackfill complete — inserted ${inserted} row(s).`);
    if (inserted < missing.length) {
      console.log(`(${missing.length - inserted} were skipped — already existed, created concurrently since the scan.)`);
    }
    console.log('\nEvery shared product now has a listing row at every active store, with stock 0.');
    console.log('Stock still needs to be brought in per store via GRN / stock adjustment, same as any store-owned product.');
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('backfill-store-product-listings.js failed:', err);
  process.exit(1);
});
