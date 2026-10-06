/**
 * Onboarding Routes
 * Handles onboarding wizard completion and data storage
 */

const express = require('express');
const router = express.Router();
const { pool, query } = require('../config/db');
const { authenticate } = require('../middleware/unifiedAuthMiddleware');
const AuditService = require('../services/auditService');
const TenantProvisioningService = require('../services/tenantProvisioningService');
const templateProvisioningService = require('../services/templateProvisioningService');
const retailProfileService = require('../services/retailProfileService');
const jwt = require('jsonwebtoken');
const rbacService = require('../services/rbacService');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/constants');

/**
 * Complete onboarding wizard
 * POST /api/onboarding/complete
 * Stores business info, store configuration, and marks onboarding as complete
 */
router.post('/complete', authenticate, async (req, res) => {
  let connection;
  
  try {
    const { businessInfo, storeInfo } = req.body;
    const userId = req.user.id;
    const tenantId = req.user.tenant_id;

    // Validate required data
    if (!businessInfo || !storeInfo) {
      return res.status(400).json({
        success: false,
        message: 'Business info and store info are required'
      });
    }

    // Validate required business fields
    const requiredBusinessFields = ['businessType'];
    for (const field of requiredBusinessFields) {
      if (!businessInfo[field]) {
        return res.status(400).json({
          success: false,
          message: `Business ${field} is required`
        });
      }
    }

    // Validate required store fields
    const requiredStoreFields = ['currency', 'timezone'];
    for (const field of requiredStoreFields) {
      if (!storeInfo[field]) {
        return res.status(400).json({
          success: false,
          message: `Store ${field} is required`
        });
      }
    }

    // Get a connection from the shared pool instead of opening a new one.
    connection = await pool.getConnection();
    await connection.beginTransaction();

    // 1. Update tenant with business information and mark onboarding complete
    const { toIndustryCode } = require('../services/industryMapping');
    const industryCode = toIndustryCode(businessInfo.businessType);

    const tenantSettings = {
      businessType: businessInfo.businessType,
      industry_code: industryCode,
      address: businessInfo.address || null,
      city: businessInfo.city || null,
      state: businessInfo.state || null,
      zipCode: businessInfo.zipCode || null,
      website: businessInfo.website || null,
      currency: storeInfo.currency,
      timezone: storeInfo.timezone,
      onboardingCompletedAt: new Date().toISOString()
    };

    // Also write real, queryable columns — not just the settings JSON blob.
    // Before this, a company's address/city/state/zip/website was captured
    // here ONCE and then permanently invisible: there was no read API and no
    // edit UI anywhere that ever surfaced tenants.settings back out (see
    // docs/17-migration-and-roadmap/22_Tenant_vs_Store_Business_Identity_Audit_And_Plan.md).
    // The settings JSON write above is kept for backward compatibility with
    // anything else that might read it, but these columns are now the real
    // source of truth, editable afterward via PATCH /api/tenants/me.
    //
    // Also update tenants.name from the onboarding wizard's businessName —
    // previously the name was set once at signup (from the optional Business
    // Name field) and never updated here, so if the user edited it during
    // onboarding the change was silently lost (audit Gap 4).
    await connection.execute(
      `UPDATE tenants
       SET name = ?,
           settings = ?,
           industry_code = ?,
           address = ?,
           city = ?,
           state = ?,
           postal_code = ?,
           country_code = ?,
           phone = ?,
           website = ?,
           setup_completed = 1,
           onboarding_step = 'completed',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        businessInfo.businessName,
        JSON.stringify(tenantSettings),
        industryCode,
        businessInfo.address || null,
        businessInfo.city || null,
        businessInfo.state || null,
        businessInfo.zipCode || null,
        businessInfo.countryCode || null,
        businessInfo.phone || null,
        businessInfo.website || null,
        tenantId,
      ]
    );

    // 2. Update the default store with detailed information
    // Resolve the specific store id up front rather than blanket-matching
    // WHERE tenant_id = ? — a tenant has exactly one store at onboarding time
    // today, so that was harmless in practice, but it would silently
    // overwrite every store's name/address/currency/timezone with the same
    // values the moment onboarding ever ran against a tenant that already
    // had more than one store. Targeting the earliest store by id closes
    // that gap now, before it can ever bite. See docs/17-migration-and-roadmap/
    // 22_Tenant_vs_Store_Business_Identity_Audit_And_Plan.md §2.5.
    const [onboardingStoreRows] = await connection.execute(
      'SELECT id FROM stores WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1',
      [tenantId]
    );
    const onboardingStoreId = onboardingStoreRows[0]?.id || null;

    const storeUpdateFields = [];
    const storeUpdateValues = [];

    if (storeInfo.storeName) {
      storeUpdateFields.push('name = ?');
      storeUpdateValues.push(storeInfo.storeName);
    }

    if (businessInfo.address) {
      const fullAddress = [
        businessInfo.address,
        businessInfo.city,
        businessInfo.state,
        businessInfo.zipCode
      ].filter(Boolean).join(', ');
      
      storeUpdateFields.push('address = ?');
      storeUpdateValues.push(fullAddress);
    }

    if (businessInfo.phone) {
      storeUpdateFields.push('phone = ?');
      storeUpdateValues.push(businessInfo.phone);
    }

    // Sync localization selections into store record so Settings page reflects onboarding
    if (storeInfo.currency) {
      storeUpdateFields.push('currency_code = ?');
      storeUpdateValues.push(storeInfo.currency);
    }

    if (storeInfo.timezone) {
      storeUpdateFields.push('timezone = ?');
      storeUpdateValues.push(storeInfo.timezone);
    }

    if (businessInfo.countryCode) {
      storeUpdateFields.push('country_code = ?');
      storeUpdateValues.push(businessInfo.countryCode);
    }

    if (storeUpdateFields.length > 0 && onboardingStoreId) {
      storeUpdateFields.push('updated_at = CURRENT_TIMESTAMP');
      // Target the specific store, scoped to this tenant as a defense-in-depth
      // check (not just id = ?) rather than every store the tenant owns.
      storeUpdateValues.push(onboardingStoreId, tenantId);

      const storeUpdateQuery = `
        UPDATE stores
        SET ${storeUpdateFields.join(', ')}
        WHERE id = ? AND tenant_id = ?
      `;

      console.log(`✅ Updating store ${onboardingStoreId} for tenant: ${tenantId} with fields: ${storeUpdateFields.join(', ')}`);
      await connection.execute(storeUpdateQuery, storeUpdateValues);
    } else if (!onboardingStoreId) {
      console.log(`⚠️ No store found for tenant: ${tenantId} — skipping store update`);
    } else {
      console.log(`ℹ️ No store fields to update for tenant: ${tenantId}`);
    }

    // 3. Create or update tenant payment settings
    await connection.execute(
      `INSERT INTO tenant_payment_settings 
       (tenant_id, default_currency, created_at, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE 
       default_currency = VALUES(default_currency),
       updated_at = CURRENT_TIMESTAMP`,
      [tenantId, storeInfo.currency]
    );

    // 4. CRITICAL: Assign user to the default store (this was missing!)
    const [defaultStoreRows] = await connection.execute(
      'SELECT id FROM stores WHERE tenant_id = ? AND is_active = 1 LIMIT 1',
      [tenantId]
    );

    if (defaultStoreRows.length > 0) {
      const storeId = defaultStoreRows[0].id;
      await connection.execute(
        'UPDATE users SET store_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [storeId, userId]
      );
      console.log(`✅ User ${userId} assigned to store ${storeId}`);
    } else {
      console.error(`❌ No active store found for tenant ${tenantId}`);
      throw new Error('No active store found for tenant');
    }

    console.log(`✅ Onboarding completed for tenant ${tenantId} by user ${userId}`);

    // Commit the transaction
    await connection.commit();
    
    // 5. Log the onboarding completion using audit service (after transaction commit to prevent locks)
    try {
      const requestContext = AuditService.extractRequestContext(req);
      await AuditService.logOnboarding({
        userId,
        tenantId,
        action: 'onboarding_completed',
        details: {
          businessType: businessInfo.businessType,
          currency: storeInfo.currency,
          timezone: storeInfo.timezone,
          completedSections: ['business_info', 'store_info', 'payment_settings']
        },
        ...requestContext
      });
      console.log(`✅ Audit log created for onboarding completion`);
    } catch (auditError) {
      console.error(`⚠️ Failed to create audit log (non-critical):`, auditError.message);
      // Don't fail the onboarding completion if audit logging fails
    }
    console.log(`✅ Transaction committed successfully for tenant ${tenantId}`);

    // 5. Ensure deterministic provisioning (idempotent) after commit
    try {
      const provisionResult = await TenantProvisioningService.provisionTenant(tenantId, { requestedBy: userId });
      console.log(`✅ Provisioning ensured for tenant ${tenantId}:`, {
        storeCreated: provisionResult.created?.store,
        roles: provisionResult.created?.roles,
        features: provisionResult.features
      });
    } catch (provErr) {
      console.error(`⚠️ Provisioning step failed (non-blocking) for tenant ${tenantId}:`, provErr.message);
    }

    // 5a. Set duty-free status BEFORE template provisioning so the correct
    // duty-free templates are included. The onboarding wizard collects an
    // "isDutyFree" checkbox in the Business Information step; this writes
    // it through to store_jurisdiction_settings.sales_mode (the single
    // source of truth) via retailProfileService.updateRetailProfile.
    // Without this, a duty-free store gets only domestic templates and
    // has no duty-free invoice/receipt until someone manually toggles it
    // in Settings → General later.
    if (businessInfo.isDutyFree) {
      try {
        // Resolve the store ID (same query as step 4 above, but the
        // connection is already committed so use a fresh query).
        const [storeRows] = await connection.execute(
          'SELECT id FROM stores WHERE tenant_id = ? AND is_active = 1 ORDER BY created_at ASC LIMIT 1',
          [tenantId]
        );
        if (storeRows.length > 0) {
          await retailProfileService.updateRetailProfile(tenantId, storeRows[0].id, {
            isDutyFree: true,
          });
          console.log(`✅ Duty-free status set for store ${storeRows[0].id} (tenant ${tenantId})`);
        }
      } catch (dutyFreeErr) {
        console.error(`⚠️ Failed to set duty-free status (non-blocking) for tenant ${tenantId}:`, dutyFreeErr.message);
      }
    }

    // 5b. Provision print templates now that the real industry is known.
    // The signup-time background job (signupService.js verifyEmail) always
    // provisions General Retail templates because industry isn't known yet
    // at that point — this wizard step is the first moment it is.
    //
    // Previously this ONLY ran for non-general-retail industries, relying
    // entirely on the verifyEmail background job for general retail. But
    // if that background job failed (server restart, pool issue, etc.),
    // a general-retail tenant ended up with ZERO templates and no fallback.
    // Now always run provisioning here — it's idempotent (skips templates
    // that already exist by name), so re-running for general retail after
    // the background job already succeeded is a no-op.
    //
    // For non-general-retail industries, replace=true so the correct
    // industry-specific templates replace the general-retail ones the
    // background job created. For general retail, replace=false (just
    // ensure they exist).
    try {
      const reprovisionResult = await templateProvisioningService.provisionTenantTemplates(tenantId, {
        replace: industryCode && industryCode !== 'general_retail',
        publish: true,
        createdBy: userId,
      });
      const created = reprovisionResult.reduce((n, r) => n + (r.created ? r.created.length : 0), 0);
      console.log(`✅ Print templates provisioned for tenant ${tenantId} (industry: ${industryCode})`, {
        stores: reprovisionResult.length,
        created,
      });
    } catch (templateErr) {
      console.error(`⚠️ Print template provisioning failed (non-blocking) for tenant ${tenantId}:`, templateErr.message);
    }

    // 6. Fetch updated tenant and store information to return
    const [tenantRows] = await connection.execute(
      'SELECT id, name, settings, setup_completed, onboarding_step FROM tenants WHERE id = ?',
      [tenantId]
    );
    console.log(`✅ Fetched tenant data: setup_completed=${tenantRows[0]?.setup_completed}, onboarding_step=${tenantRows[0]?.onboarding_step}`);

    const [storeRows] = await connection.execute(
      'SELECT id, name, address, phone, email FROM stores WHERE tenant_id = ?',
      [tenantId]
    );
    console.log(`✅ Fetched store data: ${storeRows.length} stores found for tenant ${tenantId}`);

    // Validate that required updates were successful
    if (tenantRows.length === 0) {
      console.error(`❌ Tenant ${tenantId} not found after onboarding completion`);
      return res.status(500).json({
        success: false,
        message: 'Tenant data not found after onboarding completion'
      });
    }

    if (tenantRows[0].setup_completed !== 1) {
      console.error(`❌ Tenant ${tenantId} setup_completed not updated properly: ${tenantRows[0].setup_completed}`);
    }

    if (tenantRows[0].onboarding_step !== 'completed') {
      console.error(`❌ Tenant ${tenantId} onboarding_step not updated properly: ${tenantRows[0].onboarding_step}`);
    }

    // 7. Build and issue a fresh JWT including the assigned store_id
    // Fetch user data for token payload
    const [userRows] = await connection.execute(
      'SELECT id, name, email FROM users WHERE id = ?',
      [userId]
    );

    // Determine the active storeId we assigned earlier
    const storeIdForToken = (defaultStoreRows && defaultStoreRows[0]) ? defaultStoreRows[0].id : (req.user.store_id || req.user.storeId);

    // Get RBAC data scoped to tenant/store for accurate permissions in token
    let rbacData = { roles: [], roleNames: [], permissions: [], systemRoles: [] };
    try {
      const rbacResult = await rbacService.getUserRolesAndPermissions(userId, tenantId, storeIdForToken || null);
      if (rbacResult) {
        rbacData = {
          roles: Array.isArray(rbacResult.roles) ? rbacResult.roles : [],
          roleNames: Array.isArray(rbacResult.roleNames) ? rbacResult.roleNames : [],
          permissions: Array.isArray(rbacResult.permissions) ? rbacResult.permissions : [],
          systemRoles: Array.isArray(rbacResult.systemRoles) ? rbacResult.systemRoles : []
        };
      }
    } catch (e) {
      console.error('[ONBOARDING] Error fetching RBAC data for new token:', e.message);
    }

    const userRecord = userRows && userRows[0] ? userRows[0] : { id: userId, name: req.user.name, email: req.user.email };
    const tokenPayload = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: req.user.role,
      permissions: rbacData.permissions || [],
      roles: rbacData.roleNames || [],
      systemRoles: rbacData.systemRoles || [],
      tenant_id: tenantId,
      tenantId: tenantId,
      store_id: storeIdForToken,
      storeId: storeIdForToken
    };

    const refreshedToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        tenant: tenantRows[0] || null,
        store: storeRows[0] || null,
        token: refreshedToken,
        user: {
          id: tokenPayload.id,
          name: tokenPayload.name,
          email: tokenPayload.email,
          role: tokenPayload.role,
          tenant_id: tokenPayload.tenant_id,
          tenantId: tokenPayload.tenantId,
          store_id: tokenPayload.store_id,
          storeId: tokenPayload.storeId,
          roles: tokenPayload.roles,
          permissions: tokenPayload.permissions,
          systemRoles: tokenPayload.systemRoles
        },
        onboardingData: {
          businessInfo: {
            businessType: businessInfo.businessType,
            address: businessInfo.address,
            city: businessInfo.city,
            state: businessInfo.state,
            zipCode: businessInfo.zipCode,
            website: businessInfo.website
          },
          storeInfo: {
            storeName: storeInfo.storeName,
            currency: storeInfo.currency,
            timezone: storeInfo.timezone
          }
        }
      }
    });

  } catch (error) {
    // Rollback transaction on error
    if (connection) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error('Rollback error:', rollbackError);
      }
    }

    console.error('Onboarding completion error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * Get onboarding status
 * GET /api/onboarding/status
 * Returns current onboarding step and completion status
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'No tenant associated with user'
      });
    }

    const tenantRows = await query(
      'SELECT onboarding_step, setup_completed, settings FROM tenants WHERE id = ?',
      [tenantId]
    );

    if (tenantRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const tenant = tenantRows[0];

    res.json({
      success: true,
      data: {
        onboarding_step: tenant.onboarding_step,
        setup_completed: Boolean(tenant.setup_completed),
        settings: tenant.settings ? JSON.parse(tenant.settings) : {}
      }
    });

  } catch (error) {
    console.error('Get onboarding status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get onboarding status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
