/**
 * purge-expired-stores.js
 *
 * Hard-deletes any store whose 30-day soft-delete window has passed
 * (`stores.deleted_at IS NOT NULL AND stores.scheduled_purge_at <= NOW()`),
 * along with all of that store's data.
 *
 * This is the second half of the soft-delete flow added by
 * database/migrations/2026-09-05_store_soft_delete_and_default.sql and
 * backend/routes/store.routes.js's DELETE /:id (soft delete) /
 * POST /:id/restore endpoints — a store deleted via the Stores tab sits in
 * this "pending purge" state for 30 days and can be restored during that
 * window; once scheduled_purge_at passes, this script is what actually
 * removes it and its data.
 *
 * Like every other maintenance script in this directory (see
 * generate_delete_tenant_sql.js, provision-missing-print-templates.js),
 * there is NO cron/scheduler wired up anywhere in this codebase — this must
 * be run manually (e.g. via an ops cron job outside the app, or by hand).
 *
 * Usage:
 *   node scripts/purge-expired-stores.js            (dry run — reports only)
 *   node scripts/purge-expired-stores.js --execute   (actually deletes)
 *
 * What this DOES cover:
 *   - Every table with a `store_id` column, discovered live from
 *     INFORMATION_SCHEMA (same technique as generate_delete_tenant_sql.js),
 *     deleted directly on `store_id = ?`.
 *   - A hardcoded list of child tables that hang off a store-owned parent by
 *     the parent's `id` rather than their own `store_id` column (e.g.
 *     `sale_items` via `sales.id`) — mirrors the CHILD_TABLES pattern in
 *     generate_delete_tenant_sql.js, filtered to parents that are
 *     store-owned.
 *   - The `stores` row itself, deleted last.
 *
 * What this does NOT yet cover (flagged rather than silently ignored):
 *   - Any file/blob storage (product images, attachments, uploaded photos)
 *     referenced by rows in the deleted tables — those files are NOT
 *     removed from disk/object storage by this script.
 *   - Tables added after this script was written that gain a `store_id`
 *     column but are also a *parent* to further child tables not in
 *     CHILD_TABLES_VIA_STORE_PARENT below (those children would be silently
 *     orphaned rather than deleted, unless FK cascade quietly handles it —
 *     most store_id-bearing tables in this schema do NOT have enforced FK
 *     constraints; see CLAUDE.md's "FK constraints on store_id" note).
 *   - Print-related tables (print_agents, print_templates, etc.) DO have
 *     real `ON DELETE CASCADE` FKs to `stores(id)` per CLAUDE.md, so those
 *     are cleaned up automatically by the final `DELETE FROM stores` and are
 *     deliberately not listed as separate store_id-owned tables here to
 *     avoid a double-delete race — verify this remains true if that FK is
 *     ever changed.
 *
 * Run `npm run migrate:status` first to confirm the soft-delete columns
 * (`deleted_at`, `scheduled_purge_at`, `is_default_store`) exist before
 * relying on this script.
 */

const { pool } = require('../config/db');

const COLLATE = 'COLLATE utf8mb4_0900_ai_ci';
const EXECUTE = process.argv.includes('--execute');

// Child tables keyed by a store-owned parent's `id`, not their own
// `store_id` column — mirrors generate_delete_tenant_sql.js's CHILD_TABLES,
// filtered to parents that carry `store_id` in this schema.
const CHILD_TABLES_VIA_STORE_PARENT = [
  { table: 'sale_items', parentTable: 'sales', parentColumn: 'id', childColumn: 'sale_id' },
  { table: 'sale_item_discounts', parentTable: 'sales', parentColumn: 'id', childColumn: 'sale_id' },
  { table: 'sale_applied_offers', parentTable: 'sales', parentColumn: 'id', childColumn: 'sale_id' },
  { table: 'payment_gateway_transactions', parentTable: 'sales', parentColumn: 'id', childColumn: 'sale_id' },
  { table: 'sales_return_items', parentTable: 'sales_returns', parentColumn: 'id', childColumn: 'sales_return_id' },
  { table: 'grn_items', parentTable: 'goods_received_notes', parentColumn: 'id', childColumn: 'grn_id' },
  { table: 'purchase_order_items', parentTable: 'purchase_orders', parentColumn: 'id', childColumn: 'purchase_order_id' },
  { table: 'offer_price_tiers', parentTable: 'promotional_offers', parentColumn: 'id', childColumn: 'offer_id' },
  { table: 'offer_rules', parentTable: 'promotional_offers', parentColumn: 'id', childColumn: 'offer_id' },
  { table: 'offer_usage', parentTable: 'promotional_offers', parentColumn: 'id', childColumn: 'offer_id' },
];

async function getExpiredStores(connection) {
  const [rows] = await connection.query(
    `SELECT id, tenant_id, name, deleted_at, scheduled_purge_at
     FROM stores
     WHERE deleted_at IS NOT NULL AND scheduled_purge_at <= NOW()`
  );
  return rows;
}

async function getStoreOwnedTables(connection) {
  const [baseTables] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`
  );
  const baseTableSet = new Set(baseTables.map((r) => r.TABLE_NAME));

  const [storeCols] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'store_id'
     ORDER BY TABLE_NAME`
  );

  const childTableNames = new Set(CHILD_TABLES_VIA_STORE_PARENT.map((s) => s.table));
  return storeCols
    .map((r) => r.TABLE_NAME)
    .filter((t) => baseTableSet.has(t) && t !== 'stores' && !childTableNames.has(t));
}

async function purgeStore(connection, store, storeOwnedTables) {
  const counts = {};

  await connection.beginTransaction();
  try {
    for (const spec of CHILD_TABLES_VIA_STORE_PARENT) {
      const [result] = await connection.execute(
        `DELETE c FROM \`${spec.table}\` c
         JOIN \`${spec.parentTable}\` p ON c.\`${spec.childColumn}\` ${COLLATE} = p.\`${spec.parentColumn}\` ${COLLATE}
         WHERE p.store_id ${COLLATE} = ? ${COLLATE}`,
        [store.id]
      );
      if (result.affectedRows) counts[spec.table] = result.affectedRows;
    }

    for (const table of storeOwnedTables) {
      const [result] = await connection.execute(
        `DELETE FROM \`${table}\` WHERE store_id ${COLLATE} = ? ${COLLATE}`,
        [store.id]
      );
      if (result.affectedRows) counts[table] = result.affectedRows;
    }

    await connection.execute('DELETE FROM `stores` WHERE id = ?', [store.id]);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  }

  return counts;
}

async function main() {
  const connection = await pool.getConnection();
  try {
    const expiredStores = await getExpiredStores(connection);

    if (expiredStores.length === 0) {
      console.log('No stores are past their purge date. Nothing to do.');
      return;
    }

    const storeOwnedTables = await getStoreOwnedTables(connection);

    console.log(`Found ${expiredStores.length} store(s) past their purge date:`);
    for (const s of expiredStores) {
      console.log(`  - ${s.name} (${s.id}) — deleted ${s.deleted_at}, purge due ${s.scheduled_purge_at}`);
    }
    console.log('');

    if (!EXECUTE) {
      console.log('Dry run only — no data was deleted. Re-run with --execute to actually purge.');
      return;
    }

    for (const store of expiredStores) {
      console.log(`Purging "${store.name}" (${store.id})...`);
      const counts = await purgeStore(connection, store, storeOwnedTables);
      const summary = Object.entries(counts).map(([t, c]) => `${c} ${t}`).join(', ') || 'no related rows';
      console.log(`  Done — removed ${summary}, and the store row itself.`);
    }

    console.log('\nPurge complete.');
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('purge-expired-stores.js failed:', err);
  process.exit(1);
});
