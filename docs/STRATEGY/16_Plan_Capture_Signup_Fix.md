# Plan Capture in Signup — Audit + Fix (2026-08-31)

The user noticed: clicking "Start Free Trial" from any pricing tier on the landing page
produced an identical signup, regardless of which plan was clicked. This documents what was
found and what was fixed.

---

## 1. What was audited

`frontend/src/pages/LandingPage.tsx` (pricing section) → `frontend/src/pages/SignupPage.tsx`
→ `backend/routes/publicAuthRoutes.js` → `backend/services/signupService.js` →
`plans`/`subscriptions` tables. Also checked `OnboardingWizard.tsx`, `subscriptionService.js`,
`subscriptionMiddleware.js`, and grepped for any Stripe/billing integration.

## 2. Findings

### 2.1 The actual break — one field dropped in one place (highest severity, confirmed)

Of the pricing page's CTAs, only Enterprise's "Contact Sales" passed `?plan=enterprise` in
its link; Starter and Professional both linked to a bare `/signup`. `SignupPage.tsx` does
read `searchParams.get('plan')` into `selectedPlan` state, and even has a full "Choose Your
Plan" picker modal built (`PLAN_CONFIGS`) — but nothing on the page rendered a way to open
it, and, critically, `handleSubmit`'s POST body never included `selectedPlan` at all. The
value was read from the URL and then discarded before the request went out.

Downstream, this was a non-issue by design, not a coincidence:
`backend/routes/publicAuthRoutes.js`'s `/signup` handler never read a plan field from the
body either, and `signupService.js`'s `registerUser()` defaults `selectedPlan = 'professional'`
whenever it's missing — so every real signup silently became Professional no matter what was
clicked, including Enterprise.

### 2.2 Missing "Starter" plan row

The `plans` table (seeded in `2025-06-18_rbac_seed_data.sql`) has Growth/Professional/
Enterprise — no "Starter" row, despite the pricing page and `SignupPage.tsx`'s own
`PLAN_CONFIGS` both naming a Starter tier. `createTrialSubscription()`'s plan lookup
(`SELECT id FROM plans WHERE name = ? AND is_active = 1`) is deliberately non-fatal on a
miss — a lookup failure logs a warning and skips creating a subscription row rather than
failing the whole signup. That's the right behavior for a lookup miss in general, but it
meant a Starter selection silently produced no subscription at all.

### 2.3 What's already correctly built underneath (no fix needed)

`signupService.js`'s plan-handling itself was already solid once given a real value:
`registerUser()` threads `selectedPlan` straight into `createTrialSubscription()`, which maps
the wizard's lowercase key to the DB's display name (`starter` → `'Starter'`, etc.), looks up
the matching `plans` row, and writes a proper `subscriptions` row with `status = 'trial'` and
a `trial_end_date` computed from the shared `TRIAL_LENGTH_DAYS` constant. None of that needed
to change — it just never received a value.

### 2.4 Bigger picture — billing/plan enforcement is unbuilt (not addressed here)

Stepping back further, several things exist only as scaffolding and were deliberately **not**
touched in this pass:

- A second, unrelated `subscription_plans` table sits in the schema, unused by any code —
  dead schema, a trap for a future session (flagged here, not removed, since removing schema
  a current session doesn't fully own the history of is riskier than leaving a comment).
- `subscriptionService.js` / `subscriptionRoutes.js` reference methods and a `payment_method`
  column that don't exist — this code path isn't wired into any live route today, so it's
  dormant rather than actively broken, but would fail if something started calling it.
- `subscriptionMiddleware.js` exports `requireActiveSubscription`/`requireFeature`/
  `withinUsageLimits`, all built but applied to zero routes — nothing today actually enforces
  a tenant's transaction/store/user limits during their trial.
- No Stripe or any other payment integration exists for SaaS billing (the "stripe" hits in
  this codebase are in-store POS payment methods, unrelated). There's no trial-to-paid
  conversion mechanism beyond a raw subscription-status flip.
- `OnboardingWizard.tsx`'s "14 days remaining" trial copy is a hardcoded string, not derived
  from the tenant's actual `subscriptions.trial_end_date`.

These are real gaps, but each is its own scoped feature decision (does the trial need to
actually enforce plan limits day-to-day, or is plan choice just expectation-setting until a
real billing/upgrade flow exists?) — not something to guess at silently while fixing a data
plumbing bug. Recommend treating as separate follow-ups.

## 3. What was implemented this session

1. **Pricing page CTAs now carry the plan.** Starter's and Professional's "Start Free Trial"
   links go to `/signup?plan=starter` and `/signup?plan=professional` respectively
   (`LandingPage.tsx`), matching Enterprise's existing `?plan=enterprise`.
2. **`selectedPlan` is now actually sent to the API.** `SignupPage.tsx`'s `handleSubmit`
   includes `selectedPlan` in the POST body. A "Selected plan" summary card was added above
   the form, showing the plan name/price with a "Change plan" button that opens the existing
   (previously unreachable) plan-picker modal — so the choice is visible and changeable
   instead of silently inferred from a URL param the user never sees again.
3. **Backend accepts and validates the plan.** `publicAuthRoutes.js`'s `/signup` handler now
   reads `selectedPlan` from the request body, validates it against the three known keys
   (`starter`/`professional`/`enterprise`), and passes it through to
   `signupService.registerUser()` — falling back to that service's existing `'professional'`
   default for anything missing or unrecognized, rather than rejecting the signup outright
   over a stale or tampered query param.
4. **Added the missing Starter plan row** (`database/seeds/2026-08-31_starter_plan.sql`,
   idempotent via `INSERT ... SELECT ... WHERE NOT EXISTS`, since `plans.name` has no unique
   key to use `INSERT IGNORE`/`ON DUPLICATE KEY UPDATE`), matching the pricing page's Starter
   copy (1,000 transactions/month, basic reporting, email support, free).

## 4. What was deliberately not implemented

Per §2.4: the dead `subscription_plans` table, `subscriptionService.js`'s broken/unused
methods, wiring `subscriptionMiddleware.js`'s enforcement functions into real routes, any
Stripe/payment integration, and deriving the onboarding trial-countdown copy from the real
`trial_end_date`. Recommend scoping these as their own follow-up once there's a decision on
whether trial-tier enforcement matters before a real paid-conversion flow exists.

## 5. Verification

- `npx tsc --noEmit` clean on the frontend after the `LandingPage.tsx`/`SignupPage.tsx`
  changes.
- `node -c` clean on `publicAuthRoutes.js`.
- Run `cd database && ` (per `database/README.md`'s seed workflow) to apply
  `2026-08-31_starter_plan.sql` against a real database before testing a Starter signup —
  it has not yet been applied to any live database from this session, since sandbox has no
  DB access.
