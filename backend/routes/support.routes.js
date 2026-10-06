/**
 * Support Routes — tenant-facing helpdesk + announcements.
 * Base path: /api/support (mounted in routes/index.js)
 *
 * These are the tenant side of the platform console's support ticket system:
 * a tenant user can open tickets and read their own tenant's ticket thread;
 * platform staff answer through /api/platform/tickets (support.* perms).
 */
'use strict';

const express = require('express');
const router = express.Router();

const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const platformService = require('../services/platformService');

const ok = (res, data) => res.json({ status: 'success', data });
const fail = (res, e, fallback = 'Support request failed') =>
  res.status(e.status || 500).json({ status: 'error', message: e.status ? e.message : fallback });

router.use(authenticate, requireTenantId);

const tid = (req) => req.tenantId || req.user?.tenant_id || req.user?.tenantId;

// Active platform announcements for this tenant (dashboard banner)
router.get('/announcements/active', async (req, res) => {
  try { ok(res, await platformService.activeAnnouncements(tid(req))); }
  catch (e) { fail(res, e); }
});

router.get('/tickets', async (req, res) => {
  try { ok(res, await platformService.listMyTickets(tid(req))); }
  catch (e) { fail(res, e); }
});

router.post('/tickets', async (req, res) => {
  try {
    const result = await platformService.createTicket(tid(req), req.user?.id, req.body || {});
    res.status(201).json({ status: 'success', data: result });
  } catch (e) { fail(res, e, 'Failed to create ticket'); }
});

router.get('/tickets/:id', async (req, res) => {
  try {
    const t = await platformService.getTicket(req.params.id);
    if (!t || t.ticket.tenant_id !== tid(req)) {
      return res.status(404).json({ status: 'error', message: 'Ticket not found' });
    }
    ok(res, t);
  } catch (e) { fail(res, e); }
});

router.post('/tickets/:id/messages', async (req, res) => {
  try {
    const t = await platformService.getTicket(req.params.id);
    if (!t || t.ticket.tenant_id !== tid(req)) {
      return res.status(404).json({ status: 'error', message: 'Ticket not found' });
    }
    const result = await platformService.replyToTicket(req.params.id, req.body?.body, req.user?.id, false);
    res.status(201).json({ status: 'success', data: result });
  } catch (e) { fail(res, e, 'Failed to send message'); }
});

module.exports = router;
