# Zettaz Print Agent v2 — Audit and Operations

**Current version:** 2.0.0-dev  
**Technology:** Go  
**Status:** Development features complete; signing, external PDF dependency decision, installer QA, and physical certification pending

## Architecture decision

The unused Electron 1.0.1 implementation was deleted on 2026-08-26 with explicit approval. It was unsigned, blocked by endpoint security, thermal-size-only, dependency-heavy, and not installed by clients.

The existing `app-zettaz-cloud/print-agent/` folder now contains the only Zettaz Print Agent implementation: a product-neutral Go Agent v2 intended for reuse by Zettaz Cloud, iRestrack, and future Zettaz applications.

The iRestrack Go bridge was audited as reference material. Reused ideas include TCP RAW delivery, Windows Winspool, service lifecycle, configuration, request limits, and installer patterns. Product-specific endpoints, permissive CORS, weak shared-secret transport, missing macOS system printing, and legacy relay behavior were not copied unchanged.

## Current structure

```text
print-agent/
├── cmd/zettaz-print-agent/main.go
├── internal/agent/server.go
├── internal/agent/server_test.go
├── internal/printer/printer.go
├── internal/printer/system_darwin.go
├── internal/printer/system_linux.go
├── internal/printer/system_windows.go
├── installer/macos/
├── installer/windows/
├── go.mod
├── README.md
└── PROJECT_STATUS.md
```

No Electron source, Node dependencies, package files, unpacked applications, blockmaps, or old installer artifacts remain.

## Implemented capabilities

- Loopback HTTP service, default `127.0.0.1:9419`
- Exact origin allowlist
- Bearer-token authorization for printer/job endpoints
- Health endpoint
- Printer enumeration:
  - macOS/Linux through CUPS `lpstat`
  - Windows through `Get-Printer`
- System printing:
  - macOS/Linux PDF through CUPS `lp`
  - macOS/Linux RAW through CUPS `lp -o raw`
  - Windows RAW through `winspool.drv`
- Private-network/loopback TCP RAW delivery
- PDF, ESC/POS, ZPL, and TSPL job types
- Base64 payloads
- Copies validation
- In-process job status and idempotent job IDs
- Request/payload size limits
- Go tests, vet, macOS build, and cross-platform workflow

## Verified locally

```text
GET /v1/health
→ zettaz-print-agent, darwin, 2.0.0-dev

GET /v1/printers
→ _192_168_1_100
→ Canon_TS3700_series (default)
```

This proves the Go agent can enumerate the development Mac's Canon printer through CUPS. Physical PDF printing still requires field QA.

## Development

```bash
cd print-agent
go test ./...
go vet ./...
ZETTAZ_AGENT_ALLOW_UNPAIRED=true \
ZETTAZ_AGENT_ALLOWED_ORIGINS=http://localhost:5173 \
go run ./cmd/zettaz-print-agent
```

Do not enable unpaired mode in production.

## Current API

- `GET /v1/health`
- `GET /v1/printers`
- `POST /v1/jobs`
- `GET /v1/jobs/:id`

Jobs support:

```json
{
  "id": "idempotency-key",
  "clientId": "zettaz-cloud",
  "destination": "system",
  "printerId": "Canon_TS3700_series",
  "contentType": "pdf",
  "payloadBase64": "...",
  "copies": 1,
  "mediaSize": "a4"
}
```

TCP thermal example:

```json
{
  "id": "idempotency-key",
  "clientId": "zettaz-cloud",
  "destination": "tcp",
  "address": "127.0.0.1:9100",
  "contentType": "escpos",
  "payloadBase64": "...",
  "copies": 1,
  "mediaSize": "80mm"
}
```

## Frontend transition

The frontend Local Agent path now converts rendered HTML to PDF in the browser and submits it to `/v1/jobs` for system-printer delivery. Printer enumeration uses `/v1/printers`.

Temporary development can use unpaired mode. Production requires a pairing/token UI before customer deployment.

Network ESC/POS remains a separate backend route while secure printer-device and job orchestration work continues.

## ESC/POS simulator

Verified reachable from the local backend:

- `127.0.0.1:9100`
- `127.0.0.1:9101`

The first simulator test proved transport but exposed missing items/totals caused by reverse-parsing new template HTML. Direct test jobs now send structured fixture data, and real-sale jobs rebuild structured items/totals/payment data from tenant-scoped sale rows before ESC/POS formatting.

Retest the simulator before connecting a physical printer. Then certify cut, drawer, code page, barcode/QR, width, copies, and timeout recovery.

## Packaging policy

`dist-app/` was deleted with the Electron artifacts. It will be recreated only by Go v2 release builds.

Approved final policy: installer-only.

```text
dist-app/
├── Zettaz Print Agent Setup <version>.exe
└── Zettaz Print Agent-<version>-arm64.dmg
```

Do not store unpacked builds, ZIPs, blockmaps, builder metadata, Node dependencies, or `.DS_Store` in the release folder.

The workflow now builds/checksums Go binaries and creates unsigned Windows Inno Setup and macOS PKG installers. Signing steps require external certificates.

## Release blockers

- Apple Developer ID and notarization credentials
- Windows code-signing certificate
- SumatraPDF bundling/license decision or replacement Windows PDF adapter
- Tray/menu-bar settings UX; service/LaunchAgent lifecycle is implemented
- Clean-machine installer QA
- Physical Canon, Windows, ESC/POS, and label-printer certification
- Auto-update design and signed update channel

Pairing, persistent queue/recovery, retries, cancellation, diagnostics, rotating logs, service lifecycle, frontend configuration UI, and installer scaffolding are implemented.

Do not distribute 2.0.0-dev to customers.

## Next release sequence

1. Resolve SumatraPDF bundling/license or implement an owned Windows PDF spool adapter.
2. Add tray/menu-bar access to pairing code, status, logs, and service controls.
3. Configure Apple and Windows signing credentials in protected CI secrets.
4. Sign Windows binary/installer.
5. Sign/notarize/staple macOS application/installer.
6. Generate SHA-256 checksums.
7. Test clean installs on Windows and macOS.
8. Certify Canon PDF, ESC/POS TCP, Windows RAW/system, and label RAW jobs.
9. Implement and validate signed auto-update.
10. Publish installers and update `/print-agent` download links.

See `PRINT_DELIVERY_AND_AGENT_COMPLETION_PLAN.md` for the complete shared-agent and print-delivery plan.
