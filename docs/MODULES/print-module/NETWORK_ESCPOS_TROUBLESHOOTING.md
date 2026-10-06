# Network ESC/POS Printing Troubleshooting Guide

## Current Issues (2026-08-27)

### Issue 1: Invoice format prints to Canon instead of local Agent

**Symptom:**
- Print format set to "invoice"
- Printer setting set to "print agent"
- Checkout prints directly to Canon printer (CUPS system printer)

**Expected:**
- Should route through local Print Agent, which then prints to selected printer

**Debugging steps:**

1. Check the effective delivery mode in frontend:
   ```javascript
   // In useReceipt.ts, around line 140-162
   console.log('Effective delivery mode:', effectiveDocSetting.deliveryMode);
   console.log('Effective printer settings:', effectivePrinterSettings);
   ```

2. Check which path `printReceipt()` takes:
   ```javascript
   // In printerService.ts, add logging in printReceipt()
   console.log('Print mode:', printerSettings.print_mode);
   console.log('Should use local agent?', shouldUseLocalAgent(printerSettings));
   ```

3. Verify `print_document_settings` row for invoice:
   ```sql
   SELECT * FROM print_document_settings
   WHERE document_type = 'invoice'
   AND store_id = '<your_store_id>';
   ```

4. Check if `deliveryMode` is being mapped correctly:
   - `deliveryMode: 'local_agent'` should become `print_mode: 'local-agent'`
   - Check the mapping in useReceipt.ts line 158

**Possible fixes:**
- Ensure `deliveryMode` is saved as `'local_agent'` in database
- Verify the frontend is reading the correct `print_document_settings` row
- Check that `print_mode` is being passed correctly to `printReceipt()`

---

### Issue 2: Network printer ESC/POS not printing at all

**Symptom:**
- Print format set to "receipt"
- Network printer ESC/POS selected
- No print output, no error in browser console

**Expected:**
- Should render template to raster image
- Convert to ESC/POS bytes
- Send to local Agent
- Agent forwards to Docker simulator at `127.0.0.1:9100`

**Debugging steps:**

1. Check browser console for errors:
   - Open DevTools → Console
   - Trigger a print
   - Look for:
     - `html2canvas` import errors
     - CORS/tainted canvas errors
     - "Unable to create ESC/POS render frame"
     - Any errors in `htmlToEscposRasterBase64()`

2. Verify html2canvas is available:
   ```bash
   cd frontend
   npm list html2canvas
   # If not installed:
   npm install html2canvas
   ```

3. Add logging to `htmlToEscposRasterBase64()`:
   ```javascript
   // In printerService.ts
   console.log('Starting HTML to ESC/POS raster conversion');
   console.log('Paper width:', paperWidth);
   console.log('Target width:', width);
   // Add try/catch logging around each step
   ```

4. Check Print Agent jobs.json:
   ```bash
   # On Mac
   cat ~/Library/Application\ Support/Zettaz/PrintAgent/jobs.json | jq .
   ```
   - Look for jobs with `destination: "tcp"`
   - Check if `contentType: "escpos"`
   - Check if `payloadBase64` is present and not empty

5. Verify simulator is reachable:
   ```bash
   # On Mac
   nc -vz 127.0.0.1 9100
   # Should return: "Connection to 127.0.0.1 port 9100 [tcp/hp-pdl-datastr] succeeded!"
   ```

6. Test raster encoding directly in browser console:
   ```javascript
   // Open DevTools → Console on your POS page
   const testPixels = new Uint8ClampedArray([0,0,0,255, 255,255,255,255]);
   const result = rgbaToEscposRasterBase64(testPixels, 2, 1);
   console.log('Raster base64 length:', result.length);
   console.log('First 20 chars:', result.substring(0, 20));
   ```

**Possible causes and fixes:**

- **html2canvas not installed**: Run `npm install html2canvas` in frontend
- **CORS/tainted canvas**: Logo images from S3/CloudFront need CORS headers. Check:
  - S3 bucket CORS configuration
  - CloudFront distribution CORS settings
  - Or use data URLs for logos during testing

- **iframe timing issues**: Increase the 150ms delay in `htmlToEscposRasterBase64()`:
  ```javascript
  await new Promise((resolve) => setTimeout(resolve, 500)); // Increase to 500ms
  ```

- **Canvas too large**: Some browsers have canvas size limits. If receipt is very long, consider:
  - Splitting into multiple raster chunks
  - Reducing scale factor (currently 2)

- **Browser security**: Some browsers block canvas pixel access in certain contexts. Try:
  - Testing in Chrome (most permissive)
  - Ensuring page is served over HTTPS in production
  - Checking if any browser extensions are interfering

---

### Quick Test Script

Add this to browser console to test the full raster pipeline:

```javascript
async function testRasterPipeline() {
  const html = `
    <div style="width: 80mm; font-family: Arial; padding: 10px;">
      <h1>Test Receipt</h1>
      <p>Item 1 - $10.00</p>
      <p>Total: $10.00</p>
    </div>
  `;
  try {
    const result = await htmlToEscposRasterBase64(html, 80);
    console.log('✅ Raster conversion successful');
    console.log('Payload length:', result.length);
    return result;
  } catch (error) {
    console.error('❌ Raster conversion failed:', error);
    throw error;
  }
}

// Run it
testRasterPipeline();
```

---

### Next Steps for Claude IDE

1. **Add comprehensive logging** to `htmlToEscposRasterBase64()` to identify which step fails
2. **Test html2canvas import** - may need to be a regular dependency instead of dynamic import
3. **Handle CORS for logos** - either configure S3/CloudFront CORS or convert to data URLs
4. **Add error boundaries** in the print flow to show user-friendly error messages
5. **Consider fallback to text-based ESC/POS** if raster conversion fails
6. **Test with actual thermal printer** (not just Docker simulator) to verify raster commands are correct

---

### Files to Investigate

- `frontend/src/services/printerService.ts` - Lines 208-272 (raster conversion)
- `frontend/src/hooks/useReceipt.ts` - Lines 140-210 (delivery mode resolution)
- `frontend/src/services/receiptService.ts` - Template rendering
- `backend/routes/printRoutes.js` - Legacy network print route (should not be used)