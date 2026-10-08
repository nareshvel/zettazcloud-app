/**
 * Subscription Routes
 * Handles API endpoints for subscription plans, tenant subscription status,
 * and the Stripe-driven billing lifecycle (checkout, portal, plan change,
 * cancel/restore). The Stripe webhook endpoint itself is a SEPARATE router
 * (stripeWebhookRoutes.js) mounted unauthenticated with raw-body parsing —
 * see server.js.
 *
 * NOTE: this file previously called several subscriptionService methods that
 * did not exist (getAllPlans, createSubscription, updateSubscription,
 * deletePlan, checkResourceLimit) and referenced an undefined `PERMISSIONS`
 * global — both were broken/never-run code. Rewritten to call only the real,
 * current subscriptionService exports and the real requirePermission(...)
 * pattern used elsewhere in this codebase (see customer.routes.js).
 */
const express = require('express');
const router = express.Router();
const subscriptionService = require('../services/subscriptionService');
const { authenticate, requireTenantId } = require('../middleware/unifiedAuthMiddleware');
const { requirePermission } = require('../middleware/rbacPermissionMiddleware');

// ---------------------------------------------------------------------------
// Plans (system-admin CRUD + authenticated read)
// ---------------------------------------------------------------------------

/**
 * @route GET /api/subscriptions/plans
 * @desc List active subscription plans (used by the Billing settings page)
 * @access Private - any authenticated user
 */
router.get('/plans', authenticate, async (req, res) => {
  try {
    const plans = await subscriptionService.getPlans({ activeOnly: true });
    res.json({ status: 'success', data: plans });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch subscription plans' });
  }
});

/**
 * @route GET /api/subscriptions/plans/:id
 * @access Private
 */
router.get('/plans/:id', authenticate, async (req, res) => {
  try {
    const plan = await subscriptionService.getPlanById(req.params.id);
    if (!plan) {
      return res.status(404).json({ status: 'error', message: 'Plan not found' });
    }
    res.json({ status: 'success', data: plan });
  } catch (error) {
    console.error('Error fetching plan:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch plan' });
  }
});

/**
 * @route POST /api/subscriptions/plans
 * @access Private - system.plans.create
 */
router.post('/plans', authenticate, requirePermission('plans.create'), async (req, res) => {
  try {
    const plan = await subscriptionService.createPlan(req.body);
    res.status(201).json({ status: 'success', data: plan });
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({ status: 'error', message: 'Failed to create plan' });
  }
});

/**
 * @route PUT /api/subscriptions/plans/:id
 * @access Private - system.plans.edit
 */
router.put('/plans/:id', authenticate, requirePermission('plans.edit'), async (req, res) => {
  try {
    const plan = await subscriptionService.updatePlan(req.params.id, req.body);
    res.json({ status: 'success', data: plan });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({ status: 'error', message: 'Failed to update plan' });
  }
});

// ---------------------------------------------------------------------------
// Tenant subscription status
// ---------------------------------------------------------------------------

/**
 * @route GET /api/subscriptions/status
 * @desc Current tenant's active subscription + plan details. Always
 *       reachable regardless of subscription state (excluded from the
 *       requireActiveSubscription gate in server.js) so a tenant can see why
 *       they're blocked and fix it.
 * @access Private - tenant.subscription.view
 */
router.get('/status', authenticate, requireTenantId, requirePermission('tenant.subscription.view'), async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];
    const subscription = await subscriptionService.getActiveSubscriptionForTenant(tenantId);
    if (!subscription) {
      return res.status(404).json({ status: 'error', message: 'No subscription found for your tenant' });
    }
    res.json({ status: 'success', data: subscription });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch subscription status' });
  }
});

// ---------------------------------------------------------------------------
// Stripe checkout / portal / plan lifecycle
// ---------------------------------------------------------------------------

/**
 * @route POST /api/subscriptions/checkout
 * @desc Create a Stripe Checkout Session for the tenant to add a payment
 *       method / subscribe to a paid plan. Trial subscriptions are DB-only
 *       until this is called — see CLAUDE.md-equivalent doc for this module.
 * @access Private - tenant.subscription.view (billing is reachable to any
 *         subscription-view user, gating on this route would create a
 *         deadlock for suspended tenants trying to fix payment)
 */
router.post('/checkout', authenticate, requireTenantId, requirePermission('tenant.subscription.view'), async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];
    const { planId, billingCycle } = req.body;
    if (!planId) {
      return res.status(400).json({ status: 'error', message: 'planId is required' });
    }
    const url = await subscriptionService.createCheckoutSession(
      tenantId,
      planId,
      billingCycle === 'yearly' ? 'yearly' : 'monthly',
      req.user?.id || req.user?.userId
    );
    res.json({ status: 'success', data: { url } });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(400).json({ status: 'error', message: error.message || 'Failed to create checkout session' });
  }
});

/**
 * @route POST /api/subscriptions/portal
 * @desc Create a Stripe Billing Portal session (manage payment method, view
 *       invoices, cancel) — redirect target for "Manage billing".
 * @access Private
 */
router.post('/portal', authenticate, requireTenantId, requirePermission('tenant.subscription.view'), async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const returnUrl = req.body.returnUrl || `${frontendUrl}/settings/billing`;
    const url = await subscriptionService.createBillingPortalSession(tenantId, returnUrl);
    res.json({ status: 'success', data: { url } });
  } catch (error) {
    console.error('Error creating billing portal session:', error);
    res.status(400).json({ status: 'error', message: error.message || 'Failed to create billing portal session' });
  }
});

/**
 * @route POST /api/subscriptions/change-plan
 * @access Private
 */
router.post('/change-plan', authenticate, requireTenantId, requirePermission('tenant.subscription.view'), async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];
    const { planId, billingCycle } = req.body;
    if (!planId) {
      return res.status(400).json({ status: 'error', message: 'planId is required' });
    }
    const subscription = await subscriptionService.changePlan(tenantId, planId, billingCycle);
    res.json({ status: 'success', data: subscription });
  } catch (error) {
    console.error('Error changing plan:', error);
    res.status(400).json({ status: 'error', message: error.message || 'Failed to change plan' });
  }
});

/**
 * @route POST /api/subscriptions/cancel
 * @access Private
 */
router.post('/cancel', authenticate, requireTenantId, requirePermission('tenant.subscription.view'), async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];
    const subscription = await subscriptionService.cancelSubscription(tenantId);
    res.json({ status: 'success', data: subscription });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(400).json({ status: 'error', message: error.message || 'Failed to cancel subscription' });
  }
});

/**
 * @route POST /api/subscriptions/restore
 * @access Private
 */
router.post('/restore', authenticate, requireTenantId, requirePermission('tenant.subscription.view'), async (req, res) => {
  try {
    const tenantId = req.tenantId || req.headers['x-tenant-id'];
    const subscription = await subscriptionService.restoreSubscription(tenantId);
    res.json({ status: 'success', data: subscription });
  } catch (error) {
    console.error('Error restoring subscription:', error);
    res.status(400).json({ status: 'error', message: error.message || 'Failed to restore subscription' });
  }
});

module.exports = router;
