'use strict';
require('dotenv').config();
const { pool } = require('../config/db');

(async () => {
  const conn = await pool.getConnection();
  try {
    const [tenants] = await conn.execute('SELECT id, name FROM tenants ORDER BY name');
    for (const tenant of tenants) {
      const [roles] = await conn.execute(
        `SELECT r.id, r.name, r.is_system_role, r.created_at, COUNT(rp.permission_id) AS perm_count,
                GROUP_CONCAT(DISTINCT p.name ORDER BY p.name SEPARATOR ', ') AS perms
         FROM roles r
         LEFT JOIN role_permissions rp ON rp.role_id = r.id
         LEFT JOIN permissions p ON p.id = rp.permission_id
         WHERE r.tenant_id = ?
         GROUP BY r.id, r.name, r.is_system_role, r.created_at
         ORDER BY r.name`,
        [tenant.id]
      );
      const [users] = await conn.execute(
        `SELECT u.id, u.name, r.id AS role_id, r.name AS role_name
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE u.tenant_id = ?`,
        [tenant.id]
      );
      console.log('\nTenant: ' + tenant.name + ' (' + tenant.id + ')');
      for (const r of roles) {
        console.log('  Role: ' + r.name + ' [' + r.id + '] sys=' + r.is_system_role + ' perms=' + r.perm_count + ' created=' + r.created_at);
      }
      for (const u of users) {
        console.log('  User: ' + u.name + ' -> ' + u.role_name + ' [' + u.role_id + ']');
      }
    }
  } finally {
    conn.release();
    await pool.end();
  }
})();
