/**
 * Script to fix unsafe req.user accesses in reportsController.js
 * This script adds optional chaining and fallbacks to prevent server crashes
 * when req.user is undefined due to skipped permission checks
 */

const fs = require('fs');
const path = require('path');

// Path to the reports controller
const controllerPath = path.join(__dirname, '..', 'controllers', 'reportsController.js');

// Read the file
console.log(`Reading ${controllerPath}...`);
let content = fs.readFileSync(controllerPath, 'utf8');
let originalContent = content;

// Pattern 1: destructuring from req.user
content = content.replace(/const \{ tenant_id \} = req\.user;/g, 
  'const tenant_id = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];');

// Pattern 2: direct access to req.user.tenant_id
content = content.replace(/const tenantId = req\.user\.tenant_id;/g, 
  'const tenantId = req.user?.tenant_id || req.query?.tenant_id || req.headers["x-tenant-id"];');

// Write back the file if changed
if (content !== originalContent) {
  fs.writeFileSync(controllerPath, content);
  console.log(`Fixed unsafe req.user accesses in reportsController.js`);
} else {
  console.log('No changes needed in reportsController.js');
}
