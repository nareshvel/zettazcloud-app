/**
 * Payment Gateway API Routes
 * Handles gateway management and online payment processing
 */

const express = require('express');
const router = express.Router();
const paymentGatewayService = require('../services/paymentGatewayService');
const jwtMiddleware = require('../middleware/jwtMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');

// Apply JWT middleware to all routes
router.use(jwtMiddleware);

/**
 * GET /api/payment-gateways
 * Get all payment gateways for tenant
 */
router.get('/', requirePermission('payments.view'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    
    const result = await paymentGatewayService.getGateways(tenantId);
    
    if (result.success) {
      res.json({
        success: true,
        gateways: result.gateways
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error fetching payment gateways:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/payment-gateways
 * Configure new payment gateway
 */
router.post('/', requirePermission('payments.create'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const gatewayData = req.body;
    
    // Validate required fields
    const { gatewayType, configData } = gatewayData;
    if (!gatewayType || !configData) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: gatewayType, configData'
      });
    }
    
    const result = await paymentGatewayService.configureGateway(tenantId, gatewayData);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        gatewayId: result.gatewayId,
        webhookEndpoint: result.webhookEndpoint
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error configuring payment gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/payment-gateways/:id
 * Update payment gateway configuration
 */
router.put('/:id', requirePermission('payments.edit'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id: gatewayId } = req.params;
    const updateData = req.body;
    
    const result = await paymentGatewayService.updateGateway(gatewayId, tenantId, updateData);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error updating payment gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/payment-gateways/:id
 * Delete payment gateway
 */
router.delete('/:id', requirePermission('payments.delete'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id: gatewayId } = req.params;
    
    const result = await paymentGatewayService.deleteGateway(gatewayId, tenantId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error deleting payment gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/payment-gateways/:id/test
 * Test gateway connection
 */
router.post('/:id/test', requirePermission('payments.view'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id: gatewayId } = req.params;
    
    const result = await paymentGatewayService.testGateway(gatewayId, tenantId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        provider: result.provider,
        mode: result.mode
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error testing payment gateway:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/payment-gateways/:id/create-intent
 * Create payment intent for online payment
 */
router.post('/:id/create-intent', requirePermission('sales.create'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id: gatewayId } = req.params;
    const paymentData = req.body;
    
    // Validate required fields
    const { saleId, amount } = paymentData;
    if (!saleId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: saleId, amount (must be > 0)'
      });
    }
    
    const result = await paymentGatewayService.createPaymentIntent(gatewayId, tenantId, paymentData);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        transactionId: result.transactionId,
        paymentIntentId: result.paymentIntentId,
        clientSecret: result.clientSecret
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/payment-gateways/transactions
 * Get gateway transaction history
 */
router.get('/transactions', requirePermission('sales.view'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { limit = 50, offset = 0, status, gatewayId } = req.query;
    
    let query = `
      SELECT pgt.*, pg.gateway_type, s.total_amount as sale_amount
      FROM payment_gateway_transactions pgt
      JOIN payment_gateways pg ON pgt.gateway_id = pg.id
      LEFT JOIN sales s ON pgt.sale_id = s.id
      WHERE pg.tenant_id = ?
    `;
    const queryParams = [tenantId];
    
    if (status) {
      query += ' AND pgt.status = ?';
      queryParams.push(status);
    }
    
    if (gatewayId) {
      query += ' AND pgt.gateway_id = ?';
      queryParams.push(gatewayId);
    }
    
    query += ' ORDER BY pgt.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));
    
    const [rows] = await pool.query(query, queryParams);
    
    res.json({
      success: true,
      transactions: rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: rows.length
      }
    });
  } catch (error) {
    console.error('Error fetching gateway transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
