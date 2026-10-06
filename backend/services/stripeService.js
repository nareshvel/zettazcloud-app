/**
 * Stripe Service
 * Thin wrapper around the Stripe SDK for Zettaz Cloud's billing module.
 *
 * Unlike most services in this codebase, Stripe calls fail LOUDLY — money is
 * involved, so there is no "graceful degradation" here. Every method throws
 * if STRIPE_SECRET_KEY is unset or the Stripe API call fails.
 *
 * API version: pinned to the stripe npm package's own current default
 * (no explicit apiVersion override) — see docs/17-migration-and-roadmap/
 * 17_Stripe_Billing_Module.md for reasoning (we deliberately did NOT copy
 * Paytime's future-dated '2026-05-27.dahlia' pin).
 */

let stripeClient = null;

/**
 * Lazily initialize and return the Stripe client.
 * @returns {import('stripe').Stripe}
 */
const getClient = () => {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Stripe billing operations cannot proceed without it.'
    );
  }

  const Stripe = require('stripe');
  stripeClient = new Stripe(secretKey);
  return stripeClient;
};

/**
 * Find an existing Stripe customer for this tenant (by metadata.tenantId),
 * falling back to a search by email, or create a new one.
 */
const findOrCreateCustomer = async (tenantId, email, name) => {
  const stripe = getClient();

  if (email) {
    const existing = await stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) {
      return existing.data[0];
    }
  }

  const customer = await stripe.customers.create({
    email: email || undefined,
    name: name || undefined,
    metadata: { tenantId },
  });
  return customer;
};

/**
 * Create a Stripe Checkout Session in subscription mode.
 * metadata carries tenantId/planId/userId so the webhook can read them back
 * on checkout.session.completed (mirrors Paytime's pattern).
 */
const createCheckoutSession = async ({
  customerId,
  priceId,
  tenantId,
  planId,
  userId,
  successUrl,
  cancelUrl,
}) => {
  const stripe = getClient();

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: { tenantId, planId, userId },
    },
    metadata: { tenantId, planId, userId },
  });

  return session;
};

/**
 * Create a Stripe Billing Portal session so the tenant can manage their
 * payment method / view invoices / cancel, without us building custom UI
 * for any of that.
 */
const createBillingPortalSession = async (customerId, returnUrl) => {
  const stripe = getClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session;
};

const retrieveSubscription = async (stripeSubscriptionId) => {
  const stripe = getClient();
  return stripe.subscriptions.retrieve(stripeSubscriptionId, {
    expand: ['items.data.price'],
  });
};

/**
 * Change the price on the subscription's first/only item — used for plan
 * changes (upgrade/downgrade). `prorationBehavior` is Stripe's own enum:
 * 'create_prorations' | 'none' | 'always_invoice'.
 */
const updateSubscriptionItem = async (stripeSubscriptionId, newPriceId, prorationBehavior = 'create_prorations') => {
  const stripe = getClient();
  const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) {
    throw new Error(`Stripe subscription ${stripeSubscriptionId} has no subscription items to update`);
  }

  return stripe.subscriptions.update(stripeSubscriptionId, {
    items: [{ id: itemId, price: newPriceId }],
    proration_behavior: prorationBehavior,
  });
};

const cancelAtPeriodEnd = async (stripeSubscriptionId) => {
  const stripe = getClient();
  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: true,
  });
};

const resumeSubscription = async (stripeSubscriptionId) => {
  const stripe = getClient();
  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: false,
  });
};

/**
 * Verify and parse a raw webhook payload using the Stripe signature header.
 * Must be called with the RAW (unparsed) request body — see stripeWebhookRoutes.js.
 */
const constructWebhookEvent = (rawBody, signature, webhookSecret) => {
  const stripe = getClient();
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set. Cannot verify webhook signature.');
  }
  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
};

module.exports = {
  getClient,
  findOrCreateCustomer,
  createCheckoutSession,
  createBillingPortalSession,
  retrieveSubscription,
  updateSubscriptionItem,
  cancelAtPeriodEnd,
  resumeSubscription,
  constructWebhookEvent,
};
