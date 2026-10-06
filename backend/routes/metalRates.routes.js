/**
 * Metal rates + weight pricing routes — /api/metal-rates
 * Jewelry-only. Weight pricing is OFF unless the tenant enables it.
 *
 *   GET    /settings          pricing settings (weight pricing on/off + defaults + market fetch config)
 *   PUT    /settings          update settings
 *   GET    /current           currently effective rates
 *   GET    /history           rate history (optional ?metal=&purity=)
 *   POST   /                  publish a new rate (closes the previous one)
 *   POST   /calculate         price a line from weight + rate (no save)
 *   POST   /fetch-market      fetch live rates from goldapi.io → returns preview
 *   POST   /fetch-market/publish  fetch + immediately publish all rates
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const requireIndustry = require('../middleware/requireIndustry');
const metalPricing = require('../services/metalPricingService');
const marketFetcher = require('../services/marketRateFetcherService');

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
const uid = (req) => req.user?.id || null;

router.use(authenticate);
router.use(requireTenantId);
router.use(requireIndustry(['jewelry']));

const DEFAULT_SETTINGS = {
  weight_pricing_enabled: 0,
  default_making_charge_type: 'per_gram',
  default_making_charge_value: 0,
  default_wastage_pct: 0,
  market_rate_api_key: null,
  market_rate_local_premium_pct: 0,
  market_rate_auto_publish: 0,
  market_rate_fetch_time: '10:00',
  weight_unit: 'g',
};

router.get('/settings', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM tenant_pricing_settings WHERE tenant_id = ?', [tid(req)]);
    res.json({ status: 'success', data: rows[0] || { tenant_id: tid(req), ...DEFAULT_SETTINGS } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.put('/settings', async (req, res) => {
  try {
    const b = req.body || {};
    await pool.execute(
      `INSERT INTO tenant_pricing_settings
        (tenant_id, weight_pricing_enabled, default_making_charge_type, default_making_charge_value,
         default_wastage_pct, market_rate_api_key, market_rate_local_premium_pct,
         market_rate_auto_publish, market_rate_fetch_time, weight_unit)
       VALUES (?,?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         weight_pricing_enabled        = VALUES(weight_pricing_enabled),
         default_making_charge_type    = VALUES(default_making_charge_type),
         default_making_charge_value   = VALUES(default_making_charge_value),
         default_wastage_pct           = VALUES(default_wastage_pct),
         market_rate_api_key           = VALUES(market_rate_api_key),
         market_rate_local_premium_pct = VALUES(market_rate_local_premium_pct),
         market_rate_auto_publish      = VALUES(market_rate_auto_publish),
         market_rate_fetch_time        = VALUES(market_rate_fetch_time),
         weight_unit                   = VALUES(weight_unit)`,
      [
        tid(req),
        b.weight_pricing_enabled ? 1 : 0,
        b.default_making_charge_type   || 'per_gram',
        Number(b.default_making_charge_value) || 0,
        Number(b.default_wastage_pct)  || 0,
        b.market_rate_api_key          || null,
        Number(b.market_rate_local_premium_pct) || 0,
        b.market_rate_auto_publish     ? 1 : 0,
        b.market_rate_fetch_time       || '10:00',
        b.weight_unit                  || 'g',
      ]
    );
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.get('/current', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM metal_rates
        WHERE tenant_id = ? AND effective_to IS NULL
        ORDER BY metal, purity_label`,
      [tid(req)]
    );
    res.json({ status: 'success', data: rows });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.get('/history', async (req, res) => {
  try {
    const params = [tid(req)];
    let sql = 'SELECT * FROM metal_rates WHERE tenant_id = ?';
    if (req.query.metal) { sql += ' AND metal = ?'; params.push(req.query.metal); }
    if (req.query.purity) { sql += ' AND purity_label = ?'; params.push(req.query.purity); }
    sql += ' ORDER BY effective_from DESC LIMIT 200';
    const [rows] = await pool.execute(sql, params);
    res.json({ status: 'success', data: rows });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// Publishing a new rate closes the previous open one for that metal+purity,
// so history stays intact and `effective_to IS NULL` always means "current".
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const b = req.body || {};
    if (!b.metal || !b.purity_label || b.rate_per_gram == null) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'metal, purity_label and rate_per_gram are required' });
    }
    const now = b.effective_from ? new Date(b.effective_from) : new Date();

    await conn.query(
      `UPDATE metal_rates SET effective_to = ?
        WHERE tenant_id = ? AND metal = ? AND purity_label = ? AND effective_to IS NULL`,
      [now, tid(req), b.metal, b.purity_label]
    );

    const id = uuidv4();
    await conn.query(
      `INSERT INTO metal_rates
        (id, tenant_id, store_id, metal, purity_label, purity_pct, rate_per_gram, buy_rate_per_gram,
         effective_from, effective_to, created_by_user_id)
       VALUES (?,?,?,?,?,?,?,?,?,NULL,?)`,
      [id, tid(req), b.store_id ?? null, b.metal, b.purity_label, b.purity_pct ?? null,
       Number(b.rate_per_gram), b.buy_rate_per_gram ?? null, now, uid(req)]
    );

    await conn.commit();
    res.status(201).json({ status: 'success', data: { id } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

router.post('/calculate', async (req, res) => {
  try {
    const b = req.body || {};
    let rate = Number(b.rate_per_gram);

    // Fall back to the current published rate when one isn't supplied.
    if (!rate && b.metal && b.purity_label) {
      const [[row]] = await pool.query(
        `SELECT rate_per_gram FROM metal_rates
          WHERE tenant_id = ? AND metal = ? AND purity_label = ? AND effective_to IS NULL LIMIT 1`,
        [tid(req), b.metal, b.purity_label]
      );
      if (row) rate = Number(row.rate_per_gram);
    }
    if (!rate) return res.status(400).json({ status: 'error', message: 'No rate supplied and no current rate published for that metal/purity.' });

    const input = {
      netWeight: b.net_weight, ratePerGram: rate, wastagePct: b.wastage_pct,
      makingChargeType: b.making_charge_type, makingChargeValue: b.making_charge_value,
      stoneValue: b.stone_value, metal: b.metal, purityLabel: b.purity_label,
    };
    const result = metalPricing.calculateLinePrice(input);
    res.json({ status: 'success', data: { ...result, snapshot: metalPricing.buildSnapshot(input, result) } });
  } catch (e) { res.status(400).json({ status: 'error', message: e.message }); }
});

/* ─── helpers shared by fetch routes ────────────────────────────────────── */
async function getSettingsForTenant(tenantId) {
  const [rows] = await pool.execute('SELECT * FROM tenant_pricing_settings WHERE tenant_id = ?', [tenantId]);
  return rows[0] || DEFAULT_SETTINGS;
}

async function getStoreCurrency(tenantId) {
  const [[row]] = await pool.query(
    'SELECT currency_code FROM stores WHERE tenant_id = ? LIMIT 1', [tenantId]
  );
  return row?.currency_code || 'USD';
}

async function publishRates(conn, tenantId, userId, rates) {
  const now = new Date();
  for (const r of rates) {
    // Close existing current rate for this metal+purity
    await conn.query(
      'UPDATE metal_rates SET effective_to = ? WHERE tenant_id = ? AND metal = ? AND purity_label = ? AND effective_to IS NULL',
      [now, tenantId, r.metal, r.purityLabel]
    );
    await conn.query(
      `INSERT INTO metal_rates
        (id, tenant_id, metal, purity_label, purity_pct, rate_per_gram, buy_rate_per_gram,
         effective_from, effective_to, created_by_user_id)
       VALUES (?,?,?,?,?,?,?,?,NULL,?)`,
      [
        uuidv4(), tenantId,
        r.metal, r.purityLabel, r.purityPct != null ? r.purityPct : null,
        r.ratePerGram, r.buyRatePerGram ?? null,
        now, userId,
      ]
    );
  }
}

/* POST /fetch-market — fetch live rates, return preview (does NOT publish) */
router.post('/fetch-market', async (req, res) => {
  try {
    const s = await getSettingsForTenant(tid(req));
    const currencyCode = (await getStoreCurrency(tid(req)));
    const apiKey = s.market_rate_api_key;
    const metals = req.body?.metals || ['Gold', 'Silver', 'Platinum'];

    const result = await marketFetcher.fetchMarketRates({
      apiKey,
      currencyCode,
      weightUnit: s.weight_unit || 'g',
      localPremiumPct: Number(s.market_rate_local_premium_pct) || 0,
      metals,
    });
    res.json({ status: 'success', data: result });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

/* POST /fetch-market/publish — fetch live rates AND publish them immediately */
router.post('/fetch-market/publish', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const s = await getSettingsForTenant(tid(req));
    const currencyCode = await getStoreCurrency(tid(req));
    const metals = req.body?.metals || ['Gold', 'Silver', 'Platinum'];

    const result = await marketFetcher.fetchMarketRates({
      apiKey: s.market_rate_api_key,
      currencyCode,
      weightUnit:       s.weight_unit || 'g',
      localPremiumPct:  Number(s.market_rate_local_premium_pct) || 0,
      metals,
    });

    if (!result.rates.length) {
      await conn.rollback();
      return res.status(422).json({ status: 'error', message: 'No rates fetched', errors: result.errors });
    }

    await publishRates(conn, tid(req), uid(req), result.rates);
    await conn.commit();
    res.json({ status: 'success', data: { published: result.rates.length, errors: result.errors, fetchedAt: result.fetchedAt } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

module.exports = router;
