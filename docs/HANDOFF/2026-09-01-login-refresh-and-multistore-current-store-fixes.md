# 2026-09-01 — Login page refresh on wrong password, multi-store "Current Store" label

Session record covering a production incident chain that started as "I can't log in after
deploying" and turned out to be three unrelated bugs surfacing back-to-back. Kept as a single
doc since they were diagnosed together and the false leads are worth keeping for the next
person who hits something that smells the same.

---

## 1. DB connection-pool exhaustion (real, fixed, unrelated to the actual login report)

Already documented in `docs/17-migration-and-roadmap/18_Plan_Limits_Enforcement.md` §6.1 and
`CLAUDE.md`'s "Production incident (2026-09-01)" bullet. Root cause:
`requireActiveSubscription()` (mounted globally on every `/api` request) queried
`subscriptions`+`plans` with zero caching, combined with a too-low `DB_CONNECTION_LIMIT` (8)
and no queue timeout. Fixed with in-process TTL caching in `subscriptionService.js` plus raising
`DB_CONNECTION_LIMIT` to 15 (the hosting account's `max_user_connections` cap is 20 — don't
raise the pool above that without confirming the cap first). This fix is real and stayed
deployed, but it was **not** the cause of the specific login report that followed — see §3.

## 2. `tax_class_rates` provisioning bug (real, fixed, unrelated to login)

`backend/services/taxProvisioningService.js` was inserting into `tax_class_rates` using a
column name (`tax_rate`) that has never existed in the schema. The real column is `rate`,
stored as a **fraction** (`0.10` for 10%, not `10.0`), and the table also requires `store_id`
(`NOT NULL`), which the old INSERT omitted. This was not a missing migration — the schema was
always correct; the application code was wrong. It fired on every new-tenant signup (caught
non-fatally, so signup itself didn't fail, but the tenant ended up with a tax class and no
matching rate — 0% tax until someone manually fixed it in Tax Settings). Fixed by correcting the
column name, scale, and adding `store_id` to the INSERT. Any tenant provisioned before this fix
should be checked for a "Standard Tax" `tax_classes` row with zero matching `tax_class_rates`
rows and backfilled manually if found — no automated backfill was written.

## 3. The actual login bug: `fetchApi`'s global 401 handler fired on a failed login itself

**Symptom:** entering a wrong password appeared to do nothing useful — a message flashed and
then the page reloaded back to a blank login form, with no way to read the error before it
disappeared. This looked identical to (and was initially misdiagnosed as) a backend outage,
because DevTools' Network/Console tabs also appear to "reset" on the same reload, hiding the
actual response unless **Preserve log** is enabled first.

**Root cause:** `frontend/src/services/api.ts`'s `fetchApi()` had a blanket rule — any `401`
response from any endpoint cleared local auth storage and force-redirected to `/login` via
`window.location.href = '/login'`, treating it as an expired/invalid session. A failed login
attempt itself returns `401 {"error":"Invalid credentials."}` from
`unifiedAuthMiddleware.js` — an entirely expected response, not a session-expiry signal — so the
force-redirect fired before `Login.tsx`'s own `catch` block ever got to render the "Invalid
credentials" message. The hard navigation (`window.location.href`, not a SPA route change) is
what caused the visible "flash then refresh."

There were actually **two** places this logic lived in `api.ts` — an inline check right after
the response is parsed, and a second check in the outer `catch` block — and the first pass in
this session only patched the first one, so the symptom persisted after that deploy. The second
occurrence was found and fixed via Devin's IDE.

**Full fix (3 files, across this session + Devin's IDE pass):**
- `api.ts` — both 401-handling locations now skip the force-redirect when the request was to
  `/api/auth/login`, `/api/auth/register`, or a `2fa` endpoint (`isAuthEndpoint` regex guard).
  A 401 from any other endpoint still force-redirects as before — that part of the behavior is
  correct and intentional for actual session expiry.
- `api.ts` — the thrown error's message now prefers the backend's actual `error` field
  (`typedErrorData.error`) over a generic `"Request failed with status 401..."` fallback, so the
  UI shows the real reason instead of a technical-sounding placeholder.
- `authService.ts` — removed a leftover debug `alert()` (apparently added during earlier
  Chromium-specific debugging and never cleaned up) that was popping a raw technical error
  dialog on login failure — likely the actual thing users were seeing "flash" before the page
  reloaded.
- `Login.tsx` — stopped overwriting the server's specific error message with a generic
  `"Login failed..."` string when `login()` returns `null` instead of throwing; the specific
  message now survives to the UI.

**Diagnostic path that got here** (kept for the next similar-looking incident): confirmed same
DB, local dev login worked but production didn't for the same tenant → ruled out DB/pool
entirely once that was established → captured the actual network response by enabling
**Preserve log** in DevTools' Network tab (and the equivalent in Console) since the page reload
was wiping the tab before it could be read manually → found the true response was
`{"error":"Invalid credentials."}`, a wrong password, not a bug at all — until the *lack of a
displayed error message* was recognized as its own separate, real bug worth fixing.

## 4. `stores.settings` returning the wrong store for multi-store tenants (real, fixed)

Separately noticed: the TopBar's "Current Store: ___" label showed a different store than the
one checked in the "Switch Store" dropdown for a multi-store tenant. Root cause:
`GET /api/stores/settings` (`backend/routes/store.routes.js`) has no `authenticate` middleware
of its own and filtered only `WHERE tenant_id = ? LIMIT 1` — no `store_id`, no `ORDER BY` — so it
always returned whichever store MySQL listed first for the tenant (the oldest one), regardless
of which store was actually active. The "Switch Store" dropdown reads a different, correctly
store-scoped endpoint (`/stores/accessible`), which is why only the header label was wrong.

**Fix:** the route now accepts and filters by `store_id` (from `req.user`, a query param, or an
`x-store-id` header — falling back to the old tenant-only behavior only if none is supplied,
with a further fallback to "first store for tenant" if the given `store_id` doesn't match, so a
stale ID doesn't 404 the page). `StoreContext.tsx`'s `fetchStore()` now sends the active
`store_id` explicitly (`user.storeId`, falling back to `localStorage.getItem('store_id')`, which
`switchStore()` already sets correctly on every store switch).

## Takeaways

- A hard `window.location.href` redirect on any 401, anywhere in a shared fetch wrapper, is a
  trap for auth endpoints specifically — a failed login is a *normal* 401, not a session-expiry
  signal, and needs its own carve-out or it will always look like a crash instead of a form
  error.
- When a symptom is "the page reloads and I can't see what happened," reach for DevTools'
  **Preserve log** (Network *and* Console) before chasing the backend — it's usually the fastest
  way to separate "there's no error to see" from "there's an error I'm not preserving."
  Grep the whole file for a pattern before declaring a fix complete — this bug existed in two
  separate spots in the same file, and only one was caught on the first pass.
