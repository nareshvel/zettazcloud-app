/**
 * Add Sales Return permissions to both tenant-level `permissions` and `system_permissions` tables
 * Safe to run multiple times (idempotent): only inserts missing permissions.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { v4: uuid } = require('uuid');
const { pool } = require('../config/db');

const PERMISSIONS = [
  { name: 'sales.return.view', module: 'sales.return', description: 'View sales returns' },
  { name: 'sales.return.create', module: 'sales.return', description: 'Create sales returns' },
  { name: 'sales.return.complete', module: 'sales.return', description: 'Complete sales returns' },
  { name: 'sales.return.cancel', module: 'sales.return', description: 'Cancel sales returns' },
];

async function ensurePermission(table, name, module, description) {
  const [rows] = await pool.query(`SELECT id FROM ${table} WHERE name = ?`, [name]);
  if (rows.length > 0) return { inserted: false, id: rows[0].id };
  const id = uuid();
  await pool.query(
    `INSERT INTO ${table} (id, name, module, description, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [id, name, module, description]
  );
  return { inserted: true, id };
}

async function run() {
  console.log('Adding Sales Return permissions…');
  try {
    const results = [];
    for (const p of PERMISSIONS) {
      const ten = await ensurePermission('permissions', p.name, p.module, p.description);
      const sys = await ensurePermission('system_permissions', p.name, p.module, p.description);
      results.push({ name: p.name, tenant_added: ten.inserted, system_added: sys.inserted });
    }
    console.table(results);
    console.log('Done.');
  } catch (e) {
    console.error('Failed to add permissions:', e.message);
    process.exitCode = 1;
  } finally {
    pool.end && pool.end();
  }
}

run();
