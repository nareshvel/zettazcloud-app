/**
 * Print Job Service
 * Manages print job lifecycle, state transitions, retries, and history
 */

const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/db');
const logger = require('../utils/logger');
const printerDeviceService = require('./printerDeviceService');
const auditLogService = require('./auditLogService');

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
 * Job status constants
 */
const JobStatus = {
  PENDING: 'pending',
  QUEUED: 'queued',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Job type constants
 */
const JobType = {
  RECEIPT: 'receipt',
  INVOICE: 'invoice',
  LABEL: 'label',
  DOCUMENT: 'document',
  TEST: 'test'
};

/**
 * Create a new print job
 */
async function createPrintJob(data) {
  const {
    tenant_id,
    store_id,
    station_id,
    printer_device_id,
    job_type,
    document_type,
    payload,
    priority = 5,
    idempotency_key = null,
    created_by
  } = data;

  // Validate job type
  const validJobTypes = Object.values(JobType);
  if (!validJobTypes.includes(job_type)) {
    throw new Error(`Invalid job_type: ${job_type}`);
  }

  // Check idempotency if key provided
  if (idempotency_key) {
    const [existing] = await pool.query(
      `SELECT id, status FROM print_jobs
       WHERE idempotency_key = ? AND tenant_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [idempotency_key, tenant_id]
    );

    if (existing && existing.length > 0) {
      // Return existing job if it's recent (within 24 hours)
      const jobAge = Date.now() - new Date(existing[0].created_at).getTime();
      if (jobAge < 24 * 60 * 60 * 1000) {
        logger.log(`Idempotent request: returning existing job ${existing[0].id}`);
        return existing[0];
      }
    }
  }

  // Validate printer device exists and is active
  if (printer_device_id) {
    const device = await printerDeviceService.getPrinterDevice(printer_device_id, tenant_id);
    if (!device) {
      throw new Error('Printer device not found');
    }
    if (!device.is_active) {
      throw new Error('Printer device is not active');
    }
  }

  const jobId = uuidv4();

  await pool.query(
    `INSERT INTO print_jobs
     (id, tenant_id, store_id, station_id, printer_device_id, job_type, document_type,
      status, priority, payload, idempotency_key, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      jobId,
      tenant_id,
      store_id,
      station_id,
      printer_device_id,
      job_type,
      document_type,
      JobStatus.PENDING,
      priority,
      JSON.stringify(payload),
      idempotency_key,
      created_by
    ]
  );

  // Fetch the created job
  const [jobs] = await pool.query(
    `SELECT * FROM print_jobs WHERE id = ?`,
    [jobId]
  );

  const job = jobs[0];
  job.payload = safeParseJSON(job.payload);

  // Audit log
  await auditLogService.logAuditEvent({
    tenant_id,
    store_id,
    user_id: created_by,
    action: 'print_job_created',
    entity_type: 'print_job',
    entity_id: jobId,
    details: {
      job_type,
      document_type,
      printer_device_id
    }
  });

  return job;
}

/**
 * Update job status
 */
async function updateJobStatus(jobId, status, errorMessage = null) {
  const validStatuses = Object.values(JobStatus);
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const updates = ['status = ?', 'updated_at = NOW()'];
  const params = [status];

  if (errorMessage) {
    updates.push('error_message = ?');
    params.push(errorMessage);
  }

  if (status === JobStatus.COMPLETED) {
    updates.push('completed_at = NOW()');
  }

  params.push(jobId);

  await pool.query(
    `UPDATE print_jobs SET ${updates.join(', ')} WHERE id = ?`,
    params
  );

  // Fetch updated job
  const [jobs] = await pool.query(
    `SELECT * FROM print_jobs WHERE id = ?`,
    [jobId]
  );

  if (jobs.length > 0) {
    const job = jobs[0];
    job.payload = safeParseJSON(job.payload);
    return job;
  }

  return null;
}

/**
 * Increment retry count
 */
async function incrementRetryCount(jobId) {
  await pool.query(
    `UPDATE print_jobs
     SET retry_count = retry_count + 1, updated_at = NOW()
     WHERE id = ?`,
    [jobId]
  );

  const [jobs] = await pool.query(
    `SELECT * FROM print_jobs WHERE id = ?`,
    [jobId]
  );

  if (jobs.length > 0) {
    return jobs[0];
  }

  return null;
}

/**
 * Get job by ID
 */
async function getJob(jobId, tenantId) {
  const [jobs] = await pool.query(
    `SELECT * FROM print_jobs WHERE id = ? AND tenant_id = ?`,
    [jobId, tenantId]
  );

  if (jobs.length === 0) {
    return null;
  }

  const job = jobs[0];
  job.payload = safeParseJSON(job.payload);
  return job;
}

/**
 * List jobs for tenant/store with filters
 */
async function listJobs(tenantId, storeId = null, filters = {}) {
  const { status, job_type, printer_device_id, limit = 50, offset = 0 } = filters;

  let query = `
    SELECT pj.*, pd.name as printer_name, ps.name as station_name
    FROM print_jobs pj
    LEFT JOIN printer_devices pd ON pj.printer_device_id = pd.id
    LEFT JOIN print_stations ps ON pj.station_id = ps.id
    WHERE pj.tenant_id = ?
  `;
  const params = [tenantId];

  if (storeId) {
    query += ` AND pj.store_id = ?`;
    params.push(storeId);
  }

  if (status) {
    query += ` AND pj.status = ?`;
    params.push(status);
  }

  if (job_type) {
    query += ` AND pj.job_type = ?`;
    params.push(job_type);
  }

  if (printer_device_id) {
    query += ` AND pj.printer_device_id = ?`;
    params.push(printer_device_id);
  }

  query += ` ORDER BY pj.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), parseInt(offset));

  const [jobs] = await pool.query(query, params);

  // Parse JSON payloads
  return jobs.map(job => ({
    ...job,
    payload: safeParseJSON(job.payload)
  }));
}

/**
 * Retry a failed job
 */
async function retryJob(jobId, tenantId, userId) {
  const job = await getJob(jobId, tenantId);

  if (!job) {
    throw new Error('Print job not found');
  }

  if (job.status !== JobStatus.FAILED) {
    throw new Error('Only failed jobs can be retried');
  }

  if (job.retry_count >= job.max_retries) {
    throw new Error('Maximum retry count exceeded');
  }

  // Reset to pending
  await updateJobStatus(jobId, JobStatus.PENDING, null);

  // Audit log
  await auditLogService.logAuditEvent({
    tenant_id: tenantId,
    store_id: job.store_id,
    user_id: userId,
    action: 'print_job_retried',
    entity_type: 'print_job',
    entity_id: jobId,
    details: {
      previous_status: job.status,
      retry_count: job.retry_count + 1
    }
  });

  return await getJob(jobId, tenantId);
}

/**
 * Cancel a job
 */
async function cancelJob(jobId, tenantId, userId) {
  const job = await getJob(jobId, tenantId);

  if (!job) {
    throw new Error('Print job not found');
  }

  if (job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED) {
    throw new Error('Cannot cancel a completed or already cancelled job');
  }

  await updateJobStatus(jobId, JobStatus.CANCELLED, null);

  // Audit log
  await auditLogService.logAuditEvent({
    tenant_id: tenantId,
    store_id: job.store_id,
    user_id: userId,
    action: 'print_job_cancelled',
    entity_type: 'print_job',
    entity_id: jobId,
    details: {
      previous_status: job.status
    }
  });

  return await getJob(jobId, tenantId);
}

/**
 * Get job statistics for a tenant
 */
async function getJobStatistics(tenantId, storeId = null, startDate = null, endDate = null) {
  let query = `
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
    FROM print_jobs
    WHERE tenant_id = ?
  `;
  const params = [tenantId];

  if (storeId) {
    query += ` AND store_id = ?`;
    params.push(storeId);
  }

  if (startDate) {
    query += ` AND created_at >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND created_at <= ?`;
    params.push(endDate);
  }

  const [stats] = await pool.query(query, params);
  return stats[0];
}

/**
 * Clean up old completed jobs (older than 30 days)
 */
async function cleanupOldJobs(tenantId, daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const [result] = await pool.query(
    `DELETE FROM print_jobs
     WHERE tenant_id = ?
     AND status IN ('completed', 'cancelled', 'failed')
     AND created_at < ?`,
    [tenantId, cutoffDate]
  );

  logger.log(`Cleaned up ${result.affectedRows} old print jobs for tenant ${tenantId}`);
  return result.affectedRows;
}

module.exports = {
  JobStatus,
  JobType,
  createPrintJob,
  updateJobStatus,
  incrementRetryCount,
  getJob,
  listJobs,
  retryJob,
  cancelJob,
  getJobStatistics,
  cleanupOldJobs
};
