/**
 * Print Agent Fleet Service
 *
 * Tenant-scoped management of workstation Print Agents:
 * - enrollment-code lifecycle (plaintext code returned once, SHA-256 stored)
 * - device-token lifecycle (bearer token returned once, SHA-256 stored)
 * - fleet listing, updates, revocation, heartbeat metadata, and configuration
 *
 * Security invariants:
 * - Plaintext codes/tokens are never persisted.
 * - Codes are one-time and expire in 10 minutes.
 * - Tokens are revoked by clearing their hash and setting status revoked.
 * - Heartbeats accept only an explicit allowlist of operational metadata.
 * - No document payloads, pairing browser tokens, customer data, arbitrary logs,
 *   or secrets are accepted or stored.
 */

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const logger = require('../utils/logger');

const DEFAULT_CODE_TTL_MINUTES = 10;
const CODE_BYTES = 16;
const TOKEN_BYTES = 32;

const VALID_UPDATE_CHANNELS = ['stable', 'pilot', 'beta'];
const VALID_NOTIFICATION_POLICIES = ['all', 'errors', 'none'];
const VALID_CONFIG_POLICIES = ['cloud', 'workstation', 'hybrid'];
const VALID_AGENT_STATUSES = ['pending', 'online', 'offline', 'error', 'revoked'];
const VALID_DOCUMENT_ROUTES = ['receipt', 'invoice', 'return', 'label', 'document'];

const HEARTBEAT_INTERVAL_MIN = 30;
const HEARTBEAT_INTERVAL_MAX = 3600;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function generateRandomCode() {
  return crypto.randomBytes(CODE_BYTES).toString('base64url');
}

function generateRandomToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

function safeParseJSON(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    logger.error('Failed to parse JSON column value:', error.message);
    return null;
  }
}

function sanitizeLastError(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text.length === 0) return null;
  // Hard cap to prevent log stuffing; strip control characters.
  const truncated = text.slice(0, 2000).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  return truncated;
}

function normalizeMapping(mapping) {
  const route = String(mapping.document_route || '').toLowerCase().trim();
  const localPrinterId = String(mapping.local_printer_id || '').trim();
  const priority = Number(mapping.priority);
  const isFallback = Boolean(mapping.is_fallback);
  const enabled = mapping.enabled === undefined ? true : Boolean(mapping.enabled);
  const printerName = mapping.printer_name ? String(mapping.printer_name).trim() : null;
  const capabilities = mapping.capabilities && typeof mapping.capabilities === 'object'
    ? mapping.capabilities
    : null;

  return {
    route,
    localPrinterId,
    priority,
    isFallback,
    enabled,
    printerName,
    capabilities,
  };
}

async function createEnrollmentCode(tenantId, storeId, userId, expiresMinutes = DEFAULT_CODE_TTL_MINUTES) {
  if (!tenantId || !storeId) {
    throw Object.assign(new Error('Tenant ID and Store ID are required'), { statusCode: 400 });
  }

  const code = generateRandomCode();
  const codeHash = sha256(code);
  const codeId = uuidv4();
  const expiresAt = new Date(Date.now() + expiresMinutes * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  await pool.query(
    `INSERT INTO print_agent_enrollment_codes
     (id, tenant_id, store_id, code_hash, expires_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [codeId, tenantId, storeId, codeHash, expiresAt, userId || null]
  );

  return {
    id: codeId,
    code,
    code_hash: codeHash,
    expires_at: expiresAt,
    tenant_id: tenantId,
    store_id: storeId,
  };
}

async function consumeEnrollmentCode(code, agentId, metadata = {}) {
  if (!code || !agentId) {
    throw Object.assign(new Error('Enrollment code and agentId are required'), { statusCode: 400 });
  }

  const codeHash = sha256(code);
  const displayName = metadata.display_name ? String(metadata.display_name).trim() : null;
  const platform = metadata.platform ? String(metadata.platform).trim() : null;
  const osVersion = metadata.os_version ? String(metadata.os_version).trim() : null;
  const architecture = metadata.architecture ? String(metadata.architecture).trim() : null;
  const version = metadata.version ? String(metadata.version).trim() : null;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [codeRows] = await connection.query(
      `SELECT * FROM print_agent_enrollment_codes
       WHERE code_hash = ? AND consumed_by IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [codeHash]
    );

    if (!codeRows || codeRows.length === 0) {
      throw Object.assign(new Error('Invalid or expired enrollment code'), { statusCode: 401 });
    }

    const codeRow = codeRows[0];
    const tenantId = codeRow.tenant_id;
    const storeId = codeRow.store_id;

    const [existingAgentRows] = await connection.query(
      `SELECT id, status FROM print_agents
       WHERE tenant_id = ? AND agent_id = ? FOR UPDATE`,
      [tenantId, agentId]
    );

    let agentIdRow;
    const token = generateRandomToken();
    const tokenHash = sha256(token);

    if (existingAgentRows && existingAgentRows.length > 0) {
      agentIdRow = existingAgentRows[0].id;
      if (existingAgentRows[0].status === 'revoked') {
        throw Object.assign(new Error('Agent credentials have been revoked'), { statusCode: 403 });
      }
      await connection.query(
        `UPDATE print_agents
         SET status = 'pending', token_hash = ?, version = ?, platform = ?,
             os_version = ?, architecture = ?, updated_at = NOW()
         WHERE id = ?`,
        [tokenHash, version, platform, osVersion, architecture, agentIdRow]
      );
      await connection.query(
        `DELETE FROM print_agent_printer_mappings WHERE print_agent_id = ?`,
        [agentIdRow]
      );
    } else {
      agentIdRow = uuidv4();
      await connection.query(
        `INSERT INTO print_agents
         (id, tenant_id, store_id, agent_id, display_name, status, token_hash,
          version, platform, os_version, architecture, created_by)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, NULL)`,
        [agentIdRow, tenantId, storeId, agentId, displayName, tokenHash, version, platform, osVersion, architecture]
      );
    }

    await connection.query(
      `UPDATE print_agent_enrollment_codes
       SET consumed_by = ?, consumed_at = NOW()
       WHERE id = ?`,
      [agentIdRow, codeRow.id]
    );

    await connection.commit();

    return {
      agent_id: agentIdRow,
      tenant_id: tenantId,
      store_id: storeId,
      token,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function authenticateDevice(token) {
  if (!token) return null;
  const tokenHash = sha256(token);
  const [rows] = await pool.query(
    `SELECT * FROM print_agents WHERE token_hash = ?`,
    [tokenHash]
  );
  if (!rows || rows.length === 0) return null;
  const agent = rows[0];
  if (agent.status === 'revoked') return null;
  agent.capabilities = safeParseJSON(agent.capabilities);
  agent.queue_counts = safeParseJSON(agent.queue_counts);
  agent.workstation_overrides = safeParseJSON(agent.workstation_overrides);
  return agent;
}

async function getAgentById(agentRowId, tenantId, storeId = null) {
  let query = `SELECT * FROM print_agents WHERE id = ? AND tenant_id = ?`;
  const params = [agentRowId, tenantId];
  if (storeId) {
    query += ` AND store_id = ?`;
    params.push(storeId);
  }
  const [rows] = await pool.query(query, params);
  if (!rows || rows.length === 0) return null;
  const agent = rows[0];
  agent.capabilities = safeParseJSON(agent.capabilities);
  agent.queue_counts = safeParseJSON(agent.queue_counts);
  agent.workstation_overrides = safeParseJSON(agent.workstation_overrides);
  return agent;
}

async function listAgents(tenantId, storeId = null, filters = {}) {
  let query = `SELECT * FROM print_agents WHERE tenant_id = ?`;
  const params = [tenantId];
  if (storeId) {
    query += ` AND store_id = ?`;
    params.push(storeId);
  }
  if (filters.status) {
    query += ` AND status = ?`;
    params.push(filters.status);
  }
  query += ` ORDER BY store_id, display_name, agent_id`;

  const [rows] = await pool.query(query, params);
  return rows.map((agent) => ({
    ...agent,
    capabilities: safeParseJSON(agent.capabilities),
    queue_counts: safeParseJSON(agent.queue_counts),
    workstation_overrides: safeParseJSON(agent.workstation_overrides),
  }));
}

function validateUpdateInput(input) {
  const errors = {};
  const updates = {};

  if (input.display_name !== undefined) {
    const name = String(input.display_name).trim();
    if (name.length === 0) {
      errors.display_name = 'Display name cannot be empty';
    } else if (name.length > 255) {
      errors.display_name = 'Display name too long';
    } else {
      updates.display_name = name;
    }
  }

  if (input.update_channel !== undefined) {
    if (!VALID_UPDATE_CHANNELS.includes(input.update_channel)) {
      errors.update_channel = `Must be one of: ${VALID_UPDATE_CHANNELS.join(', ')}`;
    } else {
      updates.update_channel = input.update_channel;
    }
  }

  if (input.heartbeat_interval !== undefined) {
    const interval = Number(input.heartbeat_interval);
    if (!Number.isInteger(interval) || interval < HEARTBEAT_INTERVAL_MIN || interval > HEARTBEAT_INTERVAL_MAX) {
      errors.heartbeat_interval = `Must be an integer between ${HEARTBEAT_INTERVAL_MIN} and ${HEARTBEAT_INTERVAL_MAX}`;
    } else {
      updates.heartbeat_interval = interval;
    }
  }

  if (input.notification_policy !== undefined) {
    if (!VALID_NOTIFICATION_POLICIES.includes(input.notification_policy)) {
      errors.notification_policy = `Must be one of: ${VALID_NOTIFICATION_POLICIES.join(', ')}`;
    } else {
      updates.notification_policy = input.notification_policy;
    }
  }

  if (input.config_policy !== undefined) {
    if (!VALID_CONFIG_POLICIES.includes(input.config_policy)) {
      errors.config_policy = `Must be one of: ${VALID_CONFIG_POLICIES.join(', ')}`;
    } else {
      updates.config_policy = input.config_policy;
    }
  }

  if (input.workstation_overrides !== undefined) {
    if (input.workstation_overrides !== null && (typeof input.workstation_overrides !== 'object' || Array.isArray(input.workstation_overrides))) {
      errors.workstation_overrides = 'Must be a JSON object or null';
    } else {
      updates.workstation_overrides = input.workstation_overrides === null ? null : JSON.stringify(input.workstation_overrides);
    }
  }

  return { updates, errors };
}

async function updateAgent(agentRowId, tenantId, storeId, input) {
  const { updates, errors } = validateUpdateInput(input);
  if (Object.keys(errors).length > 0) {
    throw Object.assign(new Error('Validation failed'), { statusCode: 400, errors });
  }
  if (Object.keys(updates).length === 0) {
    throw Object.assign(new Error('No valid fields provided'), { statusCode: 400 });
  }

  let query = `UPDATE print_agents SET `;
  const fields = Object.keys(updates).map((key) => `${key} = ?`);
  query += fields.join(', ');
  query += `, updated_at = NOW()`;
  query += ` WHERE id = ? AND tenant_id = ?`;
  const params = [...Object.values(updates), agentRowId, tenantId];
  if (storeId) {
    query += ` AND store_id = ?`;
    params.push(storeId);
  }

  const [result] = await pool.query(query, params);
  return result.affectedRows > 0;
}

async function revokeAgent(agentRowId, tenantId, storeId = null) {
  let query = `UPDATE print_agents SET status = 'revoked', token_hash = NULL, updated_at = NOW()
               WHERE id = ? AND tenant_id = ?`;
  const params = [agentRowId, tenantId];
  if (storeId) {
    query += ` AND store_id = ?`;
    params.push(storeId);
  }
  const [result] = await pool.query(query, params);
  return result.affectedRows > 0;
}

function validateMappings(mappings) {
  if (!Array.isArray(mappings)) {
    return { errors: { mappings: 'Mappings must be an array' } };
  }
  const errors = {};
  const normalized = [];
  mappings.forEach((mapping, index) => {
    const prefix = `mappings[${index}]`;
    const norm = normalizeMapping(mapping);
    if (!VALID_DOCUMENT_ROUTES.includes(norm.route)) {
      errors[`${prefix}.document_route`] = `Must be one of: ${VALID_DOCUMENT_ROUTES.join(', ')}`;
    }
    if (!norm.localPrinterId || norm.localPrinterId.length > 255) {
      errors[`${prefix}.local_printer_id`] = 'Local printer ID is required and must be <= 255 characters';
    }
    if (!Number.isInteger(norm.priority) || norm.priority < 0 || norm.priority > 100) {
      errors[`${prefix}.priority`] = 'Priority must be an integer between 0 and 100';
    }
    if (norm.printerName && norm.printerName.length > 255) {
      errors[`${prefix}.printer_name`] = 'Printer name must be <= 255 characters';
    }
    normalized.push(norm);
  });
  return { errors, normalized };
}

async function updatePrinterMappings(agentRowId, tenantId, storeId, mappings) {
  const { errors, normalized } = validateMappings(mappings);
  if (Object.keys(errors).length > 0) {
    throw Object.assign(new Error('Validation failed'), { statusCode: 400, errors });
  }

  const agent = await getAgentById(agentRowId, tenantId, storeId);
  if (!agent) {
    throw Object.assign(new Error('Print agent not found'), { statusCode: 404 });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `DELETE FROM print_agent_printer_mappings WHERE print_agent_id = ?`,
      [agentRowId]
    );

    for (const norm of normalized) {
      await connection.query(
        `INSERT INTO print_agent_printer_mappings
         (id, print_agent_id, document_route, local_printer_id, printer_name,
          priority, is_fallback, enabled, capabilities)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          agentRowId,
          norm.route,
          norm.localPrinterId,
          norm.printerName,
          norm.priority,
          norm.isFallback ? 1 : 0,
          norm.enabled ? 1 : 0,
          norm.capabilities ? JSON.stringify(norm.capabilities) : null,
        ]
      );
    }

    await connection.commit();
    return normalized;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getPrinterMappings(agentRowId) {
  const [rows] = await pool.query(
    `SELECT * FROM print_agent_printer_mappings
     WHERE print_agent_id = ?
     ORDER BY document_route, priority DESC, created_at ASC`,
    [agentRowId]
  );
  return rows.map((row) => ({
    ...row,
    capabilities: safeParseJSON(row.capabilities),
    is_fallback: Boolean(row.is_fallback),
    enabled: Boolean(row.enabled),
  }));
}

function validateHeartbeatInput(input) {
  const allowed = {};
  const errors = {};

  if (input.version !== undefined) allowed.version = String(input.version).trim().slice(0, 50) || null;
  if (input.platform !== undefined) allowed.platform = String(input.platform).trim().slice(0, 50) || null;
  if (input.os_version !== undefined) allowed.os_version = String(input.os_version).trim().slice(0, 100) || null;
  if (input.architecture !== undefined) allowed.architecture = String(input.architecture).trim().slice(0, 50) || null;

  if (input.status !== undefined) {
    const status = String(input.status).toLowerCase().trim();
    if (!VALID_AGENT_STATUSES.includes(status)) {
      errors.status = `Must be one of: ${VALID_AGENT_STATUSES.join(', ')}`;
    } else if (status === 'revoked') {
      errors.status = 'Revoked status cannot be set via heartbeat';
    } else {
      allowed.status = status;
    }
  }

  if (input.capabilities !== undefined) {
    if (input.capabilities !== null && (typeof input.capabilities !== 'object' || Array.isArray(input.capabilities))) {
      errors.capabilities = 'Must be a JSON object or null';
    } else {
      allowed.capabilities = input.capabilities === null ? null : JSON.stringify(input.capabilities);
    }
  }

  if (input.queue_counts !== undefined) {
    if (input.queue_counts !== null && (typeof input.queue_counts !== 'object' || Array.isArray(input.queue_counts))) {
      errors.queue_counts = 'Must be a JSON object or null';
    } else {
      allowed.queue_counts = input.queue_counts === null ? null : JSON.stringify(input.queue_counts);
    }
  }

  if (input.last_error !== undefined) {
    allowed.last_error = sanitizeLastError(input.last_error);
  }

  if (Object.keys(errors).length > 0) {
    throw Object.assign(new Error('Validation failed'), { statusCode: 400, errors });
  }
  return allowed;
}

async function recordHeartbeat(agentRowId, input) {
  const updates = validateHeartbeatInput(input);
  if (Object.keys(updates).length === 0) {
    updates.last_error = null;
  }

  const fields = Object.keys(updates).map((key) => `${key} = ?`).join(', ');
  const params = Object.values(updates);
  params.push(agentRowId);

  const [result] = await pool.query(
    `UPDATE print_agents SET ${fields}, last_seen = NOW(), updated_at = NOW() WHERE id = ?`,
    params
  );
  return result.affectedRows > 0;
}

async function getConfiguration(agent) {
  const mappings = await getPrinterMappings(agent.id);
  const overrides = agent.workstation_overrides || null;

  return {
    agent_id: agent.agent_id,
    tenant_id: agent.tenant_id,
    store_id: agent.store_id,
    update_channel: agent.update_channel,
    heartbeat_interval: agent.heartbeat_interval,
    notification_policy: agent.notification_policy,
    config_policy: agent.config_policy,
    workstation_overrides: overrides,
    printer_mappings: mappings,
  };
}

module.exports = {
  createEnrollmentCode,
  consumeEnrollmentCode,
  authenticateDevice,
  getAgentById,
  listAgents,
  updateAgent,
  revokeAgent,
  updatePrinterMappings,
  getPrinterMappings,
  recordHeartbeat,
  getConfiguration,
  sha256,
  generateRandomCode,
  generateRandomToken,
  VALID_DOCUMENT_ROUTES,
};
