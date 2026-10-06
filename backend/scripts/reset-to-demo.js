#!/usr/bin/env node
/**
 * Reset the database to demo-only tenant data.
 *
 *   npm run db:reset-demo
 *
 * WHAT IT DOES
 * ------------
 * Deletes EVERY tenant and all of its data, then re-seeds the five demo tenants
 * and provisions their print templates. Reference data that is not tenant-owned
 * (countries, permissions, industry_types, jurisdiction_profiles) is preserved —
 * it is schema, not customer data.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not touch the schema. Tables, columns and migrations are left exactly
 * as they are; only rows go. If you want a schema rebuild, that is
 * `npm run migrate` against an empty database, which is a different operation
 * with different risks.
 *
 * SAFETY
 * ------
 * This is irreversible and there is no undo. Three things stand in the way:
 *
 *   1. It prints the target host and database and requires you to type the
 *      database name back. A muscle-memory "yes" cannot get through it.
 *   2. It refuses to run when NODE_ENV=production.
 *   3. It reports how many tenants and sales it is about to destroy, so a
 *      wrong-database mistake is visible BEFORE you confirm, not after.
 *
 * TAKE A BACKUP FIRST. The confirmation prompt is not a backup.
 */

'use strict';

const readline = require('readline');
const path = require('path');
const fs = require('fs');
const { pool } = require('../config/db');

const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

const ask = (q) => new Promise((resolve) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(q, (a) => { rl.close(); resolve(a.trim()); });
});

/**
 * Delete tenant-owned rows.
 *
 * Order matters where foreign keys are not ON DELETE CASCADE, so children are
 * removed before parents. Tables absent from the schema are skipped rather than
 * treated as an error — this script has to keep working as the schema evolves,
 * and failing halfway through a wipe is the worst possible outcome.
 */
const WIPE_ORDER = [
  // Print + document layer
  'print_template_versions', 'print_templates', 'print_jobs', 'printer_devices',
  // Sales and money
  'payment_transactions', 'sale_items', 'sales_returns', 'sales',
  'layaway_payments', 'layaway_items', 'layaway_plans',
  'savings_scheme_payments', 'savings_scheme_enrollments', 'savings_scheme_plans',
  'memo_items', 'memo_transactions',
  'old_gold_purchases', 'old_gold_voucher_sequences',
  'repair_order_updates', 'repair_orders',
  // Inventory
  'product_pieces', 'product_piece_sequences',
  'stock_adjustments', 'inventory_movements',
  'purchase_order_items', 'purchase_orders', 'grn_items', 'grn',
  'products', 'categories', 'suppliers',
  // CRM
  'customer_activity_log', 'customer_contacts', 'customers',
  // Config + identity
  'store_jurisdiction_settings', 'tenant_pricing_settings', 'tenant_payment_settings',
  'payment_terminals', 'payment_methods',
  'employees', 'user_roles', 'roles', 'users', 'stores', 'tenants',
];

async function tableExists(name) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`, [name],
  );
  return rows[0].n > 0;
}

async function countOr0(table) {
  if (!(await tableExists(table))) return null;
  const [rows] = await pool.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
  return rows[0].n;
}

/** Split a .sql file into statements. Enough for our seed files: no DELIMITER blocks. */
function splitStatements(sql) {
  const out = [];
  let buf = '';
  let quote = null;
  let lineComment = false;
  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (lineComment) { if (ch === '\n') { lineComment = false; buf += ch; } continue; }
    if (!quote && ((ch === '-' && next === '-') || ch === '#')) { lineComment = true; continue; }
    if (quote) {
      buf += ch;
      if (ch === '\\') { buf += next ?? ''; i += 1; continue; }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; buf += ch; continue; }
    if (ch === ';') { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

async function main() {
  const [[{ db }]] = await pool.query('SELECT DATABASE() AS db');
  const [[{ host }]] = await pool.query("SELECT @@hostname AS host");

  if (process.env.NODE_ENV === 'production') {
    console.error(`${c.red}${c.bold}Refusing to run with NODE_ENV=production.${c.reset}`);
    process.exitCode = 1;
    return;
  }

  const tenants = await countOr0('tenants');
  const sales = await countOr0('sales');
  const customers = await countOr0('customers');

  console.log('');
  console.log(`${c.red}${c.bold}  DESTRUCTIVE — this deletes all tenant data  ${c.reset}`);
  console.log('');
  console.log(`  database : ${c.bold}${db}${c.reset} ${c.dim}@ ${host}${c.reset}`);
  console.log(`  tenants  : ${c.yellow}${tenants}${c.reset}`);
  console.log(`  customers: ${c.yellow}${customers}${c.reset}`);
  console.log(`  sales    : ${c.yellow}${sales}${c.reset}`);
  console.log('');
  console.log(`${c.dim}  All of the above will be deleted and replaced with the five demo tenants.${c.reset}`);
  console.log(`${c.dim}  There is no undo. If you have not taken a backup, stop now.${c.reset}`);
  console.log('');

  const answer = await ask(`  Type the database name (${c.bold}${db}${c.reset}) to confirm: `);
  if (answer !== db) {
    console.log(`\n${c.green}Aborted — nothing was changed.${c.reset}\n`);
    return;
  }

  console.log('');
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  try {
    for (const table of WIPE_ORDER) {
      if (!(await tableExists(table))) continue;
      const [res] = await pool.query(`DELETE FROM \`${table}\``);
      if (res.affectedRows) {
        console.log(`  ${c.dim}cleared${c.reset} ${table} ${c.dim}(${res.affectedRows})${c.reset}`);
      }
    }
  } finally {
    // Restore even if a delete throws — leaving FK checks off would let later
    // work write rows that violate referential integrity without complaint.
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  console.log(`\n${c.green}Wiped.${c.reset} Re-seeding demo tenants...\n`);

  // Every *.demo.sql, in filename order — tenants before the sales that
  // reference them. Searching both migrations/ and applied/ because a file
  // moves to applied/ once it has run, and a reset has to work either way.
  const migrationsDir = path.resolve(__dirname, '..', '..', 'database', 'migrations');
  const searchDirs = [migrationsDir, path.join(migrationsDir, 'applied')].filter(fs.existsSync);

  const seeds = searchDirs
    .flatMap((d) => fs.readdirSync(d).map((f) => ({ file: f, full: path.join(d, f) })))
    .filter(({ file }) => file.endsWith('.demo.sql'))
    .sort((a, b) => a.file.localeCompare(b.file));

  if (!seeds.length) {
    console.error(`${c.red}No *.demo.sql files found under database/migrations/.${c.reset}`);
    process.exitCode = 1;
    return;
  }

  for (const { file, full } of seeds) {
    for (const stmt of splitStatements(fs.readFileSync(full, 'utf8'))) {
      await pool.query(stmt);
    }
    console.log(`  ${c.green}✔${c.reset} seeded ${file}`);
  }

  console.log(`\n${c.green}Done.${c.reset} Now provision templates:\n`);
  console.log(`  node scripts/provision-demo-templates.js\n`);
}

main()
  .catch((err) => {
    console.error(`\n${c.red}Reset failed:${c.reset}`, err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
