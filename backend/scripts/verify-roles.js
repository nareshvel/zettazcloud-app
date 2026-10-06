'use strict';
require('dotenv').config();
const { pool } = require('../config/db');

(async () => {
  const conn = await pool.getConnection();
  try {
    const [tenants] = await conn.execute('SELECT id, name FROM tenants ORDER BY name');
    for (const tenant of tenants) {
      const [roles] = await conn.execute(
        'SELECT r.id, r.name, r.is_system_role, COUNT(rp.permission_id) AS perm_count FROM roles r LEFT JOIN role_permissions rp ON rp.role_id = r.id WHERE r.tenant_id = ? GROUP BY r.id, r.name, r.is_system_role',
        [tenant.id]
      );
      const [users] = await conn.execute(
        `SELECT u.id, u.name, r.name AS role_name, COUNT(rp.permission_id) AS role_perm_count
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         LEFT JOIN role_permissions rp ON rp.role_id = r.id
         WHERE u.tenant_id = ?
         GROUP BY u.id, u.name, r.name`,
        [tenant.id]
      );
      console.log('\nTenant: ' + tenant.name);
      console.log('Roles: ' + JSON.stringify(roles.map(r => r.name + '(' + r.perm_count + ')' + (r.is_system_role ? '*' : ''))));
      console.log('Users: ' + JSON.stringify(users.map(u => u.name + ':' + u.role_name + '(' + u.role_perm_count + ')')));
    }
  } finally {
    conn.release();
    await pool.end();
  }
})();
