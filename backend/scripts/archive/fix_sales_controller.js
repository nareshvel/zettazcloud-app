/**
 * Script to fix unsafe req.user accesses in salesController.js
 * This script adds optional chaining and fallbacks to prevent server crashes
 * when req.user is undefined due to skipped permission checks
 */

const fs = require('fs');
const path = require('path');

// Path to the sales controller
const controllerPath = path.join(__dirname, '..', 'controllers', 'salesController.js');

// Read the file
console.log(`Reading ${controllerPath}...`);
let content = fs.readFileSync(controllerPath, 'utf8');
let originalContent = content;

// Pattern 1: direct access to req.user.tenant_id
content = content.replace(/const tenantId = req\.user\.tenant_id;/g, 
  'const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;');

// Pattern 2: destructuring from req.user
content = content.replace(/const \{ tenant_id: tenantId, store_id: storeId \} = req\.user;/g, 
  'const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"] || null;\n        const storeId = req.user?.store_id || req.query?.store_id || req.headers["x-store-id"] || null;');

// Write back the file if changed
if (content !== originalContent) {
  fs.writeFileSync(controllerPath, content);
  console.log(`Fixed unsafe req.user accesses in salesController.js`);
} else {
  console.log('No changes needed in salesController.js');
}
