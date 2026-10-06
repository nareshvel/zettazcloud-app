# Print Templates and Duty-Free Checkout Fixes

**Session date:** August 2026  
**Areas:** Print Template Designer, Sales Hub, duty-free checkout, payment methods, inventory, audit logging

## Summary

This session started with a deep audit of the Print Template Designer and continued into issues found while testing the new Sales Hub and duty-free checkout flow. The work corrected template rendering and editing gaps, tenant payment-method validation, missing duty-free database columns, non-atomic inventory updates, stock-adjustment foreign keys, audit logging, and a receipt-printing TypeScript error.

## Print Template Designer

### Header mixed store identity and document metadata

The header and text blocks both defaulted to the store name. The header also appended the invoice number and date, making store identity, document title, and document metadata behave as one block.

The rendering was separated so that:

- `header` represents a document title such as `INVOICE` or `TAX INVOICE`.
- Header metadata can include invoice/document number, date, due date, and cashier.
- `text` can represent store identity and display selected store fields.
- Store name, address, phone, email, and tax ID can be enabled independently.

The canvas renderer and printable HTML renderer were updated together so the live preview and printed result follow the same rules.

### Font-size control did not affect the preview

The properties panel saved `config.fontSize`, but many render paths used fixed values such as `scale.title`, `scale.base`, and `scale.sm`. As a result, changing the dropdown appeared to do nothing.

The renderers now resolve a configured primary size with a block-specific fallback. Font sizing is supported across headers, store details, customer details, addresses, tables, jewelry sections, totals, payment, terms, compliance, footer, price, signatures, and custom fields.

The available scale now includes:

- Fine
- Extra small
- Small
- Base
- Large
- Extra large
- Title

A bold control was also added for applicable text blocks.

### Logo could not be resized

Logo height was previously hardcoded by paper type. A `logoHeight` value in millimeters was added to the block configuration and is respected by both renderers.

The properties panel includes:

- Small, medium, large, and extra-large presets
- Custom millimeter height
- Left, center, and right alignment
- Optional image URL override
- Automatic use of the store logo from General Settings

### Customer and address fields were incomplete

Customer blocks originally showed only name, email, and phone. Address blocks displayed one generic address string.

Customer blocks can now show selected fields including:

- Name
- Street address
- City, state, postal code, and country
- Phone
- Email
- Tax ID
- Passport

Address blocks can render billing address, shipping address, or both. Preview fixtures were expanded with realistic store, customer, billing, shipping, tax-ID, passport, and cashier data.

### Toolbar cleanup

The Duplicate, Versions, Delete, Print Preview, and Save Draft actions were converted to compact icon-only controls with browser tooltips. Print Preview uses a document-search icon instead of a generic printer icon. Publish remains a labeled primary action.

## Tenant Payment Method Rejected During Checkout

### Symptom

Duty-free checkout returned:

```text
Invalid payment method ID received: demo0001-jw00-0000-0000-00000000pm1
Valid system payment methods: cash, card, phone, on_account, none, stripe, paypal
```

### Root cause

The backend queried `payment_methods` only when the supplied ID matched a strict hexadecimal UUID regular expression. Demo payment IDs are valid opaque tenant IDs, but they are not RFC UUIDs. The lookup was skipped and the ID was compared only with the fixed system-code list.

### Fix

All values that are not already recognized system codes are now resolved through `payment_methods` using:

- The supplied payment method ID
- The authenticated tenant ID
- `is_active = 1`

This preserves legacy code callers while accepting tenant-owned opaque IDs and custom payment methods. Cross-tenant, inactive, and nonexistent methods remain rejected.

A regression test covers `demo0001-jw00-0000-0000-00000000pm1`.

## Missing Duty-Free Sales Columns

### Symptom

After fixing payment validation, sale creation failed with:

```text
Unknown column 'sales_mode' in 'field list'
```

### Root cause

The Sales Hub duty-free controller changes expected new columns, but the corresponding migration had not been applied to the connected database.

### Fix

The pending migration was applied:

```text
2026-09-01_pos_hub_duty_free_capture.sql
```

It added:

- `sales_mode`
- `zero_rate_reason`
- Traveller ID type, number, and country
- Travel method type, reference, and detail
- Destination
- Departure date
- Duty-free sales reporting index

After application, migration status reported no pending migrations and the duty-free tests passed.

## Stock Update Failed After a Successful Sale

### Symptom

Checkout completed, but the browser then called:

```text
PATCH /api/products/:id/stock
```

The request failed while inserting `stock_adjustments`:

```text
Cannot add or update a child row
stock_adjustments_ibfk_1
FOREIGN KEY (product_id) REFERENCES products (id)
```

### Root causes

There were two separate problems:

1. `products.id` used `CHAR(36)`, while `stock_adjustments.product_id` used `VARCHAR(36)`. The mismatched FK column definitions caused valid demo product IDs to fail the FK check.
2. The sale was committed first and inventory was updated later from the browser. This was non-atomic: a sale could succeed while inventory failed.

### Fix

The live schema was aligned so stock-adjustment FK columns use the same ID type as their parent tables. The FK was verified using an insert inside a rolled-back transaction.

Inventory deduction was then moved into the sale transaction:

1. Lock the tenant-owned product row with `FOR UPDATE`.
2. Calculate the new stock quantity.
3. Update the product.
4. Insert the `SALE_TRANSACTION` stock-adjustment record.
5. Commit inventory changes together with the sale and sale items.

The frontend post-checkout stock PATCH was removed, preventing both partial completion and double deduction. Serialized pieces continue through their existing piece-specific synchronization path.

The schema migration was applied to the active database as `2026-09-02_fix_stock_adjustment_fk_types.sql`. The migration source file was subsequently removed from the working tree, so it must be restored or replaced before deploying this schema correction to another database.

## Audit Logger Export Mismatch

### Symptom

The sale completed but logged:

```text
TypeError: logActivity is not a function
```

### Root cause

Several callers imported `logActivity`, while `auditLogService.js` exported only `logAuditEvent`, `logPrintJob`, and `logPrinterDeviceEvent`.

### Fix

A compatibility `logActivity` adapter was added. It maps legacy activity payloads onto `logAuditEvent`, including tenant, store, user, action, entity, details, IP address, and user agent.

Successful checkout now emits an audit entry similar to:

```text
[AUDIT] SALE_PROCESSED | Tenant: ... | User: ... | Entity: activity:<sale-id>
```

## Receipt Printing TypeScript Error

### Symptom

TypeScript reported:

```text
Type 'true' has no properties in common with type
'{ mode?: "print" | "view"; disableFallback?: boolean; }'
```

### Root cause

`showReceiptForSale` previously accepted a Boolean second argument, but its current API accepts an options object.

### Fix

The call was changed from:

```ts
showReceiptForSale(newSale, true)
```

to:

```ts
showReceiptForSale(newSale, {
  mode: 'print',
  disableFallback: true,
})
```

This preserves automatic printing without browser fallback.

## Logging Cleanup and Tenant Safety

The session also removed or gated excessive logging that printed every payment method and full sale payloads. Detailed sales diagnostics now respect `DEBUG_SALES=true`.

Payment-method display lookup and sale-item existence checks were scoped to the authenticated tenant. This avoids cross-tenant lookups while retaining useful fallback display behavior.

## Verification

The following verification was completed during the session:

- Frontend TypeScript and production build passed.
- Payment-method regression tests passed.
- Duty-free zero-rating and traveller-capture tests passed.
- Template, fixture, jurisdiction, and provisioning tests passed.
- Focused backend suite: 33 passing.
- Stock-adjustment FK insert verified against the live database inside a rolled-back transaction.
- Migration status reached zero pending migrations after applying the session migrations.
- Full backend suite reached 280 passing, 1 pending, and 16 unrelated pre-existing route-auth failures.
- Final manual checkout completed without payment, schema, stock, or audit errors.

## Operational Notes

- Run `npm run migrate:status` before testing newly added database-backed features.
- Run `npm run migrate` before starting the application when pending migrations exist.
- Inventory mutation should remain server-authoritative and part of the sale transaction.
- Treat payment method IDs as tenant-scoped opaque identifiers rather than assuming UUID format.
- Keep live preview and print HTML rendering driven by the same block configuration fields.
- The MySQL warning about `America/Antigua` indicates missing timezone tables on the database server. The application falls back to UTC; it did not block checkout.
