/**
 * Payment Terminal API Routes
 * Handles terminal management and payment processing
 */

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const paymentTerminalService = require('../services/paymentTerminalService');
const jwtMiddleware = require('../middleware/jwtMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');

// Apply JWT middleware to all routes
router.use(jwtMiddleware);

/**
 * GET /api/payment-terminals
 * Get all payment terminals for tenant
 */
router.get('/', requirePermission('payment_methods.view'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    
    const result = await paymentTerminalService.getTerminals(tenantId);
    
    if (result.success) {
      res.json({
        success: true,
        terminals: result.terminals
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error fetching payment terminals:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/payment-terminals
 * Add new payment terminal
 */
router.post('/', requirePermission('payment_methods.create'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const terminalData = req.body;
    
    // Validate required fields
    const { terminalType, provider, terminalId, deviceName } = terminalData;
    if (!terminalType || !provider || !terminalId || !deviceName) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: terminalType, provider, terminalId, deviceName'
      });
    }
    
    const result = await paymentTerminalService.addTerminal(tenantId, terminalData);
    
    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        terminalId: result.terminalId
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error adding payment terminal:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * PUT /api/payment-terminals/:id
 * Update payment terminal configuration
 */
router.put('/:id', requirePermission('payment_methods.edit'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id: terminalId } = req.params;
    const updateData = req.body;
    
    const result = await paymentTerminalService.updateTerminal(terminalId, tenantId, updateData);
    
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
    console.error('Error updating payment terminal:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/payment-terminals/:id
 * Delete payment terminal
 */
router.delete('/:id', requirePermission('payment_methods.delete'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id: terminalId } = req.params;
    
    const result = await paymentTerminalService.deleteTerminal(terminalId, tenantId);
    
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
    console.error('Error deleting payment terminal:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/payment-terminals/:id/test
 * Test terminal connection
 */
router.post('/:id/test', requirePermission('payment_methods.view'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id: terminalId } = req.params;
    
    const result = await paymentTerminalService.testTerminal(terminalId, tenantId);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        provider: result.provider
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error testing payment terminal:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * POST /api/payment-terminals/:id/charge
 * Process payment through terminal
 */
router.post('/:id/charge', requirePermission('sales.create'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id: terminalId } = req.params;
    const paymentData = req.body;
    
    // Validate required fields
    const { saleId, amount } = paymentData;
    if (!saleId || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: saleId, amount (must be > 0)'
      });
    }
    
    const result = await paymentTerminalService.processPayment(terminalId, tenantId, paymentData);
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        transactionId: result.transactionId,
        providerTransactionId: result.providerTransactionId
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error processing terminal payment:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/payment-terminals/transactions
 * Get terminal transaction history
 */
router.get('/transactions', requirePermission('sales.view'), async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { limit = 50, offset = 0, status, terminalId } = req.query;
    
    let query = `
      SELECT ptt.*, pt.device_name, pt.provider, s.total_amount as sale_amount
      FROM payment_terminal_transactions ptt
      JOIN payment_terminals pt ON ptt.terminal_id = pt.id
      LEFT JOIN sales s ON ptt.sale_id = s.id
      WHERE pt.tenant_id = ?
    `;
    const queryParams = [tenantId];
    
    if (status) {
      query += ' AND ptt.status = ?';
      queryParams.push(status);
    }
    
    if (terminalId) {
      query += ' AND ptt.terminal_id = ?';
      queryParams.push(terminalId);
    }
    
    query += ' ORDER BY ptt.created_at DESC LIMIT ? OFFSET ?';
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
    console.error('Error fetching terminal transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

module.exports = router;
