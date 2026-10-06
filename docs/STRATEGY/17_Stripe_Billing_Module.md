# 17 — Stripe Billing Module (2026-08-31)

Full Stripe-based recurring billing/subscription module, replicating the
architecture already proven in the sibling project "Paytime" (NestJS/TypeORM),
re-derived for Zettaz Cloud's own stack (Node/Express + raw MySQL via
`mysql2`). Same Stripe account as Paytime; a **separate** webhook endpoint and
`STRIPE_WEBHOOK_SECRET`.

## Required environment variables

| Variable | Where used | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | `backend/services/stripeService.js` | Server-side Stripe API key. Never logged or returned to the frontend. |
| `STRIPE_WEBHOOK_SECRET` | `backend/routes/stripeWebhookRoutes.js` | **Must be a NEW secret from a Zettaz-specific webhook endpoint** registered in the Stripe dashboard (`https://<zettaz-backend-host>/api/webhooks/stripe`) — webhook secrets are per-endpoint, not per-account, so Paytime's existing secret will NOT work here even though both use the same Stripe account. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | frontend (reserved, not currently read by any code) | Not needed for the hosted-Checkout/Portal flow this module uses, but reserved in case a future milestone embeds Stripe Elements. |
| `FRONTEND_URL` | already exists in this codebase | Reused for Checkout/Portal success/cancel/return URLs. |

None of the actual key/secret values were seen or invented by this session —
the code reads them from `process.env` by name only.

## What the user must still do manually

1. In the (shared) Stripe dashboard, create Products + Prices for each plan
   (Starter/Growth/Professional/Enterprise), for both monthly and yearly
   cycles as needed.
2. Populate `plans.stripe_price_id_monthly` / `plans.stripe_price_id_yearly`
   for each plan row with the real Stripe Price IDs (direct SQL update, or a
   future plans-admin UI — not built in this session; `PUT /api/subscriptions/plans/:id`
   accepts these fields already).
3. Register a new webhook endpoint in the Stripe dashboard pointing at
   `POST /api/webhooks/stripe` on the Zettaz Cloud backend, subscribed to at
   least: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_succeeded`,
   `invoice.payment_failed`. Copy the resulting signing secret into
   `STRIPE_WEBHOOK_SECRET`.
4. Set `STRIPE_SECRET_KEY` in the backend's environment.
5. Run `cd backend && npm install` to pull in the new `stripe` dependency,
   then `npm run migrate:status` to confirm
   `2026-08-31_stripe_billing_module.sql` is applied before testing (per this
   codebase's standing rule: a migration file existing and passing tests is
   not the same claim as it having been applied to the database you're
   testing against).

## Architecture summary

**Trial creation stays exactly as it was** — `signupService.js`'s
`createTrialSubscription()` still creates a DB-only `subscriptions` row with
`status='trial'`, no Stripe customer, matching the landing page's "no credit
card required" promise. Stripe involvement begins only when a tenant visits
**Settings → Billing** (`frontend/src/components/settings/SettingsBilling.tsx`,
new "Billing" tab in the Commerce group of `Settings.tsx`) and chooses a plan.

- `POST /api/subscriptions/checkout` (`subscriptionService.createCheckoutSession`)
  finds-or-creates a Stripe Customer for the tenant, looks up the chosen
  plan's `stripe_price_id_monthly`/`_yearly`, creates a Checkout Session in
  `mode: 'subscription'` with `metadata: {tenantId, planId, userId}` (read
  back by the webhook), and returns the hosted Checkout URL. The frontend
  redirects via `window.location.href` — no embedded Stripe Elements, mirroring
  Paytime's own primary pattern.
- `POST /api/subscriptions/portal` opens the Stripe Billing Portal (manage
  card, view invoices, cancel) — no custom UI built for any of that.
- `backend/routes/stripeWebhookRoutes.js` (`POST /api/webhooks/stripe`) is
  mounted in `server.js` **before** `express.json()`, with
  `express.raw({type:'application/json'})`, specifically so
  `stripe.webhooks.constructEvent` gets the exact raw bytes it needs for
  signature verification — this ordering is called out with an inline
  comment in `server.js` since it's the single most common real bug in
  Stripe integrations.
- Idempotency: every webhook event is recorded in `stripe_webhook_events`
  (unique on `stripe_event_id`) before processing; a duplicate delivery of an
  already-`processed` event is skipped, a `failed` one is retried.
- `subscriptionService.js` handlers: `activateFromCheckoutSession`
  (`checkout.session.completed` → upsert the existing trial row to active,
  attaching `stripe_customer_id`/`stripe_subscription_id`, never inserting a
  second row), `syncFromStripeSubscription` (`customer.subscription.updated`
  → status/period sync + applies a deferred downgrade if one was staged),
  `cancelByStripeSubscriptionId` (`customer.subscription.deleted`),
  `handlePaymentSucceeded`/`handlePaymentFailed` (`invoice.payment_*` →
  dunning: after the 3rd consecutive failed attempt, sets
  `grace_period_ends_at = now + 7 days` and sends the grace-period email;
  earlier attempts send the payment-failed email). Every handler logs to the
  new `subscription_history` audit table via `logSubscriptionHistory()`.
- `changePlan(tenantId, newPlanId, billingCycle)`: upgrade (by
  `price_monthly` comparison) applies immediately via
  `stripeService.updateSubscriptionItem(..., 'create_prorations')`;
  downgrade stores `pendingPlanId` in the subscription's `metadata` JSON and
  is applied at the next renewal inside `syncFromStripeSubscription`.
- `requireActiveSubscription()` (`backend/middleware/subscriptionMiddleware.js`)
  is now wired globally in `server.js` (`app.use('/api', requireActiveSubscription())`,
  mounted right after the standard rate limiter and before the main API
  router). Because `authenticate` is applied per-route-file in this codebase
  rather than centrally, this middleware does its own lightweight JWT decode
  (same `JWT_SECRET`) to get a tenant ID independent of `req.user`, rather
  than requiring every route file to be reordered. It excludes
  `/api/subscriptions`, `/api/webhooks`, `/api/auth`, `/api/public`,
  `/api/onboarding`, and `/api/users/me` by path prefix — mirroring Paytime's
  `SubscriptionGuard` billing-route exclusion list — and fails **open** (lets
  the request through) on any internal error, so a bug in this middleware
  can never lock every tenant out of the whole app. It also newly treats a
  `trial` subscription whose `trial_end_date` has passed as blocked
  (`subscriptionStatus: 'trial_expired'`), which was not previously enforced
  anywhere.

## What was deliberately not implemented

- **Per-employee overage billing** — Paytime prices per seat; Zettaz's
  `plans.limits` JSON is stores/products/users/storage, not an employee
  count. This entire subsystem (Paytime's `StripeEmployeeBillingService`,
  pack-rounded overage line items, `stripe_extra_emp_price_id`/`_item_id`)
  has no equivalent here and was skipped entirely, per the brief.
- **Embedded Stripe Elements / custom card-entry UI** — hosted Checkout
  Session + Billing Portal only, matching Paytime's own primary integration
  pattern. `VITE_STRIPE_PUBLISHABLE_KEY` is reserved in the env-var table
  above in case a future milestone wants this, but nothing reads it yet.
- **A plans-admin UI for entering Stripe Price IDs** — `PUT
  /api/subscriptions/plans/:id` already accepts
  `stripe_price_id_monthly`/`stripe_price_id_yearly` in its body, but no
  frontend screen was built to drive it in this session; direct SQL/API call
  is the interim path.
- **Read-only enforcement during the grace period** — the middleware
  currently lets a tenant in an active grace period through unrestricted
  (rather than Paytime's read-only mode) to avoid half-building a
  read/write distinction that doesn't exist anywhere else in this codebase's
  request handling yet. Flagged as a gap, not silently dropped.
- **Coupons/discounts** — Paytime's admin-discount-coupon flow
  (`getOrCreateAdminDiscountCoupon`) was not ported; no equivalent concept
  exists in Zettaz's `subscriptions`/`plans` schema today.
- **A cron/scheduled job to expire stale trials proactively** — the
  `trial_expired` check in `requireActiveSubscription()` is evaluated
  lazily, on request, rather than by a background job that flips
  `status` to `expired` in the database. Functionally equivalent for gating
  access, but `subscriptions.status` will keep reading `'trial'` in the DB
  past the trial end date until the tenant takes an action that changes it
  (e.g. successful checkout) — a status-correcting job is a reasonable
  future addition, not built here.
- **Trial countdown inside `OnboardingWizard.tsx`** — left the existing
  hardcoded "14 days remaining" text as-is with an explanatory comment
  rather than wiring it to a real `trial_end_date`, because that value isn't
  currently captured anywhere in that component's state and it wasn't
  confirmed whether `/users/me` even returns it — see the comment at that
  line for the reasoning. The countdown on the new Settings → Billing page
  IS computed from the real `trial_end_date` and is the source of truth.

## Incident: global guard locked out every pre-existing tenant (2026-08-31, fixed same day)

Right after this module went live, `requireActiveSubscription()` returned
HTTP 402 "This action requires an active subscription" for an existing tenant
on every request. Root cause: `getActiveSubscriptionForTenant()` returns
`null` when a tenant has **zero** rows in `subscriptions`, and the guard
originally treated that as "blocked." Every tenant created before this module
existed has zero rows — their trial was never backfilled — so the guard
locked out the entire pre-existing user base the moment it was deployed, not
just genuinely lapsed subscribers.

**Fix:** `requireActiveSubscription()` now fails **open** on a missing row
(logs a warning, lets the request through) — only a row that explicitly says
`trial` (past `trial_end_date`), `expired`, or `cancelled` blocks access.
**`backend/scripts/backfill-missing-subscriptions.js`** (new, run with
`--dry-run` first) gives every tenant with zero rows an `active` subscription
on the Professional plan (`payment_method='manual'`, no Stripe customer
attached — matches the pre-plan-capture signup default), so the fail-open
branch above should rarely fire once it's been run. **Run this script once
against the real database** — it wasn't run as part of this session (no DB
access from the sandbox). Safe to re-run; it only inserts for tenants that
still have zero rows.

## Table audit (2026-08-31) — what's active, what's dead

Three subscription-related tables existed or were added this session,
which is confusing without a map:

| Table | Status | Notes |
|---|---|---|
| `plans` | **ACTIVE** — the real one | Baseline table; gained `stripe_price_id_monthly`/`_yearly` this session. Everything (`subscriptionService.js`, `signupService.js`, checkout) reads/writes this one. |
| `subscriptions` | **ACTIVE** — the real one | Baseline table; gained `stripe_customer_id`/`stripe_subscription_id`/`payment_method`/`billing_cycle`/`cancel_at_period_end`/`grace_period_ends_at` this session. |
| `subscription_history` | **ACTIVE** (new, write-only audit log) | Every lifecycle transition (`checkout_started`, `subscription_activated`, `payment_failed`, `plan_changed`, etc.) is logged here via `logSubscriptionHistory()`. Nothing reads it back yet — that's expected for an audit trail, not a bug; a future admin screen could surface it. |
| `stripe_webhook_events` | **ACTIVE** (new) | Idempotency ledger for incoming Stripe webhook events, keyed on `stripe_event_id`. |
| `subscription_plans` | **REMOVED** (`2026-08-31_drop_subscription_plans.sql`) | A second, differently-shaped "plans" table from the original baseline schema — never referenced by any backend code (confirmed via full-codebase grep). A hand-written cleanup script (`scripts/delete_subscription_plans_table.sql`) already existed but lived outside `database/migrations/`, so the migration runner never actually executed it and its status on any given database was unknowable from the repo. Replaced with a tracked, idempotent migration (`DROP TABLE IF EXISTS`) so this is now guaranteed applied wherever migrations are run. `scripts/delete_subscription_plans_table.sql`, `scripts/cleanup_subscription_plans_duplicates.sql`, and `scripts/cleanup_duplicate_plan_tables.sql` are all now superseded/dead — kept for historical reference only, do not run them. |

**If you're picking this codebase up fresh: `plans` and `subscriptions` are
the only two tables you need to think about for "what plan is this tenant
on." `subscription_history` and `stripe_webhook_events` are supporting
infrastructure you'll rarely query directly. `subscription_plans` no longer
exists once this migration has run — if you see code or an old doc reference
it, that reference is stale.**
