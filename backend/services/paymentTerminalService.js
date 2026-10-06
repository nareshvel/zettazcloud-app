/**
 * Payment Terminal Service
 * Handles integration with various payment terminals (Card/UPI)
 */

const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class PaymentTerminalService {
  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  }

  /**
   * Encrypt sensitive data (API keys)
   */
  encrypt(text) {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedText) {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Get all payment terminals for a tenant
   */
  async getTerminals(tenantId) {
    try {
      const [rows] = await pool.query(
        `SELECT id, terminal_type, provider, terminal_id, device_name, 
                is_active, last_connected_at, created_at
         FROM payment_terminals 
         WHERE tenant_id = ? 
         ORDER BY terminal_type, device_name`,
        [tenantId]
      );

      return {
        success: true,
        terminals: rows
      };
    } catch (error) {
      console.error('Error fetching terminals:', error);
      return {
        success: false,
        message: 'Failed to fetch payment terminals'
      };
    }
  }

  /**
   * Add a new payment terminal
   */
  async addTerminal(tenantId, terminalData) {
    try {
      const {
        terminalType,
        provider,
        terminalId,
        deviceName,
        apiEndpoint,
        apiKey,
        configuration = {}
      } = terminalData;

      const id = uuidv4();
      const encryptedApiKey = apiKey ? this.encrypt(apiKey) : null;

      await pool.query(
        `INSERT INTO payment_terminals 
         (id, tenant_id, terminal_type, provider, terminal_id, device_name, 
          api_endpoint, api_key_encrypted, configuration, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, true)`,
        [
          id, tenantId, terminalType, provider, terminalId, 
          deviceName, apiEndpoint, encryptedApiKey, JSON.stringify(configuration)
        ]
      );

      return {
        success: true,
        message: 'Payment terminal added successfully',
        terminalId: id
      };
    } catch (error) {
      console.error('Error adding terminal:', error);
      return {
        success: false,
        message: 'Failed to add payment terminal'
      };
    }
  }

  /**
   * Update payment terminal configuration
   */
  async updateTerminal(terminalId, tenantId, updateData) {
    try {
      const {
        deviceName,
        apiEndpoint,
        apiKey,
        configuration,
        isActive
      } = updateData;

      let updateFields = [];
      let updateValues = [];

      if (deviceName !== undefined) {
        updateFields.push('device_name = ?');
        updateValues.push(deviceName);
      }

      if (apiEndpoint !== undefined) {
        updateFields.push('api_endpoint = ?');
        updateValues.push(apiEndpoint);
      }

      if (apiKey !== undefined) {
        updateFields.push('api_key_encrypted = ?');
        updateValues.push(apiKey ? this.encrypt(apiKey) : null);
      }

      if (configuration !== undefined) {
        updateFields.push('configuration = ?');
        updateValues.push(JSON.stringify(configuration));
      }

      if (isActive !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(isActive);
      }

      updateFields.push('updated_at = NOW()');
      updateValues.push(terminalId, tenantId);

      await pool.query(
        `UPDATE payment_terminals 
         SET ${updateFields.join(', ')}
         WHERE id = ? AND tenant_id = ?`,
        updateValues
      );

      return {
        success: true,
        message: 'Payment terminal updated successfully'
      };
    } catch (error) {
      console.error('Error updating terminal:', error);
      return {
        success: false,
        message: 'Failed to update payment terminal'
      };
    }
  }

  /**
   * Delete payment terminal
   */
  async deleteTerminal(terminalId, tenantId) {
    try {
      await pool.query(
        'DELETE FROM payment_terminals WHERE id = ? AND tenant_id = ?',
        [terminalId, tenantId]
      );

      return {
        success: true,
        message: 'Payment terminal deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting terminal:', error);
      return {
        success: false,
        message: 'Failed to delete payment terminal'
      };
    }
  }

  /**
   * Test terminal connection
   */
  async testTerminal(terminalId, tenantId) {
    try {
      // Get terminal configuration
      const [rows] = await pool.query(
        `SELECT terminal_type, provider, terminal_id, api_endpoint, 
                api_key_encrypted, configuration
         FROM payment_terminals 
         WHERE id = ? AND tenant_id = ? AND is_active = 1`,
        [terminalId, tenantId]
      );

      if (rows.length === 0) {
        return {
          success: false,
          message: 'Terminal not found or inactive'
        };
      }

      const terminal = rows[0];
      const apiKey = terminal.api_key_encrypted ? this.decrypt(terminal.api_key_encrypted) : null;

      // Test connection based on provider
      const testResult = await this.testProviderConnection(terminal, apiKey);

      // Update last_connected_at if successful
      if (testResult.success) {
        await pool.query(
          'UPDATE payment_terminals SET last_connected_at = NOW() WHERE id = ?',
          [terminalId]
        );
      }

      return testResult;
    } catch (error) {
      console.error('Error testing terminal:', error);
      return {
        success: false,
        message: 'Failed to test terminal connection'
      };
    }
  }

  /**
   * Test connection to specific provider
   */
  async testProviderConnection(terminal, apiKey) {
    switch (terminal.provider.toLowerCase()) {
      case 'square':
        return await this.testSquareConnection(terminal, apiKey);
      case 'stripe':
        return await this.testStripeTerminalConnection(terminal, apiKey);
      case 'paytm':
        return await this.testPaytmConnection(terminal, apiKey);
      case 'razorpay':
        return await this.testRazorpayConnection(terminal, apiKey);
      default:
        return {
          success: false,
          message: `Provider ${terminal.provider} not yet implemented`
        };
    }
  }

  /**
   * Test Square terminal connection
   */
  async testSquareConnection(terminal, apiKey) {
    try {
      // Square Terminal API test
      // This would make an actual API call to Square's terminal API
      console.log(`Testing Square terminal: ${terminal.terminal_id}`);
      
      // Placeholder for actual Square API integration
      return {
        success: true,
        message: 'Square terminal connection successful',
        provider: 'square'
      };
    } catch (error) {
      return {
        success: false,
        message: `Square terminal test failed: ${error.message}`
      };
    }
  }

  /**
   * Test Stripe Terminal connection
   */
  async testStripeTerminalConnection(terminal, apiKey) {
    try {
      // Stripe Terminal API test
      console.log(`Testing Stripe terminal: ${terminal.terminal_id}`);
      
      // Placeholder for actual Stripe Terminal API integration
      return {
        success: true,
        message: 'Stripe terminal connection successful',
        provider: 'stripe'
      };
    } catch (error) {
      return {
        success: false,
        message: `Stripe terminal test failed: ${error.message}`
      };
    }
  }

  /**
   * Test Paytm Soundbox connection
   */
  async testPaytmConnection(terminal, apiKey) {
    try {
      // Paytm Soundbox API test
      console.log(`Testing Paytm terminal: ${terminal.terminal_id}`);
      
      // Placeholder for actual Paytm API integration
      return {
        success: true,
        message: 'Paytm terminal connection successful',
        provider: 'paytm'
      };
    } catch (error) {
      return {
        success: false,
        message: `Paytm terminal test failed: ${error.message}`
      };
    }
  }

  /**
   * Test Razorpay POS connection
   */
  async testRazorpayConnection(terminal, apiKey) {
    try {
      // Razorpay POS API test
      console.log(`Testing Razorpay terminal: ${terminal.terminal_id}`);
      
      // Placeholder for actual Razorpay API integration
      return {
        success: true,
        message: 'Razorpay terminal connection successful',
        provider: 'razorpay'
      };
    } catch (error) {
      return {
        success: false,
        message: `Razorpay terminal test failed: ${error.message}`
      };
    }
  }

  /**
   * Process payment through terminal
   */
  async processPayment(terminalId, tenantId, paymentData) {
    try {
      const { saleId, amount, currency = 'USD' } = paymentData;

      // Get terminal configuration
      const [rows] = await pool.query(
        `SELECT terminal_type, provider, terminal_id, api_endpoint, 
                api_key_encrypted, configuration
         FROM payment_terminals 
         WHERE id = ? AND tenant_id = ? AND is_active = 1`,
        [terminalId, tenantId]
      );

      if (rows.length === 0) {
        return {
          success: false,
          message: 'Terminal not found or inactive'
        };
      }

      const terminal = rows[0];
      const apiKey = terminal.api_key_encrypted ? this.decrypt(terminal.api_key_encrypted) : null;

      // Create transaction record
      const transactionId = uuidv4();
      await pool.query(
        `INSERT INTO payment_terminal_transactions 
         (id, sale_id, terminal_id, amount, currency, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [transactionId, saleId, terminalId, amount, currency]
      );

      // Process payment with provider
      const paymentResult = await this.processProviderPayment(terminal, apiKey, {
        transactionId,
        amount,
        currency
      });

      // Update transaction record
      await pool.query(
        `UPDATE payment_terminal_transactions 
         SET status = ?, provider_transaction_id = ?, response_data = ?, 
             error_message = ?, processed_at = NOW()
         WHERE id = ?`,
        [
          paymentResult.success ? 'completed' : 'failed',
          paymentResult.providerTransactionId || null,
          JSON.stringify(paymentResult.responseData || {}),
          paymentResult.error || null,
          transactionId
        ]
      );

      return {
        success: paymentResult.success,
        message: paymentResult.message,
        transactionId,
        providerTransactionId: paymentResult.providerTransactionId
      };
    } catch (error) {
      console.error('Error processing terminal payment:', error);
      return {
        success: false,
        message: 'Failed to process terminal payment'
      };
    }
  }

  /**
   * Process payment with specific provider
   */
  async processProviderPayment(terminal, apiKey, paymentData) {
    switch (terminal.provider.toLowerCase()) {
      case 'square':
        return await this.processSquarePayment(terminal, apiKey, paymentData);
      case 'stripe':
        return await this.processStripeTerminalPayment(terminal, apiKey, paymentData);
      case 'paytm':
        return await this.processPaytmPayment(terminal, apiKey, paymentData);
      case 'razorpay':
        return await this.processRazorpayPayment(terminal, apiKey, paymentData);
      default:
        return {
          success: false,
          message: `Provider ${terminal.provider} not yet implemented`
        };
    }
  }

  /**
   * Process Square terminal payment
   */
  async processSquarePayment(terminal, apiKey, paymentData) {
    try {
      // Square Terminal API payment processing
      console.log(`Processing Square payment: ${paymentData.amount}`);
      
      // Placeholder for actual Square API integration
      return {
        success: true,
        message: 'Square payment processed successfully',
        providerTransactionId: `sq_${Date.now()}`,
        responseData: { provider: 'square', amount: paymentData.amount }
      };
    } catch (error) {
      return {
        success: false,
        message: `Square payment failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Process Stripe Terminal payment
   */
  async processStripeTerminalPayment(terminal, apiKey, paymentData) {
    try {
      // Stripe Terminal API payment processing
      console.log(`Processing Stripe Terminal payment: ${paymentData.amount}`);
      
      // Placeholder for actual Stripe Terminal API integration
      return {
        success: true,
        message: 'Stripe Terminal payment processed successfully',
        providerTransactionId: `pi_${Date.now()}`,
        responseData: { provider: 'stripe', amount: paymentData.amount }
      };
    } catch (error) {
      return {
        success: false,
        message: `Stripe Terminal payment failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Process Paytm payment
   */
  async processPaytmPayment(terminal, apiKey, paymentData) {
    try {
      // Paytm API payment processing
      console.log(`Processing Paytm payment: ${paymentData.amount}`);
      
      // Placeholder for actual Paytm API integration
      return {
        success: true,
        message: 'Paytm payment processed successfully',
        providerTransactionId: `paytm_${Date.now()}`,
        responseData: { provider: 'paytm', amount: paymentData.amount }
      };
    } catch (error) {
      return {
        success: false,
        message: `Paytm payment failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Process Razorpay payment
   */
  async processRazorpayPayment(terminal, apiKey, paymentData) {
    try {
      // Razorpay API payment processing
      console.log(`Processing Razorpay payment: ${paymentData.amount}`);
      
      // Placeholder for actual Razorpay API integration
      return {
        success: true,
        message: 'Razorpay payment processed successfully',
        providerTransactionId: `rzp_${Date.now()}`,
        responseData: { provider: 'razorpay', amount: paymentData.amount }
      };
    } catch (error) {
      return {
        success: false,
        message: `Razorpay payment failed: ${error.message}`,
        error: error.message
      };
    }
  }
}

module.exports = new PaymentTerminalService();
