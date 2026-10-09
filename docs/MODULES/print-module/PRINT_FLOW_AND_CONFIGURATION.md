# Print Flow and Configuration — Operator & Developer Reference

How a document gets from the app to paper: which settings exist, what each
delivery mode actually does, what the Print Agent is (and isn't) needed for,
and what happens when nothing is configured. This is the *runtime truth* doc;
the redesign plan and blueprints elsewhere in this folder describe intent and
history.

## Document families

There are two independent configuration surfaces — they do not share settings.

### 1. Sales documents — `print_document_settings`

One row per `(tenant, store, document_type)`:

| `document_type` | What it is | Template | Media |
|---|---|---|---|
| `receipt` | Thermal POS receipt after checkout | `print_templates` (`receipt`) | 58mm / 80mm roll |
| `invoice` | A4/Letter formal document | `print_templates` (`invoice`, `jewelry_invoice`) | Page formats |
| `register_close` | X/Z shift report after a register close | **Built-in layout** (no template picker — `template_id` is forced null) | 58mm / 80mm roll |

Configured in **Settings → Printer Settings**. Which of `receipt`/`invoice`
a completed sale uses is decided by the store's
`default_sale_document_type` ("Default document after checkout" radio on the
same page). Refunds/credit notes currently ride the `receipt` route.

Per-row fields: `delivery_mode`, `printer_name`, `media_size`,
`template_id`, `copies`, `enabled`, `auto_print`.

### 2. Labels / tags — `stores.label_*` columns

Configured in **Settings → Label Printer** (`LabelPrinterSettings.tsx`,
backed by `labels.routes.js`). Single per-store choice:

| `label_printer_type` | Behavior |
|---|---|
| `none` | Label print calls fail with "not configured" |
| `browser` | Backend returns rendered HTML; frontend opens a window + `window.print()` |
| `zebra_zpl` | Backend generates ZPL II and sends it **from the server** over TCP to `label_printer_address` (default port 9100) |
| `tsc_network` | Same, with TSPL-EZ for TSC/Godex printers |

> ⚠ Label network printing is **server-side TCP** — the label printer must be
> reachable from the backend host (the VPS), not from the cashier's device.
> A printer on a store LAN behind NAT is *not* reachable this way; use
> `browser` or plan for the agent-relay path. This is a real deployment
> constraint, not a UI choice.

## Delivery modes (sales documents)

Set per document type. Defined values: `browser`, `direct`, `local_agent`
(`server` exists in the legacy `printer_settings` schema but is
unimplemented — it falls back to browser).

### `browser`

HTML (template render or report) → hidden iframe → `window.print()` system
dialog. The user picks the printer, paper, and copies every time.

- No agent, no driver, works everywhere a browser runs.
- `printer_name` is stored as null; `copies` is forced to 1 (a browser print
  dialog's copies field can't be preset — the UI shows this as a hint).
- Needs a published template for receipt/invoice; `register_close` uses its
  built-in layout.
- **This is the default when nothing is configured.**

### `direct` — network ESC/POS

HTML → `html2canvas` raster (384px for 58mm, 576px for 80mm) → monochrome →
ESC/POS `GS v 0` raster commands → `POST /v1/jobs` on the **local Print
Agent** with `destination: 'tcp'` → agent opens a TCP socket to
`printer_name` (`host:port`, default convention 9100).

- **Requires the Print Agent installed, running, and paired on the cashier's
  device** — the browser cannot open raw TCP sockets. "Network printer" means
  *agent relays to a network printer*, not browser→printer.
- `printer_name` holds `host:port`, not a system queue name.
- Allowed for `receipt` and `register_close` (thermal media only); rejected
  for `invoice`.
- If the agent isn't reachable, checkout fails with an explicit error
  (fallback is disabled at POS; elsewhere it offers browser print).

### `local_agent` — silent system printing

HTML → PDF rendered in the browser → `POST /v1/jobs` on the local agent with
`destination: 'system'` → agent prints to an OS-level printer queue
(`printer_name` = CUPS queue / Windows printer name) via the platform's
normal print path.

- Silent — no dialog. This is the kiosk/counter mode.
- Requires agent running + paired for this browser's origin + `printer_name`.
- Works for all three document types, both roll and page media.
- `copies` is honored (the frontend loops the job).

### Nothing configured / disabled

If `enabled` is off, settings can't be fetched, or a non-browser mode lacks
its requirements, `printReceipt()` falls back to `browser` (with a toast).
At POS checkout `disableFallback` is on, so `direct`/`local_agent` failures
surface as errors instead of silently printing to a different path.

## The Print Agent's role, precisely

The agent (`print-agent/`, Go binary + macOS menu-bar launcher) is a
**device-level** facility, not a per-document choice:

| Mode | Needs agent? | What the agent does |
|---|---|---|
| `browser` | No | Nothing |
| `direct` | **Yes** | Relays ESC/POS bytes to `host:9100` |
| `local_agent` | **Yes** | Prints PDF to a system queue |
| Labels `browser` | No | Nothing |
| Labels `zebra_zpl`/`tsc_network` | No (server prints) | Nothing — backend sends TCP |

So showing agent status/settings when a store is configured for pure browser
printing is informational only — it's a device facility other documents or
delivery modes may use. The Printer Settings page already scopes the agent
detect/picker UI to `local_agent` routes; the header chip links to the
device's agent page.

Agent mechanics:

- Listens on `127.0.0.1:9419`. Pairing: the app sends a one-time code shown
  on the agent's local page (`http://127.0.0.1:9419/`) and in the menu bar;
  each browser gets an independent client token (multi-client pairing).
- **Per-device printer override**: "Use on this device" on the Print Agent
  page stores a localStorage override layered over the store's shared
  `printer_name` — two workstations at one store can use different printers.
- Version: `Check for Updates` compares the **running daemon's** version
  (from `/v1/health`) against `cloud.zettaz.com/downloads/manifest.json`,
  fetched cache-free. The `Running · x.y.z` menu line is the same running
  version — if it lags after installing a pkg, use `Restart Agent`.

## Auto-print

`auto_print` on a document type skips the preview step and initiates the
configured delivery immediately — receipts at checkout, the Z-report right
after a register close. It does not bypass the browser's print dialog in
`browser` mode (browsers require the user gesture/dialog); auto-print is only
fully silent in `direct`/`local_agent` modes.

## Decision guide

| Situation | Recommended |
|---|---|
| Single workstation, one thermal printer, occasional printing | `browser` — simplest, zero install |
| Counter POS, speed matters, thermal printer on LAN | `direct` + agent on the counter machine |
| Silent printing to any OS printer (incl. USB/A4) | `local_agent` + agent on the device |
| Labels on a LAN printer reachable from the server | `zebra_zpl`/`tsc_network` |
| Labels on a printer only the workstation can see | `browser` label driver (or plan agent-relay labels) |
| Multi-workstation, centralized management | Today: agent per device + per-device override. Future: Tier 1 cloud-mediated printing (`CLOUD_MEDIATED_PRINTING_DESIGN.md`) |

## Known gaps / way forward

- **Tier 1 cloud-mediated printing** (enroll workstation → cloud job queue →
  agent pulls via heartbeat) removes browser pairing from the printing path
  entirely; design is committed, implementation pending.
- Labels do not yet route through the agent — needed for store-LAN label
  printers behind NAT.
- `register_close` uses a built-in report layout; a tenant-editable Z-report
  template needs a session-data contract in the template renderer (separate
  epic).
- `server` delivery mode is a dead value kept for schema compatibility.

Key code paths: `frontend/src/services/printerService.ts` (delivery
dispatch + ESC/POS raster), `frontend/src/hooks/useReceipt.ts` (settings →
dispatch glue), `frontend/src/services/labelService.ts` +
`backend/routes/labels.routes.js` + `backend/services/labelPrintService.js`
(labels, server-side), `backend/controllers/printDocumentSettingsController.js`
(settings CRUD/validation), `print-agent/` (local agent).
