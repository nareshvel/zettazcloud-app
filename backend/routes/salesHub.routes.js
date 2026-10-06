/**
 * Sales Hub routes — /api/sales-hub
 *
 *   GET /search?q=   universal customer-relationship search (see
 *                     salesHubController.js for the aggregation logic)
 *   GET /glance      lightweight counters for the Hub glance strip
 */

'use strict';

const express = require('express');
const router = express.Router();
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const salesHubController = require('../controllers/salesHubController');

router.use(authenticate);
router.use(requireTenantId);

router.get('/search', salesHubController.search);
router.get('/glance', salesHubController.glance);

module.exports = router;
