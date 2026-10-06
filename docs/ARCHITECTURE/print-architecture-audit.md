# Print Module: Architecture Audit, Research, and Recommendations

**Status:** Final review baseline — independent Zettaz Cloud direction; implementation remains gated on approval

**Audit scope:** frontend printing services and settings, backend print routes/utilities, label printing, local agent integration, templates, database configuration, security, and future multi-industry requirements.

**Audit date:** 2026-08-16

## 1. Executive summary

Zettaz Cloud has a useful first-generation printing foundation, but the current design is receipt-centric and stores too many concerns in one printer-settings record. It can support a small store with one receipt printer and one label printer, but it is not yet a robust foundation for:

- Multiple POS stations
- Multiple printer classes per store
- Professional A4/Letter jewelry documents
- Per-module routing
- Duty-free documentation
- Offline print queues and reliable retries
- Versioned templates and visual design
- Cloud-connected printers across NAT/firewalls

The recommended target is a dedicated Print Management subsystem with five independent concepts:

```text
Document type -> template profile -> routing rule -> printer device -> adapter/agent
```

The most important architectural decision is to separate **what is printed**, **how it looks**, **where it goes**, and **how the hardware is reached**.

## 2. Current architecture discovered

### 2.1 Receipt printing

The frontend supports `browser`, `direct`, `server`, and `local-agent` modes in `frontend/src/services/printerService.ts`.

- Browser mode writes HTML into an iframe and calls `window.print()`.
- Direct mode sends HTML to `/api/print`; the backend converts HTML to ESC/POS and opens a TCP connection.
- Local-agent mode posts HTML to a localhost agent on ports 9419/9420.
- Server mode is exposed in the UI but currently falls back to browser printing because it is not implemented.

References:

- `frontend/src/services/printerService.ts`
- `backend/routes/printRoutes.js`
- `backend/utils/printerUtils.js`
- `frontend/src/components/Receipt/ReceiptModal.tsx`
- `frontend/src/services/receiptService.ts`
- `frontend/src/hooks/useReceipt.ts`

### 2.2 Labels and tags

Label printing is separated from receipt printing and currently supports:

- Zebra ZPL over TCP
- TSC/Godex TSPL-EZ over TCP
- Browser/PDF fallback

The backend generates ZPL and TSPL in `backend/services/labelPrintService.js`. Label dimensions are configurable, but the ZPL generator currently assumes 203 DPI. The frontend settings already identify jewelry tag, product, shelf, and custom size presets.

References:

- `frontend/src/services/labelService.ts`
- `frontend/src/components/settings/LabelPrinterSettings.tsx`
- `backend/routes/labels.routes.js`
- `backend/services/labelPrintService.js`
- `database/migrations/applied/2026-08-13_label_printing_crm_wishlist.sql`

### 2.3 Printer configuration

The existing model is primarily one `printer_settings` row per store. It contains receipt settings and label-printer fields together:

- Receipt mode, name, width, template, header, footer
- Legacy receipt logo
- Label driver, address, width, and height

This is insufficient for multiple registers, office printers, certificate printers, warehouse stations, backup printers, or document-specific routing.

### 2.4 Existing documentation

Historical receipt specifications and a task list existed under `docs/technical/`. The printer hardware manual existed under `docs/12-user-guides/`. They have been consolidated into this directory for review and future maintenance.

## 3. Audit findings

Severity meanings:

- **Critical:** address before exposing or expanding the capability
- **High:** blocks reliable production scale or creates material operational risk
- **Medium:** important for extensibility and supportability
- **Low:** quality-of-life or future enhancement

| ID | Severity | Finding | Impact | Recommendation |
|---|---|---|---|---|
| PRINT-001 | Critical | Backend TCP print routes accept printer addresses from request/configuration and connect directly | SSRF/internal-network access risk; cloud backend usually cannot reach store-private printers | Resolve tenant-scoped printer IDs; validate addresses and ports; block public, loopback, metadata, and unauthorized ranges |
| PRINT-002 | Critical | Debug print routes in `backend/routes/printRoutes.js` are not consistently protected by authentication | Arbitrary print jobs, network probing, and receipt-content leakage may be possible | Remove debug routes or require authentication, permission checks, rate limits, and explicit development-only flags |
| PRINT-003 | High | `server` print mode is exposed but not implemented | Users can select a mode that silently falls back to browser printing | Remove from production UI until implemented, or rename and clearly mark as experimental |
| PRINT-004 | High | Direct backend-to-printer TCP depends on network topology | Fails for cloud deployment when printers are behind NAT/firewalls | Make Local Agent the default for workstation printers; support private gateway/VPN or supported cloud-printer adapters explicitly |
| PRINT-005 | High | No durable print-job model | No reliable retry, status, idempotency, audit, or reprint workflow | Add `print_jobs` with status, attempts, error details, idempotency key, and rendered payload metadata |
| PRINT-006 | High | Receipt and label settings are coupled in one store-level row | Cannot model multiple printers, stations, devices, or routes cleanly | Introduce stations, printer devices, capabilities, templates, and routing rules |
| PRINT-007 | High | HTML-to-ESC/POS conversion is suitable for simple receipts but not professional documents | Rich jewelry invoices and certificates lose layout, images, and page semantics | Use a dedicated PDF/document rendering path for A4/Letter documents |
| PRINT-008 | High | Label ZPL generation hardcodes 203 DPI | Physical layout can be incorrect on 300/600 DPI printers | Store DPI in printer capability profile and render coordinates accordingly |
| PRINT-009 | High | Local Agent API lacks a documented versioned job/status contract | Difficult to support upgrades, retries, device discovery, and multiple device types | Define `/v1` agent API with device discovery, job IDs, status, capabilities, and compatibility negotiation |
| PRINT-010 | Medium | Browser printing cannot guarantee target printer, silent output, cut, drawer control, or status | Poor fit for high-volume POS | Keep as explicit fallback/manual path only |
| PRINT-011 | Medium | Label browser fallback opens a new window and requires popup permission | Bulk operations are fragile and user-dependent | Prefer Local Agent/vendor bridge for labels; retain browser as manual fallback |
| PRINT-012 | Medium | Template model is receipt-only and lacks schema, version, draft/publish, and compatibility metadata | Customization becomes unsafe and difficult to roll back | Use document-type-specific versioned template profiles |
| PRINT-013 | Medium | No centralized print routing | Modules cannot choose different printers by document type, station, or industry | Add routing resolution with station > store > tenant > industry > platform precedence |
| PRINT-014 | Medium | No printer status, media status, or calibration workflow | Staff discover failures only after a print attempt | Add health/status/test/calibration operations where hardware supports them |
| PRINT-015 | Medium | Legacy receipt logo storage is separate from centralized store branding | Branding can diverge between receipts, reports, labels, and invoices | Use store branding as the canonical source, with output-specific transformations |
| PRINT-016 | Medium | No jurisdictional document/compliance profile | Duty-free and tax-free requirements cannot be safely generalized | Model jurisdiction-specific required fields, legal text, sequence, copies, and validation |
| PRINT-017 | Low | Printer capability details are not represented | UI cannot prevent unsupported combinations | Add capabilities: color, DPI, paper widths, cut, drawer, barcode, QR, image, duplex, trays |
| PRINT-018 | Low | No certification matrix or automated fixture tests | Regressions may only appear on physical hardware | Maintain golden fixtures and test across printer models, widths, DPI, encodings, and languages |

## 4. Security audit notes

### 4.1 Printer address handling

Print jobs should never accept arbitrary `host:port` values from a normal browser request. A browser should submit a tenant-scoped `printerDeviceId`. The backend should resolve and validate the destination.

Required controls:

- Tenant and store ownership check
- Station authorization check
- Allowed driver and port validation
- Private network policy
- DNS resolution safeguards
- Block loopback and cloud metadata addresses
- Payload size and execution time limits
- Rate limiting
- Audit event for every print request

### 4.2 Local Agent security

The Local Agent should listen on loopback only and enforce:

- Allowed web origins
- Agent installation identity
- Signed or short-lived job tokens
- Device allowlists
- Maximum HTML/raw payload size
- Explicit raw-print permission
- Job authentication and replay protection
- Version compatibility
- Sanitized diagnostic logs

QZ Tray is a useful reference for browser-to-localhost printing security. It uses a secure localhost WebSocket and signed privileged requests. See the research section below.

### 4.3 Template security

Tenant template editing must not become arbitrary server-side code execution. Templates should use a structured block schema or a strongly sanitized HTML/CSS subset. Raw ZPL/TSPL should be restricted to an explicit advanced permission.

## 5. Target architecture

### 5.1 Core entities

#### `print_stations`

Represents a workstation, register, warehouse station, office, or consultation desk.

Suggested fields:

```text
id, tenant_id, store_id, name, station_type, agent_id,
device_fingerprint, last_seen_at, is_active
```

#### `printer_devices`

Represents physical or logical output hardware.

Suggested fields:

```text
id, tenant_id, store_id, station_id, name,
device_type, driver, connection_type, address, port,
capabilities_json, is_default, is_active
```

Device types should include:

```text
receipt_thermal
office_document
label
jewelry_tag
certificate
kitchen
cash_drawer
```

#### `print_templates`

Suggested fields:

```text
id, tenant_id, industry_code, document_type, output_format,
paper_profile, template_schema_json, html_template, css_template,
version, status, is_system, is_default, created_by, published_by
```

#### `print_routes`

Suggested fields:

```text
id, tenant_id, store_id, station_id, document_type,
printer_device_id, template_id, priority,
fallback_printer_device_id, is_active
```

#### `print_jobs`

Suggested fields:

```text
id, tenant_id, store_id, station_id, document_type,
printer_device_id, template_id, idempotency_key,
payload_json, rendered_format, status, attempts,
error_code, error_message, created_by, created_at,
started_at, completed_at
```

### 5.2 Print pipeline

```text
Module action
  -> canonical document payload
  -> document type resolution
  -> tenant/store/station/industry context
  -> routing rule resolution
  -> template selection
  -> renderer/adapter selection
  -> print job creation
  -> local/cloud/device dispatch
  -> status, retry, audit, and user feedback
```

### 5.3 Adapter model

Use adapters behind one internal interface:

```text
BrowserPrintAdapter
LocalAgentAdapter
EscPosAdapter
PdfAdapter
ZplAdapter
TsplAdapter
EpsonEposAdapter
StarCloudPrntAdapter
QzTrayAdapter
SystemPrintAdapter
```

The application should not let individual pages call raw printer APIs directly.

## 6. Printer class recommendations

### POS thermal receipts

- Primary: Local Agent with ESC/POS or controlled HTML thermal rendering
- Fallback: Browser print with explicit user action
- Capabilities: 58/80 mm, cut, cash drawer, QR/barcode, image, status
- Requirements: idempotent jobs, duplicate prevention, fast feedback, reprint audit

### A4/Letter office documents

- Primary: PDF renderer plus Local Agent/system print
- Fallback: browser PDF/manual print
- Use for invoices, purchase orders, GRNs, reports, certificates, returns, and duty-free documents
- Do not force rich documents through ESC/POS

### Labels and tags

- Primary: ZPL/TSPL through Local Agent or vendor bridge
- Direct TCP only for controlled private-network deployments
- Printer profile must include DPI, media type, gap/black-mark mode, darkness, speed, and dimensions
- Use physical units and printer DPI for layout calculations

### Jewelry premium documents

Recommended document family:

- Premium jewelry invoice
- Certificate of authenticity
- Warranty certificate
- Repair intake and completion document
- Old gold voucher
- Memo/consignment document
- Layaway agreement
- Customer care card

Support logo, product images, purity, gross/net/stone weight, gemstone details, serial/piece code, QR/barcode, signatures, terms, and multi-page output.

## 7. Template strategy

### Stage 1: structured blocks

Provide approved blocks:

- Store branding
- Customer details
- Transaction metadata
- Seller/cashier
- Item table
- Jewelry attributes
- Tax and discount sections
- Payment section
- QR/barcode
- Compliance section
- Terms and signature
- Footer

Each block needs visibility, data binding, order, alignment, font, width, and conditional rules.

### Stage 2: visual designer

Support separate canvases for:

- 58 mm thermal
- 80 mm thermal
- A4/Letter
- Jewelry tags
- Shelf labels

Use physical units for labels and include sample data, preview, test print, draft/publish, version history, duplication, and rollback.

### Stage 3: advanced source mode

Permit raw HTML/CSS or ZPL/TSPL only with explicit permission, validation, preview, test print, and rollback.

## 8. Duty-free and tax-free requirements

Duty-free is a jurisdiction-specific compliance problem, not just another paper size.

A configurable duty-free profile may need:

- Traveller name
- Passport or travel document number
- Nationality/residency
- Residential address
- Flight/voyage number
- Departure date
- Departure airport/port
- Customs/export reference
- Tax-free status and tax amount
- Invoice sequence
- Required copies
- Language and currency
- Legal text
- Signature fields

The exact fields must be confirmed for each target jurisdiction before claiming compliance. Research examples show materially different workflows:

- Australian guidance describes travel-document checks, sequential invoices, traveller identity, trip details, departure location, values, and passport/crew details.
- Italy's OTELLO process requires traveller and passport/equivalent identity data plus an electronically generated request code.
- German tax-free shopping requires identity/residency evidence and export confirmation.

The system should support profiles such as:

```text
jurisdiction
required_fields_json
validation_rules_json
legal_text_json
sequence_format
copy_count
delivery_mode
customs_reference_required
```

## 9. External research

### Browser and local hardware

- [QZ Tray architecture](https://github.com/qzind/tray/wiki/Architecture) — browser-to-localhost WebSocket model and privileged hardware access
- [QZ Tray signing](https://qz.io/docs/Signing) — signed requests for silent privileged operations
- [QZ Tray raw printing](https://qz.io/docs/raw) — raw ESC/POS and driver considerations
- [WebApp Hardware Bridge](https://github.com/imTigger/webapp-hardware-bridge) — local bridge supporting PDF, images, raw ESC/POS, devices, and printer mappings

### Vendor/cloud integrations

- [Epson ePOS SDK for JavaScript](https://download4.epson.biz/sec_pubs/pos/reference_en/technology/epson_epos_sdk.html) — direct web application control for supported Epson TM printers
- [Star CloudPRNT protocol](https://star-m.jp/products/s_print/sdk/StarCloudPRNT/manual/en/index.html) — printer polling from a cloud service and printer/peripheral control
- [Zebra web application printing](https://developer.zebra.com/content/print-web-application) — Browser Print and other ZPL integration options

### Label printing

- [Driverless label printing architecture](https://www.boxhero.io/engineering/label-printing-thermal-printers-electron) — application, driver, and ZPL/TSPL pipeline considerations
- [Zebra printer APIs](https://techdocs.zebra.com/enterprise-browser/latest/tutorial/printing/) — discovery, connection, status, and print operations

### Document and receipt design

- [Lightspeed receipt templates](https://x-series-support.lightspeedhq.com/hc/en-us/articles/25534014632987-Setting-up-your-receipt-templates) — different layouts for thermal and standard printers, logo constraints, and country-specific templates
- [HTML receipt formatting guidance](https://docs.biblio.org/docs/latest/getting-started/html-formatting-receipts.html) — simple HTML, real-device testing, and thermal CSS constraints
- [80 mm thermal print CSS](https://freereceipt.dev/blog/how-to-print-80mm-thermal-receipt-from-browser) — zero-margin `@page` and fixed-width thermal output

### Duty-free and tax-free research

- [Australian Border Force duty-free operator guide](https://www.abf.gov.au/licensing-subsite/files/duty-free-operator-guide.pdf)
- [Italian Customs OTELLO procedure](https://www.adm.gov.it/portale/en/ee/citizen/otello-english-version/the-procedure)
- [German Customs tax-free shopping](https://www.zoll.de/EN/Private-individuals/Travel/Leaving-Germany/Tax-free-shopping/tax-free-shopping_node.html)

These sources are architectural and product research references. They are not a substitute for jurisdiction-specific legal review.

## 10. Recommended product direction

```text
Receipt printing:
  Local Agent -> ESC/POS or thermal HTML
  Browser fallback

Office documents:
  PDF/HTML -> Local Agent or browser
  Never convert rich documents to ESC/POS

Labels:
  ZPL/TSPL -> Local Agent or vendor bridge
  Browser fallback only

Cloud-connected printers:
  Optional Epson/Star/vendor adapters

Routing:
  Station + document type + printer profile

Templates:
  Structured blocks first, visual designer second
```

## 11. Decision gates before implementation

- [ ] Approve Print Management as a separate subsystem
- [ ] Approve station/device/template/route/job entities
- [ ] Select Local Agent as the primary workstation architecture
- [ ] Decide whether QZ Tray/vendor bridges are adapters or unsupported alternatives
- [ ] Select target office PDF strategy
- [ ] Define initial printer certification matrix
- [ ] Define first duty-free jurisdiction, if any
- [ ] Approve security requirements
- [ ] Approve migration and backward-compatibility plan
