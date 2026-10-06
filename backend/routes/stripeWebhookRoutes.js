/**
 * Stripe Webhook Routes
 *
 * IMPORTANT: this router must be mounted BEFORE the global express.json()
 * body parser hits it, and must be given the RAW request body — Stripe
 * signature verification (stripe.webhooks.constructEvent) requires the exact
 * unparsed bytes, not a re-serialized JS object. See server.js for where
 * this is mounted with express.raw({ type: 'application/json' }).
 *
 * This route is intentionally NOT behind authenticate/requireTenantId —
 * Stripe calls it directly, unauthenticated. It is verified only by the
 * Stripe-Signature header + STRIPE_WEBHOOK_SECRET.
 */
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const stripeService = require('../services/stripeService');
const subscriptionService = require('../services/subscriptionService');

router.post('/stripe', async (req, res) => {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripeService.constructWebhookEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Idempotency guard — Stripe may retry the same event multiple times.
  // Only a genuinely 'processed' prior row blocks reprocessing; a 'failed'
  // row is allowed to be retried (Stripe will keep resending on 5xx).
  const existing = await db.queryOne('SELECT * FROM stripe_webhook_events WHERE stripe_event_id = ?', [event.id]).catch(() => null);
  if (existing && existing.status === 'processed') {
    console.warn(`Duplicate Stripe webhook event ${event.id} (${event.type}) — already processed, skipping`);
    return res.json({ received: true, duplicate: true });
  }

  let rowId = existing ? existing.id : uuidv4();
  if (existing) {
    await db.query('UPDATE stripe_webhook_events SET status = ?, error_message = NULL WHERE id = ?', ['processing', rowId]);
  } else {
    await db.query(
      'INSERT INTO stripe_webhook_events (id, stripe_event_id, event_type, status) VALUES (?, ?, ?, ?)',
      [rowId, event.id, event.type, 'processing']
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await subscriptionService.activateFromCheckoutSession(event.data.object);
        break;
      case 'customer.subscription.updated':
        await subscriptionService.syncFromStripeSubscription(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await subscriptionService.cancelByStripeSubscriptionId(event.data.object.id);
        break;
      case 'invoice.payment_succeeded':
        await subscriptionService.handlePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await subscriptionService.handlePaymentFailed(event.data.object);
        break;
      default:
        // Unhandled event types are fine — just acknowledge receipt.
        break;
    }

    await db.query('UPDATE stripe_webhook_events SET status = ? WHERE id = ?', ['processed', rowId]);
    res.json({ received: true });
  } catch (error) {
    console.error(`Error processing Stripe webhook event ${event.id} (${event.type}):`, error);
    await db.query('UPDATE stripe_webhook_events SET status = ?, error_message = ? WHERE id = ?', ['failed', String(error.message || error), rowId]);
    // Return 500 so Stripe retries — but the idempotency row prevents double-processing.
    res.status(500).json({ received: false, error: 'Internal error processing webhook' });
  }
});

module.exports = router;
