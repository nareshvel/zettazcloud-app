/**
 * industryFieldService
 * -----------------------------------------------------------------------------
 * Resolves the effective set of dynamic fields a tenant should see on a given
 * form (product / pos / customer), by combining:
 *   1. the platform default field definitions for the tenant's industry, and
 *   2. the tenant's own overrides (hide / relabel / add custom fields).
 *
 * The resolved schema drives the frontend form and validates incoming values.
 */

'use strict';

const { pool } = require('../config/db');

const DEFAULT_INDUSTRY = 'general_retail';

/**
 * Resolve a tenant's industry code (column first, then settings JSON fallback).
 */
async function getTenantIndustry(tenantId) {
  const [rows] = await pool.execute(
    'SELECT industry_code, settings FROM tenants WHERE id = ?',
    [tenantId]
  );
  if (!rows.length) return DEFAULT_INDUSTRY;
  const row = rows[0];
  if (row.industry_code) return row.industry_code;
  try {
    const s = typeof row.settings === 'string' ? JSON.parse(row.settings) : row.settings;
    if (s && s.industry_code) return s.industry_code;
  } catch (_) { /* ignore */ }
  return DEFAULT_INDUSTRY;
}

/**
 * Return the effective, ordered list of fields for a tenant + entity form.
 * @param {string} tenantId
 * @param {'product'|'pos'|'customer'} appliesTo
 */
async function getFieldsForTenant(tenantId, appliesTo = 'product') {
  const industry = await getTenantIndustry(tenantId);

  const [defs] = await pool.execute(
    `SELECT field_key, label, data_type, options_json, unit, is_required,
            is_searchable, show_on_receipt, sort_order
       FROM industry_field_definitions
      WHERE industry_code = ? AND applies_to = ? AND is_active = 1
      ORDER BY sort_order, label`,
    [industry, appliesTo]
  );

  const [overrides] = await pool.execute(
    `SELECT field_key, label, data_type, options_json, unit, is_required,
            is_enabled, is_custom, sort_order
       FROM tenant_field_overrides
      WHERE tenant_id = ? AND applies_to = ?`,
    [tenantId, appliesTo]
  );
  const ovByKey = new Map(overrides.map((o) => [o.field_key, o]));

  const merged = [];

  // 1) platform defaults, adjusted by overrides
  for (const d of defs) {
    const ov = ovByKey.get(d.field_key);
    if (ov && ov.is_enabled === 0) continue; // tenant hid this field
    merged.push(applyOverride(d, ov, false));
  }

  // 2) tenant custom fields (not in defaults)
  for (const ov of overrides) {
    if (ov.is_custom && ov.is_enabled !== 0 && !defs.find((d) => d.field_key === ov.field_key)) {
      merged.push(applyOverride({ field_key: ov.field_key }, ov, true));
    }
  }

  merged.sort((a, b) => a.sort_order - b.sort_order);
  return { industry, appliesTo, fields: merged };
}

function applyOverride(def, ov, isCustom) {
  const parseOpts = (v) => {
    if (v == null) return null;
    return typeof v === 'string' ? safeJson(v) : v;
  };
  return {
    field_key: def.field_key,
    label: (ov && ov.label) || def.label || def.field_key,
    data_type: (ov && ov.data_type) || def.data_type || 'text',
    options: parseOpts((ov && ov.options_json) ?? def.options_json),
    unit: (ov && ov.unit) || def.unit || null,
    is_required: ov && ov.is_required != null ? !!ov.is_required : !!def.is_required,
    is_searchable: !!def.is_searchable,
    show_on_receipt: !!def.show_on_receipt,
    is_custom: !!isCustom,
    sort_order: (ov && ov.sort_order != null) ? ov.sort_order : (def.sort_order || 999),
  };
}

function safeJson(v) { try { return JSON.parse(v); } catch (_) { return null; } }

/**
 * Validate & sanitize an incoming attributes object against the tenant schema.
 * Unknown keys are dropped; required missing keys are reported.
 * @returns {{ value: object, errors: string[] }}
 */
async function validateAttributes(tenantId, appliesTo, attributes = {}) {
  const { fields } = await getFieldsForTenant(tenantId, appliesTo);
  const value = {};
  const errors = [];
  const attrs = attributes && typeof attributes === 'object' ? attributes : {};

  for (const f of fields) {
    const raw = attrs[f.field_key];
    const empty = raw === undefined || raw === null || raw === '';
    if (empty) {
      if (f.is_required) errors.push(`${f.label} is required`);
      continue;
    }
    switch (f.data_type) {
      case 'number':
      case 'decimal': {
        const n = Number(raw);
        if (Number.isNaN(n)) { errors.push(`${f.label} must be a number`); break; }
        value[f.field_key] = n;
        break;
      }
      case 'boolean':
        value[f.field_key] = raw === true || raw === 'true' || raw === 1 || raw === '1';
        break;
      case 'select':
        if (Array.isArray(f.options) && f.options.length && !f.options.includes(raw)) {
          errors.push(`${f.label} must be one of: ${f.options.join(', ')}`);
          break;
        }
        value[f.field_key] = raw;
        break;
      default:
        value[f.field_key] = String(raw);
    }
  }
  return { value, errors };
}

module.exports = {
  DEFAULT_INDUSTRY,
  getTenantIndustry,
  getFieldsForTenant,
  validateAttributes,
};
