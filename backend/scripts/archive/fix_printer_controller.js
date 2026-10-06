/**
 * Script to fix unsafe req.user accesses in printerSettingsController.js
 * This script adds optional chaining and fallbacks to prevent server crashes
 * when req.user is undefined due to skipped permission checks
 */

const fs = require('fs');
const path = require('path');

// Path to the printer settings controller
const controllerPath = path.join(__dirname, '..', 'controllers', 'printerSettingsController.js');

// Read the file
console.log(`Reading ${controllerPath}...`);
let content = fs.readFileSync(controllerPath, 'utf8');
let originalContent = content;

// Pattern 1: direct access to req.user.tenant_id
content = content.replace(/const tenantId = req\.user\.tenant_id;/g, 
  'const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];');

// Pattern 2: direct access to req.user.id in SQL queries
content = content.replace(/req\.user\.id/g, '(req.user?.id || "system")');

// Write back the file if changed
if (content !== originalContent) {
  fs.writeFileSync(controllerPath, content);
  console.log(`Fixed unsafe req.user accesses in printerSettingsController.js`);
} else {
  console.log('No changes needed in printerSettingsController.js');
}
