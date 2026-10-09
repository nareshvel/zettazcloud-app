# Project Operational Notes

## MySQL Connection Pool — Critical Constraints

- The production MySQL database runs on the same VPS at `localhost:3306` using `zettazcloud_systemadmin` / `zettazcloud_prod`.
- These pool limits are used by default:
  - **Dev `.env`**: `DB_CONNECTION_LIMIT=3`, `DB_MAX_IDLE=1`, `DB_IDLE_TIMEOUT=60000`
  - **Production `.env`**: `DB_CONNECTION_LIMIT=5`, `DB_MAX_IDLE=2`, `DB_IDLE_TIMEOUT=120000`
- You can raise the production pool on a local MySQL server, but `DB_CONNECTION_LIMIT` should still not exceed the MySQL `max_connections` setting.
- `server.js`'s `safeExit()` helper closes the pool before any `process.exit()` — always use it, never bare `process.exit()`, or connections leak for 8 hours.
- `config/db.js`'s `query()` and `getConnection()` retry on `ER_CON_COUNT_ERROR` and `PROTOCOL_CONNECTION_LOST` with backoff.
- Never use `mysql.createConnection()` in server code — always use the shared pool via `require('./config/db')` or `require('./db')`.

## Print Agent macOS build

- Current version: 2.3.12
- Build script: `print-agent/installer/macos/package.sh`
- Creates a universal (arm64 + x86_64) signed and notarized `.pkg` installer with app icon
- Requires Developer ID Application and Developer ID Installer certificates in Keychain
- Notarization uses a keychain profile (default: `zettaz-notary`)
- To create the notary profile: `xcrun notarytool store-credentials --apple-id <you@example.com> --team-id 7688G2MP45 zettaz-notary`
- Build: `cd print-agent && bash installer/macos/package.sh`
- Output: `print-agent/installer/macos/zettaz-print-agent-macos.pkg` (plus timestamped build directory)
- The installer does not auto-start the service; users must start it manually or use the Print Agent page
- Frontend integration: Running `npm run build` in the frontend automatically copies the current versioned installer (e.g., `zettaz-print-agent-macos-2.3.5.pkg`) to `frontend/public/downloads/`, removes all other `.pkg` files (including `zettaz-print-agent-macos-latest.pkg`), and updates the manifest to point to the current versioned file

## Print Agent Downloads Policy

- Only the current versioned installer is kept in `frontend/public/downloads/` and `frontend/dist/downloads/`
- Old versioned `.pkg` files (e.g., `zettaz-print-agent-macos-2.3.4.pkg`) and any `zettaz-print-agent-macos-latest.pkg` copy are removed on each build
- The `manifest.json` points to the current versioned `.pkg` (e.g., `zettaz-print-agent-macos-2.3.5.pkg`) for both `url` and `latestUrl`
- Version metadata is still stored in `manifest.json` for display (`version` field)
- This keeps the frontend build small and avoids stale installer clutter

## UI conventions worth knowing

- **Tooltips are instant**: `frontend/src/components/common/TitleTooltip.tsx` (mounted
  in `App.tsx`) globally intercepts hovers on any `[title]` element, suppresses the
  ~1s native browser tooltip, and renders a styled one after 120ms. Keep writing
  `title="..."` normally — it's fast everywhere. Only reach for the Radix
  `ui/tooltip.tsx` components for rich content or explicit positioning.
- **Metric/KPI cards** carry a `border-r-4` right-edge accent bar (primary or
  semantic color). New stat cards should follow the same pattern.

## Production backend deployment

- Production backend repository: `/var/www/zettazcloud-app`
- PM2 application name: `zettaz-api`
- Backend port: `5172`
- Full deployment: `bash /var/www/zettazcloud-app/deploy.sh`
- Quick deployment for minor frontend/backend changes: `bash /var/www/zettazcloud-app/deploy-quick.sh`
- The MySQL database is `zettazcloud_prod` on the same VPS at `localhost:3306`.
- The production backend server public IP is `185.75.21.46`.
- If you see `ER_ACCESS_DENIED_ERROR`, check that `zettazcloud_systemadmin` exists with `GRANT` on `zettazcloud_prod.*` and that MySQL is listening on `127.0.0.1`.
- Verify database connectivity on the production server with `cd /var/www/zettazcloud-app/backend && node scripts/check_db_connection.js` before restarting PM2.
- Historical errors can remain in PM2 log files after a successful restart. Confirm current startup from the newest output lines and verify the API responds instead of treating old error-log lines as a current failure.
- PM2 `online` status alone is not sufficient proof of application health because a process can briefly appear online while restart-looping.

## Network ESC/POS Printing Implementation (2026-08-27)

### Architecture Change

Network ESC/POS printing now uses a raster-based pipeline instead of text-based conversion:

**Old Flow (removed):**
1. Frontend sends HTML to backend `/api/print/convert`
2. Backend extracts structured data from HTML
3. Backend converts to text-based ESC/POS commands
4. Backend sends to network printer directly from server

**New Flow:**
1. Frontend renders selected Print Template as HTML
2. Frontend uses `html2canvas` to render HTML to canvas
3. Frontend resizes canvas to thermal printer native width (384px for 58mm, 576px for 80mm)
4. Frontend converts canvas to monochrome pixels
5. Frontend encodes pixels as ESC/POS GS v 0 raster commands
6. Frontend adds feed and paper-cut commands
7. Frontend sends raster bytes to local Print Agent via TCP
8. Print Agent forwards bytes to network printer (e.g., `127.0.0.1:9100`)

### Files Changed

- `frontend/src/services/printerService.ts`:
  - Added `rgbaToEscposRasterBase64()` - converts RGBA pixels to ESC/POS raster bytes
  - Added `htmlToEscposRasterBase64()` - renders HTML to canvas and converts to raster
  - Removed backend `/api/print/convert` call from `printReceiptToNetworkPrinter()`
  - Removed `receiptData` parameter from network print path (unused)

- `backend/routes/printRoutes.js`:
  - Removed `/api/print/convert` endpoint (conversion now client-side)
  - Main `/api/print` route still handles legacy network printing but is not used by new frontend

- `frontend/src/services/printerService.test.ts`:
  - Added test for `rgbaToEscposRasterBase64()` encoding
  - Verifies ESC/POS raster header, pixel encoding, feed, and cut commands

- `backend/tests/printConversionRoute.test.js`:
  - Updated to verify conversion happens before printing (legacy route check)

### Known Issues (as of 2026-08-27)

1. **Invoice format with print agent**: Still printing directly to Canon printer instead of routing through local Agent. The `deliveryMode: 'local_agent'` path may need verification.

2. **Receipt format with network printer ESC/POS**: Not printing at all. Possible causes:
   - `html2canvas` may not be loaded or imported correctly
   - CORS issues with logo images (tainting canvas, preventing `getImageData`)
   - iframe rendering timing issues (150ms delay may be insufficient)
   - Browser security restrictions on canvas pixel access

3. **html2canvas dependency**: Added dynamically via `import('html2canvas')` in `htmlToEscposRasterBase64()`. Ensure `html2canvas` is in `package.json` and installed.

### Testing Checklist

For network ESC/POS printing:
- [ ] Verify `html2canvas` is installed: `cd frontend && npm list html2canvas`
- [ ] Check browser console for errors during print (especially CORS/tainted canvas errors)
- [ ] Verify Docker simulator is reachable: `nc -vz 127.0.0.1 9100`
- [ ] Check Print Agent jobs.json for new TCP jobs with `contentType: "escpos"`
- [ ] Verify raster bytes are being sent (not PDF or plain text)

For local agent printing:
- [ ] Verify `deliveryMode: 'local_agent'` is being set correctly in Printer Settings
- [ ] Check that `printReceipt()` is using the local agent path, not falling back to browser print
- [ ] Verify Print Agent is running and paired
- [ ] Check jobs.json for jobs with `destination: "system"` and correct `printerId` (CUPS queue name)

### Deployment Notes

- Production backend deployment may require a clean restart to clear Node.js module cache
- Use `bash /var/www/zettazcloud-app/deploy.sh` to pull the latest code, reinstall dependencies, restart PM2, and rebuild the frontend
- Use `bash /var/www/zettazcloud-app/deploy-quick.sh` for minor changes (pull, reload, build)
- Frontend build automatically copies the current Print Agent installer to `frontend/public/downloads/` and updates `manifest.json`

## NPM Security Vulnerabilities (2026-08-27)

### Status: ✅ 0 vulnerabilities (was 5)

All npm security vulnerabilities have been fixed using dependency overrides in `frontend/package.json`:

### Vulnerabilities Fixed

1. **uuid (MODERATE, PRODUCTION)** - CVE-2026-41907
   - Issue: Missing buffer bounds check in v3/v5/v6 when buf is provided
   - Fixed by: Override exceljs to use uuid@11.1.1
   - Impact: Production code (exceljs dependency)

2. **serialize-javascript (HIGH, DEV)** - GHSA-5c6j-r48x-rmvq
   - Issue: RCE via RegExp.flags and Date.prototype.toISOString()
   - Fixed by: Override mocha to use serialize-javascript@7.1.0
   - Impact: Dev only (mocha test framework)

3. **serialize-javascript (MODERATE, DEV)** - GHSA-qj8w-gfj5-8c6v
   - Issue: CPU exhaustion DoS via crafted array-like objects
   - Fixed by: Same override as above (7.1.0 fixes both)

4. **diff/jsdiff (LOW, DEV)** - GHSA-73rr-hh4g-fpgx
   - Issue: DoS in parsePatch and applyPatch with line break characters
   - Fixed by: Override mocha to use diff@8.0.4
   - Impact: Dev only (mocha test framework)

### Implementation

Added `overrides` section to `frontend/package.json`:

```json
"overrides": {
  "exceljs": {
    "uuid": "^11.1.1"
  },
  "mocha": {
    "serialize-javascript": "^7.0.5",
    "diff": "^8.0.3"
  }
}
```

### Why Overrides Instead of Upgrades?

Using npm overrides is safer than upgrading to new major versions because:
- Avoids potential breaking changes in exceljs, mocha, or their dependencies
- Targets only the vulnerable transitive dependencies
- Maintains compatibility with existing code
- All 664 tests pass with the overrides

### Verification

```bash
cd frontend
npm audit  # Returns: found 0 vulnerabilities
npm test   # Returns: 664 tests passed
```

### Maintenance

When upgrading dependencies in the future:
1. Check if newer versions of exceljs/mocha already include these fixes
2. If so, remove the corresponding override
3. Run `npm audit` to verify
4. Run tests to ensure compatibility

## Imported Claude Cowork project instructions

Read `/CLAUDE.md` at the repo root before doing any nontrivial work — it is
the single source of truth for conventions, module status, and known pending
work across all AI tools on this project (Claude, Devin, Codex, Cursor). It
in turn points to `docs/AI_CONTEXT/HANDOFF_PROTOCOL.md` and
`docs/AI_CONTEXT/SESSION_LOG.md`, which are the actual cross-tool handoff
mechanism: read the last few session-log entries before starting, and append
one before finishing. This file (`AGENTS.md`) stays for the operational
specifics above that are genuinely tool-agnostic infrastructure notes
(DB pool limits, Print Agent build/deploy) — don't duplicate `CLAUDE.md`'s
content here, just point at it.
