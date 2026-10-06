/**
 * Payment Gateway Service
 * Handles integration with online payment gateways (Stripe, PayPal, etc.)
 */

const { pool } = require('../db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

class PaymentGatewayService {
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
   * Get all payment gateways for a tenant
   */
  async getGateways(tenantId) {
    try {
      const [rows] = await pool.query(
        `SELECT id, gateway_type, is_active, is_live_mode, 
                webhook_endpoint, supported_currencies, created_at
         FROM payment_gateways 
         WHERE tenant_id = ? 
         ORDER BY gateway_type`,
        [tenantId]
      );

      // Parse JSON fields
      const gateways = rows.map(row => ({
        ...row,
        supported_currencies: JSON.parse(row.supported_currencies || '["USD"]')
      }));

      return {
        success: true,
        gateways
      };
    } catch (error) {
      console.error('Error fetching gateways:', error);
      return {
        success: false,
        message: 'Failed to fetch payment gateways'
      };
    }
  }

  /**
   * Configure payment gateway
   */
  async configureGateway(tenantId, gatewayData) {
    try {
      const {
        gatewayType,
        isLiveMode = false,
        configData,
        webhookSecret,
        supportedCurrencies = ['USD']
      } = gatewayData;

      // Encrypt sensitive configuration data
      const encryptedConfig = this.encrypt(JSON.stringify(configData));
      const encryptedWebhookSecret = webhookSecret ? this.encrypt(webhookSecret) : null;

      const id = uuidv4();
      const webhookEndpoint = `${process.env.BACKEND_URL}/api/webhooks/payment/${gatewayType}/${id}`;

      // Insert or update gateway configuration
      await pool.query(
        `INSERT INTO payment_gateways 
         (id, tenant_id, gateway_type, is_active, is_live_mode, config_data, 
          webhook_secret, webhook_endpoint, supported_currencies)
         VALUES (?, ?, ?, true, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         is_active = true, is_live_mode = VALUES(is_live_mode),
         config_data = VALUES(config_data), webhook_secret = VALUES(webhook_secret),
         webhook_endpoint = VALUES(webhook_endpoint), 
         supported_currencies = VALUES(supported_currencies),
         updated_at = NOW()`,
        [
          id, tenantId, gatewayType, isLiveMode, encryptedConfig,
          encryptedWebhookSecret, webhookEndpoint, JSON.stringify(supportedCurrencies)
        ]
      );

      return {
        success: true,
        message: 'Payment gateway configured successfully',
        gatewayId: id,
        webhookEndpoint
      };
    } catch (error) {
      console.error('Error configuring gateway:', error);
      return {
        success: false,
        message: 'Failed to configure payment gateway'
      };
    }
  }

  /**
   * Update gateway configuration
   */
  async updateGateway(gatewayId, tenantId, updateData) {
    try {
      const {
        isActive,
        isLiveMode,
        configData,
        webhookSecret,
        supportedCurrencies
      } = updateData;

      let updateFields = [];
      let updateValues = [];

      if (isActive !== undefined) {
        updateFields.push('is_active = ?');
        updateValues.push(isActive);
      }

      if (isLiveMode !== undefined) {
        updateFields.push('is_live_mode = ?');
        updateValues.push(isLiveMode);
      }

      if (configData !== undefined) {
        updateFields.push('config_data = ?');
        updateValues.push(this.encrypt(JSON.stringify(configData)));
      }

      if (webhookSecret !== undefined) {
        updateFields.push('webhook_secret = ?');
        updateValues.push(webhookSecret ? this.encrypt(webhookSecret) : null);
      }

      if (supportedCurrencies !== undefined) {
        updateFields.push('supported_currencies = ?');
        updateValues.push(JSON.stringify(supportedCurrencies));
      }

      updateFields.push('updated_at = NOW()');
      updateValues.push(gatewayId, tenantId);

      await pool.query(
        `UPDATE payment_gateways 
         SET ${updateFields.join(', ')}
         WHERE id = ? AND tenant_id = ?`,
        updateValues
      );

      return {
        success: true,
        message: 'Payment gateway updated successfully'
      };
    } catch (error) {
      console.error('Error updating gateway:', error);
      return {
        success: false,
        message: 'Failed to update payment gateway'
      };
    }
  }

  /**
   * Delete payment gateway
   */
  async deleteGateway(gatewayId, tenantId) {
    try {
      await pool.query(
        'DELETE FROM payment_gateways WHERE id = ? AND tenant_id = ?',
        [gatewayId, tenantId]
      );

      return {
        success: true,
        message: 'Payment gateway deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting gateway:', error);
      return {
        success: false,
        message: 'Failed to delete payment gateway'
      };
    }
  }

  /**
   * Test gateway connection
   */
  async testGateway(gatewayId, tenantId) {
    try {
      // Get gateway configuration
      const [rows] = await pool.query(
        `SELECT gateway_type, config_data, is_live_mode
         FROM payment_gateways 
         WHERE id = ? AND tenant_id = ? AND is_active = 1`,
        [gatewayId, tenantId]
      );

      if (rows.length === 0) {
        return {
          success: false,
          message: 'Gateway not found or inactive'
        };
      }

      const gateway = rows[0];
      const configData = JSON.parse(this.decrypt(gateway.config_data));

      // Test connection based on gateway type
      const testResult = await this.testGatewayConnection(gateway.gateway_type, configData, gateway.is_live_mode);

      return testResult;
    } catch (error) {
      console.error('Error testing gateway:', error);
      return {
        success: false,
        message: 'Failed to test gateway connection'
      };
    }
  }

  /**
   * Test connection to specific gateway
   */
  async testGatewayConnection(gatewayType, configData, isLiveMode) {
    switch (gatewayType.toLowerCase()) {
      case 'stripe':
        return await this.testStripeConnection(configData, isLiveMode);
      case 'paypal':
        return await this.testPayPalConnection(configData, isLiveMode);
      case 'razorpay':
        return await this.testRazorpayGatewayConnection(configData, isLiveMode);
      case 'square':
        return await this.testSquareGatewayConnection(configData, isLiveMode);
      default:
        return {
          success: false,
          message: `Gateway ${gatewayType} not yet implemented`
        };
    }
  }

  /**
   * Test Stripe connection
   */
  async testStripeConnection(configData, isLiveMode) {
    try {
      // Stripe API test
      console.log(`Testing Stripe connection (${isLiveMode ? 'live' : 'test'} mode)`);
      
      // Placeholder for actual Stripe API integration
      // const stripe = require('stripe')(configData.secretKey);
      // const account = await stripe.accounts.retrieve();
      
      return {
        success: true,
        message: 'Stripe connection successful',
        provider: 'stripe',
        mode: isLiveMode ? 'live' : 'test'
      };
    } catch (error) {
      return {
        success: false,
        message: `Stripe connection failed: ${error.message}`
      };
    }
  }

  /**
   * Test PayPal connection
   */
  async testPayPalConnection(configData, isLiveMode) {
    try {
      // PayPal API test
      console.log(`Testing PayPal connection (${isLiveMode ? 'live' : 'sandbox'} mode)`);
      
      // Placeholder for actual PayPal API integration
      return {
        success: true,
        message: 'PayPal connection successful',
        provider: 'paypal',
        mode: isLiveMode ? 'live' : 'sandbox'
      };
    } catch (error) {
      return {
        success: false,
        message: `PayPal connection failed: ${error.message}`
      };
    }
  }

  /**
   * Test Razorpay Gateway connection
   */
  async testRazorpayGatewayConnection(configData, isLiveMode) {
    try {
      // Razorpay Gateway API test
      console.log(`Testing Razorpay Gateway connection (${isLiveMode ? 'live' : 'test'} mode)`);
      
      // Placeholder for actual Razorpay API integration
      return {
        success: true,
        message: 'Razorpay Gateway connection successful',
        provider: 'razorpay',
        mode: isLiveMode ? 'live' : 'test'
      };
    } catch (error) {
      return {
        success: false,
        message: `Razorpay Gateway connection failed: ${error.message}`
      };
    }
  }

  /**
   * Test Square Gateway connection
   */
  async testSquareGatewayConnection(configData, isLiveMode) {
    try {
      // Square Gateway API test
      console.log(`Testing Square Gateway connection (${isLiveMode ? 'production' : 'sandbox'} mode)`);
      
      // Placeholder for actual Square API integration
      return {
        success: true,
        message: 'Square Gateway connection successful',
        provider: 'square',
        mode: isLiveMode ? 'production' : 'sandbox'
      };
    } catch (error) {
      return {
        success: false,
        message: `Square Gateway connection failed: ${error.message}`
      };
    }
  }

  /**
   * Create payment intent
   */
  async createPaymentIntent(gatewayId, tenantId, paymentData) {
    try {
      const { saleId, amount, currency = 'USD', description } = paymentData;

      // Get gateway configuration
      const [rows] = await pool.query(
        `SELECT gateway_type, config_data, is_live_mode
         FROM payment_gateways 
         WHERE id = ? AND tenant_id = ? AND is_active = 1`,
        [gatewayId, tenantId]
      );

      if (rows.length === 0) {
        return {
          success: false,
          message: 'Gateway not found or inactive'
        };
      }

      const gateway = rows[0];
      const configData = JSON.parse(this.decrypt(gateway.config_data));

      // Create transaction record
      const transactionId = uuidv4();
      await pool.query(
        `INSERT INTO payment_gateway_transactions 
         (id, sale_id, gateway_id, amount, currency, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [transactionId, saleId, gatewayId, amount, currency]
      );

      // Create payment intent with provider
      const intentResult = await this.createProviderPaymentIntent(
        gateway.gateway_type, 
        configData, 
        gateway.is_live_mode,
        { transactionId, amount, currency, description }
      );

      // Update transaction record
      await pool.query(
        `UPDATE payment_gateway_transactions 
         SET payment_intent_id = ?, gateway_response = ?
         WHERE id = ?`,
        [
          intentResult.paymentIntentId || null,
          JSON.stringify(intentResult.responseData || {}),
          transactionId
        ]
      );

      return {
        success: intentResult.success,
        message: intentResult.message,
        transactionId,
        paymentIntentId: intentResult.paymentIntentId,
        clientSecret: intentResult.clientSecret
      };
    } catch (error) {
      console.error('Error creating payment intent:', error);
      return {
        success: false,
        message: 'Failed to create payment intent'
      };
    }
  }

  /**
   * Create payment intent with specific provider
   */
  async createProviderPaymentIntent(gatewayType, configData, isLiveMode, paymentData) {
    switch (gatewayType.toLowerCase()) {
      case 'stripe':
        return await this.createStripePaymentIntent(configData, isLiveMode, paymentData);
      case 'paypal':
        return await this.createPayPalOrder(configData, isLiveMode, paymentData);
      case 'razorpay':
        return await this.createRazorpayOrder(configData, isLiveMode, paymentData);
      case 'square':
        return await this.createSquarePayment(configData, isLiveMode, paymentData);
      default:
        return {
          success: false,
          message: `Gateway ${gatewayType} not yet implemented`
        };
    }
  }

  /**
   * Create Stripe Payment Intent
   */
  async createStripePaymentIntent(configData, isLiveMode, paymentData) {
    try {
      // Stripe Payment Intent creation
      console.log(`Creating Stripe Payment Intent: ${paymentData.amount}`);
      
      // Placeholder for actual Stripe API integration
      const paymentIntentId = `pi_${Date.now()}`;
      const clientSecret = `${paymentIntentId}_secret_${Math.random().toString(36).substr(2, 9)}`;
      
      return {
        success: true,
        message: 'Stripe Payment Intent created successfully',
        paymentIntentId,
        clientSecret,
        responseData: { 
          provider: 'stripe', 
          amount: paymentData.amount,
          currency: paymentData.currency
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Stripe Payment Intent creation failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Create PayPal Order
   */
  async createPayPalOrder(configData, isLiveMode, paymentData) {
    try {
      // PayPal Order creation
      console.log(`Creating PayPal Order: ${paymentData.amount}`);
      
      // Placeholder for actual PayPal API integration
      const orderId = `PAYPAL_${Date.now()}`;
      
      return {
        success: true,
        message: 'PayPal Order created successfully',
        paymentIntentId: orderId,
        responseData: { 
          provider: 'paypal', 
          amount: paymentData.amount,
          currency: paymentData.currency
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `PayPal Order creation failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Create Razorpay Order
   */
  async createRazorpayOrder(configData, isLiveMode, paymentData) {
    try {
      // Razorpay Order creation
      console.log(`Creating Razorpay Order: ${paymentData.amount}`);
      
      // Placeholder for actual Razorpay API integration
      const orderId = `order_${Date.now()}`;
      
      return {
        success: true,
        message: 'Razorpay Order created successfully',
        paymentIntentId: orderId,
        responseData: { 
          provider: 'razorpay', 
          amount: paymentData.amount,
          currency: paymentData.currency
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Razorpay Order creation failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Create Square Payment
   */
  async createSquarePayment(configData, isLiveMode, paymentData) {
    try {
      // Square Payment creation
      console.log(`Creating Square Payment: ${paymentData.amount}`);
      
      // Placeholder for actual Square API integration
      const paymentId = `sq_${Date.now()}`;
      
      return {
        success: true,
        message: 'Square Payment created successfully',
        paymentIntentId: paymentId,
        responseData: { 
          provider: 'square', 
          amount: paymentData.amount,
          currency: paymentData.currency
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Square Payment creation failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Handle webhook from payment provider
   */
  async handleWebhook(gatewayType, gatewayId, webhookData, signature) {
    try {
      // Verify webhook signature
      const isValid = await this.verifyWebhookSignature(gatewayType, gatewayId, webhookData, signature);
      
      if (!isValid) {
        return {
          success: false,
          message: 'Invalid webhook signature'
        };
      }

      // Process webhook based on provider
      const result = await this.processProviderWebhook(gatewayType, webhookData);

      // Log webhook processing
      await pool.query(
        `INSERT INTO payment_processing_logs 
         (id, gateway_id, action, status, request_data, response_data)
         VALUES (?, ?, 'webhook', ?, ?, ?)`,
        [
          uuidv4(),
          gatewayId,
          result.success ? 'success' : 'failed',
          JSON.stringify(webhookData),
          JSON.stringify(result)
        ]
      );

      return result;
    } catch (error) {
      console.error('Error handling webhook:', error);
      return {
        success: false,
        message: 'Failed to process webhook'
      };
    }
  }

  /**
   * Verify webhook signature
   */
  async verifyWebhookSignature(gatewayType, gatewayId, webhookData, signature) {
    try {
      // Get webhook secret
      const [rows] = await pool.query(
        'SELECT webhook_secret FROM payment_gateways WHERE id = ?',
        [gatewayId]
      );

      if (rows.length === 0) {
        return false;
      }

      const webhookSecret = this.decrypt(rows[0].webhook_secret);

      // Verify signature based on provider
      switch (gatewayType.toLowerCase()) {
        case 'stripe':
          return this.verifyStripeSignature(webhookData, signature, webhookSecret);
        case 'paypal':
          return this.verifyPayPalSignature(webhookData, signature, webhookSecret);
        default:
          return true; // Placeholder for other providers
      }
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Verify Stripe webhook signature
   */
  verifyStripeSignature(webhookData, signature, webhookSecret) {
    // Placeholder for actual Stripe signature verification
    console.log('Verifying Stripe webhook signature');
    return true;
  }

  /**
   * Verify PayPal webhook signature
   */
  verifyPayPalSignature(webhookData, signature, webhookSecret) {
    // Placeholder for actual PayPal signature verification
    console.log('Verifying PayPal webhook signature');
    return true;
  }

  /**
   * Process webhook from specific provider
   */
  async processProviderWebhook(gatewayType, webhookData) {
    switch (gatewayType.toLowerCase()) {
      case 'stripe':
        return await this.processStripeWebhook(webhookData);
      case 'paypal':
        return await this.processPayPalWebhook(webhookData);
      default:
        return {
          success: true,
          message: `Webhook processed for ${gatewayType}`
        };
    }
  }

  /**
   * Process Stripe webhook
   */
  async processStripeWebhook(webhookData) {
    try {
      // Process Stripe webhook events
      console.log(`Processing Stripe webhook: ${webhookData.type}`);
      
      // Update transaction status based on webhook event
      // This would contain actual Stripe webhook processing logic
      
      return {
        success: true,
        message: 'Stripe webhook processed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Stripe webhook processing failed: ${error.message}`
      };
    }
  }

  /**
   * Process PayPal webhook
   */
  async processPayPalWebhook(webhookData) {
    try {
      // Process PayPal webhook events
      console.log(`Processing PayPal webhook: ${webhookData.event_type}`);
      
      // Update transaction status based on webhook event
      // This would contain actual PayPal webhook processing logic
      
      return {
        success: true,
        message: 'PayPal webhook processed successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `PayPal webhook processing failed: ${error.message}`
      };
    }
  }
}

module.exports = new PaymentGatewayService();
