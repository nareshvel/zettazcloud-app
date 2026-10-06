/**
 * Print Agent Fleet Routes
 *
 * Authenticated tenant-scoped fleet management under /api/print-agents.
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { rateLimit } = require('../middleware/rateLimitMiddleware');
const printAgentController = require('../controllers/printAgentController');

router.use(authenticate);
router.use(requireTenantId);

const enrollmentRateLimit = rateLimit({
  windowMs: 60000,
  max: 10,
  keyGenerator: (req) => `print-agent-enrollment:${req.user?.id || req.ip}`,
});

// Literal routes before /:id
router.post('/enrollment-codes', enrollmentRateLimit, requirePermission('settings.printer'), printAgentController.createEnrollmentCode);
router.get('/', requirePermission('settings.view'), printAgentController.listAgents);
router.get('/:id', requirePermission('settings.view'), printAgentController.getAgent);
router.put('/:id', requirePermission('settings.printer'), printAgentController.updateAgent);
router.put('/:id/printer-mappings', requirePermission('settings.printer'), printAgentController.updatePrinterMappings);
router.post('/:id/revoke', requirePermission('settings.printer'), printAgentController.revokeAgent);

module.exports = router;
