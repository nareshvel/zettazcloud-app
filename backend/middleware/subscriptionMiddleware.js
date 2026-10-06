/**
 * Subscription Middleware
 * Provides middleware for checking subscription status and features
 */
const subscriptionService = require('../services/subscriptionService');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');
const { parseSizeToBytes, formatBytes } = require('../utils/storageSize');

/**
 * Best-effort tenant ID extraction independent of req.user — this
 * middleware is mounted globally in server.js BEFORE the per-router
 * `authenticate` middleware runs (each route file calls authenticate
 * itself; there is no single earlier point where req.user is guaranteed
 * set). Decoding the JWT here directly, rather than depending on
 * req.user, lets one broad mount point work without reordering every
 * existing route file's own auth middleware. Never throws — an invalid/
 * missing token just means "no tenant context yet", left for the real
 * `authenticate` middleware further down the chain to reject properly.
 */
const extractTenantId = (req) => {
  if (req.user?.tenant_id || req.user?.tenantId) {
    return req.user.tenant_id || req.user.tenantId;
  }
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded.tenant_id || decoded.tenantId || null;
  } catch {
    return null;
  }
};

/**
 * Route prefixes that must stay reachable regardless of subscription state —
 * a tenant whose trial has expired or whose card was declined must still be
 * able to log in, finish onboarding, and reach billing to fix payment.
 * Mirrors Paytime's SubscriptionGuard exclusion list (isBillingRoute).
 */
const EXCLUDED_PATH_PREFIXES = [
  '/api/subscriptions',   // billing/status/checkout/portal/change-plan/cancel/restore
  '/api/webhooks',        // Stripe webhook (also unauthenticated, but belt-and-braces)
  '/api/auth',
  '/api/public',
  '/api/onboarding',
  '/api/users/me',        // profile fetch, needed by most authenticated shells
];

const isExcludedPath = (path) => EXCLUDED_PATH_PREFIXES.some((p) => path.startsWith(p));

/**
 * A subscription whose status is 'trial' and whose trial_end_date has
 * passed must be treated as needing an upgrade, not silently allowed
 * forever — this was NOT previously enforced (see CLAUDE.md-equivalent
 * Stripe Billing Module doc for context).
 */
const isTrialExpired = (subscription) => {
  if (subscription.status !== 'trial' || !subscription.trial_end_date) return false;
  const trialEnd = new Date(subscription.trial_end_date);
  trialEnd.setUTCHours(23, 59, 59, 999); // date column: block only after end-of-day UTC
  return trialEnd < new Date();
};

/**
 * Middleware to check if a tenant has an active subscription.
 * Intended to be mounted broadly (see server.js) — internally skips billing/
 * auth/public/onboarding/webhook routes so a locked-out tenant can still fix
 * payment.
 * @returns {Function} Express middleware
 */
const requireActiveSubscription = () => {
  return async (req, res, next) => {
    try {
      if (isExcludedPath(req.path)) {
        return next();
      }

      const tenantId = extractTenantId(req);

      if (!tenantId) {
        // No authenticated tenant context yet on this request (e.g. an
        // unauthenticated route not covered above) — let downstream
        // authenticate/requireTenantId middleware handle it.
        return next();
      }

      const subscription = await subscriptionService.getActiveSubscriptionForTenant(tenantId);

      if (!subscription) {
        // No subscriptions row at all. This is NOT necessarily "no active
        // subscription" — it's also the state of every tenant created before
        // the Stripe billing module existed (their trial was never backfilled
        // into `subscriptions`), and of any tenant whose signup-time plan
        // lookup silently missed (see signupService.js's createTrialSubscription
        // — a lookup miss is deliberately non-fatal to signup). Blocking here
        // locked out every pre-existing tenant, not just genuinely unsubscribed
        // ones. Fail OPEN on a missing row; only a row that explicitly says
        // expired/cancelled/trial-expired blocks access below. Run
        // scripts/backfill-missing-subscriptions.js once, then this branch
        // should rarely fire for real tenants going forward.
        console.warn(`Subscription check: tenant ${tenantId} has no subscriptions row — allowing through (legacy/unbackfilled tenant).`);
        return next();
      }

      if (subscription.status === 'trial' && isTrialExpired(subscription)) {
        return res.status(402).json({
          message: 'Your trial period has expired. Please add a payment method in Settings → Billing to continue.',
          subscriptionStatus: 'trial_expired'
        });
      }

      // In grace period (dunning) — allow through, read-only enforcement is
      // left to individual write endpoints if/when that's needed; for now
      // access continues so the tenant isn't locked out mid-grace-period.
      const inGrace = subscription.grace_period_ends_at && new Date(subscription.grace_period_ends_at) >= new Date();

      if (subscription.status !== 'active' && subscription.status !== 'trial' && !inGrace) {
        return res.status(402).json({
          message: 'Your subscription is not active. Please renew your subscription in Settings → Billing.',
          subscriptionStatus: subscription.status
        });
      }

      // Add subscription to request for use in route handlers
      req.subscription = subscription;
      next();
    } catch (error) {
      console.error('Error in subscription middleware:', error);
      // Fail open — a middleware bug here must never lock every tenant out
      // of the whole app.
      return next();
    }
  };
};

/**
 * Middleware to check if a tenant's subscription includes a specific feature
 * @param {String} requiredFeature - Feature name that must be included in the subscription
 * @returns {Function} Express middleware
 */
const requireFeature = (requiredFeature) => {
  return async (req, res, next) => {
    try {
      // First ensure active subscription
      const tenantId = req.user?.tenant_id || req.user?.tenantId;
      
      if (!tenantId) {
        console.error('FEATURE CHECK MIDDLEWARE: No tenant ID found in request');
        return res.status(400).json({ 
          message: 'Tenant ID is required for feature checks'
        });
      }
      
      // Use cached subscription if available from previous middleware
      let subscription = req.subscription;
      
      // If no cached subscription, fetch it
      if (!subscription) {
        subscription = await subscriptionService.getTenantSubscription(tenantId, { includePlan: true });
        
        // Check if subscription exists and is active
        if (!subscription || (subscription.status !== 'active' && subscription.status !== 'trial')) {
          const status = subscription ? subscription.status : 'none';
          console.log(`FEATURE CHECK MIDDLEWARE: No active subscription for tenant ${tenantId}`, { status });
          return res.status(402).json({ 
            message: 'This feature requires an active subscription',
            subscriptionStatus: status
          });
        }
        
        // Cache subscription for future middleware
        req.subscription = subscription;
      }
      
      // Check if subscription plan includes required feature
      const hasFeature = subscription.plan?.features && 
                         subscription.plan.features[requiredFeature] === true;
                         
      if (!hasFeature) {
        console.log(`FEATURE CHECK MIDDLEWARE: Subscription doesn't include feature ${requiredFeature}`, {
          tenant: tenantId,
          plan: subscription.plan?.name
        });
        
        return res.status(402).json({
          message: `Your current plan doesn't include the ${requiredFeature} feature. Please upgrade your plan.`,
          currentPlan: subscription.plan?.name,
          requiredFeature: requiredFeature
        });
      }
      
      // Feature is available
      next();
    } catch (error) {
      console.error('Error in feature check middleware:', error);
      return res.status(500).json({ message: 'Error checking subscription features' });
    }
  };
};

/**
 * Check if a tenant is within usage limits for a specific resource
 * @param {String} resourceType - Type of resource to check (users, stores, etc.)
 * @param {Function} countFn - Async function that returns current usage count
 * @returns {Function} Express middleware
 */
const withinUsageLimits = (resourceType, countFn) => {
  return async (req, res, next) => {
    try {
      // Extract tenant ID from req.user
      const tenantId = req.user?.tenant_id || req.user?.tenantId;
      
      if (!tenantId) {
        console.error('USAGE LIMITS MIDDLEWARE: No tenant ID found in request');
        return res.status(400).json({ 
          message: 'Tenant ID is required for usage limit checks'
        });
      }
      
      // Use cached subscription if available
      let subscription = req.subscription;

      // If no cached subscription, fetch it
      if (!subscription) {
        subscription = await subscriptionService.getTenantSubscription(tenantId, { includePlan: true });
        req.subscription = subscription;
      }

      // Fail OPEN on a missing subscription row or a plan with no `limits`
      // configured — same philosophy as requireActiveSubscription() above:
      // a tenant with zero subscription rows (e.g. pre-dating this module,
      // or the subscription lookup itself failing) must never be blocked
      // from ordinary work. Subscription STATUS (active/trial/expired) is
      // already enforced globally by requireActiveSubscription() on every
      // /api request before this middleware ever runs, so re-blocking here
      // on status would only duplicate that check — this middleware's only
      // job is the numeric usage cap, not gating access.
      if (!subscription || !subscription.plan) {
        return next();
      }

      // Get usage limit from subscription plan. Most resource types
      // (products/users/stores) store this as a plain integer already, but
      // `storage` is seeded as a human string ('500MB', '1GB', ...) — parse
      // it to bytes so the comparison below always works regardless of
      // resourceType. parseSizeToBytes passes plain numbers through
      // unchanged, so this is a no-op for the other resource types.
      const rawLimit = subscription.plan?.limits?.[resourceType];

      // If no limit specified, allow unlimited usage
      if (rawLimit === undefined || rawLimit === null || rawLimit === -1) {
        return next();
      }

      const limit = parseSizeToBytes(rawLimit);

      // Couldn't parse the configured limit at all (e.g. a malformed plan
      // config) — fail OPEN rather than block every request against a
      // tenant because of a data-entry mistake on the plan row.
      if (isNaN(limit)) {
        console.error(`USAGE LIMITS MIDDLEWARE: could not parse limits.${resourceType} value:`, rawLimit);
        return next();
      }
      if (limit === -1) {
        return next();
      }

      // Get current usage count
      const currentCount = await countFn(tenantId);

      // Check if creating a new resource would exceed the limit
      if (currentCount >= limit) {
        const displayLimit = resourceType === 'storage' ? formatBytes(limit) : limit;
        const displayUsage = resourceType === 'storage' ? formatBytes(currentCount) : currentCount;
        return res.status(402).json({
          message: `You have reached the ${resourceType} limit (${displayLimit}) for your subscription plan. Please upgrade your plan to add more ${resourceType}.`,
          currentUsage: displayUsage,
          limit: displayLimit,
          resourceType: resourceType
        });
      }

      // Within limits, proceed
      next();
    } catch (error) {
      console.error('Error in usage limits middleware:', error);
      return res.status(500).json({ message: 'Error checking subscription usage limits' });
    }
  };
};

/**
 * Storage-limit enforcement for a file-upload route, applied AFTER multer.
 * Unlike `withinUsageLimits` (a count-then-create check run BEFORE the
 * resource exists), a file's size isn't known until multer has already
 * written it to disk — so this checks tenant storage usage post-write and,
 * if the plan's `limits.storage` cap is now exceeded, deletes the
 * just-written file and responds 402 instead of letting it stand.
 *
 * `getUploadedFilePath(req)` must return the absolute path multer wrote
 * req.file to (routes differ in how they compute this — product/category
 * uploads use multer.diskStorage with an absolute destination, so
 * `req.file.path` already is that path; attachments/avatars go through
 * storageService instead and need a route-specific extractor).
 * No-ops (calls next()) if the route's request had no file attached.
 */
const enforceStorageLimitAfterUpload = (getUploadedFilePath) => {
  return async (req, res, next) => {
    try {
      if (!req.file) return next(); // nothing was uploaded on this request

      const tenantId = req.user?.tenant_id || req.user?.tenantId;
      if (!tenantId) return next(); // let downstream auth reject properly

      let subscription = req.subscription;
      if (!subscription) {
        subscription = await subscriptionService.getTenantSubscription(tenantId, { includePlan: true });
        req.subscription = subscription;
      }
      if (!subscription || !subscription.plan) return next();

      const rawLimit = subscription.plan?.limits?.storage;
      if (rawLimit === undefined || rawLimit === null || rawLimit === -1) return next();

      const limitBytes = parseSizeToBytes(rawLimit);
      if (isNaN(limitBytes) || limitBytes === -1) return next();

      const storageUsageService = require('../services/storageUsageService');
      const currentBytes = await storageUsageService.getTenantStorageBytes(tenantId);

      if (currentBytes > limitBytes) {
        // Roll back the file multer just wrote — this request pushed the
        // tenant over their plan's storage cap.
        const fs = require('fs').promises;
        try {
          const filePath = getUploadedFilePath(req);
          if (filePath) await fs.unlink(filePath);
        } catch (_) { /* best effort — don't fail the 402 over cleanup */ }

        return res.status(402).json({
          message: `You have reached the storage limit (${formatBytes(limitBytes)}) for your subscription plan. Please upgrade your plan or remove some files to free up space.`,
          currentUsage: formatBytes(currentBytes),
          limit: formatBytes(limitBytes),
          resourceType: 'storage',
        });
      }

      next();
    } catch (error) {
      console.error('Error in storage limit enforcement middleware:', error);
      // Fail open — a bug here must never block every upload.
      return next();
    }
  };
};

module.exports = {
  requireActiveSubscription,
  requireFeature,
  withinUsageLimits,
  enforceStorageLimitAfterUpload,
};
