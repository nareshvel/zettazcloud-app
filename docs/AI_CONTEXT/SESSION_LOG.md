# AI Session Log

Append-only. Newest entry at the bottom. See `HANDOFF_PROTOCOL.md` for the
entry format and the rules around it. Don't rewrite or delete old entries —
if something described here turned out to be wrong, add a new entry that
says so rather than editing history.

---

## 2026-09-09 — Claude (Cowork)
**Changed:** Added a per-transaction tax-mode override for duty-free/domestic
sales (backend `createSaleController.js`, frontend `CartContext.tsx` +
`Cart.tsx`), with real-world compliance logic — a walk-in customer with no
traveller evidence can never be zero-rated, even via manual override. Fixed
a React stale-state bug where switching the override back to Domestic didn't
restore tax. Traced and fixed cashiers being able to see/click a Dashboard
shortcut they shouldn't (`isAdminUser` vs. `dashboard.view` confusion —
`dashboard.view` is deliberately granted to Cashier for an unrelated purpose
and is NOT a valid admin-nav gate); added `isAdminUser()` to
`permissionUtils.ts`, applied to `SalesHubPage.tsx` and `Breadcrumbs.tsx`,
and removed `dashboard.view` from Cashier in both the live signup seed
(`permissionSeedingService.js`) and existing tenants (migration
`2026-09-03_remove_dashboard_view_from_cashier_roles.sql`, not yet run by
the user). Added pagination (10/25/50/100 dropdown) to `ReusableTable.tsx`
and wired it into `CustomersPage.tsx` and `StockCountPage.tsx`; fixed a
missing `itemsPerPage` dependency in `StockCountPage.tsx`'s pagination memo
that caused the row count to not update when the page-size dropdown changed.
**Files:** `backend/controllers/createSaleController.js`,
`frontend/src/contexts/CartContext.tsx`, `frontend/src/components/pos/Cart.tsx`,
`frontend/src/services/templateReceiptService.ts`,
`frontend/src/utils/permissionUtils.ts`,
`frontend/src/components/common/Breadcrumbs.tsx`,
`frontend/src/pages/SalesHubPage.tsx` (+ `.test.tsx`),
`backend/services/permissionSeedingService.js`,
`database/migrations/2026-09-03_sales_tax_mode_override_permission.sql`,
`database/migrations/2026-09-03_remove_dashboard_view_from_cashier_roles.sql`,
`frontend/src/components/ReusableTable.tsx`,
`frontend/src/pages/StockCountPage.tsx`, `frontend/src/pages/CustomersPage.tsx`.
**Verified:** `tsc --noEmit` clean throughout. `SalesHubPage.test.tsx` 30/30
passing after the final `isAdminUser` fix. Tax-mode override logic reviewed
against real-world compliance requirements but not yet exercised end-to-end
against a live checkout. Pagination changes verified via `tsc` only, not
manually clicked through in a browser.
**In-flight / not yet done:**
- User has NOT yet run `2026-09-03_remove_dashboard_view_from_cashier_roles.sql`
  against the database — needs `npm run migrate:status` then `npm run migrate`.
- Original "footer not pinned to page bottom" report was investigated (ruled
  out stale template config) but never root-caused or fixed — may still be
  broken.
- No end-to-end test sale (walk-in + discount + duty-free override + print)
  has been done since the tax-mode/stale-state/compliance fixes landed.
- Reorganized the entire `docs/` folder (223 files, 33 old numbered folders)
  into the new taxonomy described in `docs/README.md`: `AI_CONTEXT/`,
  `ARCHITECTURE/`, `archive/`, `CLIENTS/`, `DECISIONS/`, `FEATURES/`,
  `HANDOFF/`, `ISSUES_FIXES/`, `MODULES/`, `STRATEGY/`, `TESTING/`. Nothing
  deleted — superseded/duplicate content (old GRN drafts, old RBAC migration
  docs, `OLD_FILES_FOR_REFERENCE_ONLY/`) moved to `archive/`. `CLAUDE.md`'s
  "Docs index" table still needs its paths updated to match — that's the
  very next step in this session, not yet done as of this log entry.

**Update, same session:** `CLAUDE.md`'s "Docs index" table and every other
`docs/...` reference inside it (18 total) rewritten to the new paths and
verified with a repo-wide grep — zero stale `docs/1-...` through `docs/18-...`
references remain in `CLAUDE.md`, `AGENTS.md`, or any backend/frontend source
file. Also discovered and filled in an empty "Imported Claude Cowork project
instructions" section at the bottom of the pre-existing `AGENTS.md` (written
by an earlier Codex/Cursor session) — it now points back to `CLAUDE.md` and
`AI_CONTEXT/` instead of sitting empty; added a reciprocal pointer from
`CLAUDE.md` to `AGENTS.md` so either file leads to both. Discovered `docs/`
is entirely gitignored (`.gitignore` line 41) — no version history exists for
any doc, old or new; flagged in `HANDOFF_PROTOCOL.md` as the reason this
session log is the only durable record of doc changes, and recommended
removing that gitignore line (not yet done — the user's call).
**Known gap:** ~12 files *inside* `docs/` (mostly in `HANDOFF/`, `ARCHITECTURE/`,
`STRATEGY/`) still contain internal cross-links to old sibling paths like
`docs/17-migration-and-roadmap/NN_....md` pointing at docs that moved — these
are doc-to-doc links, not code references, so nothing is broken outside
`docs/`, but a reader following an old internal link inside one of these
files will hit a 404. Not rewritten in this pass (223-file link audit was out
of scope); worth a follow-up grep-and-fix pass if it becomes annoying.
**Next:** Run the pending `dashboard.view` migration, do the deferred
end-to-end sale/print test, revisit the footer-pinning report if the user
hits it again, and optionally fix the internal doc cross-links noted above.

---

## 2026-09-09 — Claude (Cowork), follow-up
**Changed:** User removed the `/docs/` line from `.gitignore` (line 41) —
closing the gap flagged above. Ran `git add docs/ && git commit`, giving the
whole reorganized 225-file structure a single baseline commit
(`9ee16530c`) under `git config user.email/user.name` set to the project
owner. Updated `HANDOFF_PROTOCOL.md`'s "Known gap" section to reflect that
`docs/` is now tracked — `git log`/`git blame` work normally on doc paths
going forward, though history before this commit doesn't exist (one-time
gap from the baseline squash, not ongoing).
**Files:** `.gitignore` (user's change), `docs/AI_CONTEXT/HANDOFF_PROTOCOL.md`.
**Verified:** `git status --short docs` clean after commit; `git log -1
--stat` confirms all 225 files landed in the one commit.
**In-flight:** none.
**Next:** No change to the prior entry's "Next" list — this was purely
closing the git-tracking gap. Future doc edits get normal per-commit history
from here on; no special handling needed.

---

## 2026-09-09 — Devin
**Changed:** Built a native VoterMatrix-style aside menu in `Sidebar.tsx` (no Metronic/Bootstrap): dark navy floating rounded panel, bright-blue active leaf, grouped sections with uppercase headers, single-open accordion, permission/industry filtering, collapsed-mode flyouts, wider `w-72` panel, flattened Sales Floor, renamed Team → "Team & Access". Updated `MainLayout.tsx` offsets for the floating panel. Fixed idle/blank-menu issues in `i18n/index.ts` (always invoke backend read callback, even when tab is hidden) and `main.tsx` (dev-only reload after 2-min hidden). Wrapped `useI18n.ts` `t` in `useCallback` for stable dependency arrays.
**Files:** `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/components/layout/MainLayout.tsx`, `frontend/src/hooks/useI18n.ts`, `frontend/src/i18n/index.ts`, `frontend/src/main.tsx`.
**Verified:** `npx tsc --noEmit`, `npx eslint` on changed files, and `npm run build` all clean. UI tested via screenshots/feedback during the session; no formal browser QA pass.
**In-flight:** none — menu work is complete, though the user may further tweak rounded corners or copy the style to another app.
**Next:** No change to the prior "Next" list: run the pending `dashboard.view` migration, do the end-to-end sale/print test, revisit footer-pinning if it recurs, and optionally fix the ~12 old internal doc cross-links.

---

## 2026-09-09 — Devin, pending-task audit
**Changed:** Reviewed the `dashboard.view` migration status and the per-transaction duty-free override state against `CLAUDE.md`'s "Known pending work" list. `2026-09-03_remove_dashboard_view_from_cashier_roles.sql` is already applied to `digitpulse_zcloud` (shown by `npm run migrate:status`), so that item is done. The per-transaction sales-mode override for duty-free/domestic is implemented in `CartContext.tsx`, `Cart.tsx`, `createSaleController.js`, and the `sales.override_tax_mode` permission, so it is also built — `CLAUDE.md` was still listing it as pending. Updated `CLAUDE.md` "Known pending work" to reflect these two items are no longer open.
**Files:** `docs/AI_CONTEXT/SESSION_LOG.md`, `docs/CLAUDE.md`.
**Verified:** `npm run migrate:status` in `backend/` (65 applied, 0 pending); `grep` confirmed `sales.override_tax_mode` UI and backend code exist. Not field-verified with a live checkout.
**In-flight:** none — audit and doc update only.
**Next:** True remaining tasks are: end-to-end sale/print test, footer-pinning report if it recurs, ~12 internal doc cross-links, and the broader `CLAUDE.md` work that remains (Sales Hub glance strip, mobile/tablet QA, market-rate cron, `weight_unit` typing, Print Agent Go build vet, print-module next phases, etc.).

---

## 2026-09-10 — Devin
**Changed:** Completed the Sales Hub glance strip: added `GET /api/sales-hub/glance` endpoint, `getSalesHubGlance()` service, and red count badges on the Repair and Memo out shortcuts. Investigated the "footer not pinned" report and confirmed the `pageFooter` block already pins correctly in both the print stylesheet and the canvas preview. Implemented the per-item `show_on_receipt` industry-attributes block for print templates: new `itemAttributes` block type, `PrintContext.fieldOverrides` plumbing in `saleToPrintData.ts`, renderer in `printTemplateRenderer.ts`, preview in `TemplateCanvas.tsx`, and `getTenantFieldOverrides('product')` supplied by `receiptService.ts`. Confirmed with the user that `cost_code` must **not** appear on customer-facing receipts/invoices — it remains internal-only.
**Files:** `backend/controllers/salesHubController.js`, `backend/routes/salesHub.routes.js`, `frontend/src/services/salesHubService.ts`, `frontend/src/pages/SalesHubPage.tsx`, `frontend/src/types/printTemplate.ts`, `frontend/src/utils/saleToPrintData.ts`, `frontend/src/utils/printTemplateRenderer.ts`, `frontend/src/components/print-templates/TemplateCanvas.tsx`, `frontend/src/services/receiptService.ts`.
**Verified:** `npx tsc --noEmit` in `frontend/` passes. No browser/print QA run.
**In-flight:** none — the requested print/Sales Hub items are done.
**Next:** Update `CLAUDE.md` "Known pending work" to remove the completed items.

---

## 2026-09-10 — Devin, follow-up
**Changed:** Fixed the Memo & Consignment page `Overdue` KPI. It was incorrectly using `status='cancelled'` as its filter, so clicking it produced an empty list. The `Overdue` card now sets `statusFilter='overdue'`, `listMemosPaged` passes `overdue=1` to the backend, and `backend/routes/memo.routes.js` filters for `status='open' AND due_date < CURDATE()`.
**Files:** `frontend/src/pages/MemoPage.tsx`, `frontend/src/services/jewelryOpsService.ts`, `backend/routes/memo.routes.js`.
**Verified:** `npx tsc --noEmit` in `frontend/` passes.

---

## 2026-10-06 — Devin
**Changed:** Created a PaisePath-style local Docker MySQL setup for Zettaz (`docker-compose.yml`). Restored the shared-hosting dump `digitpulse_zcloud.zip` into a local `digitpulse_zcloud` DB. The dump contained generated-column values that MySQL 8 rejects, so a preprocessing step removed them before import. Built a clean production dump at `database/dumps/digitpulse_zcloud_clean.sql` containing only the owner/test tenants (`Global Retail LLC / zettaz.com` plus the five `demo*` demo tenants); all real customer tenant data and rows were removed.
**Files:** `docker-compose.yml` (new), `database/dumps/digitpulse_zcloud_clean.sql` (new).
**Verified:** `docker compose up -d mysql` started cleanly; full dump loaded into `digitpulse_zcloud`; `digitpulse_zcloud_clean` contains 6 tenants, 10 users, 7 stores, 410 products, 49 sales (vs. 9 / 15 / 10 / 576 / 54 in the full dump); `mysqldump` of the clean DB produces a 4,287-line file with `CREATE DATABASE digitpulse_zcloud` and `USE digitpulse_zcloud`.
**In-flight:** none.
**Next:** Update `backend/.env` to point the local app at the Docker MySQL (`zettaz_dev` or `digitpulse_zcloud`) and import `database/dumps/digitpulse_zcloud_clean.sql` to the production server when ready.

---

## 2026-10-06 — Devin, production DB migration
**Changed:** Migrated the production Zettaz backend from the shared remote MySQL (`mysql.us.cloudlogin.co`) to a local MySQL 8.0 instance on the production VPS. Steps: uploaded `digitpulse_zcloud_full.sql` to the server, created `zettazcloud_prod` database, restored the full dump, created `zettazcloud_systemadmin`@`127.0.0.1` DB user, updated `.env.production`/`backend/.env` to `MYSQL_HOST=localhost`/`MYSQL_DATABASE=zettazcloud_prod` and `BEHIND_REVERSE_PROXY=true`/`ENABLE_EXPRESS_CORS=true`. Switched nginx from remote to local MySQL by copying `.env.production` over `.env` and restarting `zettaz-api` via PM2.
**Files:** `backend/.env` (server), `backend/.env.production` (server), `backend/controllers/reportsController.js` (server — 4 date-format fixes for MySQL 8 `DATE()` compatibility).
**Verified:** PM2 `zettaz-api` starts with `Environment: production` and `Database setup check passed`; `https://api.zettaz.com/` returns 404 through nginx on port 5172; browser login to `https://cloud.zettaz.com` succeeds; dashboard loads without 500s after removing `NO_ZERO_DATE` from MySQL `sql_mode` and fixing date parameters.
**In-flight:** MySQL `sql_mode` `NO_ZERO_DATE`/`NO_ZERO_IN_DATE` was removed with `SET GLOBAL` but is not yet persisted in `mysqld.cnf` — will revert on MySQL restart until added to config.
**Next:** Persist the `sql_mode` change in `/etc/mysql/mysql.conf.d/mysqld.cnf` and restart MySQL; optionally commit the `reportsController.js` date-format fixes to source; verify the local `zettaz_dev` Docker setup remains working for local dev.

---

## 2026-10-06 — Devin, RBAC Phase 1 hardening + catalog alignment
**Changed:** Full RBAC audit and Phase-1 fixes. `unifiedAuthMiddleware.hasPermission()` now resolves permissions from the live DB via `rbacService` (with the same store-context precedence as `requirePermission`), so both authorization paths agree and role changes take effect without re-login. `rbacService.getUserRolesAndPermissions()` now constrains roles to the request tenant (or the user's own tenant) — closing a cross-tenant leak where `?tenantId=` params let a user's home-tenant roles satisfy checks under another tenant; store-scoped roles no longer apply when no store context exists; role dedup now unions permission IDs via a Set instead of silently dropping same-named roles; cache TTL bug fixed (`5 * 60` → `RBAC_CACHE_TTL` ms). `isTenantAdmin` additionally requires `is_system_role = 1`, and `roleService` rejects the reserved name `Tenant Admin` on create/rename of non-system roles. Cache invalidation added on every user_roles/role_permissions write (rbacService assign/remove, roleService update/delete post-commit, userRoutes role rewrite/delete, employees account_role_id, roleRoutes permissions write). Removed dead `routes/userRoleRoutes.js` (mounted but broken: unimported service, `|| "system"` always-truthy self-check). `PUT /api/roles/permissions/:roleId` now verifies role ownership by tenant and rejects system-prefixed permissions on tenant roles; `GET /api/permissions/role/:roleId` fixed (was calling nonexistent service methods + undefined `PERMISSIONS`). Remapped ~30 phantom route permission names to canonical `module.action` catalog names (e.g. `categories.update`→`categories.edit`, `sales.return.*`→`sales-return.*`, `payment_methods.*`→`payments.*`, `settings.create/update/delete`→`settings.printer`, `admin`→`system.maintenance`, `activity.read`→`system.audit`); printer-settings reads now use `printer.view`. Added 13 missing catalog permissions (system.roles.manage, system.plans.manage, system.platform.manage, tenants.edit, tenant.subscription.view, sales.delete, sales.override_tax_mode, payments.refund, payments.delete, tax.delete, grn.delete, orders.create, orders.edit) in `permissionSeedingService.js` + migration `2026-10-06_rbac_phase1_permission_catalog_alignment.sql`. Role-permission picker now hides system-prefixed perms from tenant roles. Seeding `assignPermissionsToRole` is now additive-only (never strips tenant customizations on backfill). Frontend: `CartContext` + `useTaxClassesData` skip tax-settings calls when the token lacks `tax.view`/`settings.view` (ProductFormModal already had this guard).
**Files:** `backend/services/rbacService.js`, `backend/services/roleService.js`, `backend/services/permissionSeedingService.js`, `backend/services/cacheService.js` (deleteByPrefix), `backend/middleware/unifiedAuthMiddleware.js`, `backend/routes/{roleRoutes,permissionRoutes,userRoutes,index,employees,category,customer,grnRoutes,payment,paymentGateway,paymentTerminal,product,salesReturn,printAgent,printTemplates,printerDevices,retailProfile,store,supplier,subscriptionRoutes,activityLog,printJobs,printTests,printerSettings}.routes.js`, `backend/routes/userRoleRoutes.js` (deleted), `backend/tests/rbacHardening.test.js` (new), `backend/tests/printAgentRoutes.test.js` (contract updated), `database/migrations/applied/2026-10-06_rbac_phase1_permission_catalog_alignment.sql`, `frontend/src/contexts/CartContext.tsx`, `frontend/src/hooks/useTaxClassesData.tsx`.
**Verified:** `npm test` 374 passing / 10 failing — all 10 are pre-existing baseline failures (verified via stash A/B). New `rbacHardening.test.js` pins: route-perm names ⊆ catalog, is_system_role gate, tenant containment, post-commit cache invalidation, tenant-scoped role writes. `npx tsc --noEmit` clean. Migration applied locally; local `permissions` table == code catalog (98 rows).
**In-flight:** The 10 baseline failures (`createSaleController.dutyFree`, `taxHeaders`, `taxAuthWithToken`, sinon stub drift) predate this change and need their own fix pass. Frontend guard keys off the JWT snapshot — a permission granted mid-session still requires re-login for the *UI* to show it (backend now allows it immediately).
**Next:** Deploy via `deploy-quick.sh` + run `npm run migrate -- --yes` on prod (or let deploy script run migrations); verify Senior Cashier tax calls succeed WITHOUT relogin (that's the live-DB check working). Production "Senior Cashier" role remains tenant business data — keep or trim via Roles UI. Phase 2 backlog: per-user grant/deny overrides, audit logging on role/permission mutations, threshold/approval permissions (refund caps, discount limits), effective-permission preview endpoint for the UI.

---

## 2026-10-06 — Devin, dashboard access gating + widget permission guards
**Changed:** Follow-up to RBAC Phase 1 after production verification showed a `Senior Cashier`-class user could reach `/dashboard` by URL but hit 403s on every widget. Re-gated dashboard *navigation* on `dashboard.view` (SalesHubPage icon, Breadcrumbs root link) — the permission became meaningful once migration `2026-09-03` stripped it from Cashier/Sales Associate roles, so the `isAdminUser` workaround is retired (kept only for login routing). Dashboard.tsx now gates each data fetch by the permission its endpoint requires (`sales.view` for `/sales/summary`, `reports.view` for `/reports/sales/*`, `products.view` for inventory widgets, `sales.delete` for the delete-sale button), renders a `WidgetNoAccess` empty state per widget instead of 403 console spam, and shows a page-level access-denied screen when the user lacks `dashboard.view`. Inventory-context fetch is skipped for users without `products.view` so `isInventoryLoaded` can't hang the page. QuickStartGuide falls back to the JWT `storeId` instead of firing `/stores/current` when the user lacks `stores.view`. Removed `dashboard.view` from the baseline + Diamond Republic demo seed role lists to match the migration's intent for fresh seeds. Fixed `SalesHubPage.test.tsx`'s stale `salesHubService` mock (missing `getSalesHubGlance` stub — pre-existing harness break) and updated the nav-gating tests to the new contract.
**Files:** `frontend/src/utils/permissionUtils.ts`, `frontend/src/pages/SalesHubPage.tsx`, `frontend/src/pages/SalesHubPage.test.tsx`, `frontend/src/components/common/Breadcrumbs.tsx`, `frontend/src/pages/Dashboard.tsx`, `frontend/src/components/onboarding/QuickStartGuide.tsx`, `database/seeds/applied/2025-06-18_rbac_seed_data.sql`, `database/seeds/applied/2026-08-14_diamond_republic_extras_seed.sql`, `database/seeds/applied/2026-08-15_diamond_republic_antigua_seed.sql`.
**Verified:** `npx tsc --noEmit` clean; `vitest run src/pages/SalesHubPage.test.tsx` — all 31 pass including new `dashboard.view` gating tests.
**Next:** Tenant grants `reports.view` + `stores.view` (and `dashboard.view` if not already held) to the "Senior Cashier" role via Roles UI — custom tenant role = business data, deliberately not seeded/migrated. Grant takes effect immediately (live-DB authz).

---

## 2026-10-06 — Devin, RBAC Phase 2 + test-suite repair + bundle split
**Changed:**
- **Phase 2a audit logging**: `auditLogService.logAuditEvent` was a stub — the `audit_logs` INSERT was commented out, so every `logActivity` call app-wide was a silent no-op. Now writes real rows (action→resource_type mapping, event_category/severity/status/old_values/new_values). Added `auditReq(req, fields)` helper; wired into every role/permission mutation: roleRoutes system+tenant CRUD, `PUT /permissions/:roleId` (captures old vs new permission names), `userRoutes PUT /:userId/roles`, `employees PUT /:id` role changes. All pre-existing `logActivity` callers now persist too.
- **Phase 2b**: `GET /api/users/:id/effective-permissions` — resolved roles + permissions + per-store scoping via `getUserRolesAndPermissions`, plus `tenantAdmin` bypass flag and override list. Self or users.view/tenant-admin only; cross-tenant targets 404.
- **Phase 2c**: `user_permission_overrides` table (grant/deny, optional store_id + expires_at) — per-user adjustments without cloning a role. Resolution inside `getUserRolesAndPermissions`: tenant-wide + store-scoped rows, store scope wins over tenant-wide, deny wins same-scope. `POST/GET/DELETE /users/:id/permission-overrides` (users.edit/users.view); grant of system.* etc. rejected like role writes.
- **Phase 2d**: `role_limits` (discount_percent / discount_amount / refund_amount per role, effective cap = MIN across user's roles, tenant admin uncapped) + `users.pos_pin_hash` + `approvals.manager_override` permission + `POST /users/me/pos-pin`. `limitService.enforceLimit` wired into createSaleController (discount) and salesReturnController (return total); over-cap without a valid `manager_pin` in the body → 403 `LIMIT_EXCEEDED`/`requires_manager_override`. Fail-open when no caps configured or lookup errors (opt-in feature, checkout must not stall). Role caps managed via `GET/PUT /roles/tenant/:id/limits`.
- **Phase 2e**: `user_roles.expires_at` — filtered at read time in the resolver; `assignTenantRole` + `PUT /users/:id/roles` accept `expires_at`.
- **Phase 2f**: deleted `mapRoleToPermissions` and `inferRoleFromPermissions`; `user.role` in `mapBackendDataToUser` now derives from actual role names only (permission-count/pattern inference could label any 40-perm user 'tenant_admin').
- **Test repair**: `taxHeaders.test.js` uses signed JWTs (dev header fallback is gated behind ALLOW_DEV_HEADER_AUTH); `taxAuthWithToken.test.js` + new test files force fresh `config/db`/`rbacService` requires to survive require-cache pollution from sibling tests; `documentSectionsModel.test.ts` updated to current "Walk-in Customer" contract.
- **Bundle**: all non-landing pages lazy-loaded (`React.lazy` + `Suspense`); Pos/SalesHub/Dashboard stay eager. Main chunk 4,472 kB → 1,207 kB (gzip 1,069 → 312).
**Migrations:** `2026-10-06_rbac_phase2_user_permission_overrides.sql`, `2026-10-06_rbac_phase2_expirable_role_assignments.sql`, `2026-10-06_rbac_phase2_limits_and_manager_pin.sql` — all applied locally, idempotent.
**Verified:** backend `npm test` 395 passing / 0 failing (was 374/10 pre-RBAC); frontend `vitest` 734 green; `tsc --noEmit` clean; `vite build` clean; `go build ./... && go vet ./...` clean in print-agent.
**Next:** deploy via `deploy-quick.sh` + `node scripts/migrate.js --yes` on VPS; persist prod MySQL `sql_mode` in mysqld.cnf (still runtime-only). Follow-up UX not yet built: POS manager-PIN prompt modal on LIMIT_EXCEEDED, Roles UI surfaces for limits/overrides/effective-permissions.

---

## 2026-10-07 — Devin, view-only Settings + attachment permission gating + logo enum fix
**Changed:** Reported symptom: a view-only Senior Cashier could open Settings and attempt a logo upload, which 400'd. Root causes were two: (1) `attachments` POST/DELETE had NO permission check — any authenticated tenant user could write files for any entity; (2) `attachments.kind` enum lacked `'logo'` (the value the Settings UI sends), so strict `sql_mode` rejected the insert with data truncation. Fixes: `attachments.routes.js` now maps every `ALLOWED_ENTITIES` type to read/write permissions in `ENTITY_PERMS` (`store`→`stores.view`/`stores.edit`, product/product_piece→products.*, customer→customers.*, repair_order/layaway→sales.*, memo→inventory.*); `permFor('read'|'write')` resolves the route-param entity before `requirePermission`; DELETE loads the row first to learn the entity type, then checks via `rbacService.hasPermission` (with tenant-admin bypass). Migration `2026-10-07_attachments_kind_logo.sql` adds `'logo'` to the enum. `GeneralSettings.tsx` renders read-only when the user lacks `stores.edit` (all inputs, logo dropzone/input/remove, duty-free + numbering checkboxes, and Save are disabled with a view-only hint). `SalesHubPage` user menu gains an unconditional "My Profile" → `/profile` link, and the Settings link now requires `settings.edit` or `stores.edit`.
**Files:** `backend/routes/attachments.routes.js`, `backend/tests/attachmentsRoutes.test.js`, `frontend/src/components/settings/GeneralSettings.tsx`, `frontend/src/pages/SalesHubPage.tsx`, `database/migrations/2026-10-07_attachments_kind_logo.sql` (+ applied/).
**Verified:** backend `npm test` 405 passing; new mapping test asserts every entity has read+write specs; frontend `vitest` 734 green; `tsc --noEmit` clean.
**Next:** Deploy: `bash deploy-quick.sh` then `node scripts/migrate.js --yes` (applies the attachments enum). In prod verify: view-only user sees disabled Settings controls + 403 on direct upload; editor uploads a logo successfully.

## 2026-10-07 — Devin, Settings-tab view-only audit (all tabs) + backend write-route gates
**Changed:** Continuation of the view-only Settings work — every remaining Settings tab was audited for enabled save controls under view-only permissions. Backend write routes that lacked middleware were gated: `PATCH /stores/settings`→`stores.edit`; industry `PUT /tenant`, `PUT|DELETE /overrides`, `PUT /cost-code`→`settings.edit`; metal-rates `PUT /settings`, `POST /`, `POST /fetch-market/publish`→`settings.edit` (fetch-preview + calculate left open — read/compute only); catalog-sync `POST /channels`, `PUT /channels/:id`, `POST /channels/:id/publish`, `POST /queue/:id/complete`→`settings.edit`; labels `PUT /settings`→`settings.printer` (print ops left open — staff task). Frontend tabs mirror those gates with `canEdit` + handler-level guards + disabled controls: Localization (`stores.edit`), CostCode/IndustryFields/MetalRates/CatalogSync (`settings.edit`), Printer+LabelPrinter (`settings.printer`), Taxes (basis→`stores.edit`; class/rate create/edit/delete→`tax.create`/`tax.edit`/`tax.delete`), Payments toggles (`payments.edit`, still local-state-only pending backend write API). Security + Notifications are self-service local-state (no backend writes) — left ungated. Paytime is read-only status.
**Verified:** backend `npm test` 405 passing; frontend `vitest` 734 green; `tsc --noEmit` clean.
**Next:** `bash deploy-quick.sh` on VPS — no new migrations. In prod verify a view-only user sees disabled save controls on every tab and direct write calls return 403.
