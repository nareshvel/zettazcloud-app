const express = require('express');
const router = express.Router();
// Consolidated RBAC permission middleware — also handles authentication
// (see rbacPermissionMiddleware.js), same pattern as sales.routes.js /
// salesReturn.routes.js. Reuses the existing sales.view/sales.create
// permission keys rather than inventing new unseeded ones — sales orders
// are a sub-flow of the same sales workflow, not a separate permission
// domain like returns.
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const {
  getAllOrders,
  getOrderStats,
  getOrderById,
  createOrder,
  updateOrderStatus,
} = require('../controllers/salesOrdersController');

/**
 * @route   GET /api/sales-orders/stats
 * @desc    Get sales order status counts (KPI strip)
 * @access  Private (requires sales.view permission)
 */
router.get('/stats', requirePermission('sales.view'), getOrderStats);

/**
 * @route   GET /api/sales-orders
 * @desc    Get all sales orders with pagination/search/status filter
 * @access  Private (requires sales.view permission)
 */
router.get('/', requirePermission('sales.view'), getAllOrders);

/**
 * @route   GET /api/sales-orders/:id
 * @desc    Get a specific sales order
 * @access  Private (requires sales.view permission)
 */
router.get('/:id', requirePermission('sales.view'), getOrderById);

/**
 * @route   POST /api/sales-orders
 * @desc    Create a new sales order
 * @access  Private (requires sales.create permission)
 */
router.post('/', requirePermission('sales.create'), createOrder);

/**
 * @route   PATCH /api/sales-orders/:id/status
 * @desc    Update a sales order's status
 * @access  Private (requires sales.create permission)
 */
router.patch('/:id/status', requirePermission('sales.create'), updateOrderStatus);

module.exports = router;
