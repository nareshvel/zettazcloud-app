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
 *   GET    /vendors / POST /vendors     supplier search + quick-add for forms
 *   GET    /expenses/export.csv         CSV export (GL/accounting hand-off)
 *   POST   /expenses/:id/approve        approver releases a pending_approval expense
 *   GET/PUT /settings                   per-tenant finance knobs (approval threshold)
 *
 * Workflows:
 *   - partial payments: an expense accrues completed payments; status is
 *     unpaid -> partial -> paid from the running paid total.
 *   - due_date: unpaid/partial rows past due surface as 'overdue'.
 *   - tax_inclusive: line amounts already include tax; tax_amount is
 *     informational and excluded from the payable.
 *   - recurring: is_recurring+recurrence_interval+next_occurrence; a
 *     platformJobs task materializes each occurrence as a new unpaid expense.
 *   - approval: when tenant_finance_settings.expense_approval_threshold is set
 *     and the amount exceeds it, creators without finance.approve get
 *     status 'pending_approval' until an approver releases it.
 *
 * Permissions: finance.view reads, finance.manage writes, finance.approve approves.
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { pool, getConnectionWithTimeZone } = require('../config/db');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { logActivity } = require('../services/auditLogService');
const rbacService = require('../services/rbacService');
const moneyPosting = require('../services/moneyPostingService');

router.use(authenticate);
router.use(requireTenantId);
router.use(requireStoreId);

const PAYEE_TYPES = ['supplier', 'expense', 'other'];
const RECURRENCE_INTERVALS = ['weekly', 'monthly', 'quarterly', 'yearly'];

function parseAmount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Ledger hooks for outgoing payments. Both run on the caller's transaction
 * so the payment row and its journal entry commit/roll back together.
 *
 * Posting model: supplier payments settle Accounts Payable (event:payable →
 * AP) — the payable was accrued by the GRN receipt entry, so cash out clears
 * the liability instead of hitting an expense line. Tenants preferring
 * cash-basis books can remap event:payable → PURCH; expense/other payments
 * keep posting Dr event:expense (OPEXP) / Cr tender.
 */
async function postOutgoingPaymentEntry(conn, tenantId, payment, userId) {
  const eventKey = payment.payee_type === 'supplier' ? 'event:payable' : 'event:expense';
  const debitAcctId = await moneyPosting.resolveAccountId(tenantId, eventKey, conn);
  const creditAcctId = await moneyPosting.tenderAccountId(conn, tenantId, payment.payment_method, 'out');
  if (!debitAcctId || !creditAcctId) {
    throw new Error('Ledger posting failed: required money account(s) are missing or inactive');
  }
  await moneyPosting.postEntry({
    tenantId,
    storeId: payment.store_id || null,
    sourceType: 'outgoing_payment',
    sourceId: payment.id,
    entryDate: payment.payment_date || undefined,
    memo: `Payment ${payment.payment_number || payment.id} — ${payment.payee_name || payment.payee_type}`,
    createdBy: userId,
    lines: [
      { accountId: debitAcctId, debit: payment.amount, credit: 0, memo: payment.payee_name || null, supplierId: payment.supplier_id || null },
      { accountId: creditAcctId, debit: 0, credit: payment.amount, memo: `Paid via ${payment.payment_method || 'unspecified'}`, supplierId: payment.supplier_id || null },
    ],
  }, conn);
}

/** Reverse the journal entry of a payment being voided (no-op if none posted). */
async function reverseOutgoingPaymentEntry(conn, tenantId, paymentId, userId) {
  const [entries] = await conn.query(
    `SELECT id FROM money_journal_entries
      WHERE tenant_id = ? AND source_type = 'outgoing_payment' AND source_id = ? AND status = 'posted'`,
    [tenantId, paymentId]
  );
  for (const e of entries) {
    await moneyPosting.reverseEntry(e.id, { tenantId, memo: 'Payment voided', createdBy: userId }, conn);
  }
}

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

/** Tenant's finance settings row (empty object when none saved). */
async function getFinanceSettings(tenantId) {
  const [rows] = await pool.query(
    'SELECT expense_approval_threshold FROM tenant_finance_settings WHERE tenant_id = ?',
    [tenantId]
  );
  return rows[0] || {};
}

/**
 * Recompute an expense's status from its completed payments:
 * none -> unpaid, some -> partial, covered -> paid.
 * Must be called inside the caller's transaction.
 */
async function syncExpensePaymentStatus(conn, tenantId, expenseId) {
  const [rows] = await conn.query(
    `SELECT e.amount, e.status,
            COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount END), 0) AS paid
       FROM expenses e
       LEFT JOIN outgoing_payments p ON p.expense_id = e.id AND p.tenant_id = e.tenant_id
      WHERE e.id = ? AND e.tenant_id = ?
      GROUP BY e.id FOR UPDATE`,
    [expenseId, tenantId]
  );
  if (!rows.length) return;
  const { amount, status, paid } = rows[0];
  if (status === 'cancelled' || status === 'pending_approval') return;
  const total = Number(amount);
  const paidAmt = Number(paid);
  const next = paidAmt >= total - 0.004 ? 'paid' : paidAmt > 0.004 ? 'partial' : 'unpaid';
  if (next !== status) {
    await conn.query('UPDATE expenses SET status = ? WHERE id = ?', [next, expenseId]);
  }
  return next;
}

/** Validate/normalize a YYYY-MM-DD date string or return null. */
const parseDate = (v) => {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

/** Next occurrence of an interval after `from` (YYYY-MM-DD). */
function advanceDate(dateStr, interval) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (interval === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (interval === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  else if (interval === 'quarterly') d.setUTCMonth(d.getUTCMonth() + 3);
  else if (interval === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Payable total. Tax-inclusive expenses carry tax inside the line amounts,
 * so tax is reported but not added to the payable.
 */
const payableTotal = (subtotal, tax, shipping, discount, taxInclusive) =>
  round2(subtotal + (taxInclusive ? 0 : tax) + shipping - discount);

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

router.get('/expenses', requirePermission('finance.view'), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { search, category, status, from, to, supplierId } = req.query;

    const where = ['e.tenant_id = ?'];
    const params = [tenantId];
    if (status === 'overdue') {
      where.push(`e.status IN ('unpaid','partial') AND e.due_date IS NOT NULL AND e.due_date < CURDATE()`);
    } else if (status) {
      where.push('e.status = ?'); params.push(status);
    }
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
              u.name AS created_by_name,
              COALESCE(paid.paid_amount, 0) AS paid_amount
         FROM expenses e
         LEFT JOIN suppliers s ON s.id = e.supplier_id
         LEFT JOIN users u ON u.id = e.created_by
         LEFT JOIN (
           SELECT expense_id, tenant_id, SUM(amount) AS paid_amount
             FROM outgoing_payments
            WHERE status = 'completed' AND expense_id IS NOT NULL
            GROUP BY expense_id, tenant_id
         ) paid ON paid.expense_id = e.id AND paid.tenant_id = e.tenant_id
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
         COALESCE(SUM(CASE WHEN status IN ('unpaid','partial') THEN amount END), 0) AS unpaid_total,
         COALESCE(SUM(CASE WHEN status IN ('unpaid','partial')
                           AND due_date IS NOT NULL AND due_date < CURDATE()
                          THEN amount END), 0) AS overdue_total,
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
    const { category, payee, description, amount, expense_date, due_date, status,
            payment_method, reference, supplier_id, notes,
            items: rawItems, tax_amount, shipping_amount, discount_amount,
            tax_inclusive, is_recurring, recurrence_interval, next_occurrence } = req.body || {};

    if (!category || !String(category).trim()) return res.status(400).json({ message: 'Category is required.' });

    // Document totals: subtotal (from line items, or the direct amount) plus
    // tax + shipping minus discount = payable `amount`. When tax_inclusive,
    // the tax is already inside the line amounts and is informational only.
    const norm = normalizeLineItems(rawItems);
    if (norm.error) return res.status(400).json({ message: norm.error });
    const lineItems = norm.items;
    const taxIncl = tax_inclusive === 1 || tax_inclusive === true || tax_inclusive === '1' || tax_inclusive === 'true';
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
    const amt = payableTotal(subtotal, tax, shipping, discount, taxIncl);
    if (amt <= 0) return res.status(400).json({ message: 'The payable total must be positive.' });

    const date = expense_date || new Date().toISOString().slice(0, 10);
    const dueDate = parseDate(due_date);

    // Recurring: the expense itself is the template — each occurrence spawns
    // a child expense and next_occurrence advances.
    const recurring = is_recurring === 1 || is_recurring === true || is_recurring === '1' || is_recurring === 'true';
    const interval = recurring && RECURRENCE_INTERVALS.includes(recurrence_interval) ? recurrence_interval : null;
    if (recurring && !interval) return res.status(400).json({ message: 'Choose a recurrence interval (weekly/monthly/quarterly/yearly).' });
    const nextOcc = recurring ? (parseDate(next_occurrence) || advanceDate(date, interval)) : null;

    // Approval gate: amounts above the tenant threshold need finance.approve
    // unless the creator already holds that permission.
    let expStatus = status === 'paid' ? 'paid' : 'unpaid';
    const settings = await getFinanceSettings(tenantId);
    const threshold = settings.expense_approval_threshold != null ? Number(settings.expense_approval_threshold) : null;
    const needsApproval = threshold !== null && amt > threshold;
    if (needsApproval) {
      const canApprove = userId
        ? await rbacService.hasPermission(userId, 'finance.approve', tenantId, storeId)
        : false;
      if (!canApprove) expStatus = 'pending_approval';
    }

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
          amount, subtotal, tax_amount, shipping_amount, discount_amount, tax_inclusive,
          expense_date, due_date, status, payment_method, reference, supplier_id, notes,
          is_recurring, recurrence_interval, next_occurrence, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, storeId, number, String(category).trim(), payee || null,
       description || lineItems[0]?.description || null,
       amt, subtotal, tax, shipping, discount, taxIncl ? 1 : 0,
       date, dueDate, expStatus, payment_method || null, reference || null, supplier_id || null, notes || null,
       recurring ? 1 : 0, interval, nextOcc, userId]
    );

    await insertLineItems(conn, tenantId, id, lineItems);

    // A paid expense is money out — mirror it into outgoing_payments so the
    // Payments page is a single ledger of everything that left the business.
    if (expStatus === 'paid') {
      const payNum = await docNumber(conn, 'outgoing_payments', 'payment_number', 'PAY', tenantId, new Date(date).getFullYear());
      const payId = uuidv4();
      await conn.query(
        `INSERT INTO outgoing_payments
           (id, tenant_id, store_id, payment_number, payee_type, payee_name,
            supplier_id, expense_id, amount, payment_date, payment_method,
            reference, notes, created_by)
         VALUES (?, ?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [payId, tenantId, storeId, payNum, payee || String(category).trim(),
         supplier_id || null, id, amt, date, payment_method || null, reference || null,
         `Expense ${number}`, userId]
      );
      await postOutgoingPaymentEntry(conn, tenantId, {
        id: payId, store_id: storeId, payment_number: payNum, payee_type: 'expense',
        payee_name: payee || String(category).trim(), supplier_id: supplier_id || null,
        amount: amt, payment_date: date, payment_method: payment_method || null,
      }, userId);
    }

    await conn.commit();
    res.status(201).json({ id, expense_number: number, status: expStatus });
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
    const { category, payee, description, amount, expense_date, due_date, status,
            payment_method, reference, supplier_id, notes,
            items: rawItems, tax_amount, shipping_amount, discount_amount,
            tax_inclusive, is_recurring, recurrence_interval, next_occurrence } = req.body || {};

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
    const taxIncl = tax_inclusive !== undefined
      ? (tax_inclusive === 1 || tax_inclusive === true || tax_inclusive === '1' || tax_inclusive === 'true')
      : !!existing.tax_inclusive;
    const tax = tax_amount !== undefined ? parseOptionalAmount(tax_amount) : Number(existing.tax_amount || 0);
    const shipping = shipping_amount !== undefined ? parseOptionalAmount(shipping_amount) : Number(existing.shipping_amount || 0);
    const discount = discount_amount !== undefined ? parseOptionalAmount(discount_amount) : Number(existing.discount_amount || 0);
    const amt = payableTotal(subtotal, tax, shipping, discount, taxIncl);
    if (amt <= 0) return res.status(400).json({ message: 'The payable total must be positive.' });

    // Recurring fields — absent keys keep stored values.
    const recurring = is_recurring !== undefined
      ? (is_recurring === 1 || is_recurring === true || is_recurring === '1' || is_recurring === 'true')
      : !!existing.is_recurring;
    const interval = recurrence_interval !== undefined
      ? (RECURRENCE_INTERVALS.includes(recurrence_interval) ? recurrence_interval : null)
      : existing.recurrence_interval;
    if (recurring && !interval) return res.status(400).json({ message: 'Choose a recurrence interval (weekly/monthly/quarterly/yearly).' });
    const effDate = expense_date || existing.expense_date;
    const nextOcc = next_occurrence !== undefined
      ? parseDate(next_occurrence)
      : (existing.next_occurrence || (recurring && interval ? advanceDate(String(effDate).slice(0, 10), interval) : null));

    // Already-paid amounts constrain status flips: 'paid' tops up the
    // remaining balance with a new payment row; 'unpaid'/'cancelled' void
    // every live payment (partial payments are 'completed' rows too).
    let expStatus = status !== undefined
      ? (status === 'paid' ? 'paid' : status === 'cancelled' ? 'cancelled' : status === 'pending_approval' ? 'pending_approval' : 'unpaid')
      : existing.status;

    // Approval gate on amount edits: raising the amount above the threshold
    // re-pends the expense for non-approvers.
    const settings = await getFinanceSettings(tenantId);
    const threshold = settings.expense_approval_threshold != null ? Number(settings.expense_approval_threshold) : null;
    if (threshold !== null && amt > threshold && existing.status !== 'pending_approval' && expStatus !== 'cancelled') {
      const canApprove = userId
        ? await rbacService.hasPermission(userId, 'finance.approve', tenantId, req.storeId)
        : false;
      if (!canApprove) expStatus = 'pending_approval';
    }

    await conn.beginTransaction();
    await conn.query(
      `UPDATE expenses SET
         category = ?, payee = ?, description = ?, amount = ?, subtotal = ?,
         tax_amount = ?, shipping_amount = ?, discount_amount = ?, tax_inclusive = ?,
         expense_date = ?, due_date = ?,
         status = ?, payment_method = ?, reference = ?, supplier_id = ?, notes = ?,
         is_recurring = ?, recurrence_interval = ?, next_occurrence = ?
       WHERE id = ?`,
      [
        category !== undefined ? String(category).trim() : existing.category,
        payee !== undefined ? payee : existing.payee,
        description !== undefined ? description : existing.description,
        amt, subtotal, tax, shipping, discount, taxIncl ? 1 : 0,
        effDate,
        due_date !== undefined ? parseDate(due_date) : existing.due_date,
        expStatus,
        payment_method !== undefined ? payment_method : existing.payment_method,
        reference !== undefined ? reference : existing.reference,
        supplier_id !== undefined ? supplier_id : existing.supplier_id,
        notes !== undefined ? notes : existing.notes,
        recurring ? 1 : 0, recurring ? interval : null, recurring ? nextOcc : null,
        req.params.id,
      ]
    );

    // Replace line items only when the caller sent a new list.
    if (lineItems !== null) {
      await conn.query('DELETE FROM expense_items WHERE expense_id = ? AND tenant_id = ?', [req.params.id, tenantId]);
      await insertLineItems(conn, tenantId, req.params.id, lineItems);
    }

    // Keep payment rows in step with the expense's paid state.
    const [links] = await conn.query(
      `SELECT id, amount, status FROM outgoing_payments
        WHERE expense_id = ? AND tenant_id = ?`, [req.params.id, tenantId]);
    const liveLinks = links.filter(l => l.status === 'completed');
    const paidSoFar = liveLinks.reduce((s, l) => s + Number(l.amount), 0);

    if (expStatus === 'paid' && paidSoFar < amt - 0.004) {
      // Top up the remaining balance with a payment row.
      const year = new Date(effDate).getFullYear();
      const payNum = await docNumber(conn, 'outgoing_payments', 'payment_number', 'PAY', tenantId, year);
      const payId = uuidv4();
      const payAmt = round2(amt - paidSoFar);
      const payMethod = payment_method !== undefined ? payment_method : existing.payment_method;
      const paySupplier = supplier_id !== undefined ? supplier_id : existing.supplier_id;
      await conn.query(
        `INSERT INTO outgoing_payments
           (id, tenant_id, store_id, payment_number, payee_type, payee_name,
            supplier_id, expense_id, amount, payment_date, payment_method,
            reference, notes, created_by)
         VALUES (?, ?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [payId, tenantId, existing.store_id, payNum,
         (payee !== undefined ? payee : existing.payee) || (category !== undefined ? category : existing.category),
         paySupplier,
         req.params.id, payAmt, effDate,
         payMethod,
         reference !== undefined ? reference : existing.reference,
         `Expense ${existing.expense_number}`, userId]
      );
      await postOutgoingPaymentEntry(conn, tenantId, {
        id: payId, store_id: existing.store_id, payment_number: payNum, payee_type: 'expense',
        payee_name: (payee !== undefined ? payee : existing.payee) || (category !== undefined ? category : existing.category),
        supplier_id: paySupplier, amount: payAmt, payment_date: effDate, payment_method: payMethod,
      }, userId);
    } else if (expStatus !== 'paid' && expStatus !== 'partial' && liveLinks.length) {
      for (const l of liveLinks) {
        await reverseOutgoingPaymentEntry(conn, tenantId, l.id, userId);
      }
      await conn.query(
        `UPDATE outgoing_payments SET status = 'voided', voided_by = ?, voided_at = NOW(),
           void_reason = 'Expense marked unpaid/cancelled'
         WHERE expense_id = ? AND tenant_id = ? AND status = 'completed'`,
        [userId, req.params.id, tenantId]
      );
    }

    // Stored status follows payment reality (raising the payable above what
    // was paid honestly demotes 'paid' to 'partial'). Cancelled and
    // pending_approval are explicit states, not derived.
    let finalStatus = expStatus;
    if (expStatus !== 'cancelled' && expStatus !== 'pending_approval') {
      finalStatus = await syncExpensePaymentStatus(conn, tenantId, req.params.id) || expStatus;
    }

    await conn.commit();
    res.json({ ok: true, status: finalStatus });
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
    // expense itself is removed. Reverse each payment's journal entry too.
    const [linked] = await conn.query(
      `SELECT id FROM outgoing_payments WHERE expense_id = ? AND tenant_id = ? AND status = 'completed'`,
      [req.params.id, tenantId]
    );
    for (const p of linked) {
      await reverseOutgoingPaymentEntry(conn, tenantId, p.id, userId);
    }
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
        `SELECT e.id, e.payee, e.category, e.amount, e.status, e.expense_number, e.supplier_id,
                COALESCE(p.paid_amount, 0) AS paid_amount
           FROM expenses e
           LEFT JOIN (
             SELECT expense_id, SUM(amount) AS paid_amount FROM outgoing_payments
              WHERE status = 'completed' AND tenant_id = ? GROUP BY expense_id
           ) p ON p.expense_id = e.id
          WHERE e.id = ? AND e.tenant_id = ? FOR UPDATE`,
        [tenantId, expense_id, tenantId]
      );
      if (!exp.length) { await conn.rollback(); return res.status(400).json({ message: 'Expense not found.' }); }
      if (!['unpaid', 'partial'].includes(exp[0].status)) {
        await conn.rollback();
        return res.status(400).json({ message: exp[0].status === 'pending_approval' ? 'That expense is awaiting approval.' : 'That expense is already paid.' });
      }
      // Partial payments allowed — cap at the remaining balance.
      const remaining = Number(exp[0].amount) - Number(exp[0].paid_amount);
      if (amt > remaining + 0.004) {
        await conn.rollback();
        return res.status(400).json({ message: `Amount exceeds the remaining balance (${remaining.toFixed(2)}).` });
      }
      resolvedPayeeName = exp[0].payee || exp[0].category;
      linkedSupplierId = exp[0].supplier_id || null;
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

    await postOutgoingPaymentEntry(conn, tenantId, {
      id, store_id: storeId, payment_number: number, payee_type,
      payee_name: resolvedPayeeName, supplier_id: linkedSupplierId,
      amount: amt, payment_date: date, payment_method: payment_method || null,
    }, userId);

    // Expense payments roll up to the expense's derived status
    // (unpaid → partial → paid).
    if (expense_id) {
      await conn.query(
        `UPDATE expenses SET payment_method = COALESCE(?, payment_method) WHERE id = ?`,
        [payment_method || null, expense_id]
      );
      await syncExpensePaymentStatus(conn, tenantId, expense_id);
    }

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

    await reverseOutgoingPaymentEntry(conn, tenantId, req.params.id, userId);

    await conn.query(
      `UPDATE outgoing_payments SET status = 'voided', voided_by = ?, voided_at = NOW(), void_reason = ? WHERE id = ?`,
      [userId, reason || null, req.params.id]
    );

    // Voiding an expense payment re-derives the expense status — it may be
    // partial rather than fully unpaid when other payments stand.
    if (payment.expense_id) {
      await syncExpensePaymentStatus(conn, tenantId, payment.expense_id);
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

// ---------------------------------------------------------------------------
// Approval — release a pending_approval expense. Optional { status: 'paid',
// payment_method, reference } settles it in the same step.
// ---------------------------------------------------------------------------

router.post('/expenses/:id/approve', requirePermission('finance.approve'), async (req, res) => {
  const conn = await getConnectionWithTimeZone();
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.id || null;
    const { status, payment_method, reference } = req.body || {};
    const approveAsPaid = status === 'paid';

    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT * FROM expenses WHERE id = ? AND tenant_id = ? FOR UPDATE`, [req.params.id, tenantId]
    );
    if (!rows.length) { await conn.rollback(); return res.status(404).json({ message: 'Expense not found.' }); }
    const exp = rows[0];
    if (exp.status !== 'pending_approval') {
      await conn.rollback();
      return res.status(400).json({ message: 'This expense is not awaiting approval.' });
    }

    const nextStatus = approveAsPaid ? 'paid' : 'unpaid';
    await conn.query(
      `UPDATE expenses SET status = ?, approved_by = ?, approved_at = NOW(),
         payment_method = COALESCE(?, payment_method), reference = COALESCE(?, reference)
       WHERE id = ?`,
      [nextStatus, userId, payment_method || null, reference || null, exp.id]
    );

    if (approveAsPaid) {
      // DATE columns come back as Date objects — normalize to YYYY-MM-DD.
      const expDate = new Date(exp.expense_date).toISOString().slice(0, 10);
      const payNum = await docNumber(conn, 'outgoing_payments', 'payment_number', 'PAY', tenantId, new Date(expDate).getUTCFullYear());
      const payId = uuidv4();
      const payMethod = payment_method || exp.payment_method || null;
      await conn.query(
        `INSERT INTO outgoing_payments
           (id, tenant_id, store_id, payment_number, payee_type, payee_name,
            supplier_id, expense_id, amount, payment_date, payment_method,
            reference, notes, created_by)
         VALUES (?, ?, ?, ?, 'expense', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [payId, tenantId, exp.store_id, payNum, exp.payee || exp.category,
         exp.supplier_id, exp.id, Number(exp.amount), expDate,
         payMethod, reference || exp.reference || null,
         `Expense ${exp.expense_number} (approved)`, userId]
      );
      await postOutgoingPaymentEntry(conn, tenantId, {
        id: payId, store_id: exp.store_id, payment_number: payNum, payee_type: 'expense',
        payee_name: exp.payee || exp.category, supplier_id: exp.supplier_id,
        amount: Number(exp.amount), payment_date: expDate, payment_method: payMethod,
      }, userId);
    }

    await conn.commit();
    res.json({ ok: true, status: nextStatus });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] POST /expenses/:id/approve failed:', err);
    res.status(500).json({ message: 'Failed to approve expense.' });
  } finally {
    conn.release();
  }
});

// ---------------------------------------------------------------------------
// Settings — per-tenant finance knobs (approval threshold today).
// ---------------------------------------------------------------------------

router.get('/settings', requirePermission('finance.view'), async (req, res) => {
  try {
    res.json(await getFinanceSettings(req.tenantId));
  } catch (err) {
    console.error('[finance] GET /settings failed:', err);
    res.status(500).json({ message: 'Failed to load finance settings.' });
  }
});

router.put('/settings', requirePermission('finance.manage'), async (req, res) => {
  try {
    const { expense_approval_threshold } = req.body || {};
    let threshold = null;
    if (expense_approval_threshold !== null && expense_approval_threshold !== undefined && expense_approval_threshold !== '') {
      const n = Number(expense_approval_threshold);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({ message: 'Threshold must be a non-negative amount, or empty to disable approval.' });
      }
      threshold = round2(n);
    }
    await pool.query(
      `INSERT INTO tenant_finance_settings (tenant_id, expense_approval_threshold)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE expense_approval_threshold = VALUES(expense_approval_threshold)`,
      [req.tenantId, threshold]
    );
    res.json({ ok: true, expense_approval_threshold: threshold });
  } catch (err) {
    console.error('[finance] PUT /settings failed:', err);
    res.status(500).json({ message: 'Failed to save finance settings.' });
  }
});

// ---------------------------------------------------------------------------
// CSV export — GL hand-off for accountants. Same filters as the list.
// ---------------------------------------------------------------------------

router.get('/expenses/export.csv', requirePermission('finance.view'), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { search, category, status, from, to } = req.query;

    const where = ["e.tenant_id = ?", "e.status != 'cancelled'"];
    // The paid-rollup subquery's tenant_id ? sits in SELECT — it binds FIRST.
    const params = [tenantId, tenantId];
    if (status === 'overdue') {
      where.push(`e.status IN ('unpaid','partial') AND e.due_date IS NOT NULL AND e.due_date < CURDATE()`);
    } else if (status) {
      where.push('e.status = ?'); params.push(status);
    }
    if (category) { where.push('e.category = ?'); params.push(category); }
    if (from) { where.push('e.expense_date >= ?'); params.push(from); }
    if (to) { where.push('e.expense_date <= ?'); params.push(to); }
    if (search) {
      where.push('(e.payee LIKE ? OR e.description LIKE ? OR e.reference LIKE ? OR e.expense_number LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    const [rows] = await pool.query(
      `SELECT e.expense_number, DATE_FORMAT(e.expense_date, '%Y-%m-%d') AS expense_date,
              DATE_FORMAT(e.due_date, '%Y-%m-%d') AS due_date, e.category, e.payee,
              s.supplier_name, e.subtotal, e.tax_amount, e.tax_inclusive,
              e.shipping_amount, e.discount_amount, e.amount,
              e.status, e.payment_method, e.reference, e.notes,
              COALESCE(paid.paid_amount, 0) AS paid_total
         FROM expenses e
         LEFT JOIN suppliers s ON s.id = e.supplier_id
         LEFT JOIN (
           SELECT expense_id, SUM(amount) AS paid_amount FROM outgoing_payments
            WHERE status = 'completed' GROUP BY expense_id
         ) paid ON paid.expense_id = e.id
        WHERE ${where.join(' AND ')}
        ORDER BY e.expense_date DESC
        LIMIT 5000`,
      params.slice(1)
    );

    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ['Expense #', 'Date', 'Due date', 'Category', 'Payee', 'Supplier',
      'Subtotal', 'Tax', 'Tax inclusive', 'Shipping', 'Discount', 'Total',
      'Paid', 'Balance', 'Status', 'Payment method', 'Reference', 'Notes'];
    const lines = [head.map(esc).join(',')];
    for (const r of rows) {
      lines.push([
        r.expense_number, r.expense_date, r.due_date, r.category, r.payee,
        r.supplier_name, r.subtotal, r.tax_amount, r.tax_inclusive ? 'yes' : 'no',
        r.shipping_amount, r.discount_amount, r.amount, r.paid_total,
        round2(Number(r.amount) - Number(r.paid_total)), r.status,
        r.payment_method, r.reference, r.notes,
      ].map(esc).join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="expenses-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(lines.join('\n'));
  } catch (err) {
    console.error('[finance] GET /expenses/export.csv failed:', err);
    res.status(500).json({ message: 'Failed to export expenses.' });
  }
});

/* ============================================================================
 * Money accounts + ledger — double-entry foundation (Phase 1)
 *
 *   GET    /accounts               list chart of accounts with live balances
 *   POST   /accounts               create a custom account (code unique/tenant)
 *   PUT    /accounts/:id           rename, set opening balance (pre-posting
 *                                  only), activate/deactivate
 *   GET    /mappings               posting map (tender:<code>, event:<name> -> account)
 *   PUT    /mappings/:key          remap a posting key to a different account
 *   GET    /ledger                 journal entries with lines; filters:
 *                                  ?account_id&source_type&from&to&limit
 *   POST   /journal                manual balanced entry (finance.manage)
 *   POST   /journal/:id/reverse    void a posted entry via a reversal entry
 *
 * Account types drive normal balance: asset/expense are debit-normal,
 * liability/equity/revenue are credit-normal. Posted entries are immutable —
 * corrections happen through reversal entries, never edits.
 * ========================================================================== */

const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];

// GET /api/finance/accounts — chart of accounts with computed balances.
router.get('/accounts', requirePermission('finance.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  try {
    await moneyPosting.ensureDefaults(tenantId); // lazily seeds pre-existing tenants
    const accounts = await moneyPosting.accountBalances(tenantId, {
      storeId: req.query.store_id || req.storeId || undefined,
    });
    res.json({ status: 'success', data: { accounts } });
  } catch (err) {
    console.error('[finance] GET /accounts failed:', err);
    res.status(500).json({ message: 'Failed to load money accounts.' });
  }
});

// POST /api/finance/accounts — create a custom account.
router.post('/accounts', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { code, name, accountType, subtype, storeId, openingBalance } = req.body || {};
  const cleanCode = String(code || '').trim().toUpperCase();
  const cleanName = String(name || '').trim();

  if (!/^[A-Z0-9][A-Z0-9_-]{0,39}$/.test(cleanCode)) {
    return res.status(400).json({ message: 'Code must be 1–40 chars: letters, digits, - or _' });
  }
  if (!cleanName || cleanName.length > 120) {
    return res.status(400).json({ message: 'Name is required (max 120 chars)' });
  }
  if (!ACCOUNT_TYPES.includes(accountType)) {
    return res.status(400).json({ message: `accountType must be one of ${ACCOUNT_TYPES.join(', ')}` });
  }
  const opening = openingBalance === undefined || openingBalance === null ? 0 : Number(openingBalance);
  if (!Number.isFinite(opening)) {
    return res.status(400).json({ message: 'openingBalance must be a number' });
  }

  try {
    const id = uuidv4();
    await pool.query(
      `INSERT INTO money_accounts
         (id, tenant_id, store_id, code, name, account_type, subtype, opening_balance, is_system, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
      [id, tenantId, storeId || null, cleanCode, cleanName, accountType, subtype || null, round2(opening)]
    );
    res.status(201).json({ status: 'success', data: { id, code: cleanCode } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: `Account code ${cleanCode} already exists` });
    }
    console.error('[finance] POST /accounts failed:', err);
    res.status(500).json({ message: 'Failed to create account.' });
  }
});

// PUT /api/finance/accounts/:id — rename, opening balance (pre-ledger only),
// activate/deactivate. Codes are immutable — postings and mappings anchor on
// them; a code change would silently re-point history.
router.put('/accounts/:id', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { id } = req.params;
  const { name, subtype, isActive, openingBalance } = req.body || {};

  try {
    const [rows] = await pool.query(
      'SELECT id, code, is_system, opening_balance FROM money_accounts WHERE id = ? AND tenant_id = ?',
      [id, tenantId]
    );
    if (!rows.length) return res.status(404).json({ message: 'Account not found' });

    const sets = [];
    const params = [];
    if (name !== undefined) {
      const cleanName = String(name).trim();
      if (!cleanName || cleanName.length > 120) {
        return res.status(400).json({ message: 'Name must be 1–120 chars' });
      }
      sets.push('name = ?'); params.push(cleanName);
    }
    if (subtype !== undefined) { sets.push('subtype = ?'); params.push(subtype || null); }
    if (isActive !== undefined) { sets.push('is_active = ?'); params.push(isActive ? 1 : 0); }

    if (openingBalance !== undefined) {
      const opening = Number(openingBalance);
      if (!Number.isFinite(opening)) {
        return res.status(400).json({ message: 'openingBalance must be a number' });
      }
      // Once postings exist, changing the opening balance would corrupt the
      // derived balance — it must go through an opening_balance journal entry.
      const [posted] = await pool.query(
        'SELECT 1 FROM money_journal_lines WHERE account_id = ? LIMIT 1',
        [id]
      );
      if (posted.length) {
        return res.status(409).json({
          message: 'This account already has posted entries — record an opening/adjustment journal instead of editing the opening balance',
        });
      }
      sets.push('opening_balance = ?'); params.push(round2(opening));
    }

    if (!sets.length) return res.status(400).json({ message: 'Nothing to update' });
    params.push(id, tenantId);
    await pool.query(`UPDATE money_accounts SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, params);
    res.json({ status: 'success' });
  } catch (err) {
    console.error('[finance] PUT /accounts/:id failed:', err);
    res.status(500).json({ message: 'Failed to update account.' });
  }
});

// GET /api/finance/mappings — posting map with resolved account info.
router.get('/mappings', requirePermission('finance.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  try {
    await moneyPosting.ensureDefaults(tenantId);
    const [rows] = await pool.query(
      `SELECT m.mapping_key, m.account_id, a.code, a.name, a.account_type, a.is_active
         FROM finance_account_mappings m
         JOIN money_accounts a ON a.id = m.account_id
        WHERE m.tenant_id = ?
        ORDER BY m.mapping_key`,
      [tenantId]
    );
    res.json({ status: 'success', data: { mappings: rows } });
  } catch (err) {
    console.error('[finance] GET /mappings failed:', err);
    res.status(500).json({ message: 'Failed to load posting mappings.' });
  }
});

// PUT /api/finance/mappings/:key — re-point a posting key at another account.
router.put('/mappings/:key', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const key = String(req.params.key || '');
  const { accountId } = req.body || {};
  if (!/^[a-z]+:[a-z0-9_]+$/i.test(key)) {
    return res.status(400).json({ message: 'Invalid mapping key' });
  }
  try {
    const [acct] = await pool.query(
      'SELECT id FROM money_accounts WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [accountId, tenantId]
    );
    if (!acct.length) return res.status(400).json({ message: 'Unknown or inactive account' });

    const [existing] = await pool.query(
      'SELECT id FROM finance_account_mappings WHERE tenant_id = ? AND mapping_key = ?',
      [tenantId, key]
    );
    if (existing.length) {
      await pool.query(
        'UPDATE finance_account_mappings SET account_id = ? WHERE tenant_id = ? AND mapping_key = ?',
        [accountId, tenantId, key]
      );
    } else {
      await pool.query(
        'INSERT INTO finance_account_mappings (id, tenant_id, mapping_key, account_id) VALUES (?, ?, ?, ?)',
        [uuidv4(), tenantId, key, accountId]
      );
    }
    res.json({ status: 'success' });
  } catch (err) {
    console.error('[finance] PUT /mappings/:key failed:', err);
    res.status(500).json({ message: 'Failed to update mapping.' });
  }
});

// GET /api/finance/ledger — journal entries with their lines.
router.get('/ledger', requirePermission('finance.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { account_id: accountId, source_type: sourceType, from, to } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const where = ['e.tenant_id = ?'];
  const params = [tenantId];
  if (sourceType) { where.push('e.source_type = ?'); params.push(sourceType); }
  if (from) { where.push('e.entry_date >= ?'); params.push(from); }
  if (to) { where.push('e.entry_date <= ?'); params.push(to); }
  if (accountId) {
    where.push(`EXISTS (SELECT 1 FROM money_journal_lines l WHERE l.entry_id = e.id AND l.account_id = ?)`);
    params.push(accountId);
  }

  try {
    const [entries] = await pool.query(
      `SELECT e.id, e.entry_number, e.entry_date, e.source_type, e.source_id,
              e.memo, e.status, e.reversal_of_id, e.store_id, e.created_at
         FROM money_journal_entries e
        WHERE ${where.join(' AND ')}
        ORDER BY e.entry_date DESC, e.created_at DESC
        LIMIT ${limit}`,
      params
    );
    if (!entries.length) return res.json({ status: 'success', data: { entries: [] } });

    const ids = entries.map((e) => e.id);
    const [lines] = await pool.query(
      `SELECT l.entry_id, l.line_no, l.account_id, l.debit, l.credit, l.memo,
              l.customer_id, l.supplier_id, a.code AS account_code, a.name AS account_name
         FROM money_journal_lines l
         JOIN money_accounts a ON a.id = l.account_id
        WHERE l.entry_id IN (${ids.map(() => '?').join(',')})
        ORDER BY l.entry_id, l.line_no`,
      ids
    );
    const byEntry = {};
    for (const l of lines) (byEntry[l.entry_id] ||= []).push(l);
    res.json({
      status: 'success',
      data: { entries: entries.map((e) => ({ ...e, lines: byEntry[e.id] || [] })) },
    });
  } catch (err) {
    console.error('[finance] GET /ledger failed:', err);
    res.status(500).json({ message: 'Failed to load ledger.' });
  }
});

// POST /api/finance/journal — manual balanced entry (corrections, opening
// balances, accruals). lines: [{accountId|accountCode, debit?, credit?, memo?}]
router.post('/journal', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { entryDate, memo, lines } = req.body || {};
  try {
    const result = await moneyPosting.postEntry({
      tenantId,
      storeId: req.storeId || null,
      entryDate,
      sourceType: 'manual',
      memo,
      createdBy: req.user.id,
      lines: (lines || []).map((l) => ({
        accountId: l.accountId || l.account_id,
        accountCode: l.accountCode || l.account_code,
        debit: l.debit,
        credit: l.credit,
        memo: l.memo,
      })),
    });
    await logActivity({
      tenant_id: tenantId,
      user_id: req.user?.id || 'system',
      username: req.user?.email || 'system',
      action_type: 'JOURNAL_POSTED',
      entity_type: 'money_journal_entry',
      entity_id: result.entryId,
      description: `Journal ${result.entryNumber} posted`,
    }).catch(() => {});
    res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    console.error('[finance] POST /journal failed:', err);
    res.status(400).json({ message: err.message || 'Failed to post journal entry.' });
  }
});

// POST /api/finance/journal/:id/reverse — void a posted entry via reversal.
router.post('/journal/:id/reverse', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  try {
    const result = await moneyPosting.reverseEntry(req.params.id, {
      tenantId,
      memo: req.body?.memo,
      createdBy: req.user.id,
    });
    await logActivity({
      tenant_id: tenantId,
      user_id: req.user?.id || 'system',
      username: req.user?.email || 'system',
      action_type: 'JOURNAL_REVERSED',
      entity_type: 'money_journal_entry',
      entity_id: req.params.id,
      description: `Journal entry ${req.params.id} reversed as ${result.entryNumber}`,
    }).catch(() => {});
    res.status(201).json({ status: 'success', data: result });
  } catch (err) {
    console.error('[finance] POST /journal/:id/reverse failed:', err);
    const status = /not found/i.test(err.message) ? 404 : /already voided/i.test(err.message) ? 409 : 400;
    res.status(status).json({ message: err.message || 'Failed to reverse entry.' });
  }
});

// ---------------------------------------------------------------------------
// Cash drawer sessions — open float → paid in/out → close with counted vs
// expected variance. Expected cash is derived from the drawer's ledger lines
// for this store during the session window; the journal stays authoritative.
// ---------------------------------------------------------------------------

/** Live expected cash for an open session: float + ledger activity since open.
 *  drawer_open entries are excluded — the float is added via opening_float,
 *  so counting its journal leg too would double-count it. */
async function drawerExpectedCash(conn, tenantId, session) {
  const [rows] = await conn.query(
    `SELECT COALESCE(SUM(l.debit - l.credit), 0) AS net
       FROM money_journal_lines l
       JOIN money_journal_entries e ON e.id = l.entry_id AND e.tenant_id = l.tenant_id
      WHERE l.tenant_id = ? AND l.account_id = ?
        AND e.store_id = ? AND e.created_at >= ?
        AND e.source_type <> 'drawer_open'`,
    [tenantId, session.account_id, session.store_id, session.opened_at]
  );
  return round2(Number(session.opening_float) + Number(rows[0].net));
}

/** Default drawer account: the account cash sales actually post to (tender:cash
 *  mapping), else a store-scoped cash_drawer account, else the tenant cash-in
 *  default. Binding the session to the tender account keeps expected-cash
 *  correct — sales journal legs land on whatever tender:cash maps to, so the
 *  drawer must measure that same account. */
async function resolveDrawerAccount(conn, tenantId, storeId, explicitId) {
  if (explicitId) {
    const [rows] = await conn.query(
      'SELECT id FROM money_accounts WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [explicitId, tenantId]
    );
    return rows.length ? rows[0].id : null;
  }
  const tenderCash = await moneyPosting.resolveAccountId(tenantId, 'tender:cash', conn);
  if (tenderCash) return tenderCash;
  const [storeAcct] = await conn.query(
    `SELECT id FROM money_accounts
      WHERE tenant_id = ? AND store_id = ? AND subtype = 'cash_drawer' AND is_active = 1
      LIMIT 1`,
    [tenantId, storeId]
  );
  if (storeAcct.length) return storeAcct[0].id;
  return moneyPosting.resolveAccountId(tenantId, 'event:default_in', conn);
}

// GET /api/finance/drawer-sessions — session history (most recent first).
router.get('/drawer-sessions', requirePermission('register.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { status, store_id: storeId } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  try {
    const where = ['s.tenant_id = ?'];
    const params = [tenantId];
    if (status) { where.push('s.status = ?'); params.push(status); }
    if (storeId) { where.push('s.store_id = ?'); params.push(storeId); }
    const [rows] = await pool.query(
      `SELECT s.id, s.store_id, s.account_id, s.opening_float, s.opened_at, s.opened_by,
              s.closed_at, s.closed_by, s.counted_cash, s.expected_cash, s.variance,
              s.status, s.notes, a.code AS account_code, a.name AS account_name,
              st.name AS store_name,
              ou.name AS opened_by_name, cu.name AS closed_by_name
         FROM cash_drawer_sessions s
         JOIN money_accounts a ON a.id = s.account_id
         LEFT JOIN stores st ON st.id = s.store_id
         LEFT JOIN users ou ON ou.id = s.opened_by
         LEFT JOIN users cu ON cu.id = s.closed_by
        WHERE ${where.join(' AND ')}
        ORDER BY s.opened_at DESC
        LIMIT ${limit}`,
      params
    );
    res.json({ status: 'success', data: { sessions: rows } });
  } catch (err) {
    console.error('[finance] GET /drawer-sessions failed:', err);
    res.status(500).json({ message: 'Failed to load drawer sessions.' });
  }
});

// GET /api/finance/drawer-sessions/current?store_id= — the open session for a
// store, with live expected cash and its movement list.
router.get('/drawer-sessions/current', requirePermission('register.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const storeId = req.query.store_id || req.storeId;
  if (!storeId) return res.status(400).json({ message: 'store_id is required.' });
  try {
    const [rows] = await pool.query(
      `SELECT s.*, a.code AS account_code, a.name AS account_name
         FROM cash_drawer_sessions s JOIN money_accounts a ON a.id = s.account_id
        WHERE s.tenant_id = ? AND s.store_id = ? AND s.status = 'open'`,
      [tenantId, storeId]
    );
    if (!rows.length) return res.json({ status: 'success', data: { session: null } });
    const session = rows[0];
    const [movements] = await pool.query(
      `SELECT m.*, u.name AS created_by_name
         FROM money_drawer_movements m LEFT JOIN users u ON u.id = m.created_by
        WHERE m.session_id = ? ORDER BY m.created_at`,
      [session.id]
    );
    const expectedCash = await drawerExpectedCash(pool, tenantId, session);
    res.json({ status: 'success', data: { session: { ...session, expected_cash_live: expectedCash }, movements } });
  } catch (err) {
    console.error('[finance] GET /drawer-sessions/current failed:', err);
    res.status(500).json({ message: 'Failed to load current drawer session.' });
  }
});

// GET /api/finance/drawer-sessions/status?store_id= — open/closed flag only.
// Deliberately no financial figures: leaking expected_cash here would defeat
// blind close. Reachable by ANY register.* holder (or finance.*) so a cashier
// with open/close/movement but no register.view can still tell whether the
// register needs opening — that user can't reach /current at all.
router.get('/drawer-sessions/status', async (req, res) => {
  const tenantId = req.user.tenant_id;
  const storeId = req.query.store_id || req.storeId;
  if (!storeId) return res.status(400).json({ message: 'store_id is required.' });
  try {
    const REGISTER_PERMS = [
      'register.view', 'register.open', 'register.movement', 'register.close',
      'finance.view', 'finance.manage',
    ];
    let allowed = false;
    for (const p of REGISTER_PERMS) {
      if (await rbacService.hasPermission(req.user.id, p, tenantId, storeId)) { allowed = true; break; }
    }
    if (!allowed) {
      return res.status(403).json({ message: 'Access denied. A register.* or finance.* permission is required.' });
    }
    const [rows] = await pool.query(
      `SELECT s.id, s.session_no, s.opened_at, u.name AS opened_by_name
         FROM cash_drawer_sessions s LEFT JOIN users u ON u.id = s.opened_by
        WHERE s.tenant_id = ? AND s.store_id = ? AND s.status = 'open'`,
      [tenantId, storeId]
    );
    res.json({ status: 'success', data: { open: rows.length > 0, session: rows[0] || null } });
  } catch (err) {
    console.error('[finance] GET /drawer-sessions/status failed:', err);
    res.status(500).json({ message: 'Failed to check register status.' });
  }
});

// POST /api/finance/drawer-sessions — open a drawer for the store.
router.post('/drawer-sessions', requirePermission('register.open'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const userId = req.user?.id || null;
  const storeId = req.body?.storeId || req.storeId;
  const openingFloat = Number(req.body?.openingFloat ?? req.body?.opening_float) || 0;
  if (!storeId) return res.status(400).json({ message: 'storeId is required.' });
  if (openingFloat < 0) return res.status(400).json({ message: 'openingFloat cannot be negative.' });

  const conn = await getConnectionWithTimeZone();
  try {
    await conn.beginTransaction();
    const accountId = await resolveDrawerAccount(conn, tenantId, storeId, req.body?.accountId);
    if (!accountId) { await conn.rollback(); return res.status(400).json({ message: 'No usable cash account — create one under Money Accounts first.' }); }

    const id = uuidv4();
    // Session number is a display/audit label, not a uniqueness constraint —
    // uq_drawer_open already serializes opens per store. Concurrent opens at
    // two stores may collide on the number; acceptable for a sequence label.
    const [numRows] = await conn.query(
      `SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(session_no, '-', -1) AS UNSIGNED)), 0) + 1 AS next_no
         FROM cash_drawer_sessions WHERE tenant_id = ?`,
      [tenantId]
    );
    const sessionNo = `REG-${String(numRows[0].next_no).padStart(4, '0')}`;
    await conn.query(
      `INSERT INTO cash_drawer_sessions
         (id, session_no, tenant_id, store_id, account_id, opening_float, opened_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, sessionNo, tenantId, storeId, accountId, round2(openingFloat), userId, req.body?.notes || null]
    );

    // Journal the float so the drawer account's ledger balance reflects it:
    // Dr drawer / Cr funding source. The float normally comes out of the
    // store safe — pass body.sourceAccountId to fund it from elsewhere.
    // Skipped (not an error) when no distinct counterpart exists — the
    // session row still carries the float for expected-cash math.
    if (openingFloat > 0) {
      const counterpart = req.body?.sourceAccountId
        ? await resolveDrawerAccount(conn, tenantId, storeId, req.body.sourceAccountId)
        : await moneyPosting.resolveAccountId(tenantId, 'SAFE', conn);
      if (counterpart && counterpart !== accountId) {
        await moneyPosting.postEntry({
          tenantId, storeId,
          sourceType: 'drawer_open', sourceId: id,
          memo: `Drawer opening float`,
          createdBy: userId,
          lines: [
            { accountId, debit: round2(openingFloat), credit: 0, memo: 'Opening float' },
            { accountId: counterpart, debit: 0, credit: round2(openingFloat), memo: 'Opening float funding' },
          ],
        }, conn);
      }
    }
    await conn.commit();
    res.status(201).json({ status: 'success', data: { id } });
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'This store already has an open drawer session.' });
    }
    console.error('[finance] POST /drawer-sessions failed:', err);
    res.status(500).json({ message: 'Failed to open drawer session.' });
  } finally {
    conn.release();
  }
});

// POST /api/finance/drawer-sessions/:id/movements — paid-in / paid-out.
// paid_out: Dr expense-side (or counterpartAccountId) / Cr drawer.
// paid_in:  Dr drawer / Cr counterpart (default SAFE).
router.post('/drawer-sessions/:id/movements', requirePermission('register.movement'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const userId = req.user?.id || null;
  const direction = req.body?.direction;
  const amount = Number(req.body?.amount);
  if (!['paid_in', 'paid_out'].includes(direction)) return res.status(400).json({ message: 'direction must be paid_in or paid_out.' });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'amount must be a positive number.' });

  const conn = await getConnectionWithTimeZone();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT * FROM cash_drawer_sessions WHERE id = ? AND tenant_id = ? AND status = 'open' FOR UPDATE`,
      [req.params.id, tenantId]
    );
    if (!rows.length) { await conn.rollback(); return res.status(404).json({ message: 'Open drawer session not found.' }); }
    const session = rows[0];

    let lines;
    if (direction === 'paid_out') {
      const dr = req.body?.counterpartAccountId
        ? await resolveDrawerAccount(conn, tenantId, session.store_id, req.body.counterpartAccountId)
        : await moneyPosting.resolveAccountId(tenantId, 'event:expense', conn);
      if (!dr) { await conn.rollback(); return res.status(400).json({ message: 'No expense account available for the paid-out.' }); }
      lines = [
        { accountId: dr, debit: amount, credit: 0, memo: req.body?.reason || 'Drawer paid-out' },
        { accountId: session.account_id, debit: 0, credit: amount, memo: req.body?.reason || 'Drawer paid-out' },
      ];
    } else {
      const cr = req.body?.counterpartAccountId
        ? await resolveDrawerAccount(conn, tenantId, session.store_id, req.body.counterpartAccountId)
        : await moneyPosting.resolveAccountId(tenantId, 'SAFE', conn);
      if (!cr) { await conn.rollback(); return res.status(400).json({ message: 'No source account for the paid-in — pass counterpartAccountId.' }); }
      lines = [
        { accountId: session.account_id, debit: amount, credit: 0, memo: req.body?.reason || 'Drawer paid-in' },
        { accountId: cr, debit: 0, credit: amount, memo: req.body?.reason || 'Drawer paid-in' },
      ];
    }

    const movementId = uuidv4();
    const entry = await moneyPosting.postEntry({
      tenantId,
      storeId: session.store_id,
      sourceType: direction === 'paid_out' ? 'drawer_paid_out' : 'drawer_paid_in',
      sourceId: movementId,
      memo: `Drawer ${direction === 'paid_out' ? 'paid-out' : 'paid-in'} — ${req.body?.reason || ''}`.trim(),
      createdBy: userId,
      lines,
    }, conn);

    await conn.query(
      `INSERT INTO money_drawer_movements
         (id, tenant_id, session_id, direction, amount, reason, journal_entry_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [movementId, tenantId, session.id, direction, round2(amount), req.body?.reason || null, entry.entryId, userId]
    );

    await conn.commit();
    res.status(201).json({ status: 'success', data: { id: movementId, entryNumber: entry.entryNumber } });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] POST /drawer-sessions/:id/movements failed:', err);
    res.status(500).json({ message: err.message || 'Failed to record drawer movement.' });
  } finally {
    conn.release();
  }
});

// POST /api/finance/drawer-sessions/:id/close — count the drawer, post the
// variance to Cash Over/Short, mark the session closed.
router.post('/drawer-sessions/:id/close', requirePermission('register.close'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const userId = req.user?.id || null;
  const counted = Number(req.body?.countedCash ?? req.body?.counted_cash);
  if (!Number.isFinite(counted) || counted < 0) return res.status(400).json({ message: 'countedCash must be a non-negative number.' });

  const conn = await getConnectionWithTimeZone();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT * FROM cash_drawer_sessions WHERE id = ? AND tenant_id = ? AND status = 'open' FOR UPDATE`,
      [req.params.id, tenantId]
    );
    if (!rows.length) { await conn.rollback(); return res.status(404).json({ message: 'Open drawer session not found.' }); }
    const session = rows[0];

    const expected = await drawerExpectedCash(conn, tenantId, session);
    const variance = round2(counted - expected); // negative = short

    let varianceEntry = null;
    if (Math.abs(variance) >= 0.005) {
      const overshort = await moneyPosting.resolveAccountId(tenantId, 'event:over_short', conn);
      if (overshort) {
        // Short (counted < expected): Dr OVERSHORT / Cr drawer — the missing
        // cash is expensed. Over: Dr drawer / Cr OVERSHORT — the extra cash
        // is booked against the same account (negative expense = income).
        varianceEntry = await moneyPosting.postEntry({
          tenantId,
          storeId: session.store_id,
          sourceType: 'drawer_variance',
          sourceId: session.id,
          memo: `Drawer close variance — ${variance < 0 ? 'short' : 'over'} ${Math.abs(variance).toFixed(2)}`,
          createdBy: userId,
          lines: variance < 0
            ? [
                { accountId: overshort, debit: -variance, credit: 0, memo: 'Cash short' },
                { accountId: session.account_id, debit: 0, credit: -variance, memo: 'Counted below expected' },
              ]
            : [
                { accountId: session.account_id, debit: variance, credit: 0, memo: 'Counted above expected' },
                { accountId: overshort, debit: 0, credit: variance, memo: 'Cash over' },
              ],
        }, conn);
      }
    }

    await conn.query(
      `UPDATE cash_drawer_sessions
          SET status = 'closed', closed_at = NOW(), closed_by = ?,
              counted_cash = ?, expected_cash = ?, variance = ?
        WHERE id = ?`,
      [userId, round2(counted), expected, variance, session.id]
    );

    await conn.commit();
    res.json({ status: 'success', data: { expectedCash: expected, countedCash: round2(counted), variance, varianceEntry: varianceEntry?.entryNumber || null } });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] POST /drawer-sessions/:id/close failed:', err);
    res.status(500).json({ message: 'Failed to close drawer session.' });
  } finally {
    conn.release();
  }
});

// GET /api/finance/drawer-sessions/:id/report — X-report for an open session,
// Z-report once closed. One endpoint for both: the report payload is the same,
// reportType tells the caller which label to print.
router.get('/drawer-sessions/:id/report', requirePermission('register.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  try {
    const [sessions] = await pool.query(
      `SELECT s.*, a.code AS account_code, a.name AS account_name, st.name AS store_name,
              u1.name AS opened_by_name, u2.name AS closed_by_name
         FROM cash_drawer_sessions s
         LEFT JOIN money_accounts a ON a.id = s.account_id
         LEFT JOIN stores st ON st.id = s.store_id
         LEFT JOIN users u1 ON u1.id = s.opened_by
         LEFT JOIN users u2 ON u2.id = s.closed_by
        WHERE s.id = ? AND s.tenant_id = ?`,
      [req.params.id, tenantId]
    );
    if (!sessions.length) return res.status(404).json({ message: 'Session not found.' });
    const session = sessions[0];
    const windowEnd = session.status === 'closed' && session.closed_at ? session.closed_at : new Date();

    const [movements] = await pool.query(
      `SELECT m.*, u.name AS created_by_name
         FROM money_drawer_movements m LEFT JOIN users u ON u.id = m.created_by
        WHERE m.tenant_id = ? AND m.session_id = ? ORDER BY m.created_at`,
      [tenantId, session.id]
    );

    // Tender mix across the session window — payment legs carry the real
    // method on split tenders; resolved by method id or code.
    const [tenders] = await pool.query(
      `SELECT COALESCE(pm.code, pt.payment_method_id) AS method_code,
              COALESCE(pm.name, pt.payment_method_id) AS method_name,
              SUM(pt.amount) AS total, COUNT(DISTINCT pt.sale_id) AS txns
         FROM payment_transactions pt
         JOIN sales s ON s.id = pt.sale_id AND s.tenant_id = pt.tenant_id
         LEFT JOIN payment_methods pm
                ON pm.tenant_id = pt.tenant_id
               AND (pm.id = pt.payment_method_id OR pm.code = pt.payment_method_id)
        WHERE pt.tenant_id = ? AND s.store_id = ? AND pt.status = 'COMPLETED'
          AND pt.created_at BETWEEN ? AND ?
        GROUP BY method_code, method_name
        ORDER BY total DESC`,
      [tenantId, session.store_id, session.opened_at, windowEnd]
    );

    const [salesAgg] = await pool.query(
      `SELECT COUNT(*) AS sale_count, COALESCE(SUM(total), 0) AS gross
         FROM sales
        WHERE tenant_id = ? AND store_id = ? AND status = 'completed'
          AND created_at BETWEEN ? AND ?`,
      [tenantId, session.store_id, session.opened_at, windowEnd]
    );

    const expected = session.status === 'closed'
      ? Number(session.expected_cash)
      : await drawerExpectedCash(pool, tenantId, session);

    res.json({
      status: 'success',
      data: {
        reportType: session.status === 'closed' ? 'z' : 'x',
        session,
        movements,
        tenders,
        salesCount: Number(salesAgg[0].sale_count),
        grossSales: Number(salesAgg[0].gross),
        expectedCashLive: expected,
      },
    });
  } catch (err) {
    console.error('[finance] GET /drawer-sessions/:id/report failed:', err);
    res.status(500).json({ message: 'Failed to build register report.' });
  }
});

// POST /api/finance/transfers — move money between accounts (drawer → safe →
// bank deposit). A balanced two-line entry, source_type 'transfer'.
router.post('/transfers', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { fromAccountId, toAccountId, amount, memo, entryDate, storeId } = req.body || {};
  const amt = Number(amount);
  if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
    return res.status(400).json({ message: 'Choose two different accounts.' });
  }
  if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ message: 'amount must be a positive number.' });

  const conn = await getConnectionWithTimeZone();
  try {
    await conn.beginTransaction();
    const [accts] = await conn.query(
      `SELECT id, code, name FROM money_accounts
        WHERE tenant_id = ? AND is_active = 1 AND id IN (?, ?)`,
      [tenantId, fromAccountId, toAccountId]
    );
    if (accts.length !== 2) { await conn.rollback(); return res.status(400).json({ message: 'Unknown or inactive account.' }); }
    const from = accts.find(a => a.id === fromAccountId);
    const to = accts.find(a => a.id === toAccountId);

    const entry = await moneyPosting.postEntry({
      tenantId,
      storeId: storeId || req.storeId || null,
      entryDate,
      sourceType: 'transfer',
      sourceId: uuidv4(),
      memo: memo || `Transfer ${from.code} → ${to.code}`,
      createdBy: req.user?.id || null,
      lines: [
        { accountId: toAccountId, debit: round2(amt), credit: 0, memo: `From ${from.name}` },
        { accountId: fromAccountId, debit: 0, credit: round2(amt), memo: `To ${to.name}` },
      ],
    }, conn);

    await conn.commit();
    res.status(201).json({ status: 'success', data: entry });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] POST /transfers failed:', err);
    res.status(500).json({ message: 'Failed to record transfer.' });
  } finally {
    conn.release();
  }
});

// ---------------------------------------------------------------------------
// Reports — cash-flow statement, profit & loss, journal CSV export.
// All derived from the ledger: balances are computed per period with
// opening/closing windows, so reports stay correct even with reversals.
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/finance/reports/cash-flow?from=&to=&store_id=
// Per asset account (the money buckets): opening balance, money in (Σdebit),
// money out (Σcredit), net change, closing — plus a by-source-type summary.
router.get('/reports/cash-flow', requirePermission('finance.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { from, to, store_id: storeId } = req.query;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return res.status(400).json({ message: 'from/to must be YYYY-MM-DD' });
  }
  try {
    const acctWhere = ["a.tenant_id = ?", "a.account_type = 'asset'"];
    const acctParams = [tenantId];
    if (storeId) { acctWhere.push('(a.store_id = ? OR a.store_id IS NULL)'); acctParams.push(storeId); }
    const [accounts] = await pool.query(
      `SELECT a.id, a.code, a.name, a.subtype, a.opening_balance, a.store_id
         FROM money_accounts a WHERE ${acctWhere.join(' AND ')}
        ORDER BY a.code`,
      acctParams
    );

    // Lines joined to entries (entries carry store_id + entry_date). The
    // line-level filter selects lines on these accounts; the entry-level
    // filter optionally scopes to a store.
    // Note: the six date placeholders sit in the SELECT list, which binds
    // textually BEFORE the WHERE params — tenantId comes last.
    const lineWhere = ['l.tenant_id = ?', "a.account_type = 'asset'"];
    const lineParams = [tenantId];
    if (storeId) { lineWhere.push('(a.store_id = ? OR a.store_id IS NULL)', 'e.store_id = ?'); lineParams.push(storeId, storeId); }
    const [periodRows] = await pool.query(
      `SELECT l.account_id,
              SUM(IF(e.entry_date < ?, l.debit, 0))  AS open_debit,
              SUM(IF(e.entry_date < ?, l.credit, 0)) AS open_credit,
              SUM(IF(e.entry_date BETWEEN ? AND ?, l.debit, 0))  AS in_flow,
              SUM(IF(e.entry_date BETWEEN ? AND ?, l.credit, 0)) AS out_flow
         FROM money_journal_lines l
         JOIN money_journal_entries e ON e.id = l.entry_id
         JOIN money_accounts a ON a.id = l.account_id
        WHERE ${lineWhere.join(' AND ')}
        GROUP BY l.account_id`,
      [from || '1970-01-01', from || '1970-01-01',
       from || '1970-01-01', to || '9999-12-31',
       from || '1970-01-01', to || '9999-12-31',
       ...lineParams]
    );

    const bySourceWhere = ['e.tenant_id = ?'];
    const bySourceParams = [tenantId];
    if (storeId) { bySourceWhere.push('e.store_id = ?'); bySourceParams.push(storeId); }
    if (from) { bySourceWhere.push('e.entry_date >= ?'); bySourceParams.push(from); }
    if (to) { bySourceWhere.push('e.entry_date <= ?'); bySourceParams.push(to); }
    const [bySource] = await pool.query(
      `SELECT e.source_type,
              SUM(IF(a.account_type = 'asset', l.debit, 0))  AS money_in,
              SUM(IF(a.account_type = 'asset', l.credit, 0)) AS money_out
         FROM money_journal_entries e
         JOIN money_journal_lines l ON l.entry_id = e.id
         JOIN money_accounts a ON a.id = l.account_id
        WHERE ${bySourceWhere.join(' AND ')}
        GROUP BY e.source_type`,
      bySourceParams
    );

    const perAcct = Object.fromEntries(periodRows.map(r => [r.account_id, r]));
    const rows = accounts.map(a => {
      const p = perAcct[a.id] || {};
      const opening = round2(Number(a.opening_balance) + Number(p.open_debit || 0) - Number(p.open_credit || 0));
      const inflow = round2(Number(p.in_flow || 0));
      const outflow = round2(Number(p.out_flow || 0));
      return {
        id: a.id, code: a.code, name: a.name, subtype: a.subtype, store_id: a.store_id,
        opening, inflow, outflow, closing: round2(opening + inflow - outflow),
      };
    });
    res.json({
      status: 'success',
      data: {
        from: from || null, to: to || null,
        accounts: rows,
        bySource,
        totals: {
          opening: round2(rows.reduce((s, r) => s + r.opening, 0)),
          inflow: round2(rows.reduce((s, r) => s + r.inflow, 0)),
          outflow: round2(rows.reduce((s, r) => s + r.outflow, 0)),
          closing: round2(rows.reduce((s, r) => s + r.closing, 0)),
        },
      },
    });
  } catch (err) {
    console.error('[finance] GET /reports/cash-flow failed:', err);
    res.status(500).json({ message: 'Failed to build cash-flow report.' });
  }
});

// GET /api/finance/reports/profit-loss?from=&to=
// Revenue and expense accounts with period activity. Revenue-type accounts
// are credit-normal (SALESRET shows negative automatically). Net profit =
// revenue − expenses.
router.get('/reports/profit-loss', requirePermission('finance.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { from, to, store_id: storeId } = req.query;
  if ((from && !DATE_RE.test(from)) || (to && !DATE_RE.test(to))) {
    return res.status(400).json({ message: 'from/to must be YYYY-MM-DD' });
  }
  const where = ['l.tenant_id = ?', "a.account_type IN ('revenue','expense')"];
  const params = [tenantId];
  if (from) { where.push('e.entry_date >= ?'); params.push(from); }
  if (to) { where.push('e.entry_date <= ?'); params.push(to); }
  if (storeId) { where.push('e.store_id = ?'); params.push(storeId); }
  try {
    const [rows] = await pool.query(
      `SELECT a.id, a.code, a.name, a.account_type, a.subtype,
              SUM(l.debit) AS total_debit, SUM(l.credit) AS total_credit
         FROM money_journal_lines l
         JOIN money_journal_entries e ON e.id = l.entry_id
         JOIN money_accounts a ON a.id = l.account_id
        WHERE ${where.join(' AND ')}
        GROUP BY a.id
        ORDER BY a.account_type DESC, a.code`,
      params
    );
    const revenue = [];
    const expenses = [];
    for (const r of rows) {
      const signed = round2(Number(r.total_debit) - Number(r.total_credit));
      const amount = r.account_type === 'revenue' ? -signed : signed; // normal-side balance
      const item = { code: r.code, name: r.name, subtype: r.subtype, amount };
      (r.account_type === 'revenue' ? revenue : expenses).push(item);
    }
    const totalRevenue = round2(revenue.reduce((s, r) => s + r.amount, 0));
    const totalExpenses = round2(expenses.reduce((s, r) => s + r.amount, 0));
    res.json({
      status: 'success',
      data: {
        from: from || null, to: to || null,
        revenue, expenses, totalRevenue, totalExpenses,
        netProfit: round2(totalRevenue - totalExpenses),
      },
    });
  } catch (err) {
    console.error('[finance] GET /reports/profit-loss failed:', err);
    res.status(500).json({ message: 'Failed to build profit & loss report.' });
  }
});

// ---------------------------------------------------------------------------
// Customer account payments — collect against a customer's on-account (AR)
// balance. Every row posts Dr tender / Cr AR and decrements
// customers.outstanding_credit, all in one transaction. Voids reverse the
// entry and put the amount back on the balance — never hard-deleted.
// ---------------------------------------------------------------------------

// GET /api/finance/customer-payments?customer_id=&status=
router.get('/customer-payments', requirePermission('finance.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { customer_id: customerId, status } = req.query;
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  try {
    const where = ['p.tenant_id = ?'];
    const params = [tenantId];
    if (customerId) { where.push('p.customer_id = ?'); params.push(customerId); }
    if (status) { where.push('p.status = ?'); params.push(status); }
    const [rows] = await pool.query(
      `SELECT p.*, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
              c.company_name AS customer_company, u.name AS received_by_name,
              e.entry_number AS journal_entry_number
         FROM customer_account_payments p
         LEFT JOIN customers c ON c.id = p.customer_id
         LEFT JOIN users u ON u.id = p.received_by
         LEFT JOIN money_journal_entries e ON e.id = p.journal_entry_id
        WHERE ${where.join(' AND ')}
        ORDER BY p.created_at DESC
        LIMIT ${limit}`,
      params
    );
    res.json({ status: 'success', data: { payments: rows } });
  } catch (err) {
    console.error('[finance] GET /customer-payments failed:', err);
    res.status(500).json({ message: 'Failed to load customer payments.' });
  }
});

// POST /api/finance/customer-payments — collect an on-account payment.
// { customerId, amount, paymentMethod, reference?, notes?, storeId? }
router.post('/customer-payments', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const userId = req.user?.id || null;
  const storeId = req.body?.storeId || req.storeId || null;
  const { customerId } = req.body || {};
  const amount = round2(Number(req.body?.amount));
  const method = String(req.body?.paymentMethod || req.body?.payment_method || 'cash').toLowerCase();

  if (!customerId) return res.status(400).json({ message: 'customerId is required.' });
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: 'amount must be a positive number.' });

  const conn = await getConnectionWithTimeZone();
  try {
    await conn.beginTransaction();

    const [[customer]] = await conn.query(
      'SELECT id, outstanding_credit FROM customers WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [customerId, tenantId]
    );
    if (!customer) { await conn.rollback(); return res.status(404).json({ message: 'Customer not found.' }); }

    const dr = await moneyPosting.tenderAccountId(conn, tenantId, method, 'in');
    const cr = await moneyPosting.resolveAccountId(tenantId, 'event:receivable', conn);
    if (!dr || !cr) { await conn.rollback(); return res.status(500).json({ message: 'Ledger posting failed: money account(s) missing.' }); }

    const id = uuidv4();
    const entry = await moneyPosting.postEntry({
      tenantId, storeId,
      sourceType: 'payment_received', sourceId: id,
      memo: `Payment received on account${req.body?.reference ? ` — ${req.body.reference}` : ''}`,
      createdBy: userId,
      lines: [
        { accountId: dr, debit: amount, credit: 0, memo: `Tender — ${method}`, customerId },
        { accountId: cr, debit: 0, credit: amount, memo: 'On-account payment received', customerId },
      ],
    }, conn);

    await conn.query(
      `INSERT INTO customer_account_payments
         (id, tenant_id, store_id, customer_id, amount, payment_method, reference, notes, journal_entry_id, received_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, tenantId, storeId, customerId, amount, method,
       req.body?.reference || null, req.body?.notes || null, entry.entryId, userId]
    );

    await conn.query(
      'UPDATE customers SET outstanding_credit = outstanding_credit - ? WHERE id = ? AND tenant_id = ?',
      [amount, customerId, tenantId]
    );

    await conn.commit();
    res.status(201).json({
      status: 'success',
      data: {
        id,
        entryNumber: entry.entryNumber,
        outstandingCredit: round2(Number(customer.outstanding_credit || 0) - amount),
      },
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] POST /customer-payments failed:', err);
    res.status(500).json({ message: 'Failed to record customer payment.' });
  } finally {
    conn.release();
  }
});

// POST /api/finance/customer-payments/:id/void — reverse the journal entry and
// put the amount back on the customer's balance (payment never happened).
router.post('/customer-payments/:id/void', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const userId = req.user?.id || null;
  const reason = req.body?.reason || 'Payment voided';
  const conn = await getConnectionWithTimeZone();
  try {
    await conn.beginTransaction();
    const [[payment]] = await conn.query(
      'SELECT * FROM customer_account_payments WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [req.params.id, tenantId]
    );
    if (!payment) { await conn.rollback(); return res.status(404).json({ message: 'Payment not found.' }); }
    if (payment.status === 'voided') { await conn.rollback(); return res.status(400).json({ message: 'Payment is already voided.' }); }

    if (payment.journal_entry_id) {
      await moneyPosting.reverseEntry(payment.journal_entry_id, {
        tenantId, memo: `Void: ${reason}`, createdBy: userId,
      }, conn);
    }

    await conn.query(
      'UPDATE customers SET outstanding_credit = outstanding_credit + ? WHERE id = ? AND tenant_id = ?',
      [payment.amount, payment.customer_id, tenantId]
    );
    await conn.query(
      `UPDATE customer_account_payments
          SET status = 'voided', voided_by = ?, voided_at = NOW(), void_reason = ?
        WHERE id = ?`,
      [userId, reason, req.params.id]
    );

    await conn.commit();
    res.json({ status: 'success' });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] POST /customer-payments/:id/void failed:', err);
    res.status(500).json({ message: 'Failed to void customer payment.' });
  } finally {
    conn.release();
  }
});

// GET /api/finance/ledger/export.csv — flat journal-lines CSV for accountants.
// Same filters as GET /ledger.
router.get('/ledger/export.csv', requirePermission('finance.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { account_id: accountId, source_type: sourceType, from, to } = req.query;
  const where = ['e.tenant_id = ?'];
  const params = [tenantId];
  if (req.query.store_id) { where.push('e.store_id = ?'); params.push(req.query.store_id); }
  if (sourceType) { where.push('e.source_type = ?'); params.push(sourceType); }
  if (from) { where.push('e.entry_date >= ?'); params.push(from); }
  if (to) { where.push('e.entry_date <= ?'); params.push(to); }
  if (accountId) { where.push('l.account_id = ?'); params.push(accountId); }
  try {
    const [rows] = await pool.query(
      `SELECT e.entry_number, e.entry_date, e.source_type, e.status, e.memo AS entry_memo,
              l.line_no, a.code AS account_code, a.name AS account_name,
              l.debit, l.credit, l.memo AS line_memo
         FROM money_journal_entries e
         JOIN money_journal_lines l ON l.entry_id = e.id
         JOIN money_accounts a ON a.id = l.account_id
        WHERE ${where.join(' AND ')}
        ORDER BY e.entry_date, e.entry_number, l.line_no
        LIMIT 20000`,
      params
    );
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = 'entry_number,entry_date,source_type,status,entry_memo,account_code,account_name,debit,credit,line_memo';
    const body = rows.map(r => [
      r.entry_number,
      r.entry_date instanceof Date ? r.entry_date.toISOString().slice(0, 10) : r.entry_date,
      r.source_type, r.status, r.entry_memo, r.account_code, r.account_name,
      Number(r.debit).toFixed(2), Number(r.credit).toFixed(2), r.line_memo,
    ].map(esc).join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="journal-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(header + '\n' + body + '\n');
  } catch (err) {
    console.error('[finance] GET /ledger/export.csv failed:', err);
    res.status(500).json({ message: 'Failed to export journal.' });
  }
});

// ---------------------------------------------------------------------------
// Accounting period lock — one row per tenant; postEntry rejects any journal
// dated on/before locked_through (the guard lives in insertEntry, so manual
// journals, automatic hooks, and reversals are all covered).
// ---------------------------------------------------------------------------

// GET /api/finance/period-lock
router.get('/period-lock', requirePermission('finance.view'), async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT l.locked_through, l.locked_at, l.notes, u.name AS locked_by_name
         FROM accounting_period_locks l
         LEFT JOIN users u ON u.id = l.locked_by
        WHERE l.tenant_id = ?`,
      [req.user.tenant_id]
    );
    res.json({ status: 'success', data: { lock: row || null } });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ status: 'success', data: { lock: null } });
    console.error('[finance] GET /period-lock failed:', err);
    res.status(500).json({ message: 'Failed to load period lock.' });
  }
});

// PUT /api/finance/period-lock — { lockedThrough: 'YYYY-MM-DD' | null, notes? }
router.put('/period-lock', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const lockedThrough = req.body?.lockedThrough || req.body?.locked_through || null;
  try {
    if (lockedThrough === null) {
      await pool.query('DELETE FROM accounting_period_locks WHERE tenant_id = ?', [tenantId]);
      return res.json({ status: 'success', data: { lock: null } });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lockedThrough)) {
      return res.status(400).json({ message: 'lockedThrough must be a YYYY-MM-DD date (or null to unlock).' });
    }
    await pool.query(
      `INSERT INTO accounting_period_locks (tenant_id, locked_through, locked_by, notes)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE locked_through = VALUES(locked_through),
                               locked_by = VALUES(locked_by),
                               locked_at = CURRENT_TIMESTAMP,
                               notes = VALUES(notes)`,
      [tenantId, lockedThrough, req.user?.id || null, req.body?.notes || null]
    );
    res.json({ status: 'success', data: { lock: { locked_through: lockedThrough } } });
  } catch (err) {
    console.error('[finance] PUT /period-lock failed:', err);
    res.status(500).json({ message: 'Failed to update period lock.' });
  }
});

// ---------------------------------------------------------------------------
// Tax remittance — TAXPAY accrues credits on sales and debits on returns;
// this settles the accrued balance out through a chosen tender account.
// ---------------------------------------------------------------------------

// GET /api/finance/tax-payable — current accrued liability on the tax account.
router.get('/tax-payable', requirePermission('finance.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  try {
    const acctId = await moneyPosting.resolveAccountId(tenantId, 'event:tax');
    if (!acctId) return res.json({ status: 'success', data: { accountId: null, balance: 0 } });
    const [[row]] = await pool.query(
      `SELECT COALESCE(SUM(l.credit - l.debit), 0) AS accrued
         FROM money_journal_lines l
         JOIN money_journal_entries e ON e.id = l.entry_id
        WHERE l.tenant_id = ? AND l.account_id = ?`,
      [tenantId, acctId]
    );
    const [[remits]] = await pool.query(
      'SELECT COALESCE(SUM(amount),0) AS total FROM tax_remissions WHERE tenant_id = ?',
      [tenantId]
    ).catch((e) => e.code === 'ER_NO_SUCH_TABLE' ? [[{ total: 0 }]] : Promise.reject(e));
    res.json({ status: 'success', data: {
      accountId: acctId,
      balance: round2(Number(row.accrued) || 0),
      remittedTotal: round2(Number(remits?.total) || 0),
    } });
  } catch (err) {
    console.error('[finance] GET /tax-payable failed:', err);
    res.status(500).json({ message: 'Failed to load tax payable balance.' });
  }
});

// POST /api/finance/tax-remittance — { amount, paymentMethod|paidFromAccountId,
//   periodFrom?, periodTo?, reference?, notes? }
router.post('/tax-remittance', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const amount = round2(Number(req.body?.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'amount must be a positive number.' });
  }
  const conn = await getConnectionWithTimeZone();
  try {
    await conn.beginTransaction();
    const taxAcctId = await moneyPosting.resolveAccountId(tenantId, 'event:tax', conn);
    const paidFromId = req.body?.paidFromAccountId ||
      await moneyPosting.tenderAccountId(conn, tenantId, req.body?.paymentMethod || 'bank_transfer', 'out');
    if (!taxAcctId || !paidFromId) {
      await conn.rollback();
      return res.status(500).json({ message: 'Ledger posting failed: money account(s) missing.' });
    }
    const remissionId = uuidv4();
    const entry = await moneyPosting.postEntry({
      tenantId,
      storeId: req.body?.storeId || req.storeId || null,
      sourceType: 'tax_remittance', sourceId: remissionId,
      memo: `Tax remittance${req.body?.reference ? ` — ${req.body.reference}` : ''}`,
      createdBy: req.user?.id || null,
      lines: [
        { accountId: taxAcctId, debit: amount, credit: 0, memo: 'Tax authority settlement' },
        { accountId: paidFromId, debit: 0, credit: amount, memo: `Remitted via ${req.body?.paymentMethod || 'account'}` },
      ],
    }, conn);
    await conn.query(
      `INSERT INTO tax_remissions
         (id, tenant_id, period_from, period_to, amount, paid_from_account_id, journal_entry_id, reference, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [remissionId, tenantId, req.body?.periodFrom || null, req.body?.periodTo || null,
       amount, paidFromId, entry.entryId, req.body?.reference || null, req.body?.notes || null, req.user?.id || null]
    );
    await conn.commit();
    res.status(201).json({ status: 'success', data: { id: remissionId, entryNumber: entry.entryNumber } });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] POST /tax-remittance failed:', err);
    res.status(500).json({ message: 'Failed to record tax remittance.' });
  } finally {
    conn.release();
  }
});

// GET /api/finance/tax-remissions — remittance history.
router.get('/tax-remissions', requirePermission('finance.view'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.*, e.entry_number, a.code AS paid_from_code, u.name AS created_by_name
         FROM tax_remissions t
         LEFT JOIN money_journal_entries e ON e.id = t.journal_entry_id
         LEFT JOIN money_accounts a ON a.id = t.paid_from_account_id
         LEFT JOIN users u ON u.id = t.created_by
        WHERE t.tenant_id = ?
        ORDER BY t.created_at DESC
        LIMIT 200`,
      [req.user.tenant_id]
    );
    res.json({ status: 'success', data: { remissions: rows } });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ status: 'success', data: { remissions: [] } });
    console.error('[finance] GET /tax-remissions failed:', err);
    res.status(500).json({ message: 'Failed to load tax remissions.' });
  }
});

// ---------------------------------------------------------------------------
// Account reconciliation — match ledger lines against a statement. A session
// picks an account + statement date/balance, clears lines, and completes only
// when cleared lines + any booked adjustment equal the statement.
// ---------------------------------------------------------------------------

const roundAmt = (n) => Math.round(Number(n) * 100) / 100;

// GET /api/finance/reconciliations?account_id=&status=
router.get('/reconciliations', requirePermission('finance.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  try {
    const where = ['r.tenant_id = ?'];
    const params = [tenantId];
    if (req.query.account_id) { where.push('r.account_id = ?'); params.push(req.query.account_id); }
    if (req.query.status) { where.push('r.status = ?'); params.push(req.query.status); }
    const [rows] = await pool.query(
      `SELECT r.*, a.code AS account_code, a.name AS account_name, u.name AS created_by_name
         FROM money_reconciliations r
         JOIN money_accounts a ON a.id = r.account_id
         LEFT JOIN users u ON u.id = r.created_by
        WHERE ${where.join(' AND ')}
        ORDER BY r.created_at DESC
        LIMIT 100`,
      params
    );
    res.json({ status: 'success', data: { reconciliations: rows } });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ status: 'success', data: { reconciliations: [] } });
    console.error('[finance] GET /reconciliations failed:', err);
    res.status(500).json({ message: 'Failed to load reconciliations.' });
  }
});

// POST /api/finance/reconciliations — { accountId, statementDate, statementBalance }
router.post('/reconciliations', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const { accountId, statementDate } = req.body || {};
  const statementBalance = roundAmt(req.body?.statementBalance);
  if (!accountId) return res.status(400).json({ message: 'accountId is required.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(statementDate || ''))) {
    return res.status(400).json({ message: 'statementDate must be YYYY-MM-DD.' });
  }
  if (!Number.isFinite(statementBalance)) {
    return res.status(400).json({ message: 'statementBalance must be a number.' });
  }
  try {
    const [[acct]] = await pool.query(
      'SELECT id FROM money_accounts WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [accountId, tenantId]
    );
    if (!acct) return res.status(404).json({ message: 'Account not found.' });
    const id = uuidv4();
    await pool.query(
      `INSERT INTO money_reconciliations (id, tenant_id, account_id, statement_date, statement_balance, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tenantId, accountId, statementDate, statementBalance, req.user?.id || null]
    );
    res.status(201).json({ status: 'success', data: { id } });
  } catch (err) {
    console.error('[finance] POST /reconciliations failed:', err);
    res.status(500).json({ message: 'Failed to start reconciliation.' });
  }
});

// GET /api/finance/reconciliations/:id — session + every ledger line on the
// account up to the statement date, flagged cleared/uncleared, plus the live
// cleared-balance and difference.
router.get('/reconciliations/:id', requirePermission('finance.view'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  try {
    const [[recon]] = await pool.query(
      `SELECT r.*, a.code AS account_code, a.name AS account_name, a.account_type,
              a.opening_balance, u.name AS created_by_name
         FROM money_reconciliations r
         JOIN money_accounts a ON a.id = r.account_id
         LEFT JOIN users u ON u.id = r.created_by
        WHERE r.id = ? AND r.tenant_id = ?`,
      [req.params.id, tenantId]
    );
    if (!recon) return res.status(404).json({ message: 'Reconciliation not found.' });

    const [lines] = await pool.query(
      `SELECT l.id, l.entry_id, l.debit, l.credit, l.memo AS line_memo, l.reconciliation_id,
              e.entry_number, e.entry_date, e.source_type, e.status AS entry_status, e.memo AS entry_memo
         FROM money_journal_lines l
         JOIN money_journal_entries e ON e.id = l.entry_id AND e.tenant_id = l.tenant_id
        WHERE l.tenant_id = ? AND l.account_id = ?
          AND e.entry_date <= ?
        ORDER BY e.entry_date, e.entry_number, l.line_no`,
      [tenantId, recon.account_id, recon.statement_date]
    );

    // Cleared balance = opening + Σ(cleared lines) — sign via normal side.
    const debitNormal = ['asset', 'expense'].includes(recon.account_type);
    let cleared = Number(recon.opening_balance) || 0;
    for (const l of lines) {
      if (!l.reconciliation_id) continue;
      cleared += (Number(l.debit) - Number(l.credit)) * (debitNormal ? 1 : -1);
    }
    cleared = roundAmt(cleared);

    res.json({ status: 'success', data: {
      reconciliation: recon,
      lines,
      clearedBalance: cleared,
      difference: roundAmt(Number(recon.statement_balance) - cleared),
    } });
  } catch (err) {
    console.error('[finance] GET /reconciliations/:id failed:', err);
    res.status(500).json({ message: 'Failed to load reconciliation.' });
  }
});

// POST /api/finance/reconciliations/:id/lines — { lineIds: [...], cleared: bool }
router.post('/reconciliations/:id/lines', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const lineIds = Array.isArray(req.body?.lineIds) ? req.body.lineIds : [];
  const cleared = req.body?.cleared !== false;
  if (!lineIds.length) return res.status(400).json({ message: 'lineIds is required.' });
  const conn = await getConnectionWithTimeZone();
  try {
    await conn.beginTransaction();
    const [[recon]] = await conn.query(
      'SELECT * FROM money_reconciliations WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [req.params.id, tenantId]
    );
    if (!recon) { await conn.rollback(); return res.status(404).json({ message: 'Reconciliation not found.' }); }
    if (recon.status !== 'in_progress') { await conn.rollback(); return res.status(400).json({ message: 'Reconciliation is already completed.' }); }

    const placeholders = lineIds.map(() => '?').join(',');
    if (cleared) {
      // Only lines on this account, in-range, and not already claimed by a
      // DIFFERENT session can be cleared into this one.
      await conn.query(
        `UPDATE money_journal_lines l
           JOIN money_journal_entries e ON e.id = l.entry_id
            SET l.reconciliation_id = ?
          WHERE l.tenant_id = ? AND l.account_id = ? AND e.entry_date <= ?
            AND l.id IN (${placeholders})
            AND (l.reconciliation_id IS NULL OR l.reconciliation_id = ?)`,
        [recon.id, tenantId, recon.account_id, recon.statement_date, ...lineIds, recon.id]
      );
    } else {
      await conn.query(
        `UPDATE money_journal_lines
            SET reconciliation_id = NULL
          WHERE tenant_id = ? AND reconciliation_id = ?
            AND id IN (${placeholders})`,
        [tenantId, recon.id, ...lineIds]
      );
    }
    await conn.commit();
    res.json({ status: 'success' });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] POST /reconciliations/:id/lines failed:', err);
    res.status(500).json({ message: 'Failed to update cleared lines.' });
  } finally {
    conn.release();
  }
});

// POST /api/finance/reconciliations/:id/complete — close the session. When the
// cleared balance doesn't reach the statement balance, body.adjustmentAccountId
// books the residual (e.g. bank fees → OPEXP) with its own journal entry whose
// account-side line is immediately marked cleared in this session.
router.post('/reconciliations/:id/complete', requirePermission('finance.manage'), async (req, res) => {
  const tenantId = req.user.tenant_id;
  const conn = await getConnectionWithTimeZone();
  try {
    await conn.beginTransaction();
    const [[recon]] = await conn.query(
      `SELECT r.*, a.account_type, a.opening_balance
         FROM money_reconciliations r JOIN money_accounts a ON a.id = r.account_id
        WHERE r.id = ? AND r.tenant_id = ? FOR UPDATE`,
      [req.params.id, tenantId]
    );
    if (!recon) { await conn.rollback(); return res.status(404).json({ message: 'Reconciliation not found.' }); }
    if (recon.status !== 'in_progress') { await conn.rollback(); return res.status(400).json({ message: 'Reconciliation is already completed.' }); }

    const debitNormal = ['asset', 'expense'].includes(recon.account_type);
    const [[sum]] = await conn.query(
      `SELECT COALESCE(SUM((l.debit - l.credit) * ?), 0) AS cleared
         FROM money_journal_lines l
         JOIN money_journal_entries e ON e.id = l.entry_id
        WHERE l.tenant_id = ? AND l.account_id = ?
          AND e.entry_date <= ? AND l.reconciliation_id IS NOT NULL`,
      [debitNormal ? 1 : -1, tenantId, recon.account_id, recon.statement_date]
    );
    let cleared = roundAmt((Number(recon.opening_balance) || 0) + (Number(sum.cleared) || 0));
    let difference = roundAmt(Number(recon.statement_balance) - cleared);
    let adjustmentEntryId = null;

    if (Math.abs(difference) > 0.005) {
      const adjustmentAccountId = req.body?.adjustmentAccountId;
      if (!adjustmentAccountId) {
        await conn.rollback();
        return res.status(400).json({
          message: `Cleared balance differs from the statement by ${difference.toFixed(2)} — provide adjustmentAccountId to book the residual, or review the cleared lines.`,
          difference,
          clearedBalance: cleared,
        });
      }
      // statement < cleared → too much money in the books → Cr the account,
      // Dr the adjustment (expense). statement > cleared → the reverse.
      const adjAmt = Math.abs(difference);
      const lines = difference < 0
        ? [
            { accountId: adjustmentAccountId, debit: adjAmt, credit: 0, memo: 'Reconciliation adjustment' },
            { accountId: recon.account_id, debit: 0, credit: adjAmt, memo: 'Statement adjustment' },
          ]
        : [
            { accountId: recon.account_id, debit: adjAmt, credit: 0, memo: 'Statement adjustment' },
            { accountId: adjustmentAccountId, debit: 0, credit: adjAmt, memo: 'Reconciliation adjustment' },
          ];
      const entry = await moneyPosting.postEntry({
        tenantId, storeId: null,
        entryDate: recon.statement_date instanceof Date
          ? recon.statement_date.toISOString().slice(0, 10) : recon.statement_date,
        sourceType: 'reconciliation', sourceId: recon.id,
        memo: `Reconciliation adjustment — account ${recon.account_id}`,
        createdBy: req.user?.id || null,
        lines,
      }, conn);
      adjustmentEntryId = entry.entryId;
      // Mark the adjustment's own account-side line cleared so the statement
      // and ledger agree going forward.
      await conn.query(
        `UPDATE money_journal_lines SET reconciliation_id = ?
          WHERE entry_id = ? AND account_id = ?`,
        [recon.id, entry.entryId, recon.account_id]
      );
      cleared = roundAmt(cleared + difference);
      difference = 0;
    }

    await conn.query(
      `UPDATE money_reconciliations
          SET status = 'completed', cleared_balance = ?, difference = ?,
              adjustment_entry_id = ?, completed_at = NOW()
        WHERE id = ?`,
      [cleared, difference, adjustmentEntryId, recon.id]
    );
    await conn.commit();
    res.json({ status: 'success', data: { clearedBalance: cleared, difference, adjustmentEntryId } });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('[finance] POST /reconciliations/:id/complete failed:', err);
    res.status(500).json({ message: err.message || 'Failed to complete reconciliation.' });
  } finally {
    conn.release();
  }
});

module.exports = router;
