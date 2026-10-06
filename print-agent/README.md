# Zettaz Print Agent v2

Product-neutral Go print service used by Zettaz Cloud and intended for reuse by other Zettaz applications.

## Status

Go v2 foundation is active. The previous Electron application and generated artifacts were removed on 2026-08-26 because they were unused, unsigned, blocked by endpoint security, thermal-size-only, and carried outdated dependencies.

Implemented:

- Loopback HTTP service
- Strict origin allowlist
- Bearer-token protection for printer/job endpoints
- Health and printer enumeration
- macOS/Linux CUPS printer enumeration
- macOS/Linux PDF and RAW spool printing
- Windows printer enumeration
- Windows RAW spool printing
- Private-network TCP RAW printing
- Base64 job payloads
- In-memory idempotency/status for the current process
- Copies validation
- PDF, ESC/POS, ZPL, and TSPL content types

Completed after the initial foundation:

- Persistent hashed-token pairing and disconnect flow
- Frontend detect/pair/disconnect UI
- Persistent queue with restart recovery, three attempts, cancellation, status polling, and seven-day cleanup
- Diagnostics endpoint and UI
- Rotating local log files
- Windows Service and macOS LaunchAgent lifecycle commands
- Windows Inno Setup and macOS PKG installer scaffolding
- Windows PDF adapter through SumatraPDF

External/release work still required:

- Bundle/license-review SumatraPDF or replace it with an owned Windows PDF adapter
- Tray/menu-bar settings UI
- Signed Windows installer
- Signed/notarized macOS installer
- Auto-update
- Physical printer certification

## Structure

```text
print-agent/
├── cmd/zettaz-print-agent/main.go
├── internal/agent/
├── internal/printer/
├── installer/windows/
├── installer/macos/
├── go.mod
├── README.md
└── PROJECT_STATUS.md
```

## Development

Requires Go 1.23 or newer.

```bash
cd print-agent
go test ./...
go vet ./...
go run ./cmd/zettaz-print-agent
```

Development without pairing:

```bash
ZETTAZ_AGENT_ALLOW_UNPAIRED=true \
ZETTAZ_AGENT_ALLOWED_ORIGINS=http://localhost:5173 \
go run ./cmd/zettaz-print-agent
```

Default address:

```text
127.0.0.1:9419
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ZETTAZ_AGENT_LISTEN` | `127.0.0.1:9419` | Loopback listener |
| `ZETTAZ_AGENT_TOKEN` | none | Bearer token required for printer/job endpoints |
| `ZETTAZ_AGENT_ALLOWED_ORIGINS` | localhost dev + cloud.zettaz.com | Comma-separated exact browser origins |
| `ZETTAZ_AGENT_ALLOW_UNPAIRED` | false | Development-only access without token |

Do not enable unpaired mode in production.

## API v1

### Pairing

```text
POST /v1/pair
DELETE /v1/pair
```

The six-digit pairing code is written to the Agent startup output and rotating `agent.log`. The returned token is stored hashed in the Agent configuration and stored by the paired browser in local storage.

### Health

```text
GET /v1/health
```

Health is intentionally available without a token and contains no sensitive data.

### Printers

```text
GET /v1/printers
Authorization: Bearer <token>
```

### Submit job

```text
POST /v1/jobs
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "id": "unique-idempotency-key",
  "clientId": "zettaz-cloud",
  "destination": "system",
  "printerId": "Canon_TS3700_series",
  "contentType": "pdf",
  "payloadBase64": "...",
  "copies": 1,
  "mediaSize": "a4"
}
```

TCP RAW example:

```json
{
  "id": "unique-idempotency-key",
  "clientId": "zettaz-cloud",
  "destination": "tcp",
  "address": "127.0.0.1:9100",
  "contentType": "escpos",
  "payloadBase64": "...",
  "copies": 1,
  "mediaSize": "80mm"
}
```

### Job status and cancellation

```text
GET /v1/jobs/<id>
POST /v1/jobs/<id>/cancel
Authorization: Bearer <token>
```

### Diagnostics

```text
GET /v1/diagnostics
Authorization: Bearer <token>
```

## Build

macOS Apple Silicon:

```bash
mkdir -p dist-app
GOOS=darwin GOARCH=arm64 go build -trimpath -ldflags="-s -w" \
  -o "dist-app/Zettaz Print Agent-arm64" ./cmd/zettaz-print-agent
```

Windows x64:

```bash
mkdir -p dist-app
GOOS=windows GOARCH=amd64 go build -trimpath -ldflags="-s -w -H windowsgui" \
  -o "dist-app/Zettaz Print Agent.exe" ./cmd/zettaz-print-agent
```

The GitHub Actions workflow builds and checksums both platform binaries. Installer packaging/signing remains pending. `dist-app/` must eventually contain only verified installer packages, not unpacked builds or build metadata.

## Documentation

- `docs/print-module/PRINT_AGENT_AUDIT_AND_OPERATIONS.md`
- `docs/print-module/PRINT_DELIVERY_AND_AGENT_COMPLETION_PLAN.md`
