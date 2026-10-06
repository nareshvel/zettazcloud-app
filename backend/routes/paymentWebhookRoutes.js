/**
 * Payment Webhook Routes
 * Handles webhooks from payment gateways (Stripe, PayPal, etc.)
 */

const express = require('express');
const router = express.Router();
const paymentGatewayService = require('../services/paymentGatewayService');

/**
 * POST /api/webhooks/payment/stripe/:gatewayId
 * Handle Stripe webhooks
 */
router.post('/stripe/:gatewayId', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const { gatewayId } = req.params;
    const signature = req.get('stripe-signature');
    const webhookData = req.body;
    
    console.log(`[WEBHOOK] Received Stripe webhook for gateway: ${gatewayId}`);
    
    const result = await paymentGatewayService.handleWebhook('stripe', gatewayId, webhookData, signature);
    
    if (result.success) {
      res.status(200).json({ received: true });
    } else {
      console.error(`[WEBHOOK] Stripe webhook failed: ${result.message}`);
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('[WEBHOOK] Error processing Stripe webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/webhooks/payment/paypal/:gatewayId
 * Handle PayPal webhooks
 */
router.post('/paypal/:gatewayId', express.json(), async (req, res) => {
  try {
    const { gatewayId } = req.params;
    const signature = req.get('paypal-transmission-sig');
    const webhookData = req.body;
    
    console.log(`[WEBHOOK] Received PayPal webhook for gateway: ${gatewayId}`);
    
    const result = await paymentGatewayService.handleWebhook('paypal', gatewayId, webhookData, signature);
    
    if (result.success) {
      res.status(200).json({ received: true });
    } else {
      console.error(`[WEBHOOK] PayPal webhook failed: ${result.message}`);
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('[WEBHOOK] Error processing PayPal webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/webhooks/payment/razorpay/:gatewayId
 * Handle Razorpay webhooks
 */
router.post('/razorpay/:gatewayId', express.json(), async (req, res) => {
  try {
    const { gatewayId } = req.params;
    const signature = req.get('x-razorpay-signature');
    const webhookData = req.body;
    
    console.log(`[WEBHOOK] Received Razorpay webhook for gateway: ${gatewayId}`);
    
    const result = await paymentGatewayService.handleWebhook('razorpay', gatewayId, webhookData, signature);
    
    if (result.success) {
      res.status(200).json({ received: true });
    } else {
      console.error(`[WEBHOOK] Razorpay webhook failed: ${result.message}`);
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('[WEBHOOK] Error processing Razorpay webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/webhooks/payment/square/:gatewayId
 * Handle Square webhooks
 */
router.post('/square/:gatewayId', express.json(), async (req, res) => {
  try {
    const { gatewayId } = req.params;
    const signature = req.get('x-square-signature');
    const webhookData = req.body;
    
    console.log(`[WEBHOOK] Received Square webhook for gateway: ${gatewayId}`);
    
    const result = await paymentGatewayService.handleWebhook('square', gatewayId, webhookData, signature);
    
    if (result.success) {
      res.status(200).json({ received: true });
    } else {
      console.error(`[WEBHOOK] Square webhook failed: ${result.message}`);
      res.status(400).json({ error: result.message });
    }
  } catch (error) {
    console.error('[WEBHOOK] Error processing Square webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/webhooks/payment/health
 * Health check for webhook endpoints
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Payment webhook endpoints are healthy',
    timestamp: new Date().toISOString(),
    supportedProviders: ['stripe', 'paypal', 'razorpay', 'square']
  });
});

module.exports = router;
