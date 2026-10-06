/**
 * Read-only DB check for Sales Return permissions and visibility in Roles UI
 * - Uses backend/config/db (loads .env)
 * - Prints rows from permissions and system_permissions for module 'sales.return'
 * - Prints distinct modules present in permissions
 * - Prints a small sample from role_permissions join to confirm assignability
 * - Exits cleanly to avoid hanging terminals
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool } = require('../config/db');

async function main() {
  try {
    console.log('Using DB:', process.env.MYSQL_DATABASE, '@', process.env.MYSQL_HOST, 'as', process.env.MYSQL_USER);

    const [tenantPerms] = await pool.query(
      "SELECT id, name, module, description, created_at FROM permissions WHERE module='sales.return' OR name LIKE 'sales.return.%' ORDER BY name"
    );
    console.log(`\nTenant permissions (permissions) sales.return.* count: ${tenantPerms.length}`);
    console.table(tenantPerms);

    const [systemPerms] = await pool.query(
      "SELECT id, name, module, description, created_at FROM system_permissions WHERE module='sales.return' OR name LIKE 'sales.return.%' ORDER BY name"
    );
    console.log(`\nSystem permissions (system_permissions) sales.return.* count: ${systemPerms.length}`);
    console.table(systemPerms);

    const [mods] = await pool.query("SELECT DISTINCT module FROM permissions ORDER BY module");
    console.log('\nDistinct modules in permissions:', mods.map(m => m.module).join(', '));

    // Sample: show a few permissions with their human names to ensure the UI grouping will see them
    const [sample] = await pool.query(
      `SELECT p.id as permission_id, p.name as permission_name, p.module
       FROM permissions p
       WHERE p.module='sales.return' OR p.name LIKE 'sales.return.%'
       ORDER BY p.name
       LIMIT 10`
    );
    console.log('\nSample tenant permissions for UI mapping:');
    console.table(sample);

    // Optional: show how many tenant roles exist and how many have any sales.return permission
    const [roleCounts] = await pool.query(
      `SELECT 
         (SELECT COUNT(*) FROM roles) as total_roles,
         (SELECT COUNT(DISTINCT rp.role_id)
            FROM role_permissions rp
            JOIN permissions p ON p.id = rp.permission_id
           WHERE p.module='sales.return' OR p.name LIKE 'sales.return.%') as roles_with_sales_return`
    );
    console.log('\nRole assignment overview:');
    console.table(roleCounts);

  } catch (e) {
    console.error('Check failed:', e.message);
    process.exitCode = 1;
  } finally {
    try { await pool.end(); } catch(_) {}
    // Ensure process exits cleanly even if pool keeps sockets alive
    setTimeout(() => process.exit(), 0);
  }
}

main();
