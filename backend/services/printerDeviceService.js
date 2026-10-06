/**
 * Printer Device Service
 * Manages printer device registry, validation, and security
 * Replaces arbitrary printer addresses with tenant-scoped device IDs
 */

const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const logger = require('../utils/logger');

/**
 * Safely parse a JSON column value. mysql2 auto-parses JSON-typed columns into
 * JS objects/arrays already, so guard against double-parsing.
 */
const safeParseJSON = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    logger.error('Failed to parse JSON column value:', error.message);
    return null;
  }
};

/**
 * Validate printer address format (IP:port or hostname:port)
 * Prevents SSRF by restricting to private network ranges
 */
function validatePrinterAddress(address) {
  if (!address) return null;

  // Split address into host and port
  const [host, portStr] = address.split(':');
  const port = parseInt(portStr, 10) || 9100;

  // Validate port range
  if (port < 1 || port > 65535) {
    throw new Error('Invalid port number');
  }

  // Validate host is not a public IP (SSRF protection)
  // Allow: localhost, 127.0.0.1, private ranges (10.x, 172.16-31.x, 192.168.x)
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(host)) {
    const parts = host.split('.').map(Number);
    const [first, second] = parts;

    // Block public IPs
    if (
      !(first === 127) && // localhost
      !(first === 10) && // 10.0.0.0/8
      !(first === 172 && second >= 16 && second <= 31) && // 172.16.0.0/12
      !(first === 192 && second === 168) // 192.168.0.0/16
    ) {
      throw new Error('Public IP addresses not allowed for printer connections');
    }
  }

  return { host, port };
}

/**
 * Create a new printer device
 */
async function createPrinterDevice(tenantId, storeId, data, userId) {
  const {
    name,
    device_type,
    connection_type = 'network',
    address,
    port = 9100,
    capabilities,
    station_id,
    is_default = false,
    is_active = true
  } = data;

  // Validate device type
  const validDeviceTypes = [
    'thermal_receipt', 'laser', 'inkjet',
    'label_zebra_zpl', 'label_tsc_tspl', 'label_dymo', 'label_brother',
    'pdf_generator'
  ];
  if (!validDeviceTypes.includes(device_type)) {
    throw new Error(`Invalid device_type: ${device_type}`);
  }

  // Validate connection type
  const validConnectionTypes = ['network', 'usb', 'bluetooth', 'cloud', 'browser'];
  if (!validConnectionTypes.includes(connection_type)) {
    throw new Error(`Invalid connection_type: ${connection_type}`);
  }

  // Validate address if network connection
  let validatedAddress = null;
  if (connection_type === 'network' && address) {
    validatedAddress = validatePrinterAddress(address);
  }

  const deviceId = uuidv4();

  // If setting as default, unset other defaults for this tenant/store
  if (is_default) {
    await pool.query(
      `UPDATE printer_devices SET is_default = 0
       WHERE tenant_id = ? AND store_id = ?`,
      [tenantId, storeId]
    );
  }

  await pool.query(
    `INSERT INTO printer_devices
     (id, tenant_id, store_id, station_id, name, device_type, connection_type,
      address, port, capabilities, is_default, is_active, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      deviceId,
      tenantId,
      storeId,
      station_id || null,
      name,
      device_type,
      connection_type,
      validatedAddress ? `${validatedAddress.host}:${validatedAddress.port}` : null,
      port,
      capabilities ? JSON.stringify(capabilities) : null,
      is_default ? 1 : 0,
      is_active ? 1 : 0,
      userId,
      userId
    ]
  );

  return deviceId;
}

/**
 * Get printer device by ID
 */
async function getPrinterDevice(deviceId, tenantId) {
  const [rows] = await pool.query(
    `SELECT * FROM printer_devices
     WHERE id = ? AND tenant_id = ?`,
    [deviceId, tenantId]
  );

  if (!rows || rows.length === 0) {
    return null;
  }

  const device = rows[0];
  // Parse JSON capabilities
  device.capabilities = safeParseJSON(device.capabilities);

  return device;
}

/**
 * List printer devices for a tenant/store
 */
async function listPrinterDevices(tenantId, storeId = null, filters = {}) {
  const { device_type, is_active } = filters;

  let query = `
    SELECT pd.*, ps.name as station_name
    FROM printer_devices pd
    LEFT JOIN print_stations ps ON pd.station_id = ps.id
    WHERE pd.tenant_id = ?
  `;
  const params = [tenantId];

  if (storeId) {
    query += ` AND pd.store_id = ?`;
    params.push(storeId);
  }

  if (device_type) {
    query += ` AND pd.device_type = ?`;
    params.push(device_type);
  }

  if (is_active !== undefined) {
    query += ` AND pd.is_active = ?`;
    params.push(is_active ? 1 : 0);
  }

  query += ` ORDER BY pd.is_default DESC, pd.name ASC`;

  const [rows] = await pool.query(query, params);

  // Parse JSON capabilities
  return rows.map(row => ({
    ...row,
    capabilities: safeParseJSON(row.capabilities)
  }));
}

/**
 * Update printer device
 */
async function updatePrinterDevice(deviceId, tenantId, data, userId) {
  const updates = [];
  const params = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }

  if (data.device_type !== undefined) {
    updates.push('device_type = ?');
    params.push(data.device_type);
  }

  if (data.connection_type !== undefined) {
    updates.push('connection_type = ?');
    params.push(data.connection_type);
  }

  if (data.address !== undefined) {
    if (data.connection_type === 'network') {
      const validated = validatePrinterAddress(data.address);
      updates.push('address = ?');
      params.push(`${validated.host}:${validated.port}`);
    } else {
      updates.push('address = ?');
      params.push(data.address);
    }
  }

  if (data.port !== undefined) {
    updates.push('port = ?');
    params.push(data.port);
  }

  if (data.capabilities !== undefined) {
    updates.push('capabilities = ?');
    params.push(JSON.stringify(data.capabilities));
  }

  if (data.station_id !== undefined) {
    updates.push('station_id = ?');
    params.push(data.station_id);
  }

  if (data.is_default !== undefined) {
    updates.push('is_default = ?');
    params.push(data.is_default ? 1 : 0);

    // If setting as default, unset others
    if (data.is_default) {
      const device = await getPrinterDevice(deviceId, tenantId);
      if (device) {
        await pool.query(
          `UPDATE printer_devices SET is_default = 0
           WHERE tenant_id = ? AND store_id = ? AND id != ?`,
          [tenantId, device.store_id, deviceId]
        );
      }
    }
  }

  if (data.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(data.is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return; // Nothing to update
  }

  updates.push('updated_by = ?');
  updates.push('updated_at = NOW()');
  params.push(userId);
  params.push(deviceId);
  params.push(tenantId);

  await pool.query(
    `UPDATE printer_devices SET ${updates.join(', ')}
     WHERE id = ? AND tenant_id = ?`,
    params
  );
}

/**
 * Delete printer device
 */
async function deletePrinterDevice(deviceId, tenantId) {
  // Check if device is in use by print routes
  const [routes] = await pool.query(
    `SELECT COUNT(*) as count FROM print_routes
     WHERE printer_device_id = ? AND tenant_id = ?`,
    [deviceId, tenantId]
  );

  if (routes[0].count > 0) {
    throw new Error('Cannot delete device: it is in use by print routes');
  }

  await pool.query(
    `DELETE FROM printer_devices
     WHERE id = ? AND tenant_id = ?`,
    [deviceId, tenantId]
  );
}

/**
 * Create a print station
 */
async function createPrintStation(tenantId, storeId, data, userId) {
  const { name, location, description, is_default = false, is_active = true } = data;

  const stationId = uuidv4();

  // If setting as default, unset other defaults
  if (is_default) {
    await pool.query(
      `UPDATE print_stations SET is_default = 0
       WHERE tenant_id = ? AND store_id = ?`,
      [tenantId, storeId]
    );
  }

  await pool.query(
    `INSERT INTO print_stations
     (id, tenant_id, store_id, name, location, description, is_default, is_active, created_by, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [stationId, tenantId, storeId, name, location, description, is_default ? 1 : 0, is_active ? 1 : 0, userId, userId]
  );

  return stationId;
}

/**
 * List print stations
 */
async function listPrintStations(tenantId, storeId = null) {
  let query = `SELECT * FROM print_stations WHERE tenant_id = ?`;
  const params = [tenantId];

  if (storeId) {
    query += ` AND store_id = ?`;
    params.push(storeId);
  }

  query += ` ORDER BY is_default DESC, name ASC`;

  const [rows] = await pool.query(query, params);
  return rows;
}

module.exports = {
  validatePrinterAddress,
  createPrinterDevice,
  getPrinterDevice,
  listPrinterDevices,
  updatePrinterDevice,
  deletePrinterDevice,
  createPrintStation,
  listPrintStations
};
