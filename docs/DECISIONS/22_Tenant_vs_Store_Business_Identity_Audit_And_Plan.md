# Tenant vs. Store business identity — audit and remediation plan (2026-09-01)

## Follow-up gap found and fixed (2026-09-01, same day): company contact info

Raised by the user after reviewing the Phase B implementation: **the
company/tenant level had no real contact information at all.** Confirmed by
code inspection — `tenants` had only `id, name, domain, settings (json),
industry_code, created_at, updated_at, setup_completed, trial_started_at,
onboarding_step`. Onboarding (`onboardingRoutes.js`) collects
`address/city/state/zipCode/website` in the wizard, but previously wrote them
**only** into `tenants.settings` (a JSON blob) — and nothing anywhere ever
read that JSON back out. `GET /api/tenants/me` (the only tenant-read
endpoint) selected just `id, name, industry_code`. So a company's own
address/phone/website was captured exactly once, at signup, and then
permanently invisible and uneditable — unlike `stores`, which has real,
always-editable columns for the equivalent fields.

**Fixed:**
- `database/migrations/2026-09-01_tenant_company_profile.sql` — adds
  `address, city, state, postal_code, country_code, phone, email, website,
  logo_url` to `tenants`, with a backfill from the existing `settings` JSON
  for tenants that already completed onboarding (idempotent — only fills a
  column if currently NULL). **Not yet applied** — run
  `cd backend && npm run migrate` before this is usable in any environment.
- `backend/routes/tenants.routes.js` — `GET /api/tenants/me` now returns the
  new fields; `PATCH /api/tenants/me` accepts any subset of them (Tenant
  Admin only, same gate as the existing name/industry fields).
- `frontend/src/services/industryService.ts` — `TenantCompanyProfile`
  interface, `getTenantProfile()` return type extended, new
  `updateTenantProfile()` function.
- `frontend/src/pages/UserProfilePage.tsx` — Business tab now has a "Company
  Contact Information" section (address, city, state, postal code, country
  code, phone, email, website) directly below the existing name/industry
  fields, explicitly labeled as distinct from any store's own contact info.
- `backend/routes/onboardingRoutes.js` — now writes `address/city/state/
  postal_code/country_code/phone/website` into the real `tenants` columns at
  onboarding completion, not just into `settings` JSON (which is still
  written too, for anything else that might depend on it existing).

**Deliberately not done in this pass:**
- A distinct company-wide **logo** was discussed but not implemented — the
  column exists in the migration (`tenants.logo_url`) for future use, but no
  upload UI was built for it, since there was no explicit confirmation on
  whether a company-level logo (separate from every store's own) is actually
  wanted, and guessing at an upload flow felt riskier than leaving the column
  ready and unused.
- This still lives inside My Profile → Business tab, not a dedicated
  "Company" section in the Settings nav — item 8 from the original plan
  (§Implementation status below) is unchanged: still an open UX/IA decision,
  not resolved by adding fields to the existing tab.
- No format validation on phone/email/website beyond trimming empty strings
  to `null` — matches the existing, equally-unvalidated pattern for the
  store-level equivalents in `store.routes.js`, for consistency, but is worth
  tightening later if bad data becomes a real problem.

## Implementation status (updated 2026-09-01, same day)

Phases A, B, D, and E's item 11 are **implemented**. Phase C is **not
started** — it explicitly requires a product decision (§4.1) before any
engineering should begin, and none was given.

| # | Item | Status |
|---|---|---|
| 1 | `PUT /api/industry/tenant` only touches stores with `industry_code IS NULL` | ✅ Done — `backend/routes/industry.routes.js` |
| 2 | `industry_code` exposed on `GET /api/stores/settings` + frontend `Store` type | ✅ Done — `backend/routes/store.routes.js`, `frontend/src/types/index.ts` |
| 3 | Per-store Business Type control in `GeneralSettings.tsx` | ✅ Done — inherit/override dropdown wired to `PUT /api/retail-profile` |
| 4 | My Profile Business tab help text clarified | ✅ Done — `frontend/src/pages/UserProfilePage.tsx` |
| 5 | Re-verify template provisioning on a per-store-divergent value | ⚠️ Verified by code inspection only — `templateProvisioningService.provisionStoreTemplates` is called from the same `PUT /api/retail-profile` handler that now accepts a real per-store override; **not yet exercised against a live database** with two stores actually holding different `industry_code` values. Recommended before calling this fully proven. |
| 6 | Phase C (per-store dynamic product fields) | ❌ Not started — blocked on product decision, see §4.1 |
| 8 | "Company" section in Settings nav | ❌ Not done — see note below |
| 9 | Stale comment in `Settings.tsx` | ✅ N/A — item 3 made the existing description accurate again, nothing to remove |
| 10 | Company name shown alongside store name | ✅ Done — `TopBar.tsx` dropdown and `StoresTab.tsx` list header |
| 11 | Onboarding `UPDATE stores` id guard | ✅ Done — `backend/routes/onboardingRoutes.js` now targets the resolved store id, not a blanket `tenant_id` match |
| 12 | Onboarding multi-store creation | ❌ Not started — scope/priority call, see §4.3 |

**Item 8 (Company section in Settings nav) was deliberately left undone**: it's
a real UX/navigation decision (move the Business tab's content into Settings,
or just add a shortcut link?) rather than a mechanical fix, and doing it
without that call risks producing a worse information architecture than
leaving it alone. Flagged for explicit follow-up rather than guessed at.

### A bug found and fixed while implementing item 3

`backend/services/retailProfileService.js`'s `INDUSTRIES` catalog is a
**separate, hardcoded mirror** of the `industry_types` table (unlike
`industryFieldService.js`, which queries that table directly) — it was
missing the `souvenir_gifts` entry added earlier this session, meaning a
store could not have actually been set to that business type via the new
per-store override despite everything else supporting it. Added the missing
entry. Also fixed: `updateRetailProfile()` had no way to reset a store back
to "inherit from company" — passing any falsy value for `industryCode` threw
`Unknown industry`. It now treats an explicit `industryCode: null` (distinct
from `undefined`, which means "don't touch this field") as "clear the
override," which the new Settings dropdown's "Inherit from company" option
relies on. Both fixes are noted in code comments at their location — flagged
here too since they weren't in the original plan and are easy to miss in a
diff review.

### Verification performed

- `npx tsc --noEmit` (frontend) — clean, across every change in this pass.
- `node -c` on every touched backend file — clean.
- **Not done**: no live-database test of the new per-store override end to
  end (create a second store, set its business type differently from the
  tenant default via General Settings, confirm it sticks after a tenant-wide
  Business Type change elsewhere, confirm print templates provision
  correctly for it). Recommended as the next concrete step before
  considering this feature complete, not just implemented.

---

## Why this doc exists

The intended model, per product direction, is:

> A tenant (company — e.g. "Global Retail Inc") signs up once with company-level
> details. It then operates one or more **stores**, each with its own name,
> address, localization, and business type (e.g. "Global Jewelry ANU" selling
> jewelry, "Global Gifts MIA" selling souvenirs/gifts — one company, two
> different kinds of shop).

This doc is the result of a full, code-level audit (no assumptions — every
claim below is backed by an actual file read) of whether the codebase
currently implements that model, where it deviates, and what it would take to
close the gaps. Two independent audits were run in parallel and cross-checked;
where they agree, that's a confirmed finding, not a guess.

**Bottom line up front:** localization (currency, timezone, date/number
format, measurement units, language) is **already correctly per-store**,
end to end, schema through UI through the formatting hook. Business
type/industry is **not** — the database column and backend update path for a
per-store industry exist and work correctly, but every UI write path forces
it to be identical across all of a tenant's stores, and the dynamic
product-attribute system (what fields show on Add Product) has no per-store
concept at all, only tenant-wide. Company/tenant identity also has no
dedicated home in the Settings UI a user would naturally find.

---

## 1. What already works correctly (no action needed)

| Capability | Status | Evidence |
|---|---|---|
| Per-store name, address, phone, email, logo | ✅ Correct | `stores` table columns; editable in `GeneralSettings.tsx`; settable at creation in `CreateStoreModal.tsx`; persisted by `POST /api/stores` and `PATCH /api/stores/settings` in `store.routes.js` |
| Per-store localization (currency, country, timezone, date/time format, number format, decimal precision, measurement system, language, locale, theme) | ✅ Correct | All live as columns on `stores` (`database/migrations/applied/0000_baseline_schema.sql`), fully collected in `CreateStoreModal.tsx`'s Localization tab, edited per-store in `LocalizationSettings.tsx`, resolved per the *active* store by `useLocaleFormat.ts` (reads `useOptionalStore()?.store`), and correctly refreshed on `switchStore()`'s full-page reload |
| Print/receipt template selection prioritizing store over tenant industry | ✅ Correct, but currently unreachable (see §2.4) | `retailProfileService.getRetailProfile()`: `industryCode = row.store_industry \|\| row.tenant_industry \|\| DEFAULT_INDUSTRY` — genuinely store-wins-over-tenant logic, and `templateProvisioningService.js` calls it correctly per store |
| Multi-store creation itself (a tenant can have N stores) | ✅ Correct | `POST /api/stores`, `StoresTab.tsx`, plan-limit enforcement all already shipped (see `docs/17-migration-and-roadmap/19_Store_Creation_And_Switching.md`) |

---

## 2. Confirmed gaps

### 2.1 Business type/industry is architecturally per-store-capable but functionally tenant-wide-only

This is the central finding, confirmed from four independent angles:

- **Schema**: `stores.industry_code` exists (`varchar(40) NULL`, migration
  `2026-08-24_retail_profile_and_duty_free.sql`, comment: *"Vertical for this
  store. NULL = inherit from tenant"*). `tenants.industry_code` also exists.
  Both are real columns, not one being a JSON afterthought.
- **Backend read path is correct**: `retailProfileService.getRetailProfile(tenantId, storeId)`
  resolves `store.industry_code || tenant.industry_code || 'general_retail'`
  — store genuinely wins when set. `templateProvisioningService.js` uses this
  correctly, meaning if a store's `industry_code` were ever set to `'jewelry'`
  under a `'general_retail'` tenant, that store would legitimately receive
  jewelry print templates (invoice, certificate of authenticity) instead of
  general-retail ones. **The plumbing already works.**
- **But the only UI write path clobbers all stores at once**: `PUT
  /api/industry/tenant` (`backend/routes/industry.routes.js`), triggered from
  My Profile → Business tab, runs:
  ```sql
  UPDATE tenants SET industry_code = ? WHERE id = ?;
  UPDATE stores  SET industry_code = ? WHERE tenant_id = ?;   -- ALL stores, unconditionally
  ```
  Every time a Tenant Admin sets the company's business type, it silently
  overwrites every existing store's `industry_code` to match — even a store
  that might have had its own value. There is no code path anywhere that
  currently writes a *different* `industry_code` to one specific store.
- **No UI ever exposes a per-store selector**: `CreateStoreModal.tsx`
  explicitly excludes it (comment: *"Business Type/industry (a tenant-wide
  setting from the Profile page's Business tab, not a per-store one)"`),
  `GeneralSettings.tsx` explicitly removed it (comment: *"moved to
  UserProfilePage.tsx's 'Business' tab ... it's a tenant-wide setting, not a
  per-store one"*), and `GET /api/stores/settings` (which powers the store
  object the frontend reads) doesn't even `SELECT` `industry_code`, so it
  never reaches the frontend `Store` type at all.

**Net effect**: right now, every store under a tenant is guaranteed to show
the same business type, because the one UI control that exists forces them to
match, and nothing else can diverge them. "Global Jewelry ANU" and "Global
Gifts MIA" under "Global Retail Inc" — the scenario the product direction
describes — is not achievable today.

### 2.2 Dynamic product attribute fields are tenant-wide only, with no per-store concept at all

This is a deeper gap than §2.1 — it's not a missing UI control, it's a
missing parameter throughout a whole subsystem.

`industryFieldService.js`'s `getTenantIndustry(tenantId)` and
`getFieldsForTenant(tenantId, appliesTo)` — the functions that decide which
fields render on Add/Edit Product, in bulk import, and drive
`requireIndustry()` gating — take **only `tenantId`**. There is no `storeId`
parameter anywhere in these functions or in any of their nine real callers
(`ProductFormModal.tsx`, `ProductImport.tsx`, `industry.routes.js`,
`useIndustry.ts`, `requireIndustry.js` middleware, `ReportsCenter.tsx`,
`Login.tsx`, `UserProfilePage.tsx`, plus `industryFieldService.js` itself).

**Practical consequence**: even if §2.1 were fixed and "Global Jewelry ANU"
correctly had `stores.industry_code = 'jewelry'`, the Add Product form for
that store would still show the *tenant's* industry fields (general retail's,
or whatever the tenant-wide value is), not jewelry-specific ones (purity,
weight, stone type). Fixing print templates without fixing this would produce
a confusing half-state: a jewelry store with a jewelry invoice template but a
general-retail product form.

This also intersects with the existing multi-store product-sharing model
(`store_product_listings`, documented in
`docs/17-migration-and-roadmap/20_Multi_Store_Data_Sharing_Model.md`):
products are tenant-wide/shared by default, with `products.store_id`
distinguishing a store-owned product. If two stores can have different
industries, does a *shared* product need to satisfy both stores' attribute
schemas at once, or does attribute-schema resolution only matter for
store-owned products? This is a real product decision, not just an
engineering one — see Open Questions (§4).

### 2.3 No dedicated "Company/Business Profile" page in Settings

`Settings.tsx`'s nav groups are: Store (General, Localization), Operations
(Taxes, Printers, Cost Code), Commerce (Payments), Catalog (Metal Rates,
Sales Channels), People (Security, Notifications), Integrations (Paytime),
Advanced (Industry Fields). There is no "Company" or "Business" group at all.
The only place tenant-level identity (company name, tenant-wide industry) is
editable is `UserProfilePage.tsx`'s "Business" tab — a page most users would
associate with their own personal profile, not company-wide configuration.
This is a discoverability gap: a Tenant Admin looking for "where do I edit my
company details" under Settings would not find it there today.

Additionally, `Settings.tsx` has a stale doc comment (line ~43) still
claiming the General tab covers "business type" — a leftover from before it
was moved, worth cleaning up regardless of what else changes.

### 2.4 No UI distinguishes company name from store name anywhere a user would look

`TopBar.tsx`'s store-switcher dropdown renders only `store.name` — a
multi-store tenant's dropdown would show "Global Jewelry ANU" / "Global Gifts
MIA" with no visual indication they belong to the same "Global Retail Inc."
`StoresTab.tsx`'s list has the same gap. This is minor on its own but becomes
more important once stores can genuinely differ in business type — a user
managing several visually-similar-sounding stores benefits from seeing the
parent company name for context.

### 2.5 Signup and onboarding only ever create one store, named generically

`signupService.js` and `tenantProvisioningService.js` both create exactly one
store per tenant at signup, named `"{businessName} - Main Store"` with a
hardcoded placeholder address (`'Address to be updated'`). `OnboardingWizard.tsx`
collects one `BusinessInfo` + one `StoreInfo` — never multiple stores. This
matches the product direction's *first* step (collect company info once) but
does not yet support the described flow's natural continuation (immediately
setting up the *named, distinct* stores like "Global Jewelry ANU"). Today, a
tenant that wants a second, differently-named, differently-typed store has to
finish onboarding with one generic store, then separately discover and use
"Create Store" in Profile → Stores afterward — which itself can't set
business type (§2.1).

Separately, a lower-severity correctness bug: `onboardingRoutes.js`'s
`POST /api/onboarding/complete` updates the tenant's store via
`UPDATE stores ... WHERE tenant_id = ?` with no `id`/`LIMIT 1` guard. Since a
tenant has exactly one store at onboarding time today, this is currently
harmless, but it's a latent bug that would silently overwrite every store's
name/address/currency/timezone with the same values the moment onboarding
ever runs against a tenant that already has more than one store (e.g. a
future "invite a second brand to onboarding" flow, or a re-run of onboarding
for any reason).

### 2.6 Weight-unit localization is broken (found incidentally, unrelated to business-type but in the same code path)

`useLocaleFormat.ts`'s `weightUnit` reads `(store as any)?.weightUnit` — but
neither the `Store` TypeScript type nor `GET /api/stores/settings`'s SELECT
list includes any such column. It always evaluates to `undefined`, silently
falling back to `'g'`. The real weight-unit setting lives in the separate,
tenant-wide `tenant_pricing_settings` table. This means weight-unit display
is currently **not** per-store despite everything else in `useLocaleFormat`
being correctly per-store — matches a pending item already flagged in
CLAUDE.md ("`weight_unit` in StoreContext type ... add the typed field to the
Store interface") but confirmed here as directly relevant to the
per-store-localization completeness goal.

---

## 3. Remediation plan

Ordered by dependency and risk — each phase is independently shippable and
leaves the system in a consistent state.

### Phase A — Stop the unconditional overwrite (low risk, immediate)

1. Change `PUT /api/industry/tenant`'s handler to **only** update
   `tenants.industry_code`, and change its blanket
   `UPDATE stores SET industry_code = ? WHERE tenant_id = ?` to instead only
   touch stores that currently have `industry_code IS NULL` (i.e., stores
   still inheriting from the tenant) — never overwrite a store that has
   already been given its own explicit value. This alone stops future data
   loss once §B ships, without yet adding new UI.
2. Add `industry_code` to `GET /api/stores/settings`'s SELECT list and to the
   frontend `Store` type, so the frontend can actually see a store's own
   industry once it's set.

### Phase B — Expose a real per-store Business Type control

3. Add a Business Type selector to `GeneralSettings.tsx` (or a new
   "Advanced" section within it) that calls the existing, already-correct
   `PUT /api/retail-profile` → `updateRetailProfile({ industryCode })` path
   (confirmed working in `retailProfileService.js`) — this is largely wiring
   an existing backend capability to a new UI control, not new backend work.
   Needs an explicit "Inherit from company" vs. "Override for this store"
   toggle so a store can be reset back to `NULL` (inherit) as well as set.
4. Update My Profile → Business tab's help text to clarify it sets the
   *default/company-wide* business type, which individual stores may
   override — so the two controls don't read as contradictory to a user who
   finds both.
5. Verify `templateProvisioningService.js` re-provisions the right templates
   the moment a store's `industry_code` changes via this new path (it should
   already, per §1, but must be re-tested against a real per-store-divergent
   value, since that state has apparently never existed in practice).

### Phase C — Per-store (or explicitly decided) dynamic product fields

6. **Requires a product decision first** — see Open Questions §4.1 — before
   any engineering, because the answer changes the design:
   - If product attribute schemas should follow the *store the product is
     owned by* (and shared/tenant-wide products keep using the tenant's
     schema): thread an optional `storeId` through
     `industryFieldService.getFieldsForTenant()`/`getTenantIndustry()`,
     defaulting to tenant-level resolution when a product is shared
     (`store_id IS NULL`), and to the owning store's resolved industry
     (store-own-value-or-tenant-fallback) when store-owned. Update all nine
     callers found in the audit to pass the relevant store context where one
     exists (Add/Edit Product already has `currentStore` in scope via
     `useStore()`/`useOptionalStore()`; bulk import already resolves a
     current store for other purposes).
   - If product attribute schemas should remain tenant-wide regardless of
     store business type (simpler, avoids the shared-product conflict
     entirely): explicitly document that decision so nobody re-opens this as
     a "bug" later, and this phase is done as a documentation-only change.
7. Either way, add a regression test asserting the chosen behavior, since
   this is exactly the kind of implicit assumption ("fields are tenant-wide")
   that's easy to silently break in either direction later.

### Phase D — Settings discoverability + naming clarity

8. Add a "Company" (or "Business") group to `Settings.tsx`'s nav, hosting (or
   linking to) the company name + tenant-wide default industry currently
   stranded in My Profile → Business tab. Whether this *moves* the Business
   tab's content or just adds a visible link/shortcut from Settings is a UX
   call, not an engineering one — either closes the discoverability gap.
9. Remove the stale "General tab covers business type" comment in
   `Settings.tsx`.
10. Show the parent company name alongside each store name in `TopBar.tsx`'s
    store switcher and `StoresTab.tsx`'s store list (e.g. "Global Jewelry ANU
    — Global Retail Inc" or a secondary line), so a multi-store, mixed-type
    tenant is legible at a glance.

### Phase E — Signup/onboarding alignment (larger, lowest urgency)

11. Fix the onboarding `UPDATE stores ... WHERE tenant_id = ?` guard to
    target the specific store id, even though it's currently harmless — cheap
    insurance against the exact class of bug CLAUDE.md already documents
    happening elsewhere in this codebase (blanket tenant-scoped UPDATEs with
    no id guard).
12. Decide whether onboarding should let a user create/name their first
    *store* distinctly from their company name and set its business type
    directly during onboarding (closer to the product direction's example),
    versus keeping today's "one generic store now, add more named/typed
    stores later via Profile → Stores" flow, once Phases B/C are in place to
    make that later step actually capable of setting a distinct business
    type. This is a scope/priority call for the team, not something to build
    speculatively.

---

## 4. Open questions requiring a product decision before Phase C can start

1. **Do shared (tenant-wide) products need to satisfy every store's
   attribute schema, or only store-owned products get per-store schemas?**
   This directly determines the design of Phase C and cannot be decided by
   engineering judgment alone — it depends on how the business actually wants
   shared catalogs to behave across mixed-industry stores.
2. **Should a store's business type be settable freely at any time, or only
   at store creation** (to avoid a jewelry store's existing product catalog
   suddenly needing apparel attributes it was never given)? Affects whether
   Phase B's control lives in `CreateStoreModal.tsx`, `GeneralSettings.tsx`,
   or both.
3. **Should onboarding support creating multiple, distinctly-named,
   distinctly-typed stores in one flow** (matching the "Global Jewelry ANU /
   Global Gifts MIA" example directly), or is "one store at signup, add more
   later" an acceptable permanent flow? Determines whether Phase E is worth
   scoping at all.

---

## 5. Source material

This plan is derived entirely from two independent code audits performed in
this session (no documentation or comments were taken at face value without
confirming the underlying code), covering: `backend/services/signupService.js`,
`backend/services/tenantProvisioningService.js`,
`backend/services/retailProfileService.js`,
`backend/services/templateProvisioningService.js`,
`backend/services/industryFieldService.js`,
`backend/routes/industry.routes.js`, `backend/routes/store.routes.js`,
`backend/routes/onboardingRoutes.js`, `frontend/src/pages/OnboardingWizard.tsx`,
`frontend/src/pages/SignupPage.tsx`, `frontend/src/pages/UserProfilePage.tsx`,
`frontend/src/components/settings/GeneralSettings.tsx`,
`frontend/src/components/stores/CreateStoreModal.tsx`,
`frontend/src/components/profile/StoresTab.tsx`,
`frontend/src/components/layout/TopBar.tsx`,
`frontend/src/contexts/StoreContext.tsx`, `frontend/src/hooks/useLocaleFormat.ts`,
`frontend/src/pages/Settings.tsx`, and the relevant `database/migrations/applied/*.sql`
files for both `stores` and `tenants`. No code was changed as part of this
audit — this is a planning document only, per the explicit request that
preceded it.
