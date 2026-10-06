/**
 * Standardize default roles and permissions across all existing tenants.
 *
 * - Ensures Tenant Admin, Store Manager and Cashier roles exist for every tenant.
 * - Backfills the standard permission sets (including employees.*) on those roles.
 * - Renames legacy "Sales Associate" roles to "Cashier" so the standard set applies.
 * - Assigns the Tenant Admin role to any user whose only current role has zero
 *   permissions, preventing accidental lockouts (e.g. custom "Ceo" roles).
 *
 * Usage (from backend/):
 *   node scripts/standardize-tenant-roles.js
 */

'use strict';

require('dotenv').config();
const { pool } = require('../config/db');
const TenantProvisioningService = require('../services/tenantProvisioningService');

async function run() {
  const conn = await pool.getConnection();

  try {
    const [tenants] = await conn.execute('SELECT id, name FROM tenants ORDER BY name');
    console.log(`Found ${tenants.length} tenants to standardize.`);

    for (const tenant of tenants) {
      console.log(`\n--- Tenant: ${tenant.name} (${tenant.id}) ---`);

      // 1. Rename legacy "Sales Associate" role to "Cashier" so it fits the default set.
      await conn.execute(
        `UPDATE roles
         SET name = 'Cashier',
             description = 'Process sales and handle transactions',
             is_system_role = 1
         WHERE tenant_id = ? AND name = 'Sales Associate'`,
        [tenant.id]
      );

      // 2. Ensure standard roles exist and permissions are assigned.
      //    TenantProvisioningService is idempotent: it creates missing roles,
      //    backfills permissions, and ensures a default store/tax config.
      const [anyUser] = await conn.execute(
        'SELECT id FROM users WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1',
        [tenant.id]
      );

      if (!anyUser.length) {
        console.log('  ⚠️ No users found; skipping role provisioning.');
        continue;
      }

      const requestedBy = anyUser[0].id;
      const result = await TenantProvisioningService.provisionTenant(tenant.id, { requestedBy });
      console.log(`  ✅ Roles provisioned: ${JSON.stringify(result.created.roles)}`);
      console.log(`  ✅ Permissions assigned: ${JSON.stringify(result.permissionsAssigned)}`);

      // 3. Assign Tenant Admin to any user whose current role(s) grant zero permissions.
      //    This prevents lockout for tenants with custom roles like "Ceo" that have no perms.
      const [lockedOutUsers] = await conn.execute(
        `SELECT u.id
         FROM users u
         WHERE u.tenant_id = ?
           AND NOT EXISTS (
             SELECT 1
             FROM user_roles ur
             JOIN role_permissions rp ON rp.role_id = ur.role_id
             WHERE ur.user_id = u.id
           )`,
        [tenant.id]
      );

      if (lockedOutUsers.length) {
        const [[tenantAdminRole]] = await conn.execute(
          'SELECT id FROM roles WHERE tenant_id = ? AND name = ? LIMIT 1',
          [tenant.id, 'Tenant Admin']
        );

        if (tenantAdminRole) {
          for (const user of lockedOutUsers) {
            const [alreadyAssigned] = await conn.execute(
              `SELECT 1 FROM user_roles
               WHERE user_id = ? AND role_id = ?
               LIMIT 1`,
              [user.id, tenantAdminRole.id]
            );

            if (!alreadyAssigned.length) {
              await conn.execute(
                `INSERT INTO user_roles (id, user_id, role_id, scope, store_id, assigned_by, created_at, updated_at)
                 VALUES (UUID(), ?, ?, 'tenant', NULL, ?, NOW(), NOW())`,
                [user.id, tenantAdminRole.id, requestedBy]
              );
              console.log(`  🔧 Assigned Tenant Admin to user ${user.id} (no permissions before).`);
            }
          }
        }
      }
    }

    console.log('\n✅ Tenant role standardization complete.');
  } catch (error) {
    console.error('\n❌ Standardization failed:', error);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
