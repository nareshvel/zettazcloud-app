/**
 * Print Agent Connect Routes
 *
 * Public-but-device-authenticated endpoints for agent enrollment, heartbeat,
 * and configuration retrieval under /api/print-agent-connect.
 */

const express = require('express');
const router = express.Router();
const { authenticatePrintAgent } = require('../middleware/printAgentAuthMiddleware');
const { rateLimit } = require('../middleware/rateLimitMiddleware');
const printAgentConnectController = require('../controllers/printAgentConnectController');

const enrollmentRateLimit = rateLimit({
  windowMs: 60000,
  max: 10,
  keyGenerator: (req) => `print-agent-connect-enroll:${req.ip}`,
});

const connectRateLimit = rateLimit({
  windowMs: 60000,
  max: 60,
  keyGenerator: (req) => `print-agent-connect:${req.agent?.id || req.ip}`,
});

router.post('/enroll', enrollmentRateLimit, printAgentConnectController.enroll);
router.post('/heartbeat', connectRateLimit, authenticatePrintAgent, printAgentConnectController.heartbeat);
router.get('/configuration', connectRateLimit, authenticatePrintAgent, printAgentConnectController.getConfiguration);

module.exports = router;
