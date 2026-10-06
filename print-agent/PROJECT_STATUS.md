# Zettaz Print Agent v2 — Project Status

**Version:** 2.3.10 *(unreconciled discrepancy: the last version confirmed live via a real
rebuild/deploy during the 2026-08-29 origin/CORS fixes was 2.3.6 — reconcile which number is
current before relying on this field, see the note under Completed)*

**Technology:** Go service with native macOS menu-bar launcher

**Status:** Signed and notarized macOS pilot release; physical printer certification and Windows signing pending

## Completed

- Go-only product-neutral Agent; Electron fully removed
- Origin-gated loopback API — reworked 2026-08-29 to fix a dev-vs-production pairing conflict:
  pairing is now additive across origins (`config_store.go`'s `Pair()` appends rather than
  replaces `AllowedOrigins`), `cors()` in `server.go` checks both the static
  `ZETTAZ_AGENT_ALLOWED_ORIGINS` list and the persisted, pairing-grown list, and `/health`,
  `/v1/health`, and `/v1/pair` are exempted from the origin gate so a brand-new origin can
  discover and pair with the agent at all (previously every endpoint including health/pairing
  was gated, which was a chicken-and-egg deadlock for any origin with zero prior trust). Not
  independently compiled/verified by the AI session that made this change (no Go toolchain
  available there) — verified instead by a live rebuild/deploy to v2.3.6 with successful
  pairing on both `cloud.zettaz.com` and `localhost:5173`. See
  `docs/17-migration-and-roadmap/14_Sales_Hub_Search_First_Redesign.md` §4 for the full
  before/after and `CLAUDE.md`'s Critical conventions for the three-layer breakdown. Run `go
  build ./... && go vet ./...` before further changes here if picking this up fresh.
- Persistent pairing with six-digit code and hashed bearer token
- Frontend detect/pair/disconnect UX
- macOS/Linux/Windows printer enumeration
- macOS/Linux CUPS PDF and RAW printing
- Windows Winspool RAW printing
- Windows PDF printing through configurable SumatraPDF
- Private-network TCP RAW printing
- PDF, ESC/POS, ZPL, and TSPL jobs
- Persistent job queue and restart recovery
- Three-attempt retry policy
- Cancellation, retry, queue-listing, and job-status APIs
- Job ID idempotency
- Seven-day completed-job cleanup
- Sanitized diagnostics, pairing metadata, and frontend operations display
- Printer capability metadata and local test-print API
- Rotating local log files
- Native macOS menu-bar status, controls, diagnostics export, notifications, and launch-at-login
- Windows Service lifecycle
- Windows Inno Setup installer script
- Signed, notarized, universal macOS PKG installer
- Cross-platform CI build workflow and checksums

## Verified

- Go tests and vet pass
- Darwin, Windows amd64, and Linux amd64 builds pass
- macOS universal PKG is Developer ID signed, Apple-notarized, and stapled
- Frontend build passes
- Frontend 643/643 tests pass
- Backend focused 37/37 tests pass
- Pair → token → printers → diagnostics → unpair smoke passes
- macOS detects network queue and `Canon_TS3700_series` as default
- Structured ESC/POS smoke includes items and totals

## External release blockers

- Windows code-signing certificate
- Decision to bundle/license SumatraPDF or replace it with an owned PDF adapter
- Clean-machine installer QA across supported macOS versions
- Canon physical PDF print QA
- Windows physical system-printer QA
- ESC/POS physical thermal QA
- ZPL/TSPL label-printer QA
- Authenticated device enrollment before cloud heartbeat or remote fleet controls
- Fully automated update installation; current update checks direct users to the signed installer

## Release rule

Publish macOS builds only after Developer ID signing, Apple notarization, stapling, and clean-machine verification. Keep remote fleet controls disabled until device enrollment credentials and tenant isolation are implemented.
