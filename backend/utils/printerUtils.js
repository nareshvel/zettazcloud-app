/**
 * Utility functions for printer operations
 * Text-based receipt formatting for thermal printers
 * with ESC/POS commands for printer control
 * Supports both 58mm and 80mm paper widths
 */
const net = require('net');
const logger = require('./logger');
const cheerio = require('cheerio');
const { pool } = require('../db'); // Import database connection

// ESC/POS Commands
const ESC = String.fromCharCode(27);
const GS = String.fromCharCode(29);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);

// Control commands
const COMMANDS = {
  INITIALIZE: ESC + '@',
  LINE_FEED: LF,
  CARRIAGE_RETURN: CR,
  // Paper cut command - separate from feed
  PAPER_CUT: GS + 'V' + String.fromCharCode(1),
  // Feed lines before cutting
  FEED_LINES: (lines) => ESC + 'd' + String.fromCharCode(lines),
  // Combined feed and cut command
  FEED_AND_CUT: ESC + 'd' + String.fromCharCode(5) + GS + 'V' + String.fromCharCode(1),
  ALIGN_LEFT: ESC + 'a' + String.fromCharCode(0),
  ALIGN_CENTER: ESC + 'a' + String.fromCharCode(1),
  ALIGN_RIGHT: ESC + 'a' + String.fromCharCode(2),
  BOLD_ON: ESC + 'E' + String.fromCharCode(1),
  BOLD_OFF: ESC + 'E' + String.fromCharCode(0),
  UNDERLINE_ON: ESC + '-' + String.fromCharCode(1),
  UNDERLINE_OFF: ESC + '-' + String.fromCharCode(0),
  FONT_A: ESC + 'M' + String.fromCharCode(0), // Standard font
  FONT_B: ESC + 'M' + String.fromCharCode(1), // Smaller, more condensed font
  NORMAL_TEXT: ESC + '!' + String.fromCharCode(0),
  // Text size and formatting
  TEXT_FORMAT: ESC + '!', // + n (0-255) for various text formatting
  EMPHASIZE_ON: ESC + 'E' + String.fromCharCode(1), // Alias for BOLD_ON, some printers respond better
  EMPHASIZE_OFF: ESC + 'E' + String.fromCharCode(0), // Alias for BOLD_OFF
  DOUBLE_STRIKE_ON: ESC + 'G' + String.fromCharCode(1),
  DOUBLE_STRIKE_OFF: ESC + 'G' + String.fromCharCode(0),
  // Character size: GS ! n - n uses bits for height and width
  // Bit 0-2: Height magnification (0-7, 1x to 8x)
  // Bit 4-6: Width magnification (0-7, 1x to 8x)
  // Normal: 0x00, Double Height: 0x01, Double Width: 0x10, Double H&W: 0x11
  SET_TEXT_SIZE_NORMAL: GS + '!' + String.fromCharCode(0), // Normal size (0x00)
  SET_CODEPAGE_PC850: ESC + 't' + String.fromCharCode(2), // Select PC850 (Multilingual) codepage,
  SET_TEXT_SIZE_DOUBLE_HEIGHT: GS + '!' + String.fromCharCode(0x01),
  SET_TEXT_SIZE_DOUBLE_WIDTH: GS + '!' + String.fromCharCode(0x10),
  SET_TEXT_SIZE_DOUBLE_WIDTH_HEIGHT: GS + '!' + String.fromCharCode(0x11),

  // QR Code Commands (common set, e.g., Epson TM-T88 series)
  // Function to generate QR code commands. Data is the string to encode.
  // pL, pH are part of the command structure: (dataLength + 3) % 256, Math.floor((dataLength + 3) / 256)
  QR_MODEL_2: String.fromCharCode(50), // Use QR Code Model 2
  QR_ERROR_LEVEL_M: String.fromCharCode(49), // Error correction level M (approx 15%)
  QR_CELL_SIZE_DEFAULT: String.fromCharCode(3), // Default cell size (dots per module)

  // GS ( k pL pH cn fn m d1...dk
  // cn=49 (fixed identifier for QR code)
  // Store QR data in printer buffer
  // fn=80 (Store QR data), m=48 (fixed for 'Store QR data')
  STORE_QR_CODE: (data) => {
    const dataLength = data.length + 3; // data + cn + fn + m
    const pL = String.fromCharCode(dataLength % 256);
    const pH = String.fromCharCode(Math.floor(dataLength / 256));
    return GS + '(k' + pL + pH + String.fromCharCode(49) + String.fromCharCode(80) + String.fromCharCode(48) + data;
  },
  // Set QR code cell size
  // fn=67 (Set module size), m=size (1-16, default 3)
  SET_QR_CELL_SIZE: (size = String.fromCharCode(3)) => { // size is a character 1-16
    const pL = String.fromCharCode(3); const pH = String.fromCharCode(0); // Length of params for this function (cn, fn, m)
    return GS + '(k' + pL + pH + String.fromCharCode(49) + String.fromCharCode(67) + size;
  },
  // Set QR code error correction level
  // fn=69 (Set error correction level), m=level (48:L, 49:M, 50:Q, 51:H)
  SET_QR_ERROR_LEVEL: (level = String.fromCharCode(49)) => { // level is a character 48-51
    const pL = String.fromCharCode(3); const pH = String.fromCharCode(0);
    return GS + '(k' + pL + pH + String.fromCharCode(49) + String.fromCharCode(69) + level;
  },
  // Print QR code from buffer
  // fn=81 (Print QR data), m=48 (fixed for 'Print QR data')
  PRINT_QR_CODE: () => {
    const pL = String.fromCharCode(3); const pH = String.fromCharCode(0);
    return GS + '(k' + pL + pH + String.fromCharCode(49) + String.fromCharCode(81) + String.fromCharCode(48);
  }
};

// Paper width definitions
const PAPER_WIDTH = {
  NARROW: '58mm', // 58mm receipt paper (30-32 characters per line with standard font)
  WIDE: '80mm'    // 80mm receipt paper (42-48 characters per line with standard font)
};

// Characters per line for each paper width (with standard font)
/**
 * Helper function to format a number as currency (e.g., $10.00 or -$5.50)
 * @param {number|string} value - The numeric value or string to format.
 * @returns {string} - The formatted currency string.
 */
const formatCurrency = (value, currencyCode = 'USD') => {
  if (currencyCode && currencyCode.toUpperCase() === 'INR') {
    // Printer does not support ₹ symbol, use textual representation "Rs."
    // Format number according to Indian locale for correct comma placement.
    const numericValue = Number(value);
    if (isNaN(numericValue)) {
        // Handle cases where value might not be a number, though less likely here
        return `Rs. 0.00`; 
    }
    return `Rs. ${numericValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else if (currencyCode && currencyCode.toUpperCase() === 'EUR') {
    const numericValue = Number(value);
    if (isNaN(numericValue)) {
      return `Õ0.00`; // Euro symbol for PC858 (0xD5)
    }
    // Using a common European locale for formatting, adjust if needed
    return `Õ${numericValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    const num = parseFloat(String(value).replace(/[^\d.-]/g, ''));
    if (isNaN(num)) {
      // Attempt to format a zero value with the given currency code or a default
      try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode || 'USD' }).format(0);
      } catch (e) {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(0); // Fallback to USD
      }
    }
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode, minimumFractionDigits: 2 }).format(num);
    } catch (error) {
      logger.warn(`Error formatting currency with code ${currencyCode}. Falling back to USD. Value: ${num}, Error: ${error.message}`);
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(num);
    }
  }
};

const CHARS_PER_LINE = {
  '58mm': 32,
  '80mm': 46, // Reduced from 48 to help prevent line wrapping
};

// Default paper width
const DEFAULT_PAPER_WIDTH = PAPER_WIDTH.WIDE;

/**
 * Format text to fit paper width
 * @param {string} text - Text to format
 * @param {string} paperWidth - Paper width (58mm or 80mm)
 * @returns {string} - Formatted text
 */
const formatTextForPaperWidth = (text, paperWidth = DEFAULT_PAPER_WIDTH) => {
  const maxChars = CHARS_PER_LINE[paperWidth] || CHARS_PER_LINE[DEFAULT_PAPER_WIDTH];
  
  // Split text into lines and format each line
  const lines = text.split('\n');
  const formattedLines = lines.map(line => {
    // If line is shorter than max chars, return as is
    if (line.length <= maxChars) {
      return line;
    }
    
    // Otherwise, wrap the text
    let result = '';
    let currentLine = '';
    const words = line.split(' ');
    
    for (const word of words) {
      if (currentLine.length + word.length + 1 <= maxChars) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        result += currentLine + '\n';
        currentLine = word;
      }
    }
    
    if (currentLine) {
      result += currentLine;
    }
    
    return result;
  });
  
  return formattedLines.join('\n');
};

/**
 * Formats a single item line for the receipt according to new specifications.
 * ITEM column: itemName @ unitPrice x quantity
 * AMOUNT column: lineTotal (right-aligned)
 * @param {string} itemName - Name of the item.
 * @param {string} unitPriceStr - Unit price as a string (e.g., "$5.99" or "5.99").
 * @param {string|number} qtyStr - Quantity as a string or number.
 * @param {number} paperWidthChars - Maximum characters for the paper width.
 * @returns {string} - Formatted item line.
 */
const formatReceiptItemLine = (itemNameAsFullString, unitPriceStr, qtyStr, paperWidthChars, currencyCode = 'USD') => {
  const quantity = parseInt(String(qtyStr).trim(), 10) || 1;
  const unitPriceNum = parseFloat(String(unitPriceStr).replace(/[^\d.-]/g, ''));

  if (isNaN(unitPriceNum)) {
    logger.warn(`Invalid unit price for item '${itemNameAsFullString}': ${unitPriceStr}. Using $0.00.`);
    // itemNameAsFullString already contains the item name, price, and quantity string
    const itemPartError = itemNameAsFullString.substring(0, paperWidthChars - 10); // Truncate if too long
    const totalError = formatCurrency(0, currencyCode).replace(/\d[\d,.]*/, '?.??');
    // Attempt to fit on one line, or split if itemPartError is too long
    if (itemPartError.length + 1 + totalError.length > paperWidthChars) {
      return `${itemPartError}\n${totalError.padStart(paperWidthChars)}`;
    } else {
      return `${itemPartError.padEnd(paperWidthChars - totalError.length)}${totalError}`;
    }
  }

  const lineTotalNum = unitPriceNum * quantity;
  const formattedLineTotal = formatCurrency(lineTotalNum, currencyCode);

  // itemNameAsFullString is already the complete left part of the item line (e.g., "Product @ Price x Qty")
  const itemPart = itemNameAsFullString;

  // Check if itemPart and formattedLineTotal can fit on one line with at least one space
  if (itemPart.length + 1 + formattedLineTotal.length > paperWidthChars) {
    // If too long, print itemPart on its own line (it will wrap if it exceeds paperWidthChars)
    // and print formattedLineTotal on the next line, right-aligned.
    return `${itemPart}\n${formattedLineTotal.padStart(paperWidthChars)}`;
  } else {
    // If it fits, print on a single line
    return `${itemPart.padEnd(paperWidthChars - formattedLineTotal.length)}${formattedLineTotal}`;
  }
};

/**
 * Format a total line with label and value
 * @param {string} label - Label (e.g., "Subtotal:")
 * @param {string} value - Value (e.g., "$10.99")
 * @param {string} paperWidth - Paper width
 * @returns {string} - Formatted line
 */
const formatTotalLine = (label, value, paperWidth = DEFAULT_PAPER_WIDTH) => {
  const maxChars = CHARS_PER_LINE[paperWidth] || CHARS_PER_LINE[DEFAULT_PAPER_WIDTH];
  const spaces = ' '.repeat(Math.max(1, maxChars - label.length - value.length));
  return `${label}${spaces}${value}`;
};

/**
 * Decode HTML entities to their corresponding characters
 * @param {string} html - HTML with entities
 * @returns {string} - Decoded HTML
 */
const decodeHtmlEntities = (html) => {
  if (!html) return '';
  
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
};

/**
 * Extracts footer notes from the receipt HTML.
 * It prioritizes the dynamic footer from printer settings if present in the HTML.
 * @param {Object} $ - Cheerio instance
 * @param {Object} data - Receipt data object to update (its footerNotes will be modified)
 */
const extractFooterNotes = ($, data) => {
    try {
        // Clear any pre-existing/default footer notes to prioritize HTML content
        data.footerNotes = []; 
        let dynamicFooterFound = false;

        // Attempt to extract the dynamic footer from the class used by frontend: 'receipt-footer'
        $('div.receipt-footer p').each((i, el) => {
            const note = $(el).text().trim();
            if (note) {
                data.footerNotes.push(note);
                dynamicFooterFound = true;
            }
        });

        // If no dynamic footer was found using the primary selector,
        // check for the older 'receipt-footer-notes' as a fallback.
        if (!dynamicFooterFound) {
            $('div.receipt-footer-notes p').each((i, el) => {
                const note = $(el).text().trim();
                if (note) {
                    data.footerNotes.push(note);
                    dynamicFooterFound = true;
                }
            });
        }
        
        // If still no footer notes are found from HTML (neither dynamic nor older structure),
        // then add a simple default.
        if (!dynamicFooterFound) {
            // logger.log('[extractFooterNotes] No dynamic footer found in HTML, using default.');
            data.footerNotes.push(
                'Thank you for your purchase!',
                'Please come again!'
            );
        } else {
            // logger.log(`[extractFooterNotes] Extracted footer notes from HTML: ${JSON.stringify(data.footerNotes)}`);
        }
    } catch (error) {
        logger.error('Error extracting footer notes:', error);
        // In case of an error during extraction, ensure some default notes exist.
        // Clear any partially added notes and set defaults.
        data.footerNotes = [
            'Thank you for shopping with us!',
            'Please come again!'
        ];
    }
};

/**
 * Extracts receipt data from HTML using Cheerio
 * @param {string} html - The HTML content to parse
 * @param {Object} data - The receipt data object to populate
 * @returns {Object} The populated receipt data object
 */
const extractReceiptDataFromHtml = (html, data) => {
    try {
        const $ = cheerio.load(html);
        
        // Extract store info if available
        data.storeName = $('.store-name').text().trim() || data.storeName;
        
        // Extract items
        $('.receipt-item').each((i, el) => {
            const item = {
                name: $(el).find('.item-name').text().trim(),
                qty: $(el).find('.item-qty').text().trim() || '1',
                price: $(el).find('.item-price').text().trim() || '$0.00'
            };
            if (item.name) data.items.push(item);
        });
        
        // Extract totals
        $('.receipt-totals .total-row').each((i, el) => {
            data.totals.push({
                label: $(el).find('.total-label').text().trim(),
                value: $(el).find('.total-value').text().trim()
            });
        });
        
        // Extract footer notes
        extractFooterNotes($, data);
        
        // Add default items/totals if none found
        if (data.items.length === 0) {
            data.items.push({ name: 'Receipt Item', qty: '1', price: '$0.00' });
        }
        if (data.totals.length === 0) {
            data.totals.push({ label: 'Total:', value: '$0.00' });
        }
        
        logger.log('Successfully extracted receipt data from HTML');
        return data;
        
    } catch (error) {
        logger.error('Error during Cheerio receipt data extraction:', error);
        // Ensure we always return valid data structure
        if (data.items.length === 0) {
            data.items.push({ name: 'Error Item', qty: '1', price: '$0.00' });
        }
        if (data.totals.length === 0) {
            data.totals.push({ label: 'Total:', value: '$0.00' });
        }
        return data;
    }
};

/**
 * Format a complete receipt from structured data
 * @param {object} data - Receipt data object
 * @param {string} paperWidth - Paper width
 * @returns {string} - Formatted receipt text with ESC/POS commands
 */
const formatStructuredReceipt = (data, paperWidth = DEFAULT_PAPER_WIDTH, currencyCode = 'USD') => {
  const receipt = [];
  let finalTotalValueStr = '$0.00'; // Default for payment section, updated from HTML total value if available
  const paperWidthChars = CHARS_PER_LINE[paperWidth] || CHARS_PER_LINE[DEFAULT_PAPER_WIDTH];
  
  // Debug log all receipt data to analyze discount issue
  // logger.log('[formatStructuredReceipt] STARTING DATA:', {
  //   has_subtotal: !!data.subtotal,
  //   has_tax: !!data.tax,
  //   has_total: !!data.total,
  //   has_discount: data.discount !== undefined && data.discount !== null,
  //   discount_value: data.discount,
  //   discount_type: data.discount_type,
  //   items_count: data.items?.length || 0,
  //   totals_count: data.totals?.length || 0,
  //   // Log all totals objects to inspect what's being passed
  //   totals: data.totals ? data.totals.map(t => ({ label: t.label, value: t.value })) : 'none'
  // });
  
  // If there are discount-related items in the items array, log a warning
  if (data.items && data.items.length > 0) {
    const discountItems = data.items.filter(item => 
      item.name.toLowerCase().includes('discount') || 
      item.name.toLowerCase().includes('promo') || 
      item.name.toLowerCase().includes('coupon'));
    
    if (discountItems.length > 0) {
      logger.log('[formatStructuredReceipt] WARNING: Found discount items in the items array:', 
        discountItems.map(item => ({ name: item.name, price: item.price })));
    }
  }

  receipt.push(COMMANDS.INITIALIZE);
  receipt.push(COMMANDS.SET_CODEPAGE_PC850);

  // --- Store Header ---
  receipt.push(COMMANDS.ALIGN_CENTER);
  const storeNameToPrint = (data.storeName || 'ZETTAZ STORE').trim();
  receipt.push(COMMANDS.SET_TEXT_SIZE_DOUBLE_WIDTH_HEIGHT, storeNameToPrint, COMMANDS.SET_TEXT_SIZE_NORMAL);
  //receipt.push(COMMANDS.LINE_FEED);
  
  // Add store address lines
  if (data.storeAddressLines && data.storeAddressLines.length > 0) {
    data.storeAddressLines.forEach(line => receipt.push(line));
  }
  
  // Add phone and email with proper spacing
  if (data.storeTel || data.storeEmail) {
    //receipt.push(COMMANDS.LINE_FEED);
    if (data.storeTel) receipt.push(data.storeTel);
    if (data.storeEmail) receipt.push(data.storeEmail);
  }
  
  // Add a separator line after store info
  //receipt.push(COMMANDS.LINE_FEED, '-'.repeat(paperWidthChars));

  // --- Sale Info Block ---
  receipt.push(COMMANDS.ALIGN_LEFT);
  if (data.date) receipt.push(`Date: ${data.date}`);
  
  // Add cashier info if available
  if (data.cashierName && data.cashierName.trim()) {
    const cashierName = data.cashierName.trim();
    // Only add if it's not the default 'Cashier' value
    if (cashierName.toLowerCase() !== 'cashier') {
      receipt.push(`Cashier: ${cashierName}`);
      logger.log(`[formatStructuredReceipt] Added cashier to receipt: '${cashierName}'`);
    } else {
      logger.log('[formatStructuredReceipt] Skipping default cashier name');
    }
  } else {
    logger.log('[formatStructuredReceipt] No cashier name available to display');
  }
  
  // Add customer name only if valid (non-empty)
  if (data.customerName && data.customerName.trim()) {
    const customerName = data.customerName.trim();
    receipt.push(`Customer: ${customerName}`);
    logger.log(`[formatStructuredReceipt] Added customer to receipt: '${customerName}'`);
  } else {
    logger.log('[formatStructuredReceipt] No customer name available to display');
  }

  // --- Items Header ---
  const itemColHeader = 'ITEM';
  const amountColHeader = 'AMOUNT';
  receipt.push(COMMANDS.BOLD_ON, itemColHeader.padEnd(paperWidthChars - amountColHeader.length) + amountColHeader, COMMANDS.BOLD_OFF);
  receipt.push('-'.repeat(paperWidthChars));

  // --- Items List ---
  if (data.items && data.items.length > 0) {
    // Skip discount lines in the items section and only show them in the totals section
    // This is simpler than trying to detect discounts with complex logic
    data.items.forEach(item => {
      // Only print if this is a regular item, not a discount
      if (!String(item.name || '').toLowerCase().includes('discount')) {
        receipt.push(formatReceiptItemLine(item.name, item.price, item.qty, paperWidthChars, currencyCode));
      } else {
        logger.log(`Skipping discount item in items list: ${item.name}`);
      }
    });
    
    // Add a separator line before totals
    receipt.push('-'.repeat(paperWidthChars));
    
    // --- Totals Section (Revised) ---
    // This section will derive subtotal, tax, and total from data.totals (parsed HTML),
    // and use the authoritative discount from data.discount (via additionalData).
    // It also sets finalTotalValueStr for the payment section.

    let subtotalText, discountText, taxText, totalTextForDisplay, totalSeparator;
    // finalTotalValueStr is now declared at the top of the function and initialized.

    const authoritativeDiscountExists = data.discount !== undefined && data.discount !== null && parseFloat(data.discount) > 0;
    
    if (data.totals && data.totals.length > 0) {
      data.totals.forEach(totalEntry => {
        const label = totalEntry.label.replace(':', '').toLowerCase();
        const valueStr = totalEntry.value; // Value from HTML, e.g., "$123.45" or "-$50.00"

        if (label.includes('subtotal')) {
          subtotalText = formatTotalLine('Subtotal:', valueStr, paperWidthChars);
          // logger.log(`[formatStructuredReceipt] Found Subtotal from HTML: ${subtotalText}`);
        } else if (label.includes('tax')) {
          taxText = formatTotalLine('Tax:', valueStr, paperWidthChars);
          // logger.log(`[formatStructuredReceipt] Found Tax from HTML: ${taxText}`);
        } else if (label.includes('total')) {
          totalTextForDisplay = formatTotalLine('Total:', valueStr, paperWidthChars);
          totalSeparator = '='.repeat(paperWidthChars);
          // logger.log(`[formatStructuredReceipt] Found Total from HTML: ${totalTextForDisplay}`);
          
          // Capture finalTotalValueStr for payment section from the HTML total's value
          const valueNum = parseFloat(String(valueStr).replace(/[^\d.-]/g, ''));
          if (!isNaN(valueNum)) {
            finalTotalValueStr = formatCurrency(valueNum, currencyCode);
            // logger.log(`[formatStructuredReceipt] Updated finalTotalValueStr for payment: ${finalTotalValueStr}`);
          }
        } else if (label.includes('discount')) {
          // HTML discount line is processed here only if no authoritative discount exists.
          if (!authoritativeDiscountExists) {
            const htmlDiscountValueNum = parseFloat(String(valueStr).replace(/[^\d.-]/g, ''));
            if (!isNaN(htmlDiscountValueNum) && htmlDiscountValueNum !== 0) { 
                 // HTML value is already formatted, e.g., "-$50.00"
                 discountText = formatTotalLine('Discount:', valueStr, paperWidthChars);
                 // logger.log(`[formatStructuredReceipt] Using Discount from HTML (no authoritative): ${discountText}`);
            }
          } else {
            // logger.log(`[formatStructuredReceipt] Ignoring HTML discount line as authoritative discount will be used.`);
          }
        }
      });
    }

    // Generate authoritative discount line if it exists (this will override HTML discount if both were found)
    if (authoritativeDiscountExists) {
      const authDiscountAmount = parseFloat(data.discount); // This is the actual discount amount, e.g., 1586.50
      const authDiscountType = data.discount_type || 'fixed';
      // data.discount_value is the original pre-calculated value for the discount label (e.g., 50 for 50%)
      const authDiscountLabelDetail = data.discount_value || 0; 
      
      const discountLabel = `Discount${authDiscountType === 'percentage' ? ` (${authDiscountLabelDetail}%)` : ''}`;
      const formattedAuthDiscountAmount = formatCurrency(authDiscountAmount, currencyCode); // e.g., "$1586.50"

      // Display authoritative discount as a negative value
      discountText = formatTotalLine(`${discountLabel}:`, `-${formattedAuthDiscountAmount}`, paperWidthChars);
      // logger.log(`[formatStructuredReceipt] Using Authoritative Discount line: ${discountText}`);
    }

    // Add processed totals to receipt in correct order: Subtotal, Discount, Tax, Total
    if (subtotalText) {
      receipt.push(subtotalText);
      // logger.log('[formatStructuredReceipt] Added Subtotal line to receipt.');
    }
    if (discountText) { // This will be the authoritative one if it existed, otherwise from HTML if no authoritative
      receipt.push(discountText);
      // logger.log('[formatStructuredReceipt] Added Discount line to receipt.');
    }
    if (taxText) {
      receipt.push(taxText);
      // logger.log('[formatStructuredReceipt] Added Tax line to receipt.');
    }
    if (totalTextForDisplay) {
      if (totalSeparator) receipt.push(totalSeparator);
      receipt.push(totalTextForDisplay);
      if (totalSeparator) receipt.push(totalSeparator);
      // logger.log('[formatStructuredReceipt] Added Total line(s) to receipt.');
    }
  } else {
    receipt.push(formatReceiptItemLine('No items found', '0.00', '1', paperWidthChars, currencyCode));
    // If no items, finalTotalValueStr remains '$0.00' which is appropriate for payment section
  }
  receipt.push('-'.repeat(paperWidthChars)); // Separator after items and their totals, or after "No items found" message

  // The old "Totals Section" loop (previously lines 527-549) is now fully replaced by the logic above.
  // finalTotalValueStr is now correctly set for the Payment Section below. 

  //receipt.push(COMMANDS.LINE_FEED); // Spacer before payment

  // --- Payment Section ---
  receipt.push(COMMANDS.ALIGN_LEFT);
  receipt.push(formatTotalLine('Payment Method:', data.paymentMethod || 'N/A', paperWidthChars));
  receipt.push(formatTotalLine('Amount Paid:', finalTotalValueStr, paperWidthChars));
  // Removed line feed after payment for Request 5 (less padding before QR)

  // --- QR Code for Sales ID ---
  if (data.receiptNumber) {
    receipt.push(COMMANDS.ALIGN_CENTER);
    // Removed 'Sales ID:' text label
    receipt.push(COMMANDS.STORE_QR_CODE(data.receiptNumber));
    receipt.push(COMMANDS.SET_QR_CELL_SIZE(String.fromCharCode(5))); // Size 5
    receipt.push(COMMANDS.SET_QR_ERROR_LEVEL(COMMANDS.QR_ERROR_LEVEL_M));
    receipt.push(COMMANDS.PRINT_QR_CODE());
    // Removed line feed after QR
  }

  // --- Printer Settings Header/Footer (Request 6) ---
  if (data.printerSettingsHeaderText) {
    //receipt.push(COMMANDS.LINE_FEED); // Add a line feed before this section
    receipt.push(COMMANDS.ALIGN_CENTER);
    data.printerSettingsHeaderText.split('\n').forEach(line => receipt.push(line.trim()));
  }
  if (data.printerSettingsFooterText) {
    //receipt.push(COMMANDS.LINE_FEED); // Add a line feed before this section
    receipt.push(COMMANDS.ALIGN_CENTER);
    data.printerSettingsFooterText.split('\n').forEach(line => receipt.push(line.trim()));
  }

  // --- Footer Notes (from HTML) ---
  if (data.footerNotes && data.footerNotes.length > 0) {
    //receipt.push(COMMANDS.LINE_FEED); // Add a line feed before this section for separation
    receipt.push(COMMANDS.ALIGN_CENTER);
    data.footerNotes.forEach(note => receipt.push(note));
    receipt.push(COMMANDS.LINE_FEED); // Spacer after notes (existing)
  }

  // --- Final Cut ---
  receipt.push(COMMANDS.FEED_LINES(2));
  receipt.push(COMMANDS.PAPER_CUT); // Single cut command at the end

  return receipt.join(COMMANDS.LINE_FEED);
};

/**
 * Fetches store information from the database
 * @param {string} tenantId - The tenant ID for the store
 * @returns {Promise<object>} Store information
 */
const fetchStoreInfo = async (tenantId) => {
  if (!tenantId) {
    logger.warn('No tenantId provided, using default store info');
    return null;
  }

  try {
    const [rows] = await pool.execute(
      `SELECT name, address, phone, email, currency_code 
       FROM stores 
       WHERE tenant_id = ? 
       LIMIT 1`,
      [tenantId]
    );
    
    if (rows.length === 0) {
      logger.warn('No store found for tenant_id:', tenantId);
      return null;
    }
    
    return rows[0];
  } catch (error) {
    logger.error('Error fetching store info:', error);
    return null;
  }
}

/**
 * Extract structured receipt data from HTML content
 * @param {string} html - HTML receipt
 * @param {string} tenantId - Optional tenant ID to fetch store info
 * @returns {Promise<object>} - Structured receipt data
 */
const extractReceiptData = async (html, tenantId = null) => {
  // Default values
  const data = {
    storeName: 'ZETTAZ STORE',
    storeAddressLines: [
      'Address not configured',
      'Please update store settings'
    ],
    storeTel: 'Tel: Not configured',
    storeEmail: 'Email: Not configured',
    items: [],
    totals: [],
    date: '',
    receiptNumber: '',
    cashierName: '',
    customerName: '',
    paymentMethod: 'Cash',
    footerNotes: [
      'Thank you for shopping with us!',
      'Please come again!',
      'For returns, please present this receipt within 30 days'
    ]
  };

  try {
    // Try to fetch store info from database if tenantId is provided
    if (tenantId) {
      try {
        const storeInfo = await fetchStoreInfo(tenantId);
        if (storeInfo) {
          // Update store info from database
          data.storeName = storeInfo.name || data.storeName;
          data.storeAddressLines = storeInfo.address ? 
            storeInfo.address.split('\n').filter(line => line.trim()) : 
            data.storeAddressLines;
          data.storeTel = storeInfo.phone ? `Tel: ${storeInfo.phone}` : data.storeTel;
          data.storeEmail = storeInfo.email ? `Email: ${storeInfo.email}` : data.storeEmail;
        }
      } catch (error) {
        logger.error('Error in extractReceiptData while fetching store info:', error);
        // Continue with default values if there's an error
      }
    }

    logger.log('Starting Cheerio receipt data extraction. HTML length:', html.length);

    if (html.includes('&lt;') || html.includes('&gt;')) {
      logger.log('HTML contains entities, decoding...');
      html = decodeHtmlEntities(html);
      logger.log('HTML decoded. New length:', html.length);
    }

    const $ = cheerio.load(html);

    // Extract store name (override database value if present in HTML)
    const storeNameText = $('h2.store-name').text().trim();
    if (storeNameText) {
      data.storeName = storeNameText;
      logger.log(`Store Name: '${data.storeName}'`);
    }
    
    // Extract cashier name from HTML if not already set
    if (!data.cashierName) {
      // logger.log('[extractReceiptData] Attempting to extract cashier name from HTML');
      
      // Try different selectors to find the cashier name
      const selectors = [
        // Exact class names
        '.cashier-name', 
        '.cashier',
        // Elements with 'cashier' in class
        '[class*="cashier"]',
        // Elements containing 'Cashier:' text
        'p:contains("Cashier:")',
        'div:contains("Cashier:")',
        'span:contains("Cashier:")',
        // Common POS receipt patterns
        '.cashier-info',
        '.cashier-label',
        '.sale-cashier',
        '.transaction-cashier'
      ];
      
      let cashierNameText = null;
      
      // Try each selector until we find a match
      for (const selector of selectors) {
        const element = $(selector).first();
        if (element.length > 0) {
          cashierNameText = element.text()
            .replace(/cashier:/gi, '')
            .replace(/^\s*:\s*/, '')  // Remove leading colon if any
            .trim();
          
          if (cashierNameText) {
            // logger.log(`Found cashier name using selector '${selector}': '${cashierNameText}'`);
            break;
          }
        }
      }
      
      // If still not found, look for any text containing 'cashier'
      if (!cashierNameText) {
        // logger.log('Cashier not found with standard selectors, searching all text...');
        $('p, div, span, td, th').each((i, el) => {
          const text = $(el).text().trim();
          if (text.toLowerCase().includes('cashier') && !cashierNameText) {
            cashierNameText = text
              .replace(/cashier:/gi, '')
              .replace(/^\s*:\s*/, '')
              .trim();
            return false; // Exit the loop once found
          }
        });
      }
      
      if (cashierNameText) {
        data.cashierName = cashierNameText;
        // logger.log(`Extracted cashier name from HTML: '${data.cashierName}'`);
      } else {
        // logger.log('No cashier name found in HTML');
        // Don't set a default value here, let it be handled by the caller
      }
    }

    // Extract store address, tel, email from HTML if present
    $('div.store-contact-info p.address-line').each((i, el) => {
      const line = $(el).text().trim();
      if (line) {
        if (i === 0) data.storeAddressLines = [];
        data.storeAddressLines[i] = line;
      }
    });

    const telText = $('div.store-contact-info p.tel-line').text().trim();
    if (telText) data.storeTel = telText;

    const emailText = $('div.store-contact-info p.email-line').text().trim();
    if (emailText) data.storeEmail = emailText;

    // Extract receipt number, date, payment method, etc.
    const receiptNumText = $('p.receipt-number').text().trim();
    if (receiptNumText) {
      data.receiptNumber = receiptNumText.replace('Receipt #:', '').trim();
    }

    const dateText = $('p.receipt-date').text().trim();
    if (dateText) {
      data.date = dateText.replace('Date:', '').trim();
    }

    const paymentMethodText = $('p.payment-method').text().trim();
    if (paymentMethodText) {
      data.paymentMethod = paymentMethodText.replace('Payment Method:', '').trim();
    }

    // Extract cashier and customer info
    let cashierText = $('p.cashier-info, .cashier-info, [class*="cashier"]').first().text().trim();
    if (!cashierText) {
      // Try to find any element containing 'cashier' in the receipt header
      $('p, div, span').each((i, el) => {
        const text = $(el).text().trim();
        if (text.toLowerCase().includes('cashier') && !cashierText) {
          cashierText = text.replace(/cashier:/i, '').trim();
        }
      });
    }
    if (cashierText) {
      data.cashierName = cashierText.replace(/^[^\w]*cashier[^\w]*/i, '').trim();
    }

    const customerText = $('p.customer-info').text().trim();
    if (customerText) {
      data.customerName = customerText.replace('Customer:', '').trim();
    }

    // Extract items
    const $itemsSection = $('#receipt-items');
    if ($itemsSection.length) {
      // Extract items and discount information from the receipt
      $('div.receipt-item, tr.receipt-item, table tr').each((i, el) => {
        const $el = $(el);
        const itemName = $el.find('.item-name, .name, td:nth-child(1)').text().trim();
        const itemPrice = $el.find('.item-price, .price, td:nth-child(2)').text().trim();
        const itemQty = $el.find('.item-qty, .qty, td:nth-child(3)').text().trim() || '1';
        
        // Debug log the raw item data
        // logger.log(`[extractReceiptData] Raw item found: name='${itemName}', price='${itemPrice}', qty='${itemQty}'`);
        
        // Enhanced discount detection - check multiple signals
        const fullText = $el.text().toLowerCase();
        const nameText = itemName.toLowerCase();
        const priceText = itemPrice.toLowerCase();
        
        // Check for discount indicators in name or full row text
        const discountKeywords = ['discount', 'promo', 'coupon', 'off', '%'];
        const isDiscountKeyword = discountKeywords.some(keyword => fullText.includes(keyword));
        const hasPercentage = fullText.includes('%');
        const hasNegativePrice = priceText.includes('-') || nameText.includes('-');
        
        // Determine if this is a discount item
        const isDiscount = isDiscountKeyword || (hasPercentage && hasNegativePrice);
        
        if (isDiscount) {
          // Try to extract discount amount but DO NOT add it as an item
          // Just capture the discount value for use in the summary section
          const amountMatch = text.match(/(\d+\.?\d*)/);
          if (amountMatch) {
            data.discount = parseFloat(amountMatch[1]);
            data.discount_type = text.includes('%') ? 'percentage' : 'fixed';
            data.discount_value = data.discount_type === 'percentage' ? data.discount : '';
            // logger.log(`[extractReceiptData] Extracted discount: ${data.discount} (${data.discount_type}${data.discount_type === 'percentage' ? ': ' + data.discount_value + '%' : ''})`);
          }
          // Skip adding this as an item since it's a discount that will be shown in the summary
        } else if (itemName && itemPrice) {
          // Collect industry-specific attribute lines (show_on_receipt fields)
          const attrLines = [];
          $el.find('.item-attr').each((_, attrEl) => {
            const attrText = $(attrEl).text().trim();
            if (attrText) attrLines.push(`  ${attrText}`);
          });
          // Append attribute lines to item name so they print as sub-lines
          const fullItemName = attrLines.length > 0
            ? `${itemName}\n${attrLines.join('\n')}`
            : itemName;
          // This is a regular item
          data.items.push({
            name: fullItemName,
            price: itemPrice,
            qty: itemQty
          });
        }
      });
      
      // Extract totals if available
      $('.total-line, tfoot tr').each((i, el) => {
        const $el = $(el);
        const label = $el.find('.label, th').text().toLowerCase().trim();
        const value = $el.find('.value, td').last().text().trim();
        
        if (label.includes('subtotal')) {
          data.subtotal = parseFloat(value.replace(/[^0-9.-]+/g, ''));
        } else if (label.includes('tax') || label.includes('gst') || label.includes('vat')) {
          data.tax = parseFloat(value.replace(/[^0-9.-]+/g, ''));
        } else if (label.includes('total') && !label.includes('subtotal')) {
          data.total = parseFloat(value.replace(/[^0-9.-]+/g, ''));
        } else if ((label.includes('discount') || label.includes('promo')) && !data.discount) {
          // If we didn't find discount in items, check totals
          data.discount = Math.abs(parseFloat(value.replace(/[^0-9.-]+/g, '')));
          data.discount_type = value.includes('%') ? 'percentage' : 'fixed';
          data.discount_value = data.discount_type === 'percentage' ? data.discount : '';
        }
      });
    }

    // Extract totals
    const $totalsSection = $('#receipt-totals');
    if ($totalsSection.length) {
      $totalsSection.find('.receipt-total-row').each((i, el) => {
        const $totalRow = $(el);
        const totalLabel = $totalRow.find('.total-label').text().trim();
        const totalValue = $totalRow.find('.total-value').text().trim();
        
        if (totalLabel && totalValue) {
          data.totals.push({ label: totalLabel, value: totalValue });
        }
      });
    }

    // Extract footer notes using our helper function
    extractFooterNotes($, data);

    logger.log('Successfully extracted receipt data');
    return data;
    
  } catch (error) {
    logger.error('Error in extractReceiptData:', error);
    // Return default data with error note
    data.footerNotes.unshift('Error generating receipt details. Using default information.');
    return data;
  }
};

/**
 * Convert HTML content to ESC/POS commands
 * @param {string} htmlContent - HTML content
 * @param {number} paperWidth - Paper width
 * @param {string} tenantId - Tenant ID
 * @param {object|string} additionalData - Additional data for the receipt (cashierName, customerName, discount)
 * @returns {Buffer} - ESC/POS commands
 */
const convertHtmlToEscpos = async (htmlContent, paperWidth = DEFAULT_PAPER_WIDTH, tenantId = null, additionalData = null, structuredData = null) => {
  try {
    // Extract structured data from HTML
    const defaults = await extractReceiptData(structuredData ? '' : htmlContent, tenantId);
    const receiptData = structuredData ? { ...defaults, ...structuredData } : defaults;
    
    // Log receipt data and additional data for debugging
    // logger.log('[convertHtmlToEscpos] Original receiptData:', JSON.stringify({
    //   hasCustomerName: !!receiptData.customerName,
    //   hasCashierName: !!receiptData.cashierName,
    //   hasDiscount: receiptData.discount !== undefined
    // }));
    // logger.log('[convertHtmlToEscpos] additionalData:', additionalData ? 
    //   JSON.stringify(additionalData) : 'null');
    
    // Support both string (backward compatibility) and object format
    const isLegacyFormat = typeof additionalData === 'string';
    const cashierName = isLegacyFormat ? additionalData : 
                        (additionalData && additionalData.cashierName);
    
    // Handle cashier name
    if (cashierName && cashierName.trim()) {
      // Check if cashier name is a valid name and not a placeholder
      if (cashierName.trim().toLowerCase() !== 'cashier' && 
          cashierName.trim().toLowerCase() !== 'n/a') {
        receiptData.cashierName = cashierName.trim();
        // logger.log(`[convertHtmlToEscpos] Using provided cashier name: '${receiptData.cashierName}'`);
      } else {
        // logger.log(`[convertHtmlToEscpos] Ignoring placeholder cashier name: '${cashierName.trim()}'`);
        delete receiptData.cashierName;
      }
    } else if (receiptData.cashierName && 
               receiptData.cashierName.trim() && 
               receiptData.cashierName.trim().toLowerCase() !== 'cashier' && 
               receiptData.cashierName.trim().toLowerCase() !== 'n/a') {
      // logger.log(`[convertHtmlToEscpos] Using cashier name from receipt data: '${receiptData.cashierName}'`);
    } else {
      // Clear the cashier name if it's missing or just a placeholder value
      delete receiptData.cashierName;
      // logger.log('[convertHtmlToEscpos] No valid cashier name available');
    }
    
    // Handle customer name if provided
    if (!isLegacyFormat && additionalData && additionalData.customerName) {
      const customerName = additionalData.customerName.trim();
      if (customerName) {
        receiptData.customerName = customerName;
        // logger.log(`[convertHtmlToEscpos] Using provided customer name: '${customerName}'`);
      }
    } else {
      // logger.log('[convertHtmlToEscpos] No valid customer name provided in additionalData');
    }
    
    // Handle discount information if provided
    if (!isLegacyFormat && additionalData && additionalData.discount) {
      receiptData.discount = parseFloat(additionalData.discount);
      receiptData.discount_type = additionalData.discountType || 'fixed';
      receiptData.discount_value = additionalData.discountValue || 0;
      
      // CRITICAL FIX: Mark the discount with a special flag for proper positioning
      receiptData._discount_after_subtotal = true;
      
      // logger.log(`[convertHtmlToEscpos] Using provided discount: ${receiptData.discount} (${receiptData.discount_type}${receiptData.discount_type === 'percentage' ? ': ' + receiptData.discount_value + '%' : ''})`);
      // logger.log('[convertHtmlToEscpos] Special flag added to ensure discount appears after subtotal');
    } else {
      logger.log('[convertHtmlToEscpos] No valid discount provided in additionalData');
    }
    
    // Ensure discount is properly passed to formatStructuredReceipt (double-check)
    // logger.log('[convertHtmlToEscpos] Final receiptData before formatting:', JSON.stringify({
    //   hasCustomerName: !!receiptData.customerName, 
    //   customerName: receiptData.customerName,
    //   hasCashierName: !!receiptData.cashierName,
    //   cashierName: receiptData.cashierName,
    //   hasDiscount: receiptData.discount !== undefined,
    //   discount: receiptData.discount,
    //   discount_type: receiptData.discount_type,
    //   discount_value: receiptData.discount_value
    // }));
    
    // Format the receipt with ESC/POS commands
    const storeDetails = await fetchStoreInfo(tenantId);
    const storeCurrencyCode = storeDetails?.currency_code || 'USD';
    logger.log(`[convertHtmlToEscpos] Using currency code for formatting: ${storeCurrencyCode}`);
    const escposText = formatStructuredReceipt(receiptData, paperWidth, storeCurrencyCode);

    const initCmd = '\x1B\x40'; // ESC @ - Initialize Printer
    const codepageCmd = '\x1B\x74\x13'; // ESC t 19 (0x13) - Select PC858 (includes Euro)
    
    const fullEscposText = initCmd + codepageCmd + escposText;
    logger.log(`[convertHtmlToEscpos] Initializing printer and attempting to set codepage to PC858 (19).`);
    // Convert to buffer with 'latin1' encoding for codepage compatibility
    return Buffer.from(fullEscposText, 'latin1');
  } catch (error) {
    logger.error('Error converting HTML to ESC/POS:', error);
    // Fallback to simple text receipt on error
    const errorMessage = `ERROR: ${error.message}\n\nPrinting simplified receipt...\n\n`;
    return Buffer.from(errorMessage + htmlContent.replace(/<[^>]*>/g, '').trim(), 'utf8');
  }
};

/**
 * Create a simple text receipt
 * @param {string} text - Text content for the receipt
 * @returns {Buffer} - Formatted text buffer
 */
const createSimpleReceipt = (text) => {
  try {
    // Initialize with reset command
    let receipt = COMMANDS.INITIALIZE;
    
    // Add text with line feeds
    receipt += text.split('\n').map(line => line.trim()).join('\n');
    
    // Add some space and cut the paper
    receipt += '\n\n\n';
    receipt += COMMANDS.FEED_LINES(2);
    receipt += COMMANDS.PAPER_CUT;
    
    return Buffer.from(receipt, 'binary');
  } catch (error) {
    logger.error('Error creating simple receipt:', error);
    // Return a minimal error message if something goes wrong
    return Buffer.from('Error: Could not generate receipt.\n\n', 'binary');
  }
};

/**
 * Send print data to a network printer
 * @param {string} printerAddress - IP address of the printer
 * @param {number} port - Port number (default: 9100)
 * @param {Buffer|string} data - Data to send to the printer
 * @returns {Promise<boolean>} - True if successful
 */
const printToNetworkPrinter = async (printerAddress, port = 9100, data) => {
  return new Promise((resolve, reject) => {
    try {
      // Parse IP address and port
      const [ip, customPort] = printerAddress.split(':');
      const actualPort = customPort ? parseInt(customPort, 10) : port;
      
      // Validate data
      if (!data) {
        return reject(new Error('No print data provided'));
      }
      
      // Ensure data is a Buffer
      const printData = Buffer.isBuffer(data) ? data : Buffer.from(data);
      logger.log(`Preparing to send ${printData.length} bytes to printer ${ip}:${actualPort}`);
      
      // Create socket connection
      const socket = new net.Socket();
      
      // Set a timeout for the connection attempt
      const timeout = setTimeout(() => {
        logger.error(`Connection timeout to printer ${ip}:${actualPort}`);
        socket.destroy();
        reject(new Error('Connection timeout to printer'));
      }, 5000);
      
      // Handle connection errors
      socket.on('error', (err) => {
        clearTimeout(timeout);
        logger.error(`Socket error: ${err.message}`);
        reject(new Error(`Failed to connect to printer: ${err.message}`));
      });
      
      // Handle successful connection
      socket.connect(actualPort, ip, () => {
        logger.log(`Connected to printer at ${ip}:${actualPort}`);
        clearTimeout(timeout);
        
        // Initialize printer
        const initCommand = Buffer.from(COMMANDS.INITIALIZE);
        socket.write(initCommand, (initErr) => {
          if (initErr) {
            socket.destroy();
            return reject(new Error(`Error initializing printer: ${initErr.message}`));
          }
          
          // Send the complete print data (including any cut commands added by the receipt formatter)
          socket.write(printData, (dataErr) => {
            if (dataErr) {
              socket.destroy();
              return reject(new Error(`Error sending data to printer: ${dataErr.message}`));
            }
            
            // Close connection after data is sent
            socket.end();
            logger.log('Print data sent successfully');
            resolve(true);
          });
        });
      });
    } catch (error) {
      logger.error(`Error in network printing: ${error.message}`);
      reject(error);
    }
  });
};

module.exports = {
  // Core functions
  convertHtmlToEscpos,
  createSimpleReceipt,
  printToNetworkPrinter,
  extractReceiptData,
  formatStructuredReceipt,
  formatReceiptItemLine, 
  formatTotalLine,
  decodeHtmlEntities,
  formatCurrency, 
  // Constants
  COMMANDS,
  PAPER_WIDTH,
  CHARS_PER_LINE,
  DEFAULT_PAPER_WIDTH
};
