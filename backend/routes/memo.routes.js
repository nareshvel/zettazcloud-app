/**
 * Memo / consignment routes — /api/memos
 *
 *   GET    /            list (?direction=in|out &status= &q=)
 *   GET    /:id         memo + items (with product/piece info)
 *   POST   /            create memo with items
 *   PUT    /:id         edit notes / due_date / total_value
 *   POST   /:id/return  return some/all items back
 *   POST   /:id/status  set status with transition guard
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
const uid = (req) => req.user?.id || null;

router.use(authenticate);
router.use(requireTenantId);

/* ─── status transitions ─────────────────────────────────────────────────── */
const TRANSITIONS = {
  open:               ['partially_returned', 'returned', 'purchased', 'sold', 'cancelled'],
  partially_returned: ['returned', 'purchased', 'sold', 'cancelled'],
  returned:           ['cancelled'],
  purchased:          [],
  sold:               [],
  cancelled:          [],
};

/* ─── helpers ────────────────────────────────────────────────────────────── */
async function nextMemoNo(conn, tenantId) {
  await conn.query(
    'INSERT INTO memo_sequences (tenant_id, `last_value`) VALUES (?, 1) '
    + 'ON DUPLICATE KEY UPDATE `last_value` = `last_value` + 1', [tenantId]
  );
  const [[row]] = await conn.query('SELECT `last_value` FROM memo_sequences WHERE tenant_id = ?', [tenantId]);
  return `MM-${String(row.last_value).padStart(5, '0')}`;
}

/* ─── GET / ──────────────────────────────────────────────────────────────── */
/* Server-side search + pagination, following the same pattern as
   salesReturnController.js's getAllReturns: LEFT JOIN customers/suppliers,
   search across memo #/party name/email/phone, page+limit → { data, pagination }. */
router.get('/', async (req, res) => {
  try {
    const params = [tid(req)];
    let where = `
        FROM memo_transactions m
        LEFT JOIN suppliers s ON s.id = m.supplier_id
        LEFT JOIN customers c ON c.id = m.customer_id
       WHERE m.tenant_id = ?`;

    if (req.query.direction) { where += ' AND m.direction = ?'; params.push(req.query.direction); }
    if (req.query.status)    { where += ' AND m.status = ?';    params.push(req.query.status); }
    if (req.query.overdue === '1' || req.query.overdue === 'true') {
      where += " AND m.status = 'open' AND m.due_date IS NOT NULL AND m.due_date < CURDATE()";
    }
    const search = req.query.q || req.query.search;
    if (search) {
      const like = `%${search}%`;
      where += ` AND (m.memo_no LIKE ? OR s.supplier_name LIKE ?
                    OR c.first_name LIKE ? OR c.last_name LIKE ?
                    OR c.email LIKE ? OR c.phone_number LIKE ? OR m.notes LIKE ?)`;
      params.push(like, like, like, like, like, like, like);
    }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${where}`, params);

    const page  = Math.max(parseInt(req.query.page, 10)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
    const offset = (page - 1) * limit;

    const sql = `
      SELECT m.*,
             s.supplier_name,
             c.first_name AS customer_first_name,
             c.last_name  AS customer_last_name,
             c.phone_number AS customer_phone,
             c.email AS customer_email,
             (SELECT COUNT(*) FROM memo_items mi WHERE mi.memo_id = m.id) AS item_count,
             (SELECT COUNT(*) FROM memo_items mi WHERE mi.memo_id = m.id AND mi.status = 'returned') AS returned_count
      ${where}
      ORDER BY m.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`;

    const [rows] = await pool.execute(sql, params);
    res.json({
      status: 'success',
      data: {
        data: rows,
        pagination: { total, page, limit, pages: Math.max(Math.ceil(total / limit), 1) },
      },
    });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* ─── GET /stats ─────────────────────────────────────────────────────────── */
router.get('/stats', async (req, res) => {
  try {
    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'open') AS open_count,
         SUM(status = 'partially_returned') AS partial_count,
         SUM(status = 'returned') AS returned_count,
         SUM(status = 'open' AND due_date IS NOT NULL AND due_date < CURDATE()) AS overdue_count,
         SUM(CASE WHEN direction = 'out' AND status IN ('open','partially_returned') THEN total_value ELSE 0 END) AS value_out,
         SUM(CASE WHEN direction = 'in'  AND status IN ('open','partially_returned') THEN total_value ELSE 0 END) AS value_in
       FROM memo_transactions
       WHERE tenant_id = ?`,
      [tid(req)]
    );
    res.json({ status: 'success', data: stats });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* ─── GET /:id ───────────────────────────────────────────────────────────── */
router.get('/:id', async (req, res) => {
  try {
    const [[memo]] = await pool.query(
      `SELECT m.*,
              s.supplier_name,
              c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              c.phone_number AS customer_phone, c.email AS customer_email
         FROM memo_transactions m
         LEFT JOIN suppliers s ON s.id = m.supplier_id
         LEFT JOIN customers c ON c.id = m.customer_id
        WHERE m.id = ? AND m.tenant_id = ?`,
      [req.params.id, tid(req)]
    );
    if (!memo) return res.status(404).json({ status: 'error', message: 'not found' });

    const [items] = await pool.execute(
      `SELECT mi.*,
              p.name  AS product_name,
              p.sku   AS product_sku,
              pp.piece_code, pp.barcode, pp.purity, pp.gross_weight, pp.net_weight
         FROM memo_items mi
         LEFT JOIN products      p  ON p.id  = mi.product_id
         LEFT JOIN product_pieces pp ON pp.id = mi.piece_id
        WHERE mi.memo_id = ?
        ORDER BY mi.id ASC`,
      [req.params.id]
    );
    res.json({ status: 'success', data: { ...memo, items } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* ─── POST / (create) ────────────────────────────────────────────────────── */
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const b = req.body || {};
    if (!b.direction || !['in', 'out'].includes(b.direction)) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'direction must be in|out' });
    }
    const items = Array.isArray(b.items) ? b.items : [];
    if (!items.length) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'at least one item required' });
    }

    const id = uuidv4();
    const memoNo = await nextMemoNo(conn, tid(req));
    const partyType = b.direction === 'in' ? 'supplier' : 'customer';
    const total = items.reduce((sum, it) => {
      const qty  = Number(it.quantity) || 1;
      const unit = Number(it.unit_value) || 0;
      return sum + (Number(it.line_value) || qty * unit);
    }, 0);

    await conn.query(
      `INSERT INTO memo_transactions
        (id, tenant_id, store_id, memo_no, direction, party_type,
         supplier_id, customer_id, employee_id,
         issue_date, due_date, status, total_value, notes, created_by_user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, tid(req), b.store_id ?? req.user?.store_id ?? null,
        memoNo, b.direction, partyType,
        b.supplier_id ?? null, b.customer_id ?? null, b.employee_id ?? null,
        b.issue_date ?? new Date().toISOString().slice(0, 10),
        b.due_date ?? null, 'open',
        Math.round(total * 100) / 100,
        b.notes ?? null, uid(req),
      ]
    );

    for (const it of items) {
      const qty  = Number(it.quantity)   || 1;
      const unit = Number(it.unit_value) || 0;
      const line = Number(it.line_value) || Math.round(qty * unit * 100) / 100;
      await conn.query(
        `INSERT INTO memo_items
          (id, tenant_id, memo_id, product_id, piece_id,
           description, quantity, unit_value, line_value, status)
         VALUES (?,?,?,?,?,?,?,?,?,'held')`,
        [
          uuidv4(), tid(req), id,
          it.product_id ?? null, it.piece_id ?? null,
          it.description || 'Item',
          qty, unit, line,
        ]
      );
      // Serialized piece going out → put on hold
      if (it.piece_id && b.direction === 'out') {
        await conn.query(
          "UPDATE product_pieces SET status = 'hold' WHERE id = ? AND tenant_id = ?",
          [it.piece_id, tid(req)]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ status: 'success', data: { id, memo_no: memoNo } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

/* ─── PUT /:id (edit) ────────────────────────────────────────────────────── */
router.put('/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const allowed = ['due_date', 'notes', 'employee_id'];
    const sets = [], vals = [];
    for (const f of allowed) {
      if (b[f] !== undefined) { sets.push(`${f} = ?`); vals.push(b[f]); }
    }
    if (!sets.length) return res.status(400).json({ status: 'error', message: 'nothing to update' });
    vals.push(req.params.id, tid(req));
    await pool.execute(
      `UPDATE memo_transactions SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals
    );
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

/* ─── POST /:id/return ───────────────────────────────────────────────────── */
router.post('/:id/return', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const returns = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!returns.length) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'items required' });
    }

    for (const r of returns) {
      const [[item]] = await conn.query(
        'SELECT * FROM memo_items WHERE id = ? AND memo_id = ? AND tenant_id = ?',
        [r.item_id, req.params.id, tid(req)]
      );
      if (!item) continue;

      const remaining = Number(item.quantity) - Number(item.returned_quantity);
      if (remaining <= 0) continue; // already fully returned

      const qty = Math.min(Math.abs(Number(r.quantity) || remaining), remaining);
      const newReturned = Number(item.returned_quantity) + qty;
      const fullyReturned = newReturned >= Number(item.quantity);

      await conn.query(
        'UPDATE memo_items SET returned_quantity = ?, status = ? WHERE id = ?',
        [newReturned, fullyReturned ? 'returned' : 'held', item.id]
      );

      // Free the serialized piece ONLY when fully returned
      if (item.piece_id && fullyReturned) {
        await conn.query(
          "UPDATE product_pieces SET status = 'available' WHERE id = ? AND tenant_id = ?",
          [item.piece_id, tid(req)]
        );
      }
    }

    // Recompute memo status from items
    const [[agg]] = await conn.query(
      `SELECT COUNT(*) AS total,
              SUM(status = 'returned') AS returned,
              SUM(status = 'held')     AS held
         FROM memo_items WHERE memo_id = ?`,
      [req.params.id]
    );
    let newStatus;
    if (Number(agg.returned) === 0)                       newStatus = 'open';
    else if (Number(agg.returned) < Number(agg.total))    newStatus = 'partially_returned';
    else                                                   newStatus = 'returned';

    await conn.query(
      'UPDATE memo_transactions SET status = ? WHERE id = ? AND tenant_id = ?',
      [newStatus, req.params.id, tid(req)]
    );

    await conn.commit();
    res.json({ status: 'success', data: { status: newStatus } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

/* ─── POST /:id/status ───────────────────────────────────────────────────── */
router.post('/:id/status', async (req, res) => {
  try {
    const newStatus = req.body?.status;
    if (!TRANSITIONS[newStatus] && newStatus !== 'open') {
      return res.status(400).json({ status: 'error', message: 'invalid status' });
    }

    const [[memo]] = await pool.query(
      'SELECT status FROM memo_transactions WHERE id = ? AND tenant_id = ?',
      [req.params.id, tid(req)]
    );
    if (!memo) return res.status(404).json({ status: 'error', message: 'not found' });

    const allowed = TRANSITIONS[memo.status] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(422).json({
        status: 'error',
        message: `Cannot transition from '${memo.status}' to '${newStatus}'`,
      });
    }

    await pool.execute(
      'UPDATE memo_transactions SET status = ? WHERE id = ? AND tenant_id = ?',
      [newStatus, req.params.id, tid(req)]
    );
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

module.exports = router;
