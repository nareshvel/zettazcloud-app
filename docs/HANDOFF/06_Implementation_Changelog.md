# Implementation Changelog — 2026-08-08

Additive, non-breaking changes. Nothing existing was removed; legacy behavior is
preserved when the new fields are absent.

> **Migrations are now applied and filed.** All migration/seed files referenced
> below have been run and moved to `database/migrations/applied/` and
> `database/seeds/applied/`. See `database/README.md` for the workflow and
> `database/MIGRATIONS_LOG.md` for the applied history. File paths below reflect
> their original (authoring) location.

## Database (apply in this order)
1. `database/migrations/2026-08-08_industry_fields_and_pricing.sql`
   — industry_types, industry_field_definitions, tenant_field_overrides,
   tenant_cost_code_settings, `tenants.industry_code`, and product columns
   (`purchase_price`, `handling_cost_pct`, `markup_pct`, `cost_code`, `attributes`).
2. `database/seeds/2026-08-08_industry_field_definitions_seed.sql`
   — industries + default fields (jewelry, apparel, electronics, grocery,
   pharmacy, general_retail).
3. `database/migrations/2026-08-08_employees_module.sql`
   — employees, employee_sales_targets, `sales.employee_id`.

All migrations are idempotent (guarded) and safe to re-run.

## Backend
- **New services:** `services/costCodeService.js`, `services/industryFieldService.js`,
  `services/paytimeService.js`.
- **New routes:** `routes/industry.routes.js` (`/api/industry`),
  `routes/employees.routes.js` (`/api/employees`); both mounted in `routes/index.js`.
- **Changed:** `routes/product.routes.js` — create handler now validates/persists
  `attributes`, computes cost from purchase+handling, generates `cost_code` when the
  cipher is enabled; product responses include the new fields.
- **Tests:** `tests/costCodeService.test.js` — 12 passing (`npx mocha tests/costCodeService.test.js`).

## Frontend
- **New:** `services/industryService.ts`,
  `components/inventory/DynamicProductFields.tsx`,
  `components/settings/CostCodeSettings.tsx`.
- **Changed:** `components/inventory/ProductForm.tsx` — pricing inputs (purchase /
  handling % / markup %) with live derived-price preview, plus the dynamic
  industry fields block.

## Verified
- `node --check` passes on all changed/added backend files.
- Cost-code unit tests pass (12/12).
- `tsc --noEmit` reports no errors in the changed/added frontend files.
- Request/response snake_case↔camelCase conversion accounted for (the frontend api
  client converts bodies; backend reads snake_case).

## Iteration 2 (2026-08-08) — UI wiring
- `components/inventory/ProductFormModal.tsx` (the second product form used by
  `ProductsPage.tsx`) now has the pricing inputs + `DynamicProductFields`;
  `pages/ProductsPage.tsx` FormData builder sends `attributes` (JSON),
  `purchase_price`, `handling_cost_pct`, `markup_pct` with correct snake_case keys.
- POS: `components/pos/ProductCard.tsx` surfaces up to three industry attributes
  (e.g. purity/weight/hallmark) as chips at point of sale.
- Employee UI: `pages/EmployeesPage.tsx` + `services/employeeService.ts` — list,
  add, deactivate, per-period performance (achieved vs target + computed
  incentive), and target/incentive setup. Route `employees` added in
  `AppRoutes.tsx`; sidebar nav item added.

## Iteration 3 (2026-08-08) — POS attribution + Repairs module
- **POS employee attribution:** `sales.employee_id` now populated. Backend
  `createSaleController.js` reads `employee_id`; frontend threads it through
  `CartContext` (`selectedEmployeeId`), `salesService`, and `api.CreateSaleData`;
  a "Sales staff" dropdown was added to `components/pos/Cart.tsx`. Employee
  performance now attributes automatically.
- **Repair / custom-order module (jewelry P1):**
  - Migration `database/migrations/2026-08-08_repair_orders.sql`
    (`repair_orders`, `repair_order_updates`, `repair_ticket_sequences`).
  - Backend `routes/repairs.routes.js` (`/api/repairs`): list/get/create (auto
    ticket no), update, status change with chain-of-custody history. Mounted in
    `routes/index.js`.
  - Frontend `services/repairService.ts` + `pages/RepairsPage.tsx` (intake modal,
    status-filtered list, inline status transitions). Route `repairs` + sidebar
    nav added.

## Iteration 4 (2026-08-08) — Old-gold / metal exchange (jewelry P1)
- Migration `database/migrations/2026-08-08_old_gold_exchange.sql`
  (`old_gold_purchases`, `old_gold_voucher_sequences`).
- Valuation service `services/oldGoldService.js`:
  pure weight = (gross − stone) × purity% ; value = pure × rate − deduction (min 0).
  Unit-tested in `tests/oldGoldService.test.js` (6 passing).
- Backend `routes/oldGold.routes.js` (`/api/old-gold`): list/get, `POST /preview`
  (valuation without saving), create (auto voucher `OG-00001` + valuation),
  status change with optional `redeemed_sale_id`. Mounted in `routes/index.js`.
- Frontend `services/oldGoldService.ts` (with a client-side valuation mirror for
  instant feedback) + `pages/OldGoldPage.tsx` (intake with live valuation,
  status-filtered voucher list). Route `old-gold` + sidebar nav added.

Migration to apply: `database/migrations/2026-08-08_old_gold_exchange.sql`.

## Iteration 5 (2026-08-08) — Serialized (per-piece) inventory (jewelry P1)
- Migration `database/migrations/2026-08-08_serialized_inventory.sql`
  (`product_pieces`, `product_piece_sequences`, `products.is_serialized`).
- Additive: coexists with fungible `stock_quantity`. When a product has pieces,
  `products.stock_quantity` is kept in sync = count of `available` pieces, and the
  product is flagged `is_serialized = 1`.
- Backend `routes/productPieces.routes.js` (`/api/product-pieces`): list by
  product, barcode/tag `lookup` (POS scan), create (auto `PC-000001` code +
  best-effort cost-code from the tenant cipher), `bulk` create, update, and status
  change (available/hold/sold/returned/melted). Mounted in `routes/index.js`.
- Frontend `services/productPieceService.ts` + `pages/SerializedInventoryPage.tsx`
  (product picker, status counts, per-piece table, single + bulk add). Route
  `serialized-inventory` + sidebar nav ("Serialized Stock") added.

Migration to apply: `database/migrations/2026-08-08_serialized_inventory.sql`.

## Iteration 6 (2026-08-08) — Navigation, design-system standards, practices
- **Menu reorg** (`Sidebar.tsx`): Customers, Repairs, Old Gold moved under
  **Sales Operations** (with Orders, Promotions, Sales Return); **System** renamed
  **Administration** with Settings, User Management, Employees. i18n keys added to
  all 6 locales (`nav.employees/repairs/old_gold/serialized_stock`,
  `sections.administration`).
- **Shared primitives:** `components/common/PageHeader.tsx`,
  `components/common/StatusBadge.tsx`. The four new pages (Employees, Repairs,
  Old Gold, Serialized) refactored to use `PageHeader`, `Button`, `StatusBadge`
  and semantic tokens instead of raw Tailwind / hand-rolled elements.
- **Docs:** `docs/11-developer-guidelines/FRONTEND_STANDARDS.md` (design-system
  rules), `docs/11-developer-guidelines/CODEBASE_AND_DEPLOYMENT.md` (CI, hooks,
  deploy/rollback, maintenance), `docs/2-architecture/ADR-0001-employees-vs-users.md`
  (decision: keep separate, link via `employees.user_id`, don't merge).

## Iteration 7 (2026-08-09) — Hygiene, theming, responsiveness, industry-aware menu
- **Dead files removed:** `grnController.js.backup`, `authMiddleware.js.backup`,
  `userRoutes.js.broken`, `userRoutes.js.fixed`, `archive/user.routes.js.bak`
  (none were referenced; git history retains them).
- **CI added:** `.github/workflows/ci.yml` — frontend lint/typecheck/build and
  backend lint/syntax/unit tests on every PR. `frontend/.env.example` added.
- **Theming unified to navy:** `tailwind.config.js` `primary` scale was indigo
  (`#6366f1`…) which read as light blue/purple; replaced with a true navy scale
  anchored on `--primary` (`226 85% 17%`). All raw `bg-blue-*` buttons across
  in-app pages/components replaced with `bg-primary` / `hover:bg-primary/90`
  (~70 files). Semantic status colours in `ui/badge` intentionally kept.
  Standard button = `ui/button` default size (h-9), used page and modal alike.
- **Responsiveness:** audit of every sidebar-linked page; new pages fixed
  (`p-4 sm:p-6`, wrapping filter chips, `grid-cols-1 sm:grid-cols-2` modals,
  stacked product picker). Documented in
  `docs/11-developer-guidelines/RESPONSIVE_STANDARDS.md` with a per-page table
  and a manual QA checklist.
- **Industry-aware platform:** onboarding now persists `tenants.industry_code`
  via new `backend/services/industryMapping.js`; "Jewelry Store" added to the
  onboarding list; `Settings → Industry` lets existing stores set/change it;
  `useIndustry()` hook + `industries: [...]` gating on nav items hides Old Gold
  (jewelry), Repairs and Serialized Stock (jewelry/electronics) for other
  verticals. Backfill migration for existing tenants.
  Plan: `docs/17-migration-and-roadmap/07_Industry_Aware_Platform_Plan.md`.

Migration to apply: `database/migrations/2026-08-09_backfill_tenant_industry_code.sql`.

## Iteration 8 (2026-08-09) — Settings consolidation, Promotions mobile, hard gating
- **Business Type moved into Settings → General** (separate "Industry" tab removed,
  `IndustrySettings.tsx` deleted). Saving General now also persists the industry
  when changed, clears the cache and reloads so fields/menus refresh.
- **Promotions mobile pass:** `PromotionalOffersPage` now uses `PageHeader` and
  responsive container padding (`px-4 sm:px-6 py-4 sm:py-6`). Its toolbar
  (`UniversalListControls`) and table (`ReusableTable`, `overflow-x-auto`) were
  already responsive.
- **Industry hard gating (3 layers):**
  - `backend/middleware/requireIndustry.js` → `403 INDUSTRY_NOT_ENABLED`; applied to
    `/api/old-gold` (jewelry), `/api/repairs` and `/api/product-pieces`
    (jewelry + electronics). Fails open only if industry can't be resolved.
  - `frontend/src/components/common/IndustryRoute.tsx` guards the matching routes
    in `AppRoutes.tsx` (redirects to dashboard).
  - Sidebar `industries: [...]` gating (from iteration 7).

## Iteration 9 (2026-08-09) — Roadmap completion (P2 + P3)
Six new migrations (all in `database/migrations/`, pending):
`2026-08-09_memo_consignment.sql`, `_layaway.sql`, `_attachments.sql`,
`_metal_rates.sql`, `_savings_schemes.sql`, `_catalog_sync.sql`.

- **Memo / consignment** — `memo_transactions` + `memo_items`, kept out of owned
  stock valuation. Memo-out reserves serialized pieces (`hold`) and returns free
  them. API `/api/memos`, page `MemoPage`.
- **Layaway** — plans, items, payments; schedule maths in `installmentService`.
  Completion releases reserved pieces as `sold`; cancel/default frees them.
  API `/api/layaways`, page `LayawayPage` with progress bars.
- **Attachments** — one polymorphic `attachments` table for products, pieces,
  repairs, customers, memos and layaways. `storageService` abstracts the driver;
  **local disk is the default** (reuses the existing `/uploads` pattern — no new
  credentials), with `storage_driver` recorded per row so S3 is a later swap.
  API `/api/attachments`.
- **Metal rates + weight pricing (opt-in)** — effective-dated `metal_rates`
  (publishing closes the previous rate so history is intact),
  `tenant_pricing_settings.weight_pricing_enabled` **off by default**, and
  `sale_items.pricing_snapshot` so historical invoices stay reproducible.
  API `/api/metal-rates`, page `MetalRatesPage`.
- **Savings schemes** — plans, enrollments, instalments; amount- **and**
  weight-based accrual, maturity bonus (extra instalment / percentage).
  API `/api/savings-schemes`, page `SavingsSchemesPage`.
- **Catalog sync (platform-agnostic)** — `sales_channels`, `channel_product_links`,
  `channel_sync_queue` outbox, plus a normalized JSON/CSV product feed. No
  platform picked: an adapter consumes the queue, so Shopify/Woo/custom can be
  added with no schema change. Credentials stored **by reference only**.
  API `/api/catalog`, page `CatalogSyncPage`.
- **POS wiring completed** — `createSaleController` now marks scanned serialized
  pieces `sold` (and re-syncs the product's available count) and redeems an
  old-gold voucher against the sale (`old_gold_voucher_id`).
- **Jewelry reports** — purity-wise valuation (serialized + non-serialized),
  piece status, old-gold summary. API `/api/jewelry-reports`, page
  `reports/JewelryValuationReport`.
- **Tests:** 35 backend unit tests passing (added `metalPricingService` and
  `installmentService` suites).

## Iteration 10 (2026-08-10) — Customer code, migration runner, sidebar fix

### Customer code (CU-000123)
- Migration `database/migrations/2026-08-10_customer_code.sql` — adds `customer_code`
  column (e.g. `CU-000123`) and `customer_code_sequences` table to `customers`.
  UUID `id` remains the internal key; `customer_code` is the human-visible identifier.
  Backfill uses `ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at, id)`
  for deterministic sequencing (MySQL 8 session-variable ordering is undefined).
  Key SQL compatibility fixes applied: `INSERT IGNORE` + `UPDATE…JOIN` instead of
  `INSERT…SELECT…ON DUPLICATE KEY UPDATE…VALUES()` (not valid in MySQL 8); all
  `last_value` column references backtick-quoted (MySQL 8 reserved word).
- `backend/routes/customer.routes.js` — create handler now runs in a transaction,
  allocates the next `customer_code` from the sequence table, and inserts it
  alongside the UUID. Falls back gracefully (logs warning, continues without a code)
  if the migration has not yet been applied. Search includes `customer_code LIKE ?`.
- `frontend/src/types/index.ts` — `Customer` interface gains `customerCode?: string | null`.
- `frontend/src/pages/CustomersPage.tsx` — "Code" column (monospace) added before
  the Name column; shows `—` when no code is assigned.

### Production migration runner
- `backend/scripts/migrate.js` — custom SQL splitter + runner. Reads files from
  `database/migrations/` in filename order, applies each against the configured DB
  (reads `backend/.env`), records in `schema_migrations`, and moves files to
  `database/migrations/applied/` on success.
  Handles: `DELIMITER` blocks, `--`/`#`/`/* */` comments, escaped quotes, and
  `PREPARE`/`EXECUTE`/`DEALLOCATE` sequences correctly.
  Flags: `--dry-run`, `--status`, `--yes`, `--no-move`, `--seeds`.
  Color-coded output; prints target host/database and asks for confirmation.
- `backend/package.json` — new scripts:
  ```
  npm run migrate          # apply pending migrations (with confirmation prompt)
  npm run migrate:status   # show applied vs pending — runs nothing
  npm run migrate:dry      # dry-run — changes nothing
  npm run migrate:seeds    # include database/seeds/ as well
  ```
- `database/README.md` — updated to document the runner workflow; authoring
  rule 0 added: backtick-quote all MySQL 8 reserved identifiers.

### Blank sidebar menu fix (3 root causes)
- **`frontend/src/components/layout/Sidebar.tsx`**
  1. `!isReady ? [] : [...]` gate removed — nav is always built; English fallback
     labels (`NAV_FALLBACK`, `SECTION_FALLBACK`) used via `t(key, {defaultValue})`.
  2. `cachedUser` — `useMemo` reads `localStorage.getItem('currentUser')` as a
     fallback for the brief period when `user` is null during auth re-validation.
     All permission checks use `effectiveUser = user || cachedUser`.
  3. `window.location.reload()` hack and `attempted_sidebar_refresh` sessionStorage
     guard removed entirely (they masked the null-user problem, then left the menu
     blank permanently after firing).
  Import changed: `{ useState, useMemo }` (removed unused `useEffect`).
- **`frontend/src/hooks/useIndustry.ts`**
  - Switched from `sessionStorage` to `localStorage` so the cached industry
    survives tab backgrounding/restore without a network round-trip.
  - On fetch failure falls back to `'general_retail'` instead of leaving `industry`
    null (which would hide every industry-gated menu item indefinitely).
  - `clearIndustryCache()` clears both stores.

### All migrations applied ✅
All 15 migration/seed files are in `database/migrations/applied/` or
`database/seeds/applied/`. Nothing is pending.

## Iteration 11 (2026-08-13) — Tag printing, CRM wishlists, repair photos, Paytime UI

### Tag / label printing (multi-printer)
- Migration `database/migrations/2026-08-13_label_printing_crm_wishlist.sql`:
  - Adds `label_printer_type`, `label_printer_address`, `label_paper_width_mm`,
    `label_paper_height_mm` to `printer_settings`.
- `backend/services/labelPrintService.js` — driver-agnostic label generator:
  - `buildZpl(item, settings)` — Zebra ZPL II (Code128 barcode, name, purity, price).
  - `buildTspl(item, settings)` — TSC / Godex TSPL-EZ (same data).
  - `buildHtmlLabel(item, settings)` — browser/PDF fallback (opens `window.print()`).
  - `printLabel({ driver, address, item, settings })` — dispatches over TCP or returns HTML.
- `backend/routes/labels.routes.js` (`/api/labels`): `GET/PUT /settings`,
  `POST /print`, `POST /print/bulk`, `POST /test`. Mounted in `routes/index.js`.
- `frontend/src/services/labelService.ts` — `getLabelSettings`, `saveLabelSettings`,
  `testLabelPrinter`, `printPieceLabel`, `printBulkLabels`, browser-print helper.
- `frontend/src/components/settings/LabelPrinterSettings.tsx` — 4-option printer
  type selector (Disabled / Zebra / TSC / Browser), IP:port field, label size
  (38|50|60|80 mm × 20|25|30|40|50 mm), test-print button. Added as a section
  inside the existing Printer settings tab.
- `frontend/src/pages/SerializedInventoryPage.tsx` — tag-print icon button per
  piece row; "Cycle Count" shortcut button in the page header.
- `frontend/src/pages/CycleCountPage.tsx` — **new page**: barcode/RFID
  cycle-count reconciliation. Scans piece codes via keyboard input (works with
  any USB HID barcode scanner or RFID reader that emulates keyboard). Displays
  Scanned / Missing / Unexpected counters + drill-down tables. CSV export.
  Route `/cycle-count` (jewelry + electronics); sidebar nav entry added.

### CRM — wishlists, birthday/anniversary reminders
- Migration (same file): adds `date_of_birth`, `anniversary_date` to `customers`;
  creates `customer_wishlist_items` table.
- `backend/routes/crm.routes.js` (`/api/crm`): `GET /reminders?days=N` (upcoming
  birthdays + anniversaries — month/day match, year-agnostic), wishlist CRUD per
  customer, `GET/PUT /customers/:id/profile-extra` (dob + anniversary).
  Mounted in `routes/index.js`.
- `frontend/src/services/crmService.ts` — typed client for all CRM endpoints.
- `frontend/src/components/crm/CustomerWishlist.tsx` — wishlist list/add/remove
  with inline product picker.
- `frontend/src/components/crm/CustomerCrmDrawer.tsx` — slide-over panel with
  two tabs (Wishlist · Dates). Opened via the heart icon ❤ in the Customers table.
- `frontend/src/pages/CustomersPage.tsx` — heart icon action button per row,
  `crmCustomer` state, `CustomerCrmDrawer` wired up.
- `frontend/src/components/crm/UpcomingRemindersWidget.tsx` — dashboard card
  listing customers with birthdays/anniversaries in the next 7 days with
  days-away count and click-to-call phone link. Self-hides when empty.
- `frontend/src/pages/Dashboard.tsx` — `UpcomingRemindersWidget` rendered above
  the stats grid.

### Repair order photo uploader
- `frontend/src/components/common/AttachmentUploader.tsx` — **new reusable
  component**: drag-and-drop file upload using `/api/attachments` (existing
  endpoint). Thumbnail grid for images; file icon for PDFs. Delete with confirm.
  Polymorphic: takes `entityType` + `entityId` props, works for any entity.
- `frontend/src/pages/RepairsPage.tsx` — "Photos" column with expand toggle per
  row; expanded row renders `AttachmentUploader` inline (entity_type=repair_order).

### Paytime payroll integration UI
- `frontend/src/services/employeeService.ts` — added `pushPaytimeIncentive(id, payload)`
  (calls `POST /employees/:id/paytime/sync`).
- `frontend/src/components/settings/PaytimeSettings.tsx` — **new settings card**:
  live connection status check (green/amber), step-by-step env-var setup guide.
  Added as a new "Paytime" tab in Settings.
- `frontend/src/pages/EmployeesPage.tsx` — "Push incentive" button on each
  `EmployeeCard` (shown only when Paytime is configured). Calls `getPerformance`
  for the current month, then `pushPaytimeIncentive`. Toast on success/failure.
  Requires `paytime_employee_id` to be set on the employee record.

### Backend note — Paytime app
The Zettaz side is complete. To build the Paytime application side, mount the
Paytime project folder and we will add:
  - `GET  /v1/employers/:id/employees` — return employee directory.
  - `POST /v1/incentives` — accept + store an incentive push.

## Still open / not yet wired
- `cost_code` / `show_on_receipt` fields not yet surfaced in print-agent receipt templates.
- Repair order photo upload: backend stores a JSON URL array; no drag-and-drop
  uploader UI built yet (use the generic `/api/attachments` endpoint meanwhile).
- **Paytime API** contract to be confirmed before enabling `paytimeService` in production.
- **RFID / tag printing** (P2, see doc 05) — not in scope unless requested.
- **CRM wishlists + anniversary reminders** (P2, see doc 05) — not in scope unless
  requested; notification infrastructure already exists.
- **Shopify / platform adapter** (catalog sync Phase 2) — outbox pattern is ready;
  build the adapter when a paying tenant asks. Four decisions logged in
  `08_Catalog_Sync_Adapter_Recommendation.md`.

## Iteration 12 (2026-08-15) — Serialized Inventory rewrite, Memo & Consignment overhaul, Metal Rates automation, weight-unit localization

### Serialized Inventory — full-page rewrite + DB fix

**DB migrations**
- `database/migrations/2026-08-15_serialized_inventory.sql` — creates `product_pieces`
  and `product_piece_sequences` with `utf8mb4_0900_ai_ci` collation; replaces the
  earlier iteration-5 migration which used the wrong collation.
- `database/migrations/2026-08-15_fix_piece_collation.sql` — idempotent `CONVERT TO
  CHARACTER SET` for stores that already ran the old migration; resolves
  `Illegal mix of collations` error.

**Backend**
- `backend/routes/product-pieces.routes.js` — added `GET /all` (cross-product listing
  with `?q=` free-text search, status filter, pagination), `GET /:id` (full piece
  detail), and `?q=` search on existing list endpoint.

**Frontend — `frontend/src/pages/SerializedInventoryPage.tsx`** (full rewrite)
- Cross-product listing (`listAllPieces`) — no longer requires picking a product first.
- KPI strip: clickable status tiles (available / hold / sold / returned / melted)
  that filter the table.
- Available-value banner, debounced search bar (350 ms), product dropdown filter.
- Bulk selection with Print Labels action bar.
- Inline status dropdown per row; `window.confirm` guard on destructive `melted` transition.
- `PieceDrawer`: full detail view + edit mode (weight, price, purity, barcode, notes),
  status action buttons, single-label print.
- `AddPiecesModal`: single or bulk mode, piece barcode linkage, displays generated
  piece codes + cost-code cipher after creation.
- `useLocaleFormat` used throughout; cost-code displayed as cipher text.

---

### Memo & Consignment — full audit and rewrite

**Backend — `backend/routes/memo.routes.js`** (full rewrite)
- `TRANSITIONS` map enforces valid status changes; returns `422 INVALID_TRANSITION`
  on invalid moves.
- `GET /` — added `?q=` free-text search (memo_no, supplier, customer name, notes);
  includes `item_count`, `returned_count` in response.
- `GET /:id` — JOINs `products` + `product_pieces` for full item detail
  (`product_name`, `piece_code`, `purity`, `gross_weight`).
- `PUT /:id` — new endpoint: edit `due_date`, `notes`, `employee_id`.
- `POST /:id/return` — fixed: serialized piece freed only when fully returned
  (`newReturned >= quantity`); skips already-returned items; recomputes memo status.
- `POST /:id/status` — validates transition via `TRANSITIONS` map.
- Fixed `ORDER BY mi.rowid` → `ORDER BY mi.id` (rowid is SQLite, not MySQL).
- Fixed `c.phone` → `c.phone_number` (correct `customers` column name).

**Frontend services — `frontend/src/services/jewelryOpsService.ts`**
- Extended `MemoItem`: added `productName`, `productSku`, `pieceCode`, `barcode`,
  `purity`, `grossWeight`, `netWeight`, typed `status` union.
- Extended `Memo`: added `customerPhone`, `customerEmail`, `employeeId`,
  `itemCount`, `returnedCount`.
- `listMemos` accepts `?q=` search param.
- Added `updateMemo(id, payload)` for the new PUT endpoint.
- `returnMemoItems` sends `item_id` (snake_case) correctly.

**Print service — `frontend/src/services/memoPrintService.ts`** (new file)
- `printMemoSlip(memo, store)` — 80 mm thermal slip (68 mm monospace, quick reference).
- `printMemoAcknowledgement(memo, store)` — A4 formal document with items table,
  total, signature lines, consignment terms.
- Both use `window.open() + document.write() + setTimeout(print, 400)` pattern.

**Frontend — `frontend/src/pages/MemoPage.tsx`** (full rewrite)
- KPI strip: open count, partially returned, overdue, value-out (active), value-in.
- Direction tabs (All / Memo In / Memo Out) + status filter + search bar.
- Table: overdue rows show red due date with ⚠; `item_count` displayed; direction badge.
- `MemoDrawer`: full item list with piece details; per-item return quantity inputs;
  Record Return button; status transition buttons with icons; edit mode (due_date +
  notes); Thermal Slip + Acknowledgement print buttons.
- `NewMemoModal`: direction toggle; `CustomerSearchSelect` for Out / supplier
  `<select>` for In; piece search (`listAllPieces({ q, status: 'available', limit: 10 })`);
  auto-fills description + unit_value from piece; multi-item with remove; live total.

---

### Metal Rates — market rate automation + settings overhaul

**DB migration**
- `database/migrations/2026-08-15_market_rates_weight_unit.sql` — idempotent
  additions to `tenant_pricing_settings`:
  `market_rate_api_key`, `market_rate_local_premium_pct`, `market_rate_auto_publish`,
  `market_rate_fetch_time`, `weight_unit` (enum g/oz/tola/baht/kg, default g).

**Backend services — `backend/services/marketRateFetcherService.js`** (new file)
- `GRAMS_PER_UNIT`: `{ g:1, oz:31.1035, tola:11.6638, baht:15.244, kg:1000 }`.
- Calls `https://www.goldapi.io/api/{XAU|XAG|XPT|XPD}/{currencyCode}`.
- Returns `price_gram_24k` already in the org's currency — no forex needed.
- Applies `localPremiumPct` on top of spot for import duty (India ≈15–18%, USA ≈2–5%).
- Builds full purity matrix per metal (Gold 24K/22K/18K/14K/10K, Silver 999/925/800,
  Platinum 950/900, Palladium 999/950).
- DB always stores `ratePerGram`; `ratePerUnit` is display-only.

**Backend routes — `backend/routes/metalRates.routes.js`** (extended)
- `DEFAULT_SETTINGS` extended with 5 new fields.
- `PUT /settings` UPSERT now saves all 9 fields.
- Helper `getStoreCurrency(tenantId)` reads `currency_code` from `stores` table —
  rates auto-follow org currency regardless of country (no hardcoding).
- `POST /fetch-market` — preview: fetch + return rates without publishing.
- `POST /fetch-market/publish` — fetch + publish in a single transaction.

**Frontend services** (extended `jewelryOpsService.ts`)
- Added `MarketRatePreview` and `MarketFetchResult` interfaces.
- `fetchMarketRates(metals?)` → `POST /metal-rates/fetch-market`.
- `fetchAndPublishMarketRates(metals?)` → `POST /metal-rates/fetch-market/publish`.
- Extended `PricingSettings` with 5 new fields.

**Frontend — `frontend/src/pages/MetalRatesPage.tsx`** (components added/updated)
- `MarketFetchPanel` component:
  - API key status badge (green = configured, amber = missing) with currency + unit.
  - Metal checkboxes (Gold / Silver / Platinum / Palladium) with colored dots.
  - "Fetch Preview" button → grouped preview table: sell/buy per org unit + per gram.
  - Spot price in troy oz shown per metal group header.
  - "Publish All (N)" button → calls `fetchAndPublishMarketRates`, reloads rates.
  - Error list for any metals that failed to fetch.
- `SettingsPanel` updated — new fields added:
  - Weight unit selector (Gram / Troy oz / Tola / Baht / Kilogram) — pill buttons.
  - API key field with show/hide toggle.
  - Local premium % input with guidance note.
  - Auto-fetch time input (24 h clock).
  - Auto-publish toggle.
  - All fields persisted via the extended PUT /settings endpoint.

---

### Weight-unit localization — all jewelry pages

**`frontend/src/hooks/useLocaleFormat.ts`** (extended)
- `WeightUnit` type export: `'g' | 'oz' | 'tola' | 'baht' | 'kg'`.
- `GRAMS_PER_UNIT` and `WEIGHT_UNIT_LABELS` maps.
- `weightUnit` read from `(store as any)?.weightUnit || 'g'`.
- `formatWeight(grams, dp=3, showUnit=true)` — converts from grams (DB unit) to
  org's display unit using `GRAMS_PER_UNIT`, formats with `numberLocale`.
- Returns `formatWeight`, `weightUnit`, `weightUnitLabel` alongside existing exports.

**Pages updated to use `formatWeight` / `weightUnitLabel`:**
- `SerializedInventoryPage.tsx` — table weight columns + drawer detail labels.
- `MemoPage.tsx` — piece info line in drawer; auto-description in `NewMemoModal`.
- `OldGoldPage.tsx` — table columns, drawer detail labels, computed net weight in modal.
- `MetalRatesPage.tsx` — rate cards (/unit suffix), history table headers, market
  fetch preview table column headers.

---

### Key architectural decisions in this iteration

| Decision | Rationale |
|---|---|
| goldapi.io currency passed directly from `stores.currency_code` | No forex math; works for any country automatically |
| DB always stores rate in grams | Single source of truth; display unit is a view concern |
| `formatWeight` lives in `useLocaleFormat` | One hook, one source for all locale formatting |
| Partial return frees piece only when fully returned | Prevents premature stock reappearance |
| All migrations idempotent (`INFORMATION_SCHEMA.COLUMNS` check) | Safe to re-run without error |

---

## Iteration 13 (2026-08-25) — Print/invoice template redesign + Duty-Free/Export generalization

### Clean invoice template rollout (replaces old layout in place)

**Backend**
- `services/printTemplateService.js` — rewrote `DEFAULT_BLOCKS.invoice` (13 blocks:
  inline logo, right-aligned header with invoice no. + date, parties band, items
  table, tax summary, totals, payment, serialCapture, warranty, returnPolicy, QR
  barcode, terms, `pageFooter`) and `DEFAULT_BLOCKS.jewelry_invoice` (14 blocks,
  same shape plus the jewelry-specific purity/weight and gemstone blocks). Both
  now carry a `pageFooter` block pinned to every page — the old jewelry invoice
  had no page-level footer at all, so a multi-page invoice only showed the
  seller's address/tax number on whichever page it happened to land on.
- Added `withDutyFreeVisible(blocks)` — the single, canonical place that turns a
  template's `dutyFree` block on; re-exported and reused from
  `templateProvisioningService.js` and `legacyInvoiceBlocksSnapshot.js` instead of
  being copied a third time.
- Added `blocksForReset(existingBlocks, freshDefaults)` — used by the
  `/reset-defaults` route (below) so resetting a template to current defaults
  carries forward whether its `dutyFree` block was switched on, instead of
  silently dropping traveller details on a live Duty-Free Invoice.
- `services/retailProfileService.js` — removed the redundant `retail-invoice-clean-a4`
  plan entry; the clean look is now `invoice`'s default, not a second opt-in preset.
- `routes/printTemplates.routes.js` — **fixed `POST /:id/reset-defaults`**, which
  previously overwrote a template's blocks with `DEFAULT_BLOCKS` verbatim. Since
  `DEFAULT_BLOCKS` ships `dutyFree` hidden (it only turns on at provisioning
  time), a naive reset on a store's actual "Duty-Free Invoice" would have wiped
  its passport/flight/destination fields. Now uses `blocksForReset`. The previous
  version is saved to `template_versions` first, so a reset is reversible via
  Version History.
- `services/legacyInvoiceBlocksSnapshot.js` (**new**) — frozen snapshots of the
  pre-redesign `invoice` / `jewelry_invoice` block arrays, plus
  `classifyStoredBlocks(templateType, storedBlocks)`, a deep-equality classifier
  that tells the backfill script below whether an already-provisioned tenant's
  row is still untouched (safe to backfill) or has been customized (must be left
  alone).
- `scripts/sync-clean-invoice-templates.js` (**new**) — dry-run / `--yes` /
  `--tenant <uuid>` backfill for tenants provisioned before this redesign.
  `npm run sync:clean-invoices` (dry run) / `sync:clean-invoices:apply`.
- **Tests:** `tests/legacyInvoiceBlocksSnapshot.test.js` (new, 12 passing);
  `tests/printDefaults.test.js` extended with `withDutyFreeVisible` (3) and
  `blocksForReset` (5) describe blocks.

**Frontend**
- `components/print-templates/TemplateCanvas.tsx` and
  `utils/printTemplateRenderer.ts` (the designer preview and the actual print/PDF
  renderer — two separate implementations that must stay in parity):
  - **Footer pinned to the page bottom.** The page box and its content wrapper
    were made flex columns; the `pageFooter` block gets `margin-top: auto` on
    paged sizes, so it sits at the bottom of the last page instead of wherever
    it happened to fall in block order.
  - **Barcode caption suppression.** A QR/barcode block no longer prints a
    document-number caption underneath it when that number has been configured
    off (`showNumberOnInvoice`/`showNumberOnReceipt`) — uses
    `shouldShowDocumentNumber`/`classifyDocument` from `documentNumberVisibility`.
  - **Header/subtitle font-size bug.** A block's `fontSize` config (meant to
    size the title) was also inflating the subtitle line beneath it, via the
    shared `primarySize()` override helper applying uniformly to every size
    request in the block. Subtitles now use a fixed `scale.sm` regardless of the
    title's configured size. This is what caused "Emp: Marcus Hill" to wrap onto
    its own oversized line on the Duty-Free Invoice.
  - `utils/documentSectionsModel.ts` — added `cityLine()` so switching the old
    `customer` block to the new `parties` band didn't drop city/state/postcode.
  - `utils/barcodeModel.ts` — fixed `resolveBarcodeValue`'s `'invoiceNo'` case to
    prefer `data.documentNumber` (what the sequence allocator actually issued)
    over `data.invoiceNumber` (a fixture-only field that a real sale never sets),
    which could otherwise put a stale demo number in the QR code.
- `utils/templatePresets.ts` — removed the `retail-invoice-clean-a4` gallery
  entry; updated preset descriptions to reflect the new default look.
- **Tests:** `utils/printGolden.test.ts` — added header-subtitle-size-independence
  tests and document-number-visibility regression tests; `utils/barcodeModel.test.ts`
  reworked to be symbology-aware (QR vs Code128) and paper-size-correct per type.

**Verified live** against the Diamond Republic tenant at `/print-templates`: used
the app's own "Refresh to latest blocks" action (which runs on the user's
machine and can reach the real DB, unlike this session's sandbox) on both the
Duty-Free Invoice and the domestic Jewelry Invoice, reloaded the page each time,
and confirmed the clean layout, pinned footer, and corrected header sizing
persisted after a full page reload.

---

### Duty-Free / Export block redesign

Two problems with the original `dutyFree` block: (1) it hardcoded an "export
declaration" toggle onto a block whose actual legal wording varies tenant to
tenant and country to country, and (2) it assumed every duty-free traveller
carries a passport and departs by flight — not true for Caribbean cruise-ship
traffic, which typically travels on a seaman's book or national ID and departs
by vessel.

**Backend — `services/printTemplateService.js`**
- `DEFAULT_BLOCKS.jewelry_invoice`'s `dutyFree` block: `dutyFreeFields` now
  defaults to `['travellerId', 'travelMethod', 'destination', 'departureDate']`
  (was `['passport', 'flight', ...]`); added `travellerIdType: 'passport'` and
  `travelMethodType: 'flight'`; removed `showExportDeclaration` (moved — see
  below).
- The adjacent `compliance` block's comment now documents that the export
  declaration prints from there, sourced from the jurisdiction profile.

**Frontend**
- `utils/salesModeRules.ts` — `buildDutyFreeLines(data, fields, labelConfig)`
  generalized: `travellerId`/`travelMethod` are the canonical field keys, with
  `travellerIdType` (`passport` / `national_id` / `seaman_book` / `other`) and
  `travelMethodType` (`flight` / `vessel` / `other`) controlling the printed
  label — each with a `*Label` override for a fully custom label. `passport`/
  `flight` are kept as accepted legacy field-key aliases (already-provisioned
  templates still store them; `templateProvisioningService` never rewrites
  existing rows), and the data-side fallbacks (`data.passportNumber` →
  `data.travellerIdNumber`, `data.flightNumber` → `data.travelMethodRef`) mean
  no existing sale data or template config breaks.
- `utils/printTemplateRenderer.ts` and `components/print-templates/TemplateCanvas.tsx`
  — moved the export declaration out of the `dutyFree` case entirely and into
  the `compliance` case, appended after the jurisdiction's `legalText` lines,
  gated on `isDutyFreeOrExport(data)` so it can never leak onto a domestic
  invoice's compliance text.
- `types/printTemplate.ts` — added `travellerIdType`/`travellerIdLabel`/
  `travelMethodType`/`travelMethodLabel` to the dutyFree block config;
  `showExportDeclaration` kept as a deprecated, unused field so a template saved
  before this change doesn't fail validation on its stored config.
- `components/print-templates/BlockPropertiesPanel.tsx` — replaced the "Show
  export declaration" switch with Traveller ID Type / Travel Method Type
  selects (+ custom-label inputs when "Other" is picked); the traveller-field
  chips and their active/toggle state are legacy-alias-aware, so opening an
  already-provisioned template's dutyFree block correctly shows its existing
  `passport`/`flight` selection as `Traveller ID`/`Travel Method`, and the first
  edit silently upgrades the stored config to the new field names.
- **Tests:** `utils/salesModeRules.test.ts` — new describe block covering the
  generalized traveller ID / travel method model (label overrides, legacy-key
  equivalence, generic vs. legacy data field precedence); `utils/printPhase1.integration.test.ts`
  — rewrote the `dutyFree block` tests (declaration no longer prints from there)
  and added a `compliance block on a duty-free document` describe block (declaration
  prints from there, and only for an actual duty-free/export sale).
- Both directions **mutation-tested**: reintroduced the declaration into
  `dutyFree` and stripped it from `compliance` in separate runs, confirmed the
  relevant new test failed each time, then reverted (byte-identical diff).

**Verified live** against Diamond Republic's Duty-Free Invoice: refreshed the
template to the new defaults, confirmed the compliance block now carries the
legal text and export declaration together, switched Traveller ID Type to
"Seaman's Book" and Travel Method to "Vessel" and watched the canvas label
update live, then discarded the test edit (never saved) so the tenant's
template was left exactly as reset, not in the demo state.

**Deliberately out of scope for this iteration** (per explicit decision): no
POS/checkout UI fields, backend DB columns, or `saleToPrintData.ts` capture
logic were added for vessel name/voyage number/national ID/seaman's book
number — see "Pending after iteration 13" below.

---

## Iteration 14 (2026-08-25) — Sales Hub + duty-free intake + zero-rating fix

Closes the gap flagged as "pending" at the top of iteration 13: nothing
captured the generalized traveller/travel-method fields the print layer had
just been taught to render. Full design and decision record:
`docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md`.

**The idea, in short.** Grocery/general-retail POS is always "ring up the next
item" — one screen, sale after sale. Jewelry counters also do repairs,
old-gold buys, memos, layaway; those lived as disconnected sidebar pages with
no relationship to the register. Researched how comparable products solve
this (Toast's dining-options screen before the menu; Bravo/Luxare/WJewel
building repairs/buying into the counter screen, not a back-office module;
LS Retail/Socket Mobile capturing traveller ID before the travel-retail sale,
not just for the receipt) — see the proposal doc's §3 for citations. Landed
the "ask what kind of interaction this is, before the item grid" pattern as
an additional jewelry-only screen.

**Scope decisions (all made explicitly, via `AskUserQuestion`, before
building):** Hub ships as an *additional* sidebar entry — `/pos` is untouched
and still reachable directly. Jewelry industry only for this pass. Duty-free
scope is "Option A" — capture UI only, no per-transaction tax override.

**Backend**
- `database/migrations/2026-09-01_pos_hub_duty_free_capture.sql` (new,
  idempotent) — `sales.sales_mode`, `sales.zero_rate_reason`,
  `sales.traveller_id_type`, `traveller_id_number`, `traveller_id_country`,
  `travel_method_type`, `travel_method_ref`, `travel_method_detail`,
  `destination`, `departure_date`, plus an index on `sales_mode`.
- `controllers/createSaleController.js` — **the actual zero-rating fix.**
  `services/taxCalculationService.js` had two tax functions:
  `calculateSaleTaxes` (jurisdiction-unaware, what the controller actually
  called) and `calculateSaleTaxesWithJurisdiction` (jurisdiction-aware,
  zero-rates duty-free/export, fully unit-tested in
  `tests/taxJurisdiction.test.js`) — but the jurisdiction-aware one had **zero
  callers anywhere in the app**. A store configured `sales_mode = duty_free`
  never actually charged $0 tax on a real sale; only print fixtures ever saw
  a zero-rated total. Found while wiring the Hub's Duty-Free Sale tile (which
  would otherwise have collected a passport for a receipt that still taxed
  the sale) — flagged to the user via `AskUserQuestion` rather than silently
  patched or silently shipped, since it touches money and was outside Option
  A's stated "tax calculation is unchanged." User chose to fix it, scoped
  narrowly: the controller now calls `jurisdictionService.getJurisdictionProfile`
  server-side and forces `tax = 0` whenever the *store* resolves `zeroRated`
  (duty_free or export) — `mixed` and `domestic` are unaffected and still go
  through the existing `verifySaleTax` check. `sales_mode`/`zero_rate_reason`
  are frozen onto the sale row at creation time so a later change to the
  store's duty-free configuration can't rewrite whether an old sale looks
  zero-rated on reprint. The traveller fields (all nullable, all optional)
  are persisted the same way `employee_id` already was — accepting both
  camelCase and snake_case since `fetchApi` converts one direction but a
  direct API caller could send either.
- `controllers/salesController.js` — no change needed; `getSaleById`'s
  `SELECT s.*` and object spread already surface the new columns.
- `tests/createSaleController.dutyFree.test.js` (new) — 8 tests: a
  duty-free/export store forces tax to 0 and freezes `sales_mode`/
  `zero_rate_reason` regardless of what the client posted; a domestic/mixed
  store is unaffected (tax comes from `verifySaleTax`, `zero_rate_reason`
  stays null); a jurisdiction-lookup failure fails open to the normal tax
  path rather than blocking the sale; traveller fields round-trip in both
  camelCase and snake_case and are null on an ordinary sale.

**Frontend**
- `pages/SalesHubPage.tsx` (new) — the tile grid: New Sale, Duty-Free Sale,
  Repair Intake, Old Gold Buy, Memo In/Out, Layaway Payment, Savings Scheme
  Payment, Sales Return. Every tile except Duty-Free Sale navigates straight
  to the existing page for that workflow — additive wiring, not a rewrite of
  Repairs/Old Gold/Memo/Layaway/Savings Schemes.
- `pages/DutyFreeIntakeModal.tsx` (new) — the traveller-ID/travel-method form
  (Passport/National ID/Seaman's Book, Flight/Vessel/Other — the same
  generalized model the print layer already used), opened as a modal from the
  Hub. On submit, calls `setTravellerContext(...)` and navigates to `/pos`.
- `AppRoutes.tsx` — new `/sales-hub` route, gated `IndustryRoute
  allow={['jewelry']}`, same mechanism already used for Repairs/Old
  Gold/Metal Rates.
- `components/layout/Sidebar.tsx` — new "Sales Hub" entry (jewelry-only,
  `LayoutGrid` icon) placed directly under POS Screen.
- `contexts/CartContext.tsx` — `travellerContext`/`setTravellerContext` state;
  `isDutyFreeStore` (resolved once per session from `getJurisdictionContext`,
  fails open to `false` on error) now feeds into the existing tax-exemption
  check the same way a tax-exempt customer does, so the cart's displayed tax
  matches what the backend will actually charge; `travellerContext` is
  included in the sale-creation payload and cleared on checkout/clearCart so
  it never leaks into the next sale.
- `services/salesService.ts` / `services/api.ts` — `TravellerContext` type
  and the 8 flattened payload fields threaded through `createSale`.
- `utils/saleToPrintData.ts` — maps the new sale columns
  (`salesMode`/`zeroRateReason`/`travellerId*`/`travelMethod*`/`destination`/
  `departureDate`) onto `PrintableSale`, closing the exact mapping gap flagged
  at the end of iteration 13.
- `services/receiptService.ts` — now fetches `getJurisdictionContext()` before
  a real print and passes `mandatoryInvoiceTitle`/`taxLabel`/`taxIdLabel`/
  `exportDeclarationText`/`fiscalizationEnabled` into the print context —
  previously this only ever reached design-time fixtures, never a real sale's
  receipt.
- `contexts/CartContext.test.tsx` (new) — 7 tests: `travellerContext` starts
  null, is set by the intake form, is cleared by `clearCart`; `isDutyFreeStore`
  reflects duty-free/export/domestic jurisdiction responses and fails open to
  `false` if the lookup rejects.
- `pages/SalesHubPage.test.tsx` (new) — 6 tests: every tile renders; "New
  Sale" and the existing-page tiles navigate directly; "Duty-Free Sale" opens
  the intake step instead of navigating immediately; completing the intake
  captures traveller data and continues to `/pos`; canceling captures
  nothing.

**Verification**
- `cd backend && npx mocha tests/createSaleController.dutyFree.test.js` — 8/8
  passing. Full suite: 255 passing (3 pre-existing files that `require`
  `server.js` — and therefore `sharp` — don't load in this sandbox's
  linux-arm64 environment; unrelated to this change, not run here).
- `cd frontend && npx vitest run` — 606/606 passing (593 pre-existing + 13 new).
- `cd frontend && npx tsc --noEmit` — clean.

**Deliberately out of scope for this iteration** (per the approved Option A
decision): tax calculation is unaffected for stores NOT already configured
duty-free/export — there is still no way to ring one duty-free sale inside an
otherwise-domestic store (that is "Option B" in the proposal doc, deferred
until a tenant actually needs mixed-mode selling). The Hub's optional "glance
strip" (repairs ready for pickup, memos overdue) from the design mockup was
not built. Repairs/Old Gold/Memo/Layaway pages were not changed to deep-link
into an already-open "new" modal from the Hub tile — tiles land on those
pages' default list view.

---

## Iteration 15 (2026-08-25) — Sales Hub: fullscreen redesign + role-based landing

Same-day follow-up on iteration 14, driven by direct feedback: the Hub needed
to be a fullscreen counter screen — store-branded, responsive, visually
polished — and the actual screen sales staff land on right after login,
not the admin dashboard. Full record of the design reasoning:
`docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md` §9.

**Frontend**
- `AppRoutes.tsx` — `/sales-hub` moved out of the `AppLayout`-wrapped route
  group and now sits alongside `/pos` as a standalone fullscreen route (still
  gated `IndustryRoute allow={['jewelry']}`). No sidebar/topbar chrome, same
  treatment `/pos` already had.
- `pages/SalesHubPage.tsx` — rebuilt as a fullscreen `h-screen` layout:
  sticky header with store branding (`store.logoUrl` from `useStore()`, or a
  rounded lettermark fallback built from the store name's first letter),
  a live clock/date (hidden below `md`), and a role-aware user avatar menu
  (Dashboard link hidden for cashiers, shown for everyone else, plus
  Settings and Sign out — mirrors the pattern already in `POSScreen.tsx`).
  Main content adds a time-of-day greeting ("Good afternoon, {name}") above
  a responsive tile grid (`grid-cols-1` → `sm:grid-cols-2` →
  `lg:grid-cols-3` → `xl:grid-cols-4`) with larger touch-friendly cards,
  colored icon badges, hover lift/shadow, and a trailing chevron. A thin
  footer matches `/pos`'s.
  **Bug fixed during live verification:** the logo `<img>`'s `onError`
  handler originally just hid the broken image in place
  (`style.display = 'none'`), which on a tenant with a broken `logoUrl` left
  the header with no branding at all instead of falling back to the
  lettermark. Fixed by tracking load failure in React state (`logoFailed`)
  and switching the render branch, not just hiding the failed element.
- `pages/Login.tsx` — `getRedirectPath` (the only place in the app that
  decides a post-login destination — confirmed via search) is now `async`.
  For a non-admin user with `sales.create` permission, it resolves the
  tenant's industry via `getTenantIndustry()`: jewelry tenants land on
  `/sales-hub`, every other industry keeps going straight to `/pos`
  unchanged. A failed industry lookup fails open to `/pos` rather than
  blocking login. Admins (`/admin`) and users without `sales.create`
  (`/dashboard`) are unaffected. The resolved industry code is also written
  to the `tenant_industry_code` localStorage key so `useIndustry()` doesn't
  re-fetch what login just resolved.
- `pages/SalesHubPage.test.tsx` — extended with 5 more tests (11 total):
  store name/greeting render, lettermark fallback, Dashboard link
  hidden/shown by role, sign-out flow. Needed a `MemoryRouter` wrapper once
  the header started rendering real `<Link>`s inside the user-menu dropdown.
- `pages/Login.test.tsx` (new) — 7 tests covering every branch of
  `getRedirectPath`: jewelry cashier → Sales Hub (and localStorage warmed);
  non-jewelry cashier → POS unchanged; sales-floor manager (non-admin,
  `sales.create`) → Sales Hub for a jewelry tenant; industry-lookup failure
  → fails open to POS; tenant admin → `/admin` without ever calling
  `getTenantIndustry`; plain user with no `sales.create` → `/dashboard`;
  incomplete onboarding → `/onboarding`, taking priority over everything else.

**Verification**
- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npx vitest run` — 618/618 passing (606 prior + 12 new:
  5 SalesHubPage + 7 Login).
- **Verified live** via the Chrome extension against a running dev server on
  a jewelry demo tenant ("Diamond Republic Demo — Heritage Quay"): confirmed
  the fullscreen layout, store name in the header, tile grid at desktop
  width, the duty-free intake modal, and the user-menu dropdown (Dashboard
  shown for the demo admin user, since they aren't a cashier). This run is
  what surfaced the broken-logo-URL bug above — the fix was verified live
  with a page reload showing the lettermark fallback render correctly.

**Deliberately unchanged:** the tile set, the duty-free intake flow, and the
store-level zero-rating fix from iteration 14 — this was a chrome/entry-point
change, not a rescoping of what the Hub does.

**Same-day visual follow-up:** the first cut of the fullscreen redesign still
read as flat/dated once seen live (flat pastel icon tints, one undifferentiated
grid, plain header). Reworked `SalesHubPage.tsx` again: New Sale and
Duty-Free Sale are now larger "featured" tiles (the two things a cashier does
dozens of times a day) above a secondary grid for the other six workflows;
every tile's icon badge is a color gradient with a white icon instead of a
flat tint, with a matching colored glow on hover shadow; the header got a
gradient store-lettermark/avatar and a pill-style clock; and soft blurred
color washes sit behind the content for depth. Also fixed a copy regression
introduced during this pass — the greeting briefly truncated `first_name` to
its first word (`.split(' ')[0]`), which cut a demo user's full name
("Jewelry Demo Admin") down to just "Jewelry" because that field held a full
name string, not a true first name. Reverted to showing the full
`displayName`. No behavior changed, only layout/styling — same tiles, same
routes, same tests (still 11/11 for `SalesHubPage.test.tsx`).

---

## Iteration 16 (2026-08-25) — Sales Hub: bento grid + chromeless canvas

Second same-day follow-up. Feedback on iteration 15's fullscreen redesign:
still read as a conventional "topbar + uniform card grid" screen, and the
explicit ask was to drop the separate topbar and to research current design
thinking rather than iterate on the same shape again. Full research writeup
and source list: `docs/17-migration-and-roadmap/13_POS_Hub_Proposal.md` §10–11
(bento grids, chromeless/blended navigation, visible search-first navigation,
current Shopify/Square/Toast POS redesign direction).

**Frontend — `pages/SalesHubPage.tsx` rewritten again**
- **Header removed entirely.** No more `<header>` element. Store logo/name,
  live clock/date, and the user avatar/menu now render as the first row
  inside the same scrolling content container as the rest of the page —
  they scroll away with everything else instead of sitting in a fixed,
  bordered strip.
- **Time-of-day mesh background** — `meshForHour()` returns a layered
  `radial-gradient` CSS background-image (warm amber tones before noon, sky
  blue/violet in the afternoon, indigo/pink in the evening), applied as an
  inline style on the page root. Replaces the previous version's static
  blurred decorative circles.
- **Bento grid, not a uniform grid.** `New Sale` is a 2×2 hero tile — solid
  gradient fill, an oversized low-opacity watermark icon in the bottom
  corner, white text, since it's by far the most frequent action. `Duty-Free
  Sale` is a 2×1 hero tile, same treatment. The other six tiles (Repair,
  Old Gold, Memo, Layaway, Savings, Returns) are uniform 1×1 translucent
  "glass" tiles with a colored gradient icon chip. Spans were chosen so the
  total grid area is an exact multiple of the column count (4+2+6=12=3 rows
  × 4 cols) — an earlier attempt that mixed more tile sizes (making two
  small tiles row-span-2 to consume leftover space) produced scattered gaps
  live in the browser, because `grid-flow-dense` auto-placement is greedy,
  not an optimal packer. Keeping the secondary tiles uniform sidesteps the
  packing problem entirely rather than hand-solving it.
- **Live, visible search-to-filter field** (`pages/SalesHubPage.tsx`'s
  `query` state) sits directly on the page — not a hidden Cmd+K overlay,
  since a counter isn't a keyboard-first context. Typing narrows the grid to
  matching tiles in real time (case-insensitive substring match on title +
  description); pressing Enter with exactly one tile visible opens it
  directly. Verified live: typing "repair" narrows the whole grid down to
  just the Repair Intake tile.
- **Copy bug caught during this pass:** the previous iteration's greeting
  used `displayName.split(' ')[0]` to show just a first name, but a real
  tenant's `first_name` field held a full name string ("Jewelry Demo
  Admin"), so the greeting truncated to "Good afternoon, Jewelry". Reverted
  to the full `displayName` — only surfaced by looking at real-shaped demo
  data live, not by reasoning about the field name.

**Verification**
- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npx vitest run` — 618/618 passing, no test changes needed
  (existing `SalesHubPage.test.tsx` queries tiles by title text and menu
  behavior by `aria-label`/link text, neither of which the layout rework
  touched).
- **Verified live** via the Chrome extension against "Diamond Republic Demo
  — Heritage Quay": confirmed the gapless bento grid at desktop width, the
  chromeless top row scrolling normally with the page, the mesh background,
  the live search narrowing to a single tile, and the user menu (Dashboard
  shown for the non-cashier demo user).

**Deliberately unchanged:** the tile set, the duty-free intake flow, the
zero-rating fix, and the role-based login redirect from iterations 14–15 —
this was, again, purely a visual/layout pass.

---

## Iteration 16.1 (2026-08-25) — Sales Hub: refinement after user approval

Same-day follow-up, this time approving the bento/chromeless design itself
("I like this design") but requesting four targeted changes.

**Frontend — `pages/SalesHubPage.tsx`**
- **Search box removed.** The live filter field, its `query` state, and
  `handleSearchKeyDown` are gone; the bento grid now maps `tiles` directly.
  Rationale given: every option is already visible and selectable on the
  single screen, so a filter step doesn't save anything.
- **Greeting shrunk.** "Good afternoon, {name}" dropped from
  `text-3xl md:text-5xl font-bold` to `text-lg md:text-xl font-semibold` — it
  reads as a label now, not a hero headline, which fits a screen the user
  taps through quickly rather than lingers on.
- **Tenant logo now normalized.** The identity row previously rendered raw
  `store.logoUrl` directly in `<img src>`. `GeneralSettings.tsx`'s Settings
  page stores the uploaded logo as a relative path and resolves it for
  display via `normalizeImageUrl()` (`utils/imageUtils.ts`) before rendering
  — `SalesHubPage.tsx` skipped that step, so any tenant with a relative-path
  logo would silently fail to load and fall back to the lettermark. Fixed by
  computing `const logoSrc = normalizeImageUrl(store?.logoUrl)` and using
  `logoSrc` in place of `store.logoUrl`.
- **Footer added back.** A single right-aligned `<footer>` line —
  "Zettaz Cloud · Version {package.json version}" — sits below the scroll
  container. Simpler than the old two-sided store-name/copyright footer
  removed during the chromeless rewrite, per the explicit ask for just
  "Zettaz Cloud and version details right aligned."

**Verification**
- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npx vitest run src/pages/SalesHubPage.test.tsx` — 11/11
  passing (no test changes needed; tests query tiles by title text and the
  user menu by `aria-label`/link text, none of which reference search).
- **Verified live** via the Chrome extension against "Diamond Republic Demo
  — Heritage Quay": confirmed the search box is gone, the greeting renders
  small, the bento grid is still gapless, and the footer reads
  "Zettaz Cloud · Version 1.1.2" bottom-right. This demo tenant has no
  uploaded logo, so it correctly shows the lettermark fallback — the
  `normalizeImageUrl()` fix specifically addresses tenants with a real
  uploaded logo, which this tenant isn't, so it couldn't be visually
  confirmed against this data set.

**Deliberately unchanged:** tile set, duty-free intake flow, zero-rating
fix, role-based login redirect, mesh background, bento sizing — visual/copy
refinement only.

---

## Iteration 16.2 (2026-08-25) — Duty-Free intake: customer capture folded in

Feedback on the duty-free flow itself, not the Hub layout: the intake screen
captured traveller ID/travel method, but the customer was still a separate
step — land on `/pos`, click "Select Customer", search or quick-add in its
own modal. Three stops for one transaction. Explicit ask: collect the
customer here too, and make it required (not skippable) for a duty-free
sale.

**Frontend**
- **`components/customers/CustomerSearchSelect.tsx`** — added and exported
  `mapCustomerHitToCustomer()`, lifting the `CustomerHit → Customer`
  conversion (including the `isTaxExempt` derivation) that previously lived
  only inside `POSScreen.tsx`'s `handleCustomerHitSelected`. Two call sites
  now share one conversion instead of risking drift.
- **`pages/POSScreen.tsx`** — `handleCustomerHitSelected` now calls the
  shared `mapCustomerHitToCustomer()` instead of inlining the same object
  literal; behavior unchanged.
- **`pages/DutyFreeIntakeModal.tsx`** — rebuilt as a two-column, wider
  (`max-w-3xl`) modal: **Customer** on the left (the same
  `CustomerSearchSelect` component POS uses, search + inline quick-add,
  embedded directly rather than opened as a nested modal), **Traveller ID +
  Travel Method** on the right, unchanged fields. "Continue to Sale" now
  calls both `setSelectedCustomer()` and `setTravellerContext()` before
  navigating to `/pos` — a cashier lands on the register with the customer
  and traveller data already attached, no extra click. A customer is
  **required**: Continue is blocked with an inline message ("Select or add a
  customer to continue — required for a duty-free sale") until one is
  selected or quick-added; the message clears the moment a customer is set.
- Confirmed on `/pos`: after completing the intake, "Current Sale" shows
  "For: {customer name}" immediately — no separate customer-selection step
  needed for a duty-free sale.

**Verification**
- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npx vitest run` — 619/619 passing. `SalesHubPage.test.tsx`
  updated: existing intake tests adjusted for the new copy and two-column
  structure, a new test confirms Continue is blocked with no customer
  selected (`setTravellerContext`/`setSelectedCustomer` not called, no
  navigation), and the "completing the intake" test now drives the embedded
  quick-add form (mocking `@/services/api`'s `searchCustomers`/
  `createCustomer`) and asserts both `setSelectedCustomer` and
  `setTravellerContext` are called before navigating to `/pos`.
- **Verified live** via the Chrome extension against "Diamond Republic Demo
  — Heritage Quay": clicking Continue with no customer shows the inline
  block message; quick-adding "Jordan Tan" clears it and shows the rich
  selected-customer card; Continue then navigates to `/pos` where "Current
  Sale" already reads "For: Jordan Tan".

**Deliberately unchanged:** the traveller ID/travel-method fields and their
values, the zero-rating logic, and the ordinary (non-duty-free) `/pos`
customer picker — which remains optional there, only the duty-free intake
now requires a customer up front.

---

## Iteration 16.3 (2026-08-25) — Duty-Free customer capture: deferred create + labeled details + locale date fix

Follow-up feedback on 16.2's two-column intake: disagreed with creating the
new customer immediately on its own inline "Create & Select" button (still
an extra click/network round-trip ahead of "Continue to Sale"), asked for
the existing-customer match to render as clearly labeled read-only fields
rather than a compact chip, wanted the search box to stay usable even while
a new-customer draft is being typed, and flagged that Departure Date's
native `<input type="date">` both ignored the tenant's date format and let
the year field overflow past 4 digits.

**Frontend — `pages/DutyFreeIntakeModal.tsx` reworked again**
- **Existing customer** is unchanged in *how* it's found (still
  `CustomerSearchSelect`'s search), but the result is now rendered as a
  bespoke, labeled card in the modal itself — Name, Customer Code/Type,
  Phone, Email, Address, each under its own small uppercase label — instead
  of relying on `CustomerSearchSelect`'s compact built-in "selected" chip.
  `CustomerSearchSelect` is now always kept in `selected={null}` mode; the
  parent tracks `existingCustomer` itself.
- **New customer** creation is deferred. Clicking "Add new customer" (the
  same `+` affordance `CustomerSearchSelect` already exposes, wired via its
  `onQuickAddRequested` callback) opens an inline form — First/Last Name,
  Phone, Email, Address Line 1/2, City, State, Postal Code, Country — with
  no submit button of its own. Nothing is created yet; a note under the
  form says as much ("Created automatically when you click 'Continue to
  Sale' — no extra step"). `handleContinue` now: if an existing customer is
  selected, proceeds immediately; otherwise, if the new-customer form is
  open, validates First Name, calls `createCustomer()` with the collected
  fields, and only then calls `setSelectedCustomer` +
  `setTravellerContext` + navigates — one click does customer creation and
  sale handoff together.
- **Search stays live during a new-customer draft.** `CustomerSearchSelect`
  is rendered above the new-customer form (not replaced by it), so a
  cashier who started typing a walk-in's details can still search and pick
  an existing match; doing so discards the draft and shows the labeled
  existing-customer card instead (`handleSelectExisting`).
- **Departure Date now uses `components/ui/DatePickerInput`** (the same
  text-input-with-calendar-popover component `RepairsPage.tsx` uses for its
  Ready/Completion Date) instead of a native `<input type="date">`. It
  reads `store.dateFormat` for display/entry and auto-inserts separators as
  you type, so a duty-free traveller's departure date now follows the
  tenant's configured date format instead of the browser's own — and,
  because it builds the ISO value from capped 2/2/4-digit segments rather
  than letting the browser's native date widget accept extra keystrokes, the
  year segment can no longer run past 4 digits. `minDate={today()}`,
  `maxDate="2099-12-31"` (matching `RepairsPage.tsx`'s convention for
  future-dated fields) — a departure date can't be entered in the past.

**Verification**
- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npx vitest run` — 621/621 passing.
  `SalesHubPage.test.tsx` updated: the old "quick-add creates immediately"
  test is replaced with one asserting `createCustomer` is NOT called while
  the new-customer form is being filled and IS called (with the typed
  fields) only once "Continue to Sale" is clicked; two new tests cover
  selecting an existing customer (labeled card renders phone/email) and
  switching to an existing customer while a new-customer draft is open
  (draft is discarded, existing customer wins).
- **Verified live** via the Chrome extension against "Diamond Republic Demo
  — Heritage Quay": Departure Date shows `DD/MM/YYYY` (this tenant's
  format) with a calendar icon; typing 12 digits into it
  (`251220269999`) settles on `25/12/2026` — the trailing digits are
  dropped, confirming the year can't overflow. Opened the new-customer
  form, typed a first name, confirmed no network call fired, clicked
  "Continue to Sale", and landed on `/pos` with "For: Maria" already shown
  in Current Sale — the customer was created exactly once, at that click.

**Deliberately unchanged:** the requirement that a customer (existing or
new) is mandatory before continuing, the traveller ID/travel-method fields,
and the zero-rating logic.

---

## Iteration 16.4 (2026-08-25) — Duty-Free intake: traveller details actually enforced as mandatory

Bug catch: the customer requirement added in 16.2 was enforced in
`handleContinue`, but the traveller fields (ID Number, Issuing Country,
Flight/Vessel/Reference, Destination, Departure Date) were never checked —
"Continue to Sale" would create/attach a customer and navigate to `/pos`
even with every traveller field left blank, silently producing a
duty-free-flagged sale with no ID or travel record behind it.

**Frontend — `pages/DutyFreeIntakeModal.tsx`**
- Added `isTravellerComplete()`, checking the five traveller fields that
  don't say "(optional)" (ID Number, Issuing Country, the travel-method
  reference field, Destination, Departure Date — Detail stays optional).
  `handleContinue` now evaluates both the customer and traveller checks up
  front and surfaces both problems at once (rather than one, then the
  other on a second click) — it returns before creating a new customer or
  navigating if either is incomplete, so a blocked traveller side can never
  leave behind a half-created customer record.
- Each required traveller field's label now carries a red asterisk, and
  the field itself gets a red border the moment Continue is clicked with it
  empty — clearing live as soon as a value is typed, no second click
  needed to see the fix take effect. A summary line ("Complete all
  traveller details to continue — required for a duty-free sale") sits
  under the travel column, mirroring the existing customer-required
  message's tone on the other side.
- `inputCls` changed from a plain string to a small function taking an
  `invalid` flag, matching the `border-border`/`border-red-400` toggle
  pattern already used in `QuickAddCustomerModal.tsx`, rather than trying
  to concatenate conflicting Tailwind border classes.

**Verification**
- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npx vitest run` — 622/622 passing. Added a test
  confirming Continue is blocked (no `createCustomer`, no
  `setTravellerContext`/`setSelectedCustomer`, no navigation) when a new
  customer's name is filled in but every traveller field is empty; updated
  the "completes the intake" test to fill all five required traveller
  fields (previously only ID Number) before asserting success.
- **Verified live**: clicking Continue on a fully empty screen shows both
  the customer-required message and the traveller-required summary with
  red-bordered fields simultaneously.

**Deliberately unchanged:** the customer-required behavior from 16.2/16.3,
the zero-rating logic, and the "Detail (optional)" field, which stays
optional.

---

## Iteration 16.5 (2026-08-25) — Fixed: "Sale creation failed: Invalid payment method ID."

Reported live while testing the Duty-Free flow end to end: checkout failed
at the very last step with a 400 from `POST /api/sales`, `Invalid payment
method ID.` — unrelated to anything in the Sales Hub or duty-free work
itself; a pre-existing bug in `createSaleController.js`'s payment method
validation, on any sale (duty-free or ordinary) using an affected payment
method.

**Root cause:** `payment_methods` is a per-tenant, admin-configurable table
(Settings → Payment Methods) — a tenant can name and code a method however
they like, and the frontend always sends that row's UUID. But
`createSaleController.js` required the UUID's DB `code` to also appear in a
second, separately-maintained `codeMapping` dict (`cash`/`card`/`phone`/
`on_account`/`none` only) before the sale could proceed. Any active,
correctly-scoped payment method whose code wasn't one of those five —
anything added via Settings with a different code — resolved its DB row
fine, then got silently discarded back to the raw UUID, which then failed
the final check against the fixed `VALID_PAYMENT_METHODS` whitelist.

**Backend — `controllers/createSaleController.js`**
- A UUID that resolves to an active `payment_methods` row scoped to the
  authenticated tenant is now accepted on that basis alone — no second
  whitelist lookup required. `codeMapping` still runs, but only to
  normalize onto the handful of codes the "none"/$0.00-total special case
  further down actually checks for; an unmapped code is left as-is and
  still accepts the sale.
- The fixed `VALID_PAYMENT_METHODS` map is now purely a fallback for
  legacy/non-UUID callers (or a UUID that genuinely doesn't resolve —
  wrong tenant, inactive, or nonexistent), not a second gate every
  UUID-backed method has to also pass.

**Verification**
- `cd backend && npx mocha tests/createSaleController.dutyFree.test.js` —
  12/12 passing (8 previously existing + 4 new). Added a "payment method
  validation" describe block: a UUID with a DB code outside the old
  hardcoded list (`gift_card`) now succeeds (this is the regression test —
  it reproduces exactly the reported bug and fails against the old code);
  a UUID with no matching row for the tenant is still rejected; an
  unrecognized plain non-UUID code is still rejected; a UUID whose DB code
  is empty is still special-cased as `none` and still restricted to
  $0.00-total sales.
- Ran the full backend suite minus the three files that fail to even load
  in this sandbox for an unrelated reason (`sharp`'s native binary isn't
  installed for linux-arm64 here — `routeAuthGuard`/`taxAuthWithToken`/
  `taxHeaders.test.js`, all of which pull in `server.js`): 251 passing, 0
  failing, on top of the 12 in the file above.

**Deliberately unchanged:** every other sale-creation code path (tax
verification/zero-rating, document numbering, traveller capture) — this
was purely the payment-method gate.

---

## Iteration 16.6 (2026-08-25/2026-09, via Devin IDE) — end-to-end duty-free checkout fixes

Full session notes: `docs/18-errors-fixes/2026-08-print-templates-duty-free-checkout-fixes.md`.
Devin picked up checkout from where 16.5 left off, testing the Duty-Free
flow all the way through a real payment and print. This surfaced (and
fixed) four more issues layered on top of 16.5's payment-method fix, plus
an unrelated pass over the Print Template Designer done earlier in the same
session:

- **16.5's fix was still too narrow.** It only queried `payment_methods`
  when `payment_method_id` matched a strict UUID regex. Demo/seeded payment
  method IDs (e.g. `demo0001-jw00-0000-0000-00000000pm1`) are valid
  tenant-scoped opaque IDs but not RFC UUIDs, so the lookup was skipped and
  they still failed. `createSaleController.js` now resolves **any**
  `payment_method_id` that isn't already a recognized system code (`cash`,
  `card`, `phone`, `on_account`, `none`, `stripe`, `paypal`) against
  `payment_methods` by ID + tenant + `is_active = 1` — no format
  assumption. Treat payment method IDs as opaque tenant-scoped strings, not
  UUIDs, anywhere else in the codebase.
- **Missing duty-free columns.** The `sales_mode`/`zero_rate_reason`/
  traveller/travel-method/destination/departure-date columns this
  session's earlier `createSaleController.js` work (16.1–16.4) already
  wrote to didn't exist in the connected database — the migration existed
  but hadn't been applied. Applied as
  `database/migrations/applied/2026-09-01_pos_hub_duty_free_capture.sql`.
  **Always run `npm run migrate:status` before testing a feature that adds
  columns** — code and schema can drift silently otherwise.
- **Non-atomic, FK-broken inventory deduction.** Checkout used to commit the
  sale, then the frontend fired a separate `PATCH /api/products/:id/stock`
  — a sale could succeed while inventory failed, and `stock_adjustments`'s
  FK columns (`VARCHAR(36)`) didn't match `products.id`/`users.id`
  (`CHAR(36)`), so valid product IDs failed the FK constraint outright.
  Fixed on both sides: `stock_adjustments.product_id`/`user_id` converted
  to `CHAR(36)` (`database/migrations/applied/2026-09-02_fix_stock_adjustment_fk_types.sql`,
  idempotent — drops/re-adds the FKs only if the constraint names exist/are
  missing); `createSaleController.js` now locks each product row
  (`SELECT ... FOR UPDATE`), decrements stock, and inserts the
  `stock_adjustments` row **inside the same transaction as the sale**
  (non-piece line items only — serialized pieces keep their existing
  piece-specific sync path). `Cart.tsx`'s post-checkout `updateProductStock`
  PATCH loop was deleted — inventory mutation is now server-authoritative
  and part of the sale transaction, full stop. Don't reintroduce a
  client-side post-checkout stock call.
- **`auditLogService.js` export mismatch.** `createSaleController.js` (and
  others) imported `logActivity`, but the service only exported
  `logAuditEvent`/`logPrintJob`/`logPrinterDeviceEvent`, so every checkout
  logged `TypeError: logActivity is not a function` after the sale had
  already committed. Fixed with a `logActivity` compatibility adapter that
  maps the legacy call shape onto `logAuditEvent`. If you see that
  TypeError again, something re-imported the old name from a stale build —
  the export exists now.
- **`showReceiptForSale` call-site TypeScript error.** Its signature moved
  from a boolean second argument to an options object a while back;
  `Cart.tsx` still called it as `showReceiptForSale(newSale, true)`. Fixed
  to `showReceiptForSale(newSale, { mode: 'print', disableFallback: true })`.
- **Logging/tenant-safety cleanup.** Verbose per-sale request-body/payment-method
  logging in `createSaleController.js` now respects `DEBUG_SALES=true`
  instead of always printing; payment-method display lookups and sale-item
  existence checks were scoped to the authenticated tenant to avoid
  cross-tenant reads.

**Print Template Designer** (same session, done earlier, unrelated to
checkout): header/text blocks no longer conflate store identity with
document title/metadata (`header` = document title + metadata like
invoice number/date/cashier; `text` = store identity fields, each
toggleable independently); font-size control now actually reaches the
renderers (`config.fontSize` resolved with a block-specific fallback
across headers, store/customer details, tables, totals, payment, terms,
compliance, footer, signatures — scale: Fine/Extra small/Small/Base/Large/Extra
large/Title, plus a bold toggle); logo height is now configurable in mm
(`logoHeight`, with small/medium/large/extra-large presets, alignment, and
an optional image-URL override) instead of hardcoded per paper type;
customer/address blocks can now show street/city/state/postal/country/tax
ID/passport individually, and address blocks can render billing, shipping,
or both. `printTemplateRenderer.ts` (print HTML) and `TemplateCanvas.tsx`
(on-screen preview) were updated together so they stay in parity, per the
existing convention in this file.

**Verification (per the session notes):** frontend TypeScript and
production build passed; payment-method regression tests passed;
duty-free zero-rating/traveller-capture tests passed; template/fixture/
jurisdiction/provisioning tests passed; focused backend suite 33 passing;
stock-adjustment FK insert verified against the live DB inside a
rolled-back transaction; `npm run migrate:status` reached zero pending
after applying the two migrations above; full backend suite 280 passing,
1 pending, 16 unrelated pre-existing route-auth failures; final manual
checkout completed clean (payment, schema, stock, audit).

**Re-verified in this session (2026-08-25, this agent, after the fact):**
confirmed all of the above are actually present in the working tree —
`createSaleController.js`'s payment check no longer gates on a UUID regex,
inventory deduction is inside the sale transaction with the FK-safe
column types, `auditLogService.js` exports `logActivity`, `Cart.tsx` calls
`showReceiptForSale` with the options object and no longer has a
post-checkout stock PATCH, and both migration files exist under
`database/migrations/applied/` (the "migration source file was removed
from the working tree" note in the session doc is stale — it's present).
Ran `cd backend && npx mocha tests/createSaleController.dutyFree.test.js`
(13/13 passing, including Devin's `demo0001-jw00-...` regression test) and
the rest of the backend suite minus the three files that fail to load in
this sandbox for an unrelated reason (`sharp` has no linux-arm64 binary
here — `routeAuthGuard`/`taxAuthWithToken`/`taxHeaders.test.js`, all of
which pull in `server.js`): 250 passing, 1 pending. Frontend:
`npx tsc --noEmit` clean, `npx vitest run` 622/622 passing.

**Deliberately unchanged:** the zero-rating logic, document numbering,
traveller capture shape, and serialized-piece sync path — none of this
touched those.

---

## Iteration 16.7 (2026-08-25) — Sales Hub: return to the Hub after checkout

Feedback: a sale started from the Sales Hub (New Sale or Duty-Free Sale)
left the cashier stranded on `/pos` after checkout — the only way back to
the Hub was the user-menu link, an extra step the Hub itself was supposed
to eliminate.

**Frontend**
- `pages/SalesHubPage.tsx`'s "New Sale" tile and `pages/DutyFreeIntakeModal.tsx`'s
  `finalizeContinue` now navigate to `/pos` with router state
  `{ fromSalesHub: true }` instead of a bare `navigate('/pos')`.
- `pages/POSScreen.tsx` reads that flag via `useLocation()` and, once set,
  has both `resetSelectedCustomerAfterSale` (desktop cart) and
  `handleMobileCheckoutSuccess` (mobile cart, which calls the former)
  `navigate('/sales-hub')` after a completed sale, right after the
  existing post-sale customer reset. `onCheckoutSuccess` in `Cart.tsx`
  already fires after the receipt-print attempt (success or failure)
  regardless of `fromSalesHub`, so this doesn't change print/receipt
  timing — it only adds a navigation at the very end.
- Ordinary (non-Hub) POS use is unaffected: `fromSalesHub` is only ever
  `true` when the navigation came from a Sales Hub tile, so a tenant
  without the Hub (every non-jewelry industry) or a jewelry cashier who
  reached `/pos` some other way (e.g. a bookmark) sees the previous
  behavior — stay on `/pos` with an empty cart.

**Verification**
- `cd frontend && npx tsc --noEmit` — clean.
- `cd frontend && npx vitest run` — 622/622 passing.
  `SalesHubPage.test.tsx`'s existing "New Sale navigates to /pos" and
  "completing the duty-free intake ... continues to /pos" assertions were
  updated to expect the `{ state: { fromSalesHub: true } }` second
  argument.
- **Verified live** via the Chrome extension: "New Sale" from the Hub
  landed on `/pos` with the cart empty; added an item and checked out
  (cash, exact amount) — the sale completed (stock dropped from 6 to 5
  "left" on the tapped product, confirming the transactional inventory fix
  from 16.6 is working end to end). The live browser's real print dialog
  from `showReceiptForSale`'s `window.print()` then blocked further
  scripted interaction with that tab (expected — a real OS/browser print
  dialog isn't something page-level automation can dismiss, and isn't
  something this change touches), so the actual `/sales-hub` landing after
  dismissing print wasn't captured in a screenshot. Confirmed instead by
  tracing `Cart.tsx`: `onCheckoutSuccess()` (which now performs the
  navigation) is called unconditionally right after the awaited
  `showReceiptForSale` call, success or failure, so the redirect fires as
  soon as the cashier's print dialog is dismissed.

**Deliberately unchanged:** receipt printing, stock deduction, and every
other post-checkout step — this only adds a navigation at the end of an
existing callback.

---

## Iteration 17 (2026-08-25/26) — Print Module Phase 1: receipt/invoice printing rebuilt

User report: a printed receipt (Diamond Republic) showed the old plain
layout — header text, "Customer: Guest", item table, QR, "Thank you for
your purchase!" — despite the Print Template Designer work landing in
Iteration 13. Printer Settings' "Receipt Template" dropdown only ever
showed "Default template." User asked for a full audit, then approved
proceeding with a scoped, store-level slice of
`docs/print-module/PRINT_MODULE_FINAL_BLUEPRINT.md`.

**Root cause (audit)**
- `receiptService.ts`'s `getReceiptForSale` only attempted the Designer's
  `renderSaleWithTemplate` when `printerSettings?.usePrintTemplates` was
  truthy — but `printerService.ts`'s `getPrinterSettings()` built its
  returned object from an explicit field allowlist that never included
  `use_print_templates`/`usePrintTemplates`. The flag was persisted
  correctly by the backend and silently dropped on every read, so the
  Designer path was unreachable in production for any tenant.
- The "Receipt Template" dropdown was backed by a separate, dead
  `receipt_templates` table nothing had ever written rows into — unrelated
  to the Designer's real `print_templates` table.
- Confirmed via `provision-missing-print-templates.js --dry-run`: every
  real tenant (ajahswan's Business, Deshvidesh Enterprises, Diamond
  Republic, The VVV Spot) had ZERO published templates — even after
  Iteration 13's Designer work landed, so every one of them was always
  hitting the hardcoded legacy renderer regardless.

**Schema — a discovery mid-migration**
- A migration first named its new table `print_routes`. Running it against
  the real database failed with `Unknown column 'document_type'` — a
  `print_routes` table (plus `print_stations`, `printer_devices`,
  `print_jobs`) already existed, empty, an earlier partial attempt at the
  FULL blueprint's generic condition-engine routing model
  (`condition_type`/`condition_value` → `printer_device_id`), unreferenced
  by any application code. That schema has no `template_id`/`copies`/
  `auto_print`/`paper_width` and no `local_agent` connection type the app
  already depends on. Renamed the new table to **`print_document_settings`**
  rather than colliding with or half-adopting the dormant one; those four
  tables are left untouched. See
  `docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md §0`.

**Backend**
- `database/migrations/2026-08-25_print_document_settings.sql` — new table,
  one row per `(tenant, store, document_type IN ('receipt','invoice'))`:
  `delivery_mode` (browser/direct/local_agent), `printer_name`,
  `paper_width`, `template_id`, `copies`, `enabled`, `auto_print`.
  Idempotent; backfills a `receipt` row per existing `printer_settings` row.
- `database/migrations/2026-08-25_default_sale_document_type.sql` —
  `stores.default_sale_document_type ENUM('receipt','invoice') DEFAULT
  'receipt'` — the store-level choice of what a completed sale prints as.
- `backend/controllers/printDocumentSettingsController.js` (new) +
  `GET/PUT /api/settings/print-document-settings/:storeId[/:documentType]`,
  `PUT .../default-format`. `template_id` is validated against
  `print_templates` scoped to the tenant before being stored.
- `backend/scripts/provision-missing-print-templates.js` (new,
  `npm run provision:missing-templates[:dry]`) — one-off backfill giving
  every existing non-demo tenant its default templates, reusing
  `templateProvisioningService.provisionStoreTemplates` (new tenants and
  industry changes already auto-provision via `signupService.js`/
  `industry.routes.js`; this closes the gap for tenants that predate that
  wiring). Run for real against the production DB during this session — all
  4 real tenants backfilled successfully (13 templates created, 0 failed).
- Removed entirely: `getReceiptTemplates`/`getReceiptTemplate`/
  `createReceiptTemplate`/`updateReceiptTemplate`/`deleteReceiptTemplate`
  from `printerSettingsController.js`, and the `/receipt-templates` routes.
  `printer_settings`'s own `GET/PUT /printer/:storeId` endpoints are kept,
  marked deprecated, for one release's rollback window.

**Frontend**
- `frontend/src/services/receiptService.ts` — deleted `generateReceiptHtml`
  (500+ lines) and the hardcoded HTML branch of `getReceiptForReturn`
  entirely, along with the now-fully-unused `generateTestReceipt` (had zero
  callers). `getReceiptForSale`/`getReceiptForReturn` now render EXCLUSIVELY
  via `renderSaleWithTemplate`/`renderReturnWithTemplate` and throw a clear,
  actionable error if no published template resolves — safe only because
  every tenant now has one. `getReceiptForSale` gained a `documentType`
  parameter (`'receipt' | 'invoice'`, default `'receipt'`); when `'invoice'`
  is requested it tries `invoice` then falls back to `jewelry_invoice` (a
  jewelry tenant's invoice template type), so a jewelry store choosing
  "print sales as Invoice" doesn't need to know its own template taxonomy.
  KNOWN GAP surfaced by this removal: the legacy renderer showed per-item
  industry attributes (`show_on_receipt`, e.g. jewelry purity/weight); the
  Designer's block model has no equivalent yet — logged under "Known
  pending work" in `CLAUDE.md`, not addressed this iteration.
- `frontend/src/services/printDocumentSettingsService.ts` (new) — the real
  settings service going forward; `printerService.ts`'s
  `getPrinterSettings`/`updatePrinterSettings` are deprecated.
- `frontend/src/hooks/useReceipt.ts` — now fetches `print_document_settings`
  and resolves an `effectiveDocSetting` for whichever document type the
  store's `default_sale_document_type` says a sale prints as, builds an
  `effectivePrinterSettings` object from it (both `paper_width` and
  `paperWidth` set, since `printerService.ts` and `receiptService.ts` read
  different casings — `paperWidth` was previously never set at all here,
  silently defaulting), and passes it EXPLICITLY into `printReceipt(...)`.
  Previously `printReceipt` was called with `printerSettings: undefined`,
  which made it silently re-fetch the legacy `printer_settings` row
  internally — meaning the new Printer Settings UI would have been
  decorative, with no effect on actual printing, had this not been caught
  and fixed in the same pass.
- `frontend/src/services/printerService.ts` — `printReceipt(...)` gained a
  `copies` parameter (default 1), looped for `local_agent`/`direct`
  delivery only; a browser print dialog's copies field can't be preset, so
  it has no effect in browser mode (documented in code and in the UI hint).
- `frontend/src/components/settings/PrinterSettings.tsx` — full redesign:
  a "Print Sales As" (Receipt/Invoice) store-level toggle, then two
  independent sections — "Sales Receipt & Refunds" and "Invoices" — each
  with its own enabled/auto-print, delivery mode, printer name, paper width
  (receipt) or "A4/Letter" (invoice, read-only), copies, and a template
  picker sourced from real `print_templates` (filtered to published only).
  Labels & Tags stay their own untouched system
  (`LabelPrinterSettings.tsx`, rendered alongside by the existing wrapper).
- Deleted as dead code (zero importers, confirmed by grep):
  `frontend/src/hooks/useOptimizedReceipt.ts`,
  `frontend/src/components/settings/SettingsPrint.tsx`.

**Regression protection**
- `backend/tests/deadCodeRemoval.test.js` — new "Removed: receipt_templates
  dead system" describe block (6 assertions: controller exports gone, route
  gone, no backend source queries the table, frontend doesn't call the
  removed endpoints, the two dead files stay deleted, the legacy HTML
  generators stay deleted) plus one more confirming `PrinterSettings.tsx`
  no longer reads/writes the legacy `printer_settings`-backed API.

**Verification**
- `backend`: `npx mocha tests/migrationSplitter.test.js` — both new
  migrations split into valid statements. Full suite (excluding the 3 files
  that fail to load in this sandbox for an unrelated `sharp` native-binary
  reason) — 259/259 passing, including 36/36 in `deadCodeRemoval.test.js`.
- `frontend`: `npx tsc --noEmit` — clean after every step. `npx vitest run`
  — 622/622 passing.
- Both new migrations run for real against the production database
  (`digitpulse_zcloud`) during this session; `provision:missing-templates`
  run for real, all 4 tenants backfilled successfully.
- **Not yet live-verified**: an actual POS checkout printing through the
  new path end-to-end in a browser (this session's live-browser
  verification was blocked in the same way documented in Iteration 16.7 —
  a real print dialog freezes further scripted interaction). Traced through
  code instead; recommend a manual checkout test before considering this
  fully closed.

**Deliberately deferred** (see `docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md
§5` for the full list): station-level routing/`print_stations`, durable
`print_jobs`/retry/audit trail, full Local Agent v1 protocol, the label/tag
template system, and per-item industry-attribute display on
template-rendered receipts.

### Iteration 17.1 (2026-08-26) — Fixed: `print-document-settings` 500 on load

User hit a real browser 500 opening Printer Settings right after Iteration
17 shipped: `GET /api/settings/print-document-settings/:storeId` failing.

**Root cause**: `backend/config/db.js` exports two different things both
casually called "pool" depending on how a file requires it —
`const pool = require('../config/db')` gives the whole exports object, whose
`pool.query()` is a custom retry wrapper that already unwraps mysql2's
`[rows, fields]` tuple and returns the rows array directly; `const { pool } =
require('../config/db')` gives the real mysql2 pool, whose `.query()` returns
the tuple. `printDocumentSettingsController.js` was written using the first
require style but the second style's destructuring pattern
(`const [rows] = await pool.query(...)`), which silently grabbed row zero
instead of the array — `.map()`/`.find()` on that then threw, caught by the
generic try/catch, surfaced as a 500.

**Fix**: removed the destructuring in all 3 spots in
`printDocumentSettingsController.js`. While there, found and fixed the
identical pre-existing latent bug in `printerSettingsController.js`'s
`updatePrinterSettings` and `testPrintSettings` (the deprecated-but-still-live
legacy endpoints) — same wrong-require-style destructuring, previously
masked because the 0-rows case happened to still route to the right branch.

**Regression test**: `backend/tests/printDocumentSettingsController.test.js`
(new) stubs `../config/db` in the flat, non-tuple shape and asserts
`getPrintDocumentSettings` returns real data for both the has-rows and
no-rows-yet cases.

**Verification**: `npx mocha tests/printDocumentSettingsController.test.js`
— 2/2 passing. Full backend suite (same sandbox exclusions as before) —
261/261 passing.

### Iteration 17.2 (2026-08-26) — Fixed: `ER_BAD_FIELD_ERROR` on `default_sale_document_type`

User re-tested after 17.1 and hit a second real error: `Unknown column
'default_sale_document_type' in 'field list'`, thrown from
`getPrintDocumentSettings`'s `SELECT default_sale_document_type FROM
stores ...` query.

**Root cause**: the `2026-08-25_default_sale_document_type.sql` migration
was written, syntax-checked (`migrationSplitter.test.js`), and reported as
part of Iteration 17's deliverables — but was never actually run
(`npm run migrate`) against the real database before the feature was
declared done. The `print_document_settings` migration WAS run (confirmed
by the user's terminal output in Iteration 17); this one was missed,
because the "run the migration" step happened once, before this second
migration was fully written, and was not repeated.

**Fix**: none needed in code — instructed the user to run
`cd backend && npm run migrate`, which picks up the still-pending
`2026-08-25_default_sale_document_type.sql` file.

**Lesson captured in `docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md §6`**:
"migration file exists and is syntactically valid" is not the same claim as
"migration has been applied to the database you're about to test against" —
`npm run migrate:status` must be checked, not assumed, especially when a
second migration is added after the first has already been run once in the
same session.

### Iteration 17.3 (2026-08-26) — Printer Settings runtime truthfulness and UX redesign

A deep logic audit found that two visible Printer Settings controls did not
control runtime behavior: the saved route `template_id` was never passed to
the renderer, and `auto_print` was never checked before printing. The same
audit found contradictory enable/default states, non-atomic three-request
saving, ambiguous receipt/invoice/template taxonomy, legacy test-print use,
and no explicit A4-vs-Letter media value.

**Runtime fixes**
- Threaded the route's explicit `templateId` through `useReceipt` →
  `getReceiptForSale` → `renderSaleWithTemplate`; exact compatible published
  selection now wins over defaults.
- Auto Print now has truthful behavior: off opens preview, on initiates the
  configured delivery, disabled routes do nothing, and explicit view mode
  always previews.
- Template fallback no longer picks an arbitrary first template when multiple
  published non-default candidates exist.
- Template listing includes intentional tenant-wide (`store_id IS NULL`)
  templates, and default updates are store-scope aware.

**Settings and UX**
- Added one validated transactional endpoint that saves receipt route,
  invoice route, and the store default document together.
- Added explicit `media_size` (`58mm`/`80mm`/`110mm`/`a4`/`letter`) with the
  applied `2026-09-03_print_document_media_size.sql` migration.
- Replaced “Print Sales As” with accessible default-document cards, an
  effective checkout workflow summary, active-route-first layout, collapsed
  additional formats, explicit refund compatibility text, route-level test
  actions, dirty/discard behavior, and field-level validation display.
- Removed the new UI's generic legacy Test Print dependency; each route tests
  current unsaved template/media/delivery values with one copy.

**Security correction found during verification**
- Removed the unconditional `|| true` development-auth bypass. Header-derived
  development users now require both development mode and explicit
  `ALLOW_DEV_HEADER_AUTH=true`; forged tenant headers no longer authenticate.

**Verification**
- Frontend: 629/629 tests passing; production build passing.
- Backend focused print/template/settings suite: 77 passing. The one auth
  failure discovered in that run was fixed and its focused rerun is 6/6.
- Migration status: 40 applied, 0 pending.
- Template provisioning dry run: 0 missing, 4 stores already complete.

### Iteration 17.4 (2026-08-26) — Fixed atomic-save request casing and noisy agent probing

First live save of the redesigned page returned `400 Printer settings are
incomplete`. `fetchApi` correctly converts JSON request bodies from camelCase
to snake_case, but the new atomic controller read only camelCase
`defaultSaleDocumentType`, `deliveryMode`, `templateId`, `mediaSize`, and
`autoPrint`. The controller now normalizes both casings at its boundary, and
the regression test sends the same snake_case payload produced by `fetchApi`.

Structured API validation errors were also being discarded because `fetchApi`
created a new plain `Error`. It now preserves status, field errors, and response
data so Printer Settings can display the exact failing fields.

Local Agent health requests to ports 9419/9420 produced connection-refused
entries simply by opening Settings. Automatic probing was removed; agent
detection now runs only when the user chooses **Detect agent** or tests an
agent route. A missing local agent is therefore an explicit setup result, not
background console noise.

**Verification:** atomic controller tests 4/4 passing; frontend build passing;
settings action tests 4/4 passing.

### Iteration 17.5 (2026-08-26) — Agent/direct-print audit, return legacy removal, and structured ESC/POS data

- Audited Electron Print Agent packaging and live QA. Unsigned Electron dev was
  killed by endpoint security; arm64 DMG builds but is unsigned/unnotarized,
  thermal-size-only, and not production-ready for A4/Letter.
- Audited the iRestrack Go bridge. Reusable Windows RAW spool, TCP, service,
  tray, installer, secret, and request-limit patterns were found; macOS system
  printing, PDF, enumeration, queue/idempotency, strict origins, and a clear
  shared-code license/ownership notice are missing. Decision: design a shared
  product-neutral Go Agent v2 rather than rebrand the bridge unchanged.
- Network simulator ports 9100/9101 are reachable. Simulator output proved the
  old HTML parser loses items/totals from new template HTML.
- Direct test printing now sends structured receipt data, and real-sale direct
  printing rebuilds item/totals/payment data from tenant-scoped sale rows before
  ESC/POS formatting. HTML is no longer the sole data source for those jobs.
- `useReturnReceipt` no longer reads deprecated `printer_settings` or asks
  `printReceipt` to refetch it. Returns use the selected default document route's
  media/delivery/Auto Print settings: receipt-first stores get thermal output;
  invoice-first stores get A4/Letter output.
- Return rendering now requires a published `return` template and never falls
  back to a sale-receipt template or hardcoded legacy slip.
- Added Print Agent audit/operations, template inventory, and full delivery/
  Agent completion-plan documents.

**Verification:** frontend build passing; return/template tests 29/29; structured
ESC/POS smoke confirms item and total output; backend syntax checks passing.

### Iteration 17.6 (2026-08-26) — Electron retired; Go Print Agent v2 foundation

With explicit approval, removed the unused Electron agent completely:
`electron/`, Express `src/`, Node dependencies/lock/package files, generated
`dist-app/`, and the dead duplicate frontend local-agent service. No clients
were using those installers.

Created the only new Agent implementation under `app-zettaz-cloud/print-agent/`:

- Product-neutral Go 2.0.0-dev module
- Strict-origin loopback HTTP API with bearer-token enforcement
- Health, printer enumeration, job submission, and job status
- macOS/Linux CUPS enumeration and PDF/RAW spool
- Windows `Get-Printer` enumeration and Winspool RAW printing
- Private-network TCP RAW printing
- PDF/ESC-POS/ZPL/TSPL content types, copies, payload limits, and in-process
  job ID idempotency/status
- Go test/vet and cross-platform binary workflow

The frontend Local Agent path now targets `/v1/printers` and `/v1/jobs`,
converting template HTML to PDF lazily in the browser for system printers.
Old Electron installer links were removed from `/print-agent`; the page now
states installers are pending certification.

**Local verification:** Go test/vet/build passing; `/v1/health` returns
2.0.0-dev on Darwin; `/v1/printers` detects the network queue and
`Canon_TS3700_series` as the default; frontend production build and focused
33 tests pass.

### Iteration 17.7 (2026-08-26) — Agent v2 completion pass

Completed the remaining development-scoped Agent functionality:

- Persistent six-digit pairing, hashed tokens, browser pair/disconnect UI
- Durable JSON job queue, restart recovery, three attempts, cancellation,
  status polling, seven-day cleanup, and in-process cancellation
- Diagnostics endpoint/UI and rotating local logs
- Windows PDF printing via configurable SumatraPDF plus Windows RAW Winspool
- Windows Service and macOS LaunchAgent lifecycle commands
- Windows Inno Setup and macOS PKG installer scaffolding with service setup
- Cross-platform Go build verification and installer workflow updates
- Frontend PDF job submission/polling and 14 pairing/configuration tests

**Verification:** Go tests/vet and Darwin/Windows/Linux builds pass; macOS PKG
builds unsigned; frontend build and 643/643 tests pass; backend focused 37/37;
full pair → printers → diagnostics → unpair smoke passes.

**External blockers only:** Apple/Windows signing credentials, SumatraPDF
bundling/license decision or replacement, tray/menu-bar polish, clean-machine
installer QA, physical printer certification, and signed auto-update.

---

## Pending after iteration 17

- **Printer Settings redesign is automated-test complete but still requires
  field QA** — work through Phase G in
  `docs/print-module/PRINTER_SETTINGS_UX_AND_LOGIC_REDESIGN_PLAN.md`: open the
  real page, save an explicit receipt and jewelry-invoice template, verify
  Auto Print off/on, test browser and available agent routes, complete a real
  receipt sale and invoice sale, test refund output, copies, responsive layout,
  and keyboard behavior.
- **Print Module: station-level routing, `print_jobs`, full Local Agent v1,
  label/tag system** — see `docs/print-module/PHASE_1_STORE_LEVEL_ROUTES.md
  §5` and the full blueprint. A dormant `print_routes`/`print_stations`/
  `printer_devices`/`print_jobs` schema already exists in the database from
  an earlier attempt — evaluate adopting it rather than re-designing.
- **Per-item industry attributes on template-rendered receipts** — dropped
  when the legacy renderer was removed; no Designer block type exists yet
  for jewelry purity/weight-style per-item detail lines.
- **Per-transaction duty-free override ("Option B")** — `sales.sales_mode`
  settable per sale (not just per store), with `taxCalculationService.js` /
  `jurisdictionService.getJurisdictionProfile` accepting an override so a
  single sale can be zero-rated in an otherwise-domestic store. Larger change,
  touches the tax engine, needs audit/compliance guardrails. Only worth
  building on an actual tenant request — see the proposal doc §5.
- **Sales Hub glance strip** — the optional "3 repairs ready for pickup / 2
  memos overdue" summary row from the design mockup; would reuse KPI queries
  those pages already compute.
- **Hub tiles deep-linking into "new" modals** — Repair Intake / Old Gold Buy
  / Memo / Layaway / Savings Scheme tiles currently land on the existing
  page's default list view rather than an already-open intake/create modal.
- **Mobile/tablet live verification** — the bento grid's responsive behavior
  (2-col mobile → 4-col desktop) was verified by code review and the
  existing automated tests, not by an actual live screenshot at a
  phone/tablet width (the sandbox's browser automation could not resize the
  rendered viewport independently of the screenshot tool). Worth a manual
  pass on a real device or browser DevTools' device toolbar.
- **Scheduled auto-fetch**: the daily market-rate cron (backend job at configured
  `market_rate_fetch_time`) is not yet wired. Settings are saved; a Node
  `node-cron` job in the backend startup needs to call `marketFetcherService` +
  `publishRates` when `market_rate_auto_publish = 1`.
- **`weight_unit` in store context**: `useLocaleFormat` reads
  `(store as any)?.weightUnit` — the `StoreContext` / `useStore` type should be
  extended to expose `weightUnit` cleanly once settings are confirmed stable.
- **Paytime API** (from iteration 11): build the `/v1/employers` and `/v1/incentives`
  endpoints in the Paytime project.
- **Shopify catalog adapter** (P3 Phase 2): outbox is ready; build adapter on first
  tenant request.
- **Receipt templates**: surface `cost_code` / `show_on_receipt` in print templates.
- **Duty-Free/Export block, template-by-template polish** — the user flagged
  this block's styling as something to revisit "template by template" later;
  only the header-subtitle sizing bug and the declaration/traveller-field
  redesign were fixed in iteration 13, not a full visual pass.

---

## Apply (historical reference)
All files below have been applied. Shown for traceability only.
```bash
# Iteration 1–9 migrations — already in applied/
# Iteration 10:
cd backend && npm run migrate   # (was used to apply 2026-08-10_customer_code.sql)
npm run migrate:status          # confirm nothing pending
```
