# Signup, Onboarding & Transactional Email Audit + Fix Plan (2026-08-31)

Consolidates two read-only audits (trial signup flow + email templates, then data
collection + onboarding wizard) into one record, plus the fixes implemented from it in
this session. Written before any code changed, per the user's request to review the plan
first — kept here afterward as the authoritative record of what was found and what was
(and wasn't) done about it.

---

## 1. What was audited

1. The trial signup flow end to end: `frontend/src/pages/SignupPage.tsx` →
   `backend/routes/publicAuthRoutes.js` → `backend/services/signupService.js`.
2. Every transactional email template, all three living in
   `backend/services/emailService.js`.
3. What data is actually collected at signup vs. what's missing, and the post-verification
   onboarding experience: `EmailVerificationPage.tsx`, `OnboardingWizard.tsx`,
   `backend/routes/onboardingRoutes.js`, `QuickStartGuide.tsx`.

---

## 2. Findings

### 2.1 Trial length mismatch (highest severity, confirmed)

`frontend/src/pages/LandingPage.tsx` promises a 14-day trial in four places. But
`backend/services/signupService.js` (`createTrialSubscription`) set the actual trial to
**30 days**, with a comment that literally said "30 days trial." `docs/features/
PUBLIC_SIGNUP_COMPLETE.md` also says 14 days — nothing reconciled the two. This is a real
promise-vs-billing mismatch, not cosmetic.

### 2.2 Business Type / Store Type dropdown — mismatched vocabulary, not actually broken

`OnboardingWizard.tsx` had a hardcoded `businessTypes` list with codes that don't match
`industry_types.code` in the database at all (`'retail'`, `'clothing'`, `'marketstall'`,
`'other'` vs. the real `'general_retail'`, `'apparel'`, `'jewelry'`, `'electronics'`,
`'grocery'`). This looked like a serious bug at first — a tenant onboarding as "Retail
Store" would submit `businessType: 'retail'`, which isn't a real industry code — but
`backend/services/industryMapping.js`'s `toIndustryCode()` already translates the wizard's
marketing-facing vocabulary to the real code (`retail` → `general_retail`, `clothing` →
`apparel`, etc.), so `tenants.industry_code` was in fact ending up correct. Real problems
that remained:
- The wizard's list included `'pharmacy'`, which `industry_types.is_active = 0` deliberately
  excludes from the picker everywhere else (held back pending regulatory review per that
  migration's own comment) — so onboarding let a tenant select an industry Settings won't
  even show as an option.
- The display names didn't match Settings' (`"Jewelry Store"` in the wizard vs. `"Jewelry &
  Bullion"` from the real `industry_types` row) — cosmetically inconsistent, and the two
  screens would drift further apart every time an industry is added/renamed in the DB
  without someone remembering to hand-edit the wizard's copy too.
- `GeneralSettings.tsx` already solves this correctly: it calls `getIndustries()`
  (`GET /api/industry/industries`, DB-backed, `is_active = 1` only) and renders whatever
  comes back. The wizard should do the same instead of maintaining a second, hand-written
  list that can silently drift from the source of truth.
- A separate, genuinely redundant field: Step 3 (Store Setup) had its own **Store Type**
  dropdown using the *same* hardcoded list, whose value was captured but never read by the
  backend (`onboardingRoutes.js`'s `/complete` handler only ever reads
  `businessInfo.businessType` to derive `industry_code`) — the user picks an industry twice
  and the second answer is silently discarded.

### 2.3 Print templates provisioned before industry is known

A background job at signup (`signupService.js`, `setImmediate`) provisions print templates
immediately — before the tenant has told anyone what industry they're in (that only
happens at the end of the onboarding wizard, several screens later). Its own comment
acknowledges this and always provisions **General Retail** templates as a result. Nothing
re-provisioned them once the real industry became known at onboarding completion, so a
jewelry tenant could finish onboarding and still be looking at generic retail receipt/
invoice templates.

### 2.4 Post-verification landing experience

`verifyEmail()` sets `email_verified = TRUE` and issues a JWT immediately — the user is
authenticated before any setup happens. `EmailVerificationPage.tsx` redirects to
`/onboarding` after a 2s delay, but its own success copy said "Redirecting you to sign
in..." — wrong, it's redirecting straight into an authenticated onboarding flow, not a
sign-in page. Small, but a real user-facing inconsistency on the very first screen after
signup.

### 2.5 Email templates — "too much color, not professional"

All three templates (verification, welcome, password reset) are independent `<html>`
blocks in `emailService.js`, each with its own `<style>`, sharing no layout:

| Template | Header/button colors |
|---|---|
| Verification | Purple gradient `#667eea → #764ba2` header, purple button |
| Welcome | Same purple gradient header, but a **green** `#28a745` button, purple-accented cards |
| Password reset | Solid **red** `#dc3545` header and button |

Five unrelated colors across three emails, none tied to the app's actual navy brand
identity used everywhere else in the product. Alarm-red for a routine password reset in
particular reads as a security scare rather than a normal account action. Heavy emoji use
in headers (🚀🎉📊📦👥💳🔒✅). Div-based rather than table-based markup, which is the
standard for reliable rendering in Outlook and other email clients that don't support
modern CSS.

### 2.6 Store address / currency defaults

`stores.address` is set to the literal placeholder string `'Address to be updated'` at
signup, and `tenant_payment_settings.default_currency` is hardcoded `'USD'` regardless of
who's signing up. Both get corrected if the (mandatory, but not route-guarded) onboarding
wizard is completed — Step 2 has an optional address field, Step 3 requires a currency
selection. The placeholder can still reach a printed receipt if a tenant starts selling
before finishing onboarding.

### 2.7 What's missing entirely (not implemented this session — see §4)

No tax configuration step, no team/employee invite step (despite `QuickStartGuide.tsx`'s
own copy promising one), no billing/payment-method collection anywhere for trial-to-paid
conversion, no logo/branding capture (the column exists, never surfaced in onboarding), and
no jewelry-specific onboarding step (metal rates, serialized inventory) despite that being
the product's actual specialty vertical.

---

## 3. What was implemented this session

1. **Business Type dropdown** now fetches the real industry list via `getIndustries()`
   (`frontend/src/services/industryService.ts`), the same call `GeneralSettings.tsx` makes
   — so the two screens can never drift apart again, and `pharmacy` is automatically
   excluded since the API already filters `is_active = 1`. See `OnboardingWizard.tsx`.
2. **Redundant Store Type field removed** from Step 3 — the business type chosen in Step 2
   is now shown there as read-only confirmation instead of asking the same question twice
   with an answer nothing reads.
3. **Trial length reconciled to 14 days** — `signupService.js`'s trial subscription now
   matches the landing page's promise, with a single named constant instead of a magic
   number, so the next place this needs changing only needs changing once.
4. **Print templates re-provisioned after onboarding sets the real industry** —
   `onboardingRoutes.js`'s `/complete` handler now calls
   `templateProvisioningService.provisionTenantTemplates(tenantId, { replace: true })`
   when the resolved industry isn't `general_retail` (the same default the signup-time job
   always provisions), so a jewelry tenant finishing onboarding gets jewelry-flavored
   templates instead of leftover general-retail ones. Scoped to fire only on that one
   transition (industry chosen for the first time, templates still untouched by the
   tenant) rather than reachable from Settings' later industry-change path, which
   deliberately never replaces a tenant's existing templates.
5. **Verification page copy fixed** — no longer claims to redirect to sign-in when it
   redirects to onboarding.
6. **Email templates redesigned** to a single shared layout (`emailService.js`): one navy
   header, one accent color, table-based markup for client compatibility, no emoji, no more
   alarm-red password-reset styling.

## 4. What was deliberately not implemented

Tax configuration, team/employee invites, billing/payment-method collection, and
jewelry-specific onboarding (metal rates, serialized inventory) are all genuine **new
features**, not bug fixes — each would need its own design decisions (what fields, what
validation, whether mandatory) that weren't part of this audit's scope and shouldn't be
guessed at silently. Recommend treating each as its own follow-up with the user's input on
scope before building.

Also not touched: the store-address-placeholder and hardcoded-currency window between
signup and onboarding completion. The wizard already corrects both, and it's positioned as
the mandatory next step after verification — the risk window is small in practice.
Revisit if a tenant is ever observed transacting before finishing onboarding.
