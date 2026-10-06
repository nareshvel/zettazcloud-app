/**
 * Limit Service (RBAC Phase 2d)
 *
 * Resolves per-role numeric caps (role_limits) for the acting user and
 * verifies manager-PIN overrides when an action exceeds the cap.
 *
 * Effective cap = MIN(limit_value) across the user's applicable roles in
 * this tenant/store context — the most restrictive role wins, matching the
 * fail-closed spirit of the rest of the RBAC layer. No configured limit
 * returns null = uncapped (existing tenants keep current behaviour).
 */

const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const logger = require('../logger');
const rbacService = require('./rbacService');

const LIMIT_TYPES = ['discount_percent', 'discount_amount', 'refund_amount'];

/**
 * Effective cap for a user in a tenant/store context.
 * @returns {Promise<number|null>} cap value, or null when uncapped
 */
const getEffectiveLimit = async (userId, tenantId, limitType, storeId = null) => {
  if (!LIMIT_TYPES.includes(limitType)) throw new Error(`Unknown limit_type: ${limitType}`);
  if (!userId || !tenantId) return null;

  // Tenant admins are uncapped — they hold the keys anyway
  if (await rbacService.isTenantAdmin(userId, tenantId)) return null;

  const params = [userId, tenantId, limitType];
  let scopeClause = `AND (ur.scope = 'tenant' OR ur.store_id IS NULL)`;
  if (storeId) {
    scopeClause = `AND (ur.scope = 'tenant' OR ur.store_id = ?)`;
    params.push(storeId);
  }

  const [rows] = await pool.query(
    `SELECT MIN(rl.limit_value) AS cap
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     JOIN role_limits rl ON rl.role_id = r.id AND rl.tenant_id = r.tenant_id
     WHERE ur.user_id = ?
       AND r.tenant_id = ?
       AND rl.limit_type = ?
       AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
       ${scopeClause}`,
    params
  );
  const cap = rows && rows[0] && rows[0].cap != null ? Number(rows[0].cap) : null;
  return cap;
};

/**
 * Find an active user in the tenant whose role grants
 * `approvals.manager_override` and whose POS PIN matches. When storeId is
 * given, the manager's assignment must be tenant-scoped or for that store.
 *
 * @returns {Promise<{id:string,name:string}|null>} the approving manager
 */
const verifyManagerPin = async (tenantId, pin, storeId = null) => {
  if (!tenantId || !pin) return null;
  const pinStr = String(pin).trim();
  if (!/^\d{4,8}$/.test(pinStr)) return null;

  const params = [tenantId, tenantId];
  let scopeClause = '';
  if (storeId) {
    scopeClause = `AND (ur.scope = 'tenant' OR ur.store_id IS NULL OR ur.store_id = ?)`;
    params.push(storeId);
  }

  const [candidates] = await pool.query(
    `SELECT DISTINCT u.id, u.name, u.pos_pin_hash
     FROM users u
     JOIN user_roles ur ON ur.user_id = u.id
     JOIN roles r ON r.id = ur.role_id AND r.tenant_id = ?
     JOIN role_permissions rp ON rp.role_id = r.id
     JOIN permissions p ON p.id = rp.permission_id AND p.name = 'approvals.manager_override'
     WHERE u.tenant_id = ?
       AND u.is_active = 1
       AND u.pos_pin_hash IS NOT NULL
       AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
       ${scopeClause}`,
    params
  );

  for (const c of candidates || []) {
    try {
      if (await bcrypt.compare(pinStr, c.pos_pin_hash)) {
        return { id: c.id, name: c.name };
      }
    } catch (e) {
      logger.error(`[limits] PIN compare failed for user ${c.id}: ${e.message}`);
    }
  }
  return null;
};

/**
 * Enforce a cap for an attempted action.
 * @returns {Promise<{ok:true, overriddenBy?:object}|{ok:false,status:403,body:object}>}
 */
const enforceLimit = async ({ req, userId, tenantId, storeId, limitType, attemptedValue, context = {} }) => {
  let cap = null;
  try {
    cap = await getEffectiveLimit(userId, tenantId, limitType, storeId);
  } catch (e) {
    // Fail open on lookup errors — caps are opt-in; a DB hiccup must not
    // block checkout/returns for tenants that never configured limits.
    logger.error(`[limits] limit lookup failed (${limitType}): ${e.message}`);
    return { ok: true };
  }
  if (cap == null || Number(attemptedValue) <= cap) return { ok: true };

  const manager = await verifyManagerPin(tenantId, req.body?.manager_pin, storeId).catch(() => null);
  if (manager) {
    const { auditReq } = require('./auditLogService');
    await auditReq(req, {
      action: 'manager_override_used',
      entity_type: 'activity',
      severity: 'high',
      details: { limit_type: limitType, cap, attempted: attemptedValue, approved_by: manager.id, ...context },
    });
    return { ok: true, overriddenBy: manager };
  }

  return {
    ok: false,
    status: 403,
    body: {
      message: 'This action exceeds your limit and requires manager approval',
      code: 'LIMIT_EXCEEDED',
      limit_type: limitType,
      limit_value: cap,
      attempted_value: attemptedValue,
      requires_manager_override: true,
    },
  };
};

module.exports = { LIMIT_TYPES, getEffectiveLimit, verifyManagerPin, enforceLimit };
