/**
 * Platform Routes — system-admin console API.
 * Base path: /api/platform (mounted in routes/index.js)
 *
 * Every route requires `authenticate` + a platform.* permission resolved
 * through NULL-tenant system roles (rbacPermissionMiddleware treats
 * platform./tenants./subscriptions./plans./support./system. prefixes as
 * system-scoped: no tenant-admin bypass, no tenant context required).
 *
 * Consolidates what paisepath-app split across /platform + /platform/ops.
 */
'use strict';

const express = require('express');
const zlib = require('zlib');
const router = express.Router();

const { authenticate } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const platformService = require('../services/platformService');

const ok = (res, data) => res.json({ status: 'success', data });
const fail = (res, e, fallback = 'Platform operation failed') =>
  res.status(e.status || 500).json({ status: 'error', message: e.status ? e.message : fallback });

router.use(authenticate);

// ---------------------------------------------------------------------------
// Overview & health
// ---------------------------------------------------------------------------

router.get('/overview', requirePermission('platform.view'), async (req, res) => {
  try { ok(res, await platformService.overview()); } catch (e) { fail(res, e); }
});

router.get('/health', requirePermission('platform.health.view'), async (req, res) => {
  try { ok(res, await platformService.health()); } catch (e) { fail(res, e); }
});

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

router.get('/tenants', requirePermission('tenants.view'), async (req, res) => {
  try { ok(res, await platformService.listTenants()); } catch (e) { fail(res, e); }
});

router.get('/tenants/:id', requirePermission('tenants.view'), async (req, res) => {
  try {
    const t = await platformService.getTenant(req.params.id);
    if (!t) return res.status(404).json({ status: 'error', message: 'Tenant not found' });
    ok(res, t);
  } catch (e) { fail(res, e); }
});

router.post('/tenants', requirePermission('tenants.create'), async (req, res) => {
  try {
    const result = await platformService.createTenant(req.body || {}, req.user?.id);
    await platformService.auditPlatform(req, result.tenantId, {
      action: 'platform.tenant.created', entity_type: 'tenant', entity_id: result.tenantId,
      severity: 'high', details: { name: req.body?.name, adminEmail: req.body?.adminEmail },
    });
    res.status(201).json({ status: 'success', data: result });
  } catch (e) { fail(res, e, 'Failed to create tenant'); }
});

router.patch('/tenants/:id', requirePermission('tenants.edit'), async (req, res) => {
  try {
    const changed = await platformService.updateTenant(req.params.id, req.body || {});
    await platformService.auditPlatform(req, req.params.id, {
      action: 'platform.tenant.updated', entity_type: 'tenant', entity_id: req.params.id,
      details: changed,
    });
    ok(res, changed);
  } catch (e) { fail(res, e, 'Failed to update tenant'); }
});

router.post('/tenants/:id/suspend', requirePermission('tenants.edit'), async (req, res) => {
  try {
    await platformService.suspendTenant(req.params.id, req.body?.reason, req.user?.id);
    await platformService.auditPlatform(req, req.params.id, {
      action: 'platform.tenant.suspended', entity_type: 'tenant', entity_id: req.params.id,
      severity: 'high', details: { reason: req.body?.reason },
    });
    ok(res, { status: 'suspended' });
  } catch (e) { fail(res, e, 'Failed to suspend tenant'); }
});

router.post('/tenants/:id/resume', requirePermission('tenants.edit'), async (req, res) => {
  try {
    await platformService.resumeTenant(req.params.id, req.user?.id);
    await platformService.auditPlatform(req, req.params.id, {
      action: 'platform.tenant.resumed', entity_type: 'tenant', entity_id: req.params.id,
      severity: 'high',
    });
    ok(res, { status: 'active' });
  } catch (e) { fail(res, e, 'Failed to resume tenant'); }
});

router.post('/tenants/:id/schedule-deletion', requirePermission('tenants.delete'), async (req, res) => {
  try {
    await platformService.scheduleDeletion(req.params.id, req.body?.days, req.body?.reason, req.user?.id);
    await platformService.auditPlatform(req, req.params.id, {
      action: 'platform.tenant.deletion_scheduled', entity_type: 'tenant', entity_id: req.params.id,
      severity: 'critical', details: { days: req.body?.days, reason: req.body?.reason },
    });
    ok(res, { status: 'pending_deletion' });
  } catch (e) { fail(res, e, 'Failed to schedule deletion'); }
});

router.post('/tenants/:id/cancel-deletion', requirePermission('tenants.delete'), async (req, res) => {
  try {
    await platformService.cancelDeletion(req.params.id, req.user?.id);
    await platformService.auditPlatform(req, req.params.id, {
      action: 'platform.tenant.deletion_cancelled', entity_type: 'tenant', entity_id: req.params.id,
      severity: 'high',
    });
    ok(res, { status: 'active' });
  } catch (e) { fail(res, e, 'Failed to cancel deletion'); }
});

// Full tenant data export (gzipped JSON). Sensitive credential columns are
// excluded inside the service.
router.get('/tenants/:id/export', requirePermission('tenants.view'), async (req, res) => {
  try {
    const data = await platformService.exportTenant(req.params.id);
    const gz = zlib.gzipSync(JSON.stringify(data));
    await platformService.auditPlatform(req, req.params.id, {
      action: 'platform.tenant.exported', entity_type: 'tenant', entity_id: req.params.id,
      severity: 'high',
    });
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="tenant-${req.params.id}-export.json.gz"`);
    res.send(gz);
  } catch (e) { fail(res, e, 'Failed to export tenant'); }
});

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

router.get('/tenants/:id/features', requirePermission('tenants.view'), async (req, res) => {
  try { ok(res, await platformService.getTenantFeatures(req.params.id)); } catch (e) { fail(res, e); }
});

router.put('/tenants/:id/features', requirePermission('platform.features.manage'), async (req, res) => {
  try {
    const featureKey = req.body?.feature_key ?? req.body?.featureKey;
    const result = await platformService.setTenantFeature(req.params.id, featureKey, req.body?.state, req.user?.id);
    await platformService.auditPlatform(req, req.params.id, {
      action: 'platform.tenant.feature_changed', entity_type: 'tenant', entity_id: req.params.id,
      details: { featureKey, state: req.body?.state },
    });
    ok(res, result);
  } catch (e) { fail(res, e, 'Failed to set feature'); }
});

// ---------------------------------------------------------------------------
// Impersonation
// ---------------------------------------------------------------------------

router.post('/tenants/:id/impersonate', requirePermission('platform.impersonate'), async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 10) {
      return res.status(400).json({ status: 'error', message: 'A reason of at least 10 characters is required' });
    }
    const result = await platformService.impersonate(req.params.id, req.user, reason);
    await platformService.auditPlatform(req, req.params.id, {
      action: 'platform.impersonation.start', entity_type: 'tenant', entity_id: req.params.id,
      severity: 'high', details: { reason },
    });
    ok(res, result);
  } catch (e) { fail(res, e, 'Failed to start impersonation'); }
});

// ---------------------------------------------------------------------------
// Subscriptions & billing
// ---------------------------------------------------------------------------

router.get('/subscriptions', requirePermission('subscriptions.view'), async (req, res) => {
  try { ok(res, await platformService.listSubscriptions({ status: req.query.status })); }
  catch (e) { fail(res, e); }
});

router.put('/subscriptions/:id', requirePermission('subscriptions.edit'), async (req, res) => {
  try {
    const sub = await platformService.updateSubscription(req.params.id, req.body || {});
    await platformService.auditPlatform(req, sub?.tenant_id, {
      action: 'platform.subscription.updated', entity_type: 'subscription', entity_id: req.params.id,
      severity: 'high', details: req.body,
    });
    ok(res, sub);
  } catch (e) { fail(res, e, 'Failed to update subscription'); }
});

router.get('/billing/issues', requirePermission('subscriptions.view'), async (req, res) => {
  try { ok(res, await platformService.billingIssues()); } catch (e) { fail(res, e); }
});

router.post('/billing/run-dunning', requirePermission('subscriptions.edit'), async (req, res) => {
  try {
    const { runDunning } = require('../services/platformJobs');
    const result = await runDunning();
    ok(res, result);
  } catch (e) { fail(res, e, 'Dunning run failed'); }
});

// ---------------------------------------------------------------------------
// Plans (platform view — CRUD on plans.* so tenants.* perms stay separate)
// ---------------------------------------------------------------------------

router.get('/plans', requirePermission('plans.view'), async (req, res) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    ok(res, await subscriptionService.getPlans({ activeOnly: false }));
  } catch (e) { fail(res, e); }
});

router.post('/plans', requirePermission('plans.create'), async (req, res) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    const plan = await subscriptionService.createPlan(req.body);
    await platformService.auditPlatform(req, null, {
      action: 'platform.plan.created', entity_type: 'plan', entity_id: plan?.id,
      severity: 'high', details: { name: req.body?.name },
    });
    res.status(201).json({ status: 'success', data: plan });
  } catch (e) { fail(res, e, 'Failed to create plan'); }
});

router.put('/plans/:id', requirePermission('plans.edit'), async (req, res) => {
  try {
    const subscriptionService = require('../services/subscriptionService');
    const plan = await subscriptionService.updatePlan(req.params.id, req.body);
    await platformService.auditPlatform(req, null, {
      action: 'platform.plan.updated', entity_type: 'plan', entity_id: req.params.id,
      details: req.body,
    });
    ok(res, plan);
  } catch (e) { fail(res, e, 'Failed to update plan'); }
});

// ---------------------------------------------------------------------------
// Platform staff + platform RBAC
// ---------------------------------------------------------------------------

router.get('/users', requirePermission('platform.manage'), async (req, res) => {
  try { ok(res, await platformService.listSystemUsers()); } catch (e) { fail(res, e); }
});

// Lender/tenant-side user list across tenants (read-only console view)
router.get('/tenant-users', requirePermission('tenants.view'), async (req, res) => {
  try {
    const [rows] = await require('../config/db').pool.query(
      `SELECT u.id, u.name, u.email, u.is_active, u.last_login_at, u.created_at,
              u.tenant_id, t.name AS tenant_name
         FROM users u JOIN tenants t ON t.id = u.tenant_id
        WHERE u.tenant_id <> ?
        ORDER BY u.created_at DESC LIMIT 500`,
      [platformService.PLATFORM_TENANT_ID]
    );
    ok(res, rows);
  } catch (e) { fail(res, e); }
});

router.post('/users', requirePermission('platform.manage'), async (req, res) => {
  try {
    const result = await platformService.createSystemUser(req.body || {}, req.user?.id);
    await platformService.auditPlatform(req, null, {
      action: 'platform.user.created', entity_type: 'user', entity_id: result.id,
      severity: 'high', details: { email: req.body?.email, role: req.body?.roleName },
    });
    res.status(201).json({ status: 'success', data: result });
  } catch (e) { fail(res, e, 'Failed to create platform user'); }
});

router.patch('/users/:id', requirePermission('platform.manage'), async (req, res) => {
  try {
    await platformService.updateSystemUser(req.params.id, req.body || {}, req.user?.id);
    await platformService.auditPlatform(req, null, {
      action: 'platform.user.updated', entity_type: 'user', entity_id: req.params.id,
      severity: 'high', details: { role: req.body?.roleName, isActive: req.body?.isActive },
    });
    ok(res, { id: req.params.id });
  } catch (e) { fail(res, e, 'Failed to update platform user'); }
});

router.delete('/users/:id', requirePermission('platform.manage'), async (req, res) => {
  try {
    await platformService.deleteSystemUser(req.params.id, req.user?.id);
    await platformService.auditPlatform(req, null, {
      action: 'platform.user.deleted', entity_type: 'user', entity_id: req.params.id,
      severity: 'critical',
    });
    ok(res, { id: req.params.id });
  } catch (e) { fail(res, e, 'Failed to delete platform user'); }
});

router.get('/rbac/roles', requirePermission('platform.manage'), async (req, res) => {
  try { ok(res, await platformService.listPlatformRoles()); } catch (e) { fail(res, e); }
});

router.get('/rbac/permissions', requirePermission('platform.manage'), async (req, res) => {
  try { ok(res, await platformService.listPlatformPermissions()); } catch (e) { fail(res, e); }
});

router.put('/rbac/roles/:id/permissions', requirePermission('platform.manage'), async (req, res) => {
  try {
    await platformService.updatePlatformRolePermissions(
      req.params.id, req.body?.permission_ids ?? req.body?.permissionIds, req.user?.id);
    await platformService.auditPlatform(req, null, {
      action: 'platform.role.permissions_updated', entity_type: 'role', entity_id: req.params.id,
      severity: 'critical',
    });
    ok(res, { id: req.params.id });
  } catch (e) { fail(res, e, 'Failed to update platform role'); }
});

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

router.get('/audit', requirePermission('platform.audit.view'), async (req, res) => {
  try {
    ok(res, await platformService.auditFeed({
      tenantId: req.query.tenantId,
      limit: req.query.limit,
      offset: req.query.offset,
    }));
  } catch (e) { fail(res, e); }
});

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

router.get('/announcements', requirePermission('platform.announcements.manage'), async (req, res) => {
  try { ok(res, await platformService.listAnnouncements()); } catch (e) { fail(res, e); }
});

router.post('/announcements', requirePermission('platform.announcements.manage'), async (req, res) => {
  try {
    const result = await platformService.createAnnouncement(req.body || {}, req.user?.id);
    res.status(201).json({ status: 'success', data: result });
  } catch (e) { fail(res, e, 'Failed to create announcement'); }
});

router.patch('/announcements/:id', requirePermission('platform.announcements.manage'), async (req, res) => {
  try {
    await platformService.updateAnnouncement(req.params.id, req.body || {});
    ok(res, { id: req.params.id });
  } catch (e) { fail(res, e, 'Failed to update announcement'); }
});

// ---------------------------------------------------------------------------
// Support tickets (platform side — tenant side lives in support.routes.js)
// ---------------------------------------------------------------------------

router.get('/tickets', requirePermission('support.view'), async (req, res) => {
  try { ok(res, await platformService.listTickets({ status: req.query.status })); }
  catch (e) { fail(res, e); }
});

router.get('/tickets/:id', requirePermission('support.view'), async (req, res) => {
  try {
    const t = await platformService.getTicket(req.params.id);
    if (!t) return res.status(404).json({ status: 'error', message: 'Ticket not found' });
    ok(res, t);
  } catch (e) { fail(res, e); }
});

router.post('/tickets/:id/messages', requirePermission('support.respond'), async (req, res) => {
  try {
    const result = await platformService.replyToTicket(req.params.id, req.body?.body, req.user?.id, true);
    res.status(201).json({ status: 'success', data: result });
  } catch (e) { fail(res, e, 'Failed to reply'); }
});

router.patch('/tickets/:id', requirePermission('support.respond'), async (req, res) => {
  try {
    await platformService.updateTicketStatus(req.params.id, req.body?.status, req.user?.id);
    ok(res, { id: req.params.id });
  } catch (e) { fail(res, e, 'Failed to update ticket'); }
});

module.exports = router;
