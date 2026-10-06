/**
 * generate_delete_tenant_sql.js
 *
 * Generates backend/scripts/delete_tenant.sql from the live schema.
 * The generated SQL disables FK checks, runs all deletes, and deletes the tenant last.
 *
 * Usage:
 *   node scripts/generate_delete_tenant_sql.js
 */

const { pool } = require('../config/db');
const fs = require('fs');
const path = require('path');

const COLLATE = 'COLLATE utf8mb4_0900_ai_ci';

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
  { table: 'payment_gateway_transactions', parentTable: 'sales', parentColumn: 'id', childColumn: 'sale_id' },
  { table: 'customer_contacts', parentTable: 'customers', parentColumn: 'id', childColumn: 'customer_id' },
  { table: 'customer_activity_log', parentTable: 'customers', parentColumn: 'id', childColumn: 'customer_id' },
];

const TENANT_NAME_TABLES = [];

async function main() {
  const connection = await pool.getConnection();
  try {
    // Base tables only (exclude views)
    const [baseTables] = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'`
    );
    const baseTableSet = new Set(baseTables.map(r => r.TABLE_NAME));

    const [tenantCols] = await connection.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'tenant_id'
       ORDER BY TABLE_NAME`
    );
    const tenantTables = tenantCols
      .map(r => r.TABLE_NAME)
      .filter(t => baseTableSet.has(t) && t !== 'tenants');

    const [storeRows] = await connection.query(
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
    const childTableNames = new Set(CHILD_TABLES.map(s => s.table));
    const storeOwnedTables = storeRows
      .map(r => r.table_name)
      .filter(t => baseTableSet.has(t) && !childTableNames.has(t));

    const activeChildTables = CHILD_TABLES.filter(s => baseTableSet.has(s.table));
    const activeTenantNameTables = TENANT_NAME_TABLES.filter(t => baseTableSet.has(t));

    const lines = [];
    lines.push('-- Generated tenant hard-delete script');
    lines.push('-- Replace @tenant_id with the UUID of the tenant to delete.');
    lines.push('-- Stop the backend app before running to avoid lock contention.');
    lines.push('');
    lines.push('SET @tenant_id = \'__TENANT_ID__\';');
    lines.push('SET @tenant_name = (SELECT name FROM tenants WHERE id = @tenant_id);');
    lines.push('');
    lines.push('SET SESSION FOREIGN_KEY_CHECKS = 0;');
    lines.push('SET SESSION innodb_lock_wait_timeout = 600;');
    lines.push('');

    // Child tables via parent
    for (const spec of activeChildTables) {
      lines.push(`DELETE c FROM \`${spec.table}\` c`);
      lines.push(`JOIN \`${spec.parentTable}\` p ON c.\`${spec.childColumn}\` ${COLLATE} = p.\`${spec.parentColumn}\` ${COLLATE}`);
      lines.push(`WHERE p.tenant_id ${COLLATE} = @tenant_id ${COLLATE};`);
      lines.push('');
    }

    // Tenant-name keyed tables
    for (const table of activeTenantNameTables) {
      lines.push(`DELETE FROM \`${table}\` WHERE tenant_name ${COLLATE} = @tenant_name ${COLLATE};`);
      lines.push('');
    }

    // Store-owned tables without tenant_id
    for (const table of storeOwnedTables) {
      lines.push(`DELETE t FROM \`${table}\` t`);
      lines.push('JOIN `stores` s ON t.`store_id` ' + COLLATE + ' = s.`id` ' + COLLATE);
      lines.push('WHERE s.tenant_id ' + COLLATE + ' = @tenant_id ' + COLLATE + ';');
      lines.push('');
    }

    // Tenant-scoped tables (tenants itself last)
    for (const table of tenantTables) {
      lines.push(`DELETE FROM \`${table}\` WHERE tenant_id ${COLLATE} = @tenant_id ${COLLATE};`);
      lines.push('');
    }

    // Tenant record last
    lines.push('DELETE FROM `tenants` WHERE id = @tenant_id;');
    lines.push('');
    lines.push('SET SESSION FOREIGN_KEY_CHECKS = 1;');
    lines.push('');
    lines.push('-- Verify');
    lines.push('SELECT id, name FROM tenants WHERE id = @tenant_id;');

    const outputPath = path.join(__dirname, 'delete_tenant.sql');
    fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
    console.log(`Generated ${outputPath}`);
    console.log(`- Tenant-scoped tables: ${tenantTables.length}`);
    console.log(`- Child tables: ${activeChildTables.length}`);
    console.log(`- Store-owned tables: ${storeOwnedTables.length}`);
    console.log(`- Tenant-name tables: ${activeTenantNameTables.length}`);
  } finally {
    connection.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
