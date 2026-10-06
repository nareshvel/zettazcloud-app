# Industry-Based Dynamic Fields

Lets any tenant see product/POS fields relevant to their industry (jewelry,
apparel, electronics, grocery, pharmacy, general retail) — with more or fewer
fields — and lets a specific tenant add/hide/relabel fields without forking the
platform. Built generically, not exclusively for one tenant.

## Data model (migration `2026-08-08_industry_fields_and_pricing.sql`)

- `industry_types` — catalogue of verticals (seeded).
- `industry_field_definitions` — platform default fields per `industry_code` +
  `applies_to` (`product` / `pos` / `customer`). Each field has `field_key`,
  `label`, `data_type` (text/number/decimal/date/select/boolean/textarea),
  `options_json`, `unit`, `is_required`, `is_searchable`, `show_on_receipt`,
  `sort_order`.
- `tenant_field_overrides` — per-tenant hide (`is_enabled = 0`), relabel, or add
  a custom field (`is_custom = 1`).
- `tenants.industry_code` — the tenant's selected industry (falls back to
  `general_retail`, or `settings.industry_code` if the column is null).
- `products.attributes` (JSON) — where the dynamic field **values** are stored,
  keyed by `field_key`.

Seed data (`database/seeds/2026-08-08_industry_field_definitions_seed.sql`)
ships default fields for all six industries. Jewelry example fields: metal,
purity, gross/net weight, stone type/weight/value, making charge, hallmark/HUID,
certificate no, HSN.

## Backend

- `services/industryFieldService.js`
  - `getFieldsForTenant(tenantId, appliesTo)` — merges defaults + overrides into
    the effective ordered field list.
  - `validateAttributes(tenantId, appliesTo, attributes)` — type-checks and
    sanitizes incoming values; drops unknown keys; enforces `is_required` and
    `select` options.
- `routes/industry.routes.js` (mounted at `/api/industry`):
  `GET /industries`, `GET /fields`, `GET/PUT /tenant`,
  `GET/PUT/DELETE /overrides`, plus cost-code endpoints (doc 03).
- `routes/product.routes.js` — the create handler now validates & persists
  `attributes`; all product read/list responses include `attributes`.

## Frontend

- `services/industryService.ts` — typed client for the above.
- `components/inventory/DynamicProductFields.tsx` — fetches the tenant schema and
  renders the industry fields; stores values in an `attributes` object. Renders
  nothing when the industry defines no extra fields.
- Wired into `components/inventory/ProductForm.tsx` (the form used by
  `pages/Products.tsx`).

## How a tenant switches industry

`PUT /api/industry/tenant { industryCode }`. The product form immediately renders
that industry's fields. Admins tune fields via the overrides endpoints.

## Remaining / next

- Apply the same `DynamicProductFields` pattern to the POS quick-add and to
  `ProductFormModal.tsx` (the second product form used by `ProductsPage.tsx`).
- Admin UI to manage `tenant_field_overrides` visually (backend already exists).
- Surface `show_on_receipt` fields in the print-agent templates.
- Index hot `attributes` keys via generated columns if they become searchable at
  scale (MySQL 8 supports functional indexes on JSON).
