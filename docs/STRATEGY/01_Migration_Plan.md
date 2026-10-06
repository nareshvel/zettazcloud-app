# dJewel → Zettaz Cloud — Data Migration Plan (v2)

Supersedes the initial analysis. Reflects the client's confirmed decisions:
non-weight pricing, tables to drop, returns to keep, and Paytime payroll.

## 0. Source & target at a glance

| | Old (dJewel) | New (Zettaz Cloud) |
|---|---|---|
| Stack | .NET + Microsoft SQL Server (2006) | Node/Express + MySQL 8 + React |
| Tenancy | Single company | Multi-tenant (`tenant_id`, `store_id`) |
| Keys | int identity | UUID (`char(36)`) |
| Pricing | Manual, per-tag cost code | purchase → cost → selling (see doc 03) |

## 1. What we migrate (and what we drop)

**Bring across:**

- `Product` → `products` (Style_Code → `sku`; jewelry attributes → `products.attributes`)
- `Customer` → `customers`
- `Supplier` → `suppliers`
- `Stock` (movements/balances) → `inventory_logs` / `stock_adjustments` (opening balances)
- `StockTransfer_ReturnProduct` → sales-return / return records (**kept** — returns are still used)
- `Purchase` → purchase history (optional; or opening supplier balances)

**Do NOT migrate (confirmed unused):**

- `Banking`, `Branch_BankAccount`, `Branch_Company` (single branch; no bank ledger in Zettaz)
- `Employee_Advance` (payroll advances now handled by Paytime — see doc 04)
- `StockTransfer` inter-branch transfers (not actively used; only the *return* portion is kept)

Export the dropped tables to CSV for archival before decommissioning the old DB, so history is never lost even though it doesn't enter Zettaz.

## 2. The three simultaneous shifts — order of operations

Handle engine → tenancy → keys, in that order.

**Step 0 — Restore & script the source.** Restore `diamondrepublic_7aug2026.bak` on any SQL Server / Azure SQL / Docker `mssql` instance and script the real schema + row counts. The schema in the analysis was reconstructed from stored-procedure text; verify it against the restore before writing ETL.

**Step 1 — Provision the target.** Create the destination `tenant` (Diamond Republic) and its `store`, set `tenants.industry_code = 'jewelry'` (see doc 02). Capture those UUIDs.

**Step 2 — ID crosswalk tables.** For each entity build `map_<entity>(old_int_id, new_uuid)`. Generate UUIDs once; reuse everywhere so FKs stay consistent.

**Step 3 — Apply the new migrations first** (so target columns exist):
`database/migrations/2026-08-08_industry_fields_and_pricing.sql`,
`database/seeds/2026-08-08_industry_field_definitions_seed.sql`,
`database/migrations/2026-08-08_employees_module.sql`.

**Step 4 — Master data, in dependency order:** suppliers → categories (distinct old `Category`) → customers → products. For products, map Style_Code→sku and parse any metal/purity/weight out of the old free-text `Description` into `products.attributes` (flag uncertain rows for manual review).

**Step 5 — Transactional data:** Stock balances → opening `inventory_logs`/`stock_adjustments`; returns → return records. Sales history only if needed in-app, else archive.

**Step 6 — ETL as idempotent Node scripts** (repo already uses `mysql2`): SQL Server → CSV/JSON per table → transform via crosswalk → `INSERT ... ON DUPLICATE KEY UPDATE`. Re-runnable without duplicating.

**Step 7 — Validate before cutover:** row-count parity; financial totals (stock balance, counts) to the cent; referential integrity (no orphan tenant/store/category/product ids); spot-check 20–30 high-value pieces end to end. Run on a **staging tenant** first, sign off, then production during a freeze.

**Step 8 — Cutover:** freeze old writes → final delta → verify → switch users → keep old SQL Server read-only for the retention window as fallback.

## 3. Pricing & tag cost-code during migration

The client does **not** use weight-based pricing. Each product carries `purchase_price`, `handling_cost_pct`, `markup_pct`; cost and selling price are derived (doc 03). If the old tag cost code is recoverable, configure the tenant's cost-code cipher (doc 03) so re-printed tags match the historical codes; otherwise regenerate codes from the migrated cost price.

## 4. Caveats

Column/type details for the source must be confirmed against a real restore (Step 0). Row-level data (customers, invoices, balances) has not yet been read from the backup.
