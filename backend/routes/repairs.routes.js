/**
 * Repair / custom-order routes
 * Base path: /api/repairs   (mounted in routes/index.js)
 *
 *   GET    /                 list repair orders (optional ?status=)
 *   GET    /:id              one order + status history
 *   POST   /                 create (auto ticket number)
 *   PUT    /:id              update fields
 *   POST   /:id/status       change status + append history
 *   POST   /:id/collect-balance  record balance payment on/before delivery
 *   POST   /:id/email        send job card or status-update email
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const requireIndustry = require('../middleware/requireIndustry');

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
const uid = (req) => req.user?.id || null;

const PAYMENT_MODES = ['cash','card','upi','bank_transfer','cheque','online','other'];

router.use(authenticate);
router.use(requireTenantId);
router.use(requireIndustry(['jewelry', 'electronics']));

// ── helpers ────────────────────────────────────────────────────────────────

async function nextTicketNo(conn, tenantId) {
  await conn.query(
    'INSERT INTO repair_ticket_sequences (tenant_id, `last_value`) VALUES (?, 1) '
     + 'ON DUPLICATE KEY UPDATE `last_value` = `last_value` + 1',
    [tenantId]
  );
  const [[row]] = await conn.query('SELECT `last_value` FROM repair_ticket_sequences WHERE tenant_id = ?', [tenantId]);
  return `RP-${String(row.last_value).padStart(5, '0')}`;
}

function safeMode(m) {
  return PAYMENT_MODES.includes(m) ? m : null;
}

// ── GET / ──────────────────────────────────────────────────────────────────
//
// Supports server-side status filter, search (ticket no / customer name,
// email, phone), and page/limit pagination — same shape as
// salesReturnController.js's getAllReturns, so RepairsPage.tsx can reuse the
// identical page/limit/pagination.pages contract.

router.get('/', async (req, res) => {
  try {
    const { status, search = '', page = 1, limit = 20 } = req.query;
    const params = [tid(req)];
    let base = `FROM repair_orders r
                 LEFT JOIN customers c ON c.id = r.customer_id
                WHERE r.tenant_id = ?`;

    if (status) { base += ' AND r.status = ?'; params.push(status); }

    if (search) {
      base += ` AND (
        r.ticket_no LIKE ?
        OR r.item_description LIKE ?
        OR CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?
        OR c.email LIKE ?
        OR c.phone_number LIKE ?
      )`;
      const t = `%${search}%`;
      params.push(t, t, t, t, t);
    }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total ${base}`, params);

    const lim = Math.max(1, parseInt(limit, 10) || 20);
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const offset = (pg - 1) * lim;

    const dataSql = `SELECT r.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
                             c.email AS customer_email, c.phone_number AS customer_phone
                        ${base} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    const [rows] = await pool.query(dataSql, [...params, lim, offset]);

    res.json({
      status: 'success',
      data: rows,
      pagination: { total, page: pg, limit: lim, pages: Math.ceil(total / lim) || 1 },
    });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ── GET /stats ─────────────────────────────────────────────────────────────
//
// Status counts across the WHOLE tenant, not just the current page — mirrors
// salesReturnController.js's getReturnStats. Must stay above GET /:id
// (literal routes before wildcard, per project convention).

router.get('/stats', async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'received'    THEN 1 ELSE 0 END) AS received,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
         SUM(CASE WHEN status = 'ready'       THEN 1 ELSE 0 END) AS ready,
         SUM(CASE WHEN status = 'delivered'   THEN 1 ELSE 0 END) AS delivered,
         SUM(CASE WHEN status = 'cancelled'   THEN 1 ELSE 0 END) AS cancelled
       FROM repair_orders WHERE tenant_id = ?`,
      [tid(req)]
    );
    res.json({ status: 'success', data: row });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ── GET /:id ───────────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
  try {
    const [[order]] = await pool.query(
      `SELECT r.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              c.email AS customer_email, c.phone_number AS customer_phone
         FROM repair_orders r
         LEFT JOIN customers c ON c.id = r.customer_id
        WHERE r.id = ? AND r.tenant_id = ?`,
      [req.params.id, tid(req)]
    );
    if (!order) return res.status(404).json({ status: 'error', message: 'not found' });
    const [history] = await pool.execute(
      'SELECT * FROM repair_order_updates WHERE repair_order_id = ? ORDER BY created_at', [req.params.id]
    );
    res.json({ status: 'success', data: { ...order, history } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ── POST / (create) ────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const b = req.body || {};
    if (!b.item_description) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'item_description required' });
    }
    const id = uuidv4();
    const ticketNo = await nextTicketNo(conn, tid(req));

    await conn.query(
      `INSERT INTO repair_orders
        (id, tenant_id, store_id, ticket_no, customer_id, employee_id,
         item_description, metal, weight,
         problem_description, work_required, job_type, condition_notes, goldsmith_name,
         estimated_cost,
         advance_paid, advance_payment_mode,
         payment_gateway, payment_gateway_ref,
         status, received_date, promised_date,
         photos, notes, created_by_user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id, tid(req), b.store_id ?? req.user?.store_id ?? null, ticketNo,
        b.customer_id ?? null, b.employee_id ?? null,
        b.item_description,
        b.metal ?? null, b.weight ?? null,
        b.problem_description ?? null, b.work_required ?? null,
        b.job_type ?? null, b.condition_notes ?? null, b.goldsmith_name ?? null,
        b.estimated_cost ?? null,
        b.advance_paid ?? 0, safeMode(b.advance_payment_mode),
        b.payment_gateway ?? null, b.payment_gateway_ref ?? null,
        'received',
        b.received_date ?? new Date().toISOString().slice(0, 10),
        b.promised_date ?? null,
        b.photos ? JSON.stringify(b.photos) : null,
        b.notes ?? null, uid(req),
      ]
    );

    await conn.query(
      'INSERT INTO repair_order_updates (id, tenant_id, repair_order_id, status, note, updated_by_user_id) VALUES (?,?,?,?,?,?)',
      [uuidv4(), tid(req), id, 'received', 'Order received', uid(req)]
    );

    await conn.commit();
    res.status(201).json({ status: 'success', data: { id, ticket_no: ticketNo } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

// ── PUT /:id (update) ──────────────────────────────────────────────────────

router.put('/:id', async (req, res) => {
  try {
    const b = req.body || {};
    const scalarFields = [
      'store_id','customer_id','employee_id','item_description','metal','weight',
      'problem_description','work_required','job_type','condition_notes','goldsmith_name',
      'estimated_cost','final_cost',
      'advance_paid','balance_paid',
      'promised_date','delivered_date','notes',
      'payment_gateway','payment_gateway_ref',
    ];
    const sets = [], vals = [];

    for (const f of scalarFields) {
      if (b[f] !== undefined) { sets.push(`${f} = ?`); vals.push(b[f]); }
    }

    // Validated enum fields
    if (b.advance_payment_mode !== undefined) {
      sets.push('advance_payment_mode = ?');
      vals.push(safeMode(b.advance_payment_mode));
    }
    if (b.balance_payment_mode !== undefined) {
      sets.push('balance_payment_mode = ?');
      vals.push(safeMode(b.balance_payment_mode));
    }
    if (b.photos !== undefined) { sets.push('photos = ?'); vals.push(JSON.stringify(b.photos)); }

    if (!sets.length) return res.status(400).json({ status: 'error', message: 'no fields to update' });

    vals.push(req.params.id, tid(req));
    await pool.execute(
      `UPDATE repair_orders SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals
    );
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// ── POST /:id/status ───────────────────────────────────────────────────────

router.post('/:id/status', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { status, note } = req.body || {};
    const valid = ['received','in_progress','ready','delivered','cancelled'];
    if (!valid.includes(status)) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'invalid status' });
    }
    const extra = status === 'delivered' ? ', delivered_date = CURDATE()' : '';
    const [r] = await conn.query(
      `UPDATE repair_orders SET status = ?${extra} WHERE id = ? AND tenant_id = ?`,
      [status, req.params.id, tid(req)]
    );
    if (!r.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ status: 'error', message: 'not found' });
    }
    await conn.query(
      'INSERT INTO repair_order_updates (id, tenant_id, repair_order_id, status, note, updated_by_user_id) VALUES (?,?,?,?,?,?)',
      [uuidv4(), tid(req), req.params.id, status, note ?? null, uid(req)]
    );
    await conn.commit();
    res.json({ status: 'success' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

// ── POST /:id/collect-balance ─────────────────────────────────────────────
//
// Records balance payment.  Can be called before or at delivery.
// Body: { amount, payment_mode, gateway?, gateway_ref?, mark_delivered? }

router.post('/:id/collect-balance', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { amount, payment_mode, gateway, gateway_ref, mark_delivered = false } = req.body || {};

    if (amount == null || isNaN(Number(amount))) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'amount is required' });
    }

    const sets = [
      'balance_paid = ?',
      'balance_paid_at = NOW()',
      'balance_payment_mode = ?',
    ];
    const vals = [Number(amount), safeMode(payment_mode)];

    if (gateway)     { sets.push('payment_gateway = ?');     vals.push(gateway); }
    if (gateway_ref) { sets.push('payment_gateway_ref = ?'); vals.push(gateway_ref); }

    if (mark_delivered) {
      sets.push('status = ?', 'delivered_date = CURDATE()');
      vals.push('delivered');
    }

    vals.push(req.params.id, tid(req));
    const [r] = await conn.query(
      `UPDATE repair_orders SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals
    );

    if (!r.affectedRows) {
      await conn.rollback();
      return res.status(404).json({ status: 'error', message: 'not found' });
    }

    if (mark_delivered) {
      const note = `Balance ${amount} collected via ${payment_mode ?? 'cash'}. Item delivered.`;
      await conn.query(
        'INSERT INTO repair_order_updates (id, tenant_id, repair_order_id, status, note, updated_by_user_id) VALUES (?,?,?,?,?,?)',
        [uuidv4(), tid(req), req.params.id, 'delivered', note, uid(req)]
      );
    }

    await conn.commit();
    res.json({ status: 'success' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

// ── POST /:id/email ────────────────────────────────────────────────────────

router.post('/:id/email', async (req, res) => {
  const { to, subject, message, docType = 'job_card' } = req.body || {};
  if (!to) return res.status(400).json({ status: 'error', message: 'to is required' });

  let emailService;
  try { emailService = require('../services/emailService'); } catch { /* no-op */ }
  if (!emailService?.transporter) {
    return res.status(503).json({ status: 'error', message: 'Email service not configured' });
  }

  try {
    const [[order]] = await pool.query(
      `SELECT r.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              c.email AS customer_email, c.phone_number AS customer_phone
         FROM repair_orders r
         LEFT JOIN customers c ON c.id = r.customer_id
        WHERE r.id = ? AND r.tenant_id = ?`,
      [req.params.id, tid(req)]
    );
    if (!order) return res.status(404).json({ status: 'error', message: 'not found' });

    const [[store]] = await pool.query(
      'SELECT name, address, phone, currency_symbol, date_format FROM stores WHERE id = ? LIMIT 1',
      [order.store_id]
    ).catch(() => [[null]]);

    const currency = store?.currency_symbol || '₹';
    const fmtCur = (n) => n == null ? '—' : `${currency}${Number(n).toFixed(2)}`;
    const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    const custName = [order.customer_first_name, order.customer_last_name].filter(Boolean).join(' ') || 'Valued Customer';
    const totalCost = order.final_cost ?? order.estimated_cost ?? 0;
    const totalPaid = (order.advance_paid || 0) + (order.balance_paid || 0);
    const balance = totalCost - totalPaid;
    const docLabel = docType === 'job_card' ? 'Repair Job Card' : 'Status Update';

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111">
        <h2 style="font-size:20px;margin-bottom:4px">${store?.name ?? 'Store'}</h2>
        <p style="color:#666;font-size:13px;margin-bottom:20px">${store?.address ?? ''}</p>
        <h3 style="font-size:16px;border-bottom:2px solid #eee;padding-bottom:8px">${docLabel} – ${order.ticket_no}</h3>
        <p style="margin:12px 0;font-size:14px">Dear ${custName},</p>
        ${message ? `<p style="margin-bottom:16px;font-size:14px">${message}</p>` : ''}
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
          <tr style="background:#f3f4f6">
            <td style="padding:8px 10px;font-weight:700;border:1px solid #e5e7eb">Ticket No</td>
            <td style="padding:8px 10px;border:1px solid #e5e7eb;font-family:monospace">${order.ticket_no}</td>
          </tr>
          <tr>
            <td style="padding:8px 10px;font-weight:700;border:1px solid #e5e7eb">Item</td>
            <td style="padding:8px 10px;border:1px solid #e5e7eb">${order.item_description}</td>
          </tr>
          ${order.job_type ? `<tr style="background:#f3f4f6"><td style="padding:8px 10px;font-weight:700;border:1px solid #e5e7eb">Work Type</td><td style="padding:8px 10px;border:1px solid #e5e7eb">${order.job_type}</td></tr>` : ''}
          ${order.metal ? `<tr><td style="padding:8px 10px;font-weight:700;border:1px solid #e5e7eb">Metal</td><td style="padding:8px 10px;border:1px solid #e5e7eb">${order.metal}${order.weight ? ` · ${order.weight}g` : ''}</td></tr>` : ''}
          <tr style="background:#f3f4f6"><td style="padding:8px 10px;font-weight:700;border:1px solid #e5e7eb">Status</td><td style="padding:8px 10px;border:1px solid #e5e7eb;text-transform:capitalize">${(order.status || '').replace('_', ' ')}</td></tr>
          <tr><td style="padding:8px 10px;font-weight:700;border:1px solid #e5e7eb">Ready / Completion Date</td><td style="padding:8px 10px;border:1px solid #e5e7eb">${fmtDate(order.promised_date)}</td></tr>
          <tr style="background:#f3f4f6"><td style="padding:8px 10px;font-weight:700;border:1px solid #e5e7eb">Estimated Cost</td><td style="padding:8px 10px;border:1px solid #e5e7eb">${fmtCur(order.estimated_cost)}</td></tr>
          ${order.final_cost != null ? `<tr><td style="padding:8px 10px;font-weight:700;border:1px solid #e5e7eb">Final Cost</td><td style="padding:8px 10px;border:1px solid #e5e7eb">${fmtCur(order.final_cost)}</td></tr>` : ''}
          <tr style="background:#f3f4f6"><td style="padding:8px 10px;font-weight:700;border:1px solid #e5e7eb">Advance Paid</td><td style="padding:8px 10px;border:1px solid #e5e7eb">${fmtCur(order.advance_paid ?? 0)}${order.advance_payment_mode ? ` <span style="color:#666;font-size:11px">(${order.advance_payment_mode})</span>` : ''}</td></tr>
          ${order.balance_paid != null ? `<tr><td style="padding:8px 10px;font-weight:700;border:1px solid #e5e7eb">Balance Paid</td><td style="padding:8px 10px;border:1px solid #e5e7eb">${fmtCur(order.balance_paid)}${order.balance_payment_mode ? ` <span style="color:#666;font-size:11px">(${order.balance_payment_mode})</span>` : ''}</td></tr>` : ''}
          <tr><td style="padding:8px 10px;font-weight:700;border:1px solid #e5e7eb;color:${balance > 0 ? '#dc2626' : '#16a34a'}">Balance Due</td><td style="padding:8px 10px;border:1px solid #e5e7eb;font-weight:700;color:${balance > 0 ? '#dc2626' : '#16a34a'}">${balance > 0 ? fmtCur(balance) : 'Fully Paid'}</td></tr>
        </table>
        ${order.work_required ? `<div style="background:#f9f9f9;border:1px solid #eee;border-radius:6px;padding:12px;margin-bottom:16px;font-size:13px"><strong>Work Required:</strong><br>${order.work_required}</div>` : ''}
        <p style="font-size:13px;color:#555">Please bring this email or your job card when collecting your item.</p>
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
        <p style="font-size:12px;color:#999">${store?.name ?? ''} · ${store?.address ?? ''} · ${store?.phone ?? ''}</p>
      </div>`;

    await emailService.transporter.sendMail({
      from: emailService.FROM_ADDRESS || `"${store?.name ?? 'Repairs'}" <no-reply@zettaz.com>`,
      to,
      subject: subject || `${docLabel} – ${order.ticket_no}`,
      html: htmlBody,
    });

    res.json({ status: 'success' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
