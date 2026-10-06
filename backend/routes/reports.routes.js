const express = require('express');
const router = express.Router();
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
const reportsController = require('../controllers/reportsController');

/**
 * @route   GET /api/reports/customer-value
 * @desc    Get customer value detailed report
 * @access  Private (requires reports.read permission)
 */
router.get('/customer-value', requirePermission('reports.view'), reportsController.getCustomerValueReport);

/**
 * @route   GET /api/reports/customer-value/summary
 * @desc    Get customer value summary metrics
 * @access  Private (requires reports.read permission)
 */
router.get('/customer-value/summary', requirePermission('reports.view'), reportsController.getCustomerValueSummaryMetrics);

/**
 * @route   GET /api/reports/charge-account
 * @desc    Get charge account detailed report
 * @access  Private (requires reports.read permission)
 */
router.get('/charge-account', requirePermission('reports.view'), reportsController.getChargeAccountReport);

/**
 * @route   GET /api/reports/charge-account/summary
 * @desc    Get charge account summary metrics
 * @access  Private (requires reports.read permission)
 */
router.get('/charge-account/summary', requirePermission('reports.view'), reportsController.getChargeAccountSummaryMetrics);

/**
 * @route   GET /api/reports/sales/transactions
 * @desc    Get sales transactions report
 * @access  Private (requires reports.read permission)
 */
router.get('/sales/transactions', requirePermission('reports.view'), (req, res, next) => {
  // Extract tenant_id and store_id before passing to controller
  // This ensures they're available even when permission checks are skipped
  req.headers['x-tenant-id'] = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
  req.headers['x-store-id'] = req.user?.store_id || req.query?.store_id || req.headers['x-store-id'];
  next();
}, reportsController.getSalesTransactions);

/**
 * @route   GET /api/reports/sales/chart
 * @desc    Get sales chart data
 * @access  Private (requires reports.read permission)
 */
router.get('/sales/chart', requirePermission('reports.view'), (req, res, next) => {
  // Extract tenant_id and store_id before passing to controller
  // This ensures they're available even when permission checks are skipped
  req.headers['x-tenant-id'] = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
  req.headers['x-store-id'] = req.user?.store_id || req.query?.store_id || req.headers['x-store-id'];
  next();
}, reportsController.getSalesChartData);

/**
 * @route   GET /api/reports/sales/categories
 * @desc    Get sales categories summary
 * @access  Private (requires reports.read permission)
 */
router.get('/sales/categories', requirePermission('reports.view'), (req, res, next) => {
  // Extract tenant_id and store_id before passing to controller
  // This ensures they're available even when permission checks are skipped
  req.headers['x-tenant-id'] = req.user?.tenant_id || req.query?.tenant_id || req.headers['x-tenant-id'];
  req.headers['x-store-id'] = req.user?.store_id || req.query?.store_id || req.headers['x-store-id'];
  next();
}, reportsController.getSalesCategorySummary);

/**
 * @route   GET /api/reports/inventory/items
 * @desc    Get inventory items report
 * @access  Private (requires reports.read permission)
 */
router.get('/inventory/items', requirePermission('reports.view'), reportsController.getInventoryReportItems);

/**
 * @route   GET /api/reports/inventory/summary
 * @desc    Get inventory summary metrics
 * @access  Private (requires reports.read permission)
 */
router.get('/inventory/summary', requirePermission('reports.view'), reportsController.getInventorySummaryMetrics);

/**
 * @route   GET /api/reports/payments/items
 * @desc    Get payment report items
 * @access  Private (requires reports.read permission)
 */
router.get('/payments/items', requirePermission('reports.view'), reportsController.getPaymentReportItems);

/**
 * @route   GET /api/reports/payments/summary
 * @desc    Get payment summary metrics
 * @access  Private (requires reports.read permission)
 */
router.get('/payments/summary', requirePermission('reports.view'), reportsController.getPaymentSummaryMetrics);

module.exports = router;
