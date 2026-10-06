# State-of-the-Art Jewelry Software — Feature Gap & Task List

Benchmarked against 2026 jewelry POS/ERP products (WJewel, Jewel360, ChainDrive,
Luxare, Gem-Logic, GemFind, Synergics). Marks what Zettaz has, partially has, or
is missing, with prioritized tasks. This client does **not** use weight-based
pricing, so metal-rate pricing is optional/off by default but the attribute model
still captures weight/purity for description, valuation and compliance.

Legend: ✅ have · 🟡 partial · ❌ missing

## A. Inventory & item master
- 🟡 **Serialized, per-piece inventory** — each item unique with its own SKU,
  photo, cost, status. *Zettaz uses fungible `stock_quantity`.*
  **P1:** add a per-piece mode (one row per tag) with status
  available/hold/sold/returned; map old `Stock.RowNumber`/`Hold`.
- ✅ Industry attributes (metal, purity, weight, stone, hallmark) — done via
  `products.attributes` (doc 02).
- ❌ **RFID / barcode tag printing & fast physical count.**
  **P2:** tag/label templates + RFID or barcode cycle-count screen.
- ❌ **Certificate / appraisal attachments** (GIA/EGL/AGS, images) per piece.
  **P2:** file attachments on product; store cert no (already a field).

## B. Pricing & billing
- ✅ Non-weight pricing (purchase→cost→selling) + tag cost-code cipher (doc 03).
- 🟡 Optional **metal-rate (weight-based) pricing** for tenants who need it.
  **P3:** `metal_rates` (effective-dated) + line pricing = weight×rate + making +
  stone; store rate snapshot per line. Off for this client.
- ✅ Tax classes/rates, promotions, multi payment modes — already in Zettaz.
- 🟡 **Old-gold / metal exchange** (purity test, live valuation, part-payment,
  re-melt stock entry). **P1 for jewelry vertical:** model buy-back as a credit
  line + re-melt inventory entry with audit trail.

## C. Sales workflows
- ✅ Sales, returns (kept from old system), held orders — present.
- ❌ **Repair & custom-order management** (intake ticket, photos, status,
  customer SMS, chain of custody). **P1:** new `repair_orders` module.
- ❌ **Layaway / installment plans** (schedule, part-payments, financing).
  **P2:** `layaway_plans` + payment schedule.
- ❌ **Memo / consignment** (memo-in from vendors, memo-out to customers, due
  dates, aging, partial returns) — kept distinct from owned stock.
  **P2:** `memo` ledgers.

## D. Customers & CRM
- ✅ Customers, contacts, activity log — present.
- 🟡 **CRM depth**: purchase history, wish lists, birthday/anniversary reminders.
  **P2:** wishlists + reminder scheduler (ties to existing notifications).
- ❌ **Savings/gold schemes** (customer instalment schemes, scheme redemption).
  **P3 for markets that use them.**

## E. Compliance & finance
- 🟡 **Hallmark/HUID + HSN** captured as attributes; **P2:** validation & report.
- ❌ **Purity/karat-wise stock valuation report** (by metal & purity).
  **P2:** reporting query over `attributes`.
- ✅ Audit logs, RBAC, subscriptions — strong already.

## F. Operations
- ✅ Multi-store, multi-tenant, receipt printing (ESC/POS), dashboards, reports.
- 🟡 **Employee performance/incentives** — module added (doc 04); needs UI + POS
  attribution. **P1.**
- ❌ **E-commerce / catalog sync** (website, marketplace feeds). **P3.**

## Build status (updated 2026-08-10)

**P1 — complete.** Serialized inventory ✅ · old-gold exchange ✅ · repair orders ✅ ·
employee performance UI + POS attribution ✅ · POS piece auto-sell + voucher
redemption wired ✅.

**P2 — complete.** Memo/consignment ✅ · layaway ✅ · certificate & photo
attachments ✅ · purity-wise valuation report ✅.
*Still open:* RFID/tag printing and CRM wishlists/anniversary reminders (tracked
below; out of scope until a tenant requests them).

**P3 — complete.** Metal-rate pricing engine ✅ (opt-in, off by default) ·
savings schemes ✅ · e-commerce catalog sync ✅ (platform-agnostic outbox
foundation; platform-specific adapter to be built on first tenant request).

**Post-roadmap additions (iteration 10):**
- Human-friendly customer codes ✅ (`CU-000123`; UUID stays internal).
- Production migration runner ✅ (`npm run migrate` from `backend/`).
- Blank sidebar menu fix ✅ (3 root causes resolved in `Sidebar.tsx` and
  `useIndustry.ts`).
- All 15 database migrations applied ✅.

**Iteration 11 additions (2026-08-13):**
- Barcode/RFID tag printing ✅ (Zebra ZPL, TSC/Godex, browser PDF; user-selectable in Settings → Printer).
- Cycle-count page ✅ (scan barcodes to reconcile serialized stock; CSV export).
- CRM wishlists ✅ (per-customer wishlist with inline product picker, drawer UI).
- Birthday/anniversary reminders ✅ (dashboard widget, dob + anniversary fields per customer).
- Repair order photo uploader ✅ (drag-and-drop inline in repair rows).
- Paytime Zettaz UI ✅ (Settings → Paytime tab, push-incentive button per employee).

**Iteration 12 additions (2026-08-15):**
- Serialized Inventory full rewrite ✅ — cross-product search, KPI strip, PieceDrawer (view + edit), AddPiecesModal (single + bulk), bulk label print, inline status change.
- DB collation fix ✅ — `product_pieces` / `product_piece_sequences` rebuilt with correct `utf8mb4_0900_ai_ci`; idempotent fix migration for existing installs.
- Memo & Consignment full overhaul ✅ — backend transition guards, partial-return piece-liberation fix, `?q=` search, edit endpoint; frontend: KPI strip, piece-linked item entry, per-item return inputs, print Thermal Slip + A4 Acknowledgement.
- Metal Rates — goldapi.io market rate integration ✅ — MarketFetchPanel with preview + publish; Settings panel extended with weight unit, API key, premium %, auto-publish toggle, fetch time.
- Weight-unit localization ✅ — `formatWeight` + `weightUnitLabel` in `useLocaleFormat`; applied to SerializedInventory, Memo, OldGold, and MetalRates pages.

**Iteration 13 additions (2026-08-25):**
- Clean invoice template rollout ✅ — `invoice` and `jewelry_invoice` DEFAULT_BLOCKS
  redesigned (13/14 blocks), applied in place to already-provisioned tenants via a
  reviewed backfill script; page footer now pinned to the bottom of every page
  instead of floating mid-document.
- `/reset-defaults` bug fix ✅ — resetting a template to current defaults no longer
  silently drops a Duty-Free Invoice's traveller fields (`blocksForReset` carries
  the `dutyFree` block's visibility forward).
- Header/subtitle font-size bug fix ✅ — a block's title-size config no longer
  inflates/wraps the subtitle line beneath it (was the cause of the "Emp: Marcus
  Hill" wrapping on the Duty-Free Invoice header).
- Duty-Free/Export block redesign ✅ — the export declaration now prints from the
  jurisdiction-driven `compliance` block instead of being hardcoded into the
  traveller-details block; traveller ID and travel method are now store-configurable
  (Passport/National ID/Seaman's Book; Flight/Vessel) rather than assuming every
  duty-free traveller flies in on a passport — added for Caribbean cruise-ship
  traffic. Backward compatible with every already-provisioned template and sale.

**Iteration 14 additions (2026-08-25):**
- Sales Hub ✅ — jewelry-only `/sales-hub` landing screen (additional sidebar
  entry, `/pos` unchanged), tile grid to New Sale, Duty-Free Sale, Repair
  Intake, Old Gold Buy, Memo In/Out, Layaway Payment, Savings Scheme Payment,
  Sales Return. Closes the POS/checkout capture gap flagged as pending after
  iteration 13: `DutyFreeIntakeModal` now captures traveller ID + travel
  method (Passport/National ID/Seaman's Book; Flight/Vessel/Other) before the
  item grid, threaded through `CartContext` and persisted on the sale.
- Duty-free zero-rating fix ✅ — found that `calculateSaleTaxesWithJurisdiction`
  (the jurisdiction-aware, zero-rating tax function, already unit-tested) had
  zero callers in the real sale-creation path; a store configured
  `sales_mode = duty_free` never actually charged $0 tax on a real sale, only
  on print fixtures. `createSaleController.js` now resolves the store's
  jurisdiction server-side and forces `tax = 0` for `duty_free`/`export`
  stores; `sales_mode`/`zero_rate_reason` are frozen onto the sale row at
  creation. Confirmed with the user before building (this was outside the
  originally-scoped "Option A: capture UI only" — see the proposal doc §5 and
  `06_Implementation_Changelog.md` iteration 14 for the full reasoning).

**Iteration 15 additions (2026-08-25):**
- Sales Hub fullscreen redesign ✅ — `/sales-hub` moved to a standalone
  fullscreen route (same treatment as `/pos`, no admin sidebar/topbar),
  rebuilt with a store-branded header (tenant logo or lettermark fallback,
  live clock/date), a role-aware user menu (Dashboard hidden for cashiers),
  a greeting, and a responsive tile grid (`grid-cols-1` up to
  `xl:grid-cols-4`). Verified live against a demo tenant.
- Role-based post-login landing ✅ — `Login.tsx`'s `getRedirectPath` now sends
  a non-admin, `sales.create` user to `/sales-hub` instead of `/pos` when the
  tenant's industry is jewelry (every other industry unaffected); fails open
  to `/pos` if the industry lookup fails. This is the only place in the app
  that decides a post-login destination.

**Iteration 16 additions (2026-08-25):**
- Sales Hub bento/chromeless redesign ✅ — researched 2026 bento-grid,
  chromeless-navigation, and search-first UI patterns
  (`13_POS_Hub_Proposal.md` §10–11) and rebuilt the Hub again: removed the
  `<header>` entirely (store branding/clock/user-menu now scroll with the
  page), added a time-of-day gradient mesh background, replaced the uniform
  tile grid with an asymmetric bento layout (New Sale/Duty-Free as large
  hero tiles, the other six as uniform small tiles), and added a live
  inline search field that filters the grid as you type. Verified live
  against a demo tenant; 618/618 frontend tests still passing.

**Iteration 16.1 additions (2026-08-25):**
- Sales Hub refinement after design approval ✅ — removed the live search
  field (all tiles already fit on-screen), shrank the greeting to a small
  label, fixed the tenant logo to resolve through `normalizeImageUrl()`
  (previously used the raw, possibly-relative `store.logoUrl` directly, so
  a real uploaded logo could silently fail to load), and added back a
  single right-aligned "Zettaz Cloud · Version" footer. Verified live
  against a demo tenant; `SalesHubPage.test.tsx` 11/11 passing.

**Iteration 16.2 additions (2026-08-25):**
- Duty-Free intake: customer capture folded in ✅ — `DutyFreeIntakeModal`
  rebuilt as a two-column screen (Customer required + selectable/quick-add
  on the left, Traveller ID/Travel Method on the right); Continue now sets
  both the customer and the traveller context on the cart before landing on
  `/pos`, so the separate POS "Select Customer" step is no longer needed for
  a duty-free sale. Shared the `CustomerHit → Customer` conversion between
  `POSScreen.tsx` and the new intake screen via
  `mapCustomerHitToCustomer()`. Verified live; 619/619 frontend tests
  passing.

**Iteration 16.3 additions (2026-08-25):**
- Duty-Free customer capture, round 2 ✅ — new-customer creation deferred
  from its own inline button to the single "Continue to Sale" click
  (`createCustomer()` now only runs inside `handleContinue`, together with
  the cart updates and `/pos` navigation); existing-customer match now
  renders as a labeled card (Name/Code/Type/Phone/Email/Address) instead of
  a compact chip; the search box stays live above an open new-customer
  draft so a cashier can still switch to an existing match; Departure Date
  moved from a native `<input type="date">` to `components/ui/DatePickerInput`
  (tenant `dateFormat`, capped 4-digit year — fixes the reported 6-digit
  year bug). Verified live; 621/621 frontend tests passing.

**Iteration 16.4 additions (2026-08-25):**
- Duty-Free intake: traveller details actually enforced as mandatory ✅ —
  fixed a bug where "Continue to Sale" proceeded even with every traveller
  field (ID Number, Issuing Country, Flight/Vessel/Reference, Destination,
  Departure Date) left blank. `handleContinue` now validates the customer
  and traveller sides together, surfacing both required-field messages at
  once and blocking before a customer is created if either is incomplete.
  Required fields carry a red asterisk and highlight red live on a blocked
  attempt. Verified live; 622/622 frontend tests passing.

**Pending:**
- Per-transaction duty-free override ("Option B" in
  `13_POS_Hub_Proposal.md`) — `sales_mode` is still store-level only; no way
  yet to ring one duty-free sale inside an otherwise-domestic store. Deferred
  until a tenant needs mixed-mode selling.
- Sales Hub glance strip (repairs ready for pickup / memos overdue) from the
  Hub design — not yet built.
- Sales Hub mobile/tablet live verification — responsive breakpoints were
  verified by code review and automated tests, not an actual phone/tablet
  screenshot.
- Duty-Free/Export block visual polish, template by template — only the sizing
  bug and the declaration/traveller-field redesign were addressed; a fuller
  visual pass was explicitly deferred.
- Scheduled auto-fetch cron — `node-cron` job to call `marketRateFetcherService` +
  `publishRates` at the configured `market_rate_fetch_time` when `market_rate_auto_publish = 1`.
- `weight_unit` typing in `StoreContext` — currently read as `(store as any)?.weightUnit`; should be a typed field once confirmed stable.
- Paytime application side — mount the Paytime project to add the API endpoints
  (`GET /v1/employers/:id/employees`, `POST /v1/incentives`).
- Shopify / platform catalog adapter (P3 Phase 2; outbox is ready — build when tenant asks).
- Receipt template: surface `cost_code` / `show_on_receipt` fields (tag-only for now, by design).

See `06_Implementation_Changelog.md` for the file-level detail.

## Sources
- [WJewel — Jewelry POS System Guide (2026)](https://www.wjewel.com/blog/jewelry-pos-system-guide.php)
- [Jewel360 — Best Jewelry Store POS Systems](https://jewel360.com/blog/best-jewelry-store-pos-systems)
- [AppIntent — 6 Best Jewelry Store POS Software 2026](https://www.appintent.com/software/point-of-sale/retail/jewelry-store/)
- [ChainDrive — Jewelry Store Management Software](https://www.chaindrive.com/jewelry-store-management-software)
- [Luxare — Jewelry POS Software](https://www.luxare.com/retail/jewelry-pos-software)
- [Gem-Logic — Jewelry POS System](https://www.gem-logic.com/jewelry-pos-system)
- [Synergics — 20 Must-Have Features in Modern Jewellery ERP](https://www.synergicssolutions.com/20-must-have-features-in-modern-jewellery-erp-software)
- [GemFind — Best Jewelry POS System 2026](https://gemfind.com/blogs/digital-marketing/best-jewelry-pos-system)
- [BCSS — Jewelry Consignment Software](https://www.bestconsignmentshopsoftware.com/jewelry-consignment-software.htm)
