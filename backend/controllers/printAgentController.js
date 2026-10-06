/**
 * Print Agent Controller
 *
 * Authenticated fleet-management endpoints under /api/print-agents.
 */

const printAgentService = require('../services/printAgentService');
const logger = require('../utils/logger');

exports.createEnrollmentCode = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    const storeId = req.body?.store_id || req.user?.store_id;
    const userId = req.user?.id;

    if (!tenantId || !storeId) {
      return res.status(400).json({ status: 'error', message: 'Tenant and store scope are required' });
    }

    const result = await printAgentService.createEnrollmentCode(tenantId, storeId, userId);

    res.status(201).json({
      status: 'success',
      message: 'Enrollment code created',
      data: {
        id: result.id,
        code: result.code,
        expires_at: result.expires_at,
        tenant_id: result.tenant_id,
        store_id: result.store_id,
      },
    });
  } catch (error) {
    logger.error('Error creating enrollment code:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ status: 'error', message: error.message });
  }
};

exports.listAgents = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    const storeId = req.query?.store_id || req.user?.store_id;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant scope is required' });
    }

    const filters = {};
    if (req.query?.status) filters.status = req.query.status;

    const agents = await printAgentService.listAgents(tenantId, storeId, filters);

    res.json({
      status: 'success',
      data: agents,
    });
  } catch (error) {
    logger.error('Error listing print agents:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ status: 'error', message: error.message });
  }
};

exports.getAgent = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    const storeId = req.user?.store_id;
    const agentRowId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant scope is required' });
    }

    const agent = await printAgentService.getAgentById(agentRowId, tenantId, storeId);
    if (!agent) {
      return res.status(404).json({ status: 'error', message: 'Print agent not found' });
    }

    const mappings = await printAgentService.getPrinterMappings(agentRowId);

    res.json({
      status: 'success',
      data: { ...agent, printer_mappings: mappings },
    });
  } catch (error) {
    logger.error('Error getting print agent:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ status: 'error', message: error.message });
  }
};

exports.updateAgent = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    const storeId = req.user?.store_id;
    const agentRowId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant scope is required' });
    }

    const updated = await printAgentService.updateAgent(agentRowId, tenantId, storeId, req.body);
    if (!updated) {
      return res.status(404).json({ status: 'error', message: 'Print agent not found' });
    }

    res.json({
      status: 'success',
      message: 'Print agent updated',
    });
  } catch (error) {
    logger.error('Error updating print agent:', error);
    const status = error.statusCode || 400;
    res.status(status).json({ status: 'error', message: error.message, errors: error.errors || undefined });
  }
};

exports.updatePrinterMappings = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    const storeId = req.user?.store_id;
    const agentRowId = req.params.id;
    const mappings = req.body?.mappings || [];

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant scope is required' });
    }

    const normalized = await printAgentService.updatePrinterMappings(
      agentRowId,
      tenantId,
      storeId,
      mappings
    );

    res.json({
      status: 'success',
      message: 'Printer mappings updated',
      data: normalized,
    });
  } catch (error) {
    logger.error('Error updating printer mappings:', error);
    const status = error.statusCode || 400;
    res.status(status).json({ status: 'error', message: error.message, errors: error.errors || undefined });
  }
};

exports.revokeAgent = async (req, res) => {
  try {
    const tenantId = req.user?.tenant_id;
    const storeId = req.user?.store_id;
    const agentRowId = req.params.id;

    if (!tenantId) {
      return res.status(400).json({ status: 'error', message: 'Tenant scope is required' });
    }

    const revoked = await printAgentService.revokeAgent(agentRowId, tenantId, storeId);
    if (!revoked) {
      return res.status(404).json({ status: 'error', message: 'Print agent not found' });
    }

    res.json({
      status: 'success',
      message: 'Print agent credential revoked',
    });
  } catch (error) {
    logger.error('Error revoking print agent:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ status: 'error', message: error.message });
  }
};
