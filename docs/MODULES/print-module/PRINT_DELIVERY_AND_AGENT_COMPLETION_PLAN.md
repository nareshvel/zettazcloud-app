# Print Delivery and Agent Completion Plan

**Created:** 2026-08-26  
**Status:** Planning approved in principle; agent technology decision pending  
**Scope:** Local system printing, network ESC/POS, return documents, installers, device configuration, and field certification

## Evidence from current QA

### Electron development launch is blocked

Running `npm run electron:dev` on macOS exits with `SIGKILL`. The workstation security product reports `Electron.app` as malware and moves it to Trash. The package build itself succeeds, but the generated application is unsigned and not notarized. This is a release blocker, not an application-logic error that should be bypassed.

### macOS package builds but is unsigned

`npm run dist` successfully creates the Apple Silicon DMG and ZIP, but reports:

- No application author metadata
- Default Electron icon
- No valid Developer ID identity
- Code signing skipped
- APFS DMG output

The DMG is therefore a development artifact, not a production-ready installer.

### Network ESC/POS connectivity works

Both simulator sockets are reachable from the local backend:

```text
127.0.0.1:9100
127.0.0.1:9101
```

A direct receipt print reaches the simulator, proving TCP transport works.

### Network ESC/POS content is incomplete

The simulator output includes store identity and receipt framing but prints:

```text
No items found
$0.00
```

The cause is architectural: the backend direct-print route parses rendered template HTML back into receipt data. The new Print Template renderer's HTML structure is not the legacy structure expected by `extractReceiptData()`. Physical printer testing would reproduce the same missing-item output; do not use a real printer to certify content until this parser dependency is removed.

## Target print contract

Stop using one HTML representation for every destination and then reverse-parsing it.

Use one canonical document payload and destination-specific renderers:

```text
Sale / Return / Document data
→ canonical print payload
→ HTML/PDF renderer for browser and page printers
→ ESC/POS renderer for thermal printers
→ ZPL/TSPL renderer for labels
```

Delivery receives already-rendered content appropriate to the printer:

- Browser: HTML/PDF
- Local system printer: PDF for A4/Letter; PDF/raster or RAW for thermal depending on driver
- Network thermal printer: ESC/POS bytes
- Label printer: ZPL/TSPL bytes

Never parse HTML to reconstruct item/tax/payment data.

## Agent technology decision

### Keep Electron v1

Advantages:

- Existing code and Electron system-printer enumeration
- Direct HTML rendering via Chromium
- Lowest short-term rewrite effort

Disadvantages:

- Large installer/runtime
- Current Electron 31 dependency line is old and has a high vulnerability burden
- Unsigned Electron binary is blocked by workstation security
- Current page-size logic is thermal-only
- Requires Apple/Windows signing work
- HTML rendering ties the agent to browser layout behavior

### Build Go Agent v2

Advantages:

- Small single-purpose binaries
- Lower runtime footprint and faster startup
- Good fit for Windows Service/menu-bar/tray background process
- Native access to Windows spooler and macOS/Linux CUPS (`lp`/`lpstat`)
- Straightforward RAW ESC/POS/ZPL/TSPL dispatch
- Can be reused across Zettaz and iRestrack applications with a versioned, application-neutral contract
- Easier structured configuration, queue, logs, diagnostics, and local authentication

Challenges:

- Go does not natively render arbitrary HTML/CSS with browser fidelity
- A4/Letter should therefore be supplied as PDF, not HTML
- Windows and macOS printer APIs require platform-specific adapters
- Tray/settings UI needs either native libraries, a localhost web UI, or a small Wails shell
- Signing/notarization is still required for trusted distribution

## iRestrack Go agent audit result

The existing `app-iRestrack/tools/irestrack-print-bridge` is a useful foundation, but it is not a complete cross-platform system-printer agent.

Reusable strengths:

- Go 1.21 with only two direct third-party dependencies (`systray`, `kardianos/service`).
- Unified `/v1/print_job` endpoint with base64 RAW payloads.
- TCP printing with timeouts and LAN/private-host restriction.
- Windows RAW spool printing through `winspool.drv`.
- Windows tray, configuration file, logs, service install/start/stop, and Inno Setup installer.
- Loopback device mode and shared-secret authentication.
- Request size limits and graceful HTTP server lifecycle.

Important gaps before reuse:

- macOS system/USB printing is explicitly unsupported by `usb_stub.go`; macOS currently supports TCP only.
- No printer enumeration or capabilities endpoint.
- No PDF/A4/Letter printing.
- No durable local queue, job status, cancellation implementation, idempotency, or retry persistence.
- CORS reflects any requesting origin and allows `*` without Origin; replace this with paired explicit origins.
- Shared secret is sent in each JSON request; move to paired token headers and replay protection.
- `/v1/forward` accepts configurable LAN HTTP targets and should not be part of the shared Zettaz agent.
- Product-specific names/environment variables and default LAN-listen mode must be removed.
- No repository-level license was found for this tool; confirm company ownership and add an explicit license/ownership notice before extracting shared code.
- Several indirect `getlantern` dependencies are old; audit and upgrade or replace the tray library.

Conclusion: reuse the Windows RAW/TCP/service patterns, not the binary or API unchanged. Build a product-neutral Go Agent v2 package with platform adapters.

## Recommendation

Adopt a **Go Print Agent v2** as the long-term shared agent. The iRestrack audit supports this direction, but the existing bridge must be refactored and hardened rather than rebranded unchanged.

Do not port Electron's HTML-print implementation line by line. Use a new versioned contract:

- PDF for page/system printers
- RAW bytes for ESC/POS and label printers
- Canonical job metadata and printer capabilities

Electron v1 was unused by clients and was deleted after the Go v2 foundation passed local build, test, health, and printer-enumeration checks. The audit record remains in documentation; no Electron source or installer artifacts remain in the codebase.

## Go Agent v2 functional scope

### API

- `GET /v1/health`
- `GET /v1/version`
- `GET /v1/printers`
- `GET /v1/printers/:id/capabilities`
- `POST /v1/jobs`
- `GET /v1/jobs/:id`
- `POST /v1/jobs/:id/cancel`
- `GET /v1/diagnostics`
- `GET/PUT /v1/config`

### Job payload

- Job ID and idempotency key
- Application/client ID
- Tenant/store/station ID where appropriate
- Document type
- Content type: `pdf`, `escpos`, `zpl`, `tspl`, optional `png`
- Base64/binary content
- Printer ID
- Copies
- Media size
- Orientation
- Cut/drawer options for thermal printers
- Correlation metadata without sensitive customer payload logging

### Printer support

- Windows spooler printer enumeration and status
- macOS CUPS printer enumeration and status
- System default printer
- PDF printing
- RAW spool printing
- Direct TCP ESC/POS/ZPL/TSPL where configured locally
- Capability-based filtering in Zettaz UI

### User configuration

Users should be able to configure:

- Friendly printer mappings by document family
- Default receipt printer
- Default invoice printer
- Default return/credit-note printer
- Label printer
- Media per printer
- Drawer/cut support
- Copies policy
- Auto-print policy
- Per-station overrides
- Test page and diagnostics
- Log level and retention
- Start on login/service startup

The cloud app should reference stable agent printer IDs, not OS display names alone.

### Security

- Loopback by default
- Explicit paired application origins
- Shared secret or asymmetric challenge generated during pairing
- Signed job requests
- Replay protection/idempotency
- Request/content size limits
- No arbitrary URL fetching
- No arbitrary public network targets
- Local config permissions
- Signed Windows binary and signed/notarized macOS application
- Structured logs with sensitive values redacted

## Full network ESC/POS implementation

### Phase 1 — Correct content

- Remove HTML-to-data parsing from the direct path.
- Produce ESC/POS from the canonical sale/return payload.
- Preserve selected Print Template intent through a thermal model, while acknowledging that free-form HTML layout cannot map exactly to character printers.
- Support item names, quantities, prices, discount, tax, totals, payment, customer/cashier, document number, barcode/QR, cut, and drawer commands.
- Add golden byte/text snapshots for 58 and 80 mm.

### Phase 2 — Secure device registry

- Configure simulator/physical printers as `printer_devices`.
- Store validated private `host:port` addresses server-side.
- Printer Settings selects `printer_device_id`; remove arbitrary address from browser payload.
- Enforce tenant/store/device ownership and active status.
- Add connectivity/status test.

### Phase 3 — Job orchestration

- Route through `print_jobs` and adapters.
- Add idempotency, retry policy, status, history, and reprint.
- Prevent duplicate jobs across browser retries.
- Surface actionable failure states.

### Phase 4 — Certification

- Simulator 9100 and 9101
- At least one physical 58/80 mm ESC/POS printer
- Long names and wrapping
- Unicode/code pages
- Barcode/QR scanning
- Cut/drawer
- Network timeout/recovery
- Copies/idempotency

## Return / Credit Note completion

Delete remaining legacy return-setting dependencies and make Print Templates the only renderer.

### Data/settings

- Add a dedicated `return` route to print document settings, or a clearly versioned route mapping with its own template/media/delivery fields.
- Do not reuse deprecated `printer_settings`.
- Configure explicit `return` template ID.
- Support `80mm`, `a4`, and `letter` media.

### Templates

- Keep `retail-return-80` for thermal refunds.
- Add `retail-return-a4` as a simple universal A4/Letter Credit Note.
- Include original sale reference, return number/date, customer, returned items, tax reversal, refund method, totals, reason, notes, and signature/authorization fields.
- Allow vertical-specific improvements later without blocking the universal template.

### Runtime

- Rewrite `useReturnReceipt` to use `print_document_settings` and the same action resolver used by sales.
- Pass explicit return template ID to `renderReturnWithTemplate`.
- Remove receipt-template fallback after every store has a published return template.
- Remove legacy settings fetch and legacy fallback comments/code.
- Route browser/agent/network delivery according to return settings and capabilities.

### QA

- Thermal refund
- A4 Credit Note
- Letter Credit Note
- Browser preview and Auto Print
- Original sale reference
- Partial and full returns
- Tax-inclusive/exclusive reversals
- Duty-free return
- Inventory restock and refund payment reconciliation

## Sequenced execution plan

1. **Completed:** Audit the existing iRestrack Go agent source, dependencies, license, API, printer backends, and installer process.
2. **Completed:** Created the Go Agent v2 foundation in `app-zettaz-cloud/print-agent/` and removed Electron source/artifacts.
3. Remove legacy return printing and implement dedicated thermal/A4/Letter return configuration and templates.
4. Freeze and version the canonical Agent v2 API/job contract.
5. Fix network ESC/POS content using canonical payloads; certify simulator output before physical testing.
6. Wire secure `printer_device_id` selection into Printer Settings.
7. Build Go v2 printer enumeration, macOS CUPS/PDF spool, Windows PDF/RAW spool, TCP RAW, config, queue, diagnostics, and pairing.
8. Add Windows/macOS packaging, signing, notarization, checksums, and update strategy.
9. Run simulator, physical thermal, Canon/page-printer, Windows, and macOS certification.
10. Apply installer-only `dist-app/` cleanup after verified Windows and macOS installers exist.

## Definition of complete app state

- No legacy receipt or return renderer/settings path remains.
- Every printable document uses the canonical payload and Print Template platform.
- Page printers receive PDF; thermal/label printers receive native command formats.
- Browser, local agent, and network-device routes are capability-aware and truthful.
- Printer addresses are never accepted arbitrarily from browser requests.
- Sale, invoice, return, certificate, and label routes are configurable without conflating template type and printer route.
- Agent installers are signed, verified, downloadable, and supported for listed architectures.
- Simulator and real-hardware certification procedures pass.
