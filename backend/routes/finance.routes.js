/**
 * Finance — expenses + outgoing payments (the money-OUT side).
 *
 * Base path: /api/finance  (mounted in routes/index.js)
 *
 *   GET    /expenses                    list expenses (?search&category&status&from&to)
 *   GET    /expenses/categories         distinct categories for filter dropdowns
 *   POST   /expenses                    create (status 'paid' auto-writes a linked
 *                                       outgoing_payments row so money-out is one ledger)
 *   PUT    /expenses/:id                edit; unpaid<->paid flips create/void the
 *                                       linked payment; amount edits update it
 *   DELETE /expenses/:id                removes the expense; linked payments are
 *                                       voided, never hard-deleted (audit trail)
 *   GET    /payments                    list outgoing payments (?payeeType&supplierId&from&to&search)
 *   POST   /payments                    record a payment: supplier (+ optional PO,
 *                                       capped at that PO's outstanding), expense
 *                                       (marks it paid), or free-form 'other'
 *   POST   /payments/:id/void           void a payment (re-opens the expense/PO balance)
 *   GET    /supplier-outstanding        ?supplier_id -> POs with outstanding balances
 *
 * Permissions: finance.view for reads, finance.manage for writes.
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool, getConnectionWithTimeZone } = require('../config/db');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { logActivity } = require('../services/auditLogService');

router.use(authenticate);
router.use(requireTenantId);
router.use(requireStoreId);

const PAYEE_TYPES = ['supplier', 'expense', 'other'];

function parseAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Non-negative number or 0 — for tax/shipping/discount components. */
function parseOptionalAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? round2(n) : 0;
}

/**
 * Normalize posted line items. A line amount is qty*unitCost when both are
 * present, otherwise the posted `amount`. Returns { items, subtotal } or
 * { error }.
 */
function normalizeLineItems(rawItems) {
  if (!Array.isArray(rawItems)) return { items: [], subtotal: 0 };
  const items = [];
  for (const raw of rawItems) {
    const description = String(raw?.description || '').trim();
    if (!description) return { error: 'Every line item needs a description.' };
    const qty = Number(raw?.quantity ?? 1);
    if (!Number.isFinite(qty) || qty <= 0) return { error: `Invalid quantity for "${description}".` };
    // Body arrives snake_cased (fetchApi converts camelCase -> snake_case).
    const rawUnitCost = raw?.unit_cost ?? raw?.unitCost;
    const unitCost = rawUnitCost !== undefined && rawUnitCost !== null && rawUnitCost !== ''
      ? Number(rawUnitCost) : null;
    if (unitCost !== null && (!Number.isFinite(unitCost) || unitCost < 0)) {
      return { error: `Invalid unit cost for "${description}".` };
    }
    let amount;
    if (unitCost !== null) {
      amount = round2(qty * unitCost);
    } else {
      amount = parseAmount(raw?.amount);
      if (amount === null) return { error: `Enter an amount for "${description}".` };
    }
    items.push({ description, quantity: qty, unitCost, amount });
  }
  return { items, subtotal: round2(items.reduce((s, i) => s + i.amount, 0)) };
}

async function insertLineItems(conn, tenantId, expenseId, items) {
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    await conn.query(
      `INSERT INTO expense_items (id, tenant_id, expense_id, description, quantity, unit_cost, amount, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), tenantId, expenseId, it.description, it.quantity, it.unitCost, it.amount, i]
    );
  }
}

/**
 * Per-tenant, per-year human reference: EXP-2026-000123 / PAY-2026-000123.
 * MAX+1 inside the insert transaction — low-frequency writes, no unique
 * constraint, so a rare concurrent dup is cosmetic, not corrupting.
 */
async function docNumber(conn, table, col, prefix, tenantId, year) {
  const [rows] = await conn.query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(${col}, '-', -1) AS UNSIGNED)) AS maxSeq
       FROM ${table} WHERE tenant_id = ? AND ${col} LIKE ?`,
    [tenantId, `${prefix}-${year}-%`]
  );
  const seq = (rows[0].maxSeq || 0) + 1;
  return `${prefix}-${year}-${String(seq).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

router.get('/expenses', requirePermission('finance.view'), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { search, category, status, from, to, supplierId } = req.query;

    const where = ['e.tenant_id = ?'];
    const params = [tenantId];
    if (status) { where.push('e.status = ?'); params.push(status); }
    if (category) { where.push('e.category = ?'); params.push(category); }
    if (supplierId) { where.push('e.supplier_id = ?'); params.push(supplierId); }
    if (from) { where.push('e.expense_date >= ?'); params.push(from); }
    if (to) { where.push('e.expense_date <= ?'); params.push(to); }
    if (search) {
      where.push('(e.payee LIKE ? OR e.description LIKE ? OR e.reference LIKE ? OR e.expense_number LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const [items] = await pool.query(
      `SELECT e.*, s.supplier_name AS supplier_name,
              u.name AS created_by_name
         FROM expenses e
         LEFT JOIN suppliers s ON s.id = e.supplier_id
         LEFT JOIN users u ON u.id = e.created_by
        WHERE ${where.join(' AND ')}
        ORDER BY e.expense_date DESC, e.created_at DESC
        LIMIT 500`,
      params
    );

    // Attach line items in one batch query (500-row cap keeps this sane).
    if (items.length) {
      const ids = items.map(i => i.id);
      const [lines] = await pool.query(
        `SELECT id, expense_id, description, quantity, unit_cost, amount, sort_order
           FROM expense_items
          WHERE tenant_id = ? AND expense_id IN (?)
          ORDER BY sort_order, created_at`,
        [tenantId, ids]
      );
      const byExpense = {};
      for (const l of lines) {
        (byExpense[l.expense_id] = byExpense[l.expense_id] || []).push(l);
      }
      for (const e of items) e.line_items = byExpense[e.id] || [];
    }

    const [summary] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status != 'cancelled' THEN amount END), 0) AS total,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount END), 0) AS paid_total,
         COALESCE(SUM(CASE WHEN status = 'unpaid' THEN amount END), 0) AS unpaid_total,
         COALESCE(SUM(CASE WHEN status != 'cancelled'
                           AND YEAR(expense_date) = YEAR(CURDATE())
                           AND MONTH(expense_date) = MONTH(CURDATE())
                          THEN amount END), 0) AS this_month
         FROM expenses WHERE tenant_id = ?`,
      [tenantId]
    );

    res.json({ items, summary: summary[0] });
  } catch (err) {
    console.error('[finance] GET /expenses failed:', err);
    res.status(500).json({ message: 'Failed to load expenses.' });
  }
});

router.get('/expenses/categories', requirePermission('finance.view'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT DISTINCT category FROM expenses WHERE tenant_id = ? ORDER BY category',
      [req.tenantId]
    );
    res.json({ categories: rows.map(r => r.category) });
  } catch (err) {
    console.error('[finance] GET /expenses/categories failed:', err);
    res.status(500).json({ message: 'Failed to load categories.' });
  }
});

router.post('/expenses', requirePermission('finance.manage'), async (req, res) => {
  const conn = await getConnectionWithTimeZone();
  try {
    const tenantId = req.tenantId;
    const storeId = req.storeId;
    const userId = req.user?.id || null;
    const { category, payee, description, amount, expense_date, status,
            payment_method, reference, supplier_id, notes,
            items: rawItems, tax_amount, shipping_amount, discount_amount } = req.body || {};

    if (!category || !String(category).trim()) return res.status(400).json({ message: 'Category is required.' });

    // Document totals: subtotal (from line items, or the direct amount) plus
    // tax + shipping minus discount = payable `amount`.
    const norm = normalizeLineItems(rawItems);
    if (norm.error) return res.status(400).json({ message: norm.error });
    const lineItems = norm.items;
    const tax = parseOptionalAmount(tax_amount);
    const shipping = parseOptionalAmount(shipping_amount);
    const discount = parseOptionalAmount(discount_amount);

    let subtotal;
    if (lineItems.length) {
      subtotal = norm.subtotal;
    } else {
      subtotal = parseAmount(amount);
      if (subtotal === null) return res.status(400).json({ message: 'Add at least one line item or a positive amount.' });
    }
    const amt = round2(subtotal + tax + shipping - discount);
    if (amt <= 0) return res.status(400).json({ message: 'The payable total must be positive.' });

    const date = expense_date || new Date().toISOString().slice(0, 10);
    const expStatus = status === 'paid' ? 'paid' : 'unpaid';

    if (supplier_id) {
      const [sup] = await conn.query('SELECT id FROM suppliers WHERE id = ? AND tenant_id = ?', [supplier_id, tenantId]);
      if (!sup.length) return res.status(400).json({ message: 'Supplier not found.' });
    }

    await conn.beginTransaction();
    const id = uuidv4();
    const number = await docNumber(conn, 'expenses', 'expense_number', 'EXP', tenantId, new Date(date).getFullYear());
    await conn.query(
      `INSERT INTO expenses
         (id, tenant_id, store_id, expense_number, category, payee, description,
          amount, subtotal, tax_amount, shipping_amount, discount_amount,
          expense_date, status, payment_method, reference, supplier_id, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, storeId, number, String(category).trim(), payee || null,
       description || lineItems[0]?.description || null,
       amt, subtotal, tax, shipping, discount,
       date, expStatus, payment_method || null, reference || null, supplier_id || null, notes || null, userId]
    );

    await insertLineItems(conn, tenantId, id, lineItems);

    // A paid expense is money out — mirror it into outgoing_payments so the
    // Payments page is a single ledger of everything that left the business.
    if (expStatus === 'paid') {
      const payNum = await docNumber(conn, 'outgoing_payments', 'payment_number', 'PAY', tenantId, new Date(date).getFullYear());
      await conn.query(
        `INSERT INTO outgoing_payments
           (id, tenant_id, store_id, payment_number, payee_type, payee_name,
            supplier_id, expense_id, amount, payment_date, payment_method,
            reference, notes, created_by)
         VALUES (?, ?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), tenantId, storeId, payNum, payee || String(category).trim(),
         supplier_id || null, id, amt, date, payment_method || null, reference || null,
         `Expense ${number}`, userId]
      );
    }

    await conn.commit();
    res.status(201).json({ id, expense_number: number });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] POST /expenses failed:', err);
    res.status(500).json({ message: 'Failed to create expense.' });
  } finally {
    conn.release();
  }
});

router.put('/expenses/:id', requirePermission('finance.manage'), async (req, res) => {
  const conn = await getConnectionWithTimeZone();
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.id || null;
    const { category, payee, description, amount, expense_date, status,
            payment_method, reference, supplier_id, notes,
            items: rawItems, tax_amount, shipping_amount, discount_amount } = req.body || {};

    const [rows] = await conn.query(
      'SELECT * FROM expenses WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [req.params.id, tenantId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Expense not found.' });
    const existing = rows[0];

    // Totals: when line items are posted they own the subtotal; otherwise the
    // posted amount (or the stored one) is the subtotal.
    let lineItems = null;
    let subtotal;
    if (rawItems !== undefined) {
      const norm = normalizeLineItems(rawItems);
      if (norm.error) return res.status(400).json({ message: norm.error });
      lineItems = norm.items;
      subtotal = norm.subtotal;
      if (!lineItems.length) {
        const direct = parseAmount(amount);
        if (direct === null) return res.status(400).json({ message: 'Add at least one line item or a positive amount.' });
        subtotal = direct;
      }
    } else {
      subtotal = amount !== undefined ? parseAmount(amount) : Number(existing.subtotal ?? existing.amount);
      if (subtotal === null) return res.status(400).json({ message: 'A positive amount is required.' });
    }
    const tax = tax_amount !== undefined ? parseOptionalAmount(tax_amount) : Number(existing.tax_amount || 0);
    const shipping = shipping_amount !== undefined ? parseOptionalAmount(shipping_amount) : Number(existing.shipping_amount || 0);
    const discount = discount_amount !== undefined ? parseOptionalAmount(discount_amount) : Number(existing.discount_amount || 0);
    const amt = round2(subtotal + tax + shipping - discount);
    if (amt <= 0) return res.status(400).json({ message: 'The payable total must be positive.' });

    const expStatus = status !== undefined ? (status === 'paid' ? 'paid' : status === 'cancelled' ? 'cancelled' : 'unpaid') : existing.status;

    await conn.beginTransaction();
    await conn.query(
      `UPDATE expenses SET
         category = ?, payee = ?, description = ?, amount = ?, subtotal = ?,
         tax_amount = ?, shipping_amount = ?, discount_amount = ?,
         expense_date = ?,
         status = ?, payment_method = ?, reference = ?, supplier_id = ?, notes = ?
       WHERE id = ?`,
      [
        category !== undefined ? String(category).trim() : existing.category,
        payee !== undefined ? payee : existing.payee,
        description !== undefined ? description : existing.description,
        amt, subtotal, tax, shipping, discount,
        expense_date || existing.expense_date,
        expStatus,
        payment_method !== undefined ? payment_method : existing.payment_method,
        reference !== undefined ? reference : existing.reference,
        supplier_id !== undefined ? supplier_id : existing.supplier_id,
        notes !== undefined ? notes : existing.notes,
        req.params.id,
      ]
    );

    // Replace line items only when the caller sent a new list.
    if (lineItems !== null) {
      await conn.query('DELETE FROM expense_items WHERE expense_id = ? AND tenant_id = ?', [req.params.id, tenantId]);
      await insertLineItems(conn, tenantId, req.params.id, lineItems);
    }

    // Keep the linked payment row in step with the expense's paid state.
    const [links] = await conn.query(
      `SELECT id, status FROM outgoing_payments
        WHERE expense_id = ? AND tenant_id = ?`, [req.params.id, tenantId]);
    const liveLink = links.find(l => l.status === 'completed');

    if (expStatus === 'paid' && !liveLink) {
      const year = new Date(expense_date || existing.expense_date).getFullYear();
      const payNum = await docNumber(conn, 'outgoing_payments', 'payment_number', 'PAY', tenantId, year);
      await conn.query(
        `INSERT INTO outgoing_payments
           (id, tenant_id, store_id, payment_number, payee_type, payee_name,
            supplier_id, expense_id, amount, payment_date, payment_method,
            reference, notes, created_by)
         VALUES (?, ?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), tenantId, existing.store_id, payNum,
         (payee !== undefined ? payee : existing.payee) || (category !== undefined ? category : existing.category),
         (supplier_id !== undefined ? supplier_id : existing.supplier_id),
         req.params.id, amt, expense_date || existing.expense_date,
         payment_method !== undefined ? payment_method : existing.payment_method,
         reference !== undefined ? reference : existing.reference,
         `Expense ${existing.expense_number}`, userId]
      );
    } else if (expStatus !== 'paid' && liveLink) {
      await conn.query(
        `UPDATE outgoing_payments SET status = 'voided', voided_by = ?, voided_at = NOW(),
           void_reason = 'Expense marked unpaid/cancelled'
         WHERE id = ?`, [userId, liveLink.id]);
    } else if (expStatus === 'paid' && liveLink) {
      await conn.query(
        `UPDATE outgoing_payments SET amount = ?, payment_date = ?,
           payment_method = COALESCE(?, payment_method), reference = COALESCE(?, reference)
         WHERE id = ?`,
        [amt, expense_date || existing.expense_date,
         payment_method !== undefined ? payment_method : null,
         reference !== undefined ? reference : null, liveLink.id]
      );
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] PUT /expenses/:id failed:', err);
    res.status(500).json({ message: 'Failed to update expense.' });
  } finally {
    conn.release();
  }
});

router.delete('/expenses/:id', requirePermission('finance.manage'), async (req, res) => {
  const conn = await getConnectionWithTimeZone();
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.id || null;
    await conn.beginTransaction();
    // Void linked payments first — payment rows survive as audit, the
    // expense itself is removed.
    await conn.query(
      `UPDATE outgoing_payments SET status = 'voided', voided_by = ?, voided_at = NOW(),
         void_reason = 'Expense deleted'
       WHERE expense_id = ? AND tenant_id = ? AND status = 'completed'`,
      [userId, req.params.id, tenantId]
    );
    await conn.query('DELETE FROM expense_items WHERE expense_id = ? AND tenant_id = ?', [req.params.id, tenantId]);
    const [result] = await conn.query(
      'DELETE FROM expenses WHERE id = ? AND tenant_id = ?', [req.params.id, tenantId]);
    if (!result.affectedRows) { await conn.rollback(); return res.status(404).json({ message: 'Expense not found.' }); }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] DELETE /expenses/:id failed:', err);
    res.status(500).json({ message: 'Failed to delete expense.' });
  } finally {
    conn.release();
  }
});

// ---------------------------------------------------------------------------
// Vendors — supplier search + inline quick-add for expense/payment forms.
// Kept under finance.* permissions: the Expenses/Payments screens shouldn't
// require suppliers.* just to name who a payment went to.
// ---------------------------------------------------------------------------

router.get('/vendors', requirePermission('finance.view'), async (req, res) => {
  try {
    const search = String(req.query.search || '').trim();
    const params = [req.tenantId];
    let where = 'tenant_id = ? AND is_active = 1';
    if (search) {
      where += ' AND (supplier_name LIKE ? OR contact_person LIKE ? OR email LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const [rows] = await pool.query(
      `SELECT id, supplier_name, contact_person, email, phone
         FROM suppliers WHERE ${where}
        ORDER BY supplier_name LIMIT 50`,
      params
    );
    res.json({ items: rows });
  } catch (err) {
    console.error('[finance] GET /vendors failed:', err);
    res.status(500).json({ message: 'Failed to search vendors.' });
  }
});

router.post('/vendors', requirePermission('finance.manage'), async (req, res) => {
  try {
    const { name, contact_person, email, phone } = req.body || {};
    const supplierName = String(name || '').trim();
    if (!supplierName) return res.status(400).json({ message: 'Vendor name is required.' });

    const [dup] = await pool.query(
      'SELECT id, supplier_name FROM suppliers WHERE tenant_id = ? AND supplier_name = ? LIMIT 1',
      [req.tenantId, supplierName]
    );
    if (dup.length) return res.json({ id: dup[0].id, supplier_name: dup[0].supplier_name, existing: true });

    const id = uuidv4();
    await pool.query(
      `INSERT INTO suppliers (id, tenant_id, supplier_name, contact_person, email, phone, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [id, req.tenantId, supplierName, contact_person || null, email || null, phone || null]
    );
    res.status(201).json({ id, supplier_name: supplierName });
  } catch (err) {
    console.error('[finance] POST /vendors failed:', err);
    res.status(500).json({ message: 'Failed to create vendor.' });
  }
});

// ---------------------------------------------------------------------------
// Outgoing payments
// ---------------------------------------------------------------------------

router.get('/payments', requirePermission('finance.view'), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { search, payeeType, supplierId, from, to } = req.query;

    const where = ['p.tenant_id = ?', "p.status != 'voided'"];
    const params = [tenantId];
    if (payeeType) { where.push('p.payee_type = ?'); params.push(payeeType); }
    if (supplierId) { where.push('p.supplier_id = ?'); params.push(supplierId); }
    if (from) { where.push('p.payment_date >= ?'); params.push(from); }
    if (to) { where.push('p.payment_date <= ?'); params.push(to); }
    if (search) {
      where.push('(p.payee_name LIKE ? OR p.reference LIKE ? OR p.payment_number LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    const [items] = await pool.query(
      `SELECT p.*, s.supplier_name AS supplier_name, po.purchase_order_number,
              u.name AS created_by_name
         FROM outgoing_payments p
         LEFT JOIN suppliers s ON s.id = p.supplier_id
         LEFT JOIN purchase_orders po ON po.id = p.purchase_order_id
         LEFT JOIN users u ON u.id = p.created_by
        WHERE ${where.join(' AND ')}
        ORDER BY p.payment_date DESC, p.created_at DESC
        LIMIT 500`,
      params
    );

    const [summary] = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'completed' THEN amount END), 0) AS total_paid,
         COALESCE(SUM(CASE WHEN status = 'completed'
                           AND YEAR(payment_date) = YEAR(CURDATE())
                           AND MONTH(payment_date) = MONTH(CURDATE())
                          THEN amount END), 0) AS this_month
         FROM outgoing_payments WHERE tenant_id = ?`,
      [tenantId]
    );

    // Total owed to suppliers = sum over POs of (total - completed payments).
    const [owed] = await pool.query(
      `SELECT COALESCE(SUM(po.total_amount - COALESCE(paid.paid_amount, 0)), 0) AS supplier_outstanding
         FROM purchase_orders po
         LEFT JOIN (
           SELECT purchase_order_id, SUM(amount) AS paid_amount
             FROM outgoing_payments
            WHERE tenant_id = ? AND status = 'completed' AND purchase_order_id IS NOT NULL
            GROUP BY purchase_order_id
         ) paid ON paid.purchase_order_id = po.id
        WHERE po.tenant_id = ? AND po.status NOT IN ('DRAFT', 'CANCELLED')`,
      [tenantId, tenantId]
    );

    res.json({ items, summary: { ...summary[0], supplier_outstanding: owed[0].supplier_outstanding } });
  } catch (err) {
    console.error('[finance] GET /payments failed:', err);
    res.status(500).json({ message: 'Failed to load payments.' });
  }
});

router.get('/supplier-outstanding', requirePermission('finance.view'), async (req, res) => {
  try {
    const { supplierId } = req.query;
    if (!supplierId) return res.status(400).json({ message: 'supplierId is required.' });
    const [rows] = await pool.query(
      `SELECT po.id, po.purchase_order_number, po.order_date, po.expected_delivery_date,
              po.status, po.total_amount,
              COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount END), 0) AS paid_amount,
              po.total_amount - COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount END), 0) AS outstanding
         FROM purchase_orders po
         LEFT JOIN outgoing_payments p ON p.purchase_order_id = po.id AND p.tenant_id = po.tenant_id
        WHERE po.tenant_id = ? AND po.supplier_id = ?
          AND po.status NOT IN ('DRAFT', 'CANCELLED')
        GROUP BY po.id
        HAVING outstanding > 0.004
        ORDER BY po.order_date ASC`,
      [req.tenantId, supplierId]
    );
    res.json({ items: rows });
  } catch (err) {
    console.error('[finance] GET /supplier-outstanding failed:', err);
    res.status(500).json({ message: 'Failed to load supplier balances.' });
  }
});

router.post('/payments', requirePermission('finance.manage'), async (req, res) => {
  const conn = await getConnectionWithTimeZone();
  try {
    const tenantId = req.tenantId;
    const storeId = req.storeId;
    const userId = req.user?.id || null;
    const { payee_type, supplier_id, purchase_order_id, expense_id, payee_name,
            amount, payment_date, payment_method, reference, notes } = req.body || {};

    if (!PAYEE_TYPES.includes(payee_type)) return res.status(400).json({ message: 'Invalid payee type.' });
    const amt = parseAmount(amount);
    if (amt === null) return res.status(400).json({ message: 'A positive amount is required.' });
    const date = payment_date || new Date().toISOString().slice(0, 10);

    await conn.beginTransaction();

    let resolvedPayeeName = payee_name || null;
    let linkedSupplierId = null;

    if (payee_type === 'supplier') {
      if (!supplier_id) { await conn.rollback(); return res.status(400).json({ message: 'Supplier is required.' }); }
      const [sup] = await conn.query('SELECT id, supplier_name FROM suppliers WHERE id = ? AND tenant_id = ?', [supplier_id, tenantId]);
      if (!sup.length) { await conn.rollback(); return res.status(400).json({ message: 'Supplier not found.' }); }
      resolvedPayeeName = sup[0].supplier_name;
      linkedSupplierId = supplier_id;

      if (purchase_order_id) {
        // Cap at the PO's outstanding balance — overpayments against a PO
        // silently corrupt supplier balances.
        const [po] = await conn.query(
          `SELECT po.total_amount,
                  COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount END), 0) AS paid_amount
             FROM purchase_orders po
             LEFT JOIN outgoing_payments p ON p.purchase_order_id = po.id AND p.tenant_id = po.tenant_id
            WHERE po.id = ? AND po.tenant_id = ? AND po.supplier_id = ?
            GROUP BY po.id FOR UPDATE`,
          [purchase_order_id, tenantId, supplier_id]
        );
        if (!po.length) { await conn.rollback(); return res.status(400).json({ message: 'Purchase order not found for this supplier.' }); }
        const outstanding = Number(po[0].total_amount) - Number(po[0].paid_amount);
        if (amt > outstanding + 0.004) {
          await conn.rollback();
          return res.status(400).json({ message: `Amount exceeds this PO's outstanding balance (${outstanding.toFixed(2)}).` });
        }
      }
    } else if (payee_type === 'expense') {
      if (!expense_id) { await conn.rollback(); return res.status(400).json({ message: 'Expense is required.' }); }
      const [exp] = await conn.query(
        'SELECT id, payee, category, amount, status, expense_number, supplier_id FROM expenses WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [expense_id, tenantId]
      );
      if (!exp.length) { await conn.rollback(); return res.status(400).json({ message: 'Expense not found.' }); }
      if (exp[0].status !== 'unpaid') { await conn.rollback(); return res.status(400).json({ message: 'That expense is already paid.' }); }
      resolvedPayeeName = exp[0].payee || exp[0].category;
      linkedSupplierId = exp[0].supplier_id || null;
      await conn.query(
        `UPDATE expenses SET status = 'paid', payment_method = ?, reference = COALESCE(?, reference) WHERE id = ?`,
        [payment_method || null, reference || null, expense_id]
      );
    } else if (!resolvedPayeeName) {
      await conn.rollback();
      return res.status(400).json({ message: 'Payee name is required.' });
    }

    const id = uuidv4();
    const number = await docNumber(conn, 'outgoing_payments', 'payment_number', 'PAY', tenantId, new Date(date).getFullYear());
    await conn.query(
      `INSERT INTO outgoing_payments
         (id, tenant_id, store_id, payment_number, payee_type, payee_name,
          supplier_id, purchase_order_id, expense_id, amount, payment_date,
          payment_method, reference, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, storeId, number, payee_type, resolvedPayeeName,
       linkedSupplierId, purchase_order_id || null, expense_id || null, amt, date,
       payment_method || null, reference || null, notes || null, userId]
    );

    await conn.commit();
    res.status(201).json({ id, payment_number: number });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] POST /payments failed:', err);
    res.status(500).json({ message: 'Failed to record payment.' });
  } finally {
    conn.release();
  }
});

router.post('/payments/:id/void', requirePermission('finance.manage'), async (req, res) => {
  const conn = await getConnectionWithTimeZone();
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.id || null;
    const { reason } = req.body || {};

    await conn.beginTransaction();
    const [rows] = await conn.query(
      'SELECT * FROM outgoing_payments WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [req.params.id, tenantId]
    );
    if (!rows.length) { await conn.rollback(); return res.status(404).json({ message: 'Payment not found.' }); }
    const payment = rows[0];
    if (payment.status === 'voided') { await conn.rollback(); return res.status(400).json({ message: 'Payment is already voided.' }); }

    await conn.query(
      `UPDATE outgoing_payments SET status = 'voided', voided_by = ?, voided_at = NOW(), void_reason = ? WHERE id = ?`,
      [userId, reason || null, req.params.id]
    );

    // Voiding an expense payment re-opens the expense as unpaid.
    if (payment.expense_id) {
      await conn.query(
        `UPDATE expenses SET status = 'unpaid' WHERE id = ? AND tenant_id = ?`,
        [payment.expense_id, tenantId]
      );
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] POST /payments/:id/void failed:', err);
    res.status(500).json({ message: 'Failed to void payment.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
