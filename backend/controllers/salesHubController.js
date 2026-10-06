'use strict';

/**
 * Sales Hub — universal customer-relationship search.
 *
 * GET /api/sales-hub/search?q=<query>
 *
 * Fans out across customers + every actionable per-feature record (open
 * repairs, active old-gold purchases, unreturned memos, active layaways,
 * active savings enrollments, recent completed sales) and rolls them up
 * into a single customer-centric result, following the same
 * LEFT JOIN customers / tenant-scoped / ORDER BY created_at DESC / LIMIT
 * pattern already used by salesController.searchSales,
 * salesReturnController.getAllReturns, and the repairs/layaway/memo/
 * old-gold/savings-schemes search routes.
 *
 * Only "still actionable" rows are surfaced (open repair, active/unpaid
 * layaway, unreturned memo, active enrollment, a completed sale eligible
 * for return) — this is a quick-action surface, not a full history dump.
 */

const { pool } = require('../config/db');

const PER_SUBQUERY_LIMIT = 8;
const MAX_CUSTOMERS = 5;
const RECENT_SALE_DAYS = 30;

const tid = (req) => req.user?.tenant_id || req.headers['x-tenant-id'];

const custName = (row) =>
  [row.customer_first_name, row.customer_last_name].filter(Boolean).join(' ').trim() ||
  row.customer_name ||
  'Unknown customer';

function fmtDate(d) {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function fmtMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

exports.search = async (req, res, next) => {
  try {
    const tenantId = tid(req);
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized: Tenant ID is missing.' });
    }

    const q = (req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ status: 'success', data: { customers: [], standaloneRecords: [] } });
    }

    const term = `%${q}%`;

    const [
      repairRows,
      oldGoldRows,
      memoRows,
      layawayRows,
      enrollmentRows,
      saleRows,
    ] = await Promise.all([
      // Repairs still in-flight (not delivered/cancelled)
      pool.query(
        `SELECT r.id, r.ticket_no, r.item_description, r.status, r.promised_date,
                r.estimated_cost, r.final_cost, r.advance_paid, r.customer_id, r.created_at,
                c.first_name AS customer_first_name, c.last_name AS customer_last_name,
                c.email AS customer_email, c.phone_number AS customer_phone
           FROM repair_orders r
           LEFT JOIN customers c ON c.id = r.customer_id
          WHERE r.tenant_id = ?
            AND r.status IN ('received','in_progress','ready')
            AND (
              r.ticket_no LIKE ?
              OR r.item_description LIKE ?
              OR CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?
              OR c.email LIKE ?
              OR c.phone_number LIKE ?
            )
          ORDER BY r.created_at DESC
          LIMIT ?`,
        [tenantId, term, term, term, term, term, PER_SUBQUERY_LIMIT]
      ),
      // Old-gold purchases still awaiting redemption (valued/credited)
      pool.query(
        `SELECT o.id, o.voucher_no, o.status, o.valuation_amount, o.customer_id, o.created_at,
                c.first_name AS customer_first_name, c.last_name AS customer_last_name,
                c.email AS customer_email, c.phone_number AS customer_phone
           FROM old_gold_purchases o
           LEFT JOIN customers c ON c.id = o.customer_id
          WHERE o.tenant_id = ?
            AND o.status IN ('valued','credited')
            AND (
              o.voucher_no LIKE ?
              OR CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?
              OR c.email LIKE ?
              OR c.phone_number LIKE ?
            )
          ORDER BY o.created_at DESC
          LIMIT ?`,
        [tenantId, term, term, term, term, PER_SUBQUERY_LIMIT]
      ),
      // Memos issued out to a customer, not yet fully returned/settled
      pool.query(
        `SELECT m.id, m.memo_no, m.status, m.total_value, m.due_date, m.customer_id, m.created_at,
                c.first_name AS customer_first_name, c.last_name AS customer_last_name,
                c.email AS customer_email, c.phone_number AS customer_phone
           FROM memo_transactions m
           LEFT JOIN customers c ON c.id = m.customer_id
          WHERE m.tenant_id = ?
            AND m.direction = 'out'
            AND m.party_type = 'customer'
            AND m.status IN ('open','partially_returned')
            AND (
              m.memo_no LIKE ?
              OR CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?
              OR c.email LIKE ?
              OR c.phone_number LIKE ?
            )
          ORDER BY m.created_at DESC
          LIMIT ?`,
        [tenantId, term, term, term, term, PER_SUBQUERY_LIMIT]
      ),
      // Layaway plans not yet completed/cancelled
      pool.query(
        `SELECT l.id, l.plan_no, l.status, l.total_amount, l.paid_amount, l.installment_count,
                l.due_date, l.customer_id, l.created_at,
                c.first_name AS customer_first_name, c.last_name AS customer_last_name,
                c.email AS customer_email, c.phone_number AS customer_phone
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
          LIMIT ?`,
        [tenantId, term, term, term, term, PER_SUBQUERY_LIMIT]
      ),
      // Savings scheme enrollments still active
      pool.query(
        `SELECT e.id, e.enrollment_no, e.status, e.paid_installments, e.total_paid,
                e.maturity_date, e.customer_id, e.created_at,
                p.name AS plan_name, p.duration_months,
                c.first_name AS customer_first_name, c.last_name AS customer_last_name,
                c.email AS customer_email, c.phone_number AS customer_phone
           FROM savings_scheme_enrollments e
           LEFT JOIN customers c ON c.id = e.customer_id
           LEFT JOIN savings_scheme_plans p ON p.id = e.plan_id
          WHERE e.tenant_id = ?
            AND e.status = 'active'
            AND (
              e.enrollment_no LIKE ?
              OR CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?
              OR c.email LIKE ?
              OR c.phone_number LIKE ?
            )
          ORDER BY e.created_at DESC
          LIMIT ?`,
        [tenantId, term, term, term, term, PER_SUBQUERY_LIMIT]
      ),
      // Recent completed sales (return-eligible window)
      pool.query(
        `SELECT s.id, s.document_number, s.total, s.customer_id, s.created_at,
                c.first_name AS customer_first_name, c.last_name AS customer_last_name,
                c.email AS customer_email, c.phone_number AS customer_phone
           FROM sales s
           LEFT JOIN customers c ON c.id = s.customer_id
          WHERE s.tenant_id = ?
            AND s.status = 'completed'
            AND s.created_at >= DATE_SUB(NOW(), INTERVAL ${RECENT_SALE_DAYS} DAY)
            AND (
              s.document_number LIKE ?
              OR CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) LIKE ?
              OR c.email LIKE ?
              OR c.phone_number LIKE ?
            )
          ORDER BY s.created_at DESC
          LIMIT ?`,
        [tenantId, term, term, term, term, PER_SUBQUERY_LIMIT]
      ),
    ]);

    const repairs = repairRows[0];
    const oldGold = oldGoldRows[0];
    const memos = memoRows[0];
    const layaways = layawayRows[0];
    const enrollments = enrollmentRows[0];
    const sales = saleRows[0];

    // ── Roll rows up by customer_id ────────────────────────────────────────
    const customerMap = new Map(); // customer_id -> { id, name, phone, email, records: [] }
    const standaloneRecords = [];

    const REPAIR_STATUS_LABEL = {
      received: 'Received',
      in_progress: 'In progress',
      ready: 'Ready for pickup',
    };

    function pushRecord(row, record) {
      const customerId = row.customer_id;
      if (!customerId) {
        standaloneRecords.push(record);
        return;
      }
      if (!customerMap.has(customerId)) {
        if (customerMap.size >= MAX_CUSTOMERS) {
          standaloneRecords.push(record);
          return;
        }
        customerMap.set(customerId, {
          id: customerId,
          name: custName(row),
          phone: row.customer_phone || null,
          email: row.customer_email || null,
          records: [],
        });
      }
      customerMap.get(customerId).records.push(record);
    }

    repairs.forEach((r) => {
      pushRecord(r, {
        type: 'repair',
        id: r.id,
        label: `Repair ticket ${r.ticket_no} · ${r.item_description}`,
        status: r.status,
        statusLabel: REPAIR_STATUS_LABEL[r.status] || r.status,
        action: r.status === 'ready' ? 'collect-payment' : 'check-in',
        actionLabel: r.status === 'ready' ? 'Collect payment' : 'Check in',
        date: fmtDate(r.promised_date || r.created_at),
      });
    });

    oldGold.forEach((o) => {
      pushRecord(o, {
        type: 'old-gold',
        id: o.id,
        label: `Old gold voucher ${o.voucher_no} · ${fmtMoney(o.valuation_amount)}`,
        status: o.status,
        statusLabel: o.status === 'credited' ? 'Credit available' : 'Valued',
        action: 'redeem-credit',
        actionLabel: 'Redeem credit',
        date: fmtDate(o.created_at),
      });
    });

    memos.forEach((m) => {
      pushRecord(m, {
        type: 'memo',
        id: m.id,
        label: `Memo ${m.memo_no} · ${fmtMoney(m.total_value)}`,
        status: m.status,
        statusLabel: m.status === 'partially_returned' ? 'Partially returned' : 'Out on memo',
        action: 'return-item',
        actionLabel: 'Return item',
        date: fmtDate(m.due_date || m.created_at),
      });
    });

    layaways.forEach((l) => {
      const count = l.installment_count || 0;
      const paidRatio = l.total_amount ? (Number(l.paid_amount) / Number(l.total_amount)) : 0;
      const paidInstallments = count ? Math.round(paidRatio * count) : 0;
      pushRecord(l, {
        type: 'layaway',
        id: l.id,
        label: count
          ? `Layaway plan ${l.plan_no} · ${paidInstallments} of ${count} paid`
          : `Layaway plan ${l.plan_no}`,
        status: l.status,
        statusLabel: 'Active',
        action: 'collect-payment',
        actionLabel: 'Collect payment',
        date: fmtDate(l.due_date || l.created_at),
      });
    });

    enrollments.forEach((e) => {
      pushRecord(e, {
        type: 'savings-enrollment',
        id: e.id,
        label: `${e.plan_name || 'Savings scheme'} · ${e.enrollment_no} · ${e.paid_installments}${e.duration_months ? `/${e.duration_months}` : ''} paid`,
        status: e.status,
        statusLabel: 'Active',
        action: 'collect-payment',
        actionLabel: 'Collect payment',
        date: fmtDate(e.maturity_date || e.created_at),
      });
    });

    sales.forEach((s) => {
      // document_number is only populated for sales made after the
      // document_sequences migration (2026-08-27) — an older or otherwise
      // unnumbered sale would render as the literal string "Sale null"
      // if interpolated directly, since template literals stringify
      // null/undefined that way. Fall back to a short id fragment instead.
      const reference = s.document_number || `#${String(s.id).slice(0, 8)}`;
      pushRecord(s, {
        type: 'sale',
        id: s.id,
        label: `Sale ${reference} · ${fmtMoney(s.total)}`,
        status: 'completed',
        statusLabel: 'Completed',
        action: 'return',
        actionLabel: 'Return item',
        date: fmtDate(s.created_at),
      });
    });

    // Also match customers directly by name/phone/email even if they have
    // no actionable record right now, so a plain name search still resolves
    // to the customer (with an empty records array the frontend can treat
    // as "no open items").
    if (customerMap.size < MAX_CUSTOMERS) {
      const [directCustomers] = await pool.query(
        `SELECT id, first_name, last_name, email, phone_number
           FROM customers
          WHERE tenant_id = ?
            AND (
              CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) LIKE ?
              OR email LIKE ?
              OR phone_number LIKE ?
            )
          ORDER BY created_at DESC
          LIMIT ?`,
        [tenantId, term, term, term, MAX_CUSTOMERS]
      );
      directCustomers.forEach((c) => {
        if (customerMap.size >= MAX_CUSTOMERS) return;
        if (!customerMap.has(c.id)) {
          customerMap.set(c.id, {
            id: c.id,
            name: [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || 'Unknown customer',
            phone: c.phone_number || null,
            email: c.email || null,
            records: [],
          });
        }
      });
    }

    return res.json({
      status: 'success',
      data: {
        customers: Array.from(customerMap.values()),
        standaloneRecords,
      },
    });
  } catch (error) {
    console.error('Error in sales-hub search:', error);
    return next(error);
  }
};

exports.glance = async (req, res, next) => {
  try {
    const tenantId = tid(req);
    if (!tenantId) {
      return res.status(401).json({ status: 'error', message: 'Unauthorized: Tenant ID is missing.' });
    }

    const [[repairsReadyRows], [memosOverdueRows]] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) AS c
           FROM repair_orders
          WHERE tenant_id = ?
            AND status = 'ready'`,
        [tenantId]
      ),
      pool.query(
        `SELECT COUNT(*) AS c
           FROM memo_transactions
          WHERE tenant_id = ?
            AND status = 'open'
            AND due_date IS NOT NULL
            AND due_date < CURDATE()`,
        [tenantId]
      ),
    ]);

    return res.json({
      status: 'success',
      data: {
        repairsReady: repairsReadyRows?.[0]?.c || 0,
        memosOverdue: memosOverdueRows?.[0]?.c || 0,
      },
    });
  } catch (error) {
    console.error('Error in sales-hub glance:', error);
    return next(error);
  }
};
