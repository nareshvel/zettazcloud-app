/**
 * Platform Service — system-admin (cross-tenant) operations.
 *
 * Consolidated port of paisepath-app's platform + platform-ops modules:
 * tenant lifecycle (create/edit/suspend/resume/scheduled deletion/export),
 * subscription & plan administration, platform staff management, overview
 * metrics, billing issues/dunning, feature flags, announcements, support
 * tickets, impersonation, and platform health.
 *
 * Authorization model: every route gates on platform.* permissions resolved
 * through NULL-tenant roles (see rbacPermissionMiddleware.checkSystemPermission)
 * — tenant-admin bypass deliberately does NOT apply. `PLATFORM_TENANT_ID` is
 * the well-known tenant row all platform staff hang off (users.tenant_id is
 * NOT NULL), and it doubles as the audit tenant for platform actions.
 */
'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool, query: dbQuery, executeTransaction } = require('../config/db');
const cacheService = require('./cacheService');
const { logActivity } = require('./auditLogService');
const { JWT_SECRET } = require('../config/constants');

const PLATFORM_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const PLATFORM_SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000002';

// Feature flags togglable per tenant (platform console → tenant detail).
// 'default' state falls back to the tenant's plan features JSON.
const FEATURES = [
  'catalog_sync',
  'print_agent',
  'metal_rates',
  'duty_free',
  'api_access',
];

// Fields a platform admin may update on a tenant row (whitelist — never
// accept arbitrary columns).
const TENANT_PLATFORM_FIELDS = [
  'name', 'industry_code', 'address', 'city', 'state', 'postal_code',
  'country_code', 'phone', 'email', 'website', 'logo_url',
];

const pickFields = (data, allowed) => {
  const out = {};
  for (const k of allowed) {
    if (data[k] !== undefined) out[k] = data[k];
  }
  return out;
};

const invalidateTenantStatus = (tenantId) => {
  try { cacheService.delete(`tenant_status:${tenantId}`); } catch (_) { /* best-effort */ }
};

/**
 * Dual-write an audit event: once under the platform tenant (the admin feed)
 * and once under the affected tenant (their own log shows what platform staff
 * did to them).
 */
const auditPlatform = async (req, targetTenantId, fields) => {
  const base = {
    user_id: req.user?.id || PLATFORM_SYSTEM_USER_ID,
    username: req.user?.email,
    ip_address: req.ip,
    user_agent: req.headers?.['user-agent'],
  };
  const writes = [
    logActivity({ ...base, tenant_id: PLATFORM_TENANT_ID, ...fields }),
  ];
  if (targetTenantId && targetTenantId !== PLATFORM_TENANT_ID) {
    writes.push(logActivity({ ...base, tenant_id: targetTenantId, ...fields }));
  }
  await Promise.allSettled(writes);
};

// ============================================================================
// OVERVIEW / HEALTH
// ============================================================================

/**
 * Headline metrics for /system/dashboard: tenant counts, MRR split by
 * currency, usage rollups, and the 8 least-healthy tenants.
 */
const overview = async () => {
  const [[tenantCounts]] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
       SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended,
       SUM(CASE WHEN status = 'pending_deletion' THEN 1 ELSE 0 END) AS pendingDeletion,
       SUM(CASE WHEN created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN 1 ELSE 0 END) AS newThisMonth
     FROM tenants WHERE id <> ?`, [PLATFORM_TENANT_ID]
  );

  // Latest subscription per tenant joined to its plan for revenue math.
  const [revenueRows] = await pool.query(
    `SELECT s.status, s.billing_cycle, p.price_monthly, p.price_yearly, p.currency
       FROM subscriptions s
       JOIN (SELECT tenant_id, MAX(created_at) AS latest FROM subscriptions GROUP BY tenant_id) l
         ON l.tenant_id = s.tenant_id AND l.latest = s.created_at
       LEFT JOIN plans p ON p.id = s.plan_id
      WHERE s.tenant_id <> ?`,
    [PLATFORM_TENANT_ID]
  );

  const revenue = { mrr: {}, paying: 0, trials: 0, trialsEnding7d: 0, pastDue: 0 };
  for (const r of revenueRows) {
    const cur = (r.currency || 'USD').toUpperCase();
    if (r.status === 'active') {
      const monthly = r.billing_cycle === 'yearly'
        ? Number(r.price_yearly || 0) / 12
        : Number(r.price_monthly || 0);
      revenue.mrr[cur] = (revenue.mrr[cur] || 0) + monthly;
      revenue.paying += 1;
    } else if (r.status === 'trial') {
      revenue.trials += 1;
    }
  }
  const [[trialEnding]] = await pool.query(
    `SELECT COUNT(*) AS c FROM subscriptions
      WHERE status = 'trial' AND trial_end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`
  );
  revenue.trialsEnding7d = trialEnding?.c || 0;
  const [[pastDue]] = await pool.query(
    `SELECT COUNT(*) AS c FROM subscriptions s
       JOIN (SELECT tenant_id, MAX(created_at) AS latest FROM subscriptions GROUP BY tenant_id) l
         ON l.tenant_id = s.tenant_id AND l.latest = s.created_at
      WHERE s.grace_period_ends_at IS NOT NULL AND s.status IN ('active','trial')`
  );
  revenue.pastDue = pastDue?.c || 0;

  const [[usage]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE tenant_id <> ?) AS staff,
       (SELECT COUNT(*) FROM users WHERE tenant_id <> ? AND last_login_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS activeStaff7d,
       (SELECT COUNT(*) FROM stores) AS stores,
       (SELECT COUNT(*) FROM products) AS products,
       (SELECT COUNT(*) FROM sales WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) AS sales30d`,
    [PLATFORM_TENANT_ID, PLATFORM_TENANT_ID]
  );

  const attention = (await listTenants())
    .filter((t) => t.healthStatus !== 'healthy')
    .slice(0, 8)
    .map((t) => ({ id: t.id, name: t.name, status: t.status, healthScore: t.healthScore, flags: t.flags }));

  return { tenants: tenantCounts, revenue, usage, attention };
};

/** Latest run per job + DB ping + uptime — feeds /system/health. */
const health = async () => {
  let dbOk = true;
  try { await pool.query('SELECT 1'); } catch (_) { dbOk = false; }

  const [jobs] = await pool.query(
    `SELECT jr.job_name, jr.started_at, jr.finished_at, jr.status, jr.message
       FROM job_runs jr
       JOIN (SELECT job_name, MAX(started_at) AS latest FROM job_runs GROUP BY job_name) l
         ON l.job_name = jr.job_name AND l.latest = jr.started_at
      ORDER BY jr.started_at DESC`
  );

  return {
    database: dbOk ? 'up' : 'down',
    uptimeSeconds: Math.round(process.uptime()),
    node: process.version,
    jobs,
  };
};

// ============================================================================
// TENANTS
// ============================================================================

/**
 * Tenant list enriched with latest subscription, plan, usage counts, and a
 * 0–100 health score (paisepath scoring: suspended −50, pending_deletion
 * −60, payment grace −25, trial ending ≤3d −5, no login in 14d −25,
 * ≥90% of a plan limit −10 per flagged limit).
 */
const listTenants = async () => {
  const [rows] = await pool.query(
    `SELECT
       t.id, t.name, t.industry_code, t.status, t.created_at,
       t.suspended_reason, t.suspended_at, t.deletion_due_at,
       s.status AS sub_status, s.billing_cycle, s.trial_end_date,
       s.end_date, s.grace_period_ends_at,
       p.name AS plan_name, p.limits AS plan_limits,
       (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) AS user_count,
       (SELECT COUNT(*) FROM stores st WHERE st.tenant_id = t.id) AS store_count,
       (SELECT COUNT(*) FROM products pr WHERE pr.tenant_id = t.id) AS product_count,
       (SELECT MAX(u2.last_login_at) FROM users u2 WHERE u2.tenant_id = t.id) AS last_login_at
     FROM tenants t
     LEFT JOIN subscriptions s ON s.id = (
       SELECT s2.id FROM subscriptions s2 WHERE s2.tenant_id = t.id
       ORDER BY s2.created_at DESC LIMIT 1)
     LEFT JOIN plans p ON p.id = s.plan_id
     WHERE t.id <> ?
     ORDER BY t.created_at DESC`,
    [PLATFORM_TENANT_ID]
  );

  const now = Date.now();
  return rows.map((t) => {
    let score = 100;
    const flags = [];

    if (t.status === 'suspended') { score -= 50; flags.push('suspended'); }
    if (t.status === 'pending_deletion') { score -= 60; flags.push('pending_deletion'); }
    if (t.grace_period_ends_at) { score -= 25; flags.push('payment_grace'); }
    if (t.sub_status === 'trial' && t.trial_end_date) {
      const daysLeft = (new Date(t.trial_end_date).getTime() - now) / 86400000;
      if (daysLeft <= 3) { score -= 5; flags.push('trial_ending'); }
    }
    if (!t.last_login_at || (now - new Date(t.last_login_at).getTime()) > 14 * 86400000) {
      score -= 25; flags.push('inactive_14d');
    }
    const limits = parseJson(t.plan_limits);
    if (limits) {
      const usage = { max_users: t.user_count, max_stores: t.store_count, max_products: t.product_count };
      for (const [key, current] of Object.entries(usage)) {
        const max = Number(limits[key]);
        if (max > 0 && current >= max * 0.9) { score -= 10; flags.push(`near_limit:${key}`); }
      }
    }

    return {
      ...t,
      plan_limits: undefined,
      healthScore: Math.max(0, score),
      healthStatus: score >= 80 ? 'healthy' : score >= 50 ? 'watch' : 'at_risk',
      flags,
    };
  });
};

const getTenant = async (tenantId) => {
  const [[tenant]] = await pool.query('SELECT * FROM tenants WHERE id = ?', [tenantId]);
  if (!tenant) return null;

  const [[sub]] = await pool.query(
    `SELECT s.*, p.name AS plan_name, p.price_monthly, p.price_yearly, p.currency,
            p.features AS plan_features, p.limits AS plan_limits
       FROM subscriptions s LEFT JOIN plans p ON p.id = s.plan_id
      WHERE s.tenant_id = ? ORDER BY s.created_at DESC LIMIT 1`,
    [tenantId]
  );
  const [admins] = await pool.query(
    `SELECT u.id, u.name, u.email, u.is_active, u.last_login_at, u.totp_enabled
       FROM users u
      WHERE u.tenant_id = ? AND EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = u.id
           AND LOWER(REPLACE(r.name, ' ', '_')) = 'tenant_admin'
           AND r.is_system_role = 1)
      ORDER BY u.created_at ASC`,
    [tenantId]
  );
  const [stores] = await pool.query(
    'SELECT id, name, is_active, created_at FROM stores WHERE tenant_id = ?', [tenantId]
  );
  const [[counts]] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM users WHERE tenant_id = ?) AS users,
       (SELECT COUNT(*) FROM stores WHERE tenant_id = ?) AS stores,
       (SELECT COUNT(*) FROM products WHERE tenant_id = ?) AS products,
       (SELECT COUNT(*) FROM sales WHERE tenant_id = ?) AS sales`,
    [tenantId, tenantId, tenantId, tenantId]
  );

  return { tenant, subscription: sub || null, admins, stores, counts };
};

/**
 * Create a tenant + first admin + main store + trial subscription in one
 * transaction — the platform-console equivalent of the signup pipeline's
 * provisionTenantAfterVerification (store, Tenant Admin role, payment
 * methods/settings). The heavier provisioning (print templates etc.) runs
 * afterward via TenantProvisioningService, best-effort.
 */
const createTenant = async (data, actorId) => {
  // Request bodies arrive snake_case (fetchApi converts camelCase →
  // snake_case before sending); accept both shapes for internal callers.
  const name = data.name;
  const adminName = data.admin_name ?? data.adminName;
  const adminEmail = data.admin_email ?? data.adminEmail;
  const adminPassword = data.admin_password ?? data.adminPassword;
  const adminPhone = data.admin_phone ?? data.adminPhone;
  const industryCode = data.industry_code ?? data.industryCode ?? 'general_retail';
  const planName = data.plan_name ?? data.planName ?? 'Starter';
  const trialDays = data.trial_days ?? data.trialDays ?? 14;

  if (!name?.trim()) throw Object.assign(new Error('Tenant name is required'), { status: 400 });
  if (!adminName?.trim() || !adminEmail?.trim() || !adminPassword) {
    throw Object.assign(new Error('Admin name, email and password are required'), { status: 400 });
  }
  if (String(adminPassword).length < 8) {
    throw Object.assign(new Error('Admin password must be at least 8 characters'), { status: 400 });
  }

  const [dup] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [adminEmail.trim().toLowerCase()]);
  if (dup.length) throw Object.assign(new Error('A user with that email already exists'), { status: 409 });

  const tenantId = uuidv4();
  const userId = uuidv4();
  const hash = await bcrypt.hash(String(adminPassword), 10);
  const days = Math.min(Math.max(parseInt(trialDays, 10) || 0, 0), 90);

  await executeTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO tenants (id, name, industry_code, status, created_by,
                            setup_completed, trial_started_at, onboarding_step,
                            created_at, updated_at)
       VALUES (?, ?, ?, 'active', ?, 1, NOW(), 'completed', NOW(), NOW())`,
      [tenantId, name.trim(), industryCode, actorId || null]
    );

    await connection.execute(
      `INSERT INTO users (id, tenant_id, name, email, password_hash, phone_number,
                          is_active, email_verified, signup_completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1, NOW(), NOW())`,
      [userId, tenantId, adminName.trim(), adminEmail.trim().toLowerCase(), hash, adminPhone || null]
    );

    // Same provisioning shape as signupService.provisionTenantAfterVerification
    const storeId = uuidv4();
    await connection.execute(
      `INSERT INTO stores (id, name, tenant_id, address, phone, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [storeId, `${name.trim()} - Main Store`, tenantId, 'Address to be updated', adminPhone || null, adminEmail]
    );
    await connection.execute('UPDATE users SET store_id = ? WHERE id = ?', [storeId, userId]);

    const adminRoleId = uuidv4();
    await connection.execute(
      `INSERT INTO roles (id, name, description, tenant_id, is_system_role, created_by, created_at, updated_at)
       VALUES (?, 'Tenant Admin', 'Full administrative access to tenant resources', ?, 1, ?, NOW(), NOW())`,
      [adminRoleId, tenantId, userId]
    );
    await connection.execute(
      'INSERT INTO user_roles (user_id, role_id, created_at) VALUES (?, ?, NOW())',
      [userId, adminRoleId]
    );

    const defaultPaymentMethods = [
      [uuidv4(), tenantId, 'Cash', 'cash', true, false, 'cash', 1],
      [uuidv4(), tenantId, 'Credit/Debit Card', 'card', true, true, 'credit-card', 2],
      [uuidv4(), tenantId, 'Phone', 'phone', true, true, 'phone', 3],
      [uuidv4(), tenantId, 'Charge', 'ON_ACCOUNT', true, false, 'user', 4],
      [uuidv4(), tenantId, 'No Payment Required', 'none', true, false, 'check-circle', 99],
    ];
    await connection.query(
      `INSERT INTO payment_methods (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at)
       VALUES ${defaultPaymentMethods.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())').join(', ')}`,
      defaultPaymentMethods.flat()
    );
    await connection.execute(
      `INSERT INTO tenant_payment_settings (tenant_id, default_currency, allow_partial_payments, created_at, updated_at)
       VALUES (?, 'USD', 1, NOW(), NOW())`,
      [tenantId]
    );

    // Trial subscription on the chosen plan
    const [[plan]] = await connection.query('SELECT * FROM plans WHERE name = ? AND is_active = 1', [planName]);
    const planRow = plan || null;
    const trialEnd = days > 0 ? daysFromNow(days) : null;
    await connection.execute(
      `INSERT INTO subscriptions (id, tenant_id, plan_id, status, start_date, end_date,
                                  trial_end_date, auto_renew, billing_cycle, created_at, updated_at)
       VALUES (?, ?, ?, ?, CURDATE(), ?, ?, 0, 'monthly', NOW(), NOW())`,
      [
        uuidv4(), tenantId, planRow?.id || planName,
        days > 0 && planRow ? 'trial' : 'active',
        daysFromNow(30), trialEnd,
      ]
    );
  });

  // Deterministic provisioning (print templates, tax profile, etc.) — same
  // service the admin provision route calls; best-effort, never blocks creation.
  try {
    const TenantProvisioningService = require('./tenantProvisioningService');
    await TenantProvisioningService.provisionTenant(tenantId, { requestedBy: actorId || 'platform' });
  } catch (e) {
    console.error(`[platform] post-create provisioning for ${tenantId} failed:`, e.message);
  }

  return { tenantId, userId };
};

const updateTenant = async (tenantId, data) => {
  const fields = pickFields(data, TENANT_PLATFORM_FIELDS);
  const keys = Object.keys(fields);
  if (!keys.length) throw Object.assign(new Error('No recognized fields to update'), { status: 400 });

  const sets = keys.map((k) => `\`${k}\` = ?`).join(', ');
  await pool.query(`UPDATE tenants SET ${sets}, updated_at = NOW() WHERE id = ?`, [...keys.map((k) => fields[k]), tenantId]);
  return pickFields(data, TENANT_PLATFORM_FIELDS);
};

const setTenantStatus = async (tenantId, status, { reason = null, actorId = null, deletionDueAt = null } = {}) => {
  if (tenantId === PLATFORM_TENANT_ID) {
    throw Object.assign(new Error('The platform tenant cannot be suspended or deleted'), { status: 400 });
  }
  const sets = ['status = ?', 'updated_at = NOW()'];
  const vals = [status];
  if (status === 'suspended') {
    sets.push('suspended_reason = ?', 'suspended_at = NOW()', 'deletion_due_at = NULL');
    vals.push(reason || null);
  } else if (status === 'pending_deletion') {
    sets.push('suspended_reason = ?', 'deletion_due_at = ?');
    vals.push(reason || null, deletionDueAt);
  } else {
    sets.push('suspended_reason = NULL', 'suspended_at = NULL', 'deletion_due_at = NULL');
  }
  vals.push(tenantId);
  await pool.query(`UPDATE tenants SET ${sets.join(', ')} WHERE id = ?`, vals);

  // Instant lockout: revoke every live session for the tenant's users.
  if (status !== 'active') {
    await pool.query(
      `UPDATE user_sessions s JOIN users u ON u.id = s.user_id
          SET s.revoked_at = NOW()
        WHERE u.tenant_id = ? AND s.revoked_at IS NULL`,
      [tenantId]
    ).catch(() => {});
  }
  invalidateTenantStatus(tenantId);
};

const suspendTenant = (tenantId, reason, actorId) =>
  setTenantStatus(tenantId, 'suspended', { reason, actorId });

const resumeTenant = (tenantId, actorId) =>
  setTenantStatus(tenantId, 'active', { actorId });

const scheduleDeletion = (tenantId, days, reason, actorId) => {
  const clamped = Math.min(Math.max(parseInt(days, 10) || 30, 7), 90);
  const due = new Date(Date.now() + clamped * 86400000);
  return setTenantStatus(tenantId, 'pending_deletion', {
    reason, actorId, deletionDueAt: due.toISOString().slice(0, 19).replace('T', ' '),
  });
};

const cancelDeletion = (tenantId, actorId) =>
  setTenantStatus(tenantId, 'active', { actorId });

/**
 * Full tenant data export as a JSON object (the route gzips it).
 * Credentials/password fields are intentionally excluded.
 */
const exportTenant = async (tenantId) => {
  const tables = [
    'tenants', 'stores', 'products', 'categories', 'customers', 'suppliers',
    'sales', 'sale_items', 'payment_methods', 'tax_rates', 'tax_classes',
    'stock_adjustments', 'repair_orders', 'layaway_plans', 'memos',
    'roles', 'print_templates', 'printer_settings', 'print_document_settings',
  ];
  const out = { exportedAt: new Date().toISOString(), tenantId, tables: {} };
  for (const table of tables) {
    try {
      const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE tenant_id = ?`, [tenantId]);
      out.tables[table] = rows;
    } catch (_) {
      // Table may not exist in older schemas — skip rather than fail the export.
    }
  }
  const [users] = await pool.query(
    'SELECT id, tenant_id, name, email, phone_number, is_active, last_login_at, created_at FROM users WHERE tenant_id = ?',
    [tenantId]
  );
  out.tables.users = users;
  return out;
};

// ============================================================================
// FEATURE FLAGS (tri-state: default / on / off)
// ============================================================================

const getTenantFeatures = async (tenantId) => {
  const [rows] = await pool.query(
    'SELECT feature_key, state FROM tenant_features WHERE tenant_id = ?', [tenantId]
  );
  const overrides = Object.fromEntries(rows.map((r) => [r.feature_key, r.state]));
  // Resolve effective state: override → plan features JSON → default off-list
  const [[sub]] = await pool.query(
    `SELECT p.features FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.tenant_id = ? ORDER BY s.created_at DESC LIMIT 1`,
    [tenantId]
  );
  const planFeatures = parseJson(sub?.features) || {};
  return FEATURES.map((key) => ({
    key,
    override: overrides[key] || 'default',
    effective: overrides[key] && overrides[key] !== 'default'
      ? overrides[key] === 'on'
      : !!planFeatures[key],
  }));
};

const setTenantFeature = async (tenantId, featureKey, state, actorId) => {
  if (!FEATURES.includes(featureKey)) {
    throw Object.assign(new Error(`Unknown feature: ${featureKey}`), { status: 400 });
  }
  if (!['default', 'on', 'off'].includes(state)) {
    throw Object.assign(new Error("state must be 'default', 'on' or 'off'"), { status: 400 });
  }
  await pool.query(
    `INSERT INTO tenant_features (id, tenant_id, feature_key, state, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE state = VALUES(state), updated_by = VALUES(updated_by), updated_at = NOW()`,
    [uuidv4(), tenantId, featureKey, state, actorId]
  );
  return { featureKey, state };
};

// ============================================================================
// SUBSCRIPTIONS & BILLING
// ============================================================================

const listSubscriptions = async ({ status } = {}) => {
  const params = [];
  let where = '';
  if (status) { where = 'WHERE s.status = ?'; params.push(status); }
  const [rows] = await pool.query(
    `SELECT s.*, t.name AS tenant_name, p.name AS plan_name,
            p.price_monthly, p.price_yearly, p.currency
       FROM subscriptions s
       JOIN tenants t ON t.id = s.tenant_id
       LEFT JOIN plans p ON p.id = s.plan_id
       ${where}
      ORDER BY s.updated_at DESC`,
    params
  );
  return rows;
};

const updateSubscription = async (subId, data) => {
  const allowed = ['status', 'plan_id', 'start_date', 'end_date', 'trial_end_date',
                   'auto_renew', 'billing_cycle', 'payment_method'];
  const fields = pickFields(data, allowed);
  if (!Object.keys(fields).length) {
    throw Object.assign(new Error('No recognized fields to update'), { status: 400 });
  }
  const sets = Object.keys(fields).map((k) => `\`${k}\` = ?`).join(', ');
  await pool.query(
    `UPDATE subscriptions SET ${sets}, updated_at = NOW() WHERE id = ?`,
    [...Object.values(fields), subId]
  );
  const [[sub]] = await pool.query('SELECT * FROM subscriptions WHERE id = ?', [subId]);
  return sub;
};

/**
 * Billing issues feed: subscriptions in the payment-failure grace window or
 * with recorded failed attempts, trials ending within 7 days, and trials/actives
 * expired in the last 60 days.
 */
const billingIssues = async () => {
  const [rows] = await pool.query(
    `SELECT s.id, s.tenant_id, t.name AS tenant_name, s.status, s.billing_cycle,
            s.trial_end_date, s.end_date, s.grace_period_ends_at, s.metadata,
            p.name AS plan_name
       FROM subscriptions s
       JOIN tenants t ON t.id = s.tenant_id
       LEFT JOIN plans p ON p.id = s.plan_id
      WHERE (s.grace_period_ends_at IS NOT NULL)
         OR (s.status = 'trial' AND s.trial_end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY))
         OR (s.status = 'expired' AND s.end_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY))
      ORDER BY s.updated_at DESC`
  );
  return rows.map((r) => {
    const meta = parseJson(r.metadata) || {};
    return {
      ...r,
      metadata: undefined,
      failedAttempts: meta.failedAttempts || 0,
      issue: r.grace_period_ends_at ? 'payment_grace'
        : r.status === 'trial' ? 'trial_ending' : 'lapsed',
    };
  });
};

// ============================================================================
// PLATFORM STAFF
// ============================================================================

const listSystemUsers = async () => {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone_number, u.is_active, u.last_login_at,
            u.created_at,
            (SELECT GROUP_CONCAT(r.name) FROM user_roles ur JOIN roles r ON r.id = ur.role_id
              WHERE ur.user_id = u.id AND r.tenant_id IS NULL) AS system_roles
       FROM users u
      WHERE u.tenant_id = ?
      ORDER BY u.created_at ASC`,
    [PLATFORM_TENANT_ID]
  );
  return rows.map((r) => ({ ...r, system_roles: r.system_roles ? r.system_roles.split(',') : [] }));
};

const createSystemUser = async (data, actorId) => {
  const { name, email, password } = data;
  const roleName = data.role_name ?? data.roleName;
  if (!name?.trim() || !email?.trim() || !password) {
    throw Object.assign(new Error('name, email and password are required'), { status: 400 });
  }
  if (String(password).length < 10) {
    throw Object.assign(new Error('Password must be at least 10 characters'), { status: 400 });
  }
  const normalized = email.trim().toLowerCase();
  const [dup] = await pool.query('SELECT id FROM users WHERE email = ?', [normalized]);
  if (dup.length) throw Object.assign(new Error('A user with that email already exists'), { status: 409 });

  const role = await getPlatformRoleByName(roleName || 'System Support');
  if (!role) throw Object.assign(new Error(`Unknown platform role: ${roleName}`), { status: 400 });

  const userId = uuidv4();
  const hash = await bcrypt.hash(String(password), 10);
  await executeTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO users (id, tenant_id, name, email, password_hash,
                          is_active, email_verified, signup_completed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, 1, 1, NOW(), NOW())`,
      [userId, PLATFORM_TENANT_ID, name.trim(), normalized, hash]
    );
    await connection.execute(
      'INSERT INTO user_roles (id, user_id, role_id, scope, assigned_by, created_at) VALUES (?, ?, ?, "tenant", ?, NOW())',
      [uuidv4(), userId, role.id, actorId]
    );
  });
  return { id: userId };
};

const updateSystemUser = async (userId, data, actorId) => {
  const { name, password } = data;
  const isActive = data.is_active ?? data.isActive;
  const roleName = data.role_name ?? data.roleName;
  const [[u]] = await pool.query('SELECT * FROM users WHERE id = ? AND tenant_id = ?', [userId, PLATFORM_TENANT_ID]);
  if (!u) throw Object.assign(new Error('Platform user not found'), { status: 404 });

  const sets = [];
  const vals = [];
  if (name !== undefined) { sets.push('name = ?'); vals.push(String(name).trim()); }
  if (isActive !== undefined) { sets.push('is_active = ?'); vals.push(isActive ? 1 : 0); }
  if (password) {
    if (String(password).length < 10) throw Object.assign(new Error('Password must be at least 10 characters'), { status: 400 });
    sets.push('password_hash = ?');
    vals.push(await bcrypt.hash(String(password), 10));
  }
  if (sets.length) {
    vals.push(userId);
    await pool.query(`UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = ?`, vals);
  }

  if (roleName) {
    const role = await getPlatformRoleByName(roleName);
    if (!role) throw Object.assign(new Error(`Unknown platform role: ${roleName}`), { status: 400 });
    await pool.query(
      `DELETE ur FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ? AND r.tenant_id IS NULL`, [userId]
    );
    await pool.query(
      'INSERT INTO user_roles (id, user_id, role_id, scope, assigned_by, created_at) VALUES (?, ?, ?, "tenant", ?, NOW())',
      [uuidv4(), userId, role.id, actorId]
    );
    try { cacheService.deleteByPrefix(`rbac:${userId}:`); } catch (_) {}
  }

  // Any material change signs the staff member out everywhere.
  await pool.query(
    'UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]
  ).catch(() => {});
};

const deleteSystemUser = async (userId, actorId) => {
  if (userId === actorId) throw Object.assign(new Error('You cannot delete your own account'), { status: 400 });
  if (userId === PLATFORM_SYSTEM_USER_ID) throw Object.assign(new Error('The platform system user cannot be deleted'), { status: 400 });
  const [[u]] = await pool.query('SELECT id FROM users WHERE id = ? AND tenant_id = ?', [userId, PLATFORM_TENANT_ID]);
  if (!u) throw Object.assign(new Error('Platform user not found'), { status: 404 });

  // Never orphan the console: refuse to remove the last active System Admin.
  if (await isSystemRoleUser(userId, 'System Admin')) {
    const [[c]] = await pool.query(
      `SELECT COUNT(DISTINCT ur.user_id) AS c
         FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         JOIN users u ON u.id = ur.user_id AND u.is_active = 1
        WHERE r.tenant_id IS NULL AND r.name = 'System Admin' AND ur.user_id <> ?`,
      [userId]
    );
    if (!c.c) throw Object.assign(new Error('Cannot delete the last active System Admin'), { status: 400 });
  }
  await pool.query('UPDATE users SET is_active = 0, updated_at = NOW() WHERE id = ?', [userId]);
  await pool.query('UPDATE user_sessions SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL', [userId]).catch(() => {});
};

const getPlatformRoleByName = async (name) => {
  const [[r]] = await pool.query(
    'SELECT id, name FROM roles WHERE tenant_id IS NULL AND name = ?', [name]
  );
  return r || null;
};

const isSystemRoleUser = async (userId, roleName) => {
  const [[r]] = await pool.query(
    `SELECT 1 AS x FROM user_roles ur JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ? AND r.tenant_id IS NULL AND r.name = ? LIMIT 1`,
    [userId, roleName]
  );
  return !!r;
};

const listPlatformRoles = async () => {
  const [roles] = await pool.query(
    `SELECT r.id, r.name, r.description FROM roles r WHERE r.tenant_id IS NULL ORDER BY r.name`
  );
  const [perms] = await pool.query(
    `SELECT rp.role_id, p.id AS permission_id, p.name, p.description, p.module
       FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
       JOIN roles r ON r.id = rp.role_id AND r.tenant_id IS NULL
      ORDER BY p.module, p.name`
  );
  return roles.map((r) => ({ ...r, permissions: perms.filter((p) => p.role_id === r.id) }));
};

/** All permission names grantable to platform roles (system-scoped only). */
const listPlatformPermissions = async () => {
  const [rows] = await pool.query(
    `SELECT id, name, description, module FROM permissions
      WHERE name REGEXP '^(platform|tenants|subscriptions|plans|support|system)\\.'
      ORDER BY module, name`
  );
  return rows;
};

const updatePlatformRolePermissions = async (roleId, permissionIds, actorId) => {
  const [[role]] = await pool.query('SELECT id FROM roles WHERE id = ? AND tenant_id IS NULL', [roleId]);
  if (!role) throw Object.assign(new Error('Platform role not found'), { status: 404 });

  const allowed = await listPlatformPermissions();
  const allowedIds = new Set(allowed.map((p) => p.id));
  const ids = (Array.isArray(permissionIds) ? permissionIds : []).filter((id) => allowedIds.has(id));

  await executeTransaction(async (connection) => {
    await connection.query('DELETE FROM role_permissions WHERE role_id = ?', [roleId]);
    if (ids.length) {
      await connection.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ${ids.map(() => '(?, ?)').join(', ')}`,
        ids.flatMap((id) => [roleId, id])
      );
    }
  });
  try { cacheService.deleteByPrefix('rbac:'); } catch (_) {}
};

// ============================================================================
// AUDIT
// ============================================================================

const auditFeed = async ({ tenantId, limit = 100, offset = 0 } = {}) => {
  const params = [];
  const where = tenantId ? 'WHERE al.tenant_id = ?' : '';
  if (tenantId) params.push(tenantId);
  const [rows] = await pool.query(
    `SELECT al.id, al.tenant_id, t.name AS tenant_name, al.user_id, al.action,
            al.resource_type AS entity_type, al.resource_id AS entity_id,
            al.severity, al.status, al.details,
            al.ip_address, al.created_at, u.email AS user_email
       FROM audit_logs al
       LEFT JOIN tenants t ON t.id = al.tenant_id
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?`,
    [...params, Number(limit), Number(offset)]
  );
  return rows;
};

// ============================================================================
// ANNOUNCEMENTS
// ============================================================================

const listAnnouncements = async () => {
  const [rows] = await pool.query('SELECT * FROM announcements ORDER BY created_at DESC');
  return rows;
};

const createAnnouncement = async (data, actorId) => {
  const { title, body, severity, audience } = data;
  const startsAt = data.starts_at ?? data.startsAt;
  const endsAt = data.ends_at ?? data.endsAt;
  if (!title?.trim()) throw Object.assign(new Error('title is required'), { status: 400 });
  const id = uuidv4();
  await pool.query(
    `INSERT INTO announcements (id, title, body, severity, audience, starts_at, ends_at, is_active, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())`,
    [id, title.trim(), body || null, severity || 'info', audience || 'all',
     startsAt || null, endsAt || null, actorId]
  );
  return { id };
};

const updateAnnouncement = async (id, data) => {
  const fields = pickFields(data, ['title', 'body', 'severity', 'audience', 'is_active']);
  const startsAt = data.starts_at ?? data.startsAt;
  const endsAt = data.ends_at ?? data.endsAt;
  if (startsAt !== undefined) fields.starts_at = startsAt;
  if (endsAt !== undefined) fields.ends_at = endsAt;
  if (!Object.keys(fields).length) throw Object.assign(new Error('No recognized fields'), { status: 400 });
  const sets = Object.keys(fields).map((k) => `\`${k}\` = ?`).join(', ');
  await pool.query(`UPDATE announcements SET ${sets}, updated_at = NOW() WHERE id = ?`, [...Object.values(fields), id]);
};

/** Active announcements for a tenant — consumed by the tenant-facing banner. */
const activeAnnouncements = async (tenantId) => {
  const [rows] = await pool.query(
    `SELECT a.id, a.title, a.body, a.severity
       FROM announcements a
      WHERE a.is_active = 1
        AND (a.starts_at IS NULL OR a.starts_at <= NOW())
        AND (a.ends_at IS NULL OR a.ends_at >= NOW())
        AND (a.audience = 'all' OR a.audience = (
          SELECT CASE
            WHEN s.status = 'trial' THEN 'trial'
            WHEN s.grace_period_ends_at IS NOT NULL THEN 'past_due'
            ELSE 'active' END
            FROM subscriptions s WHERE s.tenant_id = ?
            ORDER BY s.created_at DESC LIMIT 1))
      ORDER BY FIELD(a.severity, 'critical','warning','info'), a.created_at DESC`,
    [tenantId]
  );
  return rows;
};

// ============================================================================
// SUPPORT TICKETS
// ============================================================================

const listTickets = async ({ status } = {}) => {
  const params = [];
  let where = '';
  if (status) { where = 'WHERE st.status = ?'; params.push(status); }
  const [rows] = await pool.query(
    `SELECT st.*, t.name AS tenant_name, u.email AS user_email,
            (SELECT COUNT(*) FROM support_ticket_messages m WHERE m.ticket_id = st.id) AS message_count
       FROM support_tickets st
       JOIN tenants t ON t.id = st.tenant_id
       LEFT JOIN users u ON u.id = st.user_id
       ${where}
      ORDER BY st.updated_at DESC`,
    params
  );
  return rows;
};

const getTicket = async (ticketId) => {
  const [[ticket]] = await pool.query(
    `SELECT st.*, t.name AS tenant_name, u.email AS user_email
       FROM support_tickets st JOIN tenants t ON t.id = st.tenant_id
       LEFT JOIN users u ON u.id = st.user_id WHERE st.id = ?`,
    [ticketId]
  );
  if (!ticket) return null;
  const [messages] = await pool.query(
    `SELECT m.*, u.name AS author_name, u.email AS author_email
       FROM support_ticket_messages m LEFT JOIN users u ON u.id = m.author_user_id
      WHERE m.ticket_id = ? ORDER BY m.created_at ASC`,
    [ticketId]
  );
  return { ticket, messages };
};

const updateTicketStatus = async (ticketId, status, actorId) => {
  if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
    throw Object.assign(new Error('Invalid ticket status'), { status: 400 });
  }
  await pool.query('UPDATE support_tickets SET status = ?, updated_at = NOW() WHERE id = ?', [status, ticketId]);
};

const replyToTicket = async (ticketId, body, authorId, isPlatformReply) => {
  if (!body?.trim()) throw Object.assign(new Error('Reply body is required'), { status: 400 });
  const id = uuidv4();
  await pool.query(
    `INSERT INTO support_ticket_messages (id, ticket_id, author_user_id, body, is_platform_reply, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [id, ticketId, authorId, body.trim(), isPlatformReply ? 1 : 0]
  );
  await pool.query(
    `UPDATE support_tickets SET status = IF(status = 'open', 'in_progress', status), updated_at = NOW() WHERE id = ?`,
    [ticketId]
  );
  return { id };
};

// Tenant-facing ticket endpoints (mounted under /api/support)
const listMyTickets = async (tenantId) => {
  const [rows] = await pool.query(
    'SELECT id, subject, status, priority, created_at, updated_at FROM support_tickets WHERE tenant_id = ? ORDER BY updated_at DESC',
    [tenantId]
  );
  return rows;
};

const createTicket = async (tenantId, userId, { subject, body, priority }) => {
  if (!subject?.trim() || !body?.trim()) {
    throw Object.assign(new Error('subject and body are required'), { status: 400 });
  }
  const id = uuidv4();
  await executeTransaction(async (connection) => {
    await connection.execute(
      `INSERT INTO support_tickets (id, tenant_id, user_id, subject, status, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', ?, NOW(), NOW())`,
      [id, tenantId, userId, subject.trim(), ['low', 'normal', 'high', 'urgent'].includes(priority) ? priority : 'normal']
    );
    await connection.execute(
      `INSERT INTO support_ticket_messages (id, ticket_id, author_user_id, body, is_platform_reply, created_at)
       VALUES (?, ?, ?, ?, 0, NOW())`,
      [uuidv4(), id, userId, body.trim()]
    );
  });
  return { id };
};

// ============================================================================
// IMPERSONATION
// ============================================================================

/**
 * Mint a short-lived JWT scoped to the target tenant, carrying an `imp`
 * claim recording who/why. The token acts as the tenant's first Tenant Admin
 * (platform staff have no per-tenant user row). Dual-audited to both the
 * platform and tenant logs.
 */
const impersonate = async (tenantId, actor, reason) => {
  const [[tenant]] = await pool.query(
    'SELECT id, name, status FROM tenants WHERE id = ?', [tenantId]
  );
  if (!tenant) throw Object.assign(new Error('Tenant not found'), { status: 404 });
  if (tenantId === PLATFORM_TENANT_ID) {
    throw Object.assign(new Error('Cannot impersonate the platform tenant'), { status: 400 });
  }

  // Act as the tenant's first active Tenant Admin so tenant-scoped reads
  // resolve identically to what that admin sees.
  const [[admin]] = await pool.query(
    `SELECT u.id, u.email, u.name FROM users u
      WHERE u.tenant_id = ? AND u.is_active = 1 AND EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = u.id
           AND LOWER(REPLACE(r.name, ' ', '_')) = 'tenant_admin'
           AND r.is_system_role = 1)
      ORDER BY u.created_at ASC LIMIT 1`,
    [tenantId]
  );
  if (!admin) throw Object.assign(new Error('Tenant has no active admin user to impersonate'), { status: 400 });

  const rbacService = require('./rbacService');
  const rbacData = await rbacService.getUserRolesAndPermissions(admin.id, tenantId, null);

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const token = jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      tenant_id: tenantId,
      tenantId,
      roles: rbacData.roleNames,
      systemRoles: rbacData.systemRoles,
      permissions: rbacData.permissions,
      imp: {
        by: actor.id,
        email: actor.email,
        reason,
        exp: expiresAt.toISOString(),
      },
    },
    JWT_SECRET,
    { expiresIn: '30m' }
  );

  return { token, tenantName: tenant.name, expiresAt, actingAs: admin.email };
};

// ============================================================================
// helpers
// ============================================================================

const parseJson = (v) => {
  if (!v) return null;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return null; }
};

const daysFromNow = (n) => {
  const d = new Date(Date.now() + n * 86400000);
  return d.toISOString().slice(0, 10);
};

module.exports = {
  PLATFORM_TENANT_ID,
  PLATFORM_SYSTEM_USER_ID,
  FEATURES,
  overview,
  health,
  listTenants,
  getTenant,
  createTenant,
  updateTenant,
  suspendTenant,
  resumeTenant,
  scheduleDeletion,
  cancelDeletion,
  exportTenant,
  getTenantFeatures,
  setTenantFeature,
  listSubscriptions,
  updateSubscription,
  billingIssues,
  listSystemUsers,
  createSystemUser,
  updateSystemUser,
  deleteSystemUser,
  listPlatformRoles,
  listPlatformPermissions,
  updatePlatformRolePermissions,
  auditFeed,
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  activeAnnouncements,
  listTickets,
  getTicket,
  updateTicketStatus,
  replyToTicket,
  listMyTickets,
  createTicket,
  impersonate,
  auditPlatform,
};
