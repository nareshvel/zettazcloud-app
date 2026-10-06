# Print Module - Phase 2: Print Job Service & Adapter Layer

**Date:** 2026-08-16
**Status:** Completed

## Overview

This document summarizes the Print Job Service and Adapter Layer implementation for the Zettaz Cloud print module. This phase adds job lifecycle management, retry logic, and a pluggable adapter architecture for different printer types.

## Changes Made

### 1. Print Job Service (`services/printJobService.js`)

Implemented complete print job lifecycle management:

#### Job Status States
- `pending` - Job created, waiting to be processed
- `queued` - Job queued for processing
- `processing` - Job is currently being printed
- `completed` - Job finished successfully
- `failed` - Job failed (can be retried)
- `cancelled` - Job was cancelled by user

#### Job Types
- `receipt` - POS receipts
- `invoice` - Invoices
- `label` - Product/piece labels
- `document` - A4/Letter documents
- `test` - Test prints

#### Core Functions
- `createPrintJob()` - Create new job with idempotency support
- `updateJobStatus()` - Transition job status
- `incrementRetryCount()` - Track retry attempts
- `getJob()` - Fetch single job
- `listJobs()` - List jobs with filters (status, type, device, pagination)
- `retryJob()` - Retry failed jobs (with max retry check)
- `cancelJob()` - Cancel pending/processing jobs
- `getJobStatistics()` - Get job counts by status
- `cleanupOldJobs()` - Delete old completed jobs (configurable retention)

#### Idempotency
- Jobs can have an `idempotency_key` to prevent duplicate prints
- If a job with the same key exists within 24 hours, the existing job is returned
- Useful for preventing duplicate prints on network retries

### 2. Print Job Routes (`routes/printJobs.routes.js`)

New API endpoints for job management:

- `GET /api/print-jobs` - List jobs with filters
- `GET /api/print-jobs/statistics` - Get job statistics
- `GET /api/print-jobs/:id` - Get specific job
- `POST /api/print-jobs` - Create new job
- `POST /api/print-jobs/:id/retry` - Retry failed job (requires `settings.update`)
- `POST /api/print-jobs/:id/cancel` - Cancel job (requires `settings.update`)
- `DELETE /api/print-jobs/cleanup` - Clean up old jobs (requires `admin`)

### 3. Adapter Layer (`services/printAdapters/`)

Implemented pluggable adapter architecture for different printer types:

#### Base Adapter (`PrintAdapter.js`)
- Abstract base class defining the adapter interface
- Methods: `print()`, `testConnectivity()`, `getStatus()`, `validateConfig()`

#### Network Thermal Adapter (`NetworkThermalAdapter.js`)
- Handles ESC/POS printing over TCP
- Supports thermal receipt printers
- Connection pooling with timeout handling
- Automatic disconnect after print

#### Label ZPL Adapter (`LabelZplAdapter.js`)
- Handles ZPL II printing for Zebra label printers
- TCP-based network connection
- Supports jewelry tags and product labels

#### Browser Adapter (`BrowserAdapter.js`)
- Returns HTML for browser-based printing
- Used for PDF generation and browser print dialogs
- No network connection needed

#### Adapter Factory (`AdapterFactory.js`)
- Maps device types to adapter classes
- `createAdapter()` - Instantiate appropriate adapter
- `getSupportedDeviceTypes()` - List supported types
- `isDeviceTypeSupported()` - Check type support

#### Current Adapter Mapping
| Device Type | Adapter | Status |
|---|---|---|
| `thermal_receipt` | NetworkThermalAdapter | ✅ Implemented |
| `laser` | BrowserAdapter | ⚠️ Placeholder (needs PDF adapter) |
| `inkjet` | BrowserAdapter | ⚠️ Placeholder (needs PDF adapter) |
| `label_zebra_zpl` | LabelZplAdapter | ✅ Implemented |
| `label_tsc_tspl` | LabelZplAdapter | ⚠️ Placeholder (needs TSPL adapter) |
| `label_dymo` | LabelZplAdapter | ⚠️ Placeholder (needs Dymo adapter) |
| `label_brother` | LabelZplAdapter | ⚠️ Placeholder (needs Brother adapter) |
| `pdf_generator` | BrowserAdapter | ⚠️ Placeholder (needs PDF adapter) |

### 4. Print Execution Service (`services/printExecutionService.js`)

Orchestrates print job execution using adapters:

#### Functions
- `executePrintJob()` - Execute a print job with full lifecycle tracking
  - Validates device
  - Creates job record
  - Updates status through lifecycle
  - Executes via adapter
  - Logs audit events
  - Handles errors with status updates

- `testPrinter()` - Test printer connectivity
- `getPrinterStatus()` - Get current printer status

### 5. Integration with Existing Routes

Updated `routes/printRoutes.js`:
- Now creates print job records when `printer_device_id` is provided
- Tracks job status: `pending` → `processing` → `completed`/`failed`
- Returns `job_id` in response for tracking
- Gracefully handles job creation failures (print continues)
- Uses `useJobTracking` flag to control job tracking

Updated `routes/printerDevices.routes.js`:
- Added `POST /api/printer-devices/:id/test` - Test connectivity
- Added `GET /api/printer-devices/:id/status` - Get printer status

## Database Usage

The `print_jobs` table is now actively used:
- Jobs are created on every print (when using `printer_device_id`)
- Status transitions are tracked
- Retry counts are incremented
- Failed jobs are preserved for manual retry
- Audit trail is maintained

## Backward Compatibility

- Legacy `printer` field (IP:port) still works without job tracking
- Job tracking only activates when `printer_device_id` is provided
- Frontend can migrate gradually

## Next Steps

1. **Template Platform** - Implement structured template blocks and designer
2. **Additional Adapters** - Implement PDF, TSPL, Dymo, Brother adapters
3. **Print Routes** - Implement automatic printer routing using `print_routes` table
4. **Job History UI** - Frontend UI for viewing job history and retrying failed jobs
5. **Duty-Free Profiles** - Jurisdiction-specific invoice requirements
6. **Audit Log Table** - Create `audit_log` table for persistent audit trail

## Testing Recommendations

1. Test job creation with idempotency key (duplicate prevention)
2. Test job status transitions (pending → processing → completed)
3. Test job retry (exceed max retries, retry before max)
4. Test job cancellation (cancel pending, cancel completed)
5. Test job statistics (filter by date, store, status)
6. Test job cleanup (delete old jobs)
7. Test adapter factory with different device types
8. Test network thermal adapter with real printer
9. Test ZPL adapter with label printer
10. Test browser adapter (HTML return)
11. Test printer connectivity test endpoint
12. Test printer status endpoint

## Files Created/Modified

**Created:**
- `backend/services/printJobService.js`
- `backend/services/printAdapters/PrintAdapter.js`
- `backend/services/printAdapters/NetworkThermalAdapter.js`
- `backend/services/printAdapters/LabelZplAdapter.js`
- `backend/services/printAdapters/BrowserAdapter.js`
- `backend/services/printAdapters/AdapterFactory.js`
- `backend/services/printExecutionService.js`
- `backend/routes/printJobs.routes.js`
- `docs/print-module/PRINT_JOB_SERVICE_PHASE2.md`

**Modified:**
- `backend/routes/printRoutes.js` - Added job tracking
- `backend/routes/printerDevices.routes.js` - Added test/status endpoints
- `backend/routes/index.js` - Mounted print jobs routes
- `database/migrations/applied/2026-08-16_print_device_registry.sql` - Recreated in applied folder

## Security Considerations

- Job creation requires authentication and tenant context
- Retry/cancel operations require `settings.update` permission
- Cleanup operation requires `admin` permission
- All job operations are tenant-scoped
- Audit logging for all job state changes
