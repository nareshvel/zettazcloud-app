# Print Module Security Hardening - Phase 1

**Date:** 2026-08-16
**Status:** Completed

## Overview

This document summarizes the security hardening work completed for the Zettaz Cloud print module. The focus was on replacing arbitrary printer addresses with a tenant-scoped device registry, removing debug endpoints, and adding validation, rate limiting, and audit logging.

## Changes Made

### 1. Database Schema

Created four new tables to support secure print operations:

#### `printer_devices`
- Stores printer device configurations with tenant-scoped IDs
- Replaces arbitrary IP:port strings with validated device records
- Fields:
  - `id`, `tenant_id`, `store_id`, `station_id`
  - `name`, `device_type`, `connection_type`
  - `address`, `port` (validated for private networks only)
  - `capabilities` (JSON)
  - `is_default`, `is_active`
  - Audit fields: `created_at`, `updated_at`, `created_by`, `updated_by`

#### `print_stations`
- Groups printers by physical location (e.g., "Front Desk", "Warehouse")
- Enables routing print jobs to appropriate stations
- Fields:
  - `id`, `tenant_id`, `store_id`
  - `name`, `location`, `description`
  - `is_default`, `is_active`
  - Audit fields

#### `print_jobs`
- Audit trail for all print operations
- Enables job tracking, retry, and history
- Fields:
  - `id`, `tenant_id`, `store_id`, `station_id`, `printer_device_id`
  - `job_type`, `document_type`, `status`
  - `payload` (JSON), `error_message`
  - `retry_count`, `max_retries`
  - `idempotency_key`
  - Timestamps: `created_at`, `updated_at`, `completed_at`
  - Audit fields

#### `print_routes`
- Defines routing rules for automatic printer selection
- Enables conditional routing based on document type, payment method, etc.
- Fields:
  - `id`, `tenant_id`, `store_id`
  - `route_name`, `condition_type`, `condition_value`
  - `printer_device_id`, `priority`
  - `is_active`
  - Audit fields

### 2. Security Hardening in Routes

#### Removed Debug Endpoints
- **Removed:** `POST /api/print/test-raw` (no auth, arbitrary printer)
- **Removed:** `POST /api/print/receipt-test` (no auth, content logging)
- **Removed:** `POST /api/print/debug` (no auth, arbitrary printer)
- **Removed:** `GET /api/print/test/:ip` (SSRF risk, arbitrary IP)

#### Updated Print Routes
- **`POST /api/print`**: Now accepts `printer_device_id` instead of arbitrary `printer` address
  - Legacy `printer` field still supported with deprecation warning
  - Validates device exists, is active, and belongs to tenant
  - Only allows network printers via this endpoint
- **`POST /api/print/text`**: Same security updates as above
- **`PUT /api/labels/settings`**: Added address validation for network printers

#### New Printer Device Routes
- **`GET /api/printer-devices`**: List devices for tenant/store
- **`GET /api/printer-devices/:id`**: Get specific device
- **`POST /api/printer-devices`**: Create device (requires `settings.create` permission)
- **`PUT /api/printer-devices/:id`**: Update device (requires `settings.update` permission)
- **`DELETE /api/printer-devices/:id`**: Delete device (requires `settings.delete` permission)
- **`GET /api/printer-devices/stations/list`**: List print stations
- **`POST /api/printer-devices/stations`**: Create print station

### 3. Address Validation (SSRF Protection)

Created `printerDeviceService.validatePrinterAddress()`:
- Blocks public IP addresses (SSRF protection)
- Only allows:
  - `localhost` / `127.0.0.1`
  - Private ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- Validates port range (1-65535)
- Throws error for invalid addresses

### 4. Rate Limiting

Created `middleware/rateLimitMiddleware.js`:
- In-memory rate limiter (for production, consider Redis)
- **Print rate limit:** 30 prints per minute per user
- **Settings rate limit:** 20 settings updates per minute per user
- Adds rate limit headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Returns 429 status when limit exceeded

Applied to:
- `POST /api/print`
- `POST /api/print/text`
- `POST /api/labels/print`
- `POST /api/labels/print/bulk`

### 5. Audit Logging

Created `services/auditLogService.js`:
- Logs security-relevant events (currently to console/logger)
- Planned: write to `audit_log` table
- Functions:
  - `logAuditEvent()` - Generic audit logging
  - `logPrintJob()` - Log print job events
  - `logPrinterDeviceEvent()` - Log device CRUD events

Applied to:
- `POST /api/print` - logs print job creation

### 6. Print Mode Restriction

Updated `printerSettingsController.js`:
- Removed `'server'` and `'local-agent'` from allowed print modes
- Only `'browser'` and `'direct'` are currently allowed
- These modes will be re-enabled when the corresponding features are implemented

### 7. New Services

#### `services/printerDeviceService.js`
- `validatePrinterAddress()` - Address validation
- `createPrinterDevice()` - Create device with validation
- `getPrinterDevice()` - Get device by ID
- `listPrinterDevices()` - List devices with filters
- `updatePrinterDevice()` - Update device
- `deletePrinterDevice()` - Delete device (checks for usage)
- `createPrintStation()` - Create print station
- `listPrintStations()` - List print stations

#### `services/auditLogService.js`
- Audit logging functions (see above)

## Migration

**File:** `database/migrations/2026-08-16_print_device_registry.sql`
**Status:** Applied 2026-08-16
**Tables created:** 4
**Statements executed:** 50

## Backward Compatibility

The implementation maintains backward compatibility:
- Legacy `printer` field (IP:port string) still accepted in print routes
- Deprecation warning logged when legacy field is used
- Frontend can migrate gradually to `printer_device_id`

## Next Steps

1. **Frontend Migration:** Update frontend to use `printer_device_id` instead of `printer` addresses
2. **Print Job Service:** Implement job creation, state transitions, and retry logic using `print_jobs` table
3. **Print Routes:** Implement automatic printer routing using `print_routes` table
4. **Audit Log Table:** Create `audit_log` table and update service to write to DB
5. **Redis Rate Limiting:** Replace in-memory rate limiter with Redis for production
6. **Template Platform:** Implement structured template blocks and designer
7. **Duty-Free Profiles:** Implement jurisdiction-specific invoice requirements

## Security Checklist

- [x] Arbitrary printer addresses replaced with device IDs
- [x] Debug endpoints removed
- [x] Address validation (SSRF protection)
- [x] Rate limiting on print endpoints
- [x] Audit logging for print jobs
- [x] Tenant-scoped device registry
- [x] Permission checks on device CRUD
- [x] Unimplemented print modes hidden
- [ ] Audit log table (pending)
- [ ] Redis-based rate limiting (pending)

## Testing Recommendations

1. Test printer device CRUD operations
2. Test address validation with public IPs (should fail)
3. Test address validation with private IPs (should succeed)
4. Test rate limiting (exceed 30 prints/minute)
5. Test audit logging (check logs for print events)
6. Test legacy `printer` field (should work with warning)
7. Test new `printer_device_id` field (should work without warning)
