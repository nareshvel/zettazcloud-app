/**
 * Print Agent Connect Controller
 *
 * Public-but-device-authenticated endpoints for agent enrollment, heartbeat,
 * and configuration retrieval. No JWT session is required; agents prove identity
 * via a bearer token whose SHA-256 hash is stored in print_agents.
 */

const printAgentService = require('../services/printAgentService');
const logger = require('../utils/logger');

exports.enroll = async (req, res) => {
  try {
    const { code, agent_id, display_name, version, platform, os_version, architecture } = req.body || {};

    if (!code || !agent_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Enrollment code and agent_id are required',
      });
    }

    const metadata = {
      display_name,
      version,
      platform,
      os_version,
      architecture,
    };

    const result = await printAgentService.consumeEnrollmentCode(code, agent_id, metadata);

    res.status(201).json({
      status: 'success',
      message: 'Agent enrolled',
      data: {
        agent_id: result.agent_id,
        tenant_id: result.tenant_id,
        store_id: result.store_id,
        token: result.token,
      },
    });
  } catch (error) {
    logger.error('Error enrolling print agent:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ status: 'error', message: error.message });
  }
};

exports.heartbeat = async (req, res) => {
  try {
    const agent = req.agent;
    if (!agent) {
      return res.status(401).json({ status: 'error', message: 'Device authentication required' });
    }

    const allowedInput = {};
    const allowedKeys = ['version', 'platform', 'os_version', 'architecture', 'status', 'capabilities', 'queue_counts', 'last_error'];
    allowedKeys.forEach((key) => {
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, key)) {
        allowedInput[key] = req.body[key];
      }
    });

    await printAgentService.recordHeartbeat(agent.id, allowedInput);

    res.json({
      status: 'success',
      message: 'Heartbeat recorded',
    });
  } catch (error) {
    logger.error('Error recording heartbeat:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ status: 'error', message: error.message, errors: error.errors || undefined });
  }
};

exports.getConfiguration = async (req, res) => {
  try {
    const agent = req.agent;
    if (!agent) {
      return res.status(401).json({ status: 'error', message: 'Device authentication required' });
    }

    const config = await printAgentService.getConfiguration(agent);

    res.json({
      status: 'success',
      data: config,
    });
  } catch (error) {
    logger.error('Error retrieving agent configuration:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ status: 'error', message: error.message });
  }
};
