/**
 * delete_tenant.js
 *
 * Hard-deletes a tenant and all of its data without leaving orphaned rows.
 *
 * Usage:
 *   node scripts/delete_tenant.js <tenant-id> [--dry-run] [--force]
 *
 * Examples:
 *   node scripts/delete_tenant.js d7f267da-d5d9-4a15-b0d3-31ca710a4492 --dry-run
 *   node scripts/delete_tenant.js d7f267da-d5d9-4a15-b0d3-31ca710a4492 --force
 */

const { pool } = require('../config/db');
const readline = require('readline');

// Accept both RFC UUIDs and demo-style IDs (e.g. demo0001-jw00-0000-0000-000000000001)
// — see CLAUDE.md: demo/seeded IDs are valid but aren't RFC UUIDs.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEMO_ID_REGEX = /^demo\d{4}-[a-z0-9]{4}-\d{4}-\d{4}-\d{12}$/i;
const isTenantId = (s) => UUID_REGEX.test(s) || DEMO_ID_REGEX.test(s);

// Child tables that do not have a tenant_id column but are owned by tenant-scoped parents.
// Each entry is { table, parentTable, parentColumn, childColumn }.
// The child table will be deleted by walking up to the parent through parentColumn/childColumn.
// Tables that store the tenant name instead of tenant_id.
const TENANT_NAME_TABLES = [];

async function getBaseTables(connection) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`
  );
  return new Set(rows.map(r => r.TABLE_NAME));
}

const CHILD_TABLES = [
  { table: 'sale_items', parentTable: 'sales', parentColumn: 'id', childColumn: 'sale_id' },
  { table: 'sale_item_discounts', parentTable: 'sales', parentColumn: 'id', childColumn: 'sale_id' },
  { table: 'sale_applied_offers', parentTable: 'sales', parentColumn: 'id', childColumn: 'sale_id' },
  { table: 'sales_return_items', parentTable: 'sales_returns', parentColumn: 'id', childColumn: 'sales_return_id' },
  { table: 'grn_items', parentTable: 'goods_received_notes', parentColumn: 'id', childColumn: 'grn_id' },
  { table: 'purchase_order_items', parentTable: 'purchase_orders', parentColumn: 'id', childColumn: 'purchase_order_id' },
  { table: 'tax_class_rates', parentTable: 'tax_classes', parentColumn: 'id', childColumn: 'tax_class_id' },
  { table: 'offer_price_tiers', parentTable: 'promotional_offers', parentColumn: 'id', childColumn: 'offer_id' },
  { table: 'offer_rules', parentTable: 'promotional_offers', parentColumn: 'id', childColumn: 'offer_id' },
  { table: 'offer_usage', parentTable: 'promotional_offers', parentColumn: 'id', childColumn: 'offer_id' },
  { table: 'role_permissions', parentTable: 'roles', parentColumn: 'id', childColumn: 'role_id' },
  { table: 'user_roles', parentTable: 'users', parentColumn: 'id', childColumn: 'user_id' },
  { table: 'user_system_roles', parentTable: 'users', parentColumn: 'id', childColumn: 'user_id' },
  { table: 'user_activity_summary', parentTable: 'users', parentColumn: 'id', childColumn: 'user_id' },
  { table: 'user_backup_codes', parentTable: 'users', parentColumn: 'id', childColumn: 'user_id' },
  { table: 'payment_gateway_transactions', parentTable: 'sales', parentColumn: 'id', childColumn: 'sale_id' },
  { table: 'customer_contacts', parentTable: 'customers', parentColumn: 'id', childColumn: 'customer_id' },
  { table: 'customer_activity_log', parentTable: 'customers', parentColumn: 'id', childColumn: 'customer_id' },
  { table: 'template_versions', parentTable: 'print_templates', parentColumn: 'id', childColumn: 'template_id' },
  { table: 'print_agent_printer_mappings', parentTable: 'print_agents', parentColumn: 'id', childColumn: 'print_agent_id' },
];

// Tables that have a store_id but no tenant_id. They will be cleared via JOIN to stores.
const STORE_OWNED_TABLES = [];

function parseArgs() {
  const args = process.argv.slice(2);
  const tenantId = args.find(a => isTenantId(a));
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  return { tenantId, dryRun, force };
}

async function confirm(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'yes');
    });
  });
}

async function getTenantScopedTables(connection) {
  const baseTables = await getBaseTables(connection);
  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS table_name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'tenant_id'
     ORDER BY TABLE_NAME`
  );
  return rows.map(r => r.table_name).filter(t => baseTables.has(t));
}

async function getStoreOwnedTables(connection) {
  const baseTables = await getBaseTables(connection);
  const [rows] = await connection.query(
    `SELECT c.TABLE_NAME AS table_name
     FROM INFORMATION_SCHEMA.COLUMNS c
     WHERE c.TABLE_SCHEMA = DATABASE() AND c.COLUMN_NAME = 'store_id'
       AND NOT EXISTS (
         SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS c2
         WHERE c2.TABLE_SCHEMA = c.TABLE_SCHEMA
           AND c2.TABLE_NAME = c.TABLE_NAME
           AND c2.COLUMN_NAME = 'tenant_id'
       )
     ORDER BY c.TABLE_NAME`
  );
  const childTableNames = new Set(CHILD_TABLES.map(c => c.table));
  return rows.map(r => r.table_name).filter(t => baseTables.has(t) && !childTableNames.has(t));
}

async function countForTable(connection, table, tenantId) {
  try {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = ?`,
      [tenantId]
    );
    return rows[0].cnt;
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

function collateJoin(childAlias, childColumn, parentAlias, parentColumn) {
  return `\`${childAlias}\`.\`${childColumn}\` COLLATE utf8mb4_0900_ai_ci = \`${parentAlias}\`.\`${parentColumn}\` COLLATE utf8mb4_0900_ai_ci`;
}

async function countChildTable(connection, spec, tenantId) {
  try {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS cnt
       FROM \`${spec.table}\` c
       JOIN \`${spec.parentTable}\` p ON ${collateJoin('c', spec.childColumn, 'p', spec.parentColumn)}
       WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = ?`,
      [tenantId]
    );
    return rows[0].cnt;
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

async function countTenantNameTable(connection, table, tenantName) {
  try {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE tenant_name COLLATE utf8mb4_0900_ai_ci = ?`,
      [tenantName]
    );
    return rows[0].cnt;
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

async function countStoreOwnedTable(connection, table, tenantId) {
  try {
    const [rows] = await connection.query(
      `SELECT COUNT(*) AS cnt
       FROM \`${table}\` t
       JOIN stores s ON ${collateJoin('t', 'store_id', 's', 'id')}
       WHERE s.tenant_id COLLATE utf8mb4_0900_ai_ci = ?`,
      [tenantId]
    );
    return rows[0].cnt;
  } catch (err) {
    return `ERROR: ${err.message}`;
  }
}

async function main() {
  const { tenantId, dryRun, force } = parseArgs();

  if (!tenantId) {
    console.error('Usage: node scripts/delete_tenant.js <tenant-id> [--dry-run] [--force]');
    process.exit(1);
  }

  let connection;
  try {
    connection = await pool.getConnection();

    // Verify tenant exists
    const [[tenant]] = await connection.query(
      'SELECT id, name FROM tenants WHERE id = ?',
      [tenantId]
    );
    if (!tenant) {
      console.error(`Tenant ${tenantId} not found.`);
      process.exit(1);
    }
    console.log(`Target tenant: ${tenant.name || '(no name)'} (${tenantId})`);

    const baseTables = await getBaseTables(connection);
    const tenantTables = await getTenantScopedTables(connection);
    const storeOwnedTables = await getStoreOwnedTables(connection);
    const activeChildTables = CHILD_TABLES.filter(s => baseTables.has(s.table));
    const activeTenantNameTables = TENANT_NAME_TABLES.filter(t => baseTables.has(t));

    console.log(`\nFound ${tenantTables.length} tables with tenant_id`);
    console.log(`Found ${storeOwnedTables.length} store-owned tables without tenant_id`);
    console.log(`Found ${activeChildTables.length} child tables to delete via parent`);
    console.log(`Found ${activeTenantNameTables.length} tables to delete by tenant_name`);

    // Count rows that will be affected
    console.log('\n--- Deletion preview ---');
    const counts = [];

    for (const table of tenantTables) {
      const cnt = await countForTable(connection, table, tenantId);
      counts.push({ type: 'tenant', table, cnt });
    }
    for (const spec of activeChildTables) {
      const cnt = await countChildTable(connection, spec, tenantId);
      counts.push({ type: 'child', table: spec.table, parent: spec.parentTable, cnt });
    }
    for (const table of storeOwnedTables) {
      const cnt = await countStoreOwnedTable(connection, table, tenantId);
      counts.push({ type: 'store', table, cnt });
    }
    for (const table of activeTenantNameTables) {
      const cnt = await countTenantNameTable(connection, table, tenant.name);
      counts.push({ type: 'tenant_name', table, cnt });
    }

    let total = 0;
    let errorCount = 0;
    for (const item of counts) {
      const label = item.type === 'child'
        ? `${item.table} (via ${item.parent})`
        : item.type === 'tenant_name'
          ? `${item.table} (by tenant_name)`
          : item.table;
      if (typeof item.cnt === 'number') {
        if (item.cnt > 0) {
          console.log(`  ${label}: ${item.cnt}`);
          total += item.cnt;
        }
      } else {
        console.log(`  ${label}: ${item.cnt}`);
        errorCount += 1;
      }
    }
    console.log(`\nTotal rows to delete: ${total}`);

    if (errorCount > 0) {
      console.error(`\nAborting: ${errorCount} table(s) could not be counted.`);
      process.exit(1);
    }

    if (dryRun) {
      console.log('\n--dry-run specified. No changes made.');
      process.exit(0);
    }

    if (!force) {
      const ok = await confirm(`\nType "yes" to permanently delete tenant ${tenantId} and all ${total} related rows: `);
      if (!ok) {
        console.log('Aborted.');
        process.exit(0);
      }
    }

    console.log('\nStarting deletion...');
    console.log('Tip: Stop the backend app first to avoid lock contention.\n');

    // Disable FK checks BEFORE starting the transaction — setting SESSION
    // variables inside a transaction can be unreliable with some mysql2/pool
    // configurations, and the whole point of this script is to hard-delete
    // every row for a tenant regardless of FK ordering.
    await connection.query('SET SESSION innodb_lock_wait_timeout = 600');
    await connection.query('SET SESSION FOREIGN_KEY_CHECKS = 0');

    await connection.beginTransaction();

    // 1. Delete child tables via parent
    for (const spec of activeChildTables) {
      const [result] = await connection.query(
        `DELETE c FROM \`${spec.table}\` c
         JOIN \`${spec.parentTable}\` p ON ${collateJoin('c', spec.childColumn, 'p', spec.parentColumn)}
         WHERE p.tenant_id COLLATE utf8mb4_0900_ai_ci = ?`,
        [tenantId]
      );
      console.log(`  Deleted ${result.affectedRows} rows from ${spec.table}`);
    }

    // 2. Delete tables keyed by tenant_name
    for (const table of activeTenantNameTables) {
      const [result] = await connection.query(
        `DELETE FROM \`${table}\` WHERE tenant_name COLLATE utf8mb4_0900_ai_ci = ?`,
        [tenant.name]
      );
      console.log(`  Deleted ${result.affectedRows} rows from ${table}`);
    }

    // 3. Delete store-owned tables without tenant_id
    for (const table of storeOwnedTables) {
      const [result] = await connection.query(
        `DELETE t FROM \`${table}\` t
         JOIN stores s ON ${collateJoin('t', 'store_id', 's', 'id')}
         WHERE s.tenant_id COLLATE utf8mb4_0900_ai_ci = ?`,
        [tenantId]
      );
      console.log(`  Deleted ${result.affectedRows} rows from ${table}`);
    }

    // 4. Delete from every table that has tenant_id.
    //    Drop the tenant itself last so FKs remain resolvable during the loop.
    for (const table of tenantTables) {
      if (table === 'tenants') continue;
      const [result] = await connection.query(
        `DELETE FROM \`${table}\` WHERE tenant_id COLLATE utf8mb4_0900_ai_ci = ?`,
        [tenantId]
      );
      if (result.affectedRows > 0) {
        console.log(`  Deleted ${result.affectedRows} rows from ${table}`);
      }
    }

    // 5. Finally delete the tenant record
    const [tenantResult] = await connection.query(
      'DELETE FROM tenants WHERE id = ?',
      [tenantId]
    );
    console.log(`  Deleted ${tenantResult.affectedRows} tenant record(s)`);

    await connection.commit();
    await connection.query('SET SESSION FOREIGN_KEY_CHECKS = 1');

    // Verify
    const [[remaining]] = await connection.query(
      'SELECT COUNT(*) AS cnt FROM tenants WHERE id = ?',
      [tenantId]
    );
    if (remaining.cnt === 0) {
      console.log('\nTenant deleted successfully.');
    } else {
      console.error('\nWarning: tenant record still exists after deletion.');
      process.exit(1);
    }
  } catch (err) {
    if (connection) {
      try { await connection.rollback(); } catch (e) { /* ignore */ }
      try { await connection.query('SET FOREIGN_KEY_CHECKS = 1'); } catch (e) { /* ignore */ }
    }
    console.error('\nError deleting tenant:', err);
    process.exit(1);
  } finally {
    if (connection) connection.release();
    await pool.end();
  }
}

main();
