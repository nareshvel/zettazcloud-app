/**
 * Jurisdiction routes — /api/jurisdiction
 *
 *   GET  /current    effective jurisdiction context for the acting store
 *   GET  /profiles   the shared country catalog (for a settings picker)
 *   PUT  /settings   update this store's binding / sales mode / fiscal identifiers
 *
 * SECURITY: `/api` is not authenticated at the app level, so — following the
 * convention used by metalRates.routes.js and its peers — this router applies
 * `authenticate` + `requireTenantId` itself. Tenant and store scope come from
 * `req.user` (verified JWT) only, never from request headers.
 * See tests/routeAuthGuard.test.js.
 */

'use strict';

const express = require('express');
const router = express.Router();

const jurisdictionService = require('../services/jurisdictionService');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');

router.use(authenticate);
router.use(requireTenantId);

/** Tenant id from the verified JWT. Fails closed. */
const tenantOf = (req) => {
  const t = req.user?.tenant_id || req.user?.tenantId;
  if (!t) { const e = new Error('No tenant context'); e.statusCode = 401; throw e; }
  return t;
};

/**
 * Store for the request. A `store-id` header is a legitimate store-switching
 * mechanism, but is only honoured when the user is not bound to a different store.
 */
const storeOf = (req) => {
  const userStore = req.user?.store_id || req.user?.storeId || null;
  const requested = req.query.storeId || req.headers['store-id'] || null;
  if (!requested) return userStore;
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
    if (status >= 500) console.error('[jurisdiction]', err);
    res.status(status).json({
      status: 'error',
      message: status >= 500 ? 'Internal server error' : err.message,
    });
  }
};

/**
 * GET /api/jurisdiction/current
 * Effective jurisdiction context for the acting store: catalog profile, store
 * settings, sales mode, and whether the sale is zero-rated.
 */
router.get('/current', handle(async (req, res) => {
  const data = await jurisdictionService.getJurisdictionProfile(tenantOf(req), storeOf(req));
  res.json({ status: 'success', data });
}));

/**
 * GET /api/jurisdiction/profiles
 * The shared country catalog — for a settings-screen country picker.
 * Read-only and tenant-agnostic, but still authenticated.
 */
router.get('/profiles', handle(async (req, res) => {
  const activeOnly = req.query.all !== 'true';
  const data = await jurisdictionService.listProfiles({ activeOnly });
  res.json({ status: 'success', data });
}));

/**
 * PUT /api/jurisdiction/settings
 * Update the acting store's jurisdiction binding / sales mode / fiscal identifiers.
 *
 * Gated on `stores.edit` — sales mode determines whether tax is charged at all,
 * so this is a financially significant setting, not a display preference.
 */
router.put('/settings', requirePermission('stores.edit'), handle(async (req, res) => {
  const tenantId = tenantOf(req);
  const storeId = storeOf(req);
  if (!storeId) { const e = new Error('A store context is required'); e.statusCode = 400; throw e; }

  const VALID_MODES = ['domestic', 'duty_free', 'export', 'mixed'];
  if (req.body.salesMode && !VALID_MODES.includes(req.body.salesMode)) {
    const e = new Error(`salesMode must be one of: ${VALID_MODES.join(', ')}`);
    e.statusCode = 400;
    throw e;
  }

  const data = await jurisdictionService.updateStoreSettings(tenantId, storeId, req.body);
  res.json({ status: 'success', data });
}));

module.exports = router;
