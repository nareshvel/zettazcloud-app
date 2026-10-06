/**
 * Subscription Service
 * Manages subscription plans, tenant subscriptions, and Stripe-driven
 * billing lifecycle (checkout, webhooks, plan changes, cancel/restore).
 *
 * Architecture: docs/17-migration-and-roadmap/17_Stripe_Billing_Module.md
 */
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const stripeService = require('./stripeService');
const storageUsageService = require('./storageUsageService');
const { parseSizeToBytes, formatBytes } = require('../utils/storageSize');

// ---------------------------------------------------------------------------
// Tiny in-process TTL caches — `requireActiveSubscription()` (subscriptionMiddleware.js)
// is mounted globally on every /api request and calls getActiveSubscriptionForTenant()
// on each one; withinUsageLimits/requireFeature/enforceStorageLimitAfterUpload
// call getTenantSubscription() the same way on their own routes. Before this,
// EVERY authenticated request re-ran `SELECT * FROM subscriptions ...` +
// `SELECT * FROM plans WHERE id = ?` from scratch — on a page that fires a
// dozen API calls, that's a dozen round trips for data that changes at most
// a few times a day. Under a small connection-pool cap (see
// docs/17-migration-and-roadmap/18_Plan_Limits_Enforcement.md's storage
// section and the 2026-09-01 production incident notes), that volume alone
// was enough to exhaust available connections and hang unrelated requests
// (including login) behind it.
//
// Short TTLs (single-digit/low-double-digit seconds) bound staleness even
// without perfect invalidation coverage; the write paths below also
// explicitly invalidate on any change so a plan upgrade/cancel/restore is
// reflected immediately rather than waiting out the TTL.
const SUBSCRIPTION_CACHE_TTL_MS = 15_000;
const PLAN_CACHE_TTL_MS = 5 * 60_000; // plans change far less often than subscriptions
const subscriptionCache = new Map(); // tenantId -> { value, expiresAt }
const planCache = new Map(); // planId -> { value, expiresAt }

function cacheGet(cache, key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function cacheSet(cache, key, value, ttlMs) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Invalidate a tenant's cached subscription — called from every write path below. */
function invalidateSubscriptionCache(tenantId) {
  if (tenantId) subscriptionCache.delete(tenantId);
}

// ---------------------------------------------------------------------------
// Plans
// ---------------------------------------------------------------------------

const getPlans = async (options = {}) => {
  let query = 'SELECT * FROM plans';
  const params = [];

  if (options.activeOnly) {
    query += ' WHERE is_active = 1';
  }

  query += ' ORDER BY price_monthly ASC';

  const plans = await db.query(query, params);

  plans.forEach((plan) => {
    if (plan.features) plan.features = safeParseJson(plan.features);
    if (plan.limits) plan.limits = safeParseJson(plan.limits);
  });

  return plans;
};

const getPlanById = async (planId) => {
  if (!planId) return null;
  const cached = cacheGet(planCache, planId);
  if (cached !== undefined) return cached;

  const plan = await db.queryOne('SELECT * FROM plans WHERE id = ?', [planId]);
  if (!plan) {
    cacheSet(planCache, planId, null, PLAN_CACHE_TTL_MS);
    return null;
  }

  if (plan.features) plan.features = safeParseJson(plan.features);
  if (plan.limits) plan.limits = safeParseJson(plan.limits);

  cacheSet(planCache, planId, plan, PLAN_CACHE_TTL_MS);
  return plan;
};

const createPlan = async (planData) => {
  const planId = uuidv4();

  await db.query(
    `INSERT INTO plans (id, name, description, price_monthly, price_yearly, currency, features, limits, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      planId,
      planData.name,
      planData.description || null,
      planData.price_monthly,
      planData.price_yearly || null,
      planData.currency || 'USD',
      JSON.stringify(planData.features || {}),
      JSON.stringify(planData.limits || {}),
      planData.is_active !== undefined ? planData.is_active : true,
    ]
  );

  return getPlanById(planId);
};

const updatePlan = async (planId, planData) => {
  const existing = await db.queryOne('SELECT * FROM plans WHERE id = ?', [planId]);
  if (!existing) {
    throw new Error(`Plan with ID ${planId} not found`);
  }

  const features = planData.features ? JSON.stringify(planData.features) : existing.features;
  const limits = planData.limits ? JSON.stringify(planData.limits) : existing.limits;

  await db.query(
    `UPDATE plans SET
       name = ?, description = ?, price_monthly = ?, price_yearly = ?,
       currency = ?, features = ?, limits = ?, is_active = ?,
       stripe_price_id_monthly = ?, stripe_price_id_yearly = ?
     WHERE id = ?`,
    [
      planData.name || existing.name,
      planData.description !== undefined ? planData.description : existing.description,
      planData.price_monthly !== undefined ? planData.price_monthly : existing.price_monthly,
      planData.price_yearly !== undefined ? planData.price_yearly : existing.price_yearly,
      planData.currency || existing.currency,
      features,
      limits,
      planData.is_active !== undefined ? planData.is_active : existing.is_active,
      planData.stripe_price_id_monthly !== undefined ? planData.stripe_price_id_monthly : existing.stripe_price_id_monthly,
      planData.stripe_price_id_yearly !== undefined ? planData.stripe_price_id_yearly : existing.stripe_price_id_yearly,
      planId,
    ]
  );

  planCache.delete(planId);
  // Any tenant subscription whose cached `.plan` is this plan is now stale
  // too (limits/features/price may have changed) — cheap enough to just
  // clear the whole subscription cache rather than track which tenants
  // reference which plan.
  subscriptionCache.clear();

  return getPlanById(planId);
};

// ---------------------------------------------------------------------------
// Subscriptions — reads
// ---------------------------------------------------------------------------

const getTenantSubscription = async (tenantId, options = {}) => {
  const subscription = await db.queryOne(
    'SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1',
    [tenantId]
  );
  if (!subscription) return null;

  if (options.includePlan) {
    subscription.plan = await getPlanById(subscription.plan_id);
  }

  return subscription;
};

/**
 * Priority-ordered active-subscription lookup, mirroring Paytime's
 * findActiveForOrganization: active > trial > pending > cancelled > expired.
 * Returns the single "best" row representing the tenant's current standing,
 * with the plan attached.
 */
const STATUS_PRIORITY = ['active', 'trial', 'pending', 'cancelled', 'expired'];

const getActiveSubscriptionForTenant = async (tenantId) => {
  if (!tenantId) return null;
  const cached = cacheGet(subscriptionCache, tenantId);
  if (cached !== undefined) return cached;

  const rows = await db.query(
    'SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY created_at DESC',
    [tenantId]
  );
  if (!rows.length) {
    cacheSet(subscriptionCache, tenantId, null, SUBSCRIPTION_CACHE_TTL_MS);
    return null;
  }

  let best = null;
  for (const status of STATUS_PRIORITY) {
    best = rows.find((r) => r.status === status);
    if (best) break;
  }
  if (!best) best = rows[0];

  best.plan = await getPlanById(best.plan_id);
  cacheSet(subscriptionCache, tenantId, best, SUBSCRIPTION_CACHE_TTL_MS);
  return best;
};

// ---------------------------------------------------------------------------
// Subscriptions — writes
// ---------------------------------------------------------------------------

const createOrUpdateSubscription = async (tenantId, subscriptionData) => {
  const tenant = await db.queryOne('SELECT id FROM tenants WHERE id = ?', [tenantId]);
  if (!tenant) {
    throw new Error(`Tenant with ID ${tenantId} not found`);
  }

  const plan = await getPlanById(subscriptionData.plan_id);
  if (!plan) {
    throw new Error(`Plan with ID ${subscriptionData.plan_id} not found`);
  }

  const existing = await db.queryOne('SELECT * FROM subscriptions WHERE tenant_id = ?', [tenantId]);
  const subscriptionId = existing ? existing.id : uuidv4();

  if (existing) {
    await db.query(
      `UPDATE subscriptions SET
         plan_id = ?, status = ?, start_date = ?, end_date = ?, trial_end_date = ?,
         auto_renew = ?, payment_method = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        subscriptionData.plan_id,
        subscriptionData.status || 'active',
        subscriptionData.start_date || new Date(),
        subscriptionData.end_date,
        subscriptionData.trial_end_date || null,
        subscriptionData.auto_renew !== undefined ? subscriptionData.auto_renew : true,
        subscriptionData.payment_method || null,
        subscriptionId,
      ]
    );
  } else {
    await db.query(
      `INSERT INTO subscriptions (id, tenant_id, plan_id, status, start_date, end_date, trial_end_date, auto_renew, payment_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subscriptionId,
        tenantId,
        subscriptionData.plan_id,
        subscriptionData.status || 'active',
        subscriptionData.start_date || new Date(),
        subscriptionData.end_date,
        subscriptionData.trial_end_date || null,
        subscriptionData.auto_renew !== undefined ? subscriptionData.auto_renew : true,
        subscriptionData.payment_method || null,
      ]
    );
  }

  invalidateSubscriptionCache(tenantId);
  return getTenantSubscription(tenantId, { includePlan: true });
};

const updateSubscriptionStatus = async (subscriptionId, status) => {
  const sub = await db.queryOne('SELECT tenant_id FROM subscriptions WHERE id = ?', [subscriptionId]);
  if (!sub) {
    throw new Error(`Subscription with ID ${subscriptionId} not found`);
  }

  const validStatuses = ['active', 'trial', 'expired', 'cancelled', 'pending'];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
  }

  await db.query('UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, subscriptionId]);
  invalidateSubscriptionCache(sub.tenant_id);

  return getTenantSubscription(sub.tenant_id, { includePlan: true });
};

// ---------------------------------------------------------------------------
// Feature / limit checks (unchanged behaviour, payment_method bug fixed by
// simply no longer referencing a nonexistent column anywhere in reads)
// ---------------------------------------------------------------------------

const hasFeature = async (tenantId, featureName) => {
  try {
    const subscription = await getTenantSubscription(tenantId, { includePlan: true });
    if (!subscription || !subscription.plan) return false;
    if (subscription.status !== 'active' && subscription.status !== 'trial') return false;
    return subscription.plan.features && subscription.plan.features[featureName] === true;
  } catch (error) {
    console.error('Error in hasFeature:', error);
    return false;
  }
};

const checkLimit = async (tenantId, limitName, currentUsage) => {
  try {
    const subscription = await getTenantSubscription(tenantId, { includePlan: true });
    if (!subscription || !subscription.plan) {
      return { allowed: false, limit: 0, usage: currentUsage };
    }
    if (subscription.status !== 'active' && subscription.status !== 'trial') {
      return { allowed: false, limit: 0, usage: currentUsage };
    }
    const limit = subscription.plan.limits && subscription.plan.limits[limitName];
    if (!limit) {
      return { allowed: true, limit: 'unlimited', usage: currentUsage };
    }
    return {
      allowed: currentUsage < limit,
      limit,
      usage: currentUsage,
      remaining: Math.max(0, limit - currentUsage),
    };
  } catch (error) {
    console.error('Error in checkLimit:', error);
    return { allowed: false, limit: 0, usage: currentUsage };
  }
};

const getSubscriptionUsage = async (tenantId) => {
  const subscription = await getTenantSubscription(tenantId, { includePlan: true });
  if (!subscription || !subscription.plan) {
    return { status: 'no_subscription' };
  }

  const [storesCount] = await db.query('SELECT COUNT(*) as count FROM stores WHERE tenant_id = ?', [tenantId]);
  const [productsCount] = await db.query('SELECT COUNT(*) as count FROM products WHERE tenant_id = ?', [tenantId]);
  const [usersCount] = await db.query('SELECT COUNT(*) as count FROM users WHERE tenant_id = ?', [tenantId]);
  // Real per-tenant upload storage usage (bytes), replacing the previous
  // hardcoded `storageUsage = 0` stub — see storageUsageService.js and
  // backend/utils/storageSize.js. `limits.storage` is seeded as a human
  // string ('500MB'/'1GB'/...), so it's parsed to bytes here for the
  // percentage calc, but the raw string is still what's returned as `limit`
  // (matches what LIMIT_LABELS.storage on the frontend already expects to
  // display, e.g. "1GB storage").
  const storageUsageBytes = await storageUsageService.getTenantStorageBytes(tenantId);

  const limits = subscription.plan.limits || {};
  const storageLimitBytes = limits.storage !== undefined ? parseSizeToBytes(limits.storage) : undefined;
  const storagePercentage = storageLimitBytes && !isNaN(storageLimitBytes) && storageLimitBytes > 0
    ? (storageUsageBytes / storageLimitBytes * 100)
    : 0;

  return {
    status: subscription.status,
    plan_name: subscription.plan.name,
    plan_id: subscription.plan_id,
    start_date: subscription.start_date,
    end_date: subscription.end_date,
    trial_end_date: subscription.trial_end_date,
    auto_renew: subscription.auto_renew,
    usage: {
      stores: { used: storesCount.count, limit: limits.stores || 'unlimited', percentage: limits.stores ? (storesCount.count / limits.stores * 100) : 0 },
      products: { used: productsCount.count, limit: limits.products || 'unlimited', percentage: limits.products ? (productsCount.count / limits.products * 100) : 0 },
      users: { used: usersCount.count, limit: limits.users || 'unlimited', percentage: limits.users ? (usersCount.count / limits.users * 100) : 0 },
      storage: {
        used: storageUsageBytes,
        usedFormatted: formatBytes(storageUsageBytes),
        limit: limits.storage || 'unlimited',
        percentage: storagePercentage,
      },
    },
  };
};

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

/**
 * Log a subscription_history event. Never throws — history logging must not
 * break the billing flow it's observing.
 */
const logSubscriptionHistory = async (tenantId, subscriptionId, eventType, metadata = {}) => {
  try {
    await db.query(
      'INSERT INTO subscription_history (id, tenant_id, subscription_id, event_type, metadata) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), tenantId, subscriptionId || null, eventType, JSON.stringify(metadata || {})]
    );
  } catch (error) {
    console.error(`Failed to log subscription_history event ${eventType} for tenant ${tenantId}:`, error);
  }
};

// ---------------------------------------------------------------------------
// Stripe Checkout
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Checkout Session for a tenant to add a payment method /
 * upgrade to a paid plan. Trial subscriptions are DB-only until this point.
 */
const createCheckoutSession = async (tenantId, planId, billingCycle, userId) => {
  const plan = await getPlanById(planId);
  if (!plan) {
    throw new Error(`Plan with ID ${planId} not found`);
  }

  const priceId = billingCycle === 'yearly' ? plan.stripe_price_id_yearly : plan.stripe_price_id_monthly;
  if (!priceId) {
    throw new Error(
      `Plan "${plan.name}" has no Stripe Price ID configured for the ${billingCycle} billing cycle. ` +
      `Populate plans.stripe_price_id_${billingCycle} after creating the Price in the Stripe dashboard.`
    );
  }

  const tenant = await db.queryOne('SELECT id, name FROM tenants WHERE id = ?', [tenantId]);
  if (!tenant) {
    throw new Error(`Tenant with ID ${tenantId} not found`);
  }

  const existingSub = await getTenantSubscription(tenantId);
  let customerId = existingSub?.stripe_customer_id || null;

  if (!customerId) {
    // tenants has no email column — use the requesting user's email (billing
    // contact), falling back to the tenant name only if unavailable.
    const requestingUser = userId ? await db.queryOne('SELECT email FROM users WHERE id = ?', [userId]).catch(() => null) : null;
    const customer = await stripeService.findOrCreateCustomer(tenantId, requestingUser?.email || null, tenant.name);
    customerId = customer.id;
  }

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const session = await stripeService.createCheckoutSession({
    customerId,
    priceId,
    tenantId,
    planId,
    userId,
    successUrl: `${frontendUrl}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${frontendUrl}/settings/billing?canceled=true`,
  });

  await logSubscriptionHistory(tenantId, existingSub?.id || null, 'checkout_started', {
    planId,
    billingCycle,
    sessionId: session.id,
  });

  return session.url;
};

const createBillingPortalSession = async (tenantId, returnUrl) => {
  const sub = await getTenantSubscription(tenantId);
  if (!sub || !sub.stripe_customer_id) {
    throw new Error('No Stripe customer found for this tenant. Add a payment method first.');
  }
  const session = await stripeService.createBillingPortalSession(sub.stripe_customer_id, returnUrl);
  return session.url;
};

// ---------------------------------------------------------------------------
// Webhook handlers
// ---------------------------------------------------------------------------

/**
 * checkout.session.completed — upsert the tenant's (already-existing, trial)
 * subscription row to active, attaching Stripe IDs. Never creates a
 * duplicate row — matches Paytime's upsert-not-duplicate pattern.
 */
const activateFromCheckoutSession = async (session) => {
  const tenantId = session.metadata?.tenantId;
  const planId = session.metadata?.planId;
  if (!tenantId || !planId) {
    console.error('checkout.session.completed missing tenantId/planId metadata', session.id);
    return;
  }

  const stripeCustomerId = session.customer;
  const stripeSubscriptionId = session.subscription;

  const stripeSub = stripeSubscriptionId
    ? await stripeService.retrieveSubscription(stripeSubscriptionId)
    : null;

  const periodEnd = resolvePeriodEndDate(stripeSub);
  const billingCycle = session.metadata?.billingCycle || 'monthly';

  const existing = await db.queryOne('SELECT * FROM subscriptions WHERE tenant_id = ?', [tenantId]);
  const subscriptionId = existing ? existing.id : uuidv4();

  const endDate = periodEnd || defaultEndDate(billingCycle);

  if (existing) {
    await db.query(
      `UPDATE subscriptions SET
         plan_id = ?, status = 'active', end_date = ?, auto_renew = 1,
         stripe_customer_id = ?, stripe_subscription_id = ?, payment_method = 'stripe',
         billing_cycle = ?, cancel_at_period_end = 0, grace_period_ends_at = NULL,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [planId, endDate, stripeCustomerId, stripeSubscriptionId, billingCycle, subscriptionId]
    );
  } else {
    await db.query(
      `INSERT INTO subscriptions (id, tenant_id, plan_id, status, start_date, end_date, auto_renew, stripe_customer_id, stripe_subscription_id, payment_method, billing_cycle)
       VALUES (?, ?, ?, 'active', CURDATE(), ?, 1, ?, ?, 'stripe', ?)`,
      [subscriptionId, tenantId, planId, endDate, stripeCustomerId, stripeSubscriptionId, billingCycle]
    );
  }

  await logSubscriptionHistory(tenantId, subscriptionId, 'subscription_activated', {
    stripeSubscriptionId,
    planId,
    billingCycle,
  });
  invalidateSubscriptionCache(tenantId);
};

/**
 * customer.subscription.updated — sync status/period/pending-plan-change
 * from Stripe's view of the subscription.
 */
const syncFromStripeSubscription = async (stripeSubscription) => {
  const sub = await db.queryOne('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?', [stripeSubscription.id]);
  if (!sub) {
    console.warn(`customer.subscription.updated for unknown stripe_subscription_id ${stripeSubscription.id}`);
    return;
  }

  const periodEnd = resolvePeriodEndDate(stripeSubscription);
  const metadata = safeParseJson(sub.metadata) || {};

  let planId = sub.plan_id;
  // Apply a deferred downgrade at renewal, if one was scheduled by changePlan().
  if (metadata.pendingPlanId && stripeSubscription.status === 'active') {
    planId = metadata.pendingPlanId;
    delete metadata.pendingPlanId;
  }

  const statusMap = {
    active: 'active',
    trialing: 'trial',
    past_due: sub.status, // leave as-is; dunning handled via invoice.payment_failed
    canceled: 'cancelled',
    unpaid: sub.status,
    incomplete_expired: 'cancelled',
  };
  const newStatus = statusMap[stripeSubscription.status] || sub.status;

  await db.query(
    `UPDATE subscriptions SET
       plan_id = ?, status = ?, end_date = COALESCE(?, end_date),
       cancel_at_period_end = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      planId,
      newStatus,
      periodEnd,
      stripeSubscription.cancel_at_period_end ? 1 : 0,
      JSON.stringify(metadata),
      sub.id,
    ]
  );

  await logSubscriptionHistory(sub.tenant_id, sub.id, 'plan_changed', {
    stripeSubscriptionId: stripeSubscription.id,
    newStatus,
    planId,
  });
  invalidateSubscriptionCache(sub.tenant_id);
};

/** customer.subscription.deleted */
const cancelByStripeSubscriptionId = async (stripeSubscriptionId) => {
  const sub = await db.queryOne('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?', [stripeSubscriptionId]);
  if (!sub) return;

  await db.query(
    `UPDATE subscriptions SET status = 'cancelled', cancel_at_period_end = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [sub.id]
  );

  await logSubscriptionHistory(sub.tenant_id, sub.id, 'subscription_cancelled', { stripeSubscriptionId });
  invalidateSubscriptionCache(sub.tenant_id);
};

/** invoice.payment_succeeded */
const handlePaymentSucceeded = async (invoice) => {
  const stripeSubscriptionId = invoice.subscription;
  if (!stripeSubscriptionId) return;

  const sub = await db.queryOne('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?', [stripeSubscriptionId]);
  if (!sub) return;

  const metadata = safeParseJson(sub.metadata) || {};
  metadata.failedAttempts = 0;

  await db.query(
    `UPDATE subscriptions SET status = 'active', grace_period_ends_at = NULL, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [JSON.stringify(metadata), sub.id]
  );

  await logSubscriptionHistory(sub.tenant_id, sub.id, 'payment_succeeded', { stripeSubscriptionId, invoiceId: invoice.id });
  invalidateSubscriptionCache(sub.tenant_id);
};

/** invoice.payment_failed — dunning: after the 3rd attempt, start a 7-day grace period */
const handlePaymentFailed = async (invoice) => {
  const stripeSubscriptionId = invoice.subscription;
  if (!stripeSubscriptionId) return;

  const sub = await db.queryOne('SELECT * FROM subscriptions WHERE stripe_subscription_id = ?', [stripeSubscriptionId]);
  if (!sub) return;

  const metadata = safeParseJson(sub.metadata) || {};
  const attemptNumber = (metadata.failedAttempts || 0) + 1;
  metadata.failedAttempts = attemptNumber;

  let graceEndsAt = sub.grace_period_ends_at;
  if (attemptNumber >= 3 && !graceEndsAt) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    graceEndsAt = d.toISOString().split('T')[0];
  }

  await db.query(
    `UPDATE subscriptions SET grace_period_ends_at = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [graceEndsAt, JSON.stringify(metadata), sub.id]
  );

  await logSubscriptionHistory(sub.tenant_id, sub.id, 'payment_failed', { stripeSubscriptionId, attemptNumber, invoiceId: invoice.id });

  if (attemptNumber >= 3 && graceEndsAt && graceEndsAt !== sub.grace_period_ends_at) {
    await logSubscriptionHistory(sub.tenant_id, sub.id, 'grace_period_started', { graceEndsAt });
  }

  invalidateSubscriptionCache(sub.tenant_id);

  // Fire billing emails — best-effort, never block webhook processing on email failure.
  try {
    const emailService = require('./emailService');
    const tenant = await db.queryOne('SELECT name FROM tenants WHERE id = ?', [sub.tenant_id]);
    // "The tenant admin user" — no dedicated role lookup exists for this, so
    // mirror the existing convention here of treating the earliest-created
    // user for the tenant as its owner/admin recipient.
    const owner = await db.queryOne(
      'SELECT id, name, email FROM users WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1',
      [sub.tenant_id]
    ).catch(() => null);
    const recipientEmail = owner?.email;
    const recipientName = owner?.name || 'there';

    // Notification-preference gate — skip sending if the recipient turned
    // this class of email off. A missing preferences row (user predates this
    // feature, or the row failed to auto-create) fails OPEN (send), matching
    // the boolean columns' own DB defaults (1 = on) rather than silently
    // going quiet for users who never got a row.
    let prefsAllowSend = true;
    if (owner?.id) {
      try {
        const prefs = await db.queryOne(
          'SELECT email_payment_failed FROM user_notification_preferences WHERE user_id = ?',
          [owner.id]
        );
        if (prefs && prefs.email_payment_failed === 0) {
          prefsAllowSend = false;
        }
      } catch (prefErr) {
        console.error('Failed to read notification preferences (failing open, email will send):', prefErr.message);
      }
    }

    // NOTE: both sendPaymentFailedEmail and sendGracePeriodStartedEmail are
    // gated by the SAME `email_payment_failed` toggle — there is no separate
    // preference column for "grace period started" specifically; it's the
    // same dunning email class from the user's point of view.
    // `email_low_stock` / `email_new_sale_summary` have columns ready in
    // user_notification_preferences but no caller wired up anywhere yet.
    if (recipientEmail && prefsAllowSend) {
      if (attemptNumber >= 3 && graceEndsAt) {
        await emailService.sendGracePeriodStartedEmail(recipientEmail, recipientName, tenant?.name || '', graceEndsAt);
      } else {
        await emailService.sendPaymentFailedEmail(recipientEmail, recipientName, tenant?.name || '', attemptNumber);
      }
    }
  } catch (emailError) {
    console.error('Failed to send billing failure email:', emailError);
  }
};

// ---------------------------------------------------------------------------
// Plan changes / cancel / restore
// ---------------------------------------------------------------------------

/**
 * Upgrade = immediate, with proration via Stripe.
 * Downgrade = deferred — stores pendingPlanId in metadata, applied at the
 * next renewal by syncFromStripeSubscription() on customer.subscription.updated.
 */
const changePlan = async (tenantId, newPlanId, billingCycle) => {
  const sub = await getTenantSubscription(tenantId, { includePlan: true });
  if (!sub) throw new Error('No subscription found for this tenant');
  if (!sub.stripe_subscription_id) throw new Error('This subscription has no Stripe subscription attached yet — add a payment method first');

  const newPlan = await getPlanById(newPlanId);
  if (!newPlan) throw new Error(`Plan with ID ${newPlanId} not found`);

  const cycle = billingCycle || sub.billing_cycle || 'monthly';
  const newPriceId = cycle === 'yearly' ? newPlan.stripe_price_id_yearly : newPlan.stripe_price_id_monthly;
  if (!newPriceId) {
    throw new Error(`Plan "${newPlan.name}" has no Stripe Price ID for the ${cycle} billing cycle`);
  }

  const isUpgrade = Number(newPlan.price_monthly) >= Number(sub.plan.price_monthly);

  if (isUpgrade) {
    await stripeService.updateSubscriptionItem(sub.stripe_subscription_id, newPriceId, 'create_prorations');
    await db.query('UPDATE subscriptions SET plan_id = ?, billing_cycle = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newPlanId, cycle, sub.id]);
  } else {
    const metadata = safeParseJson(sub.metadata) || {};
    metadata.pendingPlanId = newPlanId;
    await db.query('UPDATE subscriptions SET metadata = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(metadata), sub.id]);
  }

  await logSubscriptionHistory(tenantId, sub.id, 'plan_changed', { newPlanId, cycle, immediate: isUpgrade });
  invalidateSubscriptionCache(tenantId);

  return getTenantSubscription(tenantId, { includePlan: true });
};

const cancelSubscription = async (tenantId) => {
  const sub = await getTenantSubscription(tenantId);
  if (!sub) throw new Error('No subscription found for this tenant');

  if (sub.stripe_subscription_id) {
    await stripeService.cancelAtPeriodEnd(sub.stripe_subscription_id);
  }

  await db.query('UPDATE subscriptions SET cancel_at_period_end = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sub.id]);
  await logSubscriptionHistory(tenantId, sub.id, 'subscription_cancelled', { stripeSubscriptionId: sub.stripe_subscription_id });
  invalidateSubscriptionCache(tenantId);

  return getTenantSubscription(tenantId, { includePlan: true });
};

const restoreSubscription = async (tenantId) => {
  const sub = await getTenantSubscription(tenantId);
  if (!sub) throw new Error('No subscription found for this tenant');

  if (sub.stripe_subscription_id) {
    await stripeService.resumeSubscription(sub.stripe_subscription_id);
  }

  await db.query('UPDATE subscriptions SET cancel_at_period_end = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [sub.id]);
  await logSubscriptionHistory(tenantId, sub.id, 'subscription_restored', { stripeSubscriptionId: sub.stripe_subscription_id });
  invalidateSubscriptionCache(tenantId);

  return getTenantSubscription(tenantId, { includePlan: true });
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeParseJson(value) {
  if (value == null) return value;
  if (typeof value !== 'string') return value; // mysql2 may already return parsed JSON
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function resolvePeriodEndDate(stripeSubscription) {
  if (!stripeSubscription) return null;
  const item = stripeSubscription.items?.data?.[0];
  const endSeconds = item?.current_period_end || stripeSubscription.current_period_end;
  if (!endSeconds) return null;
  return new Date(endSeconds * 1000).toISOString().split('T')[0];
}

function defaultEndDate(billingCycle) {
  const d = new Date();
  if (billingCycle === 'yearly') {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d.toISOString().split('T')[0];
}

module.exports = {
  // Plans
  getPlans,
  getPlanById,
  createPlan,
  updatePlan,

  // Subscriptions — reads
  getTenantSubscription,
  getActiveSubscriptionForTenant,

  // Subscriptions — writes
  createOrUpdateSubscription,
  updateSubscriptionStatus,

  // Feature and limit checks
  hasFeature,
  checkLimit,
  getSubscriptionUsage,

  // History
  logSubscriptionHistory,

  // Stripe checkout / portal
  createCheckoutSession,
  createBillingPortalSession,

  // Webhook handlers
  activateFromCheckoutSession,
  syncFromStripeSubscription,
  cancelByStripeSubscriptionId,
  handlePaymentSucceeded,
  handlePaymentFailed,

  // Plan lifecycle
  changePlan,
  cancelSubscription,
  restoreSubscription,
};
