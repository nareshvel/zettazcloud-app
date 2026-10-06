/**
 * Print Agent Device Authentication Middleware
 *
 * Authenticates agent requests using a bearer token whose SHA-256 hash is
 * stored in print_agents.token_hash. Sets req.agent when valid.
 */

const printAgentService = require('../services/printAgentService');
const logger = require('../utils/logger');

async function authenticatePrintAgent(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ status: 'error', message: 'Device bearer token required' });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
      return res.status(401).json({ status: 'error', message: 'Device bearer token required' });
    }

    const agent = await printAgentService.authenticateDevice(token);
    if (!agent) {
      return res.status(401).json({ status: 'error', message: 'Invalid or revoked device token' });
    }

    req.agent = agent;
    next();
  } catch (error) {
    logger.error('Error authenticating print agent:', error);
    return res.status(500).json({ status: 'error', message: 'Device authentication failed' });
  }
}

module.exports = { authenticatePrintAgent };
