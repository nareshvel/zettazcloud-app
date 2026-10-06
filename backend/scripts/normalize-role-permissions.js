/**
 * Normalize default roles across all existing tenants.
 *
 * - Merges duplicate roles that have the same name within a tenant.
 * - Resets Tenant Admin, Store Manager and Cashier permissions to the canonical
 *   sets defined in PermissionSeedingService (including employees.*).
 * - Leaves custom roles untouched.
 *
 * Usage (from backend/):
 *   node scripts/normalize-role-permissions.js
 */

'use strict';

require('dotenv').config();
const { pool } = require('../config/db');
const PermissionSeedingService = require('../services/permissionSeedingService');

const STANDARD_ROLES = ['Tenant Admin', 'Store Manager', 'Cashier'];

async function run() {
  const conn = await pool.getConnection();

  try {
    const [tenants] = await conn.execute('SELECT id, name FROM tenants ORDER BY name');
    console.log(`Found ${tenants.length} tenants to normalize.`);

    for (const tenant of tenants) {
      console.log(`\n--- Tenant: ${tenant.name} (${tenant.id}) ---`);

      for (const roleName of STANDARD_ROLES) {
        const [roles] = await conn.execute(
          `SELECT r.id,
                  (SELECT COUNT(*) FROM user_roles ur WHERE ur.role_id = r.id) AS user_count,
                  (SELECT COUNT(*) FROM role_permissions rp WHERE rp.role_id = r.id) AS perm_count
           FROM roles r
           WHERE r.tenant_id = ? AND r.name = ?
           ORDER BY r.created_at ASC`,
          [tenant.id, roleName]
        );

        if (roles.length === 0) {
          console.log(`  ⚠️ Missing role: ${roleName}`);
          continue;
        }

        // Choose keeper: role with the most users, then most permissions, then oldest.
        const keeper = roles.reduce((best, current) => {
          if (current.user_count > best.user_count) return current;
          if (current.user_count < best.user_count) return best;
          if (current.perm_count > best.perm_count) return current;
          return best;
        }, roles[0]);

        // Merge non-keepers into the keeper.
        for (const role of roles) {
          if (role.id === keeper.id) continue;

          await conn.execute(
            'UPDATE user_roles SET role_id = ? WHERE role_id = ?',
            [keeper.id, role.id]
          );
          await conn.execute(
            'DELETE FROM role_permissions WHERE role_id = ?',
            [role.id]
          );
          await conn.execute(
            'DELETE FROM roles WHERE id = ?',
            [role.id]
          );
          console.log(`  🗑 Merged duplicate ${roleName} ${role.id} into ${keeper.id}`);
        }

        // Normalize keeper: system role flag, description, and exact permission set.
        const descriptions = {
          'Tenant Admin': 'Full administrative access to tenant resources',
          'Store Manager': 'Manage store operations and staff',
          'Cashier': 'Process sales and handle transactions'
        };

        await conn.execute(
          'UPDATE roles SET is_system_role = 1, description = ? WHERE id = ?',
          [descriptions[roleName], keeper.id]
        );

        await PermissionSeedingService.assignPermissionsToRole(
          keeper.id,
          roleName,
          tenant.id,
          conn
        );

        console.log(`  ✅ ${roleName} normalized (${keeper.id})`);
      }
    }

    console.log('\n✅ Role normalization complete.');
  } catch (error) {
    console.error('\n❌ Normalization failed:', error);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
