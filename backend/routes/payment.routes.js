const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const systemPaymentController = require('../controllers/systemPaymentMethods.controller');
const { validateRequest } = require('../middleware/validation');
// Import consolidated RBAC permission middleware
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');
const { authenticate, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');

// Validation middleware
const validatePaymentProcess = [
  body('saleId').isUUID().withMessage('Invalid sale ID format'),
  body('paymentMethodId').isUUID().withMessage('Invalid payment method ID'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('tenderAmount').optional().isFloat({ min: 0 }),
  body('terminalId').optional().isUUID(),
  body('transactionId').optional().isString().trim().notEmpty(),
  body('metadata').optional().isObject(),
  validateRequest
];

const validateRefund = [
  body('transactionId').isUUID().withMessage('Invalid transaction ID'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than 0'),
  body('reason').optional().isString().trim().notEmpty(),
  validateRequest
];

const validatePaymentSettings = [
  body('defaultCurrency').isString().isLength({ min: 3, max: 3 }).toUpperCase(),
  body('allowPartialPayments').isBoolean(),
  body('allowTips').isBoolean(),
  body('defaultTipPercentage').optional().isFloat({ min: 0, max: 100 }),
  body('receiptSettings').optional().isObject(),
  validateRequest
];

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing and management
 */

/**
 * @swagger
 * /api/payment/methods:
 *   get:
 *     summary: Get available payment methods
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of available payment methods
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PaymentMethod'
 */
/**
 * @route   GET /api/payment/methods
 * @desc    Get available payment methods
 * @access  Private (requires payments.view permission)
 */
router.get('/methods', requirePermission('payments.view'), paymentController.getPaymentMethods);

/**
 * @swagger
 * /api/payment/process:
 *   post:
 *     summary: Process a payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - saleId
 *               - paymentMethodId
 *               - amount
 *             properties:
 *               saleId:
 *                 type: string
 *                 format: uuid
 *               paymentMethodId:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *                 format: float
 *               tenderAmount:
 *                 type: number
 *                 format: float
 *               terminalId:
 *                 type: string
 *                 format: uuid
 *               transactionId:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PaymentTransaction'
 */
/**
 * @route   POST /api/payment/process
 * @desc    Process a payment
 * @access  Private (requires payments.create permission)
 */
router.post('/process', requirePermission('payments.create'), validatePaymentProcess, paymentController.processPayment);

/**
 * @swagger
 * /api/payment/transactions/{transactionId}:
 *   get:
 *     summary: Get transaction details
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: transactionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PaymentTransaction'
 */
router.get(
  '/transactions/:transactionId', 
  authenticate, 
  param('transactionId').isUUID().withMessage('Invalid transaction ID'),
  validateRequest,
  paymentController.getTransaction
);

/**
 * @swagger
 * /api/payment/refund:
 *   post:
 *     summary: Process a refund
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transactionId
 *               - amount
 *             properties:
 *               transactionId:
 *                 type: string
 *                 format: uuid
 *               amount:
 *                 type: number
 *                 format: float
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     originalTransactionId:
 *                       type: string
 *                       format: uuid
 *                     amount:
 *                       type: number
 *                       format: float
 *                     status:
 *                       type: string
 *                       enum: [completed, pending, failed]
 *                     referenceId:
 *                       type: string
 *                     processedAt:
 *                       type: string
 *                       format: date-time
 */
/**
 * @route   POST /api/payment/refund
 * @desc    Process a refund
 * @access  Private (requires payments.refund permission)
 */
router.post('/refund', requirePermission('payments.refund'), validateRefund, paymentController.refundTransaction);

/**
 * @swagger
 * /api/payment/settings:
 *   get:
 *     summary: Get payment settings
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PaymentSettings'
 */
/**
 * @route   GET /api/payment/settings
 * @desc    Get payment settings
 * @access  Private (requires payments.view permission)
 */
router.get('/settings', requirePermission('payments.view'), paymentController.getPaymentSettings);

/**
 * @swagger
 * /api/payment/settings:
 *   put:
 *     summary: Update payment settings
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PaymentSettings'
 *     responses:
 *       200:
 *         description: Payment settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/PaymentSettings'
 */
/**
 * @route   PUT /api/payment/settings
 * @desc    Update payment settings
 * @access  Private (requires payments.update permission)
 */
router.put('/settings', requirePermission('payments.edit'), validatePaymentSettings, paymentController.updatePaymentSettings);

module.exports = router;
