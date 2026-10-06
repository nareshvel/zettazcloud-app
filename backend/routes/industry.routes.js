/**
 * Industry field-config + cost-code settings routes
 * Base path: /api/industry   (mounted in routes/index.js)
 *
 * Endpoints:
 *   GET    /industries                       list supported industries
 *   GET    /fields?applies_to=product        resolved field schema for tenant
 *   GET    /tenant                           tenant's industry_code
 *   PUT    /tenant                           set tenant industry_code
 *   GET    /overrides?applies_to=product     tenant field overrides
 *   PUT    /overrides                         upsert an override / custom field
 *   DELETE /overrides/:fieldKey              remove an override
 *   GET    /cost-code                        cost-code cipher settings
 *   PUT    /cost-code                         save cost-code cipher settings
 *   POST   /cost-code/preview                encode a sample amount (staff tool)
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const industryFieldService = require('../services/industryFieldService');
const templateProvisioningService = require('../services/templateProvisioningService');
const costCode = require('../services/costCodeService');
const { isTenantAdmin } = require('../services/rbacService');
const { logActivity } = require('../services/auditLogService');

// Sensitive, tenant-wide action (changes every store's industry_code/product fields
// at once) — gate to Tenant Admin only, same helper used elsewhere to bypass
// granular permission checks for that role.
async function requireTenantAdmin(req, res, next) {
  try {
    const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
    const allowed = await isTenantAdmin(req.user?.id, tenantId);
    if (!allowed) {
      return res.status(403).json({ status: 'error', message: 'Only a Tenant Admin can perform this action.' });
    }
    next();
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
}

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];

router.use(authenticate);

// ---- industries catalogue ----
router.get('/industries', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT code, name, description FROM industry_types WHERE is_active = 1 ORDER BY sort_order, name'
    );
    res.json({ status: 'success', data: rows });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ---- resolved field schema for the tenant's industry ----
router.get('/fields', requireTenantId, async (req, res) => {
  try {
    const appliesTo = ['product', 'pos', 'customer'].includes(req.query.applies_to)
      ? req.query.applies_to : 'product';
    const result = await industryFieldService.getFieldsForTenant(tid(req), appliesTo);
    res.json({ status: 'success', data: result });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ---- tenant industry get/set ----
router.get('/tenant', requireTenantId, async (req, res) => {
  try {
    const industry = await industryFieldService.getTenantIndustry(tid(req));
    res.json({ status: 'success', data: { industry_code: industry } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.put('/tenant', requireTenantId, requireTenantAdmin, async (req, res) => {
  try {
    const { industry_code } = req.body;
    if (!industry_code) return res.status(400).json({ status: 'error', message: 'industry_code required' });
    const [ind] = await pool.execute('SELECT code FROM industry_types WHERE code = ? AND is_active = 1', [industry_code]);
    if (!ind.length) return res.status(400).json({ status: 'error', message: 'unknown industry_code' });
    // Business type is stored in two places, but they are NOT always meant to
    // move together any more:
    //
    //   tenants.industry_code  — the company-wide DEFAULT, drives menu
    //                            visibility and any store still inheriting it
    //   stores.industry_code   — per-store OVERRIDE (NULL = inherit from
    //                            tenant); drives that store's own retail
    //                            profile/template plan and product fields
    //
    // This used to blanket-overwrite EVERY store's industry_code to match,
    // which made a per-store override impossible in practice — the moment a
    // Tenant Admin touched the company-wide setting, it silently clobbered
    // any store that had been given its own value (see
    // docs/17-migration-and-roadmap/22_Tenant_vs_Store_Business_Identity_Audit_And_Plan.md).
    // Now it only updates stores that are still inheriting (industry_code IS
    // NULL) — a store with an explicit override keeps it until someone
    // changes THAT store's setting directly (see PUT /api/retail-profile).
    //
    // Same connection, one transaction — a partial update is exactly the
    // disagreement this is meant to prevent.
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.execute('UPDATE tenants SET industry_code = ? WHERE id = ?', [industry_code, tid(req)]);
      await conn.execute('UPDATE stores SET industry_code = ? WHERE tenant_id = ? AND industry_code IS NULL', [industry_code, tid(req)]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    /*
     * The new vertical brings documents the old one did not have — a jeweller
     * needs a certificate, a grocer does not. Provisioning is ADDITIVE: it
     * creates what is missing and never touches or deletes existing templates,
     * because the old vertical's documents may have been customised, and a
     * business that switches type usually still has to reprint old sales.
     *
     * Failure here must not fail the industry change: the setting is saved and
     * the user can create the missing templates from the Print Templates page.
     */
    try {
      const result = await templateProvisioningService.provisionTenantTemplates(
        tid(req), { publish: true, createdBy: req.user?.id || null },
      );
      const created = result.reduce((n, r) => n + (r.created ? r.created.length : 0), 0);
      if (created) console.log(`[industry] provisioned ${created} template(s) after switch to ${industry_code}`);
    } catch (err) {
      console.error('[industry] template provisioning failed after industry change:', err.message);
    }

    try {
      await logActivity({
        tenant_id: tid(req),
        user_id: req.user?.id || null,
        username: req.user?.email,
        action: 'TENANT_INDUSTRY_CHANGED',
        description: `Business type changed to ${industry_code}`,
        details: { industry_code },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
    } catch (auditErr) {
      console.error('[industry] audit log failed:', auditErr.message);
    }

    res.json({ status: 'success', data: { industry_code } });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ---- tenant field overrides ----
router.get('/overrides', requireTenantId, async (req, res) => {
  try {
    const appliesTo = req.query.applies_to || 'product';
    const [rows] = await pool.execute(
      'SELECT * FROM tenant_field_overrides WHERE tenant_id = ? AND applies_to = ? ORDER BY sort_order',
      [tid(req), appliesTo]
    );
    res.json({ status: 'success', data: rows });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.put('/overrides', requireTenantId, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.field_key) return res.status(400).json({ status: 'error', message: 'field_key required' });
    const appliesTo = b.applies_to || 'product';
    const optionsJson = b.options != null ? JSON.stringify(b.options) : null;
    await pool.execute(
      `INSERT INTO tenant_field_overrides
         (id, tenant_id, applies_to, field_key, label, data_type, options_json, unit,
          is_required, is_enabled, is_custom, sort_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         label=VALUES(label), data_type=VALUES(data_type), options_json=VALUES(options_json),
         unit=VALUES(unit), is_required=VALUES(is_required), is_enabled=VALUES(is_enabled),
         is_custom=VALUES(is_custom), sort_order=VALUES(sort_order)`,
      [uuidv4(), tid(req), appliesTo, b.field_key, b.label ?? null, b.data_type ?? null,
       optionsJson, b.unit ?? null,
       b.is_required != null ? (b.is_required ? 1 : 0) : null,
       b.is_enabled === false ? 0 : 1,
       b.is_custom ? 1 : 0,
       b.sort_order ?? null]
    );
    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.delete('/overrides/:fieldKey', requireTenantId, async (req, res) => {
  try {
    const appliesTo = req.query.applies_to || 'product';
    await pool.execute(
      'DELETE FROM tenant_field_overrides WHERE tenant_id = ? AND applies_to = ? AND field_key = ?',
      [tid(req), appliesTo, req.params.fieldKey]
    );
    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

// ---- cost-code cipher settings ----
const DEFAULT_MAP = costCode.DEFAULT_DIGIT_MAP;

async function loadCostCode(tenantId) {
  const [rows] = await pool.execute('SELECT * FROM tenant_cost_code_settings WHERE tenant_id = ?', [tenantId]);
  if (!rows.length) {
    return { enabled: false, prefix: 'X', suffix: 'Y', decimalChar: '.', repeatChar: '', digitMap: DEFAULT_MAP };
  }
  const r = rows[0];
  return {
    enabled: !!r.enabled,
    prefix: r.prefix_char,
    suffix: r.suffix_char,
    decimalChar: r.decimal_char,
    repeatChar: r.repeat_char || '',
    digitMap: typeof r.digit_map === 'string' ? JSON.parse(r.digit_map) : r.digit_map,
  };
}

router.get('/cost-code', requireTenantId, async (req, res) => {
  try {
    res.json({ status: 'success', data: await loadCostCode(tid(req)) });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.put('/cost-code', requireTenantId, async (req, res) => {
  try {
    const b = req.body || {};
    // Accept both snake_case (via the frontend api auto-conversion) and camelCase.
    const cfg = {
      enabled: !!b.enabled,
      prefix: b.prefix || 'X',
      suffix: b.suffix || 'Y',
      decimalChar: b.decimal_char || b.decimalChar || '.',
      repeatChar: b.repeat_char || b.repeatChar || '',
      digitMap: b.digit_map || b.digitMap || DEFAULT_MAP,
    };
    costCode.normalizeConfig(cfg); // validates; throws on bad config
    await pool.execute(
      `INSERT INTO tenant_cost_code_settings
         (tenant_id, enabled, prefix_char, suffix_char, decimal_char, repeat_char, digit_map)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         enabled=VALUES(enabled), prefix_char=VALUES(prefix_char), suffix_char=VALUES(suffix_char),
         decimal_char=VALUES(decimal_char), repeat_char=VALUES(repeat_char), digit_map=VALUES(digit_map)`,
      [tid(req), cfg.enabled ? 1 : 0, cfg.prefix, cfg.suffix, cfg.decimalChar,
       cfg.repeatChar || null, JSON.stringify(cfg.digitMap)]
    );
    res.json({ status: 'success', data: cfg });
  } catch (e) {
    res.status(400).json({ status: 'error', message: e.message });
  }
});

router.post('/cost-code/preview', requireTenantId, async (req, res) => {
  try {
    const cfg = await loadCostCode(tid(req));
    const amount = req.body?.amount;
    const encoded = costCode.encode(amount, cfg);
    res.json({ status: 'success', data: { amount: Number(amount), code: encoded, decoded: costCode.decode(encoded, cfg) } });
  } catch (e) {
    res.status(400).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
