/**
 * Print Test / Certification Routes
 * Provides fixture data and test endpoints for QA
 */

const express = require('express');
const router = express.Router();
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { listFixtures, getFixture } = require('../services/printFixtures');
const logger = require('../utils/logger');

// All routes require authentication and tenant context
router.use(authenticate);
router.use(requireTenantId);

/**
 * GET /api/print-tests/fixtures
 * List available test fixtures
 */
router.get('/fixtures', async (req, res) => {
  try {
    res.json({
      status: 'success',
      data: listFixtures()
    });
  } catch (error) {
    logger.error('Error listing fixtures:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/print-tests/fixtures/:type/:name
 * Get a specific fixture
 */
router.get('/fixtures/:type/:name', async (req, res) => {
  try {
    const fixture = getFixture(req.params.type, req.params.name);

    if (!fixture) {
      return res.status(404).json({
        status: 'error',
        message: 'Fixture not found'
      });
    }

    res.json({
      status: 'success',
      data: fixture
    });
  } catch (error) {
    logger.error('Error getting fixture:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/print-tests/suite
 * Get full certification suite
 */
router.get('/suite', requirePermission('system.maintenance'), async (req, res) => {
  try {
    const fixtures = require('../services/printFixtures');

    res.json({
      status: 'success',
      data: fixtures.printFixtureSuite
    });
  } catch (error) {
    logger.error('Error getting test suite:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
