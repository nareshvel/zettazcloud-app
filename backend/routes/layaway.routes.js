/**
 * Layaway / installment plan routes — /api/layaways
 *
 *   GET    /                  list (optional ?status=)
 *   GET    /:id               plan + items + payments + computed balance
 *   POST   /preview           compute a schedule without saving
 *   POST   /                  create plan with items (auto plan no)
 *   POST   /:id/payments      record a payment (auto-completes when paid off)
 *   POST   /:id/status        cancel / default a plan
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const inst = require('../services/installmentService');

// Email service — gracefully skip if not configured
let emailService = null;
try { emailService = require('../services/emailService'); } catch {}

const fmtCur = (n, cur = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(Number(n) || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
const uid = (req) => req.user?.id || null;

router.use(authenticate);
router.use(requireTenantId);

async function nextPlanNo(conn, tenantId) {
  await conn.query(
    'INSERT INTO layaway_sequences (tenant_id, `last_value`) VALUES (?, 1) '
     + 'ON DUPLICATE KEY UPDATE `last_value` = `last_value` + 1', [tenantId]
  );
  const [[row]] = await conn.query('SELECT `last_value` FROM layaway_sequences WHERE tenant_id = ?', [tenantId]);
  return `LA-${String(row.last_value).padStart(5, '0')}`;
}

router.post('/preview', (req, res) => {
  try {
    const b = req.body || {};
    res.json({ status: 'success', data: inst.buildLayawaySchedule({
      totalAmount: b.total_amount, downPayment: b.down_payment,
      installmentCount: b.installment_count, frequency: b.frequency, startDate: b.start_date,
    }) });
  } catch (e) { res.status(400).json({ status: 'error', message: e.message }); }
});

// Server-side search + pagination, matching the pattern used by
// salesReturnController.js's getAllReturns / salesController.js's
// searchSales — customer name/email/phone plus the plan number itself.
// Registered as a literal route (`/`, query-driven) so it stays reachable
// without colliding with `/:id` below.
router.get('/', async (req, res) => {
  try {
    const params = [tid(req)];
    let sql = `SELECT l.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
                      c.phone_number AS customer_phone, c.email AS customer_email
                 FROM layaway_plans l
                 LEFT JOIN customers c ON c.id = l.customer_id
                WHERE l.tenant_id = ?`;
    let countSql = `SELECT COUNT(*) AS total
                 FROM layaway_plans l
                 LEFT JOIN customers c ON c.id = l.customer_id
                WHERE l.tenant_id = ?`;
    const countParams = [tid(req)];

    if (req.query.status) {
      sql += ' AND l.status = ?';
      countSql += ' AND l.status = ?';
      params.push(req.query.status);
      countParams.push(req.query.status);
    }

    const search = (req.query.search || '').trim();
    if (search) {
      const term = `%${search}%`;
      const clause = ` AND (
           l.plan_no LIKE ?
           OR CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?
           OR c.email LIKE ?
           OR c.phone_number LIKE ?
         )`;
      sql += clause;
      countSql += clause;
      params.push(term, term, term, term);
      countParams.push(term, term, term, term);
    }

    sql += ' ORDER BY l.created_at DESC';

    // Pagination is opt-in via ?page= so the pre-existing "load everything"
    // callers (none left in the frontend, but keep the contract) don't
    // silently get truncated to a page size they didn't ask for.
    let page, limit;
    if (req.query.page || req.query.limit) {
      page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
      sql += ' LIMIT ? OFFSET ?';
      params.push(limit, (page - 1) * limit);
    }

    const [rows] = await pool.query(sql, params);
    const data = rows.map((r) => ({ ...r, ...inst.layawayStatus({ totalAmount: r.total_amount, paidAmount: r.paid_amount }) }));

    if (page) {
      const [[{ total }]] = await pool.query(countSql, countParams);
      res.json({
        status: 'success',
        data,
        pagination: { page, limit, total, pages: Math.max(Math.ceil(total / limit), 1) },
      });
    } else {
      res.json({ status: 'success', data });
    }
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// GET /search — lightweight lookup used by the Sales Hub "Collect Payment"
// quick action to find an active plan by customer or plan number without
// pulling the full paginated list UI. Same join/match shape as GET '/'
// above, hardcoded to active plans with a small result cap. MUST stay
// before GET '/:id' below per the project's literal-before-wildcard
// route-ordering convention.
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ status: 'success', data: [] });
    const term = `%${q}%`;
    const [rows] = await pool.query(
      `SELECT l.id, l.plan_no, l.total_amount, l.paid_amount, l.status, l.due_date, l.customer_id,
              c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              c.phone_number AS customer_phone, c.email AS customer_email
         FROM layaway_plans l
         LEFT JOIN customers c ON c.id = l.customer_id
        WHERE l.tenant_id = ?
          AND l.status = 'active'
          AND (
            l.plan_no LIKE ?
            OR CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?
            OR c.email LIKE ?
            OR c.phone_number LIKE ?
          )
        ORDER BY l.created_at DESC
        LIMIT 15`,
      [tid(req), term, term, term, term]
    );
    res.json({ status: 'success', data: rows.map((r) => ({ ...r, ...inst.layawayStatus({ totalAmount: r.total_amount, paidAmount: r.paid_amount }) })) });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const [[plan]] = await pool.query(
      `SELECT l.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              c.phone_number AS customer_phone, c.email AS customer_email,
              c.address_line1 AS customer_address_line1, c.city AS customer_city
         FROM layaway_plans l
         LEFT JOIN customers c ON c.id = l.customer_id
        WHERE l.id = ? AND l.tenant_id = ?`,
      [req.params.id, tid(req)]
    );
    if (!plan) return res.status(404).json({ status: 'error', message: 'not found' });
    const [items] = await pool.execute('SELECT * FROM layaway_items WHERE layaway_id = ?', [req.params.id]);
    const [payments] = await pool.execute('SELECT * FROM layaway_payments WHERE layaway_id = ? ORDER BY paid_at', [req.params.id]);
    res.json({ status: 'success', data: {
      ...plan, items, payments,
      ...inst.layawayStatus({ totalAmount: plan.total_amount, paidAmount: plan.paid_amount }),
    } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (!items.length) { await conn.rollback(); return res.status(400).json({ status: 'error', message: 'at least one item required' }); }

    const total = Number(b.total_amount) ||
      items.reduce((s, it) => s + (Number(it.line_total) || (Number(it.unit_price) || 0) * (Number(it.quantity) || 1)), 0);
    let schedule;
    try {
      schedule = inst.buildLayawaySchedule({
        totalAmount: total, downPayment: b.down_payment,
        installmentCount: b.installment_count, frequency: b.frequency, startDate: b.start_date,
      });
    } catch (ve) { await conn.rollback(); return res.status(400).json({ status: 'error', message: ve.message }); }

    const id = uuidv4();
    const planNo = await nextPlanNo(conn, tid(req));
    const down = Number(b.down_payment) || 0;

    await conn.query(
      `INSERT INTO layaway_plans
        (id, tenant_id, store_id, plan_no, customer_id, employee_id, total_amount, down_payment, paid_amount,
         installment_amount, installment_count, frequency, start_date, due_date, status, notes, created_by_user_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, tid(req), b.store_id ?? req.user?.store_id ?? null, planNo, b.customer_id ?? null, b.employee_id ?? null,
       Math.round(total * 100) / 100, down, down,
       schedule.installmentAmount, Number(b.installment_count) || 1, b.frequency || 'monthly',
       b.start_date ?? new Date().toISOString().slice(0, 10), schedule.dueDate, 'active', b.notes ?? null, uid(req)]
    );

    for (const it of items) {
      const qty = Number(it.quantity) || 1;
      const unit = Number(it.unit_price) || 0;
      await conn.query(
        `INSERT INTO layaway_items (id, tenant_id, layaway_id, product_id, piece_id, description, quantity, unit_price, line_total)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [uuidv4(), tid(req), id, it.product_id ?? null, it.piece_id ?? null,
         it.description || 'Item', qty, unit, Math.round(qty * unit * 100) / 100]
      );
      // Reserve a serialized piece for the duration of the plan.
      if (it.piece_id) {
        await conn.query("UPDATE product_pieces SET status = 'hold' WHERE id = ? AND tenant_id = ?", [it.piece_id, tid(req)]);
      }
    }

    if (down > 0) {
      await conn.query(
        `INSERT INTO layaway_payments (id, tenant_id, layaway_id, amount, payment_method, notes, received_by_user_id)
         VALUES (?,?,?,?,?,?,?)`,
        [uuidv4(), tid(req), id, down, b.payment_method ?? null, 'Down payment', uid(req)]
      );
    }

    await conn.commit();
    res.status(201).json({ status: 'success', data: { id, plan_no: planNo, ...schedule } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

router.post('/:id/payments', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const amount = Number(req.body?.amount);
    if (Number.isNaN(amount) || amount <= 0) { await conn.rollback(); return res.status(400).json({ status: 'error', message: 'amount must be > 0' }); }

    const [[plan]] = await conn.query('SELECT * FROM layaway_plans WHERE id = ? AND tenant_id = ?', [req.params.id, tid(req)]);
    if (!plan) { await conn.rollback(); return res.status(404).json({ status: 'error', message: 'not found' }); }

    await conn.query(
      `INSERT INTO layaway_payments (id, tenant_id, layaway_id, amount, payment_method, reference, notes, received_by_user_id)
       VALUES (?,?,?,?,?,?,?,?)`,
      [uuidv4(), tid(req), req.params.id, amount, req.body?.payment_method ?? null,
       req.body?.reference ?? null, req.body?.notes ?? null, uid(req)]
    );

    const newPaid = Math.round((Number(plan.paid_amount) + amount) * 100) / 100;
    const st = inst.layawayStatus({ totalAmount: plan.total_amount, paidAmount: newPaid });
    const newStatus = st.isComplete ? 'completed' : plan.status;
    await conn.query('UPDATE layaway_plans SET paid_amount = ?, status = ? WHERE id = ?', [newPaid, newStatus, req.params.id]);

    // On completion, release reserved pieces as sold.
    if (st.isComplete) {
      await conn.query(
        `UPDATE product_pieces p
           JOIN layaway_items li ON li.piece_id = p.id
            SET p.status = 'sold'
          WHERE li.layaway_id = ? AND p.tenant_id = ?`,
        [req.params.id, tid(req)]
      );
    }

    await conn.commit();
    res.json({ status: 'success', data: { paidAmount: newPaid, ...st, status: newStatus } });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

router.post('/:id/status', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const valid = ['active', 'completed', 'cancelled', 'defaulted'];
    if (!valid.includes(req.body?.status)) { await conn.rollback(); return res.status(400).json({ status: 'error', message: 'invalid status' }); }
    const [r] = await conn.query('UPDATE layaway_plans SET status = ? WHERE id = ? AND tenant_id = ?',
      [req.body.status, req.params.id, tid(req)]);
    if (!r.affectedRows) { await conn.rollback(); return res.status(404).json({ status: 'error', message: 'not found' }); }
    // Cancelling/defaulting frees any reserved pieces.
    if (['cancelled', 'defaulted'].includes(req.body.status)) {
      await conn.query(
        `UPDATE product_pieces p
           JOIN layaway_items li ON li.piece_id = p.id
            SET p.status = 'available'
          WHERE li.layaway_id = ? AND p.tenant_id = ? AND p.status = 'hold'`,
        [req.params.id, tid(req)]
      );
    }
    await conn.commit();
    res.json({ status: 'success' });
  } catch (e) {
    await conn.rollback();
    res.status(500).json({ status: 'error', message: e.message });
  } finally { conn.release(); }
});

/* ── POST /:id/email — send agreement / statement / receipt to customer ── */
router.post('/:id/email', async (req, res) => {
  try {
    const [[plan]] = await pool.query(
      `SELECT l.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              c.phone_number AS customer_phone, c.email AS customer_email
         FROM layaway_plans l
         LEFT JOIN customers c ON c.id = l.customer_id
        WHERE l.id = ? AND l.tenant_id = ?`,
      [req.params.id, tid(req)]
    );
    if (!plan) return res.status(404).json({ status: 'error', message: 'not found' });

    const [items]    = await pool.execute('SELECT * FROM layaway_items WHERE layaway_id = ?', [req.params.id]);
    const [payments] = await pool.execute('SELECT * FROM layaway_payments WHERE layaway_id = ? ORDER BY paid_at', [req.params.id]);

    const { to, subject, message, docType = 'agreement' } = req.body || {};
    const recipientEmail = to || plan.customer_email;
    if (!recipientEmail) return res.status(400).json({ status: 'error', message: 'No recipient email' });

    // Build store info from tenants / stores tables
    const [[store]] = await pool.query(
      `SELECT s.name, s.phone, s.email, s.address FROM stores s WHERE s.tenant_id = ? LIMIT 1`,
      [tid(req)]
    ).catch(() => [[null]]);
    const storeName = store?.name || 'Store';

    const customerName = [plan.customer_first_name, plan.customer_last_name].filter(Boolean).join(' ') || 'Valued Customer';
    const balance = Math.max(Number(plan.total_amount) - Number(plan.paid_amount), 0);

    // Build a clean HTML email body
    const itemsHtml = items.map(it =>
      `<tr><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0">${it.description}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${it.quantity}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${fmtCur(it.line_total)}</td></tr>`
    ).join('');

    const paymentsHtml = payments.map(p =>
      `<tr><td style="padding:4px 8px;border-bottom:1px solid #f0f0f0">${fmtDate(p.paid_at)}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0">${p.notes === 'Down payment' ? 'Down Payment' : 'Instalment'}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0">${p.payment_method || '—'}</td>
            <td style="padding:4px 8px;border-bottom:1px solid #f0f0f0;text-align:right;color:#16a34a;font-weight:600">${fmtCur(p.amount)}</td></tr>`
    ).join('');

    const customMessage = message
      ? `<p style="margin:0 0 16px;color:#374151">${message.replace(/\n/g, '<br>')}</p>`
      : '';

    const isStatement = docType === 'statement';
    const docTitle = isStatement ? 'Account Statement' : 'Layaway Agreement';

    const htmlBody = `
<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;font-size:13px;color:#111">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
  <!-- Header -->
  <div style="background:#111;padding:20px 24px;display:flex;justify-content:space-between;align-items:center">
    <div style="color:#fff;font-size:18px;font-weight:900">${storeName}</div>
    <div style="color:#aaa;font-size:11px;text-align:right">${docTitle}<br><span style="font-family:monospace;color:#ddd">${plan.plan_no}</span></div>
  </div>
  <!-- Greeting -->
  <div style="padding:20px 24px 0">
    <p style="margin:0 0 8px;font-size:15px;font-weight:700">Dear ${customerName},</p>
    ${customMessage}
    ${!customMessage ? `<p style="margin:0 0 16px;color:#374151">Please find your layaway ${docTitle.toLowerCase()} below for plan <strong>${plan.plan_no}</strong>.</p>` : ''}
  </div>
  <!-- Summary cards -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin:0 24px 16px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
    <div style="padding:10px 12px;text-align:center;border-right:1px solid #e5e7eb">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.8px;color:#888">Plan Total</div>
      <div style="font-size:16px;font-weight:800;margin-top:3px">${fmtCur(plan.total_amount)}</div>
    </div>
    <div style="padding:10px 12px;text-align:center;border-right:1px solid #e5e7eb">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.8px;color:#888">Paid</div>
      <div style="font-size:16px;font-weight:800;margin-top:3px;color:#16a34a">${fmtCur(plan.paid_amount)}</div>
    </div>
    <div style="padding:10px 12px;text-align:center">
      <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.8px;color:#888">Balance</div>
      <div style="font-size:16px;font-weight:800;margin-top:3px;color:#dc2626">${fmtCur(balance)}</div>
    </div>
  </div>
  <!-- Plan details -->
  <div style="margin:0 24px 16px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
    <div style="background:#f3f4f6;padding:8px 12px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#666">Plan Details</div>
    <div style="padding:10px 12px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">
      <div><span style="color:#888">Plan No: </span><strong style="font-family:monospace">${plan.plan_no}</strong></div>
      <div><span style="color:#888">Status: </span><strong style="text-transform:capitalize">${plan.status}</strong></div>
      <div><span style="color:#888">Start: </span><strong>${fmtDate(plan.start_date)}</strong></div>
      <div><span style="color:#888">Due: </span><strong>${fmtDate(plan.due_date)}</strong></div>
      <div><span style="color:#888">Frequency: </span><strong style="text-transform:capitalize">${plan.frequency}</strong></div>
      <div><span style="color:#888">Instalments: </span><strong>${plan.installment_count} × ${fmtCur(plan.installment_amount)}</strong></div>
    </div>
  </div>
  <!-- Items -->
  ${items.length ? `
  <div style="margin:0 24px 16px">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#666;margin-bottom:6px">Reserved Items</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:6px 8px;text-align:left;font-size:10px;color:#666">Item</th>
        <th style="padding:6px 8px;text-align:right;font-size:10px;color:#666">Qty</th>
        <th style="padding:6px 8px;text-align:right;font-size:10px;color:#666">Total</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  </div>` : ''}
  <!-- Payment history (statement only) -->
  ${isStatement && payments.length ? `
  <div style="margin:0 24px 16px">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#666;margin-bottom:6px">Payment History</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      <thead><tr style="background:#f3f4f6">
        <th style="padding:6px 8px;text-align:left;font-size:10px;color:#666">Date</th>
        <th style="padding:6px 8px;text-align:left;font-size:10px;color:#666">Type</th>
        <th style="padding:6px 8px;text-align:left;font-size:10px;color:#666">Method</th>
        <th style="padding:6px 8px;text-align:right;font-size:10px;color:#666">Amount</th>
      </tr></thead>
      <tbody>${paymentsHtml}</tbody>
    </table>
  </div>` : ''}
  <!-- Footer -->
  <div style="background:#f9fafb;padding:14px 24px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center">
    ${storeName} · ${store?.phone || ''} · ${store?.email || ''}<br>
    This is a system-generated email. Plan: ${plan.plan_no}
  </div>
</div>
</body></html>`;

    if (!emailService || !emailService.transporter) {
      return res.status(503).json({ status: 'error', message: 'Email service not configured. Check SMTP settings.' });
    }

    const emailSubject = subject || `${docTitle} — ${plan.plan_no} (${storeName})`;
    await emailService.transporter.sendMail({
      from: { name: storeName, address: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@store.com' },
      to: recipientEmail,
      subject: emailSubject,
      html: htmlBody,
    });

    res.json({ status: 'success', message: `Email sent to ${recipientEmail}` });
  } catch (e) {
    console.error('[layaway/email]', e.message);
    res.status(500).json({ status: 'error', message: e.message });
  }
});

module.exports = router;
