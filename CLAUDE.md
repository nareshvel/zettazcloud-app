# Zettaz Cloud — Project Reference for AI Sessions

Quick-reference for any new AI session picking up this codebase. Read this first,
then consult the linked docs for depth.

**This project is worked on across multiple AI tools (Claude, Devin, Codex, Cursor)
with no fixed order.** Before doing nontrivial work, also read
`docs/AI_CONTEXT/HANDOFF_PROTOCOL.md` and the last few entries of
`docs/AI_CONTEXT/SESSION_LOG.md` — they're the cross-tool handoff mechanism that
keeps a session in one tool from disrupting or duplicating work started in another.
Append a session-log entry before ending any nontrivial session, and keep this
file's "Module status" / "Known pending work" tables in sync with reality as you go.

`docs/` was reorganized 2026-09-09 into a fixed taxonomy — see `docs/README.md` for
what's where (`ARCHITECTURE/`, `MODULES/`, `FEATURES/`, `STRATEGY/`, `DECISIONS/`,
`HANDOFF/`, `ISSUES_FIXES/`, `TESTING/`, `CLIENTS/`, `archive/`, `AI_CONTEXT/`). All
doc paths below reflect the new structure.

Also check `/AGENTS.md` at the repo root — it holds tool-agnostic operational
specifics this file doesn't duplicate (MySQL connection-pool limits on the shared
host, Print Agent macOS build/notarization steps, production PM2 deployment
details, npm audit override history). Codex/Cursor sessions read `AGENTS.md` by
convention; it now points back here too, so either file gets you to both.

---

## What is this?

Multi-tenant jewelry POS/ERP (React + Node/Express + MySQL). Supports general retail
with a deep jewelry vertical (serialized inventory, metal rates, old gold, memos,
repairs, savings schemes).

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Backend | Node.js, Express, MySQL 8 (utf8mb4_0900_ai_ci) |
| Auth | JWT; `authenticate` + `requireTenantId` middleware on all routes |
| API convention | snake_case in DB/backend; `fetchApi` auto-converts to camelCase on frontend |
| Industry gating | `requireIndustry(['jewelry'])` middleware; `<IndustryRoute>` in frontend |

---

## Critical conventions

### Backend
- `fetchApi` unwraps `{ status: 'success', data: ... }` automatically — never double-unwrap.
- MySQL collation **must** be `utf8mb4_0900_ai_ci` on every table — mismatches cause `Illegal mix of collations`.
- Express route ordering: **literal routes before wildcard `/:id`** (e.g. `/fetch-market` before `/:id`).
- All migrations are idempotent (`INFORMATION_SCHEMA.COLUMNS` check + `PREPARE/EXECUTE`).
- Run migrations: `cd backend && npm run migrate` (or `npm run migrate:status` to preview).
- Demo tenants: `npm run migrate:demo`. Files named `*.demo.sql` hold demo data and are
  **skipped** by a plain `migrate`, so demo companies can never appear in a real database.
- MySQL tracks **column** collation separately from **table** collation. `ALTER TABLE … CONVERT TO`
  fixes both; changing the table default alone leaves explicit column collations behind, which is
  how the `Illegal mix of collations` hazard survived a "collation normalised" migration.
- Duty-free config lives in `store_jurisdiction_settings.sales_mode` + `jurisdiction_profiles` +
  print template blocks. The old `duty_free_profiles` subsystem was removed 2026-08-25 — do not
  reintroduce a second home for it.
- The `dutyFree` print block carries traveller identification only (traveller ID + travel
  method, store-configurable — not every traveller has a passport or flies in, e.g. Caribbean
  cruise traffic on a seaman's book/vessel). The export declaration text lives in the
  `compliance` block instead, sourced from the jurisdiction profile — don't put jurisdiction
  legal text back on the `dutyFree` block.
- `createSaleController.js` is the ONLY place a real sale's tax gets zero-rated. It resolves
  `jurisdictionService.getJurisdictionProfile(tenantId, storeId)` server-side and forces
  `tax = 0` whenever the store's `zeroRated` is true (duty_free/export) — never trust a
  client-posted tax figure for this. `calculateSaleTaxesWithJurisdiction` in
  `taxCalculationService.js` is unit-tested but has NO other caller; if you add a new sale
  creation path, it must go through the same zero-rating check or duty-free stores will
  silently start charging tax again. `sales.sales_mode`/`sales.zero_rate_reason` are frozen
  onto the sale row at creation time — don't re-derive them from the store's current setting
  on reprint.
- `createSaleController.js`'s payment-method check accepts any `payment_method_id` that
  isn't already a recognized system code (`cash`/`card`/`phone`/`on_account`/`none`/
  `stripe`/`paypal`) by resolving it against an active `payment_methods` row scoped to the
  authenticated tenant — that row's existence is sufficient, full stop. **Treat payment
  method IDs as opaque tenant-scoped strings, not UUIDs** — demo/seeded IDs like
  `demo0001-jw00-0000-0000-00000000pm1` are valid but aren't RFC UUIDs, so don't reintroduce
  a `/^[0-9a-f]{8}-.../i` format gate before doing the DB lookup (fixed twice, 2026-08-25: the
  first pass added the DB lookup but only ran it for strings that passed a UUID regex; the
  second pass, via Devin IDE, removed that regex gate entirely). Don't gate any of this behind
  the `VALID_PAYMENT_METHODS`/`codeMapping` constants either; those exist only to normalize
  onto the few codes the "none"/$0.00-total special case checks for, and as a fallback for
  legacy system-code callers.
- Inventory deduction for a sale happens **inside `createSaleController.js`'s own
  transaction** — it locks each non-piece line item's product row (`SELECT ... FOR UPDATE`),
  decrements `stock_quantity`, and inserts the `stock_adjustments` row, all before commit.
  There is no separate client-side stock call — `Cart.tsx` used to `PATCH
  /api/products/:id/stock` after checkout, which made a successful sale with failed
  inventory possible; don't reintroduce that. Serialized pieces still go through their own
  piece-status sync path, unaffected. `stock_adjustments.product_id`/`user_id` are
  `CHAR(36)`, matching `products.id`/`users.id` — if you see `Cannot add or update a child
  row ... stock_adjustments_ibfk_*`, check for a column type mismatch before anything else
  (fixed 2026-09-02, see `06_Implementation_Changelog.md` "Iteration 16.6").
- `auditLogService.js` exports `logActivity` as a compatibility adapter over
  `logAuditEvent` — several callers (including `createSaleController.js`) use the
  `logActivity` name. If you see `TypeError: logActivity is not a function`, the export was
  removed or a stale build is loaded; don't just switch callers to `logAuditEvent` instead of
  restoring the adapter, other callers depend on the `logActivity` shape.
- `showReceiptForSale(sale, options)` takes an **options object**
  (`{ mode: 'print' | 'view', disableFallback?: boolean }`), not a boolean second argument —
  an older call shape (`showReceiptForSale(sale, true)`) will fail TypeScript.
- `Login.tsx`'s `getRedirectPath` is the ONLY place that decides where a user lands after
  signing in (there is no other post-auth redirect in the app). It's `async` because it
  resolves the tenant's industry via `getTenantIndustry()` for non-admin, `sales.create`
  users — jewelry tenants land on `/sales-hub`, every other industry goes to `/pos`, matching
  the pre-existing behavior. A failed industry lookup fails open to `/pos`, never blocks login.
- **RBAC login pipeline had two independent bugs (found/fixed 2026-08-28/29) that silently
  downgraded a correctly-resolved role to a generic one.** Watch for this *class* of bug — a
  "safety net" fallback that fires on a by-design-empty field rather than a truly missing one
  — any time login-derived permissions look wrong:
  1. `unifiedAuthMiddleware.js`'s login handler used to clobber `roleNames`/`permissions` to
     `['user']`/`['dashboard.view']` whenever `roleNames.length === 0 OR permissions.length
     === 0`. A Tenant Admin role has zero explicit `role_permissions` rows **by design**
     (tenant admins bypass permission checks by role name in `rbacPermissionMiddleware`), so
     this OR tripped on every Tenant Admin login. Fixed to `AND`.
  2. The real, more dangerous bug was frontend-only, in `authService.ts`:
     `getActualBackendUserData()`'s inner `findSourceObject()` correctly resolved
     `roles`/`roleNames`/`systemRoles`/`permissions` from the login response, but the OUTER
     function then reconstructed a brand-new object from an explicit field whitelist that
     never included those fields — silently dropping `["Tenant Admin"]` to `undefined` right
     before `mapBackendDataToUser` ran. Fix: add `roles`/`roleNames`/`systemRoles`/
     `permissions` to that whitelist reconstruction. This second bug alone produced the actual
     "Tenant Admin sees a stripped-down UI" symptom — the backend response and bug #1's fix
     were both already correct in isolation. Diagnosed only after adding temporary
     `console.log`s at both the inner and outer return points and comparing live output;
     static tracing wrongly predicted the function "should already work" twice before that.
- **Always run `npm run migrate:status` before testing a feature that just added a
  migration** — "the migration file exists and passed `migrationSplitter.test.js`" is
  not the same claim as "it has been applied to the database you're about to test
  against." Print Module Phase 1 shipped two migrations in the same session; the first
  was run, the second was written afterward and forgotten, producing a live
  `ER_BAD_FIELD_ERROR` on `stores.default_sale_document_type` (Iteration 17.2). This is
  not a hypothetical — it happened.
- **Print Module Phase 1 (2026-08-25/26)**: POS checkout now prints EXCLUSIVELY through
  `print_templates` (the Print Template Designer) — `receiptService.ts`'s hardcoded
  `generateReceiptHtml`/legacy return-slip HTML were deleted, not flagged off. A store with
  no published `receipt` (or, for a sale printing as an invoice, `invoice`/`jewelry_invoice`)
  template now gets a clear thrown error instead of a silent fallback. Before touching any of
  this, run `cd backend && npm run provision:missing-templates:dry` — if it reports missing
  templates for a real tenant, run it for real (drop `:dry`) before anything else, or that
  tenant's checkout will break. See `docs/MODULES/print-module/PHASE_1_STORE_LEVEL_ROUTES.md`.
- **Printer Settings redesign source of truth:**
  `docs/MODULES/print-module/PRINTER_SETTINGS_UX_AND_LOGIC_REDESIGN_PLAN.md`. The route family
  (`receipt`/`invoice`) is not the same taxonomy as `print_templates.template_type`;
  the Invoice route may select `invoice` or `jewelry_invoice`, while refunds remain
  `return`. Print Templates stay the only renderer. Iteration 17.3 fixed the previously
  confirmed runtime gaps: the saved route `template_id` now reaches the renderer and
  `auto_print` now controls preview versus automatic initiation. An explicit compatible
  published route `template_id` is authoritative; `is_default` is fallback/provisioning
  metadata and must not override it. The redesigned page and runtime are automated-test
  complete but still require Phase G field QA before being called field-proven.
- New table **`print_document_settings`** (NOT `print_routes` — a dormant, unrelated table of
  that name already exists in this database from an earlier partial build of the full
  blueprint's routing model; see the migration file's header). One row per
  `(tenant, store, document_type)` for `document_type IN ('receipt','invoice')` — delivery
  mode, printer name, paper width, template, copies, enabled, auto-print. Backed by
  `printDocumentSettingsController.js` / `printDocumentSettingsService.ts`. The OLD
  `printer_settings` table + `getPrinterSettings`/`updatePrinterSettings`
  endpoints are kept **read-only, for a rollback window only** — do not write new features
  against them, and do not add new columns there.
- `stores.default_sale_document_type` (`'receipt' | 'invoice'`) decides whether a completed
  POS sale prints as a receipt or an invoice — a retail-profile fact about the store (same
  category as `industry_code`/`is_duty_free`), not a `print_document_settings` column. Read
  via `GET /settings/print-document-settings/:storeId`, written via
  `PUT /settings/print-document-settings/:storeId/default-format`.
- The retired **`receipt_templates`** table/CRUD (`getReceiptTemplates` etc.) is gone from
  both backend and frontend — it backed a "Receipt Template" dropdown that only ever showed
  "Default Template" because nothing wrote rows into it. Do not reintroduce it; the real
  template list is `GET /print-templates?template_type=receipt`.
- `useReceipt.ts` resolves an `effectivePrinterSettings` object per-call from
  `print_document_settings` (mapping `deliveryMode: 'local_agent'` → the legacy
  `print_mode: 'local-agent'` string `printReceipt`/`printReceiptToNetworkPrinter` still
  expect) and passes it EXPLICITLY into `printReceipt(...)` — never pass `undefined` there
  again, that makes `printReceipt` silently re-fetch the deprecated `printer_settings` row
  internally and ignore everything configured in the new Printer Settings UI.
- `printReceipt(html, css, printerSettings, receiptData, storeId, disableFallback, copies)` —
  `copies` (new, last param, default 1) is only honored for `local_agent`/`direct` delivery by
  looping the underlying print call; a browser print dialog's copies field is user-controlled
  and cannot be preset, so `copies` has no effect when `deliveryMode === 'browser'` (the
  Printer Settings UI shows this as a hint, doesn't hide the field).
- **Print Agent v2 (2026-08-26):** `print-agent/` is now Go-only. The unused Electron
  implementation, Node dependencies, old installers, and duplicate frontend agent module
  were deleted with approval. API: `/v1/health`, `/v1/printers`, `/v1/jobs`,
  `/v1/jobs/:id`; PDF for system/page printers, RAW ESC/POS/ZPL/TSPL for thermal/labels.
  The frontend Local Agent path renders PDF lazily and posts/polls v1 jobs. Pairing,
  persistent queue/recovery, retry/cancel, diagnostics/logging, Windows PDF/RAW,
  service/LaunchAgent lifecycle, and installer scaffolding are implemented. Agent
  2.0.0-dev is not customer-ready until signing/notarization credentials, the SumatraPDF
  bundling/license decision (or replacement), tray/menu-bar polish, clean-installer QA,
  auto-update, and physical printer certification are complete.
  See `docs/MODULES/print-module/PRINT_DELIVERY_AND_AGENT_COMPLETION_PLAN.md`.
- **Print Agent origin/CORS model reworked (2026-08-29)** — three layered fixes in
  `print-agent/internal/agent/`, all needed together:
  1. `config_store.go`'s `Pair()` used to REPLACE `AllowedOrigins` with a single origin on
     every pairing, so pairing from a new origin (e.g. `localhost:5173` during dev) silently
     un-paired production. Changed to additive (`containsOrigin` + append).
  2. `server.go`'s `cors()` middleware only ever read the static, startup-only
     `s.config.AllowedOrigins` (from the `ZETTAZ_AGENT_ALLOWED_ORIGINS` env var) and never
     read `ConfigStore.Origins()` at all — meaning neither the old nor the new `Pair()` logic
     could ever have affected real enforcement. Fixed to check both lists.
  3. Even after #2, a brand-new/untrusted origin still couldn't reach `/v1/health` or
     `/v1/pair` to discover/pair the agent in the first place — a chicken-and-egg deadlock
     pre-existing in the original design. Fixed by exempting `/health`, `/v1/health`, and
     `/v1/pair` from the origin gate (their real security boundary is the one-time pairing
     code, not origin).
  **Unverified**: no Go toolchain was available to compile-check these changes in the session
  that made them — they were reviewed by hand and verified by the user rebuilding/deploying
  locally (confirmed working via live pairing on both `cloud.zettaz.com` and `localhost:5173`
  at agent v2.3.6). Run `go build ./... && go vet ./...` in `print-agent/` as a first step
  before trusting this area further.
- **`useOptionalStore()`** (`frontend/src/contexts/StoreContext.tsx`) — non-throwing sibling
  of `useStore()`, returns `undefined` instead of throwing when no `StoreProvider` is mounted.
  `/print-agent` is a deliberately PUBLIC route, registered in `App.tsx` outside
  `<ProtectedRoute><AppProviders>...` (so a browser can pair the agent without logging in) —
  any component reachable from `PrintAgentPage` (e.g. `PrintAgentFleetSection.tsx`, and
  transitively `useLocaleFormat.ts`, which it calls) must use `useOptionalStore()` with `?.`
  chaining, never the throwing `useStore()`, or that page crashes with "useStore must be used
  within a StoreProvider" for every unauthenticated visitor.
- **Subscription billing (Stripe, added 2026-08-31):** `plans` and `subscriptions` are the
  only two tables that matter for "what plan is this tenant on" — full architecture in
  `docs/STRATEGY/17_Stripe_Billing_Module.md`. `subscription_plans` (a second,
  differently-shaped, never-referenced "plans" table from the original baseline schema) is
  **removed** by `database/migrations/2026-08-31_drop_subscription_plans.sql` — if you see code
  or an old doc reference it, that reference is stale; do not resurrect it.
  `requireActiveSubscription()` (`backend/middleware/subscriptionMiddleware.js`) is mounted
  globally in `server.js` and **fails open** on a tenant with zero `subscriptions` rows — every
  tenant created before this module existed has zero rows (their trial was never backfilled),
  so treating a missing row as "blocked" locks out the entire pre-existing user base, not just
  genuinely lapsed subscribers. Run `backend/scripts/backfill-missing-subscriptions.js` once
  against a real database to close that gap; until it's run, some tenants pass through this
  guard on the fail-open branch rather than a real active-subscription check — this is by
  design, not a bug, but don't tighten that branch to fail closed without running the backfill
  first or you will reproduce the exact lockout this note exists to prevent.
- **Login page silently "refreshed" on a wrong password (2026-09-01) — not a backend bug.**
  `frontend/src/services/api.ts`'s `fetchApi()` force-redirects to `/login` via
  `window.location.href` on ANY `401` response, treating it as an expired/invalid session — but
  a failed login attempt itself returns `401 {"error":"Invalid credentials."}`
  (`unifiedAuthMiddleware.js`), which is an expected response, not a session-expiry signal. The
  hard redirect fired before `Login.tsx`'s own error UI ever rendered, making a wrong password
  look like an unexplained crash/refresh with no visible error — and DevTools' Network/Console
  tabs looked empty too unless **Preserve log** was enabled first, since the reload wiped them.
  Fixed across `api.ts` (both the inline 401 check AND a second one in the outer `catch` block —
  this bug existed in two places in the same file, don't assume one grep hit is the whole fix),
  `authService.ts` (removed a leftover debug `alert()`), and `Login.tsx` (stopped overwriting the
  server's specific error message with a generic fallback). Full diagnostic path and the two
  other real-but-unrelated bugs found along the way (subscription-cache pool exhaustion,
  `tax_class_rates` provisioning) are in
  `docs/HANDOFF/2026-09-01-login-refresh-and-multistore-current-store-fixes.md`.
- **`GET /api/stores/settings` ignored `store_id` for multi-store tenants (2026-09-01).** No
  `authenticate` middleware of its own, filtered only `WHERE tenant_id = ? LIMIT 1` with no
  `ORDER BY` — always returned the tenant's first/oldest store regardless of which one was
  active, so the TopBar's "Current Store" label could show a different store than the one
  checked in "Switch Store" (a separate, correctly store-scoped endpoint). Fixed to accept/filter
  by `store_id`; `StoreContext.tsx`'s `fetchStore()` now sends it explicitly. See the same doc
  above.
- **Stripe webhook route ordering:** `backend/routes/stripeWebhookRoutes.js` is mounted with
  `express.raw({type:'application/json'})` **before** the global `express.json()` in
  `server.js` — Stripe signature verification needs the exact raw bytes. Reordering this is the
  single most common way to silently break Stripe webhook signature verification.
- **Multi-store data sharing (2026-09-08/09-01)**: full design/status in
  `docs/STRATEGY/20_Multi_Store_Data_Sharing_Model.md`. Base + override
  pattern: `products.store_id IS NULL` = tenant-wide shared product; `store_id` set = store-
  owned. `store_product_listings` is the per-store override table for a shared product's
  price/stock/active flag AND its own cost tracking (`weighted_average_cost`,
  `total_quantity_received`, `last_received_cost_price`, `last_received_date`) — per explicit
  product-owner direction, sharing a product shares its identity/details only, never
  price/cost/receiving history, which stay strictly per-store. `storeProductListingService.js`
  (`receiveStock`/`reverseStock`/`upsertListing`/`resolveEffectiveProduct`) is the one place
  that branches store-owned vs. shared for GRN receiving, sales returns, sale-deletion
  reversal, and stock adjustment — route new stock-mutating code through it rather than
  writing directly to `products.stock_quantity` or `store_product_listings.stock_quantity`.
  A missing `store_product_listings` row for a shared product at a given store means
  listed/visible (fail-open), matching `upsertListing`'s own `is_active` default. New
  products are **shared by default** (`ProductFormModal.tsx`'s checkbox is an opt-OUT,
  "Restrict to this store only"); a shared product can be hidden from one store via a
  per-store "Unlisted" toggle without affecting other stores. A brand-new store legitimately
  starts with an empty product list if the tenant's existing catalog predates multi-store —
  those older products are still store-owned, not shared; `POST /api/products/share-existing`
  (`storeProductListingService.shareExistingStoreOwnedProducts`, surfaced as "Share existing
  products" in Profile → Stores' `StoresTab.tsx`) is the one-time, manual bulk conversion that
  fixes this without disturbing the owning store's existing stock/price/cost history. Bulk
  product import (`ProductImport.tsx`) supports the same sharing choice, plus industry
  attribute columns (→ `products.attributes` JSON, resolved via `industryFieldService.js`),
  weight/cost-code pricing columns (`purchase_price`/`handling_cost_pct`/`markup_pct`, same
  `costCodeService.js` computation the manual form uses), and serialized piece import (a
  "Piece Barcode/Serial" column creates a `product_pieces` row via `POST /api/product-pieces`
  instead of setting a flat stock count). **Not yet done**: none of this multi-store or import
  work has been exercised against a live database — verification so far is `node -c`/
  `tsc --noEmit` only. The outbound catalog-sync feed (`catalogSync.routes.js`) is explicitly
  on hold, still reading `products.price`/`stock_quantity` with no store concept at all.
  Bulk import's duplicate-SKU check now fetches the tenant's catalog ONCE per import run and
  looks SKUs up from an in-memory `Map` (`ProductImport.tsx`) instead of calling
  `getProductBySku()` — which itself re-fetches the whole catalog — once per row; this was a
  real N+1 (500-row import = 500 full-catalog requests before this fix).
- **Storage plan limit (2026-09-01)**: `limits.storage` on every seeded plan is a human string
  (`'500MB'`/`'1GB'`/`'20GB'`, see `database/seeds/applied/2025-06-18_rbac_seed_data.sql` and
  `2026-08-31_starter_plan.sql`), never bytes — `backend/utils/storageSize.js`'s
  `parseSizeToBytes()`/`formatBytes()` are the ONLY place that should parse/format it; don't
  compare it directly against a byte count. `backend/services/storageUsageService.js`'s
  `getTenantStorageBytes(tenantId)` computes real usage by recursively summing
  `backend/uploads/<tenantId>/` on disk — every tenant upload (product images, category
  images, generic attachments, user avatars) already lands under that one tenant-scoped
  subtree (see multerConfig.js / storageService.js), so this needed zero schema changes or
  backfill. This walks the filesystem, not a DB `SUM()` — fine for a write-path check, would
  need rethinking if upload volume ever makes that walk slow. `subscriptionService.js`'s
  `getSubscriptionUsage()` `storage` entry (previously a permanent `used: 0` stub) now reports
  the real number. Two different enforcement shapes exist because file size isn't known until
  multer has already written/buffered it:
  - `withinUsageLimits('storage', ...)` (the same count-then-create pattern products/users/
    stores use) does NOT apply here — there's no "count" to check before the upload exists.
  - `enforceStorageLimitAfterUpload(getUploadedFilePath)` (`subscriptionMiddleware.js`) — for
    `multer.diskStorage` routes (product/category images), runs AFTER multer, checks tenant
    usage post-write, and deletes the just-written file + 402s if the plan cap is now
    exceeded. Wired into `product.routes.js` POST/PUT and `category.routes.js` POST/PUT.
  - A pre-write inline check (`attachments.routes.js` POST, `userRoutes.js` POST
    `/me/avatar`) — these two buffer in memory (`multer.memoryStorage()`) before calling
    `storageService.save()`, so `currentBytes + req.file.size > limitBytes` can be checked
    BEFORE anything is written, no rollback needed.
  Both paths fail open on a missing subscription/plan/unparseable limit, matching every other
  usage-limit check in this file. **Not yet tested against a live database or real uploads.**
- **Production incident (2026-09-01): login hung for a multi-store tenant, root-caused to
  DB connection-pool exhaustion, not a code bug.** `requireActiveSubscription()` (mounted
  globally on every `/api` request) called `subscriptionService.getActiveSubscriptionForTenant()`
  on EVERY authenticated request with zero caching — 2 fresh queries
  (`subscriptions`+`plans`) per call. `DB_CONNECTION_LIMIT` (backend/config/db.js) was only 8,
  with `queueLimit: 0` (wait forever, no timeout) — a two-store tenant's dashboard fires
  noticeably more concurrent per-store queries than a single-store one, so it exhausted the
  pool first, and a queued login request just hung silently with no error, looking exactly
  like a broken login. Fixed two ways: (1) `subscriptionService.js` now caches
  `getActiveSubscriptionForTenant()` (15s TTL) and `getPlanById()` (5min TTL) in-process, with
  explicit invalidation on every write path including all 5 Stripe webhook handlers — this is
  a single-process `Map`, so it does NOT invalidate across PM2 cluster instances if this app
  is ever scaled horizontally; (2) `DB_CONNECTION_LIMIT` raised from 8 toward the account's
  `max_user_connections` ceiling — **check that ceiling on your specific MySQL host before
  raising this** (a shared-hosting account here capped at 20 total; setting the pool above
  that made things worse, not better, since MySQL itself starts refusing/stalling new
  connections at the account cap regardless of the app-side pool config). Full incident
  writeup: `docs/STRATEGY/18_Plan_Limits_Enforcement.md` §6.1.

### Frontend
- **`useLocaleFormat()`** — always use this for formatting. Never hardcode currency symbols, date formats, or weight units.
  - `formatCurrency(n)` — org-aware currency
  - `formatDate(d)` — org-aware date
  - `formatWeight(grams, dp=3, showUnit=true)` — converts from grams (DB unit) to org display unit
  - `weightUnitLabel` — string label for the current unit (g / oz / tola / etc.)
- **`useStore()`** from `@/contexts/StoreContext` — provides `store.currencyCode`, `store.countryCode`, `store.name`, etc.
- Weight is **always stored in grams** in the DB. `formatWeight` converts for display.
- Cost codes are cipher text — never decode, just display as-is.
- Print functions: `window.open('', '_blank') + document.write(html) + setTimeout(() => win.print(), 400)`.

---

## Key files

### Services (frontend)
| File | Purpose |
|---|---|
| `frontend/src/services/api.ts` | Base `fetchApi`, snake↔camelCase conversion |
| `frontend/src/services/jewelryOpsService.ts` | Memo, Layaway, Savings Schemes, Metal Rates, Attachments, Catalog |
| `frontend/src/services/memoPrintService.ts` | Thermal slip + A4 acknowledgement print |
| `frontend/src/services/labelService.ts` | Barcode / ZPL / TSPL label printing |
| `frontend/src/services/printDocumentSettingsService.ts` | Print Module Phase 1 — `print_document_settings` CRUD (receipt/invoice delivery config) + `stores.default_sale_document_type`. The real settings store; `printerService.ts`'s `getPrinterSettings`/`updatePrinterSettings` are deprecated, read-only rollback path |
| `frontend/src/services/receiptService.ts` | `getReceiptForSale`/`getReceiptForReturn` — render EXCLUSIVELY via `renderSaleWithTemplate`/`renderReturnWithTemplate` (print_templates). No hardcoded fallback HTML exists any more; throws if no published template resolves |
| `frontend/src/services/templateReceiptService.ts` | Bridges a real sale/return to a published `print_templates` document; returns `null` on any failure so the caller can decide how to fail (receiptService.ts throws rather than silently substituting a document) |
| `frontend/src/services/productPieceService.ts` | Serialized piece service |
| `frontend/src/hooks/useLocaleFormat.ts` | All locale formatting (currency, date, weight) |
| `frontend/src/hooks/useIndustry.ts` | Industry gating, cached in localStorage |
| `frontend/src/utils/printTemplateRenderer.ts` | Actual print/PDF output (`buildPrintableHtml`) |
| `frontend/src/components/print-templates/TemplateCanvas.tsx` | On-screen designer preview — must stay in parity with the renderer above |
| `frontend/src/utils/salesModeRules.ts` | Gift/duty-free/reprint suppression rules, shared by both renderers |
| `frontend/src/pages/SalesHubPage.tsx` | **Redesigned 2026-08-29 to a "search-first" model** (superseding the earlier bento-grid version described below): 2 hero tiles (New Sale, Duty-Free Sale — no existing record needed) + 1 universal search bar (`GET /api/sales-hub/search`, debounced 300ms) that surfaces a matched customer's whole relationship (repairs, old gold, memos, layaway, savings, sales) with contextual per-record actions, + a permission-filtered "Start something new" row of 7 shortcuts. `effectiveUser` falls back to cached `localStorage.currentUser` (mirrors `Sidebar.tsx`'s pattern) in case `AuthContext.user` is transiently null. `ACTION_DESTINATION`/`RECORD_TYPE_PATH` maps route each record's action to a destination page + quick-action state. `goToRecord()` navigates with `{quickAction:true, fromSalesHub:true, presetQuery?, presetRecordId?, quickActionType?}` (see quick-action contract below). Sale records get a separate `Eye`-icon button (not nested inside the action button — avoids invalid nested-`<button>` HTML) that calls `useReceipt().showReceiptForSale({id}, {mode:'view'})` and renders `<ReceiptModal>` inline for a print-preview "View sale details" popup. Sale record labels use `s.document_number \|\| '#'+id.slice(0,8)` — never the raw column, which is `NULL` for pre-migration demo sales and stringifies to the literal text "null" in a template literal. |
| ~~Sales Hub bento-grid version~~ | Superseded 2026-08-29 by the search-first model above (kept here for history): fullscreen route (no AppLayout, like `/pos`), chromeless (no `<header>`), time-of-day gradient mesh background, 10-tile grid mapping 1:1 to backend modules, no search. Replaced because most Hub actions actually begin with "find an existing customer/record," which the tile model made cashiers re-search for separately inside each destination page. |
| `frontend/src/pages/DutyFreeIntakeModal.tsx` | Two-column duty-free intake opened from the Hub — Customer (required) on the left, Traveller ID + travel method on the right. Existing customer: `CustomerSearchSelect` search, result rendered as a bespoke labeled card (Name/Code/Type/Phone/Email/Address), not the component's own compact chip. New customer: inline name/contact/address form with no submit button of its own — `createCustomer()` only fires inside `handleContinue`, together with `setSelectedCustomer`/`setTravellerContext` and the `/pos` navigation, so create-and-continue is one click. Search stays live above the new-customer draft so a cashier can still switch to an existing match. Departure Date uses `components/ui/DatePickerInput` (tenant `dateFormat`, capped 4-digit year) instead of a native date input. Traveller fields (ID Number, Issuing Country, Flight/Vessel/Reference, Destination, Departure Date — Detail stays optional) are mandatory too: `handleContinue` blocks and shows both the customer- and traveller-required messages together if either is incomplete, never creating a customer for a sale that can't proceed |
| `frontend/src/components/customers/CustomerSearchSelect.tsx` | Reusable customer search/select + inline quick-add; exports `mapCustomerHitToCustomer()`, the single `CustomerHit → Customer` conversion shared by `POSScreen.tsx` and `DutyFreeIntakeModal.tsx` — don't reintroduce a second inline copy |
| `frontend/src/contexts/CartContext.tsx` | `travellerContext`/`isDutyFreeStore` state — the latter drives the cart's tax-exemption display for a duty-free store |
| `frontend/src/services/salesHubService.ts` | `searchSalesHub(query)` for the search-first Sales Hub; types `SalesHubRecordType`/`SalesHubAction`/`SalesHubRecord`/`SalesHubCustomer`/`SalesHubSearchResult` |
| `frontend/src/services/salesService.ts` | `searchSales()` + `SaleSearchResult` — backs the Sales Return Step 1 live search (name/email/phone/document number), replacing raw internal Sale ID entry |
| `frontend/src/components/returns/ReturnProcessingModal.tsx` | Sale lookup step now live-searches via `searchSales()`; accepts `presetQuery`/`presetRecordId` props for quick-action deep-linking with auto-select-on-single-match |
| `frontend/src/contexts/StoreContext.tsx` | Exports both `useStore()` (throws without a provider) and `useOptionalStore()` (returns `undefined` instead) — use the latter in any component reachable from a public route (see Critical conventions) |

### Services (backend)
| File | Purpose |
|---|---|
| `backend/services/printTemplateService.js` | `DEFAULT_BLOCKS` per template type, `withDutyFreeVisible`, `blocksForReset` |
| `backend/services/templateProvisioningService.js` | Non-destructive: creates missing templates, never edits existing rows |
| `backend/controllers/printDocumentSettingsController.js` | Print Module Phase 1 — `print_document_settings` CRUD + `stores.default_sale_document_type`. Reads/writes ONLY this table, never `printer_settings` |
| `backend/scripts/provision-missing-print-templates.js` | One-off backfill giving every existing (non-demo) tenant its default templates — run `npm run provision:missing-templates:dry` before any change that assumes every tenant already has one |
| `backend/controllers/salesHubController.js` | `search` handler for `GET /api/sales-hub/search?q=` — fans out across `repair_orders`/`old_gold_purchases`/`memo_transactions`/`layaway_plans`/`savings_scheme_enrollments`/`sales` (each LEFT JOIN `customers`, tenant-scoped, `LIMIT 8`), rolls up by `customer_id` into `SalesHubCustomer[]` (max 5) + `standaloneRecords[]`. Record shape: `{type, id, label, status, statusLabel, action, actionLabel, date}` |
| `backend/routes/salesHub.routes.js` | Mounts `authenticate`+`requireTenantId`, `GET /search` — registered in `server.js` as `/api/sales-hub` |
| `backend/controllers/salesController.js` | `searchSales` — `LEFT JOIN customers`, matches `document_number`/name/email/phone, backs Sales Return's search-first lookup |

### Routes (backend)
| Route | Prefix |
|---|---|
| `memo.routes.js` | `/api/memos` |
| `metalRates.routes.js` | `/api/metal-rates` |
| `productPieces.routes.js` | `/api/product-pieces` |
| `oldGold.routes.js` | `/api/old-gold` |
| `repairs.routes.js` | `/api/repairs` |
| `savings-schemes.routes.js` | `/api/savings-schemes` |
| `layaway.routes.js` | `/api/layaways` |
| `labels.routes.js` | `/api/labels` |
| `crm.routes.js` | `/api/crm` |

### DB migrations
All live in `database/migrations/`. Applied ones move to `database/migrations/applied/`.

Key tables:
- `product_pieces` + `product_piece_sequences` — serialized inventory
- `metal_rates` — effective-dated metal rates (effective_to IS NULL = current)
- `tenant_pricing_settings` — weight pricing toggle, market rate API key, weight unit, etc.
- `memo_transactions` + `memo_items` — consignment ledger
- `old_gold_purchases` + `old_gold_voucher_sequences`
- `repair_orders` + `repair_order_updates`
- `savings_scheme_plans` + `savings_scheme_enrollments` + `savings_scheme_payments`
- `layaway_plans` + `layaway_items` + `layaway_payments`
- `sales.sales_mode`/`zero_rate_reason`/`traveller_id_type`/`traveller_id_number`/
  `traveller_id_country`/`travel_method_type`/`travel_method_ref`/`travel_method_detail`/
  `destination`/`departure_date` — added by `2026-09-01_pos_hub_duty_free_capture.sql`;
  confirm this migration is applied (`npm run migrate:status`) before testing the Duty-Free
  Sale flow against a fresh database, or `createSaleController.js` will fail with
  `Unknown column 'sales_mode'`.
- `print_document_settings` (Print Module Phase 1, `2026-08-25_print_document_settings.sql`)
  — NOT named `print_routes`: a table with that name, plus `print_stations`/
  `printer_devices`/`print_jobs`, already exists in this database (empty, a dormant partial
  build of the full blueprint's generic condition-engine routing model — see
  `docs/ARCHITECTURE/PRINT_MODULE_FINAL_BLUEPRINT.md`). None of those four are referenced by
  any application code; leave them alone unless a future milestone deliberately adopts them.
  `stores.default_sale_document_type` (`2026-08-25_default_sale_document_type.sql`) is the
  companion column deciding receipt-vs-invoice per store.

---

## Module status

| Module | Status | Notes |
|---|---|---|
| Serialized Inventory | ✅ Complete | Cross-product search, KPI strip, drawer, bulk label print |
| Old Gold / Exchange | ✅ Complete | Live valuation preview, voucher, status transitions |
| Repairs | ✅ Complete | Intake, status chain, photo uploader |
| Memo & Consignment | ✅ Complete | In/out, partial return, piece linkage, print |
| Layaway | ✅ Complete | Schedule, payments, progress bars |
| Metal Rates | ✅ Complete | Rate cards, history, calculator, goldapi.io fetch/publish |
| Savings Schemes | ✅ Complete | Plans, enrollments, payments, maturity bonus |
| Catalog Sync | ✅ Foundation | Platform-agnostic outbox; adapter TBD per tenant |
| Employees | ✅ Complete | Performance, incentives, Paytime push |
| CRM (wishlists + reminders) | ✅ Complete | Dashboard widget, drawer per customer |
| Cycle Count | ✅ Complete | Barcode scan reconciliation, CSV export |
| Label Printing | ✅ Complete | Zebra ZPL, TSC/Godex, browser fallback |
| Weight-unit localization | ✅ Complete | g / oz / tola / baht / kg; all pages use `formatWeight` |
| Print & Invoice Templates | ✅ Complete | Clean layout redesign (invoice + jewelry_invoice), pinned page footer, Duty-Free/Export block generalized (traveller ID + travel method, declaration moved to compliance); header/text blocks separated (document title+metadata vs. store identity, independently toggleable); font-size control actually reaches the renderers (Fine→Title scale + bold, resolved with per-block fallback); configurable `logoHeight` in mm with presets/alignment/URL override; customer/address blocks expanded (street/city/state/postal/country/tax ID/passport, billing/shipping/both) |
| Print Module Phase 1 (POS checkout printing) | ⚠️ Code complete, NOT field-proven | POS receipt/refund printing now goes exclusively through `print_templates` — the legacy hardcoded receipt/return HTML in `receiptService.ts` is deleted, and every existing tenant was backfilled with published default templates before the cutover. New `print_document_settings` table + redesigned Printer Settings UI: independent Receipt/Refund and Invoice sections (delivery mode, printer, paper width, template, copies, enabled/auto-print), plus a store-level "Print sales as Receipt/Invoice" choice (`stores.default_sale_document_type`). `copies` is wired end-to-end for local-agent/direct delivery (not achievable for browser print). Dead `receipt_templates` table/CRUD/dropdown removed. **Two real bugs found via manual testing after this was first declared done** (both invisible to `tsc`/Mocha/Vitest — see Iteration 17.1/17.2): a `pool.query()` destructuring bug that 500'd every settings GET, and a written-but-never-applied migration. **Before trusting this module, work through `docs/MODULES/print-module/PHASE_1_STORE_LEVEL_ROUTES.md §6` end to end** — a clean live checkout through the new path has not yet been observed. **Deferred to a later milestone** (see §5 of that doc): station-level routing, `print_jobs`/retry/audit, full Local Agent v1 protocol, label/tag template system, and a Designer block type for the per-item industry attributes (e.g. jewelry purity/weight) the old legacy renderer used to show but the template renderer doesn't yet support |
| Sales Hub (jewelry) | ✅ Complete, search-first redesign 2026-08-29 | Fullscreen, chromeless `/sales-hub` (no `<header>`, no admin chrome — same treatment as `/pos`); sales-floor jewelry users land here straight from login instead of the dashboard. **Redesigned from a 10-tile bento grid to a search-first model**: 2 hero tiles (New Sale, Duty-Free Sale) + a universal customer/record search (`GET /api/sales-hub/search`) surfacing a customer's whole relationship across all 6 modules with contextual per-record actions, + 7 permission-filtered "Start something new" shortcuts, replacing the old 1-tile-per-module grid that made cashiers re-search separately inside each destination page. Search results support quick-action deep-linking (see `SalesHubPage.tsx` row above and the quick-action contract in `docs/FEATURES/14_Sales_Hub_Search_First_Redesign.md`) into Repairs/OldGold/Memo/Layaway/Savings/Orders/Returns, each of which auto-opens its create/collect-payment flow and pre-fills its own search. Duty-Free Sale tile opens a two-column intake (required customer + traveller ID/travel method in one screen) via `DutyFreeIntakeModal`; store-level duty-free/export sales are actually zero-rated on real sales; New Sale/Duty-Free tiles navigate to `/pos` with `{fromSalesHub: true}`, and `POSScreen.tsx` returns to `/sales-hub` once checkout completes. Sale search results show a print-preview "view" icon (see Key files). Sales Return (`SalesReturnPage.tsx`) is reachable both from the Hub search and directly, and its own lookup step (`ReturnProcessingModal.tsx`) is search-by-name/email/phone/document-number rather than raw internal Sale ID. Discovering and fixing the permission-check-triggered RBAC login bugs (see Critical conventions) was a side effect of adding permission gating to this redesign — the old ungated tile Hub never surfaced them. |

## Known pending work

- **Sales Hub glance strip** — optional "N repairs ready / N memos overdue"
  summary row from the Hub design, not yet built.
- **Sales Hub mobile/tablet live check** — responsive breakpoints verified by
  code review + automated tests only, not an actual phone/tablet screenshot.
- **Duty-Free/Export block visual polish** — flagged for a template-by-template
  pass later; only the sizing bug and the declaration/field redesign are done.
- **Market rate auto-fetch cron** — `node-cron` job to run at `market_rate_fetch_time`
  when `market_rate_auto_publish = 1`. Backend service is ready; just needs scheduling.
- **`weight_unit` in StoreContext type** — currently `(store as any)?.weightUnit`;
  add the typed field to the Store interface.
- **Paytime API** — build `/v1/employers` + `/v1/incentives` in the Paytime project.
- **Shopify adapter** — catalog sync outbox is ready; build the adapter when a tenant needs it.
- **Print Module: station-level routing, `print_jobs`, full Local Agent v1** — Phase 1
  deliberately stayed store-level only with no durable job/retry/audit trail; see
  `docs/ARCHITECTURE/PRINT_MODULE_FINAL_BLUEPRINT.md` and `docs/ARCHITECTURE/print-implementation-plan.md`
  for the full design, and `PHASE_1_STORE_LEVEL_ROUTES.md §5` for exactly what this phase
  did NOT build. Note a `print_routes`/`print_stations`/`printer_devices`/`print_jobs` set of
  tables already exists in the database from an earlier, unfinished attempt — dormant, not
  referenced by any code — evaluate adopting those for real rather than re-inventing them.
- **Label/tag print settings redesign** — deliberately held out of Print Module Phase 1;
  `LabelPrinterSettings.tsx` is untouched. Plan for it alongside the other two document
  families (see blueprint Milestone 6) when the work is picked up.
- **Print Agent Go build never compiled by an AI session** — the 2026-08-29 origin/CORS
  rework (`config_store.go`, `server.go`) was reviewed by hand only; no Go toolchain was
  available. The user has verified it works end-to-end via manual rebuild/deploy, but a
  fresh session picking this up (e.g. in Devin's IDE, which does have a Go toolchain) should
  run `go build ./... && go vet ./...` and ideally the existing Go test suite in
  `print-agent/` as its first action before making further changes there.
- **`print-agent/PROJECT_STATUS.md`'s "Strict-origin loopback API" bullet is now inaccurate**
  — the model is additive-pairing plus a dual-list check plus an explicit exemption for
  `/health`/`/v1/pair`, not a single strict list. Needs rewriting by whoever next revises that
  doc's Completed section; flagged here rather than fixed given the doc's version number
  (2.3.8) does not match the last live-verified build (2.3.6) and that discrepancy needs
  reconciling first.

---

## Docs index

| File | Content |
|---|---|
| `docs/STRATEGY/05_Jewelry_State_of_the_Art_Tasklist.md` | Full feature gap analysis + iteration status |
| `docs/HANDOFF/06_Implementation_Changelog.md` | File-level changelog per iteration (1–17) |
| `docs/FEATURES/13_POS_Hub_Proposal.md` | Sales Hub (workflow switcher) for jewelry — implemented iteration 14, fullscreen redesign in iteration 15, bento/chromeless redesign in iteration 16 |
| `docs/ARCHITECTURE/FRONTEND_STANDARDS.md` | Design-system rules |
| `docs/ARCHITECTURE/CODEBASE_AND_DEPLOYMENT.md` | CI, deploy, rollback |
| `docs/ARCHITECTURE/RESPONSIVE_STANDARDS.md` | Per-page responsive QA checklist |
| `docs/DECISIONS/ADR-0001-employees-vs-users.md` | Employees ≠ Users decision |
| `database/README.md` | Migration runner workflow + authoring rules |
| `docs/HANDOFF/2026-08-print-templates-duty-free-checkout-fixes.md` | Devin IDE session notes: Print Template Designer fixes + the full duty-free checkout bug chain (payment method validation, missing columns, non-atomic inventory/FK types, audit logger export, receipt-print call shape) |
| `docs/ARCHITECTURE/PRINT_MODULE_FINAL_BLUEPRINT.md` | Full target Print Module architecture (device-agnostic, station/route/job model) — independent of Phase 1's scope |
| `docs/print-module/print-implementation-plan.md` | Milestone-based plan of action for the full blueprint above |
| `docs/MODULES/print-module/PHASE_1_STORE_LEVEL_ROUTES.md` | Execution companion for the completed store-level slice actually built (this session) — `print_document_settings`, legacy receipt removal, what was explicitly deferred |
| `docs/FEATURES/14_Sales_Hub_Search_First_Redesign.md` | 2026-08-29 session record: Sales Hub search-first redesign rationale + architecture, the quick-action deep-linking contract, the RBAC login bug chain found as a side effect, the Print Agent origin/CORS rework, the `useOptionalStore()` pattern, and the Sale-null/view-icon fix — written as a handoff record for continuing this work in a different AI tool (e.g. Devin's IDE) |

---

## goldapi.io integration

- Endpoint: `GET https://www.goldapi.io/api/{XAU|XAG|XPT|XPD}/{currencyCode}`
- Returns `price_gram_24k` already in the target currency — no forex needed.
- Currency read from `stores.currency_code` → works for any country automatically.
- Local premium % applied on top of spot for import duty (India ≈15–18%, USA ≈2–5%).
- Backend service: `backend/services/marketRateFetcherService.js`.
- Frontend trigger: Metal Rates → Market Rates button → Fetch Preview → Publish All.
