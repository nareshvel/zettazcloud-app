const express = require('express');
const router = express.Router();
const net = require('net'); // Use Node's built-in TCP library instead of exec
const { authenticate, authorize, requireTenantId, requireStoreId } = require('../middleware/unifiedAuthMiddleware');
const { printRateLimit } = require('../middleware/rateLimitMiddleware');
const logger = require('../utils/logger');
const { convertHtmlToEscpos, createSimpleReceipt, printToNetworkPrinter } = require('../utils/printerUtils');
const { pool } = require('../db');
const printerDeviceService = require('../services/printerDeviceService');
const auditLogService = require('../services/auditLogService');
const printJobService = require('../services/printJobService');

// Main print route - takes HTML content and converts it to printer-friendly format
// SECURITY: Now requires printer_device_id instead of arbitrary IP:port
router.post('/', authenticate, printRateLimit, async (req, res) => {
  try {
    const {
      printer_device_id,
      printer, // DEPRECATED: legacy support, will be removed
      content,
      paperWidth = null,
      saleId: explicitSaleId,
      discountAmount: frontendDiscountAmount,
      discountType: frontendDiscountType,
      discountValue: frontendDiscountValue,
      structuredData: requestStructuredData,
    } = req.body;

    if (!content) {
      return res.status(400).json({ status: 'error', message: 'Missing required field: content' });
    }

    // SECURITY: Prefer printer_device_id, fall back to legacy printer address with warning
    let printerAddress = null;
    let port = 9100;
    let jobId = null;
    let useJobTracking = false;

    if (printer_device_id) {
      // New secure path: look up device from registry
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const device = await printerDeviceService.getPrinterDevice(printer_device_id, tenantId);

      if (!device) {
        return res.status(404).json({ status: 'error', message: 'Printer device not found' });
      }

      if (!device.is_active) {
        return res.status(400).json({ status: 'error', message: 'Printer device is not active' });
      }

      if (device.connection_type !== 'network') {
        return res.status(400).json({ status: 'error', message: 'Only network printers are supported via this endpoint' });
      }

      if (!device.address) {
        return res.status(400).json({ status: 'error', message: 'Printer device has no address configured' });
      }

      const [ip, portStr = "9100"] = device.address.split(':');
      printerAddress = ip;
      port = parseInt(portStr, 10) || 9100;

      logger.log(`Received print request for printer device ${printer_device_id} at ${printerAddress}:${port}`);
    } else if (printer) {
      // Legacy path: log warning but allow for backward compatibility
      logger.warn('DEPRECATED: Using legacy printer address. Please migrate to printer_device_id.');
      const [ip, portStr = "9100"] = printer.split(':');
      printerAddress = ip;
      port = parseInt(portStr, 10);
      logger.log(`Received print request for printer at ${printerAddress}:${port} (LEGACY MODE)`);
    } else {
      return res.status(400).json({ status: 'error', message: 'Missing required field: printer_device_id' });
    }
    logger.log('Content length:', content.length);
    logger.log('Content type:', typeof content);
    logger.log('Paper width:', paperWidth || '80mm (default)');
    // Log more detailed content preview for debugging
    logger.log('Content preview:', content.substring(0, 100) + '...');
    
    // For debugging, save the full HTML to a temporary file (currently disabled)
    // const fs = require('fs');
    // const debugFilePath = './debug_receipt_html.txt';
    // fs.writeFileSync(debugFilePath, content);
    // logger.log(`Full HTML content saved for debugging to ${debugFilePath}`);
    
    // Import paper width constant
    const { PAPER_WIDTH } = require('../utils/printerUtils');
    
    // Determine which paper width to use
    const selectedWidth = paperWidth === '58mm' ? PAPER_WIDTH.NARROW : PAPER_WIDTH.WIDE;
    logger.log(`Using ${selectedWidth} paper width for receipt`);
    
    logger.log('Converting HTML to ESC/POS commands');
    
    // Get tenant ID from the authenticated user
    const tenantId = req.user?.tenant_id;
    
    // Parse the content to extract sale ID if available
    let saleId = null;
    try {
      // Try multiple methods to extract the sale ID
      // Method 1: Standard data-sale-id attribute
      let saleIdMatch = content.match(/data-sale-id=["']([^"']+)["']/);
      
      // Method 2: Look for an ID in a receipt ID section
      if (!saleIdMatch) {
        saleIdMatch = content.match(/Receipt(?:\s+ID)?[:\s]+([0-9a-f-]{36})/i);
      }
      
      // Method 3: Check for an ID with standard UUID format
      if (!saleIdMatch) {
        saleIdMatch = content.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
      }
      
      if (saleIdMatch && saleIdMatch[1]) {
        saleId = saleIdMatch[1].trim();
        logger.log(`Extracted sale ID from receipt: ${saleId}`);
      } else {
        // For debugging, log a snippet of the content
        const contentPreview = content.substring(0, 500).replace(/\n/g, ' ');
        logger.log(`Could not find sale ID in receipt content. Preview: ${contentPreview}`);
      }
    } catch (e) {
      logger.log('Could not extract sale ID from receipt:', e.message);
    }
    
    // Set up variables for additional receipt data
    let cashierName = null;
    let customerName = null;
    let structuredReceiptData = requestStructuredData && typeof requestStructuredData === 'object'
      ? requestStructuredData
      : null;
    
    // Initialize discount variables with frontend values if provided
    let discount = frontendDiscountAmount || null;
    let discountType = frontendDiscountType || null;
    let discountValue = frontendDiscountValue || null;
    
    // Log if frontend provided discount values
    if (discount !== null) {
      logger.log(`Using frontend-provided discount: ${discount} (${discountType || 'fixed'}${discountType === 'percentage' ? ': ' + discountValue + '%' : ''})`);
    }
    
    // Use explicitly provided saleId if available, otherwise use the extracted one
    if (explicitSaleId) {
      saleId = explicitSaleId;
      logger.log(`Using explicitly provided sale ID: ${saleId}`);
    } else if (saleId) {
      logger.log(`Using extracted sale ID from HTML: ${saleId}`);
    } else {
      logger.log('No sale ID available (neither explicit nor extracted from HTML)');
    }
    
    // Fetch sale information if we have a sale ID from any source
    if (saleId) {
      try {
        logger.log(`Fetching sale information for sale ID: ${saleId}`);
        
        // Get detailed sale information with cashier name, customer details, and all financial data
        const [saleData] = await pool.query(
          `SELECT u.name as cashier_name,
                  s.discount_type, s.discount_value, s.discount_amount, s.promotions_amount,
                  CONCAT(c.first_name, ' ', c.last_name) as customer_name,
                  s.subtotal, s.tax, s.total, s.created_at, s.document_number,
                  pm.name AS payment_method_name
           FROM sales s
           LEFT JOIN users u ON s.cashier_id = u.id
           LEFT JOIN customers c ON s.customer_id = c.id
           LEFT JOIN payment_methods pm ON s.payment_method = pm.id AND pm.tenant_id = s.tenant_id
           WHERE s.id = ? AND s.tenant_id = ?`,
          [saleId, tenantId]
        );
        
        if (saleData.length > 0) {
          // Handle cashier name
          if (saleData[0].cashier_name) {
            cashierName = saleData[0].cashier_name.trim();
            logger.log(`Found cashier name in database: '${cashierName}'`);
          } else {
            logger.log(`No cashier found for sale ID: ${saleId}`);
          }
          
          // Handle customer name
          if (saleData[0].customer_name) {
            customerName = saleData[0].customer_name.trim();
            logger.log(`Found customer name in database: '${customerName}'`);
          } else {
            logger.log(`No customer found for sale ID: ${saleId}`);
          }
          
          // Only process discount from database if frontend didn't provide it
          if (discount === null) {
            logger.log('No frontend discount provided, checking database');
            // Handle discount information
            // First check discount_amount directly
            if (saleData[0].discount_amount > 0) {
              discount = saleData[0].discount_amount;
              discountType = saleData[0].discount_type || 'fixed';
              discountValue = saleData[0].discount_value || 0;
              logger.log(`Found discount in database (discount_amount): ${discount} (${discountType}${discountType === 'percentage' ? ': ' + discountValue + '%' : ''})`);
            } 
            // Check if we have discount value and discount type
            else if (saleData[0].discount_value > 0 && saleData[0].discount_type === 'percentage') {
              // Calculate the percentage discount amount from discount_value
              const subtotal = saleData[0].subtotal || 0;
              discountType = 'percentage';
              discountValue = saleData[0].discount_value;
              discount = (subtotal * discountValue / 100);
              logger.log(`Calculated percentage discount: ${discount} (${discountValue}%)`);
            }
            // If there's a difference between subtotal+tax and total, consider that a discount
            else if (saleData[0].subtotal > 0 && saleData[0].total > 0 && saleData[0].promotions_amount <= 0) {
              const subtotal = saleData[0].subtotal;
              const tax = saleData[0].tax || 0;
              const total = saleData[0].total;
              
              // Calculate implied discount - if there's a difference between subtotal+tax and total
              const expectedTotal = subtotal + tax;
              const impliedDiscount = expectedTotal - total;
              
              if (impliedDiscount > 0.01) { // Use small threshold to avoid floating point issues
                discount = impliedDiscount;
                // If we have discount_type use it, otherwise assume fixed
                discountType = saleData[0].discount_type || 'fixed';
                discountValue = saleData[0].discount_value || 0;
                logger.log(`Calculated implied discount: subtotal=${subtotal} + tax=${tax} - total=${total} = discount=${discount}`);
              } else {
                logger.log(`No implied discount found: subtotal=${subtotal} + tax=${tax} = total=${total}`);
              }
            } else {
              logger.log(`No discount found for sale ID: ${saleId}`);
            }
          } else {
            logger.log(`Using frontend discount (skipping database discount): ${discount}`);
          }

          const [saleItems] = await pool.query(
            `SELECT COALESCE(p.name, 'Item') AS name, si.quantity AS qty,
                    si.price, (si.quantity * si.price) AS line_total
               FROM sale_items si
               LEFT JOIN products p ON p.id = si.product_id AND p.tenant_id = ?
              WHERE si.sale_id = ?`,
            [tenantId, saleId]
          );
          structuredReceiptData = {
            items: (saleItems || []).map((item) => ({
              name: item.name,
              qty: Number(item.qty || 0),
              price: Number(item.price || 0),
              lineTotal: Number(item.line_total || 0),
            })),
            totals: [
              { label: 'Subtotal', value: String(Number(saleData[0].subtotal || 0)) },
              { label: 'Tax', value: String(Number(saleData[0].tax || 0)) },
              { label: 'Total', value: String(Number(saleData[0].total || 0)) },
            ],
            receiptNumber: saleData[0].document_number || saleId,
            date: saleData[0].created_at ? new Date(saleData[0].created_at).toLocaleString() : '',
            cashierName,
            customerName,
            paymentMethod: saleData[0].payment_method_name || 'Payment',
          };
        } else {
          logger.log(`No sale data found for sale ID: ${saleId}`);
        }
      } catch (e) {
        logger.error('Error fetching sale information:', e);
      }
    } else {
      logger.log('No sale ID available to fetch sale information');
    }
    
    // Check if HTML contains Promotions to avoid duplicate discount
    if (content.includes('Promotions') && discount !== null && discount > 0) {
      logger.log('Promotions found in HTML content, setting discount to 0 to avoid duplicate');
      discount = 0;
    }
    
    // Convert receipt HTML to printer commands with ESC/POS formatting
    logger.log('Converting HTML to ESC/POS commands');
    const additionalData = {
      cashierName,
      customerName,
      discount,
      discountType,
      discountValue
    };
    logger.log('Passing additional data to printer:', JSON.stringify(additionalData));
    
    const escposData = await convertHtmlToEscpos(content, selectedWidth, tenantId, additionalData, structuredReceiptData);
    
    // Log the first part of the converted data
    const previewText = escposData.toString('utf8').substring(0, 100) + '...';
    logger.log('Converted text preview:', previewText);
    
    // Create print job record
    if (printer_device_id) {
      try {
        const job = await printJobService.createPrintJob({
          tenant_id: tenantId,
          store_id: req.user?.store_id,
          printer_device_id: printer_device_id,
          job_type: printJobService.JobType.RECEIPT,
          document_type: 'sale_receipt',
          payload: {
            content: content.substring(0, 1000), // Truncate for storage
            paperWidth: selectedWidth,
            saleId: saleId
          },
          created_by: req.user?.id
        });
        jobId = job.id;
        useJobTracking = true;
        logger.log(`Created print job ${jobId}`);
      } catch (jobError) {
        logger.error('Failed to create print job:', jobError.message);
        // Continue with print even if job creation fails
      }
    }

    // Update job status to processing
    if (useJobTracking && jobId) {
      await printJobService.updateJobStatus(jobId, printJobService.JobStatus.PROCESSING);
    }

    // Send commands to the printer (includes auto-cut command)
    logger.log(`Sending ESC/POS commands to printer at ${printerAddress}:${port}`);
    await printToNetworkPrinter(`${printerAddress}:${port}`, port, escposData);

    // Update job status to completed
    if (useJobTracking && jobId) {
      await printJobService.updateJobStatus(jobId, printJobService.JobStatus.COMPLETED);
    }

    // Audit log
    await auditLogService.logPrintJob(
      tenantId,
      req.user?.store_id,
      req.user?.id,
      printer_device_id,
      'receipt',
      'sale_receipt',
      req.ip,
      req.get('user-agent')
    );

    return res.json({
      status: 'success',
      message: 'Print job sent successfully',
      printer_device_id: printer_device_id || null,
      printer: printer_device_id ? `${printerAddress}:${port}` : printer,
      job_id: jobId
    });
  } catch (error) {
    logger.error(`Print error: ${error.message}`);

    // Update job status to failed if job was created
    if (useJobTracking && jobId) {
      try {
        await printJobService.updateJobStatus(jobId, printJobService.JobStatus.FAILED, error.message);
      } catch (updateError) {
        logger.error('Failed to update job status to failed:', updateError.message);
      }
    }

    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Handle print requests with raw text
// SECURITY: Updated to use printer_device_id
router.post('/text', authenticate, printRateLimit, async (req, res) => {
  try {
    const { printer_device_id, printer, text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text content is required'
      });
    }

    // SECURITY: Validate printer device
    let printerAddress = null;
    let port = 9100;

    if (printer_device_id) {
      const tenantId = req.user?.tenant_id || req.headers['x-tenant-id'];
      const device = await printerDeviceService.getPrinterDevice(printer_device_id, tenantId);

      if (!device) {
        return res.status(404).json({ success: false, message: 'Printer device not found' });
      }

      if (!device.is_active) {
        return res.status(400).json({ success: false, message: 'Printer device is not active' });
      }

      if (device.connection_type !== 'network') {
        return res.status(400).json({ success: false, message: 'Only network printers are supported' });
      }

      if (!device.address) {
        return res.status(400).json({ success: false, message: 'Printer device has no address configured' });
      }

      const [ip, portStr = "9100"] = device.address.split(':');
      printerAddress = ip;
      port = parseInt(portStr, 10) || 9100;
    } else if (printer) {
      logger.warn('DEPRECATED: Using legacy printer address in /text endpoint');
      const [ip, portStr = "9100"] = printer.split(':');
      printerAddress = ip;
      port = parseInt(portStr, 10);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: printer_device_id'
      });
    }

    // Create a simple text receipt
    logger.log('Creating simple text receipt');
    const receiptData = createSimpleReceipt(text);

    // Send to printer
    await printToNetworkPrinter(`${printerAddress}:${port}`, port, receiptData);

    return res.json({ success: true, message: 'Text receipt printed successfully' });
  } catch (error) {
    logger.error(`Text print error: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: `Failed to print text: ${error.message}`
    });
  }
});

// DEBUG ENDPOINTS REMOVED FOR SECURITY
// Previously: /test-raw, /receipt-test, /debug, /test/:ip
// These endpoints allowed arbitrary printer addresses without proper validation
// Use the proper print job API with printer device IDs instead

module.exports = router;
