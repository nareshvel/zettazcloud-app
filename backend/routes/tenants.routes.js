/**
 * Tenant (business) profile routes
 * Base path: /api/tenants   (mounted in routes/index.js)
 *
 * Endpoints:
 *   GET    /me     read the current tenant's name/industry/company profile (any authenticated user)
 *   PATCH  /me     update the current tenant's name and/or company profile (Tenant Admin only)
 *
 * "Company profile" = address/city/state/postal_code/country_code/phone/
 * email/website/logo_url — added 2026-09-01 (see database/migrations/
 * 2026-09-01_tenant_company_profile.sql and docs/17-migration-and-roadmap/
 * 22_Tenant_vs_Store_Business_Identity_Audit_And_Plan.md). Deliberately
 * distinct from any STORE's own address/phone/email/logo — this is the
 * parent company's own contact info, e.g. for a company that operates
 * several differently-branded/-located stores.
 */

'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const { isTenantAdmin } = require('../services/rbacService');
const { logActivity } = require('../services/auditLogService');

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];

router.use(authenticate);
router.use(requireTenantId);

async function requireTenantAdmin(req, res, next) {
  try {
    const allowed = await isTenantAdmin(req.user?.id, tid(req));
    if (!allowed) {
      return res.status(403).json({ status: 'error', message: 'Only a Tenant Admin can perform this action.' });
    }
    next();
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
}

// GET /api/tenants/me — read the tenant's business name/industry, so the
// Business tab (frontend/src/pages/UserProfilePage.tsx) has something real to
// load into the name field instead of falling back to a possibly-stale cached
// user object. No Tenant Admin gate — reading the business name isn't
// sensitive; only PATCH below is restricted.
router.get('/me', async (req, res) => {
  try {
    const row = await pool.query(
      `SELECT id, name, industry_code,
              address, city, state, postal_code, country_code,
              phone, email, website, logo_url
         FROM tenants WHERE id = ? LIMIT 1`,
      [tid(req)]
    ).then(([rows]) => rows[0]);

    if (!row) return res.status(404).json({ status: 'error', message: 'Tenant not found' });

    res.json({ status: 'success', data: row });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// Fields this endpoint accepts beyond `name` — every one is nullable/optional,
// a company can fill these in gradually. Kept as a simple string-or-null
// pass-through (no format validation) matching how store.routes.js treats
// the equivalent store-level fields.
//
// NOTE: these are snake_case (DB column names), not camelCase, because
// fetchApi (frontend/src/services/api.ts) converts every outgoing JSON
// request body from camelCase to snake_case BEFORE it reaches this route —
// req.body already has `postal_code`/`country_code`/`logo_url`, never
// `postalCode`/`countryCode`/`logoUrl`. Checking for the camelCase names
// here silently dropped those three fields on every save (fixed 2026-09-01
// after the user reported postal code not saving/loading).
const COMPANY_PROFILE_FIELDS = [
  'address', 'city', 'state', 'postal_code', 'country_code',
  'phone', 'email', 'website', 'logo_url',
];

// PATCH /api/tenants/me — update the tenant's business name and/or company profile
router.patch('/me', requireTenantAdmin, async (req, res) => {
  try {
    const updates = [];
    const values = [];
    const changedFields = {};

    if (req.body?.name !== undefined) {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!name) return res.status(400).json({ status: 'error', message: 'name is required' });
      if (name.length > 255) return res.status(400).json({ status: 'error', message: 'name is too long' });
      updates.push('name = ?');
      values.push(name);
      changedFields.name = name;
    }

    for (const column of COMPANY_PROFILE_FIELDS) {
      if (req.body?.[column] === undefined) continue;
      const raw = req.body[column];
      const value = raw === null ? null : String(raw).trim() || null;
      updates.push(`\`${column}\` = ?`);
      values.push(value);
      changedFields[column] = value;
    }

    if (updates.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No recognized fields to update' });
    }

    updates.push('updated_at = NOW()');
    values.push(tid(req));

    await pool.execute(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`, values);

    try {
      await logActivity({
        tenant_id: tid(req),
        user_id: req.user?.id || null,
        username: req.user?.email,
        action: 'TENANT_PROFILE_CHANGED',
        description: changedFields.name
          ? `Business name changed to "${changedFields.name}"`
          : 'Company profile updated',
        details: changedFields,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
    } catch (auditErr) {
      console.error('[tenants] audit log failed:', auditErr.message);
    }

    res.json({ status: 'success', data: changedFields });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
