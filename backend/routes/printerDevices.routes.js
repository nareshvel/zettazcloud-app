/**
 * Printer Device Routes
 * Manages printer device registry for security hardening
 * Replaces arbitrary printer addresses with tenant-scoped device IDs
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const printerDeviceService = require('../services/printerDeviceService');
const printExecutionService = require('../services/printExecutionService');
const logger = require('../utils/logger');

// All routes require authentication and tenant context
router.use(authenticate);
router.use(requireTenantId);

/**
 * GET /api/printer-devices
 * List printer devices for tenant/store
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const storeId = req.query.store_id || req.user?.store_id;
    const { device_type, is_active } = req.query;

    const devices = await printerDeviceService.listPrinterDevices(
      tenantId,
      storeId,
      { device_type, is_active: is_active !== undefined ? is_active === 'true' : undefined }
    );

    res.json({
      status: 'success',
      data: devices
    });
  } catch (error) {
    logger.error('Error listing printer devices:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/printer-devices/:id
 * Get a specific printer device
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const device = await printerDeviceService.getPrinterDevice(req.params.id, tenantId);

    if (!device) {
      return res.status(404).json({
        status: 'error',
        message: 'Printer device not found'
      });
    }

    res.json({
      status: 'success',
      data: device
    });
  } catch (error) {
    logger.error('Error getting printer device:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/printer-devices
 * Create a new printer device
 */
router.post('/', requirePermission('settings.printer'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const storeId = req.body.store_id || req.user?.store_id;
    const userId = req.user?.id;

    const deviceId = await printerDeviceService.createPrinterDevice(
      tenantId,
      storeId,
      req.body,
      userId
    );

    res.status(201).json({
      status: 'success',
      message: 'Printer device created successfully',
      data: { id: deviceId }
    });
  } catch (error) {
    logger.error('Error creating printer device:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * PUT /api/printer-devices/:id
 * Update a printer device
 */
router.put('/:id', requirePermission('settings.printer'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const userId = req.user?.id;

    await printerDeviceService.updatePrinterDevice(
      req.params.id,
      tenantId,
      req.body,
      userId
    );

    res.json({
      status: 'success',
      message: 'Printer device updated successfully'
    });
  } catch (error) {
    logger.error('Error updating printer device:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/printer-devices/:id
 * Delete a printer device
 */
router.delete('/:id', requirePermission('settings.printer'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

    await printerDeviceService.deletePrinterDevice(req.params.id, tenantId);

    res.json({
      status: 'success',
      message: 'Printer device deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting printer device:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/printer-devices/stations
 * List print stations
 */
router.get('/stations/list', async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const storeId = req.query.store_id || req.user?.store_id;

    const stations = await printerDeviceService.listPrintStations(tenantId, storeId);

    res.json({
      status: 'success',
      data: stations
    });
  } catch (error) {
    logger.error('Error listing print stations:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/printer-devices/stations
 * Create a print station
 */
router.post('/stations', requirePermission('settings.printer'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const storeId = req.body.store_id || req.user?.store_id;
    const userId = req.user?.id;

    const stationId = await printerDeviceService.createPrintStation(
      tenantId,
      storeId,
      req.body,
      userId
    );

    res.status(201).json({
      status: 'success',
      message: 'Print station created successfully',
      data: { id: stationId }
    });
  } catch (error) {
    logger.error('Error creating print station:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/printer-devices/:id/test
 * Test printer connectivity
 */
router.post('/:id/test', requirePermission('settings.printer'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

    const result = await printExecutionService.testPrinter(req.params.id, tenantId);

    res.json({
      status: 'success',
      data: result
    });
  } catch (error) {
    logger.error('Error testing printer:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/printer-devices/:id/status
 * Get printer status
 */
router.get('/:id/status', async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];

    const status = await printExecutionService.getPrinterStatus(req.params.id, tenantId);

    res.json({
      status: 'success',
      data: status
    });
  } catch (error) {
    logger.error('Error getting printer status:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
