# Pre-Deploy QA Checklist — Multi-Store Sharing, Bulk Import, Plan Limits

**Status as of 2026-09-01.** Everything below is code-complete and verified only via
`node -c` (backend) / `tsc --noEmit` (frontend) — **none of it has been exercised
against a live database or real file uploads yet.** This is the manual test pass to
run before/during deploy. Organized by feature area; each item names the file(s) it
exercises so a failure can be traced back quickly. Related docs:
`20_Multi_Store_Data_Sharing_Model.md`, `18_Plan_Limits_Enforcement.md`.

---

## 1. Multi-store data sharing

### 1.1 New product defaults to shared
- [ ] Add a new product via Inventory → Add Product, leave "Restrict to this store
  only" unchecked. Confirm it appears in the product list at every store (switch
  stores via the TopBar dropdown and check).
- [ ] Add another product WITH "Restrict to this store only" checked. Confirm it only
  appears at the store it was created in.

### 1.2 Per-store unlist toggle
- [ ] Open a shared product's edit view → "Store Pricing & Stock" section. Uncheck
  "Listed" for one store. Confirm that product disappears from the product list at
  that store, but still shows at every other store.
- [ ] Re-check "Listed" for that store and confirm it reappears.

### 1.3 Per-store price override
- [ ] In the same "Store Pricing & Stock" section, set a price override for one
  store and save. Switch to that store and confirm POS/checkout uses the override
  price; switch to another store and confirm it still uses the base price.

### 1.4 Empty catalog on a brand-new store + the fix
- [ ] Create a brand-new store (Profile → Stores → Create Store). Switch to it and
  confirm the product list is empty (expected, if your existing catalog predates
  multi-store).
- [ ] Go to Profile → Stores, click "Share existing products", confirm the dialog
  copy, then confirm it. Switch back to your original store and confirm nothing
  changed there (same stock, same price). Switch to the new store and confirm those
  products are now visible (with 0 stock, ready to receive into).
- [ ] Click "Share existing products" a second time — confirm it reports "nothing to
  do" / 0 converted, and doesn't error or duplicate anything.

### 1.5 GRN receiving, per store
- [ ] Receive stock via a GRN for a shared product at Store A. Confirm Store A's
  stock/cost increase, and Store B's stock for the same product is unaffected.
- [ ] Reverse/void that GRN and confirm Store A's stock/cost revert correctly.

### 1.6 Sales return + sale deletion, per store
- [ ] Process a sale of a shared product at Store A, then return it. Confirm the
  stock restock lands on Store A's listing, not another store's.
- [ ] Delete a sale (if your account has permission) involving a shared product and
  confirm the stock rollback goes to the correct store's listing.

---

## 2. Bulk product import (`ProductImport.tsx`)

### 2.1 Basic import
- [ ] Download the template, fill in a few rows (name, price, SKU, stock), import.
  Confirm products are created correctly and visible in the list.

### 2.2 Sharing checkbox
- [ ] Import with "Share newly-created products across all stores" checked — confirm
  new rows are visible at every store.
- [ ] Import with it unchecked — confirm new rows are only visible at the store you
  imported from.

### 2.3 Duplicate SKU handling + perf
- [ ] Import a file where some SKUs already exist, using each of skip / update /
  error modes, and confirm the expected behavior (skip → not touched, update →
  fields change, error → row rejected with a message).
- [ ] Import a large-ish file (50+ rows) and confirm it completes in reasonable time
  — this exercises the fixed N+1 duplicate-SKU lookup (should now be one catalog
  fetch total, not one per row).

### 2.4 Industry attribute columns
- [ ] On a jewelry tenant, confirm the template/mapping step offers columns for
  purity, gross weight, net weight, etc. Import a row with these filled in and
  confirm they show up correctly on the product's edit view (Industry Details
  section).

### 2.5 Weight/cost-code pricing columns
- [ ] Import a row with Purchase Price + Handling % + Markup % set (leave the flat
  Cost Price column unmapped). Confirm the resulting product's cost price matches
  the expected computed value (purchase price × (1 + handling%)), and that a cost
  code is generated if your tenant has cost-code pricing enabled.

### 2.6 Serialized piece import
- [ ] On a jewelry tenant, import a row with a "Piece Barcode/Serial" value set.
  Confirm: (a) the product is created (or matched by SKU) with stock NOT set from
  the row's stock column, (b) a new entry appears in Serialized Inventory for that
  product with the barcode/weight/purity from the row, (c) the product's stock
  quantity reflects the piece count after import.
- [ ] Import two rows with the same SKU and different piece barcodes — confirm both
  create separate pieces under the same product, not two products.

---

## 3. Add/Edit Product form — industry fields section

- [ ] Open Add Product on a jewelry tenant. Confirm the "... Details" industry
  section (purity, weight, etc.) visually matches every other section (same icon +
  label + divider style, same input/label styling) — not a bolted-on box with
  different fonts/spacing.
- [ ] Same check in the POS Quick Add modal.
- [ ] Select different Metal Types and confirm Purity options/visibility update
  correctly (e.g. Titanium hides Purity; Gold shows Metal Colour).

---

## 4. Plan limits (products / users / stores / storage)

For each, use a test tenant on a plan with a LOW limit (or temporarily lower a
plan's `limits` in the `plans` table) so the limit can actually be hit without
creating hundreds of rows.

### 4.1 Products / Users / Stores (already-shipped baseline — regression check)
- [ ] Hit the products limit creating a new product; confirm a clear 402 error
  message with the upgrade prompt, not a silent failure or generic 500.
- [ ] Same for users limit (create user) and stores limit (create store).

### 4.2 Storage limit — disk-storage routes (product/category images)
- [ ] On a tenant near their storage cap, upload a product image that would push
  usage over the limit. Confirm: a 402 is returned, the product image is NOT
  persisted (check `backend/uploads/<tenantId>/products/` — the file should have
  been deleted after the check), and the error message shows a human-readable
  limit (e.g. "1 GB") not raw bytes.
- [ ] Same test for a category image.
- [ ] Upload an image that stays UNDER the limit and confirm it succeeds normally.

### 4.3 Storage limit — memory-buffered routes (attachments, avatar)
- [ ] On the same near-cap tenant, try uploading a generic attachment (e.g. to a
  repair order or memo) that would exceed the limit. Confirm a 402 is returned
  BEFORE anything is written (no orphaned file, no attachments row created).
- [ ] Try uploading a profile avatar that would exceed the limit — same
  before-write 402 expectation.
- [ ] Upload an attachment/avatar that stays under the limit and confirm success.

### 4.4 Usage reporting
- [ ] Check whatever surfaces `getSubscriptionUsage()` (Settings → Billing, or the
  relevant API response) and confirm the storage `used`/`percentage` numbers move
  correctly for the same tenant as you upload/remove files, and roughly match what
  `du -sh backend/uploads/<tenantId>/` reports on the server.

### 4.5 Fail-open sanity checks
- [ ] Confirm a tenant with NO subscription row at all (a pre-existing/legacy
  tenant) can still create products/users/stores and upload files without being
  blocked — every limit check here is designed to fail open on a missing
  subscription or plan, and this should never lock out legacy tenants.

---

## 5. Regression sanity (nothing here should have changed behavior)

- [ ] Normal POS checkout (non-shared, single-store tenant) still works end to end:
  add to cart, checkout, receipt prints.
- [ ] Normal product create/edit (no sharing, no industry fields, no storage
  concerns) still works exactly as before on a non-jewelry tenant.
- [ ] Existing attachments (repair orders, memos, customers) still upload/download
  correctly on a tenant with plenty of storage headroom.

---

## Known gaps NOT covered by this pass (do not expect these to work)

- Outbound catalog-sync feed (`catalogSync.routes.js`) — explicitly on hold, has no
  multi-store concept at all.
- Per-store price/stock import via bulk import — only base price/stock import.
- Bulk piece import via `/api/product-pieces/bulk` from the import UI — current
  serialized import always creates pieces one at a time.
- S3 storage driver — storage usage/enforcement only works correctly with the
  default local disk driver; `STORAGE_DRIVER=s3` is still an unimplemented stub.
