/**
 * Retail profile routes — /api/retail-profile
 *
 *   GET  /                    this store's profile + its template plan
 *   GET  /industries          selectable business types
 *   PUT  /                    update business type / duty-free
 *   GET  /templates/missing   planned templates not yet created
 *   POST /templates/provision create the missing ones
 *
 * SECURITY: tenant and store come from the verified JWT only.
 */

'use strict';

const express = require('express');
const router = express.Router();

const retailProfileService = require('../services/retailProfileService');
const templateProvisioningService = require('../services/templateProvisioningService');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');

router.use(authenticate);
router.use(requireTenantId);

const tenantOf = (req) => {
  const t = req.user?.tenant_id || req.user?.tenantId;
  if (!t) { const e = new Error('No tenant context'); e.statusCode = 401; throw e; }
  return t;
};

const storeOf = (req) => {
  const userStore = req.user?.store_id || req.user?.storeId || null;
  const requested = req.query.storeId || req.headers['store-id'] || null;
  if (!requested) {
    if (!userStore) { const e = new Error('A store context is required'); e.statusCode = 400; throw e; }
    return userStore;
  }
  if (userStore && requested !== userStore) {
    const e = new Error('Requested store is outside your access scope');
    e.statusCode = 403;
    throw e;
  }
  return requested;
};

const handle = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const status = err.statusCode || 500;
    if (status >= 500) console.error('[retail-profile]', err);
    res.status(status).json({
      status: 'error',
      message: status >= 500 ? 'Internal server error' : err.message,
    });
  }
};

/** Business types a tenant may select. Excludes those held back. */
router.get('/industries', handle(async (req, res) => {
  res.json({ status: 'success', data: retailProfileService.availableIndustries() });
}));

/** This store's retail profile, including the templates its profile calls for. */
router.get('/', handle(async (req, res) => {
  const data = await retailProfileService.getRetailProfile(tenantOf(req), storeOf(req));
  res.json({ status: 'success', data });
}));

/**
 * Update business type / duty-free.
 *
 * Gated on `stores.edit` — duty-free determines whether tax is charged at all,
 * so this is a financially significant setting, not a display preference.
 */
router.put('/', requirePermission('stores.edit'), handle(async (req, res) => {
  const {
    industryCode, isDutyFree,
    sequentialNumbering, showNumberOnReceipt, showNumberOnInvoice,
  } = req.body || {};
  const data = await retailProfileService.updateRetailProfile(
    tenantOf(req), storeOf(req),
    { industryCode, isDutyFree, sequentialNumbering, showNumberOnReceipt, showNumberOnInvoice },
  );

  /*
   * Turning duty-free ON adds a document the store did not have — a duty-free
   * invoice or receipt. Leaving the setting saved but the document absent is
   * the worst of both: the till stops charging tax while the paperwork that
   * justifies not charging it does not exist.
   *
   * Additive, so turning duty-free OFF removes nothing. That is deliberate:
   * past duty-free sales still have to be reprintable.
   *
   * Non-fatal — the setting is saved either way, and Settings offers a manual
   * "create missing templates" action.
   */
  let provisioned = [];
  try {
    const result = await templateProvisioningService.provisionStoreTemplates(
      tenantOf(req), storeOf(req), { publish: true, createdBy: req.user?.id || null },
    );
    provisioned = result.created;
  } catch (err) {
    console.error('[retail-profile] template provisioning failed after profile change:', err.message);
  }

  res.json({ status: 'success', data: { ...data, provisionedTemplates: provisioned } });
}));

/** What a store is missing, without creating anything. */
router.get('/templates/missing', handle(async (req, res) => {
  const data = await templateProvisioningService.findMissingTemplates(tenantOf(req), storeOf(req));
  res.json({ status: 'success', data });
}));

/**
 * Create the missing templates.
 *
 * Deliberately additive: existing templates are never touched, because a tenant
 * may have customised them. `replace` is not exposed here at all — it exists
 * only for demo seeding.
 */
router.post('/templates/provision', requirePermission('settings.printer'), handle(async (req, res) => {
  const data = await templateProvisioningService.provisionStoreTemplates(
    tenantOf(req), storeOf(req),
    { publish: req.body?.publish !== false, createdBy: req.user?.id },
  );
  res.json({ status: 'success', data });
}));

module.exports = router;
