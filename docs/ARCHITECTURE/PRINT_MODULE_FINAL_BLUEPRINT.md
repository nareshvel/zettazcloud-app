# Zettaz Cloud Print Module — Final Architecture Blueprint

**Product:** Zettaz Cloud

**Status:** Approved direction pending stakeholder sign-off

**Purpose:** Define the independent, device-agnostic printing platform for Zettaz Cloud. This blueprint deliberately does not depend on iRestrack source code, contracts, naming, database tables, or deployment assumptions.

## 1. Product decision

Zettaz Cloud will implement its own Print Module as an independent platform capability.

The future Zettaz Cloud application may be delivered as:

- Responsive web application
- Android/iOS WebView shell
- Fully native application in a later phase
- Desktop station application or local print agent

The Print Module must not assume which client is used. All clients consume the same versioned print-job contract and capability model.

## 2. Design principles

1. **Independent:** no dependency on iRestrack code, database, bridge, or app identifiers.
2. **Device-agnostic:** support browser, mobile, desktop, local agent, network, USB, and cloud-capable printers through adapters.
3. **Document-first:** modules produce canonical document payloads; renderers create printer-specific output.
4. **Route-aware:** the same document can go to different printers depending on store, station, user, role, industry, or document type.
5. **Template-safe:** structured templates are the default; raw HTML/CSS and raw printer language are advanced options.
6. **Reliable:** every meaningful print operation has a job ID, idempotency key, status, retry policy, and audit trail.
7. **Offline-tolerant:** local clients can queue jobs while the cloud is unavailable and reconcile results later.
8. **Compliance-aware:** duty-free and tax-related output is configurable by jurisdiction and never hardcoded globally.
9. **Brand-consistent:** store branding is canonical and reusable across receipts, documents, labels, reports, and app surfaces.
10. **Observable:** operators can see device health, queue state, failures, and reprint history.

## 3. Supported output families

### 3.1 POS thermal receipts

- 58 mm and 80 mm rolls
- ESC/POS raw output
- Thermal HTML output
- Auto-cut and feed options
- Cash drawer pulse where supported
- Barcode and QR support
- Monochrome store logo
- Compact, standard, detailed, and industry-specific layouts

### 3.2 Office documents

- A4 and Letter
- PDF and system print
- Sales invoices
- Purchase orders
- Goods receiving notes
- Sales returns
- Inventory documents
- Reports and exports
- Repair documents
- Customer statements

### 3.3 Jewelry and premium documents

- Premium jewelry invoice
- Certificate of authenticity
- Warranty certificate
- Gemstone certificate
- Repair intake/completion document
- Old gold purchase voucher
- Memo/consignment document
- Layaway agreement
- Customer care card

Support includes product imagery, purity, gross/net/stone weight, gemstone details, serial/piece code, QR/barcode, signatures, terms, multi-page output, and premium branding.

### 3.4 Tags and labels

- Jewelry loop/barbell tags
- Ring sleeve labels
- Necklace cards
- Product barcode labels
- Shelf labels
- Storage/box labels
- Packing labels
- Price tags

Supported printer languages:

- ZPL
- TSPL/TSPL-EZ
- Browser/PDF fallback
- Future vendor-specific adapters where justified

### 3.5 Duty-free and tax-free documents

Duty-free is a jurisdiction profile layered on top of the document and template systems. It is not a printer type.

A jurisdiction profile may define:

- Traveller identity fields
- Passport/travel document fields
- Nationality/residency
- Address
- Flight/voyage details
- Departure date and location
- Customs/export reference
- Tax-free status
- Invoice sequence
- Required copies
- Legal text
- Language and currency
- Signature requirements
- Correction/reissue rules

Legal and tax review is mandatory before any jurisdiction is marked compliant.

## 4. Logical architecture

```text
Zettaz Cloud module
  -> Canonical document payload
  -> Document type resolver
  -> Store/station/industry context
  -> Route resolver
  -> Template resolver
  -> Renderer
  -> Print job service
  -> Delivery adapter
  -> Local agent / mobile shell / browser / cloud printer
  -> Status, retry, audit, and user feedback
```

### 4.1 Canonical document payload

Modules must not generate printer-specific commands directly. They produce a versioned payload:

```ts
interface DocumentPayload {
  schemaVersion: string;
  documentType: string;
  documentId?: string;
  sourceModule: string;
  tenantId: string;
  storeId: string;
  stationId?: string;
  createdBy?: string;
  store: StoreBranding;
  customer?: CustomerSnapshot;
  employee?: EmployeeSnapshot;
  items: DocumentItem[];
  totals?: DocumentTotals;
  taxes?: DocumentTax[];
  payments?: DocumentPayment[];
  compliance?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}
```

The payload is the source of truth for rendering and reprinting. Historical output should not change if store settings or templates change later.

## 5. Core data model

### 5.1 `print_stations`

A physical or logical workstation.

```text
id
tenant_id
store_id
name
station_type
client_type
agent_id
device_fingerprint
last_seen_at
is_active
metadata_json
```

Examples: POS Counter 1, Jewelry Desk, Stockroom, Warehouse, Manager Office, Airport Counter.

### 5.2 `printer_devices`

A physical or logical printer destination.

```text
id
tenant_id
store_id
station_id
name
device_type
driver
connection_type
address
port
capabilities_json
is_default
is_active
last_seen_at
```

Device types:

```text
receipt_thermal
office_document
label
jewelry_tag
certificate
cash_drawer
```

Connection types:

```text
browser
local_agent
usb
network_tcp
system_queue
cloud_protocol
```

### 5.3 `print_templates`

A versioned visual and data definition.

```text
id
tenant_id
industry_code
document_type
output_format
paper_profile
name
description
schema_json
html_template
css_template
source_template_id
version
status
is_system
is_default
created_by
published_by
created_at
published_at
```

Statuses:

```text
draft
published
archived
```

### 5.4 `print_routes`

Maps document types to printers and templates.

```text
id
tenant_id
store_id
station_id
document_type
printer_device_id
template_id
priority
fallback_printer_device_id
auto_print
copies
is_active
```

Resolution precedence:

```text
station + document type
store + document type
tenant + document type
industry + document type
platform default
```

### 5.5 `print_jobs`

Durable print lifecycle record.

```text
id
idempotency_key
tenant_id
store_id
station_id
document_type
document_id
printer_device_id
template_id
payload_json
rendered_format
payload_hash
status
attempts
max_attempts
error_code
error_message
created_by
created_at
started_at
completed_at
```

Statuses:

```text
created
queued
dispatched
printing
completed
failed
cancelled
expired
```

## 6. Print job contract

The protocol must be independent of iRestrack and versioned from the start.

```json
{
  "protocol_version": "1",
  "job_id": "uuid",
  "idempotency_key": "uuid",
  "document_type": "jewelry_invoice",
  "output_format": "pdf",
  "delivery": "local_agent",
  "printer_device_id": "uuid",
  "template_id": "uuid",
  "payload_base64": "...",
  "metadata": {
    "store_id": "uuid",
    "station_id": "uuid",
    "copies": 1,
    "paper_profile": "a4"
  }
}
```

Possible output formats:

```text
escpos
pdf
html
zpl
tspl
image
```

The browser/mobile client must never be able to override the resolved tenant, store, route, or printer destination with arbitrary host input.

## 7. Delivery adapters

Implement a common adapter interface:

```text
BrowserPrintAdapter
LocalAgentAdapter
SystemPrintAdapter
EscPosAdapter
PdfAdapter
ZplAdapter
TsplAdapter
```

Future adapters may include:

```text
EpsonEposAdapter
StarCloudPrntAdapter
QzTrayAdapter
ZebraBrowserPrintAdapter
```

The initial target should be:

- Local Agent for desktop POS and office printers
- Native mobile TCP adapter for supported LAN thermal printers
- Browser fallback for manual printing
- ZPL/TSPL through the local agent or a controlled network gateway

## 8. Template platform

### 8.1 Template types

Templates must declare their compatibility:

```text
template_kind: receipt | document | label | certificate | duty_free
output_format: escpos | html | pdf | zpl | tspl
paper_profile: 58mm | 80mm | a4 | letter | custom
```

A template cannot be assigned to an incompatible printer capability.

### 8.2 Structured template blocks

The default editor uses approved blocks:

- Store logo and brand header
- Store contact/legal details
- Customer block
- Employee/cashier block
- Transaction metadata
- Item table
- Jewelry attributes
- Metal/purity/weight block
- Gemstone block
- Tax breakdown
- Discount/promotions
- Payments
- Barcode/QR code
- Compliance/customs block
- Terms and conditions
- Signature block
- Footer
- Page break

Block properties:

```text
visible
label
field_binding
conditional_rule
order
alignment
font_family
font_size
font_weight
color
padding
width
image_fit
```

### 8.3 Custom template designer

The designer should be delivered in stages.

#### Stage A — Safe block editor

- Select document type and paper profile
- Toggle blocks on/off
- Reorder blocks
- Edit labels and legal text
- Configure field visibility
- Configure logo and branding
- Preview with fixture data
- Test print
- Save draft and publish

#### Stage B — Layout editor

- Drag-and-drop blocks
- Resize columns and sections
- Alignment guides
- Grid and snap-to-grid
- Header/footer zones
- Page breaks
- Reusable sections
- Device-aware previews

#### Stage C — Label designer

- Physical millimeter canvas
- DPI selection
- Barcode and QR placement
- Text and logo placement
- Jewelry tag presets
- Product/shelf presets
- Gap/black-mark/continuous media profiles
- ZPL/TSPL preview and test output

#### Stage D — Advanced source mode

- Sanitized HTML/CSS for trusted administrators
- Raw ZPL/TSPL for advanced users
- Syntax and capability validation
- Preview before publish
- Version history and rollback
- Permission `printing.templates.advanced_edit`

### 8.4 Template lifecycle

```text
Create draft
  -> Preview with fixture data
  -> Validate schema/capabilities
  -> Test print
  -> Publish version
  -> Assign route
  -> Monitor output
  -> Clone or rollback
```

Published templates should be immutable. Editing creates a new version.

### 8.5 Fixture data and preview

Every document type needs canonical fixture data covering:

- Short and long names
- Multiple items
- Discounts and promotions
- Multiple tax lines
- Multiple payments
- Refunds/returns
- Jewelry weights and purity
- Images
- Missing optional fields
- Long localized text
- Duty-free fields

## 9. Device and app strategy

The Print Module must be ready for future clients without requiring an app immediately.

### Web browser

- Manual browser print
- PDF download
- Local Agent through localhost where installed

### Desktop/local agent

- Silent receipt printing
- Office PDF printing
- ZPL/TSPL labels
- Printer discovery and status
- Offline queue
- USB, system queues, and network TCP

### Future Zettaz Cloud mobile app

The app name is **Zettaz Cloud**.

The first app should be a client of the same web application and Print Job protocol, not a new POS rewrite. It may begin as a WebView shell with a native printing bridge and later evolve toward native screens where required.

Initial mobile scope:

- Secure WebView
- Device identity
- Store/station registration
- Local network permission flow
- Native TCP thermal printing
- Print status and retry
- Barcode/camera support later

The app must not embed printer secrets in JavaScript or accept unrestricted printer hosts from the page.

## 10. Security requirements

- Printer destination resolved server-side by tenant-scoped ID
- No arbitrary host/port from browser requests
- Local Agent binds to loopback by default
- Explicit origin allowlist
- Device registration and revocation
- Short-lived signed job authorization where appropriate
- Idempotency and replay protection
- Payload size and timeout limits
- Raw template permissions
- Audit event for create, dispatch, complete, fail, cancel, and reprint
- Sensitive customer/payment data excluded from diagnostic logs
- SSRF protection for any server-side network adapter

## 11. Final implementation decision

Zettaz Cloud will build an independent Print Module with:

1. Canonical document payloads
2. Printer devices and stations
3. Versioned templates
4. Routing rules
5. Durable print jobs
6. Adapter-based delivery
7. Structured and custom template design
8. Local Agent readiness
9. Future Zettaz Cloud app readiness
10. Duty-free profiles without global legal assumptions

Implementation should begin with security hardening and the data model, not with another printer-specific integration.
