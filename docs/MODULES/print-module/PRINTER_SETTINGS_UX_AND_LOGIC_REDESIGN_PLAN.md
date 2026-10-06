# Printer Settings — UX and Logic Redesign Plan

**Status:** Core implementation complete; field QA required  
**Created:** 2026-08-26  
**Scope:** Settings → Printer, especially the current **Print Sales As** workflow  
**Parent handoff:** `PHASE_1_STORE_LEVEL_ROUTES.md`  

## Implementation progress

Completed in Iteration 17.3:

- Explicit route `template_id` is honored by the sale renderer.
- Auto Print off/on/disabled/view behavior is implemented and unit-tested.
- Receipt, invoice, and default format save through one validated transaction.
- Template publication/type/store applicability is validated.
- Tenant-wide templates are visible alongside store templates.
- Default-template updates no longer unset defaults belonging to another store.
- Explicit receipt and invoice media values are implemented and migrated.
- The Printer Settings information architecture and effective-workflow summary are implemented.
- Route-level test printing uses current unsaved values and no longer calls the legacy generic test endpoint.
- Migration status is clean and template provisioning reports zero missing.

Still required before field-proven status:

- Complete every manual item in Phase G against the real Settings page and supported printers.
- Confirm duty-free and domestic template suitability in real store data.
- Confirm Local Agent/direct behavior and copies on actual hardware.
- Re-engineer any interaction or workflow that field QA shows is still unclear.

## 1. Purpose

The current Printer Settings page exposes most of the data required for store-level receipt and invoice printing, but its controls do not form a clear operational workflow. It combines document policy, template selection, page/media selection, delivery routing, printer choice, copies, and automatic printing without showing how those decisions depend on one another.

Two visible controls are also not truthful at runtime:

1. The saved `template_id` is not passed to the sale renderer, so the selected template does not necessarily print.
2. `auto_print` is not checked before printing; an enabled route prints even when Auto Print is off.

This plan corrects the runtime behavior first, then redesigns the page around the actual decision sequence:

```text
Document policy → Template → Media → Delivery → Device → Print behavior
```

The goal is not merely a cleaner page. The goal is a configuration that is difficult to misunderstand and impossible to save in a contradictory state.

## 2. Alignment decisions and terminology

These decisions are authoritative for this redesign. They resolve naming and ownership ambiguity between Printer Settings, Print Templates, retail profiles, duty-free provisioning, and the broader print module.

### 2.1 Print Templates remain the only renderer

All sale, invoice, jewelry-invoice, and refund documents must render through `print_templates` using the existing structured blocks and print renderer. This redesign does not add a second template system, restore `receipt_templates`, or add hardcoded receipt/invoice HTML.

Printer Settings chooses **which published Print Template is used** and how its output is delivered. Template content—logo blocks, store/customer fields, item table, totals, legal text, footer, typography, and layout—continues to be edited only in Print Templates.

### 2.2 Route family is not the same as template type

`print_document_settings.document_type` is a delivery-route family, currently limited to:

- `receipt`
- `invoice`

`print_templates.template_type` is a document/layout taxonomy and includes:

- `receipt`
- `invoice`
- `jewelry_invoice`
- `jewelry_certificate`
- `return`
- `document`
- `label`

The mapping for this phase is:

| Route family | Compatible template types | Purpose |
|---|---|---|
| Receipt | `receipt` | Default compact sale output |
| Invoice | `invoice`, `jewelry_invoice` | Default formal sale output; vertical-specific invoice is allowed |
| Refund compatibility path | `return`, then documented `receipt` fallback | Refund / Credit Note until a dedicated route exists |

A jewelry invoice remains a `jewelry_invoice` template. It is not converted to `invoice`; it is selected by the Invoice route family.

Certificates, labels, and generic documents are not selectable as the default checkout document in this phase.

### 2.3 The route's explicit template is the runtime source of truth

For a configured store route, `print_document_settings.template_id` is authoritative. The renderer must use that exact compatible, published template.

`print_templates.is_default` is only a fallback/provisioning concept when a route has no explicit template. It must not override an explicit route selection.

This distinction is especially important because the current `is_default` update logic is tenant-and-template-type scoped, not store scoped. Publishing a default template can unset another store's default of the same type. The redesign must not depend on global `is_default` behavior for normal printing. A follow-up task must either make default semantics explicitly tenant-wide or scope them correctly by store; until then, explicit route `template_id` prevents cross-store ambiguity.

### 2.4 Template store scope must be explicit

A selected template must satisfy one of these applicability rules:

- It belongs to the current store, or
- It is intentionally tenant-wide (`store_id IS NULL`) and the product supports tenant-wide templates.

The current template list service applies an exact `store_id = ?` filter when a store is supplied. Implementation must decide and test whether tenant-wide templates are supported. The UI and backend must use the same rule; neither may show a template the renderer cannot load.

### 2.5 Duty-free is a sales mode, not a route family

Duty-free does not create a third `print_document_settings` route family. It affects template suitability and document content.

For a duty-free store:

- The selected Invoice route should normally point to the provisioned Duty-Free Invoice (`jewelry_invoice` for jewelry).
- Non-jewelry stores may use the provisioned duty-free receipt where appropriate.
- The selected template must contain the correct duty-free/compliance blocks for the store's sales mode.
- Renderer data still comes from the completed sale's frozen `sales_mode`, `zero_rate_reason`, and traveller fields; the current store setting must not rewrite historical documents.

The UI should mark templates with relevant sales-mode suitability where this metadata is available. It must not silently choose a domestic invoice merely because it is a default template of the same type.

### 2.6 Default sales document and route availability

`stores.default_sale_document_type` chooses the route family used automatically after checkout: Receipt or Invoice.

The active default route is always available and cannot be disabled. For the inactive alternate route, **Available for printing** means it can be generated manually or selected by a future checkout override; it does not mean it prints in addition to the default document.

This phase produces one default customer document after checkout, not both. Producing both receipt and invoice is a future policy option and must not be implied by enabling both routes.

### 2.7 Auto Print controls initiation, not generation

The document is generated through Print Templates whenever checkout or a view/reprint action requests it. Auto Print controls only what happens after generation:

- Off: show preview/manual Print action.
- On with browser delivery: open the browser print dialog.
- On with an agent-supported route: send to the configured printer.

### 2.8 Refunds remain distinct

A refund is a Refund / Credit Note (`return` template), not a sale receipt and not controlled by `default_sale_document_type`.

During this redesign, the existing receipt-route fallback may remain for delivery compatibility, but the UI and documentation must identify it as a temporary mapping. A dedicated refund route is deferred and must not be accidentally added to the Phase 1 schema without a deliberate migration and runtime design.

### 2.9 Print jobs and store-level settings are separate layers

The repository already contains print-job services, adapters, routes, and history UI from broader print-module work. The Phase 1 checkout path described here does not yet use durable `print_jobs` as its delivery orchestration layer.

This redesign configures the current store-level render/delivery path. It must not claim print jobs do not exist, and it must not quietly migrate checkout onto them. Integrating store settings with durable print jobs, retries, idempotency, and station routing is a separate explicit milestone.

### 2.10 Labels stay separate

Label and tag templates remain in the existing label-printing system. They do not use the Receipt/Invoice route family and are not part of the default sales document choice.

## 3. Product principles

### 3.1 Show the effective outcome

The page must answer this question without requiring the user to mentally combine several controls:

> What exactly happens after checkout at this store?

Example:

```text
After checkout
Jewelry Invoice → Standard Jewelry Invoice → A4 → Local Agent → Office Laser → 2 copies
```

### 3.2 Separate policy from delivery

These are different decisions and must not be presented as equivalents:

- **Document policy:** Receipt or Invoice is the default customer document after a sale.
- **Template:** Which published layout renders that document.
- **Media:** Thermal width or full-page size.
- **Delivery:** Browser dialog, Local Agent, or a supported registered printer.
- **Print behavior:** Preview/manual print or automatic print.

### 3.3 Never silently repair invalid settings

The API must reject incompatible configurations with field-level errors. It must not silently:

- Replace an unknown delivery mode with browser mode.
- Drop an invalid template ID and save `NULL`.
- Save an active document route without a compatible published template.
- Accept a direct/agent route with no usable printer.
- Save the selected default document as disabled.

### 3.4 Use progressive disclosure

Most stores should only need to configure the active sales route. The inactive alternate format and advanced delivery options should be available without dominating the first screen.

### 3.5 Preserve field-proven fallbacks

Browser printing is the safest baseline. Advanced delivery must not be presented as ready unless it has been field-proven against the supported printer/agent path.

### 3.6 Keep future station routing possible

Phase 1 remains store-level. The UI must clearly state that a Local Agent printer selection currently applies store-wide and should be configured from the checkout workstation. Station/register overrides remain a later architecture milestone.

### 2.11 Terminology used in the UI

Replace **Print Sales As** with:

> **Default document after checkout**

Supporting text:

> Choose the primary customer document created when a sale is completed at this store.

Options:

#### Receipt

> Compact counter document for walk-in retail. Uses thermal media such as 58 mm or 80 mm.

#### Invoice

> Formal full-page customer document for account, business, high-value, or regulated sales.

The word **default** is essential. It accurately matches `stores.default_sale_document_type` and leaves room for future per-sale overrides.

## 4. Target information architecture

### 4.1 Section A — Default document after checkout

Use two selectable cards rather than plain buttons. Each card contains:

- Document icon
- Receipt or Invoice title
- Short operational description
- Typical media
- Selected indicator

Below the cards, show:

```text
Refund document: Refund / Credit Note
```

Refund behavior must not be implied by the sales document selector.

### 4.2 Section B — Effective workflow summary

Show a live summary derived from unsaved form state.

Example:

```text
Sales
Invoice → Standard Jewelry Invoice → A4 → Browser print dialog

Refunds
Refund / Credit Note → 80 mm → Local Agent → Receipt Printer
```

Summary states:

- **Ready:** all required values resolve.
- **Needs attention:** a recoverable configuration issue exists.
- **Unavailable:** the selected route cannot print.

Warnings must link/focus the corresponding field.

### 4.3 Section C — Active sales output

Initially show only the configuration for the selected default document.

Control order:

1. Template
2. Media/page size
3. Delivery method
4. Printer/device
5. Print automatically
6. Copies
7. Test this route

This follows the user's real decision process.

### 4.4 Section D — Refund / Credit Note output

Refunds need an explicit route and document identity. If Phase 1 continues sharing the receipt route internally, the UI must say so clearly:

> Refunds currently use the receipt delivery route. A dedicated credit-note route will be added in a later phase.

Do not label all refunds as receipts when the template registry supports a `return` document type.

### 4.5 Section E — Additional document formats

Place the inactive sales format in a collapsed section:

> Additional document formats

This allows an invoice-first store to retain receipt configuration without forcing both cards into the primary flow.

### 4.6 Section F — Labels & Tags

Keep label printing separate. Show a clear link to Label Printer Settings rather than mixing label-specific devices, DPI, ZPL/TSPL, or media into this store-document flow.

## 5. Delivery model

Use truthful delivery names:

### Browser print dialog

- Works without agent installation.
- User selects the printer and copies in the browser/system dialog.
- Application cannot reliably preset copies.
- Auto Print means automatically opening the print dialog, not silent printing.

### Zettaz Print Agent

- Enables silent/local-system printing.
- Printer list comes from the current workstation.
- Must show live agent status.
- Must explain store-wide scope during Phase 1.
- Copies can be sent programmatically.

### Registered network printer

Only expose this when the device registry and actual adapter path are field-proven. Do not label a generic `direct` mode as “Windows / Network Printer.” Windows system printers belong under the Local Agent path; raw network printers require a registered device/address and supported protocol.

If `direct` is retained temporarily, place it under **Advanced / Experimental**, with an explicit setup requirement and no implication that entering an arbitrary printer name guarantees delivery.

## 6. Media model

### Receipt media

Supported choices:

- 58 mm
- 80 mm
- 110 mm, only if the renderer and target hardware are verified

### Invoice media

Supported choices:

- A4
- Letter

Do not store invoice media as `paper_width = 0` while showing “A4 / Letter.” They are different physical page sizes. Introduce an explicit page/media value in the model while retaining compatibility with existing rows.

## 7. Runtime truthfulness fixes

### 7.1 Honor the selected template

Required data flow:

```text
PrinterSettings
→ print_document_settings.template_id
→ useReceipt
→ getReceiptForSale
→ renderSaleWithTemplate
→ selected published template
```

Renderer selection rules:

1. If a compatible `template_id` is configured, load that exact template.
2. Verify tenant, store applicability, type compatibility, and published status.
3. If `template_id` is null, resolve the published store default.
4. If no store default exists, use the only compatible published template when exactly one exists.
5. Otherwise return a clear configuration error; do not choose an arbitrary first row.

For jewelry, an explicitly selected `jewelry_invoice` template must not lose to a default plain `invoice` template.

### 7.2 Honor Auto Print

Correct checkout matrix:

| Route enabled | Auto Print | Result |
|---|---|---|
| No | Any | Do not initiate printing |
| Yes | No | Open document preview with manual Print action |
| Yes | Yes + browser | Automatically open browser print dialog |
| Yes | Yes + agent/direct | Send automatically to configured destination |

“Enabled” should be renamed to **Available for printing** if retained. The selected default sales document cannot be unavailable.

### 7.3 Use the new route for test prints

Remove the generic test action that calls the legacy `printer_settings` endpoint.

Each route gets a **Test this route** action using current form values:

- Selected template
- Media
- Delivery mode
- Selected printer/device
- One test copy
- Store logo and fixture data

A test should not require saving first. It must report which route and destination were tested.

### 7.4 Pass copies only where supported

- Browser: disable the numeric copies field and explain that copies are selected in the dialog.
- Agent/direct: validate 1–10 and send that count.
- Test print: always one copy unless the user explicitly chooses a copy-test action.

## 8. Validation rules

The frontend and backend must enforce the same rules.

### Store-level rules

- `defaultSaleDocumentType` is `receipt` or `invoice`.
- The selected default route is enabled.
- The selected default route resolves a compatible published template.

### Template rules

- Template belongs to the authenticated tenant.
- Template is applicable to the selected store or tenant-wide.
- Template is published.
- Template type is compatible with the route.
- `invoice` route may accept `invoice` or the store vertical's invoice type, such as `jewelry_invoice`.
- Receipt route accepts `receipt` only.
- Refund route accepts `return`, with documented receipt fallback only during the compatibility window.

### Delivery rules

- Browser requires no printer name.
- Local Agent requires the agent to be available for a successful test; save may be allowed with a warning if configuration is performed offline.
- Local Agent printer name must be one returned by the agent, or an explicit “Use system default.”
- Registered network/direct mode requires a real registered device, not free-text alone.
- Printer name/device fields are cleared when switching to browser mode.

### Media rules

- Receipt width is one of the supported thermal widths.
- Invoice page size is A4 or Letter.
- Copies are an integer from 1 to 10 for programmable delivery modes.

### Save response

Return structured field errors:

```json
{
  "status": "error",
  "message": "Printer settings are incomplete",
  "errors": {
    "invoice.templateId": "Select a published invoice template",
    "invoice.printerName": "Select a printer detected by the Local Agent"
  }
}
```

## 9. Atomic save contract

Replace three parallel requests with one endpoint and one database transaction.

Proposed endpoint:

```text
PUT /api/settings/print-document-settings/:storeId
```

Payload:

```json
{
  "defaultSaleDocumentType": "invoice",
  "settings": {
    "receipt": {
      "enabled": true,
      "templateId": "...",
      "media": "80mm",
      "deliveryMode": "browser",
      "printerName": null,
      "copies": 1,
      "autoPrint": false
    },
    "invoice": {
      "enabled": true,
      "templateId": "...",
      "media": "a4",
      "deliveryMode": "local_agent",
      "printerName": "Office Laser",
      "copies": 2,
      "autoPrint": true
    }
  }
}
```

The backend must:

1. Authenticate tenant and store access.
2. Validate the entire payload.
3. Start a transaction.
4. Upsert both document settings.
5. Update the store default document type.
6. Commit all changes together.
7. Return the normalized, effective configuration.

No partial save is allowed.

## 10. UI states and accessibility

### Loading

Use a structured skeleton matching the final layout rather than a single loading sentence.

### Saving

- Disable Save while active.
- Keep route Test actions disabled during save.
- Show “Saved” state and clear dirty tracking only after the atomic response succeeds.

### Dirty state

- Save button is disabled until values change.
- Navigating away with unsaved changes requires confirmation.
- Reset/discard restores the last server-confirmed configuration.

### Errors

- Show an error summary near Save.
- Show field-level errors next to the relevant control.
- Preserve unsaved values after failure.

### Keyboard and screen readers

- Use real radio inputs or an accessible radio group for Receipt/Invoice cards.
- Every toggle has a visible label and description.
- Status is not communicated by color alone.
- Test and Save actions have clear focus states.
- Agent availability updates use an appropriate live region.

### Responsive layout

- Desktop: policy and workflow summary at top; active route in a two-column details layout.
- Tablet: one-column route sections with grouped controls.
- Mobile: stacked cards; sticky Save/Discard footer if the Settings shell supports it.
- Do not render dense three-column control grids on narrow screens.

## 11. Implementation task list

### Phase A — Lock runtime behavior with failing tests

- [ ] Add a test proving a configured `templateId` is the template actually rendered.
- [ ] Add a jewelry test proving an explicit `jewelry_invoice` selection wins over plain `invoice` defaults.
- [ ] Add a duty-free test proving the configured duty-free template wins over a domestic template of the same type.
- [ ] Add store-scope tests proving the picker and renderer use identical store/tenant-wide applicability rules.
- [ ] Add a multi-store test proving one store's route selection is not changed when another template is published/defaulted.
- [ ] Add tests for the Auto Print behavior matrix.
- [ ] Add a test proving disabled routes do not initiate print.
- [ ] Add tests proving browser mode ignores application copies while agent/direct honors them.
- [ ] Add a test proving the existing generic Test Print uses the wrong/legacy route, then replace it.

**Exit criterion:** tests fail for the confirmed current bugs before production code is changed.

### Phase B — Runtime truthfulness fixes

- [ ] Add `templateId` to `renderSaleWithTemplate` options.
- [ ] Load and validate the exact configured template.
- [ ] Thread `templateId` through `useReceipt` and `getReceiptForSale`.
- [ ] Update template fallback rules to avoid arbitrary first-template selection.
- [ ] Make `autoPrint` govern automatic delivery.
- [ ] Make manual mode open preview instead of printing.
- [ ] Ensure disabled routes do not initiate printing.
- [ ] Preserve current sale completion behavior if document generation fails; show an actionable post-sale error.

**Exit criterion:** selected template and Auto Print controls truthfully affect checkout.

### Phase C — Backend validation and atomic save

- [ ] Design the combined settings request/response types.
- [ ] Add one transactional update endpoint.
- [ ] Validate store ownership from authenticated tenant context only.
- [ ] Validate template ownership, store applicability, publication, type compatibility, and sales-mode suitability.
- [ ] Decide and implement tenant-wide template visibility consistently in list, validation, and render paths.
- [ ] Define whether `is_default` is tenant-wide or store-scoped; add a migration/service fix if store-scoped defaults are required.
- [ ] Validate route/default consistency.
- [ ] Validate delivery, media, printer, and copies fields.
- [ ] Return structured field errors.
- [ ] Verify update `affectedRows` for the store default.
- [ ] Keep existing per-route endpoints temporarily for compatibility, but stop using them in the new UI.
- [ ] Add backend tests for successful atomic save and full rollback on any invalid section.

**Exit criterion:** settings cannot be partially saved or silently normalized into a different configuration.

### Phase D — UI information architecture

- [ ] Replace “Print Sales As” with “Default document after checkout.”
- [ ] Implement accessible Receipt/Invoice selection cards.
- [ ] Add the live effective-workflow summary.
- [ ] Show the active sales route first.
- [ ] Move inactive alternate format under Additional document formats.
- [ ] Add explicit refund/credit-note behavior summary.
- [ ] Reorder route controls: Template → Media → Delivery → Device → Auto Print → Copies → Test.
- [ ] Replace ambiguous Enabled text with Available for printing, or remove it from the active route.
- [ ] Show the resolved default template name.
- [ ] Label mixed invoice template families clearly.
- [ ] Show domestic/duty-free suitability and warn when the selected template conflicts with the store sales mode.
- [ ] Add field-level warnings and errors.
- [ ] Add dirty state, Save/Discard, and navigation protection.
- [ ] Add responsive and keyboard-accessible behavior.

**Exit criterion:** a user can describe the post-checkout behavior by reading one summary without interpreting hidden dependencies.

### Phase E — Route-specific testing

- [ ] Add Test Receipt/Test Invoice actions using unsaved form state.
- [ ] Render fixture data through the selected template.
- [ ] Test browser print through the browser path.
- [ ] Test Local Agent availability and selected printer.
- [ ] Report the exact tested route, template, and destination.
- [ ] Remove the Printer Settings dependency on the legacy test endpoint.

**Exit criterion:** each configured route can be tested independently before saving or running a real sale.

### Phase F — Media and delivery accuracy

- [ ] Introduce explicit invoice media (`a4`/`letter`) in schema and types.
- [ ] Add a compatibility migration for existing invoice rows.
- [ ] Remove `paper_width = 0` as the invoice media representation.
- [ ] Rename delivery options to truthful supported mechanisms.
- [ ] Hide or mark unproven direct/network delivery as Advanced/Experimental.
- [ ] Add the store-wide/current-workstation Local Agent limitation text.

**Exit criterion:** every visible delivery and media option corresponds to a real supported behavior.

### Phase G — Field proving

- [ ] Run `npm run migrate:status`; confirm zero pending migrations.
- [ ] Run missing-template dry provisioning; confirm zero missing templates.
- [ ] Open Printer Settings against a real database and inspect browser/server consoles.
- [ ] Select a non-default receipt template and prove it prints.
- [ ] Select a jewelry invoice template and prove it prints.
- [ ] Verify Auto Print off opens preview without initiating delivery.
- [ ] Verify Auto Print on initiates the configured route.
- [ ] Verify browser mode does not promise programmable copies.
- [ ] Verify Local Agent copies = 2 sends two attempts.
- [ ] Verify invalid configurations cannot save.
- [ ] Force one section of an atomic save to fail; prove no settings changed.
- [ ] Complete a real sale; verify sale, stock, document, and console.
- [ ] Complete a refund; verify correct refund document and route.
- [ ] Test at desktop, tablet, and mobile widths.
- [ ] Test keyboard-only navigation and screen-reader labels.

**Exit criterion:** clean, uninterrupted receipt, invoice, and refund workflows are observed against a real database and actual supported delivery paths.

### Phase H — Cleanup after proving

- [ ] Remove deprecated frontend settings calls.
- [ ] Remove legacy test-print route after compatibility window.
- [ ] Remove old per-route save endpoints if no callers remain.
- [ ] Update Printer Settings user documentation.
- [ ] Update `CLAUDE.md` module status only after field-proving criteria pass.
- [ ] Record implementation and field-test results in the changelog.

## 12. Test matrix

| Default document | Template | Delivery | Auto Print | Expected result |
|---|---|---|---|---|
| Receipt | Explicit receipt | Browser | Off | Receipt preview opens; no print dialog until user chooses Print |
| Receipt | Explicit receipt | Browser | On | Browser print dialog opens automatically |
| Receipt | Store default | Local Agent | On | Resolved default receipt sent to detected/default agent printer |
| Receipt | Missing | Any | Any | Save blocked or actionable configuration error |
| Invoice | Explicit invoice | Browser | Off | Invoice preview opens using exact template |
| Invoice | Explicit jewelry invoice | Browser | On | Exact jewelry invoice opens in print dialog |
| Invoice | Explicit invoice | Local Agent | On | Invoice sent to selected agent printer with configured copies |
| Invoice | Disabled invoice route | Any | Any | Save blocked |
| Any | Unpublished template | Any | Any | Save blocked |
| Any | Browser | Browser | Any | Copies controlled by browser dialog, not application field |
| Any | Local Agent unavailable | Local Agent | On | Clear unavailable status and failed test; no silent fallback unless user chooses it |

## 13. Out of scope for this redesign

- Full station/register routing precedence
- Durable print jobs, retry, and idempotency
- Offline Local Agent queue
- Signed agent authentication/device registration
- Label/tag architecture changes
- Arbitrary rule engine for customer type, value, or sale mode
- Email/SMS delivery

The UI may reserve conceptual space for these features but must not imply that they exist.

## 14. Definition of done

This work is done only when all of the following are true:

1. The selected template is the document that actually renders.
2. Auto Print on/off produces observably different and correct behavior.
3. Contradictory configurations cannot be saved.
4. Settings save atomically.
5. Each route has a truthful test action.
6. The effective workflow summary matches runtime behavior.
7. Receipt, invoice, and refund behavior are clearly distinguished.
8. Delivery labels describe real supported mechanisms.
9. Receipt/invoice route families map explicitly to compatible Print Template types.
10. Domestic and duty-free stores resolve the intended template without cross-store default interference.
11. Template picker, backend validation, and renderer enforce the same store/tenant-wide applicability rule.
12. A real checkout and refund are field-proven without console/server errors.
13. Documentation status is updated from code-complete to field-proven only after the checklist passes.
