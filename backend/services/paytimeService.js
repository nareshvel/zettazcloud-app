/**
 * paytimeService
 * -----------------------------------------------------------------------------
 * Thin integration client for the Paytime payroll application. Zettaz owns the
 * lightweight employee + sales-performance data; Paytime owns salary, tax,
 * attendance and payout. This service pushes computed incentives/bonuses to
 * Paytime and can pull employee directory data to keep IDs in sync.
 *
 * Configuration (env):
 *   PAYTIME_BASE_URL   e.g. https://api.paytime.app
 *   PAYTIME_API_KEY    per-tenant or global service key
 *
 * All methods degrade gracefully (return { ok:false } instead of throwing) so a
 * Paytime outage never blocks a POS sale.
 */

'use strict';

const axios = require('axios');

const BASE_URL = process.env.PAYTIME_BASE_URL || '';
const API_KEY = process.env.PAYTIME_API_KEY || '';

function client() {
  if (!BASE_URL || !API_KEY) return null;
  return axios.create({
    baseURL: BASE_URL,
    timeout: 8000,
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
  });
}

function configured() {
  return !!(BASE_URL && API_KEY);
}

/** Pull the payroll employee directory for a tenant (to map paytime_employee_id). */
async function fetchEmployees(tenantExternalId) {
  const c = client();
  if (!c) return { ok: false, reason: 'not_configured', data: [] };
  try {
    const { data } = await c.get(`/v1/employers/${tenantExternalId}/employees`);
    return { ok: true, data: data?.employees || [] };
  } catch (e) {
    return { ok: false, reason: e.message, data: [] };
  }
}

/**
 * Push a computed incentive/bonus line to Paytime for a payroll period.
 * @param {object} payload { paytimeEmployeeId, periodStart, periodEnd, type, amount, note }
 */
async function pushIncentive(payload) {
  const c = client();
  if (!c) return { ok: false, reason: 'not_configured' };
  try {
    const { data } = await c.post('/v1/incentives', {
      employee_id: payload.paytimeEmployeeId,
      period_start: payload.periodStart,
      period_end: payload.periodEnd,
      type: payload.type || 'sales_incentive',
      amount: payload.amount,
      note: payload.note || 'Zettaz sales incentive',
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

module.exports = { configured, fetchEmployees, pushIncentive };
