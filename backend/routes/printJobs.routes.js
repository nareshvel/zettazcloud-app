/**
 * Print Job Routes
 * Manages print job lifecycle, history, and retry operations
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const printJobService = require('../services/printJobService');
const logger = require('../utils/logger');

// All routes require authentication and tenant context
router.use(authenticate);
router.use(requireTenantId);

/**
 * GET /api/print-jobs
 * List print jobs for tenant/store with filters
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const storeId = req.query.store_id || req.user?.store_id;

    const filters = {
      status: req.query.status,
      job_type: req.query.job_type,
      printer_device_id: req.query.printer_device_id,
      limit: req.query.limit,
      offset: req.query.offset
    };

    const jobs = await printJobService.listJobs(tenantId, storeId, filters);

    res.json({
      status: 'success',
      data: jobs
    });
  } catch (error) {
    logger.error('Error listing print jobs:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/print-jobs/statistics
 * Get job statistics for tenant/store
 */
router.get('/statistics', async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const storeId = req.query.store_id || req.user?.store_id;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;

    const stats = await printJobService.getJobStatistics(tenantId, storeId, startDate, endDate);

    res.json({
      status: 'success',
      data: stats
    });
  } catch (error) {
    logger.error('Error getting print job statistics:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/print-jobs/:id
 * Get a specific print job
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const job = await printJobService.getJob(req.params.id, tenantId);

    if (!job) {
      return res.status(404).json({
        status: 'error',
        message: 'Print job not found'
      });
    }

    res.json({
      status: 'success',
      data: job
    });
  } catch (error) {
    logger.error('Error getting print job:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/print-jobs
 * Create a new print job
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const storeId = req.body.store_id || req.user?.store_id;
    const userId = req.user?.id;

    const job = await printJobService.createPrintJob({
      tenant_id: tenantId,
      store_id: storeId,
      station_id: req.body.station_id,
      printer_device_id: req.body.printer_device_id,
      job_type: req.body.job_type,
      document_type: req.body.document_type,
      payload: req.body.payload,
      priority: req.body.priority,
      idempotency_key: req.body.idempotency_key,
      created_by: userId
    });

    res.status(201).json({
      status: 'success',
      message: 'Print job created successfully',
      data: job
    });
  } catch (error) {
    logger.error('Error creating print job:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/print-jobs/:id/retry
 * Retry a failed print job
 */
router.post('/:id/retry', requirePermission('printer.settings'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const userId = req.user?.id;

    const job = await printJobService.retryJob(req.params.id, tenantId, userId);

    res.json({
      status: 'success',
      message: 'Print job queued for retry',
      data: job
    });
  } catch (error) {
    logger.error('Error retrying print job:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/print-jobs/:id/cancel
 * Cancel a print job
 */
router.post('/:id/cancel', requirePermission('printer.settings'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const userId = req.user?.id;

    const job = await printJobService.cancelJob(req.params.id, tenantId, userId);

    res.json({
      status: 'success',
      message: 'Print job cancelled successfully',
      data: job
    });
  } catch (error) {
    logger.error('Error cancelling print job:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/print-jobs/cleanup
 * Clean up old completed jobs (admin only)
 */
router.delete('/cleanup', requirePermission('system.maintenance'), async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
    const daysToKeep = parseInt(req.query.days) || 30;

    const deletedCount = await printJobService.cleanupOldJobs(tenantId, daysToKeep);

    res.json({
      status: 'success',
      message: `Cleaned up ${deletedCount} old print jobs`,
      data: { deleted_count: deletedCount }
    });
  } catch (error) {
    logger.error('Error cleaning up print jobs:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
