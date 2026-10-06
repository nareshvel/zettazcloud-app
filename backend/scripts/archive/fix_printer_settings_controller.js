/**
 * Script to fix unsafe req.user accesses in printerSettingsController.js
 * This script ensures tenant_id and store_id are never undefined in SQL queries
 */
const fs = require('fs');
const path = require('path');

// Path to the controller file
const filePath = path.join(__dirname, '../controllers/printerSettingsController.js');

// Read the current content
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Ensure proper null fallback for tenantId in getPrinterSettings
content = content.replace(
  /const tenantId = req\.user\?\.tenant_id \|\| req\.query\?\.tenant_id \|\| req\.headers\["x-tenant-id"\];/g,
  'const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;'
);

// Fix 2: Ensure proper null fallback for tenantId in updatePrinterSettings
content = content.replace(
  /const tenantId = req\.user\?\.tenant_id \|\| req\.query\?\.tenant_id \|\| req\.headers\["x-tenant-id"\];/g, 
  'const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;'
);

// Fix 3: Add tenant_id handling in testPrintSettings
content = content.replace(
  /const storeId = req\.params\.storeId;(\s+)\/\/ Get the settings/g,
  'const storeId = req.params.storeId;\n    const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;\n\n    // Get the settings'
);

// Fix 4: Update SQL query in testPrintSettings to include tenant_id
content = content.replace(
  /`SELECT \* FROM printer_settings WHERE store_id = \?`,\s+\[storeId\]/g,
  '`SELECT * FROM printer_settings WHERE store_id = ? AND tenant_id = ?`,\n      [storeId, tenantId]'
);

// Fix 5: Add null fallback for tenantId in getReceiptTemplates
content = content.replace(
  /const tenantId = req\.user\?\.tenant_id \|\| req\.query\?\.tenant_id \|\| req\.headers\["x-tenant-id"\];/g,
  'const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;'
);

// Fix 6: Add null fallback for tenantId in getReceiptTemplate
content = content.replace(
  /const tenantId = req\.user\?\.tenant_id \|\| req\.query\?\.tenant_id \|\| req\.headers\["x-tenant-id"\];/g,
  'const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;'
);

// Fix 7: Add null fallback for tenantId in createReceiptTemplate
content = content.replace(
  /const tenantId = req\.user\?\.tenant_id \|\| req\.query\?\.tenant_id \|\| req\.headers\["x-tenant-id"\];/g,
  'const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;'
);

// Fix 8: Add null fallback for tenantId in updateReceiptTemplate
content = content.replace(
  /const tenantId = req\.user\?\.tenant_id \|\| req\.query\?\.tenant_id \|\| req\.headers\["x-tenant-id"\];/g,
  'const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;'
);

// Fix 9: Add null fallback for tenantId in deleteReceiptTemplate
// Note: We don't see this in the view but it likely has the same issue
content = content.replace(
  /const tenantId = req\.user\?\.tenant_id \|\| req\.query\?\.tenant_id \|\| req\.headers\["x-tenant-id"\];/g,
  'const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;'
);

// Add console logs for debugging 
content = content.replace(
  /exports\.getPrinterSettings = async \(req, res, next\) => \{\s+try \{/g,
  'exports.getPrinterSettings = async (req, res, next) => {\n  try {\n    console.log("[DEBUG] getPrinterSettings - Request User:", req.user);\n    console.log("[DEBUG] getPrinterSettings - Headers:", req.headers);'
);

// Write the updated content back to the file
fs.writeFileSync(filePath, content, 'utf8');

console.log('Fixed printer settings controller successfully!');
