/**
 * Employee module routes
 * Base path: /api/employees   (mounted in routes/index.js)
 *
 *   GET    /                       list employees (tenant-scoped)
 *   POST   /                       create employee
 *   PUT    /:id                    update employee
 *   DELETE /:id                    soft-deactivate employee
 *   POST   /:id/targets            set a sales target/incentive for a period
 *   GET    /:id/performance        sales vs target + computed incentive
 *   GET    /paytime/status         whether Paytime integration is configured
 *   POST   /:id/paytime/sync       push computed incentive to Paytime
 */

'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const paytime = require('../services/paytimeService');

const tid = (req) => req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];

router.use(authenticate);
router.use(requireTenantId);

router.get('/', requirePermission('employees.view'), async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM employees WHERE tenant_id = ? ORDER BY first_name, last_name',
      [tid(req)]
    );
    res.json({ status: 'success', data: rows });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// Bulk performance summary for all active employees in a date range.
// Avoids N+1 per-employee calls from the Employee Performance Report.
// GET /api/employees/performance-summary?period_start=...&period_end=...
router.get('/performance-summary', requirePermission('employees.view'), async (req, res) => {
  try {
    const { period_start, period_end } = req.query;
    if (!period_start || !period_end) {
      return res.status(400).json({ status: 'error', message: 'period_start/period_end required' });
    }
    const tenantId = tid(req);

    // 1) Sales aggregated per employee
    const [salesRows] = await pool.query(
      `SELECT e.id AS employee_id,
              e.first_name, e.last_name, e.job_title, e.commission_pct,
              e.is_sales_staff, e.is_active,
              COALESCE(SUM(s.total), 0) AS achieved,
              COUNT(s.id) AS num_sales
         FROM employees e
         LEFT JOIN sales s
           ON s.employee_id = e.id
          AND s.tenant_id = e.tenant_id
          AND s.status = 'completed'
          AND s.created_at >= ?
          AND s.created_at < DATE_ADD(?, INTERVAL 1 DAY)
        WHERE e.tenant_id = ?
          AND e.is_active = 1
        GROUP BY e.id
        ORDER BY achieved DESC`,
      [period_start, period_end, tenantId]
    );

    // 2) Targets that overlap the requested period (not exact match)
    const [targetRows] = await pool.query(
      `SELECT employee_id, target_amount, incentive_pct, bonus_flat
         FROM employee_sales_targets
        WHERE tenant_id = ?
          AND period_start <= ? AND period_end >= ?
        ORDER BY created_at DESC`,
      [tenantId, period_end, period_start]
    );
    // Keep first (most recent) target per employee
    const targetMap = new Map();
    for (const t of targetRows) {
      if (!targetMap.has(t.employee_id)) targetMap.set(t.employee_id, t);
    }

    // 3) Combine
    const data = salesRows.map((row) => {
      const achieved = Number(row.achieved);
      const t = targetMap.get(row.employee_id) || null;
      let computedIncentive = 0;
      if (t) {
        const target = Number(t.target_amount);
        if (achieved >= target && target > 0) {
          if (t.bonus_flat) computedIncentive += Number(t.bonus_flat);
          if (t.incentive_pct) computedIncentive += ((achieved - target) * Number(t.incentive_pct)) / 100;
        }
      }
      return {
        employee_id: row.employee_id,
        first_name: row.first_name,
        last_name: row.last_name,
        job_title: row.job_title,
        commission_pct: row.commission_pct,
        is_sales_staff: row.is_sales_staff,
        achieved,
        num_sales: Number(row.num_sales),
        target: t ? Number(t.target_amount) : null,
        incentive_pct: t ? t.incentive_pct : null,
        bonus_flat: t ? t.bonus_flat : null,
        computed_incentive: Math.round((computedIncentive + Number.EPSILON) * 100) / 100,
        met_target: t ? achieved >= Number(t.target_amount) : null,
      };
    });

    res.json({ status: 'success', data });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.post('/', requirePermission('employees.create'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const b = req.body || {};
    const tenantId = tid(req);
    if (!b.first_name) {
      conn.release();
      return res.status(400).json({ status: 'error', message: 'first_name required' });
    }

    let userId = b.user_id ?? null;

    // Inline user account creation when create_account fields are provided
    if (b.create_account && b.account_email && b.account_password) {
      // Check for duplicate email
      const [existing] = await conn.execute(
        'SELECT id FROM users WHERE email = ? AND tenant_id = ?',
        [b.account_email, tenantId]
      );
      if (existing.length > 0) {
        await conn.rollback(); conn.release();
        return res.status(409).json({ status: 'error', message: 'A user with this email already exists.' });
      }

      const newUserId = uuidv4();
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(b.account_password, salt);
      const fullName = `${b.first_name} ${b.last_name || ''}`.trim();

      await conn.execute(
        `INSERT INTO users (id, tenant_id, name, email, phone_number, password_hash, is_active, store_id)
         VALUES (?,?,?,?,?,?,1,?)`,
        [newUserId, tenantId, fullName, b.account_email, b.phone ?? null, hashedPassword, b.store_id ?? null]
      );

      // Assign role on the same connection (avoids lock-wait with outer transaction)
      if (b.role_id) {
        const [roleExists] = await conn.query(
          'SELECT id FROM roles WHERE id = ? AND tenant_id = ?', [b.role_id, tenantId]
        );
        if (roleExists.length > 0) {
          const assignmentId = uuidv4();
          const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
          const assignedBy = req.user?.id || 'system';
          // Check if assignment already exists
          const [existing] = await conn.query(
            'SELECT id FROM user_roles WHERE user_id = ? AND role_id = ? AND scope = ? AND store_id IS NULL',
            [newUserId, b.role_id, 'tenant']
          );
          if (!existing.length) {
            await conn.execute(
              `INSERT INTO user_roles (id, user_id, role_id, scope, store_id, assigned_by, created_at, updated_at)
               VALUES (?,?,?,?,NULL,?,?,?)`,
              [assignmentId, newUserId, b.role_id, 'tenant', assignedBy, now, now]
            );
          }
        }
      }

      userId = newUserId;
    }

    const id = uuidv4();
    await conn.execute(
      `INSERT INTO employees
        (id, tenant_id, store_id, user_id, employee_code, first_name, last_name, email, phone,
         job_title, commission_pct, is_sales_staff, paytime_employee_id, is_active)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
      [id, tenantId, b.store_id ?? null, userId, b.employee_code ?? null,
       b.first_name, b.last_name ?? null, b.email ?? null, b.phone ?? null, b.job_title ?? null,
       b.commission_pct ?? null, b.is_sales_staff === false ? 0 : 1, b.paytime_employee_id ?? null]
    );

    await conn.commit();
    conn.release();
    res.status(201).json({ status: 'success', data: { id, userId } });
  } catch (e) {
    await conn.rollback().catch(() => {});
    conn.release();
    res.status(500).json({ status: 'error', message: e.message });
  }
});

router.put('/:id', requirePermission('employees.edit'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const b = req.body || {};
    const tenantId = tid(req);
    const [employees] = await conn.execute(
      'SELECT user_id FROM employees WHERE id = ? AND tenant_id = ? FOR UPDATE',
      [req.params.id, tenantId]
    );
    if (!employees.length) {
      await conn.rollback();
      return res.status(404).json({ status: 'error', message: 'Employee not found' });
    }

    const fields = ['store_id','user_id','employee_code','first_name','last_name','email','phone',
      'job_title','commission_pct','is_sales_staff','paytime_employee_id','is_active'];
    const sets = [], vals = [];
    for (const f of fields) if (b[f] !== undefined) { sets.push(`${f} = ?`); vals.push(b[f]); }
    if (!sets.length && b.account_role_id === undefined && b.account_status === undefined) {
      await conn.rollback();
      return res.status(400).json({ status: 'error', message: 'no fields to update' });
    }
    if (sets.length) {
      vals.push(req.params.id, tenantId);
      await conn.execute(`UPDATE employees SET ${sets.join(', ')} WHERE id = ? AND tenant_id = ?`, vals);
    }

    const userId = b.user_id || employees[0].user_id;
    if (userId && (b.account_role_id !== undefined || b.account_status !== undefined)) {
      const fullName = `${b.first_name || ''} ${b.last_name || ''}`.trim();
      await conn.execute(
        `UPDATE users SET name = COALESCE(NULLIF(?, ''), name), phone_number = ?, store_id = ?,
          is_active = COALESCE(?, is_active), updated_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [fullName, b.phone ?? null, b.store_id ?? null,
         b.account_status === undefined ? null : (b.account_status === 'active' ? 1 : 0), userId, tenantId]
      );

      if (b.account_role_id) {
        const [matchingRoles] = await conn.execute(
          'SELECT id FROM roles WHERE id = ? AND tenant_id = ?',
          [b.account_role_id, tenantId]
        );
        if (!matchingRoles.length) throw new Error('Selected role does not belong to this tenant');
        await conn.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);
        await conn.execute(
          `INSERT INTO user_roles (id, user_id, role_id, scope, store_id, assigned_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [uuidv4(), userId, b.account_role_id, b.store_id ? 'store' : 'tenant', b.store_id || null, req.user?.id || null]
        );
      }
    }

    await conn.commit();
    // Role assignment changed inside the transaction — flush cached permissions.
    if (userId && b.account_role_id !== undefined) {
      await require('../services/rbacService').invalidateUserCache(userId);
    }
    res.json({ status: 'success' });
  } catch (e) {
    await conn.rollback().catch(() => {});
    res.status(500).json({ status: 'error', message: e.message });
  } finally {
    conn.release();
  }
});

router.delete('/:id', requirePermission('employees.delete'), async (req, res) => {
  try {
    await pool.execute('UPDATE employees SET is_active = 0 WHERE id = ? AND tenant_id = ?', [req.params.id, tid(req)]);
    res.json({ status: 'success' });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.post('/:id/targets', requirePermission('employees.edit'), async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.period_start || !b.period_end) return res.status(400).json({ status: 'error', message: 'period_start/period_end required' });
    const id = uuidv4();
    await pool.execute(
      `INSERT INTO employee_sales_targets
        (id, tenant_id, employee_id, period_type, period_start, period_end, target_amount, incentive_pct, bonus_flat, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [id, tid(req), req.params.id, b.period_type || 'monthly', b.period_start, b.period_end,
       b.target_amount ?? 0, b.incentive_pct ?? null, b.bonus_flat ?? null, b.notes ?? null]
    );
    res.status(201).json({ status: 'success', data: { id } });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

// Sales achieved vs target + computed incentive for a period.
router.get('/:id/performance', requirePermission('employees.view'), async (req, res) => {
  try {
    const { period_start, period_end } = req.query;
    if (!period_start || !period_end) return res.status(400).json({ status: 'error', message: 'period_start/period_end required' });
    const [[sales]] = await pool.query(
      `SELECT COALESCE(SUM(total),0) AS achieved, COUNT(*) AS num_sales
         FROM sales
        WHERE tenant_id = ? AND employee_id = ? AND status = 'completed'
          AND created_at >= ? AND created_at < DATE_ADD(?, INTERVAL 1 DAY)`,
      [tid(req), req.params.id, period_start, period_end]
    );
    const [targets] = await pool.execute(
      `SELECT * FROM employee_sales_targets
        WHERE tenant_id = ? AND employee_id = ? AND period_start = ? AND period_end = ?
        ORDER BY created_at DESC LIMIT 1`,
      [tid(req), req.params.id, period_start, period_end]
    );
    const t = targets[0] || null;
    const achieved = Number(sales.achieved);
    let incentive = 0;
    if (t) {
      const target = Number(t.target_amount);
      if (achieved >= target && target > 0) {
        if (t.bonus_flat) incentive += Number(t.bonus_flat);
        if (t.incentive_pct) incentive += ((achieved - target) * Number(t.incentive_pct)) / 100;
      }
    }
    res.json({
      status: 'success',
      data: {
        achieved, num_sales: sales.num_sales,
        target: t ? Number(t.target_amount) : null,
        incentive_pct: t ? t.incentive_pct : null,
        bonus_flat: t ? t.bonus_flat : null,
        computed_incentive: Math.round((incentive + Number.EPSILON) * 100) / 100,
        met_target: t ? achieved >= Number(t.target_amount) : null,
      },
    });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

router.get('/paytime/status', requirePermission('employees.view'), async (req, res) => {
  res.json({ status: 'success', data: { configured: paytime.configured() } });
});

router.post('/:id/paytime/sync', requirePermission('employees.edit'), async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT paytime_employee_id FROM employees WHERE id = ? AND tenant_id = ?', [req.params.id, tid(req)]);
    if (!rows.length || !rows[0].paytime_employee_id) {
      return res.status(400).json({ status: 'error', message: 'employee not linked to Paytime' });
    }
    const result = await paytime.pushIncentive({
      paytimeEmployeeId: rows[0].paytime_employee_id,
      periodStart: req.body?.period_start,
      periodEnd: req.body?.period_end,
      amount: req.body?.amount,
      type: req.body?.type,
      note: req.body?.note,
    });
    res.json({ status: result.ok ? 'success' : 'error', data: result });
  } catch (e) { res.status(500).json({ status: 'error', message: e.message }); }
});

module.exports = router;
