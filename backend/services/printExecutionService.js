/**
 * Print Execution Service
 * Orchestrates print job execution using adapter pattern
 */

const { pool } = require('../config/db');
const logger = require('../utils/logger');
const printerDeviceService = require('./printerDeviceService');
const printJobService = require('./printJobService');
const { createAdapter } = require('./printAdapters/AdapterFactory');
const auditLogService = require('./auditLogService');

/**
 * Execute a print job
 * @param {Object} jobData - Job data
 * @param {string} jobData.printer_device_id - Printer device ID
 * @param {string} jobData.content - Content to print
 * @param {Object} jobData.options - Print options
 * @param {string} jobData.tenant_id - Tenant ID
 * @param {string} jobData.store_id - Store ID
 * @param {string} jobData.user_id - User ID
 * @returns {Promise<Object>} Result with job ID and status
 */
async function executePrintJob(jobData) {
  const {
    printer_device_id,
    content,
    options = {},
    tenant_id,
    store_id,
    user_id,
    job_type = 'receipt',
    document_type = 'unknown'
  } = jobData;

  try {
    // Get printer device
    const device = await printerDeviceService.getPrinterDevice(printer_device_id, tenant_id);

    if (!device) {
      throw new Error('Printer device not found');
    }

    if (!device.is_active) {
      throw new Error('Printer device is not active');
    }

    // Create print job record
    const job = await printJobService.createPrintJob({
      tenant_id,
      store_id,
      printer_device_id,
      job_type,
      document_type,
      payload: {
        content: typeof content === 'string' ? content.substring(0, 1000) : 'binary',
        options
      },
      created_by: user_id
    });

    // Update job status to processing
    await printJobService.updateJobStatus(job.id, printJobService.JobStatus.PROCESSING);

    // Create adapter
    const adapter = createAdapter(device);

    // Execute print
    const result = await adapter.print({
      content,
      options
    });

    // Update job status to completed
    await printJobService.updateJobStatus(job.id, printJobService.JobStatus.COMPLETED);

    // Audit log
    await auditLogService.logAuditEvent({
      tenant_id,
      store_id,
      user_id,
      action: 'print_job_executed',
      entity_type: 'print_job',
      entity_id: job.id,
      details: {
        printer_device_id,
        job_type,
        document_type,
        success: true
      }
    });

    logger.log(`Print job ${job.id} completed successfully`);

    return {
      success: true,
      job_id: job.id,
      ...result
    };
  } catch (error) {
    logger.error(`Print job execution failed: ${error.message}`);

    // Update job status to failed if job was created
    if (jobData.printer_device_id) {
      try {
        // Try to get the job that was just created
        const recentJobs = await printJobService.listJobs(tenant_id, store_id, {
          printer_device_id,
          limit: 1
        });

        if (recentJobs.length > 0) {
          await printJobService.updateJobStatus(
            recentJobs[0].id,
            printJobService.JobStatus.FAILED,
            error.message
          );
        }
      } catch (updateError) {
        logger.error('Failed to update job status to failed:', updateError.message);
      }
    }

    // Audit log
    await auditLogService.logAuditEvent({
      tenant_id,
      store_id,
      user_id,
      action: 'print_job_failed',
      entity_type: 'print_job',
      details: {
        printer_device_id,
        job_type,
        document_type,
        error: error.message
      }
    });

    throw error;
  }
}

/**
 * Test printer connectivity
 * @param {string} printer_device_id - Printer device ID
 * @param {string} tenant_id - Tenant ID
 * @returns {Promise<Object>} Test result
 */
async function testPrinter(printer_device_id, tenant_id) {
  try {
    const device = await printerDeviceService.getPrinterDevice(printer_device_id, tenant_id);

    if (!device) {
      throw new Error('Printer device not found');
    }

    const adapter = createAdapter(device);
    const connected = await adapter.testConnectivity();

    return {
      success: connected,
      device_id: printer_device_id,
      device_name: device.name,
      device_type: device.device_type
    };
  } catch (error) {
    logger.error(`Printer test failed: ${error.message}`);
    return {
      success: false,
      device_id: printer_device_id,
      error: error.message
    };
  }
}

/**
 * Get printer status
 * @param {string} printer_device_id - Printer device ID
 * @param {string} tenant_id - Tenant ID
 * @returns {Promise<Object>} Printer status
 */
async function getPrinterStatus(printer_device_id, tenant_id) {
  try {
    const device = await printerDeviceService.getPrinterDevice(printer_device_id, tenant_id);

    if (!device) {
      throw new Error('Printer device not found');
    }

    const adapter = createAdapter(device);
    const status = await adapter.getStatus();

    return {
      ...status,
      device_id: printer_device_id,
      device_name: device.name
    };
  } catch (error) {
    logger.error(`Failed to get printer status: ${error.message}`);
    return {
      online: false,
      device_id: printer_device_id,
      error: error.message
    };
  }
}

module.exports = {
  executePrintJob,
  testPrinter,
  getPrinterStatus
};
