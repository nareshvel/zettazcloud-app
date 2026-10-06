# 2026-09-01 — Product import errors, modal scroll/responsiveness, and verbose logging cleanup

Session record covering three issues found while testing the bulk product import
flow on an apparel tenant: a modal that trapped the user on the preview step, two
distinct import failure modes that produced unhelpful error messages, and a large
volume of backend console noise that made it hard to tell whether the import was
even working. Kept as a single doc since they were diagnosed together during one
import attempt.

---

## 1. Import modal: preview step had no scroll, buttons pushed off-screen

**Symptom:** After uploading a spreadsheet and mapping columns, the preview step
showed the duplicate-handling selector, the share-across-stores checkbox, and the
preview table — but on a normal-sized screen the "Start Import" button was below
the fold and unreachable. The modal had no scroll, so the user was stuck and
could not proceed.

**Root cause:** The modal container (`ProductImport.tsx`'s root `<div>`) had no
max-height or flex layout. The content area used `p-6 min-h-[300px]` with no
`overflow-y-auto`, so the content grew unbounded and pushed the footer (with the
Previous/Start Import buttons) off-screen. The mapping step's inner scroll
container used a fixed `max-h-96` which didn't adapt to viewport height, and the
preview table used `overflow-x-auto` only (no vertical scroll).

**Fix (`frontend/src/components/inventory/ProductImport.tsx`):**
- Modal container: added `max-h-[90vh] flex flex-col` so the modal never exceeds
  the viewport.
- Content area: changed to `p-4 sm:p-6 overflow-y-auto flex-1` — content scrolls
  independently while header and footer stay fixed.
- Header and footer: added `shrink-0` so they're never squeezed off-screen.
- Mapping step: `grid-cols-2` → `grid-cols-1 sm:grid-cols-2` (stacks on mobile),
  `max-h-96` → `max-h-[50vh]` (viewport-relative).
- Preview table: `overflow-x-auto` → `overflow-auto max-h-[40vh]` (scrolls both
  directions with a height cap).
- Padding and font sizes made responsive (`p-4 sm:p-5`, `text-lg sm:text-xl`).

---

## 2. Import error messages: "Attribute validation failed" with no detail

**Symptom:** Five rows failed with `Attribute validation failed` and three more
with `This feature is not available for your business type (apparel)`. Neither
message told the user what was actually wrong or how to fix the spreadsheet.

### 2a. Attribute validation errors

**Root cause:** The backend (`product.routes.js` line ~519) returns
`{ message: 'Attribute validation failed', errors: ['Size is required', ...] }`
— the specific field-level errors are in the `errors` array. The frontend import
error handler only read `error.message`, discarding the `errors` array entirely.
The user saw "Attribute validation failed" with no indication of which fields
were missing or invalid.

**Fix (`ProductImport.tsx`):** Both the create and update error handlers now
extract `error.response.errors` (or `error.response.data.errors`) and append
them to the displayed message. Now the user sees:
> Row 1 (Urban Edge Black Boots): Attribute validation failed: Size is required, Color is required

### 2b. Serialized piece creation on non-jewelry tenants

**Root cause:** The import offered a `pieceBarcode` ("Piece Barcode/Serial")
column for all tenants. If a row had a value in that column, the import
attempted to create a serialized piece via `POST /api/product-pieces`. That
endpoint is gated behind `requireIndustry(['jewelry', 'electronics'])` in
`productPieces.routes.js`. For an apparel tenant, every piece creation call was
rejected with 403 "This feature is not available for your business type
(apparel)".

**Fix (`ProductImport.tsx`):** Two layers:
1. The `pieceBarcode` column is now only included in `baseColumnDefinitions`
   (and therefore the mapping dropdown and template download) when
   `tenantIndustry === 'jewelry' || tenantIndustry === 'electronics'`. The
   tenant's industry is resolved on mount via `getTenantIndustry()`.
2. Defensive fallback: if a file already has a `pieceBarcode` column mapped
   (e.g. from a previous session before this fix), the import silently ignores
   it for non-jewelry/electronics tenants instead of failing — the product is
   still created normally with flat stock quantity.

---

## 2c. No pre-import validation — bad attribute values only failed at POST time

**Symptom (found in a later test on the same apparel tenant, after 2a/2b above
were already fixed and deployed):** an import of 5 rows reported "Successfully
imported: 0, Skipped duplicates: 2, Failed to import: 3" with three rows
failing `Attribute validation failed: Size must be one of: XS, S, M, L, XL,
XXL, 3XL`. The detailed message from fix 2a was working correctly — but the
user only found out a value was wrong for each row one `POST /api/products`
call at a time, after every row had already been sent to the backend.

**Root cause:** the preview step showed a data table but never validated it.
Column mapping validation (`validateMapping`) only checks that required
*columns* are mapped, not that individual *cell values* satisfy each
industry attribute's constraints (required, select options, numeric). The
tenant's field schema — including each select field's allowed `options` — was
already being fetched on mount (`industryFields`, used to build the
`attr_`-prefixed mapping columns) but was never used to check the actual
uploaded values before import started.

**Fix (`ProductImport.tsx`):** added `validateAllRows()`, run against every
mapped row (not just the 10 shown in the table) the moment the user moves
from Column Mapping to Preview. It mirrors
`industryFieldService.validateAttributes`' rules client-side: Product
Name/Price required-and-numeric checks, plus for each industry attribute
field — required, select-must-be-one-of-options, number/decimal-must-parse.
Rows with problems populate `previewValidationErrors` and render as a red
banner on the Preview step listing every failing row, its product name, and
its specific errors (capped at 50 shown, with a "...and N more" tail). The
"Start Import" button is disabled (with a tooltip) while any validation
errors exist — the user must go back and remap, or fix the spreadsheet and
re-upload, before the import can run at all. The backend's own validation in
`product.routes.js`/`industryFieldService.js` is unchanged and remains the
real enforcement boundary; this is purely a UX pre-check to avoid the
one-row-at-a-time discovery loop.

---

## 3. Preview step: no product count shown

**Symptom:** The preview step said "Review the data below before importing" but
didn't tell the user how many products were in the file, so there was no quick
sanity check before committing to the import.

**Fix (`ProductImport.tsx`):** The preview description now shows the total row
count from `fileData.length`:
> **25** products ready to import. Showing the first 10 rows below for preview.

Also corrected the text from "first 5 rows" to "first 10 rows" (the code
actually slices to 10, not 5).

---

## 4. Backend verbose logging cleanup

**Symptom:** During a 100-row import, the backend console printed ~15 lines per
product (SQL statement, full values array, is_active debug, tax class debug,
success message, timezone warning) — over 1,500 lines for a single import run.
This made it impossible to spot real errors in the noise and wasn't actionable
information in normal operation.

### 4a. Product routes (`backend/routes/product.routes.js`)

17 unconditional `console.log` calls gated behind a new `DEBUG_PRODUCTS` flag
(off by default). Affected logs:
- `[Products API Router POST] Received req.body.is_active: ...` (every product)
- `[Products API Router POST] Calculated isActive boolean: ...` (every product)
- `[Product API] No tax class provided...` (every product without a tax class)
- `Executing SQL: ...` + `Final raw sqlValues for query: [...]` (full SQL dump)
- `[Products API Router] Product created successfully...` (every product)
- All `[Product Update ...]` debug logs (11 lines: update fields, SQL, WHERE
  conditions, pre-update checks, result analysis, success message)
- Auto-created category/tax class logs, image deletion logs, search result logs

To re-enable: set `DEBUG_PRODUCTS=true` in `backend/.env`.

### 4b. Auth middleware (`backend/middleware/unifiedAuthMiddleware.js`)

7 unconditional `console.log` calls in the login handler gated behind a new
`DEBUG_API` flag (off by default). Affected logs:
- `[RBAC] Loaded RBAC data for user...`
- `Debug - Login context: {...}`
- `[RBAC] Validated RBAC data for user...`
- `[RBAC] Token payload RBAC data: {...}`
- `[LOGIN] Attempting to update last_login_at...`
- `[LOGIN SUCCESS] Updated last_login_at...`
- `[LOGIN VERIFY] User ... last_login_at is now: ...`

To re-enable: set `DEBUG_API=true` in `backend/.env`.

### 4c. Timezone warning deduplication (`backend/config/db.js`)

`setSessionTimeZone()` warned on every connection when the MySQL server doesn't
recognize the IANA timezone name (e.g. `America/Antigua` — many MySQL installs
don't load the `mysql.time_zone_name` table). During a bulk import, this fired
on every single product creation. The fallback to UTC was already correct; the
warning was just noise.

**Fix:** The warning now fires at most once per unique timezone string per
process lifetime, using a `Set<string>` (`_warnedTimezones`). The UTC fallback
behavior is unchanged.

**Follow-up (same day): the UTC fallback itself was silently wrong, not just
noisy.** For a store like `America/Antigua` (UTC-04:00, no DST), falling back
to UTC was a full 4-hour error on every date/time-sensitive query run in that
session — not just a cosmetic log message. Since MySQL was missing the
`mysql.time_zone_name` table (common on shared hosting, and not something a
tenant-facing app should require the hosting provider to load), `setSessionTimeZone()`
(`backend/config/db.js`) now resolves the IANA zone to its current fixed UTC
offset using Node's own `Intl.DateTimeFormat(..., { timeZoneName: 'longOffset' })`
— no MySQL tz tables needed — and sets that (e.g. `-04:00`) instead of
collapsing straight to UTC. Only falls back to true UTC if that resolution
also fails (i.e. `tz` isn't a real IANA zone at all). The warning is now
explicit about which of the two actually happened, and still fires at most
once per unique timezone. **Known limitation:** the offset is computed at
the moment the connection is opened, so a zone that observes DST (unlike
Antigua) could get a slightly wrong offset for timestamps far in the past or
future relative to that moment — the real fix for DST-observing zones is
still to load `mysql.time_zone_name` via `mysql_tzinfo_to_sql` on the MySQL
server; this change only closes the gap for the common case of a fixed
year-round offset.

### 4d. Leftover Chromium debug alert (`frontend/src/services/authService.ts`)

A "temporary" debugging `alert()` that showed a raw technical error message
(`CHROMIUM LOGIN ERROR: ...`) on every login failure in Chromium-based browsers.
This was never meant to ship and was confusing to end users. Removed entirely.

---

## Files changed

| File | Change |
|---|---|
| `frontend/src/components/inventory/ProductImport.tsx` | Modal scroll/responsiveness, product count in preview, detailed error messages, conditional pieceBarcode column, pre-import validation of all rows against the industry attribute schema with a blocking error banner on the Preview step |
| `frontend/src/services/authService.ts` | Removed leftover Chromium debug alert |
| `backend/routes/product.routes.js` | 17 `console.log` calls gated behind `DEBUG_PRODUCTS` |
| `backend/middleware/unifiedAuthMiddleware.js` | 7 `console.log` calls gated behind `DEBUG_API` |
| `backend/config/db.js` | Timezone warning deduplicated to once per unique tz; unresolvable IANA zones now resolve to their real fixed UTC offset via Intl instead of silently using UTC |

## Not done / known limitations

- No automated test was added for the import error-message detail extraction
  (the error shape comes from `fetchApi`'s error construction, which varies by
  backend response shape — a live test against a real backend is the reliable
  verification path).
- The `pieceBarcode` column suppression is frontend-only. A determined caller
  could still POST to `/api/product-pieces` directly and get the 403 — the
  backend's `requireIndustry` gate is the real security boundary and is
  unchanged.
- The timezone warning deduplication is per-process. If the backend restarts
  mid-import (nodemon restart, PM2 reload), the warning will fire once more
  after restart. This is acceptable — the point was to stop the per-row spam,
  not to suppress the warning permanently.
- The new pre-import validation (2c) does not check for duplicate SKUs
  *within the uploaded file itself* (only against the existing catalog, which
  `handleImportProducts` already handled via `duplicateHandling`) — two rows
  in the same file with the same SKU will both attempt to import and the
  second will be caught by the existing in-catalog duplicate check only after
  the first has already been created. Not fixed here; flagged as a follow-up
  if it turns out to matter in practice.
- Client-side validation intentionally duplicates a subset of
  `industryFieldService.validateAttributes`' rules rather than calling a
  shared endpoint — if that service's validation rules change in the future,
  `ProductImport.tsx`'s `validateAllRows()` needs to be updated to match or
  the preview check can drift out of sync with what the backend actually
  enforces.
