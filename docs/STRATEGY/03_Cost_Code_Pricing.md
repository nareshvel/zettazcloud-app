# Cost-Code Pricing (Non-Weight Flow + Tag Cipher)

This client prices by markup, not metal weight. Two related features:

## 1. Pricing flow

```
cost_price    = purchase_price * (1 + handling_cost_pct/100)
selling_price = cost_price     * (1 + markup_pct/100)
```

- New product columns: `purchase_price`, `handling_cost_pct`, `markup_pct`,
  `cost_code` (migration `2026-08-08_industry_fields_and_pricing.sql`).
- `services/costCodeService.js` — `computeCostPrice`, `computeSellingPrice`,
  `derivePricing`.
- The product create handler computes the effective cost price; if the user
  leaves the selling price blank, the derived selling price is used. The legacy
  `purchase_price → cost_price` mapping still works when the new fields are absent
  (non-breaking).
- `ProductForm.tsx` shows Purchase Price / Handling % / Markup % with a live
  "derived cost / suggested selling" preview.

## 2. Tag cost-code cipher

Retailers print a coded cost price on the tag: readable by staff, hidden from
customers. Fully tenant-configurable.

- The code **starts and ends with a marker letter** (e.g. `X … Y`).
- Each digit 0–9 maps to a configurable letter (e.g. `1→A, 2→N, …, 0→O`).
- Optional decimal char and repeat char (to hide repeated digits).

Example (default map): `125.50` → `XANE.EY`, and it decodes back to `125.5`.

**Config storage:** `tenant_cost_code_settings` (prefix, suffix, decimal char,
repeat char, digit map JSON, enabled).

**Service:** `services/costCodeService.js` — `encode(amount, config)`,
`decode(code, config)`, `normalizeConfig` (validates: exactly digits 0–9, unique
non-numeric letters, marker chars must not collide). Unit-tested in
`backend/tests/costCodeService.test.js` (12 passing cases).

**API** (`/api/industry`): `GET/PUT /cost-code`, `POST /cost-code/preview`.
On product create, if the cipher is enabled the `cost_code` is generated from the
effective cost price and stored on the product.

**Frontend:** `components/settings/CostCodeSettings.tsx` — enable toggle, marker
chars, digit→letter grid, and a live preview.

## Security note

The cost code obscures cost from customers; it is **not** cryptographic. Keep the
digit map and the decoded cost price behind the same RBAC permission that guards
cost/purchase price, and never expose `cost_code` on customer-facing receipts.

## Remaining / next

- Add the same three pricing inputs + `cost_code` display to `ProductFormModal.tsx`.
- Print the `cost_code` on internal tag/label templates in the print-agent (not on
  customer receipts).
- Optional: regenerate `cost_code` in bulk when a tenant changes the cipher.
