/**
 * Audit Log Service
 * Records security-relevant events for compliance and debugging
 */

const { pool } = require('../config/db');
const logger = require('../utils/logger');
const DEBUG_AUDIT = process.env.DEBUG_AUDIT === 'true';

/**
 * Log an audit event
 * @param {Object} data - Audit event data
 * @param {string} data.tenant_id - Tenant ID
 * @param {string} data.store_id - Store ID (optional)
 * @param {string} data.user_id - User ID (optional)
 * @param {string} data.action - Action performed (e.g., 'print_job_created', 'printer_device_added')
 * @param {string} data.entity_type - Type of entity (e.g., 'print_job', 'printer_device')
 * @param {string} data.entity_id - ID of the entity (optional)
 * @param {Object} data.details - Additional details (JSON)
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
      ip_address = null,
      user_agent = null
    } = data;

    // Console audit output is opt-in to keep routine server logs quiet
    // In production, this should write to an audit_log table
    if (DEBUG_AUDIT) {
      logger.log(`[AUDIT] ${action} | Tenant: ${tenant_id} | User: ${user_id} | Entity: ${entity_type}:${entity_id} | IP: ${ip_address}`);
    }

    // TODO: Create audit_log table and insert record
    // await pool.query(
    //   `INSERT INTO audit_log (tenant_id, store_id, user_id, action, entity_type, entity_id, details, ip_address, user_agent, created_at)
    //    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
    //   [tenant_id, store_id, user_id, action, entity_type, entity_id, JSON.stringify(details), ip_address, user_agent]
    // );
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
    details: { ...data.details, description: data.description, username: data.username },
    ip_address: data.ip_address,
    user_agent: data.user_agent
  });
}

module.exports = {
  logActivity,
  logAuditEvent,
  logPrintJob,
  logPrinterDeviceEvent
};
