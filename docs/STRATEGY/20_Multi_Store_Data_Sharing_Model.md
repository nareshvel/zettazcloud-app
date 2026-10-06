# Multi-Store Data Sharing Model — Plan Document

Status: **Phase 1 complete (2026-09-06). Phase 2 code-complete (2026-09-08)
across the full lifecycle** — table, service, backfill (already run by the
user), checkout, product list/detail, stock adjustment, GRN receiving, sales
returns, sale-deletion reversal, mutual-exclusivity, and both frontend UIs
(create-a-shared-product, per-store pricing view, store-creation catalog
choice) are all done. Several genuinely missing pieces were found and fixed
along the way that the original plan hadn't anticipated: there was no way to
create a shared product at all, the store-scoped product list silently
excluded shared products entirely, a new store didn't get any of the
existing shared catalog by default, and GRN/returns/sale-deletion all wrote
stock changes to the wrong place for a shared product. Per explicit
product-owner direction (2026-09-08), cost/price data is never tenant-wide:
`weighted_average_cost` and `total_quantity_received` were moved onto
`store_product_listings` and are now tracked strictly per store, same as
`stock_quantity` — a shared product only shares its identity/details, never
its cost or price basis, unless a store deliberately leaves its price
override blank to inherit the base selling price. Per further product-owner
direction (2026-09-08), **sharing is now the default, not opt-in**: a new
product is shared across all stores unless the user checks "Restrict to
this store only" at creation; the friction of opting in per product was
judged not worth it. To balance that, any store can "unlist" a shared
product it doesn't want to sell via a per-store toggle on the product's
Store Pricing & Stock section — this hides it from that store's product
list/inventory without affecting any other store or the product itself.
**What's still open**:
only the outbound catalog-sync feed, on hold at the product owner's request
(catalog sync has no live adapter wired up yet, and exporting a shared
product needs a not-yet-made decision about which store's price/stock to
publish). The dashboard/reports stock figures were audited and fixed.
**No live manual test has been run on any of this** — everything has
only been verified via `node -c` / `tsc --noEmit`, not against a real
database with real sales/GRNs/returns. §6's open questions were answered by
the product owner (see inline answers below); Phase 1 (tax/offer sharing +
store-creation provisioning) is implemented and verified via `node -c`, and
the user has since run its migration. Update the task checkboxes and this
status line as further phases land, the same way
`18_Plan_Limits_Enforcement.md` and `19_Store_Creation_And_Switching.md` were
tracked.

Related documents: `19_Store_Creation_And_Switching.md` (store creation/switching,
soft-delete, default store — already built), and the industry-per-store audit
findings summarized in §8 below (not yet written up as its own doc — folded in
here since the two problems are adjacent).

---

## 1. Why

Two related questions triggered this work:

1. When a Tenant Admin creates a new store, what data should that store start
   with — a blank slate, or something copied/shared from the tenant or from an
   existing store? Specifically: should customers be shared? Should products be
   shared? If products are shared, can each store set its own price and track
   its own stock independently, or does "shared" mean literally the same row
   (same price, same stock count) for every store?
2. Separately (but architecturally connected): each store in a tenant can
   in principle be a different business type and a different country. Is the
   data model actually ready for that?

A full audit (see §7 and §8) found the codebase already has **three different,
inconsistent conventions** for "is this store-specific or shared," used across
different modules without a documented rule for which convention a new module
should follow. This document proposes collapsing that down to **one consistent
convention**, applies it concretely to fix the products/pricing/stock gap (the
sharpest real gap found), and lays out a provisioning flow for new stores.

---

## 2. The core design decision: one sharing convention, not three

### 2.1 What exists today (audit summary — see §7 for full detail with citations)

| Convention | Meaning | Used by |
|---|---|---|
| **Optional `store_id`, used as an ownership toggle** | `NULL` = shared/tenant-wide row, a value = that row belongs to exactly one store and no other store can see or use it | `products`, `product_pieces`, `layaway_plans`, `memo_transactions`, `savings_scheme_enrollments`, `repair_orders`, `old_gold_purchases`, `print_templates` |
| **Mandatory `store_id`** | Every row must belong to exactly one store; no tenant-wide/shared version can exist at all | `tax_classes`, `tax_class_rates`, `promotional_offers`, `offer_rules`, `offer_price_tiers`, `offer_usage` |
| **No `store_id` column at all** | Hardcoded tenant-wide, no way to ever make it store-specific | `customer_wishlist_items` (CRM), `savings_scheme_plans` |
| **Optional `store_id` used as a true base+override** | `NULL` row = tenant-wide default; a specific-store row *overrides* the default for that one store only, while the default still applies to every other store | `metal_rates` only |

The fourth row — `metal_rates` — is the pattern that actually answers the
product owner's question ("products shared, pricing/stock can vary"), and it's
already proven out in one module. The other three conventions are all missing
something: the ownership-toggle pattern can't express "shared record, per-store
price"; the mandatory pattern can't express "share this across stores that
don't need to differ"; and "no column at all" can't express per-store variation
even when a tenant eventually needs it.

### 2.2 The target convention

**Adopt the `metal_rates` base+override pattern as the one convention going
forward**, applied via a consistent naming/shape pattern:

- A tenant-wide **definition/identity** table holds the thing itself (a
  product's name/SKU/description, a tax class's name/rules, a wishlist item).
- A store-scoped **override/instance** table (new, one per module that needs
  it) holds the fields that are allowed to vary per store — nullable meaning
  "inherit the tenant default," non-null meaning "this store's value wins."
- Fields that must **never** be shared (physical stock count is the clearest
  example — two stores cannot share one stock number without risking
  overselling) live *only* in the store-scoped table, with no tenant-wide
  fallback concept at all.

This doesn't require ripping out today's `store_id` columns on
`products`/`product_pieces`/etc. — a store-owned product (e.g. a one-of-a-kind
jewelry piece that will only ever be sold from one location) keeps working
exactly as it does today by setting `store_id` on the product row directly.
The new mechanism is additive, for the *shared-catalog-with-per-store-variance*
case that doesn't exist yet.

---

## 3. Concrete design: products, pricing, and stock

This is the sharpest, most immediately useful piece of the whole plan.

### 3.1 Today

- `products.price` — one column, one value, no per-store variant.
- `products.stock_quantity` — one column, one value, no per-store variant.
- `products.store_id` — nullable. `NULL` means literally the same row (same
  price, same stock number) is visible to every store in the tenant. A
  non-null value means the product belongs to exactly one store and no other
  store can see it, sell it, or report on it as "the same SKU."

Consequence: there is no way today to have one catalog item that Store A sells
at $50 and Store B sells at $55, while each store's stock is counted
independently. A tenant-wide product pools stock across every store (real risk
of overselling if two stores' registers decrement the same counter), and a
store-owned product has no relationship to "the same item" anywhere else.

### 3.2 Target

Split **catalog identity** from **store listing**:

- `products` stays the tenant-wide catalog: SKU, name, description, images,
  category, industry-specific attributes (purity, weight, metal type, etc.),
  and a `base_price` (rename of today's `price`, still required — this is the
  tenant-wide default/fallback price).
- New table **`store_product_listings`**:
  - `id` (uuid, pk)
  - `tenant_id` (denormalized for query convenience + row-level scoping,
    matches convention elsewhere in the schema)
  - `store_id` (not null — every row here belongs to exactly one store)
  - `product_id` (not null, FK to `products.id`)
  - `price` (nullable decimal — `NULL` means "inherit `products.base_price`";
    a value overrides it for this store only)
  - `stock_quantity` (int, not null, default 0 — **always store-specific,
    never inherited, no tenant-wide fallback concept**; this is the field that
    closes the overselling risk)
  - `is_active` (tinyint, default 1 — lets a store choose not to carry a
    catalog item without deleting the shared record or affecting other
    stores)
  - `cost_price_override` (nullable decimal — optional, for a store that
    sources the same item at a different cost)
  - `created_at`, `updated_at`
  - Unique key on `(store_id, product_id)` — one listing row per store per
    product.

A product that should be **store-owned only** (never shared) keeps using
`products.store_id` exactly as today — no listing row needed, no change to
existing behavior. A product that should be **shared with per-store
price/stock** has `products.store_id = NULL` and gets one
`store_product_listings` row per store that carries it.

### 3.3 What has to change to support this

- **Backend**: every read path that currently does `SELECT price,
  stock_quantity FROM products WHERE id = ?` for a POS sale, stock check, or
  product listing needs to become store-aware: resolve the effective price as
  `COALESCE(listing.price, product.base_price)` and the effective stock as
  `listing.stock_quantity` (or 0 / "not carried" if no listing row exists for
  a shared product not yet added to that store's assortment). This touches:
  `productController`/`products.routes.js` (list/detail), the POS
  cart/checkout path (`createSaleController.js`'s stock-deduction
  transaction — this now needs to decrement `store_product_listings.
  stock_quantity`, not `products.stock_quantity`, for shared products),
  `stock_adjustments` writes, cycle count, and the Serialized Inventory
  module's non-serialized-product code paths.
- **Frontend**: the product list/edit pages need a per-store price/stock
  view when a product is shared (e.g. a "Store pricing" tab or table showing
  every store's effective price/stock with an override toggle), instead of
  today's single price/stock field.
- **Migration/backfill**: every existing store-owned product (`store_id` set)
  needs no migration — untouched. Every existing tenant-wide product (`store_id
  = NULL`) needs exactly one `store_product_listings` row created per
  accessible store, with `price = NULL` (inherit) and `stock_quantity` seeded
  from the current `products.stock_quantity` value **for the first store
  only** (to avoid silently multiplying stock counts across stores on
  migration day) — this needs an explicit product-owner decision at
  migration time, not a default the migration script should choose silently.
  See open question in §6.

---

## 4. Tax classes and promotional offers: soften "mandatory" to "optional with override"

### 4.1 Today

`tax_classes`, `tax_class_rates`, `promotional_offers`, `offer_rules`,
`offer_price_tiers`, and `offer_usage` all have `store_id NOT NULL`. A tenant
with five stores that all use identical tax rules has to define the same tax
class five separate times, once per store, with no way to define it once and
have it apply everywhere.

### 4.2 Target

Make `store_id` nullable on `tax_classes` and `promotional_offers` (the two
"parent" tables — their child tables `tax_class_rates`/`offer_rules`/etc.
follow the parent's scope and don't need their own nullable column):

- `store_id = NULL` → tenant-wide default, applies to every store that
  doesn't have its own override.
- `store_id = <uuid>` → applies to that store only, and (for tax classes)
  should be treated as *replacing* the tenant default for that store rather
  than adding to it — a store in a genuinely different tax jurisdiction
  shouldn't also inherit the tenant-wide class list.

This directly serves the "different country per store" case from the earlier
audit: a US store and a French store under one tenant can each define their
own tax classes as overrides, while stores that share a tax regime don't
redefine anything.

---

## 5. Store creation / provisioning flow

### 5.1 Today

`POST /api/stores` (`backend/routes/store.routes.js`) inserts exactly one row
into `stores` and returns it. Nothing else is created: no default tax class,
no print templates (even though `templateProvisioningService` already exists
and is used elsewhere in the codebase — it's just never invoked from store
creation), no product listings, no print/document settings.

### 5.2 Target

Add an explicit provisioning step, run inside the same transaction as store
creation (or immediately after, with clear error surfacing if a step fails —
a partially-provisioned store is confusing, so failures here should be loud,
not silent):

1. **Print templates** — call the existing `templateProvisioningService` for
   the new store, exactly as the manual backfill script
   (`provision-missing-print-templates.js`) does for existing tenants. This
   closes a real, already-possible gap (a new store with no published
   receipt template will hit the "clear thrown error" behavior described in
   Print Module Phase 1 the first time someone tries to check out).
2. **Print/document settings** — seed `print_document_settings` with sane
   defaults (receipt delivery = browser, enabled) so Printer Settings isn't
   blank on day one.
3. **Product catalog** — present the Tenant Admin with an explicit choice at
   store-creation time (this needs to be a UI step, not a silent default):
   - **Start empty** — no `store_product_listings` rows created; the store's
     assortment is built up manually or via bulk import.
   - **Copy every shared product's listing from an existing store** — creates
     one `store_product_listings` row per tenant-wide product, with a chosen
     pricing strategy: same price as the source store, a flat percentage
     markup/discount, or "inherit tenant base price" (i.e. all listings
     created with `price = NULL`). Stock is **never** copied — it always
     starts at 0 for a new store regardless of which option is picked, since
     physical stock can't exist in two places at once.
4. **Tax classes** — if the tenant already has tenant-wide (`store_id = NULL`)
   tax classes, nothing to do — they already apply. If the tenant's tax
   classes are still store-specific (pre-migration tenants, see §4), prompt
   whether to copy an existing store's tax class set as a starting point for
   the new store.

---

## 6. Open questions requiring a product decision before implementation

These are genuine decisions, not implementation details — flagging them now
rather than having an agent guess mid-migration:

1. **Backfill stock for existing tenant-wide products**: when
   `store_product_listings` is introduced, every currently-shared product
   needs stock assigned to *some* store (stock can't stay on the tenant-wide
   `products` row once the split happens, or the whole point of per-store
   stock tracking is undermined). Does existing stock move to the tenant's
   **default store** exclusively (every other store starts at 0 and stock
   must be manually transferred/rebalanced), or does the product owner want a
   different one-time allocation rule?
   answer: No, stocks are purely store specific and cannot be shared across stores. it comes through the GRN or stock adjustment or anyother implementation.
2. **Should `products.store_id` (store-owned) and `store_product_listings`
   (shared-with-listings) be mutually exclusive, enforced at the database or
   application layer?** i.e. can a product ever be both "owned by Store A"
   and also have a listing row for Store B? The design above assumes no —
   store-owned products never get listing rows — but this should be an
   explicit constraint (a check constraint or application-level validation),
   not just convention.
   answer: you can suggest me the best option here.
   **Recommendation (decided, not yet implemented — Phase 2)**: enforce this
   at the application layer, not the database layer. MySQL `CHECK`
   constraints can't reference another table, so a true DB-level constraint
   would need a trigger, which is fragile and easy to forget when adding new
   write paths. Instead: (a) the API that creates/updates a
   `store_product_listings` row rejects the write if `products.store_id` is
   set and doesn't equal the listing's `store_id`; (b) the API that sets
   `products.store_id` to a specific store rejects the change if listing rows
   already exist for any *other* store. In addition, add a periodic
   integrity-check script (same pattern as
   `backend/scripts/purge-expired-stores.js`) that scans for and reports any
   product that violates this rule, as a safety net against a future write
   path that forgets the check — surfaced to the Tenant Admin, not silently
   auto-corrected.
3. **Tax class override semantics**: when a store has its own tax class
   override, should it *replace* the tenant-wide list for that store
   entirely, or *add to* it? The design above assumes replace (a French
   store shouldn't also see US tax classes as options), but this needs
   confirmation.
   answer: Yes, replace.
4. **Promotional offers spanning multiple (but not all) stores**: this
   document only proposes "tenant-wide vs one specific store." A tenant
   might eventually want "this offer applies to these 3 of my 5 stores" —
   out of scope for this phase, flagged for later if needed (would require a
   join table like `offer_stores` rather than a single nullable `store_id`).
   answer: you can choose the best option
   **Recommendation (decided, not yet implemented — deferred to Phase 4)**:
   don't build the `offer_stores` join table now — YAGNI until a tenant
   actually asks for "applies to these 3 of my 5 stores." The nullable
   `store_id` (tenant-wide vs one specific store) built in Phase 1 covers the
   large majority of real cases. If/when the subset case is actually needed,
   add an `offer_stores(offer_id, store_id)` join table used only when an
   offer needs to target more than one but not all stores, leaving the
   existing nullable `store_id` column's meaning (NULL = all stores, a value
   = exactly one store) unchanged for every offer that doesn't need the
   subset case — purely additive, no migration risk to existing data.
5. **CRM wishlist/reminders**: left tenant-wide in this plan (no `store_id`
   added) since nothing in the audit suggested a need to scope them per
   store. Confirm this is still correct before closing this document out.
   answer: Yes, it should be tenant-wide.

---

## 7. Audit reference: what exists today, by module (with citations)

Full detail from the research pass, kept here for reference so the "why" behind
§2's table doesn't get lost:

| Module | Table(s) | `store_id` | Sharing today |
|---|---|---|---|
| Products | `products` | nullable | Ownership toggle — see §3.1 |
| Stock | (column on `products`) | n/a | Single global number, not a separate per-store table |
| Serialized pieces | `product_pieces` | nullable | Ownership toggle, same pattern as products |
| Customers | `customers` | nullable | Tenant-wide by convention (almost always NULL in practice) |
| Tax classes | `tax_classes`, `tax_class_rates` | **not null** | Always store-specific, no sharing possible |
| Promotional offers | `promotional_offers`, `offer_rules`, `offer_price_tiers`, `offer_usage` | **not null** | Always store-specific, no sharing possible |
| Metal rates | `metal_rates` | nullable | **True base+override** — the target pattern |
| Users/roles | `user_roles` | nullable, with `scope enum('tenant','store')` | Already flexible, working as designed |
| Print templates | `print_templates` | nullable, real FK to `stores.id ON DELETE CASCADE` | Ownership toggle, same pattern as products |
| CRM wishlists | `customer_wishlist_items` | **column doesn't exist** | Hardcoded tenant-wide |
| Layaway/Memo/Savings enrollments/Repairs/Old gold | respective tables | nullable | Ownership toggle (optionally store-scoped transactional records) |
| Savings scheme *plan definitions* | `savings_scheme_plans` | **column doesn't exist** | Hardcoded tenant-wide (enrollments against a plan are store-scoped, the plan itself isn't) |
| `POST /api/stores` | `backend/routes/store.routes.js` | — | Creates one `stores` row only; provisions nothing else (see §5.1) |

---

## 8. Related, adjacent gap: industry-per-store (not this document's primary scope)

A separate audit (see conversation history / to be written up formally if this
work is picked up) found that `stores.industry_code` already exists as a
column with a working store-aware service (`retailProfileService`), but every
actual gate (`industryFieldService`, `requireIndustry` middleware, the
frontend's `useIndustry`/`IndustryRoute`) resolves industry at the **tenant**
level only, and the Business Type save path on the Profile page actively
overwrites every store back to the same industry on every save
(`industry.routes.js`'s bulk `UPDATE stores SET industry_code = ? WHERE
tenant_id = ?`). If a tenant ever needs Store A to be jewelry and Store B to
be general retail, this needs its own phase of work: stop the destructive
bulk-overwrite, thread `storeId` through the field-resolution chain, and
decide how `tenant_field_overrides`/`tenant_cost_code_settings` (currently
tenant-keyed only) should key by store when industries diverge. Not required
for the sharing-model work in this document, but likely the next logical
phase after it, since a shared-catalog product's field schema (which fields
even apply to it) depends on resolving industry correctly per store.

Also flagged, not part of this document's scope but should be fixed
independently and soon: `reportsService.js`'s cross-store dashboard/report
aggregation does a raw `SUM()` with no currency conversion — already exploitable
today since the schema already permits stores with different currencies under
one tenant.

---

## 9. Task list

### Phase 1 — Foundation (schema + tax/offer sharing, lowest risk) — ✅ DONE 2026-09-06
- [x] Migration: add `store_id CHAR(36) NULL` to `tax_classes` and
      `promotional_offers` (idempotent, per `database/README.md` convention);
      leave existing rows' `store_id` untouched (they stay store-specific
      overrides by default — nothing breaks for existing tenants).
      `database/migrations/2026-09-06_tax_offers_store_id_nullable.sql` —
      **not yet applied; run `npm run migrate:status` then `npm run migrate`.**
- [x] Update tax-calculation and offer-lookup services to resolve
      `store_id = NULL` rows as the tenant-wide default, falling back to them
      when no store-specific row exists, and to REPLACE (not merge with) the
      tenant defaults when the store has any of its own rows, per §6 Q3.
      `backend/services/taxCalculationService.js`'s `getTaxClassesWithRates`
      and `backend/services/promotionEngine.js`'s `computePromotions`.
      (`taxCalculationService.js` already had the `OR store_id IS NULL`
      fallback query; `promotionEngine.js` had neither the fallback nor the
      replace logic and needed both added.)
- [ ] Frontend: Tax Classes and Promotional Offers settings pages get a
      "applies to: All stores / This store only" toggle. **Not yet built** —
      the backend now supports tenant-wide rows, but there's no UI control
      yet to actually create one (existing settings screens always write a
      specific `store_id`). Needed before this is usable end-to-end.
- [x] Wire `templateProvisioningService` into `POST /api/stores`
      (`backend/routes/store.routes.js`) — calls
      `provisionStoreTemplates(tenantId, id, { replace: false, publish: true })`
      after the store row is created, non-blocking on failure (logged, not
      thrown) so a provisioning hiccup doesn't fail store creation itself.
- [x] Seed default `print_document_settings` on store creation — inserts
      `receipt`/`invoice` rows with `delivery_mode='browser'`, `enabled=1`,
      `template_id` left NULL (resolved later via the existing is_default/
      route-resolution fallback rather than requiring provisioning to finish
      first). Same file, same non-blocking error handling.
- [x] Verified: `node -c` on `store.routes.js`, `taxCalculationService.js`,
      `promotionEngine.js`. **Not yet done**: a live manual test (create a
      store, confirm it gets templates + print settings automatically;
      confirm a tenant-wide tax class/offer actually resolves for a store
      with no override, and that a store with its own override no longer
      sees the tenant-wide ones) — do this after running the migration.

### Phase 2 — Product/pricing/stock split (the core of this document)
- [x] Migration: create `store_product_listings` table (§3.2 schema) —
      `database/migrations/2026-09-07_store_product_listings.sql`. `price`
      nullable (NULL = fall back to `products.price`), `stock_quantity NOT
      NULL DEFAULT 0` (never shared/copied, per Q1's answer — stores start
      empty and stock via GRN/adjustment), `UNIQUE(store_id, product_id)`.
      Deliberately did NOT rename `products.price` → `base_price` — no call
      sites have been touched yet, so there is nothing to compatibility-read
      against; revisit only if/when a rename is actually needed.
- [x] Service: `backend/services/storeProductListingService.js` —
      `getListing`, `getListingsForStore` (join against shared products),
      `upsertListing`, `adjustStockForUpdate(conn, ...)` (row-locking,
      transaction-participating, mirrors the `SELECT ... FOR UPDATE` pattern
      `createSaleController.js` already used for store-owned products), and
      `resolveEffectiveProduct` (read-side convenience: store-owned product →
      its own columns, shared product → its listing row for this store).
- [x] Backend: POS checkout stock deduction (`createSaleController.js`,
      the `stockItems` loop) now branches on `products.store_id === null` —
      shared products decrement `store_product_listings.stock_quantity` via
      `adjustStockForUpdate` inside the sale's existing transaction; the
      `stock_adjustments` audit row is written either way. Verified with
      `node -c`. **Not yet done**: an actual manual sale against a shared
      product with a real `store_product_listings` row (needs the backfill
      step below first, since a shared product has zero listing rows until
      one is created).
- [x] Backfill script: `backend/scripts/backfill-store-product-listings.js`
      (`npm run backfill:store-listings:dry` / `npm run backfill:store-listings`).
      For every tenant-wide product, inserts one `store_product_listings` row
      per active (non-deleted) store that doesn't already have one — price
      NULL (inherit), stock 0. Idempotent (`INSERT IGNORE`). **The user has
      run this once already** (2026-09-07, applied against `digitpulse_zcloud`)
      after running the table migration.
- [x] Store creation now auto-provisions listings too — `POST /api/stores`
      inserts a `store_product_listings` row for every existing shared
      product for the brand-new store immediately (stock 0), so a new store
      never needs the backfill script re-run just for itself. Opt out via
      `catalogSharing: 'empty'` in the request body (see the Phase 3 item
      below — this is also exposed as a checkbox in `CreateStoreModal.tsx`).
- [x] Product creation can now actually produce a shared product — **this
      was a real gap found while implementing this phase, not anticipated by
      the original plan**: `POST /api/products` always defaulted
      `store_id` to the requesting user's own store, so there was previously
      no way to create a `products.store_id IS NULL` row at all through the
      UI or API. Fixed: `ProductFormModal.tsx` gained a create-time-only
      "Share across all stores" checkbox (mirrors the tax-class/offer
      pattern — not editable after creation); it sends
      `share_across_stores: true`, which `product.routes.js`'s POST handler
      reads to force `store_id = NULL` and then provisions a
      `store_product_listings` row for every active store (the creating
      store gets the entered initial stock; every other store starts at 0).
- [x] Backend: mutual-exclusivity (open question #2) — resolved at the
      application layer as recommended: `storeProductListingService.
      upsertListing` now looks up the product's own `store_id` first and
      throws if it's not NULL (store-owned products can never get a listing
      row). The reverse direction (setting `products.store_id` on a product
      that already has listings) was checked and found to be a non-issue —
      `PUT /api/products/:id` does not accept or write `store_id` at all, so
      a product's store-owned/shared status is immutable after creation
      through every existing code path; no additional guard was needed.
- [x] Backend — call sites updated to resolve effective price/stock for
      shared products through `store_product_listings` instead of reading
      `products.price`/`stock_quantity` directly:
      - `GET /api/products` and `GET /api/products/:id` (`product.routes.js`)
        — previously a store-scoped product list **excluded shared products
        entirely** (`WHERE p.store_id = ?`), which was a second real gap
        found during this work, not just a missing price/stock resolution.
        Fixed to `WHERE p.store_id = ? OR p.store_id IS NULL` with a
        `LEFT JOIN store_product_listings` for the requesting store; the
        response now includes `isSharedProduct` and `basePrice` alongside
        the resolved effective `price`/`stockQuantity`.
      - `inventoryService.getProducts` — same fix (had the identical
        `WHERE p.store_id = ?` exclusion bug), same join, results annotated
        with the resolved price/stock.
      - `PATCH /api/products/:id/stock` (stock adjustment) — branches on
        the product's `store_id`; a shared product's adjustment now reads/
        writes `store_product_listings.stock_quantity` for the calling
        store instead of `products.stock_quantity`, and still writes the
        same `stock_adjustments` audit row either way.
      - POS checkout (`createSaleController.js`) — done in the previous
        session (see above), unchanged here.
- [x] Backend: new endpoints for managing a shared product's per-store
      overrides — `GET /api/products/:id/store-listings` (every store's
      price/stock/active row for the product, 400s for a store-owned
      product) and `PATCH /api/products/:id/store-listings/:storeId`
      (price/cost/active override only — stock is intentionally NOT settable
      here, it goes through `PATCH /:id/stock` scoped to that store so it
      keeps its audit trail).
- [x] Frontend: product edit page gains a per-store pricing view —
      `ProductFormModal.tsx`'s new `StoreListingsSection`, shown only when
      editing a shared product, lists every store with an editable price
      override (blank = inherit base price) and a read-only stock column
      (with a note to use Stock Adjustment for stock changes).
- [x] Frontend: store creation flow gains the catalog choice from §5.2 item 3
      — `CreateStoreModal.tsx` has a "Start with an empty catalog" checkbox
      (default unchecked = shared, matching the backend default) wired to
      `catalogSharing: 'empty' | 'shared'` in the create-store payload. This
      is the simpler of the two options described in §5.2 item 3 (start
      empty / copy everything) — the fancier "copy with a chosen pricing
      strategy" (e.g. percentage markup per store) was NOT built; every
      listing created this way inherits the base price (NULL override).
- [x] Verification done: `node -c` on every touched backend file
      (`product.routes.js`, `store.routes.js`, `storeProductListingService.js`,
      `inventoryService.js`, `createSaleController.js`,
      `backfill-store-product-listings.js`) and `npx tsc --noEmit` on the
      frontend, both clean, after every edit in this phase.
      **Still not done**: an actual live manual test (create a shared
      product, confirm it appears and is sellable at two different stores
      with independently-tracked stock and an overridden price at one of
      them, confirm a sale in Store A doesn't touch Store B's stock count).

#### Phase 2 — remaining gaps — GRN/returns/deletion fixed (2026-09-08)
The three transactional paths flagged in the previous pass as "should not
yet be used with a shared product" are now fixed:
- [x] `backend/services/storeProductListingService.js` gained two new
      shared entry points used by all three fixes below: `receiveStock(conn,
      tenantId, storeId, productId, receivedQty, receivedCost, opts)` and
      `reverseStock(conn, tenantId, storeId, productId, quantityToReverse,
      costToReverse)`. Both branch on the product's own `store_id`: a
      store-owned product still reads/writes `products.stock_quantity`/
      `weighted_average_cost`/`total_quantity_received` directly (unchanged);
      a shared product reads/writes the given store's own
      `store_product_listings` row for ALL of those fields instead.
- [x] `backend/controllers/grnController.js` — all four blocks that wrote
      `products.stock_quantity` directly (receive-on-create, status-change
      commitment ×2 near-duplicate call sites, status-change/deletion
      reversal ×2 near-duplicate call sites) now go through `receiveStock`/
      `reverseStock`. The two pre-reversal *validation* checks (does enough
      stock exist to reverse?) were also fixed to check the GRN's own store's
      listing for a shared product instead of reading the always-0
      `products.stock_quantity`.
- [x] `backend/controllers/salesReturnController.js` (restocking a returned
      item, and reversing that restock on return cancellation) — now checks
      the item's product `store_id` and, for a shared product, updates
      `store_product_listings` for the return's own `store_id` instead of
      `products.stock_quantity`.
- [x] `backend/services/saleDeletionService.js` (restoring stock when a sale
      is deleted, plus the deletion-preview endpoint's inventory-impact
      numbers) — now resolves and restores stock through the sale's own
      `store_id`'s listing for a shared product.
- [x] Verified: `node -c` on all touched files, clean.

**Product-owner direction received (2026-09-08), superseding the interim
decision above** — quoted verbatim: *"sharing product and details only we
share not the prices either cost or selling price unless tenant or
authorised user chose to[;] for weighted avg cost[/]total quantity received
it should be strictly store by store not a tenant wide."* This means:
sharing a product shares its identity/details only (name, sku, barcode,
category, etc.) — price (selling and cost), weighted average cost, and
total quantity received are never tenant-wide, and are tracked
independently per store unless a tenant/authorised user deliberately
overrides one (no such override UI beyond the existing per-store price
field exists yet). Implemented:
- [x] Migration `2026-09-08_store_product_listings_own_cost_tracking.sql` —
      added `weighted_average_cost`, `total_quantity_received`,
      `last_received_cost_price`, `last_received_date` to
      `store_product_listings` (previously these lived only on `products`,
      tenant-wide).
- [x] `receiveStock`/`reverseStock` rewritten: for a shared product, EVERY
      number (`stock_quantity`, `weighted_average_cost`,
      `total_quantity_received`, `last_received_cost_price`,
      `last_received_date`) is now read from and written to that one store's
      own `store_product_listings` row — never the `products` row, never
      another store's listing, and never a cross-store sum. Store-owned
      products are unaffected (still fully on the `products` row, as always).
      A shared new WAC-computation helper (`computeWeightedAverageCost`) is
      now the single implementation used by both the store-owned and shared
      branches, so the math itself can't drift between the two paths.
- [x] `grnController.js`'s two pre-reversal stock-sufficiency checks updated
      to read the GRN's own store's listing directly (no more cross-store
      SUM query — that was the previous interim behavior, now replaced).
- [x] Verified: `node -c` on `storeProductListingService.js` and
      `grnController.js`, clean.
- [ ] **Still not done**: an actual live manual test of any of GRN/returns/
      sale-deletion against a real shared product with more than one store's
      listing populated.
- [ ] `backend/routes/catalogSync.routes.js` — outbound catalog feed reads
      `products.stock_quantity`/`price` directly. **Explicitly put on hold by
      the product owner (2026-09-08)** — "we can put it on hold and address
      when it is needed." Left as-is; no code changes.
- [x] Dashboard/reports stock figures, audited and fixed (2026-09-08):
      - `dashboardController.js`'s inventory metrics already went through
        `inventoryService.getProducts`, fixed earlier in this phase — no
        changes needed, confirmed correct.
      - `reportsController.js`'s `getInventoryReportItems` (`GET
        /api/reports/inventory/items`) and `getInventorySummaryMetrics`
        (`GET /api/reports/inventory/summary`) had the exact same
        `WHERE p.store_id = ?` exclusion bug found twice already elsewhere,
        plus low-stock/out-of-stock/stock-valuation math reading
        `p.stock_quantity`/`p.cost_price` directly. Fixed: both now
        `LEFT JOIN store_product_listings` — a specific store's listing when
        `storeId` is passed (using that store's own `weighted_average_cost`
        for stock value, per the per-store cost tracking above), or a
        `SUM(stock_quantity)` aggregate across every store's listing for the
        tenant-wide (no `storeId`) view, since there's no single per-store
        cost to show without a store filter. The low-stock/out-of-stock
        filters moved from SQL predicates to a JS filter over the resolved
        per-row effective stock, since that value no longer comes straight
        off one column. Verified with `node -c`.

#### Phase 2 — sharing flipped to default-on, with per-store unlisting (2026-09-08)
Product-owner feedback: opting in to sharing per product was too much
friction for what should be the common case. Changed:
- [x] `ProductFormModal.tsx` — the create-time checkbox is now an opt-OUT
      ("Restrict to this store only"), unchecked by default. A new product
      is shared across all stores unless this is checked, in which case it's
      created store-owned (tied to the creating user's store), same as
      before this change. `ProductsPage.tsx`'s save logic needed no changes
      — it already branched on an explicit `shareAcrossStores` boolean,
      which is now `true` by default instead of `false`.
- [x] Per-store unlisting — a shared product can be hidden from one store
      without touching any other store or the product itself:
      - `StoreListingsSection` (in `ProductFormModal.tsx`, the per-store
        pricing view shown when editing a shared product) gained a
        "Listed"/"Unlisted" checkbox per store row, wired to the existing
        `PATCH /:id/store-listings/:storeId` endpoint's `isActive` field
        (the column already existed on `store_product_listings`; only the
        UI to toggle it was missing before).
      - `GET /api/products` (`product.routes.js`) and
        `inventoryService.getProducts` now exclude a shared product from a
        store's product list/inventory view when that store's own listing
        has `is_active = 0`. A missing listing row (no row at all) is
        treated as listed/visible — fail-open, matching `upsertListing`'s
        own default of `is_active = 1`.
      - `GET /api/products/:id` (single-product fetch, used for editing) is
        deliberately NOT filtered by `is_active` — a manager needs to be
        able to open and re-list an unlisted product.
      - **Known limitation, not fixed**: "unlisted" only hides a product
        from list/inventory views. It is not enforced as a hard block
        anywhere in checkout (`createSaleController.js`) — consistent with
        how `products.is_active` already isn't enforced at sale time for
        any product, shared or not, but worth knowing if "unlisted" is
        expected to mean "cannot be sold here" rather than "hidden from
        browsing here."
- [x] Verified: `node -c` on `product.routes.js`/`inventoryService.js`,
      `tsc --noEmit` on frontend, both clean.
- [ ] **Still not done**: a live manual test (create a shared product,
      confirm it appears at every store; unlist it from one store and
      confirm it disappears from that store's list only; re-list it and
      confirm it reappears).

#### Phase 2 — bulk product import audited and fixed (2026-09-08)
Checked whether `ProductImport.tsx` (the spreadsheet import modal on the
Products page) was updated for any of the above — it was not, and had a
pre-existing bug independent of multi-store that made it worse than it
looked:
- **Found**: `ProductImport.tsx` called a second, parallel
  `createProduct`/`updateProduct` pair defined locally in
  `services/inventoryService.ts`, which JSON-stringified the row data with
  its original camelCase field names straight to `POST`/`PUT /products`.
  The real endpoint expects multipart `FormData` with snake_case field names
  (`stock_quantity`, `is_active`, `purchase_price`, etc.) — the same
  contract `ProductsPage.tsx`'s manual add/edit form already builds
  carefully. Every multi-word camelCase field imported this way
  (`stockQuantity`, `costPrice`, `isActive`, `lowStockThreshold`) was
  silently dropped by the backend; only same-spelling fields like `name`,
  `price`, `sku`, `barcode` ever actually applied. This bug predates the
  multi-store work and would have been present regardless.
  Fixed: import now uses `services/productService.ts`'s `FormData`-based
  `createProduct`/`updateProduct` (the same ones `ProductsPage.tsx` uses),
  via a new `buildProductFormData` helper in `ProductImport.tsx` that
  mirrors `ProductsPage.tsx`'s `handleSaveProduct` field-mapping table
  exactly, including excluding `stockQuantity` from updates (stock changes
  must go through Stock Adjustment to keep their audit trail — the manual
  edit form already enforced this; import didn't).
- **Found**: import never sent `share_across_stores`, so every product it
  created was implicitly store-owned to whatever store the importing user
  was in — inconsistent with the shared-by-default change above. Fixed:
  added a "Share newly-created products across all stores" checkbox to the
  preview step, default checked (matching `ProductFormModal.tsx`'s
  default), applied to every new row from that import batch. Rows that
  match an existing product by SKU (`duplicateHandling: 'update'`) are
  unaffected — sharing status can't change after creation regardless of
  where the request comes from.
- [x] Verified: `tsc --noEmit`, clean.
- [x] **Fixed (2026-09-01)**: the duplicate-SKU N+1 above — `ProductImport.tsx`
  now fetches the catalog once at the start of the import run, indexes it by
  SKU into a `Map`, and looks up each row against that map (adding newly
  created SKUs to the map as it goes, so later rows in the same file still
  see them as duplicates). A 500-row import now makes 1 catalog fetch, not
  500.
- [ ] **Known, not fixed — pre-existing, out of scope for this pass**:
  - `trackInventory` is a template/mapping column that has no corresponding
    field anywhere in the backend's product create/update routes — it's
    silently a no-op both from this import and from the manual product form.
  - The import template has no way to set a per-store price override or
    initial per-store stock split for a shared product — a shared row from
    an import always inherits the base price everywhere and starts at 0
    stock at every store, same as one created through the single-product
    form. Setting per-store overrides after import still requires the
    per-store pricing view, one product at a time.
- [ ] **Still not done**: a live manual test of an actual import run (with
  the new FormData path, confirm previously-dropped fields like stock
  quantity and active status actually apply; confirm the sharing checkbox
  produces shared vs. store-owned rows as expected).

### Jewelry-accurate bulk import (2026-09-01)

Follow-up to the Phase 2 import fixes above — the user confirmed all three of:
industry attribute columns, weight/cost-code pricing, and serialized piece
import. All three are implemented in `ProductImport.tsx`:

- **Industry attribute columns**: on mount, the modal calls
  `getProductFieldSchema('product')` (existing `industryService.ts` client
  for `GET /api/industry/fields`) and adds one mappable column per resolved
  field (key `attr_<fieldKey>`, e.g. `attr_purity`, `attr_gross_weight`).
  Mapped values are collected per row into a single object and sent as a
  JSON string in the `attributes` form field — the same field
  `product.routes.js`'s POST handler already parses and validates via
  `industryFieldService.validateAttributes()`. No backend change was needed;
  this was purely a frontend gap (the import never offered these columns at
  all).
- **Weight/cost-code pricing**: added `purchasePrice`, `handlingCostPct`,
  `markupPct` columns mapping to `purchase_price`/`handling_cost_pct`/
  `markup_pct` — the exact body fields `product.routes.js` already destructures
  and feeds into `costCodeService.computeCostPrice`/`encode` for a manually
  created product. Import now reaches the same server-side cost-code
  computation; nothing new needed on the backend. If both the legacy flat
  `costPrice` column and `purchasePrice` are mapped, `purchasePrice` wins
  (only one `purchase_price` value can be sent).
- **Serialized piece import**: added a `pieceBarcode` ("Piece Barcode/Serial")
  column. A row with a non-empty value there creates one `product_pieces` row
  via `POST /api/product-pieces` (frontend `productPieceService.createPiece`)
  instead of just setting `stock_quantity` — reusing `attr_gross_weight`/
  `attr_net_weight`/`attr_purity` values from the same row if present, plus
  `purchasePrice`/`costPrice`/`price` for the piece's own price fields. Such
  a row's own `stockQuantity` is forced to 0 on the `products` row, since
  `syncAvailableCount()` (`productPieces.routes.js`) recomputes
  `products.stock_quantity` from the piece count server-side after each piece
  create — setting both would double count. Against an *existing* SKU, a
  serialized row always adds one more piece regardless of the
  skip/update/error duplicate-handling choice (that setting is about whether
  the *product itself* should be touched, not about adding another unit of
  it, so it doesn't apply the same way to a piece-only row).
- Pieces are created one at a time (`POST /api/product-pieces`), not via the
  existing `POST /api/product-pieces/bulk` — `/bulk` applies one shared set of
  attributes to N identical pieces in a single call, but a real import file
  typically has a distinct weight/purity/price per row (per serialized item),
  which `/bulk` can't express.
- Verified: `tsc --noEmit`, clean. `eslint` reports only pre-existing
  `no-explicit-any`/lint-style findings consistent with the rest of the file
  (not new correctness issues).
- **Known, not fixed — explicitly out of scope for this pass**:
  - No live test against a real database of any of these three additions —
    static verification only (matches the standing caveat on the rest of
    Phase 2's import fixes).
  - A serialized row still creates the *product* row first via the normal
    `POST /api/products` flow if the SKU is new — if that create fails
    validation (e.g. missing a required industry attribute), no piece is
    attempted; the row is reported as a plain product-creation error, not a
    distinct "piece not created" error, which is fine but worth knowing when
    reading error output.
  - No template/column-count guard against extremely wide files if a tenant
    has many industry attribute fields — every field becomes a column with
    no ability to exclude a subset from the import template download.
  - Bulk piece import still has no path to `POST /api/product-pieces/bulk`
    for the common "N identical new pieces" case (e.g. importing 50 identical
    plain gold bangles) — every row is one piece via the single-create
    endpoint, which is correct but not the most efficient call shape for that
    scenario.

### Empty catalog at a brand-new store — root cause + fix (2026-09-01)

**Symptom**: a tenant with an existing product catalog creates a second (or
Nth) store, switches to it, and the Products list shows zero items with no
error.

**Root cause — not a bug, an adoption gap**: "shared by default" (see above)
only governs products created *after* that change shipped. Every product
created before a tenant had more than one store still has `products.store_id`
set to whatever store originally owned it (there was no other model at the
time). `GET /api/products`'s fail-open shared-product logic is correct — a
brand-new store legitimately has no store-owned products of its own and no
shared products yet, so an empty list is the accurate answer, not a query
bug. Every tenant that had a catalog before adopting multi-store will hit
this the first time they add a second store.

**Fix — `storeProductListingService.shareExistingStoreOwnedProducts(tenantId)`**
(`backend/services/storeProductListingService.js`), exposed as
`POST /api/products/share-existing` (`backend/routes/product.routes.js`,
gated `requirePermission('products.update')`): for every product still owned
by a single store, creates a `store_product_listings` row at that product's
*current* store with its existing `stock_quantity`/`weighted_average_cost`/
`total_quantity_received`/`last_received_cost_price`/`last_received_date`
copied over, then sets `products.store_id = NULL`. Net effect: the store the
product already belonged to sees no change at all (same stock, same cost
history, now just resolved through a listing row instead of the product row
directly); every other store — including a brand-new one — can now see the
product and receive stock into it, starting from zero, same as any other
shared product. Runs inside a single transaction; skips (doesn't overwrite)
any product that unexpectedly already has a listing row at its own store;
safe to call more than once since already-shared products are left alone.

**Frontend**: `productService.ts`'s `shareExistingProductsAcrossStores()`,
surfaced as a "Share existing products" button in `StoresTab.tsx` (Profile →
Stores), shown only once a tenant has more than one store, with a confirm
dialog explaining exactly what will and won't change. This is a manual,
one-time action per tenant — not run automatically on store creation —
because it's a real, irreversible-in-spirit catalog decision (a shared
product's per-store price/stock model differs from a store-owned one) that
the product owner should consciously trigger, not something that silently
happens on the side of creating a store.

- [x] Verified: `node -c` on both backend files, `tsc --noEmit` clean on
  frontend.
- [ ] **Not done**: no live test against a real database (create a
  multi-product tenant predating this fix, add a second store, run the
  button, confirm the original store's stock/price are unchanged and the new
  store can see + receive the product). Also not tested: running it twice in
  a row to confirm the "already shared, nothing to do" / skip path actually
  behaves as documented.
- [ ] **Known limitation**: this only handles the "share everything" case.
  There's still no UI for "share only some of my existing products" — a
  tenant who wants only a subset shared has to use the per-product path
  instead (mark a product store-owned/shared is only settable at creation
  time today; an existing store-owned product can't be flipped to shared one
  at a time outside of this bulk action). If that's needed later, the
  cleanest addition is probably a per-product "Share across stores" action on
  the product edit view for a still-store-owned product, reusing this same
  service function's per-row logic against a single product ID.

### Phase 3 — Store creation catalog/tax provisioning UI
- [x] The simple version is done as part of Phase 2 above: `CreateStoreModal.tsx`'s
      "Start with an empty catalog" checkbox (shared vs. empty, no pricing
      strategy). Tax classes already apply tenant-wide automatically via
      Phase 1's replace-not-merge logic — no separate copy step was needed
      for tax.
- [ ] Not built: the fancier "copy with a chosen pricing strategy" version
      from §5.2 item 3 (e.g. copy every listing but apply a store-specific
      percentage markup instead of inheriting the base price as-is). Every
      listing created today inherits the base price (NULL override) with no
      way to bulk-adjust at creation time — a per-store price override still
      has to be set one product at a time via the new per-store pricing view.

### Phase 4 — Deferred / explicitly out of scope for now
- Promotional offers spanning a subset of stores (§6, open question #4).
- Industry-per-store (§8) — separate phase, has its own destructive-bug fix
  to land first (the bulk `UPDATE stores SET industry_code` overwrite).
- Cross-store currency-aware reporting (§8) — separate, should be fixed
  independently and doesn't block this document's work, but is a live
  correctness bug worth prioritizing soon regardless.
