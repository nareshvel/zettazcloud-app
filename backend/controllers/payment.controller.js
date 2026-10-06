const { query, queryOne, withTransaction } = require('../db');
const { v4: uuidv4 } = require('uuid');

/**
 * Get all active payment methods for the current tenant
 */
const getPaymentMethods = async (req, res) => {
  try {
    // Get payment methods from database for this tenant
    const paymentMethods = await query(
      `SELECT id, name, code, is_active as isActive, requires_terminal as requiresTerminal, 
              icon, sort_order as sortOrder, created_at, updated_at
       FROM payment_methods 
       WHERE tenant_id = ? AND is_active = 1 
       ORDER BY sort_order ASC`,
      [req.user.tenant_id]
    );

    // If no payment methods found, ensure default methods exist
    if (paymentMethods.length === 0) {
      await ensureDefaultPaymentMethods(req.user.tenant_id);
      
      // Re-fetch after creating defaults
      const newMethods = await query(
        `SELECT id, name, code, is_active as isActive, requires_terminal as requiresTerminal, 
                icon, sort_order as sortOrder, created_at, updated_at
         FROM payment_methods 
         WHERE tenant_id = ? AND is_active = 1 
         ORDER BY sort_order ASC`,
        [req.user.tenant_id]
      );
      
      return res.json(newMethods);
    }
    
    // Return the payment methods from database
    res.json(paymentMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch payment methods'
    });
  }
};

/**
 * Process a payment
 */
const processPayment = async (req, res) => {
  const { saleId, paymentMethodId, amount, tenderAmount, terminalId, metadata = {} } = req.body;
  const transactionId = `txn_${uuidv4().replace(/-/g, '')}`;
  
  try {
    // Start a transaction
    await db.beginTransaction();
    
    // 1. Verify the payment method exists and is active
    const paymentMethod = await queryOne(
      'SELECT id, name, code, requires_terminal as requiresTerminal FROM payment_methods WHERE id = ? AND tenant_id = ? AND is_active = 1',
      [paymentMethodId, req.user.tenant_id]
    );
    
    if (!paymentMethod) {
      await db.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Invalid or inactive payment method'
      });
    }
    
    // 2. If payment method requires a terminal, verify the terminal
    if (paymentMethod.requiresTerminal && !terminalId) {
      await db.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Terminal ID is required for this payment method'
      });
    }
    
    // 3. Create the payment transaction using transaction
    await withTransaction(async (trx) => {
      // Insert transaction
      await trx.query(
        `INSERT INTO payment_transactions 
         (id, tenant_id, sale_id, payment_method_id, terminal_id, amount, 
          currency, status, transaction_id, reference_id, metadata, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'USD', 'completed', ?, ?, ?, ?)`,
        [
          uuidv4(),
          req.user.tenant_id,
          saleId,
          paymentMethodId,
          terminalId || null,
          amount,
          transactionId,
          metadata.referenceNumber || null,
          JSON.stringify(metadata),
          req.user.id
        ]
      );

      // Update sale status
      await trx.query(
        'UPDATE sales SET payment_status = ? WHERE id = ? AND tenant_id = ?',
        ['paid', saleId, req.user.tenant_id]
      );
    });
    

    
    // 4. Return the payment confirmation
    res.json({
      status: 'success',
      data: {
        transactionId,
        saleId,
        amount: parseFloat(amount),
        change: parseFloat((tenderAmount - amount).toFixed(2)),
        status: 'completed',
        paymentMethod: {
          id: paymentMethod.id,
          name: paymentMethod.name,
          code: paymentMethod.code
        },
        processedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process payment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get transaction details
 */
const getTransaction = async (req, res) => {
  const { transactionId } = req.params;
  
  try {
    const transaction = await queryOne(
      `SELECT t.id, t.sale_id as saleId, t.payment_method_id as paymentMethodId,
              t.terminal_id as terminalId, t.amount, t.currency, t.status,
              t.transaction_id as gatewayTransactionId, t.reference_id as referenceId,
              t.metadata, t.created_at as createdAt, t.updated_at as updatedAt,
              m.name as paymentMethodName, m.code as paymentMethodCode
       FROM payment_transactions t
       LEFT JOIN payment_methods m ON t.payment_method_id = m.id
       WHERE t.id = ? AND t.tenant_id = ?`,
      [transactionId, req.user.tenant_id]
    );
    
    if (!transaction) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found'
      });
    }
    
    // Parse metadata
    let metadata = {};
    if (transaction.metadata) {
      try {
        metadata = typeof transaction.metadata === 'string' 
          ? JSON.parse(transaction.metadata) 
          : transaction.metadata;
      } catch (e) {
        console.error('Error parsing transaction metadata:', e);
      }
    }
    
    res.json({
      status: 'success',
      data: {
        id: transaction.id,
        saleId: transaction.saleId,
        paymentMethodId: transaction.paymentMethodId,
        terminalId: transaction.terminalId,
        amount: parseFloat(transaction.amount),
        currency: transaction.currency || 'USD',
        status: transaction.status,
        transactionId: transaction.gatewayTransactionId,
        referenceId: transaction.referenceId,
        cardLast4: metadata.cardLast4,
        cardType: metadata.cardType,
        metadata: metadata,
        paymentMethod: {
          id: transaction.paymentMethodId,
          name: transaction.paymentMethodName,
          code: transaction.paymentMethodCode
        },
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch transaction details'
    });
  }
};

/**
 * Refund a transaction
 */
const refundTransaction = async (req, res) => {
  const { transactionId, amount, reason } = req.body;
  const refundId = `ref_${uuidv4().replace(/-/g, '')}`;
  
  try {
    // Start a transaction
    await db.beginTransaction();
    
    // 1. Get the original transaction
    const originalTx = await withTransaction(async (trx) => {
      const [tx] = await trx.query(
        'SELECT id, amount, status, sale_id as saleId FROM payment_transactions WHERE id = ? AND tenant_id = ? FOR UPDATE',
        [transactionId, req.user.tenant_id]
      );
      
      if (!tx) {
        throw new Error('Transaction not found');
      }
      
      return tx;
    });
    
    if (!originalTx) {
      return res.status(404).json({
        status: 'error',
        message: 'Transaction not found'
      });
    }
    
    // 2. Verify the transaction can be refunded
    if (originalTx.status !== 'completed') {
      await db.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Only completed transactions can be refunded'
      });
    }
    
    // 3. Process refund within a transaction
    await withTransaction(async (trx) => {
      // Create refund transaction
      await trx.query(
        `INSERT INTO payment_transactions 
         (id, tenant_id, sale_id, original_transaction_id, amount, 
          currency, status, transaction_id, reference_id, metadata, type, created_by)
         VALUES (?, ?, ?, ?, -?, 'USD', 'completed', ?, ?, ?, 'refund', ?)`,
        [
          uuidv4(),
          req.user.tenant_id,
          originalTx.saleId,
          originalTx.id,
          amount,
          refundId,
          `REFUND_${Date.now()}`,
          JSON.stringify({ reason, originalTransactionId: transactionId }),
          req.user.id
        ]
      );
      
      // 4. Update the original transaction status if full refund
      const newAmount = parseFloat(originalTx.amount) - parseFloat(amount);
      if (Math.abs(newAmount) < 0.01) { // Full refund
        await trx.query(
          'UPDATE payment_transactions SET status = ? WHERE id = ?',
          ['refunded', transactionId]
        );
        
        // Update sale status if needed
        await trx.query(
          'UPDATE sales SET payment_status = ? WHERE id = ?',
          ['refunded', originalTx.saleId]
        );
      } else {
        // For partial refund, update the status to 'partially_refunded'
        await trx.query(
          'UPDATE payment_transactions SET status = ? WHERE id = ?',
          ['partially_refunded', transactionId]
        );
      }
    });
    
    // 5. Return the refund confirmation
    res.json({
      status: 'success',
      data: {
        id: refundId,
        originalTransactionId: transactionId,
        amount: parseFloat(amount),
        status: 'completed',
        referenceId: `REFUND_${Date.now()}`,
        processedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error processing refund:', error);
    const statusCode = error.message === 'Transaction not found' ? 404 : 500;
    res.status(statusCode).json({
      status: 'error',
      message: error.message || 'Failed to process refund',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get payment settings for the current tenant
 */
const getPaymentSettings = async (req, res) => {
  try {
    const settings = await query(
      'SELECT * FROM tenant_payment_settings WHERE tenant_id = ?',
      [req.user.tenant_id]
    );
    
    if (settings.length === 0) {
      // Return default settings if none exist
      return res.json({
        status: 'success',
        data: {
          defaultCurrency: 'USD',
          allowPartialPayments: true,
          allowTips: true,
          defaultTipPercentage: 15.0,
          receiptSettings: {
            header: 'Thank you for your purchase!',
            footer: 'Please visit us again!'
          }
        }
      });
    }
    
    const setting = settings[0];
    
    res.json({
      status: 'success',
      data: {
        defaultCurrency: setting.default_currency || 'USD',
        allowPartialPayments: setting.allow_partial_payments !== 0,
        allowTips: setting.allow_tips !== 0,
        defaultTipPercentage: parseFloat(setting.default_tip_percentage || '15.0'),
        receiptSettings: {
          header: setting.receipt_header || 'Thank you for your purchase!',
          footer: setting.receipt_footer || 'Please visit us again!'
        },
        updatedAt: setting.updated_at ? setting.updated_at.toISOString() : null
      }
    });
    
  } catch (error) {
    console.error('Error fetching payment settings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch payment settings'
    });
  }
};

/**
 * Update payment settings for the current tenant
 */
const updatePaymentSettings = async (req, res) => {
  const { 
    defaultCurrency = 'USD', 
    allowPartialPayments = true, 
    allowTips = true, 
    defaultTipPercentage = 15.0,
    receiptSettings = {}
  } = req.body;
  
  try {
    // Start a transaction
    await db.beginTransaction();
    
    await withTransaction(async (trx) => {
      // Check if settings already exist
      const [existing] = await trx.query(
        'SELECT id FROM tenant_payment_settings WHERE tenant_id = ?',
        [req.user.tenant_id]
      );
      
      if (existing.length > 0) {
        // Update existing settings
        await trx.query(
          `UPDATE tenant_payment_settings 
           SET default_currency = ?, 
               allow_partial_payments = ?, 
               allow_tips = ?, 
               default_tip_percentage = ?,
               receipt_header = ?,
               receipt_footer = ?,
               updated_at = NOW()
           WHERE tenant_id = ?`,
          [
            defaultCurrency,
            allowPartialPayments ? 1 : 0,
            allowTips ? 1 : 0,
            defaultTipPercentage,
            receiptSettings.header || '',
            receiptSettings.footer || '',
            req.user.tenant_id
          ]
        );
      } else {
        // Insert new settings
        await trx.query(
          `INSERT INTO tenant_payment_settings 
           (id, tenant_id, default_currency, allow_partial_payments, 
            allow_tips, default_tip_percentage, receipt_header, receipt_footer)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            req.user.tenant_id,
            defaultCurrency,
            allowPartialPayments ? 1 : 0,
            allowTips ? 1 : 0,
            defaultTipPercentage,
            receiptSettings.header || '',
            receiptSettings.footer || ''
          ]
        );
      }
    });
    
    // Commit the transaction
    await db.commit();
    
    // Return the updated settings
    const [setting] = await query(
      'SELECT * FROM tenant_payment_settings WHERE tenant_id = ?',
      [req.user.tenant_id]
    );
    
    res.json({
      status: 'success',
      data: {
        defaultCurrency: setting.default_currency || 'USD',
        allowPartialPayments: setting.allow_partial_payments !== 0,
        allowTips: setting.allow_tips !== 0,
        defaultTipPercentage: parseFloat(setting.default_tip_percentage || '15.0'),
        receiptSettings: {
          header: setting.receipt_header || 'Thank you for your purchase!',
          footer: setting.receipt_footer || 'Please visit us again!'
        },
        updatedAt: setting.updated_at ? setting.updated_at.toISOString() : new Date().toISOString()
      }
    });
    
  } catch (error) {
    await db.rollback();
    console.error('Error updating payment settings:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to update payment settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Ensure default payment methods exist for a tenant
 */
const ensureDefaultPaymentMethods = async (tenantId) => {
  try {
    console.log('[ENSURE DEFAULTS] Creating default payment methods for tenant:', tenantId);
    
    // Use consistent UUIDs for default payment methods to avoid UUID mismatch issues
    const defaultMethods = [
      {
        id: 'e9ca7524-35f4-11f0-8297-525400148990', // Fixed UUID for Cash
        name: 'Cash',
        code: 'cash',
        icon: 'cash',
        sortOrder: 1,
        requiresTerminal: false
      },
      {
        id: 'e9ca7670-35f4-11f0-8297-525400148990', // Fixed UUID for Card
        name: 'Card',
        code: 'card',
        icon: 'credit-card',
        sortOrder: 2,
        requiresTerminal: true
      },
      {
        id: 'e9ca76b3-35f4-11f0-8297-525400148990', // Fixed UUID for Phone
        name: 'Phone',
        code: 'phone',
        icon: 'phone',
        sortOrder: 3,
        requiresTerminal: true
      },
      {
        id: 'e9ca75b4-35f4-11f0-8297-525400148990', // Fixed UUID for Charge
        name: 'Charge',
        code: 'on_account',
        icon: 'user',
        sortOrder: 4,
        requiresTerminal: false
      },
      {
        id: '00000000-0000-0000-0000-000000000000', // Fixed UUID for None
        name: 'No Payment Required',
        code: 'none',
        icon: 'check-circle',
        sortOrder: 99,
        requiresTerminal: false
      }
    ];

    // Insert default payment methods with fixed UUIDs
    for (const method of defaultMethods) {
      // Use INSERT IGNORE to avoid duplicates
      await query(
        `INSERT IGNORE INTO payment_methods 
         (id, tenant_id, name, code, is_active, requires_terminal, icon, sort_order, created_at, updated_at) 
         VALUES (?, ?, ?, ?, 1, ?, ?, ?, NOW(), NOW())`,
        [method.id, tenantId, method.name, method.code, method.requiresTerminal ? 1 : 0, method.icon, method.sortOrder]
      );
      console.log(`[ENSURE DEFAULTS] Created: ${method.name} (${method.code}) with UUID: ${method.id}`);
    }
    
    console.log('[ENSURE DEFAULTS] Successfully created', defaultMethods.length, 'default payment methods with fixed UUIDs');
  } catch (error) {
    console.error('[ENSURE DEFAULTS] Error creating default payment methods:', error);
    throw error;
  }
};

module.exports = {
  getPaymentMethods,
  processPayment,
  getTransaction,
  refundTransaction,
  getPaymentSettings,
  updatePaymentSettings
};
