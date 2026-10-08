/**
 * Savings / instalment scheme routes — /api/savings-schemes
 * Jewelry-only (chit-style gold schemes).
 *
 *   GET    /plans                    list scheme plans
 *   POST   /plans                    create a scheme plan
 *   PUT    /plans/:id                edit / toggle active
 *   GET    /enrollments              list enrollments (?status=&customer_id=&q=)
 *   GET    /enrollments/:id          enrollment + payments + maturity value
 *   POST   /enrollments              enroll a customer
 *   POST   /enrollments/:id/payments record an instalment
 *   POST   /enrollments/:id/status   mature / redeem / cancel
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const requireIndustry = require('../middleware/requireIndustry');
const inst = require('../services/installmentService');
const moneyPosting = require('../services/moneyPostingService');

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
const uid = (req) => req.user?.id || null;

router.use(authenticate);
router.use(requireTenantId);
router.use(requireIndustry(['jewelry']));

/* ── enrollment number sequence ─────────────────────────────────────────────── */
async function nextEnrollmentNo(conn, tenantId) {
  await conn.query(
    'INSERT INTO savings_scheme_sequences (tenant_id, `last_value`) VALUES (?, 1) '
    + 'ON DUPLICATE KEY UPDATE `last_value` = `last_value` + 1',
    [tenantId]
  );
  const [[row]] = await conn.query(
    'SELECT `last_value` FROM savings_scheme_sequences WHERE tenant_id = ?',
    [tenantId]
  );
  return `SC-${String(row.last_value).padStart(5, '0')}`;
}

/* ── valid status transitions ────────────────────────────────────────────────── */
const TRANSITIONS = {
  active:    ['matured', 'cancelled'],
  matured:   ['redeemed', 'cancelled'],
  redeemed:  [],
  cancelled: [],
};

/* ════════════════════════════════════════════════════════════════════════════════
   PLANS
════════════════════════════════════════════════════════════════════════════════ */

/* GET /plans */
router.get('/plans', async (req, res) => {
  try {
    const includeInactive = req.query.all === '1';
    const params = [tid(req)];
    let sql = 'SELECT * FROM savings_scheme_plans WHERE tenant_id = ?';
    if (!includeInactive) { sql += ' AND is_active = 1'; }
    sql += ' ORDER BY name';
    const [rows] = await pool.execute(sql, params);
    res.json({ status: 'success', data: rows });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* POST /plans */
router.post('/plans', async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ status: 'error', message: 'name required' });
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO savings_scheme_plans
        (id, tenant_id, name, accrual_type, installment_amount, duration_months,
         bonus_type, bonus_value, terms, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,1)`,
      [
        id, tid(req), b.name,
        b.accrual_type    || 'amount',
        b.installment_amount != null ? Number(b.installment_amount) : null,
        Number(b.duration_months) || 11,
        b.bonus_type      || 'none',
        Number(b.bonus_value) || 0,
        b.terms           ?? null,
      ]
    );
    res.status(201).json({ status: 'success', data: { id } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* PUT /plans/:id */
router.put('/plans/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const sets = [], vals = [];

    if (b.name           != null) { sets.push('name = ?');               vals.push(b.name); }
    if (b.accrual_type   != null) { sets.push('accrual_type = ?');       vals.push(b.accrual_type); }
    if (b.installment_amount !== undefined) {
      sets.push('installment_amount = ?');
      vals.push(b.installment_amount != null ? Number(b.installment_amount) : null);
    }
    if (b.duration_months!= null) { sets.push('duration_months = ?');    vals.push(Number(b.duration_months)); }
    if (b.bonus_type     != null) { sets.push('bonus_type = ?');         vals.push(b.bonus_type); }
    if (b.bonus_value    != null) { sets.push('bonus_value = ?');        vals.push(Number(b.bonus_value)); }
    if (b.terms          !== undefined) { sets.push('terms = ?');        vals.push(b.terms ?? null); }
    if (b.is_active      != null) { sets.push('is_active = ?');          vals.push(b.is_active ? 1 : 0); }

    if (sets.length === 0) return res.status(400).json({ status: 'error', message: 'Nothing to update' });

    vals.push(req.params.id, tid(req));
    const [r] = await pool.execute(
      `UPDATE savings_scheme_plans SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
      vals
    );
    if (!r.affectedRows) return res.status(404).json({ status: 'error', message: 'not found' });
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* ════════════════════════════════════════════════════════════════════════════════
   ENROLLMENTS
════════════════════════════════════════════════════════════════════════════════ */

/* GET /enrollments
 * Server-side search + pagination, matching the pattern used by
 * salesReturnController.js's getAllReturns / salesController.js's
 * searchSales — search now also matches customer phone/email, not just
 * enrollment number / customer name / plan name, so the Sales Hub's
 * "Collect Payment" quick action (which looks a customer up by phone or
 * email as often as by name) can reuse this same endpoint instead of a
 * separate /search route. */
router.get('/enrollments', async (req, res) => {
  try {
    const params = [tid(req)];
    let sql = `
      SELECT e.*,
             p.name           AS plan_name,
             p.accrual_type,
             p.bonus_type,
             p.bonus_value,
             p.duration_months,
             p.installment_amount,
             c.first_name     AS customer_first_name,
             c.last_name      AS customer_last_name,
             c.phone_number   AS customer_phone,
             c.email          AS customer_email
        FROM savings_scheme_enrollments e
        JOIN savings_scheme_plans  p ON p.id = e.plan_id
        LEFT JOIN customers        c ON c.id = e.customer_id
       WHERE e.tenant_id = ?`;

    if (req.query.status)      { sql += ' AND e.status = ?';       params.push(req.query.status); }
    if (req.query.customer_id) { sql += ' AND e.customer_id = ?';  params.push(req.query.customer_id); }
    if (req.query.q) {
      sql += ` AND (
        e.enrollment_no LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?
        OR p.name LIKE ? OR c.phone_number LIKE ? OR c.email LIKE ?
        OR CONCAT(c.first_name, ' ', c.last_name) LIKE ?
      )`;
      const like = `%${req.query.q}%`;
      params.push(like, like, like, like, like, like, like);
    }

    const countSql = sql.replace(
      /SELECT e\.\*[\s\S]*?FROM savings_scheme_enrollments e/,
      'SELECT COUNT(*) AS total FROM savings_scheme_enrollments e'
    );
    const [[{ total }]] = await pool.execute(countSql, params);

    sql += ' ORDER BY e.created_at DESC';

    const hasPaging = req.query.page != null || req.query.limit != null;
    let limit = null, offset = 0;
    if (hasPaging) {
      limit  = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      offset = (page - 1) * limit;
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }

    const [rows] = await pool.execute(sql, params);

    if (hasPaging) {
      // Nested under `data` (not sibling to it) — fetchApi's { status, data }
      // unwrapping (frontend/src/services/api.ts) returns only the `data`
      // field, so a sibling `pagination` key would silently disappear on
      // the client. Nesting both inside `data` is what survives the unwrap
      // intact (see listEnrollmentsPaged in jewelryOpsService.ts).
      res.json({
        status: 'success',
        data: {
          data: rows,
          pagination: {
            total,
            page: Math.floor(offset / limit) + 1,
            pages: Math.max(Math.ceil(total / limit), 1),
            limit,
          },
        },
      });
    } else {
      res.json({ status: 'success', data: rows });
    }
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* GET /enrollments/:id */
router.get('/enrollments/:id', async (req, res) => {
  try {
    const [[e]] = await pool.query(
      `SELECT e.*,
              p.name              AS plan_name,
              p.accrual_type,
              p.bonus_type,
              p.bonus_value,
              p.duration_months,
              p.installment_amount,
              c.first_name        AS customer_first_name,
              c.last_name         AS customer_last_name,
              c.phone_number      AS customer_phone,
              c.email             AS customer_email
         FROM savings_scheme_enrollments e
         JOIN savings_scheme_plans  p ON p.id = e.plan_id
         LEFT JOIN customers        c ON c.id = e.customer_id
        WHERE e.id = ? AND e.tenant_id = ?`,
      [req.params.id, tid(req)]
    );
    if (!e) return res.status(404).json({ status: 'error', message: 'not found' });

    const [payments] = await pool.execute(
      'SELECT * FROM savings_scheme_payments WHERE enrollment_id = ? ORDER BY installment_no',
      [req.params.id]
    );
    const maturity = inst.schemeMaturityValue({
      totalPaid: e.total_paid,
      paidInstallments: e.paid_installments,
      bonusType: e.bonus_type,
      bonusValue: e.bonus_value,
    });
    res.json({ status: 'success', data: { ...e, payments, ...maturity } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* POST /enrollments */
router.post('/enrollments', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const b = req.body || {};
    if (!b.plan_id || !b.customer_id) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'plan_id and customer_id required' });
    }

    const [[plan]] = await conn.query(
      'SELECT * FROM savings_scheme_plans WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [b.plan_id, tid(req)]
    );
    if (!plan) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'unknown or inactive plan' });
    }

    const start   = b.start_date ? new Date(b.start_date) : new Date();
    const matDate = new Date(start);
    matDate.setMonth(matDate.getMonth() + (Number(plan.duration_months) || 11));

    const id  = uuidv4();
    const no  = await nextEnrollmentNo(conn, tid(req));

    await conn.query(
      `INSERT INTO savings_scheme_enrollments
        (id, tenant_id, store_id, plan_id, enrollment_no, customer_id,
         employee_id, start_date, maturity_date, status, notes)
       VALUES (?,?,?,?,?,?,?,?,?,'active',?)`,
      [
        id, tid(req),
        b.store_id    ?? req.user?.store_id ?? null,
        b.plan_id,
        no,
        b.customer_id,
        b.employee_id ?? null,
        start.toISOString().slice(0, 10),
        matDate.toISOString().slice(0, 10),
        b.notes ?? null,
      ]
    );

    await conn.commit();
    res.status(201).json({
      status: 'success',
      data: { id, enrollment_no: no, maturity_date: matDate.toISOString().slice(0, 10) },
    });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

/* POST /enrollments/:id/payments */
router.post('/enrollments/:id/payments', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[e]] = await conn.query(
      `SELECT e.*, p.accrual_type, p.duration_months
         FROM savings_scheme_enrollments e
         JOIN savings_scheme_plans p ON p.id = e.plan_id
        WHERE e.id = ? AND e.tenant_id = ?`,
      [req.params.id, tid(req)]
    );
    if (!e) { await conn.rollback(); return res.status(404).json({ status: 'error', message: 'not found' }); }
    if (e.status !== 'active') {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: `Cannot record payment on a ${e.status} enrollment` });
    }

    let accrual;
    try {
      accrual = inst.accrueSchemeInstallment({
        amount:      req.body?.amount,
        accrualType: e.accrual_type,
        metalRate:   req.body?.metal_rate,
      });
    } catch (ve) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: ve.message });
    }

    const nextNo      = Number(e.paid_installments) + 1;
    const totalPaid   = inst.round2(Number(e.total_paid) + accrual.amount);
    const totalWeight = inst.round3(Number(e.total_weight) + (accrual.weightCredited || 0));
    const matured     = nextNo >= Number(e.duration_months);
    const newStatus   = matured ? 'matured' : e.status;

    const payRowId = uuidv4();
    await conn.query(
      `INSERT INTO savings_scheme_payments
        (id, tenant_id, enrollment_id, installment_no, amount, metal_rate,
         weight_credited, payment_method, reference, received_by_user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        payRowId, tid(req), req.params.id, nextNo, accrual.amount,
        req.body?.metal_rate   ?? null,
        accrual.weightCredited,
        req.body?.payment_method ?? null,
        req.body?.reference     ?? null,
        uid(req),
      ]
    );

    // Ledger: Dr tender / Cr savings-scheme deferred revenue.
    const dr = await moneyPosting.tenderAccountId(conn, tid(req), req.body?.payment_method, 'in');
    const cr = await moneyPosting.resolveAccountId(tid(req), 'event:savings_liability', conn);
    if (!dr || !cr) { await conn.rollback(); return res.status(500).json({ status: 'error', message: 'Ledger posting failed: money account(s) missing' }); }
    const payAmt = inst.round2(accrual.amount);
    await moneyPosting.postEntry({
      tenantId: tid(req), sourceType: 'savings_payment', sourceId: payRowId,
      memo: `Savings scheme installment #${nextNo}`, createdBy: uid(req),
      lines: [
        { accountId: dr, debit: payAmt, credit: 0, memo: `Tender — ${req.body?.payment_method || 'unspecified'}`, customerId: e.customer_id || null },
        { accountId: cr, debit: 0, credit: payAmt, memo: 'Savings scheme deferred revenue', customerId: e.customer_id || null },
      ],
    }, conn);

    await conn.query(
      `UPDATE savings_scheme_enrollments
          SET paid_installments = ?, total_paid = ?, total_weight = ?, status = ?
        WHERE id = ?`,
      [nextNo, totalPaid, totalWeight, newStatus, req.params.id]
    );

    await conn.commit();
    res.json({ status: 'success', data: { installmentNo: nextNo, totalPaid, totalWeight, matured } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

/* POST /enrollments/:id/status */
router.post('/enrollments/:id/status', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { status, redeemed_sale_id } = req.body || {};

    const validStatuses = ['active', 'matured', 'redeemed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      await conn.rollback(); return res.status(400).json({ status: 'error', message: 'invalid status' });
    }

    const [[existing]] = await conn.query(
      'SELECT id, status, total_paid, store_id, customer_id, enrollment_no FROM savings_scheme_enrollments WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [req.params.id, tid(req)]
    );
    if (!existing) { await conn.rollback(); return res.status(404).json({ status: 'error', message: 'not found' }); }

    const allowed = TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(status)) {
      await conn.rollback();
      return res.status(400).json({
        status: 'error',
        message: `Cannot transition from "${existing.status}" to "${status}"`,
      });
    }

    const sets = ['status = ?'];
    const vals = [status];

    if (status === 'redeemed' && redeemed_sale_id) {
      sets.push('redeemed_sale_id = ?');
      vals.push(redeemed_sale_id);
    }

    vals.push(req.params.id, tid(req));
    const [r] = await conn.query(
      `UPDATE savings_scheme_enrollments SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`,
      vals
    );
    if (!r.affectedRows) { await conn.rollback(); return res.status(404).json({ status: 'error', message: 'not found' }); }

    // Relieve the deferred-revenue liability when cancelling a paid scheme.
    //   refund (default): Dr SAVDEF / Cr refund tender (body.refundMethod,
    //                     default cash). body.forfeit=true books it as
    //                     forfeited-deposit income instead.
    if (status === 'cancelled') {
      const paid = Math.round(Number(existing.total_paid || 0) * 100) / 100;
      if (paid > 0) {
        const forfeit = req.body?.forfeit === true;
        const dr = await moneyPosting.resolveAccountId(tid(req), 'event:savings_liability', conn);
        const cr = forfeit
          ? (await moneyPosting.resolveAccountId(tid(req), 'event:forfeited_deposits', conn)
              || await moneyPosting.resolveAccountId(tid(req), 'event:revenue', conn))
          : await moneyPosting.tenderAccountId(conn, tid(req), req.body?.refundMethod || 'cash', 'out');
        if (!dr || !cr) { await conn.rollback(); return res.status(500).json({ status: 'error', message: 'Ledger posting failed: money account(s) missing' }); }
        await moneyPosting.postEntry({
          tenantId: tid(req), storeId: existing.store_id || null,
          sourceType: 'savings_cancel', sourceId: existing.id,
          memo: `Savings enrollment ${existing.enrollment_no || existing.id} cancelled — ${forfeit ? 'deposit forfeited' : 'deposit refunded'}`,
          createdBy: uid(req),
          lines: [
            { accountId: dr, debit: paid, credit: 0, memo: 'Relieve savings deferred revenue', customerId: existing.customer_id || null },
            { accountId: cr, debit: 0, credit: paid, memo: forfeit ? 'Forfeited deposit income' : `Refund — ${req.body?.refundMethod || 'cash'}`, customerId: existing.customer_id || null },
          ],
        }, conn);
      }
    }

    await conn.commit();
    res.json({ status: 'success' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

module.exports = router;
