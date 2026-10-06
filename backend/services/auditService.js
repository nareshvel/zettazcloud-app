/**
 * Audit Logging Service
 * Provides comprehensive audit logging for POS system events
 *
 * NOTE: This service previously opened a brand-new MySQL connection per call
 * via mysql.createConnection(), bypassing the shared pool. On a remote shared
 * MySQL server that creates a full TCP handshake + auth round-trip for every
 * single audit log write, and those connections count against the server's
 * max_connections independently of the pool's connectionLimit. All methods
 * now use the shared pool via db.query() / db.executeTransaction().
 */

const { v4: uuidv4 } = require('uuid');
const { query, executeTransaction } = require('../config/db');

class AuditService {
  /**
   * Log an audit event
   * @param {Object} params - Audit log parameters
   * @param {string} params.userId - User ID (optional)
   * @param {string} params.tenantId - Tenant ID (optional)
   * @param {string} params.storeId - Store ID (optional)
   * @param {string} params.action - Action performed
   * @param {string} params.resourceType - Type of resource affected
   * @param {string} params.resourceId - ID of resource affected (optional)
   * @param {string} params.eventCategory - Category of event
   * @param {string} params.severity - Severity level (low, medium, high, critical)
   * @param {string} params.ipAddress - Client IP address (optional)
   * @param {string} params.userAgent - Client user agent (optional)
   * @param {string} params.sessionId - Session ID (optional)
   * @param {Object} params.oldValues - Previous values (optional)
   * @param {Object} params.newValues - New values (optional)
   * @param {Object} params.details - Additional details (optional)
   * @param {string} params.status - Status (success, failure, warning)
   * @param {string} params.errorMessage - Error message if status is failure (optional)
   */
  static async log({
    userId = null,
    tenantId = null,
    storeId = null,
    action,
    resourceType,
    resourceId = null,
    eventCategory,
    severity = 'medium',
    ipAddress = null,
    userAgent = null,
    sessionId = null,
    oldValues = null,
    newValues = null,
    details = null,
    status = 'success',
    errorMessage = null
  }) {
    try {
      const auditId = uuidv4();

      await query(
        `INSERT INTO audit_logs (
          id, user_id, tenant_id, store_id, action, resource_type, resource_id,
          event_category, severity, ip_address, user_agent, session_id,
          old_values, new_values, details, status, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          auditId, userId, tenantId, storeId, action, resourceType, resourceId,
          eventCategory, severity, ipAddress, userAgent, sessionId,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          details ? JSON.stringify(details) : null,
          status, errorMessage
        ]
      );

      console.log(`📝 Audit logged: ${action} on ${resourceType} by user ${userId || 'system'}`);
      return auditId;

    } catch (error) {
      console.error('❌ Failed to log audit event:', error);
      // Don't throw error - audit logging failure shouldn't break the main operation
      return null;
    }
  }

  /**
   * Log authentication events
   */
  static async logAuth({ userId, tenantId, action, ipAddress, userAgent, sessionId, status = 'success', errorMessage = null, details = null }) {
    return this.log({
      userId,
      tenantId,
      action,
      resourceType: 'authentication',
      eventCategory: 'authentication',
      severity: status === 'failure' ? 'high' : 'medium',
      ipAddress,
      userAgent,
      sessionId,
      details,
      status,
      errorMessage
    });
  }

  /**
   * Log user management events
   */
  static async logUserManagement({ userId, tenantId, storeId, action, targetUserId, oldValues, newValues, ipAddress, userAgent, details = null }) {
    return this.log({
      userId,
      tenantId,
      storeId,
      action,
      resourceType: 'user',
      resourceId: targetUserId,
      eventCategory: 'user_management',
      severity: 'medium',
      ipAddress,
      userAgent,
      oldValues,
      newValues,
      details
    });
  }

  /**
   * Log transaction events
   */
  static async logTransaction({ userId, tenantId, storeId, action, transactionId, amount, details, ipAddress, userAgent }) {
    return this.log({
      userId,
      tenantId,
      storeId,
      action,
      resourceType: 'transaction',
      resourceId: transactionId,
      eventCategory: 'transaction',
      severity: 'high', // Financial transactions are always high severity
      ipAddress,
      userAgent,
      details: {
        ...details,
        amount: amount
      }
    });
  }

  /**
   * Log configuration changes
   */
  static async logConfiguration({ userId, tenantId, storeId, action, resourceType, resourceId, oldValues, newValues, ipAddress, userAgent }) {
    return this.log({
      userId,
      tenantId,
      storeId,
      action,
      resourceType,
      resourceId,
      eventCategory: 'configuration',
      severity: 'medium',
      ipAddress,
      userAgent,
      oldValues,
      newValues
    });
  }

  /**
   * Log onboarding events
   */
  static async logOnboarding({ userId, tenantId, action, details, ipAddress, userAgent, status = 'success' }) {
    return this.log({
      userId,
      tenantId,
      action,
      resourceType: 'tenant',
      eventCategory: 'onboarding',
      severity: 'medium',
      ipAddress,
      userAgent,
      details,
      status
    });
  }

  /**
   * Log system events
   */
  static async logSystem({ action, resourceType, resourceId, details, severity = 'low' }) {
    return this.log({
      action,
      resourceType,
      resourceId,
      eventCategory: 'system',
      severity,
      details
    });
  }

  /**
   * Get audit logs for a user
   */
  static async getUserAuditLogs(userId, limit = 100, offset = 0) {
    try {
      const rows = await query(
        `SELECT
          al.*,
          u.name as user_name,
          u.email as user_email,
          t.name as tenant_name,
          s.name as store_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN tenants t ON al.tenant_id = t.id
        LEFT JOIN stores s ON al.store_id = s.id
        WHERE al.user_id = ?
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?`,
        [userId, limit, offset]
      );

      return rows;
    } catch (error) {
      console.error('❌ Failed to fetch user audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit logs for a tenant
   */
  static async getTenantAuditLogs(tenantId, limit = 100, offset = 0) {
    try {
      const rows = await query(
        `SELECT
          al.*,
          u.name as user_name,
          u.email as user_email,
          s.name as store_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN stores s ON al.store_id = s.id
        WHERE al.tenant_id = ?
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?`,
        [tenantId, limit, offset]
      );

      return rows;
    } catch (error) {
      console.error('❌ Failed to fetch tenant audit logs:', error);
      return [];
    }
  }

  /**
   * Get recent critical events
   */
  static async getCriticalEvents(hours = 24, limit = 50) {
    try {
      const rows = await query(
        `SELECT
          al.*,
          u.name as user_name,
          u.email as user_email,
          t.name as tenant_name,
          s.name as store_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        LEFT JOIN tenants t ON al.tenant_id = t.id
        LEFT JOIN stores s ON al.store_id = s.id
        WHERE al.severity IN ('high', 'critical')
          AND al.created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
        ORDER BY al.created_at DESC
        LIMIT ?`,
        [hours, limit]
      );

      return rows;
    } catch (error) {
      console.error('❌ Failed to fetch critical events:', error);
      return [];
    }
  }

  /**
   * Extract request context from Express request object
   */
  static extractRequestContext(req) {
    return {
      ipAddress: req.ip || req.connection.remoteAddress || null,
      userAgent: req.get('User-Agent') || null,
      sessionId: req.sessionID || null
    };
  }
}

module.exports = AuditService;
