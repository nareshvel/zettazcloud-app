# Souvenir & Gifts — new industry vertical (2026-09-01)

Adds `souvenir_gifts` as a supported business type, following the exact
pattern of the existing verticals (jewelry, apparel, electronics, grocery,
pharmacy, general_retail). Since the Add/Edit Product modal, bulk import, and
onboarding industry picker are all schema/data-driven off
`industry_types`/`industry_field_definitions` (see
`backend/services/industryFieldService.js`), most of this "feature" is a data
seed — only a handful of hardcoded TypeScript unions needed a matching entry.

## What was added

**Seed (`database/seeds/2026-09-01_souvenir_gifts_industry_seed.sql`, applied):**
- `industry_types` row: `souvenir_gifts` / "Souvenir & Gifts".
- `industry_field_definitions` for `product`: Item Type (select: Keychain,
  Magnet, Mug, T-Shirt, Postcard, Figurine, Plush Toy, Ornament,
  Jewelry/Accessory, Home Decor, Stationery, Other), Theme/Collection (text),
  Material (text), Made In (text), Personalizable (boolean), Fragile
  (boolean), Occasion (select: General, Birthday, Wedding, Holiday/Seasonal,
  Anniversary, Souvenir/Travel).

**Code changes (the only hardcoded lists that needed an entry — everything
else is generic):**
- `frontend/src/services/retailProfileService.ts` — `IndustryCode` union
  type: added `'souvenir_gifts'`. Without this, a store profile response
  containing this code would fail to type-check against callers expecting
  the old closed union.
- `frontend/src/components/inventory/ProductFormModal.tsx` —
  `INDUSTRY_NAME_PLACEHOLDER` map: added a souvenir-appropriate example
  ("Eiffel Tower Keychain, City Skyline Mug"). Purely cosmetic — the map
  already had a safe `?? 'e.g. Product Name'` fallback for unknown codes.
- `backend/services/industryMapping.js` — `BUSINESS_TYPE_TO_INDUSTRY`:
  added `souvenir_gifts`, `souvenir`, `souvenirs`, `giftshop`, `gifts` as
  synonyms mapping to `souvenir_gifts`, for any legacy/marketing-site signup
  path that still posts a fixed business-type string rather than reading the
  live `industry_types` list directly (the current `OnboardingWizard.tsx`
  already does the latter, so this is a defensive/legacy-path fix).

## Places confirmed to need NO change (already fully generic)

- **Add/Edit Product modal** (`ProductFormModal.tsx` → `DynamicProductFields.tsx`):
  renders whatever fields `GET /api/industry/fields?applies_to=product`
  returns for the tenant's industry — no per-industry branching at all.
- **Bulk import** (`ProductImport.tsx`): fetches the same field schema via
  `getProductFieldSchema('product')` and builds `attr_`-prefixed mapping
  columns from it dynamically — the new Item Type/Theme/etc. columns appear
  in the mapping step and template download automatically.
- **Onboarding industry picker** (`OnboardingWizard.tsx`) and Settings'
  business-type dropdown: both call `GET /api/industry/industries` live, no
  hardcoded list.

## Deliberately left untouched (correctly scoped to their own verticals, not
this one)

- `requireIndustry(['jewelry', 'electronics'])` gates on serialized-piece
  tracking (`productPieces.routes.js`), metal rates, old gold, repairs, and
  savings schemes — souvenir/gift items don't need serial tracking, and nothing
  about this vertical implies they should.
- Jewelry-only routing (`Sidebar.tsx`, `AppRoutes.tsx`,
  `IndustryAwareLayout.tsx`, `Login.tsx`'s post-login Sales Hub redirect,
  `POSScreen.tsx`) — the Sales Hub workflow is jewelry-specific by design.

## Follow-up (2026-09-01, same day): Print Template Designer starter presets added

The gap flagged above has been closed. `souvenir_gifts` now has a real
starting point in the Print Template Designer, not just a data schema:

- **`backend/services/printFixtures.js`** — added `STORE_SOUVENIR`, a
  `souvenirReceipt` fixture (Keychain/Mug/Home Decor line items with
  `itemType`, a final-sale/exchange-only return policy — most tourist/gift
  retail doesn't offer a refund window the way apparel's 30-day exchange
  policy does), and `souvenirGiftReceipt` (price-suppressed variant, same
  pattern as `apparelGiftReceipt`). Registered under
  `printFixtureSuite.receipt.souvenir` / `.souvenir_gift`, and
  `FIXTURE_BY_VERTICAL.souvenir_gifts`.
- **`frontend/src/utils/templatePresets.ts`** — added `'souvenir'` to
  `PresetVertical`, a `VERTICAL_LABELS` entry, two presets
  (`souvenir-receipt-80`, `souvenir-gift-80` — mirroring apparel's
  receipt + gift-receipt pair) referencing the fixtures above, and added
  `'souvenir'` to the `order` array so it shows up in the preset gallery.
- **`frontend/src/utils/itemTableModel.ts`** — added a `'souvenir'`
  `TablePresetKey` with columns Item / SKU / Item Type / Qty / Amount, and an
  "Item Type" / "Theme/Collection" entry under a new "Souvenir & Gifts" group
  in the accessor picker — without this, `itemType` would sit unused in the
  fixture data with no column to render it.
- **`frontend/src/components/print-templates/BlockPropertiesPanel.tsx`** —
  added the corresponding "Souvenir & Gifts" option to the table-preset
  dropdown so a user building a template manually can pick it directly,
  not just via the Print Template Designer's preset gallery.

**Verification:** `npx tsc --noEmit` (frontend) and `node -c
backend/services/printFixtures.js` both pass clean. The repo's own
`printGolden.test.ts` / `templatePresets.test.ts` suites exist specifically to
catch a dangling fixture reference or a preset pointing at an unknown
template type — they could **not** be run in this session (the sandbox's
`node_modules/rollup` is missing its Linux-arm64 native binary, a pre-existing
environment issue unrelated to this change — `npm i` after removing
`node_modules`/`package-lock.json` would fix it). Run
`npx vitest run src/utils/printGolden.test.ts src/utils/templatePresets.test.ts`
in a working dev environment before considering this fully verified — the new
fixtures follow the exact same shape as the apparel ones those tests already
pass against, so a failure would be surprising, but it hasn't been proven.

## Verification

- `npx tsc --noEmit` (frontend) — clean.
- `node -c backend/services/industryMapping.js` and
  `node -c backend/services/printFixtures.js` — clean.
- Seed applied via `npm run migrate:seeds` on 2026-09-01, per the user.
- Not yet manually verified end-to-end (create a souvenir_gifts tenant,
  confirm the Item Type/Theme/etc. fields render on Add Product, appear
  correctly in a bulk import template, and that the new print-template
  presets actually produce a good receipt) — recommended before considering
  this fully done. The vitest suites above should be run first since they'd
  catch most rendering issues without needing a live tenant.
