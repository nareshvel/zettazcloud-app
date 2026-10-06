/**
 * Old-gold / metal exchange routes
 * Base path: /api/old-gold
 *
 *   GET    /           list purchases (optional ?status=, ?q= search)
 *   GET    /:id        one purchase (joins customer)
 *   POST   /preview    compute valuation without saving
 *   POST   /           create (auto voucher no + valuation)
 *   PUT    /:id        update a valued record (rate, notes, etc.)
 *   POST   /:id/status change status with transition validation
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool }       = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const requireIndustry = require('../middleware/requireIndustry');
const oldGold = require('../services/oldGoldService');

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
const uid = (req) => req.user?.id || null;

router.use(authenticate);
router.use(requireTenantId);
router.use(requireIndustry(['jewelry']));

/* ── voucher sequence ──────────────────────────────────────────────────────── */
async function nextVoucherNo(conn, tenantId) {
  await conn.query(
    'INSERT INTO old_gold_voucher_sequences (tenant_id, `last_value`) VALUES (?, 1) '
    + 'ON DUPLICATE KEY UPDATE `last_value` = `last_value` + 1',
    [tenantId]
  );
  const [[row]] = await conn.query(
    'SELECT `last_value` FROM old_gold_voucher_sequences WHERE tenant_id = ?',
    [tenantId]
  );
  return `OG-${String(row.last_value).padStart(5, '0')}`;
}

/* ── valuation helper ──────────────────────────────────────────────────────── */
function valuationParams(b) {
  return {
    grossWeight:    b.gross_weight,
    stoneDeduction: b.stone_deduction,
    purityPct:      b.purity_pct,
    netWeight:      b.net_weight,
    ratePerGram:    b.rate_per_gram,
    amountDeduction: b.amount_deduction,
  };
}

/* ── valid status transitions ──────────────────────────────────────────────── */
const TRANSITIONS = {
  valued:    ['credited', 'cancelled'],
  credited:  ['redeemed', 'cancelled'],
  redeemed:  [],
  cancelled: [],
};

/* ── GET / ─────────────────────────────────────────────────────────────────── */
// Server-side search (voucher no / customer name / email / phone) + pagination,
// following the same pattern as salesReturnController.js's getAllReturns
// (LEFT JOIN customers, count query + paginated data query). `q` is kept as an
// accepted alias for `search` for backward compatibility with any existing caller.
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, sortBy = 'created_at', sortOrder = 'desc' } = req.query;
    const search = req.query.search || req.query.q || '';

    const allowedSortBy = new Set(['created_at', 'valuation_amount', 'status', 'voucher_no']);
    const safeSortBy = allowedSortBy.has(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    let query = `
        FROM old_gold_purchases g
        LEFT JOIN customers c ON c.id = g.customer_id
       WHERE g.tenant_id = ?`;
    const params = [tid(req)];

    if (status) { query += ' AND g.status = ?'; params.push(status); }
    if (search) {
      query += ` AND (
        g.voucher_no LIKE ?
        OR CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?
        OR c.email LIKE ?
        OR c.phone_number LIKE ?
      )`;
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${query}`, params);

    const pageNum  = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 20, 1);
    const offset    = (pageNum - 1) * limitNum;

    const dataSql = `
      SELECT g.*,
             c.first_name AS customer_first_name,
             c.last_name  AS customer_last_name,
             c.phone_number AS customer_phone,
             c.email      AS customer_email
      ${query}
      ORDER BY g.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(dataSql, [...params, limitNum, offset]);

    res.json({
      status: 'success',
      data: rows,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* ── GET /:id ──────────────────────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT g.*,
              c.first_name AS customer_first_name,
              c.last_name  AS customer_last_name,
              c.phone_number AS customer_phone,
              c.email      AS customer_email
         FROM old_gold_purchases g
         LEFT JOIN customers c ON c.id = g.customer_id
        WHERE g.id = ? AND g.tenant_id = ?`,
      [req.params.id, tid(req)]
    );
    if (!row) return res.status(404).json({ status: 'error', message: 'not found' });
    res.json({ status: 'success', data: row });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* ── POST /preview ─────────────────────────────────────────────────────────── */
router.post('/preview', (req, res) => {
  try {
    res.json({ status: 'success', data: oldGold.computeValuation(valuationParams(req.body || {})) });
  } catch (e) { res.status(400).json({ status: 'error', message: e.message }); }
});

/* ── POST / ────────────────────────────────────────────────────────────────── */
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const b = req.body || {};

    let valuation;
    try { valuation = oldGold.computeValuation(valuationParams(b)); }
    catch (ve) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: ve.message });
    }

    const id        = uuidv4();
    const voucherNo = await nextVoucherNo(conn, tid(req));

    await conn.query(
      `INSERT INTO old_gold_purchases
        (id, tenant_id, store_id, voucher_no, customer_id, employee_id,
         item_description,
         metal, purity_label, purity_pct,
         claimed_purity_label, claimed_purity_pct, test_method,
         gross_weight, stone_deduction, net_weight,
         rate_per_gram, amount_deduction, valuation_amount,
         status, voucher_type, payment_mode,
         notes, created_by_user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, tid(req),
        b.store_id ?? req.user?.store_id ?? null,
        voucherNo,
        b.customer_id   ?? null,
        b.employee_id   ?? null,
        b.item_description ?? null,
        b.metal         ?? 'Gold',
        b.purity_label  ?? null,
        b.purity_pct    ?? null,
        b.claimed_purity_label ?? b.purity_label ?? null,
        b.claimed_purity_pct   ?? b.purity_pct   ?? null,
        b.test_method   ?? 'visual',
        b.gross_weight,
        b.stone_deduction ?? 0,
        valuation.netWeight,
        b.rate_per_gram,
        b.amount_deduction ?? 0,
        valuation.valuationAmount,
        'valued',
        b.voucher_type  ?? 'credit',
        b.payment_mode  ?? null,
        b.notes         ?? null,
        uid(req),
      ]
    );

    await conn.commit();
    res.status(201).json({ status: 'success', data: { id, voucher_no: voucherNo, ...valuation } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

/* ── PUT /:id ──────────────────────────────────────────────────────────────── */
router.put('/:id', async (req, res) => {
  try {
    const [[existing]] = await pool.query(
      'SELECT status FROM old_gold_purchases WHERE id = ? AND tenant_id = ?',
      [req.params.id, tid(req)]
    );
    if (!existing) return res.status(404).json({ status: 'error', message: 'not found' });
    if (existing.status !== 'valued') {
      return res.status(400).json({ status: 'error', message: 'Only valued records can be edited' });
    }

    const b = req.body || {};

    // Re-compute valuation with updated fields
    let valuation;
    try { valuation = oldGold.computeValuation(valuationParams(b)); }
    catch (ve) { return res.status(400).json({ status: 'error', message: ve.message }); }

    await pool.execute(
      `UPDATE old_gold_purchases SET
         customer_id          = ?,
         item_description     = ?,
         metal                = ?,
         purity_label         = ?,
         purity_pct           = ?,
         claimed_purity_label = ?,
         claimed_purity_pct   = ?,
         test_method          = ?,
         gross_weight         = ?,
         stone_deduction      = ?,
         net_weight           = ?,
         rate_per_gram        = ?,
         amount_deduction     = ?,
         valuation_amount     = ?,
         voucher_type         = ?,
         payment_mode         = ?,
         notes                = ?
       WHERE id = ? AND tenant_id = ?`,
      [
        b.customer_id          ?? null,
        b.item_description     ?? null,
        b.metal                ?? 'Gold',
        b.purity_label         ?? null,
        b.purity_pct           ?? null,
        b.claimed_purity_label ?? null,
        b.claimed_purity_pct   ?? null,
        b.test_method          ?? 'visual',
        b.gross_weight,
        b.stone_deduction      ?? 0,
        valuation.netWeight,
        b.rate_per_gram,
        b.amount_deduction     ?? 0,
        valuation.valuationAmount,
        b.voucher_type         ?? 'credit',
        b.payment_mode         ?? null,
        b.notes                ?? null,
        req.params.id, tid(req),
      ]
    );
    res.json({ status: 'success', data: { ...valuation } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* ── POST /:id/status ──────────────────────────────────────────────────────── */
router.post('/:id/status', async (req, res) => {
  try {
    const { status, redeemed_sale_id } = req.body || {};
    const validStatuses = ['valued', 'credited', 'redeemed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ status: 'error', message: 'invalid status' });
    }

    const [[existing]] = await pool.query(
      'SELECT status FROM old_gold_purchases WHERE id = ? AND tenant_id = ?',
      [req.params.id, tid(req)]
    );
    if (!existing) return res.status(404).json({ status: 'error', message: 'not found' });

    const allowed = TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot transition from "${existing.status}" to "${status}"`,
      });
    }

    const sets = ['status = ?'];
    const vals = [status];

    if (status === 'credited')  { sets.push('credited_at = NOW()'); }
    if (status === 'redeemed') {
      sets.push('redeemed_at = NOW()');
      if (redeemed_sale_id) { sets.push('redeemed_sale_id = ?'); vals.push(redeemed_sale_id); }
    }

    vals.push(req.params.id, tid(req));
    const [r] = await pool.execute(
      `UPDATE old_gold_purchases SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
      vals
    );
    if (!r.affectedRows) return res.status(404).json({ status: 'error', message: 'not found' });
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

module.exports = router;
