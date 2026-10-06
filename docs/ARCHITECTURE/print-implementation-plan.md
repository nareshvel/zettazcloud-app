# Zettaz Cloud Print Module: Final Plan of Action and Task List

**Status:** Final planning baseline — implementation must wait for architecture review and approval

**Product boundary:** Independent Zettaz Cloud subsystem. It does not reuse iRestrack source code, contracts, databases, agent names, or app identifiers.

**Future app:** Zettaz Cloud. The app is planned as a future client of this Print Module; app implementation is intentionally deferred.

## 1. Goals

The complete target architecture is defined in [PRINT_MODULE_FINAL_BLUEPRINT.md](./PRINT_MODULE_FINAL_BLUEPRINT.md). This task list is the execution companion to that blueprint.

Build a reliable, multi-printer Print Management subsystem that supports:

- POS thermal receipts
- Standard A4/Letter documents
- Jewelry-grade invoices and certificates
- Product and jewelry labels/tags
- Per-station and per-document routing
- Local-agent and selected cloud/vendor adapters
- Template customization and versioning
- Duty-free document profiles
- Print job tracking, retries, and auditability

## 2. Non-goals for the first release

- Supporting every printer brand
- Claiming universal duty-free compliance
- Full arbitrary HTML/CSS authoring for all users
- Direct printer access from untrusted browser input
- Implementing every vendor cloud protocol at once
- Replacing the existing receipt workflow in one migration

## 3. Workstreams

### Workstream A — Security and operational hardening

1. Inventory all print routes and their middleware.
2. Remove or protect debug print endpoints.
3. Replace arbitrary printer addresses with tenant-scoped printer IDs.
4. Validate destination ownership, host, port, driver, and network policy.
5. Add payload size, timeout, rate-limit, and audit controls.
6. Remove or hide unimplemented server mode.
7. Define safe logging rules that do not expose customer or payment data.

**Exit criteria:** security review approves print endpoints and no unauthenticated/debug print path remains in production.

### Workstream B — Canonical document model

1. Define document types.
2. Define canonical document payloads.
3. Add document version and source module metadata.
4. Define branding, localization, tax, payment, and compliance blocks.
5. Add payload validation schemas.
6. Add test fixtures for each document type.

Initial document types:

```text
pos_receipt
sales_invoice
jewelry_invoice
jewelry_certificate
warranty_certificate
product_label
jewelry_tag
purchase_order
goods_receiving_note
sales_return
repair_document
old_gold_voucher
layaway_agreement
memo_document
duty_free_invoice
```

### Workstream C — Printer and station data model

1. Create `print_stations`.
2. Create `printer_devices`.
3. Create `printer_capabilities` or equivalent JSON capability model.
4. Create `print_routes`.
5. Add printer device ownership and active/default flags.
6. Add migration compatibility from existing `printer_settings`.
7. Add station registration for Local Agent installations.

### Workstream D — Print jobs and reliability

1. Create `print_jobs` table.
2. Add idempotency key support.
3. Add queued, dispatched, printing, completed, failed, cancelled states.
4. Add retry policy by adapter and error class.
5. Add manual retry and reprint permissions.
6. Add job history UI.
7. Add metrics for failure rate and latency.

### Workstream E — Adapter layer

Implement adapters behind a common interface:

```text
BrowserPrintAdapter
LocalAgentAdapter
EscPosAdapter
PdfAdapter
ZplAdapter
TsplAdapter
```

Later adapters, only when justified by customer demand:

```text
EpsonEposAdapter
StarCloudPrntAdapter
QzTrayAdapter
ZebraBrowserPrintAdapter
```

### Workstream F — Local Agent v1

1. Define versioned agent API.
2. Add `/v1/health`.
3. Add `/v1/devices`.
4. Add `/v1/devices/:id/status`.
5. Add `/v1/print-jobs`.
6. Add `/v1/print-jobs/:id`.
7. Add printer discovery and named device mappings.
8. Add receipt, PDF, and label job types.
9. Add printer allowlist and origin security.
10. Add offline queue and retry handling.
11. Add agent compatibility/version check.
12. Add installer upgrade and rollback guidance.

### Workstream G — Template platform

1. Create template metadata and version tables.
2. Define structured blocks.
3. Implement thermal receipt templates.
4. Implement A4/Letter document templates.
5. Implement jewelry templates.
6. Implement label template schema.
7. Add draft/published versions.
8. Add preview using fixture data.
9. Add test print from template editor.
10. Add publish, duplicate, rollback, and permissions.
11. Add visual designer after schema stabilization.

### Workstream H — Duty-free profiles

1. Select first target jurisdiction.
2. Obtain legal/compliance requirements.
3. Define required fields and validation.
4. Define invoice sequencing and copies.
5. Define customs/export references.
6. Add configurable legal text and language.
7. Add duty-free document template.
8. Add audit trail and correction/reissue workflow.
9. Obtain compliance sign-off before launch.

### Workstream I — Certification and QA

1. Build print fixture suite.
2. Test 58 mm receipt output.
3. Test 80 mm receipt output.
4. Test A4/Letter PDF output.
5. Test Zebra 203 DPI.
6. Test Zebra 300 DPI.
7. Test TSC/Godex TSPL.
8. Test Unicode and right-to-left text where applicable.
9. Test long names, long item descriptions, discounts, tax, refunds, and zero values.
10. Test offline agent and retry behavior.
11. Test duplicate prevention.
12. Test permissions and tenant isolation.
13. Test printer failure, paper-out, disconnected, and malformed-device cases.

## 4. Proposed implementation schedule

The schedule is intentionally milestone-based rather than date-based. Each milestone should be reviewed before the next one begins.

### Milestone 0 — Architecture approval

**Tasks**

- Review `print-architecture-audit.md`.
- Approve terminology, entities, routing precedence, and adapter strategy.
- Confirm target countries/industries.
- Confirm initial certified printer models.
- Approve security threat model.

**Deliverables**

- Approved architecture decision record
- Printer certification matrix
- Initial document-type list
- Security sign-off

**Gate:** no schema or routing implementation until approved.

### Milestone 1 — Security hardening

**Tasks**

- Protect/remove debug routes.
- Add tenant-scoped printer resolution.
- Add network destination validation.
- Add print permission checks.
- Add payload limits and timeouts.
- Hide unimplemented server mode.

**Deliverables**

- Hardened endpoints
- Security tests
- Updated deployment configuration
- Support troubleshooting notes

**Gate:** no new printer adapters until print endpoints pass security review.

### Milestone 2 — Data model and compatibility layer

**Tasks**

- Add stations, printer devices, routes, and jobs tables.
- Build compatibility reader for existing settings.
- Seed default route for existing receipt and label configurations.
- Add tenant/store ownership checks.

**Deliverables**

- Idempotent migrations
- Data model API
- Backward-compatible printer settings behavior
- Migration verification report

### Milestone 3 — Print job service

**Tasks**

- Implement job creation and state transitions.
- Add idempotency and retry rules.
- Add job audit records.
- Add manual retry/reprint API.
- Add job status UI.

**Deliverables**

- Print job API
- Retry and failure behavior
- Job history page
- Integration tests

### Milestone 4 — Local Agent v1

**Tasks**

- Version the agent API.
- Add device discovery and mapping.
- Add receipt, PDF, and label jobs.
- Add agent health/status.
- Add authenticated origin and printer allowlists.
- Update installer and setup guide.

**Deliverables**

- Agent v1 protocol
- Windows and macOS builds
- Agent compatibility test
- Operator setup guide

### Milestone 5 — Receipt and office-document adapters

**Tasks**

- Make Local Agent the primary POS receipt path.
- Keep browser printing as explicit fallback.
- Implement deterministic PDF output for A4/Letter.
- Add professional jewelry invoice template.
- Add invoice, purchase order, GRN, return, and repair document routes.

**Deliverables**

- Certified 58/80 mm receipt output
- Certified A4/Letter output
- Jewelry document preview and test print
- Print routing by document type and station

### Milestone 6 — Label/tag profiles and templates

**Tasks**

- Add DPI-aware ZPL/TSPL rendering.
- Add printer media profiles.
- Add gap/black-mark/continuous settings.
- Add calibration/test workflow.
- Add jewelry tag templates.
- Add general retail shelf/barcode templates.
- Route labels through Local Agent or approved vendor bridge.

**Deliverables**

- Certified Zebra and TSC/Godex profiles
- Jewelry tag template set
- Bulk-label reliability tests
- Calibration support documentation

### Milestone 7 — Structured template editor

**Tasks**

- Implement block schema.
- Implement preview with real fixture data.
- Implement draft/publish/version/rollback.
- Add permissions.
- Add template assignment by document type and station.

**Deliverables**

- Thermal receipt editor
- A4 document editor
- Template lifecycle controls
- Versioned output fixtures

### Milestone 8 — Duty-free profile

**Tasks**

- Confirm first jurisdiction.
- Implement required traveler and export fields.
- Implement invoice sequence and copy rules.
- Implement legal text and language profiles.
- Implement reissue/correction audit trail.
- Obtain compliance approval.

**Deliverables**

- Jurisdiction-specific duty-free profile
- Compliance-reviewed template
- End-to-end test scenario
- Operational training guide

### Milestone 9 — Visual label designer and advanced integrations

**Tasks**

- Add physical-unit label designer.
- Add logo conversion and placement.
- Add barcode/QR configuration.
- Evaluate Epson ePOS, Star CloudPRNT, QZ Tray, and Zebra Browser Print adapters based on customer demand.
- Add cloud printer provisioning only where operationally justified.

**Deliverables**

- Visual label designer
- Adapter decision records
- Additional certified printer integrations

## 5. Definition of done

A Print Module feature is complete only when:

- The document payload is tenant-safe and schema-validated.
- The printer destination is resolved by ID, not arbitrary host input.
- The template is versioned and compatible with the output format.
- The print job is idempotent and auditable.
- Success and failure states are visible to the user.
- Retry/reprint behavior is defined.
- At least one physical printer fixture has passed.
- Browser fallback behavior is explicit.
- Permissions are tested.
- Localization and currency formatting are tested.
- Security review is complete.
- User and support documentation is updated.

## 6. Suggested initial certification matrix

| Class | Initial certification target |
|---|---|
| Receipt thermal | Generic 80 mm ESC/POS Ethernet printer; Epson TM-T88-class device |
| Receipt narrow | 58 mm ESC/POS device |
| Office document | Windows/macOS system PDF printer through Local Agent |
| Zebra label | Zebra ZPL 203 DPI network printer |
| Zebra high-density | Zebra ZPL 300 DPI printer |
| TSC/Godex label | TSPL-EZ network printer |
| Browser fallback | Chrome/Edge on Windows and macOS |

This is a starting matrix, not a claim that all models in a class are compatible.

## 7. Review questions

1. Which countries must duty-free support first?
2. Which printer brands/models are already deployed by customers?
3. Must the system work on tablets, or only Windows/macOS POS stations?
4. Is an installed Local Agent acceptable for all POS locations?
5. Is cloud-to-printer printing required, or is local-agent printing sufficient?
6. Which documents require legally controlled numbering and reissue history?
7. Should templates be tenant-editable, or only administrator-editable?
8. Do jewelry customers need certificate/image-rich A4 documents in the first release?
9. Is cash-drawer control required in the first print-agent release?
10. Should print jobs be retained for audit, and for how long?

## 8. Future Zettaz Cloud app readiness

The application is deliberately planned but not implemented in this phase.

### App preparation tasks

- [ ] Keep all printing behind the versioned Print Job contract.
- [ ] Keep printer resolution and authorization in the backend.
- [ ] Define a client capability handshake for browser, desktop agent, and mobile app.
- [ ] Define mobile station registration and revocation.
- [ ] Define local-network permission and printer-discovery UX.
- [ ] Define native delivery for thermal TCP jobs.
- [ ] Define PDF and label delivery expectations before choosing native versus agent implementation.
- [ ] Reserve the product name **Zettaz Cloud** in app configuration and documentation.
- [ ] Do not begin native app implementation until the Print Job v1 contract is stable.

The first app release should be a client of the web application and Print Module, not a parallel POS rewrite.

## 9. Final review gate

Hold an architecture review using the final blueprint, audit, and this task list. Record decisions in an ADR before beginning Milestone 1. Implementation should proceed only after the following are approved:

- [ ] Independent Zettaz Cloud boundary
- [ ] Device/station/template/route/job data model
- [ ] Security threat model
- [ ] Template and custom designer scope
- [ ] Initial printer certification matrix
- [ ] Duty-free jurisdiction scope
- [ ] Print-job retention and audit policy
- [ ] Future app client strategy

No implementation task should be marked complete until its physical-printer fixture, security checks, and rollback behavior are documented.
