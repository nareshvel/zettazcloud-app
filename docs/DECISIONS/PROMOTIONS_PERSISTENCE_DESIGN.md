# Promotions Persistence: Design, Migration, and Rollout

## 1. Overview
- Goal: Make server the source of truth for promotions so Dashboard, Receipts, and Reports show consistent net totals and auditable offer details.
- Scope: DB schema, server computation at sale creation, API responses, backfill, rollout, and frontend adjustments.

## 2. Objectives & Non‑Goals
- Objectives
  - Persist both promotions amount and details (what offers applied, to which items, with snapshots).
  - Ensure `sales.total` includes both promotions and manual discount.
  - Provide reporting fields for accounting (per sale, per offer, per item).
  - Keep backward compatibility during rollout with feature flags.
- Non‑Goals
  - Retroactive perfect reconstruction for all historical sales when offers changed without version history. Backfill will be best‑effort with audit notes.

## 3. Data Model Changes

### 3.1 sales (existing)
- Add: `promotions_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00`
- Keep: `discount_amount` (manual discount only)
- Invariant: `total = subtotal + tax - (promotions_amount + discount_amount)`

### 3.2 sale_items (existing)
- Add:
  - `promo_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00`
  - `manual_discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00`
  - `final_unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00` (for price after promos+manual)
  - Optional: `promo_breakdown_json JSON NULL` (compact per‑item applied‑offers breakdown)

### 3.3 sale_applied_offers (new)
- One row per sale per applied offer (rollup for the offer across items)
- Columns:
  - `id PK`
  - `sale_id FK -> sales(id)`
  - `offer_id` (nullable if no internal ID), `offer_name`, `offer_type`
  - `applied_amount DECIMAL(10,2) NOT NULL`
  - `snapshot_json JSON NOT NULL` (offer rules snapshot at sale time)
  - `created_at TIMESTAMP NOT NULL DEFAULT now()`
- Indexes: `(sale_id)`, `(sale_id, offer_id)`

### 3.4 sale_item_discounts (new)
- One row per sale item per applied offer (fine‑grained audit)
- Columns:
  - `id PK`
  - `sale_id FK -> sales(id)`
  - `sale_item_id FK -> sale_items(id)`
  - `offer_id` (nullable), `discount_amount DECIMAL(10,2) NOT NULL`
  - `meta_json JSON NULL` (e.g., tier hit, buy_x_get_y units)
- Indexes: `(sale_id)`, `(sale_item_id)`, `(sale_id, offer_id)`

### 3.5 Offer snapshot JSON (recommended shape)
```json
{
  "id": "OFR-123",
  "name": "Buy 2 Get 1",
  "type": "buy_x_get_y",
  "priority": 50,
  "rules": { /* normalized rule set */ },
  "version": 3,
  "effectiveAt": "2025-08-01T00:00:00Z"
}
```

## 4. Server Logic (Authoritative Computation)

### 4.1 Sale creation flow (POST /sales)
1. Validate payload (items, quantities, prices, manual discount input if any).
2. Load active offers for tenant/store.
3. Run discount engine server‑side (equivalent to `applyItemWiseDiscounts`).
4. Persist:
   - sale_items: `promo_discount_amount`, `manual_discount_amount`, `final_unit_price`, `promo_breakdown_json`
   - sales: `promotions_amount = SUM(item.promo_discount_amount)`, `discount_amount = manual_only`, `total = subtotal + tax - (promotions_amount + discount_amount)`
   - sale_applied_offers & sale_item_discounts with snapshot JSON
5. Respond with net totals and applied offers breakdown.

### 4.2 Recalculate/void flows
- On void/refund, store linkage to original sale and prorated promo impacts if required by accounting.

## 5. API Contracts

### 5.1 POST /sales (Request)
```json
{
  "customerId": "CUST-1",
  "items": [
    { "productId": "P1", "price": 100.00, "quantity": 3 },
    { "productId": "P2", "price": 50.00,  "quantity": 1 }
  ],
  "manualDiscount": { "type": "percent", "value": 10 },
  "taxAmount": 18.82,
  "metadata": { "posId": "TERM-7" }
}
```

### 5.2 POST /sales (Response)
```json
{
  "sale": {
    "id": "S-1001",
    "subtotal": 350.00,
    "promotionsAmount": 40.00,
    "discountAmount": 31.18,
    "tax": 18.82,
    "total": 297.64
  },
  "items": [
    {
      "id": "SI-1",
      "productId": "P1",
      "qty": 3,
      "unitPrice": 100.00,
      "promoDiscountAmount": 30.00,
      "manualDiscountAmount": 20.00,
      "finalUnitPrice": 83.33,
      "promoBreakdown": [
        { "offerId": "OFR-123", "name": "Buy 2 Get 1", "amount": 30.00 }
      ]
    }
  ],
  "appliedOffers": [
    { "offerId": "OFR-123", "name": "Buy 2 Get 1", "type": "buy_x_get_y", "amount": 30.00 }
  ]
}
```

### 5.3 GET /reports/sales/transactions
- Each row returns: `id, datetime, paymentMethod, subtotal, promotionsAmount, discountAmount, tax, total` and a compact `appliedOffers` summary.

### 5.4 GET /sales/{id}
- Returns sale header with `promotionsAmount`, `discountAmount`, `total`, and `appliedOffers` list.

### 5.5 GET /sales/{id}/items
- Returns item rows with `promoDiscountAmount`, `manualDiscountAmount`, `finalUnitPrice`, and `promoBreakdown`.

## 6. Migrations

Provide dialect‑appropriate scripts. Below are Postgres examples; for SQLite, use compatible types and `ALTER TABLE` workarounds (recreate table if needed).

### 6.1 Postgres
```sql
-- sales
ALTER TABLE sales ADD COLUMN promotions_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00;

-- sale_items
ALTER TABLE sale_items ADD COLUMN promo_discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE sale_items ADD COLUMN manual_discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE sale_items ADD COLUMN final_unit_price NUMERIC(10,2) NOT NULL DEFAULT 0.00;
ALTER TABLE sale_items ADD COLUMN promo_breakdown_json JSONB;

-- sale_applied_offers
CREATE TABLE sale_applied_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  offer_id TEXT NULL,
  offer_name TEXT NOT NULL,
  offer_type TEXT NOT NULL,
  applied_amount NUMERIC(10,2) NOT NULL,
  snapshot_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_applied_offers_sale ON sale_applied_offers(sale_id);
CREATE INDEX idx_sale_applied_offers_sale_offer ON sale_applied_offers(sale_id, offer_id);

-- sale_item_discounts
CREATE TABLE sale_item_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  sale_item_id UUID NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  offer_id TEXT NULL,
  discount_amount NUMERIC(10,2) NOT NULL,
  meta_json JSONB
);
CREATE INDEX idx_sale_item_discounts_sale ON sale_item_discounts(sale_id);
CREATE INDEX idx_sale_item_discounts_item ON sale_item_discounts(sale_item_id);
CREATE INDEX idx_sale_item_discounts_sale_offer ON sale_item_discounts(sale_id, offer_id);
```

### 6.2 SQLite (conceptual)
- Add columns via `ALTER TABLE` where supported; otherwise:
  - Create new table with desired schema
  - Copy data
  - Drop old table and rename
- Use `TEXT` for JSON columns; enforce structure at application layer.

## 7. Backfill Strategy
- Window: last 60–90 days configurable per tenant.
- For each sale:
  - Load sale items.
  - Apply discount engine using best available offer snapshot:
    - If historical version exists, use it.
    - Else use current offers and record `meta_json.reason = 'approximation'`.
  - Update `sale_items.promo_discount_amount` and `final_unit_price`.
  - Roll up to `sales.promotions_amount`.
  - Optionally recompute `sales.total`; by default, record before/after in `sales_recalc_audit` and only update if delta < threshold (e.g., 0.01–0.05).
- Run per tenant during off‑peak hours; idempotent and resumable.

## 8. Frontend Integration Plan
- Short term (flag off):
  - Keep client‑side enrichment in `frontend/src/pages/Dashboard.tsx` for recent transactions and in `receiptService.ts`.
- After backend deploy (flag on):
  - Use server `total` and `promotionsAmount` in recent transactions.
  - Use `appliedOffers` and per‑item `promoBreakdown` in dashboard modal and print.
  - Remove client recomputation code paths after validation window.

## 9. Feature Flags & Rollout
- Flag: `server_promos_enabled` (env/tenant level).
- Phases:
  1. Deploy migrations + backend compute to staging.
  2. Staging backfill and validation (unit/integration/e2e).
  3. Pilot tenant in production, compare client vs server totals; monitor.
  4. Production backfill; enable flag for all tenants.

## 10. Testing
- Unit: offer engine (percentage/fixed/tiered/buy_x_get_y), stacking, priorities.
- Service: sale creation invariants; table writes; snapshots saved.
- Integration: POST /sales lifecycle; GET /reports consistency.
- E2E: cart → checkout → dashboard → receipt; verify totals/lines.

## 11. Performance & Indexing
- Batch compute per sale; minimize JSON size.
- Indexes on `sale_id`, `(sale_id, offer_id)`, and `sale_item_id` support reports.
- Consider archiving `sale_item_discounts` after N months if volume is large; keep rollups.

## 12. Security & Privacy
- Snapshot JSON should only include rule data needed for audit (no PII).
- Enforce tenant isolation on all new tables.

## 13. Open Questions
- Do we need offer versioning table, or is snapshot JSON sufficient?
- Should we expose per‑offer totals in a dedicated reports endpoint?

## 14. Implementation Checklist
- [ ] SQL migrations committed under `database/` with up/down scripts
- [ ] Backend sale creation computes and persists promos
- [ ] API responses extended (`/sales`, `/reports/sales/transactions`)
- [ ] Backfill job + audit logs
- [ ] Frontend types + render paths updated; feature flag wiring
- [ ] Tests (unit/integration/e2e) added and passing
- [ ] Rollout plan executed with monitoring and fallback

---

Owner: Engineering
Status: Draft
Last updated: 2025‑08‑27
