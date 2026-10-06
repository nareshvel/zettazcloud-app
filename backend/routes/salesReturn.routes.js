const express = require('express');
const router = express.Router();
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const {
  getAllReturns,
  getReturnById,
  getReturnableItems,
  createReturn,
  completeReturn,
  cancelReturn,
  getReturnStats
} = require('../controllers/salesReturnController');

/**
 * @route   GET /api/sales-returns/stats
 * @desc    Get sales return statistics
 * @access  Private (requires sales.return.view permission)
 */
router.get('/stats', requirePermission('sales-return.view'), getReturnStats);

/**
 * @route   GET /api/sales-returns
 * @desc    Get all sales returns with pagination and filtering
 * @access  Private (requires sales.return.view permission)
 */
router.get('/', requirePermission('sales-return.view'), getAllReturns);

/**
 * @route   GET /api/sales-returns/:id
 * @desc    Get specific sales return with details
 * @access  Private (requires sales.return.view permission)
 */
router.get('/:id', requirePermission('sales-return.view'), getReturnById);

/**
 * @route   POST /api/sales-returns
 * @desc    Create new sales return
 * @access  Private (requires sales.return.create permission)
 */
router.post('/', requirePermission('sales-return.create'), createReturn);

/**
 * @route   PATCH /api/sales-returns/:id/complete
 * @desc    Complete sales return (finalize processing)
 * @access  Private (requires sales.return.complete permission)
 */
router.patch('/:id/complete', requirePermission('sales-return.process'), completeReturn);

/**
 * @route   PATCH /api/sales-returns/:id/cancel
 * @desc    Cancel sales return
 * @access  Private (requires sales.return.cancel permission)
 */
router.patch('/:id/cancel', requirePermission('sales-return.approve'), cancelReturn);

module.exports = router;
