# Print Module — Phase 1: Store-Level Print Routes

**Status:** Code complete (2026-08-26). All 9 sequencing steps in §4 shipped —
migrations, backend, frontend, tests, docs. Two real bugs were found and
fixed during first live use (see Iteration 17.1/17.2 in the changelog). A later
logic audit found and Iteration 17.3 fixed two more runtime gaps: route
`template_id` was not honored and `auto_print` did not control initiation. The
redesigned path is automated-test complete but not field-proven. See §6
"Handoff / next session" before doing anything else.

See `docs/17-migration-and-roadmap/06_Implementation_Changelog.md`
Iteration 17 for the full build record and `CLAUDE.md`'s Print Module Phase 1
module status row. Remaining work is in "Pending after iteration 17" in that
changelog and §5 below.
**Scope:** A deliberately small slice of `PRINT_MODULE_FINAL_BLUEPRINT.md` — enough to kill
the legacy hardcoded receipt and let a tenant choose receipt vs. invoice format and a
delivery method per document type, at the **store level only**. This slice does not
integrate checkout with `print_stations`, durable `print_jobs`, retry/idempotency, or
label/tag routing. Those services/tables may exist from broader print-module work, but
they are not the orchestration path described by this Phase 1 document.

This document is the execution companion for this slice. It exists so the work can be
done one numbered step at a time, each one leaving the app in a working state.

---

## 0. Correction (2026-08-25, discovered while running the migration)

This document originally proposed a new table called `print_routes`. Running the
migration against the real database failed with `Unknown column 'document_type' in
'field list'` — because **`print_routes` already exists**, empty, alongside
`print_stations`, `printer_devices`, and `print_jobs`. Those four tables are an earlier,
partial attempt at the exact data model in `PRINT_MODULE_FINAL_BLUEPRINT.md` §5: a
generic condition-engine `print_routes` (`condition_type`/`condition_value` →
`printer_device_id`), with `printer_devices` carrying its own `device_type`/
`connection_type` enums. None of the four tables are referenced anywhere in the
application code (confirmed by a full-repo grep) — the schema was provisioned ahead of
the build and then the work stopped.

That schema doesn't have `template_id`, `copies`, `auto_print`, or `paper_width`, and
`printer_devices.connection_type` has no `local_agent` option, which the app already
depends on today. Adopting it as-is for this phase would mean building real
station/device modeling now — explicitly out of scope per §1 below.

**Decision:** everything in this document below still applies, but the new table is
named **`print_document_settings`**, not `print_routes`. The pre-existing
`print_routes`/`print_stations`/`printer_devices`/`print_jobs` tables are left
untouched. Whether to migrate onto them for real is a decision for whichever later
milestone actually builds station-level routing — not something to back into via a
naming collision. Every other reference to "print_routes" further down in this document
should be read as `print_document_settings`.

## 1. Decisions already made (2026-08-25 conversation)

- Full per-counter/station print configuration is **out of scope for this phase**.
  Everything here is one row per `(tenant_id, store_id, document_type)`. The schema
  still carries a nullable `station_id` column so a later phase can add station-level
  overrides without another migration — but nothing populates or reads it yet.
- Label/tag printing stays untouched (own system, own future milestone — blueprint
  Milestone 6). This phase does not add a `label` document type to the new table.
- No prior "iRestrack" print-agent documentation exists in this repo. The improvements
  to the Local Agent in this phase are limited to passing the already-designed
  `documentType`/`copies` fields through its existing payload — not a rewrite of the
  agent protocol. Full Local Agent v1 (offline queue, signed job auth, device
  registration) stays blueprint Milestone 4/§7, deferred.
- The existing `print_templates` / `printTemplateRenderer.ts` / `renderSaleWithTemplate`
  system (the "Print Template Designer") is kept and becomes the **only** renderer.
  The hardcoded HTML in `receiptService.ts` is deleted, not hidden behind a flag.

## 2. Current state (confirmed by audit, 2026-08-25)

Three parallel/overlapping systems exist today:

| System | Table | Status |
|---|---|---|
| Print Template Designer | `print_templates` | The only current sale-document renderer; supports `receipt`/`invoice`/`jewelry_invoice`/`return` and additional non-checkout types |
| Legacy hardcoded receipt | none (formerly inline HTML in `receiptService.ts`) | Removed; do not restore it as a fallback |
| Retired "Receipt Template" dropdown | `receipt_templates` | CRUD removed; do not reintroduce this parallel template system |

Root cause of "new templates never print": `frontend/src/services/printerService.ts`'s
`getPrinterSettings()` builds its return object from an explicit field allowlist that
never includes `use_print_templates`/`usePrintTemplates`. The flag is saved correctly by
the backend and immediately lost on every read back, so `receiptService.ts`'s check
`printerSettings?.usePrintTemplates` is always false in production.

## 3. Target shape for this phase

### 3.1 New table: `print_document_settings` (store-level compatibility layer)

```sql
CREATE TABLE print_document_settings (
  id CHAR(36) PRIMARY KEY,
  tenant_id CHAR(36) NOT NULL,
  store_id CHAR(36) NOT NULL,
  station_id CHAR(36) NULL,              -- unused this phase, reserved
  document_type ENUM('receipt','invoice') NOT NULL,
  delivery_mode ENUM('browser','direct','local_agent') NOT NULL DEFAULT 'browser',
  printer_name VARCHAR(255) NULL,
  paper_width INT NOT NULL DEFAULT 80,   -- receipt: 58/80/110mm; invoice: ignored (A4/Letter)
  template_id CHAR(36) NULL,             -- FK -> print_templates.id
  copies INT NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  auto_print BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_store_doc_type (tenant_id, store_id, document_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

Notes:
- One row per store per document type. A store that only sells retail (no jewelry
  invoices) simply never gets an `invoice` row until it needs one — nothing requires
  both rows to exist.
- `document_type = 'receipt'` covers **both sale receipts and refund slips** (matches
  the physical reality: same receipt printer). `renderReturnWithTemplate` already falls
  back to the `receipt` template type when no dedicated `return` template exists, so no
  schema change is needed to support refunds through this same row.
- The **tenant's receipt-vs-invoice choice for POS checkout** (point 4 of the original
  ask) is which row(s) exist / which one `sales/services` reads for a given sale, not a
  new column — see §3.3.
- Idempotent migration, following repo convention (`INFORMATION_SCHEMA.COLUMNS`/`TABLES`
  check + `PREPARE/EXECUTE`), file:
  `database/migrations/2026-08-25_print_document_settings.sql`.

### 3.2 Migration/compatibility step

The same migration:
1. Creates `print_document_settings` if missing.
2. Backfills one `receipt` row per existing `printer_settings` row (store-level),
   copying `enabled`, `auto_print`, `print_mode → delivery_mode`, `printer_name`,
   `paper_width`, `template_id` (only if it's a real `print_templates` UUID — the old
   `receipt_templates` id values and the `'standard'/'compact'/'detailed'` system
   placeholders do not carry over, since that table is being retired).
3. Does **not** drop `printer_settings` yet — it stays as a read-only historical table
   for one release cycle, in case a rollback is needed, then removed in a follow-up
   migration once Phase 1 has run in production without issues.

### 3.3 Which document type a sale prints as

Store-level setting, no new table: a `stores` (or `tenant_pricing_settings`-style
per-store settings) column `default_sale_document_type ENUM('receipt','invoice')
DEFAULT 'receipt'`. POS checkout reads this to decide whether `getReceiptForSale`
resolves the `receipt` or `invoice` row from `print_document_settings`. This keeps the
default sale-document choice explicit rather than inferring it from which settings rows
happen to exist.

### 3.4 Backend

- `backend/controllers/printDocumentSettingsController.js` provides
  `GET /api/settings/print-document-settings/:storeId` (returns both route-family rows,
  filling in-memory defaults when missing), `PUT
  /api/settings/print-document-settings/:storeId/:documentType` (compatibility upsert),
  and the current default-format endpoint.
- `backend/routes/printerSettings.routes.js` mounts those routes. The redesign plan
  replaces the three independent writes with one validated transactional save endpoint.
  The old `PUT/GET /settings/printer/:storeId` endpoints remain only for the rollback
  window and must not be used by new Printer Settings work.
- Delete `getReceiptTemplates` / `getReceiptTemplate` / `createReceiptTemplate` /
  `updateReceiptTemplate` / `deleteReceiptTemplate` and their routes. Nothing in the new
  UI calls them.

### 3.5 Frontend

- `frontend/src/services/printDocumentSettingsService.ts` is the thin fetch wrapper and replaces the
  parts of `printerService.ts` concerned with settings (the printing/adapter functions
  in `printerService.ts` — `printReceipt`, local-agent helpers — stay, they're
  delivery-mechanism code, not settings storage).
- `receiptService.ts`: delete `generateReceiptHtml` and the hardcoded HTML branch of
  `getReceiptForReturn`. `getReceiptForSale`/`getReceiptForReturn` always call
  `renderSaleWithTemplate`/`renderReturnWithTemplate`; if that returns `null` (no
  published template), surface a clear error toast telling the cashier/admin a receipt
  template needs to be published, rather than silently printing nothing or a fake
  document. This is safe **only after** step 4 below ships, so every tenant has a
  published default before the fallback disappears.
- `PrinterSettings.tsx` redesign: two sections, "Sales Receipt & Refunds" and
  "Invoices", each independently configurable (enabled, delivery mode, printer
  name/paper width when relevant, template picker sourced from `print_templates`
  filtered by type, copies, auto-print). A top-level "Print sales as" choice
  (Receipt / Invoice) drives `default_sale_document_type`. A disabled "Labels & Tags —
  configure in Label Printer Settings" row links to the existing, untouched
  `LabelPrinterSettings.tsx` rather than pretending it's part of this table.
- Header/Footer free-text fields are removed from Printer Settings — they become blocks
  inside the template itself (already supported by the Designer), so editing them now
  means editing the template, not a parallel settings field.

### 3.6 Local Agent payload (small, contract-preserving change only)

`printViaLocalAgent` in `printerService.ts` gains `documentType` and repeats the payload
`copies` times (or passes `copies` through if/when the agent build supports a native
`copies` field — check before assuming, since the agent binary is external and versioned
separately). No other agent protocol change this phase.

## 4. Sequencing (execute one at a time, verify before moving on)

1. **Bug fix** — `getPrinterSettings()` maps `use_print_templates` correctly. Smallest
   possible change, immediately makes the existing (unused) template path reachable for
   manual testing of everything that follows.
2. **Migration** — `print_document_settings` table + backfill from `printer_settings`, run against
   a copy of a real dataset, verify row counts match.
3. **Template provisioning** — confirm/extend `retailProfileService`'s `templatePlan` so
   every profile includes a default `receipt` entry (and `invoice` where the profile
   calls for it); run `provisionTenantTemplates` for existing tenants missing one.
4. **Backend routes/controller** for `print_document_settings`.
5. **Frontend service** (`printDocumentSettingsService.ts`) + **delete legacy HTML generators** in
   `receiptService.ts`/return path.
6. **PrinterSettings.tsx redesign.**
7. **Copies end-to-end** (route field → `printReceipt` → local agent payload/direct-print
   loop → browser print, where "copies" has no reliable browser API and is documented as
   such rather than faked).
8. **Retire `receipt_templates`** (backend routes/controller functions + frontend
   service functions removed).
9. **Docs** — `CLAUDE.md` + `06_Implementation_Changelog.md` updated; this file's
   "Status" flipped to Done, with a note on what moved to a later phase.

Each numbered step ships with its own tests (backend Mocha / frontend Vitest as
applicable) and is a separate, revertible unit of work — nothing here is a big-bang
cutover.

## 5. Explicitly deferred to a later phase (do not build now)

- `print_stations`, station-level routing precedence.
- `print_jobs` (durable job records, idempotency keys, retry policy, job history UI).
- Full Local Agent v1 protocol (`/v1/health`, `/v1/devices`, offline queue, device
  registration/revocation, signed job auth).
- Label/tag template system (DPI-aware ZPL/TSPL designer, media profiles).
- Duty-free jurisdiction template work beyond what already exists.
- Any mobile-shell-specific client code — this phase only keeps the contract clean
  enough that a future WebView client could reuse it.

## 6. Handoff / next session

The approved logic and UX redesign plan for Printer Settings is documented in
`PRINTER_SETTINGS_UX_AND_LOGIC_REDESIGN_PLAN.md`. Read that plan before changing
the current **Print Sales As** section. It records the confirmed runtime gaps
(`template_id` is not honored and `auto_print` does not govern printing), the
target information architecture, validation/atomic-save contract, phased task
list, test matrix, and field-proving definition of done.

All code, migrations, and docs for this phase are written and committed. What's
NOT yet true: a clean, uninterrupted live checkout through the new path has never
been observed end to end — every attempt so far has surfaced a real bug (see
below), fixed, then not re-verified past the next step. Treat this feature as
**code-complete but not yet field-proven**.

### Do this first, in order

1. **Confirm both new migrations are actually applied** to whatever database
   you're pointed at:
   ```
   cd backend && npm run migrate:status
   ```
   Both `2026-08-25_print_document_settings.sql` and
   `2026-08-25_default_sale_document_type.sql` must show as applied. If either
   is pending, `npm run migrate` (take a backup first per the runner's own
   prompt). A missing `default_sale_document_type` column is exactly what
   caused the `ER_BAD_FIELD_ERROR` in Iteration 17.2 below.
2. **Confirm every real tenant has published templates**:
   ```
   npm run provision:missing-templates:dry
   ```
   Should report 0 missing. If not, run it for real (drop `:dry`).
3. **Open Printer Settings for a real store** and confirm it loads without a
   console error (this is what caught both bugs in 17.1/17.2 — check the
   browser console, not just that the page renders).
4. **Run a real POS sale to completion** for a store with receipt printing
   enabled, browser delivery mode. Confirm:
   - the printed/previewed receipt uses the Print Template Designer layout
     (logo, configured blocks), not the old plain layout from the original
     bug report,
   - the sale completes and stock deducts correctly (unrelated regression
     check, cheap to confirm at the same time),
   - no console errors.
5. **Switch a store to "Print sales as Invoice"** in the new Printer Settings
   UI, save, and confirm a completed sale now renders through the
   `invoice`/`jewelry_invoice` template instead.
6. **Set copies to 2 on a store using `direct` or `local_agent` delivery**
   (browser mode cannot be tested for this — see the UI's own hint) and
   confirm two print attempts actually fire. If no direct/local-agent printer
   is available to test against, at minimum confirm via server/browser logs
   that `printReceipt` is called with `copies: 2` and loops accordingly.

### Bugs found and fixed so far (read before assuming anything works)

Both were caught by the person using the feature, not by the test suite —
the test suite was written to lock in the fix *after* the fact, which is why
step 3 above (open the page yourself) matters more than "tests are green."

- **Iteration 17.1**: `printDocumentSettingsController.js` destructured
  `pool.query()`'s return value as a `[rows, fields]` tuple, but the
  require-style used in this file (`const pool = require('../config/db')`)
  returns the rows array directly — silently grabbed row zero instead of
  the array, `.map()`/`.find()` threw, surfaced as a 500 on every GET. Same
  latent bug existed in `printerSettingsController.js`'s
  `updatePrinterSettings`/`testPrintSettings`, fixed in the same pass.
- **Iteration 17.2**: `default_sale_document_type` migration was written
  and syntax-tested but never actually run against the real database before
  the feature was declared done — the column didn't exist yet, so any
  `GET`/`PUT` touching it failed with `ER_BAD_FIELD_ERROR`.

Neither of these was caught by `tsc`, the Mocha suite, or the Vitest suite —
all of which were green throughout. **This is the tell**: this feature's
risk lives in things static checks and unit tests structurally cannot see —
a genuinely wrong destructuring assumption about a runtime library's return
shape, and a migration that was authored but never executed. Before marking
any further step "done," actually run it against a real database and open
the real page, the way the person testing this did both times.
