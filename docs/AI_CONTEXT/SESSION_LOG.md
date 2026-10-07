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

## 2026-10-08 — Devin, platform/system-admin console (paisepath parity)
**Changed:** Built the full platform-admin surface modeled on paisepath-app's platform + platform-ops modules, consolidated into one module. Migration `2026-10-08_platform_admin.sql` adds tenants lifecycle columns (status/suspended_reason/at/deletion_due_at/created_by), tenant_features (tri-state flags), announcements, support_tickets(+messages), job_runs, platform permission seed into `permissions` (live path) + `system_permissions` (legacy), platform roles as `roles` rows with `tenant_id NULL` (required making `roles.tenant_id` nullable), the well-known platform tenant `00000000-…-0001` + un-loginable bootstrap system user `…-0002` (roles.created_by FK needs a real user). Backend: `services/platformService.js` (overview metrics w/ per-currency MRR, tenant list w/ paisepath-style 0–100 health scores, tenant CRUD+suspend/resume/scheduleDeletion/cancel/export(gzipped JSON, no credentials)/features/impersonate, subscriptions+billing-issues feed, platform staff CRUD, platform RBAC read/update, audit feed dual-written to platform+tenant, announcements, tickets); `services/platformJobs.js` (setInterval runner + job_runs ledger — expireTrials, dunning(grace lapse→expired), processDeletions(FK-off hard delete across all tenant_id tables)); `routes/platform.routes.js` (~25 routes, all authenticate+requirePermission); `routes/support.routes.js` (tenant-facing tickets + announcements). `server.js` starts the scheduler after listen. `scripts/create-platform-admin.js` bootstraps the first console user (idempotent). **Auth boundary fixes:** `rbacPermissionMiddleware.checkUserPermission` now routes platform-scoped permission names (platform./tenants./subscriptions./plans./support. — NOT `system.`, which this codebase uses for tenant-admin capabilities) through `checkSystemPermission` (NULL-tenant role or legacy user_system_roles only — no tenant-admin bypass, verified live: tenant admin → platform.view=false). `subscriptionMiddleware` exclusions now match `req.originalUrl` (mount at /api stripped req.path so exclusions never fired) + `/api/platform` exempt + `imp` impersonation-claim bypass. `unifiedAuthMiddleware.authenticate` sets `isPlatformUser`/`isSystemAdmin`, blocks suspended/pending_deletion tenants per-request (60s status cache, fail-open on lookup error, imp-exempt); `login` refuses suspended/pending-deletion tenants (platform tenant exempt). `permissionService.getUserPermissions` now includes NULL-tenant role grants. `permissionSeedingService` catalog gained the 26 platform permission names (rbacHardening test enforces route-literal↔catalog parity). Frontend: `services/platformApi.ts` typed client; `components/system/ui.tsx` (PageHeader/Stat/Badge/Modal/Field/Empty/btn kit), `SystemLayout` (own sidebar, per-permission nav), `SystemRoute` guard, `ImpersonationBanner` (mounted in AppLayout + HubFlowShell + SystemLayout; exit restores stashed token from sessionStorage); `pages/system/` — Dashboard, Tenants (list+drawer: admins/stores/features/edit/suspend/resume/export/impersonate/schedule-delete), Subscriptions (+billing-issues tab +edit +run-dunning), Plans (cards + JSON features/limits editor), Users (staff CRUD, last-admin guard), Rbac (platform role→permission matrix), Support (ticket drawer+reply+status), Announcements, Audit (tenant filter + paging), Health (DB/uptime/job_runs). `AppRoutes` mounts the group lazy; `Login.tsx` redirects platform staff to `/system`.
**Caveats:** snake_case boundary — fetchApi converts request bodies camel→snake, so service fns accept `data.foo_bar ?? data.fooBar`. `user_sessions.revoked_at` update in setTenantStatus is best-effort (`.catch`). deleteSystemUser is a soft-delete (is_active=0).
**Verified:** backend `npm test` 408 passing incl. new `platformAccess.test.js` (11 tests pinning the platform auth boundary); frontend `vitest` 734 green; `tsc --noEmit` clean; `vite build` clean; live DB smoke: overview/tenants/health queries run, platform roles seeded (System Admin 33p/Manager 18p/Support 10p), `checkSystemPermission` true for platform staff / false for tenant admin.
**Next:** `bash deploy-quick.sh` + `node scripts/migrate.js --yes` on VPS, then `node scripts/create-platform-admin.js --email … --name … --password …` to bootstrap console access. Local test account `devin-platform@test.local` exists in dev DB only. Deferred: tenant-facing support/announcement UI (APIs exist), per-tenant feature-flag enforcement in app code (flags exist, nothing consumes them yet), tenant user detail view in console.

## 2026-10-08 — Devin, CI green + system-nav grouping + PWA/share assets
**Changed:** GitHub Actions run 37538284957 is the first-ever green CI (all 3 jobs). Prior fixes: `c2b98eb` installs backend deps in the frontend job (frontend vitest files import `backend/services/printTemplateService.js` → `uuid` resolves via backend node_modules); `b2fcc08` repaired the clean-build replay — `0000_baseline_schema.sql` had been generated columns-only (dump's ALTER key/constraint blocks stripped), so it gained ~200 guarded key ops + ~95 guarded FK ops (55 index names skipped, recreated by `2025-08-16_performance_indexes.sql`); that file's stale columns fixed (stock_level→stock_quantity, phone→phone_number, users.role_id dropped — roles live in user_roles) and all CREATE INDEX statements wrapped in INFORMATION_SCHEMA guards; `2026-08-15_teardown_diamond_republic.sql` pins `SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci` before assigning @T (mysql2 connects with unicode_ci → illegal mix against 0900_ai_ci columns); 4 unguarded ADD COLUMN migrations wrapped in the standard guard pattern. **System console nav grouped** in `SystemLayout.tsx` (NAV → NAV_GROUPS: Dashboard solo, then Tenants & billing / Access control / Operations; empty groups hidden). **PWA/share assets:** iOS ignores SVG apple-touch-icon — generated real PNGs via qlmanage (magick's internal SVG renderer outputs blank); `apple-touch-icon.png` 180 full-bleed gradient, `icon-192/512.png` rounded-square w/ margin, `icon-512-maskable.png` full-bleed, `favicon-16/32.png`, `og-image.png` 1200×630 navy-gradient + light wordmark + tagline; `public/manifest.webmanifest` (standalone, theme #08145a); index.html gained manifest link, PNG favicons, theme-color, apple-mobile-web-app-*, and full og:/twitter: card meta (absolute cloud.zettaz.com URLs).
**Verified:** frontend vitest 734 green; tsc clean; vite build clean; icon renders inspected visually.
**Known print-agent limitation (documented, not yet fixed):** `ConfigStore` holds a single `TokenHash` — `Pair()` overwrites it, so pairing a second browser/profile/origin on the same agent silently invalidates the first client's stored token ('invalid-pairing'). Pairing itself is per-browser (localStorage `zettaz-print-agent-token`), NOT per-login — users on the same browser profile share one pairing across logins. If users report repeated re-pairing, the single-token model is the likely cause; fix = store multiple token hashes keyed by clientId.
**Next:** deploy-quick.sh on VPS still pending (platform-admin migration + create-platform-admin bootstrap).

## 2026-10-08 — Devin, tenant cleanup SQL + mobile bottom nav (paisepath parity)
**Changed:** (1) `backend/scripts/delete_tenant.sql` brought to full coverage — it predated newer tables: added 19 tenant_id deletes (print module, support_tickets, tenant_features, user_sessions, user_permission_overrides, sales_orders, document_sequences, role_limits, store_*, subscription_history) + 4 join-deletes for child tables without tenant_id (support_ticket_messages, template_versions, print_agent_printer_mappings, user_backup_codes); `SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci` pinned at top (TablePlus/mysql2 connect as unicode_ci → Illegal mix of collations otherwise); final block builds a UNION query from INFORMATION_SCHEMA over EVERY tenant_id table so verification catches tables added later. Verified end-to-end on dev DB (seeded throwaway tenant → script → zero leftovers) and machine-checked against live schema (no uncovered tenant_id table). (2) Mobile bottom navigation modeled on paisepath-app's BottomNav: new `components/layout/BottomNav.tsx` (md:hidden, in-flow below <main> — not fixed, safe-area inset, hidden while on-screen keyboard open via new `hooks/useKeyboard.ts`), permission-filtered tabs (Home/Sell/Customers/Reports — Sell targets /sales-hub for hub industries else /pos), raised centre "+" quick-actions sheet (plain overlay — no headlessui dep), "More" opens the sidebar drawer. `Sidebar.tsx` mobile drawer state is now optionally controlled (`mobileOpen`/`onMobileOpenChange`) — MainLayout owns it and closes on route change; floating top-left hamburger removed (More replaces it; close-X still renders while drawer open). TopBar mobile row `pl-14`→`pl-4` (hamburger clearance no longer needed). POS/sales-hub/HubFlowShell pages are outside AppLayout so they get no bottom nav automatically — matching the "except POS screen" requirement.
**Verified:** frontend vitest 734 green; tsc --noEmit clean; vite build clean; eslint only pre-existing errors (AppLayout empty pattern, TopBar anys).
**Next:** frontend rebuild on VPS to ship. Quick-action destinations navigate to list pages (/customers, /products, /purchase-orders) — none of those pages currently consume a ?new=1-style param, so the sheet deep-links rather than opening a create form directly; wire that up if wanted.

## 2026-10-08 — Devin, mobile responsiveness audit + ?new=1 deep links
**Changed:** Mobile QA follow-up to the bottom nav. (1) BottomNav quick actions now carry `?new=1`; ProductsPage/CustomersPage/PurchaseManagementPage/GoodsReceivingPage each consume it via useSearchParams (open create modal, strip param with replace so refresh won't reopen). (2) Full audit of unresponsive `grid-cols-N` (no breakpoint) across pages+components: every form-field grid gated to `grid-cols-1 sm:grid-cols-N` — ProductFormModal (6 grids + footer: restrict-store label was crushing the footer on phones → flex-wrap + basis-48), CustomerFormModal (9 grids + footer wrap), QuickAddCustomerModal (7), StockAdjustmentModal, CustomerSearchSelect inline-add, DynamicProductFields, JewelryPricingModal, SettingsTaxes (grid-cols-4 label rows → sm:grid-cols-4, text-right→sm:text-right, col-span-3→sm:col-span-3), IndustryFieldSettings, and modal forms in SavingsSchemes/Repairs/OldGold/Layaway/SerializedInventory/Memo/MetalRates/SettingsPayments/DutyFreeIntake. Deliberately kept multi-col: KPI/stat tiles, payment-method pills, tab bars, read-only info grids, backup codes, print-designer canvas. (3) ModalBase: p-4→p-2 sm:p-4, my-8→my-4 sm:my-8, 90vh→92vh phones; product image dropzone h-36 on phones (aspect-square pinned ~350px of a ~630px modal).
**Verified:** vitest 734 green; tsc clean; eslint errors all pre-existing (any-types/unused imports in touched files — none from this diff).
**Next:** frontend rebuild on VPS. Remaining manual QA: verify each quick action lands with the create modal open, check CategoryManagementModal + CreatePurchaseOrderModal on a real phone (both already md:grid-gated, footer density untested on device).

## 2026-10-09 — Devin, mobile nav/modal fixes + Stock Count page redesign
**Changed:** (1) `useKeyboard` no longer treats "editable element focused" as keyboard-open — StockCountPage autofocuses its scan input on mount, which hid the bottom nav until a click blurred it; only visualViewport covered>80 hides the nav now. (2) `SelectPoItemsModal` forced w-1/3|w-2/3 split + 7-col unwrapped table on phones → stacks vertically, PO list max-h-48, table min-w-[560px] in own scroll. `ModalBase` gained min-w-0 (flex min-width:auto trap — any unwrapped wide child could push the whole modal past the viewport). (3) Customer/PO/GRN modals: scrollable customer-type pills, 2-col compact fields, PO footer Cancel-before-Create, GRN items table overflow-x-auto min-w-[760px]. (4) **StockCountPage fully redesigned** around a real floor-count session (research: scan-first, progress over pagination, reason codes over free text, blind counts, draft persistence): progress card "counted X of Y" + remaining + bar; Blind toggle hides expected stock/deltas (steppers base on 0, no prefill/placeholder leak — variances revealed only at review); scope = scan input + horizontal category chips + filter chips All/Remaining/Counted/Variances; scanner loop = scan → exact barcode/SKU match (loaded list, else targeted fetch+upsert) → scroll row into view + select qty input → Enter returns to scan box; per-row state chips (Uncounted/Match/±delta), one-tap "Match" and "0" (not-found) actions; removed pagination entirely (limit=500 + "narrow scope" hint when truncated); counts+reasons auto-save to per-tenant+store localStorage draft (restored on mount, "Draft restored · time", Reset clears); review dialog uses reason-code chips per variance (count_error/damaged/theft_loss/found/expired/other→required detail) + "Set all" bulk apply, notes composed for backend's required per-product `notes`; success card + "Start new count".
**Verified:** vitest 734 green; tsc clean; vite build clean; eslint on StockCountPage only pre-existing-style fetchApi<any>/err:any.
**Next:** frontend rebuild on VPS. Deferred backend-side (if wanted): real count sessions (named counts, multi-device, approval gates for large deltas, count history report) — current design delivers the workflow within existing /stock-counts endpoints.

## 2026-10-09 — Devin, stock count sessions (named counts + approval + history)
**Changed:** Stock Count v2 — sessions are now the unit of work (supersedes the localStorage-draft redesign). Migration `2026-10-09_stock_count_sessions.sql`: `stock_count_sessions` (name, scope_category_id/name, blind, requires_approval, status in_progress→submitted→posted|cancelled, created/submitted/approved/posted audit fields, applied/skipped counts) + `stock_count_session_items` (per-product row snapshotting name/sku/barcode/category/expected_qty — history survives product renames/deletes; counted_qty/variance/reason_code/notes/added_during_count; UNIQUE(session_id,product_id)); seeds `inventory.count_approve` permission. `stockCount.routes.js`: extracted shared `applyCountedQuantity()` (shared-vs-store-owned branch + stock_adjustments/inventory_logs audit pair) used by /reconcile AND session post; new routes POST/GET sessions, GET /sessions/:id, PUT /sessions/:id/items (upsert counted/reasons; adds out-of-scope scans with added_during_count=1 + live-stock expected), POST submit (validates every variance has a note → requires_approval? submitted : post immediately), POST approve (count_approve perm → posts), POST cancel. Seed cap 2000 (full-store counts exceed /products 500). `permissionSeedingService` catalog + TenantAdmin/StoreManager/InventoryManager grants (NOT Cashier — approval is supervisory). `delete_tenant.sql` gained both tables. `services/stockCountService.ts` typed client. StockCountPage reworked: session list (active cards w/ progress bars + history) ↔ count view (scan loop, debounced per-item PUT = multi-device resume, Blind from session flag, "Out of scope" badge, read-only for submitted/posted/cancelled + Approve&post for count_approve holders + cancel flow); localStorage draft removed (server persistence supersedes).
**Verified:** backend 412 tests green (rbacHardening parity + migrationSplitter incl. new file); SQL smoke on dev DB — seed 135 items, upsert variance/notes, out-of-scope add, aggregates all correct (rolled back); frontend vitest 734 green; tsc clean; vite build clean; eslint only conventional fetchApi<any>/err:any.
**Next:** VPS — `node scripts/migrate.js --yes` (migration file left pending via --no-move) + frontend rebuild + `deploy-backend.sh`. NOTE: existing tenants won't have inventory.count_approve granted to their roles automatically (seeding is additive-on-onboarding) — grant via role editor, or backfill role_permissions for admin/manager roles if bulk assignment is wanted. Variance-threshold auto-escalation and multi-counter per-session assignment remain deferred.

## 2026-10-10 — Devin, stock-count session UI density pass + global muted-text darkening
**Changed:** Follow-up to the session redesign per user screenshots. (1) Session view controls collapse to one row: scan/search input + category Select ("All shelves", derived from `item.categoryName` distinct set — a "which shelf am I on" filter over the session's items, hidden when ≤1 category) + status Select (All/Remaining/Counted/Variances with live counts, replacing the permanent chip row) + Refresh icon button (new `refreshSession()` — flushPending then re-GETs session). (2) Item list is now `grid-cols-1 lg:grid-cols-2` of spacious cards (`rounded-xl border p-3.5 sm:p-4`, match state gets green border) instead of a divided list — "show more" cap button moved out of the grid. (3) New-count dialog's category scope chips → a single Select dropdown (options on click, same as sheet controls). (4) `index.css` light-theme `--muted-foreground` 0 0% 45.1% → 0 0% 32% (~4.4:1 → ~6.6:1 contrast vs white; dark theme untouched).
**Verified:** vitest 734 green; tsc clean; vite build clean; eslint only conventional err:any.
**Next:** frontend rebuild on VPS. Watch for contrast regressions in any place that paired muted-foreground text over a muted/dark surface.
