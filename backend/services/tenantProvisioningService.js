/**
 * Tenant Provisioning Service
 * Deterministic, idempotent tenant setup:
 * - Ensure a default store exists
 * - Seed ONLY Store Manager and Cashier roles with permissions
 * - DO NOT seed/assign permissions to Tenant Admin here (admin user already has Tenant Admin role assignment)
 * - Enable default features in tenant settings
 * - Initialize/update onboarding state
 */

const { pool } = require('../config/db');
const PermissionSeedingService = require('./permissionSeedingService');
const TaxProvisioningService = require('./taxProvisioningService');
const { v4: uuidv4 } = require('uuid');

const DEFAULT_FEATURES = {
  advanced_tax: true,
  promotional_offers: true,
  printer_integration: true
};

class TenantProvisioningService {
  /**
   * Provision tenant resources in an idempotent way
   * @param {string} tenantId
   * @param {Object} options
   * @param {string} [options.requestedBy] - user id performing the provisioning (for created_by)
   * @returns {Promise<Object>} result summary
   */
  static async provisionTenant(tenantId, options = {}) {
    if (!tenantId) throw new Error('tenantId is required');
    const requestedBy = options.requestedBy || null;

    const connection = await pool.getConnection();
    let created = { store: false, roles: { tenantAdmin: false, cashier: false, storeManager: false }, permissionsAssigned: { tenantAdmin: 0, cashier: 0, storeManager: 0 }, taxConfiguration: false };

    try {
      await connection.beginTransaction();

      // 1) Ensure permissions catalog exists (system-wide)
      await PermissionSeedingService.ensurePermissionsExist(null, connection);

      // 2) Ensure default store exists
      const [stores] = await connection.execute(
        'SELECT id, name FROM stores WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1',
        [tenantId]
      );
      let storeId = stores[0]?.id;
      if (!storeId) {
        storeId = uuidv4();
        await connection.execute(
          `INSERT INTO stores (id, name, tenant_id, address, phone, email, is_active, created_at, updated_at)
           VALUES (?, CONCAT((SELECT name FROM tenants WHERE id = ?), ' - Main Store'), ?, 'Address to be updated', NULL, NULL, 1, NOW(), NOW())`,
          [storeId, tenantId, tenantId]
        );
        created.store = true;
      }

      // 2.5) Determine created_by user (must exist in users table)
      let createdByForRole = null;
      if (requestedBy) {
        try {
          const [userRows] = await connection.execute(
            'SELECT id FROM users WHERE id = ? LIMIT 1',
            [requestedBy]
          );
          if (userRows.length) {
            createdByForRole = requestedBy;
          }
        } catch (_) {
          // fallback to null
          createdByForRole = null;
        }
      }
      if (!createdByForRole) {
        const [anyTenantUser] = await connection.execute(
          'SELECT id FROM users WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1',
          [tenantId]
        );
        if (anyTenantUser.length) {
          createdByForRole = anyTenantUser[0].id;
        }
      }
      if (!createdByForRole) {
        throw new Error(`No valid created_by user found for tenant ${tenantId}. Please create a user first.`);
      }

      // 3) Ensure roles Tenant Admin, Store Manager and Cashier exist; if not, create and assign permissions
      const ensureRoleWithPermissions = async (roleName, key) => {
        const [roles] = await connection.execute(
          'SELECT id FROM roles WHERE tenant_id = ? AND name = ? LIMIT 1',
          [tenantId, roleName]
        );
        let roleId = roles[0]?.id;
        if (!roleId) {
          roleId = require('crypto').randomUUID();
          await connection.execute(
            `INSERT INTO roles (id, name, description, tenant_id, is_system_role, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, ?, NOW(), NOW())`,
            [roleId, roleName, `${roleName} default role`, tenantId, createdByForRole]
          );
          created.roles[key] = true;
        }
        // Assign permissions deterministically (INSERT IGNORE prevents dupes)
        const count = await PermissionSeedingService.assignPermissionsToRole(roleId, roleName, tenantId, connection);
        return { roleId, assigned: count || 0 };
      };

      const ta = await ensureRoleWithPermissions('Tenant Admin', 'tenantAdmin');
      const sm = await ensureRoleWithPermissions('Store Manager', 'storeManager');
      const ca = await ensureRoleWithPermissions('Cashier', 'cashier');
      created.permissionsAssigned.tenantAdmin = ta.assigned;
      created.permissionsAssigned.storeManager = sm.assigned;
      created.permissionsAssigned.cashier = ca.assigned;

      // 3.5) Create default tax configuration for the store
      try {
        const taxResult = await TaxProvisioningService.createDefaultTaxConfiguration(
          tenantId, 
          storeId, 
          { defaultTaxRate: 10.0 }, 
          connection
        );
        created.taxConfiguration = taxResult.success;
        console.log(`✅ Tax configuration created for tenant ${tenantId}: ${taxResult.created.taxClasses.length} tax classes, ${taxResult.created.taxRates.length} tax rates`);
      } catch (taxError) {
        console.error(`⚠️ Tax configuration creation failed for tenant ${tenantId}:`, taxError.message);
        // Don't fail the entire provisioning if tax setup fails
      }

      // 3.6) Seed the system chart of accounts + posting mappings (idempotent)
      try {
        await require('./moneyPostingService').ensureDefaults(tenantId, connection);
        created.moneyAccounts = true;
      } catch (acctError) {
        console.error(`⚠️ Money accounts seeding failed for tenant ${tenantId}:`, acctError.message);
      }

      // 4) Enable default features in tenant settings (merge)
      const [tenantRows] = await connection.execute(
        'SELECT settings, onboarding_step, setup_completed FROM tenants WHERE id = ? LIMIT 1',
        [tenantId]
      );
      if (!tenantRows.length) throw new Error(`Tenant ${tenantId} not found`);

      let settings = {};
      try { settings = tenantRows[0].settings ? JSON.parse(tenantRows[0].settings) : {}; } catch (_) { settings = {}; }
      settings.features = { ...(settings.features || {}), ...DEFAULT_FEATURES };

      const onboarding_step = tenantRows[0].onboarding_step || 'provisioned';
      const setup_completed = tenantRows[0].setup_completed ? 1 : 0;

      await connection.execute(
        `UPDATE tenants SET settings = ?, onboarding_step = ?, updated_at = NOW() WHERE id = ?`,
        [JSON.stringify(settings), onboarding_step, tenantId]
      );

      await connection.commit();

      return {
        success: true,
        tenantId,
        storeId,
        created,
        features: settings.features,
        onboarding_step,
        setup_completed: Boolean(setup_completed)
      };
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

module.exports = TenantProvisioningService;
