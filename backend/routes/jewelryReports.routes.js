/**
 * Jewelry-specific reports — /api/jewelry-reports
 *
 *   GET /purity-valuation   stock value grouped by metal + purity
 *   GET /piece-status       serialized piece counts/value by status
 *   GET /old-gold-summary   old-gold intake totals by period
 */

'use strict';

const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const requireIndustry = require('../middleware/requireIndustry');

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];

router.use(authenticate);
router.use(requireTenantId);
router.use(requireIndustry(['jewelry']));

/**
 * Purity-wise stock valuation.
 * Serialized pieces carry their own purity/weight, so they're the accurate source.
 * Falls back to the product's `attributes` JSON for non-serialized stock.
 */
router.get('/purity-valuation', async (req, res) => {
  try {
    const [pieces] = await pool.execute(
      `SELECT COALESCE(NULLIF(p.purity, ''), 'Unspecified') AS purity,
              COUNT(*)                       AS piece_count,
              COALESCE(SUM(p.gross_weight),0) AS gross_weight,
              COALESCE(SUM(p.net_weight),0)   AS net_weight,
              COALESCE(SUM(p.cost_price),0)   AS cost_value,
              COALESCE(SUM(p.selling_price),0) AS retail_value
         FROM product_pieces p
        WHERE p.tenant_id = ? AND p.status = 'available'
        GROUP BY COALESCE(NULLIF(p.purity, ''), 'Unspecified')
        ORDER BY purity`,
      [tid(req)]
    );

    const [nonSerialized] = await pool.execute(
      `SELECT COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(pr.attributes,'$.purity')), 'null'), 'Unspecified') AS purity,
              COUNT(*) AS product_count,
              COALESCE(SUM(pr.stock_quantity),0) AS units,
              COALESCE(SUM(pr.stock_quantity * COALESCE(pr.cost_price,0)),0) AS cost_value,
              COALESCE(SUM(pr.stock_quantity * COALESCE(pr.price,0)),0)      AS retail_value
         FROM products pr
        WHERE pr.tenant_id = ? AND pr.is_active = 1 AND COALESCE(pr.is_serialized,0) = 0
        GROUP BY purity
        ORDER BY purity`,
      [tid(req)]
    );

    const totals = {
      serialized_cost: pieces.reduce((s, r) => s + Number(r.cost_value), 0),
      serialized_retail: pieces.reduce((s, r) => s + Number(r.retail_value), 0),
      non_serialized_cost: nonSerialized.reduce((s, r) => s + Number(r.cost_value), 0),
      non_serialized_retail: nonSerialized.reduce((s, r) => s + Number(r.retail_value), 0),
      net_weight: pieces.reduce((s, r) => s + Number(r.net_weight), 0),
    };
    totals.total_cost = Math.round((totals.serialized_cost + totals.non_serialized_cost) * 100) / 100;
    totals.total_retail = Math.round((totals.serialized_retail + totals.non_serialized_retail) * 100) / 100;

    res.json({ status: 'success', data: { serialized: pieces, nonSerialized, totals } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.get('/piece-status', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT status, COUNT(*) AS count,
              COALESCE(SUM(cost_price),0) AS cost_value,
              COALESCE(SUM(net_weight),0) AS net_weight
         FROM product_pieces
        WHERE tenant_id = ?
        GROUP BY status`,
      [tid(req)]
    );
    res.json({ status: 'success', data: rows });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.get('/old-gold-summary', async (req, res) => {
  try {
    const { from, to } = req.query;
    const params = [tid(req)];
    let sql = `SELECT metal, COALESCE(purity_label,'Unspecified') AS purity,
                      COUNT(*) AS vouchers,
                      COALESCE(SUM(gross_weight),0) AS gross_weight,
                      COALESCE(SUM(net_weight),0)   AS net_weight,
                      COALESCE(SUM(valuation_amount),0) AS total_paid
                 FROM old_gold_purchases
                WHERE tenant_id = ? AND status <> 'cancelled'`;
    if (from) { sql += ' AND created_at >= ?'; params.push(from); }
    if (to) { sql += ' AND created_at < DATE_ADD(?, INTERVAL 1 DAY)'; params.push(to); }
    sql += ' GROUP BY metal, purity ORDER BY metal, purity';
    const [rows] = await pool.execute(sql, params);
    res.json({ status: 'success', data: rows });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

module.exports = router;
