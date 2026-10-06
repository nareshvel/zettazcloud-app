# Print Module — QA & Certification Procedures

**Date:** 2026-08-16
**Status:** Procedures ready; physical tests pending

## Overview

This document provides the step-by-step QA procedures for certifying the Zettaz Cloud print module across thermal receipt (58/80 mm), A4/Letter documents, and label printers.

## Pre-Test Setup

### 1. Environment
- Backend running on `http://localhost:5172` (or staging environment)
- Frontend running on `http://localhost:5173`
- Database migrations applied
- Test tenant and store configured

### 2. Test Printers
- **58mm thermal receipt printer** (e.g., EPSON TM-T20II, 58mm paper)
- **80mm thermal receipt printer** (e.g., EPSON TM-T88V, 80mm paper)
- **A4/Laser/Inkjet printer** with standard paper
- **Zebra ZPL label printer** (optional for label QA)

### 3. Network Requirements
- Printers must be on a private network (10.x, 172.16-31.x, or 192.168.x)
- SSRF protection blocks public IPs
- Printers configured in `Settings → Printers`

## Test Data

Use the certification fixture suite via the API:

```bash
GET /api/print-tests/fixtures
GET /api/print-tests/fixtures/receipt/58mm_receipt
GET /api/print-tests/fixtures/receipt/80mm_receipt
GET /api/print-tests/fixtures/document/a4_letter
GET /api/print-tests/fixtures/label/50x25_jewelry_tag
```

## Procedure 1: 58mm Thermal Receipt

### 1.1 Register Printer
1. Go to `Settings → Printers`
2. Add a printer device:
   - **Type:** `thermal_receipt`
   - **Connection:** `network`
   - **Address:** `192.168.x.x:9100` (your printer's IP)
   - **Name:** `Test 58mm Receipt Printer`
3. Click **Test** to verify connectivity

### 1.2 Create Receipt Template
1. Go to `Print → Templates`
2. Create a new template:
   - **Type:** `receipt`
   - **Name:** `58mm Test Receipt`
3. Enable these blocks:
   - store_logo
   - store_header
   - customer_details
   - items_table
   - totals_section
   - payment_section
   - footer
4. Publish the template

### 1.3 Trigger Test Print
Use API or POS:

```bash
POST /api/print
{
  "printer_device_id": "<device-id>",
  "content": "<58mm receipt HTML from fixture>",
  "paperWidth": "58mm"
}
```

### 1.4 Verify Output
- [ ] Receipt prints without errors
- [ ] Width fits 58mm paper (no truncation or overflow)
- [ ] Store header is centered
- [ ] Items are readable
- [ ] Totals align correctly
- [ ] Footer text is complete
- [ ] Auto-cut works (if supported)
- [ ] No duplicate discounts or totals

### 1.5 Check Job History
1. Go to `Print → Job History`
2. Verify job shows as `completed`
3. Verify no error messages

## Procedure 2: 80mm Thermal Receipt

### 2.1 Register Printer
- Same as 1.1, but name it `Test 80mm Receipt Printer`

### 2.2 Create Receipt Template
- Same as 1.2, but use 80mm template

### 2.3 Trigger Test Print
```bash
POST /api/print
{
  "printer_device_id": "<device-id>",
  "content": "<80mm receipt HTML from fixture>",
  "paperWidth": "80mm"
}
```

### 2.4 Verify Output
- [ ] Receipt prints on 80mm paper
- [ ] Customer email/phone visible
- [ ] Items well-spaced
- [ ] All sections aligned
- [ ] No wrapping issues
- [ ] Auto-cut works

## Procedure 3: A4/Letter Document

### 3.1 Register Printer
1. Add a printer device:
   - **Type:** `laser` or `inkjet`
   - **Connection:** `browser` (for now, until PDF adapter is complete)
   - **Name:** `Test A4 Document Printer`

### 3.2 Create Document Template
1. Go to `Print → Templates`
2. Create a new template:
   - **Type:** `document`
   - **Name:** `A4 Letter Invoice`
3. Enable these blocks:
   - store_logo
   - invoice_header
   - customer_details
   - billing_shipping
   - items_table
   - tax_section
   - totals_section
   - payment_terms
   - footer
4. Publish the template

### 3.3 Trigger Test Print
```bash
POST /api/print
{
  "printer_device_id": "<device-id>",
  "content": "<A4 document HTML from fixture>"
}
```

### 3.4 Verify Output
- [ ] Browser print dialog opens
- [ ] Document renders on A4/Letter page
- [ ] Margins correct
- [ ] Header with store info present
- [ ] Customer details clear
- [ ] Item table not cut off
- [ ] Totals and taxes correct
- [ ] Page breaks at correct locations
- [ ] Terms and footer on final page

## Procedure 4: Jewelry Invoice (Duty-Free)

### 4.1 Configure Duty-Free Profile
1. Go to `Settings → Duty-Free` (or use API)
2. Create a profile:
   - **Jurisdiction:** `ANTIGUA` or `UAE`
   - **Copies:** 2
   - **Customer Copy Label:** `Customer Copy`
   - **Store Copy Label:** `Store Copy`
3. Set legal text and required fields

### 4.2 Generate Invoice Number
```bash
POST /api/duty-free-profiles/<profile-id>/generate-invoice-number
```

### 4.3 Verify Output
- [ ] Invoice number is generated
- [ ] Passport field visible
- [ ] Jurisdiction text visible
- [ ] Legal text present
- [ ] 2 copies printed
- [ ] Customer copy labeled
- [ ] Store copy labeled

## Procedure 5: Jewelry Labels

### 5.1 Register Label Printer
1. Add a printer device:
   - **Type:** `label_zebra_zpl`
   - **Connection:** `network`
   - **Address:** `192.168.x.x:9100`
   - **Name:** `Test Zebra Label Printer`

### 5.2 Trigger Test Print
Use fixture data:
```bash
POST /api/labels/test
{
  "store_id": "<store-id>"
}
```

### 5.3 Verify Output
- [ ] Label prints correctly
- [ ] Barcode scannable
- [ ] Product name visible
- [ ] Purity and weight present
- [ ] Price formatted

## Procedure 6: Security Validation

### 6.1 SSRF Protection
Try to add a printer with public IP:
```bash
POST /api/printer-devices
{
  "name": "Bad Printer",
  "device_type": "thermal_receipt",
  "connection_type": "network",
  "address": "8.8.8.8:9100"
}
```
- [ ] Request rejected with SSRF error

### 6.2 Rate Limiting
Send 35+ print requests in 1 minute:
- [ ] Requests beyond 30/minute receive 429 Too Many Requests

### 6.3 Permission Checks
Try to access print job retry without `settings.update` permission:
- [ ] Request receives 403 Forbidden

## Procedure 7: Job Retry & Cancellation

### 7.1 Force a Failed Job
1. Configure a printer with non-routable IP
2. Send print request
3. Verify job shows `failed`

### 7.2 Retry
1. Go to `Print → Job History`
2. Click **Retry** on failed job
3. Verify status returns to `pending` then `processing`

### 7.3 Cancel
1. Send a large print job
2. While `processing`, click **Cancel**
3. Verify status changes to `cancelled`

## Pass Criteria

| Test | Pass Criteria |
|---|---|
| 58mm receipt | Prints successfully, readable, no overflow |
| 80mm receipt | Prints successfully, customer details visible |
| A4/Letter | Renders correctly in browser/PDF, proper layout |
| Duty-free | Invoice numbers, copies, legal text correct |
| Labels | Barcode scannable, all fields visible |
| Security | SSRF blocked, rate limits enforced, permissions work |
| Job history | Retry/cancel works, statuses accurate |

## Known Limitations

1. **PDF adapter not yet implemented** - A4/Letter currently uses browser print
2. **TSPL/Dymo/Brother adapters** are placeholders - ZPL is fully implemented
3. **Local Agent mode** is disabled pending implementation
4. **Audit log table** not yet created - audit events logged to console
5. **Redis rate limiter** not yet implemented - using in-memory store

## Sign-Off

| Tester | Date | Result | Notes |
|---|---|---|---|
| | | | |
| | | | |
