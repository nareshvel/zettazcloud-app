# Plan Limits Enforcement — Plan Document

**Status as of 2026-09-01:** All four plan limits (products, users, stores, storage)
are now enforced server-side. Storage was the last gap — closed in this pass, see §3.2
(kept for history) and §6 below for how it actually shipped.

---

## 1. Background

`plans.limits` (JSON: `{ stores, products, users, storage }`) has existed since the
original RBAC seed (`2025-06-18_rbac_seed_data.sql`) and is shown to the user on the
Subscription page (`frontend/src/components/settings/SettingsBilling.tsx`, see
`17_Stripe_Billing_Module.md` and the plan-bullets work that followed it). Until this
change, those numbers were **decorative only** — nothing in the backend compared a
tenant's actual usage against them before allowing a create action. A tenant on
Starter (1 store / 200 products / 1 user) could create unlimited stores, products, and
users through the existing APIs.

Two pieces of real enforcement logic already existed but were never wired up:

- `backend/middleware/subscriptionMiddleware.js` → `withinUsageLimits(resourceType, countFn)`
  — a middleware factory: reads `req.subscription.plan.limits[resourceType]`, runs
  `countFn(tenantId)`, and returns HTTP 402 if the count would meet/exceed the limit.
  Defined and exported, never imported by any route.
- `backend/services/subscriptionService.js` → `checkLimit()` (standalone, unused) and
  `getSubscriptionUsage()` (used only for read-only usage-percentage reporting, not
  gating).

## 2. What changed in this pass

### 2.1 Fixed a real lockout bug in `withinUsageLimits` before wiring it up

The original implementation returned **402 "This action requires an active
subscription"** whenever a tenant had zero subscription rows or a non-active/non-trial
status — which directly contradicts the fail-open philosophy the rest of the codebase
already established (`requireActiveSubscription()`, see `CLAUDE.md` — a tenant with no
subscription row must never be blocked from ordinary work; subscription STATUS is
already enforced globally by `requireActiveSubscription()` mounted on `/api` in
`server.js`). Wiring the old `withinUsageLimits` in as-is would have reintroduced a
variant of the exact lockout incident already fixed once this session.

Fixed: `withinUsageLimits` now calls `next()` (fails open) whenever there's no
subscription row or no `plan` attached, and only evaluates `plan.limits[resourceType]`
when a real plan is present. Status gating is left entirely to
`requireActiveSubscription()` upstream — this middleware's only job is the numeric cap.

File: `backend/middleware/subscriptionMiddleware.js`, `withinUsageLimits()`.

### 2.2 Products limit — enforced

- `backend/routes/product.routes.js`: added `countTenantProducts(tenantId)` (simple
  `COUNT(*) FROM products WHERE tenant_id = ?`, matching the same query
  `getSubscriptionUsage()` uses for the displayed percentage, so enforced and displayed
  numbers can never disagree) and inserted `withinUsageLimits('products',
  countTenantProducts)` into the `POST /api/products` (`= POST /api/inventory`, same
  router mounted twice) chain, between `requirePermission('products.create')` and the
  multer image upload middleware.

### 2.3 Users limit — enforced

- `backend/routes/userRoutes.js`: added `countTenantUsers(tenantId)` (`COUNT(*) FROM
  users WHERE tenant_id = ?`) and inserted `withinUsageLimits('users',
  countTenantUsers)` into `POST /api/users`, between `requirePermission('users.create')`
  and the handler body.

Both count functions deliberately count **all** rows for the tenant, not scoped to a
single store — the plan limit itself is tenant-wide (`limits.stores`/`limits.products`/
`limits.users` describe the whole tenant's ceiling, not a per-store one), matching how
`getSubscriptionUsage()` already counts for the usage-percentage display.

## 3. Deferred — and why

### 3.1 Stores limit — **done** (see `19_Store_Creation_And_Switching.md`)

Built in a follow-up pass: `POST /api/stores` (Tenant-Admin gated via
`stores.create`) + a "Create Store" modal reachable from the TopBar profile dropdown,
with `withinUsageLimits('stores', countTenantStores)` wired in exactly like
products/users. Also added the "Switch Store" UI and fixed a real, previously-unnoticed
crash bug in the store-switching backend (`authMiddleware.generateToken` didn't exist).
Full detail in `19_Store_Creation_And_Switching.md`.

### 3.2 Storage limit — **done** (2026-09-01, see §6)

Originally deferred here as "not trackable yet, no usage metric exists" — closed in a
later pass. Kept below for history of why it was hard:

`getSubscriptionUsage()`'s `storageUsage` was hardcoded to `0` — there was no code
anywhere that computed how much storage a tenant was actually using (product images,
avatar uploads, attachments, etc. all go through `storageService.js`/`ImageService.js`
but neither tracked or aggregated bytes per tenant). Enforcing a `storage` limit (e.g.
"1GB", "5GB" from `plans.limits.storage`) needed:

1. A real usage source — either a running counter updated on every upload/delete, or a
   walk that sums file sizes per tenant from the storage driver.
2. Parsing the human string values already in `limits.storage` (`'500MB'`, `'1GB'`,
   etc.) into bytes for comparison.

See §6 for what actually shipped.

### 3.3 Frontend error surfacing — verified, no change needed

`withinUsageLimits` returns a 402 with a clear `message` field
(`"You have reached the products limit (200) for your subscription plan. Please
upgrade your plan to add more products."`). Confirmed both real create forms already
read the message correctly:

- `frontend/src/pages/ProductsPage.tsx` (`handleSubmit`'s catch, ~line 274) —
  `error instanceof Error ? error.message : '...'`, then `toast.error(...)`.
- `frontend/src/pages/UserManagementPage.tsx` (`handleSaveUser`'s catch, ~line 227) —
  same `error.message` pattern.

Both will surface the 402 message as-is, no frontend change required.

**Found in passing, not fixed (out of scope for this pass):** `frontend/src/pages/
Products.tsx` — an older/parallel product page using `useInventory()`'s `addProduct` —
swallows the real error entirely and always shows a hardcoded `'Failed to add
product'`/`'Failed to update product'` string regardless of cause. If this page is
still reachable, a user hitting the products limit through it would see a generic
failure with no indication of why. Worth a follow-up if that page is still in use.

## 4. Task list

| # | Task | Status |
|---|------|--------|
| 1 | Fix `withinUsageLimits` fail-open bug (lockout parity with `requireActiveSubscription`) | ✅ Done |
| 2 | Enforce `products` limit on `POST /api/products` | ✅ Done |
| 3 | Enforce `users` limit on `POST /api/users` | ✅ Done |
| 4 | Verify Add Product / Add User forms surface the 402 message correctly | ✅ Done — both read `error.message` correctly, no change needed |
| 5 | Build `POST /api/stores` (tenant-admin gated) + "Create Store" UI | ✅ Done — see `19_Store_Creation_And_Switching.md` |
| 6 | Enforce `stores` limit on the new store-creation endpoint | ✅ Done |
| 7 | Build a real per-tenant storage usage metric + a `'500MB'`/`'1GB'`-style string-to-bytes parser | ✅ Done (2026-09-01) |
| 8 | Enforce `storage` limit on every upload path (product images, categories, avatars, attachments) | ✅ Done (2026-09-01) |
| 9 | Once #5–8 are live, revisit `getSubscriptionUsage()` to make sure the usage-percentage numbers shown on the Subscription page stay in lockstep with whatever counts the new enforcement paths use | ✅ Done (2026-09-01) — `storage` usage now comes from the same `storageUsageService`/`storageSize` helpers the enforcement middleware uses |

## 5. Files touched in the products/users/stores pass

- `backend/middleware/subscriptionMiddleware.js` — `withinUsageLimits()` fail-open fix
- `backend/routes/product.routes.js` — `countTenantProducts()` + wired into `POST /`
- `backend/routes/userRoutes.js` — `countTenantUsers()` + wired into `POST /`
- `docs/17-migration-and-roadmap/18_Plan_Limits_Enforcement.md` — this document

## 6. Storage limit — how it actually shipped (2026-09-01)

`limits.storage` on every seeded plan is a human string (`'500MB'`, `'1GB'`, `'20GB'`),
never a byte count — see `database/seeds/applied/2025-06-18_rbac_seed_data.sql` and
`2026-08-31_starter_plan.sql`.

**Byte parsing** — `backend/utils/storageSize.js`: `parseSizeToBytes(value)` (handles
plain numbers, numeric strings, and unit-suffixed strings; returns `NaN` on anything it
can't parse, so callers can fail open) and `formatBytes(bytes)` for human-readable
messages/UI.

**Usage source** — `backend/services/storageUsageService.js`'s
`getTenantStorageBytes(tenantId)` recursively sums file sizes under
`backend/uploads/<tenantId>/` on disk. This subtree already contains every tenant
upload — product images and category images (`multerConfig.js`'s tenant-scoped
`diskStorage` destinations), plus generic attachments and user avatars
(`storageService.js`'s `buildKey()`) — so no schema change, backfill, or new upload
code was needed to make this tenant-scoped and complete. Only applies to
`STORAGE_DRIVER=local` (the only driver actually implemented today); the `s3` driver
in `storageService.js` still just throws, so if S3 is ever turned on for real this
function needs an equivalent `ListObjectsV2` + size-sum implementation instead of a
filesystem walk.

**Enforcement — two shapes, because file size isn't known until multer has already
written or buffered it:**

- `enforceStorageLimitAfterUpload(getUploadedFilePath)` (`subscriptionMiddleware.js`)
  — for `multer.diskStorage` routes (product/category images), runs immediately AFTER
  multer, computes tenant usage post-write, and — if the plan's cap is now exceeded —
  deletes the just-written file and responds 402 instead of leaving it in place. Wired
  into `product.routes.js`'s `POST /` and `PUT /:id`, and `category.routes.js`'s
  `POST /` and `PUT /:id`.
- A pre-write inline check in `attachments.routes.js`'s `POST /:entityType/:entityId`
  and `userRoutes.js`'s `POST /me/avatar` — both of these already buffer the upload in
  memory (`multer.memoryStorage()`) before calling `storageService.save()`, so
  `currentBytes + req.file.size > limitBytes` can be checked BEFORE anything is
  written — no rollback/delete needed, unlike the disk-storage routes above.

Both shapes fail open (call `next()` / let the request through) on a missing
subscription, missing plan, or an unparseable `limits.storage` value — same philosophy
as every other usage-limit check in this codebase (see `CLAUDE.md`'s "Subscription
billing" note on `requireActiveSubscription()`'s fail-open behavior for the same
reasoning).

**`getSubscriptionUsage()`** (`subscriptionService.js`) — the `storage` entry's
`used: 0` stub is replaced with a real `getTenantStorageBytes()` call; `percentage` is
computed against `parseSizeToBytes(limits.storage)`; the `limit` field stays the raw
seeded string (`'1GB'`) so the existing frontend `LIMIT_LABELS.storage` display
(`SettingsBilling.tsx`) doesn't need to change.

### 6.1 Production incident (2026-09-01): login hangs for a multi-store tenant

Right after deploying the multi-store + storage-limit work, login started
silently hanging (no error, no response — the frontend just bounced back to
the login form) for one specific tenant that had just been given a second
store. It was NOT a code bug in the multi-store or storage-limit work
itself — it was a resource-exhaustion issue that a multi-store tenant's
heavier dashboard query pattern happened to trigger first:

- The MySQL connection pool (`backend/config/db.js`, `DB_CONNECTION_LIMIT`
  env var, defaulted to 8) has no queue timeout (`queueLimit: 0` = wait
  forever). `requireActiveSubscription()` is mounted globally on every `/api`
  request and calls `getActiveSubscriptionForTenant()`, which — before this
  fix — ran two fresh queries (`subscriptions`, `plans`) on literally EVERY
  authenticated request, with no caching at all.
- A two-store tenant's dashboard fires noticeably more concurrent requests
  per page load than a single-store one (per-store printer settings, tax,
  print-document-settings, etc.), so it was far more likely to have all 8
  pool connections busy at once. When that happened, a brand-new request —
  e.g. a login attempt in another tab — just queued silently forever with
  no timeout, looking exactly like a hang.
- The account's MySQL user also has a hard `max_user_connections` cap of 20
  (a shared-hosting limit, separate from `max_connections` which was 2000) —
  so simply raising the pool size has a ceiling; it was corrected from an
  initial (wrong) 25 down to 15, leaving headroom for anything else using
  that same DB user.

**Fix — cut the query volume, not just the pool size:**
`backend/services/subscriptionService.js` now has a small in-process TTL
cache: `getPlanById()` (5-minute TTL — plans rarely change) and
`getActiveSubscriptionForTenant()` (15-second TTL — the hot path called on
every request via `requireActiveSubscription()`). Every write path that can
change a tenant's subscription or a plan's data explicitly invalidates the
relevant cache entry: `createOrUpdateSubscription`, `updateSubscriptionStatus`,
`changePlan`, `cancelSubscription`, `restoreSubscription`, `updatePlan`, and
all five Stripe-webhook handlers (`syncFromStripeSubscription`,
`cancelByStripeSubscriptionId`, `handlePaymentSucceeded`,
`handlePaymentFailed`, and the checkout-session activation path) — so a
plan upgrade/cancel/webhook-driven status change is reflected immediately
rather than waiting out the TTL. This is a single-process, in-memory cache
(a `Map`) — if this app ever runs as multiple PM2 cluster instances or
horizontally scaled, this cache does NOT invalidate across instances; each
process only clears its own copy. That's an acceptable gap today (15s TTL
bounds the staleness regardless) but worth revisiting if/when this moves to
multi-instance.

**Not yet done:**
- No load test confirming this actually resolves contention under realistic
  multi-tenant concurrent traffic — the fix is verified via `node -c` only.
- `getTenantSubscription()` (used by `withinUsageLimits`/`requireFeature`/
  `enforceStorageLimitAfterUpload` on specific write routes, not the global
  middleware) is still uncached — lower volume than the global path, but
  could be added the same way if it turns out to matter.
- No production monitoring/alerting on connection pool saturation exists —
  this incident was only caught because a real user hit it. Worth adding a
  periodic log of `pool.pool._allConnections.length` / active vs. free
  connections, or upgrading to a proper metrics setup, so the next instance
  of this is caught before a tenant is locked out.
- Follow up with the hosting provider about raising `max_user_connections`
  above 20 as tenant count grows — 15 is a safe value for today's load, not
  a long-term ceiling.

**Not yet done (storage limit itself, separate from the incident above):**
- No live test against a real database or real uploads — every check here is
  `node -c` only. In particular, the "over the limit → file gets deleted and a 402 is
  returned" rollback path for the disk-storage routes has not been exercised for real.
- No frontend surfacing check yet for the storage-specific 402 shape (it matches the
  existing `withinUsageLimits` shape closely, so `ProductsPage.tsx`'s existing
  `error.message` handling should show it fine, but this hasn't been confirmed against
  an actual 402 response).
- No cleanup/reconciliation job if a file gets deleted directly on disk (outside the
  app) without the corresponding DB row being removed — usage would over-report until
  that row's own file eventually gets cleaned up through normal app flows.
