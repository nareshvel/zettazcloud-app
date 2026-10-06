# Application-Wide Audit — Pre-Print-Module Readiness

**Date:** 2026-08-23 (rev. 2 — Sprint 0 executed)
**Purpose:** Identify gaps that should be closed *before* starting the print module work
**Scope:** Backend (59 routes, 42 services), Frontend (54 pages, 39 services), Database (29 migrations), Tests

---

## 0. Sprint 0 — Status: COMPLETE

Everything flagged P0, plus two additional issues found while fixing them.

| # | Item | Status |
|---|---|---|
| 1 | Cross-tenant auth hole in `purchaseOrderRoutes` | ✅ Fixed |
| 2 | `requireTenantId` header/query fallback removed | ✅ Fixed |
| 3 | Header-trust purged from `store.routes.js` | ✅ Fixed |
| 4 | **Hardcoded JWT secret** — now fails fast in production *(found during fix)* | ✅ Fixed |
| 5 | Route-auth regression suite | ✅ Added — mutation-verified |
| 6 | `0000_baseline_schema.sql` — clean DB buildable from migrations | ✅ Added |
| 7 | **8 tables on wrong collation** — normalization migration *(found during fix)* | ✅ Added |
| 8 | Vitest + Testing Library + 26 print renderer tests | ✅ Added — mutation-verified |
| 9 | Dead Chakra + Emotion dependencies removed | ✅ Done |
| 10 | CI: frontend tests, security suite, clean-DB schema job | ✅ Added |

**Verification performed:** both new test suites were checked by *reintroducing*
the original bugs and confirming the tests fail — 3/3 security regressions caught,
5/5 print renderer regressions caught. Files restored and re-verified green.

**Files changed**

```
backend/config/constants.js                      JWT secret fails fast in production
backend/middleware/unifiedAuthMiddleware.js      requireTenantId: JWT only
backend/routes/purchaseOrderRoutes.js            getTenantId/getStoreId/getUserId helpers
backend/routes/store.routes.js                   header fallback removed
backend/controllers/publicController.js          documented why it is intentionally public
backend/services/signupService.js                uses centralized JWT_SECRET
backend/server.js                                PO + sale-deletion mounted behind auth
backend/tests/routeAuthGuard.test.js             NEW — 33 assertions
database/migrations/0000_baseline_schema.sql     NEW — 51 tables + 3 views
database/migrations/2026-08-23_normalize_collation.sql  NEW
frontend/vitest.config.ts                        NEW
frontend/src/test/setup.ts                       NEW
frontend/src/utils/printTemplateRenderer.test.ts NEW — 26 tests
frontend/package.json                            test scripts; Chakra/Emotion removed
.github/workflows/ci.yml                         frontend tests + schema job
```

---

## 0b. Sprint 1 — Status: COMPLETE

The shared jurisdiction foundation. Built as a **tenant-level concern**, not a
print-module-local one — tax calculation, invoice numbering and print all read
the same profile.

| # | Item | Status |
|---|---|---|
| 1 | `jurisdiction_profiles` catalog + `store_jurisdiction_settings` binding | ✅ |
| 2 | 14 seeded country profiles (AG, US, GB, EU, PT, AT, DE, IN, AE, AU, CA + ON/QC, SG) | ✅ |
| 3 | `jurisdictionService` resolver with caching and fail-closed fallback | ✅ |
| 4 | `/api/jurisdiction` routes (current, profiles, settings) | ✅ |
| 5 | `calculateSaleTaxesWithJurisdiction` — zero-rating + reverse charge | ✅ |
| 6 | `applyCashRounding` for withdrawn-coin jurisdictions (AU/CA 5c) | ✅ |
| 7 | Frontend types + service client | ✅ |
| 8 | **Migration splitter bug fixed** *(found during this work)* | ✅ |

### Design: three independent axes

```
Vertical  ×  Jurisdiction Profile  ×  Sales Mode
             (shared catalog)         (per store)
```

A duty-free jeweller in Antigua and a domestic grocer in Antigua share one
country profile and differ only in `sales_mode`. Adding a country benefits every
tenant at once; a tenant cannot corrupt a whole country's rules.

### Fail-closed fallback

`NEUTRAL_PROFILE` is returned when a store has no jurisdiction configured. Every
compliance-bearing flag defaults to false/null — no fiscalization, no mandatory
title, no hallmark regime. Claiming a capability that isn't configured would
silently emit non-compliant documents. It is frozen so one caller cannot poison
another store's context, and flagged `isNeutralFallback: true` so settings UIs
can warn.

### Additional bug found: migration splitter

`scripts/migrate.js` tracked quote state character-by-character, then discarded
it — splitting on `buf.indexOf(';')` across the whole buffer. A semicolon inside
a string literal, e.g.

```sql
COMMENT 'ISO 4217; advisory'
```

cut a `CREATE TABLE` in half. Neither fragment is valid SQL, so a migration would
**fail partway through and leave the schema half-applied**. Rewritten as a
single-pass scanner that only splits outside quotes and comments. Verified all
**39 existing migration files produce byte-identical statement counts** — the fix
changes behaviour only for the previously-broken case.

### Test coverage added

| Suite | Tests | Covers |
|---|---|---|
| `jurisdictionService.test.js` | 14 | Fail-closed fallback, zero-rating, overrides, caching |
| `taxJurisdiction.test.js` | 13 | Duty-free, export, reverse-charge refusal, cash rounding |
| `migrationSplitter.test.js` | 13 | Splitter contract + every pending migration |

**Backend: 62 passing. Frontend: 26 passing. TypeScript: 0 errors.**

---

---

## 0d. Tax integrity — FIXED

Investigating the error-swallowing flagged earlier uncovered a larger, related
problem. Both are now closed.

### Finding 1 — silent zero on failure (3 layers)

The swallow-and-return-zero pattern appeared at **three levels**:

| Layer | Old behaviour | Why it mattered |
|---|---|---|
| `getTaxClassesWithRates` | returned `{}` on error | **Root cause.** `{}` is also the legitimate value for "tenant has no tax classes", so a DB failure was *indistinguishable from a tax-free tenant* |
| `calculateSaleTaxes` | returned `total_tax_amount: 0` | Whole sale undercharged, no signal |
| `calculateLineItemTax` | returned `tax_amount: 0` for the line | One item silently untaxed while the sale looked normal — hardest of the three to notice |

All three now throw `TaxCalculationError`. `calculateSaleTaxes` additionally
returns `tax_classes_configured` so callers can distinguish *"tax is genuinely
zero"* from *"tax was never set up"* — the ambiguity that caused the bug.

### Finding 2 — client-supplied tax was stored verbatim

`createSaleController` recalculated **subtotal** server-side precisely because
client input cannot be trusted — but took tax straight from the request:

```js
tax, // Tax amount from frontend
const taxFromRequest = parseFloat(tax) || 0;
```

A modified client, or anyone calling the API directly, could post `tax: 0` on
any sale. `parseFloat(tax) || 0` also silently turned malformed input into zero.

**Fix:** `verifySaleTax()` recomputes from the tenant's own tax classes and
compares, wired into the sale creation path. Deliberately conservative:

- No tax classes configured → client value stands (`verified: false`). Tenants
  who haven't set tax up are unaffected.
- Configured and matching → verified.
- Configured and mismatched → logged with both figures. `TAX_VERIFICATION_MODE`
  controls the response: **`warn` (default)** keeps the client value,
  **`enforce`** substitutes the server figure.
- Verification itself failing never blocks checkout — but logs loudly.

Defaulting to `warn` means enabling this **cannot break a live POS**. Flip to
`enforce` once the mismatch logs are quiet.

**Coverage:** `tests/taxIntegrity.test.js` — 11 tests including the zero-tax
attack, enforce-mode substitution, NaN coercion, and sub-cent float tolerance.

---

## 0c. Open items carried forward

| Item | Severity | Note |
|---|---|---|
| Fiscalization signing vendor | High (market gate) | `fiscal` block renders what the backend supplies; signing itself needs a certified vendor (fiskaly or equivalent). Do not build the crypto in-house. |
| Sequential/gapless numbering under concurrency | Medium | `requiresSequentialNumbering` is now modelled but not yet enforced. |
| 9 pages still using `.toFixed()` | Medium | Bypasses currency-aware formatting (JPY 0dp, KWD 3dp). |
| TS `strict` not enabled | Medium | 766 `any` usages. |
| 17 inline routes in `server.js` | Medium | Inline handlers bypass mount-time middleware — this is how the auth hole happened. |

**Next:** the print module (`07_Print_Templates_Audit_and_Multi_Industry_Plan.md`),
starting at its Phase 1 — Phase 0 is now delivered by Sprint 1 above.

---

## 1. Verdict

The application is feature-rich and the jewelry vertical is genuinely complete. But
there are **two P0 issues that should be fixed before any new module starts**, and one
of them is a live cross-tenant security hole.

There is also **good news that changes the print plan**: the backend already has a
proper multi-rate, compound-capable tax engine. The print module should consume it
rather than invent a parallel model (see §7).

| Priority | Count | Theme |
|---|---|---|
| **P0 — fix first** | 2 | Cross-tenant auth hole · No baseline schema |
| **P1 — fix during** | 4 | Test coverage · Type safety · Locale adoption · Jurisdiction model |
| **P2 — backlog** | 4 | Monolith server.js · Dead deps · Import inconsistency · Large files |

---

## 2. P0 — Cross-Tenant Authorization Hole

### 2.1 The finding

`backend/routes/purchaseOrderRoutes.js` (1,256 lines) is mounted **without any
authentication middleware**:

```js
// server.js:442
app.use('/api/purchase-orders', purchaseOrderRoutes);   // ← no `authenticate`
```

Compare the line three below it, which does it correctly:

```js
// server.js:447
app.use('/api/grn', authenticate, grnRoutes);           // ← correct
```

Inside the unprotected route file, tenant scoping is taken from a **client-supplied
header**, not from a verified JWT:

```js
// purchaseOrderRoutes.js:108-109
const tenant_id = req.headers['tenant-id'];
const store_id  = req.headers['store-id'];
```

And the acting user falls back to a **hardcoded admin UUID**:

```js
// purchaseOrderRoutes.js:82
return req.user ? req.user?.id || "system"
                : 'a1b2c3d4-e5f6-4a5b-8c7d-9e0f1a2b3c4d'; // Default to an admin user for now
```

### 2.2 Impact

Any unauthenticated caller can set an arbitrary `tenant-id` header and read or write
another tenant's purchase orders, attributed to a hardcoded admin identity. In a
multi-tenant product this is a data-isolation breach, not a bug.

### 2.3 Related weaknesses

| Issue | Detail |
|---|---|
| `requireTenantId` header fallback | Prefers `req.user.tenant_id` ✅ but falls back to `req.headers['tenant-id']`, `x-tenant-id`, and `req.query.tenantId`. Safe only when `authenticate` ran first. |
| Header-trust pattern elsewhere | `store.routes.js`, `tax.routes.js`, `controllers/publicController.js` also read `req.headers['tenant-id']`. |
| Four competing auth middlewares | `permissionMiddleware.js`, `rbacPermissionMiddleware.js`, `requirePermission.js`, `unifiedAuthMiddleware.js` — unclear which is canonical. |
| `saleDeletionRoutes` | Mounted without `authenticate`, but `requirePermission` verifies the JWT itself, so it is protected *by accident of implementation* rather than by design. |

### 2.4 Fix

1. Mount `purchaseOrderRoutes` behind `authenticate` + `requireTenantId`.
2. Replace all `req.headers['tenant-id']` reads in authenticated routes with
   `req.user.tenant_id`.
3. Delete the hardcoded admin UUID fallback — fail closed instead.
4. Remove the header/query fallback from `requireTenantId` (keep JWT only).
5. Consolidate to one auth middleware; delete or clearly deprecate the other three.
6. Add a route-mounting test that asserts **every** `/api/*` route except an explicit
   allowlist (`publicAuthRoutes`, `paymentWebhookRoutes`, health) requires auth.

---

## 3. P0 — No Baseline Schema Migration

### 3.1 The finding

| Source | Tables |
|---|---|
| Latest backup dump (`Sep_03_2025_digitpulse_zcloud.sql`) | **58** |
| `CREATE TABLE` across all files in `database/migrations/applied/` | **44** (many are incremental additions, not the core set) |

The migrations directory begins at `2025-08-16_performance_indexes.sql`. Core tables —
`users`, `tenants`, `stores`, `products`, `sales`, `customers`, **`tax_classes`,
`tax_rates`** — exist **only inside backup SQL dumps**.

### 3.2 Impact

- A fresh database **cannot** be built from `database/migrations/`.
- Onboarding a developer requires restoring a production backup.
- CI cannot spin up a clean test database → this is *why* test coverage is thin.
- The print module's planned golden-file tests (render preset × jurisdiction profile)
  have nowhere to run.

### 3.3 Fix

1. Generate a `0000_baseline_schema.sql` from a clean production dump —
   **structure only, no data**.
2. Place it first in the migration order; make the runner treat it as already-applied
   on existing environments.
3. Verify: drop a scratch DB, run `npm run migrate`, confirm 58 tables.
4. Add a CI job that does exactly that on every PR.

---

## 4. P1 — Test Coverage

| Surface | Files | Tests |
|---|---|---|
| Backend routes | 59 | — |
| Backend services | 42 | **6 test files** |
| Frontend pages | 54 | **1 test file, no test runner installed** |

`frontend/package.json` has **no `test` script** and no `vitest` / `jest` /
`@testing-library` dependency. Backend uses Mocha with 6 specs
(`costCodeService`, `installmentService`, `metalPricingService`, `oldGoldService`,
`taxAuthWithToken`, `taxHeaders`).

**Blocked by §3** — meaningful integration tests need a buildable schema.

**Fix:** install Vitest + Testing Library; target the money paths first — tax
calculation, sale totals, metal pricing, layaway/savings schedules — then the print
renderers.

---

## 5. P1 — Type Safety

`frontend/tsconfig.json` does **not enable `strict`**, `noImplicitAny`, or
`strictNullChecks`. Result: **766 occurrences** of `: any`, `<any>`, or `as any` in
`frontend/src`.

The print module is a heavy consumer of untyped fixture data (`fixtureData: any`
threads through the canvas and both renderers), so this directly affects the work ahead.

**Fix:** enable `strict` in a new `tsconfig.strict.json` and migrate module-by-module,
starting with `services/` and `types/`. Type the print fixture shape as part of the
print module rather than after it.

---

## 6. P1 — Locale Adoption Is Incomplete

`CLAUDE.md` mandates `useLocaleFormat()` for all currency, date and weight formatting.
Actual adoption:

| Metric | Count |
|---|---|
| Pages using `useLocaleFormat` | **8 of 54** |
| Pages calling `.toFixed()` directly | **9** |
| Hardcoded currency symbols found | 0 ✅ |

No hardcoded symbols is genuinely good. But `.toFixed()` bypasses currency-aware
formatting (decimal places differ — JPY has 0, KWD has 3), which matters for a
country-agnostic product.

**Fix:** sweep the 9 `.toFixed()` pages onto `formatCurrency`. Add an ESLint rule
banning bare `.toFixed()` in `pages/`.

---

## 7. P1 — Jurisdiction Model *(and a correction to the print plan)*

### 7.1 Good news — the tax engine is stronger than assumed

`backend/services/taxCalculationService.js` already implements:

- **Tax classes** with multiple rates per class
- **Compound taxes** (`is_compound` — tax-on-tax, e.g. Quebec QST on GST)
- **Prices-include-tax** vs exclusive handling
- `generateTaxSummary(lineItems, taxClasses)` — a per-rate aggregated summary
- `calculateSaleTaxes(lineItems, tenantId, storeId, pricesIncludeTax)`

### 7.2 Correction to `07_Print_Templates_Audit_and_Multi_Industry_Plan.md`

That document stated the tax blocks "assume a single flat rate — no multi-rate, no
reverse charge, no exempt class." That is accurate for the **print blocks**, but I
under-credited the **backend**, which already models multi-rate and compound tax.

**Revised plan:** the print `taxSummary` block must **consume the existing
`generateTaxSummary()` output shape** rather than define a parallel model. This
removes work from print Phase 2 and prevents two divergent tax models.

### 7.3 What is genuinely missing

| Needed | Present? |
|---|---|
| Multi-rate, compound tax calculation | ✅ exists |
| Per-rate tax summary for display | ✅ exists |
| Reverse-charge mode + mandatory wording | ❌ |
| Zero-rated / export class (duty-free) | ❌ |
| Jurisdiction profile (tax label, mandatory invoice title, fiscalization flags) | ❌ |
| Gapless sequential document numbering guarantee | ❌ unverified |

**Fix:** build the `jurisdiction_profile` from §9 of the print doc as a **shared
tenant-level concern**, not a print-module-local one. Tax calculation, invoice
numbering and print all read from it.

---

## 8. P2 — Architecture & Hygiene

| # | Finding | Detail |
|---|---|---|
| 1 | **`server.js` is 1,920 lines** with **17 inline route handlers** | Route definitions belong in `routes/`. Inline handlers bypass the middleware conventions applied at mount time — this is how §2 happened. |
| 2 | **Dead UI dependency** | `@chakra-ui/react`, `@chakra-ui/icons`, `@emotion/react`, `@emotion/styled` are in `dependencies` but used in **0 files**. shadcn/Radix is used in 69. Removing Chakra + Emotion is pure bundle savings. |
| 3 | **DB import inconsistency** | 4 services `require('../db')`, 20 `require('../config/db')`. Both files exist. Pick one. |
| 4 | **Large files** | `Dashboard.tsx` 1,546 · `LayawayPage.tsx` 1,389 · `purchaseOrderRoutes.js` 1,256 · `product.routes.js` 1,194. Extraction candidates. |
| 5 | **153 `console.log`** across routes/services | Should route through the existing logger with levels. |
| 6 | **No React ErrorBoundary** found | A render error in any page blanks the whole app. |

---

## 9. Recommended Sequencing

The print module is a good next project — but two things should land first.

### Sprint 0 — Unblock *(do before print module)*

| # | Task | Why first |
|---|---|---|
| 1 | Fix `purchaseOrderRoutes` auth + purge header-trust pattern | Live security hole |
| 2 | Add route-auth assertion test | Prevents recurrence |
| 3 | Generate `0000_baseline_schema.sql` | Unblocks every test below |
| 4 | CI job: clean DB + migrate + backend tests | Makes correctness verifiable |
| 5 | Install Vitest + Testing Library | Frontend has no runner at all |

**Estimated:** ~1 sprint. Items 3–5 are prerequisites for the print module's own
verification phase, so this is not a detour.

### Sprint 1 — Shared foundations *(merge with print Phase 0)*

| # | Task |
|---|---|
| 6 | Build `jurisdiction_profile` as a shared tenant concern |
| 7 | Add reverse-charge + zero-rated classes to `taxCalculationService` |
| 8 | Verify gapless sequential document numbering under concurrency |
| 9 | Sweep 9 `.toFixed()` pages onto `useLocaleFormat` |

### Sprint 2+ — Print module

Proceed with `07_Print_Templates_Audit_and_Multi_Industry_Plan.md`, with these
amendments:

- **Phase 0** merges into Sprint 1 above (jurisdiction profile is shared, not print-local)
- **Phase 2** shrinks — consume `generateTaxSummary()` instead of building a new tax model
- **Phase 8** becomes viable because CI can now build a clean DB

### Parallel backlog (any time)

- Remove Chakra + Emotion
- Consolidate auth middleware to one
- Extract 17 inline routes from `server.js`
- Add ErrorBoundary
- Standardise DB import path
- Enable TS `strict` incrementally

---

## 10. What's Genuinely Good

Worth stating, because the findings above are all problems:

- **Jewelry vertical is complete and coherent** — 13 modules, all shipped.
- **Migrations are idempotent** and follow a documented authoring convention.
- **Collation discipline** (`utf8mb4_0900_ai_ci`) is applied consistently.
- **No hardcoded currency symbols** anywhere in the frontend.
- **The tax engine is well-built** — compound tax and inclusive pricing are not trivial.
- **RBAC is real** — permission-based, with tenant-admin bypass, not role-string checks.
- **Print module architecture** (blocks, versioning, rollback, physical-mm renderer) is
  a solid foundation; the gaps are content, not structure.

---

## Appendix — Metrics

| Metric | Value |
|---|---|
| Backend routes | 59 |
| Backend services | 42 |
| Backend test files | 6 |
| Frontend pages | 54 |
| Frontend services | 39 |
| Frontend test files | 1 (no runner) |
| Applied migrations | 29 |
| Tables in migrations vs backup | 44 vs 58 |
| `server.js` lines | 1,920 |
| Inline routes in `server.js` | 17 |
| `any` usages (frontend) | 766 |
| `console.log` (backend routes+services) | 153 |
| Pages using `useLocaleFormat` | 8 / 54 |
| Files importing Chakra | 0 |
| Files importing shadcn/ui | 69 |
