/**
 * Audit Log Service
 * Records security-relevant events for compliance and debugging
 *
 * Writes to the `audit_logs` table (baseline schema). Callers pass loose
 * fields (action/entity_type/entity_id/details) which are mapped onto the
 * table's columns (action/resource_type/resource_id/details). Failures are
 * logged and swallowed — audit must never break the main request flow.
 */

const { pool } = require('../config/db');
const logger = require('../utils/logger');
const DEBUG_AUDIT = process.env.DEBUG_AUDIT === 'true';

// entity_type → audit_logs.event_category default. Callers can always
// override with an explicit event_category.
const DEFAULT_CATEGORY = {
  role: 'user_management',
  role_permission: 'authorization',
  user_role: 'authorization',
  user: 'user_management',
  permission: 'authorization',
  print_job: 'system',
  printer_device: 'configuration',
  activity: 'system',
};

/**
 * Log an audit event
 * @param {Object} data - Audit event data
 * @param {string} data.tenant_id - Tenant ID
 * @param {string} data.store_id - Store ID (optional)
 * @param {string} data.user_id - User ID (optional)
 * @param {string} data.action - Action performed (e.g., 'role_created', 'role_permissions_updated')
 * @param {string} data.entity_type - Type of entity (e.g., 'role', 'user_role')
 * @param {string} data.entity_id - ID of the entity (optional)
 * @param {Object} data.details - Additional details (JSON)
 * @param {Object} [data.old_values] - Previous state (JSON)
 * @param {Object} [data.new_values] - New state (JSON)
 * @param {string} [data.event_category] - audit_logs.event_category override
 * @param {string} [data.severity] - 'low'|'medium'|'high'|'critical' (default 'medium')
 * @param {string} [data.status] - 'success'|'failure'|'warning' (default 'success')
 * @param {string} [data.error_message] - failure detail (optional)
 * @param {string} data.ip_address - Client IP address
 * @param {string} data.user_agent - Client user agent
 */
async function logAuditEvent(data) {
  try {
    const {
      tenant_id,
      store_id = null,
      user_id = null,
      action,
      entity_type,
      entity_id = null,
      details = {},
      old_values = null,
      new_values = null,
      event_category = null,
      severity = 'medium',
      status = 'success',
      error_message = null,
      ip_address = null,
      user_agent = null
    } = data;

    if (!action) return;

    if (DEBUG_AUDIT) {
      logger.log(`[AUDIT] ${action} | Tenant: ${tenant_id} | User: ${user_id} | Entity: ${entity_type}:${entity_id} | IP: ${ip_address}`);
    }

    await pool.query(
      `INSERT INTO audit_logs
         (user_id, tenant_id, store_id, action, resource_type, resource_id,
          event_category, severity, ip_address, user_agent,
          old_values, new_values, details, status, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        user_id || null,
        tenant_id || null,
        store_id || null,
        String(action).slice(0, 100),
        String(entity_type || 'activity').slice(0, 50),
        entity_id || null,
        event_category || DEFAULT_CATEGORY[entity_type] || 'system',
        severity,
        ip_address || null,
        user_agent || null,
        old_values ? JSON.stringify(old_values) : null,
        new_values ? JSON.stringify(new_values) : null,
        JSON.stringify(details || {}),
        status,
        error_message || null,
      ]
    );
  } catch (error) {
    // Don't throw errors from audit logging to avoid breaking main flow
    logger.error('Error logging audit event:', error);
  }
}

/**
 * Log a print job event
 */
async function logPrintJob(tenantId, storeId, userId, printerDeviceId, jobType, documentType, ipAddress, userAgent) {
  await logAuditEvent({
    tenant_id: tenantId,
    store_id: storeId,
    user_id: userId,
    action: 'print_job_created',
    entity_type: 'print_job',
    entity_id: null, // Will be set when print_jobs table is used
    details: {
      printer_device_id: printerDeviceId,
      job_type: jobType,
      document_type: documentType
    },
    ip_address: ipAddress,
    user_agent: userAgent
  });
}

/**
 * Log a printer device event
 */
async function logPrinterDeviceEvent(tenantId, storeId, userId, action, deviceId, details, ipAddress, userAgent) {
  await logAuditEvent({
    tenant_id: tenantId,
    store_id: storeId,
    user_id: userId,
    action: action,
    entity_type: 'printer_device',
    entity_id: deviceId,
    details: details,
    ip_address: ipAddress,
    user_agent: userAgent
  });
}

async function logActivity(data) {
  await logAuditEvent({
    tenant_id: data.tenant_id,
    store_id: data.store_id || data.details?.storeId || null,
    user_id: data.user_id,
    action: data.action || data.action_type,
    entity_type: data.entity_type || 'activity',
    entity_id: data.entity_id || data.details?.saleId || data.details?.productId || null,
    event_category: data.event_category,
    severity: data.severity,
    status: data.status,
    details: { ...data.details, description: data.description, username: data.username },
    ip_address: data.ip_address,
    user_agent: data.user_agent
  });
}

/**
 * Convenience: build the audit payload from an Express request so callers
 * stay one-line. Usage:
 *   await auditReq(req, { action: 'role_updated', entity_type: 'role', entity_id: id, ... });
 */
async function auditReq(req, fields) {
  await logAuditEvent({
    tenant_id: req.user?.tenant_id || req.tenantId || null,
    store_id: req.user?.store_id || req.user?.storeId || req.headers?.['store-id'] || null,
    user_id: req.user?.id || null,
    ip_address: req.ip || req.headers?.['x-forwarded-for'] || null,
    user_agent: req.headers?.['user-agent'] || null,
    ...fields,
  });
}

module.exports = {
  logActivity,
  logAuditEvent,
  auditReq,
  logPrintJob,
  logPrinterDeviceEvent
};
