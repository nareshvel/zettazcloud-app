# Store Creation & Switching — Plan Document

**Status: done (2026-09-04).** Decisions below were confirmed with the user before any
code was written, then implemented and verified end-to-end (`tsc --noEmit` clean,
`node -c` clean on every touched backend file).

---

## 1. Why

Two related gaps existed:

1. **No way to create a second store.** Confirmed by full-codebase search (see
   `18_Plan_Limits_Enforcement.md` §3.1): no `POST /api/stores`, no "Create Store" UI
   anywhere. Multi-store is advertised on every subscription plan card but unreachable
   in practice.
2. **No way to switch between stores in the UI.** A fully-implemented backend endpoint
   already exists — `POST /api/auth/switch-store` (`backend/routes/authRoutes.js:296-341`)
   — mints a fresh JWT scoped to a different store, gated by Tenant Admin status or a
   store-scoped role assignment. It has zero frontend callers today.

## 2. Decisions (confirmed with user)

| Question | Decision |
|---|---|
| Create-store form scope | **Full setup form** — name, address, phone, email, currency, country, timezone, tax basis collected up front, not deferred to a follow-up Settings visit. |
| What happens on switch | **Full page reload.** Call `/auth/switch-store` for a new JWT, persist it exactly like login does, then `window.location.reload()`. Store scoping is baked into the JWT and read by most RBAC-gated backend routes — a soft in-place refresh risks stale permission/store state on pages that don't expect `store_id` to change under them. |
| Where "Create Store" lives | **Modal launched from the TopBar profile dropdown**, not a dedicated page. |

## 3. Where this surfaces in the UI

`frontend/src/components/layout/TopBar.tsx`'s existing user-profile dropdown (custom
hand-rolled dropdown, not shadcn `DropdownMenu` — plain `useState`/click-outside, see
lines ~93-230) currently has: user info header → My Profile → My Subscription → divider
→ Language → divider → Sign Out.

New items, inserted after "My Subscription" and before the Language divider:

```
My Profile
My Subscription
─────────────
Current Store: Riverside Branch          (label only, not clickable — or links to
                                           Store Settings, TBD at build time)
Switch Store                    ›         (submenu, same nested-dropdown pattern
                                           already used for Language — lists every
                                           store the user can access, checkmark on
                                           the current one, click = switch)
+ Create Store                            (Tenant Admin only — opens CreateStoreModal)
─────────────
Language                        ›
─────────────
Sign Out
```

"Switch Store" and "Create Store" are both hidden entirely for a tenant with only one
store and no create permission (i.e. most tenants today) — no dead-end UI for users who
can't use either.

## 4. Backend changes

### 4.1 `GET /api/stores/accessible` (new)

Returns only the stores the CALLING user can actually switch into — not simply "every
store in the tenant" (that's what `GET /api/stores` already does, and it's Tenant-Admin
/ `stores.view`-gated, which over-shows stores to, say, a Store Manager who should only
see stores they're actually assigned to).

- Tenant Admin → every store for the tenant (mirrors `GET /api/stores`'s existing query).
- Everyone else → only stores where the user has a `user_roles` row scoped to that
  store (`scope = 'store'`) — i.e., exactly the same population `POST
  /auth/switch-store` itself already permission-checks against
  (`rbacService.getUserTenantRoles(userId, tenantId, {storeId, scope:'store'})`), so the
  list the UI shows and the list the switch endpoint accepts can never disagree.
- Response: `{ status: 'success', data: [{ id, name, isCurrent }] }` — `isCurrent`
  computed by comparing to `req.user.store_id` from the JWT, so the frontend doesn't
  need a separate call to know which one is active.

### 4.2 `POST /api/stores` (new)

- Middleware chain: `requirePermission('stores.create')` (already Tenant-Admin-only per
  the seeded RBAC catalog — no RBAC changes needed) → `withinUsageLimits('stores',
  countTenantStores)` (same pattern as the products/users limit work in
  `18_Plan_Limits_Enforcement.md`) → handler.
- `countTenantStores(tenantId)`: `SELECT COUNT(*) FROM stores WHERE tenant_id = ?`
  (matches the unscoped count `GET /api/stores` and `getSubscriptionUsage()` already
  use — no active/inactive filtering, consistent with how products/users were counted).
- Request body (full setup form, per decision above): `name` (required), `address`,
  `phone`, `email` (optional), `currencyCode`, `countryCode`, `timezone`,
  `defaultTaxBasis` (optional — DB column defaults apply if omitted, same defaults the
  very first store gets today per `0000_baseline_schema.sql`).
- Explicitly does **not** accept `isDutyFree` — that field is a read-only mirror of
  `store_jurisdiction_settings.sales_mode` per existing CLAUDE.md convention; a new
  store starts non-duty-free and that's configured later through the existing
  duty-free settings flow, not at creation.
- `industry_code` is not collected in the form — inherits from `tenants.industry_code`
  (NULL = "inherit from tenant", the existing convention from
  `2026-08-24_retail_profile_and_duty_free.sql`).
- Response: `{ status: 'success', data: store }` (camelCased store row) — chosen
  specifically because `fetchApi` auto-unwraps this exact shape; the codebase is
  inconsistent between this and a raw unwrapped object elsewhere in `store.routes.js`,
  so this doc is the explicit tie-breaker for any new store endpoint going forward.
- On success, the new store's `id` is returned so the frontend can immediately call
  `switchStore(newStoreId)` and land the admin inside the store they just created,
  rather than leaving them on the old store with no visible confirmation.

### 4.3 `POST /api/auth/switch-store` — found broken, fixed

Turned out **not** to be usable as-is: it calls `authMiddleware.generateToken(user,
tenantId, storeId)`, but `backend/middleware/unifiedAuthMiddleware.js` never exported a
`generateToken` function (that name only existed in an unrelated, unused `middleware/
backup/authMiddleware.js backup` file). Every call to `/switch-store` (and its sibling
`/switch-tenant`) would have thrown `TypeError: authMiddleware.generateToken is not a
function` at runtime — this was dead code that had never actually been exercised, not
just unused. Added a real `generateToken(user, tenantId, storeId)` export that mirrors
`login()`'s exact tokenPayload/response shape (roles/permissions/systemRoles via
`rbacService.getUserRolesAndPermissions`, dual-cased `tenant_id`/`tenantId` and
`store_id`/`storeId` claims), deliberately smaller than `login()` (no session-row or
`last_login_at` bookkeeping — a context switch isn't a new login). Both `/switch-store`
and `/switch-tenant` now actually work.

## 5. Frontend changes

### 5.1 `frontend/src/services/storeService.ts` (new, or add to existing store service)

- `getAccessibleStores(): Promise<{id, name, isCurrent}[]>`
- `createStore(payload): Promise<Store>`
- `switchStore(storeId): Promise<void>` — calls `POST /auth/switch-store`, persists the
  returned token/user exactly the way `applySuccessfulLogin` does in `authService.ts`
  (same `localStorage` keys), then `window.location.reload()`.

### 5.2 `frontend/src/contexts/StoreContext.tsx`

Add, without removing the existing single-`store` API (nothing currently consuming this
context expects a list, so this is additive):
- `accessibleStores: {id,name,isCurrent}[]`
- `fetchAccessibleStores()` — called once alongside the existing `fetchStore()`.

### 5.3 `frontend/src/components/layout/TopBar.tsx`

- Render "Current Store" using `store?.name` (already available from `useStore()`).
- Render "Switch Store" submenu only if `accessibleStores.length > 1`, following the
  exact nested-dropdown pattern the Language switcher already uses (own
  open/close state + ref + click-outside).
- Render "Create Store" only if `effectiveUser` is Tenant Admin (same
  `systemRoles?.includes('Tenant Admin')` check already established in
  `UserProfilePage.tsx`).

### 5.4 `frontend/src/components/stores/CreateStoreModal.tsx` (new)

**Revised 2026-09-04** after initial feedback that a flat single-page form was "still
minimalistic" and missing the full localization field set the Settings page has. Rebuilt
as a two-tab wizard mirroring `GeneralSettings.tsx` + `LocalizationSettings.tsx` exactly:

- **General tab**: Store Name (required), Address, Phone, Email, Default Tax Basis.
- **Localization tab**: Language (from `LANGUAGE_OPTIONS`, same 6-language restriction
  `LocalizationSettings.tsx` applies), Country (full `COUNTRIES` list, 94 entries),
  Currency (full `CURRENCIES` list, 49 entries), Timezone (full `TIMEZONES` list, 73
  entries), Number Format, Decimal Precision, Measurement System, Date Format, Time
  Format, Display Theme — every select pulls from the same
  `frontend/src/data/localization/*.ts` constants the real Settings page uses, not a
  hand-picked subset.

Deliberately still excludes: logo upload (no store id exists until after the POST
succeeds), duty-free status and invoice-numbering (both live on the separate
retail-profile subsystem, not the `stores` row — configured after creation like any
other store), and Business Type/industry (tenant-wide, lives on the Profile page's
Business tab).

`numberFormat` is sent as the raw DB pattern string (e.g. `'1,234.56'`), not the UI key
— identical contract to `PATCH /stores/settings`; the wizard does the same UI-key→DB
mapping `LocalizationSettings.tsx` does. On submit: `createStore(payload)` → on success,
`switchStore(newStore.id)` (reload lands the admin in the new store) → on a 402 (plan
limit reached), show the backend's message via `error.message` (verified pattern from
`18_Plan_Limits_Enforcement.md` §3.3) with a link to `/profile?tab=subscription` to
upgrade. `backend/routes/store.routes.js`'s `POST /` was extended to accept and persist
every one of these additional fields (previously only accepted the smaller original
field set).

## 6. Task list

| # | Task | Status |
|---|------|--------|
| 1 | `GET /api/stores/accessible` — new backend endpoint | ✅ Done |
| 2 | `POST /api/stores` — new backend endpoint, `stores.create`-gated | ✅ Done |
| 3 | `countTenantStores` + `withinUsageLimits('stores', ...)` wired into #2 | ✅ Done |
| 3a | Fixed `authMiddleware.generateToken` missing export (real crash bug blocking `/switch-store`/`/switch-tenant`) | ✅ Done, found during implementation |
| 4 | `storeService.ts` — `getAccessibleStores`/`createStore`/`switchStore` | ✅ Done |
| 5 | `StoreContext.tsx` — `accessibleStores` + `fetchAccessibleStores` | ✅ Done |
| 6 | `TopBar.tsx` — Current Store / Switch Store / Create Store menu items | ✅ Done |
| 7 | `CreateStoreModal.tsx` — full setup form | ✅ Done |
| 8 | Update `18_Plan_Limits_Enforcement.md` — mark stores limit task done, update task table | ✅ Done |
| 9 | Verify: `node -c` all touched backend files, `tsc --noEmit` clean on frontend | ✅ Done, both clean |

## 8. Files touched

- `backend/routes/store.routes.js` — `GET /accessible`, `POST /`, `countTenantStores`
- `backend/middleware/unifiedAuthMiddleware.js` — added missing `generateToken` export
- `backend/middleware/subscriptionMiddleware.js` — (shared fix from `18_...md`, reused here)
- `frontend/src/services/storeService.ts` (new)
- `frontend/src/contexts/StoreContext.tsx` — `accessibleStores`, `refreshAccessibleStores`
- `frontend/src/components/layout/TopBar.tsx` — Current/Switch/Create Store menu items
- `frontend/src/components/stores/CreateStoreModal.tsx` (new)

## 8a. Unrelated bug fixed alongside this: dev-server MySQL connection leak

While working in this area, the user reported repeated `Error: Too many connections`
and `Connection lost: The server closed the connection` in their local dev server log
after several rapid `nodemon` restarts. Root cause (see `backend/server.js`'s
`gracefulShutdown`): `pool.end()` only ran inside `server.close()`'s callback, which
never fires while any socket (a lingering keep-alive connection, a hung dev-tool poller)
stays open — so the 10s force-exit timer would fire `process.exit(1)` without ever
releasing that process's 8 pooled MySQL connections. Across several rapid restarts this
exhausts a local MySQL's default `max_connections` (151). Fixed: `server.js` now tracks
open sockets and force-destroys any still open after a short grace period so
`server.close()`'s callback actually fires, and `pool.end()` is now guaranteed to run
exactly once regardless of which exit path is taken (clean close or the force-exit
timer). Also fixed a second, smaller leak: `backend/config/db.js`'s `testConnection()`
(only runs when `DEBUG_DB_CONNECTION=true`) created two ad-hoc pools and never closed
either — now wrapped in `try/finally` with both `.end()`'d.

**This does not retroactively close connections MySQL is already holding from before
this fix.** If the user is still seeing "Too many connections" after pulling this
change, restarting the local MySQL server (or waiting for its `wait_timeout` to reap the
stale connections) clears the backlog; the fix only prevents new leaks going forward.

## 9. Not yet manually tested against a running app

This pass was verified via static checks only (`tsc --noEmit`, `node -c`) — no live
server/browser run was performed in this session. Before relying on this in production,
manually verify: creating a store as a Tenant Admin, hitting the `stores` plan limit and
seeing the upgrade link, switching between two stores as a Tenant Admin, and confirming
a non-admin Store Manager's "Switch Store" list only shows stores they're actually
assigned to (not the full tenant list).

## 7. Explicitly out of scope for this pass

- Per-store billing/pricing — a created store shares the tenant's one subscription;
  the `stores` plan limit caps the COUNT of stores, not separate billing per store.
- Duty-free configuration for a new store — uses the existing separate flow, not part
  of creation.

## 10. Default store + soft-delete (2026-09-05 — supersedes the "deleting stores not
built" note in §7 above)

The user's explicit requirement: every tenant always has exactly one **default
store**, which cannot be deleted through the normal store-delete flow — only by
deleting the entire tenant account. The Tenant Admin can change which store is
default at any time. A **non-default** store CAN be deleted even if it has
products/sales/other real data, as long as the user confirms — deletion is a
**soft delete** with a 30-day window before the data is permanently purged.

### 10.1 Schema

`database/migrations/2026-09-05_store_soft_delete_and_default.sql` adds three
columns to `stores` (idempotent, per `database/README.md`'s convention):

- `is_default_store TINYINT(1) NOT NULL DEFAULT 0`
- `deleted_at DATETIME NULL DEFAULT NULL`
- `scheduled_purge_at DATETIME NULL DEFAULT NULL`

The same migration backfills every tenant's oldest non-deleted store as its
default, so no tenant is left with zero default stores after this migration runs.
Run `npm run migrate:status` then `npm run migrate` to apply it.

### 10.2 Backend (`backend/routes/store.routes.js`)

- `countTenantStores`, `GET /`, and `GET /accessible` all now exclude
  `deleted_at IS NOT NULL` rows, and both list endpoints return `isDefault`.
- `POST /` (create store) sets `is_default_store = 1` automatically when it's the
  tenant's first store.
- A new `requireTenantAdmin` middleware (uses `rbacService.isTenantAdmin`) gates the
  sensitive new endpoints below.
- `DELETE /:id` is now **soft delete**, not the old "refuse if the store has any
  data" behavior:
  - Requires `{ confirm: true }` in the body — refuses with 400 otherwise.
  - Refuses (400) if the target is the tenant's default store, with a message
    pointing at "set a different store as default first."
  - Refuses (400) if it's the tenant's only remaining active store.
  - Otherwise runs `UPDATE stores SET deleted_at = NOW(), scheduled_purge_at =
    DATE_ADD(NOW(), INTERVAL 30 DAY) ...` — no longer checks for
    products/sales/user_roles; having that data is explicitly allowed once
    confirmed.
- `PATCH /:id/set-default` (Tenant Admin only) — transactionally clears
  `is_default_store` on every store for the tenant and sets it on the target.
- `GET /deleted` (Tenant Admin only) — lists soft-deleted, not-yet-purged stores
  with a computed `daysRemaining`. **Registered before `GET /:id`** in the route
  file — otherwise Express would treat the literal path segment `deleted` as an
  `:id` value, per this codebase's "literal routes before wildcard" convention.
- `POST /:id/restore` (Tenant Admin only) — only works while
  `scheduled_purge_at > NOW()`; clears both `deleted_at` and `scheduled_purge_at`.

### 10.3 Purge script

`backend/scripts/purge-expired-stores.js` hard-deletes any store whose
`scheduled_purge_at` has passed, plus all of its data — same schema-driven
`INFORMATION_SCHEMA`-based table discovery technique as
`generate_delete_tenant_sql.js`, plus a hardcoded child-table list (`sale_items`
via `sales.id`, etc.) for tables that hang off a store-owned parent rather than
having their own `store_id` column. Dry-run by default (`npm run
purge:expired-stores:dry`); pass `--execute` (`npm run purge:expired-stores`) to
actually delete. No cron/scheduler runs this automatically — same manual-invocation
convention as every other maintenance script in `backend/scripts/`. See the
script's own header comment for exactly what it does and does not yet cover
(notably: it does not remove any associated files/blobs from disk/object storage).

### 10.4 Frontend

- `frontend/src/services/storeService.ts`: `AccessibleStore` gained `isDefault:
  boolean`; `deleteStore()` now sends `{ confirm: true }`; added
  `setDefaultStore()`, `getDeletedStores()`, `restoreStore()`.
- `frontend/src/components/profile/StoresTab.tsx`: rewritten — shows a "Default"
  badge, disables the delete button (with an explanatory tooltip) on the default
  store, adds a "Set as default" button on every other store, rewords the delete
  confirmation to explain the soft-delete + 30-day purge behavior, and adds a
  "Recently deleted" section (fetched via `getDeletedStores()`) with a per-store
  "Restore" button and days-remaining countdown.
- `frontend/src/contexts/StoreContext.tsx` needed no structural change —
  `AccessibleStore` is imported from `storeService.ts`, so its new `isDefault`
  field flows through automatically.

### 10.6 Unrelated bug found via live testing: `LIMIT ?`/`OFFSET ?` bound params fail on this MySQL host

Discovered while testing this feature (checking Users & Roles right after creating and
switching into a new store) — not caused by anything in this feature, just the first time
`GET /api/users` had run against `mysql.us.cloudlogin.co` in a while. `backend/config/db.js`'s
`query()` wrapper always runs SQL through `connection.execute()` (a real MySQL prepared
statement), and this hosted MySQL server rejects `LIMIT ?`/`OFFSET ?` passed as bound
parameters with `ER_WRONG_ARGUMENTS: Incorrect arguments to mysqld_stmt_execute` — a known
mysql2/MySQL prepared-statement limitation on some server configs/versions. Fixed in
`backend/routes/userRoutes.js`'s `GET /api/users` by validating `limit`/`offset` to plain
clamped integers and inlining them directly into the SQL string instead of binding them
(also added a column whitelist for the pre-existing `ORDER BY u.${sort}` interpolation while
in there). **Not yet fixed**: the same `LIMIT ? OFFSET ?` bound-param pattern exists in at
least 12 other files — `savingsSchemes.routes.js`, `repairs.routes.js`, `oldGold.routes.js`,
`layaway.routes.js`, `salesReturnController.js`, `salesOrdersController.js`,
`printJobService.js`, `grnController.js`, `paymentGatewayRoutes.js`,
`paymentTerminalRoutes.js`, `auditService.js`, `activityLog.routes.js` — any of their paginated
list endpoints will hit the same 500 the first time they're exercised against this DB host.
Apply the same inline-integer fix to each when its endpoint is next touched or reported broken.

### 10.5 Not yet manually tested

Same caveat as §9 above — verified via `node -c` / `tsc --noEmit` only, no live
run yet. Before trusting this in production, manually verify: deleting a
non-default store with real data (confirm dialog, soft delete, appears under
"Recently deleted"), restoring it, changing the default store, and confirming the
default store's delete button stays disabled with the store still showing up
normally everywhere else.
