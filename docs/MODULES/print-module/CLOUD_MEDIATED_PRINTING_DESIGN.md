# Cloud-Mediated Printing — Design Proposal (Tier 1)

**Status:** Proposal — not implemented. Tier 2 pairing fixes shipped 2026-10-16
(commit `45c89f7`); this document proposes the durable replacement for
browser↔agent pairing.

## Problem statement

Browser pairing is per-browser localStorage + a 6-digit code exchanged with a
localhost agent. It breaks daily because:

- Tokens live in `localStorage` — lost on incognito, site-data clears, profile
  switches, new machines.
- One `print_document_settings.printer_name` is shared per
  (tenant, store, doc_type) — workstations with different printers ping-pong
  the shared value.
- Every user/browser on a workstation historically fought over a single
  pairing slot (fixed in Tier 2 by multi-client tokens — but pairing is still
  a per-browser chore).

The durable fix is to stop pairing browsers at all: **enroll the workstation
once, route jobs through the cloud, resolve printers server-side per device.**

## What already exists (~60% built)

| Layer | Exists | Missing |
|---|---|---|
| Agent | `/v1/fleet/enroll`, durable device token, 60s heartbeat loop, config on disk | Pulling/draining a job queue inside heartbeat |
| Backend | `POST /api/print-agent-connect/enroll` (code → device token), `heartbeat`, `configuration`; `print_agents`, `print_agent_enrollment_codes`, `print_agent_printer_mappings` tables; `/api/print-agents` CRUD | A `print_jobs` write path from the browser, a claim/deliver endpoint for agents |
| Frontend | `printAgentFleetService.ts` types + calls; `PrintAgentFleetSection` on the Print Agent page | UI to create enrollment codes, map printers per agent, and a `delivery_mode` that routes via the cloud |

## Proposed flow

### Enrollment (once per workstation, replaces pairing)

1. Admin opens Print Agent page → "Enroll this computer" → backend mints a
   short-lived enrollment code scoped to (tenant, store).
2. Code entered in the agent (local page, menu bar, or the same web page
   posting to `/v1/fleet/enroll` — open path, code is the credential).
3. Agent exchanges it for a **device token** (long-lived, hashed server-side,
   revocable) and writes it to `~/Library/Application Support/Zettaz/
   PrintAgent/config.json` — survives reboots, upgrades, browser changes.
4. From then on the agent heartbeats with the device token. No browser
   involvement.

### Job delivery (replaces direct browser→agent HTTP)

```
Browser ──POST /api/print-jobs {document, route}──► backend
                                                     │  (queued, tenant+store scoped)
Agent  ◄──GET /api/print-agent-connect/jobs?wait=30──┘   (long-poll inside heartbeat)
Agent  ──POST /api/print-agent-connect/jobs/:id/ack────► backend (done/failed + error)
```

- **Long-poll on the existing heartbeat** — no websockets, no inbound ports,
  works through NAT/firewalls. Heartbeat interval stays ~30–60s for presence;
  the jobs endpoint blocks up to ~25s so latency is sub-second in practice.
- **Printer resolution server-side**: `print_agent_printer_mappings` maps
  (agent, route → printer name, priority, is_fallback). If the mapped printer
  is absent the agent reports `failed` with a reason; cloud may re-queue to a
  fallback agent in the same store.
- **Payload**: raster ESC/POS base64 (existing `rgbaToEscposRasterBase64`
  pipeline) or PDF — the same bytes the browser sends to the agent today,
  just relayed by the backend.

### Delivery modes

`print_document_settings.delivery_mode` gains `store_agent`:

| Mode | Behavior |
|---|---|
| `store_agent` (new) | Browser → cloud queue → enrolled store agent prints. No pairing, works for every user/browser. |
| `local_agent` (kept) | Direct browser→agent for machines that pair (still supported, Tier-2 hardened). |
| `browser`, `network` | Unchanged fallbacks. |

**Fallback ladder on submit:** `store_agent` → if no online agent for the
store, either queue anyway (agent picks up when online) or warn the user and
fall back to browser print — configurable per document type.

## Key decisions to confirm

1. **Pull vs push.** Pull/long-poll is recommended — zero inbound
   connectivity on the workstation. Push (SSE/websocket) would be faster but
   adds a persistent-connection layer the backend doesn't have today.
2. **Job payload path.** Inline in the job row (simple, ~100KB raster is fine
   for MySQL `MEDIUMBLOB`) vs object storage (needed only if payloads grow).
   Start inline.
3. **Scope.** Device enrolls to a **store** (printer mappings are per-agent
   anyway), so agents in different stores never see each other's jobs.
4. **Revocation.** `DELETE /api/print-agents/:id` must invalidate the device
   token — heartbeat then gets 401 and the agent falls back to unenrolled
   (pairing still works for `local_agent` mode).
5. **Job retention.** Acked jobs retained 7 days for audit/reprint, then
   purged — mirrors the agent's own jobs.json lifecycle.

## What happens to pairing

Keep it — `local_agent` remains a supported mode for offline/edge cases and
as a bootstrap path for enrollment. Tier 2 fixes (multi-client tokens, code
privacy, rate limiting, KeepAlive) make it a viable fallback rather than the
daily-driver it is today.

## Rollout sketch

1. Backend: `print_jobs` queue table + enqueue/claim/ack endpoints (reuse the
   dormant `print_jobs`/`print_stations` schema if compatible).
2. Agent: job-drain goroutine in the fleet heartbeat; execute via existing
   job pipeline (`destination: system|tcp`).
3. Frontend: enrollment-code UI on the Print Agent page, per-agent printer
   mapping UI, `store_agent` option in Printer Settings.
4. Cutover: per store — set `delivery_mode: store_agent`, enroll one
   workstation, verify, repeat.
