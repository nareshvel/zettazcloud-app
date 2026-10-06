const express = require('express');
const router = express.Router();
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { getSaleById, getSaleItems, searchSales } = require('../controllers/salesController');
const { createSale } = require('../controllers/createSaleController');

/**
 * @route   GET /api/sales/search?q=...
 * @desc    Search completed sales by document number, customer name, email,
 *          or phone — used by the Sales Return flow. MUST stay above the
 *          /:id route below (literal routes before wildcard /:id, or "search"
 *          gets swallowed as an :id value — see CLAUDE.md).
 * @access  Private (requires sales.view permission)
 */
router.get('/search', requirePermission('sales.view'), searchSales);

/**
 * @route   GET /api/sales/:id
 * @desc    Get specific sale with details
 * @access  Private (requires sales.read permission)
 */
router.get('/:id', requirePermission('sales.view'), getSaleById);

/**
 * @route   GET /api/sales/:id/items
 * @desc    Get items for a specific sale
 * @access  Private (requires sales.read permission)
 */
router.get('/:id/items', requirePermission('sales.view'), getSaleItems);

/**
 * @route   POST /api/sales
 * @desc    Create a new sale
 * @access  Private (requires sales.create permission)
 */
router.post('/', requirePermission('sales.create'), createSale);

module.exports = router;
